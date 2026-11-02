/**
 * Evo — client runtime API.
 *
 * What this file owns:
 *   • `useVariant(componentKey)`         → sticky assignment, drawn SYNCHRONOUSLY
 *                                          from the bundled fixed allocation
 *   • `trackExposure(...)`               → log that a visitor saw a variant
 *   • `trackInteraction(...)`            → log an interaction with a variant
 *   • `identify(email)`                  → link the anonymous visitorId to an email
 *                                          and adopt the person's existing arms
 *
 * Evo Lab Phase 0 (irp-funnel-server/docs/designs/evo-lab.md §5):
 *   • Every first assignment logs ONE `assignment` event carrying
 *     `meta.evo = { source, p }` (the intention-to-treat denominator and its
 *     propensity) and `meta.ctx` (pre-treatment context of THIS page view).
 *   • The draw no longer waits on `/api/evo/weights`: the old async fetch lost
 *     the race on almost every first visit, so logged "MAB" weights never
 *     matched what visitors actually got.
 *   • Dev-switcher overrides are recorded (`source: 'forced'`, `meta.evo.forced`).
 *   • The page-hide beacon is sent as text/plain (CORS-safelisted); an
 *     application/json beacon to the API origin can be dropped silently.
 *
 * Telemetry MUST NEVER break UX — every failure is swallowed with a console
 * warning.
 */

import { browser } from '$app/environment';
import { get, writable } from 'svelte/store';
import store from '../../components/store.ts';
import { EVO_COMPONENTS, activeVariantsOf, allocationOf } from './config.ts';
import {
  getVisitorId,
  getCommitHash,
  getCommitMessage,
  getKnownEmail,
  rememberEmail,
  getAssignments,
  setAssignment,
  isAssignmentLogged,
  markAssignmentLogged,
  isForced,
  markForced,
  isReturningVisitor,
} from './identity.ts';
import { getAttribution } from '../attribution.ts';

// Reactivity store for instantaneous dev switching
export const activeVariants = writable<Record<string, string>>({});

if (browser) {
  activeVariants.set(getAssignments());
}

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
export type EvoEventType = 'assignment' | 'exposure' | 'interaction';
export type EvoAssignmentSource = 'fixed' | 'adopted' | 'forced' | 'legacy_sticky';

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

