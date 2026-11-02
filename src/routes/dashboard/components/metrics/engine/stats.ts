/**
 * stats.ts — the small amount of statistics the Metrics Hub needs, written so
 * a reviewer can check every formula. Pure, no dependencies.
 *
 *   wilson()        95 % Wilson score interval for x successes out of n
 *   fisherExact()   two-sided Fisher exact p for a 2×2 table (segment vs rest)
 *   benjaminiHochberg()  false-discovery control across many tests
 *   shrunkRate()    empirical-Bayes style shrink toward the baseline, used for
 *                   ranking so a 3-of-4 segment never outranks 30-of-60
 *   poissonFlag()   "is this month unusual?" for small counts
 */

export interface Interval { lo: number; hi: number }

export function wilson(x: number, n: number, z = 1.96): Interval {
  if (n <= 0) return { lo: 0, hi: 1 };
  const p = x / n;
  const z2 = z * z;
  const den = 1 + z2 / n;
  const centre = (p + z2 / (2 * n)) / den;
  const half = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / den;
  return { lo: Math.max(0, centre - half), hi: Math.min(1, centre + half) };
}

// log-factorial table, grown on demand
const LF: number[] = [0];
function logFact(n: number): number {
  for (let i = LF.length; i <= n; i++) LF[i] = LF[i - 1] + Math.log(i);
  return LF[n];
}

/**
 * Two-sided Fisher exact test for
 *            success  failure
 *   segment     a        b
 *   rest        c        d
 * p = Σ P(table) over tables with the same margins and P ≤ P(observed).
 */
export function fisherExact(a: number, b: number, c: number, d: number): number {
  const r1 = a + b, r2 = c + d, c1 = a + c, n = r1 + r2;
  if (n === 0 || r1 === 0 || r2 === 0 || c1 === 0 || c1 === n) return 1;
  const base = logFact(r1) + logFact(r2) + logFact(c1) + logFact(n - c1) - logFact(n);
  const logP = (x: number) => base - logFact(x) - logFact(r1 - x) - logFact(c1 - x) - logFact(r2 - c1 + x);
  const pObs = logP(a);
  const lo = Math.max(0, c1 - r2), hi = Math.min(r1, c1);
  let p = 0;
  for (let x = lo; x <= hi; x++) {
    const lp = logP(x);
    if (lp <= pObs + 1e-9) p += Math.exp(lp);
  }
  return Math.min(1, p);
}

/**
 * Benjamini–Hochberg: returns, for each p-value, whether it is a discovery
 * at false-discovery rate q.
 */
export function benjaminiHochberg(pvals: number[], q = 0.1): boolean[] {
  const m = pvals.length;
  const order = pvals.map((p, i) => [p, i] as [number, number]).sort((x, y) => x[0] - y[0]);
  let kMax = -1;
  for (let k = 0; k < m; k++) if (order[k][0] <= ((k + 1) / m) * q) kMax = k;
  const out = new Array<boolean>(m).fill(false);
  for (let k = 0; k <= kMax; k++) out[order[k][1]] = true;
  return out;
}

/** (x + k·p0) / (n + k): pulls small segments toward the baseline p0. */
export function shrunkRate(x: number, n: number, p0: number, k = 20): number {
  return (x + k * p0) / (n + k);
}

/**
 * Flag a count as unusual vs the mean of the months before it.
 * Only when the base is big enough (μ ≥ 10) and |x − μ| > 2√μ (≈ 2 sd under
 * Poisson), so ordinary month-to-month noise in small numbers stays quiet.
 */
export function poissonFlag(x: number, mu: number): 'up' | 'down' | null {
  if (!(mu >= 10)) return null;
  const sd = Math.sqrt(mu);
  if (x - mu > 2 * sd) return 'up';
  if (mu - x > 2 * sd) return 'down';
  return null;
}

export function median(values: number[]): number | null {
  const v = values.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return null;
  const mid = v.length >> 1;
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
}

export function quantile(values: number[], q: number): number | null {
  const v = values.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return null;
  const pos = (v.length - 1) * q;
  const lo = Math.floor(pos), hi = Math.ceil(pos);
  return v[lo] + (v[hi] - v[lo]) * (pos - lo);
}
