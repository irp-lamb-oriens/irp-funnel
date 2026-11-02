/**
 * combos.ts — the combination finder: "which segments, alone or in pairs,
 * convert better or worse than everyone else?" (spec §6.4)
 *
 *   pool      mature leads (60–540 days old), test leads out, active filters on
 *   singles   every value with n ≥ 15
 *   pairs     every allowed dimension pair (never a dimension with its parent),
 *             every value pair with n ≥ 25
 *   shown     only if also |x − n·p0| ≥ 3 (at least 3 leads off expectation)
 *   test      segment vs its complement, two-sided Fisher exact
 *   control   Benjamini–Hochberg at q = 0.10 across EVERYTHING tested
 *   pairs     must also add information: inside A=a, B=b differs from the rest
 *             of A=a (and vice-versa) — Fisher, with its own BH across pairs
 *   rank      shrunk rate (x + 20·p0) / (n + 20)
 *
 * Outcome-phase dimensions (status, stage, providers…) are never candidates,
 * so a result can't be "deals that were won win more".
 */
import type { Filter, LeadFact } from './types.ts';
import { DIMENSIONS, MEASURE, dimLabel, dimValues, type Dimension } from './registry.ts';
import { benjaminiHochberg, fisherExact, shrunkRate, wilson, type Interval } from './stats.ts';

export interface Segment {
  filters: Filter[];
  label: string;
  x: number;
  n: number;
  rate: number;
  shrunk: number;
  lift: number;
  p: number;
  ci: Interval;
  pair: boolean;
}

export interface ComboResult {
  measure: string;
  baseline: number;
  pool: number;
  tested: number;
  passed: number;
  working: Segment[];
  notWorking: Segment[];
  /** Plain-language caveat when the pool is too small or the base rate too low. */
  caveat: string | null;
  ms: number;
}

export interface ComboOptions {
  minAge?: number;
  maxAge?: number;
  minSingle?: number;
  minPair?: number;
  q?: number;
  top?: number;
  pairs?: boolean;
}

const EXCLUDED_DIMS = new Set(['leadMonth']);

function related(a: Dimension, b: Dimension): boolean {
  // A dimension is never paired with its own parent or with a sibling derived
  // from the same parent (utm medium × utm campaign both come from source).
  return !!(a.parents?.includes(b.key) || b.parents?.includes(a.key) || a.parents?.some((p) => b.parents?.includes(p)));
}

