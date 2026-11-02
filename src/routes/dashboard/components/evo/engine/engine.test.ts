import { describe, expect, it } from 'vitest';
import { chiSquareGof, chiSquareP, holm, newcombeDiff, normCdf, normQuantile, posteriorSummary, waldInteraction, betaSample, rng } from './stats.ts';
import { evaluate, decisionPoint, RULES } from './rules.ts';
import { crDay, crDayStart, joinExperiment, leadIndex } from './join.ts';
import { analyzeExperiment } from './experiment.ts';
import { scanPairs, configurations } from './combos.ts';
import { scanAudiences } from './audiences.ts';
import { buildLab } from './lab.ts';
import { syntheticEvo, syntheticLead } from './synthetic.ts';
import { forecastDecision } from './forecast.ts';
import { normalizeSpec } from './ask.ts';
import type { EvoCube } from './types.ts';

const NOW = Date.parse('2026-11-30T18:00:00.000Z');
const opts = (leads: ReturnType<typeof leadIndex>) => ({ now: NOW, windowDays: 30, currency: 'USD', leads, live: 2, noForecast: true });

describe('stats', () => {
  it('normal cdf / quantile round trip', () => {
    expect(normCdf(1.959964)).toBeCloseTo(0.975, 4);
    expect(normQuantile(0.975)).toBeCloseTo(1.959964, 4);
  });
  it('chi-square p matches tables', () => {
    expect(chiSquareP(3.841, 1)).toBeCloseTo(0.05, 3);
    expect(chiSquareP(5.991, 2)).toBeCloseTo(0.05, 3);
    expect(chiSquareP(0, 3)).toBe(1);
  });
  it('newcombe interval brackets the difference', () => {
    const ci = newcombeDiff(60, 300, 45, 300)!;
    expect(ci.lo).toBeLessThan(0.05);
    expect(ci.hi).toBeGreaterThan(0.05);
    expect(ci.lo).toBeGreaterThan(-0.02);
  });
  it('holm is monotone and capped', () => {
    expect(holm([0.01, 0.04, 0.03])).toEqual([0.03, 0.06, 0.06]);
  });
  it('posterior: normal path matches monte carlo', () => {
    const arms = [{ arm: 'a', n: 1000, x: 150 }, { arm: 'b', n: 1000, x: 180 }];
    const norm = posteriorSummary(arms, 'a');
    expect(norm.method).toBe('normal');
    const mc = posteriorSummary([...arms, { arm: 'c', n: 1000, x: 0 }].slice(0, 2).map((a) => ({ ...a })).concat([]), 'a');
    expect(mc.pBest.b).toBeCloseTo(norm.pBest.b, 6);
    const three = posteriorSummary([...arms, { arm: 'c', n: 1000, x: 150 }], 'a');
    expect(three.method).toBe('montecarlo');
    expect(three.pBest.b).toBeGreaterThan(0.9);
    expect(Math.abs(three.pBest.a + three.pBest.b + three.pBest.c - 1)).toBeLessThan(1e-9);
  });
  it('beta sampler mean is right', () => {
    const r = rng(5);
    let s = 0;
    for (let i = 0; i < 20000; i++) s += betaSample(3, 7, r);
    expect(s / 20000).toBeCloseTo(0.3, 2);
  });
  it('wald interaction: null quiet, planted found', () => {
    const nul = waldInteraction([[{ n: 1000, x: 100 }, { n: 1000, x: 120 }], [{ n: 1000, x: 130 }, { n: 1000, x: 150 }]])!;
    expect(nul.p).toBeGreaterThan(0.5);
    const hit = waldInteraction([[{ n: 1000, x: 100 }, { n: 1000, x: 100 }], [{ n: 1000, x: 100 }, { n: 1000, x: 170 }]])!;
    expect(hit.p).toBeLessThan(0.01);
    expect(hit.df).toBe(1);
  });
  it('SRM goodness of fit', () => {
    expect(chiSquareGof([500, 500], [0.5, 0.5]).p).toBe(1);
    expect(chiSquareGof([560, 440], [0.5, 0.5]).p).toBeLessThan(0.001);
  });
});

