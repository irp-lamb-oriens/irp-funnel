<script lang="ts">
  /**
   * FilterPicker — "+ Filter" popover: pick a dimension, tick values, then
   * Include or Exclude. Values show how many leads carry them.
   */
  import { onDestroy, tick } from 'svelte';
  import { DIMENSIONS } from '../engine/registry.ts';
  import { dimensionValues } from '../engine/cube.ts';
  import type { LeadFact } from '../engine/types.ts';
  import { addFilter as hubAddFilter, type FilterState } from './hubState.ts';

  export let rows: LeadFact[] = [];
  /** Whose filters to add to (default: the Metrics Hub's). */
  export let target: FilterState | null = null;
  /** Count every row (Sales Book: deals without a lead record too), not only leads. */
  export let allRows = false;

  let open = false;
  let dim = 'channel';
  let picked = new Set<string>();
  let search = '';
  let root: HTMLDivElement;
  let firstInput: HTMLSelectElement;

  const groups = ['Marketing', 'Move', 'Lead', 'Time', 'Sales'] as const;
  $: values = open ? dimensionValues(allRows ? rows : rows.filter((r) => r.isLead), dim) : [];
  $: shown = values.filter((v) => !search || v.label.toLowerCase().includes(search.toLowerCase())).slice(0, 40);

  async function toggle() {
    open = !open;
    if (open) { picked = new Set(); search = ''; await tick(); firstInput?.focus(); }
  }
  function apply(exclude: boolean) {
    if (!picked.size) return;
    (target ? target.addFilter : hubAddFilter)({ dim, values: [...picked], exclude });
    open = false;
  }
  function onDoc(e: MouseEvent) { if (open && root && !root.contains(e.target as Node)) open = false; }
  function onKey(e: KeyboardEvent) { if (e.key === 'Escape' && open) { open = false; (root?.querySelector('button') as HTMLButtonElement | null)?.focus(); } }
  if (typeof document !== 'undefined') { document.addEventListener('mousedown', onDoc); document.addEventListener('keydown', onKey); }
  onDestroy(() => { if (typeof document !== 'undefined') { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); } });
  $: dim, (picked = new Set());
</script>

<div class="fp" bind:this={root}>
  <button class="mh-btn mh-btn--sm" aria-expanded={open} aria-haspopup="dialog" on:click={toggle}>＋ Filter</button>
  {#if open}
    <div class="fp-pop" role="dialog" aria-label="Add a filter">
      <label class="mh-control">
        <span class="mh-label">Dimension</span>
        <select class="mh-input" bind:value={dim} bind:this={firstInput}>
          {#each groups as g}
            <optgroup label={g}>
              {#each DIMENSIONS.filter((d) => d.group === g) as d}<option value={d.key}>{d.label}</option>{/each}
            </optgroup>
          {/each}
        </select>
      </label>
      {#if values.length > 8}
        <input class="mh-input fp-search" type="search" placeholder="Search values…" bind:value={search} aria-label="Search values" />
      {/if}
      <fieldset class="fp-values">
        <legend class="mh-label">Values</legend>
        {#each shown as v (v.value)}
          <label class="fp-val">
            <input type="checkbox" checked={picked.has(v.value)} on:change={(e) => { const s = new Set(picked); e.currentTarget.checked ? s.add(v.value) : s.delete(v.value); picked = s; }} />
            <span class="fp-name">{v.label}</span>
            <span class="fp-count">{v.count}</span>
          </label>
        {:else}
          <p class="mh-empty">No values.</p>
        {/each}
      </fieldset>
      <div class="fp-actions">
        <button class="mh-btn mh-btn--sm mh-btn--ghost" on:click={() => apply(true)} disabled={!picked.size}>Exclude</button>
        <button class="mh-btn mh-btn--sm mh-btn--primary" on:click={() => apply(false)} disabled={!picked.size}>Show only these</button>
      </div>
    </div>
  {/if}
</div>

<style>
  .fp { position: relative; }
  .fp-pop {
    position: absolute; top: calc(100% + 6px); left: 0; z-index: 20; width: 300px; max-width: calc(100vw - 32px);
    padding: 0.8rem; background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; box-shadow: 0 12px 32px rgba(15, 23, 42, 0.16);
    display: grid; gap: 0.6rem;
  }
  .fp-search { width: 100%; box-sizing: border-box; }
  .fp-values { border: none; margin: 0; padding: 0; max-height: 240px; overflow-y: auto; display: grid; gap: 1px; }
  .fp-val { display: grid; grid-template-columns: 18px 1fr auto; gap: 0.45rem; align-items: center; padding: 0.28rem 0.35rem; border-radius: 6px; font-size: 0.8rem; color: #334155; cursor: pointer; }
  .fp-val:hover { background: #f8fafc; }
  .fp-val input { accent-color: #02b5bb; }
  .fp-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .fp-count { font-size: 0.72rem; color: #94a3b8; font-variant-numeric: tabular-nums; }
  .fp-actions { display: flex; justify-content: flex-end; gap: 0.4rem; }
</style>
