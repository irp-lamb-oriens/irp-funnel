<script lang="ts">
  /**
   * SalesReportView — Sales Report v2 (docs/designs/sales-report-v2.md).
   *
   * Read-only. Everything comes from GET /api/dashboard/sales-report → `v2`,
   * already aggregated on the server by salesReportV2.ts. This component only
   * picks the range / currency, formats, filters and sorts — no money math.
   *
   * Page order follows the operator's questions:
   *   KPIs (how much did we sell / collect / still owe?) → Funnel (where do
   *   leads die?) → Deals (which ones need a push?) → Trend, Segments, Aging
   *   → Data health.
   */
  import { onMount, onDestroy } from 'svelte';
  import {
    salesReport,
    salesReportPrefill,
    fetchSalesReport,
    fetchClientDetail,
    SalesReportSchemaError,
    type SalesReportV2,
    type SalesV2Kpis,
    type SalesV2Deal,
    type SalesV2Segment,
    type SalesDealStatus,
  } from '../store.ts';
  import Select, { type SelectOption } from './ui/Select.svelte';

  // ── Range / currency state ───────────────────────────────────────────────
  type Preset = 'this_month' | 'last_month' | 'qtd' | 'ytd' | 'last_12' | 'all' | 'custom';
  const TZ = 'America/Costa_Rica';

  let preset: Preset = 'this_month';
  let customFrom = '';
  let customTo = '';
  let currency = 'USD';

  let loading = false;
  let errorMsg = '';
  let schemaError = false;
  let stale = false;

  function currentMonth(): string {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit' }).formatToParts(new Date());
    return `${parts.find((p) => p.type === 'year')!.value}-${parts.find((p) => p.type === 'month')!.value}`;
  }
  function shiftMonth(key: string, n: number): string {
    const [y, m] = key.split('-').map(Number);
    const idx = y * 12 + (m - 1) + n;
    return `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, '0')}`;
  }
  function rangeFor(p: Preset): { from: string | null; to: string | null } {
    const now = currentMonth();
    const [y, m] = now.split('-').map(Number);
    switch (p) {
      case 'this_month': return { from: now, to: now };
      case 'last_month': { const l = shiftMonth(now, -1); return { from: l, to: l }; }
      case 'qtd': return { from: `${y}-${String(Math.floor((m - 1) / 3) * 3 + 1).padStart(2, '0')}`, to: now };
      case 'ytd': return { from: `${y}-01`, to: now };
      case 'last_12': return { from: shiftMonth(now, -11), to: now };
      case 'all': return { from: null, to: null };
      case 'custom': return { from: customFrom || now, to: customTo || customFrom || now };
    }
  }

  const presetOptions: SelectOption[] = [
    { value: 'this_month', label: 'This month' },
    { value: 'last_month', label: 'Last month' },
    { value: 'qtd', label: 'Quarter to date' },
    { value: 'ytd', label: 'Year to date' },
    { value: 'last_12', label: 'Last 12 months' },
    { value: 'all', label: 'All time' },
    { value: 'custom', label: 'Custom range…' },
  ];

  // ── URL state (?sr_preset=&sr_from=&sr_to=&sr_cur=) ─────────────────────
  const VALID_MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
  function readUrl(): void {
    try {
      const q = new URLSearchParams(window.location.search);
      const p = q.get('sr_preset') as Preset | null;
      if (p && presetOptions.some((o) => o.value === p)) preset = p;
      const f = q.get('sr_from');
      const t = q.get('sr_to');
      if (f && VALID_MONTH.test(f)) customFrom = f;
      if (t && VALID_MONTH.test(t)) customTo = t;
      const c = q.get('sr_cur');
      if (c && /^[A-Z]{3}$/.test(c)) currency = c;
    } catch { /* no URL access (SSR / sandbox) */ }
  }
  function writeUrl(): void {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('sr_preset', preset);
      url.searchParams.set('sr_cur', currency);
      if (preset === 'custom') {
        url.searchParams.set('sr_from', customFrom);
        url.searchParams.set('sr_to', customTo);
      } else {
        url.searchParams.delete('sr_from');
        url.searchParams.delete('sr_to');
      }
      window.history.replaceState(window.history.state, '', url);
    } catch { /* ignore */ }
  }

  let loadTicket = 0;
  async function load(fresh = false): Promise<void> {
    const ticket = ++loadTicket;
    loading = true;
    errorMsg = '';
    schemaError = false;
    try {
      const r = rangeFor(preset);
      await fetchSalesReport({ ...r, currency, fresh });
      if (ticket !== loadTicket) return;
      stale = false;
      writeUrl();
    } catch (err: any) {
      if (ticket !== loadTicket) return;
      schemaError = err instanceof SalesReportSchemaError;
      errorMsg = err?.message ?? 'Could not load the sales report.';
      stale = !!$salesReport?.v2;
    } finally {
      if (ticket === loadTicket) loading = false;
    }
  }

  let unsubPrefill: (() => void) | null = null;
  onMount(() => {
    readUrl();
    unsubPrefill = salesReportPrefill.subscribe((p) => {
      if (!p) return;
      preset = 'custom';
      customFrom = p.from;
      customTo = p.to;
      salesReportPrefill.set(null);
    });
    load();
  });
  onDestroy(() => unsubPrefill?.());

  function onPreset(e: CustomEvent<{ value: string }>) {
    preset = e.detail.value as Preset;
    if (preset === 'custom' && !customFrom) {
      const now = currentMonth();
      customFrom = now;
      customTo = now;
    }
    load();
  }
  function onCustomChange() {
    if (customFrom && customTo && customFrom > customTo) [customFrom, customTo] = [customTo, customFrom];
    load();
  }
  function onCurrency(e: CustomEvent<{ value: string }>) {
    currency = e.detail.value;
    load();
  }
  function showAllTime() {
    preset = 'all';
    load();
  }

  // ── Derived ──────────────────────────────────────────────────────────────
  $: v2 = ($salesReport?.v2 ?? null) as SalesReportV2 | null;
  $: cur = v2?.kpis.current ?? null;
  $: prev = v2?.kpis.previous ?? null;
  $: currencyOptions = (v2?.currencies.length ? v2.currencies : [currency]).map((c) => ({ value: c, label: c }));
  $: rangeLabel = v2 ? describeRange(v2.range) : '';
  $: prevLabel = v2?.range.prevFrom ? describeRange({ from: v2.range.prevFrom, to: v2.range.prevTo!, isAllTime: false }) : '';
  $: isEmpty = !!cur && cur.leads === 0 && cur.quotesSent === 0 && cur.cash === 0 && cur.booked === 0 && cur.invoiced === 0;

  function monthName(key: string, withYear = true): string {
    const [y, m] = key.split('-').map(Number);
    const d = new Date(Date.UTC(y, m - 1, 15));
    return d.toLocaleDateString('en-US', { month: 'short', ...(withYear ? { year: 'numeric' } : {}), timeZone: 'UTC' });
  }
  function describeRange(r: { from: string; to: string; isAllTime: boolean }): string {
    if (r.isAllTime) return 'All time';
    if (r.from === r.to) return monthName(r.from);
    return `${monthName(r.from)} – ${monthName(r.to)}`;
  }

  // ── Formatting ───────────────────────────────────────────────────────────
  function money(n: number | null | undefined, c: string = v2?.currency ?? currency): string {
    if (typeof n !== 'number' || !Number.isFinite(n)) return '—';
    try {
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: c, maximumFractionDigits: 0 }).format(n);
    } catch {
      return `${c} ${Math.round(n).toLocaleString('en-US')}`;
    }
  }
  function pct(n: number | null | undefined): string {
    return typeof n === 'number' ? `${n.toFixed(n >= 10 ? 0 : 1)}%` : '—';
  }
  function days(n: number | null | undefined): string {
    return typeof n === 'number' ? `${Math.round(n)} d` : '—';
  }
  function shortDate(iso: string | null | undefined): string {
    if (!iso) return '—';
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: TZ });
  }
  function timeAgo(iso: string | null | undefined): string {
    if (!iso) return '';
    const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
    if (s < 60) return 'just now';
    if (s < 3600) return `${Math.round(s / 60)} min ago`;
    return `${Math.round(s / 3600)} h ago`;
  }
  let tick = 0;
  const tickTimer = typeof window !== 'undefined' ? setInterval(() => (tick += 1), 30_000) : null;
  onDestroy(() => { if (tickTimer) clearInterval(tickTimer); });
  $: updatedLabel = tick >= 0 ? timeAgo($salesReport?.sourcesLoadedAt ?? v2?.generatedAt) : '';

  /** Δ vs the previous period, as a signed % (null when not comparable). */
  function delta(curV: number, prevV: number | null | undefined): { text: string; dir: 'up' | 'down' | 'flat' } | null {
    if (prevV == null) return null;
    if (prevV === 0) return curV === 0 ? { text: '±0%', dir: 'flat' } : { text: 'new', dir: 'up' };
    const d = ((curV - prevV) / Math.abs(prevV)) * 100;
    if (Math.abs(d) < 0.5) return { text: '±0%', dir: 'flat' };
    return { text: `${d > 0 ? '+' : '−'}${Math.abs(d).toFixed(0)}%`, dir: d > 0 ? 'up' : 'down' };
  }

  // ── KPI tiles ────────────────────────────────────────────────────────────
  interface Tile { key: string; label: string; value: string; sub: string; delta: ReturnType<typeof delta>; def: string; asOf?: boolean }
  $: tiles = ((): Tile[] => {
    if (!v2 || !cur) return [];
    const a = v2.kpis.asOf;
    return [
      {
        key: 'leads', label: 'Leads', value: String(cur.leads),
        sub: `${pct(cur.winRate)} win rate`,
        delta: delta(cur.leads, prev?.leads),
        def: 'New consultations, dated by their first contact (Costa Rica time). Win rate = leads from this period who accepted a quote, so far.',
      },
      {
        key: 'won', label: 'Won deals', value: String(cur.wonDeals),
        sub: `${pct(cur.acceptanceRate)} of quoted · ${days(cur.medianDaysToClose)} to close`,
        delta: delta(cur.wonDeals, prev?.wonDeals),
        def: 'Clients whose first quote acceptance happened in the period. Acceptance rate and days-to-close follow this period\'s leads.',
      },
      {
        key: 'booked', label: 'Booked', value: money(cur.booked),
        sub: `${pct(cur.marginPct)} margin · avg ${money(cur.avgDealSize)}`,
        delta: delta(cur.booked, prev?.booked),
        def: 'Contract value of quotes accepted in the period, plus extra charges agreed in Finance. Margin = booked − provider cost.',
      },
      {
        key: 'cash', label: 'Cash collected', value: money(cur.cash),
        sub: cur.refunds ? `incl. ${money(cur.refunds)} refunded` : `${cur.paidClients} paying client${cur.paidClients === 1 ? '' : 's'}`,
        delta: delta(cur.cash, prev?.cash),
        def: 'Payments received in the period, by payment date — from invoices and from Finance settlements, the same transfer counted once.',
      },
      {
        key: 'outstanding', label: 'Outstanding', value: money(a.outstanding), asOf: true,
        sub: `${a.openDeals} deal${a.openDeals === 1 ? '' : 's'} · incl. ${money(a.backlog)} not yet invoiced`,
        delta: null,
        def: 'As of today, across all periods: what clients still owe on accepted quotes and sent invoices (whichever is larger per deal, minus what they paid). Part of it may not be invoiced yet; "Unpaid invoices by age" below counts only sent invoices.',
      },
    ];
  })();
  let openDef: string | null = null;
  function toggleDef(key: string) { openDef = openDef === key ? null : key; }

  // ── Funnel ───────────────────────────────────────────────────────────────
  let stageFilter: string | null = null;
  function pickStage(stage: string) {
    stageFilter = stageFilter === stage ? null : stage;
    dealPage = 1;
    if (stageFilter) document.getElementById('sr-deals')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  $: stageLabelOf = (s: string) => v2?.funnel.steps.find((x) => x.stage === s)?.label ?? s;

  // ── Deals ────────────────────────────────────────────────────────────────
  const STATUS_LABEL: Record<SalesDealStatus, string> = {
    open: 'Open', quoted: 'Quoted', accepted: 'Accepted', invoiced: 'Invoiced',
    partially_paid: 'Partially paid', paid: 'Paid', dropped: 'Dropped',
  };
  const statusOptions: SelectOption[] = [
    { value: 'all', label: 'All statuses' },
    { value: 'needs_money', label: 'Owes money' },
    ...(['quoted', 'accepted', 'invoiced', 'partially_paid', 'paid', 'dropped'] as SalesDealStatus[]).map((s) => ({ value: s, label: STATUS_LABEL[s] })),
  ];
  const sortOptions: SelectOption[] = [
    { value: 'recent', label: 'Latest activity' },
    { value: 'outstanding', label: 'Most outstanding' },
    { value: 'booked', label: 'Largest booked' },
    { value: 'slowest', label: 'Slowest to close' },
  ];
  let dealSearch = '';
  let dealStatus = 'all';
  let dealSort = 'recent';
  let dealPage = 1;
  const DEAL_PAGE = 25;

  $: filteredDeals = ((): SalesV2Deal[] => {
    const all = v2?.deals ?? [];
    const q = dealSearch.toLowerCase().trim();
    const rows = all.filter((d) => {
      if (stageFilter && d.stage !== stageFilter) return false;
      if (dealStatus === 'needs_money' ? d.outstanding <= 0 : dealStatus !== 'all' && d.status !== dealStatus) return false;
      if (q && !`${d.name} ${d.route ?? ''} ${d.service ?? ''} ${d.stageLabel ?? ''}`.toLowerCase().includes(q)) return false;
      return true;
    });
    const by: Record<string, (a: SalesV2Deal, b: SalesV2Deal) => number> = {
      recent: (a, b) => (b.lastActivityAt ?? '').localeCompare(a.lastActivityAt ?? ''),
      outstanding: (a, b) => b.outstanding - a.outstanding,
      booked: (a, b) => b.booked - a.booked,
      slowest: (a, b) => (b.daysToClose ?? -1) - (a.daysToClose ?? -1),
    };
    return [...rows].sort(by[dealSort] ?? by.recent);
  })();
  $: pagedDeals = filteredDeals.slice(0, dealPage * DEAL_PAGE);

  async function openDeal(d: SalesV2Deal) {
    if (!d.consultationId) return;
    try { await fetchClientDetail(d.consultationId); } catch (err: any) { errorMsg = err?.message ?? 'Could not open the client.'; }
  }

  // ── Trend ────────────────────────────────────────────────────────────────
  let trendAsTable = false;
  $: trendMax = Math.max(1, ...(v2?.monthly ?? []).flatMap((m) => [m.booked, m.cash]));
  $: trendTotals = (v2?.monthly ?? []).reduce(
    (t, m) => ({ leads: t.leads + m.leads, wonDeals: t.wonDeals + m.wonDeals, booked: t.booked + m.booked, invoiced: t.invoiced + m.invoiced, cash: t.cash + m.cash, margin: t.margin + m.margin }),
    { leads: 0, wonDeals: 0, booked: 0, invoiced: 0, cash: 0, margin: 0 },
  );

  // ── Segments ─────────────────────────────────────────────────────────────
  type SegKey = 'route' | 'service' | 'provider' | 'method';
  const SEG_TABS: Array<{ key: SegKey; label: string; note?: string }> = [
    { key: 'route', label: 'Route' },
    { key: 'service', label: 'Service' },
    { key: 'provider', label: 'Provider', note: 'Deals involving each provider. A deal with several providers appears under each, so rows overlap and there is no total.' },
    { key: 'method', label: 'Payment method' },
  ];
  let segTab: SegKey = 'route';
  $: segRows = (v2?.segments[segTab] ?? []) as SalesV2Segment[];
  $: segNote = SEG_TABS.find((t) => t.key === segTab)?.note ?? '';

  // ── Aging ────────────────────────────────────────────────────────────────
  $: agingMax = Math.max(1, ...(v2?.aging.buckets ?? []).map((b) => b.amount));

  // ── CSV export ───────────────────────────────────────────────────────────
  function csvCell(v: unknown): string {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }
  function exportCsv() {
    if (!v2 || !cur) return;
    const lines: string[] = [];
    lines.push(['Sales report', rangeLabel, v2.currency, `generated ${v2.generatedAt}`].map(csvCell).join(','));
    lines.push('');
    lines.push(['KPI', 'Value'].join(','));
    const k: Array<[string, unknown]> = [
      ['Leads', cur.leads], ['Won deals', cur.wonDeals], ['Win rate %', cur.winRate], ['Quotes sent', cur.quotesSent],
      ['Booked', cur.booked], ['Margin', cur.margin], ['Invoiced', cur.invoiced], ['Cash collected', cur.cash],
      ['Outstanding (as of today)', v2.kpis.asOf.outstanding], ['Not invoiced (as of today)', v2.kpis.asOf.backlog],
    ];
    for (const [a, b] of k) lines.push([a, b].map(csvCell).join(','));
    lines.push('');
    lines.push(['Month', 'Leads', 'Won', 'Booked', 'Invoiced', 'Cash', 'Margin'].join(','));
    for (const m of v2.monthly) lines.push([m.month, m.leads, m.wonDeals, m.booked, m.invoiced, m.cash, m.margin].map(csvCell).join(','));
    lines.push('');
    lines.push(['Deal', 'Status', 'Stage', 'Route', 'Service', 'Currency', 'Lead', 'Accepted', 'Paid', 'Booked', 'Invoiced', 'Cash', 'Outstanding', 'Margin', 'Days to close'].join(','));
    for (const d of filteredDeals) {
      lines.push([d.name, STATUS_LABEL[d.status], d.stageLabel, d.route, d.service, d.currency, d.leadAt?.slice(0, 10), d.acceptedAt?.slice(0, 10), d.paidAt?.slice(0, 10), d.booked, d.invoiced, d.cash, d.outstanding, d.margin, d.daysToClose].map(csvCell).join(','));
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `sales-report_${v2.range.from}_${v2.range.to}_${v2.currency}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
</script>

<div class="sr">
  <header class="sr__head">
    <div>
      <h3>Sales report</h3>
      <p>Leads, pipeline, sales and cash for the period — one definition per number, Costa Rica time.</p>
    </div>
    <div class="sr__head-actions">
      {#if updatedLabel}<span class="sr__updated" title={$salesReport?.sourcesLoadedAt ?? ''}>Updated {updatedLabel}</span>{/if}
      {#if stale}<span class="sr__badge sr__badge--warn">Stale</span>{/if}
      <button class="sr__btn" on:click={exportCsv} disabled={!v2}>Export CSV</button>
      <button class="sr__btn sr__btn--primary" on:click={() => load(true)} disabled={loading}>
        {loading ? 'Loading…' : 'Refresh'}
      </button>
    </div>
  </header>

  <!-- ── Filters ─────────────────────────────────────────────────────── -->
  <div class="sr__filters" role="group" aria-label="Report filters">
    <div class="sr__control">
      <span class="sr__control-label" id="sr-range-l">Period</span>
      <Select options={presetOptions} value={preset} on:change={onPreset} size="sm" ariaLabel="Period" />
    </div>
    {#if preset === 'custom'}
      <label class="sr__control">
        <span class="sr__control-label">From</span>
        <input type="month" bind:value={customFrom} on:change={onCustomChange} />
      </label>
      <label class="sr__control">
        <span class="sr__control-label">To</span>
        <input type="month" bind:value={customTo} on:change={onCustomChange} />
      </label>
    {/if}
    <div class="sr__control">
      <span class="sr__control-label">Currency</span>
      <Select options={currencyOptions} value={currency} on:change={onCurrency} size="sm" ariaLabel="Currency" />
    </div>
    {#if v2}
      <p class="sr__range-note">
        {rangeLabel}{#if prevLabel}<span> · compared with {prevLabel}</span>{/if}
      </p>
    {/if}
  </div>

  <div aria-live="polite" class="sr__live">
    {#if schemaError}
      <div class="sr__alert sr__alert--warn">
        <span>{errorMsg}</span>
        <button class="sr__btn" on:click={() => window.location.reload()}>Reload dashboard</button>
      </div>
    {:else if errorMsg}
      <div class="sr__alert sr__alert--error">
        <span>{errorMsg}{stale ? ' Showing the last figures that loaded.' : ''}</span>
        <button class="sr__btn" on:click={() => load(true)}>Retry</button>
      </div>
    {/if}
    {#if v2?.warnings.length}
      <div class="sr__alert sr__alert--info">
        <span>{v2.warnings[0]}{#if v2.warnings.length > 1} <a href="#sr-health">+{v2.warnings.length - 1} more</a>{/if}</span>
      </div>
    {/if}
  </div>

  {#if !v2}
    {#if loading || !errorMsg}
      <div class="sr__skeleton" aria-hidden="true">
        <div class="sr__sk-row">{#each Array(5) as _}<div class="sr__sk-tile"></div>{/each}</div>
        <div class="sr__sk-block"></div>
        <div class="sr__sk-block"></div>
      </div>
      <p class="sr__sr-only">Loading the sales report…</p>
    {/if}
  {:else}
    <div class:sr__dim={loading}>
      <!-- ── KPIs ──────────────────────────────────────────────────────── -->
      <section class="sr__kpis" aria-label="Key figures">
        {#each tiles as t (t.key)}
          <div class="sr__tile" class:sr__tile--asof={t.asOf}>
            <div class="sr__tile-top">
              <span class="sr__tile-label">{t.label}</span>
              <button
                class="sr__info"
                aria-label="What is {t.label}?"
                aria-expanded={openDef === t.key}
                on:click={() => toggleDef(t.key)}
              >i</button>
            </div>
            <div class="sr__tile-value">{t.value}</div>
            <div class="sr__tile-sub">{t.sub}</div>
            {#if t.asOf}
              <span class="sr__tile-delta sr__tile-delta--flat">as of today</span>
            {:else if t.delta}
              <span class="sr__tile-delta sr__tile-delta--{t.delta.dir}" title="vs {prevLabel}">
                {t.delta.dir === 'up' ? '▲' : t.delta.dir === 'down' ? '▼' : '■'} {t.delta.text} <span class="sr__sr-only">vs {prevLabel}</span>
              </span>
            {/if}
            {#if openDef === t.key}
              <p class="sr__def" role="note">{t.def}</p>
            {/if}
          </div>
        {/each}
      </section>

      {#if isEmpty}
        <div class="sr__empty-state">
          <p>No sales activity in {rangeLabel} for {v2.currency}.</p>
          <div class="sr__empty-actions">
            <button class="sr__btn" on:click={showAllTime}>Show all time</button>
            {#if v2.currencies.length > 1}
              <span>Other currencies with data: {v2.currencies.filter((c) => c !== v2?.currency).join(', ')}</span>
            {/if}
          </div>
        </div>
      {/if}

      <!-- ── Funnel ────────────────────────────────────────────────────── -->
      <section class="sr__section" aria-labelledby="sr-funnel-h">
        <div class="sr__section-head">
          <h4 id="sr-funnel-h">Pipeline funnel</h4>
          <span class="sr__hint">{v2.funnel.cohortSize} lead{v2.funnel.cohortSize === 1 ? '' : 's'} from {rangeLabel}, followed to today · click a stage to see who is there now</span>
        </div>
        {#if v2.funnel.cohortSize === 0}
          <p class="sr__empty">No leads in this period.</p>
        {:else}
          <ol class="sr__funnel">
            {#each v2.funnel.steps as s, i (s.stage)}
              <li>
                <button
                  class="sr__step"
                  class:sr__step--active={stageFilter === s.stage}
                  aria-pressed={stageFilter === s.stage}
                  on:click={() => pickStage(s.stage)}
                >
                  <span class="sr__step-label">{s.label}</span>
                  <span class="sr__step-bar" aria-hidden="true"><span style="width: {Math.max(2, s.pctOfCohort ?? 0)}%"></span></span>
                  <span class="sr__step-count">{s.reached}</span>
                  <span class="sr__step-meta">
                    {pct(s.pctOfCohort)} of leads
                    {#if i > 0}· {pct(s.conversionFromPrev)} from previous{/if}
                    {#if s.medianDaysFromPrev != null}· ~{days(s.medianDaysFromPrev)}{/if}
                    {#if s.undated}· {s.undated} undated{/if}
                  </span>
                </button>
              </li>
            {/each}
          </ol>
          <div class="sr__drops">
            <span class="sr__drops-label">Dropped:</span>
            <span class="sr__chip sr__chip--drop">No-show {v2.funnel.drops.noShow}</span>
            <span class="sr__chip sr__chip--drop">Not qualified {v2.funnel.drops.nonQualified}</span>
            <span class="sr__chip sr__chip--drop">Sale dropped {v2.funnel.drops.saleDropped}</span>
          </div>
        {/if}
      </section>

      <!-- ── Deals ─────────────────────────────────────────────────────── -->
      <section class="sr__section" id="sr-deals" aria-labelledby="sr-deals-h">
        <div class="sr__section-head">
          <h4 id="sr-deals-h">Deals</h4>
          <span class="sr__hint">{filteredDeals.length} with activity in {rangeLabel}</span>
        </div>
        <div class="sr__controls">
          <input class="sr__search" type="search" placeholder="Search name, route, service…" aria-label="Search deals" bind:value={dealSearch} on:input={() => (dealPage = 1)} />
          <div class="sr__ctl"><Select options={statusOptions} bind:value={dealStatus} on:change={() => (dealPage = 1)} size="sm" ariaLabel="Filter by status" /></div>
          <div class="sr__ctl"><Select options={sortOptions} bind:value={dealSort} size="sm" ariaLabel="Sort deals" /></div>
          {#if stageFilter}
            <button class="sr__chip sr__chip--filter" on:click={() => (stageFilter = null)}>
              At stage: {stageLabelOf(stageFilter)} <span aria-hidden="true">×</span><span class="sr__sr-only">Clear stage filter</span>
            </button>
          {/if}
        </div>
        <div class="sr__table-wrap">
          <table class="sr__table sr__table--deals">
            <thead>
              <tr>
                <th scope="col">Client</th>
                <th scope="col">Status</th>
                <th scope="col">Stage</th>
                <th scope="col">Route</th>
                <th scope="col" class="num">Booked</th>
                <th scope="col" class="num">Collected</th>
                <th scope="col" class="num">Outstanding</th>
                <th scope="col">Accepted</th>
                <th scope="col" class="num">Days to close</th>
              </tr>
            </thead>
            <tbody>
              {#each pagedDeals as d (d.key)}
                <tr>
                  <td data-label="Client">
                    {#if d.consultationId}
                      <button class="sr__link" on:click={() => openDeal(d)}>{d.name}</button>
                    {:else}
                      <span class="sr__strong">{d.name}</span> <span class="sr__muted">(no lead)</span>
                    {/if}
                    {#if d.service}<span class="sr__muted sr__block">{d.service}</span>{/if}
                  </td>
                  <td data-label="Status"><span class="sr__status sr__status--{d.status}">{STATUS_LABEL[d.status]}</span></td>
                  <td class="sr__m-hide" data-label="Stage">{d.stageLabel ?? '—'}</td>
                  <td class="sr__m-hide" data-label="Route">{d.route ?? '—'}</td>
                  <td data-label="Booked" class="num">{money(d.booked, d.currency)}</td>
                  <td data-label="Collected" class="num">{money(d.cash, d.currency)}</td>
                  <td data-label="Outstanding" class="num" class:sr__owed={d.outstanding > 0}>
                    {money(d.outstanding, d.currency)}{#if d.credit > 0} <span class="sr__muted">(credit {money(d.credit, d.currency)})</span>{/if}
                  </td>
                  <td class="sr__m-hide" data-label="Accepted">{shortDate(d.acceptedAt)}</td>
                  <td data-label="Days to close" class="num sr__m-hide">{days(d.daysToClose)}</td>
                </tr>
              {/each}
              {#if pagedDeals.length === 0}
                <tr><td colspan="9" class="sr__empty">No deals match.</td></tr>
              {/if}
            </tbody>
          </table>
        </div>
        {#if filteredDeals.length > pagedDeals.length}
          <button class="sr__btn sr__more" on:click={() => (dealPage += 1)}>
            Show more ({filteredDeals.length - pagedDeals.length} remaining)
          </button>
        {/if}
      </section>

      <!-- ── Monthly trend ─────────────────────────────────────────────── -->
      <section class="sr__section" aria-labelledby="sr-trend-h">
        <div class="sr__section-head">
          <h4 id="sr-trend-h">Monthly trend</h4>
          <div class="sr__seg-tabs" role="tablist" aria-label="Trend view">
            <button role="tab" aria-selected={!trendAsTable} class:active={!trendAsTable} on:click={() => (trendAsTable = false)}>Chart</button>
            <button role="tab" aria-selected={trendAsTable} class:active={trendAsTable} on:click={() => (trendAsTable = true)}>Table</button>
          </div>
        </div>
        {#if !trendAsTable}
          <div class="sr__legend"><span class="sr__key sr__key--booked"></span> Booked <span class="sr__key sr__key--cash"></span> Cash collected <span class="sr__muted">· number above = leads</span></div>
          <div class="sr__trend" role="img" aria-label="Booked and cash collected per month">
            {#each v2.monthly as m (m.month)}
              <div class="sr__trend-col" title="{monthName(m.month)}: {m.leads} leads, booked {money(m.booked)}, cash {money(m.cash)}">
                <span class="sr__trend-leads">{m.leads}</span>
                <div class="sr__trend-bars">
                  <span class="sr__trend-bar sr__trend-bar--booked" style="height: {(m.booked / trendMax) * 100}%"></span>
                  <span class="sr__trend-bar sr__trend-bar--cash" style="height: {(Math.max(0, m.cash) / trendMax) * 100}%"></span>
                </div>
                <span class="sr__trend-label">{monthName(m.month, v2.monthly.length <= 1 || m.month.endsWith('-01'))}</span>
              </div>
            {/each}
          </div>
        {:else}
          <div class="sr__table-wrap">
            <table class="sr__table">
              <thead>
                <tr>
                  <th scope="col">Month</th>
                  <th scope="col" class="num">Leads</th>
                  <th scope="col" class="num">Won</th>
                  <th scope="col" class="num">Booked</th>
                  <th scope="col" class="num">Invoiced</th>
                  <th scope="col" class="num">Cash</th>
                  <th scope="col" class="num">Margin</th>
                </tr>
              </thead>
              <tbody>
                {#each v2.monthly as m (m.month)}
                  <tr>
                    <th scope="row">{monthName(m.month)}</th>
                    <td class="num">{m.leads}</td>
                    <td class="num">{m.wonDeals}</td>
                    <td class="num">{money(m.booked)}</td>
                    <td class="num">{money(m.invoiced)}</td>
                    <td class="num">{money(m.cash)}</td>
                    <td class="num">{money(m.margin)}</td>
                  </tr>
                {/each}
              </tbody>
              <tfoot>
                <tr>
                  <th scope="row">Total</th>
                  <td class="num">{trendTotals.leads}</td>
                  <td class="num">{trendTotals.wonDeals}</td>
                  <td class="num">{money(trendTotals.booked)}</td>
                  <td class="num">{money(trendTotals.invoiced)}</td>
                  <td class="num">{money(trendTotals.cash)}</td>
                  <td class="num">{money(trendTotals.margin)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        {/if}
      </section>

      <div class="sr__split">
        <!-- ── Segments ────────────────────────────────────────────────── -->
        <section class="sr__section" aria-labelledby="sr-seg-h">
          <div class="sr__section-head">
            <h4 id="sr-seg-h">Where the money comes from</h4>
            <div class="sr__seg-tabs" role="tablist" aria-label="Segment by">
              {#each SEG_TABS as t (t.key)}
                <button role="tab" aria-selected={segTab === t.key} class:active={segTab === t.key} on:click={() => (segTab = t.key)}>{t.label}</button>
              {/each}
            </div>
          </div>
          {#if segNote}<p class="sr__hint sr__hint--block">{segNote}</p>{/if}
          {#if segRows.length === 0}
            <p class="sr__empty">Nothing booked or collected in this period.</p>
          {:else}
            <div class="sr__table-wrap">
              <table class="sr__table">
                <thead>
                  <tr>
                    <th scope="col">{SEG_TABS.find((t) => t.key === segTab)?.label}</th>
                    <th scope="col" class="num">Deals</th>
                    {#if segTab !== 'method'}<th scope="col" class="num">Booked</th>{/if}
                    <th scope="col" class="num">Cash</th>
                    {#if segTab !== 'method'}<th scope="col" class="num">Margin</th><th scope="col" class="num">Margin %</th>{/if}
                  </tr>
                </thead>
                <tbody>
                  {#each segRows as r (r.key)}
                    <tr>
                      <th scope="row">{r.label}</th>
                      <td class="num">{r.deals}</td>
                      {#if segTab !== 'method'}<td class="num">{money(r.booked)}</td>{/if}
                      <td class="num">{money(r.cash)}</td>
                      {#if segTab !== 'method'}<td class="num">{money(r.margin)}</td><td class="num">{pct(r.marginPct)}</td>{/if}
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          {/if}
        </section>

        <!-- ── Aging ───────────────────────────────────────────────────── -->
        <section class="sr__section" aria-labelledby="sr-aging-h">
          <div class="sr__section-head">
            <h4 id="sr-aging-h">Unpaid invoices by age</h4>
            <span class="sr__hint">as of today · {v2.aging.invoices} invoice{v2.aging.invoices === 1 ? '' : 's'} · {money(v2.aging.total)}</span>
          </div>
          {#if v2.aging.invoices === 0}
            <p class="sr__empty">No sent invoice is waiting for payment.</p>
          {:else}
            <ul class="sr__aging">
              {#each v2.aging.buckets as b (b.key)}
                <li class:sr__aging--late={b.key === '61-90' || b.key === '90+'}>
                  <span class="sr__aging-label">{b.label}</span>
                  <span class="sr__aging-bar" aria-hidden="true"><span style="width: {(b.amount / agingMax) * 100}%"></span></span>
                  <span class="sr__aging-value">{money(b.amount)} <span class="sr__muted">({b.invoices})</span></span>
                </li>
              {/each}
            </ul>
          {/if}
        </section>
      </div>

      <!-- ── Data health ───────────────────────────────────────────────── -->
      <details class="sr__section sr__health" id="sr-health">
        <summary>
          <h4>Data health</h4>
          <span class="sr__hint">{v2.warnings.length ? `${v2.warnings.length} thing${v2.warnings.length === 1 ? '' : 's'} to check` : 'All sources agree'}</span>
        </summary>
        {#if v2.warnings.length}
          <ul class="sr__warnings">
            {#each v2.warnings as w}<li>{w}</li>{/each}
          </ul>
        {/if}
        <table class="sr__table sr__table--compact">
          <caption class="sr__sr-only">Paid clients by source</caption>
          <tbody>
            <tr><th scope="row">Clients with a recorded payment</th><td class="num">{v2.health.paidByPayments}</td></tr>
            <tr><th scope="row">Clients flagged “payment confirmed”</th><td class="num">{v2.health.paidByConfirmedFlag}</td></tr>
            <tr><th scope="row">Legacy payment counter</th><td class="num">{v2.health.paidByCounters ?? '—'}</td></tr>
            <tr><th scope="row">Paid but not flagged confirmed</th><td class="num">{v2.health.paidWithoutConfirmedFlag}</td></tr>
            <tr><th scope="row">Finance payments matched to an invoice payment (counted once)</th><td class="num">{v2.health.duplicateSettlementPayments}</td></tr>
            <tr><th scope="row">Payments with no date</th><td class="num">{v2.health.undatedPayments}</td></tr>
            <tr><th scope="row">Leads with no date</th><td class="num">{v2.health.undatedLeads}</td></tr>
            <tr><th scope="row">Invoices not linked to a lead</th><td class="num">{v2.health.orphanInvoices}</td></tr>
          </tbody>
        </table>
        {#if v2.health.confirmedWithoutPayment.length}
          <p class="sr__hint sr__hint--block">Flagged confirmed, no payment recorded: {v2.health.confirmedWithoutPayment.slice(0, 12).join(', ')}{v2.health.confirmedWithoutPayment.length > 12 ? '…' : ''}</p>
        {/if}
        {#if v2.health.currencyMismatchDeals.length}
          <p class="sr__hint sr__hint--block">Mixed currencies: {v2.health.currencyMismatchDeals.slice(0, 12).join(', ')}</p>
        {/if}
      </details>
    </div>
  {/if}
</div>

<style>
  .sr {
    --sr-accent: #02b5bb;
    --sr-accent-ink: #02868a;
    --sr-ink: #0f172a;
    --sr-body: #334155;
    --sr-muted: #64748b;
    --sr-faint: #94a3b8;
    --sr-line: #e2e8f0;
    --sr-soft: #f8fafc;
    --sr-booked: #8b5cf6;
    --sr-cash: #10b981;
    font-family: var(--font-paragraph, 'Jost'), system-ui, sans-serif;
    color: var(--irp-text, #181818);
  }

  .sr__head { display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; margin-bottom: 1rem; flex-wrap: wrap; }
  .sr__head h3 { margin: 0; font-size: 1.05rem; font-weight: 800; color: var(--sr-ink); }
  .sr__head p { margin: 0.3rem 0 0; font-size: 0.8rem; color: var(--sr-muted); }
  .sr__head-actions { display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; }
  .sr__updated { font-size: 0.74rem; color: var(--sr-faint); }

  .sr__btn {
    padding: 0.45rem 0.95rem; background: #fff; border: 1px solid var(--sr-line); border-radius: 10px;
    color: #475569; font: inherit; font-size: 0.8rem; font-weight: 700; cursor: pointer;
    transition: background 0.14s, color 0.14s, border-color 0.14s;
  }
  .sr__btn:hover:not(:disabled) { background: #f1f5f9; color: #1e293b; }
  .sr__btn:disabled { opacity: 0.55; cursor: not-allowed; }
  .sr__btn--primary { background: var(--sr-accent); border-color: var(--sr-accent); color: #fff; }
  .sr__btn--primary:hover:not(:disabled) { background: var(--sr-accent-ink); color: #fff; }
  .sr__btn:focus-visible, .sr__step:focus-visible, .sr__info:focus-visible, .sr__link:focus-visible,
  .sr__seg-tabs button:focus-visible, .sr__chip--filter:focus-visible {
    outline: 2px solid var(--sr-accent); outline-offset: 2px;
  }

  .sr__filters {
    position: sticky; top: 0; z-index: 5; display: flex; flex-wrap: wrap; gap: 0.9rem; align-items: flex-end;
    padding: 0.7rem 0.9rem; margin-bottom: 0.9rem; background: rgba(255, 255, 255, 0.94);
    backdrop-filter: blur(6px); border: 1px solid var(--sr-line); border-radius: 14px;
  }
  .sr__control { display: flex; flex-direction: column; gap: 0.25rem; min-width: 150px; }
  .sr__control-label { font-size: 0.66rem; font-weight: 800; color: var(--sr-faint); text-transform: uppercase; letter-spacing: 0.08em; }
  .sr__control input, .sr__search {
    padding: 0.42rem 0.6rem; border: 1px solid var(--sr-line); border-radius: 8px; background: #fff;
    color: var(--sr-ink); font: inherit; font-size: 0.82rem;
  }
  .sr__control input:focus, .sr__search:focus { outline: none; border-color: rgba(2, 181, 187, 0.5); box-shadow: 0 0 0 3px rgba(2, 181, 187, 0.12); }
  .sr__range-note { margin: 0 0 0.35rem auto; font-size: 0.78rem; font-weight: 700; color: var(--sr-body); }
  .sr__range-note span { font-weight: 500; color: var(--sr-faint); }

  .sr__live:empty { display: none; }
  .sr__alert { display: flex; align-items: center; justify-content: space-between; gap: 0.8rem; flex-wrap: wrap; padding: 0.55rem 0.9rem; border-radius: 10px; font-size: 0.8rem; margin-bottom: 0.7rem; border: 1px solid; }
  .sr__alert--error { background: #fef2f2; border-color: #fecaca; color: #b91c1c; }
  .sr__alert--warn { background: #fffbeb; border-color: #fde68a; color: #92400e; }
  .sr__alert--info { background: #f0f9ff; border-color: #bae6fd; color: #075985; }
  .sr__alert a { color: inherit; font-weight: 700; }
  .sr__badge { font-size: 0.66rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.06em; padding: 0.15em 0.55em; border-radius: 999px; }
  .sr__badge--warn { background: #fef3c7; color: #92400e; }
  .sr__dim { opacity: 0.6; transition: opacity 0.2s; pointer-events: none; }

  /* Skeleton */
  .sr__skeleton { display: grid; gap: 1rem; }
  .sr__sk-row { display: grid; grid-template-columns: repeat(5, 1fr); gap: 0.8rem; }
  .sr__sk-tile, .sr__sk-block { border-radius: 14px; background: linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%); background-size: 200% 100%; animation: sr-shimmer 1.4s infinite; }
  .sr__sk-tile { height: 104px; }
  .sr__sk-block { height: 220px; }
  @keyframes sr-shimmer { to { background-position: -200% 0; } }
  @media (prefers-reduced-motion: reduce) { .sr__sk-tile, .sr__sk-block { animation: none; } }

  /* KPIs */
  .sr__kpis { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 0.8rem; margin-bottom: 1rem; }
  .sr__tile {
    position: relative; padding: 0.9rem 1rem; background: #fff; border: 1px solid var(--sr-line); border-radius: 14px;
    border-left: 4px solid var(--sr-accent); box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  }
  .sr__tile--asof { border-left-color: #f59e0b; }
  .sr__tile-top { display: flex; justify-content: space-between; align-items: center; }
  .sr__tile-label { font-size: 0.7rem; font-weight: 800; color: var(--sr-muted); text-transform: uppercase; letter-spacing: 0.07em; }
  .sr__info {
    width: 18px; height: 18px; border-radius: 50%; border: 1px solid var(--sr-line); background: var(--sr-soft);
    color: var(--sr-muted); font: italic 700 0.68rem/1 Georgia, serif; cursor: pointer; padding: 0;
  }
  .sr__tile-value { margin-top: 0.35rem; font-size: 1.45rem; font-weight: 800; color: var(--sr-ink); font-variant-numeric: tabular-nums; }
  .sr__tile-sub { margin-top: 0.15rem; font-size: 0.74rem; color: var(--sr-muted); }
  .sr__tile-delta { display: inline-block; margin-top: 0.4rem; font-size: 0.72rem; font-weight: 700; }
  .sr__tile-delta--up { color: #047857; }
  .sr__tile-delta--down { color: #b91c1c; }
  .sr__tile-delta--flat { color: var(--sr-faint); }
  .sr__def { margin: 0.5rem 0 0; padding: 0.5rem 0.6rem; background: var(--sr-soft); border-radius: 8px; font-size: 0.74rem; line-height: 1.4; color: var(--sr-body); }

  .sr__empty-state { padding: 1rem 1.2rem; margin-bottom: 1rem; border: 1px dashed var(--sr-line); border-radius: 14px; color: var(--sr-muted); font-size: 0.85rem; }
  .sr__empty-state p { margin: 0 0 0.6rem; }
  .sr__empty-actions { display: flex; gap: 0.8rem; align-items: center; flex-wrap: wrap; font-size: 0.78rem; }

  /* Sections */
  .sr__section {
    padding: 1.1rem 1.2rem; border-radius: 16px; background: #fff; border: 1px solid var(--sr-line);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05), 0 8px 32px rgba(0, 0, 0, 0.03); margin-bottom: 1rem; min-width: 0;
  }
  .sr__section-head { display: flex; justify-content: space-between; align-items: baseline; gap: 0.8rem; flex-wrap: wrap; margin-bottom: 0.8rem; }
  .sr__section h4 { margin: 0; font-size: 0.8rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.09em; color: var(--sr-muted); }
  .sr__hint { font-size: 0.74rem; color: var(--sr-faint); }
  .sr__hint--block { display: block; margin: 0 0 0.7rem; }
  .sr__empty { color: var(--sr-faint); font-size: 0.84rem; font-style: italic; padding: 0.4rem 0; margin: 0; }
  .sr__split { display: grid; grid-template-columns: minmax(0, 3fr) minmax(0, 2fr); gap: 1rem; }
  .sr__split .sr__section { margin-bottom: 1rem; }

  /* Funnel */
  .sr__funnel { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.35rem; }
  .sr__step {
    width: 100%; display: grid; grid-template-columns: 170px minmax(0, 1fr) 52px; grid-template-rows: auto auto;
    column-gap: 0.8rem; align-items: center; padding: 0.45rem 0.6rem; border: 1px solid transparent; border-radius: 10px;
    background: none; font: inherit; text-align: left; cursor: pointer; color: var(--sr-body);
  }
  .sr__step:hover { background: var(--sr-soft); }
  .sr__step--active { background: rgba(2, 181, 187, 0.07); border-color: rgba(2, 181, 187, 0.35); }
  .sr__step-label { font-size: 0.82rem; font-weight: 700; color: var(--sr-ink); }
  .sr__step-bar { height: 14px; background: #f1f5f9; border-radius: 7px; overflow: hidden; }
  .sr__step-bar span { display: block; height: 100%; background: linear-gradient(90deg, var(--sr-accent), #38bdf8); border-radius: 7px; }
  .sr__step-count { font-size: 0.95rem; font-weight: 800; text-align: right; font-variant-numeric: tabular-nums; color: var(--sr-ink); }
  .sr__step-meta { grid-column: 2 / 4; font-size: 0.7rem; color: var(--sr-faint); margin-top: 0.15rem; }
  .sr__drops { display: flex; flex-wrap: wrap; gap: 0.4rem; align-items: center; margin-top: 0.8rem; }
  .sr__drops-label { font-size: 0.72rem; font-weight: 700; color: var(--sr-muted); }

  .sr__chip { display: inline-flex; align-items: center; gap: 0.3rem; padding: 0.2em 0.65em; border-radius: 999px; font-size: 0.72rem; font-weight: 700; border: 1px solid var(--sr-line); background: var(--sr-soft); color: var(--sr-body); }
  .sr__chip--drop { background: #fef2f2; border-color: #fecaca; color: #b91c1c; }
  .sr__chip--filter { cursor: pointer; background: rgba(2, 181, 187, 0.08); border-color: rgba(2, 181, 187, 0.35); color: var(--sr-accent-ink); font: inherit; font-size: 0.74rem; font-weight: 700; }

  /* Deals */
  .sr__controls { display: flex; flex-wrap: wrap; gap: 0.6rem; align-items: center; margin-bottom: 0.8rem; }
  .sr__search { flex: 1 1 240px; min-width: 200px; }
  .sr__ctl { flex: 0 0 190px; }
  .sr__link { background: none; border: none; padding: 0; font: inherit; font-weight: 700; color: var(--sr-ink); cursor: pointer; text-align: left; text-decoration: underline; text-decoration-color: rgba(2, 181, 187, 0.45); text-underline-offset: 3px; }
  .sr__link:hover { color: var(--sr-accent-ink); }
  .sr__strong { font-weight: 700; color: var(--sr-ink); }
  .sr__muted { color: var(--sr-faint); font-size: 0.74rem; font-weight: 500; }
  .sr__block { display: block; }
  .sr__owed { color: #b45309; font-weight: 700; }
  .sr__status { display: inline-block; padding: 0.14em 0.6em; border-radius: 999px; font-size: 0.68rem; font-weight: 800; letter-spacing: 0.03em; border: 1px solid transparent; white-space: nowrap; }
  .sr__status--open, .sr__status--quoted { background: #f8fafc; color: #475569; border-color: #e2e8f0; }
  .sr__status--accepted { background: #f5f3ff; color: #6d28d9; border-color: #ddd6fe; }
  .sr__status--invoiced { background: #eff6ff; color: #1d4ed8; border-color: #bfdbfe; }
  .sr__status--partially_paid { background: #fffbeb; color: #b45309; border-color: #fde68a; }
  .sr__status--paid { background: #ecfdf5; color: #047857; border-color: #a7f3d0; }
  .sr__status--dropped { background: #fef2f2; color: #b91c1c; border-color: #fecaca; }
  .sr__more { margin-top: 0.75rem; }

  /* Tables */
  .sr__table-wrap { overflow-x: auto; }
  .sr__table { width: 100%; border-collapse: collapse; font-size: 0.8rem; }
  .sr__table thead tr { background: var(--sr-soft); }
  .sr__table th[scope='col'] { text-align: left; padding: 0.5rem 0.7rem; color: var(--sr-faint); font-size: 0.66rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; white-space: nowrap; border-bottom: 1px solid var(--sr-line); }
  .sr__table th[scope='row'] { text-align: left; font-weight: 700; color: var(--sr-ink); }
  .sr__table td, .sr__table th[scope='row'] { padding: 0.5rem 0.7rem; color: var(--sr-body); border-bottom: 1px solid #f1f5f9; font-variant-numeric: tabular-nums; }
  .sr__table th[scope='row'] { color: var(--sr-ink); }
  .sr__table .num { text-align: right; white-space: nowrap; }
  .sr__table tbody tr:hover { background: #fafbff; }
  .sr__table tfoot th, .sr__table tfoot td { font-weight: 800; color: var(--sr-ink); border-top: 2px solid var(--sr-line); border-bottom: none; background: rgba(2, 181, 187, 0.04); }
  .sr__table--compact td, .sr__table--compact th[scope='row'] { padding: 0.35rem 0.5rem; font-weight: 500; }

  /* Segment tabs */
  .sr__seg-tabs { display: inline-flex; padding: 3px; background: #f1f5f9; border-radius: 10px; gap: 2px; }
  .sr__seg-tabs button { padding: 0.3rem 0.7rem; border: none; border-radius: 8px; background: none; font: inherit; font-size: 0.74rem; font-weight: 700; color: var(--sr-muted); cursor: pointer; }
  .sr__seg-tabs button.active { background: #fff; color: var(--sr-ink); box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08); }

  /* Trend */
  .sr__legend { display: flex; align-items: center; gap: 0.4rem; font-size: 0.72rem; color: var(--sr-muted); margin-bottom: 0.6rem; flex-wrap: wrap; }
  .sr__key { display: inline-block; width: 10px; height: 10px; border-radius: 3px; margin-left: 0.4rem; }
  .sr__key--booked { background: var(--sr-booked); }
  .sr__key--cash { background: var(--sr-cash); }
  .sr__trend { display: flex; gap: 6px; align-items: flex-end; height: 190px; overflow-x: auto; padding-bottom: 0.2rem; }
  .sr__trend-col { flex: 1 0 34px; max-width: 72px; display: flex; flex-direction: column; align-items: center; height: 100%; }
  .sr__trend-leads { font-size: 0.66rem; font-weight: 700; color: var(--sr-muted); }
  .sr__trend-bars { flex: 1; width: 100%; display: flex; gap: 2px; align-items: flex-end; justify-content: center; }
  .sr__trend-bar { width: 42%; min-height: 1px; border-radius: 4px 4px 0 0; }
  .sr__trend-bar--booked { background: var(--sr-booked); }
  .sr__trend-bar--cash { background: var(--sr-cash); }
  .sr__trend-label { margin-top: 0.3rem; font-size: 0.64rem; color: var(--sr-faint); white-space: nowrap; }

  /* Aging */
  .sr__aging { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.55rem; }
  .sr__aging li { display: grid; grid-template-columns: 82px minmax(0, 1fr) auto; gap: 0.6rem; align-items: center; font-size: 0.8rem; }
  .sr__aging-label { color: var(--sr-body); font-weight: 600; }
  .sr__aging-bar { height: 12px; background: #f1f5f9; border-radius: 6px; overflow: hidden; }
  .sr__aging-bar span { display: block; height: 100%; background: #f59e0b; border-radius: 6px; }
  .sr__aging--late .sr__aging-bar span { background: #ef4444; }
  .sr__aging-value { font-weight: 700; font-variant-numeric: tabular-nums; color: var(--sr-ink); }

  /* Health */
  .sr__health summary { display: flex; align-items: baseline; gap: 0.8rem; cursor: pointer; list-style: none; }
  .sr__health summary::-webkit-details-marker { display: none; }
  .sr__health summary::before { content: '▸'; color: var(--sr-faint); font-size: 0.8rem; }
  .sr__health[open] summary::before { content: '▾'; }
  .sr__health[open] summary { margin-bottom: 0.8rem; }
  .sr__warnings { margin: 0 0 0.8rem; padding-left: 1.1rem; font-size: 0.8rem; color: #92400e; display: grid; gap: 0.25rem; }

  .sr__sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }

  /* Responsive */
  @media (max-width: 1100px) {
    .sr__kpis { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .sr__split { grid-template-columns: minmax(0, 1fr); }
  }
  @media (max-width: 640px) {
    .sr__kpis, .sr__sk-row { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .sr__tile-value { font-size: 1.2rem; }
    .sr__filters { position: static; }
    .sr__control { min-width: 0; flex: 1 1 140px; }
    .sr__ctl { flex: 1 1 140px; }
    .sr__range-note { margin-left: 0; }
    .sr__step { grid-template-columns: minmax(0, 1fr) 44px; }
    .sr__step-bar { grid-column: 1 / 3; grid-row: 2; margin-top: 0.25rem; }
    .sr__step-meta { grid-column: 1 / 3; grid-row: 3; }
    /* Deals become stacked cards */
    .sr__table--deals thead { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0, 0, 0, 0); }
    .sr__table--deals, .sr__table--deals tbody, .sr__table--deals tr, .sr__table--deals td { display: block; width: 100%; }
    .sr__table--deals tr { border: 1px solid var(--sr-line); border-radius: 12px; padding: 0.4rem 0.2rem; margin-bottom: 0.6rem; }
    .sr__table--deals td { display: flex; justify-content: space-between; gap: 0.8rem; border: none; padding: 0.25rem 0.6rem; text-align: right; white-space: normal; }
    .sr__table--deals td::before { content: attr(data-label); font-size: 0.68rem; font-weight: 700; color: var(--sr-faint); text-transform: uppercase; letter-spacing: 0.06em; text-align: left; }
    .sr__table--deals td.num { text-align: right; }
    .sr__table--deals td.sr__m-hide { display: none; }
    .sr__table--deals td:first-child { font-size: 0.9rem; }
    .sr__table--deals td:first-child::before { content: none; }
  }
</style>
