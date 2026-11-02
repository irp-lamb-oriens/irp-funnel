/**
 * synthetic.ts — seeded Evo cube + LeadFact generator for tests and the
 * dashboard's dev-only `?fixture=evo` mode. Plants known effects so tests can
 * check the engine finds them, and nothing else.
 */

import type { LeadFact } from '../../metrics/engine/types.ts';
import { rng } from './stats.ts';
import { crDay } from './join.ts';
import type { EvoCube, EvoExperimentDef, EvoVisitor, MetricKey } from './types.ts';

export interface SynthExperiment {
  key: string;
  surface?: 'web' | 'chat';
  primary?: MetricKey;
  /** Relative lift of arm b on the CTA click. */
  clickLift?: number;
  /** Relative lift of arm b on becoming a lead. */
  leadLift?: number;
  /** Lift applied only to mobile visitors (audience effect). */
  mobileLift?: number;
}

export interface SynthOptions {
  seed?: number;
  days?: number;
  /** New visitors per day. */
  perDay?: number;
  baseClick?: number;
  baseLead?: number;
  experiments?: SynthExperiment[];
  /** Extra lead lift when A=b AND B=b (first two experiments). */
  interaction?: number;
  /** Share of people with a second device (identified via email). */
  multiDevice?: number;
  /** Arm b gets this share of traffic instead of 0.5 (SRM). */
  srmShare?: number;
  now?: string;
}

const DEFAULT_EXPERIMENTS: SynthExperiment[] = [
  { key: 'HeroForm', primary: 'step:cta_click', clickLift: 0.25 },
  { key: 'Chatbot', surface: 'chat', primary: 'step:cta_click' },
];

export function syntheticLead(id: string, leadAt: number, o: Partial<LeadFact> = {}): LeadFact {
  const iso = new Date(leadAt).toISOString();
  return {
    id, name: id, isLead: true, likelyTest: false, leadAt: iso, leadMonth: iso.slice(0, 7), leadAgeDays: null, leadWeekday: null,
    quoteSentMonth: null, quoteSentMonths: {}, won: false, wonMonth: null, paid: false, paidMonth: null, dropKind: null, dropMonth: null,
    reach: {}, stage: null, stageLabel: null, status: 'lead', dealCurrency: null, money: {}, receivable: {}, costKnown: false, openQuote: null,
    daysToClose: null, quoteTurnaroundDays: null, decisionDays: null, acceptToPaidDays: null, daysSinceActivity: null, quotes: 0,
    channel: 'Form', utmSource: '(none)', utmMedium: '(none)', utmCampaign: '(none)', heardFrom: '(none)', origin: 'US', destination: 'CR',
    route: 'US → CR', budget: 'Unknown', size: 'Unknown', propertyFrom: 'unknown', propertyTo: 'unknown', immigration: 'unknown',
    hasVehicles: 'No', service: 'unknown', providers: [], callBooked: false, callAttended: false, noShow: false, callOutcome: '', multiTouch: false,
    ...o,
  } as LeadFact;
}

