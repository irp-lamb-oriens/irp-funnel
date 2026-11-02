/**
 * sales.ts — the Sales Book's computations (docs/designs/sales-book-v3.md §5).
 *
 * Pure. Inputs are the two payloads the tab loads:
 *   - v2 `deals[]` / `receivables[]`  — per-deal money and as-of balances
 *     (Sales Report v2, the authority for those)
 *   - cube `LeadFact[]`               — per-month / per-day money, dimensions
 * Nothing here re-derives a number v2 or the ledger already defines; it only
 * slices, partitions and relates them. Rules shared with the Hub (stalled,
 * pace, concentration, forecast, maturity) are imported, never restated.
 */
import type { SalesV2Deal, SalesV2Receivable } from '../../../store.ts';
import type { Ctx, LeadFact } from './types.ts';
import { DIM, MEASURE, dimLabel, dimValues, forecast, inCohort, quoteWinCurve, QUOTE_AGE_BUCKETS } from './registry.ts';
import { aggregate } from './cube.ts';
import { median } from './stats.ts';
import { crDateKey, crToday, monthRange, shiftMonth } from './period.ts';
import { CONCENTRATION_MIN_DEALS, MTD_MIN_DAY, MTD_MIN_EVENTS, STALLED_MAX_QUOTE_AGE, STALLED_QUIET_DAYS } from './insights.ts';

export type Deal = SalesV2Deal;
export type Receivable = SalesV2Receivable;

const r2 = (n: number) => Math.round(n * 100) / 100;
const sum = <T>(xs: T[], f: (x: T) => number) => r2(xs.reduce((s, x) => s + f(x), 0));
const monthOf = (iso: string | null | undefined) => crDateKey(iso)?.slice(0, 7) ?? null;

function daysSince(iso: string | null | undefined, now: Date): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : Math.max(0, Math.floor((now.getTime() - t) / 86_400_000));
}
function monthsBetween(a: string, b: string): number {
  const [ya, ma] = a.split('-').map(Number);
  const [yb, mb] = b.split('-').map(Number);
  return (yb - ya) * 12 + (mb - ma);
}

// ── Joining the two payloads ─────────────────────────────────────────────────

/** Cube rows by deal key (cube `id` = v2 `key`). */
export function rowIndex(rows: LeadFact[]): Map<string, LeadFact> {
  return new Map(rows.map((r) => [r.id, r]));
}

/**
 * The v2 deals that survive the active filter chips: a deal is kept when its
 * cube row is in the filtered rows. With no chips, every deal is kept
 * (including any deal without a cube row).
 */
export function dealsForRows(deals: Deal[], filteredRows: LeadFact[], filtersActive: boolean): Deal[] {
  if (!filtersActive) return deals;
  const keep = new Set(filteredRows.map((r) => r.id));
  return deals.filter((d) => keep.has(d.key));
}

/** A deal is active in the period when any of its dated events falls in it. */
export function activeInPeriod(d: Deal, row: LeadFact | undefined, months: string[], allTime: boolean): boolean {
  if (allTime) return true;
  const set = new Set(months);
  for (const iso of [d.leadAt, d.quoteSentAt, d.acceptedAt, d.invoicedAt ?? null, d.paidAt]) {
    const m = monthOf(iso);
    if (m && set.has(m)) return true;
  }
  for (const p of row?.payments ?? []) { const m = monthOf(p.at); if (m && set.has(m)) return true; }
  if (row) for (const c of Object.values(row.money)) for (const [m, cell] of Object.entries(c.byMonth)) if (set.has(m) && (cell.cash || cell.invoiced || cell.booked)) return true;
  return false;
}

// ── Book totals and the money bridge ─────────────────────────────────────────

export interface BookTotals {
  deals: number;
  byStatus: Record<string, number>;
  booked: number; invoiced: number; cash: number; margin: number;
  outstanding: number; backlog: number; credit: number; refunds: number;
  /** Σ max(0, invoiced − booked): invoiced above the accepted value. */
  invoicedAboveBooked: number;
  /** Balances of deals dropped after a client acceptance (not in Outstanding). */
  droppedBalance: number;
  otherCurrencies: Record<string, { deals: number; booked: number }>;
}

/** Totals over deals in `currency` (other currencies are counted, never summed in). */
export function bookTotals(deals: Deal[], currency: string): BookTotals {
  const t: BookTotals = {
    deals: 0, byStatus: {}, booked: 0, invoiced: 0, cash: 0, margin: 0, outstanding: 0, backlog: 0, credit: 0, refunds: 0,
    invoicedAboveBooked: 0, droppedBalance: 0, otherCurrencies: {},
  };
  for (const d of deals) {
    if (d.currency !== currency) {
      const o = (t.otherCurrencies[d.currency] ??= { deals: 0, booked: 0 });
      o.deals++; o.booked = r2(o.booked + d.booked);
      continue;
    }
    t.deals++;
    t.byStatus[d.status] = (t.byStatus[d.status] ?? 0) + 1;
    t.booked += d.booked; t.invoiced += d.invoiced; t.cash += d.cash; t.margin += d.margin;
    t.credit += d.credit; t.refunds += d.refunds ?? 0;
    t.invoicedAboveBooked += Math.max(0, d.invoiced - d.booked);
    // v2 as-of rule: Outstanding and backlog leave out dropped deals.
    if (d.status === 'dropped') t.droppedBalance += d.outstanding;
    else { t.outstanding += d.outstanding; t.backlog += d.backlog; }
  }
  for (const k of ['booked', 'invoiced', 'cash', 'margin', 'outstanding', 'backlog', 'credit', 'refunds', 'invoicedAboveBooked', 'droppedBalance'] as const) t[k] = r2(t[k]);
  return t;
}

