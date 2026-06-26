<script lang="ts">
  import { onMount } from 'svelte';
  import { project, addComment, editComment, deleteComment, authEmail } from './store.ts';
  import { irpStaffEmail, irpStaffIsAuthenticated } from '../../../lib/auth/irpStaff.ts';

  export let projectId: string;

  const MUTATION_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

  let newBody = '';
  let submitting = false;
  let editingId: string | null = null;
  let editBody = '';
  let composerEl: HTMLTextAreaElement | null = null;
  let listEl: HTMLDivElement | null = null;

  let now = Date.now();
  onMount(() => {
    const t = setInterval(() => (now = Date.now()), 30_000);
    return () => clearInterval(t);
  });

  $: userEmail = ($irpStaffIsAuthenticated ? $irpStaffEmail : $authEmail) ?? '';

  function withinWindow(comment: any, nowTs: number): boolean {
    const ts = Date.parse(comment?.createdAt ?? '');
    return Number.isFinite(ts) && nowTs - ts <= MUTATION_WINDOW_MS;
  }

  $: comments = (($project?.statusComments ?? []) as any[])
    .filter((c) => !c.deleted)
    .map((c) => ({ ...c, _canModify: c.author === userEmail && withinWindow(c, now) }));

  function getInitials(email: string): string {
    if (!email) return '?';
    const local = email.split('@')[0] ?? '';
    const parts = local.split(/[._-]/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0]! + parts[1][0]!).toUpperCase();
    return (local[0] ?? '?').toUpperCase();
  }

  function formatDate(iso: string): string {
    if (!iso) return '';
    try {
      const d = new Date(iso);
      const now2 = new Date();
      const diffMs = now2.getTime() - d.getTime();
      const diffMin = Math.floor(diffMs / 60000);
      const diffH = Math.floor(diffMin / 60);
      const diffD = Math.floor(diffH / 24);
      if (diffMin < 1) return 'just now';
      if (diffMin < 60) return `${diffMin}m ago`;
      if (diffH < 24) return `${diffH}h ago`;
      if (diffD < 7) return `${diffD}d ago`;
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch { return ''; }
  }

  function autoGrow(el: HTMLTextAreaElement) {
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 200) + 'px';
  }

  function handleComposerInput(e: Event) {
    autoGrow(e.currentTarget as HTMLTextAreaElement);
  }

  function handleComposerKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      doAdd();
    }
  }

  async function doAdd() {
    const body = newBody.trim();
    if (!body || submitting) return;
    submitting = true;
    try {
      await addComment(projectId, body);
      newBody = '';
      if (composerEl) {
        composerEl.style.height = 'auto';
      }
      // Scroll to bottom after insert
      setTimeout(() => {
        if (listEl) listEl.scrollTop = listEl.scrollHeight;
      }, 80);
    } finally {
      submitting = false;
    }
  }

  function startEdit(comment: any) {
    editingId = comment.id;
    editBody = comment.body;
  }

  function cancelEdit() {
    editingId = null;
    editBody = '';
  }

  async function handleEdit(comment: any) {
    const body = editBody.trim();
    if (!body) return;
    await editComment(projectId, comment.id, body);
    cancelEdit();
  }

  async function handleDelete(comment: any) {
    if (!confirm('Delete this message? This cannot be undone.')) return;
    await deleteComment(projectId, comment.id);
  }
</script>

