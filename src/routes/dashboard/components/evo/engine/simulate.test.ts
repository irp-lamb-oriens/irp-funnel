/**
 * simulate.test.ts — the calibration contract (spec §4 goal 5).
 *
 * Runs the REAL decision rules (rules.ts) on simulated experiments: fixed
 * 50/50 allocation, 1,000 new people a month, the rule evaluated at every
 * weekly decision point for 120 days, outcomes arriving after the metric's
 * lag. Slow (~1 min): it is what licenses the thresholds in RULES.
 *
 *   A/A (no true difference): "Ready to ship" at ANY look in ≤ 5 % of runs.
 *   Power: +25 % relative on a 15 % click rate ships within 120 days in ≥ 70 %.
 *
 * Measured on 2026-11-02 with 2,000 runs: A/A 4.6 %, power 83 % at
 * T_ship = 0.99. At T_ship = 0.95 the A/A false-ship rate was 17 %.
 */
import { describe, expect, it } from 'vitest';
import { evaluate, RULES } from './rules.ts';
import { rng, type Rng } from './stats.ts';

function binom(n: number, p: number, r: Rng) { let x = 0; for (let i = 0; i < n; i++) if (r() < p) x++; return x; }
function poisson(l: number, r: Rng) { const L = Math.exp(-l); let k = 0, p = 1; do { k++; p *= r(); } while (p > L); return k - 1; }

/** Share of runs that ever reach "Ready to ship". */
export function shipRate(rates: number[], o: { runs: number; perMonth?: number; horizon?: number; lag?: number; seed?: number }): number {
  const perMonth = o.perMonth ?? 1000, horizon = o.horizon ?? 120, lag = o.lag ?? 7;
  const r = rng(o.seed ?? 1);
  const k = rates.length;
  const arms = rates.map((_, i) => String.fromCharCode(97 + i));
  let fires = 0;
  for (let s = 0; s < o.runs; s++) {
    const daily = Array.from({ length: horizon }, () => rates.map((p) => { const n = poisson(perMonth / 30 / k, r); return [n, binom(n, p, r)]; }));
    for (let look = 7; look <= horizon; look += 7) {
      const n = new Array(k).fill(0), x = new Array(k).fill(0);
      for (let d = 0; d < look - lag; d++) for (let i = 0; i < k; i++) { n[i] += daily[d][i][0]; x[i] += daily[d][i][1]; }
      const st = evaluate({ control: 'a', arms: arms.map((a, i) => ({ arm: a, n: n[i], x: x[i] })), guardrails: [], runDays: look, srmP: null, imbalanceP: null, stalled: false, live: 1 }).state;
      if (st === 'ready') { fires++; break; }
    }
  }
  return fires / o.runs;
}

describe('calibration contract (goal 5)', () => {
  it('A/A false ships ≤ 5 % with weekly looks (2 arms, 15 % base)', () => {
    expect(shipRate([0.15, 0.15], { runs: 2000, seed: 1 })).toBeLessThanOrEqual(0.05);
  }, 180_000);
  it('A/A false ships ≤ 5 % (3 arms) and on a slow 3 % lead metric', () => {
    expect(shipRate([0.15, 0.15, 0.15], { runs: 300, seed: 2 })).toBeLessThanOrEqual(0.05); // 3 arms use Monte Carlo posteriors: fewer runs keep CI fast
    expect(shipRate([0.03, 0.03], { runs: 1000, seed: 3, lag: 30 })).toBeLessThanOrEqual(0.05);
  }, 180_000);
  it('a +25 % lift on a 15 % click rate ships within 120 days in ≥ 70 % of runs', () => {
    expect(shipRate([0.15, 0.1875], { runs: 2000, seed: 4 })).toBeGreaterThanOrEqual(0.7);
  }, 180_000);
  it('uses the tuned threshold', () => {
    expect(RULES.T_ship).toBe(0.99);
  });
});
