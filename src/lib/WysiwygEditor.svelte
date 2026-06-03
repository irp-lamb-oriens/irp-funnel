<script lang="ts">
  /**
   * WysiwygEditor.svelte — Centralized, modular, zero-dependency WYSIWYG
   * block-canvas editor for IRP quote document templates.
   *
   * Architecture:
   *  • Each QuoteBlock is a visual card rendered in the document order.
   *  • HTML-content blocks (html/heading/banner/accordion) are edited
   *    inline via contenteditable — no raw textarea in sight (true WYSIWYG).
   *  • Non-HTML blocks (quoteTable, accept, …) show auto-generated placeholders.
   *  • Drag-and-drop reordering via native HTML5 drag API (zero deps).
   *  • Formatting toolbar (sticky per focused block): B, I, U, H2-H4, UL,
   *    OL, link, remove-format.
   *  • Section assignment: every block can be tagged with a named section label.
   *    Blocks sharing a section label render as navigable tabs on the status page.
   *  • Merge-field picker: insert {{tokens}} at cursor position.
   *
   * Usage:
   *   <WysiwygEditor bind:blocks={editBlocks} />
   *
   * Backward compatible: if blocks is empty, shows an empty palette.
   * Svelte 4 syntax throughout (on: directives — NOT $effect).
   */

  import { tick, createEventDispatcher } from 'svelte';
  import type { QuoteBlock, QuoteBlockType } from '../routes/dashboard/store.ts';
  import { MERGE_FIELDS, mergeFieldsByGroup } from './mergeFields.ts';

  // ── Props ────────────────────────────────────────────────────────────────────
  /** Two-way bound blocks array. */
  export let blocks: QuoteBlock[] = [];
  /** Optional client summary for showing merge-field hints. */
  export let clientSummary: Record<string, any> = {};

  const dispatch = createEventDispatcher<{ change: QuoteBlock[] }>();

  // ── Internal state ───────────────────────────────────────────────────────────
  let focusedBlockId: string | null = null;
  let dragIndex = -1;
  let dropIndex = -1;

  // Merge field picker
  let activePickerBlockId: string | null = null;
  let pickerSearch = '';
  $: pickerGroups = mergeFieldsByGroup();
  $: filteredFields = MERGE_FIELDS.filter(f =>
    !pickerSearch.trim() ||
    f.label.toLowerCase().includes(pickerSearch.toLowerCase()) ||
    f.token.toLowerCase().includes(pickerSearch.toLowerCase())
  );

  // ── Block type catalog ───────────────────────────────────────────────────────
  const BLOCK_CATALOG: Array<{ type: QuoteBlockType; label: string; icon: string; hint: string }> = [
    { type: 'html',        label: 'HTML',        icon: '📝', hint: 'Free-form rich text — headings, lists, tables' },
    { type: 'heading',     label: 'Heading',     icon: '📌', hint: 'Standalone heading block' },
    { type: 'banner',      label: 'Banner',      icon: '🖼️', hint: 'Full-width hero section' },
    { type: 'accordion',   label: 'Accordion',   icon: '📋', hint: 'Expandable info section (T&Cs, regulations)' },
    { type: 'quoteTable',  label: 'Quote Table', icon: '💰', hint: 'Live line-items from the quote' },
    { type: 'accept',      label: 'Accept CTA',  icon: '✅', hint: '"Book Your Move" acceptance button' },
    { type: 'testimonials',label: 'Testimonials',icon: '🌟', hint: 'Customer testimonials section' },
    { type: 'reviews',     label: 'Reviews',     icon: '⭐', hint: 'Google Reviews section' },
    { type: 'partners',    label: 'Partners',    icon: '🤝', hint: 'Business partner logos' },
  ];

  const HTML_CONTENT_TYPES = new Set<QuoteBlockType>(['html', 'heading', 'banner', 'accordion']);

  function blockIcon(type: QuoteBlockType): string {
    return BLOCK_CATALOG.find(b => b.type === type)?.icon ?? '📦';
  }
  function blockLabel(type: QuoteBlockType): string {
    return BLOCK_CATALOG.find(b => b.type === type)?.label ?? type;
  }
  function hasEditor(type: QuoteBlockType): boolean {
    return HTML_CONTENT_TYPES.has(type);
  }

  // ── Unique sections for datalist ─────────────────────────────────────────────
  $: existingSections = [...new Set(blocks.map(b => b.section).filter(Boolean))] as string[];

  // ── Svelte action: initialise contenteditable HTML safely ────────────────────
  //
  // Using a Svelte action avoids the cursor-jump bug that occurs when
  // bind:innerHTML triggers a re-render on every keystroke.
  // The div starts with block.html; we only update it from outside when
  // the element is NOT focused (i.e. an external blocks reload happened).
  function initContent(el: HTMLElement, html: string | null | undefined) {
    el.innerHTML = html ?? '';
    return {
      update(newHtml: string | null | undefined) {
        if (document.activeElement !== el && el.innerHTML !== (newHtml ?? '')) {
          el.innerHTML = newHtml ?? '';
        }
      },
    };
  }

  // ── Block mutation helpers ───────────────────────────────────────────────────
  function saveHtml(blockId: string, html: string) {
    blocks = blocks.map(b => b.id === blockId ? { ...b, html } : b);
    dispatch('change', blocks);
  }

  function saveSection(blockId: string, section: string) {
    blocks = blocks.map(b =>
      b.id === blockId ? { ...b, section: section.trim() || null } : b,
    );
    dispatch('change', blocks);
  }

  function removeBlock(blockId: string) {
    blocks = blocks.filter(b => b.id !== blockId);
    dispatch('change', blocks);
  }

  function addBlock(type: QuoteBlockType) {
    const id = `blk-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    blocks = [
      ...blocks,
      {
        id,
        type,
        html: HTML_CONTENT_TYPES.has(type) ? '<p>Your content here...</p>' : null,
        data: null,
        section: null,
      },
    ];
    dispatch('change', blocks);
    tick().then(() => {
      const el = document.querySelector<HTMLElement>(`[data-ce="${id}"]`);
      if (el) { el.focus(); selectAll(el); }
    });
  }

  function selectAll(el: HTMLElement) {
    const range = document.createRange();
    range.selectNodeContents(el);
    const sel = window.getSelection();
    if (sel) { sel.removeAllRanges(); sel.addRange(range); }
  }

  // ── Drag-and-drop ────────────────────────────────────────────────────────────
  function onDragStart(index: number, e: DragEvent) {
    dragIndex = index;
    if (e.dataTransfer) { e.dataTransfer.effectAllowed = 'move'; }
  }

  function onDragOver(index: number, e: DragEvent) {
    e.preventDefault();
    dropIndex = index;
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
  }

  function onDrop(index: number, e: DragEvent) {
    e.preventDefault();
    if (dragIndex < 0 || dragIndex === index) { dragIndex = -1; dropIndex = -1; return; }
    const arr = [...blocks];
    const [removed] = arr.splice(dragIndex, 1);
    arr.splice(index, 0, removed);
    blocks = arr;
    dispatch('change', blocks);
    dragIndex = -1; dropIndex = -1;
  }

  function onDragEnd() { dragIndex = -1; dropIndex = -1; }

  // ── Formatting toolbar ────────────────────────────────────────────────────────
  function fmt(cmd: string, value?: string) {
    document.execCommand(cmd, false, value ?? undefined);
  }

  function fmtBlock(tag: string) {
    document.execCommand('formatBlock', false, tag);
  }

  function insertLink() {
    const url = prompt('Enter URL:');
    if (url) document.execCommand('createLink', false, url);
  }

  function onEditorBlur(e: FocusEvent, blockId: string) {
    const el = e.currentTarget as HTMLElement;
    saveHtml(blockId, el.innerHTML);
    // Delay clearing focusedBlockId so toolbar clicks can register
    setTimeout(() => {
      if (document.activeElement?.closest('.we-toolbar') || document.activeElement?.closest('.we-picker')) return;
      if (focusedBlockId === blockId) focusedBlockId = null;
    }, 150);
  }

  // ── Merge-field picker ────────────────────────────────────────────────────────
  function openPicker(blockId: string) {
    activePickerBlockId = blockId;
    pickerSearch = '';
  }

  function closePicker() { activePickerBlockId = null; pickerSearch = ''; }

  function insertField(blockId: string, token: string) {
    const el = document.querySelector<HTMLElement>(`[data-ce="${blockId}"]`);
    if (el) {
      el.focus();
      document.execCommand('insertText', false, token);
      saveHtml(blockId, el.innerHTML);
    }
    closePicker();
  }
</script>

<!-- ═════════════════════════════════════════════════════════════════════ -->
<!-- WYSIWYG BLOCK CANVAS                                                   -->
<!-- ═════════════════════════════════════════════════════════════════════ -->

<div class="we-root">

  {#if blocks.length === 0}
    <div class="we-empty">
      <span class="we-empty__icon">📄</span>
      <p>No blocks yet. Add one from the palette below.</p>
    </div>
  {:else}
    <div class="we-canvas">
      {#each blocks as block, i (block.id)}
        <!-- Drop indicator above this block -->
        {#if dropIndex === i && dragIndex !== i}
          <div class="we-drop-indicator"></div>
        {/if}

        <!-- ── Block card ──────────────────────────────────────────────── -->
        <div
          class="we-block"
          class:we-block--focused={focusedBlockId === block.id}
          class:we-block--dragging={dragIndex === i}
          draggable="true"
          on:dragstart={(e) => onDragStart(i, e)}
          on:dragover={(e) => onDragOver(i, e)}
          on:drop={(e) => onDrop(i, e)}
          on:dragend={onDragEnd}
          role="listitem"
        >
          <!-- ── Block header bar ────────────────────────────────────── -->
          <div class="we-block__header">
            <div class="we-block__header-left">
              <!-- Drag handle -->
              <span class="we-drag-handle" title="Drag to reorder">⠿</span>
              <span class="we-block__icon">{blockIcon(block.type)}</span>
              <span class="we-block__type">{blockLabel(block.type)}</span>
            </div>
            <div class="we-block__header-right">
              <!-- Section assignment -->
              <div class="we-section-field">
                <label class="we-section-label" for="sec-{block.id}">Tab:</label>
                <input
                  id="sec-{block.id}"
                  class="we-section-input"
                  type="text"
                  list="we-sections-datalist"
                  value={block.section ?? ''}
                  placeholder="None"
                  on:change={(e) => saveSection(block.id, e.currentTarget.value)}
                  on:blur={(e) => saveSection(block.id, e.currentTarget.value)}
                  title="Section tab this block belongs to (e.g. 'Project Description')"
                />
                <datalist id="we-sections-datalist">
                  {#each existingSections as s}<option value={s}>{s}</option>{/each}
                </datalist>
              </div>
              <!-- Delete -->
              <button
                class="we-icon-btn we-icon-btn--danger"
                on:click={() => removeBlock(block.id)}
                title="Remove block"
              >✕</button>
            </div>
          </div>

          <!-- ── Formatting toolbar (only for html-content blocks) ──── -->
          {#if hasEditor(block.type) && focusedBlockId === block.id}
            <div class="we-toolbar" role="toolbar" aria-label="Text formatting">
              <button class="we-tb-btn" on:click={() => fmt('bold')} title="Bold (Ctrl+B)"><strong>B</strong></button>
              <button class="we-tb-btn" on:click={() => fmt('italic')} title="Italic (Ctrl+I)"><em>I</em></button>
              <button class="we-tb-btn" on:click={() => fmt('underline')} title="Underline (Ctrl+U)"><u>U</u></button>
              <span class="we-tb-sep"|></span>
              <button class="we-tb-btn" on:click={() => fmtBlock('h2')} title="Heading 2">H2</button>
              <button class="we-tb-btn" on:click={() => fmtBlock('h3')} title="Heading 3">H3</button>
              <button class="we-tb-btn" on:click={() => fmtBlock('h4')} title="Heading 4">H4</button>
              <button class="we-tb-btn" on:click={() => fmtBlock('p')} title="Normal paragraph">P</button>
              <span class="we-tb-sep"></span>
              <button class="we-tb-btn" on:click={() => fmt('insertUnorderedList')} title="Bullet list">•—</button>
              <button class="we-tb-btn" on:click={() => fmt('insertOrderedList')} title="Numbered list">1—</button>
              <span class="we-tb-sep"></span>
              <button class="we-tb-btn" on:click={insertLink} title="Insert link">🔗</button>
              <button class="we-tb-btn" on:click={() => fmt('removeFormat')} title="Clear formatting">✖</button>
              <span class="we-tb-sep"></span>
              <button
                class="we-tb-btn we-tb-btn--field"
                on:click|stopPropagation={() => openPicker(block.id)}
                title="Insert merge field"
              >
                ＋ Field
              </button>
            </div>
          {/if}

          <!-- ── Merge-field picker ──────────────────────────────────── -->
          {#if activePickerBlockId === block.id}
            <!-- svelte-ignore a11y-click-events-have-key-events -->
            <div class="we-picker" on:click|stopPropagation>
              <div class="we-picker__header">
                <span class="we-picker__title">Insert field token</span>
                <button class="we-picker__close" on:click={closePicker}>✕</button>
              </div>
              <input
                class="we-picker__search"
                type="text"
                bind:value={pickerSearch}
                placeholder="Search fields…"
                autocomplete="off"
              />
              <div class="we-picker__groups">
                {#each Object.entries(pickerGroups) as [group, fields]}
                  {@const visible = fields.filter(f =>
                    !pickerSearch.trim() ||
                    f.label.toLowerCase().includes(pickerSearch.toLowerCase()) ||
                    f.token.toLowerCase().includes(pickerSearch.toLowerCase())
                  )}
                  {#if visible.length > 0}
                    <div class="we-picker__group">
                      <span class="we-picker__group-label">{group}</span>
                      {#each visible as field (field.token)}
                        <button
                          class="we-picker__field"
                          on:click={() => insertField(block.id, field.token)}
                          title="{field.token} — e.g. {field.example}"
                        >
                          <span class="we-picker__field-label">{field.label}</span>
                          <code class="we-picker__field-token">{field.token}</code>
                        </button>
                      {/each}
                    </div>
                  {/if}
                {/each}
                {#if filteredFields.length === 0 && pickerSearch}
                  <div class="we-picker__empty">No fields match "{pickerSearch}"</div>
                {/if}
              </div>
            </div>
          {/if}

          <!-- ── Block content area ──────────────────────────────────── -->
          <div class="we-block__body">
            {#if hasEditor(block.type)}
              <!-- True WYSIWYG contenteditable area -->
              <div
                class="we-content"
                contenteditable="true"
                data-ce={block.id}
                use:initContent={block.html}
                on:focus={() => focusedBlockId = block.id}
                on:blur={(e) => onEditorBlur(e, block.id)}
                on:keydown={(e) => {
                  // Prevent Svelte from swallowing Ctrl+B etc.
                  if (e.ctrlKey || e.metaKey) e.stopPropagation();
                }}
                aria-label="{blockLabel(block.type)} content — click to edit"
                role="textbox"
                aria-multiline="true"
                spellcheck="false"
              ></div>
            {:else if block.type === 'quoteTable'}
              <div class="we-auto-block">
                <span class="we-auto-block__icon">💰</span>
                <span class="we-auto-block__label">Live pricing table — renders from the quote's line-items at proposal time.</span>
              </div>
            {:else if block.type === 'accept'}
              <div class="we-auto-block we-auto-block--accept">
                <span class="we-auto-block__icon">✅</span>
                <span class="we-auto-block__label">"Book Your Move" acceptance button — auto-rendered by the status page.</span>
              </div>
            {:else}
              <div class="we-auto-block">
                <span class="we-auto-block__icon">{blockIcon(block.type)}</span>
                <span class="we-auto-block__label">{blockLabel(block.type)} — renders automatically on page load.</span>
              </div>
            {/if}
          </div>
        </div>
      {/each}

      <!-- Drop indicator at the end -->
      {#if dropIndex === blocks.length}
        <div class="we-drop-indicator"></div>
      {/if}
    </div>
  {/if}

  <!-- ── Block palette ─────────────────────────────────────────────────── -->
  <div class="we-palette">
    <span class="we-palette__label">+ Add Block</span>
    <div class="we-palette__grid">
      {#each BLOCK_CATALOG as bt (bt.type)}
        <button
          class="we-palette__btn"
          on:click={() => addBlock(bt.type)}
          title={bt.hint}
        >
          <span class="we-palette__icon">{bt.icon}</span>
          <span class="we-palette__name">{bt.label}</span>
        </button>
      {/each}
    </div>
  </div>

</div>

<style>
  /* ── Root ──────────────────────────────────────────────────────────── */
  .we-root {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    font-family: var(--font-paragraph, 'Jost'), system-ui, sans-serif;
  }

  /* ── Empty state ───────────────────────────────────────────────────── */
  .we-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    padding: 2.5rem;
    text-align: center;
    color: #94a3b8;
    font-size: 0.875rem;
  }
  .we-empty__icon { font-size: 2.5rem; }

  /* ── Canvas ────────────────────────────────────────────────────────── */
  .we-canvas {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  /* ── Drop indicator ─────────────────────────────────────────────────── */
  .we-drop-indicator {
    height: 3px;
    background: linear-gradient(90deg, #02b6bc, #0284c7);
    border-radius: 2px;
    box-shadow: 0 0 8px rgba(2, 182, 188, 0.4);
    margin: 0 8px;
  }

  /* ── Block card ─────────────────────────────────────────────────────── */
  .we-block {
    background: #ffffff;
    border: 1.5px solid #e2e8f0;
    border-radius: 12px;
    overflow: visible;
    transition: border-color 0.15s, box-shadow 0.15s, opacity 0.15s;
    cursor: default;
  }
  .we-block--focused {
    border-color: #02b6bc;
    box-shadow: 0 0 0 3px rgba(2, 182, 188, 0.12);
  }
  .we-block--dragging {
    opacity: 0.45;
    cursor: grabbing;
  }
  .we-block:hover { border-color: #94a3b8; }

  /* ── Block header ───────────────────────────────────────────────────── */
  .we-block__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.45rem 0.75rem;
    background: #f8fafc;
    border-bottom: 1px solid #f1f5f9;
    border-radius: 10px 10px 0 0;
    gap: 0.5rem;
    flex-wrap: wrap;
  }
  .we-block__header-left {
    display: flex;
    align-items: center;
    gap: 0.45rem;
  }
  .we-block__header-right {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .we-drag-handle {
    cursor: grab;
    color: #cbd5e1;
    font-size: 1.2rem;
    line-height: 1;
    padding: 0 2px;
    user-select: none;
  }
  .we-drag-handle:hover { color: #64748b; }

  .we-block__icon { font-size: 0.95rem; }
  .we-block__type {
    font-size: 0.75rem;
    font-weight: 700;
    color: #475569;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  /* ── Section input ──────────────────────────────────────────────────── */
  .we-section-field {
    display: flex;
    align-items: center;
    gap: 0.35rem;
  }
  .we-section-label {
    font-size: 0.68rem;
    font-weight: 700;
    color: #94a3b8;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    white-space: nowrap;
  }
  .we-section-input {
    font-size: 0.78rem;
    font-weight: 500;
    color: #0f172a;
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    padding: 0.22rem 0.55rem;
    width: 140px;
    outline: none;
    font-family: inherit;
    transition: border-color 0.12s, box-shadow 0.12s;
  }
  .we-section-input:focus {
    border-color: #02b6bc;
    box-shadow: 0 0 0 2px rgba(2,182,188,0.12);
  }
  .we-section-input::placeholder { color: #cbd5e1; font-style: italic; }

  /* ── Icon buttons ───────────────────────────────────────────────────── */
  .we-icon-btn {
    width: 26px; height: 26px;
    border-radius: 6px;
    border: 1px solid #e2e8f0;
    background: #fff;
    color: #64748b;
    font-size: 0.75rem; font-weight: 700;
    cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    transition: background 0.12s, color 0.12s;
    flex-shrink: 0;
  }
  .we-icon-btn:hover:not(:disabled) { background: #f1f5f9; color: #0f172a; }
  .we-icon-btn--danger { color: #ef4444; border-color: rgba(239,68,68,0.2); }
  .we-icon-btn--danger:hover { background: rgba(239,68,68,0.08); color: #dc2626; }

  /* ── Formatting toolbar ─────────────────────────────────────────────── */
  .we-toolbar {
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 0.35rem 0.75rem;
    background: #f0fdfe;
    border-bottom: 1px solid rgba(2,182,188,0.2);
    flex-wrap: wrap;
  }
  .we-tb-btn {
    min-width: 28px; height: 26px;
    padding: 0 6px;
    border-radius: 5px;
    border: 1px solid transparent;
    background: transparent;
    color: #374151;
    font-size: 0.8rem; font-weight: 700;
    cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    transition: background 0.1s;
    font-family: inherit;
  }
  .we-tb-btn:hover { background: rgba(2,182,188,0.12); border-color: rgba(2,182,188,0.25); }
  .we-tb-btn--field {
    font-size: 0.72rem;
    color: #02b6bc;
    border-color: rgba(2,182,188,0.3);
    background: rgba(2,182,188,0.06);
    margin-left: 2px;
  }
  .we-tb-btn--field:hover { background: rgba(2,182,188,0.14); }
  .we-tb-sep {
    width: 1px; height: 18px;
    background: #e2e8f0;
    margin: 0 3px;
    flex-shrink: 0;
  }

  /* ── Merge-field picker ─────────────────────────────────────────────── */
  .we-picker {
    background: #fff;
    border: 1px solid #e2e8f0;
    border-top: none;
    border-radius: 0 0 10px 10px;
    box-shadow: 0 8px 24px rgba(0,0,0,0.1);
    z-index: 100;
    max-height: 260px;
    display: flex;
    flex-direction: column;
  }
  .we-picker__header {
    display: flex; align-items: center;
    justify-content: space-between;
    padding: 0.5rem 0.75rem;
    border-bottom: 1px solid #f1f5f9;
    flex-shrink: 0;
  }
  .we-picker__title { font-size: 0.74rem; font-weight: 700; color: #475569; }
  .we-picker__close {
    background: none; border: none; cursor: pointer;
    color: #94a3b8; font-size: 0.85rem;
    width: 22px; height: 22px;
    display: flex; align-items: center; justify-content: center;
    border-radius: 4px;
  }
  .we-picker__close:hover { background: #f1f5f9; color: #374151; }
  .we-picker__search {
    margin: 0.4rem 0.75rem;
    padding: 0.3rem 0.6rem;
    font-size: 0.8rem;
    border: 1px solid #e2e8f0; border-radius: 6px;
    outline: none; font-family: inherit;
    transition: border-color 0.12s;
  }
  .we-picker__search:focus { border-color: #02b6bc; }
  .we-picker__groups { overflow-y: auto; padding: 0 0.75rem 0.5rem; flex: 1; }
  .we-picker__group { margin-bottom: 0.5rem; }
  .we-picker__group-label {
    font-size: 0.65rem; font-weight: 800; text-transform: uppercase;
    letter-spacing: 0.08em; color: #94a3b8;
    display: block; margin-bottom: 3px;
  }
  .we-picker__field {
    display: flex; align-items: center; gap: 6px;
    width: 100%; text-align: left;
    padding: 0.3rem 0.4rem;
    border: none; border-radius: 6px; background: transparent;
    cursor: pointer; font-family: inherit;
    transition: background 0.1s;
  }
  .we-picker__field:hover { background: #f0fdfe; }
  .we-picker__field-label { font-size: 0.78rem; color: #374151; font-weight: 500; flex: 1; }
  .we-picker__field-token {
    font-family: 'SF Mono','Fira Code',monospace;
    font-size: 0.68rem; color: #02b6bc;
    background: rgba(2,182,188,0.08);
    border-radius: 4px; padding: 1px 5px;
  }
  .we-picker__empty { font-size: 0.78rem; color: #94a3b8; padding: 0.5rem 0; text-align: center; }

  /* ── Block content area ─────────────────────────────────────────────── */
  .we-block__body { padding: 0; }

  /* Contenteditable WYSIWYG area */
  .we-content {
    min-height: 80px;
    padding: 0.75rem 1rem;
    outline: none;
    font-family: inherit;
    font-size: 0.9rem;
    line-height: 1.65;
    color: #1e293b;
    word-break: break-word;
    cursor: text;
    border-radius: 0 0 10px 10px;
  }
  .we-content:empty::before {
    content: 'Click to edit…';
    color: #cbd5e1;
    pointer-events: none;
  }
  /* Basic styling for content the user writes */
  .we-content :global(h1) { font-size: 1.6rem; font-weight: 800; margin: 0 0 0.6rem; }
  .we-content :global(h2) { font-size: 1.25rem; font-weight: 800; margin: 0 0 0.6rem; }
  .we-content :global(h3) { font-size: 1.05rem; font-weight: 700; margin: 0 0 0.5rem; }
  .we-content :global(h4) { font-size: 0.95rem; font-weight: 700; margin: 0 0 0.45rem; }
  .we-content :global(p) { margin: 0 0 0.65rem; }
  .we-content :global(ul), .we-content :global(ol) { margin: 0 0 0.65rem; padding-left: 1.4rem; }
  .we-content :global(li) { margin-bottom: 0.2rem; }
  .we-content :global(table) { width: 100%; border-collapse: collapse; margin-bottom: 0.65rem; }
  .we-content :global(td), .we-content :global(th) { padding: 6px 10px; border: 1px solid #e2e8f0; }
  .we-content :global(a) { color: #02b6bc; text-decoration: underline; }
  .we-content :global(blockquote) { border-left: 3px solid #02b6bc; padding-left: 0.75rem; color: #64748b; }

  /* Auto-generated block placeholders */
  .we-auto-block {
    display: flex;
    align-items: center;
    gap: 0.65rem;
    padding: 1rem;
    background: linear-gradient(135deg, #f0fdfe 0%, #f8fafc 100%);
    border-radius: 0 0 10px 10px;
    font-size: 0.83rem;
    color: #0d9488;
    font-style: italic;
  }
  .we-auto-block--accept { background: linear-gradient(135deg, #f0fdf4 0%, #f8fafc 100%); }
  .we-auto-block__icon { font-size: 1.2rem; flex-shrink: 0; }
  .we-auto-block__label { color: #475569; }

  /* ── Block palette ──────────────────────────────────────────────────── */
  .we-palette {
    background: #f8fafc;
    border: 1.5px dashed #e2e8f0;
    border-radius: 12px;
    padding: 0.9rem 1rem;
  }
  .we-palette__label {
    display: block;
    font-size: 0.68rem;
    font-weight: 700;
    color: #94a3b8;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin-bottom: 0.55rem;
  }
  .we-palette__grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(78px, 1fr));
    gap: 0.35rem;
  }
  .we-palette__btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.2rem;
    padding: 0.5rem 0.3rem;
    background: #fff;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    cursor: pointer;
    transition: background 0.12s, border-color 0.12s, transform 0.1s;
  }
  .we-palette__btn:hover {
    background: #f0fdfe;
    border-color: rgba(2,182,188,0.35);
    transform: translateY(-1px);
  }
  .we-palette__icon { font-size: 1.15rem; }
  .we-palette__name {
    font-size: 0.62rem;
    font-weight: 600;
    color: #475569;
    text-align: center;
    line-height: 1.3;
  }
</style>
