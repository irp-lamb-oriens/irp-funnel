import { describe, expect, it } from 'vitest';
import { aggregate } from './cube.ts';
import { MEASURE } from './registry.ts';
import { clampDate, crDateKey, fairCompare, monthRange, shiftMonth } from './period.ts';
import { deltaAllowed, fmtStat } from './format.ts';
import {
  applyView, bookTotals, collectionCurve, concentration, moneyBridge, moneyHistory, outstandingPartition, quoteMovement,
  receivablesByDeal, rowIndex, SAVED_VIEWS, segmentTable, expectedCash, activeInPeriod, last12Contexts, type Deal, type Receivable,
} from './sales.ts';
import { syntheticRows } from './synthetic.ts';
import type { Ctx, LeadFact } from './types.ts';

const NOW_M = '2026-11';
const ctx = (months: string[], extra: Partial<Ctx> = {}): Ctx => ({ months, allTime: false, currency: 'USD', nowMonth: NOW_M, ...extra });

function deal(p: Partial<Deal> & { key: string }): Deal {
  return {
    consultationId: p.key, name: p.key, route: null, service: null, providers: [], stage: null, stageLabel: null,
    status: 'accepted', currency: 'USD', leadAt: null, quoteSentAt: null, acceptedAt: null, paidAt: null,
    booked: 0, invoiced: 0, cash: 0, outstanding: 0, backlog: 0, credit: 0, margin: 0, daysToClose: null, dropKind: null,
    lastActivityAt: null, invoiceIds: [], quoteIds: [], ...p,
  } as Deal;
}
/** Per-deal fields exactly as v2 derives them from booked / invoiced / cash. */
function v2Deal(p: Partial<Deal> & { key: string; booked: number; invoiced: number; cash: number }): Deal {
  const owed = Math.max(p.booked, p.invoiced);
  return deal({ ...p, outstanding: Math.max(0, owed - p.cash), credit: Math.max(0, p.cash - owed), backlog: Math.max(0, p.booked - p.invoiced) });
}

describe('calendar dates (Costa Rica)', () => {
  it('maps instants and calendar dates the way the server months them', () => {
    expect(crDateKey('2026-11-01T05:30:00Z')).toBe('2026-10-31'); // 23:30 CR on Oct 31
    expect(crDateKey('2026-11-01T06:30:00Z')).toBe('2026-11-01');
    expect(crDateKey('2026-10-01')).toBe('2026-10-01');
    expect(crDateKey('2026-10-01T00:00:00.000Z')).toBe('2026-10-01'); // date-picker value keeps its day
    expect(crDateKey(null)).toBeNull();
  });
  it('clamps a day to the shorter month', () => {
    expect(clampDate('2026-02', 30)).toBe('2026-02-28');
    expect(clampDate('2028-02', 30)).toBe('2028-02-29');
  });
});

describe('fair comparison (§5.3)', () => {
  const at = (iso: string) => new Date(iso);
  it('day 2 of a month compares day 1 with day 1, never a whole month', () => {
    const f = fairCompare(['2026-11'], 'prev', false, at('2026-11-02T15:00:00Z'));
    expect(f).toEqual({ kind: 'days', cur: { from: '2026-11-01', to: '2026-11-01' }, cmp: { from: '2026-10-01', to: '2026-10-01' }, throughDay: 1 });
  });
  it('day 1 has no complete day yet', () => {
    expect(fairCompare(['2026-11'], 'prev', false, at('2026-11-01T15:00:00Z')).kind).toBe('none');
  });
  it('Mar 31 compares Mar 1–30 with Feb 1–28 (clamped)', () => {
    const f = fairCompare(['2026-03'], 'prev', false, at('2026-03-31T15:00:00Z'));
    expect(f.kind === 'days' && f.cmp).toEqual({ from: '2026-02-01', to: '2026-02-28' });
  });
  it('YTD vs last year uses the same calendar dates', () => {
    const f = fairCompare(monthRange('2028-01', '2028-03'), 'yoy', false, at('2028-03-31T15:00:00Z'));
    expect(f.kind === 'days' && [f.cur, f.cmp]).toEqual([{ from: '2028-01-01', to: '2028-03-30' }, { from: '2027-01-01', to: '2027-03-30' }]);
  });
  it('a range of complete months compares whole months', () => {
    expect(fairCompare(['2026-10'], 'prev', false, at('2026-11-02T15:00:00Z'))).toEqual({ kind: 'months', cmpMonths: ['2026-09'] });
  });
  it('after 23:30 CR on the last day the month is still the current one', () => {
    const f = fairCompare(['2026-10'], 'prev', false, at('2026-11-01T05:30:00Z'));
    expect(f.kind).toBe('days');
  });
  it('flat daily volume reads as flat, not a crash', () => {
    const rows: LeadFact[] = [];
    let i = 0;
    for (const d of [...monthRange('2026-10', '2026-10').flatMap((m) => Array.from({ length: 31 }, (_, k) => `${m}-${String(k + 1).padStart(2, '0')}`)), '2026-11-01', '2026-11-02']) {
      rows.push({ ...syntheticRows(1)[0], id: `x${i++}`, isLead: true, leadAt: `${d}T18:00:00.000Z`, leadMonth: d.slice(0, 7) });
    }
    const f = fairCompare(['2026-11'], 'prev', false, at('2026-11-02T15:00:00Z'));
    if (f.kind !== 'days') throw new Error('expected days');
    const cur = aggregate(rows, 'leads', ctx(['2026-11'], { dayCut: f.cur })).value;
    const prev = aggregate(rows, 'leads', ctx(['2026-10'], { dayCut: f.cmp })).value;
    expect([cur, prev]).toEqual([1, 1]);
    // The month-level comparison the old page made: 2 vs 31.
    expect(aggregate(rows, 'leads', ctx(['2026-10'])).value).toBe(31);
  });
});

