<script lang="ts">
  import { writable } from "svelte/store";

  // Props for the custom checkbox component.
  export let checked: boolean = false;
  export let label: string = "";

  // Callback to be invoked when the checkbox state changes.
  export let onChange: (newValue: boolean) => void = () => {};

  // Create a writable store for the checkbox state.
  // Other components can subscribe to this store for updates.
  export const checkboxStore = writable<boolean>(checked);

  // Toggle the checkbox state, update the store, and call onChange.
  function toggle() {
    checked = !checked;
    checkboxStore.set(checked);
    onChange(checked);
  }

  // Allow toggling via keyboard (Enter or Space).
  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      toggle();
    }
  }
</script>

<div
  class="glass-checkbox"
  role="checkbox"
  tabindex="0"
  aria-checked={checked}
  on:click={toggle}
  on:keydown={handleKeyDown}
>
  <div class="checkbox-box">
    {#if checked}
      <!-- Custom checkmark SVG appears when checked -->
      <svg class="checkmark" viewBox="0 0 24 24">
        <path d="M20 6L9 17l-5-5" />
      </svg>
    {/if}
  </div>
  {#if label}
    <span class="checkbox-label">{label}</span>
  {/if}
</div>

<style lang="scss">
  .glass-checkbox {
    display: inline-flex;
    
    cursor: pointer;
    user-select: none;
    outline: none; /* Remove default focus outline; consider adding a custom focus style */

    &:focus {
      box-shadow: 0 0 0 3px var(--color-foreground);
    }

    .checkbox-box {
      width: 24px;
      height: 24px;
      background: var(--color-background-opaque);
      backdrop-filter: blur(6px);
      border: 2px solid var(--color-background);
      border-radius: 4px;
      display: flex;
      justify-content: center;
      
      transition:
        background 0.3s ease,
        border-color 0.3s ease;

      &:hover {
        background: var(--color-background-very-opaque);
      }

      .checkmark {
        width: 16px;
        height: 16px;
        stroke: var(--color-foreground);
        stroke-width: 3;
        fill: none;
        opacity: 0;
        animation: fadeIn 0.3s forwards;
      }
    }

    .checkbox-label {
      margin-left: 8px;
      font-size: 1rem;
      color: var(--color-foreground);
      transition: color 0.3s ease;
    }
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: scale(0.5);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }
</style>
