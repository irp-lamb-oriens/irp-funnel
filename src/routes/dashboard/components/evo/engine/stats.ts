/**
 * stats.ts — Evo Lab statistics (spec §6.5–§6.8). Pure, no dependencies,
 * every formula in one file so it can be reviewed.
 *
 * Re-exports from the Metrics Hub: wilson, benjaminiHochberg, shrunkRate.
 *
 *   rng(seed)              mulberry32 — seeded so numbers don't jitter
 *   betaSample             Beta draw via Marsaglia–Tsang gamma
 *   posteriorSummary       P(beats control), P(best), expected loss per arm;
 *                          normal approximation of Beta posteriors when every
 *                          arm has ≥ 10 successes and failures, seeded Monte
 *                          Carlo otherwise
 *   newcombeDiff           95 % hybrid Wilson interval for p1 − p0
 *   twoPropP               two-sided z-test p (fixed-horizon, display only)
 *   holm                   Holm step-down adjustment
 *   chiSquareGof / chiSquareP / chiSquareIndependence   SRM and imbalance
 *   waldInteraction        interaction contrasts of a |A|×|B| table of rates
 *   meanDiff               Welch-type normal interval for means
 *   ebShrinkK              method-of-moments prior strength for shrinkage
 *   normCdf / normQuantile, logit / expit
 */

export { wilson, benjaminiHochberg, shrunkRate } from '../../metrics/engine/stats.ts';
import { wilson } from '../../metrics/engine/stats.ts';
import type { Interval } from './types.ts';

// ── random numbers ───────────────────────────────────────────────────────────
export type Rng = () => number;

export function rng(seed = 1): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function normalSample(r: Rng): number {
  let u = 0;
  while (u === 0) u = r();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r());
}

/** Gamma(shape, 1) — Marsaglia & Tsang (2000). */
export function gammaSample(shape: number, r: Rng): number {
  if (shape < 1) return gammaSample(shape + 1, r) * Math.pow(r() || 1e-12, 1 / shape);
  const d = shape - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  for (;;) {
    let x: number, v: number;
    do {
      x = normalSample(r);
      v = 1 + c * x;
    } while (v <= 0);
    v = v * v * v;
    const u = r();
    if (u < 1 - 0.0331 * x * x * x * x) return d * v;
    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
  }
}

export function betaSample(a: number, b: number, r: Rng): number {
  const x = gammaSample(a, r);
  const y = gammaSample(b, r);
  return x / (x + y);
}

// ── normal distribution ──────────────────────────────────────────────────────
/** Standard normal CDF (Abramowitz–Stegun 7.1.26 via erf), |error| < 1.5e-7. */
export function normCdf(z: number): number {
  const t = 1 / (1 + 0.3275911 * (Math.abs(z) / Math.SQRT2));
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t) * Math.exp(-(z * z) / 2);
  return z >= 0 ? 0.5 * (1 + y) : 0.5 * (1 - y);
}

export function normPdf(z: number): number {
  return Math.exp(-0.5 * z * z) / Math.sqrt(2 * Math.PI);
}

/** Inverse standard normal CDF (Acklam), |rel error| < 1.2e-9. */
export function normQuantile(p: number): number {
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;
  const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2, -3.066479806614716e1, 2.506628277459239];
  const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1];
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416];
  const pl = 0.02425;
  if (p < pl) {
    const q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  if (p > 1 - pl) return -normQuantile(1 - p);
  const q = p - 0.5;
  const r = q * q;
  return ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
}

export const logit = (p: number) => Math.log(p / (1 - p));
export const expit = (x: number) => 1 / (1 + Math.exp(-x));

// ── posterior summaries ──────────────────────────────────────────────────────
export interface ArmCounts { arm: string; n: number; x: number }

export interface PosteriorSummary {
  /** P(arm rate > control rate), control → null. */
  pBeats: Record<string, number | null>;
  pBest: Record<string, number>;
  /** E[max_j θ_j − θ_arm]: what shipping the arm would cost if it is not the best. */
  expectedLoss: Record<string, number>;
  method: 'normal' | 'montecarlo';
}

const DRAWS = 20000;

/**
 * Beta(1 + x, 1 + n − x) posterior per arm. With two arms and enough data the
 * normal approximation is exact enough and costs nothing (it is what the
 * goal-5 simulation evaluates thousands of times); otherwise seeded Monte Carlo.
 */
