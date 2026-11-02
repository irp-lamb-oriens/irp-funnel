<script lang="ts">
  /**
   * Heatmap — a cross-tab as a table whose cells are shaded on one sequential
   * teal ramp. The number is always printed, and its ink is picked from the
   * fill's lightness, so colour is never the only carrier. One tab stop: the
   * table itself; cells are read by screen readers as ordinary table cells.
   * Clicking a cell dispatches `select` with both keys.
   */
  import { createEventDispatcher } from 'svelte';
  import type { HeatCell } from './types.ts';
  import { seqColor, inkOn } from './palette.ts';


  export let rowLabels: Array<{ key: string; label: string }> = [];
  export let colLabels: Array<{ key: string; label: string }> = [];
  export let cells: HeatCell[][] = [];
  export let rowHeader = '';
  export let caption = '';
  export let selectable = false;
  /** Fixed domain for the ramp (e.g. 0..1 for rates); defaults to data range. */
  export let domain: [number, number] | null = null;

  const dispatch = createEventDispatcher<{ select: { row: string; col: string } }>();

  $: flat = cells.flat().map((c) => c.value).filter((v): v is number => v !== null && Number.isFinite(v));
  $: lo = domain ? domain[0] : Math.min(0, ...flat);
  $: hi = domain ? domain[1] : Math.max(0, ...flat);
  const t = (v: number | null) => (v === null ? -1 : hi > lo ? (v - lo) / (hi - lo) : 0);
</script>

<div class="hm-wrap">
  <table class="hm">
    {#if caption}<caption class="sr-only">{caption}</caption>{/if}
    <thead>
      <tr>
        <th scope="col" class="hm-corner">{rowHeader}</th>
        {#each colLabels as c}<th scope="col" title={c.label}>{c.label}</th>{/each}
      </tr>
    </thead>
    <tbody>
      {#each rowLabels as r, ri}
        <tr>
          <th scope="row" title={r.label}>{r.label}</th>
          {#each colLabels as c, ci}
            {@const cell = cells[ri]?.[ci]}
            {@const tt = t(cell?.value ?? null)}
            <td
              style={tt >= 0 ? `background:${seqColor(tt)};color:${inkOn(tt)}` : ''}
              class:hm-empty={tt < 0}
              title={cell?.title ?? `${r.label} × ${c.label}: ${cell?.display ?? '—'}`}
            >
              {#if selectable && cell && cell.n > 0}
                <button class="hm-pick" on:click={() => dispatch('select', { row: r.key, col: c.key })} aria-label="Filter to {r.label} and {c.label}: {cell.display}">{cell.display}</button>
              {:else}
                {cell?.display ?? '—'}
              {/if}
            </td>
          {/each}
        </tr>
      {/each}
    </tbody>
  </table>
</div>

<style>
  .hm-wrap { overflow: auto; max-height: 520px; }
  .hm { border-collapse: separate; border-spacing: 2px; font-size: 0.76rem; font-variant-numeric: tabular-nums; }
  .hm thead th { position: sticky; top: 0; background: #fff; z-index: 1; padding: 0.35rem 0.45rem; font-size: 0.64rem; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; max-width: 110px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .hm tbody th { position: sticky; left: 0; background: #fff; text-align: left; padding: 0.3rem 0.6rem 0.3rem 0; font-weight: 600; color: #0f172a; max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .hm td { min-width: 64px; padding: 0.4rem 0.45rem; text-align: center; border-radius: 6px; font-weight: 700; }
  .hm-empty { background: #f8fafc; color: #cbd5e1; font-weight: 500; }
  .hm-corner { text-align: left !important; }
  .hm-pick { all: unset; cursor: pointer; display: block; width: 100%; }
  .hm-pick:focus-visible { outline: 2px solid #0f172a; outline-offset: 2px; border-radius: 4px; }
  .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
</style>
