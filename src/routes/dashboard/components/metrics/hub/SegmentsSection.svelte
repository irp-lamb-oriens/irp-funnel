<script lang="ts">
  /**
   * SegmentsSection — one table, any dimension: how each segment converts and
   * what it's worth. All columns are cohort-based (leads of the period,
   * followed to today) so they can be read across a row. A ▲/▼ appears when
   * the segment's 95% range sits entirely above/below the overall rate.
   */
  import { DIMENSIONS, DIM, MEASURE, inCohort } from '../engine/registry.ts';
  import { aggregate, groupBy } from '../engine/cube.ts';
  import { days, money, pct } from '../engine/format.ts';
  import { wilson } from '../engine/stats.ts';
  import type { Ctx, LeadFact } from '../engine/types.ts';
  import { addFilter } from './hubState.ts';

  export let rows: LeadFact[] = [];
  export let ctx: Ctx;
  export let dim = 'channel';

  const DIMS = DIMENSIONS.filter((d) => d.phase !== 'outcome' || d.key === 'providers');
  const COLS = [
    { key: 'leads', label: 'Leads' },
    { key: 'quoteRate', label: 'Quote rate' },
    { key: 'winRate', label: 'Win rate' },
    { key: 'matureWinRate', label: '60-day win' },
    { key: 'bookedPerLead', label: 'Booked / lead' },
    { key: 'avgDeal', label: 'Avg deal' },
    { key: 'marginPerLead', label: 'Margin / lead' },
    { key: 'daysToClose', label: 'Days to close' },
  ] as const;
  let sortKey: string = 'leads';
  let sortDir: 1 | -1 = -1;

  type Row = { key: string; label: string; vals: Record<string, number | null>; n: Record<string, number>; tone: 'good' | 'bad' | null; muted: boolean };

  function cohortAvgDeal(rs: LeadFact[]): number | null {
    let b = 0, n = 0;
    for (const r of rs) if (inCohort(r, ctx) && r.won) { const v = r.money[ctx.currency]?.booked ?? 0; if (v > 0) { b += v; n++; } }
    return n ? b / n : null;
  }
  function build(rs: LeadFact[], key: string, label: string, base: number | null): Row {
    const vals: Record<string, number | null> = {}, n: Record<string, number> = {};
    for (const c of COLS) {
      if (c.key === 'leads') { const v = rs.filter((r) => inCohort(r, ctx)).length; vals.leads = v; n.leads = v; continue; }
      if (c.key === 'avgDeal') { vals.avgDeal = cohortAvgDeal(rs); continue; }
      const mv = aggregate(rs, c.key, ctx);
      vals[c.key] = mv.value;
      n[c.key] = mv.n;
    }
    const w = aggregate(rs, 'winRate', ctx);
    let tone: Row['tone'] = null;
    if (base !== null && w.den && w.den >= 10) {
      const ci = wilson(w.num ?? 0, w.den);
      if (ci.lo > base) tone = 'good';
      else if (ci.hi < base) tone = 'bad';
    }
    return { key, label, vals, n, tone, muted: key === '__rest__' };
  }

  $: base = aggregate(rows, 'winRate', ctx).value;
  $: total = build(rows, '__all__', 'All leads', null);
  $: groups = groupBy(rows, dim, ['leads'], ctx, { top: 14, cohortOnly: true });
  $: table = groups.map((g) => build(g.rows, g.key, g.label, base));
  $: sorted = DIM[dim]?.order || dim === 'leadMonth' || dim === 'leadQuarter'
    ? (sortKey === 'leads' && sortDir === -1 ? table : [...table].sort((a, b) => sortDir * ((a.vals[sortKey] ?? -Infinity) - (b.vals[sortKey] ?? -Infinity))))
    : [...table].sort((a, b) => (a.muted ? 1 : b.muted ? -1 : sortDir * ((a.vals[sortKey] ?? -Infinity) - (b.vals[sortKey] ?? -Infinity))));

  function cell(key: string, v: number | null): string {
    const m = MEASURE[key];
    if (key === 'leads') return v === null ? '—' : v.toLocaleString('en-US');
    if (key === 'avgDeal' || m?.kind === 'money') return money(v, ctx.currency, true);
    if (m?.kind === 'days') return days(v);
    return pct(v);
  }
  function sortBy(k: string) {
    if (sortKey === k) sortDir = (sortDir === 1 ? -1 : 1);
    else { sortKey = k; sortDir = -1; }
  }
  $: multi = !!DIM[dim]?.multi;
