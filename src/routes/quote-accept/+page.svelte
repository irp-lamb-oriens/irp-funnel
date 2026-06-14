<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';

  // ── URL params ────────────────────────────────────────────────────────────
  $: consultationId = $page.url.searchParams.get('consultationId') ?? '';
  $: requestId      = $page.url.searchParams.get('requestId')      ?? '';
  $: token          = $page.url.searchParams.get('token')           ?? '';

  // ── Page states ───────────────────────────────────────────────────────────
  type State =
    | 'loading'
    | 'invalid'
    | 'not_found'
    | 'expired'
    | 'already_responded'
    | 'ready'
    | 'submitting'
    | 'accepted'
    | 'declined'
    | 'selected'
    | 'confirmed'
    | 'error';


  let state: State = 'loading';
  let errorMessage = '';

  // ── Quote request data ────────────────────────────────────────────────────
  interface MoveDetails {
    originCountry?: string;
    destinationCountry?: string;
    containerSize?: string;
    moveDate?: string;
    itemsSummary?: string;
    specialItems?: string[];
  }
  interface ProviderResponse {
    price: number | null;
    currency: string | null;
    notes: string;
    respondedAt: string;
  }
  interface QuoteRequestData {
    requestId: string;
    status: string;
    providerName: string;
    moveDetails: MoveDetails;
    sentAt: string;
    expiresAt: string;
    selectedAt: string | null;
    providerResponse: ProviderResponse | null;
  }

  let quoteRequest: QuoteRequestData | null = null;

  // ── Form state ────────────────────────────────────────────────────────────
  let selectedAction: 'accept' | 'decline' | null = null;
  let priceInput    = '';
  let currency      = 'USD';
  let notes         = '';
  let declineReason = '';
  let formError     = '';

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  onMount(async () => {
    if (!consultationId || !requestId || !token) {
      state = 'invalid';
      return;
    }
    await loadQuoteRequest();
  });

  async function loadQuoteRequest() {
    state = 'loading';
    try {
      const params = new URLSearchParams({ consultationId, requestId, token });
      const res = await fetch(`/api/provider/quote-request?${params}`);
      const data = await res.json();

      if (res.status === 404) { state = 'not_found'; return; }
      if (res.status === 403) { state = 'not_found'; return; }
      if (res.status === 410) { state = 'expired';   return; }
      if (!res.ok) {
        errorMessage = data.error ?? 'Unknown error.';
        state = 'error';
        return;
      }

      quoteRequest = data as QuoteRequestData;

      if (data.status === 'selected') {
        state = 'selected';
        return;
      }
      if (data.status === 'confirmed') {
        state = 'confirmed';
        return;
      }
      if (data.status === 'accepted' || data.status === 'declined') {
        state = 'already_responded';
        return;
      }
      if (data.status === 'expired') {
        state = 'expired';
        return;
      }

      state = 'ready';
    } catch (err) {
      console.error('[quote-accept] fetch error:', err);
      errorMessage = 'Could not connect to the server. Please try again.';
      state = 'error';
    }
  }

  async function handleSubmit() {
    formError = '';
    if (!selectedAction) {
      formError = 'Please choose to accept or decline.';
      return;
    }
    if (selectedAction === 'accept') {
      const num = Number(priceInput);
      if (!priceInput || isNaN(num) || num <= 0) {
        formError = 'Please enter a valid price greater than 0.';
        return;
      }
    }

    state = 'submitting';
    try {
      const res = await fetch('/api/provider/quote-request/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          consultationId,
          requestId,
          token,
          action: selectedAction,
          price: selectedAction === 'accept' ? Number(priceInput) : undefined,
          currency: selectedAction === 'accept' ? currency : undefined,
          notes: selectedAction === 'accept' ? notes : undefined,
          declineReason: selectedAction === 'decline' ? declineReason : undefined,
        }),
      });

      const data = await res.json();

      if (res.status === 409 && data.alreadyResponded) {
        await loadQuoteRequest();
        return;
      }
      if (res.status === 410 && data.expired) {
        state = 'expired';
        return;
      }
      if (!res.ok) {
        formError = data.error ?? 'Submission failed. Please try again.';
        state = 'ready';
        return;
      }

      state = selectedAction === 'accept' ? 'accepted' : 'declined';
    } catch (err) {
      console.error('[quote-accept] submit error:', err);
      formError = 'Could not connect to the server. Please try again.';
      state = 'ready';
    }
  }

  // ── Awarded-provider confirmation ──────────────────────────────────────────
  // Called from the "selected" screen: the provider IRP chose either confirms
  // they'll handle the move (→ client quote is drafted server-side) or backs out.
  async function handleConfirm(action: 'confirm' | 'decline') {
    formError = '';
    state = 'submitting';
    try {
      const res = await fetch('/api/provider/quote-request/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          consultationId,
          requestId,
          token,
          action: action === 'decline' ? 'decline' : 'confirm',
        }),
      });
      const data = await res.json();

      if (res.status === 409 && data.status === 'confirmed') {
        state = 'confirmed';
        return;
      }
      if (!res.ok) {
        formError = data.error ?? 'Could not record your confirmation. Please try again.';
        state = 'selected';
        return;
      }

      state = data.status === 'declined' ? 'declined' : 'confirmed';
    } catch (err) {
      console.error('[quote-accept] confirm error:', err);
      formError = 'Could not connect to the server. Please try again.';
      state = 'selected';
    }
  }

  function formatDate(iso: string | undefined): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'long', day: 'numeric', year: 'numeric',
    });
  }

  function formatCurrency(amount: number | null, cur: string | null): string {
    if (!amount) return '—';
    try {
      return new Intl.NumberFormat('en-US', {
        style: 'currency', currency: cur ?? 'USD',
      }).format(amount);
    } catch {
      return `${cur} ${amount.toLocaleString()}`;
    }
  }

  const CURRENCIES = [
    { code: 'USD', label: 'USD — US Dollar' },
    { code: 'EUR', label: 'EUR — Euro' },
    { code: 'GBP', label: 'GBP — British Pound' },
    { code: 'CAD', label: 'CAD — Canadian Dollar' },
    { code: 'CRC', label: 'CRC — Costa Rican Colón' },
    { code: 'MXN', label: 'MXN — Mexican Peso' },
    { code: 'COP', label: 'COP — Colombian Peso' },
    { code: 'PEN', label: 'PEN — Peruvian Sol' },
    { code: 'CLP', label: 'CLP — Chilean Peso' },
    { code: 'BRL', label: 'BRL — Brazilian Real' },
  ];