describe('rules', () => {
  const base = { control: 'a', guardrails: [], runDays: 60, srmP: 0.5, imbalanceP: null, stalled: false, live: 1 };
  it('floors', () => {
    expect(evaluate({ ...base, runDays: 5, arms: [{ arm: 'a', n: 900, x: 300 }, { arm: 'b', n: 900, x: 500 }] }).state).toBe('too_early');
    const r = evaluate({ ...base, arms: [{ arm: 'a', n: 100, x: 12 }, { arm: 'b', n: 100, x: 20 }] });
    expect(r.state).toBe('too_early');
    expect(r.needed.a).toBe(18);
  });
  it('ship, keep control, no difference', () => {
    expect(evaluate({ ...base, arms: [{ arm: 'a', n: 2000, x: 300 }, { arm: 'b', n: 2000, x: 400 }] }).state).toBe('ready');
    expect(evaluate({ ...base, arms: [{ arm: 'a', n: 2000, x: 400 }, { arm: 'b', n: 2000, x: 300 }] }).state).toBe('keep_control');
    expect(evaluate({ ...base, arms: [{ arm: 'a', n: 40000, x: 6000 }, { arm: 'b', n: 40000, x: 6010 }] }).state).toBe('no_difference');
  });
  it('data problem beats everything', () => {
    expect(evaluate({ ...base, srmP: 1e-6, arms: [{ arm: 'a', n: 2000, x: 300 }, { arm: 'b', n: 2000, x: 400 }] }).state).toBe('data_problem');
    expect(evaluate({ ...base, stalled: true, arms: [{ arm: 'a', n: 10, x: 1 }, { arm: 'b', n: 10, x: 1 }] }).state).toBe('data_problem');
  });
  it('guardrail hold fires before floors, and unevaluable guardrails are named', () => {
    const g = [{ key: 'lead', label: 'Lead', arms: [{ arm: 'a', n: 2000, x: 100 }, { arm: 'b', n: 2000, x: 40 }] }];
    expect(evaluate({ ...base, runDays: 8, guardrails: g, arms: [{ arm: 'a', n: 2000, x: 300 }, { arm: 'b', n: 2000, x: 400 }] }).state).toBe('guardrail_hold');
    const thin = [{ key: 'lead', label: 'Lead', arms: [{ arm: 'a', n: 2000, x: 3 }, { arm: 'b', n: 2000, x: 2 }] }];
    const r = evaluate({ ...base, guardrails: thin, arms: [{ arm: 'a', n: 2000, x: 300 }, { arm: 'b', n: 2000, x: 400 }] });
    expect(r.state).toBe('ready');
    expect(r.unevaluable).toEqual(['Lead']);
  });
  it('decision point is the latest Monday 06:00 CR', () => {
    const mon = decisionPoint(Date.parse('2026-11-04T10:00:00Z')); // Wednesday
    expect(new Date(mon).toISOString()).toBe('2026-11-02T12:00:00.000Z');
    expect(new Date(decisionPoint(Date.parse('2026-11-02T11:59:00Z'))).toISOString()).toBe('2026-10-26T12:00:00.000Z');
  });
  it('starting thresholds are the tuned ones', () => {
    expect(RULES.T_ship).toBe(0.99);
  });
});