export interface BridgeStep { key: string; label: string; value: number; kind: 'total' | 'add' | 'sub'; status?: string }

/**
 * Booked → Outstanding, per the v2 per-deal identity
 *   outstanding − credit = max(booked, invoiced) − cash
 * so  Σ booked + Σ invoiced-above-booked − Σ cash + Σ credit = Σ outstanding (all deals)
 * and Σ outstanding (all) = Outstanding (live) + dropped balances.
 */
export function moneyBridge(t: BookTotals): { steps: BridgeStep[]; closes: boolean } {
  const allOutstanding = r2(t.outstanding + t.droppedBalance);
  const steps: BridgeStep[] = [
    { key: 'booked', label: 'Booked', value: t.booked, kind: 'total' },
    ...(t.invoicedAboveBooked ? [{ key: 'above', label: 'Invoiced above booked', value: t.invoicedAboveBooked, kind: 'add' as const }] : []),
    { key: 'cash', label: 'Collected', value: t.cash, kind: 'sub' },
    ...(t.credit ? [{ key: 'credit', label: 'Overpaid (client credit)', value: t.credit, kind: 'add' as const }] : []),
    ...(t.droppedBalance ? [{ key: 'dropped', label: 'Dropped after acceptance (not owed)', value: t.droppedBalance, kind: 'sub' as const, status: 'dropped' }] : []),
    { key: 'outstanding', label: 'Outstanding', value: t.outstanding, kind: 'total' },
  ];
  const lhs = r2(t.booked + t.invoicedAboveBooked - t.cash + t.credit);
  return { steps, closes: Math.abs(lhs - allOutstanding) < 1 };
}

// ── Outstanding, explained (a true partition of v2 Outstanding) ──────────────

export type NotInvoicedAge = '0-30' | '31-90' | '90+' | 'undated';
export type InvoicedAge = '0-30' | '31-60' | '61-90' | '90+';

export interface OutstandingRow {
  deal: Deal;
  invoicedUnpaid: number;
  notInvoiced: number;
  notInvoicedAge: NotInvoicedAge;
  /** invoicedUnpaid split over this deal's open invoices, by age. */
  byInvoiceAge: Record<InvoicedAge, number>;
  /** Invoice balances not covered by the deal's balance (paid in Finance, not on the invoice). */
  paidOutsideInvoices: number;
}

const ageBucket = (a: number | null): InvoicedAge => (a === null || a > 90 ? '90+' : a > 60 ? '61-90' : a > 30 ? '31-60' : '0-30');

export interface OutstandingPartition {
  total: number;
  invoicedUnpaid: number;
  notInvoiced: number;
  invoicedByAge: Record<InvoicedAge, number>;
  notInvoicedByAge: Record<NotInvoicedAge, number>;
  /** Dropped after acceptance: shown, never counted in Outstanding. */
  atRisk: { total: number; deals: Deal[] };
  paidOutsideInvoices: number;
  rows: OutstandingRow[];
}

export function outstandingPartition(deals: Deal[], receivables: Receivable[], currency: string, now = new Date()): OutstandingPartition {
  const recByDeal = new Map<string, Receivable[]>();
  for (const r of receivables) if (r.currency === currency && r.due > 0) {
    const a = recByDeal.get(r.dealKey) ?? [];
    a.push(r);
    recByDeal.set(r.dealKey, a);
  }
  const out: OutstandingPartition = {
    total: 0, invoicedUnpaid: 0, notInvoiced: 0,
    invoicedByAge: { '0-30': 0, '31-60': 0, '61-90': 0, '90+': 0 },
    notInvoicedByAge: { '0-30': 0, '31-90': 0, '90+': 0, undated: 0 },
    atRisk: { total: 0, deals: [] }, paidOutsideInvoices: 0, rows: [],
  };
  for (const d of deals) {
    if (d.currency !== currency || d.outstanding <= 0) continue;
    if (d.status === 'dropped') { out.atRisk.total += d.outstanding; out.atRisk.deals.push(d); continue; }
    const invoicedUnpaid = r2(Math.min(d.outstanding, Math.max(0, d.invoiced - d.cash)));
    const notInvoiced = r2(d.outstanding - invoicedUnpaid);
    const age = daysSince(d.acceptedAt, now);
    const notInvoicedAge: NotInvoicedAge = age === null ? 'undated' : age <= 30 ? '0-30' : age <= 90 ? '31-90' : '90+';
    const recs = recByDeal.get(d.key) ?? [];
    const dueSum = recs.reduce((s, r) => s + r.due, 0);
    const byInvoiceAge: Record<InvoicedAge, number> = { '0-30': 0, '31-60': 0, '61-90': 0, '90+': 0 };
    if (invoicedUnpaid > 0) {
      if (dueSum > 0) {
        // Scale the open invoices so their buckets sum to the deal's invoiced-unpaid part.
        const k = Math.min(1, invoicedUnpaid / dueSum);
        for (const r of recs) { const b = r.bucket === 'credit' ? '0-30' : r.bucket; byInvoiceAge[b] += r.due * k; }
        // Open invoices smaller than the deal's part (credits elsewhere): age the
        // remainder by the deal's first invoice.
        const rest = invoicedUnpaid - Object.values(byInvoiceAge).reduce((s, v) => s + v, 0);
        if (rest > 0.005) byInvoiceAge[ageBucket(daysSince(d.invoicedAt, now))] += rest;
      } else {
        byInvoiceAge[ageBucket(daysSince(d.invoicedAt, now))] += invoicedUnpaid;
      }
    }
    const paidOutside = r2(Math.max(0, dueSum - invoicedUnpaid));
    for (const k of Object.keys(byInvoiceAge) as InvoicedAge[]) { byInvoiceAge[k] = r2(byInvoiceAge[k]); out.invoicedByAge[k] += byInvoiceAge[k]; }
    out.notInvoicedByAge[notInvoicedAge] += notInvoiced;
    out.total += d.outstanding;
    out.invoicedUnpaid += invoicedUnpaid;
    out.notInvoiced += notInvoiced;
    out.paidOutsideInvoices += paidOutside;
    out.rows.push({ deal: d, invoicedUnpaid, notInvoiced, notInvoicedAge, byInvoiceAge, paidOutsideInvoices: paidOutside });
  }
  out.total = r2(out.total); out.invoicedUnpaid = r2(out.invoicedUnpaid); out.notInvoiced = r2(out.notInvoiced);
  out.atRisk.total = r2(out.atRisk.total); out.paidOutsideInvoices = r2(out.paidOutsideInvoices);
  for (const k of Object.keys(out.invoicedByAge) as InvoicedAge[]) out.invoicedByAge[k] = r2(out.invoicedByAge[k]);
  for (const k of Object.keys(out.notInvoicedByAge) as NotInvoicedAge[]) out.notInvoicedByAge[k] = r2(out.notInvoicedByAge[k]);
  out.rows.sort((a, b) => b.deal.outstanding - a.deal.outstanding);
  out.atRisk.deals.sort((a, b) => b.outstanding - a.outstanding);
  return out;
}

