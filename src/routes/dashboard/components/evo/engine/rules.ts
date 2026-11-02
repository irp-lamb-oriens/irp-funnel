/**
 * rules.ts — recommendation states (spec §6.6).
 *
 * The state machine works on plain counts so the goal-5 calibration
 * simulation (simulate.test.ts) exercises exactly the function the page uses.
 * States are computed at the weekly decision point (Monday 06:00 Costa Rica)
 * on the full post-start population — never on a filtered subset.
 */

import { posteriorSummary, probWorseBy, normCdf, type ArmCounts, type PosteriorSummary } from './stats.ts';


/**
 * Tuned by the goal-5 grid search (simulate.test.ts, 2,000 seeded runs per
 * case, weekly looks over 120 days at 1,000 people / month): A/A false ships
 * ≤ 5 %, a +25 % lift on a 15 % click rate ships within 120 days ≥ 70 %.
 * T_ship 0.99 (not 0.95) is what weekly looking costs. See spec §6.6.
 */
export const RULES = {
  T_ship: 0.99,
  E_ship: 0.05,
  minDays: 14,
  minConversions: 30,
  guardrailMargin: 0.2,
  guardrailP: 0.9,
  guardrailMinEvents: 10,
  leaningP: 0.8,
  noDiffLift: 0.1,
  noDiffP: 0.05,
  srmAlpha: 0.001,
} as const;

export type RuleSet = { [K in keyof typeof RULES]: number };

export type State =
  | 'data_problem'
  | 'guardrail_hold'
  | 'too_early'
  | 'keep_control'
  | 'ready'
  | 'no_difference'
  | 'leaning'
  | 'collecting';

export const STATE_LABEL: Record<State, string> = {
  data_problem: 'Data problem',
  guardrail_hold: 'Guardrail hold',
  too_early: 'Too early',
  keep_control: 'Keep control',
  ready: 'Ready to ship',
  no_difference: 'No meaningful difference',
  leaning: 'Leaning',
  collecting: 'Collecting data',
};

/** States that end the experiment's question (a decision is waiting). */
export const DECISION_STATES = new Set<State>(['ready', 'keep_control', 'no_difference', 'guardrail_hold', 'data_problem']);

export interface GuardrailInput {
  key: string;
  label: string;
  arms: ArmCounts[];
}

export interface RuleInput {
  control: string;
  /** Mature primary counts per arm (control included). */
  arms: ArmCounts[];
  guardrails: GuardrailInput[];
  runDays: number;
  /** SRM p-value (pre-exclusion), null when not computable. */
  srmP: number | null;
  /** Exclusion-by-arm imbalance p-value. */
  imbalanceP: number | null;
  /** Running experiment with no assignment in 7 days. */
  stalled: boolean;
  /** Live experiments (SRM Bonferroni). */
  live: number;
}

export interface RuleResult {
  state: State;
  /** Arm with the highest P(best). */
  leader: string | null;
  /** Plain-English reason for the state (one sentence). */
  reason: string;
  /** Guardrails that could not be checked (shown on ship cards). */
  unevaluable: string[];
  /** Guardrail that triggered a hold. */
  heldBy: string | null;
  /** Posterior summary when the floors were passed (null before). */
  post: PosteriorSummary | null;
  /** Conversions still needed to pass the floor (control / leader). */
  needed: Record<string, number>;
}

/** P(arm beats control by ≥ lift, relative), normal approximation of Beta posteriors. */
export function probBeatsBy(arm: ArmCounts, control: ArmCounts, lift: number): number {
  const m = (a: ArmCounts) => (1 + a.x) / (2 + a.n);
  const v = (a: ArmCounts) => {
    const al = 1 + a.x, be = 1 + a.n - a.x;
    return (al * be) / ((al + be) ** 2 * (al + be + 1));
  };
  const mean = m(arm) - (1 + lift) * m(control);
  const sd = Math.sqrt(v(arm) + (1 + lift) ** 2 * v(control));
  return sd > 0 ? normCdf(mean / sd) : mean > 0 ? 1 : 0;
}

