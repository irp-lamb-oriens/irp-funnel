<script lang="ts">
  /**
   * WysiwygEditor.svelte — Elementor / Cosmic CMS–style true WYSIWYG page builder
   * for IRP quote-document templates.
   *
   * Architecture
   * ────────────
   *   • Blocks are grouped into SECTION LANES derived from block.section labels.
   *     Lane order = first-appearance order in blocks[]. Reordering sections = moving
   *     block groups in the array. No backend schema change needed.
   *
   *   • Each block renders as a LIVE PREVIEW inside its lane:
   *       html / heading / banner / accordion → the actual block.html rendered via
   *         innerHTML so the editor view is identical to what the client sees.
   *         The wrapper is contenteditable=true — every text node is directly
   *         editable in-place (Elementor-style). Blur serialises innerHTML → block.html.
   *       quoteTable → static representative table preview (dynamic at send time).
   *       accept     → representative CTA preview (rendered at send time).
   *
   *   • <hr class="we-dropzone"> placeholders sit between every block and at
   *     the top/bottom of each section lane. Dragging a block over any zone
   *     highlights it with a teal glow; dropping inserts the block there and
   *     reassigns block.section automatically (cross-section DnD is free).
   *
   *   • Per-block hover toolbar: drag handle · move-to-section · duplicate · delete.
   *   • Per-focused-block formatting bar: B I U · H2 H3 H4 P · lists · link · merge-field.
   *   • Section CRUD: rename (click name) · ↑↓ reorder · delete · + Add Section.
   *   • Block palette inside each section: + Add block.
   *
   * Data contract
   * ─────────────
   *   <WysiwygEditor bind:blocks={editBlocks} />
   *   Same as before — only blocks[] changes. BlockRenderer / status page untouched.
   *
   * Svelte 4 throughout (on: directives, no $effect).
   */

  import { tick, createEventDispatcher } from 'svelte';
  import type { QuoteBlock, QuoteBlockType } from '../routes/dashboard/store.ts';
  import { MERGE_FIELDS, mergeFieldsByGroup } from './mergeFields.ts';

  // ── Props ────────────────────────────────────────────────────────────────────
  export let blocks: QuoteBlock[] = [];
  export let clientSummary: Record<string, any> = {};

  const dispatch = createEventDispatcher<{ change: QuoteBlock[] }>();

  // ── Section computation ───────────────────────────────────────────────────────
  $: sectionOrder = (() => {
    const seen = new Set<string>();
    const order: string[] = [];
    for (const b of blocks) {
      if (b.section && !seen.has(b.section)) {
        seen.add(b.section);
        order.push(b.section);
      }
    }
    return order;
  })();

  $: blocksBySection = Object.fromEntries(
    sectionOrder.map(s => [s, blocks.filter(b => b.section === s)])
  ) as Record<string, QuoteBlock[]>;

  $: unsectionedBlocks = blocks.filter(b => !b.section);

  // ── UI state ──────────────────────────────────────────────────────────────────
  let focusedBlockId: string | null = null;
  let hoveredBlockId: string | null = null;

  // DnD
  let dragBlockId:    string | null = null;
  let activeDropZone: string | null = null; // "${section}::before::${blockId}" | "${section}::end"

  // Section rename
  let renamingSection: string | null = null;
  let renameValue = '';

  // Add section
  let addingSectionMode = false;
  let newSectionName = '';

  // Per-section add-block palette
  let addBlockSection: string | null = null;

  // Move-to-section popup
  let movingBlockId: string | null = null;

  // Merge-field picker
  let activePickerBlockId: string | null = null;
  let pickerSearch = '';
  $: pickerGroups = mergeFieldsByGroup();
  $: filteredFields = MERGE_FIELDS.filter(f =>
    !pickerSearch.trim() ||
    f.label.toLowerCase().includes(pickerSearch.toLowerCase()) ||
    f.token.toLowerCase().includes(pickerSearch.toLowerCase())
  );

  // ── Block type catalog ────────────────────────────────────────────────────────
  const EDITABLE_TYPES = new Set<QuoteBlockType>(['html', 'heading', 'banner', 'accordion']);

  const BLOCK_CATALOG: { type: QuoteBlockType; label: string; icon: string; hint: string }[] = [
    { type: 'html',         label: 'Rich Text',   icon: '📝', hint: 'Free-form HTML — headings, paragraphs, tables' },
    { type: 'heading',      label: 'Heading',      icon: '📌', hint: 'Standalone heading block' },
    { type: 'banner',       label: 'Banner',       icon: '🖼️', hint: 'Full-width hero section' },
    { type: 'accordion',    label: 'Accordion',    icon: '📋', hint: 'Expandable T&Cs / FAQ section' },
    { type: 'quoteTable',   label: 'Quote Table',  icon: '💰', hint: 'Live pricing from quote line-items' },
    { type: 'accept',       label: 'Accept CTA',   icon: '✅', hint: '"Book Your Move" acceptance button' },
    { type: 'testimonials', label: 'Testimonials', icon: '🌟', hint: 'Customer testimonials section' },
    { type: 'reviews',      label: 'Reviews',      icon: '⭐', hint: 'Google reviews section' },
    { type: 'partners',     label: 'Partners',     icon: '🤝', hint: 'Partner logos section' },
  ];

  function blockIcon(type: QuoteBlockType) { return BLOCK_CATALOG.find(b => b.type === type)?.icon ?? '📦'; }
  function blockLabel(type: QuoteBlockType) { return BLOCK_CATALOG.find(b => b.type === type)?.label ?? type; }
  function isEditable(type: QuoteBlockType) { return EDITABLE_TYPES.has(type); }

  // ── Svelte action: set innerHTML without cursor-jump ─────────────────────────
  function initContent(el: HTMLElement, html: string | null | undefined) {
    el.innerHTML = html ?? '';
    return {
      update(newHtml: string | null | undefined) {
        // Only update when the element is not being edited
        if (document.activeElement !== el && !el.contains(document.activeElement as Node)) {
          if (el.innerHTML !== (newHtml ?? '')) el.innerHTML = newHtml ?? '';
        }
      },
    };
  }

  // ── Mutations ─────────────────────────────────────────────────────────────────
  function emit() { dispatch('change', blocks); }

  function saveBlockHtml(blockId: string, html: string) {
    blocks = blocks.map(b => b.id === blockId ? { ...b, html } : b);
    emit();
  }

  function addBlock(type: QuoteBlockType, section: string) {
    const id = `blk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const newBlock: any = {
      id, type,
      html: EDITABLE_TYPES.has(type)
        ? `<p style="font-family:sans-serif;font-size:1rem;line-height:1.7;color:#334155;">Click to edit your ${blockLabel(type).toLowerCase()} content here…</p>`
        : null,
      data: null, section,
    };
    // Insert after the last block in this section (or at end of array)
    const lastIdx = blocks.reduce((acc, b, i) => b.section === section ? i : acc, -1);
    const arr = [...blocks];
    arr.splice(lastIdx + 1, 0, newBlock);
    blocks = arr;
    emit();
    addBlockSection = null;
    tick().then(() => {
      const el = document.querySelector<HTMLElement>(`[data-block-preview="${id}"]`);
      if (el) el.focus();
    });
  }

  function removeBlock(blockId: string) {
    blocks = blocks.filter(b => b.id !== blockId);
    emit();
  }

  function duplicateBlock(blockId: string) {
    const src = blocks.find(b => b.id === blockId);
    if (!src) return;
    const idx = blocks.findIndex(b => b.id === blockId);
    const copy: any = { ...src, id: `blk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` };
    const arr = [...blocks];
    arr.splice(idx + 1, 0, copy);
    blocks = arr;
    emit();
  }

  function moveBlockToSection(blockId: string, targetSection: string) {
    const block = blocks.find(b => b.id === blockId);
    if (!block || block.section === targetSection) { movingBlockId = null; return; }
    let arr = blocks.filter(b => b.id !== blockId);
    const lastIdx = arr.reduce((acc, b, i) => b.section === targetSection ? i : acc, -1);
    const updated: any = { ...block, section: targetSection };
    arr.splice(lastIdx + 1, 0, updated);
    blocks = arr;
    emit();
    movingBlockId = null;
    hoveredBlockId = null;
  }

  // ── Section mutations ─────────────────────────────────────────────────────────
  function startRenameSection(section: string) {
    renamingSection = section;
    renameValue = section;
    tick().then(() => {
      const el = document.querySelector<HTMLInputElement>(`.we-section-rename-input`);
      if (el) { el.focus(); el.select(); }
    });
  }

  function commitRenameSection() {
    const oldName = renamingSection;
    const newName = renameValue.trim();
    renamingSection = null;
    if (!oldName || !newName || newName === oldName) return;
    blocks = blocks.map(b => b.section === oldName ? { ...b, section: newName } as any : b);
    emit();
  }

  function deleteSection(section: string) {
    const count = blocks.filter(b => b.section === section).length;
    const msg = count > 0
      ? `Delete section "${section}" and its ${count} block${count !== 1 ? 's' : ''}? This cannot be undone.`
      : `Delete section "${section}"?`;
    if (!confirm(msg)) return;
    blocks = blocks.filter(b => b.section !== section);
    emit();
  }

  function addSection() {
    const name = newSectionName.trim();
    if (!name || sectionOrder.includes(name)) return;
    const id = `blk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    blocks = [...blocks, {
      id, type: 'html' as QuoteBlockType,
      html: `<p style="font-family:sans-serif;font-size:1rem;line-height:1.7;color:#334155;">Add your "${name}" section content here…</p>`,
      data: null, section: name,
    } as any];
    emit();
    addingSectionMode = false;
    newSectionName = '';
  }

  function reorderAllBlocks(newSectionOrder: string[]) {
    const result: typeof blocks = [];
    for (const s of newSectionOrder) {
      result.push(...blocks.filter(b => b.section === s));
    }
    result.push(...blocks.filter(b => !b.section));
    blocks = result;
    emit();
  }

  function moveSectionUp(section: string) {
    const idx = sectionOrder.indexOf(section);
    if (idx <= 0) return;
    const newOrder = [...sectionOrder];
    [newOrder[idx - 1], newOrder[idx]] = [newOrder[idx], newOrder[idx - 1]];
    reorderAllBlocks(newOrder);
  }

  function moveSectionDown(section: string) {
    const idx = sectionOrder.indexOf(section);
    if (idx >= sectionOrder.length - 1) return;
    const newOrder = [...sectionOrder];
    [newOrder[idx], newOrder[idx + 1]] = [newOrder[idx + 1], newOrder[idx]];
    reorderAllBlocks(newOrder);
  }

  // ── Drag-and-Drop ─────────────────────────────────────────────────────────────
  function onBlockDragStart(blockId: string, e: DragEvent) {
    dragBlockId = blockId;
    if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
  }

  function onDropZoneDragEnter(key: string) {
    if (!dragBlockId) return;
    activeDropZone = key;
  }

  function onDropZoneDragOver(key: string, e: DragEvent) {
    if (!dragBlockId) return;
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
    activeDropZone = key;
  }

  function onDropZoneDragLeave(key: string) {
    if (activeDropZone === key) activeDropZone = null;
  }

  function onDropAtZone(key: string, e: DragEvent) {
    e.preventDefault();
    if (!dragBlockId) { activeDropZone = null; return; }

    // key: "${section}::before::${blockId}" or "${section}::end"
    const colons = key.indexOf('::');
    const rest = key.slice(colons + 2);
    const targetSection = key.slice(0, colons);
    const isEnd = rest.startsWith('end');
    const targetBlockId = isEnd ? null : rest.replace('before::', '');

    const dragged = blocks.find(b => b.id === dragBlockId);
    if (!dragged) { dragBlockId = null; activeDropZone = null; return; }

    // Remove dragged block from array
    let arr = blocks.filter(b => b.id !== dragBlockId) as typeof blocks;

    let insertIdx: number;
    if (isEnd || !targetBlockId) {
      // After the last block of targetSection
      insertIdx = arr.reduce((last, b, i) => b.section === targetSection ? i + 1 : last, 0);
      if (insertIdx === 0 && !arr.some(b => b.section === targetSection)) {
        insertIdx = arr.length;
      }
    } else {
      insertIdx = arr.findIndex(b => b.id === targetBlockId);
      if (insertIdx < 0) insertIdx = arr.length;
    }

    const updated: any = { ...dragged, section: targetSection };
    arr.splice(insertIdx, 0, updated);
    blocks = arr;
    emit();

    dragBlockId = null;
    activeDropZone = null;
  }

  function onDragEnd() {
    dragBlockId = null;
    activeDropZone = null;
  }

  // ── Formatting ────────────────────────────────────────────────────────────────
  function fmt(cmd: string, value?: string) {
    document.execCommand(cmd, false, value ?? undefined);
  }
  function fmtBlock(tag: string) {
    document.execCommand('formatBlock', false, tag);
  }
  function insertLink() {
    const url = prompt('Enter URL (or leave empty to remove link):');
    if (url === null) return;
    if (url.trim()) document.execCommand('createLink', false, url.trim());
    else document.execCommand('unlink', false, undefined);
  }

  function onEditorBlur(e: FocusEvent, blockId: string) {
    const el = e.currentTarget as HTMLElement;
    saveBlockHtml(blockId, el.innerHTML);
    setTimeout(() => {
      if (focusedBlockId !== blockId) return;
      const related = (e as FocusEvent).relatedTarget as Node | null;
      const inBar = related && (related as Element).closest?.('.we-bar');
      const inPicker = related && (related as Element).closest?.('.we-picker');
      if (!inBar && !inPicker) focusedBlockId = null;
    }, 160);
  }

  // ── Merge-field picker ────────────────────────────────────────────────────────
  function openPicker(blockId: string) {
    activePickerBlockId = blockId;
    pickerSearch = '';
  }
  function closePicker() { activePickerBlockId = null; pickerSearch = ''; }

  function insertField(blockId: string, token: string) {
    const el = document.querySelector<HTMLElement>(`[data-block-preview="${blockId}"]`);
    if (el) {
      el.focus();
      document.execCommand('insertText', false, token);
      saveBlockHtml(blockId, el.innerHTML);
    }
    closePicker();
  }

  // ── Drop-zone key helpers ─────────────────────────────────────────────────────
  function dzKey(section: string, blockId: string | null): string {
    return blockId ? `${section}::before::${blockId}` : `${section}::end`;
  }
