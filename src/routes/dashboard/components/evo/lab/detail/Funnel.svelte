<script lang="ts">
  /** Funnel per arm, so far (not matured): assigned → steps → lead → call → quote → won → paid. */
  import type { LeadFact } from '../../../metrics/engine/types.ts';
  import type { ExperimentAnalysis } from '../../engine/experiment.ts';
  import { armLabel, DAY_MS, type JoinedExperiment } from '../../engine/join.ts';
  import { metricDef } from '../../engine/metrics.ts';
  import FunnelChart from '../../../metrics/charts/FunnelChart.svelte';

  export let a: ExperimentAnalysis;
  export let joined: JoinedExperiment;
  export let leads: Map<string, LeadFact>;

  let table = false;
  $: email = a.def.surface === 'email';
  $: stepKeys = email ? [] : [...new Set(joined.units.flatMap((u) => Object.keys(u.steps)))].sort((x, y) => (`step:${x}` === a.def.primaryMetric ? -1 : `step:${y}` === a.def.primaryMetric ? 1 : x.localeCompare(y)));
  $: steps = email
    ? [{ key: 'assigned', label: 'Assigned' }, { key: 'reached', label: 'Nurture email scheduled' }, { key: 'opened', label: 'Opened*' }, { key: 'clicked', label: 'Clicked' }, { key: 'won', label: 'Won after email' }]
    : [{ key: 'assigned', label: 'Assigned' }, ...stepKeys.map((s) => ({ key: `step:${s}`, label: metricDef(`step:${s}`).label })), { key: 'lead', label: 'Lead' }, { key: 'call', label: 'Call booked' }, { key: 'quoted', label: 'Quoted' }, { key: 'won', label: 'Won' }, { key: 'paid', label: 'Paid' }];
  $: groups = a.arms.map((k) => {
    const us = joined.units.filter((u) => u.arm === k);
    const L = (u: (typeof us)[number]) => (u.leadId ? leads.get(u.leadId) ?? null : null);
    const count = (key: string) => {
      if (key === 'assigned') return us.length;
      if (key.startsWith('step:')) { const s = key.slice(5); return us.filter((u) => u.steps[s] !== undefined && u.steps[s] >= u.t - 60_000 && u.steps[s] <= u.t + 7 * DAY_MS).length; }
      if (key === 'reached') return us.filter((u) => u.drip?.reachedType).length;
      if (key === 'opened') return us.filter((u) => u.drip?.opened).length;
      if (key === 'clicked') return us.filter((u) => u.drip?.clicked).length;
      if (key === 'lead') return us.filter((u) => u.leadId).length;
      if (key === 'call') return us.filter((u) => L(u)?.callBooked).length;
      if (key === 'quoted') return us.filter((u) => L(u)?.quoteSentMonth).length;
      if (key === 'won') return us.filter((u) => L(u)?.won).length;
      if (key === 'paid') return us.filter((u) => L(u)?.paid).length;
      return null;
    };
    return { key: k, label: armLabel(a.def, k), counts: steps.map((s) => count(s.key)) };
  });
</script>

<div class="mh-section__head">
  <p class="mh-sub">Everyone so far, including people who are still maturing — use the Scorecard for comparisons.</p>
  <button class="mh-btn mh-btn--sm" aria-pressed={table} on:click={() => (table = !table)}>{table ? 'Chart' : 'Table'}</button>
</div>
<FunnelChart {steps} {groups} showTable={table} caption="Funnel per arm for {a.def.title}" />
{#if email}<p class="mh-hint">*Opens are overstated by Apple Mail Privacy Protection.</p>{/if}
