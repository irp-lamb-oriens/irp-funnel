/**
 * format.ts — one place for how numbers read in the Hub.
 */
import type { Measure, MeasureValue } from './registry.ts';

export function money(n: number | null | undefined, currency = 'USD', compact = false): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  try {
    const useCompact = compact && Math.abs(n) >= 10000;
    return new Intl.NumberFormat('en-US', {
      style: 'currency', currency, minimumFractionDigits: 0, maximumFractionDigits: useCompact ? 1 : 0,
      notation: useCompact ? 'compact' : 'standard',
    }).format(n);
  } catch {
    return `${Math.round(n).toLocaleString('en-US')} ${currency}`;
  }
}

export function int(n: number | null | undefined): string {
  return n === null || n === undefined || !Number.isFinite(n) ? '—' : Math.round(n).toLocaleString('en-US');
}

export function pct(v: number | null | undefined, digits = 1): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  const p = v * 100;
  return `${p >= 10 || digits === 0 ? Math.round(p) : Math.round(p * 10 ** digits) / 10 ** digits}%`;
}

export function days(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  return `${Math.round(v)} d`;
}

export function fmtMeasure(m: Measure, v: number | null | undefined, currency: string, compact = false): string {
  switch (m.kind) {
    case 'money': return money(v, currency, compact);
    case 'rate': return pct(v);
    case 'days': return days(v);
    default: return int(v);
  }
}

export interface Delta {
  text: string;
  /** 'better' | 'worse' | 'flat' | 'neutral' (direction known but no judgement). */
  tone: 'better' | 'worse' | 'flat' | 'neutral';
  glyph: '▲' | '▼' | '■' | '';
  /** Full sentence for screen readers. */
  sr: string;
}

/** Δ vs a comparison value, spelled out in words as well as a glyph. */
export function delta(m: Measure, cur: MeasureValue | null, prev: MeasureValue | null, label: string): Delta | null {
  if (!cur || !prev || cur.value === null || prev.value === null) return null;
  const a = cur.value, b = prev.value;
  let text: string;
  let change: number;
  if (m.kind === 'rate') {
    change = (a - b) * 100;
    text = `${change >= 0 ? '+' : ''}${Math.round(change * 10) / 10} pts`;
  } else if (b === 0) {
    if (a === 0) return { text: 'no change', tone: 'flat', glyph: '■', sr: `No change vs ${label}` };
    change = a > 0 ? 1 : -1;
    text = 'new';
  } else {
    change = (a - b) / Math.abs(b);
    text = `${change >= 0 ? '+' : ''}${Math.round(change * 100)}%`;
  }
  const flat = m.kind === 'rate' ? Math.abs(change) < 0.5 : Math.abs(change) < 0.005;
  if (flat) return { text: 'flat', tone: 'flat', glyph: '■', sr: `Flat vs ${label}` };
  const up = change > 0;
  const tone = m.better === null ? 'neutral' : up === m.better ? 'better' : 'worse';
  const word = tone === 'better' ? 'better' : tone === 'worse' ? 'worse' : '';
  return { text, tone, glyph: up ? '▲' : '▼', sr: `${up ? 'Up' : 'Down'} ${text.replace(/^[+-]/, '')} vs ${label}${word ? `, ${word}` : ''}` };
}

// ── Small-sample rule (sales-book-v3 §5.4) ───────────────────────────────────

export const MIN_RATE_N = 15;
export const MIN_STAT_N = 5;
export const MIN_DELTA_COUNT = 10;

export interface Stat {
  /** What to print. */
  text: string;
  /** Muted: the sample is too small to read as a fact. */
  small: boolean;
  /** Tooltip with the sample size (and interval for rates). */
  title: string;
}

/**
 * A number printed with its sample size in mind.
 *   rate   n < 15 → "x of n" (muted); otherwise a % with n (and a 90 % Wilson interval) in the tooltip
 *   median / average  n < 5 → "n = …" (no value); otherwise the value with n in the tooltip
 */
export function fmtStat(kind: 'rate' | 'median' | 'average', value: number | null | undefined, n: number, opts: { num?: number; fmt?: (v: number) => string; interval?: { lo: number; hi: number } | null } = {}): Stat {
  if (kind === 'rate') {
    if (n < MIN_RATE_N) {
      const x = opts.num ?? (value !== null && value !== undefined ? Math.round(value * n) : 0);
      return { text: n ? `${x} of ${n}` : '—', small: true, title: n ? `Only ${n} case${n === 1 ? '' : 's'} — too few for a reliable rate` : 'No cases' };
    }
    const iv = opts.interval;
    return { text: pct(value), small: false, title: `n = ${n}${iv ? ` · likely range ${pct(iv.lo)}–${pct(iv.hi)}` : ''}` };
  }
  if (n < MIN_STAT_N) return { text: n ? `n = ${n}` : '—', small: true, title: `Only ${n} case${n === 1 ? '' : 's'} — not enough for a ${kind}` };
  const f = opts.fmt ?? ((v: number) => String(Math.round(v)));
  return { text: value === null || value === undefined ? '—' : f(value), small: false, title: `n = ${n}` };
}

/** Δ is hidden when both counts are under MIN_DELTA_COUNT (1 vs 2 is not "−50 %"). */
export function deltaAllowed(curCount: number | null | undefined, prevCount: number | null | undefined): boolean {
  return (curCount ?? 0) >= MIN_DELTA_COUNT || (prevCount ?? 0) >= MIN_DELTA_COUNT;
}
