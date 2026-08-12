<script lang="ts">
  /**
   * ChargesCard.svelte — "Your charges" on the client status page.
   * ────────────────────────────────────────────────────────────────────────
   * Shows the client's own billing statement: each invoice we've sent them
   * (total, received, balance due, line items) and, alongside it, how much of
   * each accepted quote is still waiting to be billed. Draft invoices never
   * appear — a draft is finance's working copy.
   *
   * Self-contained: reads the projectId from the route params, fetches via the
   * shared `fetchCharges` store action (GET /api/client-status/project/:id/charges),
   * and re-renders reactively off the `charges` store. Renders nothing when the
   * client has no sent charges yet, so it's invisible until finance bills them —
   * fully backward compatible.
   */
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { charges, fetchCharges } from './store.ts';

  $: projectId = $page.params.id;

  let loading = false;
  let errorMsg = '';
  let loadedFor = '';

  async function load(): Promise<void> {
    if (!projectId || projectId === loadedFor) return;
    loadedFor = projectId;
    loading = true;
    errorMsg = '';
    try {
      await fetchCharges(projectId);
    } catch (e: any) {
      errorMsg = e?.message ?? 'Could not load your charges.';
    } finally {
      loading = false;
    }
  }

  onMount(load);

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
    paid: 'Paid',
    partially_paid: 'Partially paid',
    sent: 'Awaiting payment',
  };

  $: hasAnything =
    ($charges?.charges?.length ?? 0) > 0 || ($charges?.quoteBalances?.length ?? 0) > 0;
</script>

