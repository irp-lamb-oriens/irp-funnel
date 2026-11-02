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