// ── Expected cash (estimate) ─────────────────────────────────────────────────

/**
 * Chance a balance is collected, by part and age. PLACEHOLDERS until enough
 * history exists to measure them (spec D11) — printed on the page, edit here.
 */
export const P_COLLECT = {
  invoiced: { '0-30': 1, '31-60': 1, '61-90': 0.5, '90+': 0.5 } as Record<InvoicedAge, number>,
  notInvoiced: { '0-30': 0.8, '31-90': 0.8, '90+': 0.3, undated: 0.3 } as Record<NotInvoicedAge, number>,
};

export interface ExpectedCash {
  fromInvoiced: number;
  fromNotInvoiced: number;
  fromOpenQuotes: number;
  total: number;
  /** ±1 sd of the open-quote part only. */
  quoteSd: number;
  openQuotes: number;
  excludedAtRisk: number;
}

/**
 * @param curveRows rows for the quote-win curve: every non-test row, never the
 *                  filtered set (a small filtered set would make p = 0).
 * @param openRows  the rows whose open quotes count (the filtered set).
 */
export function expectedCash(part: OutstandingPartition, curveRows: LeadFact[], openRows: LeadFact[], currency: string): ExpectedCash {
  let inv = 0, notInv = 0;
  for (const k of Object.keys(part.invoicedByAge) as InvoicedAge[]) inv += part.invoicedByAge[k] * P_COLLECT.invoiced[k];
  for (const k of Object.keys(part.notInvoicedByAge) as NotInvoicedAge[]) notInv += part.notInvoicedByAge[k] * P_COLLECT.notInvoiced[k];
  const f = forecast(openRows, currency, quoteWinCurve(curveRows));
  return {
    fromInvoiced: Math.round(inv), fromNotInvoiced: Math.round(notInv), fromOpenQuotes: f.expected,
    total: Math.round(inv + notInv + f.expected), quoteSd: f.sd, openQuotes: f.open, excludedAtRisk: part.atRisk.total,
  };
}

/**
 * Forecast backtest: the quote-win curve learnt from quotes first sent ≥ 180
 * days ago, applied to quotes first sent 60–180 days ago, vs what happened.
 */
export function forecastCalibration(rows: LeadFact[]): { tested: number; predicted: number; actual: number } | null {
  const age = (r: LeadFact) => (r.leadAgeDays ?? 0) - (r.quoteTurnaroundDays ?? 0);
  const quoted = rows.filter((r) => r.isLead && !r.likelyTest && r.quoteSentMonth && r.leadAgeDays !== null);
  const train = quoted.filter((r) => age(r) >= 180);
  const test = quoted.filter((r) => age(r) >= 60 && age(r) < 180);
  if (train.length < 20 || test.length < 10) return null;
  const p0 = quoteWinCurve(train)[0];
  return { tested: test.length, predicted: Math.round(test.length * p0 * 10) / 10, actual: test.filter((r) => r.won).length };
}

// ── Money history ────────────────────────────────────────────────────────────

export interface HistoryRow {
  key: string; label: string; inProgress: boolean;
  leads: number; won: number; booked: number; cash: number; margin: number; marginPct: number | null;
  avgDeal: number | null; rolling3Booked: number | null; lastYearBooked: number | null; yoyPct: number | null;
  cumBooked: number; cumCash: number;
}

