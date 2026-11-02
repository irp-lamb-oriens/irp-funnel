/**
 * audiences.ts — who a variant works for (spec §6.8).
 *
 * Decision-grade effects use PRE-TREATMENT context only (device, language,
 * landing source/medium, referrer, returning), known before the variant could
 * change anything. Lead-level splits (origin, budget …) are descriptive only:
 * the variant can change who becomes a lead, so they never enter the finder.
 */

import type { LeadFact } from '../../metrics/engine/types.ts';
import { armsOf, DAY_MS, type JoinedExperiment } from './join.ts';
import { metricDef } from './metrics.ts';
import { benjaminiHochberg, normCdf } from './stats.ts';
import type { EvoCtxRow, MetricKey, Unit } from './types.ts';

export const AUDIENCE_RULES = { minPerArm: 50, unlockConversions: 100, q: 0.1 };

export const PRE_DIMS: Array<{ key: keyof EvoCtxRow; label: string }> = [
  { key: 'device', label: 'Device' },
  { key: 'lang', label: 'Language' },
  { key: 'landingSource', label: 'Landing source' },
  { key: 'landingMedium', label: 'Landing medium' },
  { key: 'referrerHost', label: 'Referrer' },
  { key: 'returning', label: 'Returning visitor' },
];

export const LEAD_DIMS: Array<{ key: keyof LeadFact; label: string }> = [
  { key: 'origin', label: 'Origin' },
  { key: 'destination', label: 'Destination' },
  { key: 'route', label: 'Route' },
  { key: 'budget', label: 'Budget' },
  { key: 'channel', label: 'Channel' },
];

interface Ctx { now: number; windowDays: number; currency: string; leads: Map<string, LeadFact> }

export interface AudienceEffect {
  componentKey: string;
  arm: string;
  dim: string;
  dimLabel: string;
  value: string;
  inside: { n: number; diff: number };
  outside: { n: number; diff: number };
  p: number;
  significant: boolean;
  /** Inside effect shrunk toward the overall effect. */
  shrunkDiff: number;
}

export interface AudienceScan {
  effects: AudienceEffect[];
  tested: number;
  /** Experiments still locked, with their progress. */
  locked: Array<{ componentKey: string; have: number; need: number }>;
}

function rateDiff(units: Unit[], arm: string, control: string, metric: MetricKey, c: Ctx) {
  const m = metricDef(metric);
  const lag = m.lag(c.windowDays) * DAY_MS;
  let na = 0, xa = 0, nc = 0, xc = 0;
  for (const u of units) {
    if (u.t + lag > c.now) continue;
    const v = m.value(u, u.leadId ? c.leads.get(u.leadId) ?? null : null, { W: c.windowDays, currency: c.currency });
    if (v === null) continue;
    if (u.arm === arm) { na++; xa += v; } else if (u.arm === control) { nc++; xc += v; }
  }
  if (!na || !nc) return null;
  const pa = xa / na, pc = xc / nc;
  return { na, nc, x: xa + xc, d: pa - pc, se: Math.sqrt((pa * (1 - pa)) / na + (pc * (1 - pc)) / nc) };
}

export function scanAudiences(joined: JoinedExperiment[], c: Ctx): AudienceScan {
  const effects: AudienceEffect[] = [];
  const locked: AudienceScan['locked'] = [];
  for (const j of joined) {
    if (j.def.surface === 'email') continue;
    const arms = armsOf(j.def);
    const metric = j.def.primaryMetric;
    const overall = rateDiff(j.units, arms[1], j.def.control, metric, c);
    const have = overall?.x ?? 0;
    if (have < AUDIENCE_RULES.unlockConversions) {
      locked.push({ componentKey: j.def.componentKey, have, need: AUDIENCE_RULES.unlockConversions });
      continue;
    }
    for (const arm of arms.slice(1)) for (const dim of PRE_DIMS) {
      const values = new Map<string, Unit[]>();
      for (const u of j.units) {
        const v = String(u.ctx?.[dim.key] ?? 'unknown');
        (values.get(v) ?? values.set(v, []).get(v)!).push(u);
      }
      for (const [value, inside] of values) {
        if (values.size < 2) continue;
        const ins = rateDiff(inside, arm, j.def.control, metric, c);
        if (!ins || ins.na < AUDIENCE_RULES.minPerArm || ins.nc < AUDIENCE_RULES.minPerArm) continue;
        const inSet = new Set(inside);
        const rest = j.units.filter((u) => !inSet.has(u));
        const out = rateDiff(rest, arm, j.def.control, metric, c);
        if (!out) continue;
        const se = Math.sqrt(ins.se ** 2 + out.se ** 2);
        const z = se > 0 ? (ins.d - out.d) / se : 0;
        const p = 2 * (1 - normCdf(Math.abs(z)));
        const f = z * z > 1 ? 1 - 1 / (z * z) : 0;
        effects.push({
          componentKey: j.def.componentKey,
          arm,
          dim: dim.key,
          dimLabel: dim.label,
          value,
          inside: { n: ins.na + ins.nc, diff: ins.d },
          outside: { n: out.na + out.nc, diff: out.d },
          p,
          significant: false,
          shrunkDiff: (overall?.d ?? 0) + (ins.d - (overall?.d ?? 0)) * f,
        });
      }
    }
  }
  const flags = benjaminiHochberg(effects.map((e) => e.p), AUDIENCE_RULES.q);
  effects.forEach((e, i) => { e.significant = flags[i]; });
  return { effects: effects.sort((a, b) => a.p - b.p), tested: effects.length, locked };
}

export interface LeadSplitRow {
  value: string;
  arms: Record<string, { leads: number; won: number }>;
}

/** Descriptive: among credited leads, won-within-60-days by a lead dimension. */
export function leadSplits(j: JoinedExperiment, dim: keyof LeadFact, c: Ctx): LeadSplitRow[] {
  const arms = armsOf(j.def);
  const rows = new Map<string, LeadSplitRow>();
  for (const u of j.units) {
    if (!u.leadId) continue;
    const l = c.leads.get(u.leadId);
    if (!l) continue;
    const v = String(l[dim] ?? 'Unknown');
    const row = rows.get(v) ?? { value: v, arms: Object.fromEntries(arms.map((a) => [a, { leads: 0, won: 0 }])) };
    const cell = row.arms[u.arm];
    if (!cell) continue;
    cell.leads++;
    if (l.won && l.daysToClose !== null && l.daysToClose <= 60) cell.won++;
    rows.set(v, row);
  }
  return [...rows.values()].sort((a, b) => Object.values(b.arms).reduce((s, x) => s + x.leads, 0) - Object.values(a.arms).reduce((s, x) => s + x.leads, 0));
}
