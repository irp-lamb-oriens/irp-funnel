<script lang="ts">
  import { writable } from "svelte/store";

  // Props for the plain text input.
  export let value: string = "";
  export let placeholder: string = "";
  export let inputElement: HTMLInputElement;
  export let label: string = "";
  export let type: "text" | "password" | "email" | "number" | "tel" | "url" = "text"; // Add type prop

  // Callback to be invoked when the input changes.
  export let onChange: (newValue: string) => void = () => {};
  export let onEnter: () => void = () => {};

  // Create a writable store for the plain text input value.
  export const textStore = writable(value);

  // Update the store as the user types, then call onChange.
  function handleInput(event: Event) {
    const target = event.target as HTMLInputElement;
    value = target.value;
    textStore.set(value);
    onChange(value);
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      onEnter();
    }
  }
</script>

<div class="text-input-wrapper">
  <label class="input-label">{value ? label || placeholder : label}</label>
  <input
    bind:this={inputElement}
    {type}
    bind:value
    {placeholder}
    on:input={handleInput}
    on:keydown={handleKeydown}
    aria-label={label}
    autocomplete={type === 'password' ? 'current-password' : undefined}
  />
</div>

<style lang="scss">
  .text-input-wrapper {
    display: flex;
    flex-direction: column;
    width: 100%;
  }

  .input-label {
    margin-bottom: 0.5rem;
    color: var(--color-foreground);
    font-size: 1rem;
  }

  input {
    background: #f5f5f5;
    backdrop-filter: blur(6px);
    border: none;
    box-shadow: 0 0 10px -7.5px black;
    border-radius: 8px;
    padding: 0.75rem 1rem;
    font-size: 1rem;
    color: black;
    transition:
      border 0.3s ease,
      box-shadow 0.3s ease;
    outline: none;
  }

  input::placeholder {
    color: var(--color-foreground-opaque);
  }

  input:focus {
    border-color: var(--color-foreground);
    box-shadow: 0 0 10px -2px var(--color-foreground);
  }
</style>
