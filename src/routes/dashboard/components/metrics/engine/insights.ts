/**
 * insights.ts — turns the cube into a short list of plain-language cards:
 * what's working, what isn't, what changed, and what needs attention.
 * Every card carries its numbers and (where it makes sense) the filters to
 * open it in the Explorer. Thresholds are deliberately conservative so the
 * panel stays quiet on noise (spec §6.6).
 */
import type { Ctx, Filter, LeadFact } from './types.ts';
import { DIMENSIONS, MATURE_DAYS, MEASURE, dimLabel, dimValues, forecast, inCohort } from './registry.ts';
import { poissonFlag } from './stats.ts';
import { shiftMonth, crDayOfMonth, monthLabel } from './period.ts';
import type { ComboResult, Segment } from './combos.ts';

export type Tone = 'good' | 'watch' | 'bad' | 'info';

export interface Insight {
  id: string;
  tone: Tone;
  kind: 'working' | 'notWorking' | 'revenue' | 'momentum' | 'mtd' | 'concentration' | 'stalled' | 'receivable' | 'forecast' | 'leakage' | 'gap';
  headline: string;
  detail: string;
  filters?: Filter[];
  deals?: Array<{ id: string; name: string; value: string }>;
}

export type Money = (n: number) => string;

/** Shared thresholds — the Sales Book imports these instead of restating them. */
export const STALLED_QUIET_DAYS = 14;
export const STALLED_MAX_QUOTE_AGE = 90;
export const CONCENTRATION_MIN_DEALS = 10;
export const MTD_MIN_DAY = 7;
export const MTD_MIN_EVENTS = 5;
const pct = (v: number) => `${Math.round(v * 1000) / 10}%`;

// ── Working / not working (from the finder) ──────────────────────────────────

export function comboInsights(res: ComboResult | null, max = 3): { working: Insight[]; notWorking: Insight[] } {
  if (!res) return { working: [], notWorking: [] };
  const label = MEASURE[res.measure]?.label.toLowerCase() ?? 'rate';
  const card = (s: Segment, kind: 'working' | 'notWorking'): Insight => ({
    id: `${kind}:${s.label}`,
    tone: kind === 'working' ? 'good' : 'bad',
    kind,
    headline: s.label,
    detail: `${pct(s.rate)} ${label} vs ${pct(res.baseline)} baseline (${s.lift >= 1 ? `${s.lift.toFixed(1)}×` : `${Math.round((1 - s.lift) * 100)}% lower`}) · ${s.x} of ${s.n} leads · likely range ${pct(s.ci.lo)}–${pct(s.ci.hi)}`,
    filters: s.filters,
  });
  return { working: res.working.slice(0, max).map((s) => card(s, 'working')), notWorking: res.notWorking.slice(0, max).map((s) => card(s, 'notWorking')) };
}

// ── Revenue drivers (booked per lead, decomposed) ────────────────────────────

export interface Driver {
  dim: string;
  value: string;
  label: string;
  leads: number;
  won: number;
  index: number;
  winLift: number;
  dealLift: number;
  looIndex: number;
}

