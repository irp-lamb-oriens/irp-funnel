<!-- LanguageSelect.svelte -->
<script lang="ts">
  import { onMount, onDestroy, tick } from "svelte";
  import { writable } from "svelte/store";
  import fuzzysort from "fuzzysort";

  // Assuming languages.ts is in the same directory or adjust path
  import languagesData from "./languages.ts"; // Import the language list

  // Define the Language type (or import it if defined elsewhere)
  interface Language {
    code: string;
    name: string;
    flag: string | null; // Flag can be null
  }

  // Use the imported data
  const languages: Language[] = languagesData;

  // --- Props ---
  export let defaultLanguageCode: string | null = null;
  export let label = "Language"; // Default label
  export let onSelect: (selectedCode: string | null) => void = () => {};

  // --- State ---
  let selectedLanguage: Language | null = null;
  export const selectedLanguageStore = writable<Language | null>(null);

  let open = false;
  let dropdownRef: HTMLElement;
  let buttonRef: HTMLButtonElement;
  let listRef: HTMLUListElement;
  let listItems: Array<HTMLLIElement | null> = [];

  // --- Typeahead & Highlighting ---
  let typeahead = "";
  let typeaheadTimeout: number;
  let searchDebounceTimeout: number;
  const TYPEAHEAD_RESET_DELAY = 1200;
  const SEARCH_DEBOUNCE_DELAY = 150;

  let highlightedIndex: number = -1;
  let lastValidHighlightedIndex: number = -1;

  // --- Lifecycle ---
  onMount(() => {
    const initialLanguage = defaultLanguageCode
      ? findLanguageByCode(defaultLanguageCode)
      : null;
    if (initialLanguage) {
      selectedLanguage = initialLanguage;
      selectedLanguageStore.set(initialLanguage);
      lastValidHighlightedIndex = findIndexByCode(initialLanguage.code);
    } else {
      selectedLanguageStore.set(null);
      lastValidHighlightedIndex = 0;
    }

    document.addEventListener("click", handleClickOutside);
    listItems = new Array(languages.length).fill(null);
  });

  onDestroy(() => {
    document.removeEventListener("click", handleClickOutside);
    clearTimeout(typeaheadTimeout);
    clearTimeout(searchDebounceTimeout);
  });

  // --- Utility ---
  function findLanguageByCode(code: string): Language | null {
    return languages.find((language) => language.code === code) || null;
  }

  function findIndexByCode(code: string): number {
    return languages.findIndex((language) => language.code === code);
  }

  // --- Event Handlers ---
  function toggleOpen() {
    open = !open;
    if (open) {
      typeahead = "";
      highlightedIndex = selectedLanguage
        ? findIndexByCode(selectedLanguage.code)
        : lastValidHighlightedIndex !== -1
          ? lastValidHighlightedIndex
          : 0;

      tick().then(() => {
        focusAndScrollToHighlightedItem();
      });
    } else {
      buttonRef?.focus();
    }
  }

  function selectLanguage(language: Language) {
    selectedLanguage = language;
    selectedLanguageStore.set(language);
    lastValidHighlightedIndex = findIndexByCode(language.code);
    open = false;
    typeahead = "";
    highlightedIndex = -1;
    onSelect(language.code);
    buttonRef?.focus();
  }

  function handleClickOutside(event: MouseEvent) {
    if (open && dropdownRef && !dropdownRef.contains(event.target as Node)) {
      open = false;
      typeahead = "";
      buttonRef?.focus();
    }
  }

  function focusAndScrollToHighlightedItem() {
    if (highlightedIndex >= 0 && highlightedIndex < listItems.length) {
      const targetItem = listItems[highlightedIndex];
      if (targetItem) {
        // targetItem.focus(); // Focusing list items directly can be jerky with scroll; highlighting is often enough
        targetItem.scrollIntoView({ block: "nearest" });
      }
    }
  }

  // --- Keyboard Navigation & Smart Search ---
  async function handleKeydown(event: KeyboardEvent) {
    // --- 1. Handle Navigation Keys When Open ---
    if (open) {
      switch (event.key) {
        case "ArrowDown":
          event.preventDefault();
          highlightedIndex = (highlightedIndex + 1) % languages.length;
          lastValidHighlightedIndex = highlightedIndex;
          focusAndScrollToHighlightedItem();
          return;

        case "ArrowUp":
          event.preventDefault();
          highlightedIndex =
            (highlightedIndex - 1 + languages.length) % languages.length;
          lastValidHighlightedIndex = highlightedIndex;
          focusAndScrollToHighlightedItem();
          return;

        case "Home":
          event.preventDefault();
          highlightedIndex = 0;
          lastValidHighlightedIndex = highlightedIndex;
          focusAndScrollToHighlightedItem();
          return;

        case "End":
          event.preventDefault();
          highlightedIndex = languages.length - 1;
          lastValidHighlightedIndex = highlightedIndex;
          focusAndScrollToHighlightedItem();
          return;

        case "Enter":
        case " ": // Space selects too
          if (highlightedIndex !== -1 && highlightedIndex < languages.length) {
            // Check bounds
            event.preventDefault();
            selectLanguage(languages[highlightedIndex]);
          }
          return;

        case "Escape":
          event.preventDefault();
          open = false;
          typeahead = "";
          buttonRef?.focus();
          return;

        case "Tab":
          open = false;
          typeahead = "";
          return;
      }
    } else {
      // --- Open dropdown on ArrowDown/Up/Enter/Space if closed ---
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) {
        event.preventDefault();
        toggleOpen();
        return;
      }
    }

    // --- 2. Handle Typeahead Input (Printable Chars & Backspace) ---
    let isTypeaheadKey = false;
    if (event.key === "Backspace") {
      if (typeahead.length > 0) {
        typeahead = typeahead.slice(0, -1);
        isTypeaheadKey = true;
      } else {
        return;
      }
      event.preventDefault();
    } else if (
      event.key.length === 1 &&
      !event.altKey &&
      !event.ctrlKey &&
      !event.metaKey
    ) {
      typeahead += event.key.toLowerCase(); // Often better to search lowercase
      isTypeaheadKey = true;
      event.preventDefault();
    }

    if (!isTypeaheadKey) {
      return;
    }

    // --- 3. Perform Smart Search ---
    if (!open) {
      open = true;
      await tick();
    }

    clearTimeout(typeaheadTimeout);
    typeaheadTimeout = window.setTimeout(() => {
      typeahead = "";
    }, TYPEAHEAD_RESET_DELAY);

    clearTimeout(searchDebounceTimeout);
    searchDebounceTimeout = window.setTimeout(() => {
      if (typeahead === "") {
        highlightedIndex =
          lastValidHighlightedIndex !== -1
            ? lastValidHighlightedIndex
            : selectedLanguage
              ? findIndexByCode(selectedLanguage.code)
              : 0;
        focusAndScrollToHighlightedItem();
        return;
      }

      const searchResults = fuzzysort.go(typeahead, languages, {
        keys: ["name", "code"],
        threshold: -10000,
        limit: 50,
      });

      if (searchResults.length > 0) {
        const bestMatch = searchResults[0].obj;
        const bestMatchIndex = languages.findIndex(
          (l) => l.code === bestMatch.code
        );

        if (bestMatchIndex !== -1) {
          highlightedIndex = bestMatchIndex;
          lastValidHighlightedIndex = highlightedIndex;
          focusAndScrollToHighlightedItem();
        } else {
          highlightedIndex = lastValidHighlightedIndex;
          focusAndScrollToHighlightedItem();
        }
      } else {
        highlightedIndex = lastValidHighlightedIndex;
        focusAndScrollToHighlightedItem();
      }
    }, SEARCH_DEBOUNCE_DELAY);
  }
