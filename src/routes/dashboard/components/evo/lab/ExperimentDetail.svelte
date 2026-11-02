<script lang="ts">
  /**
   * ExperimentDetail — the selected experiment, as an ARIA tablist with
   * arrow-key navigation (spec §7.1.6): Scorecard, Over time, Funnel,
   * Clients, People, History. Numbers come from the (possibly filtered)
   * analysis `a`; the verdict always from `decision` (all data).
   */
  import { tick } from 'svelte';
  import type { ExperimentAnalysis } from '../engine/experiment.ts';
  import type { Lab } from '../engine/lab.ts';
  import type { EvoCube } from '../engine/types.ts';
  import { STATE_LABEL } from '../engine/rules.ts';
  import { DETAIL_TABS, type DetailTab } from './labState.ts';
  import { evidence, floorLine, forecastLine, STATE_ACTION, STATE_TONE } from './words.ts';
  import Scorecard from './detail/Scorecard.svelte';
  import OverTime from './detail/OverTime.svelte';
  import Funnel from './detail/Funnel.svelte';
  import Clients from './detail/Clients.svelte';
  import People from './detail/People.svelte';
  import History from './detail/History.svelte';

  export let a: ExperimentAnalysis;
  export let decision: ExperimentAnalysis;
  export let cube: EvoCube;
  export let lab: Lab;
  export let currency = 'USD';
  export let tab: DetailTab = 'scorecard';
  export let decisions: any[] = [];
  export let isAdmin = false;
  export let subset = false;
  export let onOpenClient: (id: string) => void;
  export let onRecord: (a: ExperimentAnalysis) => void;

  let peopleFilter: { arm: string; metric: string } | null = null;
  $: joined = lab.joined.find((j) => j.def.componentKey === a.def.componentKey)!;

  async function onKey(e: KeyboardEvent, i: number) {
    const n = DETAIL_TABS.length;
    let j = -1;
    if (e.key === 'ArrowRight') j = (i + 1) % n;
    else if (e.key === 'ArrowLeft') j = (i - 1 + n) % n;
    else if (e.key === 'Home') j = 0;
    else if (e.key === 'End') j = n - 1;
    if (j < 0) return;
    e.preventDefault();
    tab = DETAIL_TABS[j].key;
    await tick();
    document.getElementById(`evo-tab-${tab}`)?.focus();
  }
  function showPeople(arm: string, metric: string) {
    peopleFilter = { arm, metric };
    tab = 'people';
  }
</script>

<section class="mh-section evo-detail" id="evo-detail" aria-labelledby="evo-detail-h">
  <div class="mh-section__head">
    <div class="mh-section__title">
      <h3 class="mh-h" id="evo-detail-h">Experiment · {a.def.title}</h3>
      <p class="mh-sub"><span class="evo-state evo-state--{STATE_TONE[decision.decision.state]}">{STATE_LABEL[decision.decision.state]}</span> {decision.decision.reason}</p>
      <p class="mh-hint">{STATE_ACTION[decision.decision.state]} {floorLine(decision) ?? ''} {forecastLine(decision) ?? ''}</p>
    </div>
    {#if isAdmin}<button class="mh-btn mh-btn--sm mh-btn--primary" on:click={() => onRecord(decision)}>Record decision</button>{/if}
  </div>
  {#if subset}<p class="evo-subset-note">Subset numbers below. The verdict above uses all data.</p>{/if}
  <p class="evo-evidence">{evidence(a, a.primary, !['too_early', 'data_problem'].includes(decision.decision.state))}</p>

  <div class="evo-tabs" role="tablist" aria-label="{a.def.title} detail">
    {#each DETAIL_TABS as t, i}
      <button role="tab" id="evo-tab-{t.key}" aria-selected={tab === t.key} aria-controls="evo-panel-{t.key}" tabindex={tab === t.key ? 0 : -1} on:click={() => (tab = t.key)} on:keydown={(e) => onKey(e, i)}>{t.label}</button>
    {/each}
  </div>
  <select class="mh-input evo-tabs-select" aria-label="Detail view" bind:value={tab}>
    {#each DETAIL_TABS as t}<option value={t.key}>{t.label}</option>{/each}
  </select>

  <div class="evo-panel" role="tabpanel" id="evo-panel-{tab}" aria-labelledby="evo-tab-{tab}" tabindex="0">
    {#if tab === 'scorecard'}
      <Scorecard {a} {decision} {currency} onPeople={showPeople} />
    {:else if tab === 'time'}
      <OverTime {a} {joined} {cube} leads={lab.leads} windowDays={lab.options.windowDays} now={lab.options.now} {currency} />
    {:else if tab === 'funnel'}
      <Funnel {a} {joined} leads={lab.leads} />
    {:else if tab === 'clients'}
      <Clients {a} {joined} leads={lab.leads} {currency} {onOpenClient} />
    {:else if tab === 'people'}
      <People {a} {joined} leads={lab.leads} filter={peopleFilter} {onOpenClient} onClear={() => (peopleFilter = null)} windowDays={lab.options.windowDays} now={lab.options.now} {currency} />
    {:else if tab === 'history'}
      <History {a} {cube} {decisions} />
    {/if}
  </div>
</section>
