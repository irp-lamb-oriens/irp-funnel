<script lang="ts">
  /**
   * Scoreboard — 8 tiles; the lens picks which (sales-book-v3 §6.2). Every Δ
   * follows the fair-comparison rule (§5.3): partial months compare the same
   * days, through yesterday; a figure that can't be cut by day shows "not
   * comparable" instead of a misleading change. Small samples follow §5.4.
   */
  import { MEASURE, basisLabel } from '../../metrics/engine/registry.ts';
  import { aggregate, monthSeries } from '../../metrics/engine/cube.ts';
  import { delta, deltaAllowed, fmtMeasure, fmtStat, MIN_DELTA_COUNT, money as fmtMoney, pct, type Delta } from '../../metrics/engine/format.ts';
  import { compareMonths, crDateKey, inDayWindow, monthRange, shiftMonth } from '../../metrics/engine/period.ts';
  import {
    collectionSpeed, expectedCash, isStalled, pace, pipelineCoverage, quoteMovement, segmentTable, P_COLLECT,
  } from '../../metrics/engine/sales.ts';
  import type { Ctx, Filter, LeadFact } from '../../metrics/engine/types.ts';
  import Sparkline from '../../metrics/charts/Sparkline.svelte';
  import type { Book } from '../types.ts';
  import type { Lens } from '../salesBookState.ts';

  export let book: Book;
  export let lens: Lens = 'overview';
  export let cmpReason = '';
  export let onView: (view: string) => void = () => {};
  export let onMetrics: (extra?: Filter[], section?: string) => void = () => {};

  interface Tile {
    key: string; label: string; value: string; small?: boolean; title?: string; sub?: string;
    delta?: Delta | null; deltaNote?: string; basis: 'period' | 'cohort' | 'asOf' | 'estimate'; def: string;
    spark?: number[]; action?: { label: string; run: () => void };
  }

  let openDef: string | null = null;
  const money = (n: number | null | undefined) => fmtMoney(n, book.currency, true);

  $: sparkMonths = monthRange(shiftMonth(book.nowMonth, -11), book.nowMonth);
  $: thisMonthOnly = !book.allTime && book.months.length === 1 && book.months[0] === book.nowMonth;

  /** How many events stand behind a measure value (for the Δ small-sample rule). */
  function sampleOf(key: string, v: { value: number | null; n: number; den?: number }, c: Ctx): number {
    const m = MEASURE[key];
    if (m.kind === 'rate') return v.den ?? v.n;
    if (m.kind === 'count') return v.value ?? 0;
    const events = (list: (r: LeadFact) => Array<{ at: string | null; cur: string }> | undefined) => {
      if (!book.rows.some((r) => list(r))) return MIN_DELTA_COUNT; // older server: no dated events to count
      const set = new Set(c.months);
      let n = 0;
      for (const r of book.rows) for (const p of list(r) ?? []) {
        if (p.cur !== c.currency) continue;
        if (c.dayCut ? inDayWindow(p.at, c.dayCut) : c.allTime || set.has(crDateKey(p.at)?.slice(0, 7) ?? '')) n++;
      }
      return n;
    };
    if (key === 'cash') return events((r) => r.payments);
    if (key === 'invoiced') return events((r) => r.invoicedAtList);
    return aggregate(book.rows, 'won', c).value ?? 0;
  }

  /** Tile for a registry measure, with fair Δ, small-sample text, pace and sparkline. */
  function measureTile(key: string, label?: string, sub?: (v: number | null) => string): Tile {
    const m = MEASURE[key];
    const cur = aggregate(book.rows, key, book.ctx);
    let value: string, small = false, title = '';
    if (m.kind === 'rate') { const st = fmtStat('rate', cur.value, cur.den ?? cur.n, { num: cur.num }); value = st.text; small = st.small; title = st.title; }
    else if (m.kind === 'days') { const st = fmtStat('median', cur.value, cur.n, { fmt: (v) => `${Math.round(v)} d` }); value = st.text; small = st.small; title = st.title; }
    else value = fmtMeasure(m, cur.value, book.currency, true);
    let d: Delta | null = null, note = '';
    if (m.basis !== 'asOf' && book.cmp) {
      if (book.cmp.cur.dayCut && m.dayComparable === false) note = 'Not comparable until month end';
      else {
        const a = aggregate(book.rows, key, book.cmp.cur), b = aggregate(book.rows, key, book.cmp.prev);
        // Sample behind each side: rates → their denominator, counts → the count,
        // money → the number of events that make it up (§5.4).
        const na = sampleOf(key, a, book.cmp.cur), nb = sampleOf(key, b, book.cmp.prev);
        if (!deltaAllowed(na, nb)) note = 'Too few to compare';
        else {
          d = delta(m, a, b, book.cmp.label);
          if (book.allTime && d) note = `Last 12 mo ${fmtMeasure(m, a.value, book.currency, true)}`;
        }
      }
    } else if (m.basis !== 'asOf' && cmpReason) note = cmpReason;
    let subText = sub ? sub(cur.value) : cur.note ?? '';
    if (thisMonthOnly && (m.kind === 'count' || m.kind === 'money') && m.basis === 'period') {
      const p = pace(cur.value, m.kind === 'count' ? cur.value ?? 0 : aggregate(book.rows, 'won', book.ctx).value ?? 0, book.now);
      if (p !== null) subText = `On pace for ${fmtMeasure(m, p, book.currency, true)} this month`;
    }
    return {
      key, label: label ?? m.label, value, small, title, sub: subText, delta: d, deltaNote: note,
      basis: m.basis, def: m.def,
      spark: m.basis === 'asOf' ? undefined : monthSeries(book.rows, key, sparkMonths, book.ctx).map((v) => v ?? 0),
    };
  }

  // ── Figures that are not registry measures ───────────────────────────────
  $: exp = expectedCash(book.part, book.baseRows, book.rows, book.currency);
  $: overdue = book.receivables.filter((r) => r.currency === book.currency && r.due > 0 && (r.ageDays ?? 0) > 60);
  $: stalled = book.rows.filter(isStalled);
  $: speed = collectionSpeed(book.deals, book.rowsById, book.receivables, book.currency, book.now);
  $: coverage = pipelineCoverage(book.rows, book.currency, book.nowMonth);
  $: wonInPeriod = book.deals.filter((d) => !!d.acceptedAt && (book.allTime || book.months.includes(d.acceptedAt.slice(0, 7))));
  $: movement = quoteMovement(wonInPeriod, book.currency);
  $: channels = book.cubeOk ? segmentTable(book.rows, 'channel', book.ctx) : null;

  function outstandingTile(): Tile {
    const p = book.part;
    return {
      key: 'outstanding', label: 'Outstanding', value: money(p.total), basis: 'asOf',
      sub: `${p.rows.length} deal${p.rows.length === 1 ? '' : 's'} · ${money(p.notInvoiced)} not invoiced`,
      def: 'What clients still owe on accepted quotes and sent invoices, as of today, whatever the period: per deal, the larger of booked and invoiced, minus cash received. Deals dropped after acceptance are left out (Money shows them as "at risk").',
      action: { label: 'See the deals', run: () => onView('invoiced_unpaid') },
    };
  }
  function expectedTile(): Tile {
    return {
      key: 'expected', label: 'Expected cash', value: money(exp.total), basis: 'estimate',
      sub: `${money(exp.fromInvoiced + exp.fromNotInvoiced)} from balances · ${money(exp.fromOpenQuotes)} ± ${money(exp.quoteSd)} from ${exp.openQuotes} open quote${exp.openQuotes === 1 ? '' : 's'}`,
      def: `Estimate. Outstanding balances × the chance they are collected (invoiced 0–60 days ${pct(P_COLLECT.invoiced['0-30'])}, older ${pct(P_COLLECT.invoiced['90+'])}; not invoiced 0–90 days ${pct(P_COLLECT.notInvoiced['0-30'])}, older ${pct(P_COLLECT.notInvoiced['90+'])} — placeholders until history measures them), plus each open quote × the historical chance a quote of its age is accepted. The range covers open quotes only. Deals dropped after acceptance are excluded.`,
    };
  }
  function notInvoicedTile(): Tile {
    const a = book.part.notInvoicedByAge;
    return {
      key: 'notInvoiced', label: 'Not yet invoiced', value: money(book.part.notInvoiced), basis: 'asOf',
      sub: a['90+'] ? `${money(a['90+'])} accepted 90+ days ago` : `${book.part.rows.filter((r) => r.notInvoiced > 0).length} deals`,
      def: 'Accepted value with no invoice yet (part of Outstanding), as of today. Aged by days since the client accepted.',
      action: { label: 'See the deals', run: () => onView('not_invoiced') },
    };
  }
  function overdueTile(): Tile {
    const v = overdue.reduce((s, r) => s + r.due, 0);
    return {
      key: 'overdue', label: 'Overdue 60+', value: money(v), basis: 'asOf',
      sub: `${overdue.length} invoice${overdue.length === 1 ? '' : 's'} · ${new Set(overdue.map((r) => r.dealKey)).size} client${overdue.length === 1 ? '' : 's'}`,
      def: 'Unpaid balance of invoices sent more than 60 days ago, as of today.',
      action: { label: 'See the deals', run: () => onView('overdue60') },
    };
  }
  function dsoTile(): Tile {
    return {
      key: 'dso', label: 'DSO (90 days)', value: speed.dso90 === null ? '—' : `${Math.round(speed.dso90)} d`, basis: 'asOf',
      sub: speed.daysToCollectPaid.n >= 5 ? `Paid deals took ${Math.round(speed.daysToCollectPaid.value ?? 0)} d to collect (median)` : `Days to collect: n = ${speed.daysToCollectPaid.n}`,
      def: 'Days sales outstanding, count-back over 90 days: receivable today ÷ invoiced in the last 90 days × 90. "Days to collect" is the median days from first invoice (or acceptance) to the last payment, over fully paid deals — survivors only, so it reads faster than reality.',
    };
  }
  function stalledTile(): Tile {
    const v = stalled.reduce((s, r) => s + (r.openQuote?.cur === book.currency ? r.openQuote.total : 0), 0);
    return {
      key: 'stalled', label: 'Stalled quotes', value: String(stalled.length), basis: 'asOf', sub: `${money(v)} waiting`,
      def: 'Quoted, no activity for more than 14 days, quote at most 90 days old (the Metrics rule). A follow-up now is cheaper than a new lead.',
      action: { label: 'See the quotes', run: () => onView('stalled') },
    };
  }
  function coverageTile(): Tile {
    return {
      key: 'coverage', label: 'Pipeline coverage', value: coverage.months === null ? '—' : `${coverage.months.toFixed(1)} mo`, basis: 'asOf',
      sub: `${money(coverage.openValue)} open ÷ ${money(coverage.avgBooked)} booked a month`,
      def: 'Open-quote value ÷ average monthly booked over the last 3 complete months: how many months of sales the open quotes represent.',
    };
  }
  function movementTile(): Tile {
    const st = fmtStat('median', movement.median, movement.n, { fmt: (v) => `${v >= 0 ? '+' : ''}${Math.round(v * 1000) / 10}%` });
    return {
      key: 'movement', label: 'Quote movement', value: st.text, small: st.small, title: st.title, basis: 'period',
      sub: movement.n ? `${movement.down} lower · ${movement.same} same · ${movement.up} higher` : 'No won deals with both quotes',
      def: 'Median change from the first quote sent (its largest option) to the accepted quote, over deals won in the period. Revised quotes can change scope, so the Pipeline section splits "same quote" from "revised".',
    };
  }
  function topChannelTiles(): Tile[] {
    const top = channels?.rows.filter((r) => r.key !== 'Unknown' && r.key !== 'Other' && r.key !== 'No lead record')[0];
    const unknown = channels?.rows.filter((r) => r.key === 'Unknown' || r.key === 'Other' || r.key === 'No lead record').reduce((s, r) => s + (r.share ?? 0), 0) ?? 0;
    return [
      { key: 'topChannel', label: 'Top channel by booked', value: top ? top.label : '—', basis: 'period', sub: top ? `${money(top.booked)} · ${pct(top.share)} of booked` : 'No won deals in the period',
        def: 'Channel of the deals won in the period with the most booked value (deal basis: all their money).', action: top ? { label: 'Filter to it', run: () => onMetrics([{ dim: 'channel', values: [top.key] }], 'mh-marketing') } : undefined },
      { key: 'topChannelAvg', label: 'Avg deal · top channel', value: top ? money(top.avgDeal) : '—', basis: 'period', sub: top ? `${top.won} won deal${top.won === 1 ? '' : 's'}` : '', def: 'Booked ÷ won deals of the top channel, deals won in the period.' },
      { key: 'unknownShare', label: 'Booked with no source', value: channels ? pct(unknown) : '—', basis: 'period', sub: 'Channel unknown, other or no lead record', def: 'Share of booked value (deals won in the period) whose lead has no usable channel. A data-capture gap that hides what marketing works.' },
    ];
  }
  function leadsYoyTile(): Tile {
    const m = MEASURE.leads;
    let a: number | null, b: number | null, lbl: string;
    if (book.allTime) {
      const end = shiftMonth(book.nowMonth, -1);
      a = aggregate(book.rows, 'leads', { ...book.ctx, allTime: false, months: monthRange(shiftMonth(end, -11), end) }).value;
      b = aggregate(book.rows, 'leads', { ...book.ctx, allTime: false, months: monthRange(shiftMonth(end, -23), shiftMonth(end, -12)) }).value;
      lbl = 'last 12 complete months vs the 12 before';
    } else {
      const ly = compareMonths(book.months, 'yoy', false) ?? [];
      a = aggregate(book.rows, 'leads', book.ctx).value;
      b = aggregate(book.rows, 'leads', { ...book.ctx, months: ly }).value;
      lbl = 'same months last year';
    }
    const d = deltaAllowed(a, b) ? delta(m, { value: a, n: a ?? 0 }, { value: b, n: b ?? 0 }, lbl) : null;
    return { key: 'leadsYoy', label: 'Leads vs last year', value: d ? d.text : '—', basis: 'period', sub: `${a ?? 0} vs ${b ?? 0} · ${lbl}`, def: 'Leads in the period compared with the same months a year earlier (All time: last 12 complete months vs the 12 before).' };
  }
  function marginPerWonTile(): Tile {
    const mg = aggregate(book.rows, 'margin', book.ctx).value ?? 0;
    const w = aggregate(book.rows, 'won', book.ctx).value ?? 0;
    const st = fmtStat('average', w ? mg / w : null, w, { fmt: (v) => money(v) });
    return { key: 'marginPerWon', label: 'Margin per won deal', value: st.text, small: st.small, title: st.title, basis: 'period', sub: `${w} won deal${w === 1 ? '' : 's'}`, def: 'Expected margin of quotes accepted in the period ÷ deals won in the period.' };
  }
  function metricsLinkTile(): Tile {
    return { key: 'toMetrics', label: 'Lead quality', value: 'Metrics →', basis: 'cohort', sub: 'Conversion, show rate and "what works" by source', def: 'Conversion questions live on the Metrics tab; this opens it on the same period and filters.', action: { label: 'Open Metrics', run: () => onMetrics([], 'mh-marketing') } };
  }

  $: tiles = ((): Tile[] => {
    void book; void lens;
    if (!book.cubeOk) return [outstandingTile(), notInvoicedTile(), overdueTile(), expectedTile()];
    switch (lens) {
      case 'sales': return [
        measureTile('quotesSent'), measureTile('won'), measureTile('quoteToWin'),
        measureTile('openQuotes'), stalledTile(), measureTile('daysToClose'), coverageTile(), movementTile(),
      ];
      case 'finance': return [
        measureTile('booked'), measureTile('invoiced'), measureTile('cash'),
        outstandingTile(), notInvoicedTile(), overdueTile(), dsoTile(), measureTile('marginPct'),
      ];
      case 'marketing': return [
        measureTile('leads'), ...topChannelTiles().slice(0, 2), measureTile('matureWinRate'),
        topChannelTiles()[2], leadsYoyTile(), marginPerWonTile(), metricsLinkTile(),
      ];
      default: return [
        measureTile('booked'), measureTile('cash'),
        measureTile('margin', undefined, () => { const p = aggregate(book.rows, 'marginPct', book.ctx); return p.value === null ? '' : `${pct(p.value)} margin${p.note ? ` · ${p.note}` : ''}`; }),
        measureTile('won'), measureTile('matureWinRate'), measureTile('avgDeal'),
        outstandingTile(), expectedTile(),
      ];
    }
  })();

  const BASIS_TITLE = { period: 'In the period', cohort: 'Leads of the period', asOf: 'As of today', estimate: 'Estimate' };
