<script lang="ts">
  /**
   * VendorMatchCard.svelte
   *
   * Self-contained widget that hits /api/vendors/match/:clientId and renders
   * the scored vendor list as a collapsible card inside the Insights tab.
   *
   * Additive-only: if no vendors are registered in Firestore the card
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
  /* ── Card shell ────────────── */
  .vmatch-card {
    border: 1px solid #1e293b;
    border-radius: 0.75rem;
    overflow: hidden;
    background: #0f172a;
    margin-top: 0.75rem;
  }
  .vmatch-card--open {
    border-color: rgba(14,165,233,0.3);
  }

  /* ── Header ────────────────── */
  .vmatch-header {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.65rem 1rem;
    background: transparent;
    border: none;
    cursor: pointer;
    color: #94a3b8;
    font-size: 0.82rem;
    font-weight: 600;
  }
  .vmatch-header:hover { background: rgba(255,255,255,0.04); color: #e2e8f0; }
  .vmatch-header__label {
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }
  .vmatch-badge {
    display: inline-block;
    padding: 0.1rem 0.4rem;
    border-radius: 999px;
    background: rgba(100,116,139,0.2);
    color: #64748b;
    font-size: 0.7rem;
    font-weight: 700;
  }
  .vmatch-badge--green {
    background: rgba(34,197,94,0.15);
    color: #86efac;
  }
  .vmatch-header__chevron {
    font-size: 1.2rem;
    font-weight: 300;
    transition: transform 0.2s;
    display: inline-block;
  }
  .vmatch-header__chevron.rotated { transform: rotate(90deg); }

  /* ── Body ──────────────────── */
  .vmatch-body {
    border-top: 1px solid #1e293b;
    padding: 0.75rem 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.625rem;
  }

  /* ── Context pills ──────────── */
  .vmatch-context {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.35rem;
    font-size: 0.75rem;
  }
  .vmatch-context__label {
    color: #64748b;
    font-size: 0.72rem;
  }

  /* ── Chips ─────────────────── */
  .vmatch-chip {
    display: inline-flex;
    align-items: center;
    gap: 0.2rem;
    padding: 0.2rem 0.5rem;
    border-radius: 999px;
    font-size: 0.72rem;
    font-weight: 600;
    white-space: nowrap;
  }
  .vmatch-chip--sm { font-size: 0.68rem; padding: 0.15rem 0.4rem; }
  .vmatch-chip--cat { background: rgba(99,102,241,0.12); color: #a5b4fc; }
  .vmatch-chip--mod { background: rgba(14,165,233,0.12); color: #38bdf8; }
  .vmatch-chip--route { background: rgba(100,116,139,0.12); color: #94a3b8; }

  /* ── States ────────────────── */
  .vmatch-error {
    font-size: 0.78rem;
    color: #fca5a5;
    background: rgba(239,68,68,0.08);
    padding: 0.5rem 0.75rem;
    border-radius: 0.5rem;
  }
  .vmatch-loading {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.8rem;
    color: #64748b;
    padding: 0.5rem 0;
  }
  .vmatch-empty {
    font-size: 0.78rem;
    color: #64748b;
    padding: 0.25rem 0;
  }
  .vmatch-empty a {
    color: #38bdf8;
    text-decoration: underline;
    cursor: pointer;
  }

  /* ── Vendor list ───────────── */
  .vmatch-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.625rem;
  }
  .vmatch-item {
    background: #1e293b;
    border-radius: 0.5rem;
    padding: 0.65rem 0.875rem;
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    border: 1px solid transparent;
  }
  .vmatch-item:first-child { border-color: rgba(34,197,94,0.2); }
  .vmatch-item--dim { opacity: 0.6; }

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
    color: #f1f5f9;
    flex: 1;
  }
  .vmatch-site {
    font-size: 0.72rem;
    color: #38bdf8;
    text-decoration: none;
  }
  .vmatch-site:hover { text-decoration: underline; }

  .vmatch-contact {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    font-size: 0.78rem;
    color: #94a3b8;
  }
  .vmatch-email {
    color: #38bdf8;
    text-decoration: none;
  }
  .vmatch-email:hover { text-decoration: underline; }
  .vmatch-phone { color: #64748b; }

  .vmatch-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
  }

  .vmatch-notes {
    font-size: 0.75rem;
    color: #64748b;
    font-style: italic;
    line-height: 1.4;
    margin-top: 0.1rem;
  }

  /* ── Spinner ───────────────── */
  .vmatch-spinner {
    display: inline-block;
    width: 12px;
    height: 12px;
    border: 1.5px solid rgba(255,255,255,0.15);
    border-top-color: #38bdf8;
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
  }
  .vmatch-spinner--lg { width: 16px; height: 16px; }
  @keyframes spin { to { transform: rotate(360deg); } }
</style>