export function evaluate(input: RuleInput, R: RuleSet = RULES): RuleResult {
  const ctrl = input.arms.find((a) => a.arm === input.control) ?? input.arms[0];
  // Leader by posterior mean first (cheap); the full posterior is computed only
  // once the floors are passed, which keeps the forecast's thousands of
  // evaluations fast.
  let leader: string | null = null;
  let bestMean = -1;
  for (const a of input.arms) {
    const m = (a.x + 1) / (a.n + 2);
    if (m > bestMean) { bestMean = m; leader = a.arm; }
  }
  let lead = input.arms.find((a) => a.arm === leader) ?? ctrl;
  const base: Omit<RuleResult, 'state' | 'reason'> = { leader, unevaluable: [], heldBy: null, post: null, needed: {} };

  // 1. Data problem.
  const srmCut = R.srmAlpha / Math.max(1, input.live);
  if (input.srmP !== null && input.srmP < srmCut) {
    return { ...base, state: 'data_problem', reason: 'Visitors are not split the way the experiment says (sample ratio mismatch). Fix tracking before reading results.' };
  }
  if (input.imbalanceP !== null && input.imbalanceP < srmCut) {
    return { ...base, state: 'data_problem', reason: 'Excluded traffic (bots, tests, dev) differs between arms, which can bias the comparison.' };
  }
  if (input.stalled) {
    return { ...base, state: 'data_problem', reason: 'The experiment is running but no one has been assigned in 7 days. Tracking may be broken.' };
  }

  // 2. Guardrail hold (evaluated before the floors: a clear harm should not wait).
  const unevaluable: string[] = [];
  if (leader && leader !== input.control) {
    for (const g of input.guardrails) {
      const ga = g.arms.find((a) => a.arm === leader);
      const gc = g.arms.find((a) => a.arm === input.control);
      if (!ga || !gc || ga.x < R.guardrailMinEvents || gc.x < R.guardrailMinEvents) {
        unevaluable.push(g.label);
        continue;
      }
      if (probWorseBy(ga, gc, R.guardrailMargin) >= R.guardrailP) {
        return {
          ...base,
          unevaluable,
          heldBy: g.label,
          state: 'guardrail_hold',
          reason: `The leading variant looks worse on ${g.label.toLowerCase()} (by more than ${Math.round(R.guardrailMargin * 100)} %), so it should not ship as is.`,
        };
      }
    }
  }
  base.unevaluable = unevaluable;

  // 3. Too early.
  const needed: Record<string, number> = {};
  for (const a of [ctrl, lead]) if (a && a.x < R.minConversions) needed[a.arm] = R.minConversions - a.x;
  base.needed = needed;
  if (input.runDays < R.minDays || Object.keys(needed).length) {
    const why = input.runDays < R.minDays
      ? `It has run ${Math.floor(input.runDays)} of the minimum ${R.minDays} days.`
      : `Each compared arm needs ${R.minConversions} conversions before results mean anything.`;
    return { ...base, state: 'too_early', reason: why };
  }

  // 4. Keep control / ready to ship.
  const post = posteriorSummary(input.arms, input.control);
  base.post = post;
  let best = -1;
  for (const a of input.arms) if ((post.pBest[a.arm] ?? 0) > best) { best = post.pBest[a.arm] ?? 0; leader = a.arm; }
  base.leader = leader;
  lead = input.arms.find((a) => a.arm === leader) ?? ctrl;
  if (leader === input.control && (post.pBest[leader] ?? 0) >= R.T_ship) {
    return { ...base, state: 'keep_control', reason: 'The current version (control) is very likely the best. Keep it and retire the alternative.' };
  }
  if (leader && leader !== input.control) {
    const pb = post.pBest[leader] ?? 0;
    const pc = post.pBeats[leader] ?? 0;
    const loss = post.expectedLoss[leader] ?? 1;
    const ctrlRate = (ctrl.x + 1) / (ctrl.n + 2);
    if (pb >= R.T_ship && pc >= R.T_ship && loss < R.E_ship * ctrlRate) {
      return { ...base, state: 'ready', reason: 'This variant is very likely better than the current version and the risk of being wrong is small.' };
    }
  }

  // 5. No meaningful difference (in either direction).
  const others = input.arms.filter((a) => a.arm !== input.control);
  const pUp = Math.max(0, ...others.map((a) => probBeatsBy(a, ctrl, R.noDiffLift)));
  const pDown = Math.max(0, ...others.map((a) => probBeatsBy(ctrl, a, R.noDiffLift)));
  if (others.length && pUp < R.noDiffP && pDown < R.noDiffP) {
    return { ...base, state: 'no_difference', reason: `No variant is likely to differ by ${Math.round(R.noDiffLift * 100)} % or more. Pick on cost or brand.` };
  }

  // 6. Leaning / collecting.
  if (best >= R.leaningP) {
    return { ...base, state: 'leaning', reason: 'One variant is ahead, but not by enough yet. Keep running.' };
  }
  return { ...base, state: 'collecting', reason: 'No clear leader yet. Keep running.' };
}

/** Latest Monday 06:00 Costa Rica (= Monday 12:00 UTC) at or before `now`. */
export function decisionPoint(now: number): number {
  const d = new Date(now);
  const day = d.getUTCDay(); // 0 Sun … 1 Mon
  const back = (day + 6) % 7; // days since Monday
  const monday = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - back, 12, 0, 0);
  return monday <= now ? monday : monday - 7 * 86400_000;
}
