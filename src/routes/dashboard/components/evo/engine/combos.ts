/**
 * combos.ts — combinations of experiments (spec §6.7).
 *
 * Independent randomisation makes every pair of overlapping web/chat
 * experiments a factorial design, so we can ask "does A's effect depend on
 * B?" (interaction) and "which full configuration does best?" (exploratory).
 * Both are LOCKED until there is enough data and say what they need.
 * Email experiments are never paired with web ones: drip assignment happens
 * after someone becomes a lead, so it is not factorial with the site.
 */

import type { LeadFact } from '../../metrics/engine/types.ts';
import { armLabel, armsOf, DAY_MS, type JoinedExperiment } from './join.ts';
import { metricDef } from './metrics.ts';
import { benjaminiHochberg, ebShrinkK, expit, logit, waldInteraction } from './stats.ts';
import type { MetricKey, Unit } from './types.ts';

export const COMBO_RULES = { minCellConversions: 20, configMinConversions: 5, configMinCells: 4, q: 0.1 };

export interface Cell { a: string; b: string; n: number; x: number; rate: number | null }

export interface PairResult {
  a: string;
  b: string;
  metric: MetricKey;
  cells: Cell[];
  locked: boolean;
  /** Smallest cell's conversions (lock progress). */
  minCell: number;
  p: number | null;
  df: number | null;
  significant: boolean;
  /** Shrunk interaction contrasts, rate units (2×2 → one number). */
  shrunk: number[] | null;
  sentence: string | null;
}

export interface PairScan {
  pairs: PairResult[];
  tested: number;
  survivors: number;
}

interface Ctx { now: number; windowDays: number; currency: string; leads: Map<string, LeadFact> }

function matureValue(u: Unit, key: MetricKey, c: Ctx): number | null {
  const m = metricDef(key);
  if (u.t + m.lag(c.windowDays) * DAY_MS > c.now) return null;
  const lead = u.leadId ? c.leads.get(u.leadId) ?? null : null;
  return m.value(u, lead, { W: c.windowDays, currency: c.currency });
}

function overlap(a: JoinedExperiment, b: JoinedExperiment): boolean {
  if (a.def.surface === 'email' || b.def.surface === 'email') return false;
  if (!a.units.length || !b.units.length) return false;
  const aMin = Math.min(...a.units.map((u) => u.t)), aMax = Math.max(...a.units.map((u) => u.t));
  const bMin = Math.min(...b.units.map((u) => u.t)), bMax = Math.max(...b.units.map((u) => u.t));
  return aMin <= bMax && bMin <= aMax;
}

export function scanPairs(joined: JoinedExperiment[], c: Ctx): PairScan {
  const pairs: PairResult[] = [];
  const web = joined.filter((j) => j.def.surface !== 'email');
  for (let i = 0; i < web.length; i++) for (let k = i + 1; k < web.length; k++) {
    const A = web[i], B = web[k];
    if (!overlap(A, B)) continue;
    const bByVid = new Map(B.units.map((u) => [u.vid, u]));
    const metrics = [...new Set<MetricKey>(['lead', A.def.primaryMetric, B.def.primaryMetric].filter((m) => m === 'lead' || (m.startsWith('step:') && A.def.primaryMetric === B.def.primaryMetric)) as MetricKey[])];
    const armsA = armsOf(A.def), armsB = armsOf(B.def);
    for (const metric of metrics) {
      const grid = armsA.map((a) => armsB.map((b) => ({ a, b, n: 0, x: 0, rate: null as number | null })));
      for (const ua of A.units) {
        const ub = bByVid.get(ua.vid);
        if (!ub) continue;
        const ia = armsA.indexOf(ua.arm), ib = armsB.indexOf(ub.arm);
        if (ia < 0 || ib < 0) continue;
        const v = matureValue(ua, metric, c);
        if (v === null) continue;
        grid[ia][ib].n++;
        grid[ia][ib].x += v;
      }
      const cells = grid.flat().map((g) => ({ ...g, rate: g.n ? g.x / g.n : null }));
      const minCell = Math.min(...cells.map((g) => g.x));
      const locked = minCell < COMBO_RULES.minCellConversions;
      let p: number | null = null, df: number | null = null, shrunk: number[] | null = null;
      if (!locked) {
        const w = waldInteraction(grid.map((r) => r.map((g) => ({ n: g.n, x: g.x }))));
        if (w) {
          p = w.p;
          df = w.df;
          const f = w.stat > 0 ? Math.max(0, 1 - w.df / w.stat) : 0; // positive-part James–Stein
          shrunk = w.contrasts.map((x) => x * f);
        }
      }
      pairs.push({ a: A.def.componentKey, b: B.def.componentKey, metric, cells, locked, minCell, p, df, significant: false, shrunk, sentence: null });
    }
  }
  const tested = pairs.filter((r) => r.p !== null);
  const flags = benjaminiHochberg(tested.map((r) => r.p as number), COMBO_RULES.q);
  tested.forEach((r, i) => { r.significant = flags[i]; });
  const defs = new Map(joined.map((j) => [j.def.componentKey, j.def]));
  for (const r of tested) {
    if (!r.significant || !r.shrunk) continue;
    const A = defs.get(r.a)!, B = defs.get(r.b)!;
    const armA = armsOf(A)[1], armB = armsOf(B)[1];
    const effect = (b: string) => {
      const t = r.cells.find((x) => x.a === armA && x.b === b), c0 = r.cells.find((x) => x.a === A.control && x.b === b);
      return t?.rate !== null && c0?.rate !== null && t && c0 ? (t.rate as number) - (c0.rate as number) : null;
    };
    const withB = effect(armB), withoutB = effect(B.control);
    const per100 = (v: number) => `${v >= 0 ? '+' : ''}${(v * 100).toFixed(1)}`;
    r.sentence =
      `${armLabel(A, armA)} works differently depending on ${B.title.toLowerCase()}: ` +
      `${withB !== null ? per100(withB) : '?'} per 100 visitors with ${armLabel(B, armB)}, ` +
      `${withoutB !== null ? per100(withoutB) : '?'} with ${armLabel(B, B.control)} ` +
      `(interaction ≈ ${per100(r.shrunk[0])} after shrinkage; ${tested.length} pair tests run).`;
  }
  return { pairs, tested: tested.length, survivors: tested.filter((r) => r.significant).length };
}

