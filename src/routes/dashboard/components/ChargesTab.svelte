<script lang="ts">
  /**
   * ChargesTab — every charge raised against one client, and what is still owed.
   *
   * Two questions an operator asks about a client's money, answered in order:
   *
   *  1. "How much of each quote have we actually billed?" — the per-quote
   *     reconciliation, including quoted lines that were never invoiced. A quote
   *     can be accepted and half-billed for months; nothing else in the
   *     dashboard surfaces that gap.
   *  2. "What has this client been charged, and has it been paid?" — the flat
   *     list of invoices, quote-derived and custom alike, with a paid toggle.
   *
   * Charges with no quote behind them are work that was never quoted. They are
   * listed with the rest rather than in their own section: from a collections
   * point of view an unpaid custom charge is no different from an unpaid
   * installment.
   */
  import { onMount } from 'svelte';
  import {
    invoices,
    fetchInvoices,
    invoicesForClient,
    setInvoicePaid,
    downloadInvoicePdf,
    fetchQuotes,
    summarizeQuoteBilling,
    type Invoice,
    type InvoicePayment,
    type Quote,
    type QuoteBillingSummary,
  } from '../store.ts';

  export let clientId: string;

  let quotes: Quote[] = [];
  let loading = false;
  let errorMsg = '';
  /** Invoice id currently being toggled, so only its own row shows a wait state. */
  let togglingId = '';
  /** Invoice whose received payments are expanded into a per-payment list. */
  let paymentsOpenId = '';

  async function load(): Promise<void> {
    if (!clientId) return;
    loading = true;
    errorMsg = '';
    try {
      // The invoice list is global and shared with the Finance view; the quotes
      // are per-client. Both are needed before any reconciliation is meaningful.
      const [, qs] = await Promise.all([fetchInvoices(), fetchQuotes(clientId)]);
      quotes = qs;
    } catch (err: any) {
      errorMsg = err?.message ?? 'Could not load this client\u2019s charges.';
    } finally {
      loading = false;
    }
  }

  onMount(load);

  // Re-load when the panel is pointed at a different client.
  let loadedFor = '';
  $: if (clientId && clientId !== loadedFor) {
    loadedFor = clientId;
    load();
  }

  $: clientInvoices = invoicesForClient($invoices, clientId);

  /**
   * Only quotes worth reconciling: one the client accepted, or one that has
   * already been billed. A rejected draft with no invoices is noise here.
   */
  $: billableQuotes = quotes.filter(
    (q) =>
      q.status === 'client_accepted' ||
      clientInvoices.some((inv) => inv.quoteId === q.quoteId),
  );

  $: quoteSummaries = billableQuotes.map(
    (q): { quote: Quote; summary: QuoteBillingSummary } => ({
      quote: q,
      summary: summarizeQuoteBilling(q, clientInvoices),
    }),
  );

  $: totalBalance = round2(
    clientInvoices.reduce((s, inv) => s + (Number(inv.balanceDue) || 0), 0),
  );
  $: totalCharged = round2(
    clientInvoices.reduce((s, inv) => s + (Number(inv.total) || 0), 0),
  );
  $: totalReceived = round2(
    clientInvoices.reduce((s, inv) => s + (Number(inv.received) || 0), 0),
  );
  /** Quoted work that has not been billed at all, across every quote. */
  $: totalUnbilled = round2(
    quoteSummaries.reduce((s, { summary }) => s + summary.remainingTotal, 0),
  );

  function round2(n: number): number {
    return Math.round((n + Number.EPSILON) * 100) / 100;
  }

  function money(n: number | null | undefined): string {
    if (typeof n !== 'number' || !Number.isFinite(n)) return '\u2014';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n);
  }

  function shortDate(iso: string | null | undefined): string {
    if (!iso) return '\u2014';
    const d = new Date(iso);
    return Number.isNaN(d.getTime())
      ? '\u2014'
      : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  const STATUS_LABEL: Record<string, string> = {
    draft: 'Draft',
    sent: 'Sent',
    partially_paid: 'Partially paid',
    paid: 'Paid',
  };

  /**
   * The received payments for one invoice, oldest → newest by date.
   * `received !== false` matches the server's `receivedTotal`: legacy payment
   * rows saved before the `received` flag existed count as received rather
   * than silently dropping out of the breakdown.
   */
  function receivedPayments(inv: Invoice): InvoicePayment[] {
    return (inv.payments ?? [])
      .filter((p) => p.received !== false)
      .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''));
  }

  async function togglePaid(inv: Invoice, paid: boolean): Promise<void> {
    togglingId = inv.id;
    errorMsg = '';
    try {
      await setInvoicePaid(inv.id, paid);
    } catch (err: any) {
      errorMsg = err?.message ?? 'Could not update the charge.';
    } finally {
      togglingId = '';
    }
  }

  async function doDownload(inv: Invoice): Promise<void> {
    errorMsg = '';
    try {
      await downloadInvoicePdf(inv.id);
    } catch (err: any) {
      errorMsg = err?.message ?? 'Could not download the PDF.';
    }
  }
