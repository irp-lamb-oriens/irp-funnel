<script lang="ts">
  import { tabs } from '../utils/a11yTabs.ts';
  import GroupHeader from './ui/GroupHeader.svelte';
  import InfoTip from './ui/InfoTip.svelte';
  import StatusLine from './ui/StatusLine.svelte';
  import EmptyState from './ui/EmptyState.svelte';
  import Alert from './ui/Alert.svelte';
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
      loadedAt = now = Date.now();
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

  type CardKey = 'won' | 'openPipeline' | 'draft';
  const CARD_DEFS: Array<{ key: CardKey; label: string; hint: string; info: string; tone: string }> = [
    { key: 'won', label: 'Accepted', hint: 'The client said yes', tone: 'success',
      info: 'Quotes a client accepted. This is the revenue we can count on.' },
    { key: 'openPipeline', label: 'Waiting on the client', hint: 'Sent, no answer yet', tone: 'accent',
      info: 'Quotes that were sent and are still open. Some of this will be won and some will not.' },
    { key: 'draft', label: 'Still drafting', hint: 'Not sent to the client yet', tone: 'warning',
      info: 'Quotes the team is still building. The client has not seen them.' },
  ];

  const BREAKDOWNS: Array<{ key: 'byRoute' | 'byService' | 'byProvider' | 'byStage'; title: string; description: string; empty: string }> = [
    { key: 'byRoute', title: 'By route', description: 'Origin → destination of the move.', empty: 'No accepted quote has a route yet.' },
    { key: 'byService', title: 'By service', description: 'What we were hired to do.', empty: 'No accepted quote lists a service yet.' },
    { key: 'byProvider', title: 'By provider', description: 'Who carries out the work.', empty: 'No accepted quote has a provider yet.' },
    { key: 'byStage', title: 'By client stage', description: 'Where those clients are on the board today.', empty: 'Nothing recorded yet.' },
  ];

  // "Updated 3 min ago" in the header, so stale figures are never mistaken for live ones.
  let now = Date.now();
  onMount(() => {
    const t = setInterval(() => (now = Date.now()), 30_000);
    return () => clearInterval(t);
  });
  $: updatedLabel = (() => {
    const mins = Math.floor((now - loadedAt) / 60_000);
    return mins < 1 ? 'just now' : mins === 1 ? '1 min ago' : mins < 60 ? `${mins} min ago` : 'over an hour ago';
  })();

  function stats(key: CardKey): FinanceMoneyStats | null {
    return $financeMetrics ? $financeMetrics.totals[key] : null;
  }
</script>

