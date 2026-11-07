/**
 * quoteValue.ts — what a quote is actually worth (frontend copy of
 * irp-funnel-server API/dashboard/quoteValue.ts; keep the two in step).
 *
 * A quote can offer choices: several `required` line groups are packages the
 * client picks ONE of, `optional` groups are add-ons, `fixed` groups are always
 * billed. Its stored `total` adds every option together, so it is a list
 * figure, not a price:
 *   • accepted quote          → the amount the client agreed to (`finalBilledTotal`)
 *   • open quote with choices → no single value; described as "N options"
 *   • any other quote         → `total`, unchanged
 */

type GroupLike = { groupId?: string; role?: string | null; title?: string | null; lineItems?: unknown[] | null };
type QuoteLike = {
  status?: string | null;
  clientAcceptedAt?: string | null;
  total?: number | null;
  finalBilledTotal?: number | null;
  lineGroups?: GroupLike[] | null;
  /** Set by the finance/sales endpoints, which already resolved the value. */
  optionCount?: number | null;
};

const WON_STATUS = 'client_accepted';

const num = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? v : null;

function groupsOf(q: QuoteLike | null | undefined): GroupLike[] {
  return Array.isArray(q?.lineGroups) ? q!.lineGroups!.filter((g) => g && typeof g === 'object') : [];
}

export function isAcceptedQuote(q: QuoteLike | null | undefined): boolean {
  return q?.status === WON_STATUS || !!q?.clientAcceptedAt;
}

/** Choices offered: packages (when more than one) + add-ons. 0 for a plain quote. */
export function optionCount(q: QuoteLike | null | undefined): number {
  const groups = groupsOf(q);
  if (!groups.length) return Math.max(0, num(q?.optionCount) ?? 0);
  const packages = groups.filter((g) => g.role !== 'optional' && g.role !== 'fixed').length;
  const addOns = groups.filter((g) => g.role === 'optional').length;
  return (packages > 1 ? packages : 0) + addOns;
}

/** "3 options" / "1 option", or '' when the quote offers no choice. */
export function optionsLabel(n: number): string {
  return n > 0 ? `${n} option${n === 1 ? '' : 's'}` : '';
}

/**
 * The single amount a quote is worth, or null while an open quote still offers
 * options (show {@link optionsLabel} instead).
 */
export function quoteValue(q: QuoteLike | null | undefined): number | null {
  if (!q) return null;
  if (isAcceptedQuote(q)) return num(q.finalBilledTotal) ?? num(q.total);
  if (optionCount(q) > 0) return null;
  return num(q.total);
}
