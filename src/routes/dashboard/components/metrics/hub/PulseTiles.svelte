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
  .pt-group__h { font-size: 0.64rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; color: #94a3b8; margin: 0 0 0.35rem 0.15rem; }
  .pt-row { display: grid; grid-auto-flow: column; grid-auto-columns: minmax(170px, 1fr); gap: 0.7rem; }
  .pt-tile {
    position: relative; padding: 0.85rem 0.95rem 0.8rem; background: #fff; border: 1px solid #e2e8f0; border-radius: 14px;
    border-left: 4px solid #02b5bb; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05); min-width: 0; display: flex; flex-direction: column;
  }
  .pt-tile--cohort { border-left-color: #6250d6; }
  .pt-tile--asOf { border-left-color: #f59e0b; }
  .pt-top { display: flex; justify-content: space-between; align-items: center; gap: 0.4rem; }
  .pt-label { margin: 0; font-size: 0.68rem; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.07em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .pt-info { flex: none; width: 18px; height: 18px; border-radius: 50%; border: 1px solid #e2e8f0; background: #f8fafc; color: #64748b; font: italic 700 0.68rem/1 Georgia, serif; cursor: pointer; padding: 0; }
  .pt-value { margin-top: 0.3rem; font-size: 1.5rem; font-weight: 800; color: #0f172a; font-variant-numeric: tabular-nums; letter-spacing: -0.01em; }
  .pt-delta { margin-top: 0.25rem; font-size: 0.72rem; font-weight: 700; }
  .pt-delta__vs { font-weight: 500; color: #94a3b8; }
  .pt-delta--better { color: #047857; }
  .pt-delta--worse { color: #b91c1c; }
  .pt-delta--neutral { color: #334155; }
  .pt-delta--flat { color: #94a3b8; }
  .pt-note { margin-top: 0.2rem; font-size: 0.7rem; color: #b45309; }
  .pt-spark { margin-top: auto; padding-top: 0.45rem; }
  .pt-more { margin-top: 0.4rem; font-size: 0.72rem; align-self: flex-start; }
  .pt-def { margin: 0.5rem 0 0; padding: 0.5rem 0.6rem; background: #f8fafc; border-radius: 8px; font-size: 0.74rem; line-height: 1.4; color: #334155; }
  .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
  @media (max-width: 1100px) { .pt-row { grid-auto-flow: row; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); } }
</style>
