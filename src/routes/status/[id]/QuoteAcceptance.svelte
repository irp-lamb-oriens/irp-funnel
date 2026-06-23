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

      <!-- Terms of agreement — shown in full, never hidden behind a link only. -->
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
          ). I understand this is a binding commitment, governed by the
          <a href="/legal/quote-acceptance" target="_blank" rel="noopener noreferrer" class="qa-consent__link">Quote Acceptance Terms</a>.
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
  /*
   * QuoteAcceptance — styles
   *
   * All tokens consumed from the portal token system defined in status.scss:
   *   --color-highlight-2          brand teal  #02b5bb
   *   --color-highlight-2-rgb      2, 181, 187
   *   --cp-text-primary            #f1f5f9
   *   --cp-text-muted              #94a3b8
   *   --cp-text-subtle             #64748b
   *   --cp-surface                 rgba(15, 23, 42, 0.55)
   *   --cp-border                  rgba(148, 163, 184, 0.12)
   *   --cp-border-teal             rgba(2, 181, 187, 0.28)
   *   --font-paragraph             "Jost", sans-serif
   *   --font-subtitle              "Spartan Black", serif
   *
   * Component-local accents (no portal equivalent — success green only):
   *   --_qa-green: #00e9a3   (accepted / success state)
   */

  /* ══ RECEIPT — success green palette ═══════════════════════════════════ */
  .qa-receipt {
    position: relative;
    overflow: hidden;
    background:
      linear-gradient(145deg, rgba(0, 233, 163, 0.04) 0%, rgba(var(--color-highlight-2-rgb), 0.06) 60%, transparent 100%),
      var(--cp-surface);
    border: 1px solid rgba(0, 233, 163, 0.22);
    border-radius: 20px;
    padding: 2.5rem 2rem 2rem;
    text-align: center;
    box-shadow:
      0 0 0 1px rgba(0, 233, 163, 0.06) inset,
      0 24px 80px rgba(0, 0, 0, 0.55),
      0 0 60px rgba(0, 233, 163, 0.06);
  }
  /* Top glow bar */
  .qa-receipt::before {
    content: '';
    position: absolute;
    top: 0; left: 10%; right: 10%;
    height: 1px;
    background: linear-gradient(90deg, transparent, rgba(0, 233, 163, 0.7), transparent);
    filter: blur(0.5px);
  }
  .qa-receipt__icon {
    font-size: 3.5rem;
    margin-bottom: 0.75rem;
    display: block;
    filter: drop-shadow(0 0 16px rgba(0, 233, 163, 0.5));
    animation: qa-pop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) both;
  }
  @keyframes qa-pop {
    from { transform: scale(0.5) rotate(-8deg); opacity: 0; }
    to   { transform: scale(1) rotate(0deg); opacity: 1; }
  }
  .qa-receipt__title {
    font-size: 1.75rem;
    font-family: var(--font-subtitle);
    font-weight: 800;
    background: linear-gradient(135deg, #00e9a3 0%, #00d8de 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    margin: 0 0 0.5rem;
    letter-spacing: -0.02em;
  }
  .qa-receipt__sub {
    font-size: 0.9rem;
    color: var(--cp-text-muted);
    margin: 0 auto 1.75rem;
    line-height: 1.65;
    max-width: 380px;
  }
  .qa-receipt__details {
    background:
      linear-gradient(180deg, rgba(0, 233, 163, 0.04) 0%, transparent 100%),
      rgba(0, 0, 0, 0.35);
    border: 1px solid rgba(0, 233, 163, 0.16);
    border-radius: 14px;
    padding: 1.5rem 1.75rem;
    text-align: left;
    display: inline-block;
    min-width: 280px;
    max-width: 440px;
    width: 100%;
    box-shadow: inset 0 1px 0 rgba(0, 233, 163, 0.08);
  }
  .qa-receipt__amount {
    font-size: 2.5rem;
    font-weight: 900;
    letter-spacing: -0.04em;
    background: linear-gradient(135deg, #00e9a3 0%, #00d8de 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    margin-bottom: 1.25rem;
    line-height: 1;
    filter: drop-shadow(0 0 12px rgba(0, 233, 163, 0.25));
  }
  .qa-receipt__dl { display: flex; flex-direction: column; gap: 0.6rem; }
  .qa-receipt__row {
    display: flex;
    gap: 0.75rem;
    align-items: baseline;
    flex-wrap: wrap;
    padding-bottom: 0.6rem;
    border-bottom: 1px solid var(--cp-border);
  }
  .qa-receipt__row:last-child { border-bottom: none; padding-bottom: 0; }
  .qa-receipt__row dt {
    font-size: 0.68rem;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    font-weight: 700;
    color: var(--cp-text-subtle);
    flex-shrink: 0;
    min-width: 120px;
  }
  .qa-receipt__row dd {
    font-size: 0.9rem;
    color: var(--cp-text-primary);
    font-weight: 500;
    margin: 0;
    word-break: break-all;
  }
  .qa-receipt__ref {
    font-family: 'SF Mono', 'Fira Code', monospace;
    font-size: 0.78rem;
    color: var(--color-highlight-2);
    opacity: 0.8;
    letter-spacing: 0.04em;
  }

  /* ══ LOADING ══════════════════════════════════════════════════════════ */
  .qa-loading {
    display: flex;
    align-items: center;
    gap: 0.85rem;
    color: var(--cp-text-muted);
    font-size: 0.875rem;
    padding: 2rem 0;
  }

  /* ══ EMPTY ════════════════════════════════════════════════════════════ */
  .qa-empty {
    background:
      linear-gradient(145deg, rgba(var(--color-highlight-2-rgb), 0.03) 0%, transparent 60%),
      var(--cp-surface);
    border: 1px solid var(--cp-border);
    border-radius: 20px;
    padding: 3rem 2rem;
    text-align: center;
    box-shadow: 0 24px 80px rgba(0, 0, 0, 0.4);
  }
  .qa-empty__icon {
    font-size: 3rem;
    display: block;
    margin-bottom: 1rem;
    opacity: 0.55;
    filter: grayscale(0.4);
  }
  .qa-empty__title {
    font-size: 1.15rem;
    font-weight: 800;
    color: var(--cp-text-primary);
    margin: 0 0 0.6rem;
    letter-spacing: -0.01em;
  }
  .qa-empty__sub {
    font-size: 0.875rem;
    color: var(--cp-text-muted);
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
    background:
      linear-gradient(135deg, rgba(var(--color-highlight-2-rgb), 0.07) 0%, rgba(var(--color-highlight-2-rgb), 0.02) 50%, transparent 100%),
      var(--cp-surface);
    border: 1px solid var(--cp-border-teal);
    border-radius: 14px;
    padding: 1.4rem 1.6rem;
    box-shadow:
      inset 0 1px 0 rgba(var(--color-highlight-2-rgb), 0.1),
      0 8px 32px rgba(0, 0, 0, 0.35);
  }
  /* Left teal accent stripe — matches QuotePanel .qp-section--accepted style */
  .qa-summary::before {
    content: '';
    position: absolute;
    top: 0; bottom: 0; left: 0;
    width: 3px;
    background: linear-gradient(180deg, #00d8de 0%, var(--color-highlight-2) 100%);
    border-radius: 4px 0 0 4px;
    box-shadow: 0 0 12px rgba(var(--color-highlight-2-rgb), 0.6);
  }
  .qa-summary__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.6rem;
  }
  .qa-summary__label {
    font-size: 0.68rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--color-highlight-2);
    opacity: 0.85;
    margin-left: 0.75rem;
  }
  .qa-summary__link {
    background: rgba(var(--color-highlight-2-rgb), 0.08);
    border: 1px solid rgba(var(--color-highlight-2-rgb), 0.18);
    color: var(--color-highlight-2);
    font-size: 0.8rem;
    font-weight: 700;
    font-family: var(--font-paragraph);
    cursor: pointer;
    padding: 3px 10px;
    border-radius: 6px;
    transition: background 0.15s, transform 0.1s;
    line-height: 1;
  }
  .qa-summary__link:hover {
    background: rgba(var(--color-highlight-2-rgb), 0.15);
    transform: translateX(2px);
  }
  .qa-summary__amount {
    font-size: 2.75rem;
    font-weight: 900;
    letter-spacing: -0.045em;
    line-height: 1;
    background: linear-gradient(135deg, #00d8de 0%, #38bdf8 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    margin: 0 0 0.3rem 0.75rem;
    filter: drop-shadow(0 0 16px rgba(var(--color-highlight-2-rgb), 0.3));
  }
  .qa-summary__provider {
    font-size: 0.88rem;
    font-weight: 600;
    color: var(--cp-text-primary);
    margin: 0 0 0.15rem 0.75rem;
    opacity: 0.8;
  }
  .qa-summary__valid {
    font-size: 0.75rem;
    color: var(--cp-text-subtle);
    margin-left: 0.75rem;
    letter-spacing: 0.02em;
  }

  /* ══ FORM CARD ════════════════════════════════════════════════════════ */
  .qa-card {
    position: relative;
    overflow: hidden;
    background:
      linear-gradient(160deg, rgba(255,255,255,0.025) 0%, transparent 40%),
      var(--cp-surface);
    border: 1px solid var(--cp-border);
    border-radius: 20px;
    padding: 2rem 2.25rem 1.75rem;
    box-shadow:
      0 0 0 1px rgba(255,255,255,0.03) inset,
      0 32px 80px rgba(0,0,0,0.55),
      0 1px 0 rgba(255,255,255,0.05) inset;
  }
  /* Top shimmer — same pattern used in .cp-call-banner */
  .qa-card::before {
    content: '';
    position: absolute;
    top: 0; left: 15%; right: 15%;
    height: 1px;
    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent);
  }
  .qa-card__title {
    font-size: 1.25rem;
    font-family: var(--font-subtitle);
    font-weight: 800;
    color: var(--cp-text-primary);
    margin: 0 0 0.45rem;
    letter-spacing: -0.02em;
  }
  .qa-card__intro {
    font-size: 0.875rem;
    color: var(--cp-text-muted);
    margin: 0 0 1.75rem;
    line-height: 1.65;
  }
  .qa-card__intro strong {
    color: var(--color-highlight-2);
    font-weight: 600;
  }

  /* ══ TERMS OF AGREEMENT — visible, never hidden behind a link only ═════
     Mirrors the portal's ultra-modern card language (.qa-summary / .qa-consent):
     glass surface, teal left-accent stripe, eyebrow + subtitle-font heading,
     teal glowing bullets. */
  .qa-terms {
    position: relative;
    overflow: hidden;
    background:
      linear-gradient(160deg, rgba(var(--color-highlight-2-rgb), 0.07) 0%, rgba(var(--color-highlight-2-rgb), 0.015) 45%, transparent 100%),
      rgba(0, 0, 0, 0.28);
    border: 1px solid var(--cp-border-teal);
    border-radius: 16px;
    padding: 0.2rem 1.3rem 0.55rem 1.45rem;
    margin-bottom: 1.5rem;
    box-shadow:
      inset 0 1px 0 rgba(var(--color-highlight-2-rgb), 0.1),
      0 8px 28px rgba(0, 0, 0, 0.28);
  }
  /* Left teal accent stripe — same pattern as .qa-summary::before */
  .qa-terms::before {
    content: '';
    position: absolute;
    top: 0; bottom: 0; left: 0;
    width: 3px;
    background: linear-gradient(180deg, #00d8de 0%, var(--color-highlight-2) 100%);
    box-shadow: 0 0 12px rgba(var(--color-highlight-2-rgb), 0.55);
  }
  .qa-terms__summary {
    display: flex;
    align-items: baseline;
    gap: 0.65rem;
    flex-wrap: wrap;
    cursor: pointer;
    list-style: none;
    padding: 0.95rem 0;
    user-select: none;
  }
  .qa-terms__summary::-webkit-details-marker { display: none; }
  .qa-terms__summary::after {
    content: '⌄';
    margin-left: auto;
    color: var(--color-highlight-2);
    font-size: 1.1rem;
    line-height: 1;
    transition: transform 0.25s ease;
  }
  .qa-terms[open] .qa-terms__summary::after { transform: rotate(180deg); }
  .qa-terms__summary-label {
    font-size: 1rem;
    font-family: var(--font-subtitle);
    font-weight: 800;
    color: var(--cp-text-primary);
    letter-spacing: -0.01em;
  }
  .qa-terms__summary-hint {
    font-size: 0.66rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--color-highlight-2);
    opacity: 0.85;
  }
  .qa-terms__body {
    padding: 0.95rem 0 0.6rem;
    border-top: 1px solid var(--cp-border);
  }
  .qa-terms__list {
    margin: 0;
    padding: 0;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 0.7rem;
  }
  .qa-terms__list li {
    position: relative;
    padding-left: 1.4rem;
    font-size: 0.83rem;
    color: var(--cp-text-muted);
    line-height: 1.65;
  }
  /* Teal glowing bullet — replaces the default disc for the modern look */
  .qa-terms__list li::before {
    content: '';
    position: absolute;
    left: 0.15rem;
    top: 0.6em;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--color-highlight-2);
    box-shadow: 0 0 8px rgba(var(--color-highlight-2-rgb), 0.6);
  }
  .qa-terms__list strong { color: var(--cp-text-primary); font-weight: 700; }
  .qa-terms__full {
    margin: 1rem 0 0;
    font-size: 0.78rem;
    color: var(--cp-text-subtle);
    line-height: 1.6;
  }
  .qa-terms__full a {
    color: var(--color-highlight-2);
    font-weight: 700;
    text-decoration: none;
    border-bottom: 1px solid rgba(var(--color-highlight-2-rgb), 0.3);
    transition: border-color 0.15s ease;
  }
  .qa-terms__full a:hover { border-bottom-color: var(--color-highlight-2); }



  /* ══ FIELD ════════════════════════════════════════════════════════════ */
  .qa-field {
    display: flex;
    flex-direction: column;
    gap: 0.45rem;
    margin-bottom: 1.4rem;
  }
  .qa-label {
    font-size: 0.7rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--cp-text-subtle);
  }

  /* Input — mirrors .cp-auth-wall__input pattern but dark-theme */
  .qa-input {
    padding: 0.9rem 1.1rem;
    background: rgba(0, 0, 0, 0.4);
    border: 1px solid var(--cp-border);
    border-radius: 10px;
    color: var(--cp-text-primary);
    font-size: 1.05rem;
    font-family: var(--font-paragraph);
    font-weight: 500;
    outline: none;
    width: 100%;
    box-sizing: border-box;
    transition:
      border-color 0.2s ease,
      box-shadow 0.2s ease,
      background 0.2s ease;
    letter-spacing: 0.01em;
  }
  .qa-input:focus {
    background: rgba(var(--color-highlight-2-rgb), 0.04);
    border-color: var(--color-highlight-2);
    box-shadow:
      0 0 0 3px rgba(var(--color-highlight-2-rgb), 0.14),
      0 0 16px rgba(var(--color-highlight-2-rgb), 0.08);
  }
  .qa-input--warn {
    border-color: rgba(245, 158, 11, 0.55);
    box-shadow:
      0 0 0 3px rgba(245, 158, 11, 0.1),
      0 0 12px rgba(245, 158, 11, 0.06);
  }
  .qa-input::placeholder {
    color: rgba(148, 163, 184, 0.35);
    font-weight: 400;
  }
  .qa-input:disabled { opacity: 0.45; cursor: not-allowed; }

  /* Select — same surface/border language as input */
  .qa-select {
    padding: 0.75rem 1.1rem;
    background: rgba(0, 0, 0, 0.4);
    border: 1px solid var(--cp-border);
    border-radius: 10px;
    color: var(--cp-text-primary);
    font-size: 0.9rem;
    font-family: var(--font-paragraph);
    outline: none;
    cursor: pointer;
    width: 100%;
    transition: border-color 0.2s;
  }
  .qa-select:focus {
    border-color: var(--color-highlight-2);
    box-shadow: 0 0 0 3px rgba(var(--color-highlight-2-rgb), 0.14);
  }

  /* Hint lines */
  .qa-hint {
    font-size: 0.78rem;
    margin: 0;
    line-height: 1.55;
    padding: 0.4rem 0.7rem;
    border-radius: 6px;
    font-weight: 500;
  }
  .qa-hint--warn {
    color: #f59e0b;
    background: rgba(245, 158, 11, 0.08);
    border-left: 2px solid rgba(245, 158, 11, 0.5);
  }
  .qa-hint--ok {
    color: #00e9a3;
    background: rgba(0, 233, 163, 0.06);
    border-left: 2px solid rgba(0, 233, 163, 0.4);
  }

  /* ══ CONSENT BLOCK ════════════════════════════════════════════════════ */
  .qa-consent {
    position: relative;
    display: flex;
    gap: 1rem;
    align-items: flex-start;
    cursor: pointer;
    padding: 1.1rem 1.25rem;
    background: rgba(255, 255, 255, 0.025);
    border: 1px solid var(--cp-border);
    border-radius: 14px;
    margin-bottom: 1.5rem;
    transition:
      border-color 0.2s ease,
      background 0.2s ease,
      box-shadow 0.2s ease;
    user-select: none;
  }
  .qa-consent--checked {
    background: rgba(var(--color-highlight-2-rgb), 0.06);
    border-color: var(--cp-border-teal);
    box-shadow:
      0 0 0 1px rgba(var(--color-highlight-2-rgb), 0.1) inset,
      0 0 24px rgba(var(--color-highlight-2-rgb), 0.06);
  }
  /* Glow left bar — same pattern as .qa-summary::before */
  .qa-consent--checked::before {
    content: '';
    position: absolute;
    top: 0; bottom: 0; left: 0;
    width: 3px;
    background: linear-gradient(180deg, #00d8de 0%, var(--color-highlight-2) 100%);
    border-radius: 4px 0 0 4px;
    box-shadow: 0 0 10px rgba(var(--color-highlight-2-rgb), 0.55);
  }
  .qa-checkbox {
    flex-shrink: 0;
    width: 20px;
    height: 20px;
    margin-top: 1px;
    accent-color: var(--color-highlight-2);
    cursor: pointer;
  }
  .qa-consent__text {
    font-size: 0.875rem;
    color: var(--cp-text-muted);
    line-height: 1.65;
  }
  .qa-consent__text strong {
    color: var(--cp-text-primary);
    font-weight: 700;
  }
  .qa-consent__link {
    color: var(--color-highlight-2);
    font-weight: 700;
    text-decoration: none;
    border-bottom: 1px solid rgba(var(--color-highlight-2-rgb), 0.3);
    transition: border-color 0.15s ease;
  }
  .qa-consent__link:hover { border-color: var(--color-highlight-2); }


  /* ══ STAFF NOTICE ═════════════════════════════════════════════════════ */
  .qa-staff-notice {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.8rem;
    color: #f59e0b;
    background: rgba(245, 158, 11, 0.06);
    border: 1px solid rgba(245, 158, 11, 0.2);
    border-radius: 10px;
    padding: 0.65rem 1rem;
    margin-bottom: 0.85rem;
    letter-spacing: 0.01em;
    font-family: var(--font-paragraph);
  }

  /* ══ ERROR ════════════════════════════════════════════════════════════ */
  .qa-error {
    font-size: 0.875rem;
    color: #f87171;
    background: rgba(var(--color-highlight-1-rgb, 198, 36, 38), 0.07);
    border: 1px solid rgba(var(--color-highlight-1-rgb, 198, 36, 38), 0.22);
    border-radius: 10px;
    padding: 0.8rem 1.1rem;
    margin-bottom: 0.85rem;
    line-height: 1.5;
  }

  /* ══ CTA BUTTON ═══════════════════════════════════════════════════════ */
  .qa-btn {
    position: relative;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.55rem;
    width: 100%;
    padding: 1.1rem 1.5rem;
    border: 1px solid rgba(255, 255, 255, 0.07);
    border-radius: 14px;
    font-size: 1.05rem;
    font-weight: 800;
    letter-spacing: 0.02em;
    font-family: var(--font-paragraph);
    cursor: pointer;
    transition:
      background 0.25s ease,
      color 0.25s ease,
      box-shadow 0.25s ease,
      transform 0.15s ease,
      border-color 0.25s ease;
    margin-bottom: 1.1rem;
    /* Disabled ghost */
    background: rgba(255, 255, 255, 0.04);
    color: rgba(148, 163, 184, 0.35);
    box-shadow: none;
  }
  .qa-btn[disabled] {
    cursor: not-allowed;
    transform: none !important;
  }
  /* Ready — teal gradient gem w/ shimmer sweep */
  .qa-btn--ready {
    background: linear-gradient(135deg, #00d8de 0%, var(--color-highlight-2) 45%, #0284c7 100%);
    color: #00050a;
    border-color: transparent;
    box-shadow:
      0 4px 24px rgba(var(--color-highlight-2-rgb), 0.38),
      0 1px 0 rgba(255, 255, 255, 0.25) inset,
      0 0 0 1px rgba(var(--color-highlight-2-rgb), 0.3);
  }
  .qa-btn--ready::before {
    content: '';
    position: absolute;
    top: 0; left: -100%; width: 60%; height: 100%;
    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.18), transparent);
    transform: skewX(-20deg);
    transition: left 0.5s ease;
    pointer-events: none;
  }
  .qa-btn--ready:not([disabled]):hover {
    transform: translateY(-3px);
    box-shadow:
      0 8px 36px rgba(var(--color-highlight-2-rgb), 0.52),
      0 1px 0 rgba(255, 255, 255, 0.3) inset,
      0 0 0 1px rgba(var(--color-highlight-2-rgb), 0.4);
  }
  .qa-btn--ready:not([disabled]):hover::before { left: 150%; }
  .qa-btn--ready:not([disabled]):active {
    transform: translateY(-1px);
    box-shadow: 0 4px 20px rgba(var(--color-highlight-2-rgb), 0.4);
  }

  /* ══ SPINNERS ═════════════════════════════════════════════════════════ */
  .qa-spinner,
  .qa-spinner-inline {
    border: 2px solid rgba(255, 255, 255, 0.1);
    border-top-color: var(--color-highlight-2);
    border-radius: 50%;
    animation: qapin 0.65s linear infinite;
    flex-shrink: 0;
  }
  .qa-spinner { width: 20px; height: 20px; }
  .qa-spinner-inline {
    width: 16px;
    height: 16px;
    display: inline-block;
    vertical-align: middle;
  }
  @keyframes qapin { to { transform: rotate(360deg); } }

  /* ══ LEGAL FOOTNOTE ═══════════════════════════════════════════════════ */
  .qa-legal {
    font-size: 0.76rem;
    color: var(--cp-text-subtle);
    line-height: 1.65;
    margin: 0;
    padding-top: 0.25rem;
    font-family: var(--font-paragraph);
  }
  .qa-legal a {
    color: var(--color-highlight-2);
    text-decoration: none;
    border-bottom: 1px solid rgba(var(--color-highlight-2-rgb), 0.25);
    transition: border-color 0.15s;
  }
  .qa-legal a:hover { border-color: var(--color-highlight-2); }
  .qa-legal strong { color: var(--cp-text-muted); }
</style>
