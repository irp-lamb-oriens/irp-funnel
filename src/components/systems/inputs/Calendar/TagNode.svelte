<script lang="ts">
  import { writable, type Writable } from 'svelte/store';

  export let node: { name: string; value: string; disabled: boolean };
  export let selectedTags: Writable<string[]>;
  export let toggleTag: (tag: string) => void;
  /**
   * Controls text/border colour for unselected chips.
   *  'dark'  — white text on dark/glass bg (hero form, default — backward-compatible).
   *  'light' — dark text on white bg (CRM modal).
   */
  export let slotTheme: 'dark' | 'light' = 'dark';

  let isSelected: boolean;
  selectedTags.subscribe(tags => {
    isSelected = tags.includes(node.value);
  });
</script>

<button
  class="tag-button"
  class:selected={isSelected}
  class:tag-button--light={slotTheme === 'light'}
  disabled={node.disabled}
  on:click={() => !node.disabled && toggleTag(node.value)}
>
  {node.name}
</button>

<style lang="scss">
  .tag-button {
    padding: 0.75rem 1.25rem;
    border-radius: 1rem;
    /* ── Dark (default) — white text on glass/dark bg ── */
    border: 1px solid rgba(255, 255, 255, 0.1);
    background-color: rgba(255, 255, 255, 0.05);
    color: rgba(255, 255, 255, 0.9);
    font-size: 0.95rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    backdrop-filter: blur(5px);

    &:hover:not(:disabled) {
      background-color: rgba(255, 255, 255, 0.1);
      border-color: rgba(255, 255, 255, 0.2);
      transform: translateY(-1px);
    }

    &.selected {
      background-color: var(--color-highlight-2);
      color: #000;
      border-color: var(--color-highlight-2);
      box-shadow: 0 0 15px rgba(var(--color-highlight-2-rgb), 0.3);

      &:hover {
        background-color: var(--color-highlight-2);
        opacity: 0.9;
      }
    }

    &:disabled {
      background-color: rgba(255, 255, 255, 0.02);
      color: rgba(255, 255, 255, 0.2);
      border-color: rgba(255, 255, 255, 0.05);
      cursor: not-allowed;
      pointer-events: none;
    }

    /* ── Light variant — dark text on white bg (CRM modal) ── */
    &--light {
      border-color: rgba(2, 181, 187, 0.25);
      background-color: rgba(2, 181, 187, 0.04);
      color: #1e293b;
      backdrop-filter: none;

      &:hover:not(:disabled) {
        background-color: rgba(2, 181, 187, 0.10);
        border-color: rgba(2, 181, 187, 0.5);
        transform: translateY(-1px);
      }

      &:disabled {
        background-color: rgba(0, 0, 0, 0.03);
        color: rgba(0, 0, 0, 0.25);
        border-color: rgba(0, 0, 0, 0.08);
        pointer-events: none;
      }
    }
  }
</style>
