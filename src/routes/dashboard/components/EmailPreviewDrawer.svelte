<script lang="ts">
  /**
   * EmailPreviewDrawer.svelte
   * ────────────────────────────────────────────────────────────────────────
   *
   *  A right-edge slide-over that shows the actual content of a single
   *  `sentEmails` snapshot — subject + bodyHtml in a sandboxed iframe,
   *  template version chip, Evo variant chips, the full context dict
   *  (collapsible), engagement placeholders, and a "this is a reconstructed
   *  render" caveat for backfilled rows.
   *
   *  Why a sandboxed iframe?
   *  ───────────────────────
   *  Email HTML carries its own inline CSS (sometimes very aggressive
   *  global resets) which would destroy the dashboard's typography if we
   *  injected it directly with `{@html}`. The iframe with sandbox="" gives
   *  us total style + script isolation; we just hand it `srcdoc=…` and let
   *  it render natively.
   *
   *  Open/close model
   *  ────────────────
   *  Driven by a Svelte store `selectedSentEmailId` (defined in store.ts).
   *  Setting it to a string opens the drawer; setting it to null closes it.
   *  This component fetches lazily — only when there's an id, only once
   *  per id — so opening the drawer is instant after first load.
   */

  import { onMount } from 'svelte';
  import { selectedSentEmailId, fetchSentEmail } from '../store.ts';
  import type { SentEmailSnapshot } from '../store.ts';
  import { exactTime, relativeTime } from '../utils/relativeTime.ts';
  import { EMAIL_TYPES } from '../store.ts';

  let snapshot: SentEmailSnapshot | null = null;
  let loading = false;
  let error = '';
  let showContext = false;
  let lastFetchedId = '';

  // Reactive: when the store flips to a new id, fetch it.
  $: if ($selectedSentEmailId && $selectedSentEmailId !== lastFetchedId) {
    loadSnapshot($selectedSentEmailId);
  }

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

  function close() {
    selectedSentEmailId.set(null);
    // Don't reset `snapshot` here — the slide-out animation looks weird if
    // the content vanishes mid-animation. Reset on next open instead.
  }

  function emailTypeLabel(t: string): string {
    return (EMAIL_TYPES.find((e) => e.value === t)?.label) || t || 'Email';
  }

  /**
   * Build the iframe `srcdoc` content. We wrap the email body in a minimal
   * `<html>` doctype + UTF-8 meta + base styles so emails that rely on
   * doctype quirks render the same way the customer saw them.
   */
  function buildIframeSrcDoc(html: string): string {
    return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><base target="_blank"></head><body style="margin:0;padding:0;background:#f5f6f7;font-family:-apple-system,BlinkMacSystemFont,sans-serif;">${html}</body></html>`;
  }

  // Close on Escape
  function handleKey(e: KeyboardEvent) {
    if (e.key === 'Escape' && $selectedSentEmailId) close();
  }
  onMount(() => {
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  });
</script>

{#if $selectedSentEmailId}
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div class="email-preview-overlay" on:click={close} role="presentation"></div>
  <aside class="email-preview-drawer" role="dialog" aria-label="Email preview">
    <header class="email-preview-drawer__header">
      <button class="email-preview-drawer__close" on:click={close} aria-label="Close email preview">✕</button>
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
      <!-- ── Email body in sandboxed iframe ─────────────────────────────── -->
      <section class="email-preview-drawer__body">
        <iframe
          class="email-preview-drawer__iframe"
          title="Email body"
          srcdoc={buildIframeSrcDoc(snapshot.bodyHtml)}
          sandbox="allow-same-origin allow-popups"
        ></iframe>
      </section>

      <!-- ── Engagement placeholders (Phase-5 will populate) ────────────── -->
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

      <!-- ── Context (collapsible) ──────────────────────────────────────── -->
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
