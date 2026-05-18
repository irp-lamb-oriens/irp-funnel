<script lang="ts">
  /**
   * EmailPreviewDrawer.svelte
   * ────────────────────────────────────────────────────────────────────────
   *
   *  Dual-mode right-edge slide-over:
   *
   *  MODE 1 — Historical view (default, unchanged)
   *    Driven by `selectedSentEmailId` store. Shows the rendered email the
   *    customer actually received: subject, bodyHtml in sandboxed iframe,
   *    template version chip, Evo variant chips, engagement placeholders,
   *    and collapsible context table.
   *
   *  MODE 2 — Pre-send preview (new)
   *    Driven by `presendEmail` store. Shows a draft email BEFORE it's sent:
   *    same iframe preview, plus an editable body textarea (toggle between
   *    edit/preview), edit attribution note, and Send / Cancel footer.
   *    Setting `presendEmail` to null closes this mode.
   *
   *  The two modes are mutually exclusive. Pre-send takes priority if both
   *  stores are simultaneously non-null (shouldn't happen in practice).
   *
   *  Why a sandboxed iframe?
   *  ───────────────────────
   *  Email HTML carries aggressive global CSS resets. The iframe + sandbox=""
   *  gives us total style isolation; we hand it `srcdoc` and let it render.
   */

  import { onMount } from 'svelte';
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

  // ── Historical mode state ────────────────────────────────────────────────
  let snapshot: SentEmailSnapshot | null = null;
  let loading = false;
  let error = '';
  let showContext = false;
  let lastFetchedId = '';

  // ── Pre-send mode state ──────────────────────────────────────────────────
  /** Whether the operator has switched to the HTML edit textarea. */
  let editMode = false;
  /** Editable copy of the body HTML (starts as the original, operator may change it). */
  let editableBody = '';
  /** True once the operator has actually changed the body text. */
  let wasEdited = false;
  /** Original body at the time the drawer opened (for dirty check). */
  let originalBody = '';
  /** Sending in progress. */
  let sending = false;

  // ── Derived: which mode are we in? ──────────────────────────────────────
  $: isPresendMode = !!$presendEmail;
  $: isHistoricalMode = !isPresendMode && !!$selectedSentEmailId;

  // ── Historical mode: fetch on id change ─────────────────────────────────
  $: if ($selectedSentEmailId && $selectedSentEmailId !== lastFetchedId && !isPresendMode) {
    loadSnapshot($selectedSentEmailId);
  }

  // ── Pre-send mode: initialise editable state when drawer opens ───────────
  $: if ($presendEmail) {
    editableBody = $presendEmail.bodyHtml;
    originalBody = $presendEmail.bodyHtml;
    wasEdited = false;
    editMode = false;
    showContext = false;
  }

  // ── Track dirty edits ────────────────────────────────────────────────────
  $: wasEdited = editableBody !== originalBody;

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

  // ── Close handlers ───────────────────────────────────────────────────────
  function closeHistorical() {
    selectedSentEmailId.set(null);
  }

  function closePresend() {
    presendEmail.set(null);
    editMode = false;
    editableBody = '';
    originalBody = '';
    wasEdited = false;
    sending = false;
  }

  function close() {
    if (isPresendMode) closePresend();
    else closeHistorical();
  }

  // ── Send handler (pre-send mode) ─────────────────────────────────────────
  async function handleSend() {
    if (!$presendEmail) return;
    sending = true;
    try {
      const editMeta = wasEdited
        ? { editedBy: $authEmail || 'unknown', editedAt: new Date().toISOString() }
        : undefined;
      // Pass suggestionId when present so the backend can clear the suggestion atomically
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

  // ── Helpers ──────────────────────────────────────────────────────────────
  function emailTypeLabel(t: string): string {
    return (EMAIL_TYPES.find((e) => e.value === t)?.label) || t || 'Email';
  }

  function buildIframeSrcDoc(html: string): string {
    return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><base target="_blank"></head><body style="margin:0;padding:0;background:#f5f6f7;font-family:-apple-system,BlinkMacSystemFont,sans-serif;">${html}</body></html>`;
  }

  // ── Keyboard: Escape closes ──────────────────────────────────────────────
  function handleKey(e: KeyboardEvent) {
    if (e.key === 'Escape' && (isPresendMode || isHistoricalMode)) close();
  }
  onMount(() => {
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
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

    <header class="email-preview-drawer__header">
      <button class="email-preview-drawer__close" on:click={closePresend} aria-label="Cancel pre-send preview">✕</button>

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

      <!-- Edit / Preview toggle -->
      <div class="email-preview-drawer__presend-toolbar">
        <button
          type="button"
          class="email-preview-drawer__toggle-btn"
          class:email-preview-drawer__toggle-btn--active={!editMode}
          on:click={() => (editMode = false)}
        >
          👁 Preview
        </button>
        <button
          type="button"
          class="email-preview-drawer__toggle-btn"
          class:email-preview-drawer__toggle-btn--active={editMode}
          on:click={() => (editMode = true)}
        >
          ✏️ Edit HTML
        </button>
        {#if wasEdited}
          <span class="email-preview-drawer__edit-attribution">
            ✍️ Modified by {$authEmail?.split('@')[0] || 'you'}
          </span>
        {/if}
      </div>
    </header>

    <!-- Body: iframe preview or textarea editor -->
    <section class="email-preview-drawer__body">
      {#if editMode}
        <textarea
          class="email-preview-drawer__editable-body"
          bind:value={editableBody}
          aria-label="Email HTML body — edit before sending"
          spellcheck="false"
        ></textarea>
      {:else}
        <iframe
          class="email-preview-drawer__iframe"
          title="Email preview"
          srcdoc={buildIframeSrcDoc(editableBody)}
          sandbox="allow-same-origin allow-popups"
        ></iframe>
      {/if}
    </section>

    <!-- Context (collapsible) -->
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

    <!-- Sticky footer with Send / Cancel -->
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
        >
          Cancel
        </button>
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
     HISTORICAL MODE (unchanged from original)
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
      <!-- Email body in sandboxed iframe -->
      <section class="email-preview-drawer__body">
        <iframe
          class="email-preview-drawer__iframe"
          title="Email body"
          srcdoc={buildIframeSrcDoc(snapshot.bodyHtml)}
          sandbox="allow-same-origin allow-popups"
        ></iframe>
      </section>

      <!-- Engagement placeholders -->
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

      <!-- Context (collapsible) -->
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