export function revenueDrivers(rows: LeadFact[], currency: string, opts: { minLeads?: number; minWon?: number } = {}): { high: Driver[]; low: Driver[] } {
  const minLeads = opts.minLeads ?? 15, minWon = opts.minWon ?? 3;
  const pool = rows.filter((r) => r.isLead && !r.likelyTest && (r.leadAgeDays ?? 0) >= MATURE_DAYS);
  const N = pool.length;
  if (N < minLeads * 2) return { high: [], low: [] };
  const booked = (r: LeadFact) => r.money[currency]?.booked ?? 0;
  const totalB = pool.reduce((s, r) => s + booked(r), 0);
  const totalW = pool.filter((r) => r.won).length;
  if (totalB <= 0 || !totalW) return { high: [], low: [] };
  const bplAll = totalB / N, winAll = totalW / N, dealAll = totalB / Math.max(1, pool.filter((r) => booked(r) > 0).length);
  const out: Driver[] = [];
  for (const d of DIMENSIONS) {
    if (d.phase !== 'lead' || d.multi || d.key === 'leadMonth') continue;
    const parts = new Map<string, LeadFact[]>();
    for (const r of pool) { const v = dimValues(d, r)[0]; const a = parts.get(v); if (a) a.push(r); else parts.set(v, [r]); }
    for (const [v, rs] of parts) {
      if (rs.length < minLeads || N - rs.length < minLeads) continue;
      const won = rs.filter((r) => r.won).length;
      const b = rs.reduce((s, r) => s + booked(r), 0);
      const withB = rs.filter((r) => booked(r) > 0);
      const bpl = b / rs.length;
      const index = bpl / bplAll;
      const biggest = Math.max(0, ...withB.map(booked));
      const looIndex = ((b - biggest) / rs.length) / bplAll;
      out.push({
        dim: d.key, value: v, label: `${d.label}: ${dimLabel(d.key, v)}`, leads: rs.length, won, index,
        winLift: won / rs.length / winAll, dealLift: withB.length ? b / withB.length / dealAll : 0, looIndex,
      });
    }
  }
  const high = out.filter((x) => x.won >= minWon && x.index >= 1.2 && x.looIndex >= 1.2).sort((a, b) => b.looIndex - a.looIndex).slice(0, 10);
  const low = out.filter((x) => x.index <= 0.8 && x.leads >= minLeads * 1.5).sort((a, b) => a.index - b.index).slice(0, 5);
  return { high, low };
}

export function driverInsights(dr: { high: Driver[]; low: Driver[] }, money: Money, max = 2): Insight[] {
  const card = (x: Driver, good: boolean): Insight => ({
    id: `rev:${x.dim}:${x.value}`,
    tone: good ? 'good' : 'watch',
    kind: 'revenue',
    headline: `${x.label} ${good ? 'earns' : 'earns less:'} ${x.index.toFixed(1)}× booked per lead`,
    detail: `${x.leads} mature leads, ${x.won} won · win rate ${x.winLift.toFixed(1)}× and deal size ${x.dealLift.toFixed(1)}× the average${good ? ` · still ${x.looIndex.toFixed(1)}× without its biggest deal` : ''}`,
    filters: [{ dim: x.dim, values: [x.value] }],
  });
  return [...dr.high.slice(0, max).map((x) => card(x, true)), ...dr.low.slice(0, 1).map((x) => card(x, false))];
}

// ── Momentum, month-to-date ──────────────────────────────────────────────────

export function momentumInsights(rows: LeadFact[], nowMonth: string, currency: string): Insight[] {
  const latest = shiftMonth(nowMonth, -1);
  const prior = [2, 3, 4].map((k) => shiftMonth(nowMonth, -k));
  const ctx = (months: string[]): Ctx => ({ months, allTime: false, currency, nowMonth });
  const out: Insight[] = [];
  for (const key of ['leads', 'quotedLeads', 'won']) {
    const m = MEASURE[key];
    const x = m.compute(rows, ctx([latest])).value ?? 0;
    const mu = prior.reduce((s, mm) => s + (m.compute(rows, ctx([mm])).value ?? 0), 0) / 3;
    const flag = poissonFlag(x, mu);
    if (!flag) continue;
    const up = flag === 'up';
    out.push({
      id: `mom:${key}`,
      tone: up ? 'good' : 'bad',
      kind: 'momentum',
      headline: `${m.label} ${up ? 'jumped' : 'fell'} in ${monthLabel(latest, true)}`,
      detail: `${x} vs a ${mu.toFixed(1)} average over the three months before — beyond normal month-to-month swing.`,
    });
  }
  return out;
}