export function posteriorSummary(arms: ArmCounts[], control: string, seed = 7): PosteriorSummary {
  const k = arms.length;
  const out: PosteriorSummary = { pBeats: {}, pBest: {}, expectedLoss: {}, method: 'normal' };
  if (!k) return out;
  const big = arms.every((a) => a.x >= 10 && a.n - a.x >= 10);
  if (k === 2 && big) {
    const mv = arms.map((a) => {
      const al = 1 + a.x, be = 1 + a.n - a.x;
      const m = al / (al + be);
      return { m, v: (al * be) / ((al + be) ** 2 * (al + be + 1)) };
    });
    const [A, B] = arms;
    const sd = Math.sqrt(mv[0].v + mv[1].v);
    const d = mv[1].m - mv[0].m; // B − A
    const z = sd > 0 ? d / sd : 0;
    const pB = normCdf(z);
    out.pBest[A.arm] = 1 - pB;
    out.pBest[B.arm] = pB;
    // E[max(0, A − B)] for B, and E[max(0, B − A)] for A (normal of the difference).
    const lossB = sd * normPdf(z) - d * (1 - normCdf(z));
    const lossA = sd * normPdf(z) + d * normCdf(z);
    out.expectedLoss[A.arm] = Math.max(0, lossA);
    out.expectedLoss[B.arm] = Math.max(0, lossB);
    for (const a of arms) out.pBeats[a.arm] = a.arm === control ? null : out.pBest[a.arm];
    return out;
  }
  out.method = 'montecarlo';
  const r = rng(seed);
  const wins = new Array(k).fill(0);
  const beats = new Array(k).fill(0);
  const loss = new Array(k).fill(0);
  const ci = Math.max(0, arms.findIndex((a) => a.arm === control));
  const draw = new Array(k).fill(0);
  for (let s = 0; s < DRAWS; s++) {
    let best = -1, bi = 0;
    for (let i = 0; i < k; i++) {
      draw[i] = betaSample(1 + arms[i].x, 1 + arms[i].n - arms[i].x, r);
      if (draw[i] > best) { best = draw[i]; bi = i; }
    }
    wins[bi]++;
    for (let i = 0; i < k; i++) {
      loss[i] += best - draw[i];
      if (draw[i] > draw[ci]) beats[i]++;
    }
  }
  arms.forEach((a, i) => {
    out.pBest[a.arm] = wins[i] / DRAWS;
    out.expectedLoss[a.arm] = loss[i] / DRAWS;
    out.pBeats[a.arm] = i === ci ? null : beats[i] / DRAWS;
  });
  return out;
}

/**
 * P(arm − control < −margin·control) — the guardrail "worse by more than its
 * margin" probability, normal approximation of the Beta posteriors.
 */
export function probWorseBy(arm: ArmCounts, control: ArmCounts, relMargin: number): number {
  const post = (a: ArmCounts) => {
    const al = 1 + a.x, be = 1 + a.n - a.x;
    return { m: al / (al + be), v: (al * be) / ((al + be) ** 2 * (al + be + 1)) };
  };
  const A = post(arm), C = post(control);
  const sd = Math.sqrt(A.v + C.v);
  if (!(sd > 0)) return 0;
  // θa − θc < −margin·θc  ⇔  θa − (1 − margin)θc < 0
  const mean = A.m - (1 - relMargin) * C.m;
  const sdAdj = Math.sqrt(A.v + (1 - relMargin) ** 2 * C.v);
  return normCdf(-mean / sdAdj);
}

// ── frequentist display helpers ──────────────────────────────────────────────
/** Newcombe (1998) hybrid Wilson 95 % interval for p1 − p0. */
export function newcombeDiff(x1: number, n1: number, x0: number, n0: number): Interval | null {
  if (n1 <= 0 || n0 <= 0) return null;
  const p1 = x1 / n1, p0 = x0 / n0;
  const w1 = wilson(x1, n1), w0 = wilson(x0, n0);
  const d = p1 - p0;
  return {
    lo: d - Math.sqrt((p1 - w1.lo) ** 2 + (w0.hi - p0) ** 2),
    hi: d + Math.sqrt((w1.hi - p1) ** 2 + (p0 - w0.lo) ** 2),
  };
}

