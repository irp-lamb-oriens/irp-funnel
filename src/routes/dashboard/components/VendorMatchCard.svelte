<script lang="ts">
  /**
   * VendorMatchCard.svelte
   *
   * Self-contained widget that hits /api/dashboard/providers/match/:clientId
   * and renders the scored provider list as a collapsible card inside the
   * Insights tab.
   *
   * Additive-only: if no providers are registered in Firestore the card
   * simply shows an "empty" message and hides itself. No existing
   * functionality is changed.
   */
  import { onMount } from 'svelte';
  import { authToken, sendProviderRfq } from '../store.ts';
  import type { SendRfqResult } from '../store.ts';
  import { get } from 'svelte/store';


  export let clientId: string;

  // ─── Types ──────────────────────────────────────────────────────────────────

  type ServiceCategory = 'full_service' | 'self_pack_with_loading' | 'diy_no_loading';
  type VendorShippingModality = 'maritime' | 'air' | 'land';

  interface MatchedVendor {
    id: string;
    name: string;
    contactPerson?: string;
    email: string;
    phone?: string;
    website?: string;
    serviceCategories: ServiceCategory[];
    shippingModalities: VendorShippingModality[];
    originRegions?: string[];
    destinationRegions?: string[];
    notes?: string;
    active: boolean;
    _matchScore: number;
  }

  interface ClientContext {
    packingTier: string | null;
    shippingMode: string | null;
    wantedCategory: string | null;
    /** renamed from effectiveModality in the new providers/match endpoint */
    wantedModality: string | null;
    originCountry: string | null;
    destinationCountry: string | null;
  }

  const SERVICE_CATEGORY_LABEL: Record<ServiceCategory, { icon: string; label: string }> = {
    full_service:           { icon: '🛡️', label: 'Full Service' },
    self_pack_with_loading: { icon: '👥', label: 'Self Pack + Loading' },
    diy_no_loading:         { icon: '📦', label: 'DIY — No Loading' },
  };

  const MODALITY_LABEL: Record<VendorShippingModality, { icon: string; label: string }> = {
    maritime: { icon: '🚢', label: 'Maritime' },
    air:      { icon: '✈️', label: 'Air' },
    land:     { icon: '🚛', label: 'Land' },
  };

  const SCORE_COLORS = ['#22c55e', '#22c55e', '#eab308', '#eab308', '#94a3b8'];

  // ─── State ───────────────────────────────────────────────────────────────────

  let vendors: MatchedVendor[] = [];
  let clientContext: ClientContext | null = null;
  let isLoading = false;
  let error = '';
  let isOpen = false;
  let hasFetched = false;

  // ── Manual RFQ send (human-triggered ONLY — provider contact is never automatic) ──
  let sending = false;
  let sendResult: SendRfqResult | null = null;
  let sendError = '';


  // ─── API ─────────────────────────────────────────────────────────────────────

  function getApiUrl(): string {
    if (typeof window !== 'undefined' && window.location.origin.startsWith('http://localhost')) {
      return 'http://localhost:8000';
    }
    return 'https://irp-funnel-server.onrender.com';
  }

  async function fetchMatches() {
    if (hasFetched) return;
    isLoading = true;
    error = '';
    try {
      const token = get(authToken);
      const res = await fetch(`${getApiUrl()}/api/dashboard/providers/match/${clientId}`, {
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'x-dashboard-token': token } : {}),
        },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
      vendors = data.providers || [];
      clientContext = data.clientContext || null;
      hasFetched = true;
    } catch (err: any) {
      error = err.message;
    } finally {
      isLoading = false;
    }
  }

  function toggleOpen() {
    isOpen = !isOpen;
    if (isOpen && !hasFetched) {
      fetchMatches();
    }
  }

  // Auto-fetch on mount so the badge count is known immediately
  onMount(() => {
    fetchMatches();
  });

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  function scoreColor(score: number): string {
    if (score >= 5) return '#22c55e';
    if (score >= 3) return '#eab308';
    return '#94a3b8';
  }

  $: topMatches = vendors.filter(v => v._matchScore >= 3);
  $: hasMatches = vendors.length > 0;

  // The providers the RFQ will be sent to: the strong matches when present,
  // otherwise every matched vendor (the operator reviews this list above).
  $: sendTargets = topMatches.length > 0 ? topMatches : vendors;

  /**
   * Manually send the RFQ to the matched providers. Human-triggered ONLY —
   * provider contact is never automatic. Asks for explicit confirmation, then
   * calls the shared blast service (idempotent: providers with a live request
   * are skipped server-side).
   */
  async function handleSendRfq() {
    if (sending || sendTargets.length === 0) return;
    const n = sendTargets.length;
    const ok = confirm(
      `Send the quote request (RFQ) to ${n} provider${n === 1 ? '' : 's'}?\n\n` +
      `They will each receive an email asking for a quote. Providers who already ` +
      `have a live request are skipped automatically.`,
    );
    if (!ok) return;

    sending = true;
    sendError = '';
    sendResult = null;
    try {
      sendResult = await sendProviderRfq(clientId, sendTargets.map(v => v.id));
    } catch (err: any) {
      sendError = err?.message ?? 'Failed to send the RFQ.';
    } finally {
      sending = false;
    }
  }
