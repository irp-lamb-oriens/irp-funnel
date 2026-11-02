/** What every Sales Book section receives (computed once in SalesBook.svelte). */
import type { SalesReportV2 } from '../../store.ts';
import type { Ctx, Filter, LeadFact } from '../metrics/engine/types.ts';
import type { BookTotals, Deal, OutstandingPartition, Receivable } from '../metrics/engine/sales.ts';
import type { FairCompare } from '../metrics/engine/period.ts';

export interface Book {
  /** Cube rows after the test toggle and the filter chips. */
  rows: LeadFact[];
  /** Cube rows after the test toggle only (forecast curves, filter picker). */
  baseRows: LeadFact[];
  /** v2 deals (every deal, every currency) after the chips. */
  deals: Deal[];
  receivables: Receivable[];
  rowsById: Map<string, LeadFact>;
  recsByDeal: Map<string, Receivable[]>;
  v2: SalesReportV2 | null;
  cubeOk: boolean;
  ctx: Ctx;
  months: string[];
  allTime: boolean;
  rangeLabel: string;
  currency: string;
  nowMonth: string;
  firstMonth: string;
  now: Date;
  compare: FairCompare;
  /** Ctx pair for the Δ (null = no comparison). */
  cmp: { cur: Ctx; prev: Ctx; label: string } | null;
  totals: BookTotals;
  part: OutstandingPartition;
  filters: Filter[];
  filtersActive: boolean;
}

export type Money = (n: number | null | undefined, cur?: string) => string;
