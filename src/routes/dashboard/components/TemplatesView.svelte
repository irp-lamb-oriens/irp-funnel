<script lang="ts">
  /**
   * TemplatesView.svelte — Quote Document Template Manager
   *
   * Allows IRP staff to create, edit, and delete reusable QuoteTemplate
   * documents. Each template is a named ordered list of QuoteBlocks.
   * When a template is applied to a quote (from QuoteEditor), the quote's
   * `blocks` field is seeded with the template's blocks, and the
   * `templateId` field records which template was used.
   *
   * Block types supported:
   *   html        — bare HTML (staff-authored WYSIWYG content)
   *   quoteTable  — triggered automatically from the quote's lineItems
   *   accept      — the "Book Your Move" accept CTA
   *   accordion   — expandable section HTML
   *   heading     — standalone heading HTML
   *   banner      — full-width HTML banner section
   *   testimonials / reviews / partners — (future, renders nothing for now)
   */

  import { onMount } from 'svelte';
  import {
    fetchQuoteTemplates,
    createQuoteTemplate,
    updateQuoteTemplate,
    deleteQuoteTemplate,
    fetchQuoteTemplateMap,
    saveQuoteTemplateMap,
    SHIPPING_MODE_LABEL,
    type QuoteTemplate,
    type QuoteBlock,
    type QuoteBlockType,
    type QuoteTemplateMap,
    type TemplateMapRule,
    type ShippingMode,
  } from '../store.ts';
  import Select, { type SelectOption } from './ui/Select.svelte';
  import { MERGE_FIELDS, mergeFieldsByGroup } from '$lib/mergeFields.ts';

  /**
   * WysiwygEditor — centralized, zero-dep, drag-and-drop block canvas editor.
   * Replaces the raw-HTML textarea in edit mode.
   * Self-contained: handles contenteditable, formatting toolbar, section tags,
   * drag-and-drop reorder, and merge-field insertion internally.
   */
  import WysiwygEditor from '$lib/WysiwygEditor.svelte';

  // ─── State ───────────────────────────────────────────────────────────────────
  let templates: QuoteTemplate[] = [];
  let loadingList = true;
  let listError = '';

  let selectedTemplate: QuoteTemplate | null = null;
  let editing = false;   // true = edit mode, false = preview / select mode

  // Working copy during edit
  let editName = '';
  let editDescription = '';
  let editCategory = '';
  let editBlocks: QuoteBlock[] = [];

  let saving = false;
  let saveMsg = '';
  let saveError = '';

  // New template creation
  let creatingNew = false;
  let newName = '';
  let newDescription = '';
  let newCategory = '';

  // Inline row action: which template is currently being duplicated (spinner state).
  let duplicatingId: string | null = null;

  // ─── ⚙️ Main configuration: destination → template mapping ─────────────────
  // A SEPARATE panel (toggled from the sidebar header) from the searchable
  // template list. Lets staff edit which template is shown by default for a
  // given destination configuration. Backed by dashboard_config/quoteTemplateMap.
  type ViewMode = 'list' | 'config';
  let viewMode: ViewMode = 'list';

  let map: QuoteTemplateMap | null = null;
  let mapLoading = false;
  let mapLoadedOnce = false;
  let mapSaving = false;
  let mapMsg = '';
  let mapError = '';

  // Local editable working copies
  let mapDefaultTemplateId = '';
  let mapRules: TemplateMapRule[] = [];

  // Options for the template <Select>s, derived from the loaded templates.
  $: templateSelectOptions = templates.map((t): SelectOption => ({
    value: t.templateId,
    label: t.name,
    description: t.category ?? (t.isDefault ? 'Default proposal document' : null),
    badge: t.isDefault ? 'Default' : null,
  }));

  // Shipping-mode options for the optional narrowing <Select> (＋ an "Any" entry).
  const shippingModeOptions: SelectOption[] = [
    { value: '', label: 'Any shipping mode' },
    ...Object.entries(SHIPPING_MODE_LABEL).map(([value, meta]) => ({
      value,
      label: meta.label,
      icon: meta.icon,
    })),
  ];

  function templateNameById(id: string): string {
    return templates.find((t) => t.templateId === id)?.name ?? id;
  }

  function nanoId(size = 10): string {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let out = '';
    const arr = crypto.getRandomValues(new Uint8Array(size));
    for (const b of arr) out += chars[b % chars.length];
    return out;
  }

  async function switchToConfig() {
    viewMode = 'config';
    if (!mapLoadedOnce) await loadMap();
  }

  function switchToList() {
    viewMode = 'list';
  }

  async function loadMap() {
    mapLoading = true;
    mapError = '';
    try {
      map = await fetchQuoteTemplateMap();
      mapDefaultTemplateId = map.defaultTemplateId || 'irp-standard-proposal';
      mapRules = (map.rules ?? []).map((r) => ({ ...r }));
      mapLoadedOnce = true;
    } catch (err: any) {
      mapError = err?.message ?? 'Failed to load mapping configuration.';
    } finally {
      mapLoading = false;
    }
  }

  function addRule() {
    mapRules = [
      ...mapRules,
      {
        id: nanoId(10),
        label: null,
        destinationCountry: '',
        destinationCity: null,
        shippingMode: null,
        templateId: mapDefaultTemplateId || (templates[0]?.templateId ?? ''),
        priority: (mapRules.length + 1) * 10,
      },
    ];
  }

  function removeRule(id: string) {
    mapRules = mapRules.filter((r) => r.id !== id);
  }

  function moveRule(index: number, delta: number) {
    const j = index + delta;
    if (j < 0 || j >= mapRules.length) return;
    const arr = [...mapRules];
    [arr[index], arr[j]] = [arr[j], arr[index]];
    mapRules = arr;
  }

  function setRuleField(id: string, field: keyof TemplateMapRule, value: any) {
    mapRules = mapRules.map((r) => (r.id === id ? { ...r, [field]: value } : r));
  }

  async function saveMap() {
    // Validate: every rule needs a destination country + a template.
    const cleaned = mapRules
      .map((r) => ({
        ...r,
        destinationCountry: (r.destinationCountry ?? '').trim(),
        destinationCity: r.destinationCity?.trim() || null,
        label: r.label?.trim() || null,
        shippingMode: r.shippingMode || null,
      }))
      .filter((r) => r.destinationCountry && r.templateId);

    mapSaving = true;
    mapMsg = '';
    mapError = '';
    try {
      const saved = await saveQuoteTemplateMap({
        defaultTemplateId: mapDefaultTemplateId,
        rules: cleaned,
      });
      map = saved;
      mapRules = (saved.rules ?? []).map((r) => ({ ...r }));
      mapDefaultTemplateId = saved.defaultTemplateId;
      mapMsg = `✓ Mapping saved — ${cleaned.length} rule${cleaned.length !== 1 ? 's' : ''}.`;
    } catch (err: any) {
      mapError = '✗ ' + (err?.message ?? 'Save failed');
    } finally {
      mapSaving = false;
    }
  }

  // ─── Sidebar search ────────────────────────────────────────────────────────────
  let sidebarSearch = '';

  $: filteredTemplates = sidebarSearch.trim()
    ? templates.filter(t =>
        t.name.toLowerCase().includes(sidebarSearch.toLowerCase()) ||
        (t.category ?? '').toLowerCase().includes(sidebarSearch.toLowerCase())
      )
    : templates;

  // ─── Merge-field picker ────────────────────────────────────────────────────────
  let activePickerBlockId: string | null = null;   // which textarea's picker is open
  let pickerSearch = '';

  $: pickerGroups = mergeFieldsByGroup();
  $: filteredPickerFields = MERGE_FIELDS.filter(f =>
    !pickerSearch.trim() ||
    f.label.toLowerCase().includes(pickerSearch.toLowerCase()) ||
    f.token.toLowerCase().includes(pickerSearch.toLowerCase()) ||
    f.group.toLowerCase().includes(pickerSearch.toLowerCase())
  );

  function openPicker(blockId: string) {
    activePickerBlockId = blockId;
    pickerSearch = '';
  }

  function closePicker() {
    activePickerBlockId = null;
    pickerSearch = '';
  }

  /**
   * Insert `{{token}}` at the cursor position of the textarea for the given block.
   * Falls back to appending at the end if selection detection fails.
   */
  function insertField(blockId: string, token: string) {
    // Find the textarea for this block
    const ta = document.querySelector<HTMLTextAreaElement>(`[data-block-id="${blockId}"]`);
    if (!ta) {
      // Fallback: just append to the block's html
      const block = editBlocks.find(b => b.id === blockId);
      if (block) updateBlockHtml(blockId, (block.html ?? '') + token);
      closePicker();
      return;
    }
    const start = ta.selectionStart ?? ta.value.length;
    const end   = ta.selectionEnd   ?? ta.value.length;
    const newVal = ta.value.slice(0, start) + token + ta.value.slice(end);
    updateBlockHtml(blockId, newVal);
    // Restore cursor after the inserted token
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(start + token.length, start + token.length);
    });
    closePicker();
  }

  // ─── Block type options ───────────────────────────────────────────────────────
  const BLOCK_TYPES: { type: QuoteBlockType; label: string; icon: string; description: string }[] = [
    { type: 'html',         label: 'HTML Block',    icon: '📝', description: 'Free-form HTML — headers, paragraphs, lists, images' },
    { type: 'heading',      label: 'Heading',       icon: '📌', description: 'Standalone H2 heading block' },
    { type: 'banner',       label: 'Banner',        icon: '🖼️', description: 'Full-width hero banner with background image HTML' },
    { type: 'accordion',    label: 'Accordion',     icon: '📋', description: 'Expandable informational sections (T&Cs, regulations)' },
    { type: 'quoteTable',   label: 'Quote Table',   icon: '💰', description: 'Interactive service line-items table from the quote' },
    { type: 'accept',       label: 'Accept CTA',    icon: '✅', description: '"Book Your Move" button + name input field' },
    { type: 'testimonials', label: 'Testimonials',  icon: '🌟', description: 'Customer testimonials (Phase 3)' },
    { type: 'reviews',      label: 'Reviews',       icon: '⭐', description: 'Google reviews (Phase 3)' },
    { type: 'partners',     label: 'Partners',      icon: '🤝', description: 'Business partners logos (Phase 3)' },
  ];

  const HTML_BLOCK_TYPES: Set<QuoteBlockType> = new Set([
    'html', 'heading', 'banner', 'accordion',
  ]);

  function blockTypeLabel(type: QuoteBlockType): string {
    return BLOCK_TYPES.find(b => b.type === type)?.label ?? type;
  }

  function blockTypeIcon(type: QuoteBlockType): string {
    return BLOCK_TYPES.find(b => b.type === type)?.icon ?? '📦';
  }

  function hasHtmlEditor(type: QuoteBlockType): boolean {
    return HTML_BLOCK_TYPES.has(type);
  }

  // ─── Load ─────────────────────────────────────────────────────────────────────
  onMount(async () => {
    await loadTemplates();
  });

  async function loadTemplates() {
    loadingList = true;
    listError = '';
    try {
      templates = await fetchQuoteTemplates();
    } catch (err: any) {
      listError = err?.message ?? 'Failed to load templates';
    } finally {
      loadingList = false;
    }
  }

  // ─── Template selection ───────────────────────────────────────────────────────
  function selectTemplate(tmpl: QuoteTemplate) {
    selectedTemplate = tmpl;
    creatingNew = false;
    saveMsg = '';
    saveError = '';
    // WYSIWYG-first: drop straight into the editor so staff immediately see the
    // real what-you-see-is-what-you-get document — no preliminary block-summary
    // list, no extra "Edit" click. selectedTemplate is set above, so startEdit()
    // populates the working copy and flips `editing` on.
    startEdit();
  }


  function startEdit() {
    if (!selectedTemplate) return;
    editName = selectedTemplate.name;
    editDescription = selectedTemplate.description ?? '';
    editCategory = selectedTemplate.category ?? '';
    editBlocks = selectedTemplate.blocks.map(b => ({ ...b }));
    editing = true;
    saveMsg = '';
    saveError = '';
  }

  function cancelEdit() {
    // No separate preview mode anymore — "Revert" discards unsaved edits by
    // re-loading the working copy from the saved template, staying in WYSIWYG.
    if (selectedTemplate) startEdit();
    saveMsg = '';
    saveError = '';
  }


  // ─── Block editor helpers ─────────────────────────────────────────────────────
  function addBlock(type: QuoteBlockType) {
    const id = `blk-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
    editBlocks = [
      ...editBlocks,
      { id, type, html: type === 'html' ? '<p>Your content here...</p>' : null, data: null },
    ];
  }

  function removeBlock(blockId: string) {
    editBlocks = editBlocks.filter(b => b.id !== blockId);
  }

  function moveBlockUp(index: number) {
    if (index === 0) return;
    const arr = [...editBlocks];
    [arr[index - 1], arr[index]] = [arr[index], arr[index - 1]];
    editBlocks = arr;
  }

  function moveBlockDown(index: number) {
    if (index === editBlocks.length - 1) return;
    const arr = [...editBlocks];
    [arr[index], arr[index + 1]] = [arr[index + 1], arr[index]];
    editBlocks = arr;
  }

  function updateBlockHtml(blockId: string, html: string) {
    editBlocks = editBlocks.map(b => b.id === blockId ? { ...b, html } : b);
  }

  // ─── Save / Delete ────────────────────────────────────────────────────────────
  async function handleSave() {
    if (!editName.trim()) { saveError = 'Template name is required.'; return; }
    saving = true;
    saveMsg = '';
    saveError = '';
    try {
      if (selectedTemplate) {
        // Update existing
        await updateQuoteTemplate(selectedTemplate.templateId, {
          name: editName.trim(),
          description: editDescription.trim() || null,
          category: editCategory.trim() || null,
          blocks: editBlocks,
        } as any);
        await loadTemplates();
        // Refresh selectedTemplate reference
        selectedTemplate = templates.find(t => t.templateId === selectedTemplate!.templateId) ?? null;
        saveMsg = `✓ Template "${editName.trim()}" saved.`;
      }
      // Stay in the WYSIWYG editor after saving — there is no preview mode to
      // fall back to; the document remains visible and editable.
      editing = true;
    } catch (err: any) {

      saveError = '✗ ' + (err?.message ?? 'Save failed');
    } finally {
      saving = false;
    }
  }

  async function handleDelete() {
    if (!selectedTemplate) return;
    if (!confirm(`Delete template "${selectedTemplate.name}"? This action cannot be undone.`)) return;
    try {
      await deleteQuoteTemplate(selectedTemplate.templateId);
      selectedTemplate = null;
      editing = false;
      await loadTemplates();
    } catch (err: any) {
      saveError = '✗ Delete failed: ' + (err?.message ?? 'unknown error');
    }
  }

  // ─── Create new ───────────────────────────────────────────────────────────────
  function openCreateNew() {
    creatingNew = true;
    selectedTemplate = null;
    editing = false;
    newName = '';
    newDescription = '';
    newCategory = '';
    saveMsg = '';
    saveError = '';
  }

  async function handleCreateNew() {
    if (!newName.trim()) { saveError = 'Template name is required.'; return; }
    saving = true;
    saveMsg = '';
    saveError = '';
    try {
      const created = await createQuoteTemplate({
        name: newName.trim(),
        description: newDescription.trim() || null,
        category: newCategory.trim() || null,
        blocks: [],
      } as any);
      await loadTemplates();
      selectedTemplate = templates.find(t => t.templateId === created.templateId) ?? created;
      creatingNew = false;
      // Auto-enter edit mode so the user can start adding blocks immediately
      startEdit();
      saveMsg = `✓ Template "${created.name}" created. Now add some blocks.`;
    } catch (err: any) {
      saveError = '✗ ' + (err?.message ?? 'Create failed');
    } finally {
      saving = false;
    }
  }

  // ─── Duplicate (inline, from the list row) ────────────────────────────────────
  /**
   * Clone a template straight from its list row — the same "copy" affordance the
   * block editor offers per-section, lifted to the TEMPLATE level. Creates a new
   * "<name> (Copy)" document with a deep, fresh-id copy of the source blocks, then
   * opens it so staff can immediately tweak the duplicate. Delete intentionally
   * stays inside the open template (header) so the list row stays clutter-free.
   */
  async function duplicateTemplate(tmpl: QuoteTemplate) {
    if (duplicatingId) return;
    duplicatingId = tmpl.templateId;
    saveMsg = '';
    saveError = '';
    listError = '';
    try {
      const created = await createQuoteTemplate({
        name: `${tmpl.name} (Copy)`,
        description: tmpl.description ?? null,
        category: tmpl.category ?? null,
        // Deep copy with fresh block ids so the duplicate is fully independent.
        blocks: tmpl.blocks.map((b) => ({
          ...b,
          id: `blk-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        })),
      } as any);
      await loadTemplates();
      selectedTemplate = templates.find((t) => t.templateId === created.templateId) ?? created;
      creatingNew = false;
      startEdit();
      saveMsg = `✓ Duplicated "${tmpl.name}" → "${created.name}".`;
    } catch (err: any) {
      listError = '✗ Duplicate failed: ' + (err?.message ?? 'unknown error');
    } finally {
      duplicatingId = null;
    }
  }

  function formatDate(iso: string): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  // Static placeholder (avoids Svelte curly-brace escaping issues in attributes)
  const HTML_BLOCK_PLACEHOLDER = '<h2>Dear {{client.fullName}},</h2>\n<p>Your content with merge fields like {{route.destinationCountry}}.</p>';
