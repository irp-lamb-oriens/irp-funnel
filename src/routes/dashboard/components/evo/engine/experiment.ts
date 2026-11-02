/**
 * experiment.ts — the scorecard for one experiment (spec §6.5).
 *
 *   • Mature counts per arm and metric (lag rule, metrics.ts)
 *   • Comparisons vs control: Newcombe interval, relative lift, chance it's
 *     better (Beta posterior), Holm-adjusted fixed-horizon p (display only)
 *   • SRM before exclusions (Bonferroni over live experiments) and an
 *     exclusion-imbalance test
 *   • Crossover sensitivity (primary metric without crossovers)
 *   • The recommendation state at the latest decision point (full data only)
 *   • Time to decision (forecast.ts)
 *   • Novelty: first-week cohort vs later cohorts, only when ready to ship
 */

import type { LeadFact } from '../../metrics/engine/types.ts';
import { armsOf, DAY_MS, type JoinedExperiment } from './join.ts';
import { metricDef, stepKeysIn, type MetricDef } from './metrics.ts';
import { decisionPoint, evaluate, RULES, type RuleResult } from './rules.ts';
import { forecastDecision, type Forecast } from './forecast.ts';
import {
  chiSquareGof,
  chiSquareIndependence,
  holm,
  meanDiff,
  newcombeDiff,
  normCdf,
  posteriorSummary,
  twoPropP,
  type ArmCounts,
} from './stats.ts';
import type { ArmMetric, Comparison, MetricKey, MetricResult, Unit } from './types.ts';

export interface AnalysisOptions {
  now: number;
  windowDays: number;
  currency: string;
  leads: Map<string, LeadFact>;
  /** Number of live experiments (SRM Bonferroni). */
  live: number;
  /** Skip the forecast (tests, subsets). */
  noForecast?: boolean;
}

export interface ExperimentAnalysis {
  def: JoinedExperiment['def'];
  arms: string[];
  runDays: number;
  assigned: Record<string, number>;
  /** Assignments per day per arm over the last 28 days. */
  dailyRate: Record<string, number>;
  primary: MetricResult;
  guardrails: MetricResult[];
  secondary: MetricResult[];
  srm: { p: number; observed: Record<string, number>; expected: Record<string, number> } | null;
  imbalanceP: number | null;
  crossover: { share: number; primaryDiffWithout: number | null } | null;
  /** State at the latest decision point on ALL data. */
  decision: RuleResult;
  decidedAt: number;
  forecast: Forecast | null;
  novelty: { early: number | null; late: number | null; p: number | null; fading: boolean } | null;
}

/** Count one metric per arm at time `now`. */
export function countMetric(units: Unit[], arms: string[], m: MetricDef, now: number, W: number, currency: string, leads: Map<string, LeadFact>): ArmMetric[] {
  const lag = m.lag(W) * DAY_MS;
  const out = new Map(arms.map((a) => [a, { arm: a, n: 0, x: 0, rate: null as number | null, maturing: 0, sumSq: 0, nonZero: 0 }]));
  for (const u of units) {
    const acc = out.get(u.arm);
    if (!acc || u.t > now) continue;
    const lead = u.leadId ? leads.get(u.leadId) ?? null : null;
    const v = m.value(u, lead, { W, currency });
    if (v === null) continue;
    if (u.t + lag > now) { acc.maturing++; continue; }
    acc.n++;
    acc.x += v;
    acc.sumSq += v * v;
    if (v) acc.nonZero++;
  }
  return arms.map((a) => {
    const r = out.get(a)!;
    r.rate = r.n ? r.x / r.n : null;
    return r;
  });
}