/** Monthly (or quarterly / yearly) history from the first month with data to now. */
export function moneyHistory(rows: LeadFact[], currency: string, firstMonth: string, nowMonth: string, grain: 'month' | 'quarter' | 'year' = 'month'): HistoryRow[] {
  const months = monthRange(firstMonth, nowMonth);
  const idx = new Map(months.map((m, i) => [m, i]));
  const base = months.map((m) => ({ m, leads: 0, won: 0, wonBooked: 0, booked: 0, cash: 0, margin: 0, costBooked: 0, costMargin: 0 }));
  for (const r of rows) {
    if (r.isLead && r.leadMonth && idx.has(r.leadMonth)) base[idx.get(r.leadMonth)!].leads++;
    const money = r.money[currency];
    if (r.won && r.wonMonth && idx.has(r.wonMonth)) {
      const b = base[idx.get(r.wonMonth)!];
      b.won++;
      if ((money?.booked ?? 0) > 0) b.wonBooked++;
    }
    if (!money) continue;
    const known = r.costKnown || !r.isLead;
    for (const [m, c] of Object.entries(money.byMonth)) {
      const i = idx.get(m);
      if (i === undefined) continue;
      base[i].booked += c.booked; base[i].cash += c.cash; base[i].margin += c.margin;
      if (known) { base[i].costBooked += c.booked; base[i].costMargin += c.margin; }
    }
  }
  const keyOf = (m: string) => grain === 'month' ? m : grain === 'year' ? m.slice(0, 4) : `${m.slice(0, 4)}-Q${Math.floor((Number(m.slice(5, 7)) - 1) / 3) + 1}`;
  const groups = new Map<string, typeof base>();
  for (const b of base) { const k = keyOf(b.m); const g = groups.get(k) ?? []; g.push(b); groups.set(k, g); }
  const out: HistoryRow[] = [];
  let cumB = 0, cumC = 0;
  const keys = [...groups.keys()];
  const nowKey = keyOf(nowMonth);
  keys.forEach((k) => {
    const g = groups.get(k)!;
    const s = (f: (x: (typeof base)[number]) => number) => r2(g.reduce((a, x) => a + f(x), 0));
    const booked = s((x) => x.booked), cash = s((x) => x.cash), margin = s((x) => x.margin);
    const costB = s((x) => x.costBooked), costM = s((x) => x.costMargin);
    const wonBooked = s((x) => x.wonBooked);
    cumB += booked; cumC += cash;
    out.push({
      key: k, label: k, inProgress: k === nowKey,
      leads: s((x) => x.leads), won: s((x) => x.won), booked, cash, margin,
      marginPct: costB > 0 ? costM / costB : null,
      avgDeal: wonBooked > 0 ? r2(booked / wonBooked) : null,
      rolling3Booked: null, lastYearBooked: null, yoyPct: null,
      cumBooked: r2(cumB), cumCash: r2(cumC),
    });
  });
  const per = grain === 'month' ? 12 : grain === 'quarter' ? 4 : 1;
  out.forEach((row, i) => {
    if (grain === 'month' && i >= 2) row.rolling3Booked = r2((out[i].booked + out[i - 1].booked + out[i - 2].booked) / 3);
    if (i >= per) {
      row.lastYearBooked = out[i - per].booked;
      row.yoyPct = out[i - per].booked > 0 && !row.inProgress ? (row.booked - out[i - per].booked) / out[i - per].booked : null;
    }
  });
  return out;
}

// ── Post-sale collection curve ───────────────────────────────────────────────

export interface CollectionCurveRow { month: string; deals: number; booked: number; cells: Array<number | null>; depositsBefore: number }

/**
 * For deals first accepted in month m: cumulative cash by k months after
 * acceptance ÷ booked at acceptance. Censored where m + k is past the last
 * complete month. Deals dropped after acceptance are left out (returned apart).
 */
export function collectionCurve(rows: LeadFact[], currency: string, nowMonth: string, maxK = 6, cohorts = 12): { rows: CollectionCurveRow[]; cancelled: { deals: number; booked: number; cash: number }; average: Array<number | null> } {
  const lastComplete = shiftMonth(nowMonth, -1);
  const from = shiftMonth(lastComplete, -(cohorts - 1));
  const byMonth = new Map<string, { deals: number; booked: number; cash: number[]; before: number }>();
  const cancelled = { deals: 0, booked: 0, cash: 0 };
  for (const r of rows) {
    if (!r.won || !r.wonMonth || r.wonMonth < from || r.wonMonth > lastComplete) continue;
    const booked = sum((r.bookedAt ?? []).filter((b) => b.cur === currency && monthOf(b.at) === r.wonMonth), (b) => b.amount);
    if (booked <= 0) continue;
    const pays = (r.payments ?? []).filter((p) => p.cur === currency && p.at);
    if (r.status === 'dropped') { cancelled.deals++; cancelled.booked += booked; cancelled.cash += sum(pays, (p) => p.amount); continue; }
    const g = byMonth.get(r.wonMonth) ?? { deals: 0, booked: 0, cash: Array(maxK + 1).fill(0), before: 0 };
    g.deals++; g.booked += booked;
    for (const p of pays) {
      const pm = monthOf(p.at)!;
      let k = monthsBetween(r.wonMonth, pm);
      if (k < 0) { g.before++; k = 0; }
      if (k <= maxK) g.cash[k] += p.amount;
    }
    byMonth.set(r.wonMonth, g);
  }
  const out: CollectionCurveRow[] = [];
  const colNum = Array(maxK + 1).fill(0), colDen = Array(maxK + 1).fill(0);
  for (const m of monthRange(from, lastComplete)) {
    const g = byMonth.get(m);
    if (!g) continue;
    let cum = 0;
    const cells = g.cash.map((c, k) => {
      cum += c;
      if (monthsBetween(m, lastComplete) < k) return null;
      colNum[k] += cum; colDen[k] += g.booked;
      return cum / g.booked;
    });
    out.push({ month: m, deals: g.deals, booked: r2(g.booked), cells, depositsBefore: g.before });
  }
  return { rows: out, cancelled: { deals: cancelled.deals, booked: r2(cancelled.booked), cash: r2(cancelled.cash) }, average: colDen.map((d, k) => (d > 0 ? colNum[k] / d : null)) };
}

