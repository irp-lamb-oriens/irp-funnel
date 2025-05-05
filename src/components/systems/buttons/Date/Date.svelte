<script lang="ts">
  import { writable } from "svelte/store";

  // Props for the date input.
  export let value: string = "";
  export let placeholder: string = ""; // Note: some browsers may not show placeholder for type="date"
  export let label: string = "";

  // Callback to be invoked when the input changes.
  export let onChange: (newValue: string) => void = () => {};
  // Callback to be invoked when Enter is pressed.
  export let onEnter: (isValid: boolean) => void = () => {};

  // Create a writable store for the date input value.
  export const dateStore = writable(value);

  // Track validation state.
  let valid = true;

  // Checks if the string is a valid date.
  function isValidDate(str: string): boolean {
    if (str === "") return true;
    const timestamp = Date.parse(str);
    return !isNaN(timestamp);
  }

  // Validate date on input, update the store, and call the onChange callback.
  function handleInput(event: Event) {
    const target = event.target as HTMLInputElement;
    value = target.value?.trim();

    // Consider an empty string as valid.
    valid = value === "" || isValidDate(value);

    dateStore.set(value);
    onChange(value);
  }

  // If Enter is pressed, call onEnter with the current validity state.
  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === "Enter") {
      // Prevent default if needed (e.g., within a form)
      // event.preventDefault();
      onEnter(valid);
    }
  }
</script>

<div class="date-input-wrapper">
  <label class="input-label" for="date-input">{label}</label>
  <input
    id="date-input"
    type="date"
    bind:value
    {placeholder}
    on:input={handleInput}
    on:keydown={handleKeyDown}
    aria-label={label}
    class:invalid={!valid && value !== ""}
  />
  {#if !valid && value !== ""}
    <span class="error-message">Please enter a valid date.</span>
  {/if}
</div>

<style lang="scss">
  .date-input-wrapper {
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
    border-color: var(--color-danger);
    box-shadow: 0 0 10px -2px var(--color-danger);
  }

  .error-message {
    margin-top: 0.25rem;
    font-size: 0.875rem;
    color: var(--color-danger);
  }
</style>
