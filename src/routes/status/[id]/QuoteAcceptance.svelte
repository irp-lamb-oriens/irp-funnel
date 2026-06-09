<script lang="ts">
  /**
   * QuoteAcceptance.svelte
   *
   * The dedicated "Accept" tab body.
   *
   * Responsibilities:
   *  1. Shows a summary of the quote the client is about to accept.
   *  2. Has a full-name text box (pre-filled from the saved project name).
   *  3. Has a consent checkbox.
   *  4. "Accept & Proceed" is gated: disabled until the checkbox is checked
   *     AND the name box is non-empty.
   *  5. Soft name-match: if the typed full name contains neither the saved
   *     first name nor the surname, a non-blocking warning is shown.
   *  6. After acceptance: renders a durable confirmation receipt (persists
   *     across reloads via $project.quoteAcceptance returned by safeSummary).
   *  7. Multiple received quotes: shows a selector so the client picks one.
   *
   * Props
   *   projectId   — Firestore doc ID
   *   isStaff     — disables the Accept CTA (staff-bypass guard; mirrors backend 403)
   *   onViewQuote — callback to switch to the Quote tab (for the "View quote" link)
   */
  import { onMount } from 'svelte';
  import {
    quotes, quotesLoading, acceptingQuote, acceptError,
    acceptQuote, loadQuotes, project,
    type ClientQuote,
  } from './store.ts';

  export let projectId: string;
  export let isStaff: boolean = false;
  /** Callback that switches the portal to the "Quote" (read-only) tab. */
  export let onViewQuote: (() => void) | null = null;

  onMount(() => {
    loadQuotes(projectId);
  });

  // ── Derived quote state ──────────────────────────────────────────────────
  $: receivedQuotes = $quotes.filter((q: ClientQuote) => q.status === 'received');
  $: acceptedQuotes = $quotes.filter((q: ClientQuote) => q.status === 'accepted');

  // "Already accepted" is true when EITHER the quotes list contains an
  // accepted entry OR the server returned quoteAcceptance metadata on the
  // project (which happens after reload once the stage has moved).
  $: isAlreadyAccepted = acceptedQuotes.length > 0 || !!$project?.quoteAcceptance;
  $: receipt = $project?.quoteAcceptance ?? null;

  // If there is exactly one received quote, auto-select it.
  let selectedQuoteId: string | null = null;
  $: {
    if (receivedQuotes.length === 1) {
      selectedQuoteId = (receivedQuotes[0].quoteId ?? receivedQuotes[0].id) ?? null;
    }
  }
  $: targetQuote = selectedQuoteId
    ? ($quotes.find((q: ClientQuote) => (q.quoteId ?? q.id) === selectedQuoteId) ?? null)
    : (receivedQuotes[0] ?? null);

  // ── Form state ───────────────────────────────────────────────────────────
  let fullName = '';
  let consent = false;
  let localSuccess = false;

  // Pre-fill from the consultation name; only sets once (doesn't overwrite
  // what the user typed).
  let _prefilled = false;
  $: if ($project && !_prefilled) {
    const saved = [$project.name, $project.surname].filter(Boolean).join(' ').trim();
    if (saved) { fullName = saved; _prefilled = true; }
  }

  // Soft name-match: non-blocking warning if neither token matches.
  $: nameMismatch = (() => {
    if (!fullName.trim()) return false;
    const lower = fullName.toLowerCase();
    const first = ($project?.name ?? '').toLowerCase().trim();
    const last  = ($project?.surname ?? '').toLowerCase().trim();
    return !(
      (first && lower.includes(first)) ||
      (last  && lower.includes(last))
    );
  })();

  // Button gate: both fields required.
  $: isReady = consent && fullName.trim().length > 0 && !!targetQuote && !isStaff;

  // ── Submit ───────────────────────────────────────────────────────────────
  async function handleAccept() {
    if (!isReady || !targetQuote) return;
    acceptError.set('');
    const result = await acceptQuote(projectId, {
      quoteId:  targetQuote.quoteId ?? targetQuote.id ?? undefined,
      fullName: fullName.trim(),
      consent:  true,
    });
    if (result.success) localSuccess = true;
  }

  // ── Helpers ──────────────────────────────────────────────────────────────
  function fmt(amount: number | null, currency: string): string {
    if (amount === null || amount === undefined) return '—';
    return new Intl.NumberFormat('en-US', {
      style: 'currency', currency: currency || 'USD',
      minimumFractionDigits: 0, maximumFractionDigits: 0,
    }).format(amount);
  }

  function fmtDate(iso: string | null | undefined): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'long', day: 'numeric', year: 'numeric',
    });
  }
