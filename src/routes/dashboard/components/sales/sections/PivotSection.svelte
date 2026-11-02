<script lang="ts">
  /**
   * Pivot — the Hub's Explorer, mounted with MONEY measures only and no
   * combination finder (sales-book-v3 §5.6). Clicks become Sales Book filter
   * chips (never the Hub's). Preset questions set the pivot in one click.
   */
  import ExplorerSection from '../../metrics/hub/ExplorerSection.svelte';
  import type { Filter } from '../../metrics/engine/types.ts';
  import type { PivotState } from '../salesBookState.ts';
  import type { Book } from '../types.ts';

  export let book: Book;
  export let state: PivotState;
  export let onFilter: (fs: Filter[]) => void = () => {};

  const MONEY_MEASURES = ['booked', 'cash', 'margin', 'marginPct', 'invoiced', 'avgDeal', 'won', 'paid', 'openQuotes', 'forecast', 'receivable'];
  const PRESETS: Array<{ label: string; s: PivotState }> = [
    { label: 'Booked by route × service', s: { m: ['booked'], r: 'route', c: 'service', n: 10, v: 'chart' } },
    { label: 'Average deal by budget band', s: { m: ['avgDeal', 'won', 'booked'], r: 'budget', c: '', n: 12, v: 'chart' } },
    { label: 'Margin % by destination', s: { m: ['marginPct', 'margin', 'booked'], r: 'destination', c: '', n: 12, v: 'chart' } },
    { label: 'Booked by channel × month', s: { m: ['booked'], r: 'channel', c: 'leadMonth', n: 10, v: 'chart' } },
    { label: 'Booked by move size', s: { m: ['booked', 'avgDeal', 'won'], r: 'size', c: '', n: 12, v: 'chart' } },
    { label: 'Open quotes by service', s: { m: ['openQuotes', 'forecast'], r: 'service', c: '', n: 12, v: 'chart' } },
  ];
  $: filterKey = `${book.filters.map((f) => `${f.dim}:${f.values.join('|')}`).join(',')}|${book.rows.length}`;
</script>

{#if !book.cubeOk}
  <p class="mh-empty">Segment data unavailable.</p>
{:else}
  <div class="sb-presets" role="group" aria-label="Preset questions">
    {#each PRESETS as p}
      <button class="mh-btn mh-btn--sm" on:click={() => (state = { ...p.s, m: [...p.s.m] })}>{p.label}</button>
    {/each}
  </div>
  <div class="sb-pivot">
    <ExplorerSection rows={book.rows} ctx={book.ctx} {filterKey} {state} measures={MONEY_MEASURES} finder={false} exportName="sales-pivot"
      on:state={(e) => (state = e.detail)} on:filter={(e) => onFilter(e.detail)} />
  </div>
  <p class="mh-hint">Money is in {book.currency}; nothing is converted. Conversion rates and the "what works" finder live on the Metrics tab.</p>
{/if}