// ── Quote movement ───────────────────────────────────────────────────────────

export interface QuoteMovement {
  n: number; median: number | null; down: number; same: number; up: number;
  sameQuote: { n: number; median: number | null }; revised: { n: number; median: number | null };
  currencySwitches: number;
  rows: Array<{ deal: Deal; change: number; revised: boolean }>;
}

/** (accepted quote total − first quote total) ÷ first, over won deals (sales-book-v3 §5.5). */
export function quoteMovement(deals: Deal[], currency: string): QuoteMovement {
  const rows: QuoteMovement['rows'] = [];
  let switches = 0;
  for (const d of deals) {
    if (!d.acceptedAt || !d.firstQuoteTotal || d.acceptedQuoteTotal == null) continue;
    if (d.firstQuoteCurrency && d.firstQuoteCurrency !== d.currency) { switches++; continue; }
    if (d.currency !== currency) continue;
    rows.push({ deal: d, change: (d.acceptedQuoteTotal - d.firstQuoteTotal) / d.firstQuoteTotal, revised: d.acceptedQuoteSameAsFirst === false });
  }
  const ch = rows.map((r) => r.change);
  const flat = (x: number) => Math.abs(x) < 0.005;
  return {
    n: rows.length, median: median(ch),
    down: ch.filter((x) => x < 0 && !flat(x)).length, same: ch.filter(flat).length, up: ch.filter((x) => x > 0 && !flat(x)).length,
    sameQuote: { n: rows.filter((r) => !r.revised).length, median: median(rows.filter((r) => !r.revised).map((r) => r.change)) },
    revised: { n: rows.filter((r) => r.revised).length, median: median(rows.filter((r) => r.revised).map((r) => r.change)) },
    currencySwitches: switches,
    rows: rows.sort((a, b) => a.change - b.change),
  };
}

// ── Concentration and repeat clients ─────────────────────────────────────────

export interface Concentration {
  wonDeals: number;
  /** Hub rule: top-3 deals' share of booked; null under CONCENTRATION_MIN_DEALS. */
  top3DealShare: number | null;
  topClientBookedShare: number | null;
  topClient: string | null;
  topClientOutstandingShare: number | null;
  topDebtor: string | null;
  /** Cumulative share of booked by client rank; only with ≥ 30 clients. */
  pareto: number[] | null;
}

const clientOf = (d: Deal) => d.clientKey ?? `deal:${d.key}`;

export function concentration(won: Deal[], open: Deal[], currency: string): Concentration {
  const deals = won.filter((d) => d.currency === currency && d.booked > 0).sort((a, b) => b.booked - a.booked);
  const total = deals.reduce((s, d) => s + d.booked, 0);
  const byClient = new Map<string, { name: string; booked: number }>();
  for (const d of deals) { const c = byClient.get(clientOf(d)) ?? { name: d.name, booked: 0 }; c.booked += d.booked; byClient.set(clientOf(d), c); }
  const clients = [...byClient.values()].sort((a, b) => b.booked - a.booked);
  const owed = new Map<string, { name: string; v: number }>();
  for (const d of open) if (d.currency === currency && d.outstanding > 0 && d.status !== 'dropped') { const c = owed.get(clientOf(d)) ?? { name: d.name, v: 0 }; c.v += d.outstanding; owed.set(clientOf(d), c); }
  const debtors = [...owed.values()].sort((a, b) => b.v - a.v);
  const owedTotal = debtors.reduce((s, d) => s + d.v, 0);
  let cum = 0;
  return {
    wonDeals: deals.length,
    top3DealShare: deals.length >= CONCENTRATION_MIN_DEALS && total > 0 ? deals.slice(0, 3).reduce((s, d) => s + d.booked, 0) / total : null,
    topClientBookedShare: clients.length && total > 0 ? clients[0].booked / total : null,
    topClient: clients[0]?.name ?? null,
    topClientOutstandingShare: debtors.length && owedTotal > 0 ? debtors[0].v / owedTotal : null,
    topDebtor: debtors[0]?.name ?? null,
    pareto: clients.length >= 30 && total > 0 ? clients.map((c) => (cum += c.booked) / total) : null,
  };
}

export function repeatClients(won: Deal[], currency: string): { clients: number; repeat: number; repeatBookedShare: number | null; medianMonthsBetween: number | null; list: Array<{ name: string; deals: number; booked: number }> } {
  const by = new Map<string, Deal[]>();
  for (const d of won) if (d.acceptedAt) { const a = by.get(clientOf(d)) ?? []; a.push(d); by.set(clientOf(d), a); }
  let repeatBooked = 0, total = 0;
  const gaps: number[] = [];
  const list: Array<{ name: string; deals: number; booked: number }> = [];
  for (const ds of by.values()) {
    const b = ds.filter((d) => d.currency === currency).reduce((s, d) => s + d.booked, 0);
    total += b;
    if (ds.length < 2) continue;
    repeatBooked += b;
    const sorted = ds.map((d) => d.acceptedAt!).sort();
    for (let i = 1; i < sorted.length; i++) gaps.push((Date.parse(sorted[i]) - Date.parse(sorted[i - 1])) / (30.44 * 86_400_000));
    list.push({ name: ds[0].name, deals: ds.length, booked: r2(b) });
  }
  return {
    clients: by.size, repeat: list.length, repeatBookedShare: total > 0 ? repeatBooked / total : null,
    medianMonthsBetween: median(gaps), list: list.sort((a, b) => b.deals - a.deals || b.booked - a.booked),
  };
}

// ── Speed of collection ──────────────────────────────────────────────────────

