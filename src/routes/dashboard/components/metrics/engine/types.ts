/**
 * types.ts — client mirror of the server's lead fact cube
 * (irp-funnel-server/API/metrics/metricsCube.ts). Keep in sync; the cube
 * carries `schemaVersion` and the Hub refuses a version it doesn't know.
 */

export const METRICS_CUBE_SCHEMA_VERSION = 1;

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
}
