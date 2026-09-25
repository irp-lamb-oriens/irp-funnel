<script lang="ts">
  import { writable } from "svelte/store";

  // Props for the plain text input.
  export let value: string = "";
  export let placeholder: string = "";
  export let inputElement: HTMLInputElement | undefined = undefined;
  export let label: string = "";
  /** Optional clarification text rendered below the label (e.g. "Include state or province"). */
  export let hint: string = "";
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
  {#if hint}<span class="input-hint">{hint}</span>{/if}
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
    margin-bottom: 0.35rem;
    color: rgba(255, 255, 255, 0.9);
    font-size: 0.9rem;
    font-weight: 500;
    letter-spacing: 0.02em;
  }

  .input-hint {
    display: block;
    margin-bottom: 0.6rem;
    color: rgba(255, 255, 255, 0.5);
    font-size: 0.78rem;
    letter-spacing: 0.02em;
    line-height: 1.4;
  }

  input {
    background: rgba(255, 255, 255, 0.05);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 1rem;
    padding: 1rem 1.25rem;
    font-size: 1.1rem;
    color: #ffffff;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    outline: none;
    width: 100%;

    &::placeholder {
      color: rgba(255, 255, 255, 0.3);
    }

    &:focus {
      background: rgba(255, 255, 255, 0.08);
      border-color: var(--color-highlight-2);
      box-shadow: 0 0 0 4px rgba(var(--color-highlight-2-rgb), 0.15);
      transform: translateY(-1px);
    }

    &:hover:not(:focus) {
      background: rgba(255, 255, 255, 0.07);
      border-color: rgba(255, 255, 255, 0.2);
    }
  }
</style>
