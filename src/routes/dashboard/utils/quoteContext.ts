/**
 * Builds the plain-text handoff summary that the Quotes tab "Copy full
 * context" button puts on the clipboard.
 *
 * The output pairs the client portal link with everything an operator would
 * otherwise have to retype into WhatsApp or an email: who the client is, where
 * they are moving from and to, what was quoted, and the per-line client
 * pricing. Provider cost and margin are internal, so they are only included
 * when the caller explicitly asks for them.
 *
 * This module is pure and has no Svelte or DOM dependency, so it is unit
 * testable and reusable from any other tab that needs the same summary.
 */

import type { Client, Quote, QuoteLineItem } from '../store.ts';

export interface QuoteContextOptions {
  /** The already-resolved client portal URL (including the quote token). */
  portalUrl: string;
  /**
   * Include provider cost, margin and earnings. Off by default so an operator
   * cannot paste internal economics into a client-facing thread by accident.
   */
  includeInternalPricing?: boolean;
}

// ── Formatting primitives ───────────────────────────────────────────────────

/** A value worth printing: not null, not undefined, not blank, not "Unknown". */
function isPresent(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  const text = String(value).trim();
  return text !== '' && text.toLowerCase() !== 'unknown';
}

export function formatMoney(amount: number, currency = 'USD'): string {
  const rounded = Number.isFinite(amount) ? amount : 0;
  return (
    '$' +
    rounded.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }) +
    ' ' +
    currency
  );
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return String(iso);
  }
}

/** "City, Country" with either half optional. */
function formatPlace(city: string | undefined, country: string | undefined): string {
  return [city, country].filter(isPresent).join(', ');
}

/**
 * What the client is charged for a line.
 *
 * Mirrors the rule documented on `QuoteLineItem`: a flat margin is added in
 * the line's own currency, a percentage margin scales the provider cost.
 * `marginMode` is absent on pre-Phase-3 lines, which is why the default is
 * percentage.
 */
export function clientPriceOf(line: QuoteLineItem): number {
  const amount = Number(line.amount) || 0;
  if (line.marginMode === 'flat') return amount + (Number(line.marginFlat) || 0);
  return amount * (1 + (Number(line.marginPct) || 0) / 100);
}

// ── Section builders ────────────────────────────────────────────────────────

type Line = string;

/** Append "Label: value" only when the value is actually present. */
function pushField(out: Line[], label: string, value: unknown): void {
  if (isPresent(value)) out.push(`${label}: ${String(value).trim()}`);
}

function buildClientSection(client: Client | null): Line[] {
  if (!client) return [];
  const out: Line[] = ['CLIENT'];

  pushField(out, 'Name', client.displayName || client.name);
  pushField(out, 'Email', client.email);
  pushField(out, 'Phone', client.phone);
  pushField(out, 'Stage', client.stage);

  const from = formatPlace(client.originCity, client.originCountry);
  const to = formatPlace(client.destinationCity, client.destinationCountry);
  if (isPresent(from) || isPresent(to)) {
    out.push(`Route: ${from || '—'} → ${to || '—'}`);
  }
  pushField(out, 'Origin ZIP', client.originZip);
  pushField(out, 'Destination ZIP', client.destinationZip);

  pushField(out, 'Move date', client.moveTimeline);
  pushField(out, 'Shipment size', client.size);
  pushField(out, 'Budget', client.budget);
  pushField(out, 'Immigration status', client.immigrationStatus);
  pushField(out, 'Service category', client.serviceCategory);
  pushField(out, 'Property from', client.propertyTypeFrom);
  pushField(out, 'Property to', client.propertyTypeTo);
  pushField(out, 'Insurance value', client.insuranceValue);
  pushField(out, 'Referred by', client.referredBy);

  const vehicles = (client.vehicles ?? [])
    .map((v) => [v.year, v.make, v.model].filter(isPresent).join(' ').trim())
    .filter(isPresent);
  if (vehicles.length) out.push(`Vehicles: ${vehicles.join('; ')}`);

  const highValue = (client.highValueItems ?? [])
    .map((i) => {
      const desc = isPresent(i.description) ? String(i.description).trim() : 'Item';
      return isPresent(i.estimatedValue) ? `${desc} (${String(i.estimatedValue).trim()})` : desc;
    })
    .filter(isPresent);
  if (highValue.length) out.push(`High-value items: ${highValue.join('; ')}`);

  // Only the header was added, so there is nothing worth pasting.
  return out.length > 1 ? out : [];
}

