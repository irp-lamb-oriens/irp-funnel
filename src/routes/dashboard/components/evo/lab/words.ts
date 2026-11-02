/**
 * words.ts — how Evo Lab numbers read. Every judgement gets a sentence
 * (spec §7.5): "Urgent CTA: 18.4 % clicked vs 15.1 % for Baseline (+22 %,
 * likely between +6 % and +40 %). 98 % chance it's better."
 */

import { pct, int, money } from '../../metrics/engine/format.ts';
import { armLabel } from '../engine/join.ts';
import { metricDef } from '../engine/metrics.ts';
import { STATE_LABEL, type State } from '../engine/rules.ts';
import type { ExperimentAnalysis } from '../engine/experiment.ts';
import type { MetricResult } from '../engine/types.ts';

export { pct, int, money };

export function signedPct(v: number | null | undefined, digits = 0): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  const p = v * 100;
  const r = digits ? Math.round(p * 10 ** digits) / 10 ** digits : Math.round(p);
  return `${r > 0 ? '+' : ''}${r} %`;
}

export function chance(p: number | null | undefined): string {
  if (p === null || p === undefined || !Number.isFinite(p)) return '—';
  if (p > 0.995) return '> 99 %';
  if (p < 0.005) return '< 1 %';
  return `${Math.round(p * 100)} %`;
}

export function per100(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  const r = Math.round(v * 1000) / 10;
  return `${r > 0 ? '+' : ''}${r}`;
}

export function weeks(w: number | null): string {
  if (w === null) return 'more than a year';
  if (w <= 1) return 'about a week';
  return `${w} weeks`;
}

export const STATE_TONE: Record<State, 'good' | 'watch' | 'bad' | 'info'> = {
  ready: 'good',
  keep_control: 'good',
  no_difference: 'info',
  guardrail_hold: 'bad',
  data_problem: 'bad',
  leaning: 'watch',
  collecting: 'info',
  too_early: 'info',
};

export const STATE_ACTION: Record<State, string> = {
  ready: 'Ship the winner: retire the other arm in code, then record the decision.',
  keep_control: 'Keep the current version and retire the alternative.',
  no_difference: 'Stop the test and keep whichever version is cheaper or fits the brand.',
  guardrail_hold: 'Do not ship. Look at the people and clients behind the guardrail first.',
  data_problem: 'Fix tracking before reading any result. Open Operations → Data health.',
  leaning: 'Keep running.',
  collecting: 'Keep running.',
  too_early: 'Keep running. Results below the floor are noise.',
};

export { STATE_LABEL };

/**
 * One evidence sentence for the primary metric. Below the floor (too early)
 * or with a data problem, probabilities and ranges are left out: they would be
 * read as signal (spec §6.6).
 */
export function evidence(a: ExperimentAnalysis, r: MetricResult = a.primary, showProbs = !['too_early', 'data_problem'].includes(a.decision.state)): string {
  const def = a.def;
  const m = metricDef(r.key);
  const ctrl = r.arms.find((x) => x.arm === def.control);
  const lead = a.decision.leader && a.decision.leader !== def.control ? a.decision.leader : a.arms[1];
  const arm = r.arms.find((x) => x.arm === lead);
  const cmp = r.comparisons.find((c) => c.arm === lead);
  if (!ctrl || !arm || !ctrl.n || !arm.n) return `No ${m.label.toLowerCase()} results yet.`;
  if (r.kind === 'mean') {
    return `${armLabel(def, lead)}: ${money(arm.rate, 'USD')} ${m.verb} vs ${money(ctrl.rate, 'USD')} for ${armLabel(def, def.control)}.`;
  }
  const head = `${armLabel(def, lead)}: ${pct(arm.rate)} ${m.verb} vs ${pct(ctrl.rate)} for ${armLabel(def, def.control)}`;
  if (!cmp || cmp.rel === null) return `${head}.`;
  if (!showProbs) return `${head} (${signedPct(cmp.rel)} so far; too early to read).`;
  const range = cmp.relCi ? `, likely between ${signedPct(cmp.relCi.lo)} and ${signedPct(cmp.relCi.hi)}` : '';
  const ch = cmp.pBeats !== null ? ` ${chance(cmp.pBeats)} chance it's better.` : '';
  return `${head} (${signedPct(cmp.rel)}${range}).${ch}`;
}

/** "≈ 23 more clicks needed in Baseline, about 3 weeks". */
export function floorLine(a: ExperimentAnalysis): string | null {
  const need = a.decision.needed;
  const keys = Object.keys(need);
  if (!keys.length) return null;
  const m = metricDef(a.def.primaryMetric);
  const parts = keys.map((k) => {
    const rate = a.primary.arms.find((x) => x.arm === k)?.rate ?? null;
    const daily = (a.dailyRate[k] ?? 0) * (rate ?? 0);
    const d = daily > 0 ? Math.ceil(need[k] / daily) : null;
    return `${int(need[k])} more conversions (${m.label}) in ${armLabel(a.def, k)}${d !== null ? ` (about ${d <= 7 ? `${d} days` : `${Math.ceil(d / 7)} weeks`})` : ''}`;
  });
  return `Needs ${parts.join(' and ')}.`;
}

export function forecastLine(a: ExperimentAnalysis): string | null {
  const f = a.forecast;
  if (!f || a.decision.state === 'data_problem') return null;
  if (f.medianWeeks === null) {
    return Object.values(a.dailyRate).every((v) => !v)
      ? 'No new visitors, so no decision date.'
      : `Unlikely to decide within ${f.horizonWeeks} weeks at current traffic.`;
  }
  if (f.loWeeks !== null && f.hiWeeks !== null && f.hiWeeks !== f.loWeeks) return `Likely decided in ${f.loWeeks}–${f.hiWeeks} weeks.`;
  return `Likely decided in ${weeks(f.medianWeeks)}.`;
}

export function fmtMetricValue(r: MetricResult, v: number | null, currency: string): string {
  return r.kind === 'mean' ? money(v, currency) : pct(v);
}
