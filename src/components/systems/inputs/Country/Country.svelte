<script lang="ts">
  import { onMount, onDestroy, tick, createEventDispatcher } from "svelte";
  import { writable } from "svelte/store";
  import fuzzysort from "fuzzysort";
  import { fade, slide } from "svelte/transition";

  // Assuming countries.ts is in the same directory
  import countriesData from "./countries.ts";

  interface Country {
    code: string;
    name: string;
    flag: string | null;
  }

  const countries: Country[] = countriesData;

  // Props
  export let defaultCountryCode: string | null = null;
  export let label = "Country";
  export let onSelect: (selectedCode: string | null) => void = () => {};

  // State
  let selectedCountry: Country | null = null;
  export const selectedCountryStore = writable<Country | null>(null);
  let open = false;
  let showInput = false;
  let dropdownRef: HTMLElement;
  let inputRef: HTMLInputElement;
  export let buttonRef: HTMLButtonElement | undefined = undefined;
  let listRef: HTMLUListElement;
  let listItems: Array<HTMLLIElement | null> = [];

  // Typeahead & Highlighting
  let typeahead = "";
  let searchDebounceTimeout: number;
  const SEARCH_DEBOUNCE_DELAY = 150;
  let highlightedIndex: number = -1;
  let lastValidHighlightedIndex: number = -1;
  const dispatch = createEventDispatcher();

  // Lifecycle
  onMount(() => {
    const initialCountry = defaultCountryCode
      ? findCountryByCode(defaultCountryCode)
      : null;
    if (initialCountry) {
      selectedCountry = initialCountry;
      selectedCountryStore.set(initialCountry);
      lastValidHighlightedIndex = findIndexByCode(initialCountry.code);
    } else {
      selectedCountryStore.set(null);
      lastValidHighlightedIndex = 0;
    }

    document.addEventListener("click", handleClickOutside);
    listItems = new Array(countries.length).fill(null);
  });

  onDestroy(() => {
    document.removeEventListener("click", handleClickOutside);
    clearTimeout(searchDebounceTimeout);
  });

  // Utility
  function findCountryByCode(code: string): Country | null {
    return countries.find((language) => language.code === code) || null;
  }

  function findIndexByCode(code: string): number {
    return countries.findIndex((language) => language.code === code);
  }

  // Event Handlers
  function toggleOpen() {
    open = !open;
    showInput = open; // Input visibility tied to dropdown state
    if (open) {
      typeahead = "";
      highlightedIndex = selectedCountry
        ? findIndexByCode(selectedCountry.code)
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

  function selectCountry(language: Country) {
    selectedCountry = language;
    selectedCountryStore.set(language);
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
          highlightedIndex = (highlightedIndex + 1) % countries.length;
          lastValidHighlightedIndex = highlightedIndex;
          focusAndScrollToHighlightedItem();
          return;

        case "ArrowUp":
          event.preventDefault();
          highlightedIndex =
            (highlightedIndex - 1 + countries.length) % countries.length;
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
          highlightedIndex = countries.length - 1;
          lastValidHighlightedIndex = highlightedIndex;
          focusAndScrollToHighlightedItem();
          return;

        case "Enter":
          if (highlightedIndex !== -1 && highlightedIndex < countries.length) {
            event.preventDefault();
            selectCountry(countries[highlightedIndex]);
            dispatch("enter");
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
            : selectedCountry
              ? findIndexByCode(selectedCountry.code)
              : 0;
        focusAndScrollToHighlightedItem();
        return;
      }

      const searchResults = fuzzysort.go(typeahead, countries, {
        keys: ["name", "code"],
        threshold: -10000,
        limit: 50,
      });

      if (searchResults.length > 0) {
        const bestMatch = searchResults[0].obj;
        const bestMatchIndex = countries.findIndex(
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
  class="country-dropdown-container"
  bind:this={dropdownRef}
  on:keydown={handleKeydown}
  role="combobox"
  aria-haspopup="listbox"
  aria-expanded={open}
  aria-owns={open ? "language-listbox" : undefined}
>
  {#if label}
    <span class="input-label" id="language-select-label">
      {label}
    </span>
  {/if}

  <div class="input-wrapper">
    {#if showInput}
      <input
        type="text"
        bind:this={inputRef}
        value={typeahead}
        on:input={handleInput}
        placeholder="Type to search country..."
        class="search-input"
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
        class="country-select-button"
        aria-controls={open ? "language-listbox" : undefined}
        aria-labelledby="language-select-label {selectedCountry ? 'selected-language-label' : ''}"
        in:fade={{ duration: 200 }}
        out:fade={{ duration: 200 }}
      >
        {#if selectedCountry}
          <span class="selected-value">
            {#if selectedCountry.flag}
              <span class="flag" aria-hidden="true">{selectedCountry.flag}</span>
            {/if}
            <span class="name">{selectedCountry.name}</span>
            <span class="code">({selectedCountry.code})</span>
          </span>
        {:else}
          <span class="placeholder">Select a country</span>
        {/if}
        <svg
          class="chevron {open ? 'open' : ''}"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
    {/if}
  </div>

  {#if open}
    <ul
      bind:this={listRef}
      role="listbox"
      id="language-listbox"
      class="dropdown-list"
      tabindex="-1"
      aria-labelledby="language-select-label"
      in:slide={{ duration: 300, axis: 'y' }}
      out:fade={{ duration: 150 }}
    >
      {#each countries as language, index (language.code)}
        <li
          bind:this={listItems[index]}
          id={`language-option-${language.code}`}
          class="dropdown-item"
          class:highlighted={highlightedIndex === index}
          class:selected={selectedCountry?.code === language.code}
          role="option"
          aria-selected={selectedCountry?.code === language.code}
          tabindex="-1"
          on:click={() => selectCountry(language)}
          on:mouseenter={() => {
            highlightedIndex = index;
          }}
        >
          {#if language.flag}
            <span class="flag" aria-hidden="true">{language.flag}</span>
          {/if}
          <span class="name">{language.name}</span>
          <span class="code">({language.code})</span>
        </li>
      {:else}
        <li class="no-results" role="option" aria-disabled="true">
          No countries available.
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style lang="scss">
  .country-dropdown-container {
    position: relative;
    width: 100%;
    z-index: 100;
  }

  .input-label {
    display: block;
    margin-bottom: 0.75rem;
    color: rgba(255, 255, 255, 0.9);
    font-size: 0.9rem;
    font-weight: 500;
    letter-spacing: 0.02em;
  }

  .input-wrapper {
    position: relative;
    width: 100%;
  }

  .search-input, .country-select-button {
    width: 100%;
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
    text-align: left;
    display: flex;
    align-items: center;
    justify-content: space-between;
    cursor: pointer;

    &:focus {
      background: rgba(255, 255, 255, 0.08);
      border-color: var(--color-highlight-2);
      box-shadow: 0 0 0 4px rgba(var(--color-highlight-2-rgb), 0.15);
    }

    &:hover {
      background: rgba(255, 255, 255, 0.07);
      border-color: rgba(255, 255, 255, 0.2);
    }
  }

  .placeholder {
    color: rgba(255, 255, 255, 0.3);
  }

  .selected-value {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    overflow: hidden;

    .flag {
      font-size: 1.4rem;
    }

    .name {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .code {
      color: rgba(255, 255, 255, 0.5);
      font-size: 0.85rem;
    }
  }

  .chevron {
    width: 1.25rem;
    height: 1.25rem;
    color: rgba(255, 255, 255, 0.5);
    transition: transform 0.3s ease;

    &.open {
      transform: rotate(180deg);
    }
  }

  .dropdown-list {
    position: absolute;
    top: calc(100% + 0.5rem);
    left: 0;
    width: 100%;
    background: rgba(25, 25, 25, 0.95);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 1.25rem;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
    max-height: 300px;
    overflow-y: auto;
    z-index: 1000;
    padding: 0.5rem;
    list-style: none;

    &::-webkit-scrollbar {
      width: 6px;
    }
    &::-webkit-scrollbar-thumb {
      background: rgba(255, 255, 255, 0.1);
      border-radius: 10px;
    }
  }

  .dropdown-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    border-radius: 0.75rem;
    color: rgba(255, 255, 255, 0.8);
    cursor: pointer;
    transition: all 0.2s ease;

    .flag {
      font-size: 1.25rem;
    }

    .code {
      color: rgba(255, 255, 255, 0.4);
      font-size: 0.8rem;
      margin-left: auto;
    }

    &.highlighted, &:hover {
      background: rgba(255, 255, 255, 0.1);
      color: #ffffff;
    }

    &.selected {
      background: var(--color-highlight-2);
      color: #000;
      font-weight: 600;

      .code {
        color: rgba(0, 0, 0, 0.6);
      }
    }
  }

  .no-results {
    padding: 1rem;
    color: rgba(255, 255, 255, 0.4);
    text-align: center;
  }
</style>