/** Two-sided pooled two-proportion z-test p-value. */
export function twoPropP(x1: number, n1: number, x0: number, n0: number): number {
  if (n1 <= 0 || n0 <= 0) return 1;
  const p = (x1 + x0) / (n1 + n0);
  const se = Math.sqrt(p * (1 - p) * (1 / n1 + 1 / n0));
  if (!(se > 0)) return 1;
  const z = (x1 / n1 - x0 / n0) / se;
  return 2 * (1 - normCdf(Math.abs(z)));
}

/** Holm step-down adjusted p-values, original order. */
export function holm(ps: number[]): number[] {
  const m = ps.length;
  const order = ps.map((p, i) => [p, i] as const).sort((a, b) => a[0] - b[0]);
  const out = new Array(m).fill(1);
  let running = 0;
  order.forEach(([p, i], rank) => {
    running = Math.max(running, Math.min(1, (m - rank) * p));
    out[i] = running;
  });
  return out;
}

/** Normal-approximation 95 % interval for a difference of means. */
export function meanDiff(
  a: { n: number; sum: number; sumSq: number },
  b: { n: number; sum: number; sumSq: number },
): { diff: number; ci: Interval } | null {
  if (a.n < 2 || b.n < 2) return null;
  const ma = a.sum / a.n, mb = b.sum / b.n;
  const va = Math.max(0, (a.sumSq - a.n * ma * ma) / (a.n - 1));
  const vb = Math.max(0, (b.sumSq - b.n * mb * mb) / (b.n - 1));
  const se = Math.sqrt(va / a.n + vb / b.n);
  const diff = ma - mb;
  return { diff, ci: { lo: diff - 1.96 * se, hi: diff + 1.96 * se } };
}

// ── chi-square ───────────────────────────────────────────────────────────────
function logGamma(z: number): number {
  const g = 7;
  const c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - logGamma(1 - z);
  z -= 1;
  let x = c[0];
  for (let i = 1; i < g + 2; i++) x += c[i] / (z + i);
  const t = z + g + 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
}

/** Regularised upper incomplete gamma Q(s, x). */
function gammaQ(s: number, x: number): number {
  if (x <= 0) return 1;
  if (x < s + 1) {
    let sum = 1 / s, term = sum;
    for (let n = 1; n < 500; n++) {
      term *= x / (s + n);
      sum += term;
      if (term < sum * 1e-14) break;
    }
    return 1 - sum * Math.exp(-x + s * Math.log(x) - logGamma(s));
  }
  // Continued fraction (Lentz).
  let b = x + 1 - s, c = 1e300, d = 1 / b, h = d;
  for (let i = 1; i < 500; i++) {
    const an = -i * (i - s);
    b += 2;
    d = an * d + b;
    if (Math.abs(d) < 1e-300) d = 1e-300;
    c = b + an / c;
    if (Math.abs(c) < 1e-300) c = 1e-300;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < 1e-14) break;
  }
  return Math.exp(-x + s * Math.log(x) - logGamma(s)) * h;
}

/** P(χ²_df ≥ stat). */
export function chiSquareP(stat: number, df: number): number {
  if (!(df > 0) || !isFinite(stat)) return 1;
  return Math.min(1, Math.max(0, gammaQ(df / 2, stat / 2)));
}

/** Goodness of fit of observed counts against expected shares (SRM). */
export function chiSquareGof(observed: number[], expectedShares: number[]): { stat: number; df: number; p: number } {
  const n = observed.reduce((a, b) => a + b, 0);
  const tot = expectedShares.reduce((a, b) => a + b, 0) || 1;
  let stat = 0;
  observed.forEach((o, i) => {
    const e = (n * expectedShares[i]) / tot;
    if (e > 0) stat += ((o - e) ** 2) / e;
  });
  const df = observed.length - 1;
  return { stat, df, p: n > 0 ? chiSquareP(stat, df) : 1 };
}

/** Pearson chi-square test of independence for an r × c table of counts. */
export function chiSquareIndependence(table: number[][]): { stat: number; df: number; p: number } {
  const rows = table.map((r) => r.reduce((a, b) => a + b, 0));
  const cols = table[0]?.map((_, j) => table.reduce((a, r) => a + r[j], 0)) ?? [];
  const n = rows.reduce((a, b) => a + b, 0);
  let stat = 0;
  for (let i = 0; i < table.length; i++) for (let j = 0; j < cols.length; j++) {
    const e = (rows[i] * cols[j]) / (n || 1);
    if (e > 0) stat += ((table[i][j] - e) ** 2) / e;
  }
  const df = (table.length - 1) * (cols.length - 1);
  return { stat, df, p: n > 0 && df > 0 ? chiSquareP(stat, df) : 1 };
}

