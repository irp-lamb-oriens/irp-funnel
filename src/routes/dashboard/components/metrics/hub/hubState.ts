/**
 * hubState.ts — the Metrics Hub's shared state: the loaded cube and the
 * global filter chips (with an undo stack). Every section reads the same
 * filters, so clicking a bar anywhere narrows the whole page (spec D9).
 */
import { derived, get, writable } from 'svelte/store';
import type { Filter, MetricsCube } from '../engine/types.ts';

export const hubCube = writable<MetricsCube | null>(null);
export const hubFilters = writable<Filter[]>([]);

const history = writable<Filter[][]>([]);
export const canUndo = derived(history, (h) => h.length > 0);

function commit(next: Filter[]) {
  history.update((h) => [...h.slice(-19), get(hubFilters)]);
  hubFilters.set(next);
}

/** Add (or replace) the filter for a dimension. */
export function addFilter(f: Filter): void {
  if (!f.values.length) return;
  const cur = get(hubFilters);
  const same = cur.find((x) => x.dim === f.dim && !!x.exclude === !!f.exclude);
  if (same && same.values.length === f.values.length && same.values.every((v) => f.values.includes(v))) return;
  commit([...cur.filter((x) => x.dim !== f.dim), { ...f }]);
}
export function addFilters(fs: Filter[]): void {
  const cur = get(hubFilters);
  const dims = new Set(fs.map((f) => f.dim));
  commit([...cur.filter((x) => !dims.has(x.dim)), ...fs.map((f) => ({ ...f }))]);
}
export function removeFilter(index: number): void {
  const cur = get(hubFilters);
  commit(cur.filter((_, i) => i !== index));
}
export function clearFilters(): void {
  if (get(hubFilters).length) commit([]);
}
export function undoFilters(): void {
  const h = get(history);
  if (!h.length) return;
  hubFilters.set(h[h.length - 1]);
  history.set(h.slice(0, -1));
}
/** Replace without recording history (URL restore). */
export function setFiltersSilently(fs: Filter[]): void {
  hubFilters.set(fs);
}

// ── URL encoding of filters: dim:v1|v2,!dim:v ────────────────────────────────
export function encodeFilters(fs: Filter[]): string {
  return fs.map((f) => `${f.exclude ? '!' : ''}${f.dim}:${f.values.map(encodeURIComponent).join('|')}`).join(',');
}
export function decodeFilters(s: string | null): Filter[] {
  if (!s) return [];
  return s.split(',').map((part) => {
    const exclude = part.startsWith('!');
    const [dim, vals] = (exclude ? part.slice(1) : part).split(':');
    return { dim, values: (vals ?? '').split('|').filter(Boolean).map((v) => { try { return decodeURIComponent(v); } catch { return v; } }), exclude };
  }).filter((f) => f.dim && f.values.length);
}

/** Smooth-scroll to a Hub section anchor. */
export function scrollToSection(id: string): void {
  try {
    const el = document.getElementById(id);
    if (!el) return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    (el.querySelector('h3, h2') as HTMLElement | null)?.focus?.({ preventScroll: true });
  } catch { /* ignore */ }
}
