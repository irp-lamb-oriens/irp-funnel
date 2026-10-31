/**
 * attributionAggregate.ts — client-side aggregation for the Attribution
 * metrics module. Pure (no Svelte), so it is unit-tested directly.
 *
 * Input: the per-lead rows from `metrics.attribution` (server builds them in
 * irp-funnel-server/API/metrics/attributionMetrics.ts).
 */

import type { AttributionLead, AttributionTouch, AttributionVisit } from '../../store.ts';

export type AttributionModel = 'first' | 'last';
export type AttributionDimension =
  | 'source'
  | 'medium'
  | 'source_medium'
  | 'campaign'
  | 'content'
  | 'term'
  | 'refer'
  | 'self';

export const DIMENSIONS: Array<{ key: AttributionDimension; label: string }> = [
  { key: 'source', label: 'Source' },
  { key: 'source_medium', label: 'Source / Medium' },
  { key: 'medium', label: 'Medium' },
  { key: 'campaign', label: 'Campaign' },
  { key: 'content', label: 'Content (ad)' },
  { key: 'term', label: 'Term' },
  { key: 'refer', label: 'Refer tag' },
  { key: 'self', label: 'Self-reported' },
];

/** The bucket for leads that arrived with no tag at all ("de ningún lado"). */
export const UNTAGGED = '(no tag)';
/** The bucket for tagged leads missing this particular dimension. */
export const NOT_SET = '(not set)';

export interface FunnelRow {
  key: string;
  visits: number;
  leads: number;
  booked: number;
  attended: number;
  noShow: number;
  paid: number;
  revenue: number;
  leadIds: string[];
}

export interface FunnelTotals {
  leads: number;
  tagged: number;
  untagged: number;
  booked: number;
  attended: number;
  paid: number;
  revenue: number;
  multiTouch: number;
  multiDevice: number;
  visits: number;
}

export function touchValue(t: AttributionTouch | null, dim: AttributionDimension): string {
  if (!t) return UNTAGGED;
  switch (dim) {
    case 'source': return t.s || NOT_SET;
    case 'medium': return t.m || NOT_SET;
    case 'source_medium': return `${t.s || NOT_SET} / ${t.m || NOT_SET}`;
    case 'campaign': return t.c || NOT_SET;
    case 'content': return t.ct || NOT_SET;
    case 'term': return t.t || NOT_SET;
    case 'refer': return t.r || NOT_SET;
    default: return NOT_SET;
  }
}

export function leadKey(lead: AttributionLead, model: AttributionModel, dim: AttributionDimension): string {
  if (dim === 'self') return lead.self || NOT_SET;
  const touch = model === 'first' ? lead.first : lead.last;
  // Legacy leads tagged only via the self-reported "refer" still count under Refer tag.
  if (dim === 'refer' && !touch && lead.self) return lead.self;
  return touchValue(touch, dim);
}

export function inRange(iso: string, start: number, end: number): boolean {
  if (!iso) return !Number.isFinite(start) && !Number.isFinite(end);
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return false;
  return t >= start && t <= end;
}

function visitsInRange(v: AttributionVisit, start: number, end: number): number {
  if (!Number.isFinite(start) && !Number.isFinite(end)) return v.total;
  let n = 0;
  for (const [day, count] of Object.entries(v.daily)) {
    const t = Date.parse(day + 'T12:00:00Z');
    if (t >= start && t <= end) n += count;
  }
  return n;
}

export function aggregateFunnel(
  leads: AttributionLead[],
  visits: AttributionVisit[],
  model: AttributionModel,
  dim: AttributionDimension,
  start = -Infinity,
  end = Infinity,
): { rows: FunnelRow[]; totals: FunnelTotals } {
  const rows = new Map<string, FunnelRow>();
  const row = (key: string): FunnelRow => {
    let r = rows.get(key);
    if (!r) {
      r = { key, visits: 0, leads: 0, booked: 0, attended: 0, noShow: 0, paid: 0, revenue: 0, leadIds: [] };
      rows.set(key, r);
    }
    return r;
  };

  const totals: FunnelTotals = {
    leads: 0, tagged: 0, untagged: 0, booked: 0, attended: 0, paid: 0, revenue: 0,
    multiTouch: 0, multiDevice: 0, visits: 0,
  };

  for (const lead of leads) {
    if (!inRange(lead.at, start, end)) continue;
    const r = row(leadKey(lead, model, dim));
    r.leads++;
    r.leadIds.push(lead.id);
    if (lead.booked) r.booked++;
    if (lead.attended) r.attended++;
    if (lead.noShow) r.noShow++;
    if (lead.paid) r.paid++;
    r.revenue += lead.revenue || 0;

    totals.leads++;
    if (lead.first || lead.last) totals.tagged++; else totals.untagged++;
    if (lead.booked) totals.booked++;
    if (lead.attended) totals.attended++;
    if (lead.paid) totals.paid++;
    totals.revenue += lead.revenue || 0;
    if (lead.touches >= 2) totals.multiTouch++;
    if (lead.devices >= 2) totals.multiDevice++;
  }

  // Visits only exist for tagged links; self-reported has no visit concept.
  if (dim !== 'self') {
    for (const v of visits) {
      const n = visitsInRange(v, start, end);
      if (!n) continue;
      row(touchValue(v.touch, dim)).visits += n;
      totals.visits += n;
    }
  }

  const sorted = [...rows.values()].sort(
    (a, b) =>
      // "(no tag)" always sits last — it's the reference, not a channel.
      Number(a.key === UNTAGGED) - Number(b.key === UNTAGGED) ||
      b.revenue - a.revenue ||
      b.paid - a.paid ||
      b.leads - a.leads ||
      b.visits - a.visits ||
      a.key.localeCompare(b.key),
  );
  for (const r of sorted) r.revenue = Math.round(r.revenue * 100) / 100;
  totals.revenue = Math.round(totals.revenue * 100) / 100;
  return { rows: sorted, totals };
}

export function pct(n: number, d: number): string {
  if (!d) return '—';
  return `${((n / d) * 100).toFixed(n / d < 0.1 ? 1 : 0)}%`;
}

/** UTM values: lower-case, spaces → underscores, strip everything else odd. */
export function slugUtm(v: string): string {
  return v
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_\-.]/g, '');
}

export function buildTaggedUrl(
  base: string,
  p: { source: string; medium: string; campaign: string; content?: string; term?: string },
): string {
  let url: URL;
  try {
    url = new URL(base.trim() || 'https://www.internationalrelocationpartner.com/');
  } catch {
    return '';
  }
  const pairs: Array<[string, string | undefined]> = [
    ['utm_source', p.source],
    ['utm_medium', p.medium],
    ['utm_campaign', p.campaign],
    ['utm_content', p.content],
    ['utm_term', p.term],
  ];
  for (const [k, v] of pairs) {
    const val = slugUtm(v || '');
    if (val) url.searchParams.set(k, val);
    else url.searchParams.delete(k);
  }
  return url.toString();
}