export interface Collection {
  /** Median days from first invoice (else acceptance) to the last payment, over fully paid deals. */
  daysToCollectPaid: { value: number | null; n: number };
  /** Receivable today ÷ invoiced in the last 90 days × 90. */
  dso90: number | null;
  medianOpenInvoiceAge: { value: number | null; n: number };
  refundRate: number | null;
}

export function collectionSpeed(deals: Deal[], rowsById: Map<string, LeadFact>, receivables: Receivable[], currency: string, now = new Date()): Collection {
  const paidDays: number[] = [];
  let cashIn = 0, refunds = 0;
  for (const d of deals) {
    if (d.currency !== currency) continue;
    cashIn += Math.max(0, d.cash + (d.refunds ?? 0));
    refunds += d.refunds ?? 0;
    if (d.status !== 'paid') continue;
    const start = d.invoicedAt ?? d.acceptedAt;
    const pays = (rowsById.get(d.key)?.payments ?? []).filter((p) => p.at && p.cur === currency && p.amount > 0).map((p) => p.at!).sort();
    const last = pays[pays.length - 1];
    if (start && last) { const v = (Date.parse(last) - Date.parse(start)) / 86_400_000; if (v >= 0) paidDays.push(v); }
  }
  const open = receivables.filter((r) => r.currency === currency && r.due > 0);
  const receivable = open.reduce((s, r) => s + r.due, 0);
  const since = new Date(now.getTime() - 90 * 86_400_000).toISOString();
  let invoiced90 = 0;
  for (const r of rowsById.values()) for (const i of r.invoicedAtList ?? []) if (i.cur === currency && i.at && i.at >= since) invoiced90 += i.amount;
  const ages = open.map((r) => r.ageDays).filter((x): x is number => x !== null);
  return {
    daysToCollectPaid: { value: median(paidDays), n: paidDays.length },
    dso90: invoiced90 > 0 ? (receivable / invoiced90) * 90 : null,
    medianOpenInvoiceAge: { value: median(ages), n: ages.length },
    refundRate: cashIn > 0 ? refunds / cashIn : null,
  };
}

// ── Pipeline: open quotes, stalled, losses, coverage ─────────────────────────

export interface OpenQuoteBucket { label: string; start: number; count: number; value: number; p: number }

export function openQuoteBuckets(openRows: LeadFact[], curveRows: LeadFact[], currency: string): OpenQuoteBucket[] {
  const curve = quoteWinCurve(curveRows);
  const labels = QUOTE_AGE_BUCKETS.map((s, i) => (i === QUOTE_AGE_BUCKETS.length - 1 ? `${s}+ days` : `${s}–${QUOTE_AGE_BUCKETS[i + 1] - 1} days`));
  const out = QUOTE_AGE_BUCKETS.map((start, i) => ({ label: labels[i], start, count: 0, value: 0, p: curve[i] ?? 0 }));
  for (const r of openRows) {
    const q = r.openQuote;
    if (!q || q.cur !== currency) continue;
    let b = 0;
    for (let i = 0; i < QUOTE_AGE_BUCKETS.length; i++) if ((q.ageDays ?? 0) >= QUOTE_AGE_BUCKETS[i]) b = i;
    out[b].count++;
    out[b].value = r2(out[b].value + q.total);
  }
  return out;
}

/** Hub stalled rule (insights.ts): quoted, quiet > 14 days, quote ≤ 90 days old. */
export function isStalled(r: LeadFact | undefined): boolean {
  return !!r && r.isLead && r.status === 'quoted' && !!r.openQuote && (r.openQuote.ageDays ?? 0) <= STALLED_MAX_QUOTE_AGE && (r.daysSinceActivity ?? 0) > STALLED_QUIET_DAYS;
}

export interface LossValue {
  byReason: Array<{ key: string; label: string; deals: number; value: number }>;
  byStage: Array<{ key: string; deals: number; value: number }>;
  cancelledAfterAcceptance: { deals: number; booked: number; rate: number | null };
}

const DROP_LABEL: Record<string, string> = { noShow: 'No-show', nonQualified: 'Not qualified', saleDropped: 'Sale dropped', unknown: 'Dropped (no reason)' };

/** Value lost on dropped deals (largest option of the first quote), by reason and by the stage they sat in. */
export function lossValue(deals: Deal[], currency: string, months: string[] | null): LossValue {
  const set = months ? new Set(months) : null;
  const reason = new Map<string, { deals: number; value: number }>();
  const stage = new Map<string, { deals: number; value: number }>();
  let won = 0, cancelled = 0, cancelledBooked = 0;
  for (const d of deals) {
    if (d.currency !== currency) continue;
    const inP = (iso: string | null | undefined) => !set || (!!monthOf(iso) && set.has(monthOf(iso)!));
    if (d.acceptedAt && inP(d.acceptedAt)) {
      won++;
      if (d.cancelledAfterAcceptance) { cancelled++; cancelledBooked += d.booked; }
    }
    if (d.status !== 'dropped' || d.cancelledAfterAcceptance) continue;
    if (set && !inP(d.lastActivityAt)) continue;
    const v = d.firstQuoteTotal ?? 0;
    const k = d.dropKind ?? 'unknown';
    const a = reason.get(k) ?? { deals: 0, value: 0 }; a.deals++; a.value += v; reason.set(k, a);
    const s = d.stageLabel ?? '(none)';
    const b = stage.get(s) ?? { deals: 0, value: 0 }; b.deals++; b.value += v; stage.set(s, b);
  }
  return {
    byReason: [...reason.entries()].map(([key, x]) => ({ key, label: DROP_LABEL[key] ?? key, deals: x.deals, value: r2(x.value) })).sort((a, b) => b.value - a.value),
    byStage: [...stage.entries()].map(([key, x]) => ({ key, deals: x.deals, value: r2(x.value) })).sort((a, b) => b.value - a.value),
    cancelledAfterAcceptance: { deals: cancelled, booked: r2(cancelledBooked), rate: won ? cancelled / won : null },
  };
}

