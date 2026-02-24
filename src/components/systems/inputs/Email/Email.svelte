<script lang="ts">
  import { onMount } from "svelte";
  import { writable } from "svelte/store";

  // Props for the email input.
  export let value: string = "";
  export let placeholder: string = "Enter your email...";
  export let inputElement: HTMLInputElement;
  export let label: string = "";
  export let onEnter: () => void = () => {};

  // Callback to be invoked when the input changes.
  export let onChange: (newValue: string) => void = () => {};

  // Create a writable store for the email input value.
  export const emailStore = writable(value);

  // Track validation state.
  export let valid = false;

  // Validate email format on input, update the store, and call onChange.
  function handleInput(event: Event | null, newValue?: string) {
    const target = event?.target as HTMLInputElement;
    value = target?.value?.trim?.() || (newValue as string);
    valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    emailStore.set(value);

    // Call onChange with empty string if invalid or empty, otherwise with the value
    onChange(valid ? value : "");
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === "Enter") {
      // If you want to prevent the default form submission (if inside a <form>), uncomment:
      // event.preventDefault();
      onEnter();
    }
  }

  onMount(() => {
    // Initialize the store with the initial value.
    emailStore.set(value);
    handleInput(null, value);
  });
</script>

<div class="email-input-wrapper">
  <label class="input-label"
    >{value ? label || placeholder : label}</label
  >
  <input
    bind:this={inputElement}
    type="email"
    bind:value
    {placeholder}
    on:input={handleInput}
    on:keydown={handleKeyDown}
    aria-label={label}
    class:invalid={!valid && value !== ""}
  />
  {#if !valid && value !== ""}
    <span class="error-message">Please enter a valid email.</span>
  {/if}
</div>

<style lang="scss">
  .email-input-wrapper {
    display: flex;
    flex-direction: column;
    width: 100%;
    gap: .5rem;
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
    text-align: center;
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

    &.invalid {
      border-color: #ef4444;
      box-shadow: 0 0 0 4px rgba(239, 68, 68, 0.15);
    }
  }

  .error-message {
    margin-top: 0.25rem;
    font-size: 0.85rem;
    color: #ef4444;
    font-weight: 500;
  }
</style>
