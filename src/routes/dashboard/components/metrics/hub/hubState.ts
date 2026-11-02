/**
 * hubState.ts — the Metrics Hub's shared state: the loaded cube and the
 * global filter chips (with an undo stack). Every section reads the same
 * filters, so clicking a bar anywhere narrows the whole page (spec D9).
 */
import { derived, get, writable } from 'svelte/store';
import type { Filter, MetricsCube } from '../engine/types.ts';

export const hubCube = writable<MetricsCube | null>(null);

/**
 * A set of filter chips with an undo stack. The Hub uses one instance; the
 * Sales Book creates its own, so the two tabs never share filter state
 * (sales-book-v3 §5.6).
 */
export function createFilterState() {
  const filters = writable<Filter[]>([]);
  const history = writable<Filter[][]>([]);
  const canUndo = derived(history, (h) => h.length > 0);
  function commit(next: Filter[]) {
    history.update((h) => [...h.slice(-19), get(filters)]);
    filters.set(next);
  }
  return {
    filters,
    canUndo,
    /** Add (or replace) the filter for a dimension. */
    addFilter(f: Filter): void {
      if (!f.values.length) return;
      const cur = get(filters);
      const same = cur.find((x) => x.dim === f.dim && !!x.exclude === !!f.exclude);
      if (same && same.values.length === f.values.length && same.values.every((v) => f.values.includes(v))) return;
      commit([...cur.filter((x) => x.dim !== f.dim), { ...f }]);
    },
    addFilters(fs: Filter[]): void {
      const cur = get(filters);
      const dims = new Set(fs.map((f) => f.dim));
      commit([...cur.filter((x) => !dims.has(x.dim)), ...fs.map((f) => ({ ...f }))]);
    },
    removeFilter(index: number): void {
      commit(get(filters).filter((_, i) => i !== index));
    },
    clearFilters(): void {
      if (get(filters).length) commit([]);
    },
    undoFilters(): void {
      const h = get(history);
      if (!h.length) return;
      filters.set(h[h.length - 1]);
      history.set(h.slice(0, -1));
    },
    /** Replace without recording history (URL restore). */
    setFiltersSilently(fs: Filter[]): void {
      filters.set(fs);
    },
  };
}
export type FilterState = ReturnType<typeof createFilterState>;

// The Metrics Hub's instance (existing imports keep working).
const hub = createFilterState();
export const hubFilters = hub.filters;
export const canUndo = hub.canUndo;
export const addFilter = hub.addFilter;
export const addFilters = hub.addFilters;
export const removeFilter = hub.removeFilter;
export const clearFilters = hub.clearFilters;
export const undoFilters = hub.undoFilters;
export const setFiltersSilently = hub.setFiltersSilently;

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