/** Open-quote value ÷ average monthly booked over the last 3 complete months. */
export function pipelineCoverage(rows: LeadFact[], currency: string, nowMonth: string): { months: number | null; openValue: number; avgBooked: number } {
  const open = MEASURE.openQuotes.compute(rows, { months: [], allTime: true, currency, nowMonth }).value ?? 0;
  const last3 = [1, 2, 3].map((k) => shiftMonth(nowMonth, -k));
  const booked = aggregate(rows, 'booked', { months: last3, allTime: false, currency, nowMonth }).value ?? 0;
  const avg = booked / 3;
  return { months: avg > 0 ? open / avg : null, openValue: r2(open), avgBooked: r2(avg) };
}

export function quotesPerWonDeal(deals: Deal[]): { value: number | null; n: number } {
  const q = deals.filter((d) => d.acceptedAt && typeof d.quotes === 'number' && d.quotes > 0).map((d) => d.quotes!);
  return { value: median(q), n: q.length };
}

export function currencyMix(deals: Deal[], wonInPeriod: (d: Deal) => boolean): Array<{ currency: string; deals: number; booked: number }> {
  const m = new Map<string, { deals: number; booked: number }>();
  for (const d of deals) if (wonInPeriod(d) && d.booked > 0) { const a = m.get(d.currency) ?? { deals: 0, booked: 0 }; a.deals++; a.booked += d.booked; m.set(d.currency, a); }
  return [...m.entries()].map(([currency, a]) => ({ currency, deals: a.deals, booked: r2(a.booked) })).sort((a, b) => b.deals - a.deals);
}

// ── Deal book: saved views ───────────────────────────────────────────────────

/** The part of a deal's Outstanding that is not invoiced (same split as outstandingPartition). */
export function notInvoicedOf(d: Deal): number {
  if (d.status === 'dropped' || d.outstanding <= 0) return 0;
  return r2(d.outstanding - Math.min(d.outstanding, Math.max(0, d.invoiced - d.cash)));
}

export interface SavedView { key: string; label: string; rule: string; test: (d: Deal, r: LeadFact | undefined, recs: Receivable[]) => boolean; sort?: (a: Deal, b: Deal) => number; limit?: number }

/** sales-book-v3 §6.5 — each chip is exactly this predicate. */
export const SAVED_VIEWS: SavedView[] = [
  { key: 'all', label: 'All deals', rule: 'every deal', test: () => true },
  { key: 'open_quotes', label: 'Open quotes', rule: 'status quoted', test: (d) => d.status === 'quoted' },
  { key: 'not_invoiced', label: 'Accepted, not invoiced', rule: 'still owes part of the accepted value with no invoice for it (not dropped)', test: (d) => notInvoicedOf(d) > 0, sort: (a, b) => notInvoicedOf(b) - notInvoicedOf(a) },
  { key: 'invoiced_unpaid', label: 'Invoiced, unpaid', rule: 'invoiced above cash, still owes, not dropped', test: (d) => d.invoiced > d.cash && d.outstanding > 0 && d.status !== 'dropped', sort: (a, b) => b.outstanding - a.outstanding },
  { key: 'overdue60', label: 'Overdue 60+', rule: 'an invoice sent more than 60 days ago still has a balance', test: (_d, _r, recs) => recs.some((x) => (x.ageDays ?? 0) > 60 && x.due > 0), sort: (a, b) => b.outstanding - a.outstanding },
  { key: 'stalled', label: 'Stalled quotes', rule: 'quoted, quiet more than 14 days, quote at most 90 days old', test: (_d, r) => isStalled(r) },
  { key: 'paid', label: 'Paid in full', rule: 'status paid', test: (d) => d.status === 'paid' },
  { key: 'dropped_after_quote', label: 'Dropped after quote', rule: 'dropped, had a quote, never accepted', test: (d) => d.status === 'dropped' && !!d.quoteSentAt && !d.acceptedAt },
  { key: 'cancelled', label: 'Cancelled after acceptance', rule: 'dropped after the client accepted', test: (d) => !!d.cancelledAfterAcceptance },
  { key: 'credits', label: 'Credits', rule: 'client paid more than owed', test: (d) => d.credit > 0 },
  { key: 'top20', label: 'Top 20 by booked', rule: '20 largest booked values', test: (d) => d.booked > 0, sort: (a, b) => b.booked - a.booked, limit: 20 },
];

export function applyView(view: SavedView, deals: Deal[], rowsById: Map<string, LeadFact>, recsByDeal: Map<string, Receivable[]>): Deal[] {
  let out = deals.filter((d) => view.test(d, rowsById.get(d.key), recsByDeal.get(d.key) ?? []));
  if (view.sort) out = [...out].sort(view.sort);
  if (view.limit) out = out.slice(0, view.limit);
  return out;
}

export function receivablesByDeal(recs: Receivable[]): Map<string, Receivable[]> {
  const m = new Map<string, Receivable[]>();
  for (const r of recs) { const a = m.get(r.dealKey) ?? []; a.push(r); m.set(r.dealKey, a); }
  return m;
}

// ── Money by segment (deals won in the period) + reconciliation ─────────────

