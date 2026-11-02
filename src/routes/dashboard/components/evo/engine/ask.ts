/**
 * ask.ts — Ask Evo on the client (spec §6.11). The server's LLM turns a
 * question into an AskSpec; here we re-validate it against the cube and
 * describe it in plain words ("What I computed"). Numbers always come from
 * the engine, never from the model.
 */

import { metricDef } from './metrics.ts';
import { PRE_DIMS } from './audiences.ts';
import type { EvoCube, MetricKey } from './types.ts';

export type AskView = 'scorecard' | 'trend' | 'funnel' | 'interaction' | 'configs' | 'audience' | 'drip' | 'health' | 'people';
export const ASK_VIEWS: AskView[] = ['scorecard', 'trend', 'funnel', 'interaction', 'configs', 'audience', 'drip', 'health', 'people'];

export interface AskSpec {
  view: AskView;
  experiment?: string;
  variants?: string[];
  metric?: MetricKey;
  components?: string[];
  splitBy?: string;
  window?: 7 | 14 | 30 | 60;
  period?: { from: string; to: string };
  filters?: Array<{ dim: string; values: string[] }>;
  explanation: string[];
  unresolved: string[];
}

export function normalizeSpec(raw: Partial<AskSpec> | null | undefined, cube: EvoCube): AskSpec {
  const unresolved = [...(raw?.unresolved ?? [])];
  const keys = new Set(cube.experiments.map((d) => d.componentKey));
  const view = ASK_VIEWS.includes(raw?.view as AskView) ? (raw!.view as AskView) : 'scorecard';
  let experiment = raw?.experiment && keys.has(raw.experiment) ? raw.experiment : undefined;
  if (raw?.experiment && !experiment) unresolved.push(`experiment "${raw.experiment}"`);
  const def = cube.experiments.find((d) => d.componentKey === experiment);
  const variants = def ? (raw?.variants ?? []).filter((v) => def.variants.some((x) => x.key === v)) : undefined;
  const metric = raw?.metric && (raw.metric.startsWith('step:') || metricDef(raw.metric).label !== raw.metric) ? raw.metric : undefined;
  const components = (raw?.components ?? []).filter((c) => keys.has(c)).slice(0, 4);
  const splitBy = raw?.splitBy && PRE_DIMS.some((d) => d.key === raw.splitBy) ? raw.splitBy : undefined;
  if (raw?.splitBy && !splitBy) unresolved.push(`split "${raw.splitBy}" (only pre-visit context can split experiments)`);
  const window = ([7, 14, 30, 60] as const).find((w) => w === raw?.window);
  if (!experiment && ['scorecard', 'trend', 'funnel', 'people', 'audience'].includes(view) && cube.experiments.length) {
    experiment = cube.experiments[0].componentKey;
    unresolved.push('no experiment named; showing the first one');
  }
  return { view, experiment, variants, metric, components, splitBy, window, period: raw?.period, filters: raw?.filters ?? [], explanation: raw?.explanation ?? [], unresolved };
}

export function describeSpec(s: AskSpec, cube: EvoCube): string {
  const title = (k?: string) => cube.experiments.find((d) => d.componentKey === k)?.title ?? k ?? '';
  const m = s.metric ? metricDef(s.metric).label.toLowerCase() : 'the primary metric';
  switch (s.view) {
    case 'scorecard': return `Scorecard for ${title(s.experiment)} on ${m}${s.window ? `, ${s.window}-day window` : ''}.`;
    case 'trend': return `How ${title(s.experiment)} developed over time on ${m}.`;
    case 'funnel': return `The funnel per variant for ${title(s.experiment)}.`;
    case 'interaction': return `Whether experiments affect each other${s.components?.length ? ` (${s.components.map(title).join(' × ')})` : ''}.`;
    case 'configs': return `Full configurations of ${(s.components ?? []).map(title).join(', ') || 'the selected experiments'} on ${m}.`;
    case 'audience': return `Who ${title(s.experiment)} works for${s.splitBy ? `, split by ${s.splitBy}` : ''}.`;
    case 'drip': return 'The nurture email experiments.';
    case 'health': return 'Tracking and data health.';
    case 'people': return `The people behind ${title(s.experiment)}.`;
  }
}
