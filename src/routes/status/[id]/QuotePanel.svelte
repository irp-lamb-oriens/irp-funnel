<script lang="ts">
  /**
   * QuotePanel.svelte
   *
   * Displays the client's received / accepted quote(s) and the
   * "Accept Quote" primary CTA.
   *
   * Props
   *   projectId  — Firestore doc ID of the consultation
   *   isStaff    — true when an IRP agent is viewing via the staff bypass;
   *                the Accept button is disabled and a tooltip explains why
   * 
   * Data is loaded on mount via loadQuotes() from the status store.
   */
  import { onMount, createEventDispatcher } from 'svelte';
  import {
    quotes, quotesLoading, quotesError,
    loadQuotes,
    type ClientQuote,
  } from './store.ts';

  export let projectId: string;
  /** When true (staff bypass) the Accept button is visible but disabled. */
  export let isStaff: boolean = false;

  const dispatch = createEventDispatcher<{ goToAccept: void }>();

  onMount(() => {
    loadQuotes(projectId);
  });

  // ── Helpers ────────────────────────────────────────────────────────────────

  function formatCurrency(amount: number | null, currency: string): string {
    if (amount === null || amount === undefined) return '—';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  }

  function formatDate(iso: string | null): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'long', day: 'numeric', year: 'numeric',
    });
  }

  function modalityLabel(m: string | null): string {
    const map: Record<string, string> = {
      maritime: '🚢 Maritime', air: '✈️ Air', land: '🚛 Land',
    };
    return m ? (map[m] ?? m) : '—';
  }

  function categoryLabel(c: string | null): string {
    const map: Record<string, string> = {
      full_service:      '🛡️ Full Service',
      self_pack_loading: '👥 Self Pack + Loading',
      diy_no_loading:    '👤 DIY — No Loading',
      freight_only:      '🚢 Freight Only',
    };
    return c ? (map[c] ?? c) : '—';
  }

  // ── Derived ────────────────────────────────────────────────────────────────

  $: receivedQuotes  = $quotes.filter(q => q.status === 'received');
  $: acceptedQuotes  = $quotes.filter(q => q.status === 'accepted');
  $: hasAnyQuote     = $quotes.length > 0;
  $: isAlreadyAccepted = acceptedQuotes.length > 0;
</script>

