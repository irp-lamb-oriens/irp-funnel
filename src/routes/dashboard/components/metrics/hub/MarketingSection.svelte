<script lang="ts">
  /**
   * MarketingSection — channel economics: for each source, how many leads,
   * how many show up, how many buy, and what a lead is worth. The existing
   * attribution module (visits, first/last touch) follows underneath.
   */
  import BarList from '../charts/BarList.svelte';
  import type { BarRow } from '../charts/types.ts';
  import { groupBy } from '../engine/cube.ts';
  import { money, pct } from '../engine/format.ts';
  import { wilson } from '../engine/stats.ts';
  import { aggregate } from '../engine/cube.ts';
  import type { Ctx, LeadFact } from '../engine/types.ts';
  import { addFilter } from './hubState.ts';

  export let rows: LeadFact[] = [];
  export let ctx: Ctx;

  const FIELDS = [
    { key: 'channel', label: 'Channel' },
    { key: 'heardFrom', label: 'Heard about us' },
    { key: 'utmSource', label: 'UTM source' },
    { key: 'utmMedium', label: 'UTM medium' },
    { key: 'utmCampaign', label: 'UTM campaign' },
    { key: 'multiTouch', label: 'Touches' },
  ];
  let field = 'channel';

  $: base = aggregate(rows, 'winRate', ctx).value;
  $: groups = groupBy(rows, field, ['leads', 'showRate', 'winRate', 'bookedPerLead', 'marginPerLead'], ctx, { top: 10, cohortOnly: true });
  $: barRows = groups.map((g): BarRow => {
    const w = g.values.winRate;
    let tone: BarRow['tone'] = null;
    if (base !== null && (w.den ?? 0) >= 10) {
      const ci = wilson(w.num ?? 0, w.den ?? 0);
      tone = ci.lo > base ? 'good' : ci.hi < base ? 'bad' : null;
    }
    return {
      key: g.key,
      label: g.label,
      value: g.leads,
      display: g.leads.toLocaleString('en-US'),
      muted: g.key === '__rest__',
      tone,
      cells: [pct(w.value), pct(g.values.showRate.value), money(g.values.bookedPerLead.value, ctx.currency, true), money(g.values.marginPerLead.value, ctx.currency, true)],
    };
  });
</script>

<div class="mk-tools">
  <div class="mh-seg" role="group" aria-label="Attribution field">
    {#each FIELDS as f}<button aria-pressed={field === f.key} on:click={() => (field = f.key)}>{f.label}</button>{/each}
  </div>
  <p class="mh-hint">Leads of the period · booked and margin per lead count every lead, including those that never bought</p>
</div>
{#if barRows.length}
  <BarList rows={barRows} labelHeader={FIELDS.find((f) => f.key === field)?.label} valueLabel="Leads" columns={['Win rate', 'Show rate', 'Booked / lead', 'Margin / lead']} selectable caption="Lead economics by {field}"
    on:select={(e) => addFilter({ dim: field, values: [e.detail.key] })} />
{:else}
  <p class="mh-empty">No leads in this period.</p>
{/if}
<div class="mk-slot"><slot /></div>

<style>
  .mk-tools { display: flex; align-items: center; justify-content: space-between; gap: 0.6rem 1rem; flex-wrap: wrap; margin-bottom: 0.7rem; }
  .mk-slot:not(:empty) { margin-top: 1.2rem; }
  .mk-slot :global(.metrics-section) { margin-bottom: 0; }
</style>
