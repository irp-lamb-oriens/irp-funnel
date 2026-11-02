/**
 * synthetic.ts — deterministic fake lead facts for tests, the benchmark and
 * local visual checks. NOT imported by the app. Planted effects (so tests can
 * assert the finder finds them and nothing else):
 *   - destination PA wins ~3× the base rate
 *   - channel WhatsApp wins ~0.3× the base rate
 *   - budget "$20k+" books ~2.5× larger deals (same win rate)
 * Everything else is noise.
 */
import type { CubeMoney, LeadFact, MetricsCube } from './types.ts';
import { shiftMonth } from './period.ts';

/** mulberry32 — small, well-mixed PRNG (an LCG leaks correlations between consecutive picks). */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = <T>(r: () => number, xs: readonly T[]): T => xs[Math.floor(r() * xs.length)];

const STAGES = ['sales_opt_in_email', 'sales_preconsultation', 'sales_post_transcript', 'sales_pricing_quote', 'sales_quoted', 'sales_quote_acceptance', 'sales_initial_payment'];

export function syntheticRows(n = 1000, nowMonth = '2026-11', seed = 7): LeadFact[] {
  const r = rng(seed);
  const rows: LeadFact[] = [];
  for (let i = 0; i < n; i++) {
    const ageDays = Math.floor(r() * 540);
    const monthsBack = Math.floor(ageDays / 30.4);
    const leadMonth = shiftMonth(nowMonth, -monthsBack);
    const channel = pick(r, ['Chatbot', 'Form', 'Form', 'WhatsApp', 'Manual', 'Unknown'] as const);
    const origin = pick(r, ['US', 'US', 'US', 'CA', 'CR', 'MX'] as const);
    const destination = pick(r, ['CR', 'CR', 'CR', 'PA', 'US', 'MX'] as const);
    const budget = pick(r, ['< $6k', '$6–10k', '$10–20k', '$20k+', 'Unknown'] as const);
    let p = 0.18;
    if (destination === 'PA') p *= 3;
    if (channel === 'WhatsApp') p *= 0.3;
    const quoted = r() < Math.min(0.95, p * 2.6);
    const won = quoted && r() < Math.min(0.95, p / Math.min(0.95, p * 2.6));
    const daysToClose = won ? Math.round(5 + r() * 50) : null;
    const realWon = won && daysToClose !== null && daysToClose <= ageDays;
    const size = (budget === '$20k+' ? 2.5 : 1) * (3000 + r() * 9000);
    const booked = realWon ? Math.round(size) : 0;
    const wonMonth = realWon ? shiftMonth(leadMonth, Math.min(monthsBack, Math.floor((daysToClose ?? 0) / 30))) : null;
    const paid = realWon && r() < 0.8;
    const cash = paid ? Math.round(booked * (0.3 + r() * 0.7)) : 0;
    const status = realWon ? (paid ? (cash >= booked ? 'paid' : 'partially_paid') : 'accepted') : quoted ? 'quoted' : r() < 0.2 ? 'dropped' : 'lead';
    const reachDepth = realWon ? (paid ? 7 : 6) : quoted ? 5 : 1 + Math.floor(r() * 3);
    const reach: Record<string, string> = {};
    STAGES.slice(0, reachDepth).forEach((s) => (reach[s] = leadMonth));
    const qTurn = quoted ? Math.round(1 + r() * 10) : null;
    const money: Record<string, CubeMoney> = booked ? { USD: { booked, margin: Math.round(booked * 0.25), invoiced: cash ? booked : 0, cash, byMonth: { [wonMonth!]: { booked, margin: Math.round(booked * 0.25), invoiced: cash ? booked : 0, cash } } } } : {};
    rows.push({
      id: `L${i}`, name: `Lead ${i}`, isLead: true, likelyTest: i % 97 === 0,
      leadAt: `${leadMonth}-15T15:00:00.000Z`, leadMonth, leadAgeDays: ageDays, leadWeekday: pick(r, ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']),
      quoteSentMonth: quoted ? leadMonth : null, quoteSentMonths: quoted ? { [leadMonth]: 1 } : {},
      won: realWon, wonMonth, paid, paidMonth: paid ? wonMonth : null,
      dropKind: status === 'dropped' ? pick(r, ['noShow', 'nonQualified', 'saleDropped']) : null, dropMonth: null,
      reach, stage: STAGES[reachDepth - 1], stageLabel: STAGES[reachDepth - 1], status,
      dealCurrency: booked ? 'USD' : null, money, receivable: booked && cash < booked && paid ? { USD: { d0_30: booked - cash, d31_60: 0, d61_90: 0, d90p: 0 } } : {},
      costKnown: !!booked,
      openQuote: status === 'quoted' ? { total: Math.round(3000 + r() * 9000), cur: 'USD', sentMonth: leadMonth, ageDays: Math.max(0, ageDays - (qTurn ?? 0)) } : null,
      daysToClose: realWon ? daysToClose : null, quoteTurnaroundDays: qTurn, decisionDays: realWon && qTurn !== null ? Math.max(0, (daysToClose ?? 0) - qTurn) : null,
      acceptToPaidDays: paid ? Math.round(r() * 20) : null, daysSinceActivity: Math.round(r() * 40), quotes: quoted ? 1 : 0,
      channel, utmSource: channel === 'Chatbot' ? pick(r, ['google', 'facebook', '(none)']) : '(none)', utmMedium: '(none)', utmCampaign: '(none)',
      heardFrom: pick(r, ['Facebook', 'Google', 'YouTube', 'Referral', '(none)']),
      origin, destination, route: `${origin} → ${destination}`, budget, size: pick(r, ['LCL (part container)', '20ft', '40ft', '40ft HC', 'Unknown']),
      propertyFrom: pick(r, ['House', 'Apartment', 'Condo', 'Storage']), propertyTo: pick(r, ['House', 'Apartment', 'Condo']),
      immigration: pick(r, ['Residency', 'Visa', 'Citizen', 'Other']), hasVehicles: r() < 0.3 ? 'Yes' : 'No',
      service: quoted ? pick(r, ['full_move', 'shipping_only', 'door_to_port']) : '(none)', providers: realWon ? [pick(r, ['Shipper A', 'Shipper B'])] : [],
      callBooked: r() < 0.7, callAttended: false, noShow: false, callOutcome: '(none)', multiTouch: r() < 0.2,
    });
    const last = rows[rows.length - 1];
    // ISO-dated facts (sales-book-v3 §4.2), consistent with the month keys and
    // using no extra random draws so the planted effects above are unchanged.
    const day = String((i % 28) + 1).padStart(2, '0');
    const at = (m: string | null) => (m ? `${m}-${day}T18:00:00.000Z` : null);
    last.acceptedAt = at(wonMonth);
    last.paidAt = paid ? at(wonMonth) : null;
    last.firstQuoteAt = quoted ? at(leadMonth) : null;
    last.invoicedAt = cash ? at(wonMonth) : null;
    last.leadAt = at(leadMonth);
    last.clientKey = `email:lead${i % 950}@example.org`;
    last.payments = cash ? [{ at: at(wonMonth), amount: cash, cur: 'USD', method: 'wire transfer' }] : [];
    last.bookedAt = booked ? [{ at: at(wonMonth), amount: booked, margin: Math.round(booked * 0.25), cur: 'USD' }] : [];
    last.invoicedAtList = cash ? [{ at: at(wonMonth), amount: booked, cur: 'USD' }] : [];
    last.callAttended = last.callBooked && r() < 0.75;
    last.noShow = last.callBooked && !last.callAttended;
  }
  return rows;
}

export function syntheticCube(n = 600, nowMonth = '2026-11'): MetricsCube {
  return {
    schemaVersion: 1, generatedAt: new Date().toISOString(), nowMonth, tz: 'America/Costa_Rica', currencies: ['USD'],
    funnelStages: STAGES.map((s) => ({ stage: s, label: s.replace(/^sales_/, '').replace(/_/g, ' ') })),
    rows: syntheticRows(n, nowMonth), warnings: [],
  };
}
