<script lang="ts">
  import { onMount, onDestroy, tick } from "svelte";
  import { writable } from "svelte/store";
  import fuzzysort from "fuzzysort";
  import { fade, slide } from "svelte/transition";

  // Assuming countries.ts is in the same directory
  import countriesData from "./countries.ts";

  interface Country {
    code: string;
    name: string;
    flag: string | null;
    dialCode: string;
  }

  // Props
  export let countries: Country[] = countriesData;
  export let defaultCountryCode: string | null = null;
  export let inputElement: HTMLButtonElement;
  export let label = "Country";
  export let onSelect: (selectedCode: string | null) => void = () => {};

  // State
  let selectedCountry: Country | null = null;
  export const selectedCountryStore = writable<Country | null>(null);
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
  class="country-input-wrapper"
  bind:this={dropdownRef}
  on:keydown={handleKeydown}
  role="combobox"
  aria-haspopup="listbox"
  aria-expanded={open}
  aria-owns={open ? "language-listbox" : undefined}
>
  {#if showInput}
    <input
      type="text"
      bind:this={inputRef}
      value={typeahead}
      on:input={handleInput}
      placeholder="Type to search language..."
      class="control-input"
      aria-autocomplete="list"
      aria-controls={open ? "language-listbox" : undefined}
      aria-labelledby="language-select-label"
      in:fade={{ duration: 200 }}
      out:fade={{ duration: 200 }}
    />
  {:else}
    <button
      type="button"
      bind:this={inputElement}
      bind:this={buttonRef}
      on:click={toggleOpen}
      class="control-button"
      aria-controls={open ? "language-listbox" : undefined}
      aria-labelledby="language-select-label {selectedCountry ? 'selected-language-label' : ''}"
      in:fade={{ duration: 200 }}
      out:fade={{ duration: 200 }}
    >
      {#if selectedCountry}
        <span class="selected-country">
          {#if selectedCountry.flag}
            <span class="flag" aria-hidden="true">{selectedCountry.flag}</span>
          {/if}
          <span class="name">{selectedCountry.name}</span>
          <span class="dial-code">({selectedCountry.dialCode})</span>
        </span>
      {:else}
        <span class="placeholder">Select a country</span>
      {/if}
      <svg
        class="chevron"
        class:open
        fill="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path d="M7 10l5 5 5-5z" />
      </svg>
    </button>
  {/if}

  {#if open}
    <ul
      bind:this={listRef}
      role="listbox"
      id="language-listbox"
      class="dropdown-list"
      tabindex="-1"
      aria-labelledby="language-select-label"
      in:slide={{ duration: 200 }}
      out:slide={{ duration: 200 }}
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
          <span class="dial-code">
            ({language.dialCode})
          </span>
        </li>
      {:else}
        <li class="no-countries" role="option" aria-disabled="true">
          No countries available.
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style lang="scss">
  .country-input-wrapper {
    position: relative;
    font-family: var(--font-paragraph);
    width: 100%;
    max-width: 20rem;
    z-index: 10;
  }

  .control-input,
  .control-button {
    width: 100%;
    padding: 0.75rem 1rem;
    font-size: 1rem;
    background: #f5f5f5;
    backdrop-filter: blur(6px);
    border: none;
    box-shadow: 0 0 10px -7.5px black;
    border-radius: 8px;
    color: black;
    transition:
      border 0.3s ease,
      box-shadow 0.3s ease;
    outline: none;
    text-align: left;
  }

  .control-button {
    display: flex;
    align-items: center;
    justify-content: space-between;
    cursor: pointer;
  }

  .control-input:focus,
  .control-button:focus {
    border-color: var(--color-foreground);
    box-shadow: 0 0 10px -2px var(--color-foreground);
  }

  .selected-country {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .flag {
    font-size: 1.25rem;
  }

  .name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .dial-code {
    font-size: 0.875rem;
    color: #6b7280;
  }

  .placeholder {
    color: #6b7280;
  }

  .chevron {
    width: 1rem;
    height: 1rem;
    transition: transform 0.2s;
    &.open {
      transform: rotate(180deg);
    }
  }

  .dropdown-list {
    position: absolute;
    width: 100%;
    margin-top: 0.25rem;
    background-color: white;
    background: #f5f5f5;
    border: 1px solid #d1d5db;
    border-radius: 0.5rem;
    box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
    max-height: 16rem;
    overflow-y: auto;
    z-index: 20;
    list-style: none;
    padding: 0;
  }

  .dropdown-item {
    padding: 0.5rem 1rem;
    font-size: 1rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
    transition: background-color 0.15s ease-in-out;

    &:hover {
      background-color: #f3f4f6;
    }

    &.highlighted {
      background-color: var(--color-outline);
      color: white;
      .dial-code {
        color: white;
      }
    }

    &.selected {
      font-weight: bold;
    }
  }

  .no-countries {
    padding: 0.5rem 1rem;
    font-size: 1rem;
    color: #6b7280;
  }
</style>
