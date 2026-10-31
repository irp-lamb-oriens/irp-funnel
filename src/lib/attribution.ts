/**
 * attribution.ts — single source of truth for marketing attribution on the
 * public site (UTM tags, the legacy `?refer=` tag, ad click ids, referrers).
 *
 * How it works
 * ────────────
 *   1. `captureAttribution()` runs on every page load / navigation (from the
 *      root +layout). If the URL carries `utm_*`, `refer`, or an ad click id
 *      (gclid / fbclid / ttclid / msclkid), it records a **touch**. With no
 *      tags but an external `document.referrer` (Google, Instagram, a blog…)
 *      it records an *inferred* touch so organic visits are not lost as
 *      "direct". Plain direct visits record nothing.
 *   2. Touches persist in localStorage, so the tag survives page changes,
 *      tab closes and return visits weeks later (same browser):
 *        • firstTouch — the very first ad/source that brought this visitor.
 *        • lastTouch  — the most recent one before converting.
 *        • touches    — the journey (last 15), oldest → newest.
 *   3. Every lead path (email capture, booking, Lily chat) sends
 *      `attribution: getAttribution()` to the server, which merges it into the
 *      client's consultation doc. Because the server keys clients by email, two
 *      devices that end up booking with the same email are stitched together.
 *
 * Building a link
 * ───────────────
 *   https://www.internationalrelocationpartner.com/?utm_source=instagram
 *     &utm_medium=paid_social&utm_campaign=retargeting_oct&utm_content=video_a
 *   `?refer=xyz` still works and is stored alongside (it maps to `refer`).
 *
 * Portable: no SvelteKit imports, so the same file can be dropped into ILP.
 */

import { getVisitorId } from './evo/identity.ts';

export const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'] as const;
export const CLICK_ID_KEYS = ['gclid', 'fbclid', 'ttclid', 'msclkid'] as const;

/** `?refer=` values we set ourselves on internal redirects — never a source. */
const INTERNAL_REFER_VALUES = new Set(['thankyou', 'thank-you', 'internal']);

const STORAGE_KEY = 'irpAttribution';
const MAX_TOUCHES = 15;
/** Re-landing on the same tagged link within this window is the same touch. */
const DEDUPE_WINDOW_MS = 30 * 60 * 1000;
const MAX_LEN = 200;

const SEARCH_ENGINES = ['google.', 'bing.', 'duckduckgo.', 'yahoo.', 'ecosia.', 'baidu.', 'yandex.'];
const SOCIAL_SITES: Record<string, string> = {
  'facebook.com': 'facebook',
  'm.facebook.com': 'facebook',
  'l.facebook.com': 'facebook',
  'lm.facebook.com': 'facebook',
  'instagram.com': 'instagram',
  'l.instagram.com': 'instagram',
  'youtube.com': 'youtube',
  'm.youtube.com': 'youtube',
  't.co': 'twitter',
  'x.com': 'twitter',
  'twitter.com': 'twitter',
  'linkedin.com': 'linkedin',
  'lnkd.in': 'linkedin',
  'tiktok.com': 'tiktok',
  'reddit.com': 'reddit',
  'pinterest.com': 'pinterest',
  'web.whatsapp.com': 'whatsapp',
};

export interface Touch {
  source: string;
  medium: string;
  campaign: string;
  term: string;
  content: string;
  /** Legacy `?refer=` tag (kept separate so old links keep reporting). */
  refer: string;
  /** Ad platform click id, when present: "gclid:…", "fbclid:…". */
  clickId: string;
  /** Path the visitor landed on (no query string). */
  landingPage: string;
  /** Hostname of document.referrer ('' when direct). */
  referrer: string;
  /** true when no tags were present and source/medium were inferred from the referrer. */
  inferred: boolean;
  capturedAt: string;
}

export interface AttributionEnvelope {
  v: 1;
  visitorId: string;
  firstTouch: Touch | null;
  lastTouch: Touch | null;
  touches: Touch[];
}

// ── helpers ──────────────────────────────────────────────────────────────────

function clean(v: string | null | undefined): string {
  if (!v) return '';
  return String(v).trim().slice(0, MAX_LEN);
}

/** Lower-case + trim so "Instagram" and "instagram " group together. */
function norm(v: string | null | undefined): string {
  return clean(v).toLowerCase();
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return '';
  }
}

function sameTouch(a: Touch | null, b: Touch): boolean {
  if (!a) return false;
  return (
    a.source === b.source &&
    a.medium === b.medium &&
    a.campaign === b.campaign &&
    a.term === b.term &&
    a.content === b.content &&
    a.refer === b.refer
  );
}

function emptyEnvelope(): AttributionEnvelope {
  let visitorId = '';
  try { visitorId = getVisitorId(); } catch { /* SSR / storage blocked */ }
  return { v: 1, visitorId, firstTouch: null, lastTouch: null, touches: [] };
}