describe('day cut = month for a whole month (parity)', () => {
  const rows = syntheticRows(800, NOW_M);
  const keys = ['leads', 'quotedLeads', 'won', 'paid', 'booked', 'cash', 'invoiced', 'margin', 'avgDeal', 'winRate'];
  for (const m of monthRange(shiftMonth(NOW_M, -12), shiftMonth(NOW_M, -1))) {
    it(m, () => {
      const last = clampDate(m, 31);
      for (const k of keys) {
        const a = aggregate(rows, k, ctx([m])).value;
        const b = aggregate(rows, k, ctx([m], { dayCut: { from: `${m}-01`, to: last } })).value;
        expect([k, b]).toEqual([k, a]);
      }
    });
  }
  it('quotes sent cannot be cut by day', () => {
    expect(MEASURE.quotesSent.dayComparable).toBe(false);
    expect(aggregate(rows, 'quotesSent', ctx(['2026-10'], { dayCut: { from: '2026-10-01', to: '2026-10-15' } })).value).toBeNull();
  });
});

describe('outstanding, explained (§5.5)', () => {
  const now = new Date('2026-11-02T15:00:00Z');
  const deals: Deal[] = [
    v2Deal({ key: 'a', booked: 10000, invoiced: 3000, cash: 5000, status: 'partially_paid', acceptedAt: '2026-09-20T00:00:00Z', invoicedAt: '2026-09-21T00:00:00Z' }), // all not invoiced: 5000
    v2Deal({ key: 'b', booked: 1000, invoiced: 1000, cash: 200, status: 'partially_paid', acceptedAt: '2026-10-01T00:00:00Z', invoicedAt: '2026-10-02T00:00:00Z' }), // 800 invoiced
    v2Deal({ key: 'c', booked: 0, invoiced: 400, cash: 0, status: 'invoiced', invoicedAt: '2026-08-01T00:00:00Z' }), // 400 invoiced, old
    v2Deal({ key: 'g', booked: 2000, invoiced: 0, cash: 0, status: 'dropped', acceptedAt: '2026-09-15T00:00:00Z', cancelledAfterAcceptance: true }),
    v2Deal({ key: 'k', booked: 500000, invoiced: 0, cash: 100000, status: 'partially_paid', currency: 'CRC', acceptedAt: '2026-10-09T00:00:00Z' }),
    v2Deal({ key: 'p', booked: 1000, invoiced: 1000, cash: 1200, status: 'paid' }), // credit 200
  ];
  const recs: Receivable[] = [
    { invoiceId: 'i2', number: 'INV-2', dealKey: 'b', name: 'b', currency: 'USD', sentAt: '2026-10-02T00:00:00Z', total: 1000, received: 200, due: 800, ageDays: 31, bucket: '31-60', dealStatus: 'partially_paid' },
    { invoiceId: 'i3', number: 'INV-3', dealKey: 'c', name: 'c', currency: 'USD', sentAt: '2026-08-01T00:00:00Z', total: 400, received: 0, due: 400, ageDays: 93, bucket: '90+', dealStatus: 'invoiced' },
  ];
  const t = bookTotals(deals, 'USD');
  const part = outstandingPartition(deals, recs, 'USD', now);
  it('is a true partition of v2 Outstanding', () => {
    expect(part.total).toBe(t.outstanding);
    expect(part.invoicedUnpaid + part.notInvoiced).toBe(part.total);
    expect(Object.values(part.invoicedByAge).reduce((s, v) => s + v, 0)).toBeCloseTo(part.invoicedUnpaid, 2);
    expect(Object.values(part.notInvoicedByAge).reduce((s, v) => s + v, 0)).toBeCloseTo(part.notInvoiced, 2);
    expect([part.invoicedUnpaid, part.notInvoiced]).toEqual([1200, 5000]);
  });
  it('keeps dropped-after-acceptance balances apart, never in Outstanding', () => {
    expect(part.atRisk.total).toBe(2000);
    expect(part.rows.some((r) => r.deal.key === 'g')).toBe(false);
    expect(t.droppedBalance).toBe(2000);
  });
  it('ages invoiced balances by their invoices', () => {
    expect(part.invoicedByAge).toEqual({ '0-30': 0, '31-60': 800, '61-90': 0, '90+': 400 });
  });
  it('the money bridge closes', () => {
    expect(moneyBridge(t).closes).toBe(true);
    expect(t.otherCurrencies.CRC).toEqual({ deals: 1, booked: 500000 });
  });
  it('expected cash leaves at-risk balances out and labels the range', () => {
    const e = expectedCash(part, [], [], 'USD');
    expect(e.excludedAtRisk).toBe(2000);
    // 800 × 1 (31–60) + 400 × 0.5 (90+) ; 5000 not invoiced, accepted 43 days ago → 0.8
    expect([e.fromInvoiced, e.fromNotInvoiced]).toEqual([1000, 4000]);
  });
  it('saved views match their predicates', () => {
    const byKey = rowIndex([]);
    const rb = receivablesByDeal(recs);
    const v = (k: string) => applyView(SAVED_VIEWS.find((x) => x.key === k)!, deals, byKey, rb).map((d) => d.key);
    expect(v('not_invoiced')).toEqual(['k', 'a']); // largest backlog first
    expect(v('invoiced_unpaid')).toEqual(['b', 'c']);
    expect(v('overdue60')).toEqual(['c']);
    expect(v('cancelled')).toEqual(['g']);
    expect(v('credits')).toEqual(['p']);
    expect(v('all').length).toBe(deals.length);
  });
});

