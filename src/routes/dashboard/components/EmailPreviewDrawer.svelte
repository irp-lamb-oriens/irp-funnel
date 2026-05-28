<script lang="ts">
  /**
   * EmailPreviewDrawer.svelte
   * ────────────────────────────────────────────────────────────────────────
   *
   *  Dual-mode right-edge slide-over (Historical + Pre-send).
   *
   *  PRE-SEND MODE — three sub-modes:
   *    'preview'  — read-only iframe (default)
   *    'visual'   — WYSIWYG contentEditable iframe + formatting toolbar
   *                 (non-tech friendly — click and type directly on the email)
   *    'html'     — raw HTML textarea (power-user fallback)
   *
   *  All editor logic lives in ../emailEditorEngine.ts (pure functions, no
   *  Svelte/store deps) and snippet data in ../emailSnippets.ts (declarative
   *  registry — add/remove snippets there without touching this file).
   *
   *  State machines:
   *    editMode: 'preview' | 'visual' | 'html'
   *    editableBody: string  — single source of truth for edited HTML
   *    wasEdited: boolean    — true iff editableBody !== originalBody
   *
   *  On Send: reads the final innerHTML from the iframe in case the 300ms
   *  debounce hasn't fired yet, then forwards the existing editMeta flow.
   *
   *  BACKWARD-COMPATIBLE:
   *    • presendEmail store shape: unchanged
   *    • triggerEmailWithEdit API: unchanged
   *    • editMeta = { editedBy, editedAt }: unchanged
   *    • Historical mode: completely unchanged
   */

  import { onMount, tick } from 'svelte';
  import {
    selectedSentEmailId,
    presendEmail,
    fetchSentEmail,
    triggerEmailWithEdit,
    authEmail,
    EMAIL_TYPES,
  } from '../store.ts';
  import type { SentEmailSnapshot } from '../store.ts';
  import { toasts } from '../toastStore.ts';
  import { exactTime, relativeTime } from '../utils/relativeTime.ts';

  // ── Editor engine (pure functions) ──────────────────────────────────────
  import {
    buildIframeSrcDoc,
    attachContentEditable,
    execFormatCommand,
    queryFormatState,
    insertHtmlAtCaret,
    insertLink,
    readIframeHtml,
    type FormatCommand,
  } from '../emailEditorEngine.ts';

  // ── Snippet registry ─────────────────────────────────────────────────────
  import {
    getSnippetsForEmailType,
    groupSnippetsByCategory,
    type EmailSnippet,
  } from '../emailSnippets.ts';

  // ── Historical mode state ────────────────────────────────────────────────
  let snapshot: SentEmailSnapshot | null = null;
  let loading = false;
  let error = '';
  let showContext = false;
  let lastFetchedId = '';

  // ── Pre-send mode state ──────────────────────────────────────────────────
  /** Current editing sub-mode. */
  let editMode: 'preview' | 'visual' | 'html' = 'preview';
  /** Editable copy of the body HTML — single source of truth. */
  let editableBody = '';
  /** Original body when drawer opened (for dirty-check). */
  let originalBody = '';
  /** True once operator has changed the body. */
  let wasEdited = false;
  /** Sending in progress. */
  let sending = false;
  /** Whether the snippet picker dropdown is open. */
  let snippetPickerOpen = false;

  // ── iframe ref ───────────────────────────────────────────────────────────
  let iframeEl: HTMLIFrameElement;
  /**
   * Cleanup fn returned by attachContentEditable.
   * Called when switching away from visual mode.
   */
  let detachVisualEditor: (() => void) | null = null;

  /**
   * The srcdoc we want to stamp onto the iframe.
   * In visual/html modes we set this ONCE when entering the mode,
   * then the iframe drives itself — we do NOT reactively recalculate
   * srcdoc on every editableBody change (that would tear down the DOM).
   */
  let frozenSrcDoc = '';

  // ── Derived ──────────────────────────────────────────────────────────────
  $: isPresendMode = !!$presendEmail;
  $: isHistoricalMode = !isPresendMode && !!$selectedSentEmailId;
  $: wasEdited = editableBody !== originalBody;

  // Available snippets for the current email type
  $: availableSnippets = getSnippetsForEmailType($presendEmail?.emailType);
  $: snippetGroups = groupSnippetsByCategory(availableSnippets);
  $: nonEmptyCategories = (
    Object.entries(snippetGroups) as [string, EmailSnippet[]][]
  ).filter(([, list]) => list.length > 0);

  // ── Format-state for toolbar button highlighting ─────────────────────────
  // Re-evaluated on every selectionchange inside the iframe
  let fmtBold = false;
  let fmtItalic = false;
  let fmtUnderline = false;

  function refreshFormatState() {
    if (!iframeEl || editMode !== 'visual') return;
    fmtBold      = queryFormatState(iframeEl, 'bold');
    fmtItalic    = queryFormatState(iframeEl, 'italic');
    fmtUnderline = queryFormatState(iframeEl, 'underline');
  }

  // ── Historical mode: fetch on id change ─────────────────────────────────
  $: if ($selectedSentEmailId && $selectedSentEmailId !== lastFetchedId && !isPresendMode) {
    loadSnapshot($selectedSentEmailId);
  }

  // ── Pre-send mode: reset state when drawer opens ─────────────────────────
  $: if ($presendEmail) {
    resetPresendState($presendEmail.bodyHtml);
  }

  function resetPresendState(bodyHtml: string) {
    editableBody = bodyHtml;
    originalBody = bodyHtml;
    wasEdited    = false;
    editMode     = 'preview';
    frozenSrcDoc = buildIframeSrcDoc(bodyHtml);
    snippetPickerOpen = false;
    detachVisualEditor?.();
    detachVisualEditor = null;
    showContext = false;
  }

  // ── Mode switching ────────────────────────────────────────────────────────

  async function switchToMode(mode: 'preview' | 'visual' | 'html') {
    if (editMode === mode) return;

    // Leaving visual mode: flush final innerHTML before detaching.
    // detachVisualEditor() already disables contentEditable and removes ALL
    // listeners (input + selectionchange) — no extra call needed.
    if (editMode === 'visual' && iframeEl) {
      const finalHtml = readIframeHtml(iframeEl);
      if (finalHtml && finalHtml !== editableBody) {
        editableBody = finalHtml;
      }
      detachVisualEditor?.();
      detachVisualEditor = null;
    }

    // Leaving html mode: editableBody is already up-to-date from textarea bind
    editMode = mode;

    if (mode === 'visual') {
      // (Re-)stamp the srcdoc with the edit-hint variant so the iframe renders
      // the current editableBody, then wire up contentEditable once loaded.
      frozenSrcDoc = buildIframeSrcDoc(editableBody, { editHint: true });
      await tick(); // let Svelte render the new srcdoc
      // The iframe `load` event triggers attachVisualEditor (see onMount handler)
    } else if (mode === 'preview') {
      // Refresh srcdoc to show latest editableBody
      frozenSrcDoc = buildIframeSrcDoc(editableBody);
    }
    // html mode: textarea is driven by editableBody, no iframe manipulation needed
  }

  function attachVisualEditor() {
    if (!iframeEl || editMode !== 'visual') return;
    // Always clean up any previous session before re-attaching
    detachVisualEditor?.();

    // attachContentEditable wires BOTH the input listener AND selectionchange
    // inside a single cleanup contract — no separate addEventListener calls needed.
    detachVisualEditor = attachContentEditable(
      iframeEl,
      (html) => { editableBody = html; },
      { onSelectionChange: refreshFormatState },
    );
  }

  // ── Toolbar actions ───────────────────────────────────────────────────────

  function handleFormat(cmd: FormatCommand) {
    if (!iframeEl || editMode !== 'visual') return;
    execFormatCommand(iframeEl, cmd);
    refreshFormatState();
  }

  function handleLink() {
    if (!iframeEl || editMode !== 'visual') return;
    insertLink(iframeEl);
    // Sync back after inserting
    const html = readIframeHtml(iframeEl);
    if (html) editableBody = html;
  }

  function handleSnippet(snippet: EmailSnippet) {
    snippetPickerOpen = false;
    if (!iframeEl || editMode !== 'visual') return;
    insertHtmlAtCaret(iframeEl, snippet.html);
    // Sync back
    const html = readIframeHtml(iframeEl);
    if (html) editableBody = html;
  }

  // ── Snapshot loader (historical mode) ────────────────────────────────────
  async function loadSnapshot(id: string) {
    lastFetchedId = id;
    snapshot = null;
    error = '';
    loading = true;
    try {
      snapshot = await fetchSentEmail(id);
    } catch (err: any) {
      error = err?.message || 'Failed to load email snapshot.';
    } finally {
      loading = false;
    }
  }

  // ── Close handlers ────────────────────────────────────────────────────────
  function closeHistorical() {
    selectedSentEmailId.set(null);
  }

  function closePresend() {
    detachVisualEditor?.();
    detachVisualEditor = null;
    presendEmail.set(null);
    editMode = 'preview';
    editableBody = '';
    originalBody = '';
    wasEdited = false;
    sending = false;
    snippetPickerOpen = false;
  }

  function close() {
    if (isPresendMode) closePresend();
    else closeHistorical();
  }

  // ── Send handler ──────────────────────────────────────────────────────────
  async function handleSend() {
    if (!$presendEmail) return;
    sending = true;

    // Flush any final visual edits the debounce hasn't caught yet
    if (editMode === 'visual' && iframeEl) {
      const finalHtml = readIframeHtml(iframeEl);
      if (finalHtml) editableBody = finalHtml;
    }

    try {
      const editMeta = wasEdited
        ? { editedBy: $authEmail || 'unknown', editedAt: new Date().toISOString() }
        : undefined;

      await triggerEmailWithEdit(
        $presendEmail.clientId,
        $presendEmail.emailType,
        editMeta,
        $presendEmail.suggestionId,
      );
      toasts.success(
        `✓ ${emailTypeLabel($presendEmail.emailType)} queued for ${$presendEmail.clientEmail}${wasEdited ? ' (edited)' : ''}`
      );
      closePresend();
    } catch (err: any) {
      toasts.error(`Send failed: ${err?.message ?? err}`);
    } finally {
      sending = false;
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  function emailTypeLabel(t: string): string {
    return (EMAIL_TYPES.find((e) => e.value === t)?.label) || t || 'Email';
  }

  const CATEGORY_LABELS: Record<string, string> = {
    cta:       '🎯 Call to Action',
    signature: '✍️  Signature',
    block:     '📄 Content Blocks',
    inline:    '◼ Inline',
    ops:       '🚢 Operations',
  };

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  onMount(() => {
    // Keyboard: Escape closes
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && (isPresendMode || isHistoricalMode)) close();
      if (e.key === 'Escape' && snippetPickerOpen) snippetPickerOpen = false;
    }
    window.addEventListener('keydown', handleKey);

    return () => {
      window.removeEventListener('keydown', handleKey);
      detachVisualEditor?.();
    };
  });
