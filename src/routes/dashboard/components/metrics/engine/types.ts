/**
 * types.ts — client mirror of the server's lead fact cube
 * (irp-funnel-server/API/metrics/metricsCube.ts). Keep in sync; the cube
 * carries `schemaVersion` and the Hub refuses a version it doesn't know.
 */

export const METRICS_CUBE_SCHEMA_VERSION = 1;
/** Fields are added without a version bump, so accept this version or newer. */
export function cubeSchemaOk(v: unknown): boolean {
  return typeof v === 'number' && v >= METRICS_CUBE_SCHEMA_VERSION;
}

export interface LedgerCell { booked: number; margin: number; invoiced: number; cash: number }
export interface Receivable { d0_30: number; d31_60: number; d61_90: number; d90p: number }
export interface CubeMoney extends LedgerCell { byMonth: Record<string, LedgerCell> }

export interface LeadFact {
  id: string;
  name: string;
  isLead: boolean;
  likelyTest: boolean;
  leadAt: string | null;
  leadMonth: string | null;
  leadAgeDays: number | null;
  leadWeekday: string | null;
  quoteSentMonth: string | null;
  quoteSentMonths: Record<string, number>;
  won: boolean;
  wonMonth: string | null;
  paid: boolean;
  paidMonth: string | null;
  dropKind: string | null;
  dropMonth: string | null;
  reach: Record<string, string>;
  stage: string | null;
  stageLabel: string | null;
  status: string;
  dealCurrency: string | null;
  money: Record<string, CubeMoney>;
  receivable: Record<string, Receivable>;
  costKnown: boolean;
  openQuote: { total: number; cur: string; sentMonth: string | null; ageDays: number | null } | null;
  daysToClose: number | null;
  quoteTurnaroundDays: number | null;
  decisionDays: number | null;
  acceptToPaidDays: number | null;
  daysSinceActivity: number | null;
  quotes: number;
  channel: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  heardFrom: string;
  origin: string;
  destination: string;
  route: string;
  budget: string;
  size: string;
  propertyFrom: string;
  propertyTo: string;
  immigration: string;
  hasVehicles: string;
  service: string;
  providers: string[];
  callBooked: boolean;
  callAttended: boolean;
  noShow: boolean;
  callOutcome: string;
  multiTouch: boolean;
  // ── sales-book-v3 §4.2 — optional: an older server leaves them out ──
  acceptedAt?: string | null;
  firstQuoteAt?: string | null;
  paidAt?: string | null;
  invoicedAt?: string | null;
  clientKey?: string | null;
  payments?: Array<{ at: string | null; amount: number; cur: string; method: string }>;
  bookedAt?: Array<{ at: string | null; amount: number; margin: number; cur: string }>;
  invoicedAtList?: Array<{ at: string | null; amount: number; cur: string }>;
}

export interface MetricsCube {
  schemaVersion: number;
  generatedAt: string;
  sourcesLoadedAt?: string;
  nowMonth: string;
  tz: string;
  currencies: string[];
  funnelStages: Array<{ stage: string; label: string }>;
  rows: LeadFact[];
  warnings: string[];
}

/** A filter chip: rows whose dimension value is in `values`. */
export interface Filter { dim: string; values: string[]; exclude?: boolean }

export interface Ctx {
  /** Month keys in the period, ascending. Empty set + allTime = everything. */
  months: string[];
  allTime: boolean;
  currency: string;
  nowMonth: string;
  /**
   * Day-level window (Costa Rica calendar dates, inclusive), used only for a
   * fair comparison of a partial month (sales-book-v3 §5.3). When set, period
   * measures that are `dayComparable` count events by their ISO date instead
   * of their month; the others return null.
   */
  dayCut?: { from: string; to: string } | null;
}
