<script lang="ts">
  import { project, addComment, editComment, deleteComment, authEmail } from './store.ts';
  import { irpStaffEmail, irpStaffIsAuthenticated } from '../../../lib/auth/irpStaff.ts';

  export let projectId: string;

  let newBody = '';
  let submitting = false;
  let editingId: string | null = null;
  let editBody = '';

  $: comments = ($project?.statusComments ?? []) as any[];
  $: userEmail = ($irpStaffIsAuthenticated ? $irpStaffEmail : $authEmail) ?? '';
  $: isStaff = $irpStaffIsAuthenticated;

  function formatDate(iso: string): string {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch { return ''; }
  }

  async function handleAdd(e: SubmitEvent) {
    e.preventDefault();
    const body = newBody.trim();
    if (!body || submitting) return;
    submitting = true;
    try {
      await addComment(projectId, body);
      newBody = '';
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

  async function handleEdit(comment: any, e: SubmitEvent) {
    e.preventDefault();
    const body = editBody.trim();
    if (!body) return;
    await editComment(projectId, comment.id, body);
    cancelEdit();
  }

  async function handleDelete(comment: any) {
    if (!confirm('Delete this comment?')) return;
    await deleteComment(projectId, comment.id);
  }

  function canEdit(comment: any): boolean {
    return isStaff || comment.author === userEmail;
  }
</script>

<section class="comments-thread">
  <h3 class="comments-thread__title">
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
    Comments
    {#if comments.length > 0}<span class="comments-thread__count">{comments.length}</span>{/if}
  </h3>

  <div class="comments-thread__list">
    {#if comments.length === 0}
      <p class="comments-thread__empty">No comments yet — be the first to leave a note.</p>
    {/if}

    {#each comments as comment (comment.id)}
      <div class="comments-thread__item" class:comments-thread__item--staff={comment.authorType === 'staff'}>
        <div class="comments-thread__item-header">
          <span class="comments-thread__author">
            {comment.author}
            {#if comment.authorType === 'staff'}
              <span class="comments-thread__staff-pill">IRP Team</span>
            {/if}
          </span>
          <span class="comments-thread__date">
            {formatDate(comment.createdAt)}
            {#if comment.editedAt}<em class="comments-thread__edited"> (edited)</em>{/if}
          </span>
        </div>

        {#if editingId === comment.id}
          <form class="comments-thread__edit-form" on:submit={(e) => handleEdit(comment, e)}>
            <textarea class="comments-thread__textarea" bind:value={editBody} rows="3"></textarea>
            <div class="comments-thread__edit-actions">
              <button type="submit" class="comments-thread__btn comments-thread__btn--primary">Save</button>
              <button type="button" class="comments-thread__btn" on:click={cancelEdit}>Cancel</button>
            </div>
          </form>
        {:else}
          <p class="comments-thread__body">{comment.body}</p>
          {#if canEdit(comment)}
            <div class="comments-thread__actions">
              <button class="comments-thread__action-btn" on:click={() => startEdit(comment)}>Edit</button>
              <button class="comments-thread__action-btn comments-thread__action-btn--danger" on:click={() => handleDelete(comment)}>Delete</button>
            </div>
          {/if}
        {/if}
      </div>
    {/each}
  </div>

  <form class="comments-thread__add" on:submit={handleAdd}>
    <textarea
      class="comments-thread__textarea"
      bind:value={newBody}
      placeholder="Add a comment…"
      rows="3"
      disabled={submitting}
    ></textarea>
    <button type="submit" class="comments-thread__btn comments-thread__btn--primary" disabled={!newBody.trim() || submitting}>
      {submitting ? 'Posting…' : 'Post Comment'}
    </button>
  </form>
</section>

<style>
  .comments-thread {
    background: #fff;
    border-radius: 16px;
    border: 1.5px solid rgba(0,0,0,0.07);
    padding: 1.25rem;
  }

  .comments-thread__title {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 1rem;
    font-weight: 600;
    color: #1a1a2e;
    margin: 0 0 1rem;
  }

  .comments-thread__count {
    background: rgba(2, 181, 187, 0.15);
    color: #02b5bb;
    font-size: 0.78rem;
    font-weight: 700;
    padding: 1px 7px;
    border-radius: 10px;
  }

  .comments-thread__list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    margin-bottom: 1rem;
  }

  .comments-thread__empty {
    color: #94a3b8;
    font-size: 0.9rem;
    text-align: center;
    padding: 1rem 0;
    margin: 0;
  }

  .comments-thread__item {
    background: #f8f9fa;
    border-radius: 10px;
    padding: 0.85rem 1rem;
    border-left: 3px solid transparent;

    &--staff {
      border-left-color: #02b5bb;
      background: #f0fafa;
    }
  }

  .comments-thread__item-header {
    display: flex;
    align-items: baseline;
    gap: 0.5rem;
    flex-wrap: wrap;
    margin-bottom: 0.4rem;
  }

  .comments-thread__author {
    font-size: 0.8rem;
    font-weight: 600;
    color: #334155;
    display: flex;
    align-items: center;
    gap: 5px;
  }

  .comments-thread__staff-pill {
    font-size: 0.65rem;
    background: rgba(2, 181, 187, 0.15);
    color: #02b5bb;
    padding: 1px 6px;
    border-radius: 4px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .comments-thread__date {
    font-size: 0.73rem;
    color: #94a3b8;
    margin-left: auto;
  }

  .comments-thread__edited {
    font-style: italic;
    font-size: 0.7rem;
  }

  .comments-thread__body {
    margin: 0;
    font-size: 0.9rem;
    color: #475569;
    line-height: 1.55;
    white-space: pre-wrap;
    word-break: break-word;
  }

  .comments-thread__actions {
    display: flex;
    gap: 0.5rem;
    margin-top: 0.5rem;
  }

  .comments-thread__action-btn {
    font-size: 0.75rem;
    color: #94a3b8;
    background: none;
    border: none;
    cursor: pointer;
    padding: 2px 6px;
    border-radius: 4px;
    transition: color 0.15s, background 0.15s;

    &:hover { color: #475569; background: rgba(0,0,0,0.06); }
    &--danger:hover { color: #dc2626; background: rgba(220,38,38,0.08); }
  }

  .comments-thread__add {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    border-top: 1px solid rgba(0,0,0,0.07);
    padding-top: 1rem;
  }

  .comments-thread__edit-form {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  .comments-thread__edit-actions {
    display: flex;
    gap: 0.4rem;
  }

  .comments-thread__textarea {
    resize: vertical;
    border: 1.5px solid rgba(2, 181, 187, 0.3);
    border-radius: 8px;
    padding: 0.6rem 0.8rem;
    font-size: 0.88rem;
    font-family: inherit;
    outline: none;
    transition: border-color 0.2s;
    &:focus { border-color: #02b5bb; }
    &::placeholder { color: #b0c4c4; }
    &:disabled { opacity: 0.6; }
  }

  .comments-thread__btn {
    padding: 0.45rem 1rem;
    border-radius: 8px;
    font-size: 0.85rem;
    font-weight: 600;
    cursor: pointer;
    border: 1.5px solid rgba(0,0,0,0.15);
    background: #fff;
    color: #475569;
    transition: background 0.15s, border-color 0.15s;

    &:hover { background: #f1f5f9; }
    &:disabled { opacity: 0.5; cursor: not-allowed; }

    &--primary {
      background: #02b5bb;
      border-color: #02b5bb;
      color: #fff;
      &:hover:not(:disabled) { background: #019fa4; }
    }
  }
</style>
