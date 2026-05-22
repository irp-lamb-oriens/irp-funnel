<script lang="ts">
  /**
   * ProvidersView.svelte
   *
   * Full-featured provider registry panel inside the CRM dashboard.
   * Lets operators list, create, edit, deactivate, and delete providers.
   *
   * Service categories:
   *   full_service      — Full Service (empaque completo)
   *   diy_no_loading    — DIY / No Loading Assistance
   *   self_pack_loading — Self Pack with Loading
   *
   * Shipping modalities:
   *   maritime — Marítimo
   *   air      — Aéreo
   *   land     — Terrestre
   */
  import { onMount } from 'svelte';
  import { authToken } from '../store.ts';

  // ── Constants ────────────────────────────────────────────────────────────

  const SERVICE_CATEGORY_OPTIONS = [
    { value: 'full_service',      label: 'Full Service (empaque completo)' },
    { value: 'diy_no_loading',    label: 'DIY — No Loading Assistance'     },
    { value: 'self_pack_loading', label: 'Self Pack with Loading'           },
  ];

  const SHIPPING_MODALITY_OPTIONS = [
    { value: 'maritime', label: '🚢 Marítimo (Maritime)' },
    { value: 'air',      label: '✈️ Aéreo (Air)'        },
    { value: 'land',     label: '🚛 Terrestre (Land)'   },
  ];

  const CATEGORY_EMOJI: Record<string, string> = {
    full_service:      '🛡️',
    diy_no_loading:    '👤',
    self_pack_loading: '👥',
  };

  const MODALITY_EMOJI: Record<string, string> = {
    maritime: '🚢',
    air:      '✈️',
    land:     '🚛',
  };

  // ── API ───────────────────────────────────────────────────────────────────

  function getApiUrl(): string {
    if (typeof window !== 'undefined' && window.location.origin.startsWith('http://localhost')) {
      return 'http://localhost:8000';
    }
    return 'https://irp-funnel-server.onrender.com';
  }

  async function apiFetch(path: string, options: RequestInit = {}) {
    const token = $authToken;
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

  // ── State ─────────────────────────────────────────────────────────────────

  type Provider = {
    id: string;
    name: string;
    email: string;
    phone?: string;
    website?: string;
    contactPerson?: string;
    serviceCategories: string[];
    shippingModalities: string[];
    originRegions?: string[];
    destinationRegions?: string[];
    notes?: string;
    active: boolean;
    createdAt: string;
    createdBy: string;
    updatedAt?: string;
  };

  let providers: Provider[] = [];
  let loading = false;
  let error = '';
  let success = '';

  // Filters
  let filterCategory = '';
  let filterModality = '';
  let filterActiveOnly = true;

  // Form state
  let showForm = false;
  let editingId: string | null = null;

  // Form fields
  let form = emptyForm();

  function emptyForm() {
    return {
      name: '',
      email: '',
      phone: '',
      website: '',
      contactPerson: '',
      serviceCategories: [] as string[],
      shippingModalities: [] as string[],
      originRegions: '',
      destinationRegions: '',
      notes: '',
    };
  }

  // ── Computed ──────────────────────────────────────────────────────────────

  $: filteredProviders = providers.filter(p => {
    if (filterActiveOnly && !p.active) return false;
    if (filterCategory && !(p.serviceCategories || []).includes(filterCategory)) return false;
    if (filterModality && !(p.shippingModalities || []).includes(filterModality)) return false;
    return true;
  });

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  onMount(async () => {
    await loadProviders();
  });

  async function loadProviders() {
    loading = true;
    error = '';
    try {
      const data = await apiFetch('/api/dashboard/providers');
      providers = data.providers || [];
    } catch (err: any) {
      error = err.message;
    } finally {
      loading = false;
    }
  }

  // ── CRUD ──────────────────────────────────────────────────────────────────

  async function saveProvider() {
    error = '';
    success = '';

    if (!form.name.trim()) { error = 'Name is required.'; return; }
    if (!form.email.trim() || !form.email.includes('@')) { error = 'Valid email is required.'; return; }
    if (form.serviceCategories.length === 0) { error = 'Select at least one service category.'; return; }
    if (form.shippingModalities.length === 0) { error = 'Select at least one shipping modality.'; return; }

    const payload: Record<string, any> = {
      name: form.name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim() || undefined,
      website: form.website.trim() || undefined,
      contactPerson: form.contactPerson.trim() || undefined,
      serviceCategories: form.serviceCategories,
      shippingModalities: form.shippingModalities,
      notes: form.notes.trim() || undefined,
      originRegions: form.originRegions
        ? form.originRegions.split(',').map((s: string) => s.trim()).filter(Boolean)
        : undefined,
      destinationRegions: form.destinationRegions
        ? form.destinationRegions.split(',').map((s: string) => s.trim()).filter(Boolean)
        : undefined,
    };

    try {
      loading = true;
      if (editingId) {
        await apiFetch(`/api/dashboard/providers/${editingId}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        success = 'Provider updated.';
      } else {
        await apiFetch('/api/dashboard/providers', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        success = 'Provider created.';
      }
      cancelForm();
      await loadProviders();
    } catch (err: any) {
      error = err.message;
    } finally {
      loading = false;
    }
  }

  function startEdit(p: Provider) {
    editingId = p.id;
    form = {
      name: p.name || '',
      email: p.email || '',
      phone: p.phone || '',
      website: p.website || '',
      contactPerson: p.contactPerson || '',
      serviceCategories: [...(p.serviceCategories || [])],
      shippingModalities: [...(p.shippingModalities || [])],
      originRegions: (p.originRegions || []).join(', '),
      destinationRegions: (p.destinationRegions || []).join(', '),
      notes: p.notes || '',
    };
    showForm = true;
    error = '';
    success = '';
  }

  function cancelForm() {
    showForm = false;
    editingId = null;
    form = emptyForm();
    error = '';
  }

  async function toggleActive(p: Provider) {
    try {
      await apiFetch(`/api/dashboard/providers/${p.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ active: !p.active }),
      });
      providers = providers.map(pr => pr.id === p.id ? { ...pr, active: !pr.active } : pr);
    } catch (err: any) {
      error = err.message;
    }
  }

  async function deleteProvider(p: Provider) {
    if (!confirm(`Delete provider "${p.name}"? This cannot be undone.`)) return;
    try {
      await apiFetch(`/api/dashboard/providers/${p.id}`, { method: 'DELETE' });
      providers = providers.filter(pr => pr.id !== p.id);
      success = 'Provider deleted.';
    } catch (err: any) {
      error = err.message;
    }
  }

  function toggleCheckbox(arr: string[], value: string): string[] {
    return arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value];
  }