</script>

<!-- ══════════════════════════════════════════════════════════════════════════
     ALREADY ACCEPTED — persistent receipt
     (shown whenever quoteAcceptance is on the project or quotes list)
══════════════════════════════════════════════════════════════════════════ -->
{#if isAlreadyAccepted || localSuccess}
  <div class="qa-receipt">
    <div class="qa-receipt__icon">✅</div>
    <h2 class="qa-receipt__title">Quote Accepted</h2>
    <p class="qa-receipt__sub">
      Your IRP advisor will be in touch shortly to confirm next steps and
      coordinate your relocation.
    </p>

    {#if receipt}
      <div class="qa-receipt__details">
        {#if receipt.amount}
          <div class="qa-receipt__amount">
            {fmt(receipt.amount, receipt.currency ?? 'USD')}
          </div>
        {/if}
        <dl class="qa-receipt__dl">
          {#if receipt.providerName}
            <div class="qa-receipt__row">
              <dt>Provider</dt><dd>{receipt.providerName}</dd>
            </div>
          {/if}
          <div class="qa-receipt__row">
            <dt>Accepted by</dt><dd>{receipt.acceptedBy}</dd>
          </div>
          {#if receipt.typedFullName}
            <div class="qa-receipt__row">
              <dt>Name on record</dt><dd>{receipt.typedFullName}</dd>
            </div>
          {/if}
          <div class="qa-receipt__row">
            <dt>Accepted on</dt><dd>{fmtDate(receipt.acceptedAt)}</dd>
          </div>
          {#if receipt.quoteId}
            <div class="qa-receipt__row">
              <dt>Reference</dt><dd class="qa-receipt__ref">{receipt.quoteId}</dd>
            </div>
          {/if}
        </dl>
      </div>
    {:else if acceptedQuotes.length > 0}
      <!-- Fallback when quoteAcceptance not yet on project (timing gap) -->
      {#each acceptedQuotes as q (q.quoteId ?? q.id)}
        <div class="qa-receipt__details">
          {#if q.amount}
            <div class="qa-receipt__amount">{fmt(q.amount, q.currency)}</div>
          {/if}
          <dl class="qa-receipt__dl">
            <div class="qa-receipt__row"><dt>Provider</dt><dd>{q.providerName}</dd></div>
          </dl>
        </div>
      {/each}
    {/if}
  </div>

<!-- ══════════════════════════════════════════════════════════════════════════
     LOADING STATE
══════════════════════════════════════════════════════════════════════════ -->
{:else if $quotesLoading}
  <div class="qa-loading">
    <div class="qa-spinner"></div>
    <span>Loading your quote…</span>
  </div>

<!-- ══════════════════════════════════════════════════════════════════════════
     NO QUOTE YET — waiting state
══════════════════════════════════════════════════════════════════════════ -->
{:else if receivedQuotes.length === 0}
  <div class="qa-empty">
    <span class="qa-empty__icon">🕐</span>
    <h3 class="qa-empty__title">Quote not ready yet</h3>
    <p class="qa-empty__sub">
      Your IRP advisor is preparing your personalized quote.
      You'll be notified by email when it's ready to review and accept.
    </p>
  </div>

<!-- ══════════════════════════════════════════════════════════════════════════
     ACCEPTANCE FORM
══════════════════════════════════════════════════════════════════════════ -->
{:else}
  <div class="qa-form-wrap">

    <!-- Quote summary card -->
    {#if targetQuote}
      <div class="qa-summary">
        <div class="qa-summary__header">
          <span class="qa-summary__label">Quote to Accept</span>
          {#if onViewQuote}
            <button class="qa-summary__link" on:click={onViewQuote}>View full details →</button>
          {/if}
        </div>
        <div class="qa-summary__amount">
          {fmt(targetQuote.amount, targetQuote.currency)}
        </div>
        {#if targetQuote.providerName}
          <div class="qa-summary__provider">{targetQuote.providerName}</div>
        {/if}
        {#if targetQuote.validUntil}
          <div class="qa-summary__valid">Valid until {fmtDate(targetQuote.validUntil)}</div>
        {/if}
      </div>
    {/if}

    <!-- Multi-quote selector (shown only when >1 received quote) -->
    {#if receivedQuotes.length > 1}
      <div class="qa-field">
        <label class="qa-label" for="qa-quote-sel">Select quote to accept</label>
        <select
          id="qa-quote-sel"
          class="qa-select"
          bind:value={selectedQuoteId}
        >
          {#each receivedQuotes as q (q.quoteId ?? q.id)}
            <option value={q.quoteId ?? q.id}>
              {q.providerName} — {fmt(q.amount, q.currency)}
            </option>
          {/each}
        </select>
      </div>
    {/if}

    <!-- FORM CARD -->
    <div class="qa-card">
      <h3 class="qa-card__title">Sign to Accept</h3>
      <p class="qa-card__intro">
        Type your full name below and check the box to indicate your consent.
        This is legally attributed to <strong>{$project?.email ?? 'your email'}</strong>.
      </p>

      <!-- Full name -->
      <div class="qa-field">
        <label class="qa-label" for="qa-fullname">Full Name</label>
        <input
          id="qa-fullname"
          type="text"
          class="qa-input"
          class:qa-input--warn={nameMismatch && fullName.trim().length > 0}
          placeholder="Type your full name exactly as it appears on your ID"
          bind:value={fullName}
          disabled={$acceptingQuote}
          autocomplete="name"
          spellcheck="false"
        />
        {#if nameMismatch && fullName.trim().length > 0}
          <p class="qa-hint qa-hint--warn">
            ⚠️ The name you typed doesn't match the name on file
            ({[$project?.name, $project?.surname].filter(Boolean).join(' ')}).
            You can still proceed — the typed name and your verified email will
            both be recorded.
          </p>
        {:else if fullName.trim().length > 0}
          <p class="qa-hint qa-hint--ok">✓ Name matches your on-file record.</p>
        {/if}
      </div>

      <!-- Consent checkbox -->
      <label class="qa-consent" class:qa-consent--checked={consent}>
        <input
          type="checkbox"
          class="qa-checkbox"
          bind:checked={consent}
          disabled={$acceptingQuote}
        />
        <span class="qa-consent__text">
          I confirm that by proceeding I am accepting this quote and
          authorizing <strong>International Relocation Partners</strong> to
          charge me the amount shown (
          <strong>{targetQuote ? fmt(targetQuote.amount, targetQuote.currency) : '—'}</strong>
          ). I understand this is a binding commitment.
        </span>
      </label>

      <!-- Staff notice -->
      {#if isStaff}
        <div class="qa-staff-notice">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          Only the client can sign and accept their own quote.
          This button is disabled for staff.
        </div>
      {/if}

      <!-- Error -->
      {#if $acceptError}
        <div class="qa-error">{$acceptError}</div>
      {/if}

      <!-- CTA -->
      <button
        class="qa-btn"
        class:qa-btn--ready={isReady}
        on:click={handleAccept}
        disabled={!isReady || $acceptingQuote}
        aria-disabled={!isReady || $acceptingQuote}
      >
        {#if $acceptingQuote}
          <span class="qa-spinner-inline"></span> Processing…
        {:else}
          ✅ Accept & Proceed
        {/if}
      </button>

      <p class="qa-legal">
        By accepting you confirm you have read and agree to IRP's
        <a href="https://internationalrelocationpartner.com/terms" target="_blank" rel="noopener">
          Terms of Service
        </a>.
        Your acceptance is tied to <strong>{$project?.email ?? 'your verified email'}</strong>
        and is recorded with a timestamp and audit trail.
      </p>
    </div>
  </div>
{/if}

<style>
  /* ── Receipt ─────────────────────────────────────────────────────────── */
  .qa-receipt {
    background: rgba(16, 185, 129, 0.06);
    border: 1px solid rgba(16, 185, 129, 0.3);
    border-radius: 16px;
    padding: 2rem;
    text-align: center;
  }
  .qa-receipt__icon { font-size: 3rem; margin-bottom: 0.75rem; display: block; }
  .qa-receipt__title {
    font-size: 1.5rem;
    font-family: var(--font-subtitle);
    font-weight: 700;
    color: #6ee7b7;
    margin: 0 0 0.5rem;
  }
  .qa-receipt__sub {
    font-size: 0.9rem;
    color: var(--cp-text-muted, #94a3b8);
    margin: 0 0 1.5rem;
    line-height: 1.6;
  }
  .qa-receipt__details {
    background: rgba(15, 23, 42, 0.5);
    border: 1px solid rgba(16, 185, 129, 0.2);
    border-radius: 12px;
    padding: 1.25rem 1.5rem;
    text-align: left;
    display: inline-block;
    min-width: 280px;
    max-width: 420px;
    width: 100%;
  }
  .qa-receipt__amount {
    font-size: 2rem;
    font-weight: 800;
    color: #6ee7b7;
    margin-bottom: 1rem;
    letter-spacing: -0.02em;
  }
  .qa-receipt__dl { display: flex; flex-direction: column; gap: 0.5rem; }
  .qa-receipt__row { display: flex; gap: 1rem; align-items: baseline; flex-wrap: wrap; }
  .qa-receipt__row dt {
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    font-weight: 700;
    color: var(--cp-text-subtle, #64748b);
    flex-shrink: 0;
    min-width: 110px;
  }
  .qa-receipt__row dd {
    font-size: 0.9rem;
    color: var(--cp-text-primary, #f1f5f9);
    font-weight: 500;
    margin: 0;
    word-break: break-all;
  }
  .qa-receipt__ref {
    font-family: monospace;
    font-size: 0.82rem;
    opacity: 0.7;
  }

  /* ── Loading ─────────────────────────────────────────────────────────── */
  .qa-loading {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    color: var(--cp-text-muted, #94a3b8);
    font-size: 0.875rem;
    padding: 1.5rem 0;
  }

  /* ── Empty ───────────────────────────────────────────────────────────── */
  .qa-empty {
    background: rgba(15, 23, 42, 0.5);
    border: 1px solid rgba(148, 163, 184, 0.12);
    border-radius: 16px;
    padding: 2.5rem;
    text-align: center;
  }
  .qa-empty__icon { font-size: 2.5rem; display: block; margin-bottom: 0.75rem; }
  .qa-empty__title {
    font-size: 1.1rem;
    font-weight: 700;
    color: var(--cp-text-primary, #f1f5f9);
    margin: 0 0 0.5rem;
  }
  .qa-empty__sub {
    font-size: 0.875rem;
    color: var(--cp-text-muted, #94a3b8);
    margin: 0;
    line-height: 1.6;
  }

  /* ── Form wrapper ────────────────────────────────────────────────────── */
  .qa-form-wrap {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  /* ── Quote summary ───────────────────────────────────────────────────── */
  .qa-summary {
    background: rgba(15, 23, 42, 0.55);
    border: 1px solid rgba(148, 163, 184, 0.12);
    border-radius: 14px;
    padding: 1.25rem 1.5rem;
  }
  .qa-summary__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.5rem;
  }
  .qa-summary__label {
    font-size: 0.72rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: var(--cp-text-subtle, #64748b);
  }
  .qa-summary__link {
    background: none;
    border: none;
    color: var(--color-highlight-2, #02b5bb);
    font-size: 0.82rem;
    font-weight: 600;
    cursor: pointer;
    padding: 0;
    text-decoration: underline;
    text-underline-offset: 2px;
  }
  .qa-summary__amount {
    font-size: 2.25rem;
    font-weight: 800;
    color: var(--color-highlight-2, #02b5bb);
    letter-spacing: -0.02em;
    margin-bottom: 0.25rem;
  }
  .qa-summary__provider {
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--cp-text-primary, #f1f5f9);
    margin-bottom: 0.2rem;
  }
  .qa-summary__valid {
    font-size: 0.8rem;
    color: var(--cp-text-muted, #94a3b8);
  }

  /* ── Form card ───────────────────────────────────────────────────────── */
  .qa-card {
    background: rgba(15, 23, 42, 0.6);
    border: 1px solid rgba(148, 163, 184, 0.12);
    border-radius: 16px;
    padding: 1.75rem 2rem;
  }
  .qa-card__title {
    font-size: 1.1rem;
    font-family: var(--font-subtitle);
    font-weight: 700;
    color: var(--cp-text-primary, #f1f5f9);
    margin: 0 0 0.4rem;
  }
  .qa-card__intro {
    font-size: 0.875rem;
    color: var(--cp-text-muted, #94a3b8);
    margin: 0 0 1.5rem;
    line-height: 1.6;
  }
  .qa-card__intro strong { color: var(--cp-text-primary, #f1f5f9); }

  /* ── Field ───────────────────────────────────────────────────────────── */
  .qa-field { display: flex; flex-direction: column; gap: 0.4rem; margin-bottom: 1.25rem; }
  .qa-label {
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--cp-text-subtle, #64748b);
  }
  .qa-input {
    padding: 0.85rem 1rem;
    background: rgba(15, 23, 42, 0.7);
    border: 1px solid rgba(148, 163, 184, 0.2);
    border-radius: 10px;
    color: var(--cp-text-primary, #f1f5f9);
    font-size: 1rem;
    font-family: var(--font-paragraph);
    outline: none;
    transition: border-color 0.15s, box-shadow 0.15s;
    width: 100%;
    box-sizing: border-box;
  }
  .qa-input:focus {
    border-color: var(--color-highlight-2, #02b5bb);
    box-shadow: 0 0 0 3px rgba(2, 181, 187, 0.12);
  }
  .qa-input--warn {
    border-color: rgba(245, 158, 11, 0.5);
    box-shadow: 0 0 0 2px rgba(245, 158, 11, 0.1);
  }
  .qa-input::placeholder { color: var(--cp-text-subtle, #64748b); }
  .qa-input:disabled { opacity: 0.6; cursor: not-allowed; }

  .qa-select {
    padding: 0.7rem 1rem;
    background: rgba(15, 23, 42, 0.7);
    border: 1px solid rgba(148, 163, 184, 0.2);
    border-radius: 10px;
    color: var(--cp-text-primary, #f1f5f9);
    font-size: 0.9rem;
    font-family: var(--font-paragraph);
    outline: none;
    cursor: pointer;
    width: 100%;
    transition: border-color 0.15s;
  }
  .qa-select:focus { border-color: var(--color-highlight-2, #02b5bb); }

  /* Hint lines */
  .qa-hint {
    font-size: 0.8rem;
    margin: 0;
    line-height: 1.5;
  }
  .qa-hint--warn { color: #f59e0b; }
  .qa-hint--ok   { color: #34d399; }

  /* ── Consent checkbox ────────────────────────────────────────────────── */
  .qa-consent {
    display: flex;
    gap: 0.75rem;
    align-items: flex-start;
    cursor: pointer;
    padding: 1rem 1.25rem;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(148, 163, 184, 0.1);
    border-radius: 10px;
    margin-bottom: 1.25rem;
    transition: border-color 0.15s, background 0.15s;
    user-select: none;
  }
  .qa-consent--checked {
    background: rgba(2, 181, 187, 0.06);
    border-color: rgba(2, 181, 187, 0.3);
  }
  .qa-checkbox {
    width: 18px;
    height: 18px;
    flex-shrink: 0;
    margin-top: 2px;
    accent-color: var(--color-highlight-2, #02b5bb);
    cursor: pointer;
  }
  .qa-consent__text {
    font-size: 0.875rem;
    color: var(--cp-text-muted, #94a3b8);
    line-height: 1.6;
  }
  .qa-consent__text strong { color: var(--cp-text-primary, #f1f5f9); }

  /* ── Staff notice ────────────────────────────────────────────────────── */
  .qa-staff-notice {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.8rem;
    color: #f59e0b;
    background: rgba(245, 158, 11, 0.08);
    border: 1px solid rgba(245, 158, 11, 0.2);
    border-radius: 8px;
    padding: 0.6rem 0.9rem;
    margin-bottom: 0.75rem;
  }

  /* ── Error ───────────────────────────────────────────────────────────── */
  .qa-error {
    font-size: 0.875rem;
    color: #f87171;
    background: rgba(239, 68, 68, 0.08);
    border: 1px solid rgba(239, 68, 68, 0.2);
    border-radius: 8px;
    padding: 0.75rem 1rem;
    margin-bottom: 0.75rem;
  }

  /* ── CTA Button ──────────────────────────────────────────────────────── */
  .qa-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    width: 100%;
    padding: 1rem 1.5rem;
    border: none;
    border-radius: 12px;
    font-size: 1rem;
    font-weight: 800;
    font-family: var(--font-paragraph);
    cursor: pointer;
    transition: opacity 0.15s, transform 0.12s, box-shadow 0.15s;
    /* Default disabled appearance */
    background: rgba(148, 163, 184, 0.12);
    color: rgba(148, 163, 184, 0.45);
    box-shadow: none;
    pointer-events: all;
    margin-bottom: 1rem;
  }
  .qa-btn[disabled] {
    opacity: 1; /* opacity handled by color above */
    cursor: not-allowed;
    transform: none !important;
  }
  /* Ready / enabled state */
  .qa-btn--ready {
    background: linear-gradient(135deg, var(--color-highlight-2, #02b5bb) 0%, #0284c7 100%);
    color: #fff;
    box-shadow: 0 4px 20px rgba(2, 181, 187, 0.3);
  }
  .qa-btn--ready:not([disabled]):hover {
    opacity: 0.92;
    transform: translateY(-2px);
    box-shadow: 0 6px 28px rgba(2, 181, 187, 0.4);
  }

  /* ── Inline spinner ──────────────────────────────────────────────────── */
  .qa-spinner,
  .qa-spinner-inline {
    border: 2px solid rgba(255,255,255,0.15);
    border-top-color: var(--color-highlight-2, #02b5bb);
    border-radius: 50%;
    animation: qapin 0.7s linear infinite;
    flex-shrink: 0;
  }
  .qa-spinner { width: 18px; height: 18px; }
  .qa-spinner-inline { width: 16px; height: 16px; display: inline-block; vertical-align: middle; }
  @keyframes qapin { to { transform: rotate(360deg); } }

  /* ── Legal footnote ──────────────────────────────────────────────────── */
  .qa-legal {
    font-size: 0.78rem;
    color: var(--cp-text-subtle, #64748b);
    line-height: 1.6;
    margin: 0;
  }
  .qa-legal a { color: var(--color-highlight-2, #02b5bb); }
  .qa-legal strong { color: var(--cp-text-muted, #94a3b8); }
</style>