</script>

<div class="sg-tools">
  <label class="mh-control">
    <span class="mh-label">Split leads by</span>
    <select class="mh-input" bind:value={dim}>
      {#each ['Marketing', 'Move', 'Lead', 'Time', 'Sales'] as g}
        <optgroup label={g}>{#each DIMS.filter((d) => d.group === g) as d}<option value={d.key}>{d.label}</option>{/each}</optgroup>
      {/each}
    </select>
  </label>
  <p class="mh-hint">Leads of the period, followed to today · click a segment to filter the page{multi ? ' · providers overlap, so rows don\'t add up' : ''}</p>
</div>

<div class="mh-table-wrap">
  <table class="mh-table">
    <caption class="sr-only">Segments by {DIM[dim]?.label}</caption>
    <thead>
      <tr>
        <th scope="col">{DIM[dim]?.label}</th>
        {#each COLS as c}
          <th scope="col" class="num" aria-sort={sortKey === c.key ? (sortDir === 1 ? 'ascending' : 'descending') : 'none'}>
            <button class="mh-th-btn" on:click={() => sortBy(c.key)} title={MEASURE[c.key]?.def ?? 'Booked ÷ won deals among the period\'s leads'}>{c.label}{sortKey === c.key ? (sortDir === 1 ? ' ↑' : ' ↓') : ''}</button>
          </th>
        {/each}
      </tr>
    </thead>
    <tbody>
      {#each sorted as r (r.key)}
        <tr class:sg-muted={r.muted}>
          <th scope="row">
            {#if r.muted}<span class="mh-muted">{r.label}</span>{:else}
              <button class="sg-pick" on:click={() => addFilter({ dim, values: [r.key] })} title="Filter the page to {r.label}">{r.label}</button>
            {/if}
          </th>
          {#each COLS as c}
            <td class="num">
              {#if c.key === 'winRate' && r.tone}
                <span class={r.tone === 'good' ? 'mh-good' : 'mh-bad'}><span aria-hidden="true">{r.tone === 'good' ? '▲' : '▼'}</span> {cell(c.key, r.vals[c.key])}<span class="sr-only">{r.tone === 'good' ? ', clearly above average' : ', clearly below average'}</span></span>
              {:else}
                {cell(c.key, r.vals[c.key])}
              {/if}
              {#if c.key === 'matureWinRate' && r.n.matureWinRate !== undefined}<span class="mh-muted"> ({r.n.matureWinRate})</span>{/if}
            </td>
          {/each}
        </tr>
      {:else}
        <tr><td colspan={COLS.length + 1} class="mh-empty">No leads in this period.</td></tr>
      {/each}
    </tbody>
    <tfoot>
      <tr>
        <th scope="row">All leads</th>
        {#each COLS as c}<td class="num">{cell(c.key, total.vals[c.key])}{#if c.key === 'matureWinRate'}<span class="mh-muted"> ({total.n.matureWinRate ?? 0})</span>{/if}</td>{/each}
      </tr>
    </tfoot>
  </table>
</div>

<style>
  .sg-tools { display: flex; align-items: flex-end; gap: 1rem; flex-wrap: wrap; margin-bottom: 0.7rem; }
  .sg-pick { all: unset; cursor: pointer; font-weight: 700; color: #0f172a; text-decoration: underline; text-decoration-color: rgba(2, 181, 187, 0.4); text-underline-offset: 3px; }
  .sg-pick:hover { color: #02868a; }
  .sg-pick:focus-visible { outline: 2px solid #02b5bb; outline-offset: 2px; border-radius: 3px; }
  .sg-muted th, .sg-muted td { color: #94a3b8 !important; }
  .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
</style>
