<script lang="ts">
  /**
   * InvoiceEditor — create or edit an invoice, with a live preview.
   *
   * The form edits the invoice fields; the right pane renders the same
   * InvoiceDocument the client will see, so edits are visible immediately.
   * "Download PDF" hits the server's PDF endpoint (the same document, as a
   * real PDF) after the invoice is saved.
   *
   * Two modes:
   *   • create  — `invoice` is undefined; `prefill` carries the quote-derived
   *               defaults (client name/email + first-invoice amount).
   *   • edit    — `invoice` is provided; the form is seeded from it.
   */
  import { onMount } from 'svelte';
  import {
    createInvoiceFromQuote,
    updateInvoice,
    downloadInvoicePdf,
    type Invoice,
    type InvoiceLineItem,
  } from '../store.ts';
  import InvoiceDocument from './InvoiceDocument.svelte';

  export let invoice: Invoice | undefined = undefined;
  export let prefill: {
    quoteId: string;
    consultationId?: string | null;
    clientName?: string;
    clientEmail?: string;
    amount?: number;
  } | null = null;
  export let onSaved: ((inv: Invoice) => void) | undefined = undefined;
  export let onCancel: (() => void) | undefined = undefined;

  let saving = false;
  let errorMsg = '';

  // ── Form state ────────────────────────────────────────────────────────────
  let clientName = '';
  let clientEmail = '';
  let date = new Date().toISOString().slice(0, 10);
  let dueDate = '';
  let terms = 'Due on receipt';
  let poNumber = '';
  let notes = '';
  let termsAndConditions = '';
  let discount = 0;
  let lineItems: InvoiceLineItem[] = [];

  function newId(): string {
    return `li-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  }

  function money(n: number | null | undefined): string {
    if (typeof n !== 'number' || !Number.isFinite(n)) return '—';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n);
  }

  function seedFromInvoice(inv: Invoice): void {
    clientName = inv.clientName ?? '';
    clientEmail = inv.clientEmail ?? '';
    date = inv.date ? inv.date.slice(0, 10) : new Date().toISOString().slice(0, 10);
    dueDate = inv.dueDate ? inv.dueDate.slice(0, 10) : '';
    terms = inv.terms || 'Due on receipt';
    poNumber = inv.poNumber ?? '';
    notes = inv.notes ?? '';
    termsAndConditions = (inv.termsAndConditions ?? []).join('\n');
    discount = inv.discount ?? 0;
    lineItems = (inv.lineItems ?? []).map((li) => ({ ...li }));
  }

  function seedFromPrefill(): void {
    clientName = prefill?.clientName ?? '';
    clientEmail = prefill?.clientEmail ?? '';
    // A first-invoice amount becomes a single line item.
    if (prefill?.amount && prefill.amount > 0) {
      lineItems = [
        {
          id: newId(),
          description: 'International relocation services',
          qty: 1,
          rate: prefill.amount,
          discount: 0,
          amount: prefill.amount,
        },
      ];
    } else {
      lineItems = [];
    }
  }

  onMount(() => {
    if (invoice) seedFromInvoice(invoice);
    else if (prefill) seedFromPrefill();
  });

  // ── Derived totals (mirror the server's math) ─────────────────────────────
  function round2(n: number): number {
    return Math.round((n + Number.EPSILON) * 100) / 100;
  }

  $: subtotal = round2(
    lineItems.reduce((sum, li) => sum + (Number(li.amount) || 0), 0),
  );
  $: total = round2(Math.max(0, subtotal - (Number(discount) || 0)));

  // ── Line-item editing ─────────────────────────────────────────────────────
  function addLine(): void {
    lineItems = [
      ...lineItems,
      { id: newId(), description: '', qty: 1, rate: 0, discount: 0, amount: 0 },
    ];
  }

  function removeLine(id: string): void {
    lineItems = lineItems.filter((li) => li.id !== id);
  }

  function recomputeLine(id: string): void {
    lineItems = lineItems.map((li) => {
      if (li.id !== id) return li;
      const qty = Number(li.qty) || 0;
      const rate = Number(li.rate) || 0;
      const disc = Number(li.discount) || 0;
      return { ...li, amount: round2(qty * rate - disc) };
    });
  }

  // ── Save / download ───────────────────────────────────────────────────────
  function buildPayload() {
    return {
      clientName: clientName.trim(),
      clientEmail: clientEmail.trim(),
      date: date ? new Date(date).toISOString() : null,
      dueDate: dueDate ? new Date(dueDate).toISOString() : null,
      terms: terms.trim() || 'Due on receipt',
      poNumber: poNumber.trim() || null,
      notes: notes.trim() || null,
      termsAndConditions: termsAndConditions
        .split('\n')
        .map((t) => t.trim())
        .filter(Boolean),
      discount: Number(discount) || 0,
      lineItems: lineItems.map((li) => ({
        id: li.id,
        description: li.description,
        qty: Number(li.qty) || 0,
        rate: Number(li.rate) || 0,
        discount: Number(li.discount) || 0,
        amount: Number(li.amount) || 0,
      })),
    };
  }

  async function save(): Promise<void> {
    saving = true;
    errorMsg = '';
    try {
      let saved: Invoice;
      if (invoice) {
        saved = await updateInvoice(invoice.id, buildPayload());
      } else if (prefill) {
        saved = await createInvoiceFromQuote({
          quoteId: prefill.quoteId,
          consultationId: prefill.consultationId ?? null,
          clientName: clientName.trim() || undefined,
          clientEmail: clientEmail.trim() || undefined,
          amount: total,
        });
      } else {
        throw new Error('No invoice or quote to save against.');
      }
      onSaved?.(saved);
    } catch (err: any) {
      errorMsg = err?.message ?? 'Could not save the invoice.';
    } finally {
      saving = false;
    }
  }

  async function download(): Promise<void> {
    if (!invoice) return;
    errorMsg = '';
    try {
      await downloadInvoicePdf(invoice.id);
    } catch (err: any) {
      errorMsg = err?.message ?? 'Could not download the PDF.';
    }
  }

  // ── Live preview object ───────────────────────────────────────────────────
  $: previewInvoice: Invoice = {
    id: invoice?.id ?? 'preview',
    invoiceId: invoice?.invoiceId ?? 'preview',
    invoiceNumber: invoice?.invoiceNumber ?? 'DRAFT',
    quoteId: invoice?.quoteId ?? prefill?.quoteId ?? null,
    consultationId: invoice?.consultationId ?? prefill?.consultationId ?? null,
    clientId: invoice?.clientId ?? null,
    clientName: clientName.trim() || '—',
    clientEmail: clientEmail.trim(),
    date: date ? new Date(date).toISOString() : new Date().toISOString(),
    dueDate: dueDate ? new Date(dueDate).toISOString() : null,
    terms: terms.trim() || 'Due on receipt',
    poNumber: poNumber.trim() || null,
    lineItems,
    discount: Number(discount) || 0,
    subtotal,
    total,
    payments: invoice?.payments ?? [],
    notes: notes.trim() || null,
    termsAndConditions: termsAndConditions
      .split('\n')
      .map((t) => t.trim())
      .filter(Boolean),
    status: invoice?.status ?? 'draft',
    sentAt: invoice?.sentAt ?? null,
    sentToEmail: invoice?.sentToEmail ?? null,
    createdBy: invoice?.createdBy ?? '',
    createdAt: invoice?.createdAt ?? new Date().toISOString(),
    updatedAt: invoice?.updatedAt ?? null,
    received: invoice?.received ?? 0,
    balanceDue: total - (invoice?.received ?? 0),
  };
</script>

<div class="ie">
  <div class="ie__form">
    <div class="ie__head">
      <h3>{invoice ? `Edit ${invoice.invoiceNumber}` : 'New invoice'}</h3>
      <button class="ie__cancel" on:click={onCancel}>Cancel</button>
    </div>

    {#if errorMsg}
      <p class="ie__error">{errorMsg}</p>
    {/if}

    <div class="ie__grid">
      <label>
        Client name
        <input type="text" bind:value={clientName} placeholder="Full name" />
      </label>
      <label>
        Client email
        <input type="email" bind:value={clientEmail} placeholder="name@example.com" />
      </label>
      <label>
        Invoice date
        <input type="date" bind:value={date} />
      </label>
      <label>
        Due date
        <input type="date" bind:value={dueDate} />
      </label>
      <label>
        Terms
        <input type="text" bind:value={terms} placeholder="Due on receipt" />
      </label>
      <label>
        PO number
        <input type="text" bind:value={poNumber} placeholder="Optional" />
      </label>
    </div>

    <div class="ie__lines">
      <div class="ie__lines-head">
        <h4>Line items</h4>
        <button class="ie__add" on:click={addLine}>+ Add line</button>
      </div>

      {#if lineItems.length === 0}
        <p class="ie__empty">No line items yet. Add one to start building the invoice.</p>
      {:else}
        {#each lineItems as li (li.id)}
          <div class="ie__line">
            <input
              type="text"
              placeholder="Description"
              bind:value={li.description}
            />
            <input
              type="number"
              placeholder="Qty"
              bind:value={li.qty}
              on:change={() => recomputeLine(li.id)}
            />
            <input
              type="number"
              placeholder="Rate"
              bind:value={li.rate}
              on:change={() => recomputeLine(li.id)}
            />
            <input
              type="number"
              placeholder="Discount"
              bind:value={li.discount}
              on:change={() => recomputeLine(li.id)}
            />
            <span class="ie__line-amount">{money(li.amount)}</span>
            <button class="ie__x" on:click={() => removeLine(li.id)}>✕</button>
          </div>
        {/each}
      {/if}
    </div>

    <div class="ie__totals">
      <label>
        Discount
        <input type="number" bind:value={discount} />
      </label>
      <div class="ie__totals-sum">
        <span>Subtotal</span><strong>{money(subtotal)}</strong>
        <span>Total</span><strong>{money(total)}</strong>
      </div>
    </div>

    <label class="ie__wide">
      Notes
      <textarea bind:value={notes} rows="3" placeholder="Optional note to the client"></textarea>
    </label>

    <label class="ie__wide">
      Terms & conditions
      <textarea
        bind:value={termsAndConditions}
        rows="5"
        placeholder="One term per line"
      ></textarea>
    </label>

    <div class="ie__actions">
      <button class="ie__save" on:click={save} disabled={saving}>
        {saving ? 'Saving…' : invoice ? 'Save changes' : 'Create invoice'}
      </button>
      {#if invoice}
        <button class="ie__pdf" on:click={download}>Download PDF</button>
      {/if}
    </div>
  </div>

  <div class="ie__preview">
    <InvoiceDocument invoice={previewInvoice} />
  </div>
</div>

<style>
  .ie {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1.1fr);
    gap: 1.5rem;
    align-items: start;
    font-family: var(--font-paragraph, 'Jost'), system-ui, sans-serif;
    color: var(--irp-text, #181818);
  }

  .ie__form {
    background: #fff;
    border: 1px solid #e2e8f0;
    border-radius: 16px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06), 0 8px 32px rgba(0, 0, 0, 0.04);
    padding: 1.5rem;
  }

  .ie__head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
  }

  .ie__head h3 {
    margin: 0;
    font-size: 1.05rem;
    font-weight: 800;
    color: #0f172a;
  }

  .ie__cancel {
    background: none;
    border: none;
    color: #94a3b8;
    font-family: inherit;
    font-size: 0.8rem;
    font-weight: 700;
    cursor: pointer;
  }

  .ie__cancel:hover { color: #475569; }

  .ie__error {
    padding: 0.6rem 1rem;
    border-radius: 8px;
    background: #fef2f2;
    border: 1px solid #fecaca;
    color: #dc2626;
    font-size: 0.82rem;
    font-weight: 600;
    margin-bottom: 0.8rem;
  }

  .ie__grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 0.75rem;
    margin-bottom: 1.25rem;
  }

  .ie__grid label,
  .ie__totals label,
  .ie__wide {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    font-size: 0.7rem;
    font-weight: 800;
    color: #94a3b8;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  .ie__grid input,
  .ie__totals input,
  .ie__wide textarea,
  .ie__line input {
    padding: 0.5rem 0.6rem;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    background: #fff;
    color: #0f172a;
    font-family: inherit;
    font-size: 0.84rem;
    min-width: 0;
    transition: border-color 0.14s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.14s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .ie__grid input:focus,
  .ie__totals input:focus,
  .ie__wide textarea:focus,
  .ie__line input:focus {
    outline: none;
    border-color: rgba(2, 181, 187, 0.48);
    box-shadow: 0 0 0 3px rgba(2, 181, 187, 0.1);
  }

  .ie__lines {
    margin-bottom: 1.25rem;
  }

  .ie__lines-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.6rem;
  }

  .ie__lines-head h4 {
    margin: 0;
    font-size: 0.7rem;
    font-weight: 800;
    color: #94a3b8;
    text-transform: uppercase;
    letter-spacing: 0.1em;
  }

  .ie__add {
    padding: 0.32rem 0.8rem;
    background: #f1f5f9;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    color: #475569;
    font-family: inherit;
    font-size: 0.76rem;
    font-weight: 700;
    cursor: pointer;
  }

  .ie__add:hover { background: #e2e8f0; color: #1e293b; }

  .ie__empty {
    color: #94a3b8;
    font-size: 0.82rem;
    font-style: italic;
    padding: 0.5rem 0;
  }

  .ie__line {
    display: grid;
    grid-template-columns: minmax(0, 2fr) 64px 96px 96px 90px 28px;
    gap: 0.4rem;
    align-items: center;
    margin-bottom: 0.4rem;
  }

  .ie__line input[type='number'] { text-align: right; }

  .ie__line-amount {
    text-align: right;
    font-size: 0.82rem;
    font-weight: 700;
    color: #0f172a;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  .ie__x {
    width: 24px;
    height: 24px;
    border-radius: 6px;
    border: 1px solid rgba(239, 68, 68, 0.2);
    background: rgba(239, 68, 68, 0.05);
    color: #ef4444;
    font-size: 0.7rem;
    cursor: pointer;
  }

  .ie__x:hover { background: rgba(239, 68, 68, 0.12); }

  .ie__totals {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    gap: 1rem;
    margin-bottom: 1.25rem;
  }

  .ie__totals input { width: 120px; }

  .ie__totals-sum {
    display: grid;
    grid-template-columns: auto auto;
    gap: 0.2rem 1rem;
    font-size: 0.82rem;
    color: #334155;
    font-variant-numeric: tabular-nums;
  }

  .ie__totals-sum strong {
    color: #0f172a;
    font-weight: 800;
    text-align: right;
  }

  .ie__wide {
    margin-bottom: 1rem;
  }

  .ie__wide textarea {
    resize: vertical;
    line-height: 1.5;
    text-transform: none;
    letter-spacing: normal;
    font-weight: 400;
  }

  .ie__actions {
    display: flex;
    gap: 0.6rem;
    margin-top: 0.5rem;
  }

  .ie__save {
    padding: 0.55rem 1.3rem;
    background: linear-gradient(135deg, #02b5bb 0%, #02999e 100%);
    border: none;
    border-radius: 10px;
    color: #fff;
    font-family: inherit;
    font-size: 0.84rem;
    font-weight: 700;
    cursor: pointer;
    box-shadow: 0 2px 8px rgba(2, 181, 187, 0.3);
    transition: filter 0.14s cubic-bezier(0.4, 0, 0.2, 1), transform 0.14s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .ie__save:hover:not(:disabled) { filter: brightness(1.06); transform: translateY(-1px); }
  .ie__save:disabled { opacity: 0.55; cursor: wait; }

  .ie__pdf {
    padding: 0.55rem 1.3rem;
    background: #fff;
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    color: #475569;
    font-family: inherit;
    font-size: 0.84rem;
    font-weight: 700;
    cursor: pointer;
    transition: background 0.14s cubic-bezier(0.4, 0, 0.2, 1), color 0.14s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .ie__pdf:hover { background: #f1f5f9; color: #1e293b; }

  .ie__preview {
    min-width: 0;
  }

  @media (max-width: 1024px) {
    .ie { grid-template-columns: 1fr; }
  }

  @media (max-width: 640px) {
    .ie__line {
      grid-template-columns: 1fr 1fr;
    }
    .ie__line-amount { grid-column: 1 / -1; text-align: left; }
  }
</style>