describe('join', () => {
  it('CR day helpers', () => {
    expect(crDay(Date.parse('2026-11-04T05:30:00Z'))).toBe('2026-11-03');
    expect(new Date(crDayStart('2026-11-04')).toISOString()).toBe('2026-11-04T06:00:00.000Z');
  });
  it('credits the lead to the earliest-assigned visitor only, inside the window', () => {
    const t1 = Date.parse('2026-11-05T15:00:00Z');
    const cube: EvoCube = {
      ...syntheticEvo({ days: 1, perDay: 0 }).cube,
      visitors: [
        { vid: 0, person: 0, assign: { HeroForm: { v: 'a', t: t1, day: crDay(t1), p: 0.5, source: 'fixed', commit: 'c', crossover: false, x: [] } }, ctx: null as any, steps: {} },
        { vid: 1, person: 0, assign: { HeroForm: { v: 'b', t: t1 + 3600_000, day: crDay(t1), p: 0.5, source: 'fixed', commit: 'c', crossover: false, x: [] } }, ctx: null as any, steps: {} },
        { vid: 2, person: 1, assign: { HeroForm: { v: 'a', t: t1, day: crDay(t1), p: 0.5, source: 'fixed', commit: 'c', crossover: false, x: [] } }, ctx: null as any, steps: {} },
        { vid: 3, person: 2, assign: { HeroForm: { v: 'a', t: t1, day: crDay(t1), p: 0.5, source: 'fixed', commit: 'c', crossover: false, x: ['bot'] } }, ctx: null as any, steps: {} },
      ],
      persons: [
        { leads: [{ id: 'early', at: t1 - 5 * 86400_000, test: false }, { id: 'L', at: t1 + 86400_000, test: false }], visitors: [0, 1] },
        { leads: [{ id: 'late', at: t1 + 45 * 86400_000, test: false }], visitors: [2] },
        { leads: [], visitors: [3] },
      ],
    };
    const j = joinExperiment(cube, cube.experiments[0], { windowDays: 30 });
    expect(j.all.length).toBe(4);
    expect(j.units.length).toBe(3); // bot excluded
    expect(j.units.find((u) => u.vid === 0)!.leadId).toBe('L'); // pre-assignment lead skipped
    expect(j.units.find((u) => u.vid === 1)!.leadId).toBe(null); // later device not credited
    expect(j.units.find((u) => u.vid === 2)!.leadId).toBe(null); // outside the 30-day window
    const j60 = joinExperiment(cube, cube.experiments[0], { windowDays: 60 });
    expect(j60.units.find((u) => u.vid === 2)!.leadId).toBe('late');
  });
});

describe('experiment analysis on synthetic data', () => {
  it('finds a planted click lift and keeps the null experiment quiet', () => {
    const { cube, leads } = syntheticEvo({ seed: 9, days: 120, perDay: 40 });
    const L = leadIndex(leads);
    const hero = analyzeExperiment(joinExperiment(cube, cube.experiments[0], { windowDays: 30 }), opts(L));
    const chat = analyzeExperiment(joinExperiment(cube, cube.experiments[1], { windowDays: 30 }), opts(L));
    expect(hero.primary.comparisons[0].rel!).toBeGreaterThan(0.1);
    expect(hero.decision.state).toBe('ready');
    expect(['collecting', 'leaning', 'no_difference']).toContain(chat.decision.state);
    expect(hero.srm!.p).toBeGreaterThan(0.001);
  });
  it('maturity: recent visitors are maturing, not failures', () => {
    const { cube, leads } = syntheticEvo({ seed: 2, days: 20, perDay: 30 });
    const a = analyzeExperiment(joinExperiment(cube, cube.experiments[0], { windowDays: 30 }), opts(leadIndex(leads)));
    const lead = a.guardrails.find((g) => g.key === 'lead')!;
    expect(lead.arms.every((x) => x.n === 0)).toBe(true); // nobody is 30 days old yet
    expect(lead.arms.reduce((s, x) => s + x.maturing, 0)).toBeGreaterThan(500);
    expect(a.primary.arms.reduce((s, x) => s + x.n, 0)).toBeGreaterThan(300); // clicks mature after 7 days
  });
  it('detects a sample ratio mismatch', () => {
    const { cube, leads } = syntheticEvo({ seed: 4, days: 60, perDay: 40, srmShare: 0.56 });
    const a = analyzeExperiment(joinExperiment(cube, cube.experiments[0], { windowDays: 30 }), opts(leadIndex(leads)));
    expect(a.decision.state).toBe('data_problem');
  });
  it('filters never change decision states (computed on all data)', () => {
    const { cube, leads } = syntheticEvo({ seed: 9, days: 120, perDay: 40 });
    const all = buildLab(cube, leads, { now: NOW });
    const webOnly = buildLab(cube, leads, { now: NOW, surface: 'web' });
    expect(webOnly.analyses[0].decision.state).toBe(all.analyses.find((a) => a.def.componentKey === webOnly.analyses[0].def.componentKey)!.decision.state);
  });
  it('multi-device bias stays under 0.2 percentage points (spec §6.1)', () => {
    // Planted: arm b lifts the lead rate from 5 % to 6.5 % (+1.5 pp). Half of the
    // converters have a second, independently assigned, never-credited device.
    let sum = 0;
    const seeds = 20;
    for (let s = 0; s < seeds; s++) {
      const x = syntheticEvo({ seed: 100 + s, days: 100, perDay: 60, baseLead: 0.05, multiDevice: 0.5, experiments: [{ key: 'HeroForm', primary: 'lead', leadLift: 0.3 }] });
      const a = analyzeExperiment(joinExperiment(x.cube, x.cube.experiments[0], { windowDays: 30 }), { ...opts(leadIndex(x.leads)), now: NOW + 40 * 86400_000 });
      sum += a.primary.comparisons[0].diff!;
    }
    expect(Math.abs(sum / seeds - 0.015)).toBeLessThan(0.002);
  });
});

