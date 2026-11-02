<script lang="ts">
  /**
   * Combinations (spec §6.7) — experiments run at the same time on the same
   * visitors, so we can ask whether one changes another's effect
   * (interaction, false-discovery controlled), and explore which full
   * configuration does best (exploratory, shrunk). Locked until enough data.
   */
  import type { Lab } from '../engine/lab.ts';
  import type { EvoCube, MetricKey } from '../engine/types.ts';
  import { configurations, COMBO_RULES } from '../engine/combos.ts';
  import { armLabel } from '../engine/join.ts';
  import { metricDef } from '../engine/metrics.ts';
  import Heatmap from '../../metrics/charts/Heatmap.svelte';
  import LockedPanel from './LockedPanel.svelte';
  import { int, pct } from './words.ts';

  export let lab: Lab;
  export let cube: EvoCube;
  export let windowDays = 30;
  export let currency = 'USD';

  $: web = cube.experiments.filter((d) => d.surface !== 'email' && d.status === 'running');
  $: pairs = lab.pairs.pairs;
  $: sig = pairs.filter((p) => p.significant);
  $: closest = pairs.filter((p) => p.locked).sort((x, y) => y.minCell - x.minCell)[0];
  $: defOf = (k: string) => cube.experiments.find((d) => d.componentKey === k)!;

  let picked: string[] = [];
  let metric: MetricKey = 'lead';
  $: if (!picked.length && web.length >= 2) picked = web.slice(0, 2).map((d) => d.componentKey);
  $: table = picked.length >= 2 ? configurations(lab.joinedAll, picked, metric, { now: lab.options.now, windowDays, currency, leads: lab.leads }) : null;
  $: metricChoices = ['lead', 'callBooked', 'step:cta_click', 'step:first_user_message'] as MetricKey[];

  function toggle(k: string) {
    picked = picked.includes(k) ? picked.filter((x) => x !== k) : picked.length < 4 ? [...picked, k] : picked;
  }
  function heat(p: (typeof pairs)[number]) {
    const A = defOf(p.a), B = defOf(p.b);
    const ra = [...new Set(p.cells.map((c) => c.a))], rb = [...new Set(p.cells.map((c) => c.b))];
    return {
      rowLabels: ra.map((k) => ({ key: k, label: armLabel(A, k) })),
      colLabels: rb.map((k) => ({ key: k, label: armLabel(B, k) })),
      cells: ra.map((x) => rb.map((y) => { const c = p.cells.find((q) => q.a === x && q.b === y)!; return { value: c.rate, display: `${pct(c.rate)} · ${c.x}/${c.n}`, n: c.n }; })),
    };
  }
</script>

<section class="mh-section" id="evo-combos" aria-labelledby="evo-combos-h">
  <div class="mh-section__head">
    <div class="mh-section__title">
      <h3 class="mh-h" id="evo-combos-h">Combinations</h3>
      <p class="mh-sub">Does one test change another's result? Which full combination of versions does best?</p>
    </div>
    <p class="mh-hint">Every visitor is in several tests at once, so each pair of tests is also a 2 × 2 experiment.</p>
  </div>

  <h4 class="mh-card__h">Do the tests affect each other?</h4>
  {#if !pairs.length}
    <p class="mh-empty">Needs at least two web or chat tests running at the same time.</p>
  {:else if sig.length}
    {#each sig as p}
      {@const h = heat(p)}
      <div class="mh-card evo-combo">
        <p class="mh-strong">{p.sentence}</p>
        <Heatmap rowLabels={h.rowLabels} colLabels={h.colLabels} cells={h.cells} rowHeader={defOf(p.a).title} caption="{metricDef(p.metric).label} by {defOf(p.a).title} × {defOf(p.b).title}" domain={[0, Math.max(...p.cells.map((c) => c.rate ?? 0)) || 1]} />
      </div>
    {/each}
    <p class="mh-hint">{lab.pairs.tested} pair tests run, {lab.pairs.survivors} survive false-discovery control (q = {COMBO_RULES.q}).</p>
  {:else if lab.pairs.tested}
    <p class="mh-empty">No test changes another's effect ({lab.pairs.tested} pair tests run). You can read each test on its own.</p>
  {:else if closest}
    <LockedPanel title="Interaction check: {defOf(closest.a).title} × {defOf(closest.b).title}" need="Needs {COMBO_RULES.minCellConversions} {metricDef(closest.metric).label.toLowerCase()}s in every combination; the smallest has {closest.minCell}." have={closest.minCell} target={COMBO_RULES.minCellConversions} />
  {/if}

  <h4 class="mh-card__h" style="margin-top: 1.1rem">Explore configurations</h4>
  <div class="mh-tools" role="group" aria-label="Configuration explorer">
    {#each web as d}
      <label class="mh-toggle"><input type="checkbox" checked={picked.includes(d.componentKey)} on:change={() => toggle(d.componentKey)} /> {d.title}</label>
    {/each}
    <label class="mh-control"><span class="mh-label">Metric</span>
      <select class="mh-input" bind:value={metric}>{#each metricChoices as k}<option value={k}>{metricDef(k).label}</option>{/each}</select>
    </label>
  </div>
  {#if !table}
    <p class="mh-empty">Pick 2 to 4 tests.</p>
  {:else if table.locked}
    <LockedPanel title="Configuration ranking" need="Needs at least {COMBO_RULES.configMinCells} combinations with {COMBO_RULES.configMinConversions}+ {metricDef(metric).label.toLowerCase()}s; {table.readyCells} of {table.tested} have that." have={table.readyCells} target={COMBO_RULES.configMinCells} />
  {:else}
    <div class="mh-table-wrap">
      <table class="mh-table mh-table--compact">
        <caption class="sr-only">Configurations ranked by shrunk {metricDef(metric).label}</caption>
        <thead><tr>{#each picked as k}<th scope="col">{defOf(k).title}</th>{/each}<th scope="col" class="num">Visitors</th><th scope="col" class="num">Observed</th><th scope="col" class="num">Expected if additive</th><th scope="col" class="num">Best estimate</th></tr></thead>
        <tbody>
          {#each table.rows as r, i}
            <tr>
              {#each picked as k, j}{#if j === 0}<th scope="row">{armLabel(defOf(k), r.config[k])}</th>{:else}<td>{armLabel(defOf(k), r.config[k])}</td>{/if}{/each}
              <td class="num">{int(r.n)}</td><td class="num">{pct(r.rate)}</td><td class="num">{pct(r.pred)}</td><td class="num mh-strong">{pct(r.shrunk)}{i === 0 ? ' ★' : ''}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
    <p class="mh-hint">Exploratory: use it to choose the next test, not to ship. {table.tested} combinations seen, {table.hidden} hidden (fewer than {COMBO_RULES.configMinConversions} conversions). "Best estimate" pulls small combinations toward the additive expectation.</p>
  {/if}
</section>
