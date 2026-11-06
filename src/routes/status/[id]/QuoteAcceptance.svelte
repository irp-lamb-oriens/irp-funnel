<script lang="ts">
  /**
   * QuoteAcceptance.svelte
   *
   * The dedicated "Accept" tab body.
   *
   * Responsibilities:
   * 1. Shows a summary of the quote the client is about to accept.
   * 2. Has a full-name text box (pre-filled from the saved project name).
   * 3. Has a consent checkbox.
   * 4. "Accept & Proceed" is gated: disabled until the checkbox is checked
   * AND the name box is non-empty.
   * 5. Soft name-match: if the typed full name contains neither the saved
   * first name nor the surname, a non-blocking warning is shown.
   * 6. After acceptance: renders a durable confirmation receipt (persists
   * across reloads via $project.quoteAcceptance returned by safeSummary).
   * 7. Multiple received quotes: shows a selector so the client picks one.
   *
   * Props
   * projectId   — Firestore doc ID
   * isStaff     — disables the Accept CTA (staff-bypass guard; mirrors backend 403)
   * onViewQuote — callback to switch to the Quote tab (for the "View quote" link)
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
    } else if (receivedQuotes.length > 1 && !selectedQuoteId) {
      // With several quotes the summary already falls back to the first one;
      // select it too so the dropdown shows what the summary shows instead of
      // a blank control. targetQuote is unchanged by this.
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
 
 <div class="qa-container">
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
 
 {:else if $quotesLoading}
  <div class="qa-loading">
    <div class="qa-spinner"></div>
    <span>Loading your quote…</span>
  </div>
 
 {:else if receivedQuotes.length === 0}
  <div class="qa-empty">
    <span class="qa-empty__icon">🕐</span>
    <h3 class="qa-empty__title">Quote not ready yet</h3>
    <p class="qa-empty__sub">
      Your IRP advisor is preparing your personalized quote.
      You'll be notified by email when it's ready to review and accept.
    </p>
  </div>
 
 {:else}
  <div class="qa-form-wrap">
 
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
 
    <div class="qa-card">
      <h3 class="qa-card__title">Sign to Accept</h3>
      <p class="qa-card__intro">
        Type your full name below and check the box to indicate your consent.
        This is legally attributed to <strong>{$project?.email ?? 'your email'}</strong>.
      </p>
 
      <details class="qa-terms" open>
        <summary class="qa-terms__summary">
          <span class="qa-terms__summary-label">📜 Quote Acceptance Terms</span>
          <span class="qa-terms__summary-hint">Please read before accepting</span>
        </summary>
        <div class="qa-terms__body">
          <ul class="qa-terms__list">
            <li>
              The amount shown
              <strong>{targetQuote ? fmt(targetQuote.amount, targetQuote.currency) : ''}</strong>
              is based on the move details you provided. Final destination charges
              (customs duties, taxes, and confirmed shipment volume) may adjust the
              total — any change is communicated and itemized before it applies.
            </li>
            <li>
              By accepting, you authorize <strong>International Relocation Partners</strong>
              to begin coordinating your relocation and to process the agreed payment(s)
              for the services you selected.
            </li>
            <li>
              Your acceptance is tied to your verified email
              (<strong>{$project?.email ?? 'your email'}</strong>) and is recorded with a
              timestamp and audit trail as your electronic signature.
            </li>
            <li>
              Services not selected (optional items left unchecked) are not included and
              not billed. You can ask us to add them later.
            </li>
            <li>
              Cancellations and refunds follow IRP's standard relocation policy. Reach out
              any time via this portal or to your advisor with questions before accepting.
            </li>
          </ul>
          <p class="qa-terms__full">
            Full legal text:
            <a href="/legal/quote-acceptance" target="_blank" rel="noopener noreferrer">Quote Acceptance Terms</a>
            ·
            <a href="https://internationalrelocationpartner.com/terms" target="_blank" rel="noopener noreferrer">Terms of Service</a>
          </p>
        </div>
      </details>
 
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
          ). I understand this is a binding commitment, governed by the
          <a href="/legal/quote-acceptance" target="_blank" rel="noopener noreferrer" class="qa-consent__link">Quote Acceptance Terms</a>.
        </span>
 
 
      </label>
 
      {#if isStaff}
        <div class="qa-staff-notice">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          Only the client can sign and accept their own quote.
          This button is disabled for staff.
        </div>
      {/if}
 
      {#if $acceptError}
        <div class="qa-error">{$acceptError}</div>
      {/if}
 
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
 </div>
 
 <style>
  /*
   * QuoteAcceptance — Ultra Modern White-Based Styles
   * No more dark based comps.
   */
 
  .qa-container {
    /* New Light Mode Tokens — Defining locally for override */
    --_qa-bg: #ffffff;
    --_qa-surface: #f8fafc;
    --_qa-surface-recessed: #f1f5f9;
    --_qa-border: #e2e8f0;
    --_qa-text-primary: #111827;
    --_qa-text-muted: #4b5563;
    --_qa-text-subtle: #94a3b8;
    --_qa-accent: #02b5bb;
    --_qa-accent-rgb: 2, 181, 187;
    --_qa-success: #10b981; /* High contrast light green */
    --_qa-warning: #d97706; /* High contrast light orange */
    --_qa-error: #dc2626;   /* High contrast light red */
 
    /* Consume standard fonts */
    --font-paragraph: "Jost", sans-serif;
    --font-subtitle: "Spartan Black", serif;
 
    color: var(--_qa-text-primary);
    font-family: var(--font-paragraph);
    line-height: 1.5;
    background-color: var(--_qa-bg);
    padding: 1rem;
    border-radius: 12px;
  }
 
  /* ══ RECEIPT — success palette ═════════════════════════════════════════ */
  .qa-receipt {
    position: relative;
    overflow: hidden;
    background: var(--_qa-bg);
    border: 1px solid var(--_qa-success);
    border-radius: 20px;
    padding: 2.5rem 2rem 2rem;
    text-align: center;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.05);
  }
  /* Minimal top accent bar */
  .qa-receipt::before {
    content: '';
    position: absolute;
    top: 0; left: 10%; right: 10%;
    height: 2px;
    background: var(--_qa-success);
  }
  .qa-receipt__icon {
    font-size: 3.5rem;
    margin-bottom: 0.75rem;
    display: block;
    animation: qa-pop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) both;
  }
  @keyframes qa-pop {
    from { transform: scale(0.5) rotate(-8deg); opacity: 0; }
    to   { transform: scale(1) rotate(0deg); opacity: 1; }
  }
  .qa-receipt__title {
    font-size: 1.75rem;
    font-family: var(--font-title);
    font-weight: 800;
    color: var(--_qa-success);
    margin: 0 0 0.5rem;
    letter-spacing: -0.02em;
  }
  .qa-receipt__sub {
    font-size: 0.95rem;
    color: var(--_qa-text-muted);
    margin: 0 auto 1.75rem;
    line-height: 1.65;
    max-width: 380px;
  }
  .qa-receipt__details {
    background: var(--_qa-surface);
    border: 1px solid var(--_qa-border);
    border-radius: 14px;
    padding: 1.5rem 1.75rem;
    text-align: left;
    display: inline-block;
    min-width: 280px;
    max-width: 440px;
    width: 100%;
  }
  .qa-receipt__amount {
    font-size: 2.5rem;
    font-weight: 900;
    letter-spacing: -0.04em;
    color: var(--_qa-text-primary);
    margin-bottom: 1.25rem;
    line-height: 1;
  }
  .qa-receipt__dl { display: flex; flex-direction: column; gap: 0.6rem; margin: 0; }
  .qa-receipt__row {
    display: flex;
    gap: 0.75rem;
    align-items: baseline;
    flex-wrap: wrap;
    padding-bottom: 0.6rem;
    border-bottom: 1px solid var(--_qa-border);
  }
  .qa-receipt__row:last-child { border-bottom: none; padding-bottom: 0; }
  .qa-receipt__row dt {
    font-size: 0.68rem;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    font-weight: 700;
    color: var(--_qa-text-subtle);
    flex-shrink: 0;
    min-width: 120px;
  }
  .qa-receipt__row dd {
    font-size: 0.95rem;
    color: var(--_qa-text-primary);
    font-weight: 500;
    margin: 0;
    word-break: break-all;
  }
  .qa-receipt__ref {
    font-family: 'SF Mono', 'Fira Code', monospace;
    font-size: 0.8rem;
    color: var(--_qa-accent);
    opacity: 0.8;
    letter-spacing: 0.04em;
  }
 
  /* ══ LOADING ══════════════════════════════════════════════════════════ */
  .qa-loading {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.85rem;
    color: var(--_qa-text-muted);
    font-size: 0.9rem;
    padding: 2rem 0;
  }
 
  /* ══ EMPTY ════════════════════════════════════════════════════════════ */
  .qa-empty {
    background: var(--_qa-surface);
    border: 1px solid var(--_qa-border);
    border-radius: 20px;
    padding: 3rem 2rem;
    text-align: center;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.03);
  }
  .qa-empty__icon {
    font-size: 3rem;
    display: block;
    margin-bottom: 1rem;
    filter: grayscale(1);
    opacity: 0.6;
  }
  .qa-empty__title {
    font-size: 1.15rem;
    font-weight: 800;
    color: var(--_qa-text-primary);
    margin: 0 0 0.6rem;
    letter-spacing: -0.01em;
  }
  .qa-empty__sub {
    font-size: 0.9rem;
    color: var(--_qa-text-muted);
    margin: 0 auto;
    max-width: 360px;
    line-height: 1.65;
  }
 
  /* ══ FORM WRAPPER ═════════════════════════════════════════════════════ */
  .qa-form-wrap {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }
 
  /* ══ QUOTE SUMMARY BAR ════════════════════════════════════════════════ */
  .qa-summary {
    position: relative;
    overflow: hidden;
    background: var(--_qa-bg);
    border: 1px solid var(--_qa-accent);
    border-radius: 14px;
    padding: 1.4rem 1.6rem;
    box-shadow: 0 10px 30px rgba(var(--_qa-accent-rgb), 0.05);
  }
  /* Sharp accent stripe */
  .qa-summary::before {
    content: '';
    position: absolute;
    top: 0; bottom: 0; left: 0;
    width: 4px;
    background: var(--_qa-accent);
  }
  .qa-summary__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.6rem;
  }
  .qa-summary__label {
    font-size: 0.7rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--_qa-accent);
    margin-left: 0.75rem;
  }
  .qa-summary__link {
    background: transparent;
    border: 1px solid var(--_qa-accent);
    color: var(--_qa-accent);
    font-size: 0.8rem;
    font-weight: 700;
    font-family: var(--font-paragraph);
    cursor: pointer;
    padding: 4px 12px;
    border-radius: 8px;
    transition: all 0.2s ease;
    line-height: 1;
  }
  .qa-summary__link:hover {
    background: rgba(var(--_qa-accent-rgb), 0.08);
    transform: translateX(2px);
  }
  .qa-summary__amount {
    font-size: 2.75rem;
    font-weight: 900;
    letter-spacing: -0.045em;
    line-height: 1;
    background: linear-gradient(135deg, #02b5bb 0%, #038d8d 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    margin: 0 0 0.3rem 0.75rem;
  }
  .qa-summary__provider {
    font-size: 0.95rem;
    font-weight: 600;
    color: var(--_qa-text-primary);
    margin: 0 0 0.15rem 0.75rem;
  }
  .qa-summary__valid {
    font-size: 0.8rem;
    color: var(--_qa-text-subtle);
    margin-left: 0.75rem;
    letter-spacing: 0.02em;
  }
 
  /* ══ FORM CARD ════════════════════════════════════════════════════════ */
  .qa-card {
    position: relative;
    overflow: hidden;
    background: var(--_qa-bg);
    border: 1px solid var(--_qa-border);
    border-radius: 20px;
    padding: 2.25rem 2.5rem 2rem;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.04);
  }
  .qa-card__title {
    font-size: 1.35rem;
    font-family: var(--font-title);
    font-weight: 800;
    color: var(--_qa-text-primary);
    margin: 0 0 0.45rem;
    letter-spacing: -0.02em;
  }
  .qa-card__intro {
    font-size: 0.95rem;
    color: var(--_qa-text-muted);
    margin: 0 0 1.75rem;
    line-height: 1.65;
  }
  .qa-card__intro strong {
    color: var(--_qa-text-primary);
    font-weight: 600;
  }
 
  /* ══ TERMS OF AGREEMENT ═══════════════════════════════════════════════ */
  .qa-terms {
    position: relative;
    overflow: hidden;
    background: var(--_qa-surface-recessed);
    border: 1px solid var(--_qa-border);
    border-radius: 16px;
    padding: 0.4rem 1.5rem 0.75rem 1.75rem;
    margin-bottom: 2rem;
  }
  /* Accent stripe, sharp, no glow */
  .qa-terms::before {
    content: '';
    position: absolute;
    top: 0; bottom: 0; left: 0;
    width: 4px;
    background: var(--_qa-accent);
  }
  .qa-terms__summary {
    display: flex;
    align-items: baseline;
    gap: 0.75rem;
    flex-wrap: wrap;
    cursor: pointer;
    list-style: none;
    padding: 1rem 0;
    user-select: none;
  }
  .qa-terms__summary::-webkit-details-marker { display: none; }
  .qa-terms__summary::after {
    content: '⌄';
    margin-left: auto;
    color: var(--_qa-accent);
    font-size: 1.2rem;
    line-height: 1;
  }
  .qa-terms[open] .qa-terms__summary::after { content: '⌄'; } /* Rotate handled by browser native or not needed for minimalism */
 
  .qa-terms__summary-label {
    font-size: 1.05rem;
    font-family: var(--font-title);
    font-weight: 800;
    color: var(--_qa-text-primary);
    letter-spacing: -0.01em;
  }
  .qa-terms__summary-hint {
    font-size: 0.7rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--_qa-accent);
  }
  .qa-terms__body {
    padding: 1rem 0 0.75rem;
    border-top: 1px solid var(--_qa-border);
  }
  .qa-terms__list {
    margin: 0;
    padding: 0;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 0.85rem;
  }
  .qa-terms__list li {
    position: relative;
    padding-left: 1.5rem;
    font-size: 0.9rem;
    color: var(--_qa-text-muted);
    line-height: 1.65;
  }
  /* Sharp teal bullet, no glow */
  .qa-terms__list li::before {
    content: '';
    position: absolute;
    left: 0.15rem;
    top: 0.65em;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--_qa-accent);
  }
  .qa-terms__list strong { color: var(--_qa-text-primary); font-weight: 700; }
  .qa-terms__full {
    margin: 1.25rem 0 0;
    font-size: 0.8rem;
    color: var(--_qa-text-subtle);
    line-height: 1.6;
  }
  .qa-terms__full a {
    color: var(--_qa-accent);
    font-weight: 700;
    text-decoration: none;
    border-bottom: 1px solid rgba(var(--_qa-accent-rgb), 0.4);
    transition: all 0.2s ease;
  }
  .qa-terms__full a:hover { border-bottom-color: var(--_qa-accent); }
 
  /* ══ FIELD ════════════════════════════════════════════════════════════ */
  .qa-field {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-bottom: 1.5rem;
  }
  .qa-label {
    font-size: 0.75rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--_qa-text-subtle);
    margin-left: 0.2rem;
  }
 
  /* Input & Select */
  .qa-input, .qa-select {
    padding: 1rem 1.25rem;
    background: var(--_qa-surface-recessed);
    border: 1px solid var(--_qa-border);
    border-radius: 12px;
    color: var(--_qa-text-primary);
    font-size: 1.05rem;
    font-family: var(--font-paragraph);
    font-weight: 500;
    outline: none;
    width: 100%;
    box-sizing: border-box;
    transition: all 0.2s ease;
    letter-spacing: 0.01em;
  }
  .qa-input:focus, .qa-select:focus {
    background: var(--_qa-bg);
    border-color: var(--_qa-accent);
    box-shadow: 0 0 0 4px rgba(var(--_qa-accent-rgb), 0.1);
  }
  .qa-input--warn {
    border-color: var(--_qa-warning);
    box-shadow: 0 0 0 3px rgba(217, 119, 6, 0.1);
  }
  .qa-input::placeholder {
    color: var(--_qa-text-subtle);
    font-weight: 400;
  }
  .qa-input:disabled, .qa-select:disabled { opacity: 0.5; cursor: not-allowed; }
 
  .qa-select {
    cursor: pointer;
    appearance: none; /* Modern minimalist selects require custom arrows, usually handled globally in portals */
    -webkit-appearance: none;
  }
 
  /* Hint lines */
  .qa-hint {
    font-size: 0.85rem;
    margin: 0.25rem 0 0;
    line-height: 1.55;
    padding: 0.6rem 0.85rem;
    border-radius: 8px;
    font-weight: 500;
  }
  .qa-hint--warn {
    color: var(--_qa-warning);
    background: rgba(217, 119, 6, 0.08);
    border-left: 3px solid var(--_qa-warning);
  }
  .qa-hint--ok {
    color: var(--_qa-success);
    background: rgba(16, 185, 129, 0.08);
    border-left: 3px solid var(--_qa-success);
  }
 
  /* ══ CONSENT BLOCK ════════════════════════════════════════════════════ */
  .qa-consent {
    position: relative;
    display: flex;
    gap: 1.25rem;
    align-items: flex-start;
    cursor: pointer;
    padding: 1.25rem 1.5rem;
    background: var(--_qa-surface);
    border: 1px solid var(--_qa-border);
    border-radius: 16px;
    margin-bottom: 2rem;
    transition: all 0.2s ease;
    user-select: none;
  }
  .qa-consent:hover {
    background: var(--_qa-surface-recessed);
  }
  .qa-consent--checked {
    background: #f1fcfe; /* Light accent background */
    border-color: var(--_qa-accent);
  }
  /* Glow left bar */
  .qa-consent--checked::before {
    content: '';
    position: absolute;
    top: 0; bottom: 0; left: 0;
    width: 4px;
    background: var(--_qa-accent);
    border-radius: 16px 0 0 16px;
  }
  .qa-checkbox {
    flex-shrink: 0;
    width: 22px;
    height: 22px;
    margin-top: 2px;
    accent-color: var(--_qa-accent);
    cursor: pointer;
  }
  .qa-consent__text {
    font-size: 0.95rem;
    color: var(--_qa-text-muted);
    line-height: 1.65;
  }
  .qa-consent__text strong {
    color: var(--_qa-text-primary);
    font-weight: 700;
  }
  .qa-consent__link {
    color: var(--_qa-accent);
    font-weight: 700;
    text-decoration: none;
    border-bottom: 1px solid rgba(var(--_qa-accent-rgb), 0.4);
    transition: all 0.2s ease;
  }
  .qa-consent__link:hover { border-color: var(--_qa-accent); }
 
  /* ══ STAFF NOTICE ═════════════════════════════════════════════════════ */
  .qa-staff-notice {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    font-size: 0.85rem;
    color: var(--_qa-warning);
    background: rgba(217, 119, 6, 0.08);
    border: 1px solid var(--_qa-warning);
    border-radius: 12px;
    padding: 0.85rem 1.25rem;
    margin-bottom: 1.25rem;
    letter-spacing: 0.01em;
    font-family: var(--font-paragraph);
  }
 
  /* ══ ERROR ════════════════════════════════════════════════════════════ */
  .qa-error {
    font-size: 0.9rem;
    color: var(--_qa-error);
    background: rgba(220, 38, 38, 0.08);
    border: 1px solid var(--_qa-error);
    border-radius: 12px;
    padding: 1rem 1.25rem;
    margin-bottom: 1.25rem;
    line-height: 1.5;
  }
 
  /* ══ CTA BUTTON ═══════════════════════════════════════════════════════ */
  .qa-btn {
    position: relative;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    width: 100%;
    padding: 1.25rem 1.5rem;
    border: 1px solid transparent;
    border-radius: 16px;
    font-size: 1.15rem;
    font-weight: 800;
    letter-spacing: 0.03em;
    font-family: var(--font-paragraph);
    cursor: pointer;
    transition: all 0.2s ease;
    margin-bottom: 1.25rem;
    
    /* Disabled style - light against light */
    background: var(--_qa-border);
    color: var(--_qa-text-subtle);
    box-shadow: none;
  }
  .qa-btn[disabled] {
    cursor: not-allowed;
    transform: none !important;
  }
  /* Ready — vibrant teal gradient, sharp and popping */
  .qa-btn--ready {
    background: linear-gradient(135deg, #02b5bb 0%, #038d8d 100%);
    color: #ffffff; /* Contrast against gradient */
    border-color: #02a3a8;
    box-shadow: 0 8px 24px rgba(var(--_qa-accent-rgb), 0.3);
  }
  /* Light shimmer sweep effect */
  .qa-btn--ready::before {
    content: '';
    position: absolute;
    top: 0; left: -100%; width: 60%; height: 100%;
    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent);
    transform: skewX(-20deg);
    transition: left 0.6s ease;
    pointer-events: none;
  }
  .qa-btn--ready:not([disabled]):hover {
    transform: translateY(-3px);
    box-shadow: 0 12px 32px rgba(var(--_qa-accent-rgb), 0.4);
  }
  .qa-btn--ready:not([disabled]):hover::before { left: 150%; }
  .qa-btn--ready:not([disabled]):active {
    transform: translateY(-1px);
    box-shadow: 0 4px 16px rgba(var(--_qa-accent-rgb), 0.3);
  }
 
  /* ══ SPINNERS ═════════════════════════════════════════════════════════ */
  .qa-spinner,
  .qa-spinner-inline {
    border: 3px solid rgba(var(--_qa-accent-rgb), 0.1);
    border-top-color: var(--_qa-accent);
    border-radius: 50%;
    animation: qapin 0.7s linear infinite;
    flex-shrink: 0;
  }
  .qa-spinner { width: 24px; height: 24px; }
  .qa-spinner-inline {
    width: 18px;
    height: 18px;
    border-width: 2px;
    display: inline-block;
    vertical-align: middle;
    border-color: rgba(255,255,255, 0.3);
    border-top-color: #ffffff; /* Spinners inside buttons are white */
  }
  @keyframes qapin { to { transform: rotate(360deg); } }
 
  /* ══ LEGAL FOOTNOTE ═══════════════════════════════════════════════════ */
  .qa-legal {
    font-size: 0.8rem;
    color: var(--_qa-text-subtle);
    line-height: 1.65;
    margin: 0;
    padding-top: 0.5rem;
    font-family: var(--font-paragraph);
    text-align: center;
  }
  .qa-legal a {
    color: var(--_qa-text-muted);
    text-decoration: none;
    border-bottom: 1px solid var(--_qa-border);
    transition: all 0.2s ease;
  }
  .qa-legal a:hover { 
    color: var(--_qa-text-primary);
    border-color: var(--_qa-text-primary); 
  }
  .qa-legal strong { color: var(--_qa-text-muted); }
</style>