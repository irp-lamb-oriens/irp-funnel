<script lang="ts">
  import { tabs } from '../utils/a11yTabs.ts';
  /**
   * FinanceView — the money view of the pipeline.
   *
   * Everything here comes from GET /api/dashboard/finance/metrics, which reads
   * the quotes of every client and returns already-aggregated figures. This
   * component only formats them, so there is no client-side money math to drift
   * from the server's.
   *
   * The "not counted" panel is deliberately prominent: a revenue number that
   * looks low should be explainable (quotes in another currency, quotes never
   * priced, discarded alternatives of an either/or option group) rather than
   * quietly wrong.
   */
  import { onMount } from 'svelte';
  import { financeMetrics, fetchFinanceMetrics, type FinanceMoneyStats, type FinanceBucket } from '../store.ts';
  import FinanceLedgerPanel from './FinanceLedgerPanel.svelte';
  import MoveTaxonomyPanel from './MoveTaxonomyPanel.svelte';
  import InvoicesPanel from './InvoicesPanel.svelte';
  import OnlinePaymentsPanel from './OnlinePaymentsPanel.svelte';
  import PaymentLogPanel from './PaymentLogPanel.svelte';
  import { onViewShown, REVALIDATE_AFTER_MS } from '../utils/viewLifecycle.ts';

  let loading = false;
  let loadedAt = 0;
  let errorMsg = '';
  let currency = 'USD';

  /**
   * Three sections. "Quotes" is what the pipeline promises, "Money" is what
   * actually moved, and "Configuration" holds the vocabulary both are grouped
   * by. They are deliberately separate because a healthy quote book and an
   * empty bank account can happen at the same time, and because the categories
   * behind both numbers are a business decision that belongs on screen.
   */
  let section: 'quotes' | 'money' | 'config' | 'invoices' | 'online' | 'log' = 'quotes';

  async function load(): Promise<void> {
    loading = true;
    errorMsg = '';
    try {
      await fetchFinanceMetrics(currency);
      loadedAt = Date.now();
    } catch (err: any) {
      errorMsg = err?.message ?? 'Could not load the finance metrics.';
    } finally {
      loading = false;
    }
  }

  /**
   * Reuse whatever the store already holds. Reading every quote is expensive,
   * and this component remounts each time the operator returns to Finance, so
   * an unconditional fetch would repeat that work for no new information.
   */
  onMount(() => {
    if (!$financeMetrics) load();
    else loadedAt = Date.now();
  });
  // Kept alive between visits: quietly refresh the quote figures when stale.
  onViewShown('finance', () => {
    if (Date.now() - loadedAt > REVALIDATE_AFTER_MS && !loading) load();
  });

  function money(n: number | null | undefined): string {
    if (typeof n !== 'number' || !Number.isFinite(n)) return '—';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
      maximumFractionDigits: 0,
    }).format(n);
  }

  function pct(n: number | null | undefined): string {
    return typeof n === 'number' ? `${n.toFixed(1)}%` : '—';
  }

  /** Bar width relative to the largest revenue in a bucket list. */
  function barWidth(buckets: FinanceBucket[], value: number): string {
    const max = buckets.reduce((m, b) => Math.max(m, b.revenue), 0);
    if (max <= 0) return '0%';
    return `${Math.max(2, Math.round((value / max) * 100))}%`;
  }

  const CARD_DEFS: Array<{ key: 'won' | 'openPipeline' | 'draft'; label: string; hint: string }> = [
    { key: 'won', label: 'Won', hint: 'Quotes the client accepted' },
    { key: 'openPipeline', label: 'Open pipeline', hint: 'Sent or awaiting the client' },
    { key: 'draft', label: 'Draft', hint: 'Still being built internally' },
  ];

  function stats(key: 'won' | 'openPipeline' | 'draft'): FinanceMoneyStats | null {
    return $financeMetrics ? $financeMetrics.totals[key] : null;
  }
</script>

