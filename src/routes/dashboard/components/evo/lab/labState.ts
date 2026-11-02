/**
 * labState.ts — Evo Lab view state: audience filters with undo (the
 * hubState.ts pattern), the selected experiment and tab, and the ev_* URL
 * parameters (spec §7.4).
 */

import { writable, get } from 'svelte/store';

export interface AudienceFilter { dim: string; values: string[] }

export const labFilters = writable<AudienceFilter[]>([]);
const history: AudienceFilter[][] = [];
export const canUndo = writable(false);

function push() {
  history.push(get(labFilters).map((f) => ({ ...f, values: [...f.values] })));
  if (history.length > 20) history.shift();
  canUndo.set(true);
}

export function addFilter(dim: string, value: string): void {
  push();
  labFilters.update((fs) => {
    const ex = fs.find((f) => f.dim === dim);
    if (ex) return fs.map((f) => (f.dim === dim ? { dim, values: f.values.includes(value) ? f.values : [...f.values, value] } : f));
    return [...fs, { dim, values: [value] }];
  });
}

export function removeFilter(dim: string): void {
  push();
  labFilters.update((fs) => fs.filter((f) => f.dim !== dim));
}

export function clearFilters(): void {
  if (!get(labFilters).length) return;
  push();
  labFilters.set([]);
}

export function undo(): void {
  const prev = history.pop();
  if (prev) labFilters.set(prev);
  canUndo.set(history.length > 0);
}

export function encodeFilters(fs: AudienceFilter[]): string {
  return fs.map((f) => `${f.dim}:${f.values.map(encodeURIComponent).join(',')}`).join('|');
}

export function decodeFilters(raw: string | null): AudienceFilter[] {
  if (!raw) return [];
  return raw.split('|').map((p) => {
    const [dim, vals] = p.split(':');
    return { dim, values: (vals ?? '').split(',').filter(Boolean).map(decodeURIComponent) };
  }).filter((f) => f.dim && f.values.length);
}

export type LabView = 'leadership' | 'sales' | 'finance' | 'marketing';
export type DetailTab = 'scorecard' | 'time' | 'funnel' | 'clients' | 'people' | 'history';
export const DETAIL_TABS: Array<{ key: DetailTab; label: string }> = [
  { key: 'scorecard', label: 'Scorecard' },
  { key: 'time', label: 'Over time' },
  { key: 'funnel', label: 'Funnel' },
  { key: 'clients', label: 'Clients' },
  { key: 'people', label: 'People' },
  { key: 'history', label: 'History' },
];
