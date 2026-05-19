<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  const dispatch = createEventDispatcher<{ saved: void; close: void }>();

  // ─── Types ─────────────────────────────────────────────────────────────────

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

  const SERVICE_CATEGORIES: { key: ServiceCategory; icon: string; label: string; description: string }[] = [
    {
      key: 'full_service',
      icon: '🛡️',
      label: 'Full Service',
      description: 'IRP crew brings materials, packs AND loads the container.',
    },
    {
      key: 'self_pack_with_loading',
      icon: '👥',
      label: 'Self Pack + Loading',
      description: 'Client packs; vendor crew loads the container.',
    },
    {
      key: 'diy_no_loading',
      icon: '📦',
      label: 'DIY — No Loading',
      description: 'Client packs AND loads entirely on their own.',
    },
  ];

  const MODALITIES: { key: VendorShippingModality; icon: string; label: string }[] = [
    { key: 'maritime', icon: '🚢', label: 'Maritime' },
    { key: 'air',      icon: '✈️', label: 'Air' },
    { key: 'land',     icon: '🚛', label: 'Land' },
  ];

  // ─── Props ─────────────────────────────────────────────────────────────────

  /** Null for create mode, populated for edit mode. */
  export let vendor: Vendor | null = null;

  /** `apiFetch` passed in from parent so we share the same auth token/URL logic. */
  export let apiFetch: (path: string, options?: RequestInit) => Promise<any>;

  // ─── Form state ────────────────────────────────────────────────────────────

  let companyName = vendor?.companyName ?? '';
  let contactName = vendor?.contactName ?? '';
  let email = vendor?.email ?? '';
  let phone = vendor?.phone ?? '';
  let website = vendor?.website ?? '';
  let notes = vendor?.notes ?? '';
  let active = vendor?.active ?? true;

  let selectedCategories: Set<ServiceCategory> = new Set(vendor?.serviceCategories ?? []);
  let selectedModalities: Set<VendorShippingModality> = new Set(vendor?.shippingModalities ?? []);

  // Countries — stored as comma-separated strings in the input, parsed on submit
  let originCountriesRaw = (vendor?.originCountries ?? []).join(', ');
  let destinationCountriesRaw = (vendor?.destinationCountries ?? []).join(', ');

  let isSaving = false;
  let saveError = '';

  const isEdit = !!vendor;

  // ─── Toggle helpers ────────────────────────────────────────────────────────

  function toggleCategory(key: ServiceCategory) {
    const s = new Set(selectedCategories);
    if (s.has(key)) s.delete(key); else s.add(key);
    selectedCategories = s;
  }

  function toggleModality(key: VendorShippingModality) {
    const s = new Set(selectedModalities);
    if (s.has(key)) s.delete(key); else s.add(key);
    selectedModalities = s;
  }

  // ─── Country tag parsing ───────────────────────────────────────────────────

  function parseCountries(raw: string): string[] {
    return raw
      .split(/[\s,;]+/)
      .map(s => s.trim().toUpperCase())
      .filter(s => s.length === 2 || s.length === 3) // ISO Alpha-2 or Alpha-3
      .filter(Boolean);
  }

  // ─── Submit ────────────────────────────────────────────────────────────────

  async function handleSubmit() {
    saveError = '';

    if (!companyName.trim()) { saveError = 'Company name is required.'; return; }
    if (!contactName.trim()) { saveError = 'Contact name is required.'; return; }
    if (!email.trim())       { saveError = 'Email is required.'; return; }
    if (selectedCategories.size === 0) { saveError = 'Select at least one service category.'; return; }
    if (selectedModalities.size === 0) { saveError = 'Select at least one shipping modality.'; return; }

    isSaving = true;
    try {
      const payload = {
        companyName: companyName.trim(),
        contactName: contactName.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim() || undefined,
        website: website.trim() || undefined,
        notes: notes.trim() || undefined,
        serviceCategories: [...selectedCategories],
        shippingModalities: [...selectedModalities],
        originCountries: parseCountries(originCountriesRaw),
        destinationCountries: parseCountries(destinationCountriesRaw),
        active,
      };

      if (isEdit && vendor) {
        await apiFetch(`/api/vendors/${vendor.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch('/api/vendors', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }

      dispatch('saved');
    } catch (err: any) {
      saveError = err.message;
    } finally {
      isSaving = false;
    }
  }

  function handleBackdropClick(e: MouseEvent) {
    if ((e.target as HTMLElement).classList.contains('vendor-modal-backdrop')) {
      dispatch('close');
    }
  }
</script>

<!-- ─── Modal backdrop ──────────────────────────────────────────────────────── -->
<!-- svelte-ignore a11y-click-events-have-key-events -->
<!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
<div class="vendor-modal-backdrop" role="dialog" aria-modal="true" on:click={handleBackdropClick}>
  <div class="vendor-modal">

    <!-- Header -->
    <div class="vendor-modal__header">
      <h2 class="vendor-modal__title">
        {isEdit ? `✏️ Edit Vendor` : '＋ Add Vendor'}
      </h2>
      <button class="vendor-modal__close" on:click={() => dispatch('close')} aria-label="Close">✕</button>
    </div>

    <!-- Body -->
    <div class="vendor-modal__body">

      <!-- Basic info -->
      <div class="form-section">
        <h3 class="section-label">Company Info</h3>
        <div class="form-row form-row--2">
          <div class="form-field">
            <label for="v-company">Company Name *</label>
            <input id="v-company" type="text" bind:value={companyName} placeholder="Acme Logistics S.A." />
          </div>
          <div class="form-field">
            <label for="v-website">Website</label>
            <input id="v-website" type="text" bind:value={website} placeholder="acmelogistics.com" />
          </div>
        </div>
        <div class="form-row form-row--2">
          <div class="form-field">
            <label for="v-contact">Contact Name *</label>
            <input id="v-contact" type="text" bind:value={contactName} placeholder="Juan Pérez" />
          </div>
          <div class="form-field">
            <label for="v-phone">Phone</label>
            <input id="v-phone" type="text" bind:value={phone} placeholder="+506 8800-0000" />
          </div>
        </div>
        <div class="form-field">
          <label for="v-email">Email *</label>
          <input id="v-email" type="email" bind:value={email} placeholder="contact@acme.com" />
        </div>
      </div>

      <!-- Service Categories (pill multi-select) -->
      <div class="form-section">
        <h3 class="section-label">Service Categories *</h3>
        <p class="section-hint">Select all categories this vendor can fulfill.</p>
        <div class="pill-group">
          {#each SERVICE_CATEGORIES as cat}
            <button
              type="button"
              class="pill pill--cat pill--{cat.key}"
              class:pill--selected={selectedCategories.has(cat.key)}
              on:click={() => toggleCategory(cat.key)}
              title={cat.description}
            >
              <span class="pill__icon">{cat.icon}</span>
              <span class="pill__label">{cat.label}</span>
            </button>
          {/each}
        </div>
        <!-- Descriptions for selected -->
        {#each SERVICE_CATEGORIES.filter(c => selectedCategories.has(c.key)) as cat}
          <p class="pill-description">{cat.icon} <strong>{cat.label}</strong> — {cat.description}</p>
        {/each}
      </div>

      <!-- Shipping Modalities (pill multi-select) -->
      <div class="form-section">
        <h3 class="section-label">Shipping Modalities *</h3>
        <p class="section-hint">Modes of transport this vendor handles.</p>
        <div class="pill-group">
          {#each MODALITIES as mod}
            <button
              type="button"
              class="pill pill--mod pill--{mod.key}"
              class:pill--selected={selectedModalities.has(mod.key)}
              on:click={() => toggleModality(mod.key)}
            >
              <span class="pill__icon">{mod.icon}</span>
              <span class="pill__label">{mod.label}</span>
            </button>
          {/each}
        </div>
      </div>

      <!-- Geographic coverage -->
      <div class="form-section">
        <h3 class="section-label">Geographic Coverage</h3>
        <p class="section-hint">
          Enter ISO Alpha-2 country codes separated by commas (e.g. <code>US, CR, CO</code>).
          Leave blank to indicate this vendor services all countries.
        </p>
        <div class="form-row form-row--2">
          <div class="form-field">
            <label for="v-origins">Origin Countries</label>
            <input id="v-origins" type="text" bind:value={originCountriesRaw} placeholder="US, CA, MX" />
            {#if parseCountries(originCountriesRaw).length > 0}
              <div class="tag-preview">
                {#each parseCountries(originCountriesRaw) as tag}
                  <span class="tag">{tag}</span>
                {/each}
              </div>
            {/if}
          </div>
          <div class="form-field">
            <label for="v-destinations">Destination Countries</label>
            <input id="v-destinations" type="text" bind:value={destinationCountriesRaw} placeholder="CR, PA, CO" />
            {#if parseCountries(destinationCountriesRaw).length > 0}
              <div class="tag-preview">
                {#each parseCountries(destinationCountriesRaw) as tag}
                  <span class="tag">{tag}</span>
                {/each}
              </div>
            {/if}
          </div>
        </div>
      </div>

      <!-- Notes -->
      <div class="form-section">
        <h3 class="section-label">Notes</h3>
        <div class="form-field">
          <textarea id="v-notes" bind:value={notes} rows="3" placeholder="Rates, special conditions, preferred contact hours…"></textarea>
        </div>
      </div>

      <!-- Active toggle (edit mode only) -->
      {#if isEdit}
        <div class="form-section form-section--inline">
          <h3 class="section-label">Status</h3>
          <label class="toggle-label">
            <button
              type="button"
              class="toggle"
              class:toggle--on={active}
              on:click={() => (active = !active)}
              aria-pressed={active}
            >
              <span class="toggle-knob"></span>
            </button>
            <span>{active ? 'Active' : 'Inactive'}</span>
          </label>
        </div>
      {/if}

    </div>

    <!-- Footer -->
    <div class="vendor-modal__footer">
      {#if saveError}
        <span class="save-error">{saveError}</span>
      {/if}
      <div class="footer-actions">
        <button class="btn btn--ghost" on:click={() => dispatch('close')} disabled={isSaving}>
          Cancel
        </button>
        <button class="btn btn--primary" on:click={handleSubmit} disabled={isSaving}>
          {#if isSaving}
            <span class="spinner"></span> Saving…
          {:else}
            {isEdit ? 'Save Changes' : 'Create Vendor'}
          {/if}
        </button>
      </div>
    </div>

  </div>
</div>

<style>
  /* ── Backdrop ────────────────── */
  .vendor-modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.55);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 1.5rem;
    backdrop-filter: blur(4px);
  }

  /* ── Modal shell ─────────────── */
  .vendor-modal {
    background: #1e293b;
    border: 1px solid #334155;
    border-radius: 1.25rem;
    width: 100%;
    max-width: 640px;
    max-height: 90dvh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: 0 24px 64px rgba(0,0,0,0.5);
  }

  /* ── Header ──────────────────── */
  .vendor-modal__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1.25rem 1.5rem;
    border-bottom: 1px solid #334155;
    flex-shrink: 0;
  }
  .vendor-modal__title {
    margin: 0;
    font-size: 1.125rem;
    font-weight: 700;
    color: #f1f5f9;
  }
  .vendor-modal__close {
    background: transparent;
    border: none;
    color: #64748b;
    font-size: 1rem;
    cursor: pointer;
    padding: 0.25rem;
    border-radius: 0.35rem;
    line-height: 1;
    transition: color 0.15s, background 0.15s;
  }
  .vendor-modal__close:hover { color: #f1f5f9; background: rgba(255,255,255,0.08); }

  /* ── Body (scrollable) ───────── */
  .vendor-modal__body {
    flex: 1;
    overflow-y: auto;
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  /* ── Sections ────────────────── */
  .form-section {
    display: flex;
    flex-direction: column;
    gap: 0.625rem;
  }
  .form-section--inline {
    flex-direction: row;
    align-items: center;
    gap: 1rem;
  }
  .section-label {
    margin: 0;
    font-size: 0.8rem;
    font-weight: 700;
    color: #94a3b8;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
  .section-hint {
    margin: 0;
    font-size: 0.78rem;
    color: #64748b;
    line-height: 1.4;
  }

  /* ── Form fields ─────────────── */
  .form-row { display: flex; gap: 0.75rem; }
  .form-row--2 > *  { flex: 1; min-width: 0; }
  .form-field {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
  }
  label {
    font-size: 0.8rem;
    font-weight: 600;
    color: #94a3b8;
  }
  input, textarea {
    background: #0f172a;
    border: 1px solid #334155;
    border-radius: 0.5rem;
    color: #f1f5f9;
    font-size: 0.875rem;
    padding: 0.5rem 0.75rem;
    outline: none;
    transition: border-color 0.2s;
    font-family: inherit;
    width: 100%;
    box-sizing: border-box;
  }
  input:focus, textarea:focus {
    border-color: #38bdf8;
    box-shadow: 0 0 0 2px rgba(56,189,248,0.12);
  }
  textarea { resize: vertical; min-height: 72px; }

  code {
    background: rgba(255,255,255,0.08);
    padding: 1px 4px;
    border-radius: 3px;
    font-size: 0.8em;
  }

  /* ── Pill multi-select ───────── */
  .pill-group {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }
  .pill {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.4rem 0.85rem;
    border-radius: 999px;
    border: 1.5px solid transparent;
    cursor: pointer;
    font-size: 0.82rem;
    font-weight: 600;
    background: #0f172a;
    color: #64748b;
    border-color: #334155;
    transition: all 0.15s;
  }
  .pill:hover { border-color: #475569; color: #94a3b8; }

  /* Selected state — category */
  .pill--full_service.pill--selected           { background: rgba(99,102,241,0.15); border-color: #6366f1; color: #a5b4fc; }
  .pill--self_pack_with_loading.pill--selected { background: rgba(20,184,166,0.15); border-color: #14b8a6; color: #5eead4; }
  .pill--diy_no_loading.pill--selected         { background: rgba(234,179,8,0.15);  border-color: #eab308; color: #fde047; }
  /* Selected state — modality */
  .pill--maritime.pill--selected { background: rgba(14,165,233,0.15); border-color: #0ea5e9; color: #38bdf8; }
  .pill--air.pill--selected      { background: rgba(139,92,246,0.15); border-color: #8b5cf6; color: #c4b5fd; }
  .pill--land.pill--selected     { background: rgba(249,115,22,0.15); border-color: #f97316; color: #fdba74; }

  .pill__icon { font-size: 1em; }
  .pill__label { }

  .pill-description {
    margin: 0;
    font-size: 0.78rem;
    color: #94a3b8;
    padding-left: 0.25rem;
    line-height: 1.4;
  }

  /* ── Country tags ────────────── */
  .tag-preview {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
    margin-top: 0.25rem;
  }
  .tag {
    display: inline-block;
    padding: 0.15rem 0.45rem;
    border-radius: 0.35rem;
    background: rgba(56,189,248,0.12);
    color: #38bdf8;
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.04em;
  }

  /* ── Active toggle ───────────── */
  .toggle-label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    color: #94a3b8;
    cursor: pointer;
  }
  .toggle {
    width: 44px;
    height: 24px;
    background: #334155;
    border-radius: 999px;
    border: none;
    cursor: pointer;
    position: relative;
    transition: background 0.2s;
  }
  .toggle--on { background: #0ea5e9; }
  .toggle-knob {
    position: absolute;
    top: 3px;
    left: 3px;
    width: 18px;
    height: 18px;
    background: #fff;
    border-radius: 50%;
    transition: transform 0.2s;
    pointer-events: none;
  }
  .toggle--on .toggle-knob { transform: translateX(20px); }

  /* ── Footer ──────────────────── */
  .vendor-modal__footer {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 0.75rem;
    padding: 1rem 1.5rem;
    border-top: 1px solid #334155;
    flex-shrink: 0;
    flex-wrap: wrap;
  }
  .save-error {
    flex: 1;
    font-size: 0.8rem;
    color: #fca5a5;
  }
  .footer-actions {
    display: flex;
    gap: 0.625rem;
  }
  .btn {
    border: none;
    border-radius: 0.5rem;
    padding: 0.5rem 1.1rem;
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s, opacity 0.2s;
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
  }
  .btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .btn--ghost   { background: transparent; color: #94a3b8; border: 1px solid #334155; }
  .btn--ghost:hover:not(:disabled) { background: rgba(255,255,255,0.06); }
  .btn--primary { background: #0ea5e9; color: #fff; }
  .btn--primary:hover:not(:disabled) { background: #0284c7; }

  /* ── Spinner ─────────────────── */
  .spinner {
    width: 14px;
    height: 14px;
    border: 2px solid rgba(255,255,255,0.3);
    border-top-color: #fff;
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
    display: inline-block;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
</style>