</script>

<!-- svelte-ignore a11y-click-events-have-key-events -->
<div class="wysiwyg-root" on:dragend={onDragEnd} role="region" aria-label="Template page builder">

  <!-- ── Unsectioned blocks ─────────────────────────────────────────────────── -->
  {#if unsectionedBlocks.length > 0}
    <div class="we-lane we-lane--unsectioned">
      <div class="we-lane__header">
        <span class="we-lane__name we-lane__name--static">Unsectioned blocks</span>
        <span class="we-lane__count">{unsectionedBlocks.length}</span>
      </div>
      <div class="we-lane__body">
        {#each unsectionedBlocks as block, i (block.id)}
          {#if i === 0}
            <hr class="we-dropzone"
              class:we-dropzone--active={activeDropZone === dzKey('', block.id)}
              on:dragenter={() => onDropZoneDragEnter(dzKey('', block.id))}
              on:dragover|preventDefault={(e) => onDropZoneDragOver(dzKey('', block.id), e)}
              on:dragleave={() => onDropZoneDragLeave(dzKey('', block.id))}
              on:drop|preventDefault={(e) => onDropAtZone(dzKey('', block.id), e)}
            />
          {/if}
          <!-- (unsectioned block frame — same as sectioned, without section toolbar) -->
          <div class="we-block-frame"
            class:we-block-frame--focused={focusedBlockId === block.id}
            class:we-block-frame--hovered={hoveredBlockId === block.id}
            class:we-block-frame--dragging={dragBlockId === block.id}
            on:mouseenter={() => hoveredBlockId = block.id}
            on:mouseleave={() => { if (hoveredBlockId === block.id) hoveredBlockId = null; }}
            draggable="true"
            on:dragstart={(e) => onBlockDragStart(block.id, e)}
          >
            <div class="we-frame__badge">{blockIcon(block.type)} {blockLabel(block.type)}</div>
            <button class="we-frame__delete" on:click={() => removeBlock(block.id)} title="Delete">✕</button>
            <div class="we-block-preview">
              {#if isEditable(block.type)}
                <div class="we-preview-content"
                  contenteditable="true"
                  data-block-preview={block.id}
                  use:initContent={block.html}
                  on:focus={() => focusedBlockId = block.id}
                  on:blur={(e) => onEditorBlur(e, block.id)}
                  on:keydown={(e) => { if (e.ctrlKey || e.metaKey) e.stopPropagation(); }}
                  spellcheck="false" role="textbox" aria-multiline="true"
                ></div>
              {:else}
                <div class="we-preview-placeholder">{blockIcon(block.type)} {blockLabel(block.type)} — renders at send time</div>
              {/if}
            </div>
          </div>
          <hr class="we-dropzone"
            class:we-dropzone--active={activeDropZone === (i < unsectionedBlocks.length - 1 ? dzKey('', unsectionedBlocks[i+1].id) : dzKey('', null))}
            on:dragenter={() => onDropZoneDragEnter(i < unsectionedBlocks.length - 1 ? dzKey('', unsectionedBlocks[i+1].id) : dzKey('', null))}
            on:dragover|preventDefault={(e) => onDropZoneDragOver(i < unsectionedBlocks.length - 1 ? dzKey('', unsectionedBlocks[i+1].id) : dzKey('', null), e)}
            on:dragleave={() => onDropZoneDragLeave(i < unsectionedBlocks.length - 1 ? dzKey('', unsectionedBlocks[i+1].id) : dzKey('', null))}
            on:drop|preventDefault={(e) => onDropAtZone(i < unsectionedBlocks.length - 1 ? dzKey('', unsectionedBlocks[i+1].id) : dzKey('', null), e)}
          />
        {/each}
      </div>
    </div>
  {/if}

  <!-- ── Section lanes ──────────────────────────────────────────────────────── -->
  {#each sectionOrder as section, si (section)}
    {@const secBlocks = blocksBySection[section] ?? []}
    <div class="we-lane">

      <!-- Lane header ──────────────────────────────────────────────────────── -->
      <div class="we-lane__header">
        <span class="we-lane__pill">{si + 1}</span>

        {#if renamingSection === section}
          <!-- svelte-ignore a11y-autofocus -->
          <input
            class="we-section-rename-input"
            bind:value={renameValue}
            on:blur={commitRenameSection}
            on:keydown={(e) => {
              if (e.key === 'Enter') commitRenameSection();
              if (e.key === 'Escape') renamingSection = null;
            }}
            aria-label="Rename section"
          />
        {:else}
          <button class="we-lane__name" on:click={() => startRenameSection(section)} title="Click to rename section">
            {section}
          </button>
        {/if}

        <span class="we-lane__count" title="{secBlocks.length} block{secBlocks.length !== 1 ? 's' : ''}">{secBlocks.length}</span>

        <div class="we-lane__controls">
          <button class="we-lane__ctrl" title="Move section up" on:click={() => moveSectionUp(section)} disabled={si === 0}>↑</button>
          <button class="we-lane__ctrl" title="Move section down" on:click={() => moveSectionDown(section)} disabled={si === sectionOrder.length - 1}>↓</button>
          <button class="we-lane__ctrl we-lane__ctrl--danger" title="Delete section" on:click={() => deleteSection(section)}>✕</button>
        </div>
      </div>

      <!-- Lane body ────────────────────────────────────────────────────────── -->
      <div class="we-lane__body">

        <!-- Top drop zone -->
        {@const topZoneKey = dzKey(section, secBlocks[0]?.id ?? null)}
        <hr class="we-dropzone"
          class:we-dropzone--active={activeDropZone === topZoneKey}
          on:dragenter={() => onDropZoneDragEnter(topZoneKey)}
          on:dragover|preventDefault={(e) => onDropZoneDragOver(topZoneKey, e)}
          on:dragleave={() => onDropZoneDragLeave(topZoneKey)}
          on:drop|preventDefault={(e) => onDropAtZone(topZoneKey, e)}
        />

        {#each secBlocks as block, bi (block.id)}
          <!-- ── Block frame ──────────────────────────────────────────────── -->
          <div
            class="we-block-frame"
            class:we-block-frame--focused={focusedBlockId === block.id}
            class:we-block-frame--hovered={hoveredBlockId === block.id}
            class:we-block-frame--dragging={dragBlockId === block.id}
            on:mouseenter={() => hoveredBlockId = block.id}
            on:mouseleave={() => { if (hoveredBlockId === block.id) hoveredBlockId = null; }}
            draggable="true"
            on:dragstart={(e) => onBlockDragStart(block.id, e)}
            role="listitem"
          >
            <!-- Block overlay toolbar (hover) -->
            <div class="we-frame__overlay" class:we-frame__overlay--visible={hoveredBlockId === block.id || focusedBlockId === block.id}>
              <div class="we-frame__left">
                <span class="we-frame__handle" title="Drag to reorder">⠿</span>
                <span class="we-frame__type">{blockIcon(block.type)} {blockLabel(block.type)}</span>
              </div>
              <div class="we-frame__right">
                <!-- Move-to-section -->
                {#if sectionOrder.length > 1}
                  <div class="we-frame__movewrap">
                    <button
                      class="we-frame__btn"
                      title="Move to another section"
                      on:click|stopPropagation={() => movingBlockId = movingBlockId === block.id ? null : block.id}
                    >⇄ Move</button>
                    {#if movingBlockId === block.id}
                      <div class="we-frame__movedrop">
                        {#each sectionOrder.filter(s => s !== section) as targetSec}
                          <button class="we-frame__moveopt" on:click={() => moveBlockToSection(block.id, targetSec)}>
                            → {targetSec}
                          </button>
                        {/each}
                        <button class="we-frame__moveopt we-frame__moveopt--cancel" on:click={() => movingBlockId = null}>Cancel</button>
                      </div>
                    {/if}
                  </div>
                {/if}
                <button class="we-frame__btn" title="Duplicate block" on:click={() => duplicateBlock(block.id)}>⎘</button>
                <button class="we-frame__btn we-frame__btn--danger" title="Delete block" on:click={() => removeBlock(block.id)}>✕</button>
              </div>
            </div>

            <!-- Formatting toolbar (focused editable blocks) -->
            {#if focusedBlockId === block.id && isEditable(block.type)}
              <div class="we-bar" role="toolbar" aria-label="Text formatting">
                <button class="we-bar__btn" on:click={() => fmt('bold')} title="Bold"><strong>B</strong></button>
                <button class="we-bar__btn" on:click={() => fmt('italic')} title="Italic"><em>I</em></button>
                <button class="we-bar__btn" on:click={() => fmt('underline')} title="Underline"><u>U</u></button>
                <span class="we-bar__sep"></span>
                <button class="we-bar__btn" on:click={() => fmtBlock('h2')} title="Heading 2">H2</button>
                <button class="we-bar__btn" on:click={() => fmtBlock('h3')} title="Heading 3">H3</button>
                <button class="we-bar__btn" on:click={() => fmtBlock('h4')} title="Heading 4">H4</button>
                <button class="we-bar__btn" on:click={() => fmtBlock('p')} title="Paragraph">P</button>
                <span class="we-bar__sep"></span>
                <button class="we-bar__btn" on:click={() => fmt('insertUnorderedList')} title="Bullet list">•—</button>
                <button class="we-bar__btn" on:click={() => fmt('insertOrderedList')} title="Numbered list">1—</button>
                <span class="we-bar__sep"></span>
                <button class="we-bar__btn" on:click={insertLink} title="Insert / remove link">🔗</button>
                <button class="we-bar__btn" on:click={() => fmt('removeFormat')} title="Clear formatting">✖</button>
                <span class="we-bar__sep"></span>
                <button class="we-bar__btn we-bar__btn--field" on:click|stopPropagation={() => openPicker(block.id)} title="Insert merge field">＋ Field</button>
              </div>
            {/if}

            <!-- Merge-field picker -->
            {#if activePickerBlockId === block.id}
              <div class="we-picker" on:click|stopPropagation role="dialog" aria-label="Merge field picker">
                <div class="we-picker__head">
                  <span class="we-picker__title">Insert field token</span>
                  <button class="we-picker__close" on:click={closePicker}>✕</button>
                </div>
                <input class="we-picker__search" type="text" bind:value={pickerSearch} placeholder="Search fields…" autocomplete="off" />
                <div class="we-picker__list">
                  {#each Object.entries(pickerGroups) as [group, fields]}
                    {@const visible = fields.filter(f =>
                      !pickerSearch.trim() ||
                      f.label.toLowerCase().includes(pickerSearch.toLowerCase()) ||
                      f.token.toLowerCase().includes(pickerSearch.toLowerCase())
                    )}
                    {#if visible.length > 0}
                      <div class="we-picker__group">
                        <span class="we-picker__group-lbl">{group}</span>
                        {#each visible as field (field.token)}
                          <button class="we-picker__field" on:click={() => insertField(block.id, field.token)} title="{field.token}">
                            <span class="we-picker__field-lbl">{field.label}</span>
                            <code class="we-picker__token">{field.token}</code>
                          </button>
                        {/each}
                      </div>
                    {/if}
                  {/each}
                  {#if filteredFields.length === 0 && pickerSearch}
                    <p class="we-picker__empty">No fields match "{pickerSearch}"</p>
                  {/if}
                </div>
              </div>
            {/if}

            <!-- ── Block preview ────────────────────────────────────────── -->
            <div class="we-block-preview">
              {#if isEditable(block.type)}
                <!-- True WYSIWYG: renders block.html as-is (faithful preview).
                     contenteditable lets staff edit text directly in-place.
                     No CSS font/padding overrides → client sees the same output. -->
                <div
                  class="we-preview-content"
                  contenteditable="true"
                  data-block-preview={block.id}
                  use:initContent={block.html}
                  on:focus={() => focusedBlockId = block.id}
                  on:blur={(e) => onEditorBlur(e, block.id)}
                  on:keydown={(e) => { if (e.ctrlKey || e.metaKey) e.stopPropagation(); }}
                  spellcheck="false"
                  role="textbox"
                  aria-multiline="true"
                  aria-label="{blockLabel(block.type)} — click to edit"
                ></div>

              {:else if block.type === 'quoteTable'}
                <!-- Representative pricing table preview -->
                <div class="we-preview-quotetable">
                  <p class="we-preview-badge">💰 Live pricing table — populated from quote line-items at send time</p>
                  <table class="we-qt-preview">
                    <thead><tr><th>Service</th><th class="we-qt-r">Amount</th></tr></thead>
                    <tbody>
                      <tr><td>International freight (FCL)</td><td class="we-qt-r">$–,–––</td></tr>
                      <tr><td>Origin service — packing &amp; loading</td><td class="we-qt-r">$–,–––</td></tr>
                      <tr><td>Destination clearance &amp; delivery</td><td class="we-qt-r">$–,–––</td></tr>
                    </tbody>
                    <tfoot><tr class="we-qt-total"><td><strong>Total</strong></td><td class="we-qt-r"><strong>$–,–––</strong></td></tr></tfoot>
                  </table>
                </div>

              {:else if block.type === 'accept'}
                <!-- Representative accept CTA preview -->
                <div class="we-preview-accept">
                  <p class="we-preview-badge">✅ "Book Your Move" acceptance form — rendered dynamically</p>
                  <div class="we-accept-demo">
                    <input class="we-accept-input" type="text" placeholder="Your full name (optional)" disabled />
                    <button class="we-accept-btn" disabled>✅ Accept quote</button>
                  </div>
                </div>

              {:else}
                <div class="we-preview-placeholder">
                  {blockIcon(block.type)} <strong>{blockLabel(block.type)}</strong> — renders automatically on the client page
                </div>
              {/if}
            </div>
          </div>
          <!-- ─────────────────────────────────────────────────────────────── -->

          <!-- Drop zone after this block -->
          {@const afterKey = bi < secBlocks.length - 1 ? dzKey(section, secBlocks[bi + 1].id) : dzKey(section, null)}
          <hr class="we-dropzone"
            class:we-dropzone--active={activeDropZone === afterKey}
            on:dragenter={() => onDropZoneDragEnter(afterKey)}
            on:dragover|preventDefault={(e) => onDropZoneDragOver(afterKey, e)}
            on:dragleave={() => onDropZoneDragLeave(afterKey)}
            on:drop|preventDefault={(e) => onDropAtZone(afterKey, e)}
          />
        {/each}

        <!-- Add block to this section ──────────────────────────────────── -->
        {#if addBlockSection === section}
          <div class="we-palette">
            <span class="we-palette__label">Choose a block type:</span>
            <div class="we-palette__grid">
              {#each BLOCK_CATALOG as bt (bt.type)}
                <button class="we-palette__btn" on:click={() => addBlock(bt.type, section)} title={bt.hint}>
                  <span class="we-palette__icon">{bt.icon}</span>
                  <span class="we-palette__name">{bt.label}</span>
                </button>
              {/each}
            </div>
            <button class="we-palette__cancel" on:click={() => addBlockSection = null}>Cancel</button>
          </div>
        {:else}
          <button class="we-add-block-btn" on:click={() => addBlockSection = section}>
            <span>＋</span> Add block to "{section}"
          </button>
        {/if}
      </div>
    </div>
  {/each}

  <!-- ── Add section ─────────────────────────────────────────────────────────── -->
  {#if addingSectionMode}
    <div class="we-add-section-form">
      <span class="we-add-section-icon">📂</span>
      <!-- svelte-ignore a11y-autofocus -->
      <input
        class="we-add-section-in"
        bind:value={newSectionName}
        placeholder="Section name (e.g. Project Description)…"
        on:keydown={(e) => {
          if (e.key === 'Enter') addSection();
          if (e.key === 'Escape') addingSectionMode = false;
        }}
        autofocus
      />
      <button class="we-btn we-btn--primary" on:click={addSection} disabled={!newSectionName.trim()}>Add</button>
      <button class="we-btn we-btn--ghost" on:click={() => addingSectionMode = false}>Cancel</button>
    </div>
  {:else}
    <button class="we-add-section-btn" on:click={() => addingSectionMode = true}>
      ＋ Add Section
    </button>
  {/if}

  <!-- ── Empty state ─────────────────────────────────────────────────────────── -->
  {#if blocks.length === 0 && !addingSectionMode}
    <div class="we-empty">
      <span class="we-empty__icon">📄</span>
      <p>No blocks yet. Create a section above or add a section to begin.</p>
    </div>
  {/if}
</div>

<style>
  /* ═══════════════════════════════════════════════════════════════════════════
   * WysiwygEditor — Elementor / Cosmic CMS–style page builder
   * Design tokens: teal #02b5bb | Montserrat | slate backgrounds
   * All scoped to this component; no global leakage.
   * ═══════════════════════════════════════════════════════════════════════════ */

  .wysiwyg-root {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    font-family: 'Montserrat', 'Arial', sans-serif;
    padding-bottom: 2rem;
  }

  /* ── Empty state ──────────────────────────────────────────────────────────── */
  .we-empty {
    text-align: center;
    padding: 3rem 1rem;
    color: #94a3b8;
    font-size: 0.88rem;
  }
  .we-empty__icon { font-size: 2.5rem; display: block; margin-bottom: 0.5rem; }

  /* ═══════════════════════════════════════════════════════════════════════════
   * SECTION LANE
   * ═══════════════════════════════════════════════════════════════════════════ */
  .we-lane {
    background: #fff;
    border: 1.5px solid #e2e8f0;
    border-left: 3px solid #02b5bb;
    border-radius: 12px;
    overflow: visible;
    box-shadow: 0 1px 4px rgba(0,0,0,0.04), 0 0 0 0 rgba(2,181,187,0);
    transition: box-shadow 0.2s;
  }
  .we-lane--unsectioned {
    border-left-color: #64748b;
    opacity: 0.85;
  }
  .we-lane:has(.we-block-frame--focused) {
    box-shadow: 0 2px 12px rgba(2,181,187,0.14);
  }

  /* Lane header */
  .we-lane__header {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.6rem 1rem;
    background: linear-gradient(90deg, rgba(2,181,187,0.06) 0%, rgba(248,250,252,0.8) 100%);
    border-bottom: 1px solid #f1f5f9;
    border-radius: 10px 10px 0 0;
  }
  .we-lane__pill {
    width: 22px; height: 22px;
    background: #02b5bb;
    color: #fff;
    border-radius: 50%;
    font-size: 0.65rem;
    font-weight: 800;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
  }
  .we-lane__name {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 0.82rem;
    font-weight: 700;
    color: #0f172a;
    padding: 0.15rem 0.4rem;
    border-radius: 4px;
    transition: background 0.12s;
    font-family: inherit;
    letter-spacing: 0.01em;
  }
  .we-lane__name:hover { background: rgba(2,181,187,0.08); color: #02b5bb; }
  .we-lane__name--static { background: none; border: none; cursor: default; font-size: 0.82rem; font-weight: 700; color: #64748b; }
  .we-lane__count {
    font-size: 0.65rem;
    font-weight: 700;
    color: #94a3b8;
    background: #f1f5f9;
    border-radius: 999px;
    padding: 1px 7px;
    margin-left: 2px;
  }
  .we-lane__controls {
    display: flex;
    gap: 2px;
    margin-left: auto;
  }
  .we-lane__ctrl {
    width: 24px; height: 24px;
    border-radius: 5px;
    border: 1px solid #e2e8f0;
    background: #fff;
    color: #64748b;
    font-size: 0.78rem; font-weight: 600;
    cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    transition: background 0.1s, color 0.1s;
    font-family: inherit;
  }
  .we-lane__ctrl:hover:not(:disabled) { background: #f1f5f9; color: #0f172a; }
  .we-lane__ctrl:disabled { opacity: 0.3; cursor: not-allowed; }
  .we-lane__ctrl--danger { color: #ef4444; border-color: rgba(239,68,68,0.2); }
  .we-lane__ctrl--danger:hover:not(:disabled) { background: rgba(239,68,68,0.07); color: #dc2626; }

  /* Rename input */
  .we-section-rename-input {
    flex: 1;
    max-width: 220px;
    border: 1.5px solid #02b5bb;
    border-radius: 6px;
    padding: 0.2rem 0.5rem;
    font-size: 0.82rem;
    font-weight: 700;
    color: #0f172a;
    font-family: inherit;
    outline: none;
    box-shadow: 0 0 0 3px rgba(2,181,187,0.12);
  }

  /* Lane body */
  .we-lane__body {
    padding: 0.5rem 1rem 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0;
  }

  /* ═══════════════════════════════════════════════════════════════════════════
   * DROP ZONES
   * ═══════════════════════════════════════════════════════════════════════════ */
  .we-dropzone {
    border: none;
    border-top: 2px solid transparent;
    margin: 2px 0;
    height: 4px;
    border-radius: 2px;
    transition: border-color 0.15s, height 0.15s, margin 0.15s;
    background: transparent;
    cursor: pointer;
  }
  .we-dropzone--active {
    border-top-color: #02b5bb;
    height: 6px;
    margin: 4px 0;
    background: linear-gradient(90deg, transparent, rgba(2,181,187,0.12), transparent);
    box-shadow: 0 0 8px rgba(2,181,187,0.3);
  }

  /* ═══════════════════════════════════════════════════════════════════════════
   * BLOCK FRAME
   * ═══════════════════════════════════════════════════════════════════════════ */
  .we-block-frame {
    position: relative;
    border: 1.5px solid transparent;
    border-radius: 8px;
    overflow: visible;
    transition: border-color 0.15s, box-shadow 0.15s, opacity 0.15s;
    background: transparent;
    cursor: default;
  }
  .we-block-frame--hovered {
    border-color: #cbd5e1;
  }
  .we-block-frame--focused {
    border-color: #02b5bb;
    box-shadow: 0 0 0 3px rgba(2,181,187,0.12);
  }
  .we-block-frame--dragging {
    opacity: 0.35;
    cursor: grabbing;
  }

  /* Block overlay toolbar (appears on hover/focus) */
  .we-frame__overlay {
    position: absolute;
    top: -32px;
    left: 0; right: 0;
    height: 30px;
    background: #0f172a;
    border-radius: 7px 7px 0 0;
    display: flex;
    align-items: center;
    padding: 0 8px;
    gap: 0.4rem;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.15s;
    z-index: 10;
    border: 1px solid #1e293b;
    font-size: 0.72rem;
  }
  .we-frame__overlay--visible {
    opacity: 1;
    pointer-events: auto;
  }
  .we-frame__left { display: flex; align-items: center; gap: 6px; flex: 1; }
  .we-frame__right { display: flex; align-items: center; gap: 3px; }
  .we-frame__handle {
    color: #475569;
    font-size: 1rem;
    cursor: grab;
    padding: 0 2px;
    user-select: none;
  }
  .we-frame__handle:hover { color: #94a3b8; }
  .we-frame__type {
    font-size: 0.68rem;
    font-weight: 700;
    color: #94a3b8;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
  .we-frame__btn {
    height: 22px;
    padding: 0 8px;
    border-radius: 4px;
    border: 1px solid #334155;
    background: #1e293b;
    color: #94a3b8;
    font-size: 0.68rem;
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
    transition: background 0.1s, color 0.1s;
    white-space: nowrap;
  }
  .we-frame__btn:hover { background: #334155; color: #f1f5f9; }
  .we-frame__btn--danger { color: #f87171; border-color: rgba(248,113,113,0.3); }
  .we-frame__btn--danger:hover { background: rgba(239,68,68,0.15); color: #fca5a5; }

  /* Move-to-section dropdown */
  .we-frame__movewrap { position: relative; }
  .we-frame__movedrop {
    position: absolute;
    top: 24px;
    right: 0;
    background: #0f172a;
    border: 1px solid #334155;
    border-radius: 8px;
    min-width: 160px;
    z-index: 100;
    box-shadow: 0 8px 24px rgba(0,0,0,0.4);
    overflow: hidden;
  }
  .we-frame__moveopt {
    display: block;
    width: 100%;
    padding: 0.45rem 0.85rem;
    background: transparent;
    border: none;
    text-align: left;
    color: #cbd5e1;
    font-size: 0.78rem;
    font-family: inherit;
    cursor: pointer;
    transition: background 0.1s;
  }
  .we-frame__moveopt:hover { background: #1e293b; color: #f1f5f9; }
  .we-frame__moveopt--cancel { color: #64748b; font-style: italic; border-top: 1px solid #1e293b; }

  /* Legacy (unsectioned) block badge / delete */
  .we-frame__badge {
    position: absolute;
    top: 4px; left: 4px;
    background: rgba(15,23,42,0.75);
    color: #94a3b8;
    font-size: 0.65rem;
    font-weight: 700;
    border-radius: 4px;
    padding: 2px 6px;
    pointer-events: none;
    z-index: 2;
  }
  .we-frame__delete {
    position: absolute;
    top: 4px; right: 4px;
    width: 20px; height: 20px;
    border-radius: 4px;
    border: 1px solid rgba(239,68,68,0.3);
    background: rgba(239,68,68,0.08);
    color: #ef4444;
    font-size: 0.72rem;
    cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    z-index: 2;
  }
  .we-frame__delete:hover { background: rgba(239,68,68,0.15); }

  /* ═══════════════════════════════════════════════════════════════════════════
   * FORMATTING TOOLBAR
   * ═══════════════════════════════════════════════════════════════════════════ */
  .we-bar {
    display: flex;
    align-items: center;
    gap: 1px;
    padding: 4px 8px;
    background: #f8fafc;
    border-bottom: 1px solid rgba(2,181,187,0.15);
    border-radius: 6px 6px 0 0;
    flex-wrap: wrap;
    position: sticky;
    top: 0;
    z-index: 5;
  }
  .we-bar__btn {
    min-width: 26px; height: 24px;
    padding: 0 5px;
    border-radius: 4px;
    border: 1px solid transparent;
    background: transparent;
    color: #374151;
    font-size: 0.78rem; font-weight: 700;
    cursor: pointer;
    font-family: inherit;
    display: flex; align-items: center; justify-content: center;
    transition: background 0.1s;
  }
  .we-bar__btn:hover { background: rgba(2,181,187,0.1); border-color: rgba(2,181,187,0.2); }
  .we-bar__btn--field {
    font-size: 0.7rem;
    color: #02b5bb;
    border-color: rgba(2,181,187,0.3);
    background: rgba(2,181,187,0.06);
    margin-left: 3px;
  }
  .we-bar__btn--field:hover { background: rgba(2,181,187,0.14); }
  .we-bar__sep {
    width: 1px; height: 16px;
    background: #e2e8f0;
    margin: 0 3px;
    flex-shrink: 0;
  }

  /* ═══════════════════════════════════════════════════════════════════════════
   * MERGE-FIELD PICKER
   * ═══════════════════════════════════════════════════════════════════════════ */
  .we-picker {
    background: #fff;
    border: 1px solid #e2e8f0;
    border-top: none;
    border-radius: 0 0 8px 8px;
    box-shadow: 0 8px 24px rgba(0,0,0,0.1);
    max-height: 240px;
    display: flex;
    flex-direction: column;
    z-index: 20;
  }
  .we-picker__head {
    display: flex; align-items: center; justify-content: space-between;
    padding: 0.45rem 0.75rem;
    border-bottom: 1px solid #f1f5f9;
    flex-shrink: 0;
  }
  .we-picker__title { font-size: 0.72rem; font-weight: 700; color: #475569; }
  .we-picker__close {
    background: none; border: none; cursor: pointer;
    color: #94a3b8; font-size: 0.8rem;
    width: 20px; height: 20px;
    display: flex; align-items: center; justify-content: center;
    border-radius: 4px;
  }
  .we-picker__close:hover { background: #f1f5f9; }
  .we-picker__search {
    margin: 0.35rem 0.75rem;
    padding: 0.28rem 0.55rem;
    font-size: 0.78rem;
    border: 1px solid #e2e8f0; border-radius: 5px;
    outline: none; font-family: inherit;
    transition: border-color 0.12s;
  }
  .we-picker__search:focus { border-color: #02b5bb; }
  .we-picker__list { overflow-y: auto; padding: 0 0.75rem 0.4rem; flex: 1; }
  .we-picker__group { margin-bottom: 0.4rem; }
  .we-picker__group-lbl {
    font-size: 0.62rem; font-weight: 800; text-transform: uppercase;
    letter-spacing: 0.08em; color: #94a3b8; display: block; margin-bottom: 2px;
    padding-top: 4px;
  }
  .we-picker__field {
    display: flex; align-items: center; gap: 6px;
    width: 100%; text-align: left; padding: 0.28rem 0.35rem;
    border: none; border-radius: 5px; background: transparent;
    cursor: pointer; font-family: inherit; transition: background 0.1s;
  }
  .we-picker__field:hover { background: #f0fdfe; }
  .we-picker__field-lbl { font-size: 0.76rem; color: #374151; font-weight: 500; flex: 1; }
  .we-picker__token {
    font-family: 'SF Mono','Fira Code',monospace;
    font-size: 0.65rem; color: #02b5bb;
    background: rgba(2,181,187,0.08); border-radius: 4px; padding: 1px 5px;
  }
  .we-picker__empty { font-size: 0.76rem; color: #94a3b8; padding: 0.5rem 0; text-align: center; }

  /* ═══════════════════════════════════════════════════════════════════════════
   * BLOCK PREVIEW AREA
   * ─────────────────────────────────────────────────────────────────────────
   * .we-preview-content: no CSS overrides on font/padding/color.
   * The block's own inline-styled HTML (banner gradients, tables, etc.) renders
   * faithfully — exactly as the client sees it on the status page.
   * ═══════════════════════════════════════════════════════════════════════════ */
  .we-block-preview { position: relative; }

  .we-preview-content {
    outline: none;
    cursor: text;
    /* *** NO font-family / font-size / padding overrides ***
       block.html carries its own inline styles. */
    min-height: 40px;
    display: block;
    transition: box-shadow 0.15s;
  }
  .we-preview-content:focus {
    box-shadow: 0 0 0 2px rgba(2,181,187,0.18) inset;
    border-radius: 0 0 6px 6px;
  }
  .we-preview-content:empty::before {
    content: 'Click to edit…';
    color: #94a3b8;
    font-family: 'Montserrat', Arial, sans-serif;
    font-size: 0.88rem;
    padding: 0.75rem 1rem;
    display: block;
    pointer-events: none;
  }

  /* Quote table preview */
  .we-preview-quotetable {
    padding: 20px 24px;
    background: #f8fafc;
  }
  .we-preview-badge {
    font-size: 0.72rem;
    font-weight: 600;
    color: #64748b;
    margin: 0 0 12px;
    background: rgba(2,181,187,0.06);
    border: 1px solid rgba(2,181,187,0.15);
    border-left: 3px solid #02b5bb;
    border-radius: 6px;
    padding: 6px 10px;
  }
  .we-qt-preview {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.84rem;
  }
  .we-qt-preview th {
    text-align: left; font-size: 0.65rem; font-weight: 800;
    color: #94a3b8; text-transform: uppercase; letter-spacing: 0.08em;
    padding: 8px 12px; border-bottom: 2px solid #e2e8f0;
  }
  .we-qt-preview td {
    padding: 10px 12px; border-bottom: 1px solid #f1f5f9;
    color: #334155; font-size: 0.84rem;
  }
  .we-qt-r { text-align: right !important; font-weight: 600; color: #0f172a; }
  .we-qt-total td { border-top: 2px solid #e2e8f0; font-size: 1rem; font-weight: 800; color: #0f172a; border-bottom: none; }
  .we-qt-total .we-qt-r { color: #02b5bb; }

  /* Accept CTA preview */
  .we-preview-accept {
    padding: 20px 24px;
    background: linear-gradient(180deg, #f8faff 0%, #f0fdfe 100%);
  }
  .we-accept-demo { display: flex; flex-direction: column; gap: 10px; opacity: 0.6; pointer-events: none; }
  .we-accept-input {
    width: 100%; padding: 12px 16px; border: 1.5px solid #e2e8f0;
    border-radius: 10px; font-size: 0.9rem; font-family: inherit; box-sizing: border-box;
    background: #fff; color: #0f172a;
  }
  .we-accept-btn {
    background: linear-gradient(135deg, #02b5bb, #0e9f8e);
    color: #fff; border: none; border-radius: 999px; padding: 14px 28px;
    font-size: 0.95rem; font-weight: 800; font-family: inherit; cursor: default;
  }

  /* Generic placeholder for other block types */
  .we-preview-placeholder {
    padding: 16px 20px;
    background: linear-gradient(135deg, #f0fdfe 0%, #f8fafc 100%);
    font-size: 0.82rem;
    color: #64748b;
    font-style: italic;
    border-radius: 0 0 6px 6px;
    border-top: 1px dashed rgba(2,181,187,0.2);
  }

  /* ═══════════════════════════════════════════════════════════════════════════
   * ADD BLOCK PALETTE
   * ═══════════════════════════════════════════════════════════════════════════ */
  .we-add-block-btn {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    width: 100%;
    padding: 0.5rem 0.75rem;
    margin-top: 6px;
    background: transparent;
    border: 1.5px dashed #e2e8f0;
    border-radius: 8px;
    color: #94a3b8;
    font-size: 0.78rem;
    font-weight: 600;
    font-family: inherit;
    cursor: pointer;
    transition: border-color 0.14s, color 0.14s, background 0.14s;
    justify-content: center;
  }
  .we-add-block-btn:hover {
    border-color: #02b5bb;
    color: #02b5bb;
    background: rgba(2,181,187,0.04);
  }

  .we-palette {
    background: #f8fafc;
    border: 1.5px solid #e2e8f0;
    border-radius: 10px;
    padding: 0.85rem 1rem;
    margin-top: 6px;
  }
  .we-palette__label {
    display: block;
    font-size: 0.65rem;
    font-weight: 800;
    color: #94a3b8;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin-bottom: 0.5rem;
  }
  .we-palette__grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(82px, 1fr));
    gap: 0.3rem;
    margin-bottom: 0.6rem;
  }
  .we-palette__btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 3px;
    padding: 0.5rem 0.3rem;
    background: #fff;
    border: 1px solid #e2e8f0;
    border-radius: 7px;
    cursor: pointer;
    font-family: inherit;
    transition: background 0.12s, border-color 0.12s, transform 0.1s;
  }
  .we-palette__btn:hover {
    background: #f0fdfe;
    border-color: rgba(2,181,187,0.3);
    transform: translateY(-1px);
  }
  .we-palette__icon { font-size: 1.1rem; }
  .we-palette__name { font-size: 0.62rem; font-weight: 600; color: #475569; text-align: center; }
  .we-palette__cancel {
    width: 100%;
    padding: 0.35rem;
    background: none;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    color: #94a3b8;
    font-size: 0.75rem;
    font-family: inherit;
    cursor: pointer;
    transition: background 0.1s;
  }
  .we-palette__cancel:hover { background: #f1f5f9; color: #475569; }

  /* ═══════════════════════════════════════════════════════════════════════════
   * ADD SECTION
   * ═══════════════════════════════════════════════════════════════════════════ */
  .we-add-section-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.4rem;
    padding: 0.65rem 1.5rem;
    background: transparent;
    border: 2px dashed #02b5bb;
    border-radius: 10px;
    color: #02b5bb;
    font-size: 0.82rem;
    font-weight: 700;
    font-family: inherit;
    cursor: pointer;
    transition: background 0.14s, color 0.14s;
    letter-spacing: 0.03em;
  }
  .we-add-section-btn:hover {
    background: rgba(2,181,187,0.05);
  }

  .we-add-section-form {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    background: #f8fafc;
    border: 1.5px solid #02b5bb;
    border-radius: 10px;
    box-shadow: 0 0 0 3px rgba(2,181,187,0.08);
  }
  .we-add-section-icon { font-size: 1rem; flex-shrink: 0; }
  .we-add-section-in {
    flex: 1;
    border: 1.5px solid #e2e8f0;
    border-radius: 7px;
    padding: 0.42rem 0.75rem;
    font-size: 0.85rem;
    font-family: inherit;
    color: #0f172a;
    outline: none;
    transition: border-color 0.12s;
    background: #fff;
  }
  .we-add-section-in:focus { border-color: #02b5bb; }
  .we-add-section-in::placeholder { color: #94a3b8; }

  .we-btn {
    padding: 0.38rem 0.9rem;
    border-radius: 7px;
    font-size: 0.8rem;
    font-weight: 700;
    cursor: pointer;
    border: 1px solid transparent;
    font-family: inherit;
    transition: filter 0.12s, transform 0.1s;
    white-space: nowrap;
  }
  .we-btn:disabled { opacity: 0.45; cursor: not-allowed; }
  .we-btn--primary {
    background: linear-gradient(135deg, #02b5bb, #0e9f8e);
    color: #fff;
    box-shadow: 0 2px 8px rgba(2,181,187,0.25);
  }
  .we-btn--primary:hover:not(:disabled) { filter: brightness(1.08); transform: translateY(-1px); }
  .we-btn--ghost { background: #f1f5f9; color: #475569; border-color: #e2e8f0; }
  .we-btn--ghost:hover:not(:disabled) { background: #e2e8f0; }
</style>
