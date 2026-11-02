<script lang="ts">
  /** History — hypothesis per variant, the test's setup, and decisions recorded. */
  import type { ExperimentAnalysis } from '../../engine/experiment.ts';
  import type { EvoCube } from '../../engine/types.ts';
  import { armLabel } from '../../engine/join.ts';
  import { metricDef } from '../../engine/metrics.ts';
  import { pct } from '../words.ts';

  export let a: ExperimentAnalysis;
  export let cube: EvoCube;
  export let decisions: any[] = [];

  $: mine = decisions.filter((d) => d.componentKey === a.def.componentKey).sort((x, y) => String(y.at).localeCompare(String(x.at)));
  $: legacy = cube.legacy.rows.filter((r) => r.componentKey === a.def.componentKey);
</script>

<div class="mh-grid-2">
  <div class="mh-card">
    <h4 class="mh-card__h">Setup</h4>
    <ul class="evo-list">
      <li>Started {new Date(a.def.startedAt).toLocaleDateString('en-US', { dateStyle: 'medium', timeZone: 'America/Costa_Rica' })} · status {a.def.status}</li>
      <li>Decides on <b>{metricDef(a.def.primaryMetric).label}</b>; guardrails: {a.def.guardrails.map((g) => metricDef(g).label).join(', ') || 'none'}</li>
      <li>Split: {a.arms.map((k) => `${armLabel(a.def, k)} ${pct(a.srm?.expected[k] ?? 1 / a.arms.length, 0)}`).join(' / ')} (fixed)</li>
      {#if a.def.appliesTo?.length}<li>Applies to emails: {a.def.appliesTo.join(', ')}</li>{/if}
    </ul>
  </div>
  <div class="mh-card">
    <h4 class="mh-card__h">Variants and hypotheses</h4>
    <ul class="evo-list">
      {#each a.def.variants as v}
        <li><b>{v.label ?? v.key}</b>{v.key === a.def.control ? ' (control)' : ''}{v.retiredIn ? ' · retired' : ''} — {v.hypothesis ?? 'no hypothesis written'}</li>
      {/each}
    </ul>
  </div>
</div>
<h4 class="mh-card__h" style="margin-top: 1rem">Decisions</h4>
{#if mine.length}
  <div class="mh-table-wrap"><table class="mh-table mh-table--compact">
    <thead><tr><th scope="col">When</th><th scope="col">Decision</th><th scope="col">By</th><th scope="col">Note</th></tr></thead>
    <tbody>{#each mine as d}<tr class:evo-reverted={d.revertedBy}><th scope="row">{String(d.at).slice(0, 10)}</th><td>{d.decision}{d.variant ? ` · ${armLabel(a.def, d.variant)}` : ''}{d.revertedBy ? ' (reverted)' : ''}</td><td>{d.by}</td><td>{d.note}</td></tr>{/each}</tbody>
  </table></div>
{:else}
  <p class="mh-empty">No decision recorded for this experiment.</p>
{/if}
{#if legacy.length}
  <p class="mh-hint">Before the restart this component had {legacy.reduce((s, r) => s + r.visitors, 0)} visitors (descriptive only; see Operations → Before Evo Lab).</p>
{/if}
