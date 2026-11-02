/**
 * lab.ts — everything the Evo Lab page shows, computed once per
 * (cube, metrics rows, options). Sections read from this object only.
 */

import type { LeadFact } from '../../metrics/engine/types.ts';
import { ALL_EXCLUSIONS, joinAll, leadIndex, type JoinedExperiment } from './join.ts';
import { analyzeExperiment, type ExperimentAnalysis } from './experiment.ts';
import { scanPairs, type PairScan } from './combos.ts';
import { scanAudiences, type AudienceScan } from './audiences.ts';
import { DECISION_STATES } from './rules.ts';
import type { EvoCube, Exclusion } from './types.ts';

export interface LabOptions {
  now?: number;
  windowDays?: number;
  currency?: string;
  exclude?: Exclusion[];
  surface?: 'all' | 'web' | 'chat' | 'email';
  status?: 'running' | 'ended' | 'all';
  /** Run the time-to-decision simulation (default true). */
  forecast?: boolean;
}

export interface LabHealthLine {
  tone: 'good' | 'watch' | 'bad';
  text: string;
}

export interface Lab {
  options: Required<LabOptions>;
  joined: JoinedExperiment[];
  /** Every experiment, ignoring the surface/status filter (combinations, audiences). */
  joinedAll: JoinedExperiment[];
  analyses: ExperimentAnalysis[];
  waiting: ExperimentAnalysis[];
  pairs: PairScan;
  audiences: AudienceScan;
  health: LabHealthLine;
  leads: Map<string, LeadFact>;
}

const SORT: Record<string, number> = { ready: 0, guardrail_hold: 1, data_problem: 2, keep_control: 3, no_difference: 4, leaning: 5, collecting: 6, too_early: 7 };

export function buildLab(cube: EvoCube, rows: LeadFact[], o: LabOptions = {}): Lab {
  const options: Required<LabOptions> = {
    now: o.now ?? Date.now(),
    windowDays: o.windowDays ?? 30,
    currency: o.currency ?? 'USD',
    exclude: o.exclude ?? ALL_EXCLUSIONS,
    surface: o.surface ?? 'all',
    status: o.status ?? 'all',
    forecast: o.forecast ?? true,
  };
  const leads = leadIndex(rows);
  const joinedAll = joinAll(cube, { windowDays: options.windowDays, exclude: options.exclude, currency: options.currency });
  const live = cube.experiments.filter((d) => d.status === 'running').length;
  const ctx = { now: options.now, windowDays: options.windowDays, currency: options.currency, leads };
  const joined = joinedAll.filter((j) =>
    (options.surface === 'all' || j.def.surface === options.surface) &&
    (options.status === 'all' || (options.status === 'running' ? j.def.status === 'running' : j.def.status !== 'running')),
  );
  const analyses = joined
    .map((j) => analyzeExperiment(j, { ...ctx, live, noForecast: !options.forecast }))
    .sort((a, b) => (SORT[a.decision.state] ?? 9) - (SORT[b.decision.state] ?? 9) || a.def.title.localeCompare(b.def.title));
  const waiting = analyses.filter((a) => DECISION_STATES.has(a.decision.state));
  return {
    options,
    joined,
    joinedAll,
    analyses,
    waiting,
    pairs: scanPairs(joinedAll, ctx),
    audiences: scanAudiences(joinedAll, ctx),
    health: healthLine(cube, analyses),
    leads,
  };
}

export function healthLine(cube: EvoCube, analyses: ExperimentAnalysis[]): LabHealthLine {
  const running = cube.experiments.filter((d) => d.status === 'running');
  if (!cube.health.totals.postStartEvents) {
    return { tone: 'bad', text: cube.health.totals.events ? 'No events since the experiments restarted. Tracking may not be deployed yet.' : 'No Evo events at all. Tracking is not reaching the server.' };
  }
  const srm = analyses.find((a) => a.decision.state === 'data_problem');
  if (srm) return { tone: 'bad', text: `${srm.def.title}: ${srm.decision.reason}` };
  const silent = running.filter((d) => {
    const last = cube.health.experiments[d.componentKey]?.lastAssignmentAt;
    return !last || Date.parse(last) < Date.parse(cube.generatedAt) - 3 * 86400_000;
  });
  if (silent.length) return { tone: 'watch', text: `No new visitors in 3 days for ${silent.map((d) => d.title).join(', ')}.` };
  const unreg = Object.keys(cube.health.drift.unregisteredComponents).filter((c) => !/^E2E_Test_Comp_/.test(c));
  if (unreg.length) return { tone: 'watch', text: `Events for components that are not registered: ${unreg.join(', ')}.` };
  if (cube.warnings.length) return { tone: 'watch', text: cube.warnings[0] };
  return { tone: 'good', text: `Tracking healthy · ${running.length} experiments receiving data` };
}
