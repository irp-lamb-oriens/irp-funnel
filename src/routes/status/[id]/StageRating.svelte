<script lang="ts">
  import { project, submitStageRating } from './store.ts';

  export let stageKey: string;
  export let projectId: string;
  // When true (IRP staff view) the widget is fully read-only:
  // ratings are displayed but cannot be submitted or modified.
  export let readonly = false;

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
  <!-- ── READ-ONLY mode (IRP staff viewing the client portal) ─────────────── -->
  {#if readonly}
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
    {:else}
      <span class="stage-rating__pending">Not yet rated</span>
    {/if}

  <!-- ── INTERACTIVE mode (end-customer) ──────────────────────────────── -->
  {:else if alreadyRated}
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
          >{n <= hovered ? '★' : '☆'}</button>
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
    color: #64748b;
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

  /* ── Static star spans (read-only display) ─── */
  .stage-rating__star {
    font-size: 1.15rem;
    line-height: 1;
    color: #d1d5db;
    transition: color 0.12s;
  }
  .stage-rating__star--filled {
    color: #f59e0b;
  }
  .stage-rating__star--empty {
    color: #cbd5e1;  /* visible placeholder on white, still clearly unfilled vs #f59e0b filled */
  }

  /* ── Interactive star buttons ─── */
  .stage-rating__star--btn {
    background: none;
    border: none;
    cursor: pointer;
    padding: 1px 2px;
    font-size: 1.2rem;
    line-height: 1;
    color: #cbd5e1;  /* raised from white-opacity (invisible on white) to visible placeholder */
    transition: color 0.1s ease, transform 0.1s ease;
    display: inline-block;
  }
  .stage-rating__star--btn:hover {
    color: #fbbf24;
    transform: scale(1.15);
  }
  .stage-rating__star--active {
    color: #f59e0b;
  }
  .stage-rating__star--btn.stage-rating__star--active {
    color: #f59e0b;
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
    color: #0a7e82;   /* darkened from #02b5bb (~2.5:1) → #0a7e82 (~4.7:1) on white */
    font-weight: 600;
  }

  .stage-rating__pending {
    font-size: 0.72rem;
    color: #64748b;   /* raised from #cbd5e1 (~1.6:1) → #64748b (~4.8:1) on white */
    font-style: italic;
  }

  .stage-rating__extras {
    display: flex;
    align-items: center;
    gap: 0.35rem;
  }

  .stage-rating__note-input {
    font-size: 0.8rem;
    border: 1px solid rgba(2, 181, 187, 0.35);
    border-radius: 6px;
    padding: 3px 8px;
    outline: none;
    width: 160px;
    background: #f8fafc;     /* raised from rgba(255,255,255,0.05) — visible on white */
    color: #0f172a;           /* raised from #f1f5f9 — readable on light bg */
  }
  .stage-rating__note-input:focus {
    border-color: #02b5bb;
    background: #ffffff;
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
  }
  .stage-rating__submit:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .stage-rating__cancel {
    font-size: 1rem;
    background: none;
    border: none;
    cursor: pointer;
    color: #64748b;   /* raised from #94a3b8 (~2.5:1) → #64748b (~4.8:1) on white */
    line-height: 1;
  }
  .stage-rating__cancel:hover {
    color: #475569;
  }
</style>