function buildQuoteSection(quote: Quote, includeInternalPricing: boolean): Line[] {
  const currency = quote.currency || 'USD';
  const out: Line[] = ['QUOTE'];

  pushField(out, 'Title', quote.title || 'Untitled');
  pushField(out, 'Status', quote.status);
  pushField(out, 'Service type', quote.serviceType);
  out.push(`Total: ${formatMoney(quote.total ?? 0, currency)}`);

  if (includeInternalPricing) {
    if (typeof quote.costSubtotal === 'number') {
      out.push(`Provider cost: ${formatMoney(quote.costSubtotal, currency)}`);
    }
    if (typeof quote.earnings === 'number') {
      out.push(`IRP earnings: ${formatMoney(quote.earnings, currency)}`);
    }
  }

  const created = formatDate(quote.createdAt);
  if (created) out.push(`Created: ${created}`);
  const sent = formatDate(quote.sentToClientAt);
  if (sent) out.push(`Sent to client: ${sent}`);
  const accepted = formatDate(quote.clientAcceptedAt);
  if (accepted) out.push(`Accepted: ${accepted}`);

  if (isPresent(quote.clientDescription)) {
    out.push('', 'Description:', String(quote.clientDescription).trim());
  }

  return out;
}

function buildLineItemsSection(quote: Quote, includeInternalPricing: boolean): Line[] {
  const items = quote.lineItems ?? [];
  if (!items.length) return [];

  const out: Line[] = ['LINE ITEMS'];
  for (const line of items) {
    const currency = line.currency || quote.currency || 'USD';
    const price = formatMoney(clientPriceOf(line), currency);
    const label = isPresent(line.label) ? String(line.label).trim() : 'Untitled line';
    const optional = line.isOptional ? ' [optional]' : '';

    let row = `- ${label}${optional}: ${price}`;
    if (includeInternalPricing) {
      const margin =
        line.marginMode === 'flat'
          ? `+${formatMoney(Number(line.marginFlat) || 0, currency)}`
          : `+${Number(line.marginPct) || 0}%`;
      row += ` (cost ${formatMoney(Number(line.amount) || 0, currency)}, margin ${margin})`;
    }
    out.push(row);

    if (isPresent(line.notes)) out.push(`  Note: ${String(line.notes).trim()}`);
  }
  return out;
}

function buildProvidersSection(quote: Quote): Line[] {
  const snapshots = quote.providerSnapshots ?? [];
  if (!snapshots.length) return [];

  const out: Line[] = ['PROVIDERS'];
  for (const p of snapshots) {
    const detail = [p.country, p.modality, p.serviceCategory].filter(isPresent).join(' · ');
    out.push(detail ? `- ${p.name} (${detail})` : `- ${p.name}`);
  }
  return out;
}

// ── Public entry point ──────────────────────────────────────────────────────

/**
 * Assemble the full copy payload: portal link first (so a recipient who reads
 * only the first line still gets the actionable part), then the client
 * overview, the quote, its line items and the providers behind it.
 *
 * Empty sections are dropped rather than printed as headers with no body.
 */
export function buildQuoteContext(
  quote: Quote,
  client: Client | null,
  options: QuoteContextOptions,
): string {
  const includeInternalPricing = options.includeInternalPricing === true;

  const sections: Line[][] = [
    ['QUOTE LINK', options.portalUrl],
    buildClientSection(client),
    buildQuoteSection(quote, includeInternalPricing),
    buildLineItemsSection(quote, includeInternalPricing),
    buildProvidersSection(quote),
  ];

  if (isPresent(quote.notes)) {
    sections.push(['INTERNAL NOTES', String(quote.notes).trim()]);
  }

  return sections
    .filter((section) => section.length > 0)
    .map((section) => section.join('\n'))
    .join('\n\n')
    .trim();
}

export default buildQuoteContext;
