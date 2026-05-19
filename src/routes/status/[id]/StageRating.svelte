<script lang="ts">
  import { project, submitStageRating } from './store.ts';

  export let stageKey: string;
  export let projectId: string;

  let hovered = 0;
  let noteInput = '';
  let submitting = false;
  let showNoteField = false;
  let submitted = false;

  $: existingRating = ($project?.stageRatings ?? {})[stageKey] as any;
  $: alreadyRated = !!existingRating;

  async function handleRate(rating: number) {
    if (alreadyRated || submitting) return;
    if (!showNoteField) {
      showNoteField = true;
      hovered = rating;
      return;
    }
    submitting = true;
    try {
      await submitStageRating(projectId, stageKey, rating, noteInput.trim() || undefined);
      submitted = true;
      showNoteField = false;
    } finally {
      submitting = false;
    }
  }

  async function confirmRating() {
    const rating = hovered;
    if (!rating) return;
    submitting = true;
    try {
      await submitStageRating(projectId, stageKey, rating, noteInput.trim() || undefined);
      submitted = true;
      showNoteField = false;
    } finally {
      submitting = false;
    }
  }
</script>

<div class="stage-rating">
  {#if alreadyRated}
    <div class="stage-rating__done">
      <span class="stage-rating__stars">
        {#each [1,2,3,4,5] as n}
          <span class="stage-rating__star stage-rating__star--{n <= existingRating.rating ? 'filled' : 'empty'}">★</span>
        {/each}
      </span>
      {#if existingRating.note}
        <span class="stage-rating__note">"{existingRating.note}"</span>
      {/if}
    </div>
  {:else if submitted}
    <span class="stage-rating__thanks">Thank you for your feedback! ✓</span>
  {:else}
    <div class="stage-rating__widget">
      <span class="stage-rating__label">Rate this stage</span>
      <span class="stage-rating__stars">
        {#each [1,2,3,4,5] as n}
          <!-- svelte-ignore a11y-mouse-events-have-key-events -->
          <button
            class="stage-rating__star stage-rating__star--btn"
            class:stage-rating__star--active={n <= hovered}
            on:click={() => { hovered = n; showNoteField = true; }}
            on:mouseover={() => { if (!showNoteField) hovered = n; }}
            on:mouseleave={() => { if (!showNoteField) hovered = 0; }}
            type="button"
            aria-label="Rate {n} star{n > 1 ? 's' : ''}"
          >★</button>
        {/each}
      </span>

      {#if showNoteField}
        <div class="stage-rating__extras">
          <input
            class="stage-rating__note-input"
            bind:value={noteInput}
            placeholder="Any thoughts? (optional)"
            type="text"
            maxlength="200"
          />
          <button
            class="stage-rating__submit"
            on:click={confirmRating}
            disabled={!hovered || submitting}
            type="button"
          >
            {submitting ? '…' : 'Submit'}
          </button>
          <button class="stage-rating__cancel" type="button" on:click={() => { showNoteField = false; hovered = 0; }}>×</button>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .stage-rating {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    flex-wrap: wrap;
    margin-top: 4px;
  }

  .stage-rating__label {
    font-size: 0.72rem;
    color: #94a3b8;
    font-weight: 500;
  }

  .stage-rating__widget {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    flex-wrap: wrap;
  }

  .stage-rating__stars {
    display: flex;
    gap: 2px;
  }

  .stage-rating__star {
    font-size: 1.15rem;
    line-height: 1;
    color: #d1d5db;
    transition: color 0.12s;

    &--filled { color: #f59e0b; }
    &--empty { color: #d1d5db; }

    &--btn {
      background: none;
      border: none;
      cursor: pointer;
      padding: 0;
      color: #d1d5db;
      &:hover, &.stage-rating__star--active { color: #f59e0b; }
    }
  }

  .stage-rating__done {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .stage-rating__note {
    font-size: 0.75rem;
    color: #64748b;
    font-style: italic;
  }

  .stage-rating__thanks {
    font-size: 0.78rem;
    color: #02b5bb;
    font-weight: 600;
  }

  .stage-rating__extras {
    display: flex;
    align-items: center;
    gap: 0.35rem;
  }

  .stage-rating__note-input {
    font-size: 0.8rem;
    border: 1px solid rgba(2, 181, 187, 0.4);
    border-radius: 6px;
    padding: 3px 8px;
    outline: none;
    width: 160px;
    &:focus { border-color: #02b5bb; }
  }

  .stage-rating__submit {
    font-size: 0.78rem;
    background: #02b5bb;
    color: #fff;
    border: none;
    border-radius: 6px;
    padding: 4px 10px;
    cursor: pointer;
    font-weight: 600;
    &:disabled { opacity: 0.5; cursor: not-allowed; }
  }

  .stage-rating__cancel {
    font-size: 1rem;
    background: none;
    border: none;
    cursor: pointer;
    color: #94a3b8;
    line-height: 1;
    &:hover { color: #475569; }
  }
</style>
