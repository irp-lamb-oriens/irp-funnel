<script lang="ts">
  import { onMount } from 'svelte';
  import { authToken, authEmail } from '../store.ts';
  import { get } from 'svelte/store';
  import VendorFormModal from './VendorFormModal.svelte';

  // ─── Types (mirroring server vendorTypes.ts) ──────────────────────────────

  type ServiceCategory = 'full_service' | 'self_pack_with_loading' | 'diy_no_loading';
  type VendorShippingModality = 'maritime' | 'air' | 'land';

  interface Vendor {
    id: string;
    companyName: string;
    contactName: string;
    email: string;
    phone?: string;
    website?: string;
    serviceCategories: ServiceCategory[];
    shippingModalities: VendorShippingModality[];
    originCountries: string[];
    destinationCountries: string[];
    notes?: string;
    active: boolean;
    createdAt: string;
    updatedAt: string;
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

  // ─── State ────────────────────────────────────────────────────────────────

  let vendors: Vendor[] = [];
  let isLoading = false;
  let fetchError = '';

  let searchQuery = '';
  let filterCategory: ServiceCategory | '' = '';
  let filterModality: VendorShippingModality | '' = '';
  let showInactive = false;

  let showModal = false;
  let editingVendor: Vendor | null = null;

  // ─── API helper ───────────────────────────────────────────────────────────

  function getApiUrl(): string {
    if (typeof window !== 'undefined' && window.location.origin.startsWith('http://localhost')) {
      return 'http://localhost:8000';
    }
    return 'https://irp-funnel-server.onrender.com';
  }

  async function apiFetch(path: string, options: RequestInit = {}): Promise<any> {
    const token = get(authToken);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    };
    if (token) headers['x-dashboard-token'] = token;
    const res = await fetch(`${getApiUrl()}${path}`, { ...options, headers });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
    return data;
  }

  // ─── Data ─────────────────────────────────────────────────────────────────

  async function loadVendors() {
    isLoading = true;
    fetchError = '';
    try {
      const params = new URLSearchParams();
      if (showInactive) params.set('includeInactive', 'true');
      if (filterCategory) params.set('serviceCategory', filterCategory);
      if (filterModality) params.set('modality', filterModality);
      const qs = params.toString() ? `?${params.toString()}` : '';
      const data = await apiFetch(`/api/vendors${qs}`);
      vendors = data.vendors || [];
    } catch (err: any) {
      fetchError = err.message;
    } finally {
      isLoading = false;
    }
  }

  async function toggleActive(vendor: Vendor) {
    try {
      if (vendor.active) {
        // soft-delete
        await apiFetch(`/api/vendors/${vendor.id}`, { method: 'DELETE' });
      } else {
        // re-activate
        await apiFetch(`/api/vendors/${vendor.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ active: true }),
        });
      }
      await loadVendors();
    } catch (err: any) {
      alert('Failed: ' + err.message);
    }
  }

  function openCreate() {
    editingVendor = null;
    showModal = true;
  }

  function openEdit(vendor: Vendor) {
    editingVendor = vendor;
    showModal = true;
  }

  function closeModal() {
    showModal = false;
    editingVendor = null;
  }

  async function handleSaved() {
    closeModal();
    await loadVendors();
  }

  onMount(() => {
    loadVendors();
  });

  // ─── Derived: filtered + searched list ───────────────────────────────────

  $: displayed = vendors.filter(v => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      v.companyName.toLowerCase().includes(q) ||
      v.contactName.toLowerCase().includes(q) ||
      v.email.toLowerCase().includes(q)
    );
  });
</script>

<!-- ─── Toolbar ──────────────────────────────────────────────────────────── -->
<div class="vendors-view">
  <div class="vendors-toolbar">
    <div class="vendors-toolbar__left">
      <h2 class="vendors-title">Vendors</h2>
      <span class="vendors-count">{displayed.length} provider{displayed.length === 1 ? '' : 's'}</span>
    </div>
    <div class="vendors-toolbar__right">
      <!-- Search -->
      <input
        class="vendors-search"
        type="text"
        placeholder="Search by name, contact, email…"
        bind:value={searchQuery}
      />

      <!-- Category filter -->
      <select class="vendors-filter" bind:value={filterCategory} on:change={loadVendors}>
        <option value="">All categories</option>
        {#each Object.entries(SERVICE_CATEGORY_LABEL) as [key, meta]}
          <option value={key}>{meta.icon} {meta.label}</option>
        {/each}
      </select>

      <!-- Modality filter -->
      <select class="vendors-filter" bind:value={filterModality} on:change={loadVendors}>
        <option value="">All modalities</option>
        {#each Object.entries(MODALITY_LABEL) as [key, meta]}
          <option value={key}>{meta.icon} {meta.label}</option>
        {/each}
      </select>

      <!-- Show inactive -->
      <label class="vendors-toggle-label">
        <input type="checkbox" bind:checked={showInactive} on:change={loadVendors} />
        Show inactive
      </label>

      <button class="vendors-add-btn" on:click={openCreate}>＋ Add Vendor</button>
    </div>
  </div>

  <!-- ─── Error ─────────────────────────────────────────────────────────── -->
  {#if fetchError}
    <div class="vendors-error" role="alert">{fetchError}</div>
  {/if}

  <!-- ─── Loading ───────────────────────────────────────────────────────── -->
  {#if isLoading}
    <div class="vendors-loading" role="status">
      <div class="spinner"></div>
      <span>Loading vendors…</span>
    </div>
  {:else if displayed.length === 0}
    <div class="vendors-empty" role="status">
      {#if vendors.length === 0}
        <p>No vendors registered yet.</p>
        <button class="vendors-add-btn vendors-add-btn--large" on:click={openCreate}>＋ Add your first vendor</button>
      {:else}
        <p>No vendors match your search.</p>
      {/if}
    </div>
  {:else}
    <!-- ─── Table ──────────────────────────────────────────────────────── -->
    <div class="vendors-table-wrap">
      <table class="vendors-table">
        <thead>
          <tr>
            <th>Company</th>
            <th>Contact</th>
            <th>Service Categories</th>
            <th>Modalities</th>
            <th>Countries</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {#each displayed as vendor (vendor.id)}
            <tr
              class="vendors-row"
              class:vendors-row--inactive={!vendor.active}
              on:click={() => openEdit(vendor)}
            >
              <td class="vendors-cell vendors-cell--company">
                <span class="vendor-company">{vendor.companyName}</span>
                {#if vendor.website}
                  <a
                    class="vendor-website"
                    href={vendor.website.startsWith('http') ? vendor.website : `https://${vendor.website}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    on:click|stopPropagation
                  >↗</a>
                {/if}
              </td>

              <td class="vendors-cell">
                <div class="vendor-contact">{vendor.contactName}</div>
                <div class="vendor-email">{vendor.email}</div>
                {#if vendor.phone}
                  <div class="vendor-phone">{vendor.phone}</div>
                {/if}
              </td>

              <td class="vendors-cell">
                <div class="chip-group">
                  {#each vendor.serviceCategories as cat}
                    {@const meta = SERVICE_CATEGORY_LABEL[cat]}
                    {#if meta}
                      <span class="chip chip--cat chip--{cat}">{meta.icon} {meta.label}</span>
                    {/if}
                  {/each}
                </div>
              </td>

              <td class="vendors-cell">
                <div class="chip-group">
                  {#each vendor.shippingModalities as mod}
                    {@const meta = MODALITY_LABEL[mod]}
                    {#if meta}
                      <span class="chip chip--mod chip--{mod}">{meta.icon} {meta.label}</span>
                    {/if}
                  {/each}
                </div>
              </td>

              <td class="vendors-cell vendors-cell--countries">
                {#if vendor.originCountries?.length || vendor.destinationCountries?.length}
                  <div class="countries-pair">
                    <span class="countries-label">From:</span>
                    <span class="countries-value">
                      {vendor.originCountries?.length ? vendor.originCountries.join(', ') : '—'}
                    </span>
                  </div>
                  <div class="countries-pair">
                    <span class="countries-label">To:</span>
                    <span class="countries-value">
                      {vendor.destinationCountries?.length ? vendor.destinationCountries.join(', ') : '—'}
                    </span>
                  </div>
                {:else}
                  <span class="countries-any">Any</span>
                {/if}
              </td>

              <td class="vendors-cell vendors-cell--status">
                <span class="status-pill status-pill--{vendor.active ? 'active' : 'inactive'}">
                  {vendor.active ? 'Active' : 'Inactive'}
                </span>
              </td>

              <td class="vendors-cell vendors-cell--actions" on:click|stopPropagation>
                <button
                  class="vendors-action-btn vendors-action-btn--toggle"
                  title={vendor.active ? 'Deactivate' : 'Reactivate'}
                  on:click={() => toggleActive(vendor)}
                >
                  {vendor.active ? '⏸' : '▶'}
                </button>
                <button
                  class="vendors-action-btn vendors-action-btn--edit"
                  title="Edit"
                  on:click={() => openEdit(vendor)}
                >
                  ✏️
                </button>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div>

<!-- ─── Create / Edit Modal ────────────────────────────────────────────────── -->
{#if showModal}
  <VendorFormModal
    vendor={editingVendor}
    on:saved={handleSaved}
    on:close={closeModal}
    {apiFetch}
  />
{/if}

<style>
  .vendors-view {
    padding: 1.5rem 2rem;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
    min-height: 0;
  }

  /* ── Toolbar ─────────────────── */
  .vendors-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 0.75rem;
  }
  .vendors-toolbar__left {
    display: flex;
    align-items: baseline;
    gap: 0.75rem;
  }
  .vendors-title { /* shared anatomy */ margin: 0; font-size: 1.375rem; font-weight: 800; line-height: 1.2; letter-spacing: -0.02em; color: var(--irp-text); }
  .vendors-count {
    font-size: var(--irp-fs-sm);
    color: var(--color-text-muted, var(--irp-text-dim));
  }
  .vendors-toolbar__right {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    flex-wrap: wrap;
  }
  .vendors-search {
    background: var(--irp-slate-900);
    border: 1px solid var(--irp-slate-700);
    border-radius: var(--irp-r-sm);
    color: var(--irp-slate-100);
    font-size: var(--irp-fs-md);
    padding: 0.45rem 0.75rem;
    width: 220px;
    outline: none;
    transition: border-color 0.2s;
  }
  .vendors-search:focus { border-color: var(--irp-blue-400); }
  .vendors-filter {
    background: var(--irp-slate-900);
    border: 1px solid var(--irp-slate-700);
    border-radius: var(--irp-r-sm);
    color: var(--irp-slate-100);
    font-size: var(--irp-fs-sm);
    padding: 0.45rem 0.6rem;
    outline: none;
    cursor: pointer;
  }
  .vendors-toggle-label {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    font-size: var(--irp-fs-sm);
    color: var(--irp-text-faint);
    cursor: pointer;
  }
  .vendors-add-btn {
    background: var(--irp-blue-500);
    color: var(--irp-text-inverse);
    border: none;
    border-radius: var(--irp-r-sm);
    padding: 0.45rem 0.9rem;
    font-size: var(--irp-fs-md);
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s;
  }
  .vendors-add-btn:hover { background: var(--irp-blue-600); }
  .vendors-add-btn--large {
    padding: 0.65rem 1.25rem;
    font-size: var(--irp-fs-lg);
  }

  /* ── Feedback states ─────────────── */
  .vendors-error {
    background: rgba(239,68,68,0.1);
    border: 1px solid rgba(239,68,68,0.3);
    color: var(--irp-red-300);
    padding: 0.75rem 1rem;
    border-radius: var(--irp-r-sm);
    font-size: var(--irp-fs-md);
  }
  .vendors-loading {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 2rem;
    color: var(--irp-text-faint);
    font-size: var(--irp-fs-md);
  }
  .vendors-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    padding: 3rem;
    color: var(--irp-text-dim);
    font-size: var(--irp-fs-sm);
    font-style: normal;
  }

  /* ── Table ───────────────────────── */
  .vendors-table-wrap {
    overflow-x: auto;
    border: 1px solid var(--irp-slate-800);
    border-radius: var(--irp-r-md);
  }
  .vendors-table {
    width: 100%;
    border-collapse: collapse;
    font-size: var(--irp-fs-md);
  }
  .vendors-table thead tr {
    background: var(--irp-slate-900);
    border-bottom: 1px solid var(--irp-slate-800);
  }
  .vendors-table th {
    padding: 0.6rem 0.875rem;
    text-align: left;
    font-size: var(--irp-fs-xs);
    font-weight: 600;
    color: var(--irp-text-dim);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    white-space: nowrap;
  }
  .vendors-row {
    border-bottom: 1px solid var(--irp-slate-800);
    cursor: pointer;
    transition: background 0.15s;
  }
  .vendors-row:hover { background: var(--irp-slate-800); }
  .vendors-row:last-child { border-bottom: none; }
  .vendors-row--inactive { opacity: 0.5; }
  .vendors-cell {
    padding: 0.65rem 0.875rem;
    vertical-align: top;
    color: var(--irp-slate-200);
  }

  /* Company */
  .vendors-cell--company { min-width: 160px; }
  .vendor-company {
    font-weight: 600;
    color: var(--irp-slate-100);
  }
  .vendor-website {
    margin-left: 0.4rem;
    font-size: var(--irp-fs-xs);
    color: var(--irp-blue-400);
    text-decoration: none;
  }
  .vendor-website:hover { text-decoration: underline; }

  /* Contact */
  .vendor-contact { font-weight: 500; color: var(--irp-slate-100); }
  .vendor-email   { font-size: var(--irp-fs-sm); color: var(--irp-text-faint); margin-top: 1px; }
  .vendor-phone   { font-size: var(--irp-fs-xs); color: var(--irp-text-dim); margin-top: 1px; }

  /* Chips */
  .chip-group {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem;
  }
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 0.2rem;
    padding: 0.2rem 0.5rem;
    border-radius: var(--irp-r-full);
    font-size: var(--irp-fs-xs);
    font-weight: 600;
    white-space: nowrap;
  }
  /* Category colors */
  .chip--full_service           { background: rgba(2,181,187,0.12); color: var(--irp-teal-500); }
  .chip--self_pack_with_loading { background: rgba(20,184,166,0.15); color: var(--irp-green-300); }
  .chip--diy_no_loading         { background: rgba(234,179,8,0.15);  color: var(--irp-amber-300); }
  /* Modality colors */
  .chip--maritime { background: rgba(14,165,233,0.15); color: var(--irp-blue-400); }
  .chip--air      { background: rgba(139,92,246,0.15); color: var(--irp-violet-300); }
  .chip--land     { background: rgba(249,115,22,0.15); color: var(--irp-amber-300); }

  /* Countries */
  .vendors-cell--countries { min-width: 140px; font-size: var(--irp-fs-sm); }
  .countries-pair {
    display: flex;
    gap: 0.3rem;
    align-items: baseline;
  }
  .countries-label { color: var(--irp-text-dim); font-size: var(--irp-fs-xs); }
  .countries-value { color: var(--irp-slate-300); }
  .countries-any   { color: var(--irp-text-dim); font-style: italic; }

  /* Status pill */
  .vendors-cell--status { white-space: nowrap; }
  .status-pill {
    display: inline-block;
    padding: 0.2rem 0.55rem;
    border-radius: var(--irp-r-full);
    font-size: var(--irp-fs-xs);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .status-pill--active   { background: rgba(34,197,94,0.15); color: var(--irp-green-300); }
  .status-pill--inactive { background: rgba(100,116,139,0.15); color: var(--irp-text-faint); }

  /* Row actions */
  .vendors-cell--actions {
    white-space: nowrap;
    text-align: right;
    padding-right: 0.75rem;
  }
  .vendors-action-btn {
    background: transparent;
    border: none;
    cursor: pointer;
    padding: 0.25rem 0.3rem;
    border-radius: var(--irp-r-xs);
    font-size: var(--irp-fs-md);
    opacity: 0.6;
    transition: opacity 0.15s, background 0.15s;
  }
  .vendors-action-btn:hover { opacity: 1; background: rgba(255,255,255,0.08); }

  /* Spinner */
  .spinner {
    width: 18px;
    height: 18px;
    border: 2px solid rgba(255,255,255,0.15);
    border-top-color: var(--irp-blue-400);
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
</style>
