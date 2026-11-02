<script lang="ts">
  /**
   * GrowthSection — is the top of the funnel growing, and from where?
   *   1. Leads / quoted leads / won deals per month (click a month → period)
   *   2. Channel mix per month (stacked, top 5 + Other)
   *   3. Value of a lead over time: booked per lead by lead month (cohort)
   */
  import { createEventDispatcher } from 'svelte';
  import TrendChart from '../charts/TrendChart.svelte';
  import { monthSeries, partition } from '../engine/cube.ts';
  import { monthLabel } from '../engine/period.ts';
  import { money } from '../engine/format.ts';
  import { OTHER, seriesColor } from '../charts/palette.ts';
  import type { Ctx, LeadFact } from '../engine/types.ts';

  export let rows: LeadFact[] = [];
  export let ctx: Ctx;
  /** Months shown on the charts (≥ 6 even for short periods, for context). */
  export let chartMonths: string[] = [];

  const dispatch = createEventDispatcher<{ month: { month: string } }>();
  let asTable = false;

  $: labels = chartMonths.map((m) => monthLabel(m));
  $: hi = (() => { const i = chartMonths.indexOf(ctx.months[ctx.months.length - 1]); return ctx.allTime || ctx.months.length > 1 ? null : i < 0 ? null : i; })();
  $: volume = [
    { key: 'leads', label: 'Leads', values: monthSeries(rows, 'leads', chartMonths, ctx) },
    { key: 'quotedLeads', label: 'Quoted leads', values: monthSeries(rows, 'quotedLeads', chartMonths, ctx) },
    { key: 'won', label: 'Won deals', values: monthSeries(rows, 'won', chartMonths, ctx) },
  ];

  $: mix = (() => {
    const leads = rows.filter((r) => r.isLead && r.leadMonth && chartMonths.includes(r.leadMonth));
    const parts = [...partition(leads, 'channel').entries()].sort((a, b) => b[1].length - a[1].length);
    const top = parts.slice(0, 5);
    const rest = parts.slice(5).flatMap(([, rs]) => rs);
    const count = (rs: LeadFact[]) => chartMonths.map((m) => rs.filter((r) => r.leadMonth === m).length);
    const series = top.map(([k, rs], i) => ({ key: k, label: k, values: count(rs), color: seriesColor(i) }));
    if (rest.length) series.push({ key: 'other', label: 'Other', values: count(rest), color: OTHER });
    return series;
  })();

  $: value = [{ key: 'bpl', label: 'Booked per lead', kind: 'line' as const, values: monthSeries(rows, 'bookedPerLead', chartMonths, ctx) }];
  const fmtMoney = (n: number) => money(n, ctx.currency, true);
</script>

<div class="gr">
  <div class="mh-card gr-main">
    <div class="gr-head">
      <h4 class="mh-card__h">Volume by month</h4>
      <div class="mh-seg" role="group" aria-label="Show as">
        <button aria-pressed={!asTable} on:click={() => (asTable = false)}>Chart</button>
        <button aria-pressed={asTable} on:click={() => (asTable = true)}>Table</button>
      </div>
    </div>
    <div class="gr-chart">
      <TrendChart {labels} series={volume} showTable={asTable} selectable highlight={hi} caption="Leads, quoted leads and won deals per month"
        on:select={(e) => dispatch('month', { month: chartMonths[e.detail.index] })} />
    </div>
    <p class="mh-hint">Click a month to make it the period. Won deals are counted in the month the client accepted.</p>
  </div>
  <div class="mh-grid-2">
    <div class="mh-card">
      <h4 class="mh-card__h">Where leads come from</h4>
      <div class="gr-chart"><TrendChart {labels} series={mix} stacked showTable={asTable} height={200} caption="New leads per month by channel" /></div>
    </div>
    <div class="mh-card">
      <h4 class="mh-card__h">Value of a lead · {ctx.currency}</h4>
      <div class="gr-chart"><TrendChart {labels} series={value} format={fmtMoney} showTable={asTable} height={200} caption="Booked per lead, by the month the lead arrived" /></div>
      <p class="mh-hint">Booked so far by each month's leads ÷ that month's leads. Recent months are still maturing.</p>
    </div>
  </div>
</div>

<style>
  .gr { display: grid; gap: 1rem; }
  .gr-head { display: flex; justify-content: space-between; align-items: center; gap: 0.6rem; }
  .gr-chart { padding-top: 1.6rem; }
  .gr-main .gr-chart { padding-top: 1.8rem; }
  .gr .mh-card { background: #fff; }
</style>
