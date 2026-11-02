<script lang="ts">
  /**
   * BySegment — where the money comes from (sales-book-v3 §6.7). Deal basis:
   * deals FIRST accepted in the period, with all their money to date, so a
   * row never shows cash with nothing booked. The footer reconciles this with
   * the event basis the Scoreboard uses (§5.1).
   */
  import { DIMENSIONS, DIM } from '../../metrics/engine/registry.ts';
  import { csvEscape } from '../../metrics/engine/cube.ts';
  import { money as fmtMoney, pct, fmtStat } from '../../metrics/engine/format.ts';
  import { segmentTable, type SegmentRow } from '../../metrics/engine/sales.ts';
  import type { Filter } from '../../metrics/engine/types.ts';
  import type { Book } from '../types.ts';

  export let book: Book;
  export let onFilter: (f: Filter) => void = () => {};
  export let onMetrics: (extra?: Filter[], section?: string) => void = () => {};

  let dim = 'route';
  let sortKey: keyof SegmentRow = 'booked';
  let desc = true;
  const groups = ['Move', 'Marketing', 'Sales', 'Lead', 'Time'] as const;
  const money = (n: number | null | undefined) => fmtMoney(n, book.currency);

  $: t = book.cubeOk ? segmentTable(book.rows, dim, book.ctx) : null;
  $: multi = !!DIM[dim]?.multi;
  $: rows = t ? [...t.rows].sort((a, b) => {
    const x = a[sortKey] as number | string | null, y = b[sortKey] as number | string | null;
    const c = typeof x === 'string' || typeof y === 'string' ? String(x ?? '').localeCompare(String(y ?? '')) : ((x as number) ?? -Infinity) - ((y as number) ?? -Infinity);
    return desc ? -c : c;
  }) : [];
  function sortBy(k: keyof SegmentRow) { if (sortKey === k) desc = !desc; else { sortKey = k; desc = k !== 'label'; } }
  const COLS: Array<{ k: keyof SegmentRow; l: string }> = [
    { k: 'won', l: 'Deals won' }, { k: 'booked', l: 'Booked' }, { k: 'margin', l: 'Margin' }, { k: 'marginPct', l: 'Margin %' },
    { k: 'avgDeal', l: 'Avg deal' }, { k: 'cashToDate', l: 'Cash to date' }, { k: 'share', l: 'Share' }, { k: 'medianDaysToClose', l: 'Days to close' },
  ];
  $: r = t?.reconciliation;

  function exportCsv() {
    if (!t) return;
    const lines = [[DIM[dim]?.label ?? 'Segment', ...COLS.map((c) => c.l)].map(csvEscape).join(',')];
    for (const x of rows) lines.push([x.label, x.won, x.booked, x.margin, x.marginPct, x.avgDeal, x.cashToDate, x.share, x.medianDaysToClose].map(csvEscape).join(','));
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `sales-by-${dim}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
</script>

{#if !t}
  <p class="mh-empty">Segment data unavailable.</p>
{:else}
  <div class="mh-tools sb-seg-tools">
    <label class="mh-control"><span class="mh-label">Split by</span>
      <select class="mh-input" bind:value={dim}>
        {#each groups as g}<optgroup label={g}>{#each DIMENSIONS.filter((d) => d.group === g && d.phase !== 'outcome') as d}<option value={d.key}>{d.label}</option>{/each}</optgroup>{/each}
        <optgroup label="Outcome">{#each DIMENSIONS.filter((d) => d.phase === 'outcome') as d}<option value={d.key}>{d.label}</option>{/each}</optgroup>
      </select>
    </label>
    <button class="mh-btn mh-btn--sm" on:click={exportCsv} disabled={!rows.length}>Export CSV</button>
  </div>
  {#if multi}<p class="mh-hint">A deal with several providers appears under each, so rows overlap and there is no total.</p>{/if}
  {#if !rows.length}
    <p class="mh-empty">No deals won in {book.rangeLabel}{book.filtersActive ? ' with these filters' : ''}.</p>
  {:else}
    <div class="mh-table-wrap">
      <table class="mh-table sb-cards">
        <thead>
          <tr>
            <th scope="col" aria-sort={sortKey === 'label' ? (desc ? 'descending' : 'ascending') : undefined}><button class="mh-th-btn" on:click={() => sortBy('label')}>{DIM[dim]?.label}</button></th>
            {#each COLS as c}<th scope="col" class="num" aria-sort={sortKey === c.k ? (desc ? 'descending' : 'ascending') : undefined}><button class="mh-th-btn" on:click={() => sortBy(c.k)}>{c.l}{sortKey === c.k ? (desc ? ' ▾' : ' ▴') : ''}</button></th>{/each}
            <th scope="col"><span class="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          {#each rows as x (x.key)}
            <tr>
              <th scope="row" data-label={DIM[dim]?.label}><button class="sb-name" on:click={() => onFilter({ dim, values: [x.key] })} title="Filter the whole page to {x.label}">{x.label}</button></th>
              <td class="num" data-label="Deals won">{x.won}</td>
              <td class="num" data-label="Booked">{money(x.booked)}</td>
              <td class="num" data-label="Margin">{money(x.margin)}</td>
              <td class="num" data-label="Margin %">{pct(x.marginPct)}</td>
              <td class="num" data-label="Avg deal" title={fmtStat('average', x.avgDeal, x.won).title}>{fmtStat('average', x.avgDeal, x.won, { fmt: (v) => money(v) }).text}</td>
              <td class="num" data-label="Cash to date">{money(x.cashToDate)}</td>
              <td class="num" data-label="Share">{multi ? '—' : pct(x.share)}</td>
              <td class="num" data-label="Days to close">{fmtStat('median', x.medianDaysToClose, x.won, { fmt: (v) => `${Math.round(v)} d` }).text}</td>
              <td data-label=""><button class="mh-link" on:click={() => onMetrics([{ dim, values: [x.key] }], 'mh-segments')}>Conversion →</button></td>
            </tr>
          {/each}
        </tbody>
        {#if !multi}
          <tfoot>
            <tr>
              <th scope="row">All</th>
              <td class="num">{t.total.won}</td><td class="num">{money(t.total.booked)}</td><td class="num">{money(t.total.margin)}</td>
              <td class="num">{pct(t.total.marginPct)}</td><td class="num">{money(t.total.avgDeal)}</td><td class="num">{money(t.total.cashToDate)}</td>
              <td class="num">100%</td><td class="num">{fmtStat('median', t.total.medianDaysToClose, t.total.won, { fmt: (v) => `${Math.round(v)} d` }).text}</td><td></td>
            </tr>
          </tfoot>
        {/if}
      </table>
    </div>
    {#if r && !book.allTime}
      <details class="sb-recon">
        <summary>Why this differs from the Scoreboard</summary>
        <p>
          This table counts <strong>deals won in {book.rangeLabel}</strong> with all their money to date. The Scoreboard counts money <strong>when it happened</strong>.
        </p>
        <table class="mh-table mh-table--compact">
          <tbody>
            <tr><th scope="row">Booked here · deals won in the period</th><td class="num">{money(r.dealBooked)}</td></tr>
            <tr><th scope="row">Booked on the Scoreboard · accepted in the period</th><td class="num">{money(r.eventBooked)}</td></tr>
            <tr><th scope="row">Cash to date here</th><td class="num">{money(r.dealCash)}</td></tr>
            <tr><th scope="row">− collected after the period on these deals</th><td class="num">{money(r.cashAfterPeriod)}</td></tr>
            <tr><th scope="row">− collected before the period (deposits before acceptance)</th><td class="num">{money(r.cashBeforePeriod)}</td></tr>
            <tr><th scope="row">+ collected in the period on deals won earlier</th><td class="num">{money(r.cashOnEarlierDeals)}</td></tr>
            <tr><th scope="row">+ deposits in the period on deals not won yet</th><td class="num">{money(r.depositsNotYetWon)}</td></tr>
          </tbody>
          <tfoot><tr><th scope="row">= Cash collected on the Scoreboard</th><td class="num">{money(r.eventCash)}</td></tr></tfoot>
        </table>
      </details>
    {/if}
  {/if}
{/if}

<style>
  .sb-seg-tools { margin-bottom: 0.6rem; justify-content: space-between; }
  .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
</style>
