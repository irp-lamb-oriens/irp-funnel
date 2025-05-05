<script lang="ts">
  import { writable } from "svelte/store";
  import { onMount, tick } from "svelte"; // Import tick

  // Import the parser and sentence generator
  import {
    parseNaturalLanguageToCron,
    isCronString,
  } from "./naturalCronParser.ts";
  import type {
    CronParseResult,
  } from "./naturalCronParser.ts";
  import cronToSentence from "./cronToNatural.ts"; // Assuming default export

  // --- Props ---
  export let value: string = ""; // Initial value (NL or Cron)
  export let placeholder: string = 'e.g., "every Mon at 9 AM" or "0 9 * * 1"';
  export let label: string = "Schedule Time";
  export let onChange: (input: string, cron: string) => void = () => {}; // Sends current INPUT text and DERIVED cron

  // --- Internal Component State ---
  // Remove internalInputValue store
  let derivedCron: string = ""; // Cron derived from input OR the initial value if it was cron
  let derivedNatural: string = ""; // Natural sentence derived from derivedCron
  let displayError: string = ""; // Parsing error message
  let isInitialValueCron = false; // Was the *prop* value initially cron?
  let hasMounted = false; // Prevent reactive updates before mount
  let debounceTimeout: ReturnType<typeof setTimeout> | null = null; // For debouncing input
  const DEBOUNCE_DELAY = 500; // milliseconds

  // Store for the last valid PAIR (input that resulted in valid cron)
  export const scheduleStore = writable<{ schedule: string; cron: string }>({
    schedule: "",
    cron: "",
  });

  // --- Lifecycle: Initialization ---
  onMount(async () => {
    console.log("MOUNT: Initial prop value:", value);
    isInitialValueCron = isCronString(value);
    // No need to set internalInputValue

    if (isInitialValueCron) {
      // Initial value IS a cron string
      derivedCron = value;
      derivedNatural = generateNaturalSentence(value); // Generate description
      displayError = "";
      // Store: Natural description as 'schedule' for consistency? Or keep it blank? Let's store description.
      scheduleStore.set({ schedule: derivedNatural, cron: derivedCron });
      // Report initial state via onChange if needed, or rely on parent's initial value
      // onChange(value, derivedCron); // Maybe not needed if parent already has the value
    } else {
      // Initial value is Natural Language (or empty)
      const result = parseNaturalLanguageToCron(value);
      handleParseResult(value, result, true); // isInitialCheck = true
      // If initial NL parsed successfully, report the derived cron
      if (result.success && result.cron) {
        onChange(value, result.cron);
      }
    }

    await tick(); // Wait for DOM update
    hasMounted = true;
    console.log(
      "MOUNT: Complete. Initial Input:",
      value, // Use value prop directly
      " Derived Cron:",
      derivedCron,
      "Derived Natural:",
      derivedNatural
    );
  });

  // --- Helper to generate natural sentence from cron ---
  function generateNaturalSentence(cronStr: string): string {
    if (!cronStr) return "";
    try {
      return cronToSentence(cronStr);
    } catch (e: any) {
      console.error("Error generating natural sentence from cron:", cronStr, e);
      // Don't set displayError here, as the primary error is for NL parsing
      return "[Could not generate description]";
    }
  }

  // --- Helper to handle NL parsing results ---
  function handleParseResult(
    inputValue: string,
    result: CronParseResult,
    isInitialCheck = false
  ) {
    console.log(
      `PARSE_RESULT: Input='${inputValue}', Success=${result.success}, Initial=${isInitialCheck}`
    );
    if (result.success) {
      derivedCron = result.cron ?? "";
      displayError = "";
      derivedNatural = generateNaturalSentence(derivedCron); // Update natural description

      if (derivedCron || !inputValue) {
        // Valid cron or empty input
        scheduleStore.set({ schedule: inputValue, cron: derivedCron });
        if (!isInitialCheck) {
          // Avoid duplicate onChange from mount if initial was NL
          onChange(inputValue, derivedCron);
        }
      } else {
        // Success was true, but cron is empty for non-empty input (should not happen often)
        if (!isInitialCheck) onChange(inputValue, "");
      }
    } else {
      // Parsing failed
      derivedCron = ""; // Clear derived values
      derivedNatural = "";
      displayError = result.error ?? "Unknown parsing error.";
      if (!isInitialCheck) {
        // Don't call onChange for initial NL parse failure (handled in mount)
        onChange(inputValue, "");
      }
      // Do not update scheduleStore on error
    }
    console.log(
      `PARSE_RESULT: Output - Cron='${derivedCron}', Natural='${derivedNatural}', Error='${displayError}'`
    );
  }

  // --- Reactive Updates: Triggered by prop changes (with Debounce) ---
  $: {
    // React to changes in the 'value' prop after mounting
    if (hasMounted) {
      const currentInput = value; // Use the prop directly
      console.log(`REACTIVE: 'value' prop changed to: '${currentInput}'`);

      // Clear previous timeout
      if (debounceTimeout) {
        clearTimeout(debounceTimeout);
      }

      // Set a new timeout to process the input after a delay
      debounceTimeout = setTimeout(() => {
        console.log(`DEBOUNCED: Processing input from prop: '${currentInput}'`);
        let newCron = "";
        let parseError = "";

        if (isCronString(currentInput)) {
          console.log("DEBOUNCED: Input is a cron string.");
          newCron = currentInput;
          parseError = "";
        } else {
          console.log("DEBOUNCED: Input is not cron, attempting NL parse.");
          const result = parseNaturalLanguageToCron(currentInput);
          if (result.success) {
            newCron = result.cron ?? "";
            parseError = "";
          } else {
            newCron = "";
            parseError = result.error ?? "Unknown parsing error.";
          }
        }

        // Update derived state only if cron actually changed
        if (newCron !== derivedCron || parseError !== displayError) {
          derivedCron = newCron;
          derivedNatural = generateNaturalSentence(derivedCron);
          displayError = parseError;
          scheduleStore.set({ schedule: currentInput, cron: derivedCron }); // Store current input + derived cron
          // Call onChange to notify parent of the *derived* cron string based on the input
          onChange(currentInput, derivedCron);
          console.log(`DEBOUNCED: Updated derivedCron='${derivedCron}', Error='${displayError}', called onChange.`);
        } else {
           console.log(`DEBOUNCED: No change in derivedCron or error, skipping state update and onChange.`);
        }

      }, DEBOUNCE_DELAY);
    }
  }
