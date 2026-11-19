<script lang="ts">
  /**
   * ClientEmailEditor.svelte — the client's email on the Overview, with the
   * one supported way to change it and the record of past changes.
   *
   * The email is not a plain field: changing it updates it everywhere it lives
   * on the client, keeps the former address searchable, repoints pending
   * queued emails and leaves a history entry. All of that happens server-side
   * behind `changeClientEmail`; this component only collects the new address
   * (and an optional reason) and shows what happened.
   */
  import { changeClientEmail, type EmailHistoryEntry } from '../store.ts';

  export let clientId: string;
  export let value: string = '';
  export let history: EmailHistoryEntry[] = [];
  /** 8-character client reference, when the client has one. */
  export let shortId: string = '';

  let editing = false;
  let showHistory = false;
  let draft = '';
  let note = '';
  let saving = false;
  let error = '';
  let notice = '';

  // Reset when the panel switches to another client.
  let lastClientId = clientId;
  $: if (clientId !== lastClientId) {
    lastClientId = clientId;
    editing = false; showHistory = false; draft = ''; note = ''; error = ''; notice = '';
  }

  $: newestFirst = [...(history ?? [])].reverse();
  $: canSave = !saving && draft.trim().length > 3 && draft.includes('@') && draft.trim().toLowerCase() !== (value ?? '').trim().toLowerCase();

  function startEditing() {
    draft = '';
    note = '';
    error = '';
    notice = '';
    editing = true;
  }

  async function save() {
    if (!canSave) return;
    saving = true;
    error = '';
    try {
      const result = await changeClientEmail(clientId, draft.trim(), note.trim() || undefined);
      editing = false;
      const moved = result.queueItemsUpdated;
      notice = moved
        ? `Email changed. ${moved} scheduled ${moved === 1 ? 'email now goes' : 'emails now go'} to the new address.`
        : 'Email changed.';
      if (result.queueItemsFailed.length) {
        error = `${result.queueItemsFailed.length} scheduled ${result.queueItemsFailed.length === 1 ? 'email is' : 'emails are'} still set to the old address. Check the Emails tab before they send.`;
      }
    } catch (err: any) {
      error = err?.message || 'Could not change the email. Try again.';
    } finally {
      saving = false;
    }
  }

  function formatWhen(iso: string): string {
    try { return new Date(iso).toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' }); }
    catch { return iso; }
  }
</script>

<div class="email-editor">
  {#if !editing}
    <div class="email-editor__row">
      <span class="email-editor__value">{value || '—'}</span>
      {#if shortId}<span class="email-editor__ref" title="Client reference">Ref. {shortId}</span>{/if}
      <button type="button" class="email-editor__link" on:click={startEditing}>Change</button>
      {#if newestFirst.length}
        <button type="button" class="email-editor__link" aria-expanded={showHistory} on:click={() => (showHistory = !showHistory)}>
          {showHistory ? 'Hide history' : `History (${newestFirst.length})`}
        </button>
      {/if}
    </div>
  {:else}
    <form class="email-editor__form" on:submit|preventDefault={save}>
      <label class="email-editor__label" for="email-editor-new-{clientId}">New email</label>
      <input
        id="email-editor-new-{clientId}"
        class="email-editor__input"
        type="email"
        autocomplete="off"
        placeholder={value || 'name@example.com'}
        bind:value={draft}
        disabled={saving}
      />
      <label class="email-editor__label" for="email-editor-note-{clientId}">Reason (optional)</label>
      <input
        id="email-editor-note-{clientId}"
        class="email-editor__input"
        type="text"
        placeholder="e.g. Client asked to use their work address"
        bind:value={note}
        disabled={saving}
      />
      <div class="email-editor__actions">
        <button type="button" class="email-editor__btn" disabled={saving} on:click={() => (editing = false)}>Cancel</button>
        <button type="submit" class="email-editor__btn email-editor__btn--primary" disabled={!canSave}>
          {saving ? 'Saving…' : 'Change email'}
        </button>
      </div>
    </form>
  {/if}

  {#if notice}<p class="email-editor__notice" role="status">{notice}</p>{/if}
  {#if error}<p class="email-editor__error" role="alert">{error}</p>{/if}

  {#if showHistory && !editing}
    <ol class="email-editor__history">
      {#each newestFirst as h (h.changedAt + h.to)}
        <li>
          <span class="email-editor__history-change">{h.from || 'No email'} → {h.to}</span>
          <span class="email-editor__history-meta">{formatWhen(h.changedAt)} · {h.changedBy}{h.note ? ` · ${h.note}` : ''}</span>
        </li>
      {/each}
    </ol>
  {/if}
</div>

<style>
  /* Sits inside an Overview field row and inherits its type and colors, so it
     reads as part of the panel rather than as a separate widget. */
  .email-editor { display: flex; flex-direction: column; gap: 0.35rem; min-width: 0; }
  .email-editor__row { display: flex; flex-wrap: wrap; align-items: baseline; gap: 0.25rem 0.75rem; }
  .email-editor__value { overflow-wrap: anywhere; }
  .email-editor__ref {
    font-size: 0.78em;
    font-variant-numeric: tabular-nums;
    letter-spacing: 0.02em;
    opacity: 0.6;
  }
  .email-editor__link {
    font: inherit;
    font-size: 0.82em;
    font-weight: 600;
    padding: 0;
    border: 0;
    background: none;
    color: var(--color-highlight-2, var(--irp-accent-ink));
    cursor: pointer;
  }
  .email-editor__link:hover { text-decoration: underline; }
  .email-editor__form { display: flex; flex-direction: column; gap: 0.3rem; max-width: 28rem; }
  .email-editor__label { font-size: 0.75em; font-weight: 600; opacity: 0.7; }
  .email-editor__input {
    font: inherit;
    padding: 0.4rem 0.6rem;
    border-radius: var(--irp-r-xs);
    border: 1px solid color-mix(in srgb, currentColor 25%, transparent);
    background: transparent;
    color: inherit;
  }
  .email-editor__input:focus-visible,
  .email-editor__btn:focus-visible,
  .email-editor__link:focus-visible {
    outline: 2px solid var(--color-highlight-2, var(--irp-accent));
    outline-offset: 2px;
  }
  .email-editor__actions { display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 0.3rem; }
  .email-editor__btn {
    font: inherit;
    font-size: 0.85em;
    font-weight: 600;
    padding: 0.4rem 0.9rem;
    border-radius: var(--irp-r-xs);
    border: 1px solid color-mix(in srgb, currentColor 25%, transparent);
    background: transparent;
    color: inherit;
    cursor: pointer;
  }
  .email-editor__btn--primary {
    background: var(--color-highlight-2, var(--irp-accent));
    border-color: var(--color-highlight-2, var(--irp-accent));
    color: var(--irp-text);
  }
  .email-editor__btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .email-editor__notice { margin: 0; font-size: 0.82em; color: var(--color-highlight-2, var(--irp-accent-ink)); }
  .email-editor__error { margin: 0; font-size: 0.82em; color: var(--chat-color-staff, var(--irp-amber-700)); }
  .email-editor__history { list-style: none; margin: 0.2rem 0 0; padding: 0; display: flex; flex-direction: column; gap: 0.35rem; }
  .email-editor__history li { display: flex; flex-direction: column; font-size: 0.82em; }
  .email-editor__history-change { overflow-wrap: anywhere; }
  .email-editor__history-meta { opacity: 0.6; font-size: 0.92em; }
</style>