export interface SegmentRow {
  key: string; label: string; won: number; booked: number; margin: number; marginPct: number | null;
  avgDeal: number | null; cashToDate: number; share: number | null; medianDaysToClose: number | null;
}

export interface SegmentTable {
  rows: SegmentRow[];
  total: Omit<SegmentRow, 'key' | 'label'>;
  /** Event-basis figures for the same period, and the gap between bases (§5.1). */
  reconciliation: {
    dealBooked: number; eventBooked: number;
    dealCash: number; eventCash: number;
    cashOnEarlierDeals: number; depositsNotYetWon: number; cashAfterPeriod: number; cashBeforePeriod: number;
  };
}

/**
 * Deal basis: every money figure of deals FIRST accepted in the period, cash
 * to date. A deal in several values of a multi-valued dimension (providers)
 * counts in each — no grand total is meaningful then (the caller says so).
 */
export function segmentTable(rows: LeadFact[], dimKey: string, ctx: Ctx): SegmentTable {
  const d = DIM[dimKey];
  const set = new Set(ctx.months);
  const wonIn = (r: LeadFact) => r.won && (ctx.allTime || (!!r.wonMonth && set.has(r.wonMonth)));
  const won = rows.filter(wonIn);
  const groups = new Map<string, LeadFact[]>();
  for (const r of won) for (const v of new Set(d ? dimValues(d, r) : ['All'])) { const a = groups.get(v) ?? []; a.push(r); groups.set(v, a); }
  const totalBooked = sum(won, (r) => r.money[ctx.currency]?.booked ?? 0);
  const stat = (rs: LeadFact[]) => {
    const m = (r: LeadFact) => r.money[ctx.currency];
    const booked = sum(rs, (r) => m(r)?.booked ?? 0);
    const margin = sum(rs, (r) => m(r)?.margin ?? 0);
    const known = rs.filter((r) => r.costKnown || !r.isLead);
    const kb = sum(known, (r) => m(r)?.booked ?? 0), km = sum(known, (r) => m(r)?.margin ?? 0);
    const withBooked = rs.filter((r) => (m(r)?.booked ?? 0) > 0).length;
    return {
      won: rs.length, booked, margin, marginPct: kb > 0 ? km / kb : null,
      avgDeal: withBooked ? r2(booked / withBooked) : null,
      cashToDate: sum(rs, (r) => m(r)?.cash ?? 0),
      share: totalBooked > 0 ? booked / totalBooked : null,
      medianDaysToClose: median(rs.map((r) => r.daysToClose).filter((x): x is number => x !== null && x >= 0)),
    };
  };
  const out: SegmentRow[] = [...groups.entries()].map(([key, rs]) => ({ key, label: dimLabel(dimKey, key), ...stat(rs) }));
  if (d?.order) out.sort((a, b) => d.order!.indexOf(a.key) - d.order!.indexOf(b.key));
  else out.sort((a, b) => b.booked - a.booked || b.won - a.won);

  // Reconciliation with the event basis (what the scoreboard shows).
  const eventBooked = aggregate(rows, 'booked', ctx).value ?? 0;
  const eventCash = aggregate(rows, 'cash', ctx).value ?? 0;
  let onEarlier = 0, deposits = 0, after = 0, before = 0;
  const first = ctx.months[0], last = ctx.months[ctx.months.length - 1];
  if (!ctx.allTime) for (const r of rows) {
    const money = r.money[ctx.currency];
    if (!money) continue;
    const isWonIn = wonIn(r);
    for (const [m, c] of Object.entries(money.byMonth)) {
      if (!c.cash) continue;
      const inP = m !== 'undated' && set.has(m);
      if (isWonIn) { if (m === 'undated' || m > last) after += c.cash; else if (m < first) before += c.cash; }
      else if (inP) { if (r.won && r.wonMonth && r.wonMonth < first) onEarlier += c.cash; else deposits += c.cash; }
    }
  }
  return {
    rows: out,
    total: stat(won),
    reconciliation: {
      dealBooked: totalBooked, eventBooked: r2(eventBooked),
      dealCash: sum(won, (r) => r.money[ctx.currency]?.cash ?? 0), eventCash: r2(eventCash),
      cashOnEarlierDeals: r2(onEarlier), depositsNotYetWon: r2(deposits), cashAfterPeriod: r2(after), cashBeforePeriod: r2(before),
    },
  };
}

// ── Small helpers the sections share ─────────────────────────────────────────

/** Cohort lead count of a ctx (for small-sample rules on cohort tiles). */
export function cohortSize(rows: LeadFact[], ctx: Ctx): number {
  let n = 0;
  for (const r of rows) if (inCohort(r, ctx)) n++;
  return n;
}

/** "Last 12 complete months vs the 12 before" contexts (All-time tiles, §5.3). */
export function last12Contexts(nowMonth: string, currency: string): { cur: Ctx; prev: Ctx } {
  const end = shiftMonth(nowMonth, -1);
  return {
    cur: { months: monthRange(shiftMonth(end, -11), end), allTime: false, currency, nowMonth },
    prev: { months: monthRange(shiftMonth(end, -23), shiftMonth(end, -12)), allTime: false, currency, nowMonth },
  };
}

/** Pace for the current month: value ÷ elapsed full days × days in month (Hub MTD rule: day ≥ 7, ≥ 5 events). */
export function pace(value: number | null, events: number, now = new Date()): number | null {
  const t = crToday(now);
  const [y, m] = t.month.split('-').map(Number);
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const elapsed = t.day - 1;
  if (value === null || t.day < MTD_MIN_DAY || events < MTD_MIN_EVENTS || elapsed < 1) return null;
  return (value / elapsed) * days;
}
