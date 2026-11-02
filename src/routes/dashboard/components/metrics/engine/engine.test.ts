import { describe, expect, it } from 'vitest';
import { benjaminiHochberg, fisherExact, shrunkRate, wilson, poissonFlag, median } from './stats.ts';
import { aggregate, crossTab, filterRows, groupBy, monthSeries } from './cube.ts';
import { MEASURE, MEASURES, DIMENSIONS, forecast, quoteWinCurve } from './registry.ts';
import { findCombos } from './combos.ts';
import { compareMonths, monthRange, rangeFor, shiftMonth } from './period.ts';
import { delta } from './format.ts';
import { revenueDrivers } from './insights.ts';
import { syntheticRows } from './synthetic.ts';
import type { Ctx, LeadFact } from './types.ts';

const NOW = '2026-11';
const ctxOf = (months: string[], allTime = false): Ctx => ({ months, allTime, currency: 'USD', nowMonth: NOW });

describe('stats', () => {
  it('wilson interval brackets the estimate', () => {
    const w = wilson(3, 8);
    expect(w.lo).toBeGreaterThan(0.13);
    expect(w.lo).toBeLessThan(0.14);
    expect(w.hi).toBeGreaterThan(0.69);
    expect(wilson(0, 0)).toEqual({ lo: 0, hi: 1 });
  });
  it('fisher exact matches known values', () => {
    // Classic tea-tasting table [[3,1],[1,3]] → two-sided p = 0.4857
    expect(fisherExact(3, 1, 1, 3)).toBeCloseTo(0.4857, 3);
    expect(fisherExact(10, 0, 0, 10)).toBeLessThan(0.0001);
    expect(fisherExact(0, 0, 5, 5)).toBe(1);
  });
  it('benjamini-hochberg controls discoveries', () => {
    expect(benjaminiHochberg([0.001, 0.02, 0.04, 0.5], 0.1)).toEqual([true, true, true, false]);
    expect(benjaminiHochberg([0.04, 0.5, 0.6, 0.7], 0.1)).toEqual([false, false, false, false]);
  });
  it('shrinks small samples toward the baseline', () => {
    expect(shrunkRate(3, 4, 0.1)).toBeLessThan(shrunkRate(30, 60, 0.1));
  });
  it('poisson flag stays quiet on small bases and noise', () => {
    expect(poissonFlag(12, 6)).toBeNull();
    expect(poissonFlag(14, 12)).toBeNull();
    expect(poissonFlag(25, 12)).toBe('up');
    expect(poissonFlag(3, 12)).toBe('down');
  });
  it('median', () => expect(median([5, 1, 3, 2])).toBe(2.5));
});

describe('period', () => {
  it('presets match the Sales Report rules', () => {
    expect(rangeFor('qtd', '2026-11', { from: '', to: '' }, '2025-01')).toEqual({ from: '2026-10', to: '2026-11', allTime: false });
    expect(rangeFor('last_12', '2026-11', { from: '', to: '' }, '2025-01').from).toBe('2025-12');
    expect(rangeFor('custom', '2026-11', { from: '2026-09', to: '2026-03' }, '2025-01')).toEqual({ from: '2026-03', to: '2026-09', allTime: false });
  });
  it('comparison windows', () => {
    expect(compareMonths(['2026-10', '2026-11'], 'prev', false)).toEqual(['2026-08', '2026-09']);
    expect(compareMonths(['2026-10'], 'yoy', false)).toEqual(['2025-10']);
    expect(compareMonths(['2026-10'], 'prev', true)).toBeNull();
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(monthRange('2026-11', '2026-09')).toEqual(['2026-09', '2026-10', '2026-11']);
  });
});

function row(p: Partial<LeadFact>): LeadFact {
  return { ...syntheticRows(1)[0], id: Math.random().toString(36), money: {}, receivable: {}, won: false, wonMonth: null, paid: false, paidMonth: null, likelyTest: false, ...p } as LeadFact;
}

describe('measures', () => {
  const rows: LeadFact[] = [
    row({ leadMonth: '2026-10', won: true, wonMonth: '2026-10', daysToClose: 10, leadAgeDays: 30, costKnown: true, money: { USD: { booked: 1000, margin: 300, invoiced: 0, cash: 0, byMonth: { '2026-10': { booked: 1000, margin: 300, invoiced: 0, cash: 0 } } } } }),
    row({ leadMonth: '2026-10', won: false, leadAgeDays: 30 }),
    row({ leadMonth: '2026-09', won: true, wonMonth: '2026-10', daysToClose: 40, leadAgeDays: 70, costKnown: false, money: { CRC: { booked: 50000, margin: 0, invoiced: 0, cash: 0, byMonth: { '2026-10': { booked: 50000, margin: 0, invoiced: 0, cash: 0 } } } } }),
    row({ leadMonth: null, isLead: true, won: false }),
    row({ isLead: false, leadMonth: null, won: true, wonMonth: '2026-10', money: { USD: { booked: 500, margin: 100, invoiced: 500, cash: 200, byMonth: { '2026-10': { booked: 500, margin: 100, invoiced: 500, cash: 0 }, undated: { booked: 0, margin: 0, invoiced: 0, cash: 200 } } } } }),
  ];
  const oct = ctxOf(['2026-10']);
  it('period counts and money follow event months; non-leads count in money and won', () => {
    expect(aggregate(rows, 'leads', oct).value).toBe(2);
    expect(aggregate(rows, 'won', oct).value).toBe(3);
    expect(aggregate(rows, 'booked', oct).value).toBe(1500);
    expect(aggregate(rows, 'cash', ctxOf(['2026-10'], true)).value).toBe(0); // undated cash excluded, like v2
  });
  it('All time counts undated leads', () => {
    expect(aggregate(rows, 'leads', ctxOf([], true)).value).toBe(4);
  });
  it('cohort rates exclude non-lead rows', () => {
    expect(aggregate(rows, 'winRate', oct).value).toBe(0.5);
    expect(aggregate(rows, 'winRate', oct).n).toBe(2);
  });
  it('booked per lead divides by ALL cohort leads, whatever currency', () => {
    const sepOct = ctxOf(['2026-09', '2026-10']);
    expect(aggregate(rows, 'bookedPerLead', sepOct).value).toBeCloseTo(1000 / 3);
  });
  it('margin % only over deals with a known cost', () => {
    const v = aggregate(rows, 'marginPct', oct);
    expect(v.value).toBeCloseTo(400 / 1500);
  });
  it('mature win rate ignores young leads', () => {
    const v = aggregate(rows, 'matureWinRate', ctxOf(['2026-09', '2026-10']));
    expect(v.n).toBe(1);
    expect(v.value).toBe(1);
  });
  it('every measure computes without throwing on empty input', () => {
    for (const m of MEASURES) expect(() => m.compute([], oct)).not.toThrow();
  });
});

