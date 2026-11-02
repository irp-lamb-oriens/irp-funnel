<script lang="ts">
  /**
   * SalesBook — the Sales Report tab, v3 (docs/designs/sales-book-v3.md).
   *
   * Loads the WHOLE book once — every deal from the v2 report (all time, all
   * currencies) and the lead fact cube — and treats the period as a lens over
   * it (§1, D1). Period, currency, lens and filter changes re-slice in the
   * browser; the network is used again only for Refresh or the test toggle.
   *
   *   Needs action → Scoreboard → Money → Deal book → Pipeline → History
   *   → By segment → Pivot → Data quality
   *
   * Conversion analysis (finder, funnel by segment, velocity) stays on the
   * Metrics tab; every hand-off carries the period and filters (§2.1).
   */
  import { onDestroy, onMount, tick } from 'svelte';
  import { activeView, fetchMetricsCube, fetchSalesReport, SalesReportSchemaError, type SalesReportV2 } from '../../store.ts';
  import { cubeSchemaOk, type Ctx, type Filter, type LeadFact, type MetricsCube } from '../metrics/engine/types.ts';
  import { filterRows } from '../metrics/engine/cube.ts';
  import { DIM, dimLabel } from '../metrics/engine/registry.ts';
  import { fairCompare, firstMonthOf, monthLabel, monthRange, rangeFor, rangeLabel, shiftMonth, supportsDayCut } from '../metrics/engine/period.ts';
  import { bookTotals, dealsForRows, isStalled, last12Contexts, outstandingPartition, receivablesByDeal, rowIndex } from '../metrics/engine/sales.ts';
  import { money as fmtMoney } from '../metrics/engine/format.ts';
  import { encodeFilters, setFiltersSilently } from '../metrics/hub/hubState.ts';
  import FilterPicker from '../metrics/hub/FilterPicker.svelte';
  import { DEFAULTS, LENSES, SALES_PRESETS, initialSettings, saveToStorage, sbFilters, writeUrl, type SalesBookSettings } from './salesBookState.ts';
  import type { Book } from './types.ts';
  import Scoreboard from './sections/Scoreboard.svelte';
  import MoneySection from './sections/MoneySection.svelte';
  import DealBook from './sections/DealBook.svelte';
  import PipelineSection from './sections/PipelineSection.svelte';
  import HistorySection from './sections/HistorySection.svelte';
  import BySegment from './sections/BySegment.svelte';
  import PivotSection from './sections/PivotSection.svelte';
  import DataQuality from './sections/DataQuality.svelte';

  const { filters, canUndo, removeFilter, clearFilters, undoFilters } = sbFilters;

  let s: SalesBookSettings = { ...DEFAULTS };
  let ready = false;

  // ── Load ─────────────────────────────────────────────────────────────────
  let v2: SalesReportV2 | null = null;
  let cube: MetricsCube | null = null;
  let loading = false;
  let v2Error = '';
  let cubeError = '';
  let schemaError = false;
  let loadedAt = '';
  let ticket = 0;

  async function load(fresh = false) {
    const t = ++ticket;
    loading = true;
    v2Error = '';
    cubeError = '';
    schemaError = false;
    const [a, b] = await Promise.allSettled([
      fetchSalesReport({ allDeals: true, excludeTest: s.excludeTest, currency: s.currency, fresh, silent: true }),
      fetchMetricsCube({ fresh }),
    ]);
    if (t !== ticket) return;
    if (a.status === 'fulfilled') { v2 = a.value.v2 ?? null; loadedAt = a.value.sourcesLoadedAt ?? v2?.generatedAt ?? ''; }
    else { schemaError = a.reason instanceof SalesReportSchemaError; v2Error = a.reason?.message ?? 'Could not load the sales report.'; }
    if (b.status === 'fulfilled') {
      const c = b.value as MetricsCube;
      if (c && Array.isArray(c.rows) && cubeSchemaOk(c.schemaVersion)) cube = c;
      else cubeError = 'The server sent an older segment-data format.';
    } else cubeError = b.reason?.message ?? 'Could not load segment data.';
    loading = false;
  }

  // ── Settings → URL / storage ─────────────────────────────────────────────
  $: if (ready) { writeUrl(s); saveToStorage(s); }
  $: if (ready) { void $filters; writeUrl(s); }
  let lastTest = DEFAULTS.excludeTest;
  $: if (ready && s.excludeTest !== lastTest) { lastTest = s.excludeTest; load(); }

  // ── Derived: the period lens ─────────────────────────────────────────────
  $: allCubeRows = cube?.rows ?? [];
  $: nowMonth = cube?.nowMonth ?? v2?.range.to ?? new Date().toISOString().slice(0, 7);
  $: firstMonth = firstMonthOf(allCubeRows, nowMonth);
  $: range = rangeFor(s.preset, nowMonth, s.custom, firstMonth);
  $: months = monthRange(range.from, range.to);
  $: ctx = { months, allTime: range.allTime, currency: s.currency, nowMonth } as Ctx;
  $: label = rangeLabel(months, range.allTime);
  $: now = new Date();
  $: dayOk = supportsDayCut(allCubeRows);
  $: fc = fairCompare(months, s.compare, range.allTime, now);
  $: cmp = ((): Book['cmp'] => {
    if (range.allTime) {
      const c = last12Contexts(nowMonth, s.currency);
      return { cur: c.cur, prev: c.prev, label: 'last 12 complete months vs the 12 before' };
    }
    if (fc.kind === 'months') {
      const l = s.compare === 'yoy' ? 'same months last year' : fc.cmpMonths.length === 1 ? monthLabel(fc.cmpMonths[0], true) : `${monthLabel(fc.cmpMonths[0], true)} – ${monthLabel(fc.cmpMonths[fc.cmpMonths.length - 1], true)}`;
      return { cur: ctx, prev: { ...ctx, months: fc.cmpMonths }, label: l };
    }
    if (fc.kind === 'days' && dayOk) {
      const span = s.compare === 'yoy' ? 12 : months.length;
      return {
        cur: { ...ctx, dayCut: fc.cur },
        prev: { ...ctx, months: months.map((m) => shiftMonth(m, -span)), dayCut: fc.cmp },
        label: dayRangeLabel(fc.cmp),
      };
    }
    return null;
  })();
  function dayRangeLabel(w: { from: string; to: string }): string {
    const f = (d: string, year: boolean) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', ...(year ? { year: 'numeric' } : {}), timeZone: 'UTC' });
    const y = w.from.slice(0, 4) !== nowMonth.slice(0, 4);
    return w.from === w.to ? f(w.from, y) : `${f(w.from, false)} – ${f(w.to, y)}`;
  }
  $: cmpReason = fc.kind === 'none' ? fc.reason : fc.kind === 'days' && !dayOk ? 'Partial month · day-level comparison needs the server update' : '';

  // ── Derived: rows and deals ──────────────────────────────────────────────
  $: baseRows = filterRows(allCubeRows, [], { excludeTest: s.excludeTest }) as LeadFact[];
  $: rows = filterRows(baseRows, $filters) as LeadFact[];
  $: filtersActive = $filters.length > 0 && !!cube;
  $: allDeals = v2?.deals ?? [];
  $: deals = dealsForRows(allDeals, rows, filtersActive);
  $: dealKeys = new Set(deals.map((d) => d.key));
  $: receivables = (v2?.receivables ?? []).filter((r) => dealKeys.has(r.dealKey));
  $: rowsById = rowIndex(allCubeRows);
  $: recsByDeal = receivablesByDeal(receivables);
  $: currencies = [...new Set([...(v2?.currencies ?? []), ...(cube?.currencies ?? []), s.currency])];
  $: totals = bookTotals(deals, s.currency);
  $: part = outstandingPartition(deals, receivables, s.currency, now);

  $: book = {
    rows, baseRows, deals, receivables, rowsById, recsByDeal, v2, cubeOk: !!cube, ctx, months, allTime: range.allTime,
    rangeLabel: label, currency: s.currency, nowMonth, firstMonth, now, compare: fc, cmp, totals, part,
    filters: $filters, filtersActive,
  } as Book;

  // ── Needs action ─────────────────────────────────────────────────────────
  $: overdue = receivables.filter((r) => r.currency === s.currency && r.due > 0 && (r.ageDays ?? 0) > 60);
  $: stalledRows = rows.filter((r) => isStalled(r));
  $: actions = [
    { key: 'not_invoiced', n: part.rows.filter((r) => r.notInvoiced > 0).length, text: `${money(part.notInvoiced)} not invoiced` },
    { key: 'overdue60', n: new Set(overdue.map((r) => r.dealKey)).size, text: `${money(overdue.reduce((a, r) => a + r.due, 0))} overdue 60+ days` },
    { key: 'stalled', n: stalledRows.length, text: `${stalledRows.length} stalled quote${stalledRows.length === 1 ? '' : 's'} (${money(stalledRows.reduce((a, r) => a + (r.openQuote?.cur === s.currency ? r.openQuote.total : 0), 0))})` },
    { key: 'cancelled', n: part.atRisk.deals.length, text: `${money(part.atRisk.total)} on deals dropped after acceptance` },
  ].filter((a) => a.n > 0);
  $: dataIssues = (v2?.warnings ?? []).filter((w) => !/not included in this/.test(w)).length;

  function goView(view: string) {
    s = { ...s, view };
    jump('sb-deals');
  }

  // ── Cross-links ──────────────────────────────────────────────────────────
  /** Open the Metrics tab on the same period and filters (+ extra ones). */
  function openInMetrics(extra: Filter[] = [], section = '') {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('view', 'metrics');
      url.searchParams.set('mh_p', range.allTime ? 'all' : 'custom');
      if (!range.allTime) { url.searchParams.set('mh_from', range.from); url.searchParams.set('mh_to', range.to); }
      if (s.currency !== 'USD') url.searchParams.set('mh_cur', s.currency); else url.searchParams.delete('mh_cur');
      const fs = [...$filters.filter((f) => !extra.some((e) => e.dim === f.dim)), ...extra];
      if (fs.length) url.searchParams.set('mh_f', encodeFilters(fs)); else url.searchParams.delete('mh_f');
      if (!s.excludeTest) url.searchParams.set('mh_test', '1'); else url.searchParams.delete('mh_test');
      if (section) url.hash = section;
      window.history.replaceState(window.history.state, '', url);
      setFiltersSilently(fs);
    } catch { /* ignore */ }
    activeView.set('metrics');
  }

  // ── Formatting ───────────────────────────────────────────────────────────
  function money(n: number | null | undefined, cur: string = s.currency): string { return fmtMoney(n, cur); }
  let clock = 0;
  const timer = typeof window !== 'undefined' ? setInterval(() => (clock += 1), 30_000) : null;
  onDestroy(() => { if (timer) clearInterval(timer); });
  $: updated = clock >= 0 && loadedAt ? (() => { const mins = Math.round((Date.now() - new Date(loadedAt).getTime()) / 60000); return mins < 1 ? 'just now' : mins < 60 ? `${mins}m ago` : `${Math.round(mins / 60)}h ago`; })() : '';

  // ── Sections, nav, lens keys ─────────────────────────────────────────────
  const SECTIONS = [
    { id: 'sb-score', label: 'Scoreboard' },
    { id: 'sb-money', label: 'Money' },
    { id: 'sb-deals', label: 'Deal book' },
    { id: 'sb-pipeline', label: 'Pipeline' },
    { id: 'sb-history', label: 'History' },
    { id: 'sb-segments', label: 'By segment' },
    { id: 'sb-pivot', label: 'Pivot' },
    { id: 'sb-quality', label: 'Data quality' },
  ];
  let current = 'sb-score';
  let barH = 0;
  let controlsOpen = false;
  let observer: IntersectionObserver | null = null;
  async function observe() {
    await tick();
    observer?.disconnect();
    if (typeof IntersectionObserver === 'undefined') return;
    observer = new IntersectionObserver((entries) => {
      const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      if (vis[0]) current = vis[0].target.id;
    }, { rootMargin: '-20% 0px -70% 0px' });
    for (const x of SECTIONS) { const el = document.getElementById(x.id); if (el) observer.observe(el); }
  }
  $: if (v2 || cube) observe();
  function jump(id: string) {
    current = id;
    tick().then(() => {
      const el = document.getElementById(id);
      if (!el) return;
      const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
      (el.querySelector('h3') as HTMLElement | null)?.focus?.({ preventScroll: true });
    });
  }
  function lensKey(e: KeyboardEvent, i: number) {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft' && e.key !== 'Home' && e.key !== 'End') return;
    e.preventDefault();
    const n = LENSES.length;
    const j = e.key === 'Home' ? 0 : e.key === 'End' ? n - 1 : (i + (e.key === 'ArrowRight' ? 1 : -1) + n) % n;
    s = { ...s, lens: LENSES[j].key };
    tick().then(() => (document.getElementById(`sb-lens-${LENSES[j].key}`) as HTMLButtonElement | null)?.focus());
  }

  // ── Period controls ──────────────────────────────────────────────────────
  $: years = (() => { const out: string[] = []; for (let y = Number(nowMonth.slice(0, 4)); y >= Number(firstMonth.slice(0, 4)); y--) out.push(String(y)); return out; })();
  function onPreset(v: string) {
    const p = v as SalesBookSettings['preset'];
    let custom = s.custom;
    if (p === 'custom' && !VALID(custom.from)) custom = { from: nowMonth, to: nowMonth };
    if (p === 'year') custom = { from: `${VALID(custom.from) ? custom.from.slice(0, 4) : nowMonth.slice(0, 4)}-01`, to: '' };
    s = { ...s, preset: p, custom };
  }
  const VALID = (m: string) => /^\d{4}-(0[1-9]|1[0-2])$/.test(m);
  let copied = false;
  async function copyLink() {
    try { await navigator.clipboard.writeText(window.location.href); copied = true; setTimeout(() => (copied = false), 1600); } catch { /* ignore */ }
  }

  $: testRecords = v2?.testRecords ?? [];
  $: testMoney = testRecords.filter((t) => t.currency === s.currency);
  $: testLabel = `${testRecords.length} test record${testRecords.length === 1 ? '' : 's'}${testMoney.length ? ` (${money(testMoney.reduce((a, t) => a + t.booked, 0))} booked · ${money(testMoney.reduce((a, t) => a + t.cash, 0))} cash)` : ''}`;
  $: liveText = `${deals.length.toLocaleString('en-US')} deal${deals.length === 1 ? '' : 's'} · ${label}${$filters.length ? ` · ${$filters.length} filter${$filters.length === 1 ? '' : 's'}` : ''}`;

  onMount(() => {
    s = initialSettings();
    lastTest = s.excludeTest;
    ready = true;
    load();
  });
  onDestroy(() => observer?.disconnect());