function compare(m: MetricDef, arms: ArmMetric[], control: string): { comparisons: Comparison[]; pBest: Record<string, number> | null; expectedLoss: Record<string, number> | null } {
  const c = arms.find((a) => a.arm === control)!;
  const others = arms.filter((a) => a.arm !== control);
  if (m.kind === 'mean') {
    const comps = others.map((a) => {
      const md = meanDiff({ n: a.n, sum: a.x, sumSq: a.sumSq ?? 0 }, { n: c.n, sum: c.x, sumSq: c.sumSq ?? 0 });
      const enough = (a.nonZero ?? 0) >= 10 && (c.nonZero ?? 0) >= 10;
      const c0 = c.n ? c.x / c.n : 0;
      const se = md ? (md.ci.hi - md.ci.lo) / 3.92 : 0;
      return {
        arm: a.arm,
        diff: md?.diff ?? null,
        ci: enough ? md?.ci ?? null : null,
        rel: md && c0 > 0 ? md.diff / c0 : null,
        relCi: enough && md && c0 > 0 ? { lo: md.ci.lo / c0, hi: md.ci.hi / c0 } : null,
        pBeats: enough && md && se > 0 ? normCdf(md.diff / se) : null,
        pHolm: null,
      } as Comparison;
    });
    return { comparisons: comps, pBest: null, expectedLoss: null };
  }
  const counts: ArmCounts[] = arms.map((a) => ({ arm: a.arm, n: a.n, x: a.x }));
  const post = posteriorSummary(counts, control);
  const raw = others.map((a) => twoPropP(a.x, a.n, c.x, c.n));
  const adj = holm(raw);
  const comps = others.map((a, i) => {
    const ci = newcombeDiff(a.x, a.n, c.x, c.n);
    const p0 = c.n ? c.x / c.n : 0;
    const diff = a.n && c.n ? a.x / a.n - p0 : null;
    return {
      arm: a.arm,
      diff,
      ci,
      rel: diff !== null && p0 > 0 ? diff / p0 : null,
      relCi: ci && p0 > 0 ? { lo: ci.lo / p0, hi: ci.hi / p0 } : null,
      pBeats: a.n && c.n ? post.pBeats[a.arm] ?? null : null,
      pHolm: a.n && c.n ? adj[i] : null,
    } as Comparison;
  });
  return { comparisons: comps, pBest: post.pBest, expectedLoss: post.expectedLoss };
}

export function metricResult(units: Unit[], arms: string[], control: string, key: MetricKey, role: MetricResult['role'], now: number, o: AnalysisOptions): MetricResult {
  const m = metricDef(key);
  const counts = countMetric(units, arms, m, now, o.windowDays, o.currency, o.leads);
  const { comparisons, pBest, expectedLoss } = compare(m, counts, control);
  return { key, label: m.label, role, kind: m.kind, arms: counts, comparisons, pBest, expectedLoss, note: m.note };
}

