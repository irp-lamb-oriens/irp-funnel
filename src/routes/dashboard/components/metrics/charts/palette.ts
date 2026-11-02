/**
 * palette.ts — chart colours for the Metrics Hub.
 *
 * Categorical order validated with the dataviz validator against the white
 * dashboard surface (adjacent pairs: CVD ΔE ≥ 13, normal-vision ΔE ≥ 27).
 * Slot 1 is a deeper step of the IRP teal so it clears the chroma floor.
 * Yellow (4) and pink (6) sit below 3:1 contrast, so every chart that uses
 * them also prints values or offers a table view.
 *
 * Red / green are reserved for status (good / bad) and always ship with a
 * glyph (▲ ▼) and a word, never colour alone.
 */
export const CATEGORICAL = ['#00a3aa', '#eb6834', '#6250d6', '#eda100', '#2a78d6', '#e87ba4', '#008300'] as const;

/** Everything past the 7th series folds into "Other" in this neutral. */
export const OTHER = '#94a3b8';

/** Sequential teal ramp (light → dark) for heatmaps and magnitude. */
export const SEQ = ['#e6f7f7', '#c2ecec', '#8fdcdd', '#52c6c9', '#1fa9ae', '#0b878c', '#0a666a'];

export const STATUS = {
  good: '#047857',
  goodBg: '#ecfdf5',
  watch: '#b45309',
  watchBg: '#fffbeb',
  bad: '#b91c1c',
  badBg: '#fef2f2',
} as const;

export function seriesColor(i: number): string {
  return i < CATEGORICAL.length ? CATEGORICAL[i] : OTHER;
}

/** Sequential colour for t in [0, 1]. */
export function seqColor(t: number): string {
  if (!Number.isFinite(t) || t <= 0) return SEQ[0];
  const i = Math.min(SEQ.length - 1, Math.round(t * (SEQ.length - 1)));
  return SEQ[i];
}

/** White or ink text for a label sitting on a sequential fill. */
export function inkOn(t: number): string {
  return t > 0.55 ? '#ffffff' : '#0f172a';
}

/** Clean axis ticks for [0, max]. */
export function niceTicks(max: number, count = 4): number[] {
  if (!Number.isFinite(max) || max <= 0) return [0];
  const raw = max / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * mag;
  const out: number[] = [];
  for (let v = 0; v <= max + step * 0.001; v += step) out.push(Math.round(v * 1e6) / 1e6);
  if (out[out.length - 1] < max) out.push(out[out.length - 1] + step);
  return out;
}

/** Compact number for axes: 950 / 1.2K / 3.4M. */
export function compact(n: number): string {
  const a = Math.abs(n);
  if (a >= 1e6) return `${(n / 1e6).toFixed(a >= 1e7 ? 0 : 1)}M`;
  if (a >= 1e4) return `${(n / 1e3).toFixed(0)}K`;
  if (a >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return `${Math.round(n * 100) / 100}`;
}