</script>

<template>
  <div class="schedule-input-wrapper">
    <label class="input-label">{label}</label>
    <div class="input-container">
      <input
        type="text"
        bind:value={value}
        {placeholder}
        class:error={displayError && value}
        aria-label={label}
        aria-invalid={!!displayError && !!value}
        aria-describedby="feedback-area"
      />
    </div>

    <!-- Feedback Area: Show Error OR Cron + Natural Description -->
    <div id="feedback-area" class="feedback-area">
       {#if displayError && value} <!-- Check error based on prop value -->
        <div class="output-feedback error">
          <span class="error-message">{displayError}</span>
        </div>
       {:else if derivedCron}
        <div class="output-feedback">
          <span class="cron-label">Cron:</span>
          <code class="cron-code">{derivedCron}</code>
        </div>
        {#if derivedNatural && derivedNatural !== "[Could not generate description]"}
          <div class="output-feedback natural-desc">
            {derivedNatural}
          </div>
        {/if}
       {:else if !value} <!-- Check based on prop value -->
        <!-- Optionally show placeholder text or nothing when input is empty -->
        <div class="output-feedback placeholder-feedback"></div>
        <!-- Reserve space -->
      {/if}
    </div>

    <div id="helper-text" class="helper-text">
      Try: "every 5 minutes", "at 3:30 PM", "0 9 * * MON", "noon", "every Monday
      at 9am".
    </div>
  </div>
</template>

<style lang="scss">
  // --- Base Variables ---
  :root {
    --color-foreground-opaque: #e0e0e09a;
    --color-background-input: #ffffff1a;
    --color-background-input-border: #ffffff33;
    --color-error: #ff6b6b;
    --color-code-bg: #0000004d;
    --color-natural-desc: #b0c4de; // LightSteelBlue for description
  }

  // --- Wrapper ---
  .schedule-input-wrapper {
    display: flex;
    flex-direction: column;
    width: 100%;
    margin: 1rem 0;
    font-family: sans-serif;
  }

  // --- Label ---
  .input-label {
    margin-bottom: 0.5rem;
    color: var(--color-foreground);
    font-size: 0.9rem;
    font-weight: 500;
    opacity: 0.9;
  }

  // --- Input Field ---
  .input-container {
    position: relative;
  }

  input {
    width: 100%;
    box-sizing: border-box;
    background: var(--color-background-input);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    border: 1px solid var(--color-background-input-border);
    border-radius: 8px;
    padding: 0.85rem 1rem;
    font-size: 1rem;
    color: var(--color-foreground);
    transition:
      border-color 0.3s ease,
      box-shadow 0.3s ease;
    outline: none;
    box-shadow: 0 0 0 1px transparent;

    &::placeholder {
      color: var(--color-foreground-opaque);
      opacity: 0.8;
    }
    &:focus {
      border-color: var(--color-foreground);
      box-shadow:
        0 0 0 1px var(--color-foreground),
        0 2px 8px -2px #00000033;
    }
    &.error {
      border-color: var(--color-error);
      box-shadow: 0 0 0 1px var(--color-error);
      &:focus {
        box-shadow:
          0 0 0 1px var(--color-error),
          0 2px 8px -2px #00000033;
      }
    }
  }

  // --- Feedback Area ---
  .feedback-area {
    margin-top: 0.75rem;
    min-height: 2.6em; // Reserve space for potentially two lines (cron + natural)
    display: flex;
    flex-direction: column;
    gap: 0.3rem; // Space between cron line and natural line
  }

  .output-feedback {
    font-size: 0.9rem;
    color: var(--color-foreground);
    opacity: 0.95; // Slightly more prominent than helper text

    &.error {
      color: var(--color-error);
    }
    &.placeholder-feedback {
      opacity: 0; // Hide the placeholder feedback visually but keep space
    }
  }

  .cron-label {
    font-weight: 500;
    margin-right: 0.4em;
  }

  .cron-code {
    background-color: var(--color-code-bg);
    padding: 0.2em 0.5em;
    border-radius: 4px;
    font-family: monospace;
  }

  .error-message {
    font-style: italic;
  }

  .natural-desc {
    font-size: 0.85rem; // Slightly smaller
    color: var(--color-natural-desc);
    font-style: italic;
    line-height: 1.3;
  }

  // --- Helper Text ---
  .helper-text {
    margin-top: 0.6rem;
    font-size: 0.8rem;
    color: var(--color-foreground-opaque);
    line-height: 1.4;
  }
</style>
