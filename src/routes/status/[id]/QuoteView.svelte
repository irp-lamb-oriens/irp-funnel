<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import type { Quote } from '../../dashboard/store.ts';
  import { fetchQuoteByToken, acceptQuoteAsClient } from '../../dashboard/store.ts';
  import BlockRenderer from './BlockRenderer.svelte';
  import { project } from './store.ts';

  export let consultationId: string;

  let quote: Quote | null = null;
  let loading = true;
  let loadError = '';
  let accepting = false;
  let acceptedBy = '';
  let accepted = false;
  let acceptError = '';
  // Phase 3 — selections captured from BlockRenderer's accept event
  let selectedLineItemIds: string[] = [];

  const token = $page.url.searchParams.get('quoteToken') ?? '';

  onMount(async () => {
    if (!token) { loading = false; return; }
    try {
      quote = await fetchQuoteByToken(consultationId, token);
      if (!quote) loadError = 'Quote not found.';
      if (quote?.status === 'client_accepted') accepted = true;
    } catch (e: any) {
      loadError = e.message ?? 'Error loading quote.';
    } finally {
      loading = false;
    }
  });

  async function handleAccept() {
    if (!quote || !token) return;
    accepting = true;
    acceptError = '';
    try {
      // Phase 3: pass selectedLineItemIds so the server records the final services chosen
      await acceptQuoteAsClient(
        consultationId,
        token,
        acceptedBy,
        selectedLineItemIds.length > 0 ? selectedLineItemIds : undefined,
      );
      accepted = true;
      if (quote) quote = { ...quote, status: 'client_accepted' };
    } catch (e: any) {
      acceptError = e.message ?? 'Error accepting quote.';
    } finally {
      accepting = false;
    }
  }

  function formatCurrency(amount: number, currency: string): string {
    return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
  }
</script>

