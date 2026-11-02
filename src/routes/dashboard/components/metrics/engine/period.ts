/**
 * period.ts — month-key arithmetic and the period presets. Same preset list
 * and range rules as the Sales Report tab (SalesReportView.svelte), so a
 * period means the same thing on both tabs.
 */
import type { Ctx, LeadFact } from './types.ts';

export type Preset = 'this_month' | 'last_month' | 'qtd' | 'ytd' | 'last_12' | 'all' | 'custom';
export type Compare = 'prev' | 'yoy' | 'none';

export const PRESETS: Array<{ value: Preset; label: string }> = [
  { value: 'this_month', label: 'This month' },
  { value: 'last_month', label: 'Last month' },
  { value: 'qtd', label: 'Quarter to date' },
  { value: 'ytd', label: 'Year to date' },
  { value: 'last_12', label: 'Last 12 months' },
  { value: 'all', label: 'All time' },
  { value: 'custom', label: 'Custom range…' },
];

export const VALID_MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

export function shiftMonth(key: string, n: number): string {
  const [y, m] = key.split('-').map(Number);
  const idx = y * 12 + (m - 1) + n;
  return `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, '0')}`;
}

export function monthRange(from: string, to: string): string[] {
  if (from > to) [from, to] = [to, from];
  const out: string[] = [];
  for (let k = from; k <= to && out.length < 600; k = shiftMonth(k, 1)) out.push(k);
  return out;
}

export function monthLabel(key: string, long = false): string {
  const [y, m] = key.split('-').map(Number);
  if (!y || !m) return key;
  return new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString('en-US', { month: 'short', year: long ? 'numeric' : '2-digit', timeZone: 'UTC' });
}

export function rangeLabel(months: string[], allTime: boolean): string {
  if (allTime) return 'All time';
  if (!months.length) return '—';
  if (months.length === 1) return monthLabel(months[0], true);
  return `${monthLabel(months[0], true)} – ${monthLabel(months[months.length - 1], true)}`;
}

/** Earliest month with any event, for "All time" spans and charts. */
export function firstMonthOf(rows: LeadFact[], nowMonth: string): string {
  let min = nowMonth;
  for (const r of rows) {
    for (const m of [r.leadMonth, r.wonMonth, r.paidMonth, r.quoteSentMonth]) if (m && m < min) min = m;
    for (const c of Object.values(r.money)) for (const m of Object.keys(c.byMonth)) if (m !== 'undated' && m < min) min = m;
  }
  return min;
}

export function rangeFor(p: Preset, nowMonth: string, custom: { from: string; to: string }, firstMonth: string): { from: string; to: string; allTime: boolean } {
  const [y, m] = nowMonth.split('-').map(Number);
  switch (p) {
    case 'this_month': return { from: nowMonth, to: nowMonth, allTime: false };
    case 'last_month': { const l = shiftMonth(nowMonth, -1); return { from: l, to: l, allTime: false }; }
    case 'qtd': return { from: `${y}-${String(Math.floor((m - 1) / 3) * 3 + 1).padStart(2, '0')}`, to: nowMonth, allTime: false };
    case 'ytd': return { from: `${y}-01`, to: nowMonth, allTime: false };
    case 'last_12': return { from: shiftMonth(nowMonth, -11), to: nowMonth, allTime: false };
    case 'all': return { from: firstMonth, to: nowMonth, allTime: true };
    case 'custom': {
      const f = VALID_MONTH.test(custom.from) ? custom.from : nowMonth;
      const t = VALID_MONTH.test(custom.to) ? custom.to : f;
      return f <= t ? { from: f, to: t, allTime: false } : { from: t, to: f, allTime: false };
    }
  }
}

/** Comparison months: the same span right before, or the same months a year earlier. */
export function compareMonths(months: string[], mode: Compare, allTime: boolean): string[] | null {
  if (mode === 'none' || allTime || !months.length) return null;
  if (mode === 'yoy') return months.map((k) => shiftMonth(k, -12));
  const span = months.length;
  return monthRange(shiftMonth(months[0], -span), shiftMonth(months[0], -1));
}

export function makeCtx(months: string[], allTime: boolean, currency: string, nowMonth: string): Ctx {
  return { months, allTime, currency, nowMonth };
}

/** Day of month and days in month for `now` in Costa Rica time. */
export function crDayOfMonth(now = new Date()): { day: number; days: number } {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Costa_Rica', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const y = Number(parts.find((p) => p.type === 'year')!.value);
  const m = Number(parts.find((p) => p.type === 'month')!.value);
  const d = Number(parts.find((p) => p.type === 'day')!.value);
  return { day: d, days: new Date(Date.UTC(y, m, 0)).getUTCDate() };
}