</script>

<div class="tv-root">

  <!-- ── Sidebar: template list / config toggle ─────────────────────────────── -->
  <aside class="tv-sidebar">
    <div class="tv-sidebar__header">
      <div class="tv-mode-toggle" role="tablist" aria-label="Templates view">
        <button
          class="tv-mode-toggle__btn"
          class:is-active={viewMode === 'list'}
          role="tab"
          aria-selected={viewMode === 'list'}
          on:click={switchToList}
        >📄 Templates</button>
        <button
          class="tv-mode-toggle__btn"
          class:is-active={viewMode === 'config'}
          role="tab"
          aria-selected={viewMode === 'config'}
          on:click={switchToConfig}
        >⚙️ Config</button>
      </div>
    </div>

  {#if viewMode === 'list'}
    <div class="tv-sidebar__newrow">
      <button class="tv-new-btn tv-new-btn--full" on:click={openCreateNew} title="Create new template">+ New template</button>
    </div>

    <!-- ── Sidebar search ──────────────────────────────────────────────────── -->
    <div class="tv-sidebar__search">
      <input
        class="tv-sidebar__search-input"
        type="text"
        bind:value={sidebarSearch}
        placeholder="🔍 Search templates…"
        autocomplete="off"
      />
    </div>

    {#if loadingList}

      <div class="tv-empty">Loading…</div>
    {:else if listError}
      <div class="tv-error-msg">{listError}</div>
    {:else if templates.length === 0}
      <div class="tv-empty">
        <p>No templates yet.</p>
        <p>Create one to build Qwilr-style proposal documents.</p>
      </div>
    {:else}
      <ul class="tv-list">
        {#each filteredTemplates as tmpl (tmpl.templateId)}
          <li
            class="tv-list__item"
            class:tv-list__item--active={selectedTemplate?.templateId === tmpl.templateId}
          >
            <!-- Primary row action — a real, keyboard-accessible button. -->
            <button
              type="button"
              class="tv-list__select"
              title={tmpl.name}
              on:click={() => selectTemplate(tmpl)}
            >
              <span class="tv-list__name-row">
                <span class="tv-list__name">{tmpl.name}</span>
                {#if tmpl.isDefault}
                  <span class="tv-list__default-badge">Default</span>
                {/if}
              </span>
              <span class="tv-list__meta">
                {tmpl.blocks.length} block{tmpl.blocks.length !== 1 ? 's' : ''}
                {#if tmpl.category}<span class="tv-list__cat">· {tmpl.category}</span>{/if}
              </span>
            </button>

            <!-- Inline hover action: duplicate this template (delete lives inside
                 the open template, not here). A separate real button — never
                 nested in the select button — so it stays keyboard-accessible
                 and stopPropagation keeps it from triggering row selection. -->
            <button
              type="button"
              class="tv-list__dup"
              title="Duplicate this template"
              aria-label={`Duplicate template ${tmpl.name}`}
              disabled={duplicatingId === tmpl.templateId}
              on:click|stopPropagation={() => duplicateTemplate(tmpl)}
            >{duplicatingId === tmpl.templateId ? '⏳' : '⧉'}</button>
          </li>
        {/each}
        {#if filteredTemplates.length === 0 && sidebarSearch}
          <div class="tv-empty tv-empty--sm">No templates match "{sidebarSearch}"</div>
        {/if}
      </ul>
    {/if}
  {:else}
    <div class="tv-sidebar__configinfo">
      <div class="tv-sidebar__configinfo-icon">🗺️</div>
      <p class="tv-sidebar__configinfo-title">Template mapping</p>
      <p class="tv-sidebar__configinfo-text">
        Decide which proposal template shows by default for each destination
        configuration. Powers the AI auto-selector and the per-client selector
        in the quoting step.
      </p>
    </div>
  {/if}
  </aside>


  <!-- ── Main panel ─────────────────────────────────────────────────────────── -->
  <main class="tv-main">

    {#if viewMode === 'config'}
      <!-- ════ ⚙️ MAIN CONFIGURATION — destination → template mapping ════════ -->
      <div class="tv-panel tv-config">
        <div class="tv-panel__header">
          <div>
            <h3 class="tv-panel__title">⚙️ Template Mapping</h3>
            <p class="tv-panel__desc">
              Which proposal template shows by default for each destination configuration.
            </p>
          </div>
          <div class="tv-panel__actions">
            <button class="tv-btn tv-btn--primary" on:click={saveMap} disabled={mapSaving || mapLoading}>
              {mapSaving ? '⏳ Saving…' : '💾 Save Configuration'}
            </button>
          </div>
        </div>

        {#if mapMsg}<div class="tv-success-msg">{mapMsg}</div>{/if}
        {#if mapError}<div class="tv-error-msg">{mapError}</div>{/if}

        {#if mapLoading}
          <div class="tv-empty">Loading configuration…</div>
        {:else}
          <!-- ── Default fallback template ──────────────────────────────────── -->
          <div class="tv-config__section">
            <div class="tv-config__section-head">
              <span class="tv-config__section-title">Default template</span>
              <span class="tv-config__section-sub">Shown when no rule below matches.</span>
            </div>
            <div class="tv-config__default-select">
              <Select
                options={templateSelectOptions}
                value={mapDefaultTemplateId}
                placeholder="Choose the global fallback template…"
                searchable={templateSelectOptions.length > 6}
                ariaLabel="Default template"
                on:change={(e) => (mapDefaultTemplateId = e.detail.value)}
              />
            </div>
          </div>

          <!-- ── Destination rules ──────────────────────────────────────────── -->
          <div class="tv-config__section">
            <div class="tv-config__section-head">
              <span class="tv-config__section-title">Destination rules</span>
              <span class="tv-config__section-sub">
                More specific rules (with a city or shipping mode) win over general ones; ties broken by priority.
              </span>
            </div>

            {#if mapRules.length === 0}
              <div class="tv-config__empty">
                No rules yet — every client falls back to the default template.
                Add a rule to route a destination to a tailored proposal.
              </div>
            {:else}
              <div class="tv-config__rules">
                {#each mapRules as rule, i (rule.id)}
                  <div class="tv-config__rule">
                    <div class="tv-config__rule-index">{i + 1}</div>

                    <div class="tv-config__rule-grid">
                      <div class="tv-config__field tv-config__field--country">
                        <span class="tv-label tv-label--sm">Destination country <span class="tv-required">*</span></span>
                        <input
                          class="tv-input tv-input--cfg"
                          bind:value={rule.destinationCountry}
                          placeholder="e.g. Costa Rica"
                        />
                      </div>

                      <div class="tv-config__field">
                        <span class="tv-label tv-label--sm">City <span class="tv-config__opt">(optional)</span></span>
                        <input
                          class="tv-input tv-input--cfg"
                          value={rule.destinationCity ?? ''}
                          on:input={(e) => setRuleField(rule.id, 'destinationCity', e.currentTarget.value)}
                          placeholder="Any city"
                        />
                      </div>

                      <div class="tv-config__field">
                        <span class="tv-label tv-label--sm">Shipping mode <span class="tv-config__opt">(optional)</span></span>
                        <Select
                          size="sm"
                          options={shippingModeOptions}
                          value={rule.shippingMode ?? ''}
                          ariaLabel="Shipping mode"
                          on:change={(e) => setRuleField(rule.id, 'shippingMode', e.detail.value || null)}
                        />
                      </div>

                      <div class="tv-config__field tv-config__field--template">
                        <span class="tv-label tv-label--sm">Show template <span class="tv-required">*</span></span>
                        <Select
                          size="sm"
                          options={templateSelectOptions}
                          value={rule.templateId}
                          searchable={templateSelectOptions.length > 6}
                          placeholder="Choose template…"
                          ariaLabel="Template for this rule"
                          on:change={(e) => setRuleField(rule.id, 'templateId', e.detail.value)}
                        />
                      </div>

                      <div class="tv-config__field tv-config__field--priority">
                        <span class="tv-label tv-label--sm">Priority</span>
                        <input
                          class="tv-input tv-input--cfg"
                          type="number"
                          value={rule.priority}
                          on:input={(e) => setRuleField(rule.id, 'priority', Number(e.currentTarget.value))}
                        />
                      </div>
                    </div>

                    <div class="tv-config__rule-controls">
                      <button class="tv-icon-btn" title="Move up" on:click={() => moveRule(i, -1)} disabled={i === 0}>↑</button>
                      <button class="tv-icon-btn" title="Move down" on:click={() => moveRule(i, 1)} disabled={i === mapRules.length - 1}>↓</button>
                      <button class="tv-icon-btn tv-icon-btn--danger" title="Delete rule" on:click={() => removeRule(rule.id)}>✕</button>
                    </div>
                  </div>
                {/each}
              </div>
            {/if}

            <button class="tv-config__add" on:click={addRule}>＋ Add rule</button>
          </div>

          <div class="tv-apply-hint">
            💡 This mapping runs <strong>before</strong> the built-in destination logic and the AI fallback. Clients with no
            matching rule use the default template above.
          </div>
        {/if}
      </div>

    {:else}

    <!-- ── Create New form ──────────────────────────────────────────────────── -->
    {#if creatingNew}

      <div class="tv-panel">
        <div class="tv-panel__header">
          <h3 class="tv-panel__title">✨ New Template</h3>
          <button class="tv-btn tv-btn--ghost" on:click={() => { creatingNew = false; saveMsg = ''; saveError = ''; }}>Cancel</button>
        </div>

        <div class="tv-form-group">
          <span class="tv-label">Name <span class="tv-required">*</span></span>
          <input class="tv-input" bind:value={newName} placeholder="e.g. Costa Rica — Standard FCL" />
        </div>

        <div class="tv-form-group">
          <span class="tv-label">Category</span>
          <input class="tv-input" bind:value={newCategory} placeholder="e.g. costa-rica, mexico-container…" />
        </div>

        <div class="tv-form-group">
          <span class="tv-label">Description</span>
          <textarea class="tv-textarea tv-textarea--sm" bind:value={newDescription} placeholder="Describe when to use this template…" rows="2"></textarea>
        </div>

        {#if saveError}<div class="tv-error-msg">{saveError}</div>{/if}

        <div class="tv-save-bar">
          <button class="tv-btn tv-btn--primary" on:click={handleCreateNew} disabled={saving}>
            {saving ? 'Creating…' : '✓ Create Template'}
          </button>
        </div>
      </div>

    <!-- ── No selection ────────────────────────────────────────────────────── -->
    {:else if !selectedTemplate}
      <div class="tv-placeholder">
        <span class="tv-placeholder__icon">📄</span>
        <p>Select a template from the list or<br>create a new one with the <strong>+ New</strong> button.</p>
        <p class="tv-placeholder__hint">
            Templates are reusable content blocks for Qwilr-style proposals.<br>
            They are applied to a quote from the QuoteEditor.
          </p>
      </div>

    <!-- ── Selected template — WYSIWYG-first ────────────────────────────────────
         Selecting a template drops staff straight into the true
         what-you-see-is-what-you-get editor: no preliminary block-summary list,
         no extra "Edit" click. The document itself is visible and editable from
         the very first render; Save / Revert / Delete live in the header. -->
    {:else if editing}
      <div class="tv-panel">
        <div class="tv-panel__header">
          <div class="tv-panel__titles">
            <input class="tv-input tv-input--title" bind:value={editName} placeholder="Template name…" />
            <input class="tv-input tv-input--sub" bind:value={editCategory} placeholder="Category (optional)" />
          </div>
          <div class="tv-panel__actions">
            <button class="tv-btn tv-btn--danger-ghost" on:click={handleDelete} title="Delete this template">🗑 Delete</button>
            <button class="tv-btn tv-btn--ghost" on:click={cancelEdit} disabled={saving} title="Discard unsaved changes">↺ Revert</button>
            <button class="tv-btn tv-btn--primary" on:click={handleSave} disabled={saving || !editName.trim()}>
              {saving ? '⏳ Saving…' : '💾 Save'}
            </button>
          </div>
        </div>

        {#if saveMsg}<div class="tv-success-msg">{saveMsg}</div>{/if}
        {#if saveError}<div class="tv-error-msg">{saveError}</div>{/if}

        {#if selectedTemplate}
          <div class="tv-meta-row">
            <span>Created by <strong>{selectedTemplate.createdBy.split('@')[0]}</strong> · {formatDate(selectedTemplate.createdAt)}</span>
            {#if selectedTemplate.updatedAt}
              <span>· Last updated {formatDate(selectedTemplate.updatedAt)}</span>
            {/if}
          </div>
        {/if}

        <div class="tv-form-group">
          <span class="tv-label">Description</span>
          <input class="tv-input" bind:value={editDescription} placeholder="Optional description…" />
        </div>

        <!-- ── True WYSIWYG Block Canvas ────────────────────────────────────────
             WysiwygEditor.svelte (src/lib/WysiwygEditor.svelte):
               • Drag-and-drop block reordering (HTML5 drag API, zero deps)
               • Contenteditable inline editing — no raw textarea (true WYSIWYG)
               • Per-block formatting toolbar: B, I, U, H2-H4, UL, OL, Link, clear
               • Section tab assignment per block (→ Header portal-tabs navigation)
               • Merge-field picker built-in
               • Add-block palette built-in
             bind:blocks keeps editBlocks in sync with the parent save flow. -->
        <WysiwygEditor bind:blocks={editBlocks} />

        <div class="tv-apply-hint">
          💡 To apply this template to a quote, open the <strong>QuoteEditor</strong> → <em>"Use Template"</em> button.
        </div>
      </div>
    {/if}


    {/if}
  </main>
</div>


<style>
  /* ─── Root layout ────────────────────────────────────────────────────────── */
  .tv-root {
    display: flex;
    height: calc(100vh - 64px);
    overflow: hidden;
    font-family: 'Montserrat', 'Arial', sans-serif;
    background: #f8fafc;
    color: #0f172a;
  }

  /* ─── Sidebar ────────────────────────────────────────────────────────────── */
  .tv-sidebar {
    width: 280px;
    flex-shrink: 0;
    background: #fff;
    border-right: 1px solid #e2e8f0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .tv-sidebar__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1.1rem 1.2rem 0.8rem;
    border-bottom: 1px solid #f1f5f9;
    flex-shrink: 0;
  }

  .tv-new-btn {
    padding: 0.3rem 0.9rem;
    background: linear-gradient(135deg, #02b6bc, #0284c7);
    color: #fff;
    border: none;
    border-radius: 7px;
    font-size: 0.78rem;
    font-weight: 700;
    cursor: pointer;
    transition: filter 0.14s, transform 0.12s;
  }
  .tv-new-btn:hover { filter: brightness(1.1); transform: scale(1.03); }
  .tv-new-btn--full { width: 100%; text-align: center; padding: 0.5rem 0.9rem; }

  /* ─── Mode toggle (Templates ⇄ Config) ───────────────────────────────────── */
  .tv-mode-toggle {
    display: flex;
    width: 100%;
    background: #f1f5f9;
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    padding: 3px;
    gap: 3px;
  }
  .tv-mode-toggle__btn {
    flex: 1;
    border: none;
    background: transparent;
    border-radius: 6px;
    padding: 0.42rem 0.5rem;
    font-size: 0.76rem;
    font-weight: 700;
    color: #64748b;
    cursor: pointer;
    font-family: inherit;
    white-space: nowrap;
    transition: background 0.14s, color 0.14s, box-shadow 0.14s;
  }
  .tv-mode-toggle__btn:hover { color: #0f172a; }
  .tv-mode-toggle__btn.is-active {
    background: #fff;
    color: #02b6bc;
    box-shadow: 0 1px 3px rgba(15,23,42,0.1);
  }

  .tv-sidebar__newrow { padding: 0.7rem 0.8rem 0.35rem; flex-shrink: 0; }

  /* ─── Sidebar config-mode info ───────────────────────────────────────────── */
  .tv-sidebar__configinfo {
    padding: 1.4rem 1.2rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .tv-sidebar__configinfo-icon { font-size: 1.8rem; }
  .tv-sidebar__configinfo-title { margin: 0; font-size: 0.84rem; font-weight: 800; color: #0f172a; }
  .tv-sidebar__configinfo-text { margin: 0; font-size: 0.76rem; line-height: 1.6; color: #94a3b8; }

  .tv-list {

    list-style: none;
    margin: 0;
    padding: 0.5rem 0;
    overflow-y: auto;
    flex: 1;
    scrollbar-width: thin;
    scrollbar-color: rgba(2,182,188,0.15) transparent;
  }

  .tv-list__item {
    position: relative;
    border-left: 3px solid transparent;
    transition: background 0.12s, border-color 0.12s;
  }
  .tv-list__item:hover { background: #f8fafc; border-left-color: #e2e8f0; }
  .tv-list__item--active { background: #f0fdfe; border-left-color: #02b6bc; }

  /* Primary row action — a real, accessible button that fills the row. */
  .tv-list__select {
    display: flex;
    flex-direction: column;
    gap: 2px;
    width: 100%;
    padding: 0.7rem 2.4rem 0.7rem 1.2rem; /* right gutter for the hover action */
    background: transparent;
    border: none;
    text-align: left;
    font-family: inherit;
    color: inherit;
    cursor: pointer;
  }
  .tv-list__select:focus-visible {
    outline: 2px solid #02b6bc;
    outline-offset: -2px;
    border-radius: 6px;
  }

  .tv-list__name {
    font-size: 0.84rem;
    font-weight: 600;
    color: #0f172a;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .tv-list__meta {
    font-size: 0.71rem;
    color: #94a3b8;
  }
  .tv-list__cat { color: #02b6bc; font-weight: 600; }

  /* Inline "duplicate" row action — hidden until the row is hovered/focused. */
  .tv-list__dup {
    position: absolute;
    top: 6px;
    right: 8px;
    width: 26px;
    height: 26px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 1px solid #e2e8f0;
    background: #fff;
    border-radius: 7px;
    color: #475569;
    font-size: 0.82rem;
    line-height: 1;
    cursor: pointer;
    opacity: 0;
    transform: translateY(-2px);
    box-shadow: 0 1px 3px rgba(15,23,42,0.08);
    transition: opacity 0.12s, transform 0.12s, background 0.12s, color 0.12s, border-color 0.12s;
  }
  .tv-list__item:hover .tv-list__dup,
  .tv-list__item:focus-within .tv-list__dup { opacity: 1; transform: translateY(0); }
  .tv-list__dup:hover:not(:disabled) {
    background: #f0fdfe;
    color: #02b6bc;
    border-color: rgba(2,182,188,0.4);
  }
  .tv-list__dup:disabled { opacity: 1; cursor: progress; color: #94a3b8; }

  /* ─── Main ───────────────────────────────────────────────────────────────── */
  .tv-main {
    flex: 1;
    overflow-y: auto;
    padding: 1.8rem 2rem;
    scrollbar-width: thin;
    scrollbar-color: rgba(2,182,188,0.15) transparent;
  }

  /* ─── Placeholder ────────────────────────────────────────────────────────── */
  .tv-placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 55vh;
    text-align: center;
    color: #64748b;
    gap: 0.6rem;
  }
  .tv-placeholder__icon { font-size: 3rem; }
  .tv-placeholder p { margin: 0; font-size: 0.88rem; line-height: 1.7; }
  .tv-placeholder__hint { font-size: 0.76rem; color: #94a3b8; max-width: 380px; }

  /* ─── Panel ──────────────────────────────────────────────────────────────── */
  .tv-panel {
    background: #fff;
    border: 1px solid #e2e8f0;
    border-radius: 14px;
    padding: 1.5rem 1.8rem;
    box-shadow: 0 2px 8px rgba(0,0,0,0.04);
    display: flex;
    flex-direction: column;
    gap: 1.2rem;
  }

  .tv-panel__header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
  }

  .tv-panel__titles { display: flex; flex-direction: column; gap: 0.4rem; flex: 1; }

  .tv-panel__title {
    font-size: 1.15rem;
    font-weight: 800;
    color: #0f172a;
    margin: 0;
    letter-spacing: -0.02em;
  }

  .tv-panel__desc {
    font-size: 0.8rem;
    color: #64748b;
    margin: 0.2rem 0 0;
    font-style: italic;
  }

  .tv-panel__actions { display: flex; gap: 0.5rem; flex-shrink: 0; align-items: center; }

  /* ─── Buttons ────────────────────────────────────────────────────────────── */
  .tv-btn {
    padding: 0.45rem 1.1rem;
    border-radius: 8px;
    font-size: 0.82rem;
    font-weight: 700;
    cursor: pointer;
    transition: filter 0.14s, transform 0.12s, background 0.12s, border-color 0.12s;
    border: 1px solid transparent;
  }
  .tv-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none !important; }

  .tv-btn--primary {
    background: linear-gradient(135deg, #02b6bc, #0284c7);
    color: #fff;
    border: none;
    box-shadow: 0 2px 8px rgba(2,182,188,0.28);
  }
  .tv-btn--primary:hover:not(:disabled) { filter: brightness(1.07); transform: translateY(-1px); }

  .tv-btn--ghost {
    background: #f1f5f9;
    color: #475569;
    border-color: #e2e8f0;
  }
  .tv-btn--ghost:hover:not(:disabled) { background: #e2e8f0; }

  .tv-btn--danger-ghost {
    background: rgba(239,68,68,0.07);
    color: #dc2626;
    border-color: rgba(239,68,68,0.2);
  }
  .tv-btn--danger-ghost:hover:not(:disabled) { background: rgba(239,68,68,0.14); }

  /* ─── Form elements ──────────────────────────────────────────────────────── */
  .tv-label {
    display: block;
    font-size: 0.7rem;
    font-weight: 700;
    color: #94a3b8;
    text-transform: uppercase;
    letter-spacing: 0.09em;
    margin-bottom: 0.4rem;
  }
  .tv-label--sm { font-size: 0.64rem; margin-bottom: 0.3rem; }
  .tv-required { color: #ef4444; }

  .tv-form-group { display: flex; flex-direction: column; }

  .tv-input {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 0.52rem 0.85rem;
    font-size: 0.88rem;
    color: #0f172a;
    outline: none;
    font-family: inherit;
    transition: border-color 0.14s, box-shadow 0.14s;
  }
  .tv-input:focus { border-color: #02b6bc; box-shadow: 0 0 0 3px rgba(2,182,188,0.10); }
  .tv-input--title { font-size: 1.05rem; font-weight: 700; letter-spacing: -0.01em; }
  .tv-input--sub { font-size: 0.82rem; color: #64748b; }
  .tv-input--cfg {
    padding: 0.42rem 0.7rem;
    font-size: 0.82rem;
    border-radius: 8px;
    width: 100%;
    box-sizing: border-box;
  }

  /* ─── ⚙️ Template-mapping config panel ───────────────────────────────────── */
  .tv-config__section {
    display: flex;
    flex-direction: column;
    gap: 0.7rem;
  }
  .tv-config__section-head { display: flex; flex-direction: column; gap: 0.15rem; }
  .tv-config__section-title {
    font-size: 0.92rem;
    font-weight: 800;
    color: #0f172a;
    letter-spacing: -0.01em;
  }
  .tv-config__section-sub { font-size: 0.74rem; color: #94a3b8; line-height: 1.5; }
  .tv-config__default-select { max-width: 460px; }

  .tv-config__empty {
    text-align: center;
    color: #94a3b8;
    padding: 1.4rem;
    background: #f8fafc;
    border: 1px dashed #e2e8f0;
    border-radius: 10px;
    font-size: 0.8rem;
    line-height: 1.6;
  }

  .tv-config__rules { display: flex; flex-direction: column; gap: 0.7rem; }

  .tv-config__rule {
    display: flex;
    align-items: flex-start;
    gap: 0.7rem;
    background: #fafbfc;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    padding: 0.85rem 0.9rem;
  }

  .tv-config__rule-index {
    flex-shrink: 0;
    width: 24px;
    height: 24px;
    border-radius: 7px;
    background: rgba(2,182,188,0.1);
    color: #0d9488;
    font-size: 0.72rem;
    font-weight: 800;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-top: 1.35rem;
  }

  .tv-config__rule-grid {
    display: grid;
    grid-template-columns: 1.3fr 1fr 1.2fr 1.5fr 0.7fr;
    gap: 0.55rem;
    flex: 1;
    min-width: 0;
  }
  @media (max-width: 1180px) {
    .tv-config__rule-grid { grid-template-columns: 1fr 1fr; }
  }

  .tv-config__field { display: flex; flex-direction: column; min-width: 0; }
  .tv-config__opt {
    color: #cbd5e1;
    font-weight: 600;
    text-transform: none;
    letter-spacing: 0;
  }

  .tv-config__rule-controls {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    flex-shrink: 0;
    margin-top: 1.35rem;
  }

  .tv-config__add {
    align-self: flex-start;
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 0.5rem 1rem;
    background: rgba(2,182,188,0.08);
    border: 1px dashed rgba(2,182,188,0.4);
    border-radius: 10px;
    color: #0d9488;
    font-size: 0.8rem;
    font-weight: 700;
    cursor: pointer;
    font-family: inherit;
    transition: background 0.14s, border-color 0.14s;
  }
  .tv-config__add:hover { background: rgba(2,182,188,0.15); border-color: #02b6bc; }


  .tv-textarea {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 0.6rem 0.85rem;
    font-size: 0.84rem;
    color: #0f172a;
    outline: none;
    resize: vertical;
    font-family: inherit;
    transition: border-color 0.14s, box-shadow 0.14s;
  }
  .tv-textarea:focus { border-color: #02b6bc; box-shadow: 0 0 0 3px rgba(2,182,188,0.10); }
  .tv-textarea--sm { min-height: 50px; }

  /* ─── Config-rule icon buttons (↑ ↓ ✕) ───────────────────────────────────── */
  .tv-icon-btn {
    width: 26px;
    height: 26px;
    border-radius: 6px;
    border: 1px solid #e2e8f0;
    background: #fff;
    color: #64748b;
    font-size: 0.75rem;
    font-weight: 700;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.12s, color 0.12s, border-color 0.12s;
  }
  .tv-icon-btn:hover:not(:disabled) { background: #f1f5f9; color: #0f172a; }
  .tv-icon-btn:disabled { opacity: 0.35; cursor: not-allowed; }
  .tv-icon-btn--danger { color: #ef4444; border-color: rgba(239,68,68,0.2); }
  .tv-icon-btn--danger:hover:not(:disabled) { background: rgba(239,68,68,0.08); color: #dc2626; }

  /* ─── Edit-header meta row ───────────────────────────────────────────────── */
  .tv-meta-row {
    font-size: 0.76rem;
    color: #94a3b8;
  }

  .tv-apply-hint {
    background: rgba(2,182,188,0.07);
    border: 1px solid rgba(2,182,188,0.2);
    border-radius: 8px;
    padding: 0.7rem 1rem;
    font-size: 0.8rem;
    color: #0d9488;
  }

  /* ─── Status messages ────────────────────────────────────────────────────── */
  .tv-success-msg {
    padding: 0.55rem 0.9rem;
    background: #f0fdf4;
    color: #16a34a;
    border: 1px solid #bbf7d0;
    border-radius: 8px;
    font-size: 0.82rem;
    font-weight: 600;
  }
  .tv-error-msg {
    padding: 0.55rem 0.9rem;
    background: #fef2f2;
    color: #dc2626;
    border: 1px solid #fecaca;
    border-radius: 8px;
    font-size: 0.82rem;
    font-weight: 600;
  }

  .tv-save-bar { display: flex; gap: 0.5rem; }

  .tv-empty {
    padding: 2rem 1.2rem;
    text-align: center;
    color: #94a3b8;
    font-size: 0.82rem;
    line-height: 1.6;
  }
  .tv-empty p { margin: 0.2rem 0; }
  .tv-empty--sm { padding: 0.7rem 1.2rem; }

  /* ─── Sidebar search ─────────────────────────────────────────────────────── */
  .tv-sidebar__search {
    padding: 0.5rem 0.8rem 0.3rem;
    border-bottom: 1px solid #f1f5f9;
    flex-shrink: 0;
  }
  .tv-sidebar__search-input {
    width: 100%;
    box-sizing: border-box;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 7px;
    padding: 0.36rem 0.75rem;
    font-size: 0.78rem;
    color: #0f172a;
    outline: none;
    font-family: inherit;
    transition: border-color 0.14s, box-shadow 0.14s;
  }
  .tv-sidebar__search-input:focus {
    border-color: #02b6bc;
    box-shadow: 0 0 0 2px rgba(2,182,188,0.1);
  }

  /* ─── Default badge in list items ────────────────────────────────────────── */
  .tv-list__name-row {
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }
  .tv-list__default-badge {
    display: inline-block;
    font-size: 0.58rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #0d9488;
    background: rgba(2,182,188,0.1);
    border: 1px solid rgba(2,182,188,0.25);
    border-radius: 4px;
    padding: 1px 5px;
    flex-shrink: 0;
    white-space: nowrap;
  }

</style>
