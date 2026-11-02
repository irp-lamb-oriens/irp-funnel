/**
 * types.ts — client mirror of the Evo Lab cube
 * (irp-funnel-server/API/evo/evoCube.ts) plus the engine's own types.
 * Spec: irp-funnel-server/docs/designs/evo-lab.md §6. Keep in sync; the
 * cube carries `schemaVersion` and the Lab refuses a version it doesn't know.
 */

export const EVO_CUBE_SCHEMA_VERSION = 1;

export type MetricKey =
  | `step:${string}`
  | 'lead'
  | 'callBooked'
  | 'callAttended'
  | 'showRate'
  | 'quoted'
  | 'wonMature'
  | 'paidMature'
  | 'dropped'
  | 'bookedPerVisitor'
  | 'dripOpen'
  | 'dripClick';

export interface EvoVariantDef {
  key: string;
  label?: string;
  introducedIn?: string;
  retiredIn?: string | null;
  hypothesis?: string;
}

export interface EvoExperimentDef {
  componentKey: string;
  title: string;
  surface: 'web' | 'chat' | 'email';
  control: string;
  allocation?: Record<string, number>;
  primaryMetric: MetricKey;
  guardrails: MetricKey[];
  appliesTo?: string[];
  status: 'running' | 'paused' | 'ended';
  startedAt: string;
  owner?: string;
  variants: EvoVariantDef[];
}

export type Exclusion = 'forced' | 'legacy' | 'dev' | 'bot' | 'test';

export interface EvoAssign {
  v: string;
  t: number;
  day: string;
  p: number | null;
  source: string;
  commit: string;
  crossover: boolean;
  x: Exclusion[];
}

export interface EvoCtxRow {
  device: string;
  lang: string;
  landingSource: string;
  landingMedium: string;
  referrerHost: string;
  returning: boolean;
}

export interface EvoVisitor {
  vid: number;
  person: number;
  assign: Record<string, EvoAssign>;
  ctx: EvoCtxRow;
  steps: Record<string, number>;
}

export interface EvoPerson {
  leads: Array<{ id: string; at: number; test: boolean }>;
  visitors: number[];
}

export interface DripRow {
  leadId: string;
  subject: string | null;
  body: string | null;
  assignedAt: number;
  day: string;
  p: { subject: number | null; body: number | null };
  reachedType: boolean;
  opened: boolean;
  clicked: boolean;
  firstClickDays: number | null;
  test: boolean;
}

export interface ArmHealth {
  assigned: number;
  excluded: Record<Exclusion, number>;
  crossover: number;
}

export interface ExperimentHealth {
  componentKey: string;
  expected: Record<string, number>;
  arms: Record<string, ArmHealth>;
  lastEventAt: string | null;
  lastAssignmentAt: string | null;
  eventsByDay: Record<string, number>;
}

export interface HealthReport {
  mode: 'fixed' | 'bandit';
  experiments: Record<string, ExperimentHealth>;
  identity: {
    visitors: number;
    visitorsWithPerson: number;
    visitorsWithLead: number;
    leadsSinceStart: number;
    leadsWithVisitor: number;
  };
  drift: { unregisteredComponents: Record<string, number>; unknownVariants: Record<string, number> };
  totals: { events: number; postStartEvents: number; legacyEvents: number };
}

export interface LegacyRow {
  componentKey: string;
  versionKey: string;
  exposures: number;
  interactions: number;
  visitors: number;
  firstAt: string | null;
  lastAt: string | null;
}

export interface EvoCube {
  schemaVersion: number;
  generatedAt: string;
  nowDay: string;
  tz: string;
  experiments: EvoExperimentDef[];
  visitors: EvoVisitor[];
  persons: EvoPerson[];
  drip: DripRow[];
  commits: Array<{ hash: string; message: string; firstSeenAt: string }>;
  health: HealthReport;
  legacy: { rows: LegacyRow[] };
  warnings: string[];
}

// ── engine ───────────────────────────────────────────────────────────────────

/**
 * One analysable unit: a visitor (web/chat experiments) or a drip assignee
 * (email experiments), already joined to its credited lead.
 */
export interface Unit {
  /** Visitor index, or -1 for drip units. */
  vid: number;
  arm: string;
  /** Assignment epoch ms. */
  t: number;
  day: string;
  crossover: boolean;
  x: Exclusion[];
  ctx: EvoCtxRow | null;
  steps: Record<string, number>;
  /** Credited LeadFact id (see join.ts). */
  leadId: string | null;
  leadAt: number | null;
  /** Drip-only facts. */
  drip: { reachedType: boolean; opened: boolean; clicked: boolean; firstClickDays: number | null } | null;
}

export interface JoinOptions {
  /** Attribution window W in days (7 / 14 / 30 / 60). */
  windowDays: number;
  /** Exclusion reasons to DROP (default: all). */
  exclude?: Exclusion[];
  /** Reporting currency for money metrics. */
  currency?: string;
}

/** Two-sided interval. */
export interface Interval { lo: number; hi: number }

export interface ArmMetric {
  arm: string;
  /** Mature, eligible units. */
  n: number;
  /** Successes (binomial) or Σ value (mean). */
  x: number;
  rate: number | null;
  /** Units not yet mature for this metric. */
  maturing: number;
  /** For means: Σ value² (variance) and number of non-zero values. */
  sumSq?: number;
  nonZero?: number;
}

export interface Comparison {
  arm: string;
  diff: number | null;
  ci: Interval | null;
  rel: number | null;
  relCi: Interval | null;
  pBeats: number | null;
  /** Holm-adjusted two-sided p (fixed-horizon; display only). */
  pHolm: number | null;
}

export interface MetricResult {
  key: MetricKey;
  label: string;
  role: 'primary' | 'guardrail' | 'secondary';
  kind: 'binomial' | 'mean';
  arms: ArmMetric[];
  comparisons: Comparison[];
  /** P(best) per arm (binomial only). */
  pBest: Record<string, number> | null;
  /** Expected loss of shipping each arm, absolute rate units. */
  expectedLoss: Record<string, number> | null;
  note?: string;
}