</script>

<div class="sb-tiles">
  {#each tiles as t (t.key)}
    <article class="sb-tile sb-tile--{t.basis}">
      <div class="sb-tile__top">
        <h4 class="sb-tile__label">{t.label}</h4>
        <button class="sb-info" aria-expanded={openDef === t.key} aria-label="What is {t.label}?" on:click={() => (openDef = openDef === t.key ? null : t.key)}>i</button>
      </div>
      <div class="sb-tile__value" class:sb-small={t.small} title={t.title || undefined}>{t.value}</div>
      {#if t.delta}
        <div class="sb-delta sb-delta--{t.delta.tone}">
          <span aria-hidden="true">{t.delta.glyph}</span> {t.delta.text}
          <span class="sb-delta__vs">{book.allTime ? 'last 12 mo vs prior 12' : `vs ${book.cmp?.label ?? ''}`}</span>
          <span class="sr-only">{t.delta.sr}</span>
        </div>
      {:else if t.basis === 'asOf' || t.basis === 'estimate'}
        <div class="sb-delta sb-delta--flat">{BASIS_TITLE[t.basis].toLowerCase()}</div>
      {:else if t.deltaNote}
        <div class="sb-delta sb-delta--flat">{t.deltaNote}</div>
      {/if}
      {#if t.delta && t.deltaNote}<div class="sb-tile__note">{t.deltaNote}</div>{/if}
      {#if t.sub}<div class="sb-tile__sub">{t.sub}</div>{/if}
      {#if t.spark && t.spark.length > 1 && t.spark.some((v) => v)}
        <div class="sb-tile__spark"><Sparkline values={t.spark} width={140} height={26} label="{t.label}, last 12 months" /></div>
      {/if}
      {#if t.action}<button class="mh-link sb-tile__more" on:click={t.action.run}>{t.action.label} →</button>{/if}
      {#if openDef === t.key}<p class="sb-def">{t.def}{#if t.basis === 'period' || t.basis === 'cohort'} <em>({t.basis === 'period' ? basisLabel({ basis: 'period' } as any) : basisLabel({ basis: 'cohort' } as any)})</em>{/if}</p>{/if}
    </article>
  {/each}
</div>
{#if !book.cubeOk}<p class="mh-hint">Segment data is unavailable, so only as-of figures are shown.</p>{/if}

<style>
  .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
</style>