</script>

<div class="providers-view">
  <!-- Header -->
  <div class="providers-header">
    <div class="providers-title-group">
      <h2>🏢 Provider Registry</h2>
      <p class="providers-subtitle">
        Shipping and relocation companies for quote requests
      </p>
    </div>
    <button class="btn-primary" on:click={() => { showForm = !showForm; editingId = null; form = emptyForm(); error = ''; }}>
      {showForm && !editingId ? '✕ Cancel' : '+ Add Provider'}
    </button>
  </div>

  <!-- Alerts -->
  {#if error}
    <div class="alert alert-error">{error}</div>
  {/if}
  {#if success}
    <div class="alert alert-success">{success}</div>
  {/if}

  <!-- Create / Edit Form -->
  {#if showForm}
    <div class="providers-form-card">
      <h3>{editingId ? '✏️ Edit Provider' : '➕ New Provider'}</h3>

      <div class="form-grid">
        <!-- Basic Info -->
        <div class="form-field">
          <label>Name *</label>
          <input bind:value={form.name} placeholder="Shipping Co. Name" />
        </div>
        <div class="form-field">
          <label>Contact Email *</label>
          <input bind:value={form.email} type="email" placeholder="contact@shippingco.com" />
        </div>
        <div class="form-field">
          <label>Phone</label>
          <input bind:value={form.phone} placeholder="+1 (555) 000-0000" />
        </div>
        <div class="form-field">
          <label>Website</label>
          <input bind:value={form.website} placeholder="https://shippingco.com" />
        </div>
        <div class="form-field form-field--full">
          <label>Contact Person</label>
          <input bind:value={form.contactPerson} placeholder="e.g. Juan Arias" />
        </div>

        <!-- Service Categories -->
        <div class="form-field form-field--full">
          <label>Service Categories * <span class="hint">(what they offer)</span></label>
          <div class="checkbox-group">
            {#each SERVICE_CATEGORY_OPTIONS as opt}
              <label class="checkbox-label" class:checked={form.serviceCategories.includes(opt.value)}>
                <input
                  type="checkbox"
                  checked={form.serviceCategories.includes(opt.value)}
                  on:change={() => form.serviceCategories = toggleCheckbox(form.serviceCategories, opt.value)}
                />
                {CATEGORY_EMOJI[opt.value]} {opt.label}
              </label>
            {/each}
          </div>
        </div>

        <!-- Shipping Modalities -->
        <div class="form-field form-field--full">
          <label>Shipping Modalities * <span class="hint">(transport modes they support)</span></label>
          <div class="checkbox-group">
            {#each SHIPPING_MODALITY_OPTIONS as opt}
              <label class="checkbox-label" class:checked={form.shippingModalities.includes(opt.value)}>
                <input
                  type="checkbox"
                  checked={form.shippingModalities.includes(opt.value)}
                  on:change={() => form.shippingModalities = toggleCheckbox(form.shippingModalities, opt.value)}
                />
                {opt.label}
              </label>
            {/each}
          </div>
        </div>

        <!-- Regions -->
        <div class="form-field">
          <label>Origin Regions <span class="hint">(comma-separated)</span></label>
          <input bind:value={form.originRegions} placeholder="USA, Canada, Mexico" />
        </div>
        <div class="form-field">
          <label>Destination Regions <span class="hint">(comma-separated)</span></label>
          <input bind:value={form.destinationRegions} placeholder="Costa Rica, Panama, Spain" />
        </div>

        <!-- Notes -->
        <div class="form-field form-field--full">
          <label>Internal Notes</label>
          <textarea bind:value={form.notes} rows="3" placeholder="E.g. preferred for LCL, slow response times for ocean FCL…"></textarea>
        </div>
      </div>

      <div class="form-actions">
        <button class="btn-primary" on:click={saveProvider} disabled={loading}>
          {loading ? 'Saving…' : editingId ? '💾 Update Provider' : '➕ Create Provider'}
        </button>
        <button class="btn-ghost" on:click={cancelForm}>Cancel</button>
      </div>
    </div>
  {/if}

  <!-- Filters -->
  <div class="providers-filters">
    <label class="filter-toggle">
      <input type="checkbox" bind:checked={filterActiveOnly} />
      Active only
    </label>

    <div class="filter-select-group">
      <select bind:value={filterCategory}>
        <option value="">All service categories</option>
        {#each SERVICE_CATEGORY_OPTIONS as opt}
          <option value={opt.value}>{CATEGORY_EMOJI[opt.value]} {opt.label}</option>
        {/each}
      </select>

      <select bind:value={filterModality}>
        <option value="">All modalities</option>
        {#each SHIPPING_MODALITY_OPTIONS as opt}
          <option value={opt.value}>{opt.label}</option>
        {/each}
      </select>
    </div>

    <span class="filter-count">{filteredProviders.length} provider{filteredProviders.length !== 1 ? 's' : ''}</span>
  </div>

  <!-- Table -->
  {#if loading && providers.length === 0}
    <div class="providers-loading">Loading providers…</div>
  {:else if filteredProviders.length === 0}
    <div class="providers-empty">
      {providers.length === 0
        ? 'No providers registered yet. Click "+ Add Provider" to get started.'
        : 'No providers match the current filters.'}
    </div>
  {:else}
    <div class="providers-table-wrap">
      <table class="providers-table">
        <thead>
          <tr>
            <th>Provider</th>
            <th>Service Categories</th>
            <th>Modalities</th>
            <th>Regions</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {#each filteredProviders as p (p.id)}
            <tr class:inactive={!p.active}>
              <td>
                <div class="provider-name">{p.name}</div>
                <div class="provider-meta">{p.email}</div>
                {#if p.contactPerson}
                  <div class="provider-meta">👤 {p.contactPerson}</div>
                {/if}
                {#if p.phone}
                  <div class="provider-meta">📞 {p.phone}</div>
                {/if}
              </td>
              <td>
                <div class="tag-list">
                  {#each (p.serviceCategories || []) as cat}
                    <span class="tag tag-cat">{CATEGORY_EMOJI[cat] || ''} {SERVICE_CATEGORY_OPTIONS.find(o => o.value === cat)?.label ?? cat}</span>
                  {/each}
                </div>
              </td>
              <td>
                <div class="tag-list">
                  {#each (p.shippingModalities || []) as mod}
                    <span class="tag tag-mod">{MODALITY_EMOJI[mod] || ''} {SHIPPING_MODALITY_OPTIONS.find(o => o.value === mod)?.label ?? mod}</span>
                  {/each}
                </div>
              </td>
              <td>
                {#if (p.originRegions || []).length > 0}
                  <div class="provider-meta"><strong>From:</strong> {p.originRegions?.join(', ')}</div>
                {/if}
                {#if (p.destinationRegions || []).length > 0}
                  <div class="provider-meta"><strong>To:</strong> {p.destinationRegions?.join(', ')}</div>
                {/if}
              </td>
              <td>
                <span class="status-pill" class:active={p.active} class:inactive={!p.active}>
                  {p.active ? '✅ Active' : '⏸ Inactive'}
                </span>
              </td>
              <td>
                <div class="row-actions">
                  <button class="btn-icon" title="Edit" on:click={() => startEdit(p)}>✏️</button>
                  <button
                    class="btn-icon"
                    title={p.active ? 'Deactivate' : 'Activate'}
                    on:click={() => toggleActive(p)}
                  >
                    {p.active ? '⏸' : '▶️'}
                  </button>
                  <button class="btn-icon btn-danger" title="Delete" on:click={() => deleteProvider(p)}>🗑️</button>
                </div>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div>

<style>
  .providers-view {
    padding: 24px;
    max-width: 1200px;
    margin: 0 auto;
  }

  .providers-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    margin-bottom: 20px;
    gap: 16px;
    flex-wrap: wrap;
  }

  .providers-title-group h2 {
    margin: 0 0 4px;
    font-size: 22px;
    font-weight: 700;
    color: #111;
  }

  .providers-subtitle {
    margin: 0;
    font-size: 14px;
    color: #6b7280;
  }

  /* ── Buttons ─────────────────────────────────────────────── */
  .btn-primary {
    background: #060D0D;
    color: #fff;
    border: none;
    padding: 10px 20px;
    border-radius: 8px;
    font-weight: 600;
    font-size: 14px;
    cursor: pointer;
    transition: opacity 0.15s;
    white-space: nowrap;
  }
  .btn-primary:hover { opacity: 0.85; }
  .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

  .btn-ghost {
    background: transparent;
    color: #374151;
    border: 1px solid #d1d5db;
    padding: 10px 20px;
    border-radius: 8px;
    font-weight: 500;
    font-size: 14px;
    cursor: pointer;
  }
  .btn-ghost:hover { background: #f3f4f6; }

  .btn-icon {
    background: none;
    border: none;
    font-size: 16px;
    cursor: pointer;
    padding: 4px 6px;
    border-radius: 6px;
    transition: background 0.12s;
  }
  .btn-icon:hover { background: #f3f4f6; }
  .btn-icon.btn-danger:hover { background: #fee2e2; }

  /* ── Alerts ─────────────────────────────────────────────── */
  .alert {
    padding: 12px 16px;
    border-radius: 8px;
    font-size: 14px;
    margin-bottom: 16px;
  }
  .alert-error   { background: #fee2e2; color: #b91c1c; border: 1px solid #fca5a5; }
  .alert-success { background: #d1fae5; color: #065f46; border: 1px solid #6ee7b7; }

  /* ── Form card ───────────────────────────────────────────── */
  .providers-form-card {
    background: #fff;
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    padding: 24px;
    margin-bottom: 24px;
  }
  .providers-form-card h3 {
    margin: 0 0 20px;
    font-size: 17px;
    font-weight: 700;
    color: #111;
  }
  .form-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
    margin-bottom: 20px;
  }
  .form-field label {
    display: block;
    font-size: 13px;
    font-weight: 600;
    color: #374151;
    margin-bottom: 6px;
  }
  .form-field .hint {
    font-weight: 400;
    color: #9ca3af;
    font-size: 12px;
    margin-left: 4px;
  }
  .form-field input,
  .form-field textarea,
  .form-field select {
    width: 100%;
    padding: 9px 12px;
    border: 1px solid #d1d5db;
    border-radius: 8px;
    font-size: 14px;
    color: #111;
    background: #fafafa;
    box-sizing: border-box;
  }
  .form-field input:focus,
  .form-field textarea:focus {
    outline: none;
    border-color: #6366f1;
    background: #fff;
  }
  .form-field--full { grid-column: 1 / -1; }

  .checkbox-group {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  }
  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: #374151;
    padding: 8px 14px;
    border: 1px solid #d1d5db;
    border-radius: 8px;
    cursor: pointer;
    background: #fafafa;
    transition: all 0.1s;
    user-select: none;
  }
  .checkbox-label.checked {
    border-color: #6366f1;
    background: #eef2ff;
    color: #4338ca;
    font-weight: 600;
  }
  .checkbox-label input[type="checkbox"] {
    width: auto;
    padding: 0;
  }

  .form-actions {
    display: flex;
    gap: 12px;
    align-items: center;
  }

  /* ── Filters ──────────────────────────────────────────────── */
  .providers-filters {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-bottom: 20px;
    flex-wrap: wrap;
  }
  .filter-toggle {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    color: #374151;
    cursor: pointer;
    font-weight: 500;
  }
  .filter-select-group {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
  }
  .filter-select-group select {
    padding: 7px 12px;
    border: 1px solid #d1d5db;
    border-radius: 8px;
    font-size: 13px;
    color: #374151;
    background: #fff;
    cursor: pointer;
  }
  .filter-count {
    font-size: 13px;
    color: #6b7280;
    margin-left: auto;
  }

  /* ── Table ────────────────────────────────────────────────── */
  .providers-table-wrap {
    overflow-x: auto;
    border: 1px solid #e5e7eb;
    border-radius: 12px;
  }
  .providers-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 14px;
  }
  .providers-table th {
    background: #f9fafb;
    padding: 11px 16px;
    text-align: left;
    font-size: 12px;
    font-weight: 600;
    color: #6b7280;
    text-transform: uppercase;
    letter-spacing: 0.4px;
    border-bottom: 1px solid #e5e7eb;
  }
  .providers-table td {
    padding: 12px 16px;
    border-bottom: 1px solid #f3f4f6;
    vertical-align: top;
  }
  .providers-table tr:last-child td { border-bottom: none; }
  .providers-table tr.inactive td { opacity: 0.55; }

  .provider-name {
    font-weight: 600;
    color: #111;
    margin-bottom: 2px;
  }
  .provider-meta {
    font-size: 12px;
    color: #6b7280;
    margin-top: 2px;
    line-height: 1.5;
  }

  /* ── Tags ─────────────────────────────────────────────────── */
  .tag-list { display: flex; flex-wrap: wrap; gap: 6px; }
  .tag {
    display: inline-block;
    padding: 3px 9px;
    border-radius: 20px;
    font-size: 11px;
    font-weight: 600;
    white-space: nowrap;
  }
  .tag-cat {
    background: #ede9fe;
    color: #5b21b6;
    border: 1px solid #ddd6fe;
  }
  .tag-mod {
    background: #dbeafe;
    color: #1e40af;
    border: 1px solid #bfdbfe;
  }

  /* ── Status pill ─────────────────────────────────────────── */
  .status-pill {
    display: inline-block;
    padding: 4px 10px;
    border-radius: 20px;
    font-size: 12px;
    font-weight: 600;
  }
  .status-pill.active   { background: #d1fae5; color: #065f46; }
  .status-pill.inactive { background: #f3f4f6; color: #6b7280; }

  /* ── Row actions ─────────────────────────────────────────── */
  .row-actions { display: flex; gap: 4px; align-items: center; }

  /* ── Empty / loading states ──────────────────────────────── */
  .providers-empty,
  .providers-loading {
    text-align: center;
    padding: 48px 24px;
    color: #6b7280;
    font-size: 15px;
    background: #f9fafb;
    border: 1px dashed #e5e7eb;
    border-radius: 12px;
  }
</style>
