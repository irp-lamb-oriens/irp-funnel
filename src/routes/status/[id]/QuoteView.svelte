<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import type { Quote } from '../../dashboard/store.ts';
  import { fetchQuoteByToken, acceptQuoteAsClient, fetchClientQuoteDescription } from '../../dashboard/store.ts';
  import BlockRenderer from './BlockRenderer.svelte';
  import { project } from './store.ts';
  import { irpStaffIsAuthenticated } from '../../../lib/auth/irpStaff.ts';

  export let consultationId: string;

  const LEGAL_URL = '/legal/quote-acceptance';

  let quote: Quote | null = null;
  let loading = true;
  let loadError = '';
  let accepting = false;
  let acceptedBy = '';
  let consent = false;
  let accepted = false;
  let acceptError = '';
  // True when an IRP staff member is viewing via the dashboard bypass — they
  // must never be able to accept a quote on the client's behalf.
  $: isStaff = $irpStaffIsAuthenticated;
  // Phase 3 — selections captured from BlockRenderer's accept event
  let selectedLineItemIds: string[] = [];

  // Phase D — AI client description shown below the title, with a loading state
  // while it is lazily generated on first view.
  let clientDesc = '';
  let descLoading = false;

  // ── Phase 5 — line-item group selection (status-page packages + add-ons) ──
  //   required groups → ONE is chosen via radio (most expensive auto-selected)
  //   optional groups → each toggled via checkbox (ALL pre-checked by default;
  //                     the client can deselect any add-on they don't want)
  let selectedRequiredGroupId = '';
  let selectedOptionalGroupIds: Set<string> = new Set();
  let groupSelectionInit = false;

  $: groups = (Array.isArray((quote as any)?.lineGroups) ? (quote as any).lineGroups : []) as any[];
  $: hasGroups = groups.length > 0;
  $: requiredGroups = groups.filter((g) => g.role !== 'optional');
  $: optionalGroups = groups.filter((g) => g.role === 'optional');

  // Auto-select the MOST EXPENSIVE required group + PRE-CHECK every optional
  // add-on, exactly once after the quote loads. The client can still switch the
  // required package and untick any add-on they don't want.
  $: if (hasGroups && !groupSelectionInit) {
    selectedRequiredGroupId = mostExpensiveRequiredGroupId();
    selectedOptionalGroupIds = new Set(optionalGroups.map((g) => g.groupId));
    groupSelectionInit = true;
  }

  /** The groupId of the priciest required block (by client price). '' when none. */
  function mostExpensiveRequiredGroupId(): string {
    if (requiredGroups.length === 0) return '';
    return requiredGroups.reduce(
      (best, g) => (groupClientTotal(g) > groupClientTotal(best) ? g : best),
      requiredGroups[0],
    ).groupId;
  }

  function groupClientTotal(g: any): number {
    return (Array.isArray(g?.lineItems) ? g.lineItems : []).reduce(
      (sum: number, li: any) => sum + (li.clientPrice ?? li.amount ?? 0),
      0,
    );
  }

  function toggleOptionalGroup(groupId: string) {
    const next = new Set(selectedOptionalGroupIds);
    next.has(groupId) ? next.delete(groupId) : next.add(groupId);
    selectedOptionalGroupIds = next; // reassign so Svelte reacts
  }

  // The set of groups the client has chosen (selected required + checked add-ons).
  $: selectedGroups = hasGroups
    ? [
        ...requiredGroups.filter((g) => g.groupId === selectedRequiredGroupId),
        ...optionalGroups.filter((g) => selectedOptionalGroupIds.has(g.groupId)),
      ]
    : [];
  $: selectedGroupIds = selectedGroups.map((g) => g.groupId);
  // Expand the chosen groups to their line-item ids — the server bills off these.
  $: groupSelectedLineItemIds = selectedGroups.flatMap((g) =>
    (Array.isArray(g.lineItems) ? g.lineItems : []).map((li: any) => li.lineId),
  );
  // Live total reflects the current selection (or the static quote total when flat).
  $: liveTotal = hasGroups
    ? selectedGroups.reduce((sum, g) => sum + groupClientTotal(g), 0)
    : quote?.total ?? 0;
  // A package must be chosen before signing when the quote has required groups.
  $: requiredSelectionOk = requiredGroups.length === 0 || !!selectedRequiredGroupId;


  const token = $page.url.searchParams.get('quoteToken') ?? '';


  onMount(async () => {
    if (!token) { loading = false; return; }
    try {
      quote = await fetchQuoteByToken(consultationId, token);
      if (!quote) loadError = 'Quote not found.';
      if (quote?.status === 'client_accepted') accepted = true;

      // Phase D — surface the AI client description; lazily generate it on first
      // view when the quote doesn't have one yet (a brief loading state shows).
      clientDesc = (quote as any)?.clientDescription ?? '';
      const qAny = quote as any;
      const hasScope =
        (Array.isArray(qAny?.lineGroups) && qAny.lineGroups.length > 0) ||
        (Array.isArray(qAny?.lineItems) && qAny.lineItems.length > 0);
      if (quote && !clientDesc && hasScope) {
        descLoading = true;
        fetchClientQuoteDescription(consultationId, token)
          .then((t) => { if (t) clientDesc = t; })
          .finally(() => { descLoading = false; });
      }

      // Phase 5 — if the quote was already accepted, restore the exact packages /
      // add-ons the client picked (server returns `selectedGroupIds`) so the cards
      // reflect their real choice rather than resetting to the auto-default.
      const acc = quote as any;
      if (Array.isArray(acc?.selectedGroupIds) && acc.selectedGroupIds.length > 0) {
        const selIds: string[] = acc.selectedGroupIds;
        const gs: any[] = Array.isArray(acc.lineGroups) ? acc.lineGroups : [];
        const reqSel = gs.find((g) => g.role !== 'optional' && selIds.includes(g.groupId));
        if (reqSel) selectedRequiredGroupId = reqSel.groupId;
        selectedOptionalGroupIds = new Set(
          gs.filter((g) => g.role === 'optional' && selIds.includes(g.groupId)).map((g) => g.groupId),
        );
        groupSelectionInit = true; // lock so the auto-default reactive can't overwrite it
      }

    } catch (e: any) {
      loadError = e.message ?? 'Error loading quote.';
    } finally {
      loading = false;
    }
  });

  async function handleAccept() {
    if (!quote || !token) return;
    // ── Client-only, name + binding consent required (applies to BOTH the
    //    modern BlockRenderer accept block and the legacy accept section). ──
    if (isStaff) {
      acceptError = 'Quotes can only be accepted by the client named on this project — not IRP staff.';
      return;
    }
    if (!acceptedBy.trim()) {
      acceptError = 'Please type your full legal name to accept.';
      return;
    }
    if (!consent) {
      acceptError = 'Please tick the box to confirm you agree to the binding Quote Acceptance Terms.';
      return;
    }
    if (hasGroups && !requiredSelectionOk) {
      acceptError = 'Please choose a package to continue.';
      return;
    }
    accepting = true;
    acceptError = '';
    try {

      // Phase 5: grouped quotes bill off the chosen groups' line items; legacy
      // flat quotes keep using whatever BlockRenderer captured (selectedLineItemIds).
      const lineItemIds = hasGroups ? groupSelectedLineItemIds : selectedLineItemIds;
      // Phase 3/5: pass the final services + chosen groups so the server records
      // exactly what the client agreed to (and bills finalBilledTotal accordingly).
      await acceptQuoteAsClient(
        consultationId,
        token,
        acceptedBy,
        lineItemIds.length > 0 ? lineItemIds : undefined,
        hasGroups && selectedGroupIds.length > 0 ? selectedGroupIds : undefined,
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

  /** Client price for a line item. Server pre-computes `clientPrice` on the public endpoint.
   *  Falls back to `item.amount` for backward compat with old quotes in transition. */
  function lineDisplayPrice(item: any): number {
    return item.clientPrice ?? item.amount ?? 0;
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
      {isStaff}
      legalUrl={LEGAL_URL}
      clientSummary={$project ?? {}}
      on:accept={async (e) => {
        acceptedBy = e.detail.acceptedBy;
        consent = e.detail.consent ?? false;
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

    {#if hasGroups}
      <!-- ── Phase 5 — package (required radio) + add-on (optional checkbox) picker ── -->
      <div class="qv-groups">
        {#if requiredGroups.length > 0}
          <p class="qv-groups-heading">
            {requiredGroups.length > 1 ? 'Choose your package' : 'Your package'}
          </p>
          <div class="qv-groups-list" role="radiogroup" aria-label="Choose your package">
            {#each requiredGroups as g (g.groupId)}
              <label class="qv-group" class:qv-group--active={selectedRequiredGroupId === g.groupId}>
                <input
                  type="radio"
                  class="qv-group__input"
                  name="qv-required-group"
                  value={g.groupId}
                  checked={selectedRequiredGroupId === g.groupId}
                  disabled={accepted || quote.status === 'client_accepted'}
                  on:change={() => (selectedRequiredGroupId = g.groupId)}
                />
                <span class="qv-group__marker qv-group__marker--radio" aria-hidden="true"></span>
                <span class="qv-group__body">
                  <span class="qv-group__top">
                    <span class="qv-group__title">{g.title}</span>
                    <span class="qv-group__price">{formatCurrency(groupClientTotal(g), quote.currency)}</span>
                  </span>
                  <!-- {#if Array.isArray(g.lineItems) && g.lineItems.length > 0}
                    <span class="qv-group__items">
                      {#each g.lineItems as li (li.lineId)}
                        <span class="qv-group__item">
                          <span class="qv-group__item-label">{li.label}</span>
                          <span class="qv-group__item-price">{formatCurrency(li.clientPrice ?? li.amount ?? 0, li.currency)}</span>
                        </span>
                      {/each}
                    </span>
                  {/if} -->
                </span>
              </label>
            {/each}
          </div>
        {/if}

        {#if optionalGroups.length > 0}
          <p class="qv-groups-heading qv-groups-heading--addons">Optional add-ons</p>
          <div class="qv-groups-list">
            {#each optionalGroups as g (g.groupId)}
              <label class="qv-group" class:qv-group--active={selectedOptionalGroupIds.has(g.groupId)}>
                <input
                  type="checkbox"
                  class="qv-group__input"
                  checked={selectedOptionalGroupIds.has(g.groupId)}
                  disabled={accepted || quote.status === 'client_accepted'}
                  on:change={() => toggleOptionalGroup(g.groupId)}
                />
                <span class="qv-group__marker qv-group__marker--check" aria-hidden="true"></span>
                <span class="qv-group__body">
                  <span class="qv-group__top">
                    <span class="qv-group__title">{g.title}</span>
                    <span class="qv-group__price">+{formatCurrency(groupClientTotal(g), quote.currency)}</span>
                  </span>
                  <!-- {#if Array.isArray(g.lineItems) && g.lineItems.length > 0}
                    <span class="qv-group__items">
                      {#each g.lineItems as li (li.lineId)}
                        <span class="qv-group__item">
                          <span class="qv-group__item-label">{li.label}</span>
                          <span class="qv-group__item-price">{formatCurrency(li.clientPrice ?? li.amount ?? 0, li.currency)}</span>
                        </span>
                      {/each}
                    </span>
                  {/if} -->
                </span>
              </label>
            {/each}
          </div>
        {/if}

        <div class="qv-live-total">
          <span class="qv-live-total__label">Total</span>
          <span class="qv-live-total__value">{formatCurrency(liveTotal, quote.currency)}</span>
        </div>
      </div>
    {:else if Array.isArray(quote.lineItems) && quote.lineItems.length > 0}
      <table class="qv-table">
        <thead>
          <tr>
            <th>Service</th>
            <th class="qv-amount">Amount</th>
          </tr>
        </thead>
        <tbody>
          <!-- {#each quote.lineItems as item (item.lineId)}
            <tr>
              <td>
                <span class="qv-label">{item.label}</span>
                {#if item.notes}
                  <span class="qv-item-notes">{item.notes}</span>
                {/if}
              </td>
              <td class="qv-amount">{formatCurrency(lineDisplayPrice(item), item.currency)}</td>
            </tr>
          {/each} -->
        </tbody>
        <tfoot>
          <tr class="qv-total-row">
            <td><strong>Total</strong></td>
            <td class="qv-amount"><strong>{formatCurrency(quote.total, quote.currency)}</strong></td>
          </tr>
        </tfoot>
      </table>
    {/if}

    <!-- Providers intentionally hidden — clients never see provider names or cost detail -->

    {#if clientDesc}
      <div class="qv-notes">
        <p class="qv-notes-label">About this service</p>
        <p class="qv-notes-text">{clientDesc}</p>
      </div>
    {:else if descLoading}
      <div class="qv-notes qv-notes--loading" aria-live="polite">
        <p class="qv-notes-label">About this service</p>
        <div class="qv-desc-skeleton" aria-hidden="true">
          <span class="qv-skel-line"></span>
          <span class="qv-skel-line"></span>
          <span class="qv-skel-line qv-skel-line--short"></span>
        </div>
        <p class="qv-desc-loading-hint">✨ Preparing your personalized summary…</p>
      </div>
    {/if}

    {#if !accepted && quote.status !== 'client_accepted'}
      <div class="qv-accept-section">
        {#if isStaff}
          <div class="qv-staff-notice">
            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
            <span>You're viewing this as IRP staff. Only the client named on this project can accept the quote.</span>
          </div>
        {:else}
          <p class="qv-accept-intro">
            To accept, type your <strong>full legal name</strong> and tick the box below. Accepting is a
            <a href={LEGAL_URL} target="_blank" rel="noopener noreferrer" class="qv-legal-link">legally binding agreement</a>.
          </p>
          <input
            class="qv-name-input"
            type="text"
            bind:value={acceptedBy}
            placeholder="Your full legal name"
            autocomplete="name"
          />
          <label class="qv-consent" class:qv-consent--checked={consent}>
            <input type="checkbox" class="qv-consent__check" bind:checked={consent} />
            <span class="qv-consent__text">I confirm I am the named client and I have read and agree to the
              <a href={LEGAL_URL} target="_blank" rel="noopener noreferrer" class="qv-legal-link">binding Quote Acceptance Terms</a>.
              Typing my name and ticking this box is my electronic signature.</span>
          </label>
          {#if acceptError}
            <p class="qv-error-msg">{acceptError}</p>
          {/if}
          <button class="qv-accept-btn" on:click={handleAccept} disabled={accepting || !acceptedBy.trim() || !consent || (hasGroups && !requiredSelectionOk)}>
            {accepting ? 'Processing...' : '✅ Accept quote'}
          </button>
        {/if}

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
    color: #64748b;   /* raised from #94a3b8 (~2.5:1) → #64748b (~4.8:1) */
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
    color: #475569;   /* raised from #94a3b8 (~2.5:1) → #475569 (~7.5:1) on #f8fafc */
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
    color: #64748b;   /* raised from #94a3b8 (~2.5:1) → #64748b (~4.8:1) */
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

  /* ── Phase 5 — package / add-on selection cards ───────────────────────── */
  .qv-groups { margin-bottom: 24px; }
  .qv-groups-heading {
    font-size: 11px;
    font-weight: 700;
    color: #475569;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    margin: 0 0 10px;
  }
  .qv-groups-heading--addons { margin-top: 22px; }
  .qv-groups-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .qv-group {
    display: flex;
    align-items: flex-start;
    gap: 13px;
    padding: 14px 16px;
    background: #ffffff;
    border: 1.5px solid #e2e8f0;
    border-radius: 14px;
    cursor: pointer;
    transition: border-color 0.18s cubic-bezier(0.22, 0.61, 0.36, 1),
                background 0.18s cubic-bezier(0.22, 0.61, 0.36, 1),
                box-shadow 0.18s cubic-bezier(0.22, 0.61, 0.36, 1),
                transform 0.18s cubic-bezier(0.22, 0.61, 0.36, 1);
  }
  /* Brand teal sourced from the global design tokens (global.scss) per the
     style bible — `--color-highlight-2` (#02b5bb) + its rgb channel token. */
  .qv-group:hover {
    border-color: rgba(var(--color-highlight-2-rgb), 0.45);
    box-shadow: 0 6px 18px -8px rgba(var(--color-highlight-2-rgb), 0.4);
    transform: translateY(-1px);
  }
  .qv-group--active {
    border-color: rgba(var(--color-highlight-2-rgb), 0.6);
    background: linear-gradient(135deg, rgba(var(--color-highlight-2-rgb), 0.06) 0%, #f0fdfe 100%);
    box-shadow: 0 0 0 3px rgba(var(--color-highlight-2-rgb), 0.1);
  }
  .qv-group--active:hover {
    box-shadow: 0 0 0 3px rgba(var(--color-highlight-2-rgb), 0.1), 0 6px 18px -8px rgba(var(--color-highlight-2-rgb), 0.45);
  }
  /* Locked-in look once the quote is accepted — no pointer affordance. */
  .qv-group:has(.qv-group__input:disabled) {
    cursor: default;
    transform: none;
    box-shadow: none;
  }

  /* Visually-hidden native input — the custom marker mirrors its state. */
  .qv-group__input {
    position: absolute;
    opacity: 0;
    width: 1px;
    height: 1px;
    pointer-events: none;
  }
  .qv-group__marker {
    flex-shrink: 0;
    width: 20px;
    height: 20px;
    margin-top: 1px;
    border: 2px solid #cbd5e1;
    background: #ffffff;
    transition: border-color 0.16s ease, background 0.16s ease;
    position: relative;
  }
  .qv-group__marker--radio { border-radius: 999px; }
  .qv-group__marker--check { border-radius: 6px; }
  .qv-group--active .qv-group__marker { border-color: var(--color-highlight-2); background: var(--color-highlight-2); }
  /* Radio inner dot */
  .qv-group--active .qv-group__marker--radio::after {
    content: '';
    position: absolute;
    inset: 4px;
    border-radius: 999px;
    background: #ffffff;
  }
  /* Checkbox tick */
  .qv-group--active .qv-group__marker--check::after {
    content: '';
    position: absolute;
    left: 6px;
    top: 2px;
    width: 5px;
    height: 10px;
    border: solid #ffffff;
    border-width: 0 2.5px 2.5px 0;
    transform: rotate(45deg);
  }
  .qv-group__input:focus-visible + .qv-group__marker {
    box-shadow: 0 0 0 3px rgba(var(--color-highlight-2-rgb), 0.3);
  }
  .qv-group__input:disabled ~ .qv-group__body { opacity: 0.85; }
  .qv-group__body { flex: 1; min-width: 0; }
  .qv-group__top {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
  }
  .qv-group__title {
    font-size: 15px;
    font-weight: 700;
    color: #0f172a;
    letter-spacing: -0.01em;
  }
  .qv-group__price {
    font-size: 15px;
    font-weight: 800;
    color: #0f172a;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
  .qv-group__items {
    display: flex;
    flex-direction: column;
    gap: 3px;
    margin-top: 8px;
  }
  .qv-group__item {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
    font-size: 12.5px;
    color: #64748b;
    line-height: 1.45;
  }
  .qv-group__item-price {
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
    color: #94a3b8;
  }
  /* Live, reactive total that updates as packages / add-ons are toggled. */
  .qv-live-total {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 18px;
    padding-top: 16px;
    border-top: 2px solid #e2e8f0;
  }
  .qv-live-total__label {
    font-size: 19px;
    font-weight: 800;
    color: #0f172a;
    letter-spacing: -0.02em;
  }
  .qv-live-total__value {
    font-size: 19px;
    font-weight: 800;
    color: #0f172a;
    letter-spacing: -0.02em;
    font-variant-numeric: tabular-nums;
  }


  /* ── Notes card ───────────────────────────────────────────────────────── */

  .qv-notes {
    background: #f8fafc;
    border-radius: 12px;
    padding: 16px 20px;
    margin-bottom: 24px;
    border-left: 3px solid #02b5bb;
  }
  .qv-notes-label {
    font-size: 11px;
    font-weight: 700;
    color: #64748b;   /* raised from #94a3b8 (~2.5:1) → #64748b (~4.8:1) on #f8fafc */
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

  /* ── Phase D — AI description loading state (shimmer) ─────────────────────── */
  .qv-notes--loading { position: relative; }
  .qv-desc-skeleton { display: flex; flex-direction: column; gap: 8px; margin: 2px 0 10px; }
  .qv-skel-line {
    height: 11px;
    border-radius: 6px;
    background: linear-gradient(90deg, #e2e8f0 25%, #eef2f7 37%, #e2e8f0 63%);
    background-size: 400% 100%;
    animation: qvShimmer 1.3s ease-in-out infinite;
  }
  .qv-skel-line--short { width: 55%; }
  @keyframes qvShimmer {
    0%   { background-position: 100% 0; }
    100% { background-position: 0 0; }
  }
  .qv-desc-loading-hint {
    margin: 0;
    font-size: 12.5px;
    font-weight: 600;
    color: #0a7e82;
    letter-spacing: 0.01em;
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

  /* ── Staff notice ─────────────────────────────────────────────────────── */
  .qv-staff-notice {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 13px;
    font-weight: 600;
    color: #9a3412;
    background: linear-gradient(135deg, #fff7ed 0%, #fffbf5 100%);
    border: 1px solid #fed7aa;
    border-radius: 12px;
    padding: 13px 15px;
    margin: 0;
    line-height: 1.5;
  }
  .qv-staff-notice svg { flex-shrink: 0; color: #ea8a3c; }

  /* ── Binding-consent row ──────────────────────────────────────────────── */
  .qv-consent {
    display: flex;
    align-items: flex-start;
    gap: 11px;
    padding: 13px 15px;
    background: #f8fafc;
    border: 1.5px solid #e2e8f0;
    border-radius: 12px;
    cursor: pointer;
    transition: border-color 0.16s ease, background 0.16s ease, box-shadow 0.16s ease;
  }
  .qv-consent:hover { border-color: rgba(2, 181, 187, 0.45); background: #f0fdfe; }
  .qv-consent--checked {
    border-color: rgba(2, 181, 187, 0.55);
    background: linear-gradient(135deg, rgba(2, 181, 187, 0.07) 0%, #f0fdfe 100%);
    box-shadow: 0 0 0 3px rgba(2, 181, 187, 0.1);
  }
  .qv-consent__check {
    margin-top: 2px;
    width: 18px;
    height: 18px;
    accent-color: #02b5bb;
    flex-shrink: 0;
    cursor: pointer;
  }
  .qv-consent__text {
    font-size: 13px;
    color: #475569;
    line-height: 1.55;
  }
  .qv-legal-link {
    color: #0a7e82;   /* darkened from #02b5bb (~2.5:1) → #0a7e82 (~4.7:1) on white */
    font-weight: 700;
    text-decoration: none;
    border-bottom: 1px solid rgba(10, 126, 130, 0.32);
    transition: border-color 0.15s ease;
  }
  .qv-legal-link:hover { border-color: #0a7e82; }


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
  .qv-name-input::placeholder { color: #64748b; }  /* raised from #94a3b8 (~2.5:1) → #64748b (~4.8:1) */
  .qv-name-input:focus {
    border-color: #02b5bb;
    box-shadow: 0 0 0 3px rgba(2,181,187,0.15);
  }

  /* ── Accept button ────────────────────────────────────────────────────── */
  .qv-accept-btn {
    background: linear-gradient(135deg, #02b5bb 0%, #0a8a8e 100%);
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
    box-shadow: 0 4px 14px rgba(2,181,187,0.40);
    transition: box-shadow 0.2s, transform 0.2s, filter 0.2s;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
  }
  .qv-accept-btn:hover:not(:disabled) {
    box-shadow: 0 8px 28px rgba(2,181,187,0.52);
        filter: brightness(1.07);
  }
  .qv-accept-btn:active:not(:disabled) {
    transform: translateY(0);
    filter: brightness(0.97);
    box-shadow: 0 2px 8px rgba(2,181,187,0.32);
  }
  .qv-accept-btn:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }

  /* ── Error message ────────────────────────────────────────────────────── */
  .qv-error-msg {
    color: #dc2626;
    font-size: 13px;
    margin: 0;
    background: #fef2f2;
    border: 1px solid #fecaca;
    padding: 10px 14px;
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
    /* Disable the hover-lift on touch so cards don't feel "stuck" after a tap. */
    .qv-group { padding: 13px 14px; }
    .qv-group:hover { transform: none; box-shadow: none; }
    .qv-group--active:hover { box-shadow: 0 0 0 3px rgba(var(--color-highlight-2-rgb), 0.1); }
    .qv-group__title,
    .qv-group__price { font-size: 14.5px; }
  }

</style>
