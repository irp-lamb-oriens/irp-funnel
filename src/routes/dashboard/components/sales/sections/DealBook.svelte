<script lang="ts">
  /**
   * DealBook — every deal in the database, every currency (sales-book-v3 §6.5),
   * plus a Leads tab for leads that never became a deal. Saved views are
   * exact predicates (engine/sales.ts SAVED_VIEWS). With a period other than
   * All time, a removable chip limits the list to deals active in it.
   */
  import { DIMENSIONS, DIM, dimLabel, dimValues } from '../../metrics/engine/registry.ts';
  import { csvEscape } from '../../metrics/engine/cube.ts';
  import { money as fmtMoney, pct } from '../../metrics/engine/format.ts';
  import { activeInPeriod, applyView, notInvoicedOf, SAVED_VIEWS, type Deal } from '../../metrics/engine/sales.ts';
  import { NO_DRAWER, openClient } from '../openClient.ts';
  import type { Book } from '../types.ts';

  export let book: Book;
  export let view = 'all';
  export let activeOnly = true;

  const STATUS: Record<string, string> = { open: 'Open', quoted: 'Quoted', accepted: 'Accepted', invoiced: 'Invoiced', partially_paid: 'Partially paid', paid: 'Paid', dropped: 'Dropped' };
  const TZ = 'America/Costa_Rica';
  const date = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit', timeZone: TZ }) : '—');

  let tab: 'deals' | 'leads' = 'deals';
  let search = '';
  let sort = 'recent';
  let group = '';
  let page = 1;
  const PAGE = 50;
  let err = '';

  // ── Columns (chooser remembered per viewer) ──
  const COLS = [
    { key: 'currency', label: 'Currency' }, { key: 'stage', label: 'Stage' }, { key: 'route', label: 'Route' },
    { key: 'service', label: 'Service' }, { key: 'channel', label: 'Channel' }, { key: 'booked', label: 'Booked' },
    { key: 'invoiced', label: 'Invoiced' }, { key: 'cash', label: 'Collected' }, { key: 'outstanding', label: 'Outstanding' },
    { key: 'marginPct', label: 'Margin %' }, { key: 'accepted', label: 'Accepted' }, { key: 'paid', label: 'First paid' },
    { key: 'days', label: 'Days to close' }, { key: 'activity', label: 'Last activity' },
  ] as const;
  type ColKey = (typeof COLS)[number]['key'];
  const DEFAULT_COLS: ColKey[] = ['route', 'service', 'channel', 'booked', 'cash', 'outstanding', 'accepted', 'activity'];
  let cols: ColKey[] = DEFAULT_COLS;
  try { const c = JSON.parse(localStorage.getItem('irp.salesBook.cols') ?? 'null'); if (Array.isArray(c)) cols = c.filter((k: string) => COLS.some((x) => x.key === k)); } catch { /* storage blocked */ }
  function toggleCol(k: ColKey) {
    cols = cols.includes(k) ? cols.filter((x) => x !== k) : COLS.map((c) => c.key).filter((x) => x === k || cols.includes(x));
    try { localStorage.setItem('irp.salesBook.cols', JSON.stringify(cols)); } catch { /* ignore */ }
  }
  $: show = new Set(cols);

  // ── Rows ──
  $: viewDef = SAVED_VIEWS.find((v) => v.key === view) ?? SAVED_VIEWS[0];
  $: inPeriod = book.allTime || !activeOnly ? book.deals : book.deals.filter((d) => activeInPeriod(d, book.rowsById.get(d.key), book.months, false));
  $: counts = Object.fromEntries(SAVED_VIEWS.map((v) => [v.key, applyView(v, inPeriod, book.rowsById, book.recsByDeal).length]));
  $: viewed = applyView(viewDef, inPeriod, book.rowsById, book.recsByDeal);
  $: q = search.trim().toLowerCase();
  $: searched = q ? viewed.filter((d) => `${d.name} ${d.route ?? ''} ${d.service ?? ''} ${d.stageLabel ?? ''} ${row(d)?.channel ?? ''}`.toLowerCase().includes(q)) : viewed;
  const SORTS: Record<string, { label: string; fn: (a: Deal, b: Deal) => number }> = {
    recent: { label: 'Latest activity', fn: (a, b) => (b.lastActivityAt ?? '').localeCompare(a.lastActivityAt ?? '') },
    outstanding: { label: 'Most outstanding', fn: (a, b) => b.outstanding - a.outstanding },
    booked: { label: 'Largest booked', fn: (a, b) => b.booked - a.booked },
    accepted: { label: 'Newest accepted', fn: (a, b) => (b.acceptedAt ?? '').localeCompare(a.acceptedAt ?? '') },
    slowest: { label: 'Slowest to close', fn: (a, b) => (b.daysToClose ?? -1) - (a.daysToClose ?? -1) },
    name: { label: 'Name', fn: (a, b) => a.name.localeCompare(b.name) },
  };
  $: sorted = viewDef.sort && sort === 'recent' ? searched : [...searched].sort(SORTS[sort]?.fn ?? SORTS.recent.fn);
  $: paged = sorted.slice(0, page * PAGE);
  $: view, search, sort, activeOnly, group, (page = 1);

  const row = (d: Deal) => book.rowsById.get(d.key);
  const groupKey = (d: Deal) => {
    if (!group) return '';
    const r = row(d);
    if (!r) return '—';
    const vals = dimValues(DIM[group], r);
    return vals[0] ?? '—';
  };
  $: groups = group
    ? [...sorted.reduce((m, d) => { const k = groupKey(d); const a = m.get(k) ?? []; a.push(d); m.set(k, a); return m; }, new Map<string, Deal[]>()).entries()]
        .map(([k, ds]) => ({ key: k, label: dimLabel(group, k), deals: ds, booked: sum(ds, 'booked'), cash: sum(ds, 'cash'), outstanding: sum(ds, 'outstanding') }))
        .sort((a, b) => b.booked - a.booked)
    : [];
  function sum(ds: Deal[], f: 'booked' | 'cash' | 'outstanding' | 'invoiced') { return ds.filter((d) => d.currency === book.currency).reduce((s, d) => s + d[f], 0); }
  $: totals = { booked: sum(sorted, 'booked'), invoiced: sum(sorted, 'invoiced'), cash: sum(sorted, 'cash'), outstanding: sum(sorted, 'outstanding') };
  $: other = sorted.filter((d) => d.currency !== book.currency);
  $: otherByCur = other.reduce((m, d) => { m[d.currency] = (m[d.currency] ?? 0) + 1; return m; }, {} as Record<string, number>);

  const m = (n: number | null | undefined, cur: string) => fmtMoney(n, cur);
  const marginPct = (d: Deal) => (d.booked > 0 ? d.margin / d.booked : null);
  async function open1(d: { consultationId: string | null }) { err = (await openClient(d.consultationId)) ?? ''; }

  function exportCsv() {
    const head = ['Client', 'Status', 'Stage', 'Currency', 'Route', 'Service', 'Channel', 'Lead', 'First quote', 'Accepted', 'First invoice', 'First paid', 'Booked', 'Invoiced', 'Collected', 'Outstanding', 'Not invoiced', 'Credit', 'Margin', 'Days to close', 'Last activity', 'Test record'];
    const lines = [head.map(csvEscape).join(',')];
    for (const d of sorted) {
      lines.push([d.name, STATUS[d.status], d.stageLabel, d.currency, d.route, d.service, row(d)?.channel ?? '', d.leadAt?.slice(0, 10), d.quoteSentAt?.slice(0, 10), d.acceptedAt?.slice(0, 10), d.invoicedAt?.slice(0, 10) ?? '', d.paidAt?.slice(0, 10), d.booked, d.invoiced, d.cash, d.outstanding, d.backlog, d.credit, d.margin, d.daysToClose, d.lastActivityAt?.slice(0, 10), d.isTest ? 'yes' : ''].map(csvEscape).join(','));
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `sales-book_${viewDef.key}_${book.allTime ? 'all-time' : `${book.months[0]}_${book.months[book.months.length - 1]}`}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  // ── Leads tab: every lead with no deal ──
  $: dealKeys = new Set(book.deals.map((d) => d.key));
  $: leads = book.rows
    .filter((r) => r.isLead && !dealKeys.has(r.id) && (book.allTime || (r.leadMonth && book.months.includes(r.leadMonth))))
    .filter((r) => !q || `${r.name} ${r.channel} ${r.route} ${r.stageLabel ?? ''}`.toLowerCase().includes(q))
    .sort((a, b) => (b.leadAt ?? '').localeCompare(a.leadAt ?? ''));
  $: leadsPaged = leads.slice(0, page * PAGE);
  const DROP: Record<string, string> = { noShow: 'No-show', nonQualified: 'Not qualified', saleDropped: 'Sale dropped' };
</script>

{#if err}<p class="mh-alert mh-alert--error" role="alert">{err}</p>{/if}

<div class="sb-tabs" role="tablist" aria-label="Deal book">
  <button role="tab" aria-selected={tab === 'deals'} on:click={() => (tab = 'deals')}>Deals <span class="mh-muted">{inPeriod.length}</span></button>
  <button role="tab" aria-selected={tab === 'leads'} on:click={() => (tab = 'leads')} disabled={!book.cubeOk}>Leads with no deal <span class="mh-muted">{book.cubeOk ? leads.length : '—'}</span></button>
</div>

{#if tab === 'deals'}
  <div class="sb-views" role="group" aria-label="Saved views">
    {#each SAVED_VIEWS as v (v.key)}
      <button class="sb-view" aria-pressed={view === v.key} on:click={() => (view = v.key)} disabled={!counts[v.key] && v.key !== 'all'}>{v.label} <span>{counts[v.key]}</span></button>
    {/each}
  </div>
  <div class="sb-dealbar">
    {#if !book.allTime}
      {#if activeOnly}
        <span class="mh-chip">Only deals active in {book.rangeLabel}<button aria-label="Show every deal" on:click={() => (activeOnly = false)}>×</button></span>
      {:else}
        <button class="mh-btn mh-btn--sm mh-btn--ghost" on:click={() => (activeOnly = true)}>Only deals active in {book.rangeLabel}</button>
      {/if}
    {/if}
    <input class="mh-input sb-search" type="search" placeholder="Search name, route, service, channel…" aria-label="Search deals" bind:value={search} />
    <label class="mh-control"><span class="mh-label">Sort</span>
      <select class="mh-input" bind:value={sort}>{#each Object.entries(SORTS) as [k, s]}<option value={k}>{s.label}</option>{/each}</select></label>
    <label class="mh-control"><span class="mh-label">Group by</span>
      <select class="mh-input" bind:value={group} disabled={!book.cubeOk}><option value="">—</option>{#each DIMENSIONS.filter((d) => !d.multi) as d}<option value={d.key}>{d.label}</option>{/each}</select></label>
    <details class="sb-cols">
      <summary class="mh-btn mh-btn--sm">Columns</summary>
      <div class="sb-cols__menu">
        {#each COLS as c}<label class="mh-toggle"><input type="checkbox" checked={show.has(c.key)} on:change={() => toggleCol(c.key)} /> {c.label}</label>{/each}
      </div>
    </details>
    <button class="mh-btn mh-btn--sm" on:click={exportCsv} disabled={!sorted.length}>Export CSV</button>
  </div>
  <p class="mh-hint" aria-live="polite">{sorted.length} deal{sorted.length === 1 ? '' : 's'} · totals in {book.currency}{#if other.length} · plus {Object.entries(otherByCur).map(([c, n]) => `${n} in ${c}`).join(', ')} (own currency per row){/if}</p>

  <div class="mh-table-wrap">
    <table class="mh-table sb-cards sb-deals">
      <thead>
        <tr>
          <th scope="col">Client</th><th scope="col">Status</th>
          {#each COLS.filter((c) => show.has(c.key)) as c}<th scope="col" class:num={['booked', 'invoiced', 'cash', 'outstanding', 'marginPct', 'days'].includes(c.key)}>{c.label}</th>{/each}
        </tr>
      </thead>
      {#each group ? groups : [{ key: '', label: '', deals: paged, booked: 0, cash: 0, outstanding: 0 }] as g (g.key)}
        <tbody>
          {#if group}
            <tr class="sb-group"><th scope="rowgroup" colspan={2 + cols.length}>{g.label} <span class="mh-muted">· {g.deals.length} deal{g.deals.length === 1 ? '' : 's'} · booked {m(g.booked, book.currency)} · collected {m(g.cash, book.currency)} · owed {m(g.outstanding, book.currency)}</span></th></tr>
          {/if}
          {#each group ? g.deals.slice(0, 200) : g.deals as d (d.key)}
            {@const r = row(d)}
            <tr class:sb-test={d.isTest}>
              <th scope="row" data-label="Client">
                {#if d.consultationId}<button class="sb-name" on:click={() => open1(d)}>{d.name || '(no name)'}</button>
                {:else}<span class="sb-name sb-name--off" title={NO_DRAWER}>{d.name || '(no name)'}</span> <span class="mh-muted">(invoice only)</span>{/if}
                {#if d.isTest}<span class="mh-muted"> · test</span>{/if}
              </th>
              <td data-label="Status"><span class="sb-status sb-status--{d.status}">{STATUS[d.status]}</span>{#if d.cancelledAfterAcceptance}<span class="mh-muted"> after acceptance</span>{/if}</td>
              {#if show.has('currency')}<td data-label="Currency">{d.currency}</td>{/if}
              {#if show.has('stage')}<td data-label="Stage">{d.stageLabel ?? '—'}</td>{/if}
              {#if show.has('route')}<td data-label="Route">{d.route ?? r?.route ?? '—'}</td>{/if}
              {#if show.has('service')}<td data-label="Service">{d.service ?? '—'}</td>{/if}
              {#if show.has('channel')}<td data-label="Channel">{r?.channel ?? '—'}</td>{/if}
              {#if show.has('booked')}<td class="num" data-label="Booked">{m(d.booked, d.currency)}</td>{/if}
              {#if show.has('invoiced')}<td class="num" data-label="Invoiced">{m(d.invoiced, d.currency)}</td>{/if}
              {#if show.has('cash')}<td class="num" data-label="Collected">{m(d.cash, d.currency)}</td>{/if}
              {#if show.has('outstanding')}<td class="num" data-label="Outstanding" class:sb-owed={d.outstanding > 0 && d.status !== 'dropped'}>{m(d.outstanding, d.currency)}{#if d.credit > 0}<span class="mh-muted sb-block">credit {m(d.credit, d.currency)}</span>{/if}{#if notInvoicedOf(d) > 0}<span class="mh-muted sb-block">{m(notInvoicedOf(d), d.currency)} not invoiced</span>{/if}</td>{/if}
              {#if show.has('marginPct')}<td class="num" data-label="Margin %">{pct(marginPct(d))}</td>{/if}
              {#if show.has('accepted')}<td data-label="Accepted">{date(d.acceptedAt)}</td>{/if}
              {#if show.has('paid')}<td data-label="First paid">{date(d.paidAt)}</td>{/if}
              {#if show.has('days')}<td class="num" data-label="Days to close">{d.daysToClose === null ? '—' : `${Math.round(d.daysToClose)} d`}</td>{/if}
              {#if show.has('activity')}<td data-label="Last activity">{date(d.lastActivityAt)}</td>{/if}
            </tr>
          {/each}
        </tbody>
      {/each}
      {#if !sorted.length}
        <tbody><tr><td colspan={2 + cols.length} class="mh-empty">No deals match{search ? ` "${search}"` : ''}.</td></tr></tbody>
      {/if}
      {#if sorted.length}
        <tfoot>
          <tr>
            <th scope="row" colspan={2 + COLS.filter((c) => show.has(c.key) && ['currency', 'stage', 'route', 'service', 'channel'].includes(c.key)).length}>Total ({book.currency})</th>
            {#if show.has('booked')}<td class="num">{m(totals.booked, book.currency)}</td>{/if}
            {#if show.has('invoiced')}<td class="num">{m(totals.invoiced, book.currency)}</td>{/if}
            {#if show.has('cash')}<td class="num">{m(totals.cash, book.currency)}</td>{/if}
            {#if show.has('outstanding')}<td class="num">{m(totals.outstanding, book.currency)}</td>{/if}
            {#each COLS.filter((c) => show.has(c.key) && ['marginPct', 'accepted', 'paid', 'days', 'activity'].includes(c.key)) as _}<td></td>{/each}
          </tr>
        </tfoot>
      {/if}
    </table>
  </div>
  {#if !group && sorted.length > paged.length}
    <button class="mh-btn sb-mt-s" on:click={() => (page += 1)}>Show more ({sorted.length - paged.length} remaining)</button>
  {/if}
{:else}
  <div class="sb-dealbar">
    <input class="mh-input sb-search" type="search" placeholder="Search leads…" aria-label="Search leads" bind:value={search} />
  </div>
  <p class="mh-hint">{leads.length} lead{leads.length === 1 ? '' : 's'} with no quote, invoice or payment{book.allTime ? '' : ` created in ${book.rangeLabel}`}.</p>
  <div class="mh-table-wrap">
    <table class="mh-table sb-cards">
      <thead><tr><th scope="col">Lead</th><th scope="col">Created</th><th scope="col">Channel</th><th scope="col">Route</th><th scope="col">Budget</th><th scope="col">Stage now</th><th scope="col">Dropped</th></tr></thead>
      <tbody>
        {#each leadsPaged as r (r.id)}
          <tr>
            <th scope="row" data-label="Lead"><button class="sb-name" on:click={() => open1({ consultationId: r.id })}>{r.name}</button></th>
            <td data-label="Created">{date(r.leadAt)}</td>
            <td data-label="Channel">{r.channel}</td>
            <td data-label="Route">{r.route}</td>
            <td data-label="Budget">{r.budget}</td>
            <td data-label="Stage now">{r.stageLabel ?? '—'}</td>
            <td data-label="Dropped">{r.dropKind ? DROP[r.dropKind] ?? r.dropKind : '—'}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
  {#if leads.length > leadsPaged.length}<button class="mh-btn sb-mt-s" on:click={() => (page += 1)}>Show more ({leads.length - leadsPaged.length} remaining)</button>{/if}
{/if}
