/**
 * Evo — client runtime API.
 *
 * What this file owns:
 *   • `useVariant(componentKey)`         → deterministic, sticky assignment
 *   • `trackExposure(...)`               → log that a visitor saw a variant
 *   • `trackInteraction(...)`            → log an interaction with a variant
 *   • `identify(email)`                  → link the anonymous visitorId to an email
 *
 * Events are buffered and flushed in batches to
 *   POST {API}/api/evo/events/batch
 * Buffered events are also flushed via `navigator.sendBeacon` on pagehide so
 * we don't lose the last exposure before navigation.
 *
 * Telemetry MUST NEVER break UX — every failure is swallowed with a console
 * warning.
 */

import { browser } from '$app/environment';
import { get, writable } from 'svelte/store';
import store from '../../components/store.ts';
import { EVO_COMPONENTS } from './config.ts';
import {
  getVisitorId,
  getCommitHash,
  getCommitMessage,
  getKnownEmail,
  rememberEmail,
  getAssignments,
  setAssignment,
} from './identity.ts';

// Reactivity store for instantaneous dev switching
export const activeVariants = writable<Record<string, string>>({});

if (browser) {
  activeVariants.set(getAssignments());
}

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
export type EvoEventType = 'exposure' | 'interaction';

export interface EvoEventPayload {
  type: EvoEventType;
  componentKey: string;
  versionKey: string;
  commitHash: string;
  commitMessage: string;
  visitorId: string;
  userEmail: string | null;
  sessionId: string | null;
  pagePath: string;
  interactionSubtype: string | null;
  meta: Record<string, unknown> | null;
  timestamp: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// API URL helper — reuses the funnel's canonical `apiURL` getter.
// ─────────────────────────────────────────────────────────────────────────────
function apiUrl(): string {
  try {
    const s = get(store);
    if (s && typeof s.apiURL === 'function') return s.apiURL();
  } catch {}
  return '';
}

// ─────────────────────────────────────────────────────────────────────────────
// Batch buffer — flush every FLUSH_MS or when the page hides.
// ─────────────────────────────────────────────────────────────────────────────
const FLUSH_MS = 2000;
const MAX_BUFFER = 40; // force-flush if buffer grows beyond this
let buffer: EvoEventPayload[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function schedule(): void {
  if (flushTimer) return;
  flushTimer = setTimeout(() => void flush(), FLUSH_MS);
}

async function flush(): Promise<void> {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  if (!buffer.length) return;
  const batch = buffer;
  buffer = [];
  const url = `${apiUrl()}/api/evo/events/batch`;
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events: batch }),
      keepalive: true,
    });
  } catch (err) {
    // Drop on error — re-queuing could cause unbounded growth if the server
    // is down. Observability only; we're OK losing some data.
    // eslint-disable-next-line no-console
    console.warn('[evo] flush failed', err);
  }
}

