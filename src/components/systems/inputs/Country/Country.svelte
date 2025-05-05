<script lang="ts">
  import { onMount, onDestroy, tick } from "svelte";
  import { writable } from "svelte/store";
  import type { Country } from "../../../types.js"; // Adjust path if needed
  import countries from "./countries.js"; // Adjust path if needed
  import fuzzysort from "fuzzysort"; // Import fuzzysort

  export let defaultCountryCode: string | null = null;
  export let label = "Country"; // Default label

  // --- State ---
  let selectedCountry: Country | null = null;
  export const selectedCountryStore = writable<Country | null>(null); // Initialize store

  export let onSelect: (selectedCode: string | null) => void = () => {}; // Allow null selection? Or always require one? Assuming null is possible if nothing selected.

  let open = false;
  let dropdownRef: HTMLElement;
  let buttonRef: HTMLButtonElement; // Reference to the button for focus management
  let listRef: HTMLUListElement; // Reference to the list for focus management
  let listItems: Array<HTMLLIElement | null> = []; // Array to hold list item refs

  // --- Typeahead & Highlighting ---
  let typeahead = "";
  let typeaheadTimeout: number;
  let searchDebounceTimeout: number;
  const TYPEAHEAD_RESET_DELAY = 1200; // ms - Reset search string after inactivity
  const SEARCH_DEBOUNCE_DELAY = 150; // ms - Wait slightly after typing before searching

  let highlightedIndex: number = -1; // Index in the *original* countries array
  let lastValidHighlightedIndex: number = -1; // Keep track of last valid index if search fails

  // --- Lifecycle ---
  onMount(() => {
    const initialCountry = defaultCountryCode
      ? findCountryByCode(defaultCountryCode)
      : null;
    if (initialCountry) {
      // Don't trigger onSelect on initial mount, just set the state
      selectedCountry = initialCountry;
       selectedCountryStore.set(initialCountry);
       // Set initial highlight when opened later
       lastValidHighlightedIndex = countries.findIndex((c: Country) => c.code === initialCountry.code);
     } else {
        selectedCountryStore.set(null);
       lastValidHighlightedIndex = 0; // Start at top if no default
    }

    document.addEventListener("click", handleClickOutside);

    // Pre-allocate listItems array based on countries length
    listItems = new Array(countries.length).fill(null);
  });

  onDestroy(() => {
    document.removeEventListener("click", handleClickOutside);
    clearTimeout(typeaheadTimeout);
    clearTimeout(searchDebounceTimeout);
  });

   // --- Utility ---
   function findCountryByCode(code: string): Country | null {
     return countries.find((country: Country) => country.code === code) || null;
   }

   function findIndexByCode(code: string): number {
       return countries.findIndex((country: Country) => country.code === code);
   }


  // --- Event Handlers ---
  function toggleOpen() {
    open = !open;
    if (open) {
      // When opening, reset typeahead and set highlight to current selection or top
      typeahead = "";
      highlightedIndex = selectedCountry
        ? findIndexByCode(selectedCountry.code)
        : (lastValidHighlightedIndex !== -1 ? lastValidHighlightedIndex : 0); // Start at selection or last valid/top
      
      // Ensure DOM is updated before focusing/scrolling
      tick().then(() => {
        focusAndScrollToHighlightedItem();
        // Optional: Focus the list itself to capture keys if needed, but focus on button is often better UX initially.
        // listRef?.focus();
      });
    } else {
        // If closed via toggle (not selection), ensure button has focus
        buttonRef?.focus();
    }
  }

  function selectCountry(country: Country) {
    selectedCountry = country;
    selectedCountryStore.set(country);
    lastValidHighlightedIndex = findIndexByCode(country.code); // Update last valid index
    open = false;
    typeahead = ""; // Reset typeahead
    highlightedIndex = -1; // Reset highlight index
    onSelect(country.code);
    buttonRef?.focus(); // Return focus to the button
  }

  function handleClickOutside(event: MouseEvent) {
    if (open && dropdownRef && !dropdownRef.contains(event.target as Node)) {
      open = false;
      typeahead = ""; // Reset typeahead on close
       // Optional: Reset highlightIndex or keep lastValidHighlightedIndex?
       // highlightedIndex = -1; // Or keep it for reopening
       buttonRef?.focus(); // Ensure focus returns appropriately if needed
    }
  }

  function focusAndScrollToHighlightedItem() {
    if (highlightedIndex >= 0 && highlightedIndex < listItems.length) {
      const targetItem = listItems[highlightedIndex];
      if (targetItem) {
        targetItem.focus(); // Programmatically focus the item
        targetItem.scrollIntoView({ block: "nearest" }); // Scroll smoothly
      }
    }
  }

  // --- Keyboard Navigation & Smart Search ---
  async function handleKeydown(event: KeyboardEvent) {
    // --- 1. Handle Navigation Keys When Open ---
    if (open) {
      switch (event.key) {
        case "ArrowDown":
          event.preventDefault(); // Prevent page scroll
          highlightedIndex = (highlightedIndex + 1) % countries.length;
          lastValidHighlightedIndex = highlightedIndex; // Update last valid index on manual nav
          focusAndScrollToHighlightedItem();
          return; // Don't process as typeahead

        case "ArrowUp":
          event.preventDefault(); // Prevent page scroll
          highlightedIndex = (highlightedIndex - 1 + countries.length) % countries.length;
           lastValidHighlightedIndex = highlightedIndex; // Update last valid index on manual nav
          focusAndScrollToHighlightedItem();
          return; // Don't process as typeahead

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
        case " ": // Space selects too
          if (highlightedIndex !== -1) {
            event.preventDefault();
            selectCountry(countries[highlightedIndex]);
          }
          return; // Don't process as typeahead

        case "Escape":
          event.preventDefault();
          open = false;
          typeahead = "";
          // highlightedIndex = -1; // Optional reset
          buttonRef?.focus(); // Return focus to button
          return; // Don't process as typeahead

        case "Tab":
            // Allow tab to naturally move focus away, closing the dropdown
            open = false;
            typeahead = "";
            return; // Don't prevent default
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
         return; // Backspace does nothing if typeahead is empty
      }
      event.preventDefault(); // Prevent navigating back in browser history
    }
    // Append visible characters (check key length and avoid modifiers)
    else if (event.key.length === 1 && !event.altKey && !event.ctrlKey && !event.metaKey) {
      typeahead += event.key;
      isTypeaheadKey = true;
      event.preventDefault(); // Prevent default action of the key press
    }

    if (!isTypeaheadKey) {
      return; // Ignore other keys like Shift, Ctrl, etc. for typeahead
    }

    // --- 3. Perform Smart Search ---
    // Open the dropdown if it isn't already open when user starts typing
    if (!open) {
      open = true;
      await tick(); // Wait for list to render
    }

    // Reset the full typeahead string after a period of inactivity
    clearTimeout(typeaheadTimeout);
    typeaheadTimeout = window.setTimeout(() => {
      typeahead = "";
      // console.log("Typeahead reset"); // For debugging
    }, TYPEAHEAD_RESET_DELAY);

    // Debounce the actual search execution
    clearTimeout(searchDebounceTimeout);
    searchDebounceTimeout = window.setTimeout(() => {
      if (typeahead === "") {
        // If search is cleared, revert highlight to the last known good one or selected
         highlightedIndex = lastValidHighlightedIndex !== -1
            ? lastValidHighlightedIndex
            : (selectedCountry ? findIndexByCode(selectedCountry.code) : 0);
         focusAndScrollToHighlightedItem();
         // console.log("Typeahead empty, reverting highlight"); // Debug
         return;
      }

      // console.log("Searching for:", typeahead); // For debugging
      const searchResults = fuzzysort.go(typeahead, countries, {
        keys: ["name", "code"], // Search in both name and code
        threshold: -10000, // Adjust threshold as needed (lower means more fuzzy)
        limit: 50 // Limit results for performance if list is huge
        // allowTypo: true, // Fuzzysort default handles typos well
      });

      // console.log("Search results:", searchResults); // For debugging

       if (searchResults.length > 0) {
         // Find the index of the *best* match in the original countries array
         const bestMatch = searchResults[0].obj as Country; // Cast to Country
         const bestMatchIndex = countries.findIndex((c: Country) => c.code === bestMatch.code);

         if (bestMatchIndex !== -1) {
          highlightedIndex = bestMatchIndex;
          lastValidHighlightedIndex = highlightedIndex; // Update last valid on successful search
          focusAndScrollToHighlightedItem();
        } else {
           // Should not happen if obj is from countries, but good failsafe
           highlightedIndex = lastValidHighlightedIndex;
           focusAndScrollToHighlightedItem(); // Stick to last known good
        }
      } else {
        // No match found: stick with the last focused/highlighted option
        highlightedIndex = lastValidHighlightedIndex;
        focusAndScrollToHighlightedItem(); // Ensure it's still focused/visible
        // console.log("No match, sticking to index:", highlightedIndex); // Debug
      }
    }, SEARCH_DEBOUNCE_DELAY);
  }
