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
  import { authToken } from '../store.ts';
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
        <div class="vmatch-error">{error}</div>
      {:else if isLoading}
        <div class="vmatch-loading">
          <div class="vmatch-spinner vmatch-spinner--lg"></div>
          <span>Looking up compatible vendors…</span>
        </div>
      {:else if vendors.length === 0}
        <div class="vmatch-empty">
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
    </div>
  {/if}
</div>

<style>
  /* ── Card shell — light theme ──────────────────────────────────────────── */
  .vmatch-card {
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    overflow: hidden;
    background: #ffffff;
    margin-top: 0.75rem;
    box-shadow: 0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04);
    transition: border-color 0.14s;
  }
  .vmatch-card--open {
    border-color: rgba(99,102,241,0.25);
  }

  /* ── Header ────────────────────────────────────────────────────────────── */
  .vmatch-header {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.65rem 1rem;
    background: #f8fafc;
    border: none;
    cursor: pointer;
    color: #475569;
    font-size: 0.82rem;
    font-weight: 600;
    transition: background 0.12s, color 0.12s;
  }
  .vmatch-header:hover { background: #f1f5f9; color: #1e293b; }
  .vmatch-header__label {
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }
  .vmatch-badge {
    display: inline-flex;
    align-items: center;
    padding: 0.1rem 0.45rem;
    border-radius: 999px;
    background: #f1f5f9;
    color: #64748b;
    font-size: 0.7rem;
    font-weight: 700;
    border: 1px solid #e2e8f0;
  }
  .vmatch-badge--green {
    background: #f0fdf4;
    color: #16a34a;
    border-color: #bbf7d0;
  }
  .vmatch-header__chevron {
    font-size: 1.2rem;
    font-weight: 300;
    transition: transform 0.2s;
    display: inline-block;
    color: #94a3b8;
  }
  .vmatch-header__chevron.rotated { transform: rotate(90deg); }

  /* ── Body ───────────────────────────────────────────────────────────────── */
  .vmatch-body {
    border-top: 1px solid #e2e8f0;
    padding: 0.75rem 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.625rem;
    background: #ffffff;
  }

  /* ── Context pills ───────────────────────────────────────────────────────── */
  .vmatch-context {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.35rem;
    font-size: 0.75rem;
  }
  .vmatch-context__label {
    color: #94a3b8;
    font-size: 0.72rem;
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
    border-radius: 999px;
    font-size: 0.72rem;
    font-weight: 600;
    white-space: nowrap;
  }
  .vmatch-chip--sm { font-size: 0.68rem; padding: 0.15rem 0.4rem; }
  /* Dark-enough accent colours → readable on their light bg */
  .vmatch-chip--cat   { background: rgba(99,102,241,0.1);  color: #4f46e5; border: 1px solid rgba(99,102,241,0.2); }
  .vmatch-chip--mod   { background: rgba(14,165,233,0.08); color: #0284c7; border: 1px solid rgba(14,165,233,0.2); }
  .vmatch-chip--route { background: #f1f5f9;               color: #475569; border: 1px solid #e2e8f0; }

  /* ── States ──────────────────────────────────────────────────────────────── */
  .vmatch-error {
    font-size: 0.78rem;
    color: #dc2626;
    background: #fef2f2;
    border: 1px solid #fecaca;
    padding: 0.5rem 0.75rem;
    border-radius: 8px;
    font-weight: 600;
  }
  .vmatch-loading {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.8rem;
    color: #64748b;   /* dark-on-white → readable */
    padding: 0.5rem 0;
  }
  .vmatch-empty {
    font-size: 0.78rem;
    color: #64748b;   /* dark-on-white → readable */
    padding: 0.25rem 0;
  }
  .vmatch-empty a {
    color: #6366f1;
    text-decoration: underline;
    cursor: pointer;
  }
  .vmatch-empty a:hover { color: #4f46e5; }

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
    background: #f8fafc;
    border-radius: 8px;
    padding: 0.65rem 0.875rem;
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    border: 1px solid #e2e8f0;
    transition: border-color 0.12s, box-shadow 0.12s;
  }
  .vmatch-item:hover { border-color: #c7d2fe; box-shadow: 0 1px 4px rgba(99,102,241,0.08); }
  .vmatch-item:first-child { border-color: #bbf7d0; background: #f0fdf4; }
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
    font-size: 0.875rem;
    color: #0f172a;   /* dark on light-bg → high contrast */
    flex: 1;
  }
  .vmatch-site {
    font-size: 0.72rem;
    color: #6366f1;
    text-decoration: none;
    font-weight: 600;
  }
  .vmatch-site:hover { text-decoration: underline; color: #4f46e5; }

  .vmatch-contact {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    font-size: 0.78rem;
    color: #475569;   /* dark on light-bg → readable */
  }
  .vmatch-email { color: #6366f1; text-decoration: none; }
  .vmatch-email:hover { text-decoration: underline; color: #4f46e5; }
  .vmatch-phone { color: #94a3b8; }

  .vmatch-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
  }

  .vmatch-notes {
    font-size: 0.75rem;
    color: #64748b;   /* dark on light-bg → readable */
    font-style: italic;
    line-height: 1.4;
    margin-top: 0.1rem;
  }

  /* ── Spinner ─────────────────────────────────────────────────────────────── */
  .vmatch-spinner {
    display: inline-block;
    width: 12px;
    height: 12px;
    border: 1.5px solid #e2e8f0;
    border-top-color: #6366f1;
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
  }
  .vmatch-spinner--lg { width: 16px; height: 16px; }
  @keyframes spin { to { transform: rotate(360deg); } }
</style>