<div class="finance">
  <header class="irp-view-head">
    <div>
      <h2>Finance</h2>
      <p>
        What the quotes are worth, what they cost us, and what is left over.
        {#if $financeMetrics}
          <span class="irp-chip">{$financeMetrics.quotesRead} quotes · {$financeMetrics.clientsRead} clients</span>
        {/if}
      </p>
    </div>
    <div class="irp-view-head__actions">
      <StatusLine state={loading ? 'loading' : errorMsg ? 'error' : loadedAt ? 'saved' : 'idle'}
        message={loading ? 'Reading the quotes…' : errorMsg ? 'Could not refresh' : loadedAt ? `Updated ${updatedLabel}` : ''} />
      <div class="irp-field finance__currency">
        <label for="finance-currency">Currency <InfoTip text="Three-letter code, like USD or EUR. Only quotes in this currency are added up; nothing is converted." label="About the currency filter" placement="bottom" /></label>
        <input id="finance-currency" class="irp-input" type="text" maxlength="3" autocomplete="off" spellcheck="false" bind:value={currency} on:change={load} />
      </div>
      <button class="irp-btn irp-btn--primary" on:click={load} disabled={loading} aria-busy={loading}>{loading ? 'Refreshing…' : 'Refresh'}</button>
    </div>
  </header>

  <nav class="finance__sections irp-tabs" use:tabs={{ label: 'Finance sections' }}>
    <button class:active={section === 'quotes'} on:click={() => (section = 'quotes')} title="What the pipeline promises">Quotes</button>
    <button class:active={section === 'money'} on:click={() => (section = 'money')} title="What was actually paid and what is still owed">Money in and out</button>
    <button class:active={section === 'invoices'} on:click={() => (section = 'invoices')} title="Invoices sent to clients">Invoices</button>
    <button class:active={section === 'online'} on:click={() => (section = 'online')} title="Card and bank payments made through Stripe">Online payments</button>
    <button class:active={section === 'log'} on:click={() => (section = 'log')} title="Every payment event, in order">Payment log</button>
    <button class:active={section === 'config'} on:click={() => (section = 'config')} title="The routes, services and categories the figures are grouped by">Configuration</button>
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
    <Alert type="error">{errorMsg} <button type="button" class="irp-status__retry" on:click={load}>Try again</button></Alert>
  {/if}

  {#if !$financeMetrics && loading}
    <EmptyState title="Reading the quotes…" body="This looks at every quote of every client, so the first load can take a few seconds." />
  {:else if !$financeMetrics}
    <EmptyState title="No finance figures yet" body="Figures appear here as soon as at least one quote has a price. Create a quote from a client's Quotes tab, then refresh.">
      <button slot="action" class="irp-btn" on:click={load}>Refresh</button>
    </EmptyState>
  {:else}
    <section class="irp-group irp-group--plain" aria-labelledby="fin-totals-h" aria-busy={loading}>
      <GroupHeader id="fin-totals-h" title="Where the quotes stand" description="Every priced quote falls into one of three piles. Each pile shows what clients would pay (revenue), what providers charge us (cost) and what we keep (margin)." />
      <div class="irp-kpi-grid">
        {#each CARD_DEFS as def}
          {@const s = stats(def.key)}
          <article class="irp-kpi irp-kpi--{def.tone}">
            <h4 class="irp-kpi__label">{def.label}<InfoTip text={def.info} label={`About ${def.label}`} /></h4>
            <p class="irp-kpi__value">{money(s?.revenue)}</p>
            <p class="irp-kpi__hint">{def.hint}</p>
            <dl class="irp-facts">
              <div><dt>Provider cost</dt><dd>{money(s?.cost)}</dd></div>
              <div><dt>Margin</dt><dd>{money(s?.margin)} ({pct(s?.marginPct)})</dd></div>
              <div><dt>Quotes</dt><dd>{s?.n ?? 0}</dd></div>
              <div><dt>Average quote</dt><dd>{money(s?.avgDealSize)}</dd></div>
            </dl>
          </article>
        {/each}

        <article class="irp-kpi irp-kpi--neutral">
          <h4 class="irp-kpi__label">Win rate<InfoTip text="Accepted quotes divided by all quotes that were sent to a client. Drafts are left out because the client never saw them." label="About win rate" /></h4>
          <p class="irp-kpi__value">{pct($financeMetrics.winRate.pct)}</p>
          <p class="irp-kpi__hint">Of the quotes a client actually saw</p>
          <dl class="irp-facts">
            <div><dt>Accepted</dt><dd>{$financeMetrics.winRate.won}</dd></div>
            <div><dt>Sent to a client</dt><dd>{$financeMetrics.winRate.sentOrBeyond}</dd></div>
            <div>
              <dt>Typical days to close <InfoTip text="The median: half of the accepted quotes closed faster than this, half slower." label="About days to close" /></dt>
              <dd>{$financeMetrics.cycleDays.median ?? '—'}</dd>
            </div>
          </dl>
        </article>
      </div>
    </section>

    {#if $financeMetrics.byMonth.length > 0}
      <section class="irp-group" aria-labelledby="fin-month-h">
        <GroupHeader id="fin-month-h" title="Accepted quotes by month" description="Revenue, cost and margin of the quotes clients accepted, by the month they accepted them." />
        <div class="finance__tablewrap">
          <table class="finance__table">
            <thead>
              <tr><th scope="col">Month</th><th scope="col">Revenue</th><th scope="col">Provider cost</th><th scope="col">Margin</th><th scope="col">Margin %</th><th scope="col">Quotes</th></tr>
            </thead>
            <tbody>
              {#each $financeMetrics.byMonth as p (p.month)}
                <tr>
                  <th scope="row">{p.month}</th>
                  <td>{money(p.revenue)}</td>
                  <td>{money(p.cost)}</td>
                  <td>{money(p.margin)}</td>
                  <td>{pct(p.marginPct)}</td>
                  <td>{p.n}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </section>
    {/if}

    <section class="irp-group irp-group--plain" aria-labelledby="fin-split-h">
      <GroupHeader id="fin-split-h" title="Where accepted revenue comes from" description="The same accepted revenue, split four ways. Longer bars bring in more money." />
      <div class="irp-group-grid">
        {#each BREAKDOWNS as group}
          {@const buckets = $financeMetrics[group.key]}
          <section class="irp-group" aria-labelledby="fin-{group.key}-h">
            <GroupHeader id="fin-{group.key}-h" level={4} compact title={group.title} description={group.description} />
            {#if buckets.length === 0}
              <p class="irp-note" role="status">{group.empty}</p>
            {:else}
              <ul class="bars">
                {#each buckets as b (b.key)}
                  <li>
                    <div class="bars__row">
                      <span class="bars__label" title={b.label}>{b.label}</span>
                      <span class="bars__value">{money(b.revenue)}</span>
                    </div>
                    <div class="bars__track" aria-hidden="true">
                      <div class="bars__fill" style="width: {barWidth(buckets, b.revenue)}"></div>
                    </div>
                    <div class="bars__sub">{b.n} {b.n === 1 ? 'quote' : 'quotes'} · margin {money(b.margin)} ({pct(b.marginPct)})</div>
                  </li>
                {/each}
              </ul>
            {/if}
          </section>
        {/each}
      </div>
    </section>

    <section class="irp-group irp-group--soft" aria-labelledby="fin-skipped-h">
      <GroupHeader id="fin-skipped-h" title="Left out of the totals" description="If a number above looks low, the reason is usually here. These quotes exist but are not added in." />
      <ul class="finance__skipped">
        <li>
          <b>{$financeMetrics.skipped.currency}</b> in another currency
          {#if Object.keys($financeMetrics.skipped.currencies).length > 0}
            ({Object.entries($financeMetrics.skipped.currencies)
              .map(([c, n]) => `${c}: ${n}`)
              .join(', ')})
          {/if}
          <span>— switch the currency above to see them</span>
        </li>
        <li><b>{$financeMetrics.skipped.zeroTotal}</b> with no price yet <span>— add prices in the quote editor</span></li>
        <li><b>{$financeMetrics.skipped.exclusiveAlternates}</b> either/or options the client did not pick</li>
        <li><b>{$financeMetrics.marginUnknown}</b> counted with no provider cost <span>— their margin shows as the full price until a cost is entered</span></li>
      </ul>
      <p class="irp-group__foot">
        All figures are in {$financeMetrics.baseCurrency}. Nothing is converted, so a quote in another
        currency is listed here instead of being added in at the wrong rate.
      </p>
    </section>
  {/if}
  {/if}
</div>

<style>
  /* Built on the shared group anatomy (styles/_primitives.scss): .irp-view-head,
     .irp-group + GroupHeader, .irp-kpi, .irp-facts, EmptyState, StatusLine.
     Only what is specific to Finance lives here. */
  .finance {
    padding: 2.5rem 2rem;
    max-width: 1140px;
    margin: 0 auto;
    background: var(--irp-bg);
    color: var(--irp-text);
    font-family: var(--font-paragraph, 'Jost'), system-ui, sans-serif;
  }
  .finance__sections { margin-bottom: 1.25rem; }
  .finance__currency { flex-direction: row; align-items: center; gap: 0.5rem; }
  .finance__currency label { display: inline-flex; align-items: center; gap: 0.15rem; }
  .finance__currency input {
    width: 72px;
    font-family: var(--irp-mono);
    text-transform: uppercase;
  }

  .finance__tablewrap { overflow-x: auto; margin: 0 calc(var(--irp-sp-2) * -1); }
  .finance__table {
    width: 100%;
    border-collapse: collapse;
    font-size: var(--irp-fs-sm);
  }
  .finance__table thead tr { background: var(--irp-surface-2); }
  .finance__table thead th {
    text-align: right;
    padding: 0.6rem 0.85rem;
    color: var(--irp-text-dim);
    font-size: var(--irp-fs-2xs);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    white-space: nowrap;
    border-bottom: 1px solid var(--irp-line);
  }
  .finance__table thead th:first-child { text-align: left; }
  .finance__table td,
  .finance__table tbody th {
    padding: 0.6rem 0.85rem;
    color: var(--irp-text-2);
    border-bottom: 1px solid var(--irp-slate-100);
    text-align: right;
    font-weight: 500;
  }
  .finance__table tbody th { text-align: left; font-weight: 700; color: var(--irp-text); }
  .finance__table tbody tr:hover { background: var(--irp-bg); }
  .finance__table tbody tr:last-child > * { border-bottom: 0; }

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

  .finance__skipped {
    margin: 0;
    padding-left: 1.15rem;
    font-size: var(--irp-fs-sm);
    color: var(--irp-text-2);
    display: grid;
    gap: 0.35rem;
  }
  .finance__skipped b { font-variant-numeric: tabular-nums; }
  .finance__skipped span { color: var(--irp-text-dim); }

  @media (max-width: 640px) {
    .finance { padding: 1.5rem 1rem; }
  }
</style>
