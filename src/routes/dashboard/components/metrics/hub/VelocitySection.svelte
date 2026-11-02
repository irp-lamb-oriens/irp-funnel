<script lang="ts">
  /**
   * VelocitySection — how fast deals move: quote turnaround, client decision,
   * days to close and accepted → paid, each as a distribution with its
   * median, plus the quotes that have gone quiet.
   */
  import { createEventDispatcher } from 'svelte';
  import TrendChart from '../charts/TrendChart.svelte';
  import { aggregate } from '../engine/cube.ts';
  import { inCohort } from '../engine/registry.ts';
  import { days, money } from '../engine/format.ts';
  import type { Ctx, LeadFact } from '../engine/types.ts';

  export let rows: LeadFact[] = [];
  export let ctx: Ctx;

  const dispatch = createEventDispatcher<{ openClient: { id: string } }>();
  const BUCKETS = [[0, 7, '0–7'], [8, 14, '8–14'], [15, 30, '15–30'], [31, 60, '31–60'], [61, 90, '61–90'], [91, Infinity, '90+']] as const;
  const PANELS = [
    { key: 'quoteTurnaround', label: 'Lead → first quote', get: (r: LeadFact) => r.quoteTurnaroundDays },
    { key: 'decisionDays', label: 'Quote → acceptance', get: (r: LeadFact) => r.decisionDays },
    { key: 'daysToClose', label: 'Lead → acceptance', get: (r: LeadFact) => r.daysToClose },
    { key: 'acceptToPaid', label: 'Acceptance → first payment', get: (r: LeadFact) => r.acceptToPaidDays },
  ];

  $: panels = PANELS.map((p) => {
    const vals = rows.filter((r) => inCohort(r, ctx)).map(p.get).filter((v): v is number => v !== null && v >= 0);
    const counts = BUCKETS.map(([lo, hi]) => vals.filter((v) => v >= lo && v <= hi).length);
    const m = aggregate(rows, p.key, ctx);
    return { ...p, counts, median: m.value, note: m.note };
  });
  $: stalled = rows
    .filter((r) => r.isLead && r.status === 'quoted' && r.openQuote && (r.openQuote.ageDays ?? 0) <= 90 && (r.daysSinceActivity ?? 0) > 14)
    .sort((a, b) => (b.openQuote?.total ?? 0) - (a.openQuote?.total ?? 0))
    .slice(0, 12);
  const labels = BUCKETS.map((b) => `${b[2]} d`);
</script>

<div class="vl-grid">
  {#each panels as p (p.key)}
    <div class="mh-card vl-card">
      <div class="vl-head">
        <h4 class="mh-card__h">{p.label}</h4>
        <div class="vl-med"><strong>{days(p.median)}</strong> <span class="mh-muted">median</span></div>
      </div>
      <TrendChart {labels} series={[{ key: p.key, label: 'Leads', values: p.counts }]} height={140} caption="{p.label}: distribution of days" />
      {#if p.note}<p class="mh-hint">{p.note}</p>{/if}
    </div>
  {/each}
</div>

<div class="vl-stalled">
  <h4 class="mh-card__h">Quotes gone quiet <span class="mh-muted">· sent within 90 days, no activity for 14+ days, as of today</span></h4>
  {#if stalled.length}
    <div class="mh-table-wrap">
      <table class="mh-table mh-table--compact">
        <thead><tr><th scope="col">Client</th><th scope="col">Route</th><th scope="col" class="num">Quote</th><th scope="col" class="num">Quote age</th><th scope="col" class="num">Quiet for</th></tr></thead>
        <tbody>
          {#each stalled as r (r.id)}
            <tr>
              <th scope="row"><button class="mh-link" on:click={() => dispatch('openClient', { id: r.id })}>{r.name}</button></th>
              <td>{r.route}</td>
              <td class="num">{r.openQuote?.cur === ctx.currency ? money(r.openQuote.total, ctx.currency) : `${r.openQuote?.total.toLocaleString('en-US')} ${r.openQuote?.cur}`}</td>
              <td class="num">{days(r.openQuote?.ageDays)}</td>
              <td class="num">{days(r.daysSinceActivity)}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {:else}
    <p class="mh-empty">No quiet quotes. Every recent quote has had activity in the last two weeks.</p>
  {/if}
</div>

<style>
  .vl-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 0.8rem; }
  .vl-card { background: #fff; }
  .vl-head { display: flex; justify-content: space-between; align-items: baseline; gap: 0.5rem; margin-bottom: 0.3rem; }
  .vl-head .mh-card__h { margin: 0; }
  .vl-med { font-size: 0.82rem; color: #0f172a; white-space: nowrap; }
  .vl-stalled { margin-top: 1rem; }
</style>