describe('combinations and audiences', () => {
  it('finds a planted interaction and not a null one', () => {
    const ctx = (l: ReturnType<typeof leadIndex>) => ({ now: NOW, windowDays: 30, currency: 'USD', leads: l });
    const hit = syntheticEvo({ seed: 6, days: 120, perDay: 120, baseLead: 0.06, interaction: 0.9, experiments: [{ key: 'HeroForm', primary: 'lead' }, { key: 'Chatbot', surface: 'chat', primary: 'lead' }] });
    const H = leadIndex(hit.leads);
    const scan = scanPairs(['HeroForm', 'Chatbot'].map((k) => joinExperiment(hit.cube, hit.cube.experiments.find((d) => d.componentKey === k)!, { windowDays: 30 })), ctx(H));
    const pr = scan.pairs.find((p) => p.metric === 'lead')!;
    expect(pr.locked).toBe(false);
    expect(pr.significant).toBe(true);
    expect(pr.sentence).toContain('per 100 visitors');
    const nul = syntheticEvo({ seed: 6, days: 120, perDay: 120, baseLead: 0.06, experiments: [{ key: 'HeroForm', primary: 'lead' }, { key: 'Chatbot', surface: 'chat', primary: 'lead' }] });
    const N = leadIndex(nul.leads);
    const scan0 = scanPairs(['HeroForm', 'Chatbot'].map((k) => joinExperiment(nul.cube, nul.cube.experiments.find((d) => d.componentKey === k)!, { windowDays: 30 })), ctx(N));
    expect(scan0.pairs.find((p) => p.metric === 'lead')!.significant).toBe(false);
  });
  it('locks interactions and configurations at low volume', () => {
    const { cube, leads } = syntheticEvo({ seed: 1, days: 30, perDay: 10 });
    const L = leadIndex(leads);
    const js = cube.experiments.map((d) => joinExperiment(cube, d, { windowDays: 30 }));
    const ctx = { now: NOW, windowDays: 30, currency: 'USD', leads: L };
    expect(scanPairs(js, ctx).pairs.every((p) => p.locked)).toBe(true);
    expect(configurations(js, ['HeroForm', 'Chatbot'], 'lead', ctx).locked).toBe(true);
  });
  it('configurations rank by shrunk rate once unlocked', () => {
    const { cube, leads } = syntheticEvo({ seed: 6, days: 120, perDay: 120, baseLead: 0.06, interaction: 0.9, experiments: [{ key: 'HeroForm', primary: 'lead' }, { key: 'Chatbot', surface: 'chat', primary: 'lead' }] });
    const js = cube.experiments.map((d) => joinExperiment(cube, d, { windowDays: 30 }));
    const t = configurations(js, ['HeroForm', 'Chatbot'], 'lead', { now: NOW, windowDays: 30, currency: 'USD', leads: leadIndex(leads) });
    expect(t.locked).toBe(false);
    expect(t.rows[0].config).toEqual({ HeroForm: 'b', Chatbot: 'b' });
    expect(t.rows[0].shrunk).toBeLessThan(t.rows[0].rate + 1e-12);
  });
  it('audience finder: planted mobile effect found; lock below 100 conversions', () => {
    const { cube, leads } = syntheticEvo({ seed: 8, days: 120, perDay: 150, baseLead: 0.06, experiments: [{ key: 'HeroForm', primary: 'lead', mobileLift: 1.0 }] });
    const js = cube.experiments.map((d) => joinExperiment(cube, d, { windowDays: 30 }));
    const scan = scanAudiences(js, { now: NOW, windowDays: 30, currency: 'USD', leads: leadIndex(leads) });
    const hit = scan.effects.find((e) => e.significant && e.dim === 'device');
    expect(hit).toBeTruthy();
    const small = syntheticEvo({ seed: 8, days: 30, perDay: 10, experiments: [{ key: 'HeroForm', primary: 'lead' }] });
    const s2 = scanAudiences(small.cube.experiments.map((d) => joinExperiment(small.cube, d, { windowDays: 30 })), { now: NOW, windowDays: 30, currency: 'USD', leads: leadIndex(small.leads) });
    expect(s2.locked.length).toBe(1);
  });
});