<section class="ct">
  <div class="ct__header">
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
    <span class="ct__header-title">Messages</span>
    {#if comments.length > 0}
      <span class="ct__header-count">{comments.length}</span>
    {/if}
  </div>

  <div class="ct__list" bind:this={listEl}>
    {#if comments.length === 0}
      <div class="ct__empty">
        <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        <p>No messages yet. Leave a note for your relocation team.</p>
      </div>
    {/if}

    {#each comments as comment (comment.id)}
      {@const isOwn = comment.author === userEmail}
      {@const isStaff = comment.authorType === 'staff'}
      <div class="ct__msg" class:ct__msg--own={isOwn} class:ct__msg--staff={isStaff}>
        <div class="ct__msg-avatar" class:ct__msg-avatar--staff={isStaff}>
          {getInitials(comment.author)}
        </div>
        <div class="ct__msg-wrap">
          <div class="ct__msg-meta">
            <span class="ct__msg-author">
              {isOwn ? 'You' : isStaff ? 'IRP Team' : comment.author.split('@')[0]}
            </span>
            {#if isStaff}<span class="ct__msg-badge">IRP</span>{/if}
            <span class="ct__msg-time">{formatDate(comment.createdAt)}</span>
            {#if comment.editedAt}<span class="ct__msg-edited">edited</span>{/if}
          </div>

          {#if editingId === comment.id}
            <div class="ct__edit-wrap">
              <textarea
                class="ct__edit-input"
                bind:value={editBody}
                rows="2"
                on:keydown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleEdit(comment); } if (e.key === 'Escape') cancelEdit(); }}
              ></textarea>
              <div class="ct__edit-actions">
                <button class="ct__edit-save" on:click={() => handleEdit(comment)}>Save</button>
                <button class="ct__edit-cancel" on:click={cancelEdit}>Cancel</button>
              </div>
            </div>
          {:else}
            <div class="ct__msg-bubble">{comment.body}</div>
            {#if comment._canModify}
              <div class="ct__msg-controls">
                <button class="ct__msg-ctrl" on:click={() => startEdit(comment)}>Edit</button>
                <span class="ct__msg-ctrl-sep">·</span>
                <button class="ct__msg-ctrl ct__msg-ctrl--danger" on:click={() => handleDelete(comment)}>Delete</button>
              </div>
            {/if}
          {/if}
        </div>
      </div>
    {/each}
  </div>

  <!-- ── Single-action composer ─────────────────────────────────── -->
  <div class="ct__composer">
    <div class="ct__composer-wrap">
      <textarea
        bind:this={composerEl}
        class="ct__composer-input"
        bind:value={newBody}
        placeholder="Send a message…"
        rows="1"
        disabled={submitting}
        on:input={handleComposerInput}
        on:keydown={handleComposerKeydown}
      ></textarea>
      <button
        class="ct__composer-send"
        class:ct__composer-send--ready={newBody.trim().length > 0}
        disabled={!newBody.trim() || submitting}
        aria-label={submitting ? 'Sending…' : 'Send message'}
        on:click={doAdd}
      >
        {#if submitting}
          <span class="ct__composer-spinner"></span>
        {:else}
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
        {/if}
      </button>
    </div>
    <p class="ct__composer-hint">↵ Enter to send &middot; Shift+↵ for new line</p>
  </div>
</section>

<style>
  .ct {
    background: #ffffff;
    border-radius: 16px;
    border: 1.5px solid rgba(0,0,0,0.07);
    box-shadow: 0 1px 6px rgba(0,0,0,0.05);
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  /* ── Header ── */
  .ct__header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 1.1rem 1.5rem;
    border-bottom: 1px solid rgba(0,0,0,0.07);
    font-size: 0.95rem;
    font-weight: 700;
    color: #0f172a;
  }

  .ct__header-title {
    font-weight: 700;
  }

  .ct__header-count {
    background: rgba(2,181,187,0.12);
    color: #02b5bb;
    font-size: 0.72rem;
    font-weight: 700;
    padding: 1px 7px;
    border-radius: 20px;
    border: 1px solid rgba(2,181,187,0.2);
  }

  /* ── Message list ── */
  .ct__list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 1.25rem 1.5rem;
    max-height: 420px;
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: rgba(0,0,0,0.1) transparent;
    flex: 1;
  }

  .ct__empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.6rem;
    padding: 2.5rem 1rem;
    color: #94a3b8;
    text-align: center;

    p {
      margin: 0;
      font-size: 0.88rem;
    }
  }

  /* ── Single message ── */
  .ct__msg {
    display: flex;
    gap: 0.7rem;
    align-items: flex-start;

    &--own {
      flex-direction: row-reverse;

      .ct__msg-meta {
        flex-direction: row-reverse;
        justify-content: flex-start;
      }

      .ct__msg-bubble {
        background: rgba(2,181,187,0.1);
        border-color: rgba(2,181,187,0.2);
        color: #0c4a4d;
      }

      .ct__msg-controls {
        justify-content: flex-end;
      }
    }

    &--staff:not(.ct__msg--own) {
      .ct__msg-bubble {
        border-left: 3px solid #02b5bb;
        background: #f0fafa;
      }
    }
  }

  .ct__msg-avatar {
    width: 30px;
    height: 30px;
    border-radius: 50%;
    background: #e2e8f0;
    color: #475569;
    font-size: 0.72rem;
    font-weight: 800;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    letter-spacing: 0.02em;

    &--staff {
      background: rgba(2,181,187,0.15);
      color: #02b5bb;
    }
  }

  .ct__msg-wrap {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    max-width: 78%;
    min-width: 0;
  }

  .ct__msg-meta {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    flex-wrap: wrap;
  }

  .ct__msg-author {
    font-size: 0.77rem;
    font-weight: 700;
    color: #334155;
  }

  .ct__msg-badge {
    font-size: 0.62rem;
    background: rgba(2,181,187,0.12);
    color: #02b5bb;
    padding: 1px 5px;
    border-radius: 4px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    border: 1px solid rgba(2,181,187,0.2);
  }

  .ct__msg-time {
    font-size: 0.7rem;
    color: #94a3b8;
  }

  .ct__msg-edited {
    font-size: 0.66rem;
    color: #94a3b8;
    font-style: italic;
  }

  .ct__msg-bubble {
    background: #f8fafc;
    border: 1px solid rgba(0,0,0,0.07);
    border-radius: 12px;
    border-top-left-radius: 3px;
    padding: 0.65rem 0.9rem;
    font-size: 0.9rem;
    color: #334155;
    line-height: 1.55;
    white-space: pre-wrap;
    word-break: break-word;
  }

  .ct__msg--own .ct__msg-bubble {
    border-top-left-radius: 12px;
    border-top-right-radius: 3px;
  }

  .ct__msg-controls {
    display: flex;
    align-items: center;
    gap: 0.2rem;
    padding: 0 0.25rem;
  }

  .ct__msg-ctrl {
    font-size: 0.7rem;
    color: #94a3b8;
    background: none;
    border: none;
    cursor: pointer;
    padding: 2px 4px;
    border-radius: 4px;
    transition: color 0.12s, background 0.12s;
    font-weight: 500;

    &:hover { color: #475569; background: rgba(0,0,0,0.05); }
    &--danger:hover { color: #dc2626; background: rgba(220,38,38,0.07); }
  }

  .ct__msg-ctrl-sep {
    color: #cbd5e1;
    font-size: 0.7rem;
    user-select: none;
  }

  /* ── Inline edit form ── */
  .ct__edit-wrap {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  .ct__edit-input {
    resize: vertical;
    border: 1.5px solid rgba(2,181,187,0.3);
    border-radius: 8px;
    padding: 0.55rem 0.75rem;
    font-size: 0.88rem;
    font-family: inherit;
    outline: none;
    background: #fff;
    color: #0f172a;
    transition: border-color 0.15s;

    &:focus { border-color: #02b5bb; }
  }

  .ct__edit-actions {
    display: flex;
    gap: 0.4rem;
  }

  .ct__edit-save {
    padding: 0.3rem 0.85rem;
    background: #02b5bb;
    color: #fff;
    border: none;
    border-radius: 7px;
    font-size: 0.82rem;
    font-weight: 700;
    cursor: pointer;
    font-family: inherit;
    transition: background 0.15s;

    &:hover { background: #019fa4; }
  }

  .ct__edit-cancel {
    padding: 0.3rem 0.75rem;
    background: none;
    border: 1.5px solid rgba(0,0,0,0.1);
    border-radius: 7px;
    font-size: 0.82rem;
    font-weight: 600;
    color: #475569;
    cursor: pointer;
    font-family: inherit;
    transition: background 0.15s;

    &:hover { background: rgba(0,0,0,0.04); }
  }

  /* ── Composer ── */
  .ct__composer {
    border-top: 1px solid rgba(0,0,0,0.07);
    padding: 0.85rem 1.25rem 0.65rem;
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    background: #fafafa;
  }

  .ct__composer-wrap {
    display: flex;
    align-items: flex-end;
    gap: 0.6rem;
    background: #ffffff;
    border: 1.5px solid rgba(0,0,0,0.1);
    border-radius: 14px;
    padding: 0.45rem 0.5rem 0.45rem 0.85rem;
    transition: border-color 0.15s, box-shadow 0.15s;

    &:focus-within {
      border-color: #02b5bb;
      box-shadow: 0 0 0 3px rgba(2,181,187,0.1);
    }
  }

  .ct__composer-input {
    flex: 1;
    border: none;
    outline: none;
    background: transparent;
    font-size: 0.92rem;
    font-family: inherit;
    color: #0f172a;
    line-height: 1.5;
    padding: 0;
    resize: none;
    overflow: hidden;
    min-height: 1.5rem;
    max-height: 200px;

    &::placeholder { color: #94a3b8; }
    &:disabled { opacity: 0.55; }
  }

  .ct__composer-send {
    width: 34px;
    height: 34px;
    border-radius: 10px;
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    background: #e2e8f0;
    color: #94a3b8;
    transition: background 0.15s, color 0.15s, transform 0.1s;

    &--ready {
      background: #02b5bb;
      color: #ffffff;

      &:hover { background: #019fa4; transform: scale(1.05); }
    }

    &:disabled { cursor: not-allowed; }
  }

  .ct__composer-spinner {
    width: 14px;
    height: 14px;
    border: 2px solid rgba(255,255,255,0.4);
    border-top-color: #fff;
    border-radius: 50%;
    animation: ct-spin 0.7s linear infinite;
    display: block;
  }

  .ct__composer-hint {
    font-size: 0.7rem;
    color: #b0bec5;
    margin: 0;
    padding-left: 0.25rem;
  }

  @keyframes ct-spin {
    to { transform: rotate(360deg); }
  }
</style>
