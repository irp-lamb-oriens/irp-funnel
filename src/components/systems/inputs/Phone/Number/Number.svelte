<script lang="ts">
  import { writable } from "svelte/store";

  // Props for the number input.
  export let value: string = "";
  export let placeholder: string = "";
  export let label: string = "";
  export let ariaDescribedby: string = "";

  // Callback to be invoked when the input changes.
  export let onChange: (newValue: string) => void = () => {};
  // Callback to be invoked when Enter is pressed.
  export let onEnter: () => void = () => {};
  // Callback to be invoked when the input is focused.
  export let onFocus: () => void = () => {};
  // Callback to be invoked when the input is blurred.
  export let onBlur: () => void = () => {};

  // Create a writable store for the number input value.
  export const numberStore = writable(value);

  // Track validation state.
  let valid = false;

  // Checks if the string is a valid number.
  function isValidNumber(str: string): boolean {
    // Consider empty string as valid for now (optional)
    if (str === "") return true;
    // Check for a valid numeric pattern (supports optional minus and decimals)
    const regex = /^-?\d*(\.\d+)?$/;
    return regex.test(str) && !isNaN(parseFloat(str));
  }

  // Validate number on input, update the store, and call the onChange callback.
  function handleInput(event: Event) {
    const target = event.target as HTMLInputElement;
    value = target.value.trim();

    // Ensure that only valid number characters are allowed.
    // If the value doesn't match our numeric regex, simply return early.
    const regex = /^-?\d*(\.\d+)?$/;
    if (!regex.test(value)) {
      // If invalid, reset the input to the previous valid value.
      target.value = value.slice(0, -1);
      return;
    }

    // Update validity flag.
    valid = value === "" || isValidNumber(value);

    // Update store and call the change callback.
    numberStore.set(value);
    onChange(value);
  }

  // If Enter is pressed, call onEnter with the current validity state.
  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === "Enter") {
      // Uncomment the following line to prevent default form submission if needed:
      // event.preventDefault();
      onEnter();
    }
  }
</script>

<div class="number-input-wrapper">
  <label class="input-label" for="number-input">{label}</label>
  <input
    id="number-input"
    type="number"
    bind:value
    {placeholder}
    on:input={handleInput}
    on:keydown={handleKeyDown}
    on:focus={onFocus}
    on:blur={onBlur}
    aria-label={label}
    aria-describedby={ariaDescribedby}
    class:invalid={!valid && value !== ""}
  />
  {#if !valid && value !== ""}
    <span class="error-message">Please enter a valid number.</span>
  {/if}
</div>

<style lang="scss">
  .number-input-wrapper {
    display: flex;
    flex-direction: column;
    width: 100%;
  }

  .input-label {
    margin-bottom: 0.75rem;
    color: rgba(255, 255, 255, 0.9);
    font-size: 0.9rem;
    font-weight: 500;
    letter-spacing: 0.02em;
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