</script>

<!-- ════════════════════════════════════════════════════════════════════════
     PRE-SEND MODE
     ════════════════════════════════════════════════════════════════════════ -->
{#if $presendEmail}
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div class="email-preview-overlay" on:click={closePresend} role="presentation"></div>

  <aside class="email-preview-drawer email-preview-drawer--presend" role="dialog" aria-label="Pre-send email preview">

    <!-- ── Header ─────────────────────────────────────────────────────────── -->
    <header class="email-preview-drawer__header">
      <button class="email-preview-drawer__close" on:click={closePresend} aria-label="Cancel">✕</button>

      <div class="email-preview-drawer__title-row">
        <span class="email-preview-drawer__icon" aria-hidden="true">✍️</span>
        <h2 class="email-preview-drawer__title">Review before sending</h2>
        <span class="email-preview-drawer__badge email-preview-drawer__badge--presend">PREVIEW</span>
      </div>

      <div class="email-preview-drawer__meta">
        <span><strong>To:</strong> {$presendEmail.clientEmail}</span>
        <span class="email-preview-drawer__meta-dot">·</span>
        <span class="email-preview-drawer__meta-type">{emailTypeLabel($presendEmail.emailType)}</span>
      </div>

      <div class="email-preview-drawer__subject">{$presendEmail.subject}</div>

      <!-- ── Mode Toolbar ─────────────────────────────────────────────────── -->
      <div class="email-preview-drawer__presend-toolbar">
        <div class="epd-mode-tabs">
          <button
            type="button"
            class="epd-mode-tab"
            class:epd-mode-tab--active={editMode === 'preview'}
            on:click={() => switchToMode('preview')}
            title="Read-only preview"
          >👁 Preview</button>

          <button
            type="button"
            class="epd-mode-tab"
            class:epd-mode-tab--active={editMode === 'visual'}
            on:click={() => switchToMode('visual')}
            title="WYSIWYG editor — click directly on the email to edit"
          >✏️ Edit</button>

          <button
            type="button"
            class="epd-mode-tab epd-mode-tab--html"
            class:epd-mode-tab--active={editMode === 'html'}
            on:click={() => switchToMode('html')}
            title="Raw HTML editor (advanced)"
          >⚙ HTML</button>
        </div>

        {#if wasEdited}
          <span class="email-preview-drawer__edit-attribution">
            ✍️ Edited by {$authEmail?.split('@')[0] || 'you'}
          </span>
        {/if}
      </div>

      <!-- ── Formatting toolbar (visual mode only) ─────────────────────────── -->
      {#if editMode === 'visual'}
        <div class="epd-format-toolbar" role="toolbar" aria-label="Email formatting">
          <!-- Format buttons -->
          <button
            type="button"
            class="epd-fmt-btn"
            class:epd-fmt-btn--active={fmtBold}
            on:click={() => handleFormat('bold')}
            title="Bold (Cmd/Ctrl+B)"
            aria-label="Bold"
          ><strong>B</strong></button>

          <button
            type="button"
            class="epd-fmt-btn"
            class:epd-fmt-btn--active={fmtItalic}
            on:click={() => handleFormat('italic')}
            title="Italic (Cmd/Ctrl+I)"
            aria-label="Italic"
          ><em>I</em></button>

          <button
            type="button"
            class="epd-fmt-btn"
            class:epd-fmt-btn--active={fmtUnderline}
            on:click={() => handleFormat('underline')}
            title="Underline (Cmd/Ctrl+U)"
            aria-label="Underline"
          ><span style="text-decoration:underline">U</span></button>

          <div class="epd-fmt-sep"></div>

          <button
            type="button"
            class="epd-fmt-btn"
            on:click={() => handleFormat('insertUnorderedList')}
            title="Bullet list"
            aria-label="Bullet list"
          >•☰</button>

          <button
            type="button"
            class="epd-fmt-btn"
            on:click={() => handleFormat('insertOrderedList')}
            title="Numbered list"
            aria-label="Numbered list"
          >1☰</button>

          <button
            type="button"
            class="epd-fmt-btn"
            on:click={handleLink}
            title="Insert link"
            aria-label="Insert link"
          >🔗</button>

          <div class="epd-fmt-sep"></div>

          <button
            type="button"
            class="epd-fmt-btn"
            on:click={() => handleFormat('undo')}
            title="Undo"
            aria-label="Undo"
          >↶</button>

          <button
            type="button"
            class="epd-fmt-btn"
            on:click={() => handleFormat('redo')}
            title="Redo"
            aria-label="Redo"
          >↷</button>

          <div class="epd-fmt-sep"></div>

          <!-- Snippet picker -->
          <div class="epd-snippet-picker">
            <button
              type="button"
              class="epd-fmt-btn epd-snippet-btn"
              class:epd-fmt-btn--active={snippetPickerOpen}
              on:click={() => (snippetPickerOpen = !snippetPickerOpen)}
              title="Insert snippet"
              aria-haspopup="true"
              aria-expanded={snippetPickerOpen}
            >➕ Insert</button>

            {#if snippetPickerOpen}
              <!-- svelte-ignore a11y-click-events-have-key-events -->
              <!-- svelte-ignore a11y-no-static-element-interactions -->
              <div
                class="epd-snippet-overlay"
                on:click={() => (snippetPickerOpen = false)}
              ></div>
              <div class="epd-snippet-menu" role="menu">
                {#each nonEmptyCategories as [cat, snippets]}
                  <div class="epd-snippet-group">
                    <div class="epd-snippet-group__label">{CATEGORY_LABELS[cat] ?? cat}</div>
                    {#each snippets as snippet (snippet.id)}
                      <button
                        type="button"
                        class="epd-snippet-item"
                        role="menuitem"
                        on:click={() => handleSnippet(snippet)}
                      >
                        <span class="epd-snippet-item__icon">{snippet.icon}</span>
                        <span class="epd-snippet-item__label">{snippet.label}</span>
                      </button>
                    {/each}
                  </div>
                {/each}
              </div>
            {/if}
          </div>
        </div>
      {/if}
    </header>

    <!-- ── Body ───────────────────────────────────────────────────────────── -->
    <section class="email-preview-drawer__body">

      {#if editMode === 'html'}
        <!-- Raw HTML textarea (power-user mode) -->
        <textarea
          class="email-preview-drawer__editable-body"
          bind:value={editableBody}
          aria-label="Email HTML body — edit before sending"
          spellcheck="false"
        ></textarea>

      {:else}
        <!-- Shared iframe for both preview and visual modes.
             We flip contentEditable on/off without reloading the iframe. -->
        <iframe
          bind:this={iframeEl}
          class="email-preview-drawer__iframe"
          class:email-preview-drawer__iframe--editing={editMode === 'visual'}
          title="Email preview"
          srcdoc={frozenSrcDoc}
          sandbox="allow-same-origin allow-popups"
          on:load={attachVisualEditor}
        ></iframe>
      {/if}

    </section>

    <!-- ── Context (collapsible) ─────────────────────────────────────────── -->
    <section class="email-preview-drawer__context">
      <button
        type="button"
        class="email-preview-drawer__context-toggle"
        on:click={() => (showContext = !showContext)}
        aria-expanded={showContext}
      >
        {showContext ? '▾' : '▸'} Template context
        ({Object.keys($presendEmail.context || {}).length} fields)
      </button>
      {#if showContext}
        <table class="email-preview-drawer__context-table">
          <tbody>
            {#each Object.entries($presendEmail.context || {}) as [k, v]}
              <tr>
                <th scope="row">{k}</th>
                <td>
                  {#if v === null || v === undefined}
                    <span class="email-preview-drawer__context-nullish">—</span>
                  {:else if typeof v === 'object'}
                    <code class="email-preview-drawer__context-mono">{JSON.stringify(v)}</code>
                  {:else}
                    {String(v)}
                  {/if}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      {/if}
    </section>

    <!-- ── Footer ─────────────────────────────────────────────────────────── -->
    <footer class="email-preview-drawer__footer">
      {#if wasEdited}
        <p class="email-preview-drawer__footer-attribution">
          ✍️ Edited by <strong>{$authEmail || 'you'}</strong> — edit will be logged on send
        </p>
      {/if}
      <div class="email-preview-drawer__footer-actions">
        <button
          type="button"
          class="email-preview-drawer__footer-cancel"
          on:click={closePresend}
          disabled={sending}
        >Cancel</button>

        <button
          type="button"
          class="email-preview-drawer__footer-send"
          on:click={handleSend}
          disabled={sending}
        >
          {#if sending}
            <span class="actions-card__spinner"></span>
            Sending…
          {:else}
            📤 Send Email
          {/if}
        </button>
      </div>
    </footer>
  </aside>

<!-- ════════════════════════════════════════════════════════════════════════
     HISTORICAL MODE (unchanged)
     ════════════════════════════════════════════════════════════════════════ -->
{:else if $selectedSentEmailId}
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div class="email-preview-overlay" on:click={closeHistorical} role="presentation"></div>
  <aside class="email-preview-drawer" role="dialog" aria-label="Email preview">
    <header class="email-preview-drawer__header">
      <button class="email-preview-drawer__close" on:click={closeHistorical} aria-label="Close email preview">✕</button>
      {#if loading}
        <h2 class="email-preview-drawer__title email-preview-drawer__title--loading">Loading…</h2>
      {:else if error}
        <h2 class="email-preview-drawer__title">Couldn't load email</h2>
        <p class="email-preview-drawer__error">{error}</p>
      {:else if snapshot}
        <div class="email-preview-drawer__title-row">
          <span class="email-preview-drawer__icon" aria-hidden="true">{snapshot.inferred ? '🔮' : '📧'}</span>
          <h2 class="email-preview-drawer__title">{emailTypeLabel(snapshot.emailType)}</h2>
          {#if snapshot.inferred}
            <span class="email-preview-drawer__badge email-preview-drawer__badge--inferred">INFERRED</span>
          {/if}
        </div>
        <div class="email-preview-drawer__meta">
          <span><strong>To:</strong> {snapshot.clientEmail}</span>
          <span class="email-preview-drawer__meta-dot">·</span>
          <span title={exactTime(snapshot.sentAt)}>{relativeTime(snapshot.sentAt)}</span>
        </div>
        <div class="email-preview-drawer__subject">{snapshot.subject}</div>
        <div class="email-preview-drawer__chips">
          <span class="email-preview-drawer__chip email-preview-drawer__chip--template" title="Template version (content hash)">
            <span>🧬</span>
            <span><code>{snapshot.templateKey}</code> · v{snapshot.templateVersion}</span>
          </span>
          {#if snapshot.evoSubjectVariant}
            <span class="email-preview-drawer__chip email-preview-drawer__chip--variant" title="Evo subject A/B variant">
              <span>📐</span><span>subj: {snapshot.evoSubjectVariant}</span>
            </span>
          {/if}
          {#if snapshot.evoBodyVariant}
            <span class="email-preview-drawer__chip email-preview-drawer__chip--variant" title="Evo body A/B variant">
              <span>📐</span><span>body: {snapshot.evoBodyVariant}</span>
            </span>
          {/if}
        </div>
        {#if snapshot.templateBackfilled}
          <p class="email-preview-drawer__caveat">
            ⚠ Reconstructed render — this email was inferred from stage history. The
            actual content the customer received may have differed (we use today's
            template + today's customer data).
          </p>
        {/if}
      {/if}
    </header>

    {#if snapshot && !loading && !error}
      <section class="email-preview-drawer__body">
        <iframe
          class="email-preview-drawer__iframe"
          title="Email body"
          srcdoc={buildIframeSrcDoc(snapshot.bodyHtml)}
          sandbox="allow-same-origin allow-popups"
        ></iframe>
      </section>

      <section class="email-preview-drawer__engagement">
        <h3 class="email-preview-drawer__h3">Engagement</h3>
        <div class="email-preview-drawer__engagement-grid">
          <div class="email-preview-drawer__engagement-cell" class:email-preview-drawer__engagement-cell--on={snapshot.engagement?.opened}>
            <span>👁</span>
            <span>{snapshot.engagement?.opened ? `Opened ${relativeTime(snapshot.engagement.openedAt!)}` : 'Not opened'}</span>
          </div>
          <div class="email-preview-drawer__engagement-cell" class:email-preview-drawer__engagement-cell--on={snapshot.engagement?.clicked}>
            <span>🖱</span>
            <span>{snapshot.engagement?.clicked ? `Clicked ${relativeTime(snapshot.engagement.clickedAt!)}` : 'No clicks'}</span>
          </div>
          <div class="email-preview-drawer__engagement-cell" class:email-preview-drawer__engagement-cell--on={snapshot.engagement?.replied}>
            <span>💬</span>
            <span>{snapshot.engagement?.replied ? `Replied ${relativeTime(snapshot.engagement.repliedAt!)}` : 'No reply'}</span>
          </div>
          <div class="email-preview-drawer__engagement-cell" class:email-preview-drawer__engagement-cell--on={snapshot.engagement?.converted}>
            <span>🎯</span>
            <span>{snapshot.engagement?.converted ? 'Converted' : 'No conversion'}</span>
          </div>
        </div>
        <p class="email-preview-drawer__engagement-hint">
          Tracking pixel + click attribution will be wired in a follow-up. Until then these are placeholders.
        </p>
      </section>

      <section class="email-preview-drawer__context">
        <button
          type="button"
          class="email-preview-drawer__context-toggle"
          on:click={() => (showContext = !showContext)}
          aria-expanded={showContext}
        >
          {showContext ? '▾' : '▸'} Context used to render this email
          ({Object.keys(snapshot.context || {}).length} fields)
        </button>
        {#if showContext}
          <table class="email-preview-drawer__context-table">
            <tbody>
              {#each Object.entries(snapshot.context || {}) as [k, v]}
                <tr>
                  <th scope="row">{k}</th>
                  <td>
                    {#if v === null || v === undefined}
                      <span class="email-preview-drawer__context-nullish">—</span>
                    {:else if typeof v === 'object'}
                      <code class="email-preview-drawer__context-mono">{JSON.stringify(v)}</code>
                    {:else}
                      {String(v)}
                    {/if}
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        {/if}
      </section>
    {/if}
  </aside>
{/if}

<style>
  /* ── Visual-mode iframe edit border ──────────────────────────────────────── */
  .email-preview-drawer__iframe--editing {
    cursor: text;
  }

  /* ── Mode tabs ────────────────────────────────────────────────────────────── */
  .epd-mode-tabs {
    display: flex;
    gap: 2px;
    background: #12121e;
    border-radius: 7px;
    padding: 2px;
    flex-shrink: 0;
  }

  .epd-mode-tab {
    padding: 0.3rem 0.7rem;
    border: none;
    background: none;
    color: #888;
    font-size: 0.78rem;
    font-weight: 500;
    border-radius: 5px;
    cursor: pointer;
    transition: background 0.12s, color 0.12s;
    white-space: nowrap;
  }
  .epd-mode-tab:hover { background: #1e1e2e; color: #ccc; }
  .epd-mode-tab--active { background: #1e1e2e; color: #a78bfa; }
  .epd-mode-tab--html { font-family: monospace; font-size: 0.72rem; }

  /* ── Formatting toolbar ───────────────────────────────────────────────────── */
  .epd-format-toolbar {
    display: flex;
    align-items: center;
    gap: 2px;
    flex-wrap: wrap;
    padding: 4px 0 2px;
    border-top: 1px solid #2a2a3e;
    margin-top: 6px;
  }

  .epd-fmt-btn {
    padding: 0.25rem 0.5rem;
    background: #12121e;
    border: 1px solid #2a2a3e;
    color: #bbb;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.8rem;
    line-height: 1.4;
    transition: background 0.12s, color 0.12s;
    font-family: inherit;
    min-width: 28px;
    text-align: center;
  }
  .epd-fmt-btn:hover { background: #1e1e2e; color: #e2e2f0; border-color: #4a4a7c; }
  .epd-fmt-btn--active { background: #2e2e4e; color: #a78bfa; border-color: #7c3aed; }

  .epd-fmt-sep {
    width: 1px;
    height: 20px;
    background: #2a2a3e;
    margin: 0 3px;
    flex-shrink: 0;
  }

  /* ── Snippet picker ───────────────────────────────────────────────────────── */
  .epd-snippet-picker {
    position: relative;
  }

  .epd-snippet-btn {
    font-size: 0.78rem;
    padding: 0.25rem 0.6rem;
    white-space: nowrap;
  }

  .epd-snippet-overlay {
    position: fixed;
    inset: 0;
    z-index: 998;
  }

  .epd-snippet-menu {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    z-index: 999;
    background: #1e1e2e;
    border: 1px solid #3a3a5c;
    border-radius: 8px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.5);
    min-width: 210px;
    max-height: 320px;
    overflow-y: auto;
    padding: 6px 0;
  }

  .epd-snippet-group {
    padding: 0 0 4px;
  }

  .epd-snippet-group__label {
    padding: 6px 12px 3px;
    font-size: 0.68rem;
    font-weight: 700;
    color: #666;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .epd-snippet-item {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 6px 12px;
    background: none;
    border: none;
    color: #d0d0e8;
    font-size: 0.83rem;
    text-align: left;
    cursor: pointer;
    transition: background 0.1s;
  }
  .epd-snippet-item:hover { background: #2a2a3e; }

  .epd-snippet-item__icon {
    font-size: 0.9rem;
    flex-shrink: 0;
    width: 18px;
    text-align: center;
  }

  .epd-snippet-item__label {
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* ── Presend toolbar layout adjustment */
  .email-preview-drawer__presend-toolbar {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    padding-top: 6px;
  }
</style>