</script>

<svelte:head>
  <title>IRP — Quote Request</title>
  <meta name="robots" content="noindex, nofollow" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
</svelte:head>

<div class="qr-root">

  <!-- Top brand strip -->
  <header class="qr-header">
    <img src="/IRP-LOGO.jpg" alt="IRP" class="qr-logo" on:error={(e) => ((e.currentTarget as HTMLImageElement).style.display = 'none')} />

    <span class="qr-brand">International Relocation Partner</span>
  </header>

  <main class="qr-main">

    <!-- ══ LOADING ════════════════════════════════════════════════════════ -->
    {#if state === 'loading'}
      <div class="qr-card qr-card--center">
        <div class="qr-spinner"></div>
        <p class="qr-muted">Loading quote request…</p>
      </div>

    <!-- ══ SUBMITTING ═════════════════════════════════════════════════════ -->
    {:else if state === 'submitting'}
      <div class="qr-card qr-card--center">
        <div class="qr-spinner"></div>
        <p class="qr-muted">Submitting your response…</p>
      </div>

    <!-- ══ INVALID PARAMS ════════════════════════════════════════════════ -->
    {:else if state === 'invalid'}
      <div class="qr-card qr-card--center">
        <div class="qr-state-icon qr-state-icon--warn">⚠</div>
        <h2 class="qr-title">Invalid link</h2>
        <p class="qr-muted">This link is missing required parameters. Please use the original link sent to your email.</p>
      </div>

    <!-- ══ NOT FOUND ══════════════════════════════════════════════════════ -->
    {:else if state === 'not_found'}
      <div class="qr-card qr-card--center">
        <div class="qr-state-icon qr-state-icon--warn">🔍</div>
        <h2 class="qr-title">Request not found</h2>
        <p class="qr-muted">This quote request could not be found. The link may be outdated or incorrect.</p>
      </div>

    <!-- ══ EXPIRED ════════════════════════════════════════════════════════ -->
    {:else if state === 'expired'}
      <div class="qr-card qr-card--center">
        <div class="qr-state-icon qr-state-icon--warn">⏱</div>
        <h2 class="qr-title">This request has expired</h2>
        <p class="qr-muted">
          The window to respond to this quote request has passed.
          {#if quoteRequest?.expiresAt}
            It expired on {formatDate(quoteRequest.expiresAt)}.
          {/if}
        </p>
        <p class="qr-muted" style="margin-top:0.5rem;">If you believe this is an error, please contact IRP directly.</p>
      </div>

    <!-- ══ GENERAL ERROR ══════════════════════════════════════════════════ -->
    {:else if state === 'error'}
      <div class="qr-card qr-card--center">
        <div class="qr-state-icon qr-state-icon--warn">✕</div>
        <h2 class="qr-title">Something went wrong</h2>
        <p class="qr-muted">{errorMessage}</p>
        <button class="qr-btn qr-btn--ghost" style="margin-top:1.25rem;" on:click={loadQuoteRequest}>
          Try again
        </button>
      </div>

    <!-- ══ ALREADY RESPONDED ══════════════════════════════════════════════ -->
    {:else if state === 'already_responded' && quoteRequest}
      <div class="qr-card">
        <div
          class="qr-state-icon"
          class:qr-state-icon--success={quoteRequest.status === 'accepted'}
          class:qr-state-icon--neutral={quoteRequest.status === 'declined'}
          style="margin: 0 auto 1.25rem;"
        >
          {quoteRequest.status === 'accepted' ? '✓' : '○'}
        </div>
        <h2 class="qr-title" style="text-align:center;">
          {quoteRequest.status === 'accepted' ? 'Quote already submitted' : 'Request previously declined'}
        </h2>
        <p class="qr-muted" style="text-align:center; margin-bottom:1.5rem;">
          {quoteRequest.status === 'accepted'
            ? 'You have already submitted a quote for this request.'
            : 'You previously declined this quote request.'}
        </p>

        {#if quoteRequest.providerResponse}
          <div class="qr-response-summary">
            {#if quoteRequest.status === 'accepted' && quoteRequest.providerResponse.price}
              <div class="qr-response-summary__row">
                <span class="qr-response-summary__label">Your quote</span>
                <span class="qr-response-summary__value qr-response-summary__value--highlight">
                  {formatCurrency(quoteRequest.providerResponse.price, quoteRequest.providerResponse.currency)}
                </span>
              </div>
            {/if}
            {#if quoteRequest.providerResponse.notes}
              <div class="qr-response-summary__row">
                <span class="qr-response-summary__label">Notes</span>
                <span class="qr-response-summary__value">{quoteRequest.providerResponse.notes}</span>
              </div>
            {/if}
            <div class="qr-response-summary__row">
              <span class="qr-response-summary__label">Responded</span>
              <span class="qr-response-summary__value">{formatDate(quoteRequest.providerResponse.respondedAt)}</span>
            </div>
          </div>
        {/if}
      </div>

    <!-- ══ SUCCESS — ACCEPTED ═════════════════════════════════════════════ -->
    {:else if state === 'accepted'}
      <div class="qr-card qr-card--center">
        <div class="qr-confetti-ring">
          <div class="qr-state-icon qr-state-icon--success">✓</div>
        </div>
        <h2 class="qr-title">Quote submitted!</h2>
        <p class="qr-muted">
          Your quote of <strong class="qr-highlight">{formatCurrency(Number(priceInput), currency)}</strong> has been received by IRP.
          We'll be in touch with next steps shortly.
        </p>
        {#if notes}
          <div class="qr-response-summary" style="margin-top:1.25rem; text-align:left;">
            <div class="qr-response-summary__row">
              <span class="qr-response-summary__label">Your notes</span>
              <span class="qr-response-summary__value">{notes}</span>
            </div>
          </div>
        {/if}
      </div>

    <!-- ══ SELECTED — You've been chosen! ════════════════════════════════ -->
    {:else if state === 'selected' && quoteRequest}
      {@const md = quoteRequest.moveDetails}
      <div class="qr-route-banner">
        <span class="qr-route-banner__flag">{md.originCountry || 'Origin'}</span>
        <svg class="qr-route-banner__arrow" xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
        <span class="qr-route-banner__flag">{md.destinationCountry || 'Destination'}</span>
      </div>
      <div class="qr-card">
        <div class="qr-confetti-ring" style="margin-bottom: 1.5rem;">
          <div class="qr-state-icon qr-state-icon--success" style="font-size: 1.6rem;">🏆</div>
        </div>
        <h2 class="qr-title" style="text-align:center; font-size:1.45rem;">
          Congratulations{quoteRequest.providerName ? `, ${quoteRequest.providerName}` : ''}!
        </h2>
        <p class="qr-subtitle" style="text-align:center;">
          IRP has selected your company to handle this relocation.
          Please confirm you can take it on at your quoted price so we can finalize everything with the client.
        </p>

        <div class="qr-details-grid" style="margin-bottom: 1.5rem;">
          {#if md.containerSize}
            <div class="qr-detail">
              <span class="qr-detail__icon">📦</span>
              <div class="qr-detail__body">
                <span class="qr-detail__label">Container / Mode</span>
                <span class="qr-detail__value">{md.containerSize}</span>
              </div>
            </div>
          {/if}
          {#if md.moveDate}
            <div class="qr-detail">
              <span class="qr-detail__icon">📅</span>
              <div class="qr-detail__body">
                <span class="qr-detail__label">Target Move Date</span>
                <span class="qr-detail__value">{formatDate(md.moveDate)}</span>
              </div>
            </div>
          {/if}
          {#if quoteRequest.providerResponse?.price}
            <div class="qr-detail qr-detail--full">
              <span class="qr-detail__icon">💰</span>
              <div class="qr-detail__body">
                <span class="qr-detail__label">Your Quoted Price</span>
                <span class="qr-detail__value" style="color: var(--color-highlight-2); font-weight: 800;">
                  {formatCurrency(quoteRequest.providerResponse.price, quoteRequest.providerResponse.currency)}
                </span>
              </div>
            </div>
          {/if}
        </div>

        {#if formError}
          <div class="qr-form-error" style="margin-bottom:1rem;">{formError}</div>
        {/if}

        <button class="qr-btn qr-btn--primary" type="button" on:click={() => handleConfirm('confirm')}>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
          Confirm — I'll handle this move
        </button>
        <!-- Full-width to match the primary CTA above (.qr-btn--ghost defaults to width:auto). -->
        <button class="qr-btn qr-btn--ghost" type="button" style="margin-top:0.6rem; width:100%;" on:click={() => handleConfirm('decline')}>
          I can no longer take this on
        </button>


        {#if quoteRequest.selectedAt}
          <p class="qr-expiry-note" style="margin-top:1rem;">
            Selected on {formatDate(quoteRequest.selectedAt)}
          </p>
        {/if}

        <!-- Decorative selected badge -->
        <div class="qr-selected-badge">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
          Officially selected by IRP
        </div>
      </div>

    <!-- ══ CONFIRMED — assignment locked in ════════════════════════════════ -->
    {:else if state === 'confirmed'}
      <div class="qr-card qr-card--center">
        <div class="qr-confetti-ring">
          <div class="qr-state-icon qr-state-icon--success">✓</div>
        </div>
        <h2 class="qr-title">You're confirmed!</h2>
        <p class="qr-muted">
          Thank you for confirming. IRP will finalize the booking with the client, and
          a member of our team will be in touch with the full move details and next steps.
        </p>
      </div>

    <!-- ══ SUCCESS — DECLINED ══════════════════════════════════════════════ -->
    {:else if state === 'declined'}
      <div class="qr-card qr-card--center">
        <div class="qr-state-icon qr-state-icon--neutral" style="margin: 0 auto 1.25rem;">○</div>
        <h2 class="qr-title">Response recorded</h2>
        <p class="qr-muted">You've declined this quote request. IRP has been notified.</p>
      </div>

    <!-- ══ READY — MAIN FORM ══════════════════════════════════════════════ -->
    {:else if state === 'ready' && quoteRequest}
      {@const md = quoteRequest.moveDetails}

      <!-- Route banner -->
      <div class="qr-route-banner">
        <span class="qr-route-banner__flag">
          {md.originCountry || 'Origin'}
        </span>
        <svg class="qr-route-banner__arrow" xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
        <span class="qr-route-banner__flag">
          {md.destinationCountry || 'Destination'}
        </span>
      </div>

      <!-- Main card -->
      <div class="qr-card">

        <!-- Eyebrow -->
        <span class="qr-eyebrow">
          <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
          Quote Request from IRP
        </span>

        <h1 class="qr-title">
          Hello{quoteRequest.providerName ? `, ${quoteRequest.providerName}` : ''}
        </h1>
        <p class="qr-subtitle">
          International Relocation Partner is requesting a quote from you for the following move. Please review the details and submit your pricing below.
        </p>

        <!-- Move details grid -->
        <div class="qr-details-grid">
          {#if md.containerSize}
            <div class="qr-detail">
              <span class="qr-detail__icon">📦</span>
              <div class="qr-detail__body">
                <span class="qr-detail__label">Container / Mode</span>
                <span class="qr-detail__value">{md.containerSize}</span>
              </div>
            </div>
          {/if}
          {#if md.moveDate}
            <div class="qr-detail">
              <span class="qr-detail__icon">📅</span>
              <div class="qr-detail__body">
                <span class="qr-detail__label">Target Move Date</span>
                <span class="qr-detail__value">{formatDate(md.moveDate)}</span>
              </div>
            </div>
          {/if}
          {#if md.itemsSummary}
            <div class="qr-detail qr-detail--full">
              <span class="qr-detail__icon">🗃</span>
              <div class="qr-detail__body">
                <span class="qr-detail__label">Items Summary</span>
                <span class="qr-detail__value">{md.itemsSummary}</span>
              </div>
            </div>
          {/if}
          {#if md.specialItems && md.specialItems.length > 0}
            <div class="qr-detail qr-detail--full">
              <span class="qr-detail__icon">⭐</span>
              <div class="qr-detail__body">
                <span class="qr-detail__label">Special Items</span>
                <div class="qr-tags">
                  {#each md.specialItems as item}
                    <span class="qr-tag">{item}</span>
                  {/each}
                </div>
              </div>
            </div>
          {/if}
        </div>

        <hr class="qr-divider" />

        <!-- Action toggle -->
        <div class="qr-action-toggle">
          <button
            class="qr-toggle-btn"
            class:qr-toggle-btn--active={selectedAction === 'accept'}
            on:click={() => { selectedAction = 'accept'; formError = ''; }}
            type="button"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
            Accept & Quote
          </button>
          <button
            class="qr-toggle-btn qr-toggle-btn--decline"
            class:qr-toggle-btn--active={selectedAction === 'decline'}
            on:click={() => { selectedAction = 'decline'; formError = ''; }}
            type="button"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            Decline
          </button>
        </div>

        <!-- Accept form -->
        {#if selectedAction === 'accept'}
          <div class="qr-form-section">
            <label class="qr-label" for="qr-price">Your quote price <span class="qr-required">*</span></label>
            <div class="qr-price-row">
              <select id="qr-currency" bind:value={currency} class="qr-select">
                {#each CURRENCIES as c}
                  <option value={c.code}>{c.code}</option>
                {/each}
              </select>
              <input
                id="qr-price"
                type="number"
                min="1"
                step="0.01"
                bind:value={priceInput}
                placeholder="e.g. 3500"
                class="qr-input qr-input--price"
                autocomplete="off"
              />
            </div>
            <label class="qr-label" for="qr-notes" style="margin-top:1rem;">
              Additional notes
              <span class="qr-optional">(optional)</span>
            </label>
            <textarea
              id="qr-notes"
              bind:value={notes}
              rows="3"
              placeholder="Transit time, included services, conditions, etc."
              class="qr-textarea"
            ></textarea>
          </div>
        {/if}

        <!-- Decline form -->
        {#if selectedAction === 'decline'}
          <div class="qr-form-section">
            <label class="qr-label" for="qr-decline-reason">
              Reason for declining
              <span class="qr-optional">(optional)</span>
            </label>
            <textarea
              id="qr-decline-reason"
              bind:value={declineReason}
              rows="3"
              placeholder="e.g. Route not available, capacity full, timeline doesn't work…"
              class="qr-textarea"
            ></textarea>
          </div>
        {/if}

        {#if formError}
          <div class="qr-form-error">{formError}</div>
        {/if}

        {#if selectedAction}
          <button
            class="qr-btn qr-btn--primary"
            class:qr-btn--danger={selectedAction === 'decline'}
            on:click={handleSubmit}
            type="button"
          >
            {#if selectedAction === 'accept'}
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
              Submit My Quote
            {:else}
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              Confirm Decline
            {/if}
          </button>
        {/if}

        <!-- Expiry note -->
        {#if quoteRequest.expiresAt}
          <p class="qr-expiry-note">
            This request is open until {formatDate(quoteRequest.expiresAt)}.
          </p>
        {/if}

      </div><!-- /.qr-card -->
    {/if}

  </main>

  <footer class="qr-footer">
    <span>Powered by</span>
    <strong>International Relocation Partner</strong>
  </footer>

</div>

<style>
  /* ── Reset / base ──────────────────────────────────────────────────────── */
  :global(body) {
    margin: 0;
    padding: 0;
    background: #020d10;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    -webkit-font-smoothing: antialiased;
    color: #f1f5f9;
    min-height: 100vh;
  }

  /* ── Root wrapper ──────────────────────────────────────────────────────── */
  .qr-root {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    background:
      radial-gradient(ellipse 80% 60% at 50% -10%, rgba(var(--color-highlight-2-rgb), 0.09) 0%, transparent 60%),
      linear-gradient(180deg, #020d10 0%, #031319 100%);
    padding: 0 1rem 3rem;
  }

  /* ── Header brand strip ─────────────────────────────────────────────────── */
  .qr-header {
    width: 100%;
    max-width: 560px;
    display: flex;
    align-items: center;
    gap: 0.65rem;
    padding: 1.5rem 0 0;
    margin-bottom: 2rem;
  }
  .qr-logo {
    height: 30px;
    width: auto;
    border-radius: 6px;
    opacity: 0.95;
  }

  .qr-brand {
    font-size: 0.78rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: rgba(241, 245, 249, 0.5);
  }

  /* ── Main content area ──────────────────────────────────────────────────── */
  .qr-main {
    width: 100%;
    max-width: 560px;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  /* ── Route banner ──────────────────────────────────────────────────────── */
  .qr-route-banner {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    padding: 0.7rem 1.25rem;
    background: rgba(var(--color-highlight-2-rgb), 0.07);
    border: 1px solid rgba(var(--color-highlight-2-rgb), 0.18);
    border-radius: 12px;
    font-size: 1rem;
    font-weight: 700;
    color: #f1f5f9;
    letter-spacing: 0.01em;
  }
  .qr-route-banner__flag {
    flex: 1;
    text-align: center;
    color: #e2f8f9;
  }
  .qr-route-banner__arrow {
    color: var(--color-highlight-2);
    flex-shrink: 0;
  }

  /* ── Card ──────────────────────────────────────────────────────────────── */
  .qr-card {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(var(--color-highlight-2-rgb), 0.15);
    border-radius: 20px;
    padding: 2rem 1.75rem;
    box-shadow:
      0 8px 48px rgba(0, 0, 0, 0.4),
      inset 0 1px 0 rgba(255, 255, 255, 0.05);
    backdrop-filter: blur(24px);
    -webkit-backdrop-filter: blur(24px);
  }
  .qr-card--center {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding: 3rem 1.75rem;
  }

  /* ── Eyebrow ───────────────────────────────────────────────────────────── */
  .qr-eyebrow {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.68rem;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--color-highlight-2);
    margin-bottom: 0.75rem;
  }

  /* ── Typography ────────────────────────────────────────────────────────── */
  .qr-title {
    font-size: 1.35rem;
    font-weight: 800;
    color: #f8fafc;
    margin: 0 0 0.5rem;
    line-height: 1.25;
  }
  .qr-subtitle {
    font-size: 0.875rem;
    color: rgba(241, 245, 249, 0.55);
    line-height: 1.6;
    margin: 0 0 1.5rem;
  }
  .qr-muted {
    font-size: 0.875rem;
    color: rgba(241, 245, 249, 0.5);
    line-height: 1.6;
    margin: 0.25rem 0;
  }
  .qr-highlight {
    color: var(--color-highlight-2);
    font-weight: 700;
  }

  /* ── Details grid ──────────────────────────────────────────────────────── */
  .qr-details-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.75rem;
    margin-bottom: 0.25rem;
  }
  .qr-detail {
    display: flex;
    align-items: flex-start;
    gap: 0.6rem;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 10px;
    padding: 0.7rem 0.85rem;
  }
  .qr-detail--full {
    grid-column: 1 / -1;
  }
  .qr-detail__icon {
    font-size: 1rem;
    line-height: 1;
    flex-shrink: 0;
    margin-top: 1px;
  }
  .qr-detail__body {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }
  .qr-detail__label {
    font-size: 0.65rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: rgba(241, 245, 249, 0.4);
  }
  .qr-detail__value {
    font-size: 0.88rem;
    font-weight: 600;
    color: #f1f5f9;
    word-break: break-word;
  }

  /* ── Tags ──────────────────────────────────────────────────────────────── */
  .qr-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
    margin-top: 0.25rem;
  }
  .qr-tag {
    display: inline-block;
    padding: 0.15rem 0.6rem;
    background: rgba(var(--color-highlight-2-rgb), 0.12);
    border: 1px solid rgba(var(--color-highlight-2-rgb), 0.25);
    border-radius: 6px;
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--color-highlight-2);
  }

  /* ── Divider ───────────────────────────────────────────────────────────── */
  .qr-divider {
    border: none;
    border-top: 1px solid rgba(255, 255, 255, 0.07);
    margin: 1.5rem 0 1.25rem;
  }

  /* ── Action toggle ─────────────────────────────────────────────────────── */
  .qr-action-toggle {
    display: flex;
    gap: 0.65rem;
    margin-bottom: 1.25rem;
  }
  .qr-toggle-btn {
    flex: 1;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.45rem;
    padding: 0.7rem 1rem;
    background: rgba(255, 255, 255, 0.04);
    border: 1.5px solid rgba(255, 255, 255, 0.1);
    border-radius: 10px;
    color: rgba(241, 245, 249, 0.6);
    font-size: 0.875rem;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.15s ease;
    font-family: inherit;
  }
  .qr-toggle-btn:hover:not(.qr-toggle-btn--active) {
    border-color: rgba(var(--color-highlight-2-rgb), 0.3);
    color: #f1f5f9;
    background: rgba(var(--color-highlight-2-rgb), 0.06);
  }
  .qr-toggle-btn--active {
    background: rgba(var(--color-highlight-2-rgb), 0.12);
    border-color: rgba(var(--color-highlight-2-rgb), 0.55);
    color: var(--color-highlight-2);
    box-shadow: 0 0 0 3px rgba(var(--color-highlight-2-rgb), 0.1);
  }
  .qr-toggle-btn--decline.qr-toggle-btn--active {
    background: rgba(239, 68, 68, 0.1);
    border-color: rgba(239, 68, 68, 0.45);
    color: #f87171;
    box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.08);
  }

  /* ── Form section ──────────────────────────────────────────────────────── */
  .qr-form-section {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    margin-bottom: 1.25rem;
    animation: fadeIn 0.2s ease;
  }
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(4px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .qr-label {
    font-size: 0.78rem;
    font-weight: 700;
    color: rgba(241, 245, 249, 0.7);
    letter-spacing: 0.03em;
    margin-bottom: 0.2rem;
  }
  .qr-optional {
    font-weight: 400;
    color: rgba(241, 245, 249, 0.35);
    margin-left: 0.3rem;
  }
  .qr-required {
    color: #f87171;
    margin-left: 0.1rem;
  }
  .qr-price-row {
    display: flex;
    gap: 0.5rem;
  }
  .qr-select {
    padding: 0.6rem 0.75rem;
    background: rgba(15, 23, 42, 0.7);
    border: 1.5px solid rgba(var(--color-highlight-2-rgb), 0.22);
    border-radius: 9px;
    color: #f1f5f9;
    font-size: 0.875rem;
    font-family: inherit;
    cursor: pointer;
    outline: none;
    transition: border-color 0.15s;
    flex-shrink: 0;
    width: 90px;
  }
  .qr-select:focus {
    border-color: var(--color-highlight-2);
    box-shadow: 0 0 0 3px rgba(var(--color-highlight-2-rgb), 0.12);
  }
  .qr-input {
    padding: 0.6rem 0.9rem;
    background: rgba(15, 23, 42, 0.7);
    border: 1.5px solid rgba(var(--color-highlight-2-rgb), 0.22);
    border-radius: 9px;
    color: #f1f5f9;
    font-size: 0.9rem;
    font-family: inherit;
    outline: none;
    transition: border-color 0.15s;
    width: 100%;
    box-sizing: border-box;
  }
  .qr-input--price {
    flex: 1;
  }
  .qr-input:focus {
    border-color: var(--color-highlight-2);
    box-shadow: 0 0 0 3px rgba(var(--color-highlight-2-rgb), 0.12);
  }
  .qr-input::placeholder { color: rgba(241, 245, 249, 0.25); }
  .qr-textarea {
    padding: 0.65rem 0.9rem;
    background: rgba(15, 23, 42, 0.7);
    border: 1.5px solid rgba(var(--color-highlight-2-rgb), 0.2);
    border-radius: 9px;
    color: #f1f5f9;
    font-size: 0.875rem;
    font-family: inherit;
    line-height: 1.55;
    outline: none;
    resize: vertical;
    min-height: 80px;
    transition: border-color 0.15s;
  }
  .qr-textarea:focus {
    border-color: var(--color-highlight-2);
    box-shadow: 0 0 0 3px rgba(var(--color-highlight-2-rgb), 0.12);
  }
  .qr-textarea::placeholder { color: rgba(241, 245, 249, 0.22); }

  /* ── Buttons ───────────────────────────────────────────────────────────── */
  .qr-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.45rem;
    width: 100%;
    padding: 0.85rem 1.5rem;
    border: none;
    border-radius: 11px;
    font-size: 0.9rem;
    font-weight: 800;
    font-family: inherit;
    cursor: pointer;
    transition: background 0.17s ease, transform 0.13s ease, box-shadow 0.17s ease, opacity 0.14s ease;
    text-decoration: none;
  }
  .qr-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .qr-btn--primary {
    background: linear-gradient(135deg, var(--color-highlight-2) 0%, #03cdd4 100%);
    color: #020d10;
    box-shadow: 0 3px 18px rgba(var(--color-highlight-2-rgb), 0.32);
    margin-top: 0.5rem;
  }
  .qr-btn--primary:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 5px 28px rgba(var(--color-highlight-2-rgb), 0.48);
  }
  .qr-btn--primary:active:not(:disabled) {
    transform: translateY(0);
  }
  .qr-btn--danger {
    background: linear-gradient(135deg, #dc2626 0%, #ef4444 100%);
    color: #fff;
    box-shadow: 0 3px 18px rgba(220, 38, 38, 0.28);
  }
  .qr-btn--danger:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 5px 28px rgba(220, 38, 38, 0.44);
  }
  .qr-btn--ghost {
    background: rgba(255, 255, 255, 0.06);
    border: 1.5px solid rgba(255, 255, 255, 0.12);
    color: rgba(241, 245, 249, 0.75);
    padding: 0.65rem 1.5rem;
    width: auto;
  }
  .qr-btn--ghost:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.1);
    color: #f1f5f9;
  }

  /* ── Form error ────────────────────────────────────────────────────────── */
  .qr-form-error {
    padding: 0.65rem 0.9rem;
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    border-radius: 9px;
    color: #fca5a5;
    font-size: 0.82rem;
    font-weight: 600;
    margin-bottom: 0.5rem;
  }

  /* ── Expiry note ───────────────────────────────────────────────────────── */
  .qr-expiry-note {
    text-align: center;
    font-size: 0.73rem;
    color: rgba(241, 245, 249, 0.3);
    margin: 1rem 0 0;
  }

  /* ── Response summary (already responded) ──────────────────────────────── */
  .qr-response-summary {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.07);
    border-radius: 10px;
    padding: 1rem 1.1rem;
    display: flex;
    flex-direction: column;
    gap: 0.65rem;
  }
  .qr-response-summary__row {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .qr-response-summary__label {
    font-size: 0.65rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: rgba(241, 245, 249, 0.35);
  }
  .qr-response-summary__value {
    font-size: 0.88rem;
    color: rgba(241, 245, 249, 0.8);
  }
  .qr-response-summary__value--highlight {
    font-size: 1.05rem;
    font-weight: 800;
    color: var(--color-highlight-2);
  }

  /* ── State icons ───────────────────────────────────────────────────────── */
  .qr-state-icon {
    width: 56px;
    height: 56px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.4rem;
    font-weight: 700;
    margin-bottom: 1.25rem;
    flex-shrink: 0;
  }
  .qr-state-icon--success {
    background: rgba(var(--color-highlight-2-rgb), 0.12);
    border: 2px solid rgba(var(--color-highlight-2-rgb), 0.4);
    color: var(--color-highlight-2);
  }
  .qr-state-icon--neutral {
    background: rgba(100, 116, 139, 0.15);
    border: 2px solid rgba(100, 116, 139, 0.3);
    color: rgba(241, 245, 249, 0.55);
  }
  .qr-state-icon--warn {
    background: rgba(251, 191, 36, 0.1);
    border: 2px solid rgba(251, 191, 36, 0.3);
    color: #fbbf24;
  }

  /* ── Confetti ring (success) ───────────────────────────────────────────── */
  .qr-confetti-ring {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 80px;
    height: 80px;
    margin: 0 auto 1.25rem;
  }
  .qr-confetti-ring::before {
    content: '';
    position: absolute;
    inset: -6px;
    border-radius: 50%;
    border: 2px solid transparent;
    background:
      linear-gradient(#020d10, #020d10) padding-box,
      conic-gradient(var(--color-highlight-2), #03e4ec, #7ee8f0, var(--color-highlight-2)) border-box;
    animation: confetti-spin 3s linear infinite;
  }
  @keyframes confetti-spin {
    to { transform: rotate(360deg); }
  }
  .qr-confetti-ring .qr-state-icon {
    margin-bottom: 0;
  }

  /* ── Loading spinner ───────────────────────────────────────────────────── */
  .qr-spinner {
    width: 36px;
    height: 36px;
    border: 3px solid rgba(var(--color-highlight-2-rgb), 0.15);
    border-left-color: var(--color-highlight-2);
    border-radius: 50%;
    animation: spin 0.85s linear infinite;
    margin-bottom: 1rem;
  }
  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  /* ── Footer ────────────────────────────────────────────────────────────── */
  .qr-footer {
    margin-top: auto;
    padding-top: 2.5rem;
    font-size: 0.72rem;
    color: rgba(241, 245, 249, 0.22);
    display: flex;
    align-items: center;
    gap: 0.3rem;
  }
  .qr-footer strong {
    color: rgba(241, 245, 249, 0.35);
  }

  /* ── Selected badge ────────────────────────────────────────────────────── */
  .qr-selected-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    margin: 1.25rem auto 0;
    padding: 0.45rem 1rem;
    background: rgba(var(--color-highlight-2-rgb), 0.1);
    border: 1px solid rgba(var(--color-highlight-2-rgb), 0.35);
    border-radius: 999px;
    color: var(--color-highlight-2);
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    width: fit-content;
    /* Center inside the card */
    display: flex;
    margin-left: auto;
    margin-right: auto;
  }

  /* ── Responsive ────────────────────────────────────────────────────────── */
  @media (max-width: 480px) {
    .qr-root { padding-left: 0.75rem; padding-right: 0.75rem; }
    .qr-card { padding: 1.5rem 1.25rem; }
    .qr-details-grid { grid-template-columns: 1fr; }
    .qr-detail--full { grid-column: auto; }
    .qr-title { font-size: 1.15rem; }
    .qr-action-toggle { flex-direction: column; }
  }
</style>
