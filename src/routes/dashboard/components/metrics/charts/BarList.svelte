<script lang="ts">
  /**
   * BarList — ranked horizontal bars with up to a few extra value columns.
   * It is a real <table>, so the numbers are always readable without the bar.
   * Clicking a row label dispatches `select` (the Hub adds it as a filter).
   */
  import { createEventDispatcher } from 'svelte';
  import type { BarRow } from './types.ts';


  export let rows: BarRow[] = [];
  export let valueLabel = 'Value';
  export let labelHeader = 'Segment';
  export let columns: string[] = [];
  export let color = '#00a3aa';
  export let selectable = false;
  export let caption = '';

  const dispatch = createEventDispatcher<{ select: { key: string; label: string } }>();
  $: max = Math.max(0, ...rows.map((r) => r.value));
</script>

<div class="bl-wrap">
  <table class="bl">
    {#if caption}<caption class="sr-only">{caption}</caption>{/if}
    <thead>
      <tr>
        <th scope="col">{labelHeader}</th>
        <th scope="col" class="bl-barcol">{valueLabel}</th>
        {#each columns as c}<th scope="col" class="num">{c}</th>{/each}
      </tr>
    </thead>
    <tbody>
      {#each rows as r (r.key)}
        <tr class:bl-muted={r.muted}>
          <th scope="row" title={r.title ?? r.label}>
            {#if selectable && !r.muted}
              <button class="bl-pick" on:click={() => dispatch('select', { key: r.key, label: r.label })} title="Filter to {r.label}">{r.label}</button>
            {:else}
              <span class="bl-name">{r.label}</span>
            {/if}
          </th>
          <td class="bl-barcol">
            <div class="bl-bar">
              <span class="bl-track"><span class="bl-fill" style="width:{max > 0 ? Math.max(1.5, (r.value / max) * 100) : 0}%; background:{r.muted ? '#cbd5e1' : color}"></span></span>
              <span class="bl-val">{r.display}</span>
            </div>
          </td>
          {#each r.cells ?? [] as c, ci}
            <td class="num" class:bl-good={ci === 0 && r.tone === 'good'} class:bl-bad={ci === 0 && r.tone === 'bad'}>
              {#if ci === 0 && r.tone === 'good'}<span aria-hidden="true">▲ </span>{:else if ci === 0 && r.tone === 'bad'}<span aria-hidden="true">▼ </span>{/if}{c}
            </td>
          {/each}
        </tr>
      {/each}
    </tbody>
  </table>
</div>

<style>
  .bl-wrap { overflow-x: auto; }
  .bl { width: 100%; border-collapse: collapse; font-size: 0.8rem; }
  .bl thead th { text-align: left; padding: 0.35rem 0.5rem; color: #94a3b8; font-size: 0.64rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; white-space: nowrap; border-bottom: 1px solid #e2e8f0; }
  .bl tbody th, .bl td { padding: 0.32rem 0.5rem; border-bottom: 1px solid #f1f5f9; font-variant-numeric: tabular-nums; color: #334155; }
  .bl tbody th { text-align: left; font-weight: 600; color: #0f172a; max-width: 220px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .bl .num { text-align: right; white-space: nowrap; }
  .bl-barcol { width: 42%; min-width: 140px; }
  .bl-bar { display: flex; align-items: center; gap: 0.5rem; }
  .bl-track { flex: 1; height: 10px; background: #f1f5f9; border-radius: 0 5px 5px 0; overflow: hidden; }
  .bl-fill { display: block; height: 100%; border-radius: 0 4px 4px 0; transition: width 0.25s cubic-bezier(0.16, 1, 0.3, 1); }
  .bl-val { min-width: 64px; text-align: right; font-weight: 700; color: #0f172a; }
  .bl-pick { background: none; border: none; padding: 0; font: inherit; font-weight: 600; color: #0f172a; cursor: pointer; text-decoration: underline; text-decoration-color: rgba(2, 181, 187, 0.4); text-underline-offset: 3px; max-width: 100%; overflow: hidden; text-overflow: ellipsis; }
  .bl-pick:hover { color: #02868a; }
  .bl-pick:focus-visible { outline: 2px solid #02b5bb; outline-offset: 2px; border-radius: 3px; }
  .bl-muted th, .bl-muted td { color: #94a3b8; }
  .bl-good { color: #047857 !important; font-weight: 700; }
  .bl-bad { color: #b91c1c !important; font-weight: 700; }
  .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
  @media (prefers-reduced-motion: reduce) { .bl-fill { transition: none; } }
</style>
