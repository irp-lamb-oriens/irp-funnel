<script lang="ts">
  /**
   * InvoiceEditor — create or edit an invoice, with a live preview.
   *
   * The form edits the invoice fields; the right pane renders the same
   * InvoiceDocument the client will see, so edits are visible immediately.
   * "Download PDF" hits the server's PDF endpoint (the same document, as a
   * real PDF) after the invoice is saved.
   *
   * Creating an invoice starts by picking the client from the CRM rather than
   * retyping their details. A quote is then optional:
   *
   *   • Pick an accepted quote and bill all of it, a percentage of it, or just
   *     the lines chosen — the editor shows how much of that quote has already
   *     been invoiced and which quoted lines nobody has billed yet.
   *   • Pick no quote and write the lines by hand. That is a custom charge for
   *     work that was never quoted.
   *
   * Editing an existing invoice keeps the pickers out of the way: the client and
   * quote it was raised against are settled facts by then.
   */
  import { onMount } from 'svelte';
  import {
    clients,
    fetchClients,
    fetchQuotes,
    invoices,
    fetchInvoices,
    createInvoice,
    updateInvoice,
    downloadInvoicePdf,
    summarizeQuoteBilling,
    quoteBillableLines,
    QUOTE_STATUS_LABEL,
    type Invoice,
    type InvoiceLineItem,
    type Quote,
    type QuoteBillableLine,
    type QuoteBillingSummary,
  } from '../store.ts';
  import InvoiceDocument from './InvoiceDocument.svelte';

  export let invoice: Invoice | undefined = undefined;
  /**
   * Optional starting point when the editor is opened from a quote (the Quotes
   * tab "Create invoice" button). Everything is optional — opened with nothing,
   * the editor starts on the client picker.
   */
  export let prefill: {
    quoteId?: string | null;
    consultationId?: string | null;
    clientId?: string | null;
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

  // ── Client + quote selection (create mode only) ───────────────────────────
  let selectedClientId = '';
  /** '' means a custom, quote-agnostic invoice. */
  let selectedQuoteId = '';
  let clientQuotes: Quote[] = [];
  let loadingQuotes = false;
  /** Billing a share of the quote rather than the whole thing. 100 = all of it. */
  let percentage = 100;
  /** Quote lines the operator ticked. Empty means every line. */
  let pickedLineIds: string[] = [];

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

  function shortDate(iso: string | null | undefined): string {
    if (!iso) return 'no date';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return 'no date';
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
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
    selectedClientId = inv.clientId ?? inv.consultationId ?? '';
    selectedQuoteId = inv.quoteId ?? '';
  }

  onMount(async () => {
    if (invoice) {
      seedFromInvoice(invoice);
      return;
    }

    // The pickers read from these two stores, so make sure both are loaded.
    if (!$clients.length) fetchClients().catch(() => {/* the picker stays empty */});
    if ($invoices === null) fetchInvoices().catch(() => {/* remaining % just reads 100% */});

    clientName = prefill?.clientName ?? '';
    clientEmail = prefill?.clientEmail ?? '';
    const startingClient = prefill?.clientId || prefill?.consultationId || '';
    if (startingClient) {
      selectedClientId = startingClient;
      await loadQuotes(startingClient);
      if (prefill?.quoteId) selectQuote(prefill.quoteId);
    }
    // The old deposit flow passed a flat first-invoice amount.
    if (!prefill?.quoteId && prefill?.amount && prefill.amount > 0) {
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
    }
  });

  // ── Derived totals (mirror the server's math) ─────────────────────────────
  function round2(n: number): number {
    return Math.round((n + Number.EPSILON) * 100) / 100;
  }

  $: subtotal = round2(
    lineItems.reduce((sum, li) => sum + (Number(li.amount) || 0), 0),
  );
  $: total = round2(Math.max(0, subtotal - (Number(discount) || 0)));

  // ── Client / quote pickers ────────────────────────────────────────────────

  $: sortedClients = [...$clients].sort((a, b) =>
    (a.displayName || a.email || '').localeCompare(b.displayName || b.email || ''),
  );

  /**
   * Only accepted quotes are offered by default: an invoice for a quote the
   * client has not agreed to is a billing mistake, not a shortcut. Anything
   * already sent is still listed so a deposit can be raised alongside it.
   */
  $: billableQuotes = clientQuotes.filter(
    (q) => q.status === 'client_accepted' || q.status === 'sent_to_client',
  );

  $: selectedQuote = clientQuotes.find((q) => q.quoteId === selectedQuoteId) ?? null;
  $: quoteLines = quoteBillableLines(selectedQuote);
  $: billing = summarizeQuoteBilling(selectedQuote, $invoices);

  async function loadQuotes(clientId: string): Promise<void> {
    clientQuotes = [];
    if (!clientId) return;
    loadingQuotes = true;
    try {
      clientQuotes = await fetchQuotes(clientId);
    } catch (err: any) {
      errorMsg = err?.message ?? 'Could not load this client\u2019s quotes.';
    } finally {
      loadingQuotes = false;
    }
  }

  async function onClientChange(): Promise<void> {
    errorMsg = '';
    selectedQuoteId = '';
    pickedLineIds = [];
    percentage = 100;
    lineItems = [];
    const client = $clients.find((c) => c.id === selectedClientId);
    if (client) {
      clientName = client.displayName || `${client.name} ${client.surname}`.trim();
      clientEmail = client.email ?? '';
    }
    await loadQuotes(selectedClientId);
  }

  /**
   * Default to billing whatever is still outstanding on the quote, and to the
   * lines nobody has invoiced yet. Both stay editable; this is just the answer
   * the operator wanted most of the time.
   */
  function selectQuote(quoteId: string): void {
    selectedQuoteId = quoteId;
    errorMsg = '';
    const quote = clientQuotes.find((q) => q.quoteId === quoteId) ?? null;
    if (!quote) {
      pickedLineIds = [];
      lineItems = [];
      return;
    }
    const summary = summarizeQuoteBilling(quote, $invoices);
    percentage = summary.remainingPct > 0 ? summary.remainingPct : 100;
    const uninvoiced = summary.uninvoicedLines.map((l) => l.lineId);
    pickedLineIds = uninvoiced.length
      ? uninvoiced
      : quoteBillableLines(quote).map((l) => l.lineId);
    if (quote.notes && !notes) notes = quote.notes;
    rebuildLinesFromQuote();
  }

  function onQuoteChange(): void {
    if (!selectedQuoteId) {
      // Back to a custom invoice: the operator writes the lines themselves.
      pickedLineIds = [];
      percentage = 100;
      lineItems = [];
      return;
    }
    selectQuote(selectedQuoteId);
  }

  function toggleQuoteLine(lineId: string): void {
    pickedLineIds = pickedLineIds.includes(lineId)
      ? pickedLineIds.filter((id) => id !== lineId)
      : [...pickedLineIds, lineId];
    rebuildLinesFromQuote();
  }

  function setPercentage(next: number): void {
    percentage = Math.min(100, Math.max(0.01, Number(next) || 0));
    rebuildLinesFromQuote();
  }

  /**
   * Rewrite the invoice lines from the picked quote lines.
   *
   * A percentage scales each line rather than discounting the total, so the
   * subtotal on the PDF still adds up to what is being charged. The operator can
   * edit any line afterwards; those edits are what get saved.
   */
  function rebuildLinesFromQuote(): void {
    if (!selectedQuote) return;
    const picked: QuoteBillableLine[] = pickedLineIds.length
      ? quoteLines.filter((l) => pickedLineIds.includes(l.lineId))
      : quoteLines;
    const scale = (Number(percentage) || 100) / 100;
    const suffix = percentage < 100 ? ` (${round2(percentage)}% of quoted)` : '';
    lineItems = picked.map((l) => {
      const rate = round2(l.price * scale);
      return {
        id: newId(),
        quoteLineItemId: l.lineId,
        description: `${l.label}${suffix}`,
        qty: 1,
        rate,
        discount: 0,
        amount: rate,
      };
    });
  }

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
        saved = await updateInvoice(invoice.id, buildPayload() as Partial<Invoice>);
      } else {
        if (!selectedClientId && !selectedQuoteId) {
          throw new Error('Pick the client this invoice is for.');
        }
        if (!lineItems.length) {
          throw new Error('Add at least one line item.');
        }
        const payload = buildPayload();
        saved = await createInvoice({
          clientId: selectedClientId || null,
          consultationId: selectedClientId || prefill?.consultationId || null,
          quoteId: selectedQuoteId || null,
          percentage: selectedQuoteId && percentage < 100 ? round2(percentage) : null,
          quoteLineItemIds: selectedQuoteId ? pickedLineIds : undefined,
          ...payload,
        });
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
  $: previewInvoice = {
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

    {#if !invoice}
      <div class="ie__pick">
        <label class="ie__pick-field">
          Client
          <select bind:value={selectedClientId} on:change={onClientChange}>
            <option value="">Select a client…</option>
            {#each sortedClients as c (c.id)}
              <option value={c.id}>
                {c.displayName || c.email || c.id}{c.email ? ` · ${c.email}` : ''}
              </option>
            {/each}
          </select>
        </label>

        <label class="ie__pick-field">
          Quote
          <select
            bind:value={selectedQuoteId}
            on:change={onQuoteChange}
            disabled={!selectedClientId || loadingQuotes}
          >
            <option value="">No quote — custom charge</option>
            {#each billableQuotes as q (q.quoteId)}
              <option value={q.quoteId}>
                {q.title || 'Untitled quote'} · {shortDate(q.clientAcceptedAt || q.createdAt)} · {money(q.total)} · {QUOTE_STATUS_LABEL[q.status]?.label ?? q.status}
              </option>
            {/each}
          </select>
        </label>
      </div>

      {#if selectedClientId && !loadingQuotes && billableQuotes.length === 0}
        <p class="ie__hint">
          This client has no accepted or sent quote. Write the line items below and
          it will be saved as a custom charge.
        </p>
      {/if}

      {#if selectedQuote}
        <div class="ie__quote">
          <div class="ie__quote-stats">
            <div>
              <span>Quote total</span>
              <strong>{money(billing.quoteTotal)}</strong>
            </div>
            <div>
              <span>Already invoiced</span>
              <strong>{money(billing.invoicedTotal)} · {billing.invoicedPct}%</strong>
            </div>
            <div class:ie__quote-stat--open={billing.remainingTotal > 0}>
              <span>Still to bill</span>
              <strong>{money(billing.remainingTotal)} · {billing.remainingPct}%</strong>
            </div>
            <div>
              <span>Invoices raised</span>
              <strong>{billing.invoiceCount}</strong>
            </div>
          </div>

          <div class="ie__pct">
            <span class="ie__pct-label">Bill this share of the quote</span>
            <div class="ie__pct-row">
              {#each [25, 50, 75, 100] as preset}
                <button
                  type="button"
                  class="ie__pct-preset"
                  class:active={round2(percentage) === preset}
                  on:click={() => setPercentage(preset)}
                >{preset}%</button>
              {/each}
              {#if billing.remainingPct > 0 && billing.remainingPct < 100}
                <button
                  type="button"
                  class="ie__pct-preset"
                  class:active={round2(percentage) === billing.remainingPct}
                  on:click={() => setPercentage(billing.remainingPct)}
                >Remaining {billing.remainingPct}%</button>
              {/if}
              <input
                type="number"
                min="0.01"
                max="100"
                step="0.01"
                value={percentage}
                on:change={(e) => setPercentage(Number(e.currentTarget.value))}
                aria-label="Custom percentage"
              />
            </div>
          </div>

          <div class="ie__qlines">
            <span class="ie__pct-label">
              Quote lines to invoice ({pickedLineIds.length}/{quoteLines.length})
            </span>
            {#each quoteLines as l (l.lineId)}
              {@const invoiced = billing.invoicedLineIds.has(l.lineId)}
              <label class="ie__qline" class:ie__qline--invoiced={invoiced}>
                <input
                  type="checkbox"
                  checked={pickedLineIds.includes(l.lineId)}
                  on:change={() => toggleQuoteLine(l.lineId)}
                />
                <span class="ie__qline-label">{l.label}</span>
                {#if invoiced}
                  <span class="ie__qline-tag">already invoiced</span>
                {/if}
                <span class="ie__qline-price">{money(l.price)}</span>
              </label>
            {/each}
          </div>
        </div>
      {/if}
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

  /* ── Client / quote pickers ─────────────────────────────────────────────── */

  .ie__pick {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 0.75rem;
    margin-bottom: 0.9rem;
  }

  .ie__pick-field {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    font-size: 0.7rem;
    font-weight: 800;
    color: #94a3b8;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    min-width: 0;
  }

  .ie__pick-field select {
    padding: 0.5rem 0.6rem;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    background: #fff;
    color: #0f172a;
    font-family: inherit;
    font-size: 0.84rem;
    font-weight: 500;
    text-transform: none;
    letter-spacing: normal;
    min-width: 0;
    cursor: pointer;
  }

  .ie__pick-field select:focus {
    outline: none;
    border-color: rgba(2, 181, 187, 0.48);
    box-shadow: 0 0 0 3px rgba(2, 181, 187, 0.1);
  }

  .ie__pick-field select:disabled {
    background: #f8fafc;
    color: #94a3b8;
    cursor: not-allowed;
  }

  .ie__hint {
    margin: 0 0 1rem;
    padding: 0.55rem 0.8rem;
    border-radius: 8px;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    color: #64748b;
    font-size: 0.8rem;
    line-height: 1.5;
  }

  .ie__quote {
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    background: #fafbfc;
    padding: 0.9rem 1rem;
    margin-bottom: 1.25rem;
  }

  .ie__quote-stats {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
    gap: 0.7rem;
    padding-bottom: 0.85rem;
    border-bottom: 1px solid #e2e8f0;
  }

  .ie__quote-stats div {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    min-width: 0;
  }

  .ie__quote-stats span {
    font-size: 0.64rem;
    font-weight: 800;
    color: #94a3b8;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  .ie__quote-stats strong {
    font-size: 0.86rem;
    font-weight: 800;
    color: #0f172a;
    font-variant-numeric: tabular-nums;
  }

  .ie__quote-stat--open strong { color: #02999e; }

  .ie__pct { padding: 0.85rem 0 0; }

  .ie__pct-label {
    display: block;
    font-size: 0.64rem;
    font-weight: 800;
    color: #94a3b8;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin-bottom: 0.45rem;
  }

  .ie__pct-row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
    align-items: center;
  }

  .ie__pct-preset {
    padding: 0.3rem 0.7rem;
    border: 1px solid #e2e8f0;
    border-radius: 999px;
    background: #fff;
    color: #475569;
    font-family: inherit;
    font-size: 0.74rem;
    font-weight: 700;
    cursor: pointer;
    transition: border-color 0.14s cubic-bezier(0.4, 0, 0.2, 1), color 0.14s cubic-bezier(0.4, 0, 0.2, 1), background 0.14s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .ie__pct-preset:hover { border-color: rgba(2, 181, 187, 0.4); color: #02999e; }

  .ie__pct-preset.active {
    background: rgba(2, 181, 187, 0.1);
    border-color: rgba(2, 181, 187, 0.5);
    color: #02777b;
  }

  .ie__pct-row input {
    width: 84px;
    padding: 0.3rem 0.5rem;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    background: #fff;
    color: #0f172a;
    font-family: inherit;
    font-size: 0.78rem;
    text-align: right;
  }

  .ie__pct-row input:focus {
    outline: none;
    border-color: rgba(2, 181, 187, 0.48);
    box-shadow: 0 0 0 3px rgba(2, 181, 187, 0.1);
  }

  .ie__qlines { padding-top: 0.9rem; }

  .ie__qline {
    display: grid;
    grid-template-columns: 18px minmax(0, 1fr) auto auto;
    gap: 0.5rem;
    align-items: center;
    padding: 0.32rem 0;
    font-size: 0.82rem;
    color: #334155;
    cursor: pointer;
  }

  .ie__qline--invoiced .ie__qline-label { color: #94a3b8; }

  .ie__qline input { cursor: pointer; accent-color: #02b5bb; }

  .ie__qline-label {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .ie__qline-tag {
    padding: 0.1rem 0.45rem;
    border-radius: 999px;
    background: #f1f5f9;
    color: #94a3b8;
    font-size: 0.62rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    white-space: nowrap;
  }

  .ie__qline-price {
    font-weight: 700;
    color: #0f172a;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
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
