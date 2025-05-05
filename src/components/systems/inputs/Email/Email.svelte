<script lang="ts">
  import { onMount } from "svelte";
  import { writable } from "svelte/store";

  // Props for the email input.
  export let value: string = "";
  export let placeholder: string = "Enter your email...";
  export let label: string = "";
  export let onEnter: (isValid: boolean) => void = () => {};

  // Callback to be invoked when the input changes.
  export let onChange: (newValue: string) => void = () => {};

  // Create a writable store for the email input value.
  export const emailStore = writable(value);

  // Track validation state.
  let valid = false;

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
      onEnter(valid);
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
    background: var(--color-background-very-opaque);
    backdrop-filter: blur(6px);
    border: 1px solid var(--color-background);
    border-radius: 8px;
    padding: 0.75rem 1rem;
    font-size: 1rem;
    color: var(--color-foreground);
    transition:
      border 0.3s ease,
      box-shadow 0.3s ease;
    outline: none;
    text-align: center;
  }

  input::placeholder {
    color: var(--color-foreground-opaque);
  }

  input:focus {
    border-color: var(--color-foreground);
    box-shadow: 0 0 10px -2px var(--color-foreground);
  }

  input.invalid {
    border-color: red;
    box-shadow: 0 0 10px -2px red;
  }

  .error-message {
    margin-top: 0.25rem;
    font-size: 0.875rem;
    color: red;
  }
</style>