</script>

<div class="ct">
  <div class="ct__head">
    <div>
      <h4>Charges</h4>
      <p>Everything this client has been billed, and what is still owed.</p>
    </div>
    <button class="ct__reload" on:click={load} disabled={loading}>
      {loading ? 'Loading\u2026' : 'Refresh'}
    </button>
  </div>

  {#if errorMsg}
    <p class="ct__error">{errorMsg}</p>
  {/if}

  {#if loading && clientInvoices.length === 0 && quoteSummaries.length === 0}
    <p class="ct__empty">Reading this client&rsquo;s charges&hellip;</p>
  {:else if clientInvoices.length === 0 && quoteSummaries.length === 0}
    <p class="ct__empty">
      No charges yet. Create an invoice from the Quotes tab, or from Finance for
      work that was never quoted.
    </p>
  {:else}
    <div class="ct__totals">
      <div class="ct__stat">
        <span class="ct__stat-label">Charged</span>
        <strong>{money(totalCharged)}</strong>
      </div>
      <div class="ct__stat">
        <span class="ct__stat-label">Received</span>
        <strong class="ct__ok">{money(totalReceived)}</strong>
      </div>
      <div class="ct__stat">
        <span class="ct__stat-label">Balance due</span>
        <strong class:ct__owing={totalBalance > 0}>{money(totalBalance)}</strong>
      </div>
      <div class="ct__stat">
        <span class="ct__stat-label">Quoted, not billed</span>
        <strong class:ct__owing={totalUnbilled > 0}>{money(totalUnbilled)}</strong>
      </div>
    </div>

    {#if quoteSummaries.length > 0}
      <section class="ct__section">
        <h5>Quote reconciliation</h5>
        <div class="ct__quotes">
          {#each quoteSummaries as { quote, summary } (quote.quoteId)}
            <article class="ct__quote">
              <header class="ct__quote-head">
                <div>
                  <strong>{quote.title || 'Untitled quote'}</strong>
                  <span class="ct__quote-date">{shortDate(quote.createdAt)}</span>
                </div>
                <span class="ct__badge">
                  {summary.invoiceCount} invoice{summary.invoiceCount === 1 ? '' : 's'}
                </span>
              </header>

              <div class="ct__bar" role="img"
                   aria-label="{summary.invoicedPct}% of this quote invoiced">
                <div class="ct__bar-fill" style="width:{Math.min(100, summary.invoicedPct)}%"></div>
              </div>

              <dl class="ct__figures">
                <div>
                  <dt>Quote total</dt>
                  <dd>{money(summary.quoteTotal)}</dd>
                </div>
                <div>
                  <dt>Invoiced</dt>
                  <dd>{money(summary.invoicedTotal)} <em>({summary.invoicedPct}%)</em></dd>
                </div>
                <div>
                  <dt>Remaining</dt>
                  <dd class:ct__owing={summary.remainingTotal > 0}>
                    {money(summary.remainingTotal)} <em>({summary.remainingPct}%)</em>
                  </dd>
                </div>
              </dl>

              {#if summary.uninvoicedLines.length > 0}
                <div class="ct__uninvoiced">
                  <span class="ct__uninvoiced-label">
                    Never invoiced ({summary.uninvoicedLines.length})
                  </span>
                  <ul>
                    {#each summary.uninvoicedLines as line (line.lineId)}
                      <li><span>{line.label}</span><span>{money(line.price)}</span></li>
                    {/each}
                  </ul>
                </div>
              {:else}
                <p class="ct__all-billed">Every quoted line has been invoiced.</p>
              {/if}
            </article>
          {/each}
        </div>
      </section>
    {/if}

    {#if clientInvoices.length > 0}
      <section class="ct__section">
        <h5>Charges</h5>
        <div class="ct__table-wrap">
          <table class="ct__table">
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Source</th>
                <th>Issued</th>
                <th>Total</th>
                <th>Received</th>
                <th>Balance</th>
                <th>Status</th>
                <th>Paid</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {#each clientInvoices as inv (inv.id)}
                <tr>
                  <td class="ct__num">{inv.invoiceNumber}</td>
                  <td>
                    {#if inv.quoteId}
                      <span class="ct__src ct__src--quote">
                        Quote{inv.quoteInvoiceIndex ? ` \u00b7 #${inv.quoteInvoiceIndex}` : ''}
                        {#if inv.quotePercentage}<em>{inv.quotePercentage}%</em>{/if}
                      </span>
                    {:else}
                      <span class="ct__src ct__src--custom">Custom</span>
                    {/if}
                  </td>
                  <td>{shortDate(inv.date)}</td>
                  <td>{money(inv.total)}</td>
                  <td>
                    {money(inv.received)}
                    {#if receivedPayments(inv).length > 0}
                      <div class="ct__sub">
                        {receivedPayments(inv).length} payment{receivedPayments(inv).length === 1 ? '' : 's'}
                      </div>
                    {/if}
                  </td>
                  <td class:ct__owing={inv.balanceDue > 0}>{money(inv.balanceDue)}</td>
                  <td>
                    <span class="ct__status ct__status--{inv.status}">
                      {STATUS_LABEL[inv.status] ?? inv.status}
                    </span>
                  </td>
                  <td>
                    <label class="ct__check" title="Mark this charge paid in full">
                      <input
                        type="checkbox"
                        checked={inv.balanceDue <= 0}
                        disabled={togglingId === inv.id}
                        on:change={(e) => togglePaid(inv, e.currentTarget.checked)}
                      />
                    </label>
                  </td>
                  <td>
                    <div class="ct__row-actions">
                      {#if receivedPayments(inv).length > 0}
                        <button
                          class="ct__link"
                          aria-expanded={paymentsOpenId === inv.id}
                          on:click={() => (paymentsOpenId = paymentsOpenId === inv.id ? '' : inv.id)}
                        >
                          {paymentsOpenId === inv.id ? 'Hide payments' : 'Payments'}
                        </button>
                      {/if}
                      <button class="ct__link" on:click={() => doDownload(inv)}>PDF</button>
                    </div>
                  </td>
                </tr>

                {#if paymentsOpenId === inv.id}
                  <tr class="ct__payments-row">
                    <td colspan="9">
                      <div class="ct__payments">
                        <h5>Payments received</h5>
                        {#if receivedPayments(inv).length === 0}
                          <p class="ct__empty">No received payments recorded.</p>
                        {:else}
                          <table class="ct__payments-table">
                            <thead>
                              <tr>
                                <th>Date</th>
                                <th>Method</th>
                                <th>Amount</th>
                                <th>Note</th>
                              </tr>
                            </thead>
                            <tbody>
                              {#each receivedPayments(inv) as p (p.id)}
                                <tr>
                                  <td>{shortDate(p.date)}</td>
                                  <td>{p.method ?? '—'}</td>
                                  <td>{money(p.amount)}</td>
                                  <td>{p.note ?? '—'}</td>
                                </tr>
                              {/each}
                            </tbody>
                          </table>
                        {/if}
                      </div>
                    </td>
                  </tr>
                {/if}
              {/each}
            </tbody>
          </table>
        </div>
      </section>
    {/if}
  {/if}
</div>

<style>
  .ct {
    font-family: var(--font-paragraph, 'Jost'), system-ui, sans-serif;
    color: var(--irp-text, #181818);
  }

  .ct__head {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 1rem;
    margin-bottom: 1.1rem;
    flex-wrap: wrap;
  }

  .ct__head h4 {
    margin: 0;
    font-size: 0.98rem;
    font-weight: 800;
    color: #0f172a;
  }

  .ct__head p {
    margin: 0.28rem 0 0;
    font-size: 0.78rem;
    color: #64748b;
  }

  .ct__reload {
    padding: 0.45rem 1rem;
    background: #fff;
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    color: #475569;
    font-family: inherit;
    font-size: 0.78rem;
    font-weight: 700;
    cursor: pointer;
    transition: background 0.14s cubic-bezier(0.4, 0, 0.2, 1), color 0.14s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .ct__reload:hover:not(:disabled) { background: #f1f5f9; color: #1e293b; }
  .ct__reload:disabled { opacity: 0.55; cursor: wait; }

  .ct__error {
    padding: 0.55rem 0.9rem;
    border-radius: 8px;
    background: #fef2f2;
    border: 1px solid #fecaca;
    color: #dc2626;
    font-size: 0.8rem;
    font-weight: 600;
    margin-bottom: 0.8rem;
  }

  .ct__empty {
    color: #94a3b8;
    font-size: 0.83rem;
    font-style: italic;
    padding: 0.4rem 0;
    max-width: 46ch;
    line-height: 1.55;
  }

  .ct__totals {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 0.75rem;
    margin-bottom: 1.4rem;
  }

  .ct__stat {
    padding: 0.85rem 1rem;
    border-radius: 12px;
    background: #fff;
    border: 1px solid #e2e8f0;
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
  }

  .ct__stat-label {
    font-size: 0.66rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.09em;
    color: #94a3b8;
  }

  .ct__stat strong {
    font-size: 1.02rem;
    font-weight: 800;
    color: #0f172a;
    font-variant-numeric: tabular-nums;
  }

  .ct__ok { color: #16a34a; }
  .ct__owing { color: #d97706; font-weight: 700; }

  .ct__section { margin-bottom: 1.6rem; }

  .ct__section h5 {
    margin: 0 0 0.7rem;
    font-size: 0.7rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: #94a3b8;
  }

  .ct__quotes {
    display: grid;
    gap: 0.85rem;
  }

  .ct__quote {
    padding: 1.1rem 1.2rem;
    border-radius: 14px;
    background: #fff;
    border: 1px solid #e2e8f0;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  }

  .ct__quote-head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 0.8rem;
    margin-bottom: 0.7rem;
    flex-wrap: wrap;
  }

  .ct__quote-head strong {
    font-size: 0.88rem;
    font-weight: 700;
    color: #0f172a;
  }

  .ct__quote-date {
    margin-left: 0.55rem;
    font-size: 0.74rem;
    color: #94a3b8;
  }

  .ct__badge {
    padding: 0.14em 0.6em;
    border-radius: 999px;
    background: #f1f5f9;
    border: 1px solid #e2e8f0;
    color: #64748b;
    font-size: 0.66rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    white-space: nowrap;
  }

  .ct__bar {
    height: 6px;
    border-radius: 999px;
    background: #f1f5f9;
    overflow: hidden;
    margin-bottom: 0.8rem;
  }

  .ct__bar-fill {
    height: 100%;
    background: linear-gradient(90deg, #02b5bb 0%, #02999e 100%);
    transition: width 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .ct__figures {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
    gap: 0.7rem;
    margin: 0;
  }

  .ct__figures div { display: flex; flex-direction: column; gap: 0.2rem; }

  .ct__figures dt {
    font-size: 0.64rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #94a3b8;
  }

  .ct__figures dd {
    margin: 0;
    font-size: 0.88rem;
    font-weight: 700;
    color: #334155;
    font-variant-numeric: tabular-nums;
  }

  .ct__figures dd em {
    font-style: normal;
    font-size: 0.74rem;
    font-weight: 600;
    color: #94a3b8;
  }

  .ct__uninvoiced {
    margin-top: 0.9rem;
    padding-top: 0.8rem;
    border-top: 1px solid #f1f5f9;
  }

  .ct__uninvoiced-label {
    display: block;
    margin-bottom: 0.45rem;
    font-size: 0.64rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #d97706;
  }

  .ct__uninvoiced ul {
    margin: 0;
    padding: 0;
    list-style: none;
    display: grid;
    gap: 0.3rem;
  }

  .ct__uninvoiced li {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    font-size: 0.8rem;
    color: #475569;
  }

  .ct__uninvoiced li span:last-child {
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  .ct__all-billed {
    margin: 0.9rem 0 0;
    padding-top: 0.8rem;
    border-top: 1px solid #f1f5f9;
    font-size: 0.78rem;
    color: #16a34a;
    font-weight: 600;
  }

  .ct__table-wrap {
    padding: 1rem;
    border-radius: 14px;
    background: #fff;
    border: 1px solid #e2e8f0;
    overflow-x: auto;
  }

  .ct__table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.8rem;
  }

  .ct__table th {
    text-align: left;
    padding: 0.5rem 0.7rem;
    color: #94a3b8;
    font-size: 0.64rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.09em;
    white-space: nowrap;
    border-bottom: 1px solid #e2e8f0;
  }

  .ct__table td {
    padding: 0.55rem 0.7rem;
    color: #334155;
    border-bottom: 1px solid #f1f5f9;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  .ct__table tbody tr:last-child td { border-bottom: none; }
  .ct__table tbody tr:hover { background: #fafbff; }

  .ct__num { font-weight: 800; color: #02b5bb; }

  .ct__src {
    padding: 0.14em 0.55em;
    border-radius: 6px;
    font-size: 0.66rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    border: 1px solid transparent;
  }

  .ct__src em {
    font-style: normal;
    margin-left: 0.3em;
    opacity: 0.75;
  }

  .ct__src--quote { background: #eff6ff; color: #2563eb; border-color: #bfdbfe; }
  .ct__src--custom { background: #fdf4ff; color: #a21caf; border-color: #f5d0fe; }

  .ct__status {
    display: inline-block;
    padding: 0.14em 0.55em;
    border-radius: 999px;
    font-size: 0.64rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    border: 1px solid transparent;
  }

  .ct__status--draft { background: #f1f5f9; color: #64748b; border-color: #e2e8f0; }
  .ct__status--sent { background: #eff6ff; color: #2563eb; border-color: #bfdbfe; }
  .ct__status--partially_paid { background: #fffbeb; color: #d97706; border-color: #fde68a; }
  .ct__status--paid { background: #f0fdf4; color: #16a34a; border-color: #bbf7d0; }

  .ct__check {
    display: inline-flex;
    align-items: center;
    cursor: pointer;
  }

  .ct__check input {
    width: 16px;
    height: 16px;
    accent-color: #02b5bb;
    cursor: pointer;
  }

  .ct__check input:disabled { cursor: wait; opacity: 0.55; }

  .ct__link {
    background: none;
    border: none;
    color: #02999e;
    font-family: inherit;
    font-size: 0.74rem;
    font-weight: 700;
    cursor: pointer;
    padding: 0;
  }

  .ct__link:hover { text-decoration: underline; }

  .ct__sub {
    font-size: 0.66rem;
    color: #94a3b8;
    white-space: nowrap;
    margin-top: 2px;
  }

  .ct__row-actions {
    display: flex;
    gap: 0.5rem;
  }

  .ct__payments-row td {
    background: #f8fafc;
    white-space: normal;
  }

  .ct__payments {
    padding: 0.25rem 0;
  }

  .ct__payments h5 {
    margin: 0 0 0.6rem;
    font-size: 0.68rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.09em;
    color: #94a3b8;
  }

  .ct__payments-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.78rem;
    background: #fff;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    overflow: hidden;
  }

  .ct__payments-table th {
    text-align: left;
    padding: 0.45rem 0.7rem;
    color: #94a3b8;
    font-size: 0.62rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    border-bottom: 1px solid #e2e8f0;
    background: #f8fafc;
  }

  .ct__payments-table td {
    padding: 0.45rem 0.7rem;
    color: #334155;
    border-bottom: 1px solid #f1f5f9;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  .ct__payments-table tbody tr:last-child td { border-bottom: none; }

  @media (max-width: 768px) {
    .ct__totals { grid-template-columns: 1fr 1fr; }
    .ct__quote { padding: 0.9rem 1rem; }
  }
</style>