export function mtdInsight(rows: LeadFact[], nowMonth: string, now = new Date()): Insight | null {
  const { day, days } = crDayOfMonth(now);
  if (day < MTD_MIN_DAY) return null;
  const last = shiftMonth(nowMonth, -1);
  const dayOf = (iso: string) => Number(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Costa_Rica', day: '2-digit' }).format(new Date(iso)));
  let cur = 0, prev = 0;
  for (const r of rows) {
    if (!r.isLead || !r.leadAt || !r.leadMonth) continue;
    if (r.leadMonth === nowMonth) cur++;
    else if (r.leadMonth === last && dayOf(r.leadAt) <= day) prev++;
  }
  if (cur + prev < MTD_MIN_EVENTS) return null;
  const diff = prev ? (cur - prev) / prev : null;
  const tone: Tone = diff === null ? 'info' : diff >= 0.15 ? 'good' : diff <= -0.15 ? 'bad' : 'info';
  return {
    id: 'mtd:leads', tone, kind: 'mtd',
    headline: `${cur} leads so far this month`,
    detail: `${prev} by day ${day} last month${diff !== null ? ` (${diff >= 0 ? '+' : ''}${Math.round(diff * 100)}%)` : ''} · on pace for about ${Math.round((cur / day) * days)}.`,
  };
}

// ── Risk & pipeline ──────────────────────────────────────────────────────────

export function concentrationInsight(rows: LeadFact[], ctx: Ctx, money: Money): Insight | null {
  const set = new Set(ctx.months);
  const deals = rows
    .filter((r) => r.won && (ctx.allTime || (r.wonMonth && set.has(r.wonMonth))))
    .map((r) => ({ r, b: r.money[ctx.currency]?.booked ?? 0 }))
    .filter((d) => d.b > 0)
    .sort((a, b) => b.b - a.b);
  if (deals.length < CONCENTRATION_MIN_DEALS) return null;
  const total = deals.reduce((s, d) => s + d.b, 0);
  const top = deals.slice(0, 3).reduce((s, d) => s + d.b, 0);
  const share = top / total;
  if (share <= 0.5) return null;
  return {
    id: 'conc', tone: 'watch', kind: 'concentration',
    headline: `3 deals are ${Math.round(share * 100)}% of booked revenue`,
    detail: `${money(top)} of ${money(total)} across ${deals.length} won deals. Revenue depends on a few large moves.`,
    deals: deals.slice(0, 3).map((d) => ({ id: d.r.id, name: d.r.name, value: money(d.b) })),
  };
}

export function stalledInsight(rows: LeadFact[], currency: string, money: Money): Insight | null {
  const stalled = rows
    .filter((r) => r.isLead && r.status === 'quoted' && r.openQuote && (r.openQuote.ageDays ?? 0) <= STALLED_MAX_QUOTE_AGE && (r.daysSinceActivity ?? 0) > STALLED_QUIET_DAYS)
    .sort((a, b) => (b.openQuote?.total ?? 0) - (a.openQuote?.total ?? 0));
  if (!stalled.length) return null;
  const inCur = stalled.filter((r) => r.openQuote!.cur === currency);
  const value = inCur.reduce((s, r) => s + r.openQuote!.total, 0);
  return {
    id: 'stalled', tone: 'watch', kind: 'stalled',
    headline: `${stalled.length} quote${stalled.length === 1 ? '' : 's'} waiting with no activity for 2+ weeks`,
    detail: `${money(value)} in open quotes${inCur.length < stalled.length ? ` (${stalled.length - inCur.length} in other currencies)` : ''}. A follow-up now is cheaper than a new lead.`,
    deals: stalled.slice(0, 5).map((r) => ({ id: r.id, name: r.name, value: `${r.openQuote!.cur === currency ? money(r.openQuote!.total) : `${r.openQuote!.total.toLocaleString('en-US')} ${r.openQuote!.cur}`} · ${Math.round(r.daysSinceActivity ?? 0)}d quiet` })),
  };
}

export function receivableInsight(rows: LeadFact[], currency: string, money: Money): Insight | null {
  let old = 0, total = 0;
  const who: Array<{ r: LeadFact; v: number }> = [];
  for (const r of rows) {
    const a = r.receivable[currency];
    if (!a) continue;
    total += a.d0_30 + a.d31_60 + a.d61_90 + a.d90p;
    const o = a.d61_90 + a.d90p;
    if (o > 0) { old += o; who.push({ r, v: o }); }
  }
  if (old <= 0) return null;
  who.sort((a, b) => b.v - a.v);
  return {
    id: 'rcv', tone: 'bad', kind: 'receivable',
    headline: `${money(old)} unpaid for more than 60 days`,
    detail: `${Math.round((old / total) * 100)}% of the ${money(total)} receivable. Oldest balances are the hardest to collect.`,
    deals: who.slice(0, 5).map((w) => ({ id: w.r.id, name: w.r.name, value: money(w.v) })),
  };
}

export function forecastInsight(rows: LeadFact[], currency: string, money: Money): Insight | null {
  const f = forecast(rows, currency);
  if (!f.open) return null;
  return {
    id: 'fc', tone: 'info', kind: 'forecast',
    headline: `About ${money(f.expected)} likely to book from open quotes`,
    detail: `Estimate from ${f.open} open quotes worth ${money(f.value)}, weighted by how often quotes of the same age were accepted before (± ${money(f.sd)}).`,
  };
}

// ── Leakage: which funnel step got worse? ────────────────────────────────────

export function leakageInsight(rows: LeadFact[], stages: Array<{ stage: string; label: string }>): Insight | null {
  const real = rows.filter((r) => r.isLead && !r.likelyTest);
  const recent = real.filter((r) => (r.leadAgeDays ?? -1) >= MATURE_DAYS && (r.leadAgeDays ?? 0) < 240);
  const older = real.filter((r) => (r.leadAgeDays ?? -1) >= 240 && (r.leadAgeDays ?? 0) < 540);
  const conv = (rs: LeadFact[], i: number) => {
    const prev = rs.filter((r) => r.reach[stages[i - 1].stage]).length;
    const cur = rs.filter((r) => r.reach[stages[i].stage]).length;
    return { prev, rate: prev ? cur / prev : null };
  };
  let worst: { i: number; drop: number; a: number; b: number } | null = null;
  for (let i = 1; i < stages.length; i++) {
    const a = conv(recent, i), b = conv(older, i);
    if (a.rate === null || b.rate === null || a.prev < 15 || b.prev < 15) continue;
    const drop = b.rate - a.rate;
    if (drop > 0.1 && (!worst || drop > worst.drop)) worst = { i, drop, a: a.rate, b: b.rate };
  }
  if (!worst) return null;
  return {
    id: 'leak', tone: 'bad', kind: 'leakage',
    headline: `Fewer leads move from "${stages[worst.i - 1].label}" to "${stages[worst.i].label}"`,
    detail: `${pct(worst.a)} of recent mature leads (2–8 months old) vs ${pct(worst.b)} of older ones (8–18 months).`,
  };
}

// ── Data gaps ────────────────────────────────────────────────────────────────

export function gapInsights(rows: LeadFact[], ctx: Ctx): Insight[] {
  const cohort = rows.filter((r) => inCohort(r, ctx));
  if (cohort.length < 10) return [];
  const checks: Array<[string, string, (r: LeadFact) => boolean]> = [
    ['channel', 'channel', (r) => r.channel === 'Unknown'],
    ['route', 'route', (r) => r.route === 'Unknown'],
    ['budget', 'budget', (r) => r.budget === 'Unknown'],
    ['utmSource', 'UTM source', (r) => r.utmSource === '(none)'],
  ];
  const out: Insight[] = [];
  for (const [dim, name, miss] of checks) {
    const n = cohort.filter(miss).length;
    const share = n / cohort.length;
    if (share > 0.25) out.push({ id: `gap:${dim}`, tone: 'info', kind: 'gap', headline: `${Math.round(share * 100)}% of leads have no ${name}`, detail: `${n} of ${cohort.length} leads in this period. Segments by ${name} are less reliable until capture improves.` });
  }
  return out.slice(0, 2);
}