export function syntheticEvo(opts: SynthOptions = {}): { cube: EvoCube; leads: LeadFact[] } {
  const r = rng(opts.seed ?? 3);
  const days = opts.days ?? 90;
  const perDay = opts.perDay ?? 33;
  const baseClick = opts.baseClick ?? 0.15;
  const baseLead = opts.baseLead ?? 0.03;
  const exps = opts.experiments ?? DEFAULT_EXPERIMENTS;
  const now = Date.parse(opts.now ?? '2026-11-30T18:00:00.000Z');
  const start = now - days * 86400_000;
  const defs: EvoExperimentDef[] = exps.map((e) => ({
    componentKey: e.key, title: e.key, surface: e.surface ?? 'web', control: 'a', primaryMetric: e.primary ?? 'step:cta_click',
    guardrails: ['lead'], status: 'running', startedAt: new Date(start).toISOString(),
    variants: [{ key: 'a', label: `${e.key} A` }, { key: 'b', label: `${e.key} B` }],
  }));
  const share = opts.srmShare ?? 0.5;
  const visitors: EvoVisitor[] = [];
  const persons: EvoCube['persons'] = [];
  const leads: LeadFact[] = [];
  let leadN = 0;
  for (let d = 0; d < days; d++) {
    for (let i = 0; i < perDay; i++) {
      const t = start + d * 86400_000 + Math.floor(r() * 86400_000);
      const mobile = r() < 0.6;
      const assign: EvoVisitor['assign'] = {};
      for (const e of exps) {
        const v = r() < share ? 'b' : 'a';
        assign[e.key] = { v, t, day: crDay(t), p: v === 'b' ? share : 1 - share, source: 'fixed', commit: 'c1', crossover: false, x: [] };
      }
      // Click: first experiment drives the click lift.
      let pc = baseClick;
      let pl = baseLead;
      exps.forEach((e, k) => {
        const isB = assign[e.key].v === 'b';
        if (isB && e.clickLift && k === 0) pc *= 1 + e.clickLift;
        if (isB && e.leadLift) pl *= 1 + e.leadLift;
        if (isB && e.mobileLift && mobile) pl *= 1 + e.mobileLift;
      });
      if (opts.interaction && exps.length >= 2 && assign[exps[0].key].v === 'b' && assign[exps[1].key].v === 'b') pl *= 1 + opts.interaction;
      const steps: Record<string, number> = {};
      if (r() < pc) steps.cta_click = t + 30_000;
      const vid = visitors.length;
      const v: EvoVisitor = {
        vid, person: -1, assign, steps,
        ctx: { device: mobile ? 'mobile' : 'desktop', lang: r() < 0.7 ? 'en' : 'es', landingSource: r() < 0.5 ? 'instagram' : '(direct)', landingMedium: '(none)', referrerHost: '(none)', returning: false },
      };
      visitors.push(v);
      if (r() < pl) {
        const id = `lead-${leadN++}`;
        const at = t + Math.floor(r() * 3 * 86400_000);
        const won = r() < 0.2;
        leads.push(syntheticLead(id, at, {
          callBooked: r() < 0.5, won, daysToClose: won ? 20 : null,
          money: won ? { USD: { booked: 8000 + Math.floor(r() * 4000), margin: 2000, invoiced: 0, cash: 0, byMonth: {} } } : {},
        }));
        const p = persons.length;
        persons.push({ leads: [{ id, at, test: false }], visitors: [vid] });
        v.person = p;
        // A second, later device of the same person (not credited).
        if (r() < (opts.multiDevice ?? 0)) {
          const t2 = t + 86400_000;
          const a2: EvoVisitor['assign'] = {};
          for (const e of exps) {
            const vv = r() < share ? 'b' : 'a';
            a2[e.key] = { v: vv, t: t2, day: crDay(t2), p: 0.5, source: 'fixed', commit: 'c1', crossover: false, x: [] };
          }
          visitors.push({ vid: visitors.length, person: p, assign: a2, steps: {}, ctx: v.ctx });
          persons[p].visitors.push(visitors.length - 1);
        }
      }
    }
  }
  const health: EvoCube['health'] = {
    mode: 'fixed',
    experiments: Object.fromEntries(defs.map((d) => [d.componentKey, { componentKey: d.componentKey, expected: { a: 0.5, b: 0.5 }, arms: {}, lastEventAt: new Date(now).toISOString(), lastAssignmentAt: new Date(now).toISOString(), eventsByDay: {} }])),
    identity: { visitors: visitors.length, visitorsWithPerson: persons.length, visitorsWithLead: persons.length, leadsSinceStart: leads.length, leadsWithVisitor: leads.length },
    drift: { unregisteredComponents: {}, unknownVariants: {} },
    totals: { events: visitors.length * 3, postStartEvents: visitors.length * 3, legacyEvents: 0 },
  };
  for (const v of visitors) for (const [k, a] of Object.entries(v.assign)) {
    const arms = health.experiments[k].arms;
    arms[a.v] ??= { assigned: 0, excluded: { forced: 0, legacy: 0, dev: 0, bot: 0, test: 0 }, crossover: 0 };
    arms[a.v].assigned++;
    const day = a.day;
    health.experiments[k].eventsByDay[day] = (health.experiments[k].eventsByDay[day] ?? 0) + 1;
  }
  const cube: EvoCube = {
    schemaVersion: 1, generatedAt: new Date(now).toISOString(), nowDay: crDay(now), tz: 'America/Costa_Rica',
    experiments: defs, visitors, persons, drip: [], commits: [{ hash: 'c1', message: 'Synthetic', firstSeenAt: new Date(start).toISOString() }],
    health, legacy: { rows: [] }, warnings: [],
  };
  return { cube, leads };
}