function enqueue(evt: EvoEventPayload): void {
  buffer.push(evt);
  if (buffer.length >= MAX_BUFFER) {
    void flush();
  } else {
    schedule();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Assignment — random on first render, sticky thereafter.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Global cache for MAB weights fetched from the server.
 * Stored on window to persist across component mounts but re-fetched per session.
 */
let weightsCache: Record<string, Record<string, number>> | null = null;
let weightsPromise: Promise<void> | null = null;

/**
 * Non-blocking fetch of current traffic weights.
 * We don't block render for this - if it's not ready, we fall back to uniform distribution.
 */
function fetchWeights(): void {
  if (!browser || weightsPromise) return;
  
  weightsPromise = fetch(`${apiUrl()}/api/evo/weights`)
    .then(r => r.json())
    .then(data => {
      weightsCache = {};
      for (const [compKey, entry] of Object.entries(data as Record<string, { weights: Record<string, number> }>)) {
        weightsCache[compKey] = entry.weights;
      }
    })
    .catch(() => {
      // Silent failure, weightsCache remains null, fall back to uniform
    });
}

/** 
 * Selects a variant based on the provided weights map, falling back to 
 * uniform random distribution if weights are missing or invalid.
 */
function assignWeightedVariant(weights: Record<string, number> | undefined, activeVariants: {key: string}[]): string {
  if (!weights || Object.keys(weights).length === 0) {
    // Fallback to uniform distribution
    return activeVariants[Math.floor(Math.random() * activeVariants.length)].key;
  }

  // Ensure weights match active variants and sum to ~1.0
  let totalWeight = 0;
  const validWeights: { key: string; weight: number }[] = [];
  
  for (const variant of activeVariants) {
    const w = weights[variant.key];
    if (w !== undefined && w >= 0) {
      validWeights.push({ key: variant.key, weight: w });
      totalWeight += w;
    }
  }

  if (totalWeight <= 0 || validWeights.length === 0) {
    return activeVariants[Math.floor(Math.random() * activeVariants.length)].key;
  }

  // Weighted random selection
  let r = Math.random() * totalWeight;
  for (const { key, weight } of validWeights) {
    r -= weight;
    if (r <= 0) return key;
  }
  
  return validWeights[validWeights.length - 1].key;
}

export function useVariant(componentKey: string): string {
  const cfg = EVO_COMPONENTS[componentKey];
  if (!cfg || !cfg.variants.length) return 'default';
  
  const activeVariantsList = cfg.variants.filter((v) => !v.retiredIn);
  if (!activeVariantsList.length) return 'default';

  // SSR-stable: always return the first variant; the client will realign.
  if (!browser) return activeVariantsList[0].key;

  // Trigger fetch if we haven't yet (doesn't block)
  fetchWeights();

  const existing = getAssignments()[componentKey];
  if (existing && activeVariantsList.some(v => v.key === existing)) {
    // Ensure store is populated for reactivity
    const curStore = get(activeVariants);
    if (curStore[componentKey] !== existing) {
      activeVariants.update(s => ({ ...s, [componentKey]: existing }));
    }
    return existing;
  }

  // New assignment: Use server MAB weights if available, else uniform fallback
  const componentWeights = weightsCache?.[componentKey];
  const pick = assignWeightedVariant(componentWeights, activeVariantsList);
  
  setAssignment(componentKey, pick);
  activeVariants.update(s => ({ ...s, [componentKey]: pick }));
  return pick;
}

/**
 * Manually force a variant assignment (used by Dev Switcher)
 */
export function forceVariant(componentKey: string, variantKey: string): void {
  if (!browser) return;
  setAssignment(componentKey, variantKey);
  activeVariants.update(s => ({ ...s, [componentKey]: variantKey }));
}

export function getVariants(componentKey: string): string[] {
  return (EVO_COMPONENTS[componentKey]?.variants ?? []).map(v => v.key);
}

// ─────────────────────────────────────────────────────────────────────────────
// Event constructors
// ─────────────────────────────────────────────────────────────────────────────
function sessionId(): string | null {
  if (!browser) return null;
  // Reuse the chatbot's session key if present; Evo never creates its own.
  const w = window as unknown as { __EVO_SESSION__?: string };
  return w.__EVO_SESSION__ ?? null;
}

function makeEvent(
  type: EvoEventType,
  componentKey: string,
  versionKey: string,
  meta?: Record<string, unknown>,
  subtype: string | null = null,
): EvoEventPayload {
  return {
    type,
    componentKey,
    versionKey,
    commitHash: getCommitHash(),
    commitMessage: getCommitMessage(),
    visitorId: getVisitorId(),
    userEmail: getKnownEmail(),
    sessionId: sessionId(),
    pagePath: browser ? window.location.pathname : '',
    interactionSubtype: subtype,
    meta: meta ?? null,
    timestamp: new Date().toISOString(),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────
export function trackExposure(
  componentKey: string,
  versionKey: string,
  meta?: Record<string, unknown>,
): void {
  if (!browser) return;
  enqueue(makeEvent('exposure', componentKey, versionKey, meta));
}

export function trackInteraction(
  componentKey: string,
  versionKey: string,
  subtype: string = 'click',
  meta?: Record<string, unknown>,
): void {
  if (!browser) return;
  enqueue(makeEvent('interaction', componentKey, versionKey, meta, subtype));
}

/**
 * Link the anonymous `visitorId` to an email address so that later
 * sales-attribution joins can credit prior anonymous exposures to the
 * identified (and potentially paying) user.
 *
 * Safe to call repeatedly — the server upserts by visitorId.
 */
export async function identify(email: string): Promise<void> {
  if (!browser || !email) return;
  const clean = email.trim().toLowerCase();
  if (!clean) return;
  rememberEmail(clean);
  try {
    await fetch(`${apiUrl()}/api/evo/identify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visitorId: getVisitorId(), email: clean }),
      keepalive: true,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[evo] identify failed', err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Page-hide flush — use sendBeacon so in-flight exposures aren't lost.
// ─────────────────────────────────────────────────────────────────────────────
if (browser) {
  const beaconFlush = (): void => {
    if (!buffer.length) return;
    const payload = JSON.stringify({ events: buffer });
    const url = `${apiUrl()}/api/evo/events/batch`;
    try {
      if (navigator.sendBeacon) {
        const blob = new Blob([payload], { type: 'application/json' });
        navigator.sendBeacon(url, blob);
      } else {
        // Fallback to fetch with keepalive
        void fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payload,
          keepalive: true,
        });
      }
    } catch {}
    buffer = [];
  };
  window.addEventListener('pagehide', beaconFlush);
  window.addEventListener('beforeunload', beaconFlush);
}
