/**
 * Evo — visitor identity + project-version context.
 *
 * Single place that owns:
 *   • visitorId  (anonymous, localStorage-persisted)
 *   • commit hash / message (injected at build time by vite.config.ts)
 *   • sticky variant assignments (localStorage-persisted)
 *   • last-known email (reused from the funnel's existing `userEmail` key)
 *
 * Everything here is SSR-safe: functions return empty/fallback values
 * when not running in the browser.
 */

import { browser } from '$app/environment';

const VISITOR_KEY = 'evoVisitorId';
const ASSIGNMENTS_KEY = 'evoAssignments';
const EMAIL_KEY = 'userEmail'; // reused — already set across the funnel
const ASSIGN_LOGGED_KEY = 'evoAssignLogged'; // components whose assignment event was sent
const FORCED_KEY = 'evoForced'; // components force-assigned by the dev switcher

/** True when this page load created the visitor id (a first-time visitor). */
let createdThisLoad = false;

// ─────────────────────────────────────────────────────────────────────────────
// Visitor ID — stable per browser, created lazily on first access.
// ─────────────────────────────────────────────────────────────────────────────
export function getVisitorId(): string {
  if (!browser) return 'ssr';
  let id = localStorage.getItem(VISITOR_KEY);
  if (!id) {
    // Use crypto.randomUUID where available, fall back to Math.random.
    const rnd =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    id = `evo_${rnd}`;
    createdThisLoad = true;
    try {
      localStorage.setItem(VISITOR_KEY, id);
    } catch {
      // Private mode / storage disabled — id is still valid for this session.
    }
  }
  return id;
}

// ─────────────────────────────────────────────────────────────────────────────
// Project version (commit hash + message). Injected at build time.
// ─────────────────────────────────────────────────────────────────────────────
export function getCommitHash(): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (typeof __EVO_COMMIT__ !== 'undefined' ? __EVO_COMMIT__ : 'unknown') as string;
  } catch {
    return 'unknown';
  }
}

export function getCommitMessage(): string {
  try {
    return (typeof __EVO_COMMIT_MSG__ !== 'undefined' ? __EVO_COMMIT_MSG__ : '') as string;
  } catch {
    return '';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Known email — reused from the funnel's existing `userEmail` key.
// ─────────────────────────────────────────────────────────────────────────────
export function getKnownEmail(): string | null {
  if (!browser) return null;
  try {
    const raw = localStorage.getItem(EMAIL_KEY);
    return raw ? raw.trim().toLowerCase() : null;
  } catch {
    return null;
  }
}

export function rememberEmail(email: string): void {
  if (!browser || !email) return;
  try {
    localStorage.setItem(EMAIL_KEY, email.trim().toLowerCase());
  } catch {}
}

// ─────────────────────────────────────────────────────────────────────────────
// Sticky variant assignments — map of componentKey → variantKey.
// First-render random pick, then sticky for the life of the localStorage.
// ─────────────────────────────────────────────────────────────────────────────
export function getAssignments(): Record<string, string> {
  if (!browser) return {};
  try {
    const raw = localStorage.getItem(ASSIGNMENTS_KEY);
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

export function setAssignment(componentKey: string, variantKey: string): void {
  if (!browser) return;
  try {
    const all = getAssignments();
    all[componentKey] = variantKey;
    localStorage.setItem(ASSIGNMENTS_KEY, JSON.stringify(all));
  } catch {}
}

export function clearAssignments(): void {
  if (!browser) return;
  try {
    localStorage.removeItem(ASSIGNMENTS_KEY);
  } catch {}
}

// ─────────────────────────────────────────────────────────────────────────────
// Evo Lab (Phase 0) — assignment bookkeeping.
// ─────────────────────────────────────────────────────────────────────────────
function readList(key: string): string[] {
  if (!browser) return [];
  try {
    const raw = localStorage.getItem(key);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function addToList(key: string, value: string): void {
  if (!browser) return;
  try {
    const arr = readList(key);
    if (!arr.includes(value)) {
      arr.push(value);
      localStorage.setItem(key, JSON.stringify(arr));
    }
  } catch {}
}

/** Has this browser already sent the `assignment` event for the component? */
export function isAssignmentLogged(componentKey: string): boolean {
  return readList(ASSIGN_LOGGED_KEY).includes(componentKey);
}

export function markAssignmentLogged(componentKey: string): void {
  addToList(ASSIGN_LOGGED_KEY, componentKey);
}

/** Components force-assigned by the dev switcher (excluded from analysis). */
export function isForced(componentKey: string): boolean {
  return readList(FORCED_KEY).includes(componentKey);
}

export function markForced(componentKey: string): void {
  addToList(FORCED_KEY, componentKey);
}

/** A visitor id existed before this page load. */
export function isReturningVisitor(): boolean {
  if (!browser) return false;
  getVisitorId();
  return !createdThisLoad;
}
