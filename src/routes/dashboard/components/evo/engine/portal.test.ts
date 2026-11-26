import { describe, expect, it } from 'vitest';
import { DAY_MS, joinExperiment, leadIndex } from './join.ts';
import { metricDef, portalKeysIn } from './metrics.ts';
import { analyzeExperiment } from './experiment.ts';
import { syntheticEvo } from './synthetic.ts';
import type { EvoCube, Unit } from './types.ts';

const NOW = Date.parse('2026-11-30T18:00:00.000Z');
const W = 30;

function unit(o: Partial<Unit>): Unit {
  return { vid: 0, arm: 'a', t: Date.parse('2026-09-01T15:00:00.000Z'), day: '2026-09-01', crossover: false, x: [], ctx: null, steps: {}, leadId: 'L1', leadAt: null, portal: {}, drip: null, ...o };
}
const value = (key: string, u: Unit) => metricDef(key).value(u, null, { W, currency: 'USD' });

describe('status page steps as Evo outcomes', () => {
  it('counts a step of the credited lead inside W + 45 days, not after', () => {
    const u = unit({});
    expect(value('portal:quote_view', { ...u, portal: { quote_view: u.t + 10 * DAY_MS } })).toBe(1);
    expect(value('portal:quote_view', { ...u, portal: { quote_view: u.t + (W + 46) * DAY_MS } })).toBe(0);
    expect(value('portal:quote_view', u)).toBe(0);
  });

  it('gives every arm the same time: the unit waits W + 45 days before it counts', () => {
    expect(metricDef('portal:option_select').lag(W)).toBe(W + 45);
    expect(metricDef('portal:option_select').label).toBe('Picked option');
  });

  it('a drip unit only counts steps after the email assignment', () => {
    const drip = { reachedType: true, opened: true, clicked: false, firstClickDays: null };
    const u = unit({ drip });
    expect(value('portal:portal_open', { ...u, portal: { portal_open: u.t - DAY_MS } })).toBe(0);
    expect(value('portal:portal_open', { ...u, portal: { portal_open: u.t + DAY_MS } })).toBe(1);
  });

  it('lists the steps present, in the order clients go through them', () => {
    const us = [unit({ portal: { payment_start: 1, portal_open: 1 } }), unit({ portal: { quote_view: 1 } })];
    expect(portalKeysIn(us)).toEqual(['portal:portal_open', 'portal:quote_view', 'portal:payment_start']);
  });

  it('joins the credited lead’s steps to the unit and shows them in the scorecard', () => {
    const { cube, leads } = syntheticEvo({ seed: 5, days: 60, perDay: 20, now: '2026-11-30T18:00:00.000Z' });
    const credited = cube.persons.map((p) => p.leads[0].id);
    const portal: EvoCube['portal'] = Object.fromEntries(credited.map((id, i): [string, Record<string, number>] => [id, i % 2 ? { quote_view: NOW - 5 * DAY_MS } : {}]));
    const withPortal: EvoCube = { ...cube, portal };
    const def = cube.experiments[0];
    const j = joinExperiment(withPortal, def, { windowDays: W });
    const lead = j.units.find((u) => u.leadId && Object.keys(u.portal).length);
    expect(lead?.portal.quote_view).toBe(NOW - 5 * DAY_MS);
    expect(j.units.filter((u) => !u.leadId).every((u) => Object.keys(u.portal).length === 0)).toBe(true);

    const a = analyzeExperiment(j, { now: NOW, windowDays: W, currency: 'USD', leads: leadIndex(leads), live: 2, noForecast: true });
    expect(a.secondary.map((m) => m.key)).toContain('portal:quote_view');
  });
});
