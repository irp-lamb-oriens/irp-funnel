/**
 * period.ts — month-key arithmetic and the period presets. Same preset list
 * and range rules as the Sales Report tab (sales/SalesBook.svelte), so a
 * period means the same thing on both tabs.
 */
import type { Ctx, LeadFact } from './types.ts';

export type Preset = 'this_month' | 'last_month' | 'qtd' | 'ytd' | 'last_12' | 'last_12c' | 'year' | 'all' | 'custom';
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
    case 'last_12c': return { from: shiftMonth(nowMonth, -12), to: shiftMonth(nowMonth, -1), allTime: false };
    case 'year': {
      // custom.from carries the year as `YYYY-01` (Sales Book calendar-year picker).
      const yr = VALID_MONTH.test(custom.from) ? custom.from.slice(0, 4) : String(y);
      const end = `${yr}-12` < nowMonth ? `${yr}-12` : nowMonth;
      return { from: `${yr}-01`, to: end, allTime: false };
    }
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

// ── Day-level dates (sales-book-v3 §5.3) ─────────────────────────────────────
//
// Costa Rica has no daylight saving: UTC−6 all year, so a calendar date is
// the instant shifted by six hours. Calendar-date values (date-only strings
// and exact UTC midnight, what the date pickers store) keep their own date,
// the same rule as the server's monthKeyTz / isCalendarDate.

const CR_OFFSET_MS = 6 * 3600 * 1000;
const CAL_DATE = /^\d{4}-\d{2}-\d{2}$|^\d{4}-\d{2}-\d{2}T00:00:00(\.000)?Z$/;
const dateCache = new Map<string, string | null>();

/** `YYYY-MM-DD` of an ISO value on the Costa Rica calendar, or null. */
export function crDateKey(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const hit = dateCache.get(iso);
  if (hit !== undefined) return hit;
  let out: string | null;
  if (CAL_DATE.test(iso)) out = iso.slice(0, 10);
  else {
    const t = Date.parse(iso);
    out = Number.isNaN(t) ? null : new Date(t - CR_OFFSET_MS).toISOString().slice(0, 10);
  }
  if (dateCache.size > 50000) dateCache.clear();
  dateCache.set(iso, out);
  return out;
}

export function daysInMonth(monthKey: string): number {
  const [y, m] = monthKey.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** Today on the Costa Rica calendar. */
export function crToday(now = new Date()): { date: string; month: string; day: number } {
  const date = new Date(now.getTime() - CR_OFFSET_MS).toISOString().slice(0, 10);
  return { date, month: date.slice(0, 7), day: Number(date.slice(8, 10)) };
}

/** `YYYY-MM-DD` for a month and a day, clamped to that month's length (Mar 30 → Feb 28). */
export function clampDate(monthKey: string, day: number): string {
  return `${monthKey}-${String(Math.min(day, daysInMonth(monthKey))).padStart(2, '0')}`;
}

export function inDayWindow(iso: string | null | undefined, w: { from: string; to: string }): boolean {
  const d = crDateKey(iso);
  return !!d && d >= w.from && d <= w.to;
}

/** True when the cube carries the ISO-dated facts the day-level comparison needs. */
export function supportsDayCut(rows: LeadFact[]): boolean {
  for (const r of rows) if (Array.isArray(r.payments)) return true;
  return false;
}

export type FairCompare =
  | { kind: 'months'; cmpMonths: string[] }
  | { kind: 'days'; cur: { from: string; to: string }; cmp: { from: string; to: string }; throughDay: number }
  | { kind: 'none'; reason: string };

/**
 * The comparison for a period (sales-book-v3 §5.3).
 *  - A range of complete months compares whole months (previous span, or the
 *    same months a year earlier).
 *  - A range that ends in the current month is partial. Both sides are cut at
 *    YESTERDAY (today is never complete), on the same day-of-month, clamped to
 *    the shorter month. Day 1 has no complete day yet → no comparison.
 *  - All time has no comparison here (the Sales Book shows last 12 complete
 *    months vs the 12 before instead).
 */
export function fairCompare(months: string[], mode: Compare, allTime: boolean, now = new Date()): FairCompare {
  if (allTime || mode === 'none' || !months.length) return { kind: 'none', reason: allTime ? 'All time' : 'No comparison' };
  const today = crToday(now);
  const last = months[months.length - 1];
  const span = months.length;
  const shift = mode === 'yoy' ? 12 : span;
  if (last !== today.month) {
    const cmp = compareMonths(months, mode, false);
    return cmp ? { kind: 'months', cmpMonths: cmp } : { kind: 'none', reason: 'No comparison' };
  }
  if (today.day === 1) return { kind: 'none', reason: 'Month started today · comparison from tomorrow' };
  const through = today.day - 1;
  const cur = { from: `${months[0]}-01`, to: clampDate(today.month, through) };
  const cmp = { from: `${shiftMonth(months[0], -shift)}-01`, to: clampDate(shiftMonth(today.month, -shift), through) };
  return { kind: 'days', cur, cmp, throughDay: through };
}