describe('cube ops', () => {
  const rows = syntheticRows(400);
  const ctx = ctxOf(monthRange('2025-06', NOW));
  it('filters include and exclude, multi-valued dims match any', () => {
    const pa = filterRows(rows, [{ dim: 'destination', values: ['PA'] }]);
    expect(pa.every((r) => r.destination === 'PA')).toBe(true);
    const notPa = filterRows(rows, [{ dim: 'destination', values: ['PA'], exclude: true }]);
    expect(pa.length + notPa.length).toBe(rows.length);
    expect(filterRows(rows, [], { excludeTest: true }).some((r) => r.likelyTest)).toBe(false);
  });
  it('group totals add up for counts', () => {
    const g = groupBy(rows, 'channel', ['leads'], ctx);
    expect(g.reduce((s, x) => s + (x.values.leads.value ?? 0), 0)).toBe(aggregate(rows, 'leads', ctx).value);
  });
  it('top-N folds the tail', () => {
    const g = groupBy(rows, 'route', ['leads'], ctx, { top: 3 });
    expect(g.length).toBe(4);
    expect(g[3].key).toBe('__rest__');
  });
  it('cross tab shape', () => {
    const t = crossTab(rows, 'channel', 'destination', 'winRate', ctx, 4);
    expect(t.cells.length).toBe(t.rows.length);
    expect(t.cells[0].length).toBe(t.cols.length);
  });
  it('month series', () => {
    const s = monthSeries(rows, 'leads', ['2026-10', '2026-11'], ctx);
    expect(s.length).toBe(2);
  });
  it('forecast is bounded by open value', () => {
    const f = forecast(rows, 'USD', quoteWinCurve(rows));
    expect(f.expected).toBeLessThanOrEqual(f.value);
  });
});

describe('combination finder', () => {
  const rows = syntheticRows(1000);
  it('finds the planted effects and keeps outcome dims out', () => {
    const res = findCombos(rows, 'winRate');
    expect(res.pool).toBeGreaterThan(500);
    expect(res.tested).toBeGreaterThan(20);
    const top = res.working.map((s) => s.label);
    expect(top.some((l) => l.includes('Panama'))).toBe(true);
    expect(res.notWorking.some((s) => s.label.includes('WhatsApp'))).toBe(true);
    const outcome = DIMENSIONS.filter((d) => d.phase === 'outcome').map((d) => d.label);
    for (const s of [...res.working, ...res.notWorking]) for (const o of outcome) expect(s.label.startsWith(`${o}:`)).toBe(false);
  });
  it('pure noise yields no discoveries', () => {
    const noise = syntheticRows(600, NOW, 3).map((r, i) => ({ ...r, destination: 'CR', route: `${r.origin} → CR`, channel: 'Form', won: i % 5 === 0 }));
    const res = findCombos(noise, 'winRate');
    expect(res.passed).toBeLessThanOrEqual(1);
  });
  it('needs a binomial measure', () => {
    expect(findCombos(rows, 'booked').caveat).toBeTruthy();
  });
  it('benchmark: 1,000 rows under 150 ms', () => {
    const t0 = performance.now();
    findCombos(rows, 'winRate');
    expect(performance.now() - t0).toBeLessThan(150);
  });
});

describe('revenue drivers and deltas', () => {
  it('flags the planted big-budget segment', () => {
    const rows = syntheticRows(1000);
    const d = revenueDrivers(rows, 'USD');
    expect(d.high.some((x) => x.dim === 'budget' && x.value === '$20k+')).toBe(true);
  });
  it('delta wording respects direction', () => {
    const m = MEASURE.receivable;
    const d = delta(m, { value: 120, n: 0 }, { value: 100, n: 0 }, 'previous period');
    expect(d?.tone).toBe('worse');
    expect(d?.sr).toContain('worse');
    const r = delta(MEASURE.winRate, { value: 0.3, n: 1 }, { value: 0.25, n: 1 }, 'last year');
    expect(r?.text).toBe('+5 pts');
  });
});
