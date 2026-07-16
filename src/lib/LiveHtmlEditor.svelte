<script lang="ts">
  /**
   * LiveHtmlEditor.svelte
   * ────────────────────────────────────────────────────────────────────────
   * Centralized "what-you-see-is-what-you-get" editor for a SINGLE HTML string.
   *
   * Shared engine for editing rich HTML bodies (email templates, and any other
   * single-blob HTML the dashboard needs). Distinct from WysiwygEditor.svelte,
   * which is the block/section-based quote-document editor — this one edits ONE
   * `value` string via `bind:value`.
   *
   * Features (kept 1:1 with the quote editor's inline engine):
   *   • Live contenteditable surface (edit the rendered preview directly).
   *   • Formatting toolbar (bold/italic/underline, H2–H4, paragraph, lists,
   *     link, clear formatting) via document.execCommand.
   *   • HTML-source toggle (edit raw HTML in a textarea, round-trips cleanly).
   *   • Merge-field picker whose options are PASSED IN (single source of truth
   *     lives with the caller — e.g. the Overview Field Registry). Never
   *     hardcodes a token list.
   *
   * CONTRACT: two-way bound via `bind:value`; also dispatches `input` on every
   * change so callers can trigger side effects (e.g. refresh a server preview).
   */
  import { createEventDispatcher } from 'svelte';
  import type { MergeFieldOption } from '../routes/dashboard/store.ts';

  /** The HTML string being edited (two-way via bind:value). */
  export let value = '';
  /** Merge-field options for the picker (caller-provided source of truth). */
  export let fields: MergeFieldOption[] = [];
  /** Min height of the editable surface. */
  export let minHeight = '360px';
  /** Accessible label / placeholder hint. */
  export let placeholder = 'Start typing your content…';

  const dispatch = createEventDispatcher<{ input: string }>();

  let mode: 'wysiwyg' | 'html' = 'wysiwyg';
  let editorEl: HTMLElement | null = null;
  let pickerOpen = false;
  let pickerSearch = '';
  let savedRange: Range | null = null;

  // ── contenteditable ↔ value sync ─────────────────────────────────────────
  // Set innerHTML once (action) + reconcile external changes only while the
  // surface isn't focused, so typing is never clobbered mid-edit.
  function initHtml(node: HTMLElement, html: string) {
    node.innerHTML = html ?? '';
    return {
      update(next: string) {
        const focused =
          document.activeElement === node || node.contains(document.activeElement);
        if (!focused && node.innerHTML !== (next ?? '')) node.innerHTML = next ?? '';
      },
    };
  }

  function commitFromEditor() {
    if (!editorEl) return;
    const html = editorEl.innerHTML;
    if (html !== value) {
      value = html;
      dispatch('input', value);
    }
  }

  function onHtmlSourceInput(e: Event) {
    value = (e.currentTarget as HTMLTextAreaElement).value;
    dispatch('input', value);
  }

  // ── Selection helpers (so toolbar/picker act at the last caret position) ──
  function rememberSelection() {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && editorEl?.contains(sel.anchorNode)) {
      savedRange = sel.getRangeAt(0).cloneRange();
    }
  }

  function restoreSelection() {
    if (!editorEl) return;
    editorEl.focus();
    if (savedRange) {
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(savedRange);
    }
  }

  // ── Formatting ───────────────────────────────────────────────────────────
  function fmt(cmd: string, arg?: string) {
    restoreSelection();
    document.execCommand(cmd, false, arg);
    commitFromEditor();
  }
  function fmtBlock(tag: string) {
    fmt('formatBlock', tag);
  }
  function insertLink() {
    const url = prompt('Enter URL (leave empty to remove link):');
    if (url === null) return;
    restoreSelection();
    if (url.trim()) document.execCommand('createLink', false, url.trim());
    else document.execCommand('unlink');
    commitFromEditor();
  }
  function clearFormatting() {
    fmt('removeFormat');
  }

  // ── Merge-field picker ───────────────────────────────────────────────────
  function togglePicker() {
    rememberSelection();
    pickerOpen = !pickerOpen;
    pickerSearch = '';
  }
  function insertField(token: string) {
    restoreSelection();
    document.execCommand('insertText', false, token);
    commitFromEditor();
    pickerOpen = false;
  }

  $: filteredFields = fields.filter((f) => {
    const q = pickerSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      f.label.toLowerCase().includes(q) ||
      f.token.toLowerCase().includes(q) ||
      f.group.toLowerCase().includes(q)
    );
  });

  // Group filtered options for the picker (preserves registry order).
  $: groupedFields = (() => {
    const groups: { group: string; items: MergeFieldOption[] }[] = [];
    for (const f of filteredFields) {
      let g = groups.find((x) => x.group === f.group);
      if (!g) {
        g = { group: f.group, items: [] };
        groups.push(g);
      }
      g.items.push(f);
    }
    return groups;
  })();
