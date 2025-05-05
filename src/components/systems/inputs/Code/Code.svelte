<script lang="ts">
  import { writable } from "svelte/store";

  // Number of digits in the auth code (default: 6)
  export let length: number = 6;

  // Callback to be invoked when the auth code changes.
  export let onChange: (newCode: string) => void = () => {};

  // Writable store that holds the current auth code as a string.
  // Parent components can subscribe to this store.
  export const authCode = writable("");

  // Array to hold each digit (initially empty)
  let digits: string[] = Array(length).fill("");

  // Array to store input element references.
  let inputRefs: HTMLInputElement[] = [];

  // Svelte action to register each input element in the array.
  function registerInput(node: HTMLInputElement, index: number) {
    inputRefs[index] = node;
    return {
      update(newIndex: number) {
        // Update the index if it changes.
        inputRefs[newIndex] = node;
      },
    };
  }

  // If the user pastes all N digits into any single input,
  // fill them all out in one go.
  function handlePaste(event: ClipboardEvent) {
    event.preventDefault();
    console.log("pasted", event.clipboardData?.getData("text"));
    const pasteData = event.clipboardData?.getData("text") ?? "";

    // Check if the pasted string is exactly the full length and all digits:
    if (pasteData.trim().length === length && /^\d+$/.test(pasteData.trim())) {
      digits = pasteData.replace(/[^0-9]/g, "").split("");
      // Update each input field
      digits.forEach((digit, i) => {
        inputRefs[i].value = digit;
      });
      // Update the store and callback
      authCode.set(pasteData);
      onChange(pasteData);
    }
  }

  // Handle input: accept only a single digit and focus the next input.
  function handleInput(index: number, event: Event) {
    const target = event.target as HTMLInputElement;
    const value = target.value;

    // Allow only a single digit (0-9)
    if (!/^\d?$/.test(value)) {
      target.value = "";
      return;
    }
    digits[index] = value;

    // Auto-focus next field if this one is filled
    if (value && index < length - 1) {
      inputRefs[index + 1]?.focus();
    }

    // Update the store with the current code value
    const code = digits.join("");

    if (/^\d{6}$/.test(code)) {
      console.log("we got here");
      authCode.set(code);

      return onChange(code);
    }

    authCode.set("");

    return onChange("");
  }

  // Handle backspace: if empty, move focus to previous input.
  function handleKeyDown(index: number, event: KeyboardEvent) {
    const target = event.target as HTMLInputElement;

    if (event.key === "Backspace" && !target.value && index > 0) {
      inputRefs[index - 1]?.focus();
    }

    if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      if (index > 0) {
        inputRefs[index - 1]?.focus();
      }
    }

    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      if (index < length - 1) {
        inputRefs[index + 1]?.focus();
      }
    }
  }
</script>

<div class="auth-code-input">
  {#each Array(length) as _, index}
    <input
      type="text"
      inputmode="numeric"
      maxlength="1"
      use:registerInput={index}
      value={digits[index]}
      on:paste={handlePaste}
      on:input={(e) => handleInput(index, e)}
      on:keydown={(e) => handleKeyDown(index, e)}
      autocomplete="one-time-code"
      aria-label="Authentication code digit {index + 1}"
    />
  {/each}
</div>

<style lang="scss">
  .auth-code-input {
    display: flex;
    justify-content: center;
    gap: 0.5rem;
    margin: 1rem 0;
  }

  .auth-code-input input {
    width: 3rem;
    height: 3rem;
    background: var(--color-background-very-opaque);
    backdrop-filter: blur(6px);
    border: 1px solid var(--color-background);
    border-radius: 8px;
    text-align: center;
    font-size: 1.5rem;
    color: var(--color-foreground);
    transition:
      border-color 0.3s ease,
      box-shadow 0.3s ease;
    outline: none;
  }

  .auth-code-input input::placeholder {
    color: var(--color-foreground-opaque);
  }

  .auth-code-input input:focus {
    border-color: var(--color-foreground);
    box-shadow: 0 0 10px -2px var(--color-foreground);
  }
</style>