</script>

<div
  class="dropdown"
  bind:this={dropdownRef}
  on:keydown={handleKeydown}
  role="combobox"
  aria-haspopup="listbox"
  aria-expanded={open}
  aria-owns={open ? "language-listbox" : undefined}
>
  {#if label}
    <!-- Associate label with button using aria-labelledby if button had an id -->
    <span class="label" id="language-select-label">{label}</span>
  {/if}

  <button
    type="button"
    class="dropdown-toggle"
    bind:this={buttonRef}
    on:click={toggleOpen}
    aria-controls={open ? "language-listbox" : undefined}
    aria-autocomplete="list"
    aria-labelledby="language-select-label {selectedLanguage
      ? 'selected-language-label'
      : ''}"
  >
    {#if selectedLanguage}
      <span id="selected-language-label" class="selected-value-wrapper">
        {#if selectedLanguage.flag}<span
            class="language-flag"
            aria-hidden="true">{selectedLanguage.flag}</span
          >{/if}
        <span class="language-name">{selectedLanguage.name}</span>
        <span class="language-code">({selectedLanguage.code})</span>
      </span>
    {:else}
      <span class="placeholder">Select a language</span>
    {/if}
    <svg
      class="arrow {open ? 'open' : ''}"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M7 10l5 5 5-5z" />
    </svg>
  </button>

  {#if open}
    <ul
      class="dropdown-menu"
      bind:this={listRef}
      role="listbox"
      id="language-listbox"
      aria-labelledby="language-select-label"
      tabindex="-1"
    >
      {#each languages as language, index (language.code)}
        <li
          bind:this={listItems[index]}
          id={`language-option-${language.code}`}
          class:dropdown-item={true}
          class:highlighted={highlightedIndex === index}
          role="option"
          aria-selected={selectedLanguage?.code === language.code}
          tabindex="-1"
          on:click={() => selectLanguage(language)}
          on:mouseenter={() => {
            highlightedIndex = index;
          }}
        >
          {#if language.flag}<span class="language-flag" aria-hidden="true"
              >{language.flag}</span
            >{/if}
          <span class="language-name">{language.name}</span>
          <span class="language-code">({language.code})</span>
        </li>
      {:else}
        <li class="dropdown-item disabled" role="option" aria-disabled="true">
          No languages available.
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style lang="scss">
  // --- Styles are largely the same, just rename classes if needed ---
  // --- (e.g., .country-flag to .language-flag) ---

  .label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 500;
    color: var(--color-background);
  }

  .dropdown {
    position: relative;
    display: inline-block;
    font-family: sans-serif;
    z-index: 2; // Ensure dropdown is above static content

    &:focus-within {
      // Style container when button or list has focus
      // Consider adding outline here if you remove from button :focus-visible
    }
  }

  .dropdown-toggle {
    background: var(--color-background, #fff);
    color: var(--color-background-inversion);
    border: 1px solid var(--color-border, #ccc);
    padding: 0.6rem 1rem;
    border-radius: 8px;
    cursor: pointer;
    display: flex;
    
    gap: 0.5rem;
    width: 100%;
    max-width: 280px; // Adjust as needed for language names
    min-width: 180px;
    transition:
      border-color 0.2s ease,
      box-shadow 0.2s ease;
    text-align: left;
    outline: none; // Manage focus visually

    &:focus-visible {
      // Good for keyboard focus indication
      outline: 2px solid dodgerblue;
      outline-offset: 2px;
    }
  }

  // Wrapper for selected value to help with labelling
  .selected-value-wrapper {
    display: flex;
    
    gap: 0.5rem;
    flex-grow: 1; // Allow wrapper to take space
    overflow: hidden; // Prevent overflow issues
  }

  .language-flag {
    // Renamed class
    font-size: 1.2em;
    line-height: 1;
    flex-shrink: 0;
  }
  .language-code {
    // Renamed class
    color: var(--color-foreground-muted, #666);
    font-size: 0.9em;
    margin-left: auto;
    padding-left: 0.5rem;
    flex-shrink: 0;
  }

  .language-name {
    // Renamed class
    flex-grow: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .placeholder {
    color: var(--color-placeholder, #888);
    flex-grow: 1;
  }

  .arrow {
    flex-shrink: 0;
    fill: currentColor;
    transition: transform 0.2s ease;
  }

  .arrow.open {
    transform: rotate(180deg);
  }

  .dropdown-menu {
    background: var(--color-background, #fff);
    border: 1px solid var(--color-border, #ccc);
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    right: 0;
    border-radius: 8px;
    padding: 0.25rem 0;
    max-height: 300px;
    overflow-y: auto;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    z-index: 100;
    outline: none;
    width: 100%; // Ensure menu matches button width
    box-sizing: border-box; // Include padding/border in width
  }

  .dropdown-item {
    padding: 0.6rem 1rem;
    display: flex;
    
    gap: 0.5rem;
    cursor: pointer;
    transition:
      background-color 0.15s ease,
      color 0.15s ease;
    color: var(--color-background-inversion);
    white-space: nowrap;
    outline: none;

    &.disabled {
      color: #aaa;
      cursor: default;
    }

    &:not(.disabled):hover,
    &.highlighted:not(.disabled) {
      background-color: var(--color-highlight-bg, dodgerblue);
      color: var(--color-highlight-fg, #fff);

      .language-code {
        // Adjust code color on highlight
        color: var(--color-highlight-fg-muted, rgba(255, 255, 255, 0.8));
      }
    }
  }

  /* Optional fadeSlide animation */
  @keyframes fadeSlide {
    from {
      opacity: 0;
      transform: translateY(-5px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  // uncomment below to use animation
  // .dropdown-menu { animation: fadeSlide 0.15s ease-out forwards; }
</style>
