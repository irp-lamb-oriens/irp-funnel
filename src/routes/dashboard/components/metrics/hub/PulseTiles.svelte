<script lang="ts">
  /**
   * PulseTiles — the headline numbers for the chosen view. Tiles are grouped
   * by basis (period events vs cohort rates vs as-of snapshots) so nobody
   * divides a period count by a cohort count in their head. Each shows its Δ
   * vs the comparison period in words, a 12-month sparkline and its
   * definition behind ⓘ. Money tiles link to the Sales Report.
   */
  import { MEASURE, basisLabel } from '../engine/registry.ts';
  import { aggregate, monthSeries } from '../engine/cube.ts';
  import { delta, fmtMeasure } from '../engine/format.ts';
  import type { Ctx, LeadFact } from '../engine/types.ts';
  import Sparkline from '../charts/Sparkline.svelte';

  export let rows: LeadFact[] = [];
  export let ctx: Ctx;
  export let cmpCtx: Ctx | null = null;
  export let cmpLabel = '';
  export let tiles: string[] = [];
  export let sparkMonths: string[] = [];
  export let onOpenSales: (() => void) | null = null;

  let openDef: string | null = null;

  $: cards = tiles.map((key) => {
    const m = MEASURE[key];
    const cur = aggregate(rows, key, ctx);
    const prev = cmpCtx && m.basis !== 'asOf' ? aggregate(rows, key, cmpCtx) : null;
    const spark = m.basis === 'asOf' ? [] : monthSeries(rows, key, sparkMonths, ctx).map((v) => v ?? 0);
    return { key, m, cur, d: delta(m, cur, prev, cmpLabel), spark, value: fmtMeasure(m, cur.value, ctx.currency, true) };
  });
  $: groups = (['period', 'cohort', 'asOf'] as const)
    .map((b) => ({ b, items: cards.filter((c) => c.m.basis === b) }))
    .filter((g) => g.items.length);
  const groupTitle = { period: 'In the period', cohort: 'Leads of the period, to today', asOf: 'As of today' };
</script>

<div class="pt">
  {#each groups as g}
    <div class="pt-group" role="group" aria-label={groupTitle[g.b]}>
      <div class="pt-group__h">{groupTitle[g.b]}</div>
      <div class="pt-row">
        {#each g.items as c (c.key)}
          <article class="pt-tile pt-tile--{c.m.basis}">
            <div class="pt-top">
              <h4 class="pt-label">{c.m.label}</h4>
              <button class="pt-info" aria-expanded={openDef === c.key} aria-label="What is {c.m.label}?" on:click={() => (openDef = openDef === c.key ? null : c.key)}>i</button>
            </div>
            <div class="pt-value">{c.value}</div>
            {#if c.d}
              <div class="pt-delta pt-delta--{c.d.tone}">
                <span aria-hidden="true">{c.d.glyph}</span> {c.d.text}
                <span class="pt-delta__vs">vs {cmpLabel}{c.d.tone === 'better' ? ' · better' : c.d.tone === 'worse' ? ' · worse' : ''}</span>
                <span class="sr-only">{c.d.sr}</span>
              </div>
            {:else if c.m.basis === 'asOf'}
              <div class="pt-delta pt-delta--flat">{basisLabel(c.m)}</div>
            {/if}
            {#if c.cur.note}<div class="pt-note">{c.cur.note}</div>{/if}
            {#if c.spark.length > 1}
              <div class="pt-spark"><Sparkline values={c.spark} width={140} height={28} label="{c.m.label}, last {c.spark.length} months" /></div>
            {/if}
            {#if c.m.kind === 'money' && c.m.basis === 'period' && onOpenSales}
              <button class="mh-link pt-more" on:click={onOpenSales}>Detail in Sales Report →</button>
            {/if}
            {#if openDef === c.key}<p class="pt-def">{c.m.def}</p>{/if}
          </article>
        {/each}
      </div>
    </div>
  {/each}
</div>

<style>
  .pt { display: flex; gap: 0.9rem; flex-wrap: wrap; margin-bottom: 1rem; }
  .pt-group { flex: 1 1 auto; min-width: 0; }
  .pt-group__h { font-size: var(--irp-fs-2xs); font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; color: var(--irp-text-dim); margin: 0 0 0.35rem 0.15rem; }
  .pt-row { display: grid; grid-auto-flow: column; grid-auto-columns: minmax(170px, 1fr); gap: 0.7rem; }
  .pt-tile {
    position: relative; padding: 0.85rem 0.95rem 0.8rem; background: var(--irp-surface); border: 1px solid var(--irp-line); border-radius: var(--irp-r-lg);
    border-left: 4px solid var(--irp-accent); box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05); min-width: 0; display: flex; flex-direction: column;
  }
  .pt-tile--cohort { border-left-color: var(--irp-violet-600); }
  .pt-tile--asOf { border-left-color: var(--irp-amber-500); }
  .pt-top { display: flex; justify-content: space-between; align-items: center; gap: 0.4rem; }
  .pt-label { margin: 0; font-size: var(--irp-fs-2xs); font-weight: 800; color: var(--irp-text-dim); text-transform: uppercase; letter-spacing: 0.07em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .pt-info { flex: none; width: 18px; height: 18px; border-radius: 50%; border: 1px solid var(--irp-line); background: var(--irp-surface-2); color: var(--irp-text-dim); font: italic 700 0.68rem/1 Georgia, serif; cursor: pointer; padding: 0; }
  .pt-value { margin-top: 0.3rem; font-size: 1.5rem; font-weight: 800; color: var(--irp-text); font-variant-numeric: tabular-nums; letter-spacing: -0.01em; }
  .pt-delta { margin-top: 0.25rem; font-size: var(--irp-fs-xs); font-weight: 700; }
  .pt-delta__vs { font-weight: 500; color: var(--irp-text-dim); }
  .pt-delta--better { color: var(--irp-green-700); }
  .pt-delta--worse { color: var(--irp-red-700); }
  .pt-delta--neutral { color: var(--irp-text-2); }
  .pt-delta--flat { color: var(--irp-text-dim); }
  .pt-note { margin-top: 0.2rem; font-size: var(--irp-fs-2xs); color: var(--irp-amber-700); }
  .pt-spark { margin-top: auto; padding-top: 0.45rem; }
  .pt-more { margin-top: 0.4rem; font-size: var(--irp-fs-xs); align-self: flex-start; }
  .pt-def { margin: 0.5rem 0 0; padding: 0.5rem 0.6rem; background: var(--irp-surface-2); border-radius: var(--irp-r-sm); font-size: var(--irp-fs-xs); line-height: 1.4; color: var(--irp-text-2); }
  .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
  @media (max-width: 1100px) { .pt-row { grid-auto-flow: row; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); } }
</style>
