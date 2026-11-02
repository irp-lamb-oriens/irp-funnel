<script lang="ts">
  /**
   * FunnelSection — the cohort funnel, optionally split into up to four
   * segments side by side. This is the one funnel view the Sales Report
   * can't give: "do chatbot leads leak at the same step as form leads?"
   * Same stage-reach rule as the Sales Report funnel (server stageReach).
   */
  import { DIMENSIONS, DIM } from '../engine/registry.ts';
  import { funnelCounts, groupBy } from '../engine/cube.ts';
  import { pct } from '../engine/format.ts';
  import { seriesColor } from '../charts/palette.ts';
  import type { Ctx, LeadFact, MetricsCube } from '../engine/types.ts';
  import { addFilter } from './hubState.ts';

  export let rows: LeadFact[] = [];
  export let ctx: Ctx;
  export let cube: MetricsCube;
  export let onOpenSales: (() => void) | null = null;

  let split = '';
  const DIMS = DIMENSIONS.filter((d) => d.phase !== 'outcome' && !d.multi && d.key !== 'leadMonth');

  $: stages = cube.funnelStages;
  $: segs = (() => {
    const all = { key: '__all__', label: 'All leads', rows };
    if (!split) return [all];
    const g = groupBy(rows, split, ['leads'], ctx, { cohortOnly: true }).filter((x) => x.key !== '__rest__').sort((a, b) => b.leads - a.leads).slice(0, 4);
    return g.map((x) => ({ key: x.key, label: x.label, rows: x.rows }));
  })();
  $: data = segs.map((s, i) => {
    const counts = funnelCounts(s.rows, stages.map((x) => x.stage), ctx);
    return { ...s, color: seriesColor(i), counts, base: counts[0] || 0 };
  });
  $: drops = (() => {
    const set = new Set(ctx.months);
    const cohort = rows.filter((r) => r.isLead && (ctx.allTime || (r.leadMonth && set.has(r.leadMonth))));
    const by: Record<string, number> = {};
    for (const r of cohort) if (r.dropKind) by[r.dropKind] = (by[r.dropKind] ?? 0) + 1;
    return by;
  })();
  const DROP_LABEL: Record<string, string> = { noShow: 'No-show', nonQualified: 'Not qualified', saleDropped: 'Sale dropped' };
</script>

<div class="fn-tools">
  <label class="mh-control">
    <span class="mh-label">Compare funnels by</span>
    <select class="mh-input" bind:value={split}>
      <option value="">— one funnel —</option>
      {#each DIMS as d}<option value={d.key}>{d.label}</option>{/each}
    </select>
  </label>
  {#if data.length > 1}
    <ul class="fn-legend" aria-label="Segments">
      {#each data as s}<li><span class="fn-key" style="background:{s.color}"></span>{s.label} <span class="mh-muted">({s.base})</span></li>{/each}
    </ul>
  {/if}
</div>

<ol class="fn">
  {#each stages as st, i}
    <li class="fn-step">
      <div class="fn-label">{st.label}</div>
      <div class="fn-bars">
        {#each data as s}
          {@const c = s.counts[i]}
          {@const share = s.base ? c / s.base : 0}
          {@const conv = i > 0 && s.counts[i - 1] ? c / s.counts[i - 1] : null}
          <div class="fn-bar" title="{s.label}: {c} of {s.base} leads reached {st.label}">
            <span class="fn-track"><span class="fn-fill" style="width:{Math.max(share > 0 ? 1.5 : 0, share * 100)}%;background:{s.color}"></span></span>
            <span class="fn-num"><strong>{c}</strong> <span class="mh-muted">{pct(share, 0)}{conv !== null ? ` · ${pct(conv, 0)} step` : ''}</span></span>
          </div>
        {/each}
      </div>
    </li>
  {/each}
</ol>

<div class="fn-foot">
  {#if Object.keys(drops).length}
    <span class="mh-label">Dropped</span>
    {#each Object.entries(drops) as [k, n]}
      <button class="mh-chip mh-chip--exclude fn-drop" on:click={() => addFilter({ dim: 'dropKind', values: [k] })} title="Filter to {DROP_LABEL[k] ?? k}">{DROP_LABEL[k] ?? k}: {n}</button>
    {/each}
  {/if}
  {#if onOpenSales}<button class="mh-link fn-sales" on:click={onOpenSales}>See the deals behind this funnel in the Sales Report →</button>{/if}
</div>
<p class="mh-hint">Leads of the period. "Step" is the share of the previous stage that made it here. A lead that skipped a stage on the board still counts as having passed it.</p>

<style>
  .fn-tools { display: flex; align-items: flex-end; gap: 1rem; flex-wrap: wrap; margin-bottom: 0.8rem; }
  .fn-legend { display: flex; gap: 0.9rem; flex-wrap: wrap; list-style: none; margin: 0; padding: 0 0 0.35rem; font-size: 0.76rem; color: #334155; font-weight: 600; }
  .fn-legend li { display: inline-flex; align-items: center; gap: 0.35rem; }
  .fn-key { width: 10px; height: 10px; border-radius: 3px; display: inline-block; }
  .fn { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.4rem; }
  .fn-step { display: grid; grid-template-columns: 190px minmax(0, 1fr); gap: 0.8rem; align-items: center; padding: 0.3rem 0; border-bottom: 1px solid #f1f5f9; }
  .fn-label { font-size: 0.8rem; font-weight: 700; color: #0f172a; text-transform: capitalize; }
  .fn-bars { display: grid; gap: 4px; }
  .fn-bar { display: grid; grid-template-columns: minmax(0, 1fr) 150px; gap: 0.6rem; align-items: center; }
  .fn-track { height: 12px; background: #f1f5f9; border-radius: 0 6px 6px 0; overflow: hidden; }
  .fn-fill { display: block; height: 100%; border-radius: 0 4px 4px 0; transition: width 0.25s cubic-bezier(0.16, 1, 0.3, 1); }
  .fn-num { font-size: 0.76rem; font-variant-numeric: tabular-nums; color: #0f172a; white-space: nowrap; }
  .fn-foot { display: flex; align-items: center; gap: 0.45rem; flex-wrap: wrap; margin-top: 0.8rem; }
  .fn-drop { font: inherit; font-size: 0.74rem; font-weight: 700; padding-right: 0.7em; cursor: pointer; }
  .fn-sales { margin-left: auto; }
  @media (max-width: 720px) { .fn-step { grid-template-columns: minmax(0, 1fr); } .fn-bar { grid-template-columns: minmax(0, 1fr) 120px; } }
  @media (prefers-reduced-motion: reduce) { .fn-fill { transition: none; } }
</style>