// ── interaction (factorial) ──────────────────────────────────────────────────
/** Solve A·x = b by Gaussian elimination with partial pivoting (small systems). */
function solve(A: number[][], b: number[]): number[] | null {
  const n = b.length;
  const M = A.map((r, i) => [...r, b[i]]);
  for (let c = 0; c < n; c++) {
    let piv = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[piv][c])) piv = r;
    if (Math.abs(M[piv][c]) < 1e-15) return null;
    [M[c], M[piv]] = [M[piv], M[c]];
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = M[r][c] / M[c][c];
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  return M.map((r, i) => r[n] / r[i]);
}

/**
 * Wald test that A's effect is the same at every level of B. Cells are
 * independent binomials; contrasts c_ij = p_ij − p_i0 − p_0j + p_00 for
 * i, j ≥ 1 (index 0 = each factor's control); W = cᵀ Σ⁻¹ c ~ χ²((|A|−1)(|B|−1)).
 * Cell variances use p̃ = (x + 0.5)/(n + 1) so empty cells don't divide by 0.
 */
export function waldInteraction(cells: Array<Array<{ n: number; x: number }>>): { stat: number; df: number; p: number; contrasts: number[] } | null {
  const ka = cells.length, kb = cells[0]?.length ?? 0;
  if (ka < 2 || kb < 2) return null;
  if (cells.some((r) => r.some((c) => c.n < 1))) return null;
  const p = cells.map((r) => r.map((c) => c.x / c.n));
  const v = cells.map((r) => r.map((c) => {
    const pt = (c.x + 0.5) / (c.n + 1);
    return (pt * (1 - pt)) / c.n;
  }));
  const idx: Array<[number, number]> = [];
  for (let i = 1; i < ka; i++) for (let j = 1; j < kb; j++) idx.push([i, j]);
  const contrasts = idx.map(([i, j]) => p[i][j] - p[i][0] - p[0][j] + p[0][0]);
  // L has a row per contrast with ±1 on four cells; Σ = L diag(v) Lᵀ.
  const cellsOf = ([i, j]: [number, number]) => [[i, j, 1], [i, 0, -1], [0, j, -1], [0, 0, 1]] as Array<[number, number, number]>;
  const S = idx.map((a) => idx.map((b) => {
    let s = 0;
    for (const [ai, aj, as] of cellsOf(a)) for (const [bi, bj, bs] of cellsOf(b)) if (ai === bi && aj === bj) s += as * bs * v[ai][aj];
    return s;
  }));
  const y = solve(S, contrasts);
  if (!y) return null;
  const stat = contrasts.reduce((acc, c, i) => acc + c * y[i], 0);
  const df = idx.length;
  return { stat, df, p: chiSquareP(stat, df), contrasts };
}

/**
 * Method-of-moments prior strength k for shrinking cell rates toward their
 * predictions: between-cell variance τ² = mean((p̂ − pred)²) − mean(p̃(1−p̃)/n),
 * k = mean(pred(1 − pred)) / τ². Large k ⇒ strong shrinkage. Clamped [1, 10⁴].
 */
export function ebShrinkK(cells: Array<{ n: number; x: number; pred: number }>): number {
  if (cells.length < 2) return 30;
  let resid = 0, samp = 0, pv = 0;
  for (const c of cells) {
    const ph = c.x / c.n;
    resid += (ph - c.pred) ** 2;
    samp += (c.pred * (1 - c.pred)) / c.n;
    pv += c.pred * (1 - c.pred);
  }
  const m = cells.length;
  const tau2 = resid / m - samp / m;
  if (!(tau2 > 0)) return 1e4;
  return Math.min(1e4, Math.max(1, pv / m / tau2));
}

/** Two-arm fixed-horizon smallest detectable relative lift (80 % power, α = 0.05). */
export function mdeRelative(p0: number, nPerArm: number): number | null {
  if (!(p0 > 0 && p0 < 1) || nPerArm <= 0) return null;
  const z = 1.959964 + 0.841621;
  return (z * Math.sqrt((2 * p0 * (1 - p0)) / nPerArm)) / p0;
}