</script>

<div class="lhe">
  <div class="lhe-bar">
    <div class="lhe-tools" class:disabled={mode === 'html'}>
      <button type="button" title="Bold" on:mousedown|preventDefault={() => fmt('bold')}><b>B</b></button>
      <button type="button" title="Italic" on:mousedown|preventDefault={() => fmt('italic')}><i>I</i></button>
      <button type="button" title="Underline" on:mousedown|preventDefault={() => fmt('underline')}><u>U</u></button>
      <span class="lhe-sep"></span>
      <button type="button" title="Heading 2" on:mousedown|preventDefault={() => fmtBlock('H2')}>H2</button>
      <button type="button" title="Heading 3" on:mousedown|preventDefault={() => fmtBlock('H3')}>H3</button>
      <button type="button" title="Heading 4" on:mousedown|preventDefault={() => fmtBlock('H4')}>H4</button>
      <button type="button" title="Paragraph" on:mousedown|preventDefault={() => fmtBlock('P')}>¶</button>
      <span class="lhe-sep"></span>
      <button type="button" title="Bulleted list" on:mousedown|preventDefault={() => fmt('insertUnorderedList')}>• List</button>
      <button type="button" title="Numbered list" on:mousedown|preventDefault={() => fmt('insertOrderedList')}>1. List</button>
      <button type="button" title="Insert link" on:mousedown|preventDefault={insertLink}>🔗</button>
      <button type="button" title="Clear formatting" on:mousedown|preventDefault={clearFormatting}>⌫</button>
      <span class="lhe-sep"></span>
      <div class="lhe-picker-wrap">
        <button
          type="button"
          class="lhe-field-btn"
          title="Insert a client field"
          on:mousedown|preventDefault={togglePicker}
        >
          {'{{ }}'} Field
        </button>
        {#if pickerOpen}
          <div class="lhe-picker" role="listbox">
            <input
              class="lhe-picker-search"
              placeholder="Search fields…"
              bind:value={pickerSearch}
              on:mousedown|stopPropagation
            />
            <div class="lhe-picker-list">
              {#if groupedFields.length === 0}
                <div class="lhe-picker-empty">
                  No fields configured. Add them in Automations → Overview fields.
                </div>
              {:else}
                {#each groupedFields as g (g.group)}
                  <div class="lhe-picker-group">{g.group}</div>
                  {#each g.items as f (f.token)}
                    <button
                      type="button"
                      class="lhe-picker-item"
                      on:mousedown|preventDefault={() => insertField(f.token)}
                    >
                      <span class="lhe-picker-label">{f.label}</span>
                      <code class="lhe-picker-token">{f.token}</code>
                    </button>
                  {/each}
                {/each}
              {/if}
            </div>
          </div>
        {/if}
      </div>
    </div>

    <button
      type="button"
      class="lhe-mode"
      class:active={mode === 'html'}
      title="Toggle HTML source"
      on:click={() => (mode = mode === 'html' ? 'wysiwyg' : 'html')}
    >
      {mode === 'html' ? '◑ Visual' : '</> HTML'}
    </button>
  </div>

  {#if mode === 'wysiwyg'}
    <div
      class="lhe-surface"
      style={`min-height:${minHeight}`}
      contenteditable="true"
      role="textbox"
      tabindex="0"
      aria-label={placeholder}
      bind:this={editorEl}
      use:initHtml={value}
      on:input={commitFromEditor}
      on:blur={commitFromEditor}
      on:mouseup={rememberSelection}
      on:keyup={rememberSelection}
    ></div>
  {:else}
    <textarea
      class="lhe-html"
      style={`min-height:${minHeight}`}
      spellcheck="false"
      value={value}
      on:input={onHtmlSourceInput}
    ></textarea>
  {/if}
</div>

<style>
  .lhe {
    display: flex;
    flex-direction: column;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    overflow: hidden;
    background: #fff;
  }

  .lhe-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    padding: 0.4rem 0.5rem;
    background: #f8fafc;
    border-bottom: 1px solid #e2e8f0;
    flex-wrap: wrap;
  }

  .lhe-tools {
    display: flex;
    align-items: center;
    gap: 0.15rem;
    flex-wrap: wrap;
  }
  .lhe-tools.disabled {
    opacity: 0.4;
    pointer-events: none;
  }

  .lhe-tools button,
  .lhe-mode {
    font-family: 'Jost', sans-serif;
    font-size: 0.82rem;
    line-height: 1;
    color: #334155;
    background: #fff;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 0.35rem 0.5rem;
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s, color 0.15s;
  }
  .lhe-tools button:hover,
  .lhe-mode:hover {
    background: #f1f5f9;
    border-color: #02b5bb;
    color: #02b5bb;
  }

  .lhe-sep {
    width: 1px;
    height: 18px;
    background: #e2e8f0;
    margin: 0 0.25rem;
  }

  .lhe-field-btn {
    font-weight: 600;
    color: #02b5bb !important;
    border-color: #b6ebed !important;

  }

  .lhe-mode.active {
    background: #02b5bb;
    color: #fff;
    border-color: #02b5bb;
  }

  .lhe-picker-wrap {
    position: relative;
  }
  .lhe-picker {
    position: absolute;
    top: calc(100% + 6px);
    left: 0;
    z-index: 30;
    width: 320px;
    max-width: 80vw;
    background: #fff;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    box-shadow: 0 12px 32px rgba(15, 23, 42, 0.16);
    overflow: hidden;
  }
  .lhe-picker-search {
    width: 100%;
    border: none;
    border-bottom: 1px solid #e2e8f0;
    padding: 0.6rem 0.75rem;
    font-family: 'Jost', sans-serif;
    font-size: 0.85rem;
    outline: none;
    box-sizing: border-box;
  }
  .lhe-picker-list {
    max-height: 280px;
    overflow-y: auto;
    padding: 0.25rem;
  }
  .lhe-picker-empty {
    padding: 0.9rem 0.75rem;
    color: #64748b;
    font-size: 0.82rem;
    font-family: 'Jost', sans-serif;
  }
  .lhe-picker-group {
    padding: 0.4rem 0.6rem 0.2rem;
    font-size: 0.68rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: #94a3b8;
    font-family: 'Jost', sans-serif;
  }
  .lhe-picker-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    width: 100%;
    background: none;
    border: none;
    text-align: left;
    padding: 0.45rem 0.6rem;
    border-radius: 8px;
    cursor: pointer;
    font-family: 'Jost', sans-serif;
  }
  .lhe-picker-item:hover {
    background: #f0fdfd;
  }
  .lhe-picker-label {
    font-size: 0.85rem;
    color: #334155;
  }
  .lhe-picker-token {
    font-size: 0.72rem;
    color: #02b5bb;
    background: #f0fdfd;
    padding: 0.1rem 0.35rem;
    border-radius: 6px;
    white-space: nowrap;
  }

  .lhe-surface {
    padding: 1rem 1.1rem;
    font-family: 'Jost', sans-serif;
    font-size: 0.95rem;
    line-height: 1.7;
    color: #334155;
    outline: none;
    overflow-y: auto;
    max-height: 60vh;
  }
  .lhe-surface:focus {
    box-shadow: inset 0 0 0 2px rgba(2, 181, 187, 0.25);
  }
  .lhe-surface :global(a) {
    color: #02b5bb;
  }
  .lhe-surface :global(img) {
    max-width: 100%;
    height: auto;
  }

  .lhe-html {
    border: none;
    outline: none;
    padding: 1rem 1.1rem;
    font-family: 'SFMono-Regular', ui-monospace, Menlo, Consolas, monospace;
    font-size: 0.82rem;
    line-height: 1.6;
    color: #1e293b;
    background: #0f172a08;
    resize: vertical;
    max-height: 60vh;
  }
</style>
