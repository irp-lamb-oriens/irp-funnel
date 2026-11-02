/**
 * registry.ts — every dimension you can split by and every measure you can
 * compute, defined ONCE. Sections, the Explorer, the combination finder and
 * the insights all read from here, so a metric means the same thing in every
 * corner of the Hub. Definitions: docs/designs/metrics-hub.md §6.
 *
 * Bases
 *   period — events whose own month falls in the period (Sales Report rule)
 *   cohort — leads created in the period, followed to today
 *   asOf   — a snapshot of today; ignores the period
 */
import type { Ctx, LeadFact } from './types.ts';
import { median } from './stats.ts';
import { inDayWindow } from './period.ts';

// ── Dimensions ───────────────────────────────────────────────────────────────

export type Phase = 'lead' | 'quote' | 'outcome';

export interface Dimension {
  key: string;
  label: string;
  group: 'Marketing' | 'Move' | 'Lead' | 'Time' | 'Sales';
  /** lead = known when the lead arrives; quote = known after the call/quote; outcome = result of the sale. */
  phase: Phase;
  /** Dimensions this one is derived from — never paired with them in the finder. */
  parents?: string[];
  multi?: boolean;
  get: (r: LeadFact) => string | string[];
  /** Fixed value order (bands, weekdays); otherwise groups sort by the measure. */
  order?: string[];
  format?: (v: string) => string;
}

export const COUNTRY_NAMES: Record<string, string> = {
  US: 'United States', CA: 'Canada', MX: 'Mexico', CR: 'Costa Rica', PA: 'Panama', CO: 'Colombia',
  ES: 'Spain', GB: 'United Kingdom', DE: 'Germany', FR: 'France',
};
const country = (v: string) => COUNTRY_NAMES[v] ?? v;
const quarterOf = (m: string | null) => (m ? `${m.slice(0, 4)}-Q${Math.floor((Number(m.slice(5, 7)) - 1) / 3) + 1}` : 'Undated');
const STATUS_LABELS: Record<string, string> = {
  lead: 'Lead (no quote)', open: 'Open', quoted: 'Quoted', accepted: 'Accepted', invoiced: 'Invoiced',
  partially_paid: 'Partially paid', paid: 'Paid', dropped: 'Dropped',
};
const DROP_LABELS: Record<string, string> = { noShow: 'No-show', nonQualified: 'Not qualified', saleDropped: 'Sale dropped' };

