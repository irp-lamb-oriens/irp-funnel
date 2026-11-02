/**
 * cube.ts — filter, group, cross-tab and time series over lead facts.
 * Every aggregate re-runs the measure's own `compute` on the subset, so rates
 * and medians aggregate correctly (no averaging of averages).
 */
import type { Ctx, Filter, LeadFact } from './types.ts';
import { DIM, MEASURE, dimLabel, dimValues, type MeasureValue } from './registry.ts';

export function filterRows(rows: LeadFact[], filters: Filter[], opts: { excludeTest?: boolean } = {}): LeadFact[] {
  const active = filters.filter((f) => DIM[f.dim] && f.values.length);
  if (!active.length && !opts.excludeTest) return rows;
  const sets = active.map((f) => ({ d: DIM[f.dim], vals: new Set(f.values), exclude: !!f.exclude }));
  return rows.filter((r) => {
    if (opts.excludeTest && r.likelyTest) return false;
    for (const s of sets) {
      const hit = dimValues(s.d, r).some((v) => s.vals.has(v));
      if (hit === s.exclude) return false;
    }
    return true;
  });
}

export function aggregate(rows: LeadFact[], measureKey: string, ctx: Ctx): MeasureValue {
  const m = MEASURE[measureKey];
  return m ? m.compute(rows, ctx) : { value: null, n: 0 };
}

export interface Group {
  key: string;
  label: string;
  rows: LeadFact[];
  values: Record<string, MeasureValue>;
  /** Cohort lead count — the sample size most rates are based on. */
  leads: number;
}

export function partition(rows: LeadFact[], dimKey: string): Map<string, LeadFact[]> {
  const d = DIM[dimKey];
  const out = new Map<string, LeadFact[]>();
  if (!d) return out;
  for (const r of rows) {
    for (const v of new Set(dimValues(d, r))) {
      const arr = out.get(v);
      if (arr) arr.push(r);
      else out.set(v, [r]);
    }
  }
  return out;
}

/**
 * Group by one dimension. Groups beyond `top` (by the first measure) fold
 * into "Everything else" so a long tail never crowds the table.
 */
export function groupBy(rows: LeadFact[], dimKey: string, measureKeys: string[], ctx: Ctx, opts: { top?: number; sortBy?: string; cohortOnly?: boolean } = {}): Group[] {
  const d = DIM[dimKey];
  if (!d) return [];
  const parts = partition(rows, dimKey);
  const sortKey = opts.sortBy ?? measureKeys[0];
  const cohortLeads = (rs: LeadFact[]) => rs.filter((r) => r.isLead && (ctx.allTime || (r.leadMonth && ctx.months.includes(r.leadMonth)))).length;
  let groups: Group[] = [...parts.entries()].map(([key, rs]) => ({
    key,
    label: dimLabel(dimKey, key),
    rows: rs,
    leads: cohortLeads(rs),
    values: Object.fromEntries(measureKeys.map((mk) => [mk, aggregate(rs, mk, ctx)])),
  }));
  if (opts.cohortOnly) groups = groups.filter((g) => g.leads > 0);
  if (d.order) {
    const idx = (k: string) => { const i = d.order!.indexOf(k); return i < 0 ? 999 : i; };
    groups.sort((a, b) => idx(a.key) - idx(b.key) || a.label.localeCompare(b.label));
  } else if (dimKey === 'leadMonth' || dimKey === 'leadQuarter') {
    groups.sort((a, b) => a.key.localeCompare(b.key));
  } else {
    groups.sort((a, b) => (b.values[sortKey]?.value ?? -Infinity) - (a.values[sortKey]?.value ?? -Infinity) || b.leads - a.leads);
  }
  const top = opts.top ?? 0;
  if (top > 0 && groups.length > top + 1 && !d.order) {
    const head = groups.slice(0, top);
    const tailRows = [...new Set(groups.slice(top).flatMap((g) => g.rows))];
    head.push({
      key: '__rest__',
      label: `Everything else (${groups.length - top})`,
      rows: tailRows,
      leads: cohortLeads(tailRows),
      values: Object.fromEntries(measureKeys.map((mk) => [mk, aggregate(tailRows, mk, ctx)])),
    });
    groups = head;
  }
  return groups;
}

export interface CrossTab {
  rows: Array<{ key: string; label: string }>;
  cols: Array<{ key: string; label: string }>;
  cells: MeasureValue[][];
  rowTotals: MeasureValue[];
  colTotals: MeasureValue[];
}

export function crossTab(rows: LeadFact[], dimA: string, dimB: string, measureKey: string, ctx: Ctx, top = 8): CrossTab {
  const ga = groupBy(rows, dimA, [measureKey], ctx, { top, sortBy: measureKey }).filter((g) => g.key !== '__rest__');
  const gb = groupBy(rows, dimB, [measureKey], ctx, { top, sortBy: measureKey }).filter((g) => g.key !== '__rest__');
  const db = DIM[dimB];
  const cells = ga.map((a) => {
    const byB = new Map<string, LeadFact[]>();
    for (const r of a.rows) for (const v of new Set(dimValues(db, r))) { const arr = byB.get(v); if (arr) arr.push(r); else byB.set(v, [r]); }
    return gb.map((b) => aggregate(byB.get(b.key) ?? [], measureKey, ctx));
  });
  return {
    rows: ga.map((g) => ({ key: g.key, label: g.label })),
    cols: gb.map((g) => ({ key: g.key, label: g.label })),
    cells,
    rowTotals: ga.map((g) => g.values[measureKey]),
    colTotals: gb.map((g) => g.values[measureKey]),
  };
}

/** Measure value for each month (a one-month ctx per point). */
export function monthSeries(rows: LeadFact[], measureKey: string, months: string[], ctx: Ctx): Array<number | null> {
  return months.map((m) => aggregate(rows, measureKey, { ...ctx, months: [m], allTime: false }).value);
}

/** Distinct values of a dimension (for the filter picker), most common first. */
export function dimensionValues(rows: LeadFact[], dimKey: string): Array<{ value: string; label: string; count: number }> {
  const d = DIM[dimKey];
  if (!d) return [];
  const counts = new Map<string, number>();
  for (const r of rows) for (const v of new Set(dimValues(d, r))) counts.set(v, (counts.get(v) ?? 0) + 1);
  const out = [...counts.entries()].map(([value, count]) => ({ value, label: dimLabel(dimKey, value), count }));
  if (d.order) out.sort((a, b) => d.order!.indexOf(a.value) - d.order!.indexOf(b.value));
  else out.sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  return out;
}

/** Funnel reach per stage for the cohort (dated or not). */
export function funnelCounts(rows: LeadFact[], stages: string[], ctx: Ctx): number[] {
  const set = new Set(ctx.months);
  const cohort = rows.filter((r) => r.isLead && (ctx.allTime || (r.leadMonth && set.has(r.leadMonth))));
  return stages.map((s) => cohort.filter((r) => !!r.reach[s]).length);
}

export function csvEscape(v: unknown): string {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