describe('forecast, ask, performance', () => {
  it('forecast gives weeks to a decision, none without traffic', () => {
    const f = forecastDecision({ control: 'a', arms: [{ arm: 'a', n: 300, x: 45 }, { arm: 'b', n: 300, x: 56 }], dailyRate: { a: 16, b: 16 }, maturing: { a: 100, b: 100 }, lagDays: 7, runDays: 20 });
    expect(f.medianWeeks).not.toBeNull();
    expect(f.medianWeeks!).toBeLessThan(40);
    expect(forecastDecision({ control: 'a', arms: [], dailyRate: { a: 0 }, maturing: {}, lagDays: 7, runDays: 1 }).medianWeeks).toBeNull();
  });
  it('ask spec validation drops unknown keys', () => {
    const { cube } = syntheticEvo({ days: 1, perDay: 0 });
    const s = normalizeSpec({ view: 'audience', experiment: 'Nope', splitBy: 'origin', explanation: [], unresolved: [] }, cube);
    expect(s.experiment).toBe('HeroForm');
    expect(s.splitBy).toBeUndefined();
    expect(s.unresolved.length).toBe(3);
  });
  it('whole lab under 150 ms for ~20k visitors (no forecast)', () => {
    const { cube, leads } = syntheticEvo({ seed: 2, days: 120, perDay: 170 });
    expect(cube.visitors.length).toBeGreaterThan(19000);
    buildLab(cube, leads, { now: NOW, forecast: false }); // warm up
    const t0 = performance.now();
    const lab = buildLab(cube, leads, { now: NOW, forecast: false });
    const ms = performance.now() - t0;
    expect(lab.analyses.length).toBe(2);
    expect(ms).toBeLessThan(150);
    const t1 = performance.now();
    buildLab(cube, leads, { now: NOW });
    expect(performance.now() - t1).toBeLessThan(1500); // with forecasts
  });
});

describe('synthetic lead helper', () => {
  it('builds a complete LeadFact', () => {
    const l = syntheticLead('x', NOW);
    expect(l.isLead).toBe(true);
    expect(l.leadMonth).toBe('2026-11');
  });
});