export const DIMENSIONS: Dimension[] = [
  { key: 'channel', label: 'Channel', group: 'Marketing', phase: 'lead', get: (r) => r.channel },
  { key: 'utmSource', label: 'UTM source', group: 'Marketing', phase: 'lead', parents: ['channel'], get: (r) => r.utmSource },
  { key: 'utmMedium', label: 'UTM medium', group: 'Marketing', phase: 'lead', parents: ['channel', 'utmSource'], get: (r) => r.utmMedium },
  { key: 'utmCampaign', label: 'UTM campaign', group: 'Marketing', phase: 'lead', parents: ['channel', 'utmSource', 'utmMedium'], get: (r) => r.utmCampaign },
  { key: 'heardFrom', label: 'Heard about us', group: 'Marketing', phase: 'lead', get: (r) => r.heardFrom },
  { key: 'multiTouch', label: 'Touches', group: 'Marketing', phase: 'lead', get: (r) => (r.multiTouch ? 'Multi-touch' : 'Single / none') },
  { key: 'origin', label: 'Origin country', group: 'Move', phase: 'lead', get: (r) => r.origin, format: country },
  { key: 'destination', label: 'Destination country', group: 'Move', phase: 'lead', get: (r) => r.destination, format: country },
  { key: 'route', label: 'Route', group: 'Move', phase: 'lead', parents: ['origin', 'destination'], get: (r) => r.route },
  { key: 'budget', label: 'Budget', group: 'Move', phase: 'lead', get: (r) => r.budget, order: ['< $6k', '$6–10k', '$10–20k', '$20k+', 'Unknown'] },
  { key: 'size', label: 'Move size', group: 'Move', phase: 'lead', get: (r) => r.size, order: ['LCL (part container)', '20ft', '40ft', '40ft HC', 'Larger', 'House-based', 'Other', 'Unknown'] },
  { key: 'propertyFrom', label: 'Moving from', group: 'Move', phase: 'lead', get: (r) => r.propertyFrom },
  { key: 'propertyTo', label: 'Moving into', group: 'Move', phase: 'lead', get: (r) => r.propertyTo },
  { key: 'immigration', label: 'Immigration status', group: 'Lead', phase: 'lead', get: (r) => r.immigration },
  { key: 'hasVehicles', label: 'Shipping vehicles', group: 'Move', phase: 'lead', get: (r) => r.hasVehicles },
  { key: 'leadMonth', label: 'Lead month', group: 'Time', phase: 'lead', get: (r) => r.leadMonth ?? 'Undated' },
  { key: 'leadQuarter', label: 'Lead quarter', group: 'Time', phase: 'lead', parents: ['leadMonth'], get: (r) => quarterOf(r.leadMonth) },
  { key: 'leadWeekday', label: 'Lead weekday', group: 'Time', phase: 'lead', get: (r) => r.leadWeekday ?? 'Undated', order: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun', 'Undated'] },
  { key: 'callAttended', label: 'Discovery call', group: 'Sales', phase: 'quote', get: (r) => (r.callAttended ? 'Attended' : r.noShow ? 'No-show' : r.callBooked ? 'Booked, not held' : 'No call booked') },
  { key: 'service', label: 'Service', group: 'Sales', phase: 'quote', get: (r) => r.service },
  { key: 'status', label: 'Deal status', group: 'Sales', phase: 'outcome', get: (r) => r.status, format: (v) => STATUS_LABELS[v] ?? v },
  { key: 'stage', label: 'Current stage', group: 'Sales', phase: 'outcome', get: (r) => r.stageLabel ?? '(none)' },
  { key: 'dropKind', label: 'Drop reason', group: 'Sales', phase: 'outcome', get: (r) => r.dropKind ?? 'Not dropped', format: (v) => DROP_LABELS[v] ?? v },
  { key: 'providers', label: 'Provider (overlapping)', group: 'Sales', phase: 'outcome', multi: true, get: (r) => (r.providers.length ? r.providers : ['No provider']) },
];

export const DIM: Record<string, Dimension> = Object.fromEntries(DIMENSIONS.map((d) => [d.key, d]));

export function dimValues(d: Dimension, r: LeadFact): string[] {
  const v = d.get(r);
  return Array.isArray(v) ? v : [v];
}
export function dimLabel(dimKey: string, value: string): string {
  const d = DIM[dimKey];
  return d?.format ? d.format(value) : value;
}

// ── Measure helpers ──────────────────────────────────────────────────────────

const monthSets = new WeakMap<Ctx, Set<string>>();
export function monthSet(ctx: Ctx): Set<string> {
  let s = monthSets.get(ctx);
  if (!s) { s = new Set(ctx.months); monthSets.set(ctx, s); }
  return s;
}
/** Event month counts in the period. `null` months count only in All time. */
function inPeriod(m: string | null, ctx: Ctx, undatedInAll = false): boolean {
  if (!m) return undatedInAll && ctx.allTime;
  return ctx.allTime || monthSet(ctx).has(m);
}
/**
 * An event in the period: by its month, or — under a day cut (fair
 * comparison of a partial month, sales-book-v3 §5.3) — by its ISO date.
 */
function inPeriodAt(m: string | null, iso: string | null | undefined, ctx: Ctx, undatedInAll = false): boolean {
  if (ctx.dayCut) return inDayWindow(iso, ctx.dayCut);
  return inPeriod(m, ctx, undatedInAll);
}
/** Cohort: leads created in the period (All time: every lead, dated or not). */
export function inCohort(r: LeadFact, ctx: Ctx): boolean {
  if (!r.isLead) return false;
  if (ctx.dayCut) return inDayWindow(r.leadAt, ctx.dayCut);
  if (ctx.allTime) return true;
  return !!r.leadMonth && monthSet(ctx).has(r.leadMonth);
}
function sumMoney(rows: LeadFact[], ctx: Ctx, f: 'booked' | 'cash' | 'invoiced' | 'margin', only?: (r: LeadFact) => boolean): number {
  if (ctx.dayCut) return sumMoneyByDay(rows, ctx, f, only);
  const set = monthSet(ctx);
  let s = 0;
  for (const r of rows) {
    if (only && !only(r)) continue;
    const m = r.money[ctx.currency];
    if (!m) continue;
    for (const [k, c] of Object.entries(m.byMonth)) if (k !== 'undated' && (ctx.allTime || set.has(k))) s += c[f];
  }
  return Math.round(s * 100) / 100;
}
/** Same sums from the ISO-dated event lists (sales-book-v3 §4.2). */
function sumMoneyByDay(rows: LeadFact[], ctx: Ctx, f: 'booked' | 'cash' | 'invoiced' | 'margin', only?: (r: LeadFact) => boolean): number {
  const w = ctx.dayCut!;
  let s = 0;
  for (const r of rows) {
    if (only && !only(r)) continue;
    if (f === 'cash') { for (const p of r.payments ?? []) if (p.cur === ctx.currency && inDayWindow(p.at, w)) s += p.amount; }
    else if (f === 'invoiced') { for (const p of r.invoicedAtList ?? []) if (p.cur === ctx.currency && inDayWindow(p.at, w)) s += p.amount; }
    else for (const b of r.bookedAt ?? []) if (b.cur === ctx.currency && inDayWindow(b.at, w)) s += f === 'booked' ? b.amount : b.margin;
  }
  return Math.round(s * 100) / 100;
}
function cohortMoney(rows: LeadFact[], ctx: Ctx, f: 'booked' | 'cash' | 'margin'): number {
  let s = 0;
  for (const r of rows) if (inCohort(r, ctx)) s += r.money[ctx.currency]?.[f] ?? 0;
  return Math.round(s * 100) / 100;
}

export const MATURE_DAYS = 60;

// ── Measures ─────────────────────────────────────────────────────────────────

export interface MeasureValue {
  value: number | null;
  /** Rows / events behind it (sample size). */
  n: number;
  num?: number;
  den?: number;
  /** One line shown under a tile. */
  note?: string;
}

export interface Measure {
  key: string;
  label: string;
  basis: 'period' | 'cohort' | 'asOf';
  kind: 'count' | 'money' | 'rate' | 'days' | 'ratio';
  /** Up is good (true), bad (false), or neutral (null) — drives Δ wording. */
  better: boolean | null;
  /** 0/1 per cohort row: usable by the combination finder. */
  binomial?: (r: LeadFact) => 0 | 1 | null;
  /** Which dimension phases this measure may be split by in the finder. */
  phases?: Phase[];
  def: string;
  /**
   * Can be counted by calendar day (needed for a fair partial-month Δ).
   * False when the cube has no per-event date for it. Default true.
   */
  dayComparable?: boolean;
  compute: (rows: LeadFact[], ctx: Ctx) => MeasureValue;
}

function rate(rows: LeadFact[], ctx: Ctx, f: (r: LeadFact) => 0 | 1 | null, cohort = true): MeasureValue {
  let num = 0, den = 0;
  for (const r of rows) {
    if (cohort && !inCohort(r, ctx)) continue;
    const v = f(r);
    if (v === null) continue;
    den++;
    num += v;
  }
  return { value: den ? num / den : null, n: den, num, den };
}
function maturingNote(rows: LeadFact[], ctx: Ctx): string | undefined {
  let young = 0, all = 0;
  for (const r of rows) if (inCohort(r, ctx)) { all++; if ((r.leadAgeDays ?? 0) < MATURE_DAYS) young++; }
  return all && young / all > 0.3 ? `${young} of ${all} leads are under ${MATURE_DAYS} days old — still maturing` : undefined;
}
function med(rows: LeadFact[], ctx: Ctx, get: (r: LeadFact) => number | null, eligible: (r: LeadFact) => boolean): MeasureValue {
  const vals: number[] = [];
  let pool = 0;
  for (const r of rows) {
    if (!inCohort(r, ctx) || !eligible(r)) continue;
    pool++;
    const v = get(r);
    if (v !== null && v >= 0) vals.push(v);
  }
  const open = pool - vals.length;
  return { value: median(vals), n: vals.length, note: pool ? `${vals.length} closed · ${open} still open` : undefined };
}

/** Historical chance an open quote of a given age is later accepted. */
export const QUOTE_AGE_BUCKETS = [0, 15, 46, 91];
export function quoteWinCurve(rows: LeadFact[]): number[] {
  return QUOTE_AGE_BUCKETS.map((start, bi) => {
    if (bi === QUOTE_AGE_BUCKETS.length - 1) return 0; // > 90 days ≈ dead
    let open = 0, later = 0;
    for (const r of rows) {
      if (!r.isLead || !r.quoteSentMonth) continue;
      if (r.won && r.decisionDays !== null) {
        if (r.decisionDays >= start) { open++; later++; }
      } else if (!r.won && r.leadAgeDays !== null) {
        const age = r.leadAgeDays - (r.quoteTurnaroundDays ?? 0);
        if (age >= start + 30) open++; // given a fair chance to decide
      }
    }
    return open >= 5 ? later / open : 0;
  });
}
function bucketOf(age: number): number {
  let b = 0;
  for (let i = 0; i < QUOTE_AGE_BUCKETS.length; i++) if (age >= QUOTE_AGE_BUCKETS[i]) b = i;
  return b;
}
export function forecast(rows: LeadFact[], currency: string, curve = quoteWinCurve(rows)): { expected: number; sd: number; open: number; value: number } {
  let expected = 0, variance = 0, open = 0, value = 0;
  for (const r of rows) {
    const q = r.openQuote;
    if (!q || q.cur !== currency) continue;
    const p = curve[bucketOf(q.ageDays ?? 0)] ?? 0;
    open++;
    value += q.total;
    expected += q.total * p;
    variance += q.total * q.total * p * (1 - p);
  }
  return { expected: Math.round(expected), sd: Math.round(Math.sqrt(variance)), open, value: Math.round(value) };
}

const DROP = (r: LeadFact) => (r.status === 'dropped' || !!r.dropKind ? 1 : 0) as 0 | 1;
const LEAD_ONLY: Phase[] = ['lead'];
const LEAD_QUOTE: Phase[] = ['lead', 'quote'];

export const MEASURES: Measure[] = [
  // ── Period counts ──
  { key: 'leads', label: 'Leads', basis: 'period', kind: 'count', better: true,
    def: 'New leads (consultation records) created in the period, by their earliest entry date in Costa Rica time. Same as the Sales Report.',
    compute: (rows, ctx) => { const n = rows.filter((r) => r.isLead && inPeriodAt(r.leadMonth, r.leadAt, ctx, true)).length; return { value: n, n }; } },
  { key: 'quotedLeads', label: 'Quoted leads', basis: 'period', kind: 'count', better: true,
    def: 'Leads whose first quote reached the client in the period.',
    compute: (rows, ctx) => { const n = rows.filter((r) => r.isLead && inPeriodAt(r.quoteSentMonth, r.firstQuoteAt, ctx)).length; return { value: n, n }; } },
  { key: 'quotesSent', label: 'Quotes sent', basis: 'period', kind: 'count', better: true, dayComparable: false,
    def: 'Every quote sent to a client in the period (a lead can get several). Same as the Sales Report "Quotes sent".',
    compute: (rows, ctx) => { if (ctx.dayCut) return { value: null, n: 0 }; let n = 0; const s = monthSet(ctx); for (const r of rows) for (const [m, c] of Object.entries(r.quoteSentMonths)) if (ctx.allTime || s.has(m)) n += c; return { value: n, n }; } },
  { key: 'won', label: 'Won deals', basis: 'period', kind: 'count', better: true,
    def: 'Deals whose first client acceptance happened in the period. Same as the Sales Report "Won".',
    compute: (rows, ctx) => { const n = rows.filter((r) => r.won && inPeriodAt(r.wonMonth, r.acceptedAt, ctx, true)).length; return { value: n, n }; } },
  { key: 'paid', label: 'Paid clients', basis: 'period', kind: 'count', better: true,
    def: 'Clients whose first received payment landed in the period (invoice or Finance).',
    compute: (rows, ctx) => { const n = rows.filter((r) => r.paid && inPeriodAt(r.paidMonth, r.paidAt, ctx)).length; return { value: n, n }; } },
  // ── Period money ──
  { key: 'booked', label: 'Booked', basis: 'period', kind: 'money', better: true,
    def: 'Value of quotes the client accepted in the period, plus extra charges. Selected currency only; never converted.',
    compute: (rows, ctx) => { const v = sumMoney(rows, ctx, 'booked'); return { value: v, n: rows.filter((r) => r.money[ctx.currency]).length }; } },
  { key: 'cash', label: 'Cash collected', basis: 'period', kind: 'money', better: true,
    def: 'Payments received in the period, by payment date. Refunds count as negative.',
    compute: (rows, ctx) => ({ value: sumMoney(rows, ctx, 'cash'), n: 0 }) },
  { key: 'invoiced', label: 'Invoiced', basis: 'period', kind: 'money', better: true,
    def: 'Total of invoices sent in the period (drafts excluded).',
    compute: (rows, ctx) => ({ value: sumMoney(rows, ctx, 'invoiced'), n: 0 }) },
  { key: 'margin', label: 'Margin', basis: 'period', kind: 'money', better: true,
    def: 'Expected margin (contract value − provider cost) of quotes accepted in the period.',
    compute: (rows, ctx) => ({ value: sumMoney(rows, ctx, 'margin'), n: 0 }) },
  { key: 'marginPct', label: 'Margin %', basis: 'period', kind: 'rate', better: true,
    def: 'Margin ÷ booked, over accepted deals whose provider cost is recorded (deals without a cost would understate it).',
    compute: (rows, ctx) => {
      const known = (r: LeadFact) => r.costKnown || !r.isLead;
      const b = sumMoney(rows, ctx, 'booked', known), m = sumMoney(rows, ctx, 'margin', known), all = sumMoney(rows, ctx, 'booked');
      return { value: b > 0 ? m / b : null, n: 0, num: m, den: b, note: all > 0 && b < all ? `${Math.round((b / all) * 100)}% of booked has a cost on file` : undefined };
    } },
  { key: 'avgDeal', label: 'Avg deal size', basis: 'period', kind: 'money', better: true,
    def: 'Booked ÷ won deals that have a booked value, both by acceptance month (Sales Report rule).',
    compute: (rows, ctx) => {
      const b = sumMoney(rows, ctx, 'booked');
      const n = rows.filter((r) => r.won && inPeriodAt(r.wonMonth, r.acceptedAt, ctx) && (r.money[ctx.currency]?.booked ?? 0) > 0).length;
      return { value: n ? b / n : null, n };
    } },
  // ── Cohort rates ──
  { key: 'winRate', label: 'Win rate', basis: 'cohort', kind: 'rate', better: true, phases: LEAD_ONLY,
    binomial: (r) => (r.won ? 1 : 0),
    def: 'Share of the period\'s leads that have accepted a quote by today (cohort). Young cohorts look lower until they mature.',
    compute: (rows, ctx) => ({ ...rate(rows, ctx, (r) => (r.won ? 1 : 0)), note: maturingNote(rows, ctx) }) },
  { key: 'matureWinRate', label: `Win rate (${MATURE_DAYS}-day)`, basis: 'cohort', kind: 'rate', better: true, phases: LEAD_ONLY,
    binomial: (r) => ((r.leadAgeDays ?? 0) < MATURE_DAYS ? null : r.won && r.daysToClose !== null && r.daysToClose <= MATURE_DAYS ? 1 : 0),
    def: `Share of leads at least ${MATURE_DAYS} days old that won within ${MATURE_DAYS} days. Fair across old and new cohorts; used by insights and the finder.`,
    compute: (rows, ctx) => rate(rows, ctx, (r) => ((r.leadAgeDays ?? 0) < MATURE_DAYS ? null : r.won && r.daysToClose !== null && r.daysToClose <= MATURE_DAYS ? 1 : 0)) },
  { key: 'quoteRate', label: 'Quote rate', basis: 'cohort', kind: 'rate', better: true, phases: LEAD_ONLY,
    binomial: (r) => (r.quoteSentMonth ? 1 : 0),
    def: 'Share of the period\'s leads that received a quote.',
    compute: (rows, ctx) => rate(rows, ctx, (r) => (r.quoteSentMonth ? 1 : 0)) },
  { key: 'quoteToWin', label: 'Quote → win', basis: 'cohort', kind: 'rate', better: true, phases: LEAD_QUOTE,
    binomial: (r) => (r.quoteSentMonth ? (r.won ? 1 : 0) : null),
    def: 'Of the period\'s leads that got a quote, the share that accepted. Per lead (the Sales Report acceptance rate is per quote).',
    compute: (rows, ctx) => rate(rows, ctx, (r) => (r.quoteSentMonth ? (r.won ? 1 : 0) : null)) },
  { key: 'showRate', label: 'Show rate', basis: 'cohort', kind: 'rate', better: true, phases: LEAD_ONLY,
    binomial: (r) => (r.callBooked ? (r.callAttended ? 1 : 0) : null),
    def: 'Of the period\'s leads that booked a discovery call, the share that attended.',
    compute: (rows, ctx) => rate(rows, ctx, (r) => (r.callBooked ? (r.callAttended ? 1 : 0) : null)) },
  { key: 'payRate', label: 'Pay rate', basis: 'cohort', kind: 'rate', better: true, phases: LEAD_QUOTE,
    binomial: (r) => (r.won ? (r.paid ? 1 : 0) : null),
    def: 'Of the period\'s leads that won, the share that has paid anything.',
    compute: (rows, ctx) => rate(rows, ctx, (r) => (r.won ? (r.paid ? 1 : 0) : null)) },
  { key: 'dropRate', label: 'Drop rate', basis: 'cohort', kind: 'rate', better: false, phases: LEAD_ONLY,
    binomial: DROP,
    def: 'Share of the period\'s leads that were a no-show, not qualified, or dropped.',
    compute: (rows, ctx) => rate(rows, ctx, DROP) },
  { key: 'bookedPerLead', label: 'Booked per lead', basis: 'cohort', kind: 'money', better: true,
    def: 'Booked value (selected currency) of the period\'s leads ÷ ALL of the period\'s leads, whatever currency they buy in.',
    compute: (rows, ctx) => { const den = rows.filter((r) => inCohort(r, ctx)).length; const num = cohortMoney(rows, ctx, 'booked'); return { value: den ? num / den : null, n: den, num, den }; } },
  { key: 'marginPerLead', label: 'Margin per lead', basis: 'cohort', kind: 'money', better: true,
    def: 'Expected margin of the period\'s leads ÷ all of the period\'s leads. The best single "value of a lead" number.',
    compute: (rows, ctx) => { const den = rows.filter((r) => inCohort(r, ctx)).length; const num = cohortMoney(rows, ctx, 'margin'); return { value: den ? num / den : null, n: den, num, den }; } },
  { key: 'cashCollection', label: 'Cash collection', basis: 'cohort', kind: 'rate', better: true,
    def: 'Cash received so far ÷ booked, for the period\'s leads.',
    compute: (rows, ctx) => { const b = cohortMoney(rows, ctx, 'booked'), c = cohortMoney(rows, ctx, 'cash'); return { value: b > 0 ? c / b : null, n: 0, num: c, den: b }; } },
  { key: 'daysToClose', label: 'Median days to close', basis: 'cohort', kind: 'days', better: false,
    def: 'Median days from lead to first acceptance, over the period\'s leads that won.',
    compute: (rows, ctx) => med(rows, ctx, (r) => r.daysToClose, () => true) },
  { key: 'quoteTurnaround', label: 'Median quote turnaround', basis: 'cohort', kind: 'days', better: false,
    def: 'Median days from lead to the first quote reaching the client.',
    compute: (rows, ctx) => med(rows, ctx, (r) => r.quoteTurnaroundDays, () => true) },
  { key: 'decisionDays', label: 'Median client decision', basis: 'cohort', kind: 'days', better: false,
    def: 'Median days from first quote to acceptance, over quoted leads.',
    compute: (rows, ctx) => med(rows, ctx, (r) => r.decisionDays, (r) => !!r.quoteSentMonth) },
  { key: 'acceptToPaid', label: 'Median accepted → paid', basis: 'cohort', kind: 'days', better: false,
    def: 'Median days from acceptance to the first payment, over won leads.',
    compute: (rows, ctx) => med(rows, ctx, (r) => r.acceptToPaidDays, (r) => r.won) },
  // ── As of today ──
  { key: 'openQuotes', label: 'Open quotes value', basis: 'asOf', kind: 'money', better: true,
    def: 'Value of quotes sent and not yet accepted (largest option per lead), in the selected currency, as of today.',
    compute: (rows, ctx) => { let v = 0, n = 0; for (const r of rows) if (r.openQuote?.cur === ctx.currency) { v += r.openQuote.total; n++; } return { value: v, n, note: `${n} open quote${n === 1 ? '' : 's'}` }; } },
  { key: 'forecast', label: 'Pipeline forecast', basis: 'asOf', kind: 'money', better: true,
    def: 'Estimate: each open quote × the historical chance a quote of its age is later accepted (0–14, 15–45, 46–90 days; older ≈ 0).',
    compute: (rows, ctx) => { const f = forecast(rows, ctx.currency); return { value: f.expected, n: f.open, note: f.open ? `± ${f.sd.toLocaleString('en-US')} · from ${f.open} open quotes` : 'No open quotes' }; } },
  { key: 'receivable', label: 'Receivable', basis: 'asOf', kind: 'money', better: false,
    def: 'Unpaid balance of sent invoices, as of today. (Booked but not yet invoiced is not owed yet and is not included.)',
    compute: (rows, ctx) => {
      let v = 0, old = 0;
      for (const r of rows) { const a = r.receivable[ctx.currency]; if (a) { v += a.d0_30 + a.d31_60 + a.d61_90 + a.d90p; old += a.d61_90 + a.d90p; } }
      return { value: Math.round(v * 100) / 100, n: 0, note: old > 0 ? `${Math.round((old / v) * 100)}% is over 60 days` : undefined };
    } },
  { key: 'unknownChannel', label: 'Unknown channel', basis: 'cohort', kind: 'rate', better: false,
    def: 'Share of the period\'s leads with no channel recorded — a data-capture gap.',
    compute: (rows, ctx) => rate(rows, ctx, (r) => (r.channel === 'Unknown' || r.channel === 'Other' ? 1 : 0)) },
];

export const MEASURE: Record<string, Measure> = Object.fromEntries(MEASURES.map((m) => [m.key, m]));
export const BINOMIAL_MEASURES = MEASURES.filter((m) => m.binomial);

export function basisLabel(m: Measure): string {
  return m.basis === 'period' ? 'in period' : m.basis === 'cohort' ? 'leads of period' : 'as of today';
}