</script>


<!-- ─── Collapsible card ────────────────────────────────────────────────────── -->
<div class="vmatch-card" class:vmatch-card--open={isOpen}>

  <!-- Header / toggle -->
  <button class="vmatch-header" on:click={toggleOpen} type="button">
    <span class="vmatch-header__label">
      🏢 Compatible Vendors
      {#if !isLoading && hasFetched}
        <span class="vmatch-badge" class:vmatch-badge--green={topMatches.length > 0}>
          {topMatches.length > 0 ? topMatches.length : (vendors.length > 0 ? vendors.length : 'none')}
        </span>
      {:else if isLoading}
        <span class="vmatch-spinner"></span>
      {/if}
    </span>
    <span class="vmatch-header__chevron" class:rotated={isOpen}>›</span>
  </button>

  <!-- Body (shown when open) -->
  {#if isOpen}
    <div class="vmatch-body">

      {#if clientContext && (clientContext.wantedCategory || clientContext.wantedModality)}
        <div class="vmatch-context">
          <span class="vmatch-context__label">Matching for:</span>
          {#if clientContext.wantedCategory}
            {@const cat = SERVICE_CATEGORY_LABEL[clientContext.wantedCategory as ServiceCategory]}
            {#if cat}<span class="vmatch-chip vmatch-chip--cat">{cat.icon} {cat.label}</span>{/if}
          {/if}
          {#if clientContext.wantedModality}
            {@const mod = MODALITY_LABEL[clientContext.wantedModality as VendorShippingModality]}
            {#if mod}<span class="vmatch-chip vmatch-chip--mod">{mod.icon} {mod.label}</span>{/if}
          {/if}
          {#if clientContext.originCountry || clientContext.destinationCountry}
            <span class="vmatch-chip vmatch-chip--route">
              {clientContext.originCountry ?? '?'} → {clientContext.destinationCountry ?? '?'}
            </span>
          {/if}
        </div>
      {/if}

      {#if error}
        <div class="vmatch-error" role="alert">{error}</div>
      {:else if isLoading}
        <div class="vmatch-loading" role="status">
          <div class="vmatch-spinner vmatch-spinner--lg"></div>
          <span>Looking up compatible vendors…</span>
        </div>
      {:else if vendors.length === 0}
        <div class="vmatch-empty" role="status">
          No vendors registered yet.
          <a href="/dashboard" on:click|preventDefault={() => {}}>Go to Vendors tab to add providers.</a>
        </div>
      {:else}
        <ul class="vmatch-list">
          {#each vendors as v (v.id)}
            <li class="vmatch-item" class:vmatch-item--dim={v._matchScore < 3}>

              <!-- Score dot + company -->
              <div class="vmatch-item__head">
                <span
                  class="vmatch-score-dot"
                  style="background: {scoreColor(v._matchScore)}"
                  title="Match score: {v._matchScore}/6"
                ></span>
                <span class="vmatch-company">{v.name}</span>
                {#if v.website}
                  <a
                    class="vmatch-site"
                    href={v.website.startsWith('http') ? v.website : `https://${v.website}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >↗</a>
                {/if}
              </div>

              <!-- Contact -->
              <div class="vmatch-contact">
                <span>{v.contactPerson || ''}</span>
                <a href="mailto:{v.email}" class="vmatch-email">{v.email}</a>
                {#if v.phone}<span class="vmatch-phone">{v.phone}</span>{/if}
              </div>

              <!-- Categories + modalities -->
              <div class="vmatch-chips">
                {#each v.serviceCategories as cat}
                  {@const meta = SERVICE_CATEGORY_LABEL[cat]}
                  {#if meta}<span class="vmatch-chip vmatch-chip--cat vmatch-chip--sm">{meta.icon} {meta.label}</span>{/if}
                {/each}
                {#each v.shippingModalities as mod}
                  {@const meta = MODALITY_LABEL[mod]}
                  {#if meta}<span class="vmatch-chip vmatch-chip--mod vmatch-chip--sm">{meta.icon} {meta.label}</span>{/if}
                {/each}
              </div>

              {#if v.notes}
                <div class="vmatch-notes">{v.notes}</div>
              {/if}
            </li>
          {/each}
        </ul>
      {/if}

      <!-- Manual RFQ send — human-triggered only; provider contact is never automatic -->
      {#if hasMatches && !isLoading && !error}
        <div class="vmatch-send">
          {#if sendResult}
            <div class="vmatch-send-result">
              ✅ RFQ sent — {sendResult.counts.created} contacted{#if sendResult.counts.skipped > 0}, {sendResult.counts.skipped} already had a live request{/if}{#if sendResult.counts.failed > 0}, {sendResult.counts.failed} failed{/if}.
            </div>
          {:else}
            {#if sendError}
              <div class="vmatch-send-error" role="alert">{sendError}</div>
            {/if}
            <p class="vmatch-send-note">Provider contact is manual — review the matched vendors above, then send the quote request.</p>
            <button
              type="button"
              class="vmatch-send-btn"
              on:click={handleSendRfq}
              disabled={sending || sendTargets.length === 0} title={sendTargets.length === 0 ? 'Select at least one provider first' : undefined}
            >
              {#if sending}
                <span class="vmatch-spinner vmatch-spinner--btn"></span> Sending…
              {:else}
                📤 Send RFQ to {sendTargets.length} provider{sendTargets.length === 1 ? '' : 's'}
              {/if}
            </button>
          {/if}
        </div>
      {/if}
    </div>
  {/if}
</div>


<style>
  /* ── Card shell — light theme ──────────────────────────────────────────── */
  .vmatch-card {
    border: 1px solid var(--irp-line);
    border-radius: var(--irp-r-md);
    overflow: hidden;
    background: var(--irp-surface);
    margin-top: 0.75rem;
    box-shadow: 0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04);
    transition: border-color 0.14s;
  }
  .vmatch-card--open {
    border-color: rgba(2,181,187,0.25);
  }

  /* ── Header ────────────────────────────────────────────────────────────── */
  .vmatch-header {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.65rem 1rem;
    background: var(--irp-surface-2);
    border: none;
    cursor: pointer;
    color: var(--irp-text-muted);
    font-size: var(--irp-fs-sm);
    font-weight: 600;
    transition: background 0.12s, color 0.12s;
  }
  .vmatch-header:hover { background: var(--irp-surface-3); color: var(--irp-text); }
  .vmatch-header__label {
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }
  .vmatch-badge {
    display: inline-flex;
    align-items: center;
    padding: 0.1rem 0.45rem;
    border-radius: var(--irp-r-full);
    background: var(--irp-surface-3);
    color: var(--irp-text-dim);
    font-size: var(--irp-fs-2xs);
    font-weight: 700;
    border: 1px solid var(--irp-line);
  }
  .vmatch-badge--green {
    background: var(--irp-surface-2);
    color: var(--irp-green-700);
    border-color: var(--irp-green-200);
  }
  .vmatch-header__chevron {
    font-size: var(--irp-fs-2xl);
    font-weight: 300;
    transition: transform 0.2s;
    display: inline-block;
    color: var(--irp-text-dim);
  }
  .vmatch-header__chevron.rotated { transform: rotate(90deg); }

  /* ── Body ───────────────────────────────────────────────────────────────── */
  .vmatch-body {
    border-top: 1px solid var(--irp-line);
    padding: 0.75rem 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.625rem;
    background: var(--irp-surface);
  }

  /* ── Context pills ───────────────────────────────────────────────────────── */
  .vmatch-context {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.35rem;
    font-size: var(--irp-fs-xs);
  }
  .vmatch-context__label {
    color: var(--irp-text-dim);
    font-size: var(--irp-fs-xs);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  /* ── Chips ───────────────────────────────────────────────────────────────── */
  .vmatch-chip {
    display: inline-flex;
    align-items: center;
    gap: 0.2rem;
    padding: 0.2rem 0.55rem;
    border-radius: var(--irp-r-full);
    font-size: var(--irp-fs-xs);
    font-weight: 600;
    white-space: nowrap;
  }
  .vmatch-chip--sm { font-size: var(--irp-fs-2xs); padding: 0.15rem 0.4rem; }
  /* Dark-enough accent colours → readable on their light bg */
  .vmatch-chip--cat   { background: rgba(2,181,187,0.1);  color: var(--irp-accent-ink); border: 1px solid rgba(2,181,187,0.2); }
  .vmatch-chip--mod   { background: rgba(14,165,233,0.08); color: var(--irp-blue-600); border: 1px solid rgba(14,165,233,0.2); }
  .vmatch-chip--route { background: var(--irp-surface-3);               color: var(--irp-text-muted); border: 1px solid var(--irp-line); }

  /* ── States ──────────────────────────────────────────────────────────────── */
  .vmatch-error {
    font-size: var(--irp-fs-xs);
    color: var(--irp-red-600);
    background: var(--irp-surface-3);
    border: 1px solid var(--irp-red-200);
    padding: 0.5rem 0.75rem;
    border-radius: var(--irp-r-sm);
    font-weight: 600;
  }
  .vmatch-loading {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: var(--irp-fs-sm);
    color: var(--irp-text-dim);   /* dark-on-white → readable */
    padding: 0.5rem 0;
  }
  .vmatch-empty {
    font-size: var(--irp-fs-sm);
    color: var(--irp-text-dim);   /* dark-on-white → readable */
    padding: 0.25rem 0;
    font-style: normal;
  }
  .vmatch-empty a {
    color: var(--irp-accent-ink);
    text-decoration: underline;
    cursor: pointer;
  }
  .vmatch-empty a:hover { color: var(--irp-accent-ink); }

  /* ── Provider list ───────────────────────────────────────────────────────── */
  .vmatch-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .vmatch-item {
    background: var(--irp-surface-2);
    border-radius: var(--irp-r-sm);
    padding: 0.65rem 0.875rem;
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    border: 1px solid var(--irp-line);
    transition: border-color 0.12s, box-shadow 0.12s;
  }
  .vmatch-item:hover { border-color: var(--irp-teal-200); box-shadow: 0 1px 4px rgba(2,181,187,0.08); }
  .vmatch-item:first-child { border-color: var(--irp-green-200); background: var(--irp-surface-2); }
  .vmatch-item--dim { opacity: 0.55; }

  .vmatch-item__head {
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }
  .vmatch-score-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .vmatch-company {
    font-weight: 700;
    font-size: var(--irp-fs-md);
    color: var(--irp-text);   /* dark on light-bg → high contrast */
    flex: 1;
  }
  .vmatch-site {
    font-size: var(--irp-fs-xs);
    color: var(--irp-accent-ink);
    text-decoration: none;
    font-weight: 600;
  }
  .vmatch-site:hover { text-decoration: underline; color: var(--irp-accent-ink); }

  .vmatch-contact {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    font-size: var(--irp-fs-xs);
    color: var(--irp-text-muted);   /* dark on light-bg → readable */
  }
  .vmatch-email { color: var(--irp-accent-ink); text-decoration: none; }
  .vmatch-email:hover { text-decoration: underline; color: var(--irp-accent-ink); }
  .vmatch-phone { color: var(--irp-text-dim); }

  .vmatch-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
  }

  .vmatch-notes {
    font-size: var(--irp-fs-xs);
    color: var(--irp-text-dim);   /* dark on light-bg → readable */
    font-style: italic;
    line-height: 1.4;
    margin-top: 0.1rem;
  }

  /* ── Spinner ─────────────────────────────────────────────────────────────── */
  .vmatch-spinner {
    display: inline-block;
    width: 12px;
    height: 12px;
    border: 1.5px solid var(--irp-line);
    border-top-color: var(--irp-accent);
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
  }
  .vmatch-spinner--lg { width: 16px; height: 16px; }
  .vmatch-spinner--btn { border-color: rgba(255,255,255,0.4); border-top-color: var(--irp-slate-0); }
  @keyframes spin { to { transform: rotate(360deg); } }

  /* ── Manual RFQ send ──────────────────────────────────────────────────────── */
  .vmatch-send {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    border-top: 1px dashed var(--irp-line);
    padding-top: 0.625rem;
    margin-top: 0.125rem;
  }
  .vmatch-send-note {
    margin: 0;
    font-size: var(--irp-fs-xs);
    color: var(--irp-text-dim);
    line-height: 1.4;
  }
  .vmatch-send-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.4rem;
    align-self: flex-start;
    background: linear-gradient(135deg, var(--irp-accent) 0%, var(--irp-accent-hover) 100%);
    color: var(--irp-text-inverse);
    border: none;
    border-radius: var(--irp-r-full);
    padding: 0.5rem 1rem;
    font-size: var(--irp-fs-sm);
    font-weight: 700;
    cursor: pointer;
    box-shadow: 0 2px 8px rgba(2,181,187,0.28);
    transition: filter 0.15s, box-shadow 0.15s, transform 0.15s;
  }
  .vmatch-send-btn:hover:not(:disabled) {
    filter: brightness(1.07);
    box-shadow: 0 4px 14px rgba(2,181,187,0.36);
    transform: translateY(-1px);
  }
  .vmatch-send-btn:disabled { opacity: 0.6; cursor: not-allowed; }
  .vmatch-send-result {
    font-size: var(--irp-fs-xs);
    font-weight: 600;
    color: var(--irp-green-700);
    background: var(--irp-surface-2);
    border: 1px solid var(--irp-green-200);
    border-radius: var(--irp-r-sm);
    padding: 0.5rem 0.75rem;
    line-height: 1.4;
  }
  .vmatch-send-error {
    font-size: var(--irp-fs-sm);
    font-weight: 600;
    color: var(--irp-danger-ink);
    background: var(--irp-danger-bg);
    border: 1px solid var(--irp-danger-line);
    border-radius: var(--irp-r-sm);
    padding: 0.5rem 0.75rem;
    font-style: normal;
  }
</style>