</script>

<div class="mh sb" style="--mh-sticky:{barH}px">
  <header class="mh-head">
    <div>
      <h2>Sales book</h2>
      <p>Every sale in the database · the period is a lens, not a filter · Costa Rica time{updated ? ` · updated ${updated}` : ''}</p>
    </div>
    <div class="mh-head__actions">
      <button class="mh-btn" on:click={copyLink}>{copied ? 'Link copied' : 'Copy link'}</button>
      <button class="mh-btn mh-btn--primary" on:click={() => load(true)} disabled={loading}>{loading ? 'Refreshing…' : 'Refresh'}</button>
    </div>
  </header>

  <button class="mh-btn sb-controls-toggle" aria-expanded={controlsOpen} aria-controls="sb-bar" on:click={() => (controlsOpen = !controlsOpen)}>
    {label} · Filters ({$filters.length}) <span aria-hidden="true">{controlsOpen ? '▴' : '▾'}</span>
  </button>
  <div id="sb-bar" class="mh-bar sb-bar" class:sb-bar--open={controlsOpen} bind:offsetHeight={barH} role="group" aria-label="Sales book controls">
    <label class="mh-control">
      <span class="mh-label">Period</span>
      <select class="mh-input" value={s.preset} on:change={(e) => onPreset(e.currentTarget.value)}>
        {#each SALES_PRESETS as p}<option value={p.value}>{p.label}</option>{/each}
      </select>
    </label>
    {#if s.preset === 'custom'}
      <label class="mh-control"><span class="mh-label">From</span><input class="mh-input" type="month" bind:value={s.custom.from} max={nowMonth} /></label>
      <label class="mh-control"><span class="mh-label">To</span><input class="mh-input" type="month" bind:value={s.custom.to} max={nowMonth} /></label>
    {:else if s.preset === 'year'}
      <label class="mh-control"><span class="mh-label">Year</span>
        <select class="mh-input" value={s.custom.from.slice(0, 4)} on:change={(e) => (s = { ...s, custom: { from: `${e.currentTarget.value}-01`, to: '' } })}>
          {#each years as y}<option value={y}>{y}</option>{/each}
        </select>
      </label>
    {/if}
    <label class="mh-control">
      <span class="mh-label">Compare to</span>
      <select class="mh-input" bind:value={s.compare} disabled={range.allTime}>
        <option value="prev">Previous period</option>
        <option value="yoy">Same period last year</option>
        <option value="none">No comparison</option>
      </select>
    </label>
    {#if currencies.length > 1}
      <label class="mh-control">
        <span class="mh-label">Currency</span>
        <select class="mh-input" bind:value={s.currency}>{#each currencies as c}<option value={c}>{c}</option>{/each}</select>
      </label>
    {/if}
    <div class="mh-control sb-filters-wrap">
      <span class="mh-label">Filters</span>
      <div class="mh-filters">
        {#each $filters as f, i (f.dim + i)}
          <span class="mh-chip" class:mh-chip--exclude={f.exclude}>
            {f.exclude ? 'Not ' : ''}{DIM[f.dim]?.label}: {f.values.map((v) => dimLabel(f.dim, v)).join(', ')}
            <button aria-label="Remove filter {DIM[f.dim]?.label}" on:click={() => removeFilter(i)}>×</button>
          </span>
        {/each}
        {#if cube}
          <FilterPicker rows={baseRows} target={sbFilters} allRows />
        {:else}
          <span class="mh-muted">Filters need segment data{cubeError ? ' (unavailable)' : ''}</span>
        {/if}
        {#if $canUndo}<button class="mh-btn mh-btn--sm mh-btn--ghost" on:click={undoFilters}>↶ Undo</button>{/if}
        {#if $filters.length}<button class="mh-btn mh-btn--sm mh-btn--ghost" on:click={clearFilters}>Clear all</button>{/if}
      </div>
    </div>
    {#if testRecords.length || !s.excludeTest}
      <label class="mh-toggle" title="Test / internal records, by one shared rule (Data quality lists them and why)">
        <input type="checkbox" bind:checked={s.excludeTest} /> {s.excludeTest ? 'Excluding' : 'Hide'} {testLabel}
      </label>
    {/if}
    <span class="mh-live" aria-live="polite">{liveText}</span>
  </div>

  {#if schemaError}
    <div class="mh-alert mh-alert--warn" role="alert"><span>{v2Error}</span><button class="mh-btn mh-btn--sm" on:click={() => window.location.reload()}>Reload dashboard</button></div>
  {:else if v2Error}
    <div class="mh-alert mh-alert--error" role="alert"><span>{v2Error}{cube ? ' Showing segment figures only.' : ''}</span><button class="mh-btn mh-btn--sm" on:click={() => load(true)}>Retry</button></div>
  {/if}
  {#if cubeError}
    <div class="mh-alert mh-alert--warn" role="alert"><span>Segment data unavailable: {cubeError} Filters, the pivot and history are off; per-deal money still shows.</span><button class="mh-btn mh-btn--sm" on:click={() => load(true)}>Retry</button></div>
  {/if}

  {#if !v2 && !cube}
    <div aria-hidden="true">
      <div class="mh-sk" style="height:56px"></div>
      <div class="mh-sk" style="height:150px;margin-top:1rem"></div>
      <div class="mh-sk" style="height:320px;margin-top:1rem"></div>
    </div>
    {#if !v2Error}<p class="sr-only" aria-live="polite">Loading the sales book…</p>{/if}
  {:else}
    <div class="sb-actions" role="region" aria-label="Needs action">
      <span class="mh-label">Needs action</span>
      {#if actions.length || dataIssues}
        {#each actions as a (a.key)}
          <button class="sb-action" on:click={() => goView(a.key)}><strong>{a.text}</strong> <span>{a.n} deal{a.n === 1 ? '' : 's'}</span></button>
        {/each}
        {#if dataIssues}<button class="sb-action sb-action--quiet" on:click={() => jump('sb-quality')}><strong>{dataIssues} data issue{dataIssues === 1 ? '' : 's'}</strong></button>{/if}
      {:else}
        <span class="mh-muted">Nothing needs action.</span>
      {/if}
    </div>

    <div class="sb-lens" role="tablist" aria-label="Headline numbers for">
      {#each LENSES as l, i (l.key)}
        <button id="sb-lens-{l.key}" role="tab" aria-selected={s.lens === l.key} tabindex={s.lens === l.key ? 0 : -1}
          on:click={() => (s = { ...s, lens: l.key })} on:keydown={(e) => lensKey(e, i)}>{l.label}</button>
      {/each}
    </div>

    <nav class="mh-nav sb-nav" aria-label="Sales book sections">
      {#each SECTIONS as x}<a href="#{x.id}" aria-current={current === x.id ? 'true' : undefined} on:click|preventDefault={() => jump(x.id)}>{x.label}</a>{/each}
    </nav>
    <label class="sb-jump"><span class="sr-only">Jump to section</span>
      <select class="mh-input" value={current} on:change={(e) => jump(e.currentTarget.value)}>{#each SECTIONS as x}<option value={x.id}>{x.label}</option>{/each}</select>
    </label>

    <div class:sb-dim={loading}>
      <section id="sb-score" class="sb-score" aria-labelledby="sb-score-h">
        <h3 id="sb-score-h" class="sr-only" tabindex="-1">Scoreboard</h3>
        <Scoreboard {book} lens={s.lens} {cmpReason} onView={goView} onMetrics={openInMetrics} />
      </section>

      <section id="sb-money" class="mh-section" aria-labelledby="sb-money-h">
        <div class="mh-section__head"><div class="mh-section__title"><h3 id="sb-money-h" class="mh-h" tabindex="-1">Money</h3><p class="mh-hint">Booked → collected → owed, what is coming, and how fast it comes in</p></div></div>
        <MoneySection {book} onView={goView} />
      </section>

      <section id="sb-deals" class="mh-section" aria-labelledby="sb-deals-h">
        <div class="mh-section__head"><div class="mh-section__title"><h3 id="sb-deals-h" class="mh-h" tabindex="-1">Deal book</h3><p class="mh-hint">Every deal in the database, every currency · click a name to open the client</p></div></div>
        <DealBook {book} bind:view={s.view} bind:activeOnly={s.activeOnly} />
      </section>

      <section id="sb-pipeline" class="mh-section" aria-labelledby="sb-pipe-h">
        <div class="mh-section__head"><div class="mh-section__title"><h3 id="sb-pipe-h" class="mh-h" tabindex="-1">Pipeline</h3><p class="mh-hint">Open quotes as of today, what stalls, and what was won and lost</p></div>
          <button class="mh-link" on:click={() => openInMetrics([], 'mh-funnel')}>Funnel and conversion by segment → Metrics</button></div>
        <PipelineSection {book} onView={goView} />
      </section>

      <section id="sb-history" class="mh-section" aria-labelledby="sb-hist-h">
        <div class="mh-section__head"><div class="mh-section__title"><h3 id="sb-hist-h" class="mh-h" tabindex="-1">History</h3><p class="mh-hint">The whole book over time · {label === 'All time' ? 'all months' : `${label} highlighted`}</p></div></div>
        <HistorySection {book} />
      </section>

      <section id="sb-segments" class="mh-section" aria-labelledby="sb-seg-h">
        <div class="mh-section__head"><div class="mh-section__title"><h3 id="sb-seg-h" class="mh-h" tabindex="-1">By segment</h3><p class="mh-hint">Where the money comes from · deals won in {label}, all their money to date</p></div></div>
        <BySegment {book} onFilter={(f) => sbFilters.addFilter(f)} onMetrics={openInMetrics} />
      </section>

      <section id="sb-pivot" class="mh-section" aria-labelledby="sb-piv-h">
        <div class="mh-section__head"><div class="mh-section__title"><h3 id="sb-piv-h" class="mh-h" tabindex="-1">Pivot</h3><p class="mh-hint">Any money figure by any one or two dimensions · click to filter the whole page</p></div>
          <button class="mh-link" on:click={() => openInMetrics([], 'mh-explorer')}>Conversion rates and the combination finder → Metrics</button></div>
        <PivotSection {book} bind:state={s.pivot} onFilter={(fs) => sbFilters.addFilters(fs)} />
      </section>

      <section id="sb-quality" class="mh-section" aria-labelledby="sb-q-h">
        <div class="mh-section__head"><div class="mh-section__title"><h3 id="sb-q-h" class="mh-h" tabindex="-1">Data quality and definitions</h3><p class="mh-hint">Whole database · what to fix, and what every number means</p></div></div>
        <DataQuality {book} excludeTest={s.excludeTest} cube={cube} {loadedAt} />
      </section>
    </div>
  {/if}
</div>

<style>
  .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
  h3[tabindex='-1']:focus { outline: none; }
</style>
