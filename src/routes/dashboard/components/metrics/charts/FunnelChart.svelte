<script lang="ts">
  /**
   * FunnelChart — side-by-side funnels (one column per group, e.g. per arm).
   * Each step is a bar scaled to the group's first step, with the count, the
   * share of the start and the step conversion printed. A table toggle shows
   * the same numbers. Reusable by the Metrics Hub's FunnelSection.
   */
  import { seriesColor } from './palette.ts';

  export let steps: Array<{ key: string; label: string }> = [];
  export let groups: Array<{ key: string; label: string; counts: Array<number | null> }> = [];
  export let showTable = false;
  export let caption = '';

  const pct = (a: number, b: number) => (b > 0 ? `${Math.round((a / b) * 1000) / 10}%` : '—');
</script>

{#if showTable}
  <div class="mh-table-wrap">
    <table class="mh-table mh-table--compact">
      {#if caption}<caption class="sr-only">{caption}</caption>{/if}
      <thead><tr><th scope="col">Step</th>{#each groups as g}<th scope="col" class="num">{g.label}</th><th scope="col" class="num">step %</th>{/each}</tr></thead>
      <tbody>
        {#each steps as s, i}
          <tr>
            <th scope="row">{s.label}</th>
            {#each groups as g}
              {@const c = g.counts[i]}
              {@const prev = i ? g.counts[i - 1] : null}
              <td class="num">{c ?? '—'}</td>
              <td class="num">{i && c !== null && prev ? pct(c, prev) : ''}</td>
            {/each}
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
{:else}
  <div class="fc" style="grid-template-columns: repeat({groups.length}, minmax(0, 1fr))" role="img" aria-label={caption || 'Funnel'}>
    {#each groups as g, gi}
      {@const first = g.counts[0] ?? 0}
      <div class="fc-col">
        <div class="fc-h" style="border-color: {seriesColor(gi)}">{g.label}</div>
        {#each steps as s, i}
          {@const c = g.counts[i]}
          {@const prev = i ? g.counts[i - 1] : null}
          <div class="fc-step">
            <div class="fc-label">{s.label}</div>
            <div class="fc-track"><div class="fc-fill" style="width: {first && c ? Math.max(2, (c / first) * 100) : 0}%; background: {seriesColor(gi)}"></div></div>
            <div class="fc-num">
              <b>{c ?? '—'}</b>
              {#if i && c !== null && first}<span>{pct(c, first)} of start</span>{/if}
              {#if i && c !== null && prev}<span class="fc-conv">→ {pct(c, prev)}</span>{/if}
            </div>
          </div>
        {/each}
      </div>
    {/each}
  </div>
{/if}

<style>
  .fc { display: grid; gap: 1rem; }
  .fc-col { min-width: 0; }
  .fc-h { font-size: 0.78rem; font-weight: 800; color: #0f172a; border-left: 4px solid; padding-left: 0.45rem; margin-bottom: 0.5rem; }
  .fc-step { margin-bottom: 0.45rem; }
  .fc-label { font-size: 0.7rem; color: #64748b; font-weight: 700; }
  .fc-track { height: 10px; background: #f1f5f9; border-radius: 5px; overflow: hidden; margin: 2px 0; }
  .fc-fill { height: 100%; border-radius: 5px; }
  .fc-num { display: flex; gap: 0.5rem; font-size: 0.72rem; color: #334155; font-variant-numeric: tabular-nums; flex-wrap: wrap; }
  .fc-num span { color: #94a3b8; }
  .fc-num .fc-conv { color: #334155; }
  .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
  @media (max-width: 640px) { .fc { grid-template-columns: minmax(0, 1fr) !important; } }
</style>