{#if loading}
  <section class="cc">
    <p class="cc__muted">Loading your charges&hellip;</p>
  </section>
{:else if errorMsg}
  <section class="cc">
    <p class="cc__error">{errorMsg}</p>
  </section>
{:else if hasAnything}
  <section class="cc">
    <div class="cc__head">
      <h3 class="cc__title">Your charges</h3>
      <p class="cc__sub">What we&rsquo;ve invoiced so far, and what is still outstanding.</p>
    </div>

    {#if $charges}
      <div class="cc__totals">
        <div class="cc__stat">
          <span class="cc__stat-label">Invoiced to date</span>
          <strong>{money($charges.totals.charged)}</strong>
        </div>
        <div class="cc__stat">
          <span class="cc__stat-label">Paid</span>
          <strong class="cc__ok">{money($charges.totals.received)}</strong>
        </div>
        <div class="cc__stat">
          <span class="cc__stat-label">Balance due</span>
          <strong class:cc__owing={$charges.totals.balanceDue > 0}>{money($charges.totals.balanceDue)}</strong>
        </div>
        {#if $charges.totals.notYetInvoiced > 0}
          <div class="cc__stat">
            <span class="cc__stat-label">Quoted, not yet invoiced</span>
            <strong class="cc__owing">{money($charges.totals.notYetInvoiced)}</strong>
          </div>
        {/if}
      </div>
    {/if}

    {#if ($charges?.quoteBalances?.length ?? 0) > 0}
      <div class="cc__block">
        <h4 class="cc__block-title">Accepted quotes</h4>
        <div class="cc__quotes">
          {#each $charges.quoteBalances as q (q.title + q.date)}
            <div class="cc__quote">
              <div class="cc__quote-row">
                <span class="cc__quote-title">{q.title}</span>
                <span class="cc__quote-total">{money(q.quoteTotal)}</span>
              </div>
              <div class="cc__quote-row cc__quote-row--meta">
                <span>Accepted {shortDate(q.acceptedAt)}</span>
                <span>
                  {#if q.remaining > 0}
                    <span class="cc__quote-remaining">{money(q.remaining)} remaining to invoice</span>
                  {:else}
                    <span class="cc__quote-ok">Fully invoiced</span>
                  {/if}
                </span>
              </div>
            </div>
          {/each}
        </div>
      </div>
    {/if}

    {#if ($charges?.charges?.length ?? 0) > 0}
      <div class="cc__block">
        <h4 class="cc__block-title">Invoices</h4>
        <div class="cc__invoices">
          {#each $charges.charges as inv (inv.invoiceNumber)}
            <details class="cc__inv">
              <summary class="cc__inv-head">
                <span class="cc__inv-num">{inv.invoiceNumber ?? 'Invoice'}</span>
                <span class="cc__inv-date">{shortDate(inv.date)}</span>
                <span class="cc__inv-status cc__inv-status--{inv.status}">
                  {STATUS_LABEL[inv.status] ?? inv.status}
                </span>
                <span class="cc__inv-total">{money(inv.total)}</span>
                <span class="cc__inv-caret" aria-hidden="true">▾</span>
              </summary>
              <div class="cc__inv-body">
                <table class="cc__table">
                  <thead>
                    <tr>
                      <th>Description</th>
                      <th>Qty</th>
                      <th>Rate</th>
                      <th>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {#each inv.lineItems as li}
                      <tr>
                        <td>{li.description || '\u2014'}</td>
                        <td>{li.qty}</td>
                        <td>{money(li.rate)}</td>
                        <td>{money(li.amount)}</td>
                      </tr>
                    {/each}
                  </tbody>
                </table>
                <div class="cc__inv-figures">
                  <span>Subtotal <strong>{money(inv.subtotal)}</strong></span>
                  {#if (inv.discount ?? 0) > 0}
                    <span>Discount <strong>{money(inv.discount)}</strong></span>
                  {/if}
                  <span>Total <strong>{money(inv.total)}</strong></span>
                  <span>Received <strong class="cc__ok">{money(inv.received)}</strong></span>
                  <span class:cc__owing={inv.balanceDue > 0}>
                    Balance due <strong>{money(inv.balanceDue)}</strong>
                  </span>
                  {#if inv.dueDate}
                    <span>Due {shortDate(inv.dueDate)}</span>
                  {/if}
                </div>
              </div>
            </details>
          {/each}
        </div>
      </div>
    {/if}
  </section>
{/if}

<style>
  .cc {
    background: #fff;
    border: 1px solid #e2e8f0;
    border-radius: 16px;
    padding: 1.25rem 1.4rem;
    box-shadow: 0 2px 12px rgba(15, 23, 42, 0.05);
    margin: 1rem 0;
    font-family: 'Jost', system-ui, sans-serif;
  }
  .cc__head { margin-bottom: 1rem; }
  .cc__title { margin: 0; font-size: 1.05rem; font-weight: 800; color: #0f172a; letter-spacing: -0.01em; }
  .cc__sub { margin: 0.25rem 0 0; font-size: 0.82rem; color: #64748b; }
  .cc__muted { margin: 0; color: #94a3b8; font-size: 0.85rem; font-style: italic; }
  .cc__error { margin: 0; color: #dc2626; font-size: 0.85rem; font-weight: 600; }

  .cc__totals {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 0.75rem;
    margin-bottom: 1.1rem;
  }
  .cc__stat {
    padding: 0.8rem 0.95rem;
    border-radius: 12px;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  .cc__stat-label {
    font-size: 0.64rem; font-weight: 800; color: #94a3b8;
    text-transform: uppercase; letter-spacing: 0.07em;
  }
  .cc__stat strong { font-size: 1rem; font-weight: 800; color: #0f172a; font-variant-numeric: tabular-nums; }
  .cc__ok { color: #059669; }
  .cc__owing { color: #d97706; font-weight: 700; }

  .cc__block { margin-top: 1.1rem; }
  .cc__block-title {
    margin: 0 0 0.6rem;
    font-size: 0.68rem; font-weight: 800; color: #94a3b8;
    text-transform: uppercase; letter-spacing: 0.09em;
  }

  .cc__quotes { display: grid; gap: 0.6rem; }
  .cc__quote {
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    padding: 0.75rem 0.9rem;
    background: #fff;
  }
  .cc__quote-row { display: flex; justify-content: space-between; align-items: baseline; gap: 0.8rem; }
  .cc__quote-row--meta { margin-top: 0.3rem; font-size: 0.78rem; color: #94a3b8; }
  .cc__quote-title { font-weight: 700; color: #0f172a; font-size: 0.88rem; }
  .cc__quote-total { font-weight: 800; color: #0f172a; font-variant-numeric: tabular-nums; }
  .cc__quote-remaining { color: #d97706; font-weight: 700; }
  .cc__quote-ok { color: #059669; font-weight: 700; }

  .cc__invoices { display: grid; gap: 0.6rem; }
  .cc__inv {
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    background: #fff;
    overflow: hidden;
  }
  .cc__inv summary {
    list-style: none;
    display: flex;
    align-items: center;
    gap: 0.8rem;
    padding: 0.75rem 0.9rem;
    cursor: pointer;
    flex-wrap: wrap;
  }
  .cc__inv summary::-webkit-details-marker { display: none; }
  .cc__inv[open] summary { border-bottom: 1px solid #f1f5f9; }
  .cc__inv-num { font-weight: 800; color: #02b5bb; font-size: 0.9rem; }
  .cc__inv-date { color: #94a3b8; font-size: 0.78rem; }
  .cc__inv-status {
    margin-left: auto;
    padding: 0.14em 0.6em;
    border-radius: 999px;
    font-size: 0.66rem; font-weight: 800;
    text-transform: uppercase; letter-spacing: 0.05em;
    border: 1px solid transparent;
  }
  .cc__inv-status--paid { background: #f0fdf4; color: #059669; border-color: #bbf7d0; }
  .cc__inv-status--partially_paid { background: #fffbeb; color: #d97706; border-color: #fde68a; }
  .cc__inv-status--sent { background: #eff6ff; color: #2563eb; border-color: #bfdbfe; }
  .cc__inv-total { font-weight: 800; color: #0f172a; font-variant-numeric: tabular-nums; }
  .cc__inv-caret { color: #94a3b8; transition: transform 0.15s; }
  .cc__inv[open] .cc__inv-caret { transform: rotate(180deg); }

  .cc__inv-body { padding: 0.8rem 0.9rem; }
  .cc__table { width: 100%; border-collapse: collapse; font-size: 0.82rem; }
  .cc__table th {
    text-align: left; padding: 0.4rem 0.6rem;
    color: #94a3b8; font-size: 0.64rem; font-weight: 800;
    text-transform: uppercase; letter-spacing: 0.07em;
    border-bottom: 1px solid #e2e8f0;
  }
  .cc__table td { padding: 0.45rem 0.6rem; color: #334155; border-bottom: 1px solid #f1f5f9; }
  .cc__table td:not(:first-child),
  .cc__table th:not(:first-child) { text-align: right; white-space: nowrap; }

  .cc__inv-figures {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem 1.4rem;
    justify-content: flex-end;
    margin-top: 0.7rem;
    font-size: 0.8rem;
    color: #475569;
  }
  .cc__inv-figures strong { color: #0f172a; font-variant-numeric: tabular-nums; }
</style>
