/**
 * salesBookState.ts — the Sales Book's own state (docs/designs/sales-book-v3.md §5.2, §7).
 *
 *   - its own filter chips (createFilterState — never the Hub's)
 *   - period / compare / currency / lens / test toggle / deal-book view / pivot
 *   - URL `sr_*` params, and the viewer's last choice in localStorage
 *
 * Which period applies, in order: a deep link from the Hub
 * (`salesReportPrefill`), then the URL, then localStorage, then All time.
 */
import { get } from 'svelte/store';
import { salesReportPrefill } from '../../store.ts';
import { createFilterState, decodeFilters, encodeFilters } from '../metrics/hub/hubState.ts';
import { DIM } from '../metrics/engine/registry.ts';
import { VALID_MONTH, type Compare, type Preset } from '../metrics/engine/period.ts';

export const sbFilters = createFilterState();

export type Lens = 'overview' | 'sales' | 'finance' | 'marketing';
export const LENSES: Array<{ key: Lens; label: string }> = [
  { key: 'overview', label: 'Overview' },
  { key: 'sales', label: 'Sales' },
  { key: 'finance', label: 'Finance' },
  { key: 'marketing', label: 'Marketing' },
];

export const SALES_PRESETS: Array<{ value: Preset; label: string }> = [
  { value: 'all', label: 'All time' },
  { value: 'last_12c', label: 'Last 12 complete months' },
  { value: 'ytd', label: 'Year to date' },
  { value: 'qtd', label: 'Quarter to date' },
  { value: 'this_month', label: 'This month' },
  { value: 'last_month', label: 'Last month' },
  { value: 'year', label: 'Calendar year…' },
  { value: 'custom', label: 'Custom range…' },
];

export interface PivotState { m: string[]; r: string; c: string; n: number; v: 'chart' | 'table' }

export interface SalesBookSettings {
  preset: Preset;
  custom: { from: string; to: string };
  compare: Compare;
  currency: string;
  lens: Lens;
  /** Hide test / internal records (default true, sales-book-v3 §4.4). */
  excludeTest: boolean;
  view: string;
  activeOnly: boolean;
  pivot: PivotState;
}

export const DEFAULTS: SalesBookSettings = {
  preset: 'all',
  custom: { from: '', to: '' },
  compare: 'prev',
  currency: 'USD',
  lens: 'overview',
  excludeTest: true,
  view: 'all',
  activeOnly: true,
  pivot: { m: ['booked', 'margin', 'avgDeal'], r: 'route', c: '', n: 12, v: 'chart' },
};

const STORE_KEY = 'irp.salesBook.v1';
const PRESET_VALUES = new Set(SALES_PRESETS.map((p) => p.value));

function fromStorage(): Partial<SalesBookSettings> {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return {};
    const o = JSON.parse(raw);
    const out: Partial<SalesBookSettings> = {};
    if (PRESET_VALUES.has(o.preset)) out.preset = o.preset;
    if (o.custom && typeof o.custom.from === 'string') out.custom = { from: o.custom.from, to: String(o.custom.to ?? '') };
    if (o.compare === 'prev' || o.compare === 'yoy' || o.compare === 'none') out.compare = o.compare;
    if (typeof o.currency === 'string' && /^[A-Z]{3}$/.test(o.currency)) out.currency = o.currency;
    if (LENSES.some((l) => l.key === o.lens)) out.lens = o.lens;
    return out;
  } catch { return {}; }
}

export function saveToStorage(s: SalesBookSettings): void {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify({ preset: s.preset, custom: s.custom, compare: s.compare, currency: s.currency, lens: s.lens }));
  } catch { /* storage blocked */ }
}

/** Settings for first render: prefill > URL > localStorage > defaults. */
export function initialSettings(): SalesBookSettings {
  const s: SalesBookSettings = { ...DEFAULTS, custom: { ...DEFAULTS.custom }, pivot: { ...DEFAULTS.pivot } };
  Object.assign(s, fromStorage());
  try {
    const q = new URLSearchParams(window.location.search);
    const p = q.get('sr_preset') as Preset | null;
    if (p && PRESET_VALUES.has(p)) s.preset = p;
    const f = q.get('sr_from'), t = q.get('sr_to');
    if (f && VALID_MONTH.test(f)) s.custom.from = f;
    if (t && VALID_MONTH.test(t)) s.custom.to = t;
    const c = q.get('sr_cmp') as Compare | null;
    if (c === 'prev' || c === 'yoy' || c === 'none') s.compare = c;
    const cur = q.get('sr_cur');
    if (cur && /^[A-Z]{3}$/.test(cur)) s.currency = cur;
    const lens = q.get('sr_lens');
    if (lens && LENSES.some((l) => l.key === lens)) s.lens = lens as Lens;
    if (q.get('sr_test') === '1') s.excludeTest = false;
    const v = q.get('sr_view');
    if (v) s.view = v;
    if (q.get('sr_active') === '0') s.activeOnly = false;
    sbFilters.setFiltersSilently(decodeFilters(q.get('sr_f')).filter((x) => DIM[x.dim]));
    const x = q.get('sr_x');
    if (x) {
      const [m, r, cc, n, vv] = x.split('~');
      s.pivot = { m: m ? m.split('.') : s.pivot.m, r: DIM[r] ? r : s.pivot.r, c: DIM[cc] ? cc : '', n: Number(n) || 12, v: vv === 'table' ? 'table' : 'chart' };
    }
  } catch { /* no URL access */ }
  const pre = get(salesReportPrefill);
  if (pre) {
    s.preset = 'custom';
    s.custom = { from: pre.from, to: pre.to };
    salesReportPrefill.set(null);
  }
  return s;
}

export function writeUrl(s: SalesBookSettings): void {
  try {
    const url = new URL(window.location.href);
    const set = (k: string, v: string | null) => (v ? url.searchParams.set(k, v) : url.searchParams.delete(k));
    set('view', 'salesReport');
    set('sr_preset', s.preset);
    const withRange = s.preset === 'custom' || s.preset === 'year';
    set('sr_from', withRange ? s.custom.from : null);
    set('sr_to', s.preset === 'custom' ? s.custom.to : null);
    set('sr_cmp', s.compare === 'prev' ? null : s.compare);
    set('sr_cur', s.currency === 'USD' ? null : s.currency);
    set('sr_lens', s.lens === 'overview' ? null : s.lens);
    set('sr_test', s.excludeTest ? null : '1');
    set('sr_view', s.view === 'all' ? null : s.view);
    set('sr_active', s.activeOnly ? null : '0');
    const f = get(sbFilters.filters);
    set('sr_f', f.length ? encodeFilters(f) : null);
    set('sr_x', `${s.pivot.m.join('.')}~${s.pivot.r}~${s.pivot.c}~${s.pivot.n}~${s.pivot.v}`);
    window.history.replaceState(window.history.state, '', url);
  } catch { /* ignore */ }
}