function* engine(rows: LeadFact[], measureKey: string, o: Required<ComboOptions>, out: { result?: ComboResult }): Generator<void> {
  const t0 = Date.now();
  const m = MEASURE[measureKey];
  const bin = m?.binomial;
  const empty = (caveat: string): ComboResult => ({ measure: measureKey, baseline: 0, pool: 0, tested: 0, passed: 0, working: [], notWorking: [], caveat, ms: Date.now() - t0 });
  if (!m || !bin) { out.result = empty('Pick a conversion rate to search.'); return; }

  const pool: Array<{ r: LeadFact; y: 0 | 1 }> = [];
  for (const r of rows) {
    if (!r.isLead || r.likelyTest) continue;
    const age = r.leadAgeDays ?? -1;
    if (age < o.minAge || age > o.maxAge) continue;
    const y = bin(r);
    if (y === null) continue;
    pool.push({ r, y });
  }
  const N = pool.length;
  const X = pool.reduce((s, p) => s + p.y, 0);
  if (N < o.minSingle * 2) { out.result = empty(`Only ${N} mature leads match — the finder needs at least ${o.minSingle * 2}. Widen the filters.`); return; }
  const p0 = X / N;
  if (X === 0) { out.result = { ...empty('No successes in the pool yet, so nothing can stand out.'), baseline: 0, pool: N }; return; }

  const dims = DIMENSIONS.filter((d) => !d.multi && !EXCLUDED_DIMS.has(d.key) && (m.phases ?? ['lead']).includes(d.phase));
  // value index per dimension: value → member indices
  const index = dims.map((d) => {
    const map = new Map<string, number[]>();
    pool.forEach((p, i) => { const v = dimValues(d, p.r)[0]; const arr = map.get(v); if (arr) arr.push(i); else map.set(v, [i]); });
    return map;
  });
  const valueOf = dims.map((d) => pool.map((p) => dimValues(d, p.r)[0]));

  interface Cand { filters: Filter[]; label: string; x: number; n: number; p: number; pair: boolean; condP: number }
  const cands: Cand[] = [];
  // Every segment big enough is TESTED (and counted by Benjamini–Hochberg),
  // whatever its effect; the |x − n·p0| ≥ 3 floor only decides what is SHOWN.
  // Filtering on the effect before the correction would hide tests from it.
  const enough = (_x: number, n: number, min: number) => n >= min && N - n >= 5;
  const visible = (x: number, n: number) => Math.abs(x - n * p0) >= 3;
  const fisherVsRest = (x: number, n: number) => fisherExact(x, n - x, X - x, N - n - (X - x));

  // singles
  const singleStats = dims.map((d, di) => {
    const st = new Map<string, { x: number; n: number }>();
    for (const [v, idx] of index[di]) {
      const x = idx.reduce((s, i) => s + pool[i].y, 0);
      st.set(v, { x, n: idx.length });
      if (enough(x, idx.length, o.minSingle)) {
        cands.push({ filters: [{ dim: d.key, values: [v] }], label: `${d.label}: ${dimLabel(d.key, v)}`, x, n: idx.length, p: fisherVsRest(x, idx.length), pair: false, condP: 0 });
      }
    }
    return st;
  });
  yield;

  // pairs
  if (o.pairs) {
    for (let a = 0; a < dims.length; a++) {
      for (let b = a + 1; b < dims.length; b++) {
        if (related(dims[a], dims[b])) continue;
        const counts = new Map<string, { x: number; n: number; va: string; vb: string }>();
        for (let i = 0; i < N; i++) {
          const va = valueOf[a][i], vb = valueOf[b][i];
          const k = `${va}\u0000${vb}`;
          const c = counts.get(k);
          if (c) { c.n++; c.x += pool[i].y; } else counts.set(k, { x: pool[i].y, n: 1, va, vb });
        }
        for (const c of counts.values()) {
          if (!enough(c.x, c.n, o.minPair)) continue;
          const sa = singleStats[a].get(c.va)!, sb = singleStats[b].get(c.vb)!;
          // adds information inside each parent?
          const inA = sa.n - c.n > 0 ? fisherExact(c.x, c.n - c.x, sa.x - c.x, sa.n - c.n - (sa.x - c.x)) : 1;
          const inB = sb.n - c.n > 0 ? fisherExact(c.x, c.n - c.x, sb.x - c.x, sb.n - c.n - (sb.x - c.x)) : 1;
          cands.push({
            filters: [{ dim: dims[a].key, values: [c.va] }, { dim: dims[b].key, values: [c.vb] }],
            label: `${dims[a].label}: ${dimLabel(dims[a].key, c.va)} + ${dims[b].label}: ${dimLabel(dims[b].key, c.vb)}`,
            x: c.x, n: c.n, p: fisherVsRest(c.x, c.n), pair: true, condP: Math.max(inA, inB),
          });
        }
      }
      yield;
    }
  }

  const discoveries = benjaminiHochberg(cands.map((c) => c.p), o.q);
  // A pair must ALSO beat each of its parents (inside A=a, B=b differs from
  // the rest of A=a, and vice-versa), with its own false-discovery control
  // across all pairs — otherwise "Panama + anything" floods the list.
  const pairIdx = cands.map((c, i) => (c.pair && discoveries[i] ? i : -1)).filter((i) => i >= 0);
  const condOk = new Set<number>();
  benjaminiHochberg(pairIdx.map((i) => cands[i].condP), o.q).forEach((ok, k) => { if (ok) condOk.add(pairIdx[k]); });
  const segs: Segment[] = [];
  cands.forEach((c, i) => {
    if (!discoveries[i] || (c.pair && !condOk.has(i)) || !visible(c.x, c.n)) return;
    const rate = c.x / c.n;
    segs.push({ filters: c.filters, label: c.label, x: c.x, n: c.n, rate, shrunk: shrunkRate(c.x, c.n, p0), lift: p0 > 0 ? rate / p0 : 0, p: c.p, ci: wilson(c.x, c.n), pair: c.pair });
  });
  const working = segs.filter((s) => s.rate > p0).sort((x, y) => y.shrunk - x.shrunk).slice(0, o.top);
  const notWorking = segs.filter((s) => s.rate < p0).sort((x, y) => x.shrunk - y.shrunk).slice(0, o.top);
  let caveat: string | null = null;
  if (!segs.length) caveat = `No segment stands out from the ${Math.round(p0 * 100)}% baseline once chance is accounted for (${cands.length} tested). More data will sharpen this.`;
  else if (p0 < 0.08 && !notWorking.length) caveat = `With a ${Math.round(p0 * 1000) / 10}% base rate, "not working" segments need larger samples to show up.`;
  out.result = { measure: measureKey, baseline: p0, pool: N, tested: cands.length, passed: segs.length, working, notWorking, caveat, ms: Date.now() - t0 };
}

function opts(o: ComboOptions): Required<ComboOptions> {
  return { minAge: 60, maxAge: 540, minSingle: 15, minPair: 25, q: 0.1, top: 10, pairs: true, ...o };
}

export function findCombos(rows: LeadFact[], measureKey: string, o: ComboOptions = {}): ComboResult {
  const out: { result?: ComboResult } = {};
  for (const _ of engine(rows, measureKey, opts(o), out)) { /* run to completion */ }
  return out.result!;
}

/** Same as findCombos, yielding to the browser between dimension rows. Cancel with the signal. */
export async function findCombosAsync(rows: LeadFact[], measureKey: string, o: ComboOptions = {}, signal?: { cancelled: boolean }): Promise<ComboResult | null> {
  const out: { result?: ComboResult } = {};
  for (const _ of engine(rows, measureKey, opts(o), out)) {
    await new Promise((r) => setTimeout(r, 0));
    if (signal?.cancelled) return null;
  }
  return out.result ?? null;
}