describe('history, curve, movement, concentration', () => {
  const rows = syntheticRows(1000, NOW_M);
  it('money history sums to the period measures and accumulates', () => {
    const h = moneyHistory(rows, 'USD', '2025-06', NOW_M);
    const m = h.find((x) => x.key === '2026-06')!;
    expect(m.booked).toBe(aggregate(rows, 'booked', ctx(['2026-06'])).value);
    expect(m.cash).toBe(aggregate(rows, 'cash', ctx(['2026-06'])).value);
    expect(m.won).toBe(aggregate(rows, 'won', ctx(['2026-06'])).value);
    expect(h[h.length - 1].inProgress).toBe(true);
    expect(h[h.length - 1].cumBooked).toBeCloseTo(h.reduce((s, x) => s + x.booked, 0), 0);
    const q = moneyHistory(rows, 'USD', '2025-06', NOW_M, 'quarter');
    expect(q.reduce((s, x) => s + x.booked, 0)).toBeCloseTo(h.reduce((s, x) => s + x.booked, 0), 0);
  });
  it('collection curve is censored past the last complete month', () => {
    const c = collectionCurve(rows, 'USD', NOW_M);
    const last = c.rows[c.rows.length - 1];
    expect(last.month).toBe('2026-10');
    expect(last.cells[0]).not.toBeNull();
    expect(last.cells[1]).toBeNull();
    for (const r of c.rows) for (let k = 1; k < r.cells.length; k++) if (r.cells[k] !== null) expect(r.cells[k]!).toBeGreaterThanOrEqual(r.cells[k - 1]! - 1e-9);
  });
  it('quote movement separates revised quotes and skips currency switches', () => {
    const qm = quoteMovement([
      deal({ key: 'a', acceptedAt: 'x', firstQuoteTotal: 10000, acceptedQuoteTotal: 9000, acceptedQuoteSameAsFirst: false }),
      deal({ key: 'b', acceptedAt: 'x', firstQuoteTotal: 5000, acceptedQuoteTotal: 5000, acceptedQuoteSameAsFirst: true }),
      deal({ key: 'c', acceptedAt: 'x', firstQuoteTotal: 5000, acceptedQuoteTotal: 6000, acceptedQuoteSameAsFirst: false }),
      deal({ key: 'd', acceptedAt: 'x', firstQuoteTotal: 5000, firstQuoteCurrency: 'CRC', acceptedQuoteTotal: 6000 }),
    ], 'USD');
    expect([qm.n, qm.down, qm.same, qm.up, qm.currencySwitches, qm.revised.n, qm.sameQuote.n]).toEqual([3, 1, 1, 1, 1, 2, 1]);
  });
  it('concentration follows the Hub rule (≥ 10 deals, top-3 share)', () => {
    const few = Array.from({ length: 9 }, (_, i) => deal({ key: `d${i}`, booked: 1000, acceptedAt: 'x' }));
    expect(concentration(few, [], 'USD').top3DealShare).toBeNull();
    const ten = [...few, deal({ key: 'big', booked: 91000, acceptedAt: 'x' })];
    expect(concentration(ten, [], 'USD').top3DealShare).toBeCloseTo(93000 / 100000, 5);
  });
});