</script>

<!-- Add tabindex="0" to the main div to make it focusable for keydown -->
<div
  class="dropdown"
  bind:this={dropdownRef}
  on:keydown={handleKeydown}
  tabindex="0"
>
  {#if label}
    <span class="label">{label}</span>
  {/if}

  <button
    type="button"
    class="dropdown-toggle"
    bind:this={buttonRef}
    on:click={toggleOpen}
    aria-haspopup="listbox"
    aria-expanded={open}
    aria-controls={open ? 'country-listbox' : undefined}
  >
    {#if selectedCountry}
      {#if selectedCountry.flag}<span class="country-flag" aria-hidden="true">{selectedCountry.flag}</span>{/if}
      <span class="country-name">{selectedCountry.name}</span>
      <span class="country-code">({selectedCountry.code})</span>
    {:else}
      <span class="placeholder">Select a country</span>
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
      id="country-listbox"
      tabindex="-1"
    >
      {#each countries as country, index (country.code)}
        <li
          bind:this={listItems[index]}
          id={`country-option-${country.code}`}
          class:dropdown-item={true}
          class:highlighted={highlightedIndex === index}
          role="option"
          aria-selected={selectedCountry?.code === country.code}
          tabindex="-1"
          on:click={() => selectCountry(country)}
          on:mouseenter={() => { highlightedIndex = index; }}
          >
          {#if country.flag}<span class="country-flag" aria-hidden="true">{country.flag}</span>{/if}
          <span class="country-name">{country.name}</span>
          <span class="country-code">({country.code})</span>
        </li>
      {:else}
         <li class="dropdown-item disabled" role="option" aria-disabled="true">
            No countries available.
         </li>
      {/each}
    </ul>
  {/if}
</div>

<style lang="scss">
  .label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 500; // Example style
    color: var(--color-background); // Use CSS vars or defaults
  }

  .dropdown {
    position: relative;
    display: inline-block;
    font-family: sans-serif; // Example font
    z-index: 1; // Ensure dropdown is above static content

    // Add focus outline for the container when focused via keyboard
    &:focus {
        outline: none; // Remove default outline if managing focus visually elsewhere
    }

    &:focus-visible { // Use focus-visible for keyboard-only focus rings
       outline: 2px solid dodgerblue; // Or your focus color
       outline-offset: 2px;
       border-radius: 8px; // Match button radius
    }
  }

  .dropdown-toggle {
    background: var(--color-background, #fff);
    color: var(--color-background-inversion);
    border: 1px solid var(--color-border, #ccc);
    padding: 0.6rem 1rem; // Slightly more padding
    border-radius: 8px;
    cursor: pointer;
    display: flex;
    
    gap: 0.5rem; // Space between elements
    // justify-content: space-between; // Removed to let content flow naturally
    width: 100%; // Make button take full width of container
    max-width: 250px; // Ensure minimum size
    transition:
      border-color 0.2s ease,
      box-shadow 0.2s ease;
    text-align: left;
    outline: none; // Remove default button outline, handled by parent div or :focus-visible

    // &:focus { // Using :focus-visible on parent instead
    //   box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.3); // Example focus ring
    //   border-color: dodgerblue;
    // }
  }

  .country-flag {
    font-size: 1.2em; // Make flag slightly larger
    line-height: 1;
  }
  .country-code {
     color: var(--color-foreground-muted, #666);
     font-size: 0.9em;
     margin-left: auto; // Push code to the right
     padding-left: 0.5rem;
  }

  .country-name {
      flex-grow: 1; // Allow name to take available space
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
  }

  .placeholder {
    color: var(--color-placeholder, #888);
     flex-grow: 1;
  }

  .arrow {
    flex-shrink: 0; // Prevent arrow from shrinking
    // margin-left: auto; // Removed, gap handles spacing
    fill: currentColor; // Inherit text color
    transition: transform 0.2s ease;
  }

  .arrow.open {
    transform: rotate(180deg);
  }

  .dropdown-menu {
    background: var(--color-background, #fff);
    border: 1px solid var(--color-border, #ccc);
    position: absolute;
    top: calc(100% + 4px); // Small gap
    left: 0;
    right: 0; // Match button width
    border-radius: 8px;
    padding: 0.25rem 0; // Add some vertical padding
    max-height: 300px;
    overflow-y: auto;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1); // Softer shadow
    // animation: fadeSlide 0.15s ease-out forwards; // Faster animation
    z-index: 100;
    outline: none; // List itself shouldn't have outline
  }

  .dropdown-item {
    padding: 0.6rem 1rem;
    display: flex;
    
    gap: 0.5rem;
    cursor: pointer;
    transition:
      background-color 0.15s ease,
      color 0.15s ease;
    // background: var(--color-x-gradient-inversion); // Remove complex background
    color: var(--color-background-inversion);
    white-space: nowrap; // Prevent wrapping
    outline: none; // Items don't need individual outlines when focus managed

    &.disabled {
        color: #aaa;
        cursor: default;
    }

    &:not(.disabled):hover, // Hover styles
    &.highlighted:not(.disabled) { // Highlighted style (via keyboard)
      // background: var(--color-x-gradient); // Replace gradient
      background-color: var(--color-highlight-bg, dodgerblue);
      color: var(--color-highlight-fg, #fff);

      .country-code { // Adjust code color on highlight
         color: var(--color-highlight-fg-muted, rgba(255, 255, 255, 0.8));
      }
    }

    // Ensure highlighted item overrides hover if both apply (keyboard nav priority)
    &.highlighted:not(.disabled) {
        background-color: var(--color-highlight-bg, dodgerblue);
        color: var(--color-highlight-fg, #fff);
         .country-code {
            color: var(--color-highlight-fg-muted, rgba(255, 255, 255, 0.8));
        }
    }
  }

  /* Keep fadeSlide animation if you like it */
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
</style>
