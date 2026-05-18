<script lang="ts">
  /**
   * CardHistory.svelte
   *
   * Renders the consultation document's `activityLog` as a natural-language
   * audit feed: WHO did WHAT, WHEN. Every undoable row gets its own ↩ Undo
   * button. There's also a top-level "↩ Undo last" button.
   *
   * Used inline on every kanban card AND inside the detail panel's Activity
   * tab — same component, two surfaces.
   */

  import { undoLast, type ActivityEntry } from '../store.ts';
  import { formatActivity } from '../utils/formatActivity.ts';
  import { toasts } from '../toastStore.ts';

  export let clientId: string;
  export let activityLog: ActivityEntry[] | undefined = [];
  /** Maximum rows to show by default. Click "Show all" to expand. */
  export let limit: number = 5;
  /** Show only undoable rows? Default false (show everything). */
  export let undoableOnly: boolean = false;

  let showAll = false;
  let undoing = false;

  $: rows = (activityLog || [])
    .slice() // copy before reverse
    .reverse() // newest first
    .map(formatActivity)
    .filter((r) => !undoableOnly || r.undoable);

  $: visibleRows = showAll ? rows : rows.slice(0, limit);
  $: hiddenCount = Math.max(0, rows.length - visibleRows.length);
  $: hasUndoable = rows.some((r) => r.undoable);

  async function handleUndo(_indexInRows?: number) {
    if (undoing) return;
    undoing = true;
    try {
      const result = await undoLast(clientId);
      if (result.undoType === 'stage_change') {
        toasts.success(`Reverted stage to "${result.revertedTo}"`);
      } else if (result.undoType === 'field') {
        toasts.success(`Reverted ${result.path}`);
      }
    } catch (err: any) {
      toasts.error(`Undo failed: ${err?.message ?? err}`);
    } finally {
      undoing = false;
    }
  }
</script>

<div class="card-history">
  {#if rows.length === 0}
    <p class="card-history__empty">No history yet.</p>
  {:else}
    {#if hasUndoable}
      <div class="card-history__toolbar">
        <button
          type="button"
          class="card-history__undo-all"
          on:click|stopPropagation={() => handleUndo()}
          disabled={undoing}
          title="Undo most-recent change"
        >
          Undo last
        </button>
      </div>
    {/if}

    <ul class="card-history__list">
      {#each visibleRows as r}
        <li class="card-history__row" class:card-history__row--undoable={r.undoable}>
          <span class="card-history__icon" aria-hidden="true">{r.icon}</span>
          <div class="card-history__body">
            <div class="card-history__line">
              <span class="card-history__who">{r.who}</span>
              <span class="card-history__what"> {r.what}</span>
            </div>
            {#if r.detail}
              <div class="card-history__detail">{r.detail}</div>
            {/if}
            <div class="card-history__when">
              <span title={r.whenExact}>{r.whenRelative}</span>
            </div>
          </div>
          {#if r.undoable && rows.indexOf(r) === 0}
            <!-- Only the newest undoable row carries an inline ↩ — server's undo
                 walks backwards from the newest entry, so this is the only one
                 that's actually "next-undoable". -->
            <button
              type="button"
              class="card-history__row-undo"
              on:click|stopPropagation={() => handleUndo()}
              disabled={undoing}
              title={`Revert: ${r.what}`}
              aria-label={`Revert: ${r.what}`}
            >↩</button>
          {/if}
        </li>
      {/each}
    </ul>

    {#if hiddenCount > 0 && !showAll}
      <button
        type="button"
        class="card-history__show-more"
        on:click|stopPropagation={() => showAll = true}
      >Show {hiddenCount} more</button>
    {:else if showAll && rows.length > limit}
      <button
        type="button"
        class="card-history__show-more"
        on:click|stopPropagation={() => showAll = false}
      >Show less</button>
    {/if}
  {/if}
</div>
