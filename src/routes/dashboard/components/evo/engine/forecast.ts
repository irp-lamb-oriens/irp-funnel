/**
 * forecast.ts — time to decision (spec §6.5.6).
 *
 * Simulates the experiment forward from the current posterior and traffic:
 * each path draws "true" arm rates from the posterior, adds the projected
 * weekly assignments per arm (Poisson), lets outcomes mature after the
 * metric's lag, and evaluates the SAME rules at each future Monday. Reports
 * the median and 80 % range of weeks until a decision state.
 */

import { evaluate, DECISION_STATES, RULES, type RuleInput, type RuleSet } from './rules.ts';
import { betaSample, rng, type ArmCounts, type Rng } from './stats.ts';

export interface ForecastInput {
  control: string;
  arms: ArmCounts[];
  /** Assignments per day per arm (last 28 days). */
  dailyRate: Record<string, number>;
  /** Units assigned but not yet mature, per arm. */
  maturing: Record<string, number>;
  lagDays: number;
  runDays: number;
}

export interface Forecast {
  medianWeeks: number | null;
  loWeeks: number | null;
  hiWeeks: number | null;
  /** Share of paths that decide within the horizon. */
  decidedShare: number;
  horizonWeeks: number;
}

function poisson(lambda: number, r: Rng): number {
  if (lambda <= 0) return 0;
  if (lambda > 50) return Math.max(0, Math.round(lambda + Math.sqrt(lambda) * Math.sqrt(-2 * Math.log(r() || 1e-12)) * Math.cos(2 * Math.PI * r())));
  const L = Math.exp(-lambda);
  let k = 0, p = 1;
  do { k++; p *= r(); } while (p > L);
  return k - 1;
}

function binom(n: number, p: number, r: Rng): number {
  if (n <= 0) return 0;
  if (n > 60) {
    const m = n * p, sd = Math.sqrt(n * p * (1 - p));
    return Math.min(n, Math.max(0, Math.round(m + sd * Math.sqrt(-2 * Math.log(r() || 1e-12)) * Math.cos(2 * Math.PI * r()))));
  }
  let x = 0;
  for (let i = 0; i < n; i++) if (r() < p) x++;
  return x;
}

export function forecastDecision(f: ForecastInput, opts: { paths?: number; horizonWeeks?: number; seed?: number; rules?: RuleSet } = {}): Forecast {
  const paths = opts.paths ?? 400;
  const H = opts.horizonWeeks ?? 52;
  const R = opts.rules ?? RULES;
  const total = Object.values(f.dailyRate).reduce((a, b) => a + b, 0);
  if (!(total > 0)) return { medianWeeks: null, loWeeks: null, hiWeeks: null, decidedShare: 0, horizonWeeks: H };
  const r = rng(opts.seed ?? 11);
  const lagWeeks = Math.ceil(f.lagDays / 7);
  const results: number[] = [];
  for (let p = 0; p < paths; p++) {
    const truth: Record<string, number> = {};
    for (const a of f.arms) truth[a.arm] = betaSample(1 + a.x, 1 + a.n - a.x, r);
    const n: Record<string, number> = {}, x: Record<string, number> = {};
    for (const a of f.arms) { n[a.arm] = a.n; x[a.arm] = a.x; }
    // Pipeline of cohorts maturing in future weeks.
    const pipe: Array<Record<string, number>> = [];
    for (const a of f.arms) {
      const m = f.maturing[a.arm] ?? 0;
      for (let w = 0; w < lagWeeks; w++) {
        pipe[w] ??= {};
        pipe[w][a.arm] = (pipe[w][a.arm] ?? 0) + Math.round(m / Math.max(1, lagWeeks));
      }
    }
    let decidedAt: number | null = null;
    for (let w = 1; w <= H; w++) {
      // New assignments this week mature lagWeeks later.
      const cohort: Record<string, number> = {};
      for (const a of f.arms) cohort[a.arm] = poisson((f.dailyRate[a.arm] ?? 0) * 7, r);
      pipe[w - 1 + lagWeeks] = Object.fromEntries(f.arms.map((a) => [a.arm, (pipe[w - 1 + lagWeeks]?.[a.arm] ?? 0) + cohort[a.arm]]));
      const ripe = pipe[w - 1] ?? {};
      for (const a of f.arms) {
        const k = ripe[a.arm] ?? 0;
        n[a.arm] += k;
        x[a.arm] += binom(k, truth[a.arm], r);
      }
      const input: RuleInput = {
        control: f.control,
        arms: f.arms.map((a) => ({ arm: a.arm, n: n[a.arm], x: x[a.arm] })),
        guardrails: [],
        runDays: f.runDays + w * 7,
        srmP: null,
        imbalanceP: null,
        stalled: false,
        live: 1,
      };
      const s = evaluate(input, R).state;
      if (DECISION_STATES.has(s)) { decidedAt = w; break; }
    }
    results.push(decidedAt ?? Infinity);
  }
  results.sort((a, b) => a - b);
  const q = (pp: number) => {
    const v = results[Math.min(results.length - 1, Math.floor(pp * results.length))];
    return isFinite(v) ? v : null;
  };
  return {
    medianWeeks: q(0.5),
    loWeeks: q(0.1),
    hiWeeks: q(0.9),
    decidedShare: results.filter(isFinite).length / results.length,
    horizonWeeks: H,
  };
}
