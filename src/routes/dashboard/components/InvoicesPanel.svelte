<script lang="ts">
  /**
   * InvoicesPanel — list and manage invoices.
   *
   * Shows every invoice with its number, client, dates, total, received and
   * balance due, plus a status badge. Actions per row: view/edit (opens the
   * InvoiceEditor), download PDF, send (emails the invoice), record a payment,
   * and delete (blocked server-side once the invoice has been sent).
   *
   * "New invoice" opens the editor in create mode, where the operator picks the
   * client and then optionally a quote. An invoice without a quote is a custom
   * charge for work that was never quoted.
   */
  import { onMount } from 'svelte';
  import {
    invoices,
    fetchInvoices,
    fetchInvoice,
    sendInvoice,
    recordInvoicePayment,
    deleteInvoice,
    downloadInvoicePdf,
    type Invoice,
    type InvoicePayment,
  } from '../store.ts';
  import InvoiceEditor from './InvoiceEditor.svelte';
  import InvoiceDocument from './InvoiceDocument.svelte';

  let loading = false;
  let errorMsg = '';

  // Editor state
  let editing: Invoice | null = null;
  let creating = false;
  let viewing: Invoice | null = null;

  // Send / payment state. `sendOpenId` and `payOpenId` hold the invoice the form
  // is open for — a shared boolean would open it under every row at once.
  let sendingId = '';
  let sendEmail = '';
  let sendOpenId = '';
  let payingId = '';
  let payAmount = '';
  let payMethod = '';
  let payDate = new Date().toISOString().slice(0, 10);
  let payOpenId = '';

  // Invoice whose received payments are expanded into a per-payment list.
  // Read-only: recording a payment still goes through the "Pay" form.
  let paymentsOpenId = '';

  async function load(): Promise<void> {
    loading = true;
    errorMsg = '';
    try {
      await fetchInvoices();
    } catch (err: any) {
      errorMsg = err?.message ?? 'Could not load the invoices.';
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    if (!$invoices) load();
  });

  function money(n: number | null | undefined): string {
    if (typeof n !== 'number' || !Number.isFinite(n)) return '—';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n);
  }

  function shortDate(iso: string | null | undefined): string {
    if (!iso) return '—';
    const d = new Date(iso);
    return Number.isNaN(d.getTime())
      ? '—'
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

  async function openEdit(inv: Invoice): Promise<void> {
    errorMsg = '';
    try {
      const fresh = await fetchInvoice(inv.id);
      editing = fresh;
      viewing = null;
    } catch (err: any) {
      errorMsg = err?.message ?? 'Could not open the invoice.';
    }
  }

  function onSaved(saved: Invoice): void {
    editing = null;
    creating = false;
    viewing = saved;
    load();
  }

  async function doSend(inv: Invoice): Promise<void> {
    sendingId = inv.id;
    errorMsg = '';
    try {
      await sendInvoice(inv.id, sendEmail.trim() || undefined);
      sendOpenId = '';
      sendEmail = '';
      await load();
    } catch (err: any) {
      errorMsg = err?.message ?? 'Could not send the invoice.';
    } finally {
      sendingId = '';
    }
  }

  async function doPay(inv: Invoice): Promise<void> {
    payingId = inv.id;
    errorMsg = '';
    try {
      const payment: InvoicePayment = {
        id: `pay-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        date: payDate ? new Date(payDate).toISOString() : null,
        amount: Number(payAmount) || 0,
        method: payMethod.trim() || null,
        note: null,
        received: true,
      };
      await recordInvoicePayment(inv.id, [...(inv.payments ?? []), payment]);
      payOpenId = '';
      payAmount = '';
      payMethod = '';
      payDate = new Date().toISOString().slice(0, 10);
      await load();
    } catch (err: any) {
      errorMsg = err?.message ?? 'Could not record the payment.';
    } finally {
      payingId = '';
    }
  }

  async function doDelete(inv: Invoice): Promise<void> {
    if (!confirm(`Delete invoice ${inv.invoiceNumber}? This cannot be undone.`)) return;
    errorMsg = '';
    try {
      await deleteInvoice(inv.id);
      if (viewing?.id === inv.id) viewing = null;
      await load();
    } catch (err: any) {
      errorMsg = err?.message ?? 'Could not delete the invoice.';
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

<div class="ip">
  <div class="ip__head">
    <div>
      <h3>Invoices</h3>
      <p>Bills generated from accepted quotes, and the payments against them.</p>
    </div>
    <div class="ip__head-actions">
      <button class="ip__reload" on:click={load} disabled={loading}>
        {loading ? 'Loading…' : 'Refresh'}
      </button>
      <button class="ip__new" on:click={() => (creating = true)}>+ New invoice</button>
    </div>
  </div>

  {#if errorMsg}
    <p class="ip__error">{errorMsg}</p>
  {/if}

  {#if creating}
    <div class="ip__editor-wrap">
      <InvoiceEditor
        prefill={null}
        onSaved={onSaved}
        onCancel={() => (creating = false)}
      />
    </div>
  {:else if editing}
    <div class="ip__editor-wrap">
      <InvoiceEditor
        invoice={editing}
        onSaved={onSaved}
        onCancel={() => (editing = null)}
      />
    </div>
  {:else if viewing}
    {@const shown = viewing}
    <div class="ip__view">
      <div class="ip__view-head">
        <button class="ip__back" on:click={() => (viewing = null)}>← Back to list</button>
        <div class="ip__view-actions">
          <button class="ip__ghost" on:click={() => openEdit(shown)}>Edit</button>
          <button class="ip__ghost" on:click={() => doDownload(shown)}>Download PDF</button>
        </div>
      </div>
      <InvoiceDocument invoice={shown} />
    </div>
  {:else}
    {#if !$invoices}
      <p class="ip__empty">{loading ? 'Reading the invoices…' : 'No invoices yet.'}</p>
    {:else if $invoices.length === 0}
      <p class="ip__empty">No invoices yet. Create one from an accepted quote.</p>
    {:else}
      <div class="ip__panel">
        <table class="ip__table">
          <thead>
            <tr>
              <th>Invoice</th>
              <th>Client</th>
              <th>Issued</th>
              <th>Due</th>
              <th>Total</th>
              <th>Received</th>
              <th>Balance due</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {#each $invoices as inv (inv.id)}
              <tr>
                <td class="ip__num">{inv.invoiceNumber}</td>
                <td class="ip__name">{inv.clientName || '—'}</td>
                <td>{shortDate(inv.date)}</td>
                <td>{shortDate(inv.dueDate)}</td>
                <td>{money(inv.total)}</td>
                <td>
                  {money(inv.received)}
                  {#if receivedPayments(inv).length > 0}
                    <div class="ip__sub">
                      {receivedPayments(inv).length} payment{receivedPayments(inv).length === 1 ? '' : 's'}
                    </div>
                  {/if}
                </td>
                <td class:owing={inv.balanceDue > 0}>{money(inv.balanceDue)}</td>
                <td>
                  <span class="ip__status ip__status--{inv.status}">
                    {STATUS_LABEL[inv.status] ?? inv.status}
                  </span>
                </td>
                <td>
                  <div class="ip__row-actions">
                    <button class="ip__link" on:click={() => openEdit(inv)}>Edit</button>
                    <button class="ip__link" on:click={() => doDownload(inv)}>PDF</button>
                    <button class="ip__link" on:click={() => { sendOpenId = inv.id; payOpenId = ''; sendEmail = inv.clientEmail || ''; }}>Send</button>
                    <button class="ip__link" on:click={() => { payOpenId = inv.id; sendOpenId = ''; payAmount = String(inv.balanceDue > 0 ? inv.balanceDue : ''); payMethod = ''; }}>Pay</button>
                    {#if receivedPayments(inv).length > 0}
                      <button
                        class="ip__link"
                        aria-expanded={paymentsOpenId === inv.id}
                        on:click={() => (paymentsOpenId = paymentsOpenId === inv.id ? '' : inv.id)}
                      >
                        {paymentsOpenId === inv.id ? 'Hide payments' : 'Payments'}
                      </button>
                    {/if}
                    <button class="ip__link ip__link--danger" on:click={() => doDelete(inv)}>Delete</button>
                  </div>
                </td>
              </tr>

              {#if sendOpenId === inv.id}
                <tr class="ip__action-row">
                  <td colspan="9">
                    <div class="ip__action">
                      <label>
                        Send to
                        <input type="email" bind:value={sendEmail} placeholder="name@example.com" />
                      </label>
                      <button class="ip__save" on:click={() => doSend(inv)} disabled={sendingId === inv.id}>
                        {sendingId === inv.id ? 'Sending…' : 'Send invoice'}
                      </button>
                      <button class="ip__ghost" on:click={() => (sendOpenId = '')}>Cancel</button>
                    </div>
                  </td>
                </tr>
              {/if}

              {#if payOpenId === inv.id}
                <tr class="ip__action-row">
                  <td colspan="9">
                    <div class="ip__action">
                      <label>
                        Amount
                        <input type="number" bind:value={payAmount} placeholder="0.00" />
                      </label>
                      <label>
                        Method
                        <input type="text" bind:value={payMethod} placeholder="wire, card…" />
                      </label>
                      <label>
                        Date
                        <input type="date" bind:value={payDate} />
                      </label>
                      <button class="ip__save" on:click={() => doPay(inv)} disabled={payingId === inv.id}>
                        {payingId === inv.id ? 'Saving…' : 'Record payment'}
                      </button>
                      <button class="ip__ghost" on:click={() => (payOpenId = '')}>Cancel</button>
                    </div>
                  </td>
                </tr>
              {/if}

              {#if paymentsOpenId === inv.id}
                <tr class="ip__action-row ip__payments-row">
                  <td colspan="9">
                    <div class="ip__payments">
                      <h4>Payments received</h4>
                      {#if receivedPayments(inv).length === 0}
                        <p class="ip__empty">No received payments recorded.</p>
                      {:else}
                        <table class="ip__payments-table">
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
    {/if}
  {/if}
</div>

<style>
  .ip {
    font-family: var(--font-paragraph, 'Jost'), system-ui, sans-serif;
    color: var(--irp-text, #181818);
  }

  .ip__head {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 1rem;
    margin-bottom: 1.25rem;
    flex-wrap: wrap;
  }

  .ip__head h3 {
    margin: 0;
    font-size: 1.05rem;
    font-weight: 800;
    color: #0f172a;
  }

  .ip__head p {
    margin: 0.3rem 0 0;
    font-size: 0.8rem;
    color: #64748b;
  }

  .ip__head-actions {
    display: flex;
    gap: 0.6rem;
  }

  .ip__reload {
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

  .ip__reload:hover:not(:disabled) { background: #f1f5f9; color: #1e293b; }
  .ip__reload:disabled { opacity: 0.55; cursor: wait; }

  .ip__new {
    padding: 0.5rem 1.2rem;
    background: linear-gradient(135deg, #02b5bb 0%, #02999e 100%);
    border: none;
    border-radius: 10px;
    color: #fff;
    font-family: inherit;
    font-size: 0.82rem;
    font-weight: 700;
    cursor: pointer;
    box-shadow: 0 2px 8px rgba(2, 181, 187, 0.3);
    transition: filter 0.14s cubic-bezier(0.4, 0, 0.2, 1), transform 0.14s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .ip__new:hover { filter: brightness(1.06); transform: translateY(-1px); }

  .ip__error {
    padding: 0.6rem 1rem;
    border-radius: 8px;
    background: #fef2f2;
    border: 1px solid #fecaca;
    color: #dc2626;
    font-size: 0.82rem;
    font-weight: 600;
    margin-bottom: 0.8rem;
  }

  .ip__empty {
    color: #94a3b8;
    font-size: 0.85rem;
    font-style: italic;
    padding: 0.5rem 0;
  }

  .ip__panel {
    padding: 1.5rem;
    border-radius: 16px;
    background: #fff;
    border: 1px solid #e2e8f0;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06), 0 8px 32px rgba(0, 0, 0, 0.04);
    overflow-x: auto;
  }

  .ip__table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.82rem;
  }

  .ip__table thead tr { background: #f8fafc; }

  .ip__table th {
    text-align: left;
    padding: 0.6rem 0.8rem;
    color: #94a3b8;
    font-size: 0.68rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.09em;
    white-space: nowrap;
    border-bottom: 1px solid #e2e8f0;
  }

  .ip__table td {
    padding: 0.6rem 0.8rem;
    color: #334155;
    border-bottom: 1px solid #f1f5f9;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  .ip__table tbody tr:hover { background: #fafbff; }

  .ip__num { font-weight: 800; color: #02b5bb; }
  .ip__name { font-weight: 600; color: #0f172a; }
  .owing { color: #d97706; font-weight: 600; }

  .ip__status {
    display: inline-block;
    padding: 0.16em 0.6em;
    border-radius: 999px;
    font-size: 0.68rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    border: 1px solid transparent;
  }

  .ip__status--draft { background: #f1f5f9; color: #64748b; border-color: #e2e8f0; }
  .ip__status--sent { background: #eff6ff; color: #2563eb; border-color: #bfdbfe; }
  .ip__status--partially_paid { background: #fffbeb; color: #d97706; border-color: #fde68a; }
  .ip__status--paid { background: #f0fdf4; color: #16a34a; border-color: #bbf7d0; }

  .ip__row-actions {
    display: flex;
    gap: 0.5rem;
  }

  .ip__sub {
    font-size: 0.68rem;
    color: #94a3b8;
    white-space: nowrap;
    margin-top: 2px;
  }

  .ip__payments-row td { background: #f8fafc; white-space: normal; }

  .ip__payments {
    padding: 0.25rem 0;
  }

  .ip__payments h4 {
    margin: 0 0 0.6rem;
    font-size: 0.7rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.09em;
    color: #94a3b8;
  }

  .ip__payments-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.8rem;
    background: #fff;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    overflow: hidden;
  }

  .ip__payments-table th {
    text-align: left;
    padding: 0.5rem 0.7rem;
    color: #94a3b8;
    font-size: 0.64rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    border-bottom: 1px solid #e2e8f0;
    background: #f8fafc;
  }

  .ip__payments-table td {
    padding: 0.5rem 0.7rem;
    color: #334155;
    border-bottom: 1px solid #f1f5f9;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  .ip__payments-table tbody tr:last-child td { border-bottom: none; }

  .ip__link {
    background: none;
    border: none;
    color: #02999e;
    font-family: inherit;
    font-size: 0.76rem;
    font-weight: 700;
    cursor: pointer;
    padding: 0;
  }

  .ip__link:hover { text-decoration: underline; }
  .ip__link--danger { color: #ef4444; }

  .ip__action-row td { background: #f8fafc; white-space: normal; }

  .ip__action {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    gap: 0.6rem;
    padding: 0.5rem 0;
  }

  .ip__action label {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    font-size: 0.7rem;
    font-weight: 800;
    color: #94a3b8;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  .ip__action input {
    padding: 0.45rem 0.6rem;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    background: #fff;
    color: #0f172a;
    font-family: inherit;
    font-size: 0.82rem;
    min-width: 0;
    transition: border-color 0.14s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.14s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .ip__action input:focus {
    outline: none;
    border-color: rgba(2, 181, 187, 0.48);
    box-shadow: 0 0 0 3px rgba(2, 181, 187, 0.1);
  }

  .ip__action input[type='email'] { width: 240px; }
  .ip__action input[type='number'] { width: 120px; }
  .ip__action input[type='text'] { width: 160px; }

  .ip__save {
    padding: 0.5rem 1.2rem;
    background: linear-gradient(135deg, #02b5bb 0%, #02999e 100%);
    border: none;
    border-radius: 10px;
    color: #fff;
    font-family: inherit;
    font-size: 0.82rem;
    font-weight: 700;
    cursor: pointer;
    box-shadow: 0 2px 8px rgba(2, 181, 187, 0.3);
    transition: filter 0.14s cubic-bezier(0.4, 0, 0.2, 1), transform 0.14s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .ip__save:hover:not(:disabled) { filter: brightness(1.06); transform: translateY(-1px); }
  .ip__save:disabled { opacity: 0.55; cursor: wait; }

  .ip__ghost {
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

  .ip__ghost:hover { background: #f1f5f9; color: #1e293b; }

  .ip__editor-wrap {
    margin-bottom: 1rem;
  }

  .ip__view-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
  }

  .ip__back {
    background: none;
    border: none;
    color: #02999e;
    font-family: inherit;
    font-size: 0.84rem;
    font-weight: 700;
    cursor: pointer;
    padding: 0;
  }

  .ip__back:hover { text-decoration: underline; }

  .ip__view-actions {
    display: flex;
    gap: 0.6rem;
  }
</style>
