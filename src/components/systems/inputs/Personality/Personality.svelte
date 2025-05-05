<!-- src/components/systems/inputs/PersonalityField.svelte -->
<script lang="ts">
  import { slide } from "svelte/transition";
  import { generatePersonality } from "../../requests/generatePersonality.ts"; // Change back to .ts
  import { latestMessage } from "../../../store.ts"; // Change back to .ts
  import { writable } from "svelte/store";
  import SubmitButton from "../../buttons/SubmitButton/SubmitButton.svelte";

  // --- Props ---
  export let personality: string = "";
  export let newsSourceId: string;
  export let onChange: (value: string) => void = () => {};
  export let onError: (message: string) => void = () => {};

  // --- State ---
  let isGenerating = writable(false);
  let generationError = writable<string | null>(null);
  let currentContent: string = ""; // Initialize as empty string
  const placeholderText = "Input or generate a personality description...";

  // --- Reactivity ---
  // Ensure currentContent reflects the prop, defaulting null/undefined to empty string
  $: currentContent = personality ?? "";

  // --- Functions ---
  function handleInput(event: Event) {
    const target = event.target as HTMLTextAreaElement;
    currentContent = target.value;
    onChange(currentContent);
  }

  async function handleGeneratePersonality() {
    isGenerating.set(true);
    generationError.set(null);
    latestMessage.set("Generating personality...");

    try {
      const result = await generatePersonality(currentContent, newsSourceId);
      onChange(result.personality); // Update parent, which updates prop, which updates textarea
      latestMessage.set("Personality generated successfully!");
    } catch (error: any) {
      const message =
        error?.message || "An unknown error occurred during generation.";
      generationError.set(message);
      onError(message);
      latestMessage.set("");
    } finally {
      isGenerating.set(false);
    }
  }
</script>

<div class="personality-field">
  <!-- Loading Indicator -->
  {#if $isGenerating}
    <div class="status-message loading" transition:slide|local>
      {$latestMessage || "Generating..."}
    </div>
  {/if}

  <!-- Error Indicator -->
  {#if $generationError}
    <div class="status-message error" transition:slide|local>
      Error: {$generationError}
    </div>
  {/if}

  <!-- Label (only visible when textarea has content) -->
  {#if currentContent}
    <label class="textarea-label">
      {placeholderText}
    </label>
  {/if}

  <!-- Textarea Container (Optional - could be removed if no border needed) -->
  <div class="textarea-wrapper">
    <textarea
      class="personality-textarea"
      bind:value={currentContent}
      on:input={handleInput}
      placeholder={!currentContent ? placeholderText : ""}
      aria-label="Personality Description"
      rows="5"
      disabled={$isGenerating}
    ></textarea>
  </div>

  <!-- Generate Button -->
  <div class="generate-button-container">
    <SubmitButton
      label="Generate Personality"
      callback={handleGeneratePersonality}
      disabled={$isGenerating}
    />
  </div>
</div>

<style lang="scss">
  .personality-field {
    display: flex;
    flex-direction: column;
    gap: 0.5rem; // Adjust gap between label, textarea, button
  }

  .textarea-label {
    display: block; // Ensure it takes its own line
    font-size: 0.85rem; // Slightly smaller than main text
    color: var(--color-foreground-muted, #aaa);
    margin-bottom: 0.25rem; // Space between label and textarea
    padding-left: 0.1rem; // Slight indent to align roughly with textarea padding
  }

  // Wrapper only needed if you want a border/background around JUST the textarea
  .textarea-wrapper {
    border: 1px solid var(--color-border, rgba(255, 255, 255, 0.3));
    border-radius: 8px;
    background: var(--color-input-background, rgba(255, 255, 255, 0.1));
    transition: border-color 0.3s ease;
    display: flex; // To contain the textarea properly

    &:focus-within {
      border-color: var(--color-accent, #007bff);
    }
  }

  .personality-textarea {
    flex-grow: 1;
    width: 100%;
    padding: 0.75rem;
    font-size: 1rem;
    font-family: inherit;
    background: transparent; // Make background transparent if using wrapper bg
    border: none; // Border is on the wrapper now (if used)
    // Alternatively, if NOT using wrapper, add border/bg here:
    // border: 1px solid var(--color-border, rgba(255, 255, 255, 0.3));
    // border-radius: 8px;
    // background: var(--color-input-background, rgba(255, 255, 255, 0.1));

    color: var(--color-foreground, #eee);
    resize: vertical;
    min-height: 80px;
    outline: none;

    &::placeholder {
      color: var(--color-foreground-muted, #888);
      opacity: 1;
    }

    &:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
  }

  .generate-button-container {
    display: flex;
    justify-content: flex-end;
    margin-top: 0.5rem; // Add some space above the button
  }

  .status-message {
    padding: 0.5rem 0.75rem;
    border-radius: 4px;
    font-size: 0.9rem;
    margin-bottom: 0.5rem;

    &.loading {
      background-color: var(--color-info-background, rgba(0, 123, 255, 0.2));
      color: var(--color-info-text, #60a5fa);
      border: 1px solid var(--color-info-border, rgba(0, 123, 255, 0.4));
    }

    &.error {
      background-color: var(--color-error-background, rgba(220, 53, 69, 0.2));
      color: var(--color-error-text, #f87171);
      border: 1px solid var(--color-error-border, rgba(220, 53, 69, 0.4));
    }
  }

  :global(.submit-button) {
    // Specific styles if needed
  }
</style>
