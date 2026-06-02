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
    type QuoteTemplate,
    type QuoteBlock,
    type QuoteBlockType,
  } from '../store.ts';
  import { MERGE_FIELDS, mergeFieldsByGroup } from '$lib/mergeFields.ts';

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
    editing = false;
    creatingNew = false;
    saveMsg = '';
    saveError = '';
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
    editing = false;
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
    if (!editName.trim()) { saveError = 'El nombre del template es obligatorio.'; return; }
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
        saveMsg = `✓ Template "${editName.trim()}" guardado.`;
      }
      editing = false;
    } catch (err: any) {
      saveError = '✗ ' + (err?.message ?? 'Save failed');
    } finally {
      saving = false;
    }
  }

  async function handleDelete() {
    if (!selectedTemplate) return;
    if (!confirm(`¿Eliminar el template "${selectedTemplate.name}"? Esta acción no se puede deshacer.`)) return;
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
    if (!newName.trim()) { saveError = 'El nombre del template es obligatorio.'; return; }
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
      saveMsg = `✓ Template "${created.name}" creado. Ahora agregá bloques.`;
    } catch (err: any) {
      saveError = '✗ ' + (err?.message ?? 'Create failed');
    } finally {
      saving = false;
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

  <!-- ── Sidebar: template list ─────────────────────────────────────────────── -->
  <aside class="tv-sidebar">
    <div class="tv-sidebar__header">
      <h2 class="tv-sidebar__title">📄 Quote Templates</h2>
      <button class="tv-new-btn" on:click={openCreateNew} title="Create new template">+ New</button>
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
            on:click={() => selectTemplate(tmpl)}
            role="button"
            tabindex="0"
            on:keydown={(e) => e.key === 'Enter' && selectTemplate(tmpl)}
          >
            <div class="tv-list__name-row">
              <span class="tv-list__name">{tmpl.name}</span>
              {#if tmpl.isDefault}
                <span class="tv-list__default-badge">Default</span>
              {/if}
            </div>
            <span class="tv-list__meta">
              {tmpl.blocks.length} block{tmpl.blocks.length !== 1 ? 's' : ''}
              {#if tmpl.category}<span class="tv-list__cat">· {tmpl.category}</span>{/if}
            </span>
          </li>
        {/each}
        {#if filteredTemplates.length === 0 && sidebarSearch}
          <div class="tv-empty tv-empty--sm">No templates match "{sidebarSearch}"</div>
        {/if}
      </ul>
    {/if}
  </aside>

  <!-- ── Main panel ─────────────────────────────────────────────────────────── -->
  <main class="tv-main">

    <!-- ── Create New form ──────────────────────────────────────────────────── -->
    {#if creatingNew}
      <div class="tv-panel">
        <div class="tv-panel__header">
          <h3 class="tv-panel__title">✨ Nuevo Template</h3>
          <button class="tv-btn tv-btn--ghost" on:click={() => { creatingNew = false; saveMsg = ''; saveError = ''; }}>Cancel</button>
        </div>

        <div class="tv-form-group">
          <label class="tv-label">Nombre <span class="tv-required">*</span></label>
          <input class="tv-input" bind:value={newName} placeholder="Ej.: Costa Rica — Standard FCL" />
        </div>

        <div class="tv-form-group">
          <label class="tv-label">Categoría</label>
          <input class="tv-input" bind:value={newCategory} placeholder="Ej.: costa-rica, mexico-container…" />
        </div>

        <div class="tv-form-group">
          <label class="tv-label">Descripción</label>
          <textarea class="tv-textarea tv-textarea--sm" bind:value={newDescription} placeholder="Describe cuándo usar este template…" rows="2"></textarea>
        </div>

        {#if saveError}<div class="tv-error-msg">{saveError}</div>{/if}

        <div class="tv-save-bar">
          <button class="tv-btn tv-btn--primary" on:click={handleCreateNew} disabled={saving}>
            {saving ? 'Creando…' : '✓ Crear Template'}
          </button>
        </div>
      </div>

    <!-- ── No selection ────────────────────────────────────────────────────── -->
    {:else if !selectedTemplate}
      <div class="tv-placeholder">
        <span class="tv-placeholder__icon">📄</span>
        <p>Seleccioná un template de la lista o<br>creá uno nuevo con el botón <strong>+ New</strong>.</p>
        <p class="tv-placeholder__hint">
          Los templates son bloques de contenido reutilizables para propuestas tipo Qwilr.<br>
          Se aplican sobre una cotización (quote) desde el QuoteEditor.
        </p>
      </div>

    <!-- ── Edit Mode ────────────────────────────────────────────────────────── -->
    {:else if editing}
      <div class="tv-panel">
        <div class="tv-panel__header">
          <div class="tv-panel__titles">
            <input class="tv-input tv-input--title" bind:value={editName} placeholder="Template name…" />
            <input class="tv-input tv-input--sub" bind:value={editCategory} placeholder="Category (opcional)" />
          </div>
          <div class="tv-panel__actions">
            <button class="tv-btn tv-btn--ghost" on:click={cancelEdit} disabled={saving}>Cancel</button>
            <button class="tv-btn tv-btn--primary" on:click={handleSave} disabled={saving || !editName.trim()}>
              {saving ? '⏳ Saving…' : '💾 Save'}
            </button>
          </div>
        </div>

        {#if saveMsg}<div class="tv-success-msg">{saveMsg}</div>{/if}
        {#if saveError}<div class="tv-error-msg">{saveError}</div>{/if}

        <div class="tv-form-group">
          <label class="tv-label">Descripción</label>
          <input class="tv-input" bind:value={editDescription} placeholder="Descripción opcional…" />
        </div>

        <!-- ── Block list ────────────────────────────────────────────────────── -->
        <div class="tv-blocks-section">
          <div class="tv-blocks-section__header">
            <span class="tv-label">Bloques ({editBlocks.length})</span>
            <span class="tv-blocks-section__hint">Arrastrá para reordenar · Los bloques se renderizan en orden en el status page</span>
          </div>

          {#if editBlocks.length === 0}
            <div class="tv-blocks-empty">No hay bloques. Agregá uno desde el panel de abajo.</div>
          {:else}
            <div class="tv-blocks-list">
              {#each editBlocks as block, i (block.id)}
                <div class="tv-block-card">
                  <div class="tv-block-card__header">
                    <div class="tv-block-card__type-row">
                      <span class="tv-block-card__icon">{blockTypeIcon(block.type)}</span>
                      <span class="tv-block-card__label">{blockTypeLabel(block.type)}</span>
                      <code class="tv-block-card__id">{block.id}</code>
                    </div>
                    <div class="tv-block-card__controls">
                      <button class="tv-icon-btn" on:click={() => moveBlockUp(i)} disabled={i === 0} title="Move up">↑</button>
                      <button class="tv-icon-btn" on:click={() => moveBlockDown(i)} disabled={i === editBlocks.length - 1} title="Move down">↓</button>
                      <button class="tv-icon-btn tv-icon-btn--danger" on:click={() => removeBlock(block.id)} title="Remove block">✕</button>
                    </div>
                  </div>

                  {#if hasHtmlEditor(block.type)}
                    <div class="tv-block-card__body">
                      <div class="tv-block-card__html-label-row">
                        <label class="tv-label tv-label--sm">HTML Content</label>
                        <button
                          type="button"
                          class="tv-insert-field-btn"
                          on:click={() => openPicker(block.id)}
                          title="Insert merge field — client name, route, move details…"
                        >
                          ＋ Insert field
                        </button>
                      </div>

                      <!-- ── Merge-field picker ──────────────────────────────── -->
                      {#if activePickerBlockId === block.id}
                        <!-- svelte-ignore a11y-click-events-have-key-events -->
                        <div class="tv-field-picker" on:click|stopPropagation>
                          <div class="tv-field-picker__header">
                            <span class="tv-field-picker__title">Insert field token</span>
                            <button class="tv-field-picker__close" on:click={closePicker} title="Close">✕</button>
                          </div>
                          <input
                            class="tv-field-picker__search"
                            type="text"
                            bind:value={pickerSearch}
                            placeholder="Search fields…"
                            autocomplete="off"
                          />
                          <div class="tv-field-picker__groups">
                            {#each Object.entries(pickerGroups) as [group, fields]}
                              {@const visibleFields = fields.filter(f =>
                                !pickerSearch.trim() ||
                                f.label.toLowerCase().includes(pickerSearch.toLowerCase()) ||
                                f.token.toLowerCase().includes(pickerSearch.toLowerCase())
                              )}
                              {#if visibleFields.length > 0}
                                <div class="tv-field-picker__group">
                                  <span class="tv-field-picker__group-label">{group}</span>
                                  {#each visibleFields as field (field.token)}
                                    <button
                                      class="tv-field-picker__field"
                                      on:click={() => insertField(block.id, field.token)}
                                      title="{field.token} — e.g. {field.example}"
                                    >
                                      <span class="tv-field-picker__field-label">{field.label}</span>
                                      <code class="tv-field-picker__field-token">{field.token}</code>
                                      <span class="tv-field-picker__field-example">{field.example}</span>
                                    </button>
                                  {/each}
                                </div>
                              {/if}
                            {/each}
                            {#if filteredPickerFields.length === 0 && pickerSearch}
                              <div class="tv-field-picker__empty">No fields match "{pickerSearch}"</div>
                            {/if}
                          </div>
                        </div>
                      {/if}

                      <textarea
                        class="tv-textarea tv-textarea--code"
                        data-block-id={block.id}
                        value={block.html ?? ''}
                        on:input={(e) => updateBlockHtml(block.id, e.currentTarget.value)}
                        rows="6"
                        placeholder={HTML_BLOCK_PLACEHOLDER}
                        spellcheck="false"
                      ></textarea>
                    </div>
                  {:else}
                    <div class="tv-block-card__body tv-block-card__body--info">
                      <span class="tv-block-card__auto-label">
                        {#if block.type === 'quoteTable'}📊 Renders the quote's line-items table automatically.{/if}
                        {#if block.type === 'accept'}✅ Renders the "Aceptar cotización" CTA automatically.{/if}
                        {#if block.type === 'testimonials' || block.type === 'reviews' || block.type === 'partners'}🔧 Phase 3 block — renders as placeholder until implemented.{/if}
                      </span>
                    </div>
                  {/if}
                </div>
              {/each}
            </div>
          {/if}
        </div>

        <!-- ── Add Block Palette ──────────────────────────────────────────────── -->
        <div class="tv-palette">
          <span class="tv-label">+ Agregar Bloque</span>
          <div class="tv-palette__grid">
            {#each BLOCK_TYPES as bt (bt.type)}
              <button
                class="tv-palette__btn"
                on:click={() => addBlock(bt.type)}
                title={bt.description}
              >
                <span class="tv-palette__icon">{bt.icon}</span>
                <span class="tv-palette__label">{bt.label}</span>
              </button>
            {/each}
          </div>
        </div>
      </div>

    <!-- ── View / Preview Mode ──────────────────────────────────────────────── -->
    {:else}
      <div class="tv-panel">
        <div class="tv-panel__header">
          <div>
            <h3 class="tv-panel__title">{selectedTemplate.name}</h3>
            {#if selectedTemplate.category}
              <span class="tv-cat-badge">{selectedTemplate.category}</span>
            {/if}
            {#if selectedTemplate.description}
              <p class="tv-panel__desc">{selectedTemplate.description}</p>
            {/if}
          </div>
          <div class="tv-panel__actions">
            <button class="tv-btn tv-btn--danger-ghost" on:click={handleDelete} title="Delete this template">🗑 Delete</button>
            <button class="tv-btn tv-btn--primary" on:click={startEdit}>✏️ Edit</button>
          </div>
        </div>

        {#if saveMsg}<div class="tv-success-msg">{saveMsg}</div>{/if}
        {#if saveError}<div class="tv-error-msg">{saveError}</div>{/if}

        <div class="tv-meta-row">
          <span>Created by <strong>{selectedTemplate.createdBy.split('@')[0]}</strong> · {formatDate(selectedTemplate.createdAt)}</span>
          {#if selectedTemplate.updatedAt}
            <span>· Last updated {formatDate(selectedTemplate.updatedAt)}</span>
          {/if}
        </div>

        <!-- Block summary list -->
        {#if selectedTemplate.blocks.length === 0}
          <div class="tv-blocks-empty">Este template no tiene bloques. Hacé click en Edit para añadir.</div>
        {:else}
          <div class="tv-preview-list">
            {#each selectedTemplate.blocks as block, i (block.id)}
              <div class="tv-preview-item">
                <span class="tv-preview-item__num">{i + 1}</span>
                <span class="tv-preview-item__icon">{blockTypeIcon(block.type)}</span>
                <span class="tv-preview-item__type">{blockTypeLabel(block.type)}</span>
                {#if block.html}
                  <span class="tv-preview-item__html-preview">
                    {block.html.replace(/<[^>]+>/g, ' ').slice(0, 80).trim()}{block.html.length > 80 ? '…' : ''}
                  </span>
                {/if}
              </div>
            {/each}
          </div>
        {/if}

        <div class="tv-apply-hint">
          💡 Para aplicar este template a una cotización, abrí el <strong>QuoteEditor</strong> → botón <em>"Usar Template"</em>.
        </div>
      </div>
    {/if}
  </main>
</div>

<style>
  /* ─── Root layout ────────────────────────────────────────────────────────── */
  .tv-root {
    display: flex;
    height: calc(100vh - 64px);
    overflow: hidden;
    font-family: var(--font-paragraph, 'Jost'), system-ui, sans-serif;
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

  .tv-sidebar__title {
    font-size: 0.88rem;
    font-weight: 800;
    color: #0f172a;
    margin: 0;
    letter-spacing: -0.01em;
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
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 0.7rem 1.2rem;
    cursor: pointer;
    border-left: 3px solid transparent;
    transition: background 0.12s, border-color 0.12s;
  }
  .tv-list__item:hover { background: #f8fafc; border-left-color: #e2e8f0; }
  .tv-list__item--active { background: #f0fdfe; border-left-color: #02b6bc; }

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
  .tv-textarea--code {
    font-family: 'SF Mono','Fira Code','JetBrains Mono',monospace;
    font-size: 0.8rem;
    min-height: 100px;
    line-height: 1.55;
    tab-size: 2;
  }

  /* ─── Blocks section ─────────────────────────────────────────────────────── */
  .tv-blocks-section { display: flex; flex-direction: column; gap: 0.6rem; }

  .tv-blocks-section__header {
    display: flex;
    align-items: baseline;
    gap: 0.8rem;
  }
  .tv-blocks-section__hint {
    font-size: 0.7rem;
    color: #94a3b8;
    font-style: italic;
  }

  .tv-blocks-empty {
    text-align: center;
    color: #94a3b8;
    padding: 1.5rem;
    background: #f8fafc;
    border-radius: 10px;
    border: 1px dashed #e2e8f0;
    font-size: 0.82rem;
  }

  .tv-blocks-list { display: flex; flex-direction: column; gap: 0.6rem; }

  /* ─── Block card ─────────────────────────────────────────────────────────── */
  .tv-block-card {
    background: #fafbfc;
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    overflow: hidden;
  }

  .tv-block-card__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.55rem 0.9rem;
    background: #f1f5f9;
    border-bottom: 1px solid #e2e8f0;
  }

  .tv-block-card__type-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .tv-block-card__icon { font-size: 1rem; }
  .tv-block-card__label { font-size: 0.8rem; font-weight: 700; color: #0f172a; }
  .tv-block-card__id {
    font-family: 'SF Mono', monospace;
    font-size: 0.67rem;
    color: #94a3b8;
    background: #e2e8f0;
    border-radius: 4px;
    padding: 0.1em 0.45em;
  }

  .tv-block-card__controls { display: flex; gap: 0.3rem; }

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

  .tv-block-card__body { padding: 0.7rem 0.9rem; display: flex; flex-direction: column; gap: 0.4rem; }
  .tv-block-card__body--info {
    background: #f0fdfe;
    border-top: 1px solid #e2e8f0;
  }
  .tv-block-card__auto-label { font-size: 0.78rem; color: #0d9488; font-style: italic; }

  /* ─── Block palette ──────────────────────────────────────────────────────── */
  .tv-palette {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }

  .tv-palette__grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(88px, 1fr));
    gap: 0.45rem;
  }

  .tv-palette__btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
    padding: 0.55rem 0.4rem;
    background: #fff;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    cursor: pointer;
    transition: background 0.12s, border-color 0.12s, transform 0.12s;
  }
  .tv-palette__btn:hover { background: #f0fdfe; border-color: rgba(2,182,188,0.3); transform: translateY(-1px); }

  .tv-palette__icon { font-size: 1.2rem; }
  .tv-palette__label { font-size: 0.67rem; font-weight: 600; color: #475569; text-align: center; line-height: 1.3; }

  /* ─── Preview mode ───────────────────────────────────────────────────────── */
  .tv-meta-row {
    font-size: 0.76rem;
    color: #94a3b8;
  }

  .tv-preview-list { display: flex; flex-direction: column; gap: 0.4rem; }

  .tv-preview-item {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.55rem 0.85rem;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    font-size: 0.82rem;
  }

  .tv-preview-item__num {
    font-size: 0.65rem;
    font-weight: 800;
    color: #94a3b8;
    width: 18px;
    text-align: center;
    flex-shrink: 0;
  }

  .tv-preview-item__icon { font-size: 0.95rem; flex-shrink: 0; }
  .tv-preview-item__type { font-weight: 700; color: #334155; white-space: nowrap; }

  .tv-preview-item__html-preview {
    font-size: 0.72rem;
    color: #94a3b8;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
    font-family: 'SF Mono', monospace;
  }

  .tv-apply-hint {
    background: rgba(2,182,188,0.07);
    border: 1px solid rgba(2,182,188,0.2);
    border-radius: 8px;
    padding: 0.7rem 1rem;
    font-size: 0.8rem;
    color: #0d9488;
  }

  .tv-cat-badge {
    display: inline-flex;
    align-items: center;
    background: rgba(2,182,188,0.08);
    color: #0d9488;
    border: 1px solid rgba(2,182,188,0.2);
    border-radius: 999px;
    font-size: 0.7rem;
    font-weight: 700;
    padding: 0.15em 0.6em;
    letter-spacing: 0.04em;
    margin-left: 0.5rem;
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

  /* ─── Insert-field button + picker ──────────────────────────────────────── */
  .tv-block-card__html-label-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.2rem;
  }
  .tv-block-card__html-label-row .tv-label { margin-bottom: 0; }

  .tv-insert-field-btn {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 3px 10px;
    background: rgba(2,182,188,0.08);
    border: 1px solid rgba(2,182,188,0.25);
    border-radius: 6px;
    color: #0d9488;
    font-size: 0.72rem;
    font-weight: 700;
    cursor: pointer;
    transition: background 0.12s, border-color 0.12s;
    letter-spacing: 0.02em;
  }
  .tv-insert-field-btn:hover {
    background: rgba(2,182,188,0.15);
    border-color: rgba(2,182,188,0.4);
    color: #02b6bc;
  }

  /* Field picker popover */
  .tv-field-picker {
    background: #fff;
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    box-shadow:
      0 4px 20px rgba(0,0,0,0.10),
      0 1px 4px rgba(0,0,0,0.06);
    margin-bottom: 0.5rem;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .tv-field-picker__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.55rem 0.9rem 0.4rem;
    border-bottom: 1px solid #f1f5f9;
    background: #f8fafc;
  }
  .tv-field-picker__title {
    font-size: 0.72rem;
    font-weight: 800;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }
  .tv-field-picker__close {
    width: 22px;
    height: 22px;
    background: none;
    border: none;
    color: #94a3b8;
    cursor: pointer;
    border-radius: 5px;
    font-size: 0.75rem;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.12s, color 0.12s;
  }
  .tv-field-picker__close:hover { background: #f1f5f9; color: #0f172a; }

  .tv-field-picker__search {
    margin: 0.5rem 0.8rem;
    padding: 0.38rem 0.75rem;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 7px;
    font-size: 0.78rem;
    color: #0f172a;
    outline: none;
    font-family: inherit;
    transition: border-color 0.14s;
  }
  .tv-field-picker__search:focus { border-color: #02b6bc; }

  .tv-field-picker__groups {
    overflow-y: auto;
    max-height: 260px;
    padding: 0 0.5rem 0.5rem;
    scrollbar-width: thin;
    scrollbar-color: rgba(2,182,188,0.15) transparent;
  }

  .tv-field-picker__group { margin-bottom: 0.2rem; }
  .tv-field-picker__group-label {
    display: block;
    font-size: 0.62rem;
    font-weight: 800;
    color: #94a3b8;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    padding: 0.45rem 0.5rem 0.25rem;
  }

  .tv-field-picker__field {
    display: flex;
    align-items: baseline;
    gap: 0.5rem;
    width: 100%;
    padding: 0.42rem 0.65rem;
    background: none;
    border: none;
    border-radius: 7px;
    cursor: pointer;
    text-align: left;
    transition: background 0.1s;
    font-family: inherit;
  }
  .tv-field-picker__field:hover { background: #f0fdfe; }

  .tv-field-picker__field-label {
    font-size: 0.78rem;
    font-weight: 600;
    color: #0f172a;
    white-space: nowrap;
    flex-shrink: 0;
    min-width: 90px;
  }
  .tv-field-picker__field-token {
    font-size: 0.7rem;
    color: #02b6bc;
    background: rgba(2,182,188,0.08);
    border-radius: 4px;
    padding: 1px 6px;
    font-family: 'SF Mono','Fira Code',monospace;
    white-space: nowrap;
    flex-shrink: 0;
  }
  .tv-field-picker__field-example {
    font-size: 0.68rem;
    color: #94a3b8;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .tv-field-picker__empty {
    padding: 0.7rem 0.65rem;
    font-size: 0.78rem;
    color: #94a3b8;
    text-align: center;
  }
</style>
