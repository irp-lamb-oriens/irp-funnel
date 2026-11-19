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
  selectedGroupIds?: string[] | null;
  /** Frozen at acceptance: the services and prices the client signed. */
  contractSnapshot?: { services?: unknown[] | null } | null;
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

// ── Accepted quotes are fixed ──────────────────────────────────────────────
// Mirror of irp-funnel-server API/dashboard/acceptedQuote.ts (keep in step).
// Once the client accepts, the server refuses price/option/status edits, and
// invoices bill the services from the contract snapshot taken at acceptance.

export type AgreedService = { id: string; title: string; description: string | null; price: number; role: string };

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * The services the client signed for, at the prices they signed, or null when
 * the quote is not accepted, has no contract snapshot, or the snapshot does not
 * add up to the agreed total (then the quote's own lines are used).
 */
export function agreedServices(q: QuoteLike | null | undefined): AgreedService[] | null {
  if (!q || !isAcceptedQuote(q)) return null;
  const services = q.contractSnapshot?.services;
  if (!Array.isArray(services) || services.length === 0) return null;
  const valid = services.every(
    (s: any) => s && typeof s.id === 'string' && typeof s.price === 'number' && Number.isFinite(s.price),
  );
  if (!valid) return null;
  const list = services as Array<{ id: string; title?: string; description?: string | null; price: number; role?: string }>;
  const sum = round2(list.reduce((acc, s) => acc + s.price, 0));
  const agreed = quoteValue(q);
  if (agreed != null && Math.abs(sum - agreed) > 0.01) return null;
  return list.map((s) => ({
    id: s.id,
    title: String(s.title || 'Relocation services'),
    description: typeof s.description === 'string' && s.description.trim() ? s.description.trim() : null,
    price: round2(s.price),
    role: String(s.role || 'line'),
  }));
}

/** Titles of the option(s) the client chose on an accepted quote; [] otherwise. */
export function chosenOptions(q: QuoteLike | null | undefined): string[] {
  if (!q || !isAcceptedQuote(q)) return [];
  const agreed = agreedServices(q);
  if (agreed) return agreed.filter((s) => s.role === 'required' || s.role === 'optional').map((s) => s.title);
  const chosen = new Set(Array.isArray(q.selectedGroupIds) ? q.selectedGroupIds : []);
  return groupsOf(q)
    .filter((g) => g.role !== 'fixed' && chosen.has(String(g.groupId ?? '')))
    .map((g) => String(g.title ?? '').trim() || 'Option');
}