<div class="finance">
  <header class="finance__head">
    <div>
      <h2>Finance</h2>
      <p>
        Revenue, provider cost and margin across every quote.
        {#if $financeMetrics}
          <span class="finance__meta">
            {$financeMetrics.quotesRead} quotes · {$financeMetrics.clientsRead} clients
          </span>
        {/if}
      </p>
    </div>
    <div class="finance__controls">
      <label>
        Currency
        <input type="text" maxlength="3" bind:value={currency} on:change={load} />
      </label>
      <button on:click={load} disabled={loading}>{loading ? 'Loading…' : 'Refresh'}</button>
    </div>
  </header>

  <nav class="finance__sections irp-tabs" use:tabs={{ label: 'Finance sections' }}>
    <button class:active={section === 'quotes'} on:click={() => (section = 'quotes')}>Quotes</button>
    <button class:active={section === 'money'} on:click={() => (section = 'money')}>Money in and out</button>
    <button class:active={section === 'invoices'} on:click={() => (section = 'invoices')}>Invoices</button>
    <button class:active={section === 'online'} on:click={() => (section = 'online')}>Online payments</button>
    <button class:active={section === 'log'} on:click={() => (section = 'log')}>Payment log</button>
    <button class:active={section === 'config'} on:click={() => (section = 'config')}>Configuration</button>
  </nav>

  {#if section === 'money'}
    <FinanceLedgerPanel {currency} />
  {:else if section === 'config'}
    <MoveTaxonomyPanel />
  {:else if section === 'invoices'}
    <InvoicesPanel />
  {:else if section === 'online'}
    <OnlinePaymentsPanel />
  {:else if section === 'log'}
    <PaymentLogPanel />
  {:else}

  {#if errorMsg}
    <p class="finance__error">{errorMsg}</p>
  {/if}

  {#if !$financeMetrics && loading}
    <p class="finance__empty">Reading the quotes…</p>
  {:else if !$financeMetrics}
    <p class="finance__empty">No finance data yet.</p>
  {:else}
    <section class="finance__cards">
      {#each CARD_DEFS as def}
        {@const s = stats(def.key)}
        <article class="card card--{def.key}">
          <h3>{def.label}</h3>
          <p class="card__hint">{def.hint}</p>
          <p class="card__big">{money(s?.revenue)}</p>
          <dl>
            <div><dt>Cost</dt><dd>{money(s?.cost)}</dd></div>
            <div><dt>Margin</dt><dd>{money(s?.margin)} ({pct(s?.marginPct)})</dd></div>
            <div><dt>Quotes</dt><dd>{s?.n ?? 0}</dd></div>
            <div><dt>Avg deal</dt><dd>{money(s?.avgDealSize)}</dd></div>
          </dl>
        </article>
      {/each}

      <article class="card card--rate">
        <h3>Win rate</h3>
        <p class="card__hint">Of the quotes that reached a client</p>
        <p class="card__big">{pct($financeMetrics.winRate.pct)}</p>
        <dl>
          <div><dt>Won</dt><dd>{$financeMetrics.winRate.won}</dd></div>
          <div><dt>Reached a client</dt><dd>{$financeMetrics.winRate.sentOrBeyond}</dd></div>
          <div>
            <dt>Median days to close</dt>
            <dd>{$financeMetrics.cycleDays.median ?? '—'}</dd>
          </div>
        </dl>
      </article>
    </section>

    {#if $financeMetrics.byMonth.length > 0}
      <section class="panel">
        <h3>Won revenue by month</h3>
        <table>
          <thead>
            <tr><th>Month</th><th>Revenue</th><th>Cost</th><th>Margin</th><th>%</th><th>Deals</th></tr>
          </thead>
          <tbody>
            {#each $financeMetrics.byMonth as p (p.month)}
              <tr>
                <td>{p.month}</td>
                <td>{money(p.revenue)}</td>
                <td>{money(p.cost)}</td>
                <td>{money(p.margin)}</td>
                <td>{pct(p.marginPct)}</td>
                <td>{p.n}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </section>
    {/if}

    <div class="panel-grid">
      {#each [
        { title: 'By route', buckets: $financeMetrics.byRoute },
        { title: 'By service', buckets: $financeMetrics.byService },
        { title: 'By provider', buckets: $financeMetrics.byProvider },
        { title: 'By stage', buckets: $financeMetrics.byStage },
      ] as group}
        <section class="panel">
          <h3>{group.title}</h3>
          {#if group.buckets.length === 0}
            <p class="finance__empty">Nothing recorded yet.</p>
          {:else}
            <ul class="bars">
              {#each group.buckets as b (b.key)}
                <li>
                  <div class="bars__row">
                    <span class="bars__label" title={b.label}>{b.label}</span>
                    <span class="bars__value">{money(b.revenue)}</span>
                  </div>
                  <div class="bars__track">
                    <div class="bars__fill" style="width: {barWidth(group.buckets, b.revenue)}"></div>
                  </div>
                  <div class="bars__sub">{b.n} quotes · margin {money(b.margin)} ({pct(b.marginPct)})</div>
                </li>
              {/each}
            </ul>
          {/if}
        </section>
      {/each}
    </div>

    <section class="panel panel--skipped">
      <h3>Not counted above</h3>
      <ul>
        <li>
          {$financeMetrics.skipped.currency} quotes in another currency
          {#if Object.keys($financeMetrics.skipped.currencies).length > 0}
            ({Object.entries($financeMetrics.skipped.currencies)
              .map(([c, n]) => `${c}: ${n}`)
              .join(', ')})
          {/if}
        </li>
        <li>{$financeMetrics.skipped.zeroTotal} quotes never priced</li>
        <li>{$financeMetrics.skipped.exclusiveAlternates} discarded either/or options</li>
        <li>{$financeMetrics.marginUnknown} quotes counted with no provider cost recorded</li>
      </ul>
      <p class="panel__foot">
        Figures are measured in {$financeMetrics.baseCurrency}. Nothing is converted, so a quote in
        another currency is listed here instead of being added in at the wrong rate.
      </p>
    </section>
  {/if}
  {/if}
</div>

<style>
  /* Section tabs: shared .irp-tabs (styles/_primitives.scss) */
  .finance__sections { margin-bottom: 1.25rem; }

  /* Palette and rhythm are taken from AdminView so Finance reads as the same
     product: #fafbfc canvas, white cards on #e2e8f0 borders, teal #02b5bb
     accent, Jost via --font-paragraph. Every custom property has a literal
     fallback, so the view renders correctly even where the tokens are absent. */
  .finance {
    padding: 2.5rem 2rem;
    max-width: 1140px;
    margin: 0 auto;
    background: var(--irp-bg);
    color: var(--irp-text);
    font-family: var(--font-paragraph, 'Jost'), system-ui, sans-serif;
    font-feature-settings: 'cv02', 'cv03', 'cv04', 'cv11';
  }

  .finance__head {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 1rem;
    margin-bottom: 2rem;
    flex-wrap: wrap;
  }

  .finance__head h2 {
    margin: 0;
    font-size: 1.55rem;
    font-weight: 800;
    color: var(--irp-text);
    letter-spacing: -0.025em;
  }

  .finance__head p {
    margin: 0.3rem 0 0;
    color: var(--irp-text-dim);
    font-size: var(--irp-fs-sm);
    letter-spacing: 0.01em;
  }





  .finance__meta {
    margin-left: 0.5rem;
    padding: 0.18em 0.7em;
    border-radius: var(--irp-r-full);
    background: linear-gradient(135deg, rgba(2, 181, 187, 0.1), rgba(139, 92, 246, 0.07));
    border: 1px solid rgba(2, 181, 187, 0.2);
    color: var(--irp-accent-ink);
    font-size: var(--irp-fs-xs);
    font-weight: 700;
    white-space: nowrap;
  }

  .finance__controls {
    display: flex;
    align-items: flex-end;
    gap: 0.55rem;
  }

  .finance__controls label {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    font-size: var(--irp-fs-2xs);
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--irp-text-dim);
  }

  .finance__controls input {
    width: 76px;
    padding: 0.5rem 0.7rem;
    border-radius: var(--irp-r-sm);
    border: 1px solid var(--irp-line);
    background: var(--irp-surface-2);
    color: var(--irp-text);
    font-family: 'SF Mono', 'Fira Code', ui-monospace, monospace;
    font-size: var(--irp-fs-sm);
    text-transform: uppercase;
    transition: border-color 0.14s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.14s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .finance__controls input:focus {
    outline: none;
    border-color: rgba(2, 181, 187, 0.48);
    box-shadow: 0 0 0 3px rgba(2, 181, 187, 0.1);
  }

  .finance__controls button {
    padding: 0.52rem 1.2rem;
    border-radius: var(--irp-r-md);
    border: none;
    background: linear-gradient(135deg, var(--irp-accent) 0%, var(--irp-accent-hover) 100%);
    color: var(--irp-text-inverse);
    font-family: inherit;
    font-size: var(--irp-fs-sm);
    font-weight: 700;
    letter-spacing: 0.02em;
    cursor: pointer;
    box-shadow: 0 2px 8px rgba(2, 181, 187, 0.3);
    transition: filter 0.14s cubic-bezier(0.4, 0, 0.2, 1), transform 0.14s cubic-bezier(0.4, 0, 0.2, 1),
      box-shadow 0.14s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .finance__controls button:hover:not(:disabled) {
    filter: brightness(1.06);
    transform: translateY(-1px);
    box-shadow: 0 4px 16px rgba(2, 181, 187, 0.4);
  }

  .finance__controls button:active:not(:disabled) {
    transform: translateY(0);
  }

  .finance__controls button:disabled {
    opacity: 0.55;
    cursor: wait;
  }

  .finance__error {
    padding: 0.6rem 1rem;
    border-radius: var(--irp-r-sm);
    background: var(--irp-surface-3);
    border: 1px solid var(--irp-red-200);
    color: var(--irp-red-600);
    font-size: var(--irp-fs-sm);
    font-weight: 600;
    margin-bottom: 0.8rem;
  }

  .finance__empty {
    color: var(--irp-text-dim);
    font-size: var(--irp-fs-md);
    font-style: italic;
    letter-spacing: 0.02em;
  }

  .finance__cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(248px, 1fr));
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  .card {
    padding: 1.25rem 1.35rem;
    border-radius: var(--irp-r-lg);
    background: var(--irp-surface);
    border: 1px solid var(--irp-line);
    border-top: 3px solid var(--irp-line);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06), 0 8px 32px rgba(0, 0, 0, 0.04);
    transition: box-shadow 0.14s cubic-bezier(0.4, 0, 0.2, 1), transform 0.14s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .card:hover {
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08), 0 10px 28px rgba(0, 0, 0, 0.04);
    transform: translateY(-2px);
  }

  .card--won { border-top-color: var(--irp-green-500); }
  .card--openPipeline { border-top-color: var(--irp-accent); }
  .card--draft { border-top-color: var(--irp-amber-500); }
  .card--rate { border-top-color: var(--irp-violet-500); }

  .card h3 {
    margin: 0;
    font-size: var(--irp-fs-2xs);
    font-weight: 800;
    color: var(--irp-text-dim);
    text-transform: uppercase;
    letter-spacing: 0.1em;
  }

  .card__hint {
    margin: 0.3rem 0 0.7rem;
    font-size: var(--irp-fs-xs);
    color: var(--irp-text-dim);
    font-style: italic;
  }

  .card__big {
    margin: 0 0 0.85rem;
    font-size: 1.7rem;
    font-weight: 800;
    color: var(--irp-text);
    letter-spacing: -0.03em;
    font-variant-numeric: tabular-nums;
  }

  .card dl {
    margin: 0;
    display: grid;
    gap: 0.32rem;
    padding-top: 0.7rem;
    border-top: 1px solid var(--irp-slate-100);
  }

  .card dl div {
    display: flex;
    justify-content: space-between;
    gap: 0.7rem;
    font-size: var(--irp-fs-xs);
  }

  .card dt { color: var(--irp-text-dim); }

  .card dd {
    margin: 0;
    color: var(--irp-text-2);
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }

  .panel-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(330px, 1fr));
    gap: 1rem;
  }

  .panel {
    padding: 1.5rem;
    border-radius: var(--irp-r-lg);
    background: var(--irp-surface);
    border: 1px solid var(--irp-line);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06), 0 8px 32px rgba(0, 0, 0, 0.04);
    margin-bottom: 1rem;
  }

  .panel h3 {
    margin: 0 0 1rem;
    font-size: var(--irp-fs-2xs);
    font-weight: 800;
    color: var(--irp-text-dim);
    text-transform: uppercase;
    letter-spacing: 0.1em;
  }

  .panel table {
    width: 100%;
    border-collapse: collapse;
    font-size: var(--irp-fs-sm);
  }

  .panel thead tr { background: var(--irp-surface-2); }

  .panel th {
    text-align: left;
    padding: 0.65rem 0.85rem;
    color: var(--irp-text-dim);
    font-size: var(--irp-fs-2xs);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.09em;
    white-space: nowrap;
    border-bottom: 1px solid var(--irp-line);
  }

  .panel td {
    padding: 0.65rem 0.85rem;
    color: var(--irp-text-2);
    border-bottom: 1px solid var(--irp-slate-100);
    font-variant-numeric: tabular-nums;
  }

  .panel tbody tr { transition: background 0.14s cubic-bezier(0.4, 0, 0.2, 1); }
  .panel tbody tr:hover { background: var(--irp-bg); }

  .bars {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 0.9rem;
  }

  .bars__row {
    display: flex;
    justify-content: space-between;
    gap: 0.7rem;
    font-size: var(--irp-fs-sm);
  }

  .bars__label {
    color: var(--irp-text-2);
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .bars__value {
    color: var(--irp-text);
    font-weight: 800;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  .bars__track {
    height: 6px;
    margin: 0.35rem 0 0.28rem;
    border-radius: var(--irp-r-full);
    background: var(--irp-surface-3);
    overflow: hidden;
  }

  .bars__fill {
    height: 100%;
    border-radius: var(--irp-r-full);
    background: linear-gradient(90deg, var(--irp-accent) 0%, var(--irp-accent-hover) 100%);
  }

  .bars__sub {
    font-size: var(--irp-fs-xs);
    color: var(--irp-text-dim);
  }

  .panel--skipped {
    background: var(--irp-surface-2);
  }

  .panel--skipped ul {
    margin: 0;
    padding-left: 1.15rem;
    font-size: var(--irp-fs-sm);
    color: var(--irp-text-muted);
    display: grid;
    gap: 0.28rem;
  }

  .panel__foot {
    margin: 0.9rem 0 0;
    font-size: var(--irp-fs-xs);
    color: var(--irp-text-dim);
    font-style: italic;
    line-height: 1.5;
  }

  @media (max-width: 640px) {
    .finance { padding: 1.5rem 1rem; }
    .finance__controls { width: 100%; }
    .panel { padding: 1.15rem; }
  }
</style>
