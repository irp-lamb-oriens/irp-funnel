<script lang="ts">
  /**
   * Portfolio — one card per experiment: verdict (from ALL data), days
   * running, visitors per arm, intended vs actual split, the primary metric
   * per arm (counts below the floor, forest plot above it), chance of being
   * best and time to decision.
   */
  import type { ExperimentAnalysis } from '../engine/experiment.ts';
  import { STATE_LABEL } from '../engine/rules.ts';
  import { armLabel } from '../engine/join.ts';
  import { metricDef } from '../engine/metrics.ts';
  import SplitBar from '../../metrics/charts/SplitBar.svelte';
  import ForestPlot from '../../metrics/charts/ForestPlot.svelte';
  import { chance, evidence, floorLine, forecastLine, int, pct, STATE_TONE } from './words.ts';

  export let analyses: ExperimentAnalysis[] = [];
  export let decisionOf: Map<string, ExperimentAnalysis>;
  export let selected = '';
  export let onSelect: (key: string) => void;

  const SURFACE = { web: 'Website', chat: 'Chatbot', email: 'Email' } as const;
  const below = (a: ExperimentAnalysis) => ['too_early', 'data_problem'].includes(a.decision.state);

  function forest(a: ExperimentAnalysis) {
    return a.primary.arms.map((r) => {
      const ci = r.n ? wilsonRange(r.x, r.n) : null;
      return { key: r.arm, label: armLabel(a.def, r.arm), value: r.rate, lo: ci?.lo ?? null, hi: ci?.hi ?? null, display: pct(r.rate), range: ci ? `${pct(ci.lo)} – ${pct(ci.hi)}` : '—', control: r.arm === a.def.control };
    });
  }
  function wilsonRange(x: number, n: number) {
    const z = 1.96, p = x / n, z2 = z * z, den = 1 + z2 / n;
    const c = (p + z2 / (2 * n)) / den, h = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / den;
    return { lo: Math.max(0, c - h), hi: Math.min(1, c + h) };
  }
</script>

{#if !analyses.length}
  <p class="mh-empty">No experiments match these filters.</p>
{:else}
  <div class="evo-portfolio">
    {#each analyses as a (a.def.componentKey)}
      {@const d = decisionOf.get(a.def.componentKey) ?? a}
      {@const m = metricDef(a.def.primaryMetric)}
      <article class="evo-card" class:evo-card--selected={selected === a.def.componentKey}>
        <button class="evo-card__hit" aria-pressed={selected === a.def.componentKey} on:click={() => onSelect(a.def.componentKey)}>
          <span class="sr-only">Open {a.def.title}</span>
        </button>
        <header class="evo-card__head">
          <div>
            <h4 class="evo-card__title">{a.def.title}</h4>
            <p class="mh-muted">{SURFACE[a.def.surface]} · {a.def.status === 'running' ? `day ${Math.floor(a.runDays)}` : a.def.status} · decides on <b>{m.label.toLowerCase()}</b></p>
          </div>
          <span class="evo-state evo-state--{STATE_TONE[d.decision.state]}">{STATE_LABEL[d.decision.state]}</span>
        </header>
        <SplitBar compact arms={a.arms.map((k) => ({ key: k, label: armLabel(a.def, k), intended: a.srm?.expected[k] ?? 1 / a.arms.length, actual: a.assigned[k] ?? 0 }))} />
        {#if below(d)}
          <table class="mh-table mh-table--compact evo-card__counts">
            <thead><tr><th scope="col">Arm</th><th scope="col" class="num">Visitors</th><th scope="col" class="num">{m.label}</th></tr></thead>
            <tbody>
              {#each a.primary.arms as r}
                <tr><th scope="row">{armLabel(a.def, r.arm)}</th><td class="num">{int((a.assigned[r.arm] ?? 0))}</td><td class="num">{int(r.x)}{r.maturing ? ` (+${int(r.maturing)} maturing)` : ''}</td></tr>
              {/each}
            </tbody>
          </table>
          <p class="evo-card__line">{d.decision.state === 'data_problem' ? d.decision.reason : floorLine(d) ?? d.decision.reason}</p>
        {:else}
          <ForestPlot rows={forest(a)} reference={a.primary.arms.find((r) => r.arm === a.def.control)?.rate ?? null} referenceLabel={armLabel(a.def, a.def.control)} format={(v) => pct(v)} caption="{a.def.title}: {m.label} per arm" />
          <p class="evo-card__line">{evidence(a, a.primary, true)}</p>
          {#if a.primary.pBest}
            <p class="mh-muted">Chance of being best: {a.arms.map((k) => `${armLabel(a.def, k)} ${chance(a.primary.pBest?.[k])}`).join(' · ')}</p>
          {/if}
        {/if}
        {#if forecastLine(d)}<p class="evo-card__forecast">⏱ {forecastLine(d)}</p>{/if}
      </article>
    {/each}
  </div>
{/if}
