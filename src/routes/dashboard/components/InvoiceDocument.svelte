<script lang="ts">
  /**
   * InvoiceDocument — the on-screen preview of an invoice.
   *
   * This is the HTML twin of the server-side PDF (invoicePdf.ts). It renders
   * the same header (logo + company block), the same meta columns, the same
   * line-items table, the same totals column and the same notes / terms
   * sections, so what the operator sees here is what the client receives.
   *
   * It is deliberately read-only: editing happens in InvoiceEditor, which
   * composes this component for its live preview pane.
   */
  import type { Invoice } from '../store.ts';

  export let invoice: Invoice;

  const COMPANY = {
    name: 'International Relocation Partner LLC',
    address: 'Miami Florida 33130, U.S.A',
    email: 'finance@internationalrelocationpartner.com',
    website: 'www.internationalrelocationpartner.com',
  };

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
</script>

<div class="doc">
  <div class="doc__sheet">
    <!-- Header: logo + company block -->
    <header class="doc__head">
      <div class="doc__brand">
        <img class="doc__logo" src="/IRP-LOGO.jpg" alt="International Relocation Partner logo" />
        <div class="doc__company">
          <strong>{COMPANY.name}</strong>
          <span>{COMPANY.address}</span>
          <span>{COMPANY.email}</span>
          <span>{COMPANY.website}</span>
        </div>
      </div>
      <div class="doc__title">
        <h1>INVOICE</h1>
        <p class="doc__number">{invoice.invoiceNumber}</p>
        <p class="doc__status doc__status--{invoice.status}">
          {STATUS_LABEL[invoice.status] ?? invoice.status}
        </p>
      </div>
    </header>

    <!-- Meta columns -->
    <section class="doc__meta">
      <div class="doc__meta-col">
        <span class="doc__label">INVOICE DATE</span>
        <span class="doc__value">{shortDate(invoice.date)}</span>
      </div>
      <div class="doc__meta-col">
        <span class="doc__label">TERMS</span>
        <span class="doc__value">{invoice.terms || 'Due on receipt'}</span>
      </div>
      <div class="doc__meta-col">
        <span class="doc__label">BILL TO</span>
        <span class="doc__value doc__value--strong">{invoice.clientName || '—'}</span>
        <span class="doc__value">{invoice.clientEmail || ''}</span>
      </div>
      <div class="doc__meta-col">
        <span class="doc__label">DUE DATE</span>
        <span class="doc__value">{shortDate(invoice.dueDate)}</span>
      </div>
      <div class="doc__meta-col">
        <span class="doc__label">PO NUMBER</span>
        <span class="doc__value">{invoice.poNumber || '—'}</span>
      </div>
    </section>

    <!-- Overall service description from the accepted quote (clientDescription) -->
    {#if invoice.overallDescription}
      <section class="doc__overall">
        <p>{invoice.overallDescription}</p>
      </section>
    {/if}

    <!-- Line items -->
    <table class="doc__table">
      <thead>
        <tr>
          <th class="doc__th--num">#</th>
          <th>Item & Description</th>
          <th class="doc__th--num">Qty</th>
          <th class="doc__th--num">Rate</th>
          <th class="doc__th--num">Discount</th>
          <th class="doc__th--num">Amount</th>
        </tr>
      </thead>
      <tbody>
        {#each invoice.lineItems as item, i (item.id)}
          <tr>
            <td class="doc__num">{i + 1}</td>
            <td>
              <span class="doc__item-desc">{item.description}</span>
              {#if item.groupDescription}
                <span class="doc__item-sub">{item.groupDescription}</span>
              {/if}
            </td>
            <td class="doc__num">{item.qty}</td>
            <td class="doc__num">{money(item.rate)}</td>
            <td class="doc__num">{money(item.discount)}</td>
            <td class="doc__num">{money(item.amount)}</td>
          </tr>
        {:else}
          <tr>
            <td colspan="6" class="doc__empty">No line items yet.</td>
          </tr>
        {/each}
      </tbody>
    </table>

    <!-- Totals -->
    <section class="doc__totals">
      <div class="doc__totals-inner">
        <div class="doc__total-row">
          <span>Subtotal</span>
          <span>{money(invoice.subtotal)}</span>
        </div>
        {#if invoice.discount > 0}
          <div class="doc__total-row">
            <span>Discount</span>
            <span>{money(invoice.discount)}</span>
          </div>
        {/if}
        <div class="doc__total-row doc__total-row--big">
          <span>Total</span>
          <span>{money(invoice.total)}</span>
        </div>
        <div class="doc__total-row">
          <span>Payment received</span>
          <span>{money(invoice.received)}</span>
        </div>
        <div class="doc__total-row doc__total-row--due">
          <span>Balance due</span>
          <span>{money(invoice.balanceDue)}</span>
        </div>
      </div>
    </section>

    <!-- Notes -->
    {#if invoice.notes}
      <section class="doc__block">
        <h2>Notes</h2>
        <p>{invoice.notes}</p>
      </section>
    {/if}

    <!-- Terms & conditions -->
    {#if invoice.termsAndConditions && invoice.termsAndConditions.length > 0}
      <section class="doc__block">
        <h2>Terms & conditions</h2>
        <ol>
          {#each invoice.termsAndConditions as term, i (i)}
            <li>{term}</li>
          {/each}
        </ol>
      </section>
    {/if}
  </div>
</div>

<style>
  /* The sheet is styled to read like the printed PDF: a white A4-ish page on
     the #fafbfc canvas, with the same teal accent the rest of the dashboard
     uses. Fonts fall back to Jost (--font-paragraph) then system-ui. */
  .doc {
    font-family: var(--font-paragraph, 'Jost'), system-ui, sans-serif;
    color: #181818;
  }

  .doc__sheet {
    background: #fff;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06), 0 8px 32px rgba(0, 0, 0, 0.04);
    padding: 2.25rem 2.5rem;
    max-width: 820px;
    margin: 0 auto;
  }

  .doc__head {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 1.5rem;
    padding-bottom: 1.5rem;
    border-bottom: 2px solid #02b5bb;
    margin-bottom: 1.5rem;
  }

  .doc__brand {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .doc__logo {
    width: 64px;
    height: 64px;
    object-fit: contain;
    border-radius: 8px;
  }

  .doc__company {
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
    font-size: 0.78rem;
    color: #475569;
  }

  .doc__company strong {
    font-size: 0.9rem;
    color: #0f172a;
    font-weight: 800;
  }

  .doc__title {
    text-align: right;
  }

  .doc__title h1 {
    margin: 0;
    font-size: 1.6rem;
    font-weight: 800;
    color: #0f172a;
    letter-spacing: 0.02em;
  }

  .doc__number {
    margin: 0.2rem 0 0;
    font-size: 0.9rem;
    font-weight: 700;
    color: #02b5bb;
    font-variant-numeric: tabular-nums;
  }

  .doc__status {
    display: inline-block;
    margin-top: 0.5rem;
    padding: 0.18em 0.7em;
    border-radius: 999px;
    font-size: 0.68rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    border: 1px solid transparent;
  }

  .doc__status--draft { background: #f1f5f9; color: #64748b; border-color: #e2e8f0; }
  .doc__status--sent { background: #eff6ff; color: #2563eb; border-color: #bfdbfe; }
  .doc__status--partially_paid { background: #fffbeb; color: #d97706; border-color: #fde68a; }
  .doc__status--paid { background: #f0fdf4; color: #16a34a; border-color: #bbf7d0; }

  .doc__meta {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  .doc__meta-col {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
  }

  .doc__label {
    font-size: 0.62rem;
    font-weight: 800;
    color: #94a3b8;
    text-transform: uppercase;
    letter-spacing: 0.1em;
  }

  .doc__value {
    font-size: 0.82rem;
    color: #334155;
  }

  .doc__value--strong {
    font-weight: 700;
    color: #0f172a;
  }

  .doc__overall {
    margin-bottom: 1.25rem;
    padding: 0.9rem 1rem;
    background: #f8fafc;
    border-left: 3px solid #02b5bb;
    border-radius: 0 8px 8px 0;
  }

  .doc__overall p {
    margin: 0;
    font-size: 0.85rem;
    color: #334155;
    line-height: 1.6;
  }

  .doc__item-desc {
    display: block;
    font-weight: 600;
    color: #1e293b;
  }

  .doc__item-sub {
    display: block;
    margin-top: 0.15rem;
    font-size: 0.76rem;
    color: #94a3b8;
    line-height: 1.45;
  }

  .doc__table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.82rem;
    margin-bottom: 1.5rem;
  }

  .doc__table thead tr { background: #f8fafc; }

  .doc__table th {
    text-align: left;
    padding: 0.6rem 0.8rem;
    color: #94a3b8;
    font-size: 0.66rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.09em;
    border-bottom: 1px solid #e2e8f0;
  }

  .doc__table td {
    padding: 0.6rem 0.8rem;
    color: #334155;
    border-bottom: 1px solid #f1f5f9;
    vertical-align: top;
  }

  .doc__th--num, .doc__num { text-align: right; white-space: nowrap; }
  .doc__num { font-variant-numeric: tabular-nums; }

  .doc__empty {
    text-align: center;
    color: #94a3b8;
    font-style: italic;
    padding: 1.5rem 0;
  }

  .doc__totals {
    display: flex;
    justify-content: flex-end;
    margin-bottom: 1.5rem;
  }

  .doc__totals-inner {
    width: 280px;
    display: grid;
    gap: 0.4rem;
  }

  .doc__total-row {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    font-size: 0.82rem;
    color: #334155;
    font-variant-numeric: tabular-nums;
  }

  .doc__total-row--big {
    font-size: 1rem;
    font-weight: 800;
    color: #0f172a;
    padding-top: 0.4rem;
    border-top: 1px solid #e2e8f0;
  }

  .doc__total-row--due {
    font-size: 0.95rem;
    font-weight: 800;
    color: #02b5bb;
    padding-top: 0.4rem;
    border-top: 1px solid #e2e8f0;
  }

  .doc__block {
    margin-top: 1.5rem;
    padding-top: 1.25rem;
    border-top: 1px solid #e2e8f0;
  }

  .doc__block h2 {
    margin: 0 0 0.5rem;
    font-size: 0.7rem;
    font-weight: 800;
    color: #94a3b8;
    text-transform: uppercase;
    letter-spacing: 0.1em;
  }

  .doc__block p {
    margin: 0;
    font-size: 0.82rem;
    color: #334155;
    line-height: 1.6;
    white-space: pre-wrap;
  }

  .doc__block ol {
    margin: 0;
    padding-left: 1.2rem;
    font-size: 0.82rem;
    color: #334155;
    line-height: 1.6;
    display: grid;
    gap: 0.3rem;
  }

  @media (max-width: 640px) {
    .doc__sheet { padding: 1.25rem 1rem; }
    .doc__head { flex-direction: column; }
    .doc__title { text-align: left; }
  }
</style>
