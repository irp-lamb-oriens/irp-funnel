/**
 * metrics.ts — the metric table of spec §6.4 as code.
 *
 * Every metric is per unit (visitor or drip assignee) and has a decision lag
 * L: a unit counts — numerator AND denominator — only when its assignment is
 * at least L days old. That removes the bias against recently assigned arms.
 * Conditional metrics (show rate) also declare who is eligible.
 */

import type { LeadFact } from '../../metrics/engine/types.ts';
import { DAY_MS } from './join.ts';
import type { MetricKey, Unit } from './types.ts';

/** Hub's mature win rate window (registry.ts MATURE_DAYS). */
export const MATURE_DAYS = 60;

export interface MetricDef {
  key: MetricKey;
  label: string;
  /** Short business wording, e.g. "clicked the CTA". */
  verb: string;
  kind: 'binomial' | 'mean';
  /** Decision lag in days given the attribution window W. */
  lag: (W: number) => number;
  /** null = not eligible (conditional metrics); number = success (0/1) or value. */
  value: (u: Unit, lead: LeadFact | null, ctx: { W: number; currency: string }) => number | null;
  /** Which surfaces it makes sense for. */
  surfaces: Array<'web' | 'chat' | 'email'>;
  note?: string;
}

const within = (u: Unit, at: number | undefined, days: number) => at !== undefined && at >= u.t - 60_000 && at <= u.t + days * DAY_MS;

function wonAt(l: LeadFact | null): number | null {
  if (!l?.won || l.leadAt === null || l.daysToClose === null) return null;
  const t = Date.parse(l.leadAt);
  return isFinite(t) ? t + l.daysToClose * DAY_MS : null;
}

const STEP_LABELS: Record<string, [string, string]> = {
  cta_click: ['CTA click', 'clicked the CTA'],
  email_submit: ['Left email', 'left their email'],
  first_user_message: ['Chat reply', 'wrote to the chatbot'],
  carrousel_drag: ['Dragged logos', 'dragged the logo carousel'],
  carrousel_arrow_click: ['Used logo arrows', 'used the logo arrows'],
};

export function stepMetric(sub: string): MetricDef {
  const [label, verb] = STEP_LABELS[sub] ?? [sub.replace(/_/g, ' '), `did "${sub.replace(/_/g, ' ')}"`];
  return {
    key: `step:${sub}`,
    label,
    verb: `${verb} within 7 days`,
    kind: 'binomial',
    lag: () => 7,
    value: (u) => (u.drip ? null : within(u, u.steps[sub], 7) ? 1 : 0),
    surfaces: ['web', 'chat'],
  };
}

const BASE: MetricDef[] = [
  {
    key: 'lead',
    label: 'Lead',
    verb: 'became a lead',
    kind: 'binomial',
    lag: (W) => W,
    value: (u) => (u.drip ? null : u.leadId ? 1 : 0),
    surfaces: ['web', 'chat'],
    note: 'On the hero form this is almost the same as "left their email": every email submit creates a lead.',
  },
  {
    key: 'callBooked',
    label: 'Call booked',
    verb: 'booked a call',
    kind: 'binomial',
    lag: (W) => W + 30,
    value: (u, l) => (u.drip ? null : l?.callBooked ? 1 : 0),
    surfaces: ['web', 'chat'],
  },
  {
    key: 'callAttended',
    label: 'Call attended',
    verb: 'attended a call',
    kind: 'binomial',
    lag: (W) => W + 30,
    value: (u, l) => (u.drip ? null : l?.callAttended ? 1 : 0),
    surfaces: ['web', 'chat'],
  },
  {
    key: 'showRate',
    label: 'Show rate',
    verb: 'showed up (among people who booked)',
    kind: 'binomial',
    lag: (W) => W + 30,
    value: (u, l) => (u.drip || !l?.callBooked ? null : l.callAttended ? 1 : 0),
    surfaces: ['web', 'chat'],
    note: 'Among people who booked a call. Descriptive: the variant can change who books.',
  },
  {
    key: 'quoted',
    label: 'Quoted',
    verb: 'received a quote',
    kind: 'binomial',
    lag: (W) => W + 45,
    value: (u, l) => (u.drip ? null : l?.quoteSentMonth ? 1 : 0),
    surfaces: ['web', 'chat'],
  },
  {
    key: 'wonMature',
    label: 'Won (60 d)',
    verb: 'became a client within 60 days of the lead',
    kind: 'binomial',
    lag: (W) => W + MATURE_DAYS,
    value: (u, l) => {
      if (u.drip) {
        // Drip: the won date must fall after the email assignment.
        const w = wonAt(l);
        return w !== null && w >= u.t && l!.daysToClose! <= MATURE_DAYS ? 1 : 0;
      }
      return l?.won && l.daysToClose !== null && l.daysToClose <= MATURE_DAYS ? 1 : 0;
    },
    surfaces: ['web', 'chat', 'email'],
  },
  {
    key: 'paidMature',
    label: 'Paid (60 d)',
    verb: 'paid within 60 days of the lead',
    kind: 'binomial',
    lag: (W) => W + MATURE_DAYS,
    value: (u, l) => (u.drip ? null : l?.paid && l.daysToClose !== null && l.daysToClose <= MATURE_DAYS ? 1 : 0),
    surfaces: ['web', 'chat'],
  },
  {
    key: 'dropped',
    label: 'Dropped',
    verb: 'dropped out as a lead',
    kind: 'binomial',
    lag: (W) => W + 30,
    value: (u, l) => (u.drip ? null : l?.status === 'dropped' ? 1 : 0),
    surfaces: ['web', 'chat'],
  },
  {
    key: 'bookedPerVisitor',
    label: 'Booked / visitor',
    verb: 'booked revenue per visitor',
    kind: 'mean',
    lag: (W) => W + MATURE_DAYS,
    value: (u, l, c) => (u.drip ? null : l?.money?.[c.currency]?.booked ?? 0),
    surfaces: ['web', 'chat'],
    note: 'Only the reporting currency; deals in other currencies are listed in Clients.',
  },
  {
    key: 'dripOpen',
    label: 'Opened',
    verb: 'opened the email (inflated by Apple Mail)',
    kind: 'binomial',
    lag: () => 14,
    value: (u) => (!u.drip || !u.drip.reachedType ? null : u.drip.opened ? 1 : 0),
    surfaces: ['email'],
    note: 'Apple Mail Privacy Protection pre-loads images, so opens are overstated. Never used to decide.',
  },
  {
    key: 'dripClick',
    label: 'Clicked',
    verb: 'clicked a link within 14 days',
    kind: 'binomial',
    lag: () => 14,
    value: (u) => (!u.drip || !u.drip.reachedType ? null : u.drip.clicked && (u.drip.firstClickDays ?? 99) <= 14 ? 1 : 0),
    surfaces: ['email'],
    note: 'Among assignees whose nurture email was scheduled.',
  },
];

export const METRICS: Record<string, MetricDef> = Object.fromEntries(BASE.map((m) => [m.key, m]));

export function metricDef(key: MetricKey | string): MetricDef {
  if (key.startsWith('step:')) return stepMetric(key.slice(5));
  return METRICS[key] ?? stepMetric(key);
}

/** Step subtypes present in the units (for secondary rows). */
export function stepKeysIn(units: Unit[]): MetricKey[] {
  const s = new Set<string>();
  for (const u of units) for (const k of Object.keys(u.steps)) s.add(k);
  return [...s].sort().map((k) => `step:${k}` as MetricKey);
}