{#if !token}
  <!-- No quoteToken in URL — don't render anything -->
{:else if loading}
  <div class="qv-loading">Loading quote...</div>
{:else if loadError}
  <div class="qv-error">{loadError}</div>
{:else if quote}
  {#if Array.isArray(quote.blocks) && quote.blocks.length > 0}
    <!-- ── Block-based Qwilr-style document renderer (Phase 1) ──────────
         BlockRenderer owns the accept block state and dispatches the
         `accept` event back up so we can orchestrate via acceptQuoteAsClient.
         Legacy quotes without `blocks` are unaffected — they fall through
         to the qv-container path below. -->
    <BlockRenderer
      blocks={quote.blocks}
      {quote}
      {accepted}
      {accepting}
      {acceptError}
      clientSummary={$project ?? {}}
      on:accept={async (e) => {
        acceptedBy = e.detail.acceptedBy;
        // Phase 3 — capture the client's service selection from BlockRenderer
        selectedLineItemIds = e.detail.selectedLineItemIds ?? [];
        await handleAccept();
      }}
    />
  {:else}
    <!-- ── Legacy line-items render — backward compatible ──────────────── -->
    <div class="qv-container">
      <div class="qv-header">
        <h2 class="qv-title">{quote.title || 'Quote'}</h2>
      {#if quote.status === 'client_accepted'}
        <span class="qv-badge qv-badge-accepted">✓ Accepted</span>
      {:else}
        <span class="qv-badge qv-badge-pending">Pending acceptance</span>
      {/if}
    </div>

    {#if Array.isArray(quote.lineItems) && quote.lineItems.length > 0}
      <table class="qv-table">
        <thead>
          <tr>
            <th>Service</th>
            <th class="qv-amount">Amount</th>
          </tr>
        </thead>
        <tbody>
          {#each quote.lineItems as item (item.lineId)}
            <tr>
              <td>
                <span class="qv-label">{item.label}</span>
                {#if item.notes}
                  <span class="qv-item-notes">{item.notes}</span>
                {/if}
              </td>
              <td class="qv-amount">{formatCurrency(item.amount, item.currency)}</td>
            </tr>
          {/each}
        </tbody>
        <tfoot>
          <tr class="qv-total-row">
            <td><strong>Total</strong></td>
            <td class="qv-amount"><strong>{formatCurrency(quote.total, quote.currency)}</strong></td>
          </tr>
        </tfoot>
      </table>
    {/if}

    {#if Array.isArray(quote.providerSnapshots) && quote.providerSnapshots.length > 0}
      <div class="qv-providers">
        <p class="qv-providers-label">Assigned operators</p>
        {#each quote.providerSnapshots as p}
          <span class="qv-provider-tag">{p.name} · {p.country}</span>
        {/each}
      </div>
    {/if}

    {#if quote.notes}
      <div class="qv-notes">
        <p class="qv-notes-label">Team note</p>
        <p class="qv-notes-text">{quote.notes}</p>
      </div>
    {/if}

    {#if !accepted && quote.status !== 'client_accepted'}
      <div class="qv-accept-section">
        <p class="qv-accept-intro">
          By clicking <strong>Accept quote</strong>, you confirm that you have reviewed the prices and scope listed here and agree to proceed.
        </p>
        <input
          class="qv-name-input"
          type="text"
          bind:value={acceptedBy}
          placeholder="Your full name (optional)"
        />
        {#if acceptError}
          <p class="qv-error-msg">{acceptError}</p>
        {/if}
        <button class="qv-accept-btn" on:click={handleAccept} disabled={accepting}>
          {accepting ? 'Processing...' : '✅ Accept quote'}
        </button>
      </div>
    {:else}
      <div class="qv-accepted">
        <p>🎉 <strong>Quote accepted!</strong></p>
        <p class="qv-accepted-sub">Our team will be in touch to coordinate next steps.</p>
      </div>
    {/if}
  </div>
  {/if}
{/if}

<style>
  /* ── QuoteView — Ultra-Premium Client-Facing Light Theme ─────────────── */
  @keyframes slideUp {
    from { opacity: 0; transform: translateY(14px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  @keyframes celebrationPop {
    0%   { opacity: 0; transform: scale(0.92) translateY(8px); }
    60%  { transform: scale(1.02) translateY(-2px); }
    100% { opacity: 1; transform: scale(1) translateY(0); }
  }

  /* ── Loading / Error ──────────────────────────────────────────────────── */
  .qv-loading,
  .qv-error {
    padding: 32px;
    text-align: center;
    color: #94a3b8;
    font-size: 14px;
    font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont,
      'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  }
  .qv-error { color: #dc2626; }

  /* ── Main container ───────────────────────────────────────────────────── */
  .qv-container {
    max-width: 680px;
    margin: 40px auto;
    padding: 36px 40px;
    background: #ffffff;
    border-radius: 20px;
    box-shadow:
      0 4px 6px -1px rgba(0,0,0,0.07),
      0 20px 60px -8px rgba(0,0,0,0.13);
    font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont,
      'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    font-feature-settings: 'cv02','cv03','cv04','cv11';
    animation: slideUp 0.4s cubic-bezier(0.22, 0.61, 0.36, 1) both;
    color: #0f172a;
  }

  /* ── Header row ───────────────────────────────────────────────────────── */
  .qv-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    margin-bottom: 30px;
    flex-wrap: wrap;
    gap: 14px;
  }

  .qv-title {
    font-size: 26px;
    font-weight: 800;
    color: #0f172a;
    margin: 0;
    letter-spacing: -0.03em;
    line-height: 1.2;
    flex: 1;
  }

  /* ── Status badges ────────────────────────────────────────────────────── */
  .qv-badge {
    display: inline-flex;
    align-items: center;
    font-size: 12px;
    font-weight: 700;
    padding: 5px 14px;
    border-radius: 999px;
    letter-spacing: 0.03em;
    border: 1px solid transparent;
    white-space: nowrap;
    flex-shrink: 0;
  }
  .qv-badge-accepted {
    background: #f0fdf4;
    color: #059669;
    border-color: #6ee7b7;
  }
  .qv-badge-pending {
    background: #fffbeb;
    color: #d97706;
    border-color: #fde68a;
  }

  /* ── Line items table ─────────────────────────────────────────────────── */
  .qv-table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 24px;
  }
  .qv-table thead tr {
    background: #f8fafc;
  }
  .qv-table th {
    text-align: left;
    font-size: 11px;
    font-weight: 700;
    color: #94a3b8;
    padding: 10px 16px;
    border-bottom: 2px solid #f1f5f9;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    background: #f8fafc;
  }
  .qv-table th:first-child { border-radius: 8px 0 0 8px; }
  .qv-table th:last-child  { border-radius: 0 8px 8px 0; }

  .qv-table td {
    padding: 13px 16px;
    border-bottom: 1px solid #f1f5f9;
    vertical-align: top;
  }
  .qv-table tbody tr:last-child td { border-bottom: 1px solid #e2e8f0; }

  .qv-amount {
    text-align: right;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  .qv-label {
    display: block;
    color: #1e293b;
    font-size: 15px;
    font-weight: 500;
  }

  .qv-item-notes {
    display: block;
    color: #94a3b8;
    font-size: 12px;
    margin-top: 3px;
    line-height: 1.4;
  }

  /* ── Total row ────────────────────────────────────────────────────────── */
  .qv-total-row td {
    padding-top: 16px;
    padding-bottom: 10px;
    font-size: 19px;
    font-weight: 800;
    color: #0f172a;
    border-top: 2px solid #e2e8f0;
    border-bottom: none;
    letter-spacing: -0.02em;
  }

  /* ── Providers section ────────────────────────────────────────────────── */
  .qv-providers {
    margin-bottom: 24px;
  }
  .qv-providers-label {
    font-size: 11px;
    font-weight: 700;
    color: #94a3b8;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin: 0 0 10px;
  }
  .qv-provider-tag {
    display: inline-flex;
    align-items: center;
    background: #eef2ff;
    border: 1px solid #c7d2fe;
    color: #4f46e5;
    font-size: 12.5px;
    font-weight: 600;
    padding: 4px 12px;
    border-radius: 999px;
    margin-right: 6px;
    margin-bottom: 6px;
    letter-spacing: 0.01em;
  }

  /* ── Notes card ───────────────────────────────────────────────────────── */
  .qv-notes {
    background: #f8fafc;
    border-radius: 12px;
    padding: 16px 20px;
    margin-bottom: 24px;
    border-left: 3px solid #6366f1;
  }
  .qv-notes-label {
    font-size: 11px;
    font-weight: 700;
    color: #94a3b8;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin: 0 0 7px;
  }
  .qv-notes-text {
    margin: 0;
    color: #334155;
    font-size: 14px;
    line-height: 1.65;
  }

  /* ── Accept section ───────────────────────────────────────────────────── */
  .qv-accept-section {
    border-top: 2px solid #e2e8f0;
    padding-top: 24px;
    display: flex;
    flex-direction: column;
    gap: 14px;
    background: #fafbff;
    margin: 0 -40px -36px;
    padding: 24px 40px 36px;
    border-radius: 0 0 20px 20px;
    border-top: 2px solid #e2e8f0;
  }

  .qv-accept-intro {
    font-size: 13.5px;
    color: #475569;
    line-height: 1.65;
    margin: 0;
  }

  .qv-name-input {
    width: 100%;
    padding: 13px 16px;
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    font-size: 15px;
    box-sizing: border-box;
    background: #ffffff;
    color: #0f172a;
    font-family: inherit;
    outline: none;
    transition: border-color 0.15s, box-shadow 0.15s;
  }
  .qv-name-input::placeholder { color: #94a3b8; }
  .qv-name-input:focus {
    border-color: #818cf8;
    box-shadow: 0 0 0 3px rgba(99,102,241,0.10);
  }

  /* ── Accept button ────────────────────────────────────────────────────── */
  .qv-accept-btn {
    background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
    color: #fff;
    border: none;
    padding: 0 32px;
    height: 56px;
    border-radius: 999px;
    font-size: 17px;
    font-weight: 800;
    cursor: pointer;
    width: 100%;
    letter-spacing: -0.01em;
    box-shadow: 0 4px 14px rgba(99,102,241,0.40);
    transition: box-shadow 0.2s, transform 0.2s, filter 0.2s;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
  }
  .qv-accept-btn:hover:not(:disabled) {
    box-shadow: 0 8px 28px rgba(99,102,241,0.52);
    transform: translateY(-2px);
    filter: brightness(1.07);
  }
  .qv-accept-btn:active:not(:disabled) {
    transform: translateY(0);
    filter: brightness(0.97);
    box-shadow: 0 2px 8px rgba(99,102,241,0.32);
  }
  .qv-accept-btn:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }

  /* ── Error message ────────────────────────────────────────────────────── */
  .qv-error-msg {
    color: #dc2626;
    font-size: 13px;
    margin: 0;
    background: #fef2f2;
    border: 1px solid #fecaca;
    padding: 9px 14px;
    border-radius: 8px;
    font-weight: 600;
  }

  /* ── Accepted celebration card ────────────────────────────────────────── */
  .qv-accepted {
    text-align: center;
    padding: 32px 24px;
    background: linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%);
    border-radius: 14px;
    border: 1px solid #bbf7d0;
    animation: celebrationPop 0.5s cubic-bezier(0.22, 0.61, 0.36, 1) both;
    margin-top: 8px;
  }
  .qv-accepted p {
    margin: 0 0 6px;
    font-size: 20px;
    color: #059669;
    font-weight: 800;
    letter-spacing: -0.02em;
  }
  .qv-accepted-sub {
    font-size: 14px;
    color: #64748b;
    line-height: 1.55;
  }

  /* ── Mobile responsive ────────────────────────────────────────────────── */
  @media (max-width: 640px) {
    .qv-container {
      max-width: 100%;
      margin: 0;
      padding: 24px 18px;
      border-radius: 0;
      box-shadow: none;
      animation: none;
    }
    .qv-title { font-size: 21px; }
    .qv-table th,
    .qv-table td { padding: 10px 10px; }
    .qv-accept-section {
      margin: 0 -18px -24px;
      padding: 20px 18px 24px;
      border-radius: 0;
    }
    .qv-accept-btn { font-size: 15px; height: 50px; }
  }
</style>
