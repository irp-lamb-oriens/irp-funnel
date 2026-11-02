/**
 * join.ts — turn the Evo cube into analysable units per experiment and join
 * them to Metrics Hub LeadFacts (spec §6.1, §6.3).
 *
 * Web / chat experiments, per visitor with an assignment:
 *   • The visitor's arm is its first post-start assignment (ITT).
 *   • A lead is credited to the person's EARLIEST-ASSIGNED visitor for that
 *     experiment: the person's earliest consultation whose leadAt is on or
 *     after that visitor's assignment day (Costa Rica) and within W days of
 *     the assignment. The person's other visitors stay as non-converting.
 * Email experiments: one unit per drip assignee; the lead is the
 * consultation itself.
 */

import type { LeadFact } from '../../metrics/engine/types.ts';
import type { EvoCube, EvoExperimentDef, Exclusion, JoinOptions, Unit } from './types.ts';

export const DAY_MS = 86400_000;
const CR_OFFSET_MS = 6 * 3600_000; // Costa Rica: UTC−6, no daylight saving

/** Epoch ms of 00:00 Costa Rica on a yyyy-mm-dd day key. */
export function crDayStart(day: string): number {
  return Date.parse(`${day}T00:00:00.000Z`) + CR_OFFSET_MS;
}

/** CR day key of an epoch ms. */
export function crDay(ms: number): string {
  return new Date(ms - CR_OFFSET_MS).toISOString().slice(0, 10);
}

export const ALL_EXCLUSIONS: Exclusion[] = ['forced', 'legacy', 'dev', 'bot', 'test'];

export interface JoinedExperiment {
  def: EvoExperimentDef;
  /** Units kept after exclusions. */
  units: Unit[];
  /** Every unit before exclusions (SRM and imbalance checks use these). */
  all: Unit[];
}

export function leadIndex(rows: LeadFact[]): Map<string, LeadFact> {
  const m = new Map<string, LeadFact>();
  for (const r of rows) if (r.isLead) m.set(r.id, r);
  return m;
}

export function joinExperiment(cube: EvoCube, def: EvoExperimentDef, opts: JoinOptions): JoinedExperiment {
  const exclude = new Set(opts.exclude ?? ALL_EXCLUSIONS);
  const all: Unit[] = [];
  const comp = def.componentKey;
  const W = opts.windowDays * DAY_MS;

  if (def.surface === 'email') {
    const field = comp === 'EmailDripSubject' ? 'subject' : 'body';
    for (const d of cube.drip) {
      const arm = d[field];
      if (!arm) continue;
      all.push({
        vid: -1,
        arm,
        t: d.assignedAt,
        day: d.day,
        crossover: false,
        x: d.test ? ['test'] : [],
        ctx: null,
        steps: {},
        leadId: d.leadId,
        leadAt: null,
        drip: { reachedType: d.reachedType, opened: d.opened, clicked: d.clicked, firstClickDays: d.firstClickDays },
      });
    }
  } else {
    // Earliest-assigned visitor per person for this experiment.
    const earliest = new Map<number, number>(); // person → vid
    for (const v of cube.visitors) {
      const a = v.assign[comp];
      if (!a || v.person < 0) continue;
      const cur = earliest.get(v.person);
      if (cur === undefined || a.t < cube.visitors[cur].assign[comp].t) earliest.set(v.person, v.vid);
    }
    for (const v of cube.visitors) {
      const a = v.assign[comp];
      if (!a) continue;
      let leadId: string | null = null;
      let leadAt: number | null = null;
      if (v.person >= 0 && earliest.get(v.person) === v.vid) {
        const from = crDayStart(a.day);
        const to = a.t + W;
        const hit = cube.persons[v.person].leads.find((l) => l.at >= from && l.at <= to);
        if (hit) {
          leadId = hit.id;
          leadAt = hit.at;
        }
      }
      all.push({ vid: v.vid, arm: a.v, t: a.t, day: a.day, crossover: a.crossover, x: a.x, ctx: v.ctx, steps: v.steps, leadId, leadAt, drip: null });
    }
  }
  const units = all.filter((u) => !u.x.some((r) => exclude.has(r)));
  return { def, units, all };
}

export function joinAll(cube: EvoCube, opts: JoinOptions): JoinedExperiment[] {
  return cube.experiments.map((d) => joinExperiment(cube, d, opts));
}

/** Active (non-retired) arms in registry order, control first. */
export function armsOf(def: EvoExperimentDef): string[] {
  const act = def.variants.filter((v) => !v.retiredIn).map((v) => v.key);
  return [def.control, ...act.filter((k) => k !== def.control)];
}

export function armLabel(def: EvoExperimentDef, arm: string): string {
  return def.variants.find((v) => v.key === arm)?.label || arm;
}