function read(): AttributionEnvelope {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.v === 1) {
        if (!parsed.visitorId) {
          try { parsed.visitorId = getVisitorId(); } catch { /* ignore */ }
        }
        if (!Array.isArray(parsed.touches)) parsed.touches = [];
        return parsed as AttributionEnvelope;
      }
    }
  } catch { /* corrupted or storage blocked */ }
  return emptyEnvelope();
}

function write(env: AttributionEnvelope): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(env));
  } catch { /* storage blocked — attribution still rides along in memory */ }
  memory = env;
}

let memory: AttributionEnvelope | null = null;

// ── touch construction ───────────────────────────────────────────────────────

/** Build a touch from a URL + referrer, or null when there is nothing to attribute. */
export function touchFromUrl(href: string, documentReferrer = ''): Touch | null {
  let url: URL;
  try { url = new URL(href); } catch { return null; }
  const p = url.searchParams;

  const referRaw = norm(p.get('refer'));
  const refer = INTERNAL_REFER_VALUES.has(referRaw) ? '' : referRaw;

  let clickId = '';
  for (const k of CLICK_ID_KEYS) {
    const v = clean(p.get(k));
    if (v) { clickId = `${k}:${v}`; break; }
  }

  let source = norm(p.get('utm_source'));
  let medium = norm(p.get('utm_medium'));
  const campaign = norm(p.get('utm_campaign'));
  const term = norm(p.get('utm_term'));
  const content = norm(p.get('utm_content'));

  const refHost = hostOf(documentReferrer);
  const selfHost = url.hostname.replace(/^www\./, '').toLowerCase();
  const externalRef = refHost && refHost !== selfHost ? refHost : '';

  const tagged = !!(source || medium || campaign || term || content || refer || clickId);
  let inferred = false;

  if (!tagged) {
    // No tags: only an external referrer is worth recording.
    if (!externalRef) return null;
    inferred = true;
    if (SEARCH_ENGINES.some((s) => externalRef.includes(s))) {
      source = externalRef.split('.').slice(-2, -1)[0] || externalRef;
      medium = 'organic';
    } else if (SOCIAL_SITES[externalRef]) {
      source = SOCIAL_SITES[externalRef];
      medium = 'organic_social';
    } else {
      source = externalRef;
      medium = 'referral';
    }
  } else {
    // Click ids without utm_source still tell us the platform.
    if (!source && clickId.startsWith('gclid')) { source = 'google'; medium = medium || 'cpc'; }
    if (!source && clickId.startsWith('fbclid')) { source = 'facebook'; medium = medium || 'paid_social'; }
    if (!source && clickId.startsWith('ttclid')) { source = 'tiktok'; medium = medium || 'paid_social'; }
    if (!source && clickId.startsWith('msclkid')) { source = 'bing'; medium = medium || 'cpc'; }
    if (!source && refer) { source = 'refer'; medium = medium || 'tagged_link'; }
  }

  return {
    source,
    medium,
    campaign,
    term,
    content,
    refer,
    clickId,
    landingPage: clean(url.pathname),
    referrer: externalRef,
    inferred,
    capturedAt: new Date().toISOString(),
  };
}

// ── public API ───────────────────────────────────────────────────────────────

/**
 * Record a touch for the current URL (idempotent; safe to call on every
 * navigation). Returns the touch recorded, or null if nothing was recorded.
 */
export function captureAttribution(
  href: string = typeof window !== 'undefined' ? window.location.href : '',
  documentReferrer: string = typeof document !== 'undefined' ? document.referrer : '',
): Touch | null {
  if (typeof window === 'undefined' || !href) return null;
  const touch = touchFromUrl(href, documentReferrer);
  if (!touch) return null;

  const env = read();

  // An inferred (referrer-only) touch never overrides a real tagged one
  // from the same visit window — e.g. the Instagram in-app browser reloading.
  if (touch.inferred && env.lastTouch && !env.lastTouch.inferred) {
    const age = Date.now() - new Date(env.lastTouch.capturedAt).getTime();
    if (age < DEDUPE_WINDOW_MS) return null;
  }

  if (sameTouch(env.lastTouch, touch)) {
    const age = Date.now() - new Date(env.lastTouch!.capturedAt).getTime();
    if (age < DEDUPE_WINDOW_MS) return null;
  }

  if (!env.firstTouch) env.firstTouch = touch;
  env.lastTouch = touch;
  env.touches = [...env.touches, touch].slice(-MAX_TOUCHES);
  write(env);
  return touch;
}

/**
 * The envelope every lead submission sends as `attribution`. Never throws;
 * returns an envelope with null touches for direct, untagged visitors.
 */
export function getAttribution(): AttributionEnvelope {
  if (typeof window === 'undefined') return emptyEnvelope();
  return memory ?? read();
}

/** Current refer tag (URL first, then remembered), for the HeroForm "how did you hear" step. */
export function getReferTag(): string {
  if (typeof window === 'undefined') return '';
  const fromUrl = norm(new URLSearchParams(window.location.search).get('refer'));
  if (fromUrl && !INTERNAL_REFER_VALUES.has(fromUrl)) return fromUrl;
  const env = getAttribution();
  return env.lastTouch?.refer || env.firstTouch?.refer || '';
}
