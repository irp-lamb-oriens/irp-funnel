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
  import StarRating from './StarRating.svelte';


  // ── Constants ────────────────────────────────────────────────────────────

  // ── Service category options ─────────────────────────────────────────────
  // Original values first (A–D), then extended values.
  // Labels are English and match providersRouter.ts SERVICE_CATEGORY_LABELS.
  const SERVICE_CATEGORY_OPTIONS = [
    // Original
    { value: 'full_service',      label: 'A — Full Service (full professional pack & load)' },
    { value: 'diy_no_loading',    label: 'B — DIY — No Loading Assistance'                  },
    { value: 'self_pack_loading', label: 'C — Self Pack with Loading'                        },
    { value: 'external',          label: 'D — External / Custom Partner'                     },
    // Extended (additive — backward-compatible)
    { value: 'freight_only',      label: 'FLETE — Freight Only (sea / road)'                 },
    { value: 'customs_brokerage', label: 'Aduanas — Customs Brokerage'                       },
    { value: 'packing_only',      label: 'Packing & Delivery (destination-side)'             },
    { value: 'inland_transport',  label: 'Inland Transport (local / regional)'               },
  ];

  const SHIPPING_MODALITY_OPTIONS = [
    { value: 'maritime', label: '🚢 Marítimo (Maritime)' },
    { value: 'air',      label: '✈️ Aéreo (Air)'        },
    { value: 'land',     label: '🚛 Terrestre (Land)'   },
  ];

  const CATEGORY_EMOJI: Record<string, string> = {
    // Original
    full_service:      '🛡️',
    diy_no_loading:    '👤',
    self_pack_loading: '👥',
    external:          '🤝',
    // Extended
    freight_only:      '🚢',
    customs_brokerage: '🛃',
    packing_only:      '📦',
    inland_transport:  '🚛',
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
    /** Free-form custom fields; keys are globally tracked via field-schema. */
    customFields?: Record<string, string>;
    originRegions?: string[];
    destinationRegions?: string[];
    notes?: string;
    /** Operator quality score 0–5 (half-star steps); null/undefined = unrated. */
    score?: number | null;
    active: boolean;
    createdAt: string;
    createdBy: string;
    updatedAt?: string;
  };


  let providers: Provider[] = [];
  let loading = false;
  let error = '';
  let success = '';

  // ── Search + Filters ─────────────────────────────────────────────────────
  let searchQuery      = '';
  let filterCategory   = '';
  let filterModality   = '';
  let filterActiveOnly = true;

  // Form state
  let showForm = false;
  let editingId: string | null = null;

  /**
   * Globally known custom field names — fetched from /field-schema.
   * Every new field name ever added to any provider appears here so the
   * form can pre-render all known fields (blank) on every provider.
   */
  let knownCustomFieldNames: string[] = [];

  /**
   * Current form's custom field values.
   * Keys come from knownCustomFieldNames + any pre-existing provider fields.
   */
  let formCustomFields: Record<string, string> = {};

  /** Label for the "Add field" UI — the new field name being typed. */
  let newCustomFieldName = '';

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
      score: null as number | null,
    };
  }


  // ── Computed ──────────────────────────────────────────────────────────────

  $: filteredProviders = (() => {
    const q = searchQuery.trim().toLowerCase();
    return providers.filter(p => {
      if (filterActiveOnly && !p.active) return false;
      if (filterCategory && !(p.serviceCategories || []).includes(filterCategory)) return false;
      if (filterModality && !(p.shippingModalities || []).includes(filterModality)) return false;
      if (!q) return true;
      // search across name, email, contactPerson, origin regions, notes and custom-field values
      const haystack = [
        p.name,
        p.email,
        p.contactPerson,
        ...(p.originRegions ?? []),
        ...(p.destinationRegions ?? []),
        p.notes,
        ...Object.values(p.customFields ?? {}),
      ].join(' ').toLowerCase();
      return haystack.includes(q);
    });
  })();

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  onMount(async () => {
    await Promise.all([loadProviders(), loadFieldSchema()]);
  });

  async function loadFieldSchema() {
    try {
      const data = await apiFetch('/api/dashboard/providers/field-schema');
      knownCustomFieldNames = data.fields ?? [];
      // Seed formCustomFields with blank values for all known fields
      for (const name of knownCustomFieldNames) {
        if (!(name in formCustomFields)) formCustomFields[name] = '';
      }
    } catch {
      // non-fatal — field schema is enhancement, not required
    }
  }

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

    // Collect non-empty custom fields
    const customFieldsPayload: Record<string, string> = {};
    for (const [k, v] of Object.entries(formCustomFields)) {
      if (k.trim() && v.trim()) customFieldsPayload[k.trim()] = v.trim();
    }

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
      score: typeof form.score === 'number' ? form.score : null,
      ...(Object.keys(customFieldsPayload).length > 0 ? { customFields: customFieldsPayload } : {}),
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
      score: p.score ?? null,
    };
    // Merge: start with blanks for all known fields, then fill in provider's actual values

    formCustomFields = {};
    for (const name of knownCustomFieldNames) formCustomFields[name] = '';
    for (const [k, v] of Object.entries(p.customFields ?? {})) {
      formCustomFields[k] = String(v);
    }
    showForm = true;
    error = '';
    success = '';
  }

  function cancelForm() {
    showForm = false;
    editingId = null;
    form = emptyForm();
    // Reset custom fields to blank stubs for known names
    formCustomFields = {};
    for (const name of knownCustomFieldNames) formCustomFields[name] = '';
    newCustomFieldName = '';
    error = '';
  }

  function addCustomFieldRow() {
    const name = newCustomFieldName.trim();
    if (!name) return;
    formCustomFields[name] = '';
    formCustomFields = { ...formCustomFields }; // trigger reactivity
    // Add to known names locally so all rows stay in sync
    if (!knownCustomFieldNames.includes(name)) {
      knownCustomFieldNames = [...knownCustomFieldNames, name].sort();
    }
    newCustomFieldName = '';
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

  /**
   * Inline score update from the table — optimistic, non-blocking.
   * Persists via PATCH; reverts on failure.
   */
  async function setScoreInline(p: Provider, next: number) {
    const prev = p.score ?? null;
    providers = providers.map(pr => pr.id === p.id ? { ...pr, score: next } : pr);
    try {
      await apiFetch(`/api/dashboard/providers/${p.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ score: next }),
      });
    } catch (err: any) {
      // revert on failure
      providers = providers.map(pr => pr.id === p.id ? { ...pr, score: prev } : pr);
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
        <div class="form-field">
          <label>Contact Person</label>
          <input bind:value={form.contactPerson} placeholder="e.g. Juan Arias" />
        </div>
        <div class="form-field">
          <label>Quality Score <span class="hint">(drag the stars)</span></label>
          <div class="score-field">
            <StarRating
              value={form.score}
              size={24}
              on:change={(e) => form.score = e.detail}
            />
          </div>
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

        <!-- Custom Fields ─ grow organically; every key ever added appears on all future providers -->
        <div class="form-field form-field--full">
          <label>
            Additional Fields
            <span class="hint"> — any field added here becomes available on all providers</span>
          </label>
          {#if Object.keys(formCustomFields).length > 0}
            <div class="custom-fields-grid">
              {#each Object.keys(formCustomFields) as fieldName (fieldName)}
                <div class="custom-field-row">
                  <span class="custom-field-name">{fieldName}</span>
                  <input
                    bind:value={formCustomFields[fieldName]}
                    placeholder="(leave blank to skip)"
                    class="custom-field-input"
                  />
                </div>
              {/each}
            </div>
          {/if}
          <div class="custom-field-add-row">
            <input
              bind:value={newCustomFieldName}
              placeholder="New field name (e.g. Port of Origin)"
              class="custom-field-name-input"
              on:keydown={(e) => e.key === 'Enter' && (e.preventDefault(), addCustomFieldRow())}
            />
            <button type="button" class="btn-add-field" on:click={addCustomFieldRow} disabled={!newCustomFieldName.trim()}>
              + Add Field
            </button>
          </div>
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

  <!-- Search bar -->
  <div class="providers-search-wrap">
    <div class="providers-search-inner" class:has-value={searchQuery.length > 0}>
      <!-- magnifying glass -->
      <svg class="providers-search-icon" xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
      </svg>
      <input
        class="providers-search-input"
        type="search"
        bind:value={searchQuery}
        placeholder="Search providers — name, email, contact, region…"
        autocomplete="off"
        autocorrect="off"
        spellcheck="false"
      />
      {#if searchQuery}
        <button
          class="providers-search-clear"
          type="button"
          title="Clear search"
          on:click={() => searchQuery = ''}
          aria-label="Clear search"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      {/if}
    </div>
  </div>

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
            <th>Score</th>
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
                <StarRating
                  value={p.score}
                  size={17}
                  on:change={(e) => setScoreInline(p, e.detail)}
                />
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

  /* ── Search bar ──────────────────────────────────────────── */
  .providers-search-wrap {
    margin-bottom: 14px;
  }

  .providers-search-inner {
    position: relative;
    display: flex;
    align-items: center;
    background: #fff;
    border: 1.5px solid #e5e7eb;
    border-radius: 12px;
    padding: 0 14px;
    height: 46px;
    gap: 10px;
    transition: border-color 0.18s, box-shadow 0.18s;
    box-shadow: 0 1px 3px rgba(0,0,0,0.05);
  }
  .providers-search-inner:focus-within {
    border-color: #02b5bb;
    box-shadow: 0 0 0 3px rgba(2,181,187,0.12), 0 1px 4px rgba(0,0,0,0.06);
  }
  .providers-search-inner.has-value {
    border-color: #a5b4fc;
  }

  .providers-search-icon {
    color: #9ca3af;
    flex-shrink: 0;
    transition: color 0.18s;
    pointer-events: none;
  }
  .providers-search-inner:focus-within .providers-search-icon {
    color: #02b5bb;
  }

  .providers-search-input {
    flex: 1;
    border: none;
    background: transparent;
    font-size: 14.5px;
    color: #111;
    outline: none;
    padding: 0;
    min-width: 0;
    font-family: inherit;
    /* suppress browser default search cancel button */
  }
  .providers-search-input::placeholder {
    color: #b0b7c3;
    font-weight: 400;
  }
  /* remove browser-native ✕ from <input type="search"> */
  .providers-search-input::-webkit-search-cancel-button,
  .providers-search-input::-webkit-search-decoration {
    -webkit-appearance: none;
    display: none;
  }

  .providers-search-clear {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    border: none;
    border-radius: 6px;
    background: #f3f4f6;
    color: #6b7280;
    cursor: pointer;
    flex-shrink: 0;
    padding: 0;
    transition: background 0.12s, color 0.12s;
  }
  .providers-search-clear:hover {
    background: #e5e7eb;
    color: #111;
  }

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
    padding: 10px 12px;
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
    border-color: #02b5bb;
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
    border-color: #02b5bb;
    background: rgba(2,181,187,0.08);
    color: #0b3b3d;
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
    padding: 3px 10px;
    border-radius: 20px;
    font-size: 11px;
    font-weight: 600;
    white-space: nowrap;
  }
  .tag-cat {
    background: #ede9fe;
    color: #02b5bb;
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

  /* ── Custom fields ────────────────────────────────────────── */
  .custom-fields-grid {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 10px;
  }
  .custom-field-row {
    display: grid;
    grid-template-columns: 200px 1fr;
    align-items: center;
    gap: 10px;
  }
  .custom-field-name {
    font-size: 13px;
    font-weight: 600;
    color: #374151;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    padding: 10px 0 10px 4px;
  }
  .custom-field-input {
    padding: 10px 12px !important;
    border: 1px solid #d1d5db !important;
    border-radius: 8px !important;
    font-size: 14px !important;
    color: #111 !important;
    background: #fafafa !important;
    width: 100% !important;
    box-sizing: border-box !important;
  }
  .custom-field-add-row {
    display: flex;
    gap: 8px;
    align-items: center;
    margin-top: 4px;
    flex-wrap: wrap;
  }
  .custom-field-name-input {
    flex: 1;
    min-width: 180px;
    padding: 10px 12px;
    border: 1px dashed #02b5bb;
    border-radius: 8px;
    font-size: 13px;
    color: #111;
    background: #f5f3ff;
    outline: none;
  }
  .custom-field-name-input:focus {
    border-style: solid;
    border-color: #02b5bb;
    background: #fff;
  }
  .btn-add-field {
    background: rgba(2,181,187,0.08);
    color: #0b3b3d;
    border: 1px solid #9fe3e6;
    padding: 10px 16px;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    white-space: nowrap;
    transition: background 0.12s;
  }
  .btn-add-field:hover:not(:disabled) { background: #e0e7ff; }
  .btn-add-field:disabled { opacity: 0.45; cursor: not-allowed; }
</style>
