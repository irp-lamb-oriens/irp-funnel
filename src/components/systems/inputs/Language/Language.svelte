<script lang="ts">
  import { onMount, onDestroy, tick } from "svelte";
  import { writable } from "svelte/store";
  import fuzzysort from "fuzzysort";
  import { fade, slide } from "svelte/transition";

  // Assuming languages.ts is in the same directory
  import languagesData from "./languages.ts";

  interface Language {
    code: string;
    name: string;
    flag: string | null;
  }

  // Props
  export let whitelist: string[] = [];
  export let defaultLanguageCode: string | null = null;
  export let label = "Language";
  export let onSelect: (selectedCode: string | null) => void = () => {};

  // State
  let languages: Language[] = languagesData.filter(lang => whitelist.length === 0 || whitelist.includes(lang.code));
  let selectedLanguage: Language | null = null;
  export const selectedLanguageStore = writable<Language | null>(null);
  let open = false;
  let showInput = false;
  let dropdownRef: HTMLElement;
  let inputRef: HTMLInputElement;
  let buttonRef: HTMLButtonElement;
  let listRef: HTMLUListElement;
  let listItems: Array<HTMLLIElement | null> = [];

  // Typeahead & Highlighting
  let typeahead = "";
  let searchDebounceTimeout: number;
  const SEARCH_DEBOUNCE_DELAY = 150;
  let highlightedIndex: number = -1;
  let lastValidHighlightedIndex: number = -1;

  // Lifecycle
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
    clearTimeout(searchDebounceTimeout);
  });

  // Utility
  function findLanguageByCode(code: string): Language | null {
    return languages.find((language) => language.code === code) || null;
  }

  function findIndexByCode(code: string): number {
    return languages.findIndex((language) => language.code === code);
  }

  // Event Handlers
  function toggleOpen() {
    open = !open;
    showInput = open; // Input visibility tied to dropdown state
    if (open) {
      typeahead = "";
      highlightedIndex = selectedLanguage
        ? findIndexByCode(selectedLanguage.code)
        : lastValidHighlightedIndex !== -1
          ? lastValidHighlightedIndex
          : 0;
      tick().then(() => {
        inputRef?.focus();
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
    showInput = false;
    typeahead = "";
    highlightedIndex = -1;
    onSelect(language.code);
    buttonRef?.focus();
  }

  function handleClickOutside(event: MouseEvent) {
    if (open && dropdownRef && !dropdownRef.contains(event.target as Node)) {
      open = false;
      showInput = false;
      typeahead = "";
      buttonRef?.focus();
    }
  }

  function focusAndScrollToHighlightedItem() {
    if (highlightedIndex >= 0 && highlightedIndex < listItems.length) {
      const targetItem = listItems[highlightedIndex];
      if (targetItem) {
        targetItem.scrollIntoView({ block: "nearest" });
      }
    }
  }

  async function handleKeydown(event: KeyboardEvent) {
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
          if (highlightedIndex !== -1 && highlightedIndex < languages.length) {
            event.preventDefault();
            selectLanguage(languages[highlightedIndex]);
          }
          return;

        case "Escape":
          event.preventDefault();
          open = false;
          showInput = false;
          typeahead = "";
          buttonRef?.focus();
          return;

        case "Tab":
          open = false;
          showInput = false;
          typeahead = "";
          return;
      }
    } else {
      if (["ArrowDown", "ArrowUp", "Enter"].includes(event.key)) {
        event.preventDefault();
        toggleOpen();
        return;
      }
    }
  }

  async function handleInput(event: Event) {
    typeahead = (event.target as HTMLInputElement).value.toLowerCase();

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
        }
      } else {
        highlightedIndex = lastValidHighlightedIndex;
        focusAndScrollToHighlightedItem();
      }
    }, SEARCH_DEBOUNCE_DELAY);
  }
</script>

<div
  class="language-selector-wrapper z-10"
  bind:this={dropdownRef}
  on:keydown={handleKeydown}
  role="combobox"
  aria-haspopup="listbox"
  aria-expanded={open}
  aria-owns={open ? "language-listbox" : undefined}
