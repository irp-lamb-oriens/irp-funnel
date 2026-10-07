<script lang="ts">
  /**
   * SalesReportView — monthly sales / payment-funnel report.
   *
   * Read-only. Everything comes from GET /api/dashboard/sales-report, which
   * reads invoices, consultations, quotes and payment_counters and returns the
   * already-aggregated funnel segmented by year, plus the money behind each
   * reading and cross-cutting buckets. This component only formats and filters,
   * so there is no client-side arithmetic to drift from the server.
   */
  import { onMount } from 'svelte';
  import {
    salesReport,
    fetchSalesReport,
    type SalesMonth,
    type SalesYear,
    type SalesBucket,
    type ProjectCompletion,
  } from '../store.ts';
  import Select, { type SelectOption } from './ui/Select.svelte';

  let loading = false;
  let errorMsg = '';

  // Year segmentation (chronological). 'all' shows the grand totals.
  let selectedYear = 'all';
  // Project table filter by kind.
  let projectKind: 'all' | 'quote' | 'consultation' | 'invoice' = 'all';
  // Project table search + pagination.
  let projectSearch = '';
  let projectPage = 1;
  const PROJECT_PAGE_SIZE = 25;

  async function load(): Promise<void> {
    loading = true;
    errorMsg = '';
    try {
      await fetchSalesReport();
    } catch (err: any) {
      errorMsg = err?.message ?? 'Could not load the sales report.';
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    if (!$salesReport) load();
  });

  $: yearOptions = (() => {
    const opts: SelectOption[] = [{ value: 'all', label: 'All years' }];
    for (const y of $salesReport?.years ?? []) opts.push({ value: y, label: y });
    return opts;
  })();

  const kindOptions: SelectOption[] = [
    { value: 'all', label: 'All types' },
    { value: 'invoice', label: 'Invoices' },
    { value: 'consultation', label: 'Consultations' },
    { value: 'quote', label: 'Quotes' },
  ];

  /** The month rows for the currently selected year (or the grand total). */
  $: selectedMonths = (() => {
    const r = $salesReport;
    if (!r) return [];
    if (selectedYear === 'all') {
      return r.byYear.flatMap((y) => y.months).sort((a, b) => a.month.localeCompare(b.month));
    }
    const year = r.byYear.find((y) => y.year === selectedYear);
    return year?.months ?? [];
  })();

  /** The totals row shown above the monthly table. */
  $: selectedTotals = (() => {
    const r = $salesReport;
    if (!r) return null;
    if (selectedYear === 'all') return r.totals;
    return r.byYear.find((y) => y.year === selectedYear)?.totals ?? null;
  })();

  $: filteredProjects = (() => {
    const all = $salesReport?.projects ?? [];
    const q = projectSearch.toLowerCase().trim();
    return all.filter((p) => {
      if (projectKind !== 'all' && p.kind !== projectKind) return false;
      if (q && !`${p.label} ${p.id}`.toLowerCase().includes(q)) return false;
      return true;
    });
  })();

  $: pagedProjects = filteredProjects.slice(0, projectPage * PROJECT_PAGE_SIZE);
  $: hasMoreProjects = filteredProjects.length > projectPage * PROJECT_PAGE_SIZE;

  function pct(n: number | null | undefined): string {
    return typeof n === 'number' ? `${n.toFixed(1)}%` : '—';
  }

  function money(n: number | null | undefined): string {
    if (typeof n !== 'number' || !Number.isFinite(n)) return '—';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(n);
  }

  function shortDate(iso: string | null | undefined): string {
    if (!iso) return '—';
    const d = new Date(iso);
    return Number.isNaN(d.getTime())
      ? '—'
      : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  const KIND_LABEL: Record<ProjectCompletion['kind'], string> = {
    invoice: 'Invoice',
    consultation: 'Consultation',
    quote: 'Quote',
  };

  // Column definitions for the monthly table, so the markup stays a single loop.
  const MONTH_COLUMNS: Array<{ key: keyof SalesMonth; label: string; group: string; money?: boolean }> = [
    { key: 'leadsEntered', label: 'Leads', group: 'Entered' },
    { key: 'invoicesEntered', label: 'Invoices', group: 'Entered' },
    { key: 'quotesEntered', label: 'Quotes', group: 'Entered' },
    { key: 'invoicesStarted', label: 'Invoices created', group: 'Started' },
    { key: 'invoicesSent', label: 'Invoices sent', group: 'Started' },
    { key: 'clientsStartedPayment', label: 'Clients in payment', group: 'Started' },
    { key: 'invoicePaymentsRecorded', label: 'Invoice payments', group: 'Recorded' },
    { key: 'clientsPaymentConfirmed', label: 'Clients confirmed', group: 'Recorded' },
    { key: 'counterBumps', label: 'Counter bumps', group: 'Recorded' },
    { key: 'invoiced', label: 'Invoiced', group: 'Money', money: true },
    { key: 'collected', label: 'Collected', group: 'Money', money: true },
    { key: 'outstanding', label: 'Outstanding', group: 'Money', money: true },
    { key: 'margin', label: 'Margin', group: 'Money', money: true },
    { key: 'cost', label: 'Cost', group: 'Money', money: true },
  ];

  // Bucket tables: one per cross-cutting dimension.
  const BUCKET_TABLES: Array<{ key: 'byRoute' | 'byService' | 'byProvider' | 'byCurrency' | 'byPaymentMethod'; title: string }> = [
    { key: 'byRoute', title: 'By route' },
    { key: 'byService', title: 'By service' },
    { key: 'byProvider', title: 'By provider' },
    { key: 'byCurrency', title: 'By currency' },
    { key: 'byPaymentMethod', title: 'By payment method' },
  ];

  function bucketRows(key: string): SalesBucket[] {
    const r = $salesReport;
    if (!r) return [];
    return (r as any)[key] ?? [];
  }
</script>

<div class="sr">
  <header class="sr__head">
    <div>
      <h3>Sales report</h3>
      <p>Monthly payment funnel, segmented by year, with the money behind each reading.</p>
    </div>
    <div class="sr__head-actions">
      <button class="sr__reload" on:click={load} disabled={loading}>
        {loading ? 'Loading…' : 'Refresh'}
      </button>
    </div>
  </header>

  {#if errorMsg}
    <p class="sr__error">{errorMsg}</p>
  {/if}

  {#if !$salesReport}
    <p class="sr__empty">{loading ? 'Reading the report…' : 'No report yet.'}</p>
  {:else}
    <div class="sr__controls">
      <div class="sr__control">
        <span class="sr__control-label">Year</span>
        <Select options={yearOptions} bind:value={selectedYear} size="sm" ariaLabel="Filter by year" />
      </div>
    </div>

    <!-- ── Funnel percentages ─────────────────────────────────────────── -->
    <section class="sr__section">
      <h4>Funnel</h4>
      <div class="sr__funnel">
        <div class="sr__funnel-group">
          <span class="sr__funnel-title">Started ÷ entered</span>
          <div class="sr__funnel-row">
            <span class="sr__funnel-label">Invoice</span>
            <span class="sr__funnel-value">{pct($salesReport.funnel.startedOfEntered.invoice.pct)}</span>
            <span class="sr__funnel-sub">{$salesReport.funnel.startedOfEntered.invoice.numerator} / {$salesReport.funnel.startedOfEntered.invoice.denominator}</span>
          </div>
          <div class="sr__funnel-row">
            <span class="sr__funnel-label">Client</span>
            <span class="sr__funnel-value">{pct($salesReport.funnel.startedOfEntered.client.pct)}</span>
            <span class="sr__funnel-sub">{$salesReport.funnel.startedOfEntered.client.numerator} / {$salesReport.funnel.startedOfEntered.client.denominator}</span>
          </div>
          <div class="sr__funnel-row">
            <span class="sr__funnel-label">Quote</span>
            <span class="sr__funnel-value">{pct($salesReport.funnel.startedOfEntered.quote.pct)}</span>
            <span class="sr__funnel-sub">{$salesReport.funnel.startedOfEntered.quote.numerator} / {$salesReport.funnel.startedOfEntered.quote.denominator}</span>
          </div>
        </div>

        <div class="sr__funnel-group">
          <span class="sr__funnel-title">Recorded ÷ entered</span>
          <div class="sr__funnel-row">
            <span class="sr__funnel-label">Invoice</span>
            <span class="sr__funnel-value">{pct($salesReport.funnel.recordedOfEntered.invoice.pct)}</span>
            <span class="sr__funnel-sub">{$salesReport.funnel.recordedOfEntered.invoice.numerator} / {$salesReport.funnel.recordedOfEntered.invoice.denominator}</span>
          </div>
          <div class="sr__funnel-row">
            <span class="sr__funnel-label">Client</span>
            <span class="sr__funnel-value">{pct($salesReport.funnel.recordedOfEntered.client.pct)}</span>
            <span class="sr__funnel-sub">{$salesReport.funnel.recordedOfEntered.client.numerator} / {$salesReport.funnel.recordedOfEntered.client.denominator}</span>
          </div>
        </div>

        <div class="sr__funnel-group">
          <span class="sr__funnel-title">Recorded ÷ started</span>
          <div class="sr__funnel-row">
            <span class="sr__funnel-label">Invoice</span>
            <span class="sr__funnel-value">{pct($salesReport.funnel.recordedOfStarted.invoice.pct)}</span>
            <span class="sr__funnel-sub">{$salesReport.funnel.recordedOfStarted.invoice.numerator} / {$salesReport.funnel.recordedOfStarted.invoice.denominator}</span>
          </div>
          <div class="sr__funnel-row">
            <span class="sr__funnel-label">Client</span>
            <span class="sr__funnel-value">{pct($salesReport.funnel.recordedOfStarted.client.pct)}</span>
            <span class="sr__funnel-sub">{$salesReport.funnel.recordedOfStarted.client.numerator} / {$salesReport.funnel.recordedOfStarted.client.denominator}</span>
          </div>
        </div>

        <div class="sr__funnel-group sr__funnel-group--rate">
          <span class="sr__funnel-title">Collection rate</span>
          <div class="sr__funnel-row">
            <span class="sr__funnel-label">Collected ÷ invoiced</span>
            <span class="sr__funnel-value">{pct($salesReport.collectionRate.pct)}</span>
            <span class="sr__funnel-sub">{$salesReport.collectionRate.numerator} / {$salesReport.collectionRate.denominator}</span>
          </div>
        </div>
      </div>
    </section>

    <!-- ── Monthly table ──────────────────────────────────────────────── -->
    <section class="sr__section">
      <h4>Monthly breakdown</h4>
      {#if selectedTotals}
        <div class="sr__totals">
          <span class="sr__totals-label">Totals</span>
          {#each MONTH_COLUMNS as col}
            <span class="sr__totals-cell">{col.money ? money(selectedTotals[col.key] as number) : selectedTotals[col.key]}</span>
          {/each}
        </div>
      {/if}
      <div class="sr__table-wrap">
        <table class="sr__table">
          <thead>
            <tr>
              <th>Month</th>
              {#each MONTH_COLUMNS as col}
                <th title={col.group}>{col.label}</th>
              {/each}
            </tr>
          </thead>
          <tbody>
            {#each selectedMonths as m (m.month)}
              <tr>
                <td class="sr__month">{m.month}</td>
                {#each MONTH_COLUMNS as col}
                  <td>{col.money ? money(m[col.key] as number) : m[col.key]}</td>
                {/each}
              </tr>
            {/each}
            {#if selectedMonths.length === 0}
              <tr><td colspan={MONTH_COLUMNS.length + 1} class="sr__empty">No data for this year.</td></tr>
            {/if}
          </tbody>
        </table>
      </div>
    </section>

    <!-- ── Cross-cutting money buckets ────────────────────────────────── -->
    <section class="sr__section">
      <h4>Money by segment</h4>
      <div class="sr__buckets">
        {#each BUCKET_TABLES as bt}
          <div class="sr__bucket">
            <span class="sr__bucket-title">{bt.title}</span>
            {#if bucketRows(bt.key).length === 0}
              <p class="sr__empty">No data.</p>
            {:else}
              <div class="sr__table-wrap">
                <table class="sr__table">
                  <thead>
                    <tr>
                      <th>Segment</th>
                      <th>#</th>
                      <th>Invoiced</th>
                      <th>Collected</th>
                      <th>Outstanding</th>
                      <th>Margin</th>
                    </tr>
                  </thead>
                  <tbody>
                    {#each bucketRows(bt.key) as b (b.key)}
                      <tr>
                        <td class="sr__proj">{b.label}</td>
                        <td>{b.n}</td>
                        <td>{money(b.invoiced)}</td>
                        <td>{money(b.collected)}</td>
                        <td>{money(b.outstanding)}</td>
                        <td>{money(b.margin)}</td>
                      </tr>
                    {/each}
                  </tbody>
                </table>
              </div>
            {/if}
          </div>
        {/each}
      </div>
    </section>

    <!-- ── Project completion ─────────────────────────────────────────── -->
    <section class="sr__section">
      <h4>Project payment completion</h4>
      <div class="sr__controls">
        <div class="sr__control">
          <span class="sr__control-label">Type</span>
          <Select options={kindOptions} bind:value={projectKind} size="sm" ariaLabel="Filter by project type" />
        </div>
        <div class="sr__control sr__control--search">
          <input
            type="text"
            placeholder="Search projects…"
            bind:value={projectSearch}
            on:input={() => (projectPage = 1)}
          />
        </div>
      </div>
      <div class="sr__table-wrap">
        <table class="sr__table">
          <thead>
            <tr>
              <th>Type</th>
              <th>Project</th>
              <th>Completed</th>
              <th>Contract</th>
              <th>Collected</th>
              <th>Outstanding</th>
              <th>Margin</th>
              <th>Source</th>
            </tr>
          </thead>
          <tbody>
            {#each pagedProjects as p (p.kind + ':' + p.id)}
              <tr>
                <td><span class="sr__kind sr__kind--{p.kind}">{KIND_LABEL[p.kind]}</span></td>
                <td class="sr__proj" title={p.id}>{p.label}</td>
                <td class:sr__done={!!p.completedAt}>{shortDate(p.completedAt)}</td>
                <td>{money(p.contractValue)}</td>
                <td>{money(p.collected)}</td>
                <td>{money(p.outstanding)}</td>
                <td>{money(p.margin)}</td>
                <td class="sr__source">{p.source}</td>
              </tr>
            {/each}
            {#if pagedProjects.length === 0}
              <tr><td colspan="8" class="sr__empty">No projects match.</td></tr>
            {/if}
          </tbody>
        </table>
      </div>
      {#if hasMoreProjects}
        <button class="sr__more" on:click={() => (projectPage += 1)}>
          Load more ({filteredProjects.length - pagedProjects.length} remaining)
        </button>
      {/if}
    </section>
  {/if}
</div>

<style>
  .sr {
    font-family: var(--font-paragraph, 'Jost'), system-ui, sans-serif;
    color: var(--irp-text, #181818);
  }

  .sr__head {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 1rem;
    margin-bottom: 1.25rem;
    flex-wrap: wrap;
  }
  .sr__head h3 { margin: 0; font-size: 1.05rem; font-weight: 800; color: #0f172a; }
  .sr__head p { margin: 0.3rem 0 0; font-size: 0.8rem; color: #64748b; }
  .sr__head-actions { display: flex; gap: 0.6rem; }

  .sr__reload {
    padding: 0.5rem 1.1rem;
    background: #fff;
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    color: #475569;
    font-family: inherit;
    font-size: 0.82rem;
    font-weight: 700;
    cursor: pointer;
    transition: background 0.14s cubic-bezier(0.4, 0, 0.2, 1), color 0.14s cubic-bezier(0.4, 0, 0.2, 1);
  }
  .sr__reload:hover:not(:disabled) { background: #f1f5f9; color: #1e293b; }
  .sr__reload:disabled { opacity: 0.55; cursor: wait; }

  .sr__error {
    padding: 0.6rem 1rem;
    border-radius: 8px;
    background: #fef2f2;
    border: 1px solid #fecaca;
    color: #dc2626;
    font-size: 0.82rem;
    font-weight: 600;
    margin-bottom: 0.8rem;
  }
  .sr__empty { color: #94a3b8; font-size: 0.85rem; font-style: italic; padding: 0.5rem 0; }

  .sr__controls {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
    align-items: flex-end;
    margin-bottom: 1rem;
  }
  .sr__control { display: flex; flex-direction: column; gap: 0.3rem; min-width: 180px; }
  .sr__control--search { flex: 1; min-width: 220px; }
  .sr__control-label {
    font-size: 0.7rem;
    font-weight: 800;
    color: #94a3b8;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }
  .sr__control input {
    padding: 0.45rem 0.6rem;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    background: #fff;
    color: #0f172a;
    font-family: inherit;
    font-size: 0.82rem;
    transition: border-color 0.14s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.14s cubic-bezier(0.4, 0, 0.2, 1);
  }
  .sr__control input:focus {
    outline: none;
    border-color: rgba(2, 181, 187, 0.48);
    box-shadow: 0 0 0 3px rgba(2, 181, 187, 0.1);
  }

  .sr__section {
    padding: 1.25rem;
    border-radius: 16px;
    background: #fff;
    border: 1px solid #e2e8f0;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06), 0 8px 32px rgba(0, 0, 0, 0.04);
    margin-bottom: 1.25rem;
  }
  .sr__section h4 {
    margin: 0 0 1rem;
    font-size: 0.8rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.09em;
    color: #94a3b8;
  }

  .sr__funnel { display: flex; flex-wrap: wrap; gap: 1.25rem; }
  .sr__funnel-group {
    flex: 1;
    min-width: 220px;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    padding: 0.9rem 1rem;
  }
  .sr__funnel-group--rate { background: rgba(2, 181, 187, 0.05); border-color: rgba(2, 181, 187, 0.2); }
  .sr__funnel-title { display: block; font-size: 0.7rem; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 0.6rem; }
  .sr__funnel-row { display: flex; align-items: baseline; gap: 0.5rem; padding: 0.25rem 0; }
  .sr__funnel-label { font-size: 0.8rem; font-weight: 600; color: #334155; min-width: 60px; }
  .sr__funnel-value { font-size: 1rem; font-weight: 800; color: #02b5bb; }
  .sr__funnel-sub { font-size: 0.7rem; color: #94a3b8; margin-left: auto; }

  .sr__totals {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
    padding: 0.6rem 0.8rem;
    background: rgba(2, 181, 187, 0.06);
    border: 1px solid rgba(2, 181, 187, 0.2);
    border-radius: 10px;
    margin-bottom: 0.75rem;
    font-size: 0.8rem;
  }
  .sr__totals-label { font-weight: 800; color: #0f172a; }
  .sr__totals-cell { font-variant-numeric: tabular-nums; color: #334155; }

  .sr__buckets { display: flex; flex-direction: column; gap: 1rem; }
  .sr__bucket { border: 1px solid #e2e8f0; border-radius: 12px; padding: 0.9rem 1rem; }
  .sr__bucket-title { display: block; font-size: 0.7rem; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 0.6rem; }

  .sr__table-wrap { overflow-x: auto; }
  .sr__table { width: 100%; border-collapse: collapse; font-size: 0.8rem; }
  .sr__table thead tr { background: #f8fafc; }
  .sr__table th {
    text-align: left;
    padding: 0.55rem 0.7rem;
    color: #94a3b8;
    font-size: 0.66rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    white-space: nowrap;
    border-bottom: 1px solid #e2e8f0;
  }
  .sr__table td {
    padding: 0.5rem 0.7rem;
    color: #334155;
    border-bottom: 1px solid #f1f5f9;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
  .sr__table tbody tr:hover { background: #fafbff; }
  .sr__month { font-weight: 700; color: #0f172a; }
  .sr__proj { font-weight: 600; color: #0f172a; }
  .sr__source { color: #94a3b8; font-size: 0.72rem; }
  .sr__done { color: #16a34a; font-weight: 600; }

  .sr__kind {
    display: inline-block;
    padding: 0.14em 0.55em;
    border-radius: 999px;
    font-size: 0.66rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    border: 1px solid transparent;
  }
  .sr__kind--invoice { background: #eff6ff; color: #2563eb; border-color: #bfdbfe; }
  .sr__kind--consultation { background: #f0fdf4; color: #16a34a; border-color: #bbf7d0; }
  .sr__kind--quote { background: #fffbeb; color: #d97706; border-color: #fde68a; }

  .sr__more {
    margin-top: 0.75rem;
    padding: 0.5rem 1.1rem;
    background: #fff;
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    color: #02999e;
    font-family: inherit;
    font-size: 0.8rem;
    font-weight: 700;
    cursor: pointer;
  }
  .sr__more:hover { background: #f1f5f9; }
</style>