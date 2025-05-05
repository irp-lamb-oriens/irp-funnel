<script lang="ts">
  import { onMount } from "svelte";
  import { writable } from "svelte/store";

  // Props for the URL input.
  export let value: string = "";
  export let placeholder: string = "Enter your URL...";
  export let label: string = "";
  export let center: boolean = false;

  // Callback to be invoked when the input changes.
  export let onChange: (newValue: string) => void = () => {};
  export let onEnter: (isValid: boolean) => void = () => {};

  // Create a writable store for the URL input value.
  export const urlStore = writable(value);

  // Track validation state.
  let valid = false;

  function isValidURL(str: string): boolean {
    try {
      const url = new URL(str);

      // Allow only HTTP and HTTPS protocols.
      if (!["http:", "https:"].includes(url.protocol)) {
        return false;
      }

      // Ensure hostname is present.
      if (!url.hostname) {
        return false;
      }

      // Validate hostname structure with a regular expression.
      // This regex checks for valid domain characters and at least one dot,
      // ensuring the TLD is at least two letters.
      const hostnameRegex = /^(?!:\/\/)([a-zA-Z0-9-_]{1,63}\.)+[a-zA-Z]{2,}$/;
      // For IPv4 addresses, use a simple check.
      const ipv4Regex =
        /^(25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)){3}$/;
      if (!hostnameRegex.test(url.hostname) && !ipv4Regex.test(url.hostname)) {
        return false;
      }

      // Validate port (if specified) is within the valid range.
      if (url.port) {
        const port = Number(url.port);
        if (isNaN(port) || port < 1 || port > 65535) {
          return false;
        }
      }

      // Optional: Further validation for the URL path.
      // This basic regex ensures that the pathname contains only allowed characters.
      if (
        url.pathname &&
        !/^\/[a-zA-Z0-9\-._~%!$&'()*+,;=\/]*$/.test(url.pathname)
      ) {
        return false;
      }

      // Optional: Validate search parameters.
      // Ensure that query keys and values only contain allowed characters.
      // Allowed characters: alphanumerics and -._~%!$&'()*+,;=
      if (url.search) {
        const queryParamRegex = /^[a-zA-Z0-9\-._~%!$&'()*+,;=]*$/;
        for (const [key, value] of url.searchParams) {
          if (!queryParamRegex.test(key) || !queryParamRegex.test(value)) {
            return false;
          }
        }
      }

      return true;
    } catch {
      return false;
    }
  }

  // Validate URL on input, update the store, and call the onChange callback.
  function handleInput(event: Event | null, newValue?: string) {
    const target = event?.target as HTMLInputElement;
    value = target?.value?.trim?.() || (newValue as string);

    // If not empty and doesn't start with http:// or https://, prepend "https://"
    if (value?.trim() === "https:/") {
      value = "https://";
    }
    if (value !== "" && !/^https?:\/\//i.test(value)) {
      value = "https://" + (value || "");
    }

    // Consider an empty string as valid.
    valid = value === "" || isValidURL(value);

    if (target) target.value = value; // Update the input's displayed value

    urlStore.set(value);

    onChange(value);
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
    urlStore.set(value);
    handleInput(null, value);
  });
</script>

<div class="url-input-wrapper">
  <label class="input-label">{value ? label || placeholder : label}</label>
  <input
    type="url"
    bind:value
    {placeholder}
    on:input={handleInput}
    on:keydown={handleKeyDown}
    aria-label={label}
    class:invalid={!valid && value !== ""}
    class:center
  />
  {#if !valid && value !== ""}
    <span class="error-message">Please enter a valid URL.</span>
  {/if}
</div>

<style lang="scss">
  .url-input-wrapper {
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

    &.center {
      text-align: center;
    }
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