export function analyzeExperiment(j: JoinedExperiment, o: AnalysisOptions): ExperimentAnalysis {
  const def = j.def;
  const arms = armsOf(def);
  const start = Date.parse(def.startedAt);
  const runDays = Math.max(0, (o.now - start) / DAY_MS);
  const surfaceOk = (k: MetricKey) => metricDef(k).surfaces.includes(def.surface);

  const assigned: Record<string, number> = Object.fromEntries(arms.map((a) => [a, 0]));
  const recent: Record<string, number> = Object.fromEntries(arms.map((a) => [a, 0]));
  for (const u of j.units) {
    if (u.arm in assigned) assigned[u.arm]++;
    if (u.arm in recent && u.t > o.now - 28 * DAY_MS) recent[u.arm]++;
  }
  const window = Math.min(28, Math.max(1, runDays));
  const dailyRate = Object.fromEntries(arms.map((a) => [a, recent[a] / window]));

  const primary = metricResult(j.units, arms, def.control, def.primaryMetric, 'primary', o.now, o);
  const guardrails = def.guardrails.filter(surfaceOk).map((k) => metricResult(j.units, arms, def.control, k, 'guardrail', o.now, o));
  const used = new Set<string>([def.primaryMetric, ...def.guardrails]);
  const secondaryKeys: MetricKey[] =
    def.surface === 'email'
      ? (['dripOpen', 'dripClick', 'wonMature'] as MetricKey[])
      : ([...stepKeysIn(j.units), 'lead', 'callBooked', 'showRate', 'quoted', 'wonMature', 'paidMature', 'dropped', 'bookedPerVisitor'] as MetricKey[]);
  const secondary = secondaryKeys.filter((k) => !used.has(k) && surfaceOk(k)).map((k) => metricResult(j.units, arms, def.control, k, 'secondary', o.now, o));

  // SRM on ALL units (before exclusions) vs the declared split.
  const obs: Record<string, number> = Object.fromEntries(arms.map((a) => [a, 0]));
  for (const u of j.all) if (u.arm in obs) obs[u.arm]++;
  const act = def.variants.filter((v) => !v.retiredIn).map((v) => v.key);
  const exp: Record<string, number> = {};
  let tot = 0;
  for (const a of arms) { exp[a] = def.allocation?.[a] && def.allocation[a] > 0 ? def.allocation[a] : 0; tot += exp[a]; }
  for (const a of arms) exp[a] = tot > 0 && exp[a] > 0 ? exp[a] / tot : 1 / act.length;
  const nAll = Object.values(obs).reduce((a, b) => a + b, 0);
  const srm = nAll >= 20 ? { ...chiSquareGof(arms.map((a) => obs[a]), arms.map((a) => exp[a])), observed: obs, expected: exp } : null;

  // Excluded vs kept by arm.
  const keptSet = new Set(j.units);
  const table = arms.map((a) => {
    let kept = 0, ex = 0;
    for (const u of j.all) if (u.arm === a) (keptSet.has(u) ? kept++ : ex++);
    return [kept, ex];
  });
  const anyEx = table.some((r) => r[1] > 0);
  const imbalanceP = anyEx && nAll >= 20 ? chiSquareIndependence(table).p : null;

  // Crossover sensitivity on the primary metric.
  const crossN = j.units.filter((u) => u.crossover).length;
  let crossover: ExperimentAnalysis['crossover'] = null;
  if (crossN > 0) {
    const without = metricResult(j.units.filter((u) => !u.crossover), arms, def.control, def.primaryMetric, 'primary', o.now, o);
    crossover = { share: crossN / Math.max(1, j.units.length), primaryDiffWithout: without.comparisons[0]?.rel ?? null };
  }

  // Decision at the latest Monday, full population up to it.
  const decidedAt = Math.max(start, decisionPoint(o.now));
  const atDecision = j.units.filter((u) => u.t <= decidedAt);
  const dPrimary = metricResult(atDecision, arms, def.control, def.primaryMetric, 'primary', decidedAt, o);
  const dGuard = guardrails.map((g) => metricResult(atDecision, arms, def.control, g.key, 'guardrail', decidedAt, o));
  const lastAssign = j.all.reduce((m, u) => Math.max(m, u.t), 0);
  const decision = evaluate({
    control: def.control,
    arms: dPrimary.arms.map((a) => ({ arm: a.arm, n: a.n, x: a.x })),
    guardrails: dGuard.filter((g) => g.kind === 'binomial').map((g) => ({ key: g.key, label: g.label, arms: g.arms.map((a) => ({ arm: a.arm, n: a.n, x: a.x })) })),
    runDays: (decidedAt - start) / DAY_MS,
    srmP: srm?.p ?? null,
    imbalanceP,
    stalled: def.status === 'running' && runDays > 7 && (lastAssign === 0 || lastAssign < o.now - 7 * DAY_MS),
    live: o.live,
  });

  // Forecast from today's counts.
  let forecast: Forecast | null = null;
  if (!o.noForecast && def.status === 'running' && !['ready', 'keep_control', 'no_difference'].includes(decision.state)) {
    forecast = forecastDecision({
      control: def.control,
      arms: primary.arms.map((a) => ({ arm: a.arm, n: a.n, x: a.x })),
      dailyRate,
      maturing: Object.fromEntries(primary.arms.map((a) => [a.arm, a.maturing])),
      lagDays: metricDef(def.primaryMetric).lag(o.windowDays),
      runDays,
    });
  }

  // Novelty: first-7-days cohort vs later, only when a ship is on the table.
  let novelty: ExperimentAnalysis['novelty'] = null;
  if (decision.state === 'ready' && decision.leader) {
    const cut = start + 7 * DAY_MS;
    const eff = (us: Unit[]) => {
      const r = metricResult(us, arms, def.control, def.primaryMetric, 'primary', o.now, o);
      const a = r.arms.find((x) => x.arm === decision.leader)!, c = r.arms.find((x) => x.arm === def.control)!;
      if (!a.n || !c.n) return null;
      const pa = a.x / a.n, pc = c.x / c.n;
      return { d: pa - pc, se: Math.sqrt((pa * (1 - pa)) / a.n + (pc * (1 - pc)) / c.n) };
    };
    const e = eff(j.units.filter((u) => u.t < cut));
    const l = eff(j.units.filter((u) => u.t >= cut));
    if (e && l) {
      const se = Math.sqrt(e.se ** 2 + l.se ** 2);
      const z = se > 0 ? (e.d - l.d) / se : 0;
      const p = 2 * (1 - normCdf(Math.abs(z)));
      novelty = { early: e.d, late: l.d, p, fading: p < 0.05 && e.d > l.d };
    }
  }

  return { def, arms, runDays, assigned, dailyRate, primary, guardrails, secondary, srm, imbalanceP, crossover, decision, decidedAt, forecast, novelty };
}

export { RULES };
