import { describe, it, expect, beforeEach } from 'vitest';
import { touchFromUrl, captureAttribution, getAttribution, getReferTag } from './attribution.ts';
import {
  aggregateFunnel,
  buildTaggedUrl,
  UNTAGGED,
} from '../routes/dashboard/components/metrics/attributionAggregate.ts';
import type { AttributionLead } from '../routes/dashboard/store.ts';

const SITE = 'https://www.internationalrelocationpartner.com';

describe('touchFromUrl', () => {
  it('reads all five UTM params, lower-cased', () => {
    const t = touchFromUrl(
      `${SITE}/?utm_source=LinkedIn&utm_medium=organic_social&utm_campaign=lanzamiento_ebook_2026&utm_content=boton_azul&utm_term=x`,
    )!;
    expect([t.source, t.medium, t.campaign, t.content, t.term]).toEqual([
      'linkedin', 'organic_social', 'lanzamiento_ebook_2026', 'boton_azul', 'x',
    ]);
    expect(t.inferred).toBe(false);
    expect(t.landingPage).toBe('/');
  });

  it('keeps the legacy ?refer= tag', () => {
    const t = touchFromUrl(`${SITE}/?refer=unmensajeparadiferenciaralanuncio`)!;
    expect(t.refer).toBe('unmensajeparadiferenciaralanuncio');
    expect(t.source).toBe('refer');
  });

  it('ignores our own ?refer=thankyou redirect', () => {
    expect(touchFromUrl(`${SITE}/?refer=thankyou`)).toBeNull();
  });

  it('infers the platform from click ids', () => {
    expect(touchFromUrl(`${SITE}/?fbclid=abc`)!.source).toBe('facebook');
    expect(touchFromUrl(`${SITE}/?gclid=abc`)!.medium).toBe('cpc');
  });

  it('infers organic from an external referrer, nothing for direct', () => {
    const t = touchFromUrl(`${SITE}/costa-rica`, 'https://www.google.com/')!;
    expect([t.source, t.medium, t.inferred]).toEqual(['google', 'organic', true]);
    expect(touchFromUrl(`${SITE}/`, '')).toBeNull();
    expect(touchFromUrl(`${SITE}/`, `${SITE}/about`)).toBeNull();
  });
});

describe('captureAttribution (persisted)', () => {
  beforeEach(() => localStorage.clear());

  it('keeps first touch, moves last touch, de-dupes reloads', () => {
    captureAttribution(`${SITE}/?utm_source=instagram&utm_medium=paid_social&utm_campaign=ad1`, '');
    expect(captureAttribution(`${SITE}/?utm_source=instagram&utm_medium=paid_social&utm_campaign=ad1`, '')).toBeNull();
    captureAttribution(`${SITE}/?utm_source=instagram&utm_medium=paid_social&utm_campaign=retargeting`, '');
    const env = getAttribution();
    expect(env.firstTouch?.campaign).toBe('ad1');
    expect(env.lastTouch?.campaign).toBe('retargeting');
    expect(env.touches).toHaveLength(2);
    expect(env.visitorId).toBeTruthy();
  });

  it('remembers the refer tag for later pages', () => {
    captureAttribution(`${SITE}/costa-rica?refer=yt_video_3`, '');
    expect(getReferTag()).toBe('yt_video_3');
  });
});

describe('aggregateFunnel', () => {
  const lead = (id: string, over: Partial<AttributionLead>): AttributionLead => ({
    id, name: id, at: '2026-10-10T00:00:00Z', first: null, last: null, self: '',
    touches: 0, devices: 0, booked: false, attended: false, noShow: false, paid: false,
    revenue: 0, currency: 'USD', ...over,
  });
  const ig = { s: 'instagram', m: 'paid_social', c: 'cold', t: '', ct: '', r: '' };
  const rt = { s: 'instagram', m: 'paid_social', c: 'retargeting', t: '', ct: '', r: '' };
  const leads = [
    lead('a', { first: ig, last: rt, touches: 2, booked: true, attended: true, paid: true, revenue: 5000 }),
    lead('b', { first: rt, last: rt, booked: true }),
    lead('c', {}),
  ];

  it('credits revenue to the first-touch campaign', () => {
    const { rows, totals } = aggregateFunnel(leads, [], 'first', 'campaign');
    expect(rows[0]).toMatchObject({ key: 'cold', revenue: 5000, paid: 1 });
    expect(rows[rows.length - 1].key).toBe(UNTAGGED);
    expect(totals).toMatchObject({ leads: 3, tagged: 2, untagged: 1, multiTouch: 1 });
  });

  it('moves the credit under last touch', () => {
    const { rows } = aggregateFunnel(leads, [], 'last', 'campaign');
    expect(rows[0]).toMatchObject({ key: 'retargeting', revenue: 5000, leads: 2 });
  });

  it('filters by date range and counts visits per day', () => {
    const visits = [{ key: 'h', touch: rt, total: 10, daily: { '2026-10-09': 4, '2025-01-01': 6 } }];
    const start = Date.parse('2026-10-01');
    const { totals } = aggregateFunnel(leads, visits, 'last', 'campaign', start, Infinity);
    expect(totals.visits).toBe(4);
    expect(aggregateFunnel(leads, [], 'first', 'campaign', Date.parse('2027-01-01')).totals.leads).toBe(0);
  });
});

describe('buildTaggedUrl', () => {
  it('slugs values and keeps the page path', () => {
    expect(
      buildTaggedUrl(`${SITE}/costa-rica`, { source: 'Instagram', medium: 'paid social', campaign: 'Lanzamiento Ébook 2026', content: '' }),
    ).toBe(`${SITE}/costa-rica?utm_source=instagram&utm_medium=paid_social&utm_campaign=lanzamiento_ebook_2026`);
  });
});