export interface ConfigRow {
  config: Record<string, string>;
  n: number;
  x: number;
  rate: number;
  pred: number;
  shrunk: number;
}

export interface ConfigTable {
  components: string[];
  metric: MetricKey;
  rows: ConfigRow[];
  hidden: number;
  tested: number;
  k: number | null;
  locked: boolean;
  /** Cells that already have enough conversions (lock progress). */
  readyCells: number;
}

/**
 * Configurations over 2–4 components: observed rate, logit-additive
 * prediction from each component's marginal effect, and an empirical-Bayes
 * shrunk rate. Exploratory only.
 */
export function configurations(joined: JoinedExperiment[], components: string[], metric: MetricKey, c: Ctx): ConfigTable {
  const js = components.map((k) => joined.find((j) => j.def.componentKey === k)).filter(Boolean) as JoinedExperiment[];
  const maps = js.map((j) => new Map(j.units.map((u) => [u.vid, u])));
  const base = js[0];
  const cells = new Map<string, { config: Record<string, string>; n: number; x: number }>();
  const marg = js.map(() => new Map<string, { n: number; x: number }>());
  let N = 0, X = 0;
  for (const u0 of base?.units ?? []) {
    if (u0.vid < 0) continue;
    const us = maps.map((m) => m.get(u0.vid));
    if (us.some((u) => !u)) continue;
    const v = matureValue(u0, metric, c);
    if (v === null) continue;
    const config: Record<string, string> = {};
    us.forEach((u, i) => { config[js[i].def.componentKey] = u!.arm; });
    const key = JSON.stringify(config);
    const cell = cells.get(key) ?? { config, n: 0, x: 0 };
    cell.n++; cell.x += v;
    cells.set(key, cell);
    us.forEach((u, i) => {
      const m = marg[i].get(u!.arm) ?? { n: 0, x: 0 };
      m.n++; m.x += v;
      marg[i].set(u!.arm, m);
    });
    N++; X += v;
  }
  const sm = (x: number, n: number) => (x + 0.5) / (n + 1);
  const grand = logit(sm(X, N));
  const all = [...cells.values()].map((cell) => {
    let lp = grand;
    js.forEach((j, i) => {
      const m = marg[i].get(cell.config[j.def.componentKey])!;
      lp += logit(sm(m.x, m.n)) - grand;
    });
    return { ...cell, rate: cell.x / cell.n, pred: expit(lp) };
  });
  const ready = all.filter((r) => r.x >= COMBO_RULES.configMinConversions);
  const locked = ready.length < COMBO_RULES.configMinCells;
  const k = locked ? null : ebShrinkK(ready);
  const rows = locked
    ? []
    : ready
        .map((r) => ({ config: r.config, n: r.n, x: r.x, rate: r.rate, pred: r.pred, shrunk: (r.x + (k as number) * r.pred) / (r.n + (k as number)) }))
        .sort((a, b) => b.shrunk - a.shrunk);
  return { components, metric, rows, hidden: all.length - ready.length, tested: all.length, k, locked, readyCells: ready.length };
}