>
  {#if label}
    <span class="language-select-label" id="language-select-label">
      {label}
    </span>
  {/if}

  {#if showInput}
    <input
      type="text"
      bind:this={inputRef}
      value={typeahead}
      on:input={handleInput}
      placeholder="Type to search language..."
      class="language-input"
      aria-autocomplete="list"
      aria-controls={open ? "language-listbox" : undefined}
      aria-labelledby="language-select-label"
      in:fade={{ duration: 200 }}
      out:fade={{ duration: 200 }}
    />
  {:else}
    <button
      type="button"
      bind:this={buttonRef}
      on:click={toggleOpen}
      class="language-button"
      aria-controls={open ? "language-listbox" : undefined}
      aria-labelledby="language-select-label {selectedLanguage ? 'selected-language-label' : ''}"
      in:fade={{ duration: 200 }}
      out:fade={{ duration: 200 }}
    >
      {#if selectedLanguage}
        <span class="language-button-content">
          {#if selectedLanguage.flag}
            <span class="flag-icon" aria-hidden="true">{selectedLanguage.flag}</span>
          {/if}
          <span class="language-name">{selectedLanguage.name}</span>
          <span class="language-code">({selectedLanguage.code})</span>
        </span>
      {:else}
        <span class="language-placeholder">Select a language</span>
      {/if}
      <svg
        class="dropdown-chevron {open ? 'open' : ''}"
        fill="currentColor"
        viewBox="0 0 20 20"
        aria-hidden="true"
      >
        <path
          fill-rule="evenodd"
          d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
          clip-rule="evenodd"
        />
      </svg>
    </button>
  {/if}

  {#if open}
    <ul
      bind:this={listRef}
      role="listbox"
      id="language-listbox"
      class="language-dropdown-list"
      tabindex="-1"
      aria-labelledby="language-select-label"
      in:slide={{ duration: 200 }}
      out:slide={{ duration: 200 }}
    >
      {#each languages as language, index (language.code)}
        <li
          bind:this={listItems[index]}
          id={`language-option-${language.code}`}
          class="language-option"
          class:highlighted={highlightedIndex === index}
          class:selected={selectedLanguage?.code === language.code}
          role="option"
          aria-selected={selectedLanguage?.code === language.code}
          tabindex="-1"
          on:click={() => selectLanguage(language)}
          on:mouseenter={() => {
            highlightedIndex = index;
            lastValidHighlightedIndex = index;
          }}
        >
          {#if language.flag}
            <span class="flag-icon" aria-hidden="true">{language.flag}</span>
          {/if}
          <span class="language-name">{language.name}</span>
          <span class="language-code {highlightedIndex === index ? 'code-highlighted' : ''}">
            ({language.code})
          </span>
        </li>
      {:else}
        <li class="language-empty" role="option" aria-disabled="true">
          No languages available.
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style lang="scss">
  .language-selector-wrapper {
    position: relative;
    width: 100%;
    font-family: inherit;
  }

  .language-select-label {
    display: block;
    margin-bottom: 0.5rem;
    font-size: 0.85rem;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.7);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .language-input, .language-button {
    width: 100%;
    padding: 0.8rem 1.2rem;
    font-size: 1rem;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 1rem;
    color: #fff;
    outline: none;
    transition: all 0.3s ease;
    display: flex;
    align-items: center;
    justify-content: space-between;
    cursor: pointer;
  }

  .language-input {
    cursor: text;
    background: rgba(255, 255, 255, 0.08);
    border-color: var(--color-highlight-2, #1ccfc9);
    box-shadow: 0 0 0 1px rgba(28, 207, 201, 0.2);
  }

  .language-button:hover {
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(255, 255, 255, 0.2);
  }

  .language-button-content {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    overflow: hidden;
  }

  .language-placeholder {
    color: rgba(255, 255, 255, 0.5);
  }

  .flag-icon {
    font-size: 1.2rem;
  }

  .language-name {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .language-code {
    font-size: 0.8rem;
    color: rgba(255, 255, 255, 0.5);
  }

  .dropdown-chevron {
    width: 1rem;
    height: 1rem;
    color: rgba(255, 255, 255, 0.5);
    transition: transform 0.3s ease;
    flex-shrink: 0;
  }

  .dropdown-chevron.open {
    transform: rotate(180deg);
  }

  .language-dropdown-list {
    position: absolute;
    top: calc(100% + 0.5rem);
    left: 0;
    width: 100%;
    margin: 0;
    padding: 0.5rem 0;
    list-style: none;
    background: rgba(20, 20, 20, 0.95);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 1rem;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
    max-height: 250px;
    overflow-y: auto;
    z-index: 50;
    
    &::-webkit-scrollbar {
      width: 6px;
    }
    &::-webkit-scrollbar-thumb {
      background: rgba(255, 255, 255, 0.2);
      border-radius: 3px;
    }
  }

  .language-option {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.6rem 1.2rem;
    cursor: pointer;
    font-size: 0.95rem;
    color: rgba(255, 255, 255, 0.8);
    transition: all 0.15s ease;
  }

  .language-option.highlighted {
    background: rgba(28, 207, 201, 0.15);
    color: #fff;
  }

  .language-option.selected {
    font-weight: 700;
    color: var(--color-highlight-2, #1ccfc9);
  }

  .code-highlighted {
    color: rgba(255, 255, 255, 0.8) !important;
  }

  .language-empty {
    padding: 0.8rem 1.2rem;
    color: rgba(255, 255, 255, 0.4);
    font-size: 0.9rem;
    text-align: center;
  }
</style>
