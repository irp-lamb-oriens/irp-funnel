<script lang="ts">
  import { writable } from "svelte/store";

  // Props for the custom radio button.
  export let selected: boolean = false; // (Not directly used; store drives state)
  export let label: string = "";
  export let value: string | number = "";
  export let name: string = "";

  // Callback to be invoked when this radio button is activated.
  export let onChange: (newValue: string | number) => void = () => {};

  // Create a writable store for the radio group selection.
  // When multiple radio buttons import this store, they share the same selected value.
  export const selectedRadioStore = writable<string | number | null>(null);

  // When this radio button is activated, update the store with its value and call onChange.
  function handleClick() {
    selectedRadioStore.set(value);
    onChange(value);
  }
</script>

<button
  type="button"
  class="glass-radio"
  on:click={handleClick}
  role="radio"
  tabindex="0"
  aria-checked={$selectedRadioStore === value}
  on:keydown={(event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleClick();
    }
  }}
>
  <div class="radio-button">
    {#if $selectedRadioStore === value}
      <div class="radio-inner"></div>
    {/if}
  </div>
  {#if label}
    <span class="radio-label">{label}</span>
  {/if}
</button>

<style lang="scss">
  .glass-radio {
    display: inline-flex;
    
    cursor: pointer;
    user-select: none;
    border: none;
    background: transparent;
    padding: 0;
    outline: none;
  }

  .radio-button {
    width: 24px;
    height: 24px;
    border: 2px solid var(--color-background);
    background: var(--color-background-opaque);
    backdrop-filter: blur(6px);
    border-radius: 50%;
    display: flex;
    justify-content: center;
    
    margin-right: 8px;
    transition:
      border-color 0.3s ease,
      background 0.3s ease;

    &:hover {
      border-color: var(--color-foreground);
    }
  }

  .radio-inner {
    width: 12px;
    height: 12px;
    background: var(--color-foreground);
    border-radius: 50%;
    animation: radioPulse 0.3s ease-out;
  }

  .radio-label {
    font-size: 1rem;
    color: var(--color-foreground);
    transition: color 0.3s ease;
  }

  @keyframes radioPulse {
    0% {
      transform: scale(0.5);
      opacity: 0;
    }
    100% {
      transform: scale(1);
      opacity: 1;
    }
  }
</style>