describe('money by segment: deal basis reconciles with the event basis', () => {
  const rows = syntheticRows(1000, NOW_M);
  for (const months of [['2026-06'], monthRange('2026-01', '2026-06')]) {
    it(months.join('..'), () => {
      const t = segmentTable(rows, 'destination', ctx(months));
      const r = t.reconciliation;
      expect(r.eventCash).toBeCloseTo(r.dealCash - r.cashAfterPeriod - r.cashBeforePeriod + r.cashOnEarlierDeals + r.depositsNotYetWon, 2);
      expect(t.rows.reduce((s, x) => s + x.booked, 0)).toBeCloseTo(r.dealBooked, 2);
      expect(t.rows.reduce((s, x) => s + x.won, 0)).toBe(aggregate(rows, 'won', ctx(months)).value);
    });
  }
});

describe('active in period', () => {
  it('uses every dated event of the deal', () => {
    const d = deal({ key: 'a', leadAt: '2026-01-05T18:00:00Z', acceptedAt: '2026-03-10T18:00:00Z' });
    const r = { ...syntheticRows(1)[0], id: 'a', payments: [{ at: '2026-06-01T18:00:00Z', amount: 1, cur: 'USD', method: 'x' }], money: {} };
    expect(activeInPeriod(d, r, ['2026-06'], false)).toBe(true);
    expect(activeInPeriod(d, r, ['2026-05'], false)).toBe(false);
    expect(activeInPeriod(d, r, [], true)).toBe(true);
  });
  it('last 12 complete months never include the current one', () => {
    const c = last12Contexts(NOW_M, 'USD');
    expect([c.cur.months[0], c.cur.months[11], c.prev.months[11]]).toEqual(['2025-11', '2026-10', '2025-10']);
  });
});

describe('small-sample rule (§5.4)', () => {
  it('rates under 15 cases print as counts', () => {
    expect(fmtStat('rate', 1, 1)).toMatchObject({ text: '1 of 1', small: true });
    expect(fmtStat('rate', 0.5, 20)).toMatchObject({ text: '50%', small: false });
    expect(fmtStat('median', 12, 2).text).toBe('n = 2');
    expect(fmtStat('median', 12, 8, { fmt: (v) => `${v} d` }).text).toBe('12 d');
  });
  it('Δ is hidden when both counts are tiny', () => {
    expect(deltaAllowed(1, 2)).toBe(false);
    expect(deltaAllowed(3, 12)).toBe(true);
  });
});

describe('performance', () => {
  it('re-slices 2,000 rows in < 100 ms', () => {
    const rows = syntheticRows(2000, NOW_M);
    const deals = rows.filter((r) => r.won || r.quotes).map((r) => v2Deal({ key: r.id, booked: r.money.USD?.booked ?? 0, invoiced: r.money.USD?.invoiced ?? 0, cash: r.money.USD?.cash ?? 0, acceptedAt: r.acceptedAt ?? null, status: r.status as Deal['status'] }));
    const t0 = performance.now();
    const c = ctx(monthRange('2026-01', '2026-10'));
    for (const k of ['leads', 'won', 'booked', 'cash', 'margin', 'marginPct', 'avgDeal', 'matureWinRate', 'openQuotes', 'forecast']) aggregate(rows, k, c);
    bookTotals(deals, 'USD');
    outstandingPartition(deals, [], 'USD');
    segmentTable(rows, 'route', c);
    moneyHistory(rows, 'USD', '2025-05', NOW_M);
    collectionCurve(rows, 'USD', NOW_M);
    const ms = performance.now() - t0;
    expect(ms).toBeLessThan(100);
  });
});