<!-- ── ACCEPTED CONFIRMATION ───────────────────────────────────────────────── -->
{#if isAlreadyAccepted}
  <section class="qp-section qp-section--accepted">
    <div class="qp-accepted-badge">
      <span class="qp-accepted-icon">✅</span>
      <div>
        <h3 class="qp-accepted-title">Quote Accepted</h3>
        <p class="qp-accepted-sub">
          Your IRP advisor will contact you shortly to confirm next steps and
          coordinate your relocation.
        </p>
      </div>
    </div>

    {#each acceptedQuotes as q (q.quoteId ?? q.id)}
      <div class="qp-card qp-card--accepted">
        <div class="qp-card__header">
          <span class="qp-provider">{q.providerName}</span>
          <span class="qp-status qp-status--accepted">✅ Accepted</span>
        </div>
        {#if q.amount !== null}
          <div class="qp-amount">{formatCurrency(q.amount, q.currency)}</div>
        {/if}
        <div class="qp-meta-grid">
          {#if q.shippingModality}
            <div class="qp-meta-item">
              <span class="qp-meta-label">Shipping</span>
              <span>{modalityLabel(q.shippingModality)}</span>
            </div>
          {/if}
          {#if q.serviceCategory}
            <div class="qp-meta-item">
              <span class="qp-meta-label">Service</span>
              <span>{categoryLabel(q.serviceCategory)}</span>
            </div>
          {/if}
          {#if q.validUntil}
            <div class="qp-meta-item">
              <span class="qp-meta-label">Valid until</span>
              <span>{formatDate(q.validUntil)}</span>
            </div>
          {/if}
        </div>
        {#if q.notes}
          <p class="qp-notes">{q.notes}</p>
        {/if}
      </div>
    {/each}
  </section>

<!-- ── LOADING ─────────────────────────────────────────────────────────────── -->
{:else if $quotesLoading}
  <section class="qp-section">
    <div class="qp-loading">
      <div class="qp-spinner"></div>
      <span>Loading your quote…</span>
    </div>
  </section>

<!-- ── ERROR ───────────────────────────────────────────────────────────────── -->
{:else if $quotesError}
  <section class="qp-section">
    <p class="qp-error">{$quotesError}</p>
  </section>

<!-- ── NO QUOTES YET ───────────────────────────────────────────────────────── -->
{:else if !hasAnyQuote}
  <!-- Silently show nothing — quote not yet prepared -->

<!-- ── RECEIVED QUOTES ─────────────────────────────────────────────────────── -->
{:else if receivedQuotes.length > 0}
  <section class="qp-section">
    <div class="qp-header">
      <h3 class="qp-title">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-highlight-2,#0ea5e9)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><polyline points="8 21 12 17 16 21"/></svg>
        Your Relocation Quote
      </h3>
      <p class="qp-subtitle">Review the details below and accept when you're ready to proceed.</p>
    </div>

    {#each receivedQuotes as q (q.quoteId ?? q.id)}
      <div class="qp-card">
        <div class="qp-card__header">
          <span class="qp-provider">{q.providerName}</span>
          <span class="qp-status qp-status--received">📋 Awaiting acceptance</span>
        </div>

        {#if q.amount !== null}
          <div class="qp-amount">{formatCurrency(q.amount, q.currency)}</div>
        {/if}

        <div class="qp-meta-grid">
          {#if q.shippingModality}
            <div class="qp-meta-item">
              <span class="qp-meta-label">Shipping</span>
              <span>{modalityLabel(q.shippingModality)}</span>
            </div>
          {/if}
          {#if q.serviceCategory}
            <div class="qp-meta-item">
              <span class="qp-meta-label">Service tier</span>
              <span>{categoryLabel(q.serviceCategory)}</span>
            </div>
          {/if}
          {#if q.validUntil}
            <div class="qp-meta-item">
              <span class="qp-meta-label">Valid until</span>
              <span>{formatDate(q.validUntil)}</span>
            </div>
          {/if}
          {#if q.receivedAt}
            <div class="qp-meta-item">
              <span class="qp-meta-label">Received</span>
              <span>{formatDate(q.receivedAt)}</span>
            </div>
          {/if}
        </div>

        {#if q.notes}
          <p class="qp-notes">{q.notes}</p>
        {/if}

        <!-- Accept CTA — routes to the dedicated Accept tab with full consent form -->
        {#if isStaff}
          <div class="qp-staff-notice">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            Only the client can accept their own quote.
          </div>
          <button class="qp-btn qp-btn--accept qp-btn--disabled" disabled>
            🔒 Review & Accept (client action only)
          </button>
        {:else}
          <button
            class="qp-btn qp-btn--accept"
            on:click={() => dispatch('goToAccept')}
          >
            Review & Accept →
          </button>
        {/if}
      </div>
    {/each}
  </section>
{/if}

<style>
  .qp-section {
    margin-bottom: 2rem;
  }
  .qp-section--accepted {
    background: rgba(16, 185, 129, 0.06);
    border: 1px solid rgba(16, 185, 129, 0.3);
    border-radius: 16px;
    padding: 1.5rem;
    margin-bottom: 2rem;
  }

  /* Header */
  .qp-header { margin-bottom: 1.25rem; }
  .qp-title {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 1.1rem;
    font-weight: 700;
    color: var(--cp-text-primary, #0f172a);
    margin: 0 0 0.35rem;
  }
  .qp-subtitle {
    font-size: 0.875rem;
    color: var(--cp-text-muted, #475569);
    margin: 0;
  }


  /* Accepted banner */
  .qp-accepted-badge {
    display: flex;
    align-items: flex-start;
    gap: 1rem;
    margin-bottom: 1.25rem;
  }
  .qp-accepted-icon { font-size: 2rem; }
  .qp-accepted-title {
    font-size: 1.1rem;
    font-weight: 700;
    color: #047857;
    margin: 0 0 0.25rem;
  }
  .qp-accepted-sub {
    font-size: 0.875rem;
    color: var(--cp-text-muted, #475569);
    margin: 0;
  }

  /* Quote card */
  .qp-card {
    background: #ffffff;
    border: 1px solid rgba(2, 181, 187, 0.16);
    border-radius: 14px;
    padding: 1.25rem 1.5rem;
    margin-bottom: 1rem;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  }

  .qp-card--accepted {
    border-color: rgba(16, 185, 129, 0.3);
    background: rgba(16, 185, 129, 0.07);
  }
  .qp-card__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.75rem;
    flex-wrap: wrap;
    gap: 0.5rem;
  }
  .qp-provider {
    font-size: 1rem;
    font-weight: 700;
    color: var(--cp-text-primary, #0f172a);
  }

  /* Amount */
  .qp-amount {
    font-size: 2rem;
    font-weight: 800;
    color: #0a7e82;
    margin-bottom: 1rem;
    letter-spacing: -0.02em;
  }


  /* Meta grid */
  .qp-meta-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: 0.75rem;
    margin-bottom: 1rem;
  }
  .qp-meta-item {
    display: flex;
    flex-direction: column;
    gap: 2px;
    font-size: 0.85rem;
    color: var(--cp-text-primary, #0f172a);
  }
  .qp-meta-label {
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    font-weight: 700;
    color: var(--cp-text-subtle, #64748b);
  }

  /* Notes */
  .qp-notes {
    font-size: 0.85rem;
    color: var(--cp-text-muted, #475569);
    font-style: italic;
    margin: 0 0 1rem;
    padding: 0.75rem;
    background: rgba(2, 181, 187, 0.05);
    border-radius: 8px;
    border-left: 3px solid rgba(2, 181, 187, 0.35);
  }


  /* Status pills */
  .qp-status {
    font-size: 0.72rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    padding: 3px 10px;
    border-radius: 999px;
  }
  .qp-status--received {
    background: rgba(2, 181, 187, 0.12);
    color: #0a7e82;
    border: 1px solid rgba(2, 181, 187, 0.3);
  }
  .qp-status--accepted {
    background: rgba(16, 185, 129, 0.14);
    color: #047857;
    border: 1px solid rgba(16, 185, 129, 0.35);
  }


  /* Buttons */
  .qp-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.4rem;
    padding: 0.7rem 1.5rem;
    border-radius: 10px;
    font-size: 0.9rem;
    font-weight: 700;
    cursor: pointer;
    border: none;
    transition: opacity 0.15s, transform 0.12s;
    text-decoration: none;
  }
  .qp-btn--accept {
    background: linear-gradient(135deg, #02b5bb 0%, #0a7e82 100%);
    color: #ffffff;
    margin-top: 0.75rem;
    width: 100%;
    font-size: 1rem;
    padding: 0.85rem 1.5rem;
    box-shadow: 0 4px 16px rgba(2, 181, 187, 0.28);
  }
  .qp-btn--accept:hover:not(:disabled) {
    opacity: 0.95;
    transform: translateY(-1px);
    box-shadow: 0 6px 24px rgba(2, 181, 187, 0.4);
  }
  .qp-btn--accept:disabled,
  .qp-btn--disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
  }
  .qp-btn--ghost {
    background: transparent;
    color: var(--cp-text-muted, #475569);
    border: 1px solid rgba(2, 181, 187, 0.3);
  }
  .qp-btn--ghost:hover { background: rgba(2, 181, 187, 0.08); }

  /* Staff notice */
  .qp-staff-notice {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.8rem;
    color: #b45309;
    background: rgba(245, 158, 11, 0.12);
    border: 1px solid rgba(245, 158, 11, 0.3);
    border-radius: 8px;
    padding: 0.6rem 0.9rem;
    margin-top: 0.75rem;
    margin-bottom: 0.5rem;
  }

  /* Loading / error */
  .qp-loading {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    color: var(--cp-text-muted, #475569);
    font-size: 0.875rem;
    padding: 1rem 0;
  }
  .qp-spinner {
    width: 18px; height: 18px;
    border: 2px solid rgba(2, 181, 187, 0.18);
    border-top-color: #02b5bb;
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
    flex-shrink: 0;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
  .qp-error {
    font-size: 0.875rem;
    color: #b91c1c;
    background: rgba(239, 68, 68, 0.08);
    border: 1px solid rgba(239, 68, 68, 0.3);
    border-radius: 8px;
    padding: 0.75rem 1rem;
    margin-bottom: 0.75rem;
  }

</style>