/** Stamp the delivery path so the probe can compare beacon vs fetch arrival. */
function withVia(events: EvoEventPayload[], via: 'fetch' | 'beacon'): EvoEventPayload[] {
  return events.map((e) => ({ ...e, meta: { ...(e.meta ?? {}), via } }));
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
      body: JSON.stringify({ events: withVia(batch, 'fetch') }),
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
// Pre-treatment context (attached to assignment events only).
// ─────────────────────────────────────────────────────────────────────────────
function deviceClass(): 'mobile' | 'tablet' | 'desktop' | 'unknown' {
  try {
    const ua = navigator.userAgent || '';
    if (/iPad|Tablet|PlayBook|Silk|(Android(?!.*Mobile))/i.test(ua)) return 'tablet';
    if (/Mobi|iPhone|iPod|Android.*Mobile|Windows Phone/i.test(ua)) return 'mobile';
    return 'desktop';
  } catch {
    return 'unknown';
  }
}

function isDevEnv(): boolean {
  try {
    if (import.meta.env.DEV) return true;
    const h = window.location.hostname;
    return h === 'localhost' || h === '127.0.0.1' || h.endsWith('.local');
  } catch {
    return false;
  }
}

/** Context known before the variant could have changed anything. */
export function getEvoContext(): Record<string, unknown> {
  const ctx: Record<string, unknown> = {
    device: deviceClass(),
    lang: '',
    landingSource: '',
    landingMedium: '',
    landingCampaign: '',
    referrerHost: '',
    returning: false,
    env: isDevEnv() ? 'dev' : 'prod',
    ua: '',
  };
  try {
    ctx.lang = (navigator.language || '').slice(0, 16);
    ctx.ua = (navigator.userAgent || '').slice(0, 120);
    ctx.returning = isReturningVisitor();
    const first = getAttribution().firstTouch;
    if (first) {
      ctx.landingSource = first.source || '';
      ctx.landingMedium = first.medium || '';
      ctx.landingCampaign = first.campaign || '';
      ctx.referrerHost = first.referrer || '';
    }
  } catch {}
  return ctx;
}

// ─────────────────────────────────────────────────────────────────────────────
// Assignment — synchronous draw from the bundled fixed allocation, sticky
// thereafter, logged once as an `assignment` event.
// ─────────────────────────────────────────────────────────────────────────────
function drawFromAllocation(alloc: Record<string, number>): { key: string; p: number } {
  const keys = Object.keys(alloc);
  let r = Math.random();
  for (const k of keys) {
    r -= alloc[k];
    if (r <= 0) return { key: k, p: alloc[k] };
  }
  const last = keys[keys.length - 1];
  return { key: last, p: alloc[last] };
}

function logAssignment(
  componentKey: string,
  versionKey: string,
  source: EvoAssignmentSource,
  p: number | null,
  extra: Record<string, unknown> = {},
): void {
  if (!browser) return;
  const evo: Record<string, unknown> = { source, p, ...extra };
  if (source === 'forced') evo.forced = true;
  enqueue(makeEvent('assignment', componentKey, versionKey, { evo, ctx: getEvoContext() }));
  markAssignmentLogged(componentKey);
}

export function useVariant(componentKey: string): string {
  const cfg = EVO_COMPONENTS[componentKey];
  if (!cfg || !cfg.variants.length) return 'default';

  const active = activeVariantsOf(cfg);
  if (!active.length) return 'default';

  // SSR-stable: always return the first variant; the client will realign.
  if (!browser) return active[0].key;

  const existing = getAssignments()[componentKey];
  if (existing && active.some((v) => v.key === existing)) {
    // A sticky assignment with no assignment event predates Evo Lab (or was
    // forced): log it once so the visitor is visible, but it never reaches
    // verdicts (unknown propensity).
    if (!isAssignmentLogged(componentKey)) {
      logAssignment(componentKey, existing, isForced(componentKey) ? 'forced' : 'legacy_sticky', null);
    }
    const curStore = get(activeVariants);
    if (curStore[componentKey] !== existing) {
      activeVariants.update((s) => ({ ...s, [componentKey]: existing }));
    }
    return existing;
  }

  // New assignment (or the stored variant was retired → reassign; that is
  // recorded as `reassignedFrom`, not as a crossover).
  const { key: pick, p } = drawFromAllocation(allocationOf(cfg));
  setAssignment(componentKey, pick);
  logAssignment(componentKey, pick, 'fixed', p, existing ? { reassignedFrom: existing } : {});
  activeVariants.update((s) => ({ ...s, [componentKey]: pick }));
  return pick;
}

/**
 * Manually force a variant assignment (used by the dev-only switcher). The
 * component is marked forced in this browser, so its events are excluded from
 * analysis.
 */
export function forceVariant(componentKey: string, variantKey: string): void {
  if (!browser) return;
  markForced(componentKey);
  setAssignment(componentKey, variantKey);
  logAssignment(componentKey, variantKey, 'forced', null);
  activeVariants.update((s) => ({ ...s, [componentKey]: variantKey }));
}

export function getVariants(componentKey: string): string[] {
  return (EVO_COMPONENTS[componentKey]?.variants ?? []).map((v) => v.key);
}

/**
 * Adopt the person's existing arms (returned by /api/evo/identify) for
 * components this browser has NOT assigned yet, so a returning person keeps
 * their variant on a new device. Already-assigned components are never
 * changed mid-visit.
 */
function adoptAssignments(assignments: Record<string, string> | undefined): void {
  if (!browser || !assignments) return;
  const current = getAssignments();
  for (const [componentKey, variantKey] of Object.entries(assignments)) {
    if (current[componentKey]) continue;
    const cfg = EVO_COMPONENTS[componentKey];
    if (!cfg || !activeVariantsOf(cfg).some((v) => v.key === variantKey)) continue;
    setAssignment(componentKey, variantKey);
    logAssignment(componentKey, variantKey, 'adopted', null);
    activeVariants.update((s) => ({ ...s, [componentKey]: variantKey }));
  }
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
  let m: Record<string, unknown> | null = meta ?? null;
  // Every event from a force-assigned component carries the flag.
  if (browser && type !== 'assignment' && isForced(componentKey)) {
    m = { ...(m ?? {}), evo: { ...((m?.evo as Record<string, unknown>) ?? {}), forced: true } };
  }
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
    meta: m,
    timestamp: new Date().toISOString(),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/** Exposures are de-duplicated to one per component × variant × page view. */
const exposedThisView = new Set<string>();
let exposurePath = '';

export function trackExposure(
  componentKey: string,
  versionKey: string,
  meta?: Record<string, unknown>,
): void {
  if (!browser) return;
  const path = window.location.pathname;
  if (path !== exposurePath) {
    exposurePath = path;
    exposedThisView.clear();
  }
  const key = `${componentKey}|${versionKey}`;
  if (exposedThisView.has(key)) return;
  exposedThisView.add(key);
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
 * identified (and potentially paying) user. The response carries the
 * person's existing arms from other devices, adopted for unassigned
 * components.
 *
 * Safe to call repeatedly — the server upserts by visitorId.
 */
export async function identify(email: string): Promise<void> {
  if (!browser || !email) return;
  const clean = email.trim().toLowerCase();
  if (!clean) return;
  rememberEmail(clean);
  try {
    const res = await fetch(`${apiUrl()}/api/evo/identify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visitorId: getVisitorId(), email: clean }),
      keepalive: true,
    });
    if (res.ok) {
      const data = (await res.json().catch(() => null)) as { assignments?: Record<string, string> } | null;
      adoptAssignments(data?.assignments);
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[evo] identify failed', err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Page-hide flush — sendBeacon so in-flight events aren't lost. text/plain is
// a CORS-safelisted type; the server parses it as JSON.
// ─────────────────────────────────────────────────────────────────────────────
if (browser) {
  const beaconFlush = (): void => {
    if (!buffer.length) return;
    const payload = JSON.stringify({ events: withVia(buffer, 'beacon') });
    const url = `${apiUrl()}/api/evo/events/batch`;
    try {
      if (navigator.sendBeacon) {
        const blob = new Blob([payload], { type: 'text/plain;charset=UTF-8' });
        navigator.sendBeacon(url, blob);
      } else {
        void fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
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
