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

  const languages: Language[] = languagesData;

  // Props
  export let defaultLanguageCode: string | null = null;
  export let label = "Language";
  export let onSelect: (selectedCode: string | null) => void = () => {};

  // State
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

<svelte:head>
  <script src="https://cdn.tailwindcss.com"></script>
</svelte:head>

<div
  class="relative font-sans z-10"
  bind:this={dropdownRef}
  on:keydown={handleKeydown}
  role="combobox"
  aria-haspopup="listbox"
  aria-expanded={open}
  aria-owns={open ? "language-listbox" : undefined}
>
  {#if label}
    <span class="block mb-2 text-sm font-medium text-gray-700" id="language-select-label">
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
      class="w-full max-w-xs px-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 ease-in-out"
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
      class="w-full max-w-xs px-4 py-2 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 ease-in-out flex items-center justify-between"
      aria-controls={open ? "language-listbox" : undefined}
      aria-labelledby="language-select-label {selectedLanguage ? 'selected-language-label' : ''}"
      in:fade={{ duration: 200 }}
      out:fade={{ duration: 200 }}
    >
      {#if selectedLanguage}
        <span class="flex items-center gap-2 truncate">
          {#if selectedLanguage.flag}
            <span class="text-lg" aria-hidden="true">{selectedLanguage.flag}</span>
          {/if}
          <span class="truncate">{selectedLanguage.name}</span>
          <span class="text-gray-500 text-xs">({selectedLanguage.code})</span>
        </span>
      {:else}
        <span class="text-gray-500">Select a language</span>
      {/if}
      <svg
        class="w-4 h-4 transform transition-transform duration-200 {open ? 'rotate-180' : ''}"
        fill="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path d="M7 10l5 5 5-5z" />
      </svg>
    </button>
  {/if}

  {#if selectedLanguage && !showInput}
    <div
      class="mt-2 text-sm text-gray-700 flex items-center gap-2"
      in:fade={{ duration: 200 }}
      out:fade={{ duration: 200 }}
    >
      Selected:
      {#if selectedLanguage.flag}
        <span class="text-lg" aria-hidden="true">{selectedLanguage.flag}</span>
      {/if}
      <span>{selectedLanguage.name} ({selectedLanguage.code})</span>
    </div>
  {/if}

  {#if open}
    <ul
      bind:this={listRef}
      role="listbox"
      id="language-listbox"
      class="absolute w-full max-w-xs mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-64 overflow-y-auto z-20"
      tabindex="-1"
      aria-labelledby="language-select-label"
      in:slide={{ duration: 200 }}
      out:slide={{ duration: 200 }}
    >
      {#each languages as language, index (language.code)}
        <li
          bind:this={listItems[index]}
          id={`language-option-${language.code}`}
          class="px-4 py-2 text-sm flex items-center gap-2 cursor-pointer transition-colors duration-150 ease-in-out {highlightedIndex === index ? 'bg-blue-500 text-white' : 'hover:bg-gray-100'}"
          class:selected={selectedLanguage?.code === language.code}
          role="option"
          aria-selected={selectedLanguage?.code === language.code}
          tabindex="-1"
          on:click={() => selectLanguage(language)}
          on:mouseenter={() => {
            highlightedIndex = index;
          }}
        >
          {#if language.flag}
            <span class="text-lg" aria-hidden="true">{language.flag}</span>
          {/if}
          <span class="truncate">{language.name}</span>
          <span class="{highlightedIndex === index ? 'text-white' : 'text-gray-500'} text-xs">
            ({language.code})
          </span>
        </li>
      {:else}
        <li class="px-4 py-2 text-sm text-gray-500" role="option" aria-disabled="true">
          No languages available.
        </li>
      {/each}
    </ul>
  {/if}
</div>