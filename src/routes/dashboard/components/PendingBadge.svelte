<script lang="ts">
  /**
   * PendingBadge.svelte
   *
   * Field-agnostic numbered badge for pending actions.
   * Renders nothing when count is 0 — import it unconditionally on every
   * card/tab and just pass the count; visibility is handled here.
   *
   * Variants:
   *   'card'  — absolute top-right corner of a Kanban card (larger, pulsing)
   *   'tab'   — inline beside a Detail Panel tab label (smaller, static)
   */

  /** Number of pending actions. Badge is invisible when 0. */
  export let count: number = 0;

  /** Visual context. Drives CSS modifier class only — no logic difference. */
  export let variant: 'card' | 'tab' = 'card';
</script>

{#if count > 0}
  <span
    class="pending-badge pending-badge--{variant}"
    aria-label="{count} pending action{count !== 1 ? 's' : ''}"
    title="{count} pending action{count !== 1 ? 's' : ''}"
  >{count > 9 ? '9+' : count}</span>
{/if}
