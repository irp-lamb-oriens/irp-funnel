<script lang="ts">
  import { writable } from "svelte/store";
  import { onMount, onDestroy } from "svelte";
  import getColorSuggestions, {
    getComplementaryColor,
    getContrastColor,
    hslToHex,
  } from "./getColorSuggestions.ts";
  import type { CandidateScore } from "./getColorSuggestions.ts";
  import store from "../../../store.ts";
  // Import the color picker library
  import ColorPicker from "svelte-awesome-color-picker"; // Removed A11yVariant as it's not used
  import nearestColor from "nearest-color"; // Import the library
  // Standard colors are accessed via nearestColor.STANDARD_COLORS
  import {
    complementaryColor,
    foregroundColor,
  } from "../../../ThemeChanger/theme-store.ts";
  import MarkdownText from "../../texts/MarkdownText/MarkdownText.svelte";

  // Props & Stores
  export let selectedColor: string = $foregroundColor;
  export let onChange: (newColor: string) => void = () => {};
  export let canReveal = false;
  export const selectedColorStore = writable(selectedColor);

  // Initialize nearestColor using the standard colors map
  const getColorNameFunc = nearestColor.from(nearestColor.STANDARD_COLORS);

  let open = false;
  let pickerRef: HTMLElement;

  // Default palette from global store
  let palette: string[] = $store.colorPalette;

  // For drag and drop reordering of palette items
  let dragIndex: number | null = null;

  // Reactive smart suggestions update on changes
  $: suggestions = getColorSuggestions(
    palette,
    selectedColor || "#000000"
  ) as CandidateScore[];

  // Reactive color name
  $: colorName = getColorNameFunc(selectedColor)?.name || "Unknown";

  // Toggle the palette dropdown open/close
  function togglePicker() {
    open = !open;
  }

  // Update selection and propagate change
  function selectColor(color: string) {
    selectedColor = color;
    selectedColorStore.set(color);
    open = false;
    onChange(color);
  }

  // -----------------------------
  // Drag and Drop for Palette Reordering
  // -----------------------------
  function handleDragStart(e: DragEvent, index: number) {
    dragIndex = index;
    e.dataTransfer?.setData("text/plain", index.toString());
  }

  function handleDragOver(e: DragEvent) {
    e.preventDefault();
  }

  function handleDrop(e: DragEvent, dropIndex: number) {
    e.preventDefault();
    if (dragIndex === null || dragIndex === dropIndex) return;
    const updatedPalette = [...palette];
    const [removed] = updatedPalette.splice(dragIndex, 1);
    updatedPalette.splice(dropIndex, 0, removed);
    palette = updatedPalette;
    dragIndex = null;
  }

  // Close the picker if click occurs outside the component
  function handleClickOutside(event: MouseEvent) {
    if (pickerRef && !pickerRef.contains(event.target as Node)) {
      open = false;
    }
  }

  onMount(() => {
    document.addEventListener("click", handleClickOutside);
  });
  onDestroy(() => {
    document.removeEventListener("click", handleClickOutside);
  });

  // -----------------------------
  // Drag & Input for Color Wheel Functionality
  // -----------------------------
  let dragStartX = 0;
  let dragStartY = 0;
  let potentialDragging = false;
  let isDragging = false;
  let wasDragging = false;

  function handleMouseDown(event: MouseEvent) {
    dragStartX = event.clientX;
    dragStartY = event.clientY;
    potentialDragging = true;
    isDragging = false;
    wasDragging = false;
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  }

  function handleMouseMove(event: MouseEvent) {
    if (!potentialDragging) return;
    // Start drag if movement exceeds threshold
    if (
      !isDragging &&
      Math.hypot(event.clientX - dragStartX, event.clientY - dragStartY) > 5
    ) {
      isDragging = true;
      wasDragging = true;
    }
    if (isDragging) {
      updateColorFromDrag(event);
    }
  }

  function handleMouseUp(event: MouseEvent) {
    potentialDragging = false;
    if (isDragging) {
      isDragging = false;
    }
    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("mouseup", handleMouseUp);
  }

  function updateColorFromDrag(event: MouseEvent) {
    const dx = event.clientX - dragStartX;
    const dy = event.clientY - dragStartY;
    const angle = Math.atan2(dy, dx) * (180 / Math.PI);
    let hue = angle < 0 ? angle + 360 : angle;
    const hex = hslToHex(hue, 100, 50);
    selectedColor = hex;
    selectedColorStore.set(hex);
    onChange(hex);
  }

  // (The original handleInputChange is now not needed since the library handles input.)
  function handleClick(event: MouseEvent) {
    if (!wasDragging) {
      togglePicker();
    }
  }

  function setStoreColor() {
    foregroundColor.set(selectedColor);
    complementaryColor.set(getComplementaryColor(selectedColor));
  }
</script>

<div class="color-picker" bind:this={pickerRef}>
  <!-- Replacing the text input with svelte-awesome-color-picker.
       We attach on:mousedown and on:click to keep the drag functionality.
       The on:input event updates the selectedColor state and triggers onChange. -->
  <div class="picker-wrapper" on:mousedown={handleMouseDown} on:click={handleClick}>
    <ColorPicker
      bind:hex={selectedColor}
      position="responsive"
    on:input={(e) => {
      selectedColor = e.detail.hex || $foregroundColor;
      selectedColorStore.set(selectedColor);
      if (!isDragging) {
        onChange(selectedColor);
        setStoreColor();
      }
    }}
    />
    <span class="color-name" aria-live="polite">({colorName})</span>
  </div>

  <MarkdownText {canReveal}>
    ==Related colors== for different types of color ==palettes==.
  </MarkdownText>

  <!-- AI-Powered Smart Suggestions Panel -->
  <section class="suggestion-panel" aria-label="Smart Color Suggestions">
    <ul class="suggestion-list">
      {#each suggestions as suggestion, index (suggestion.candidate + "-" + index)}
        <li class="suggestion-item">
          <button
            class="suggestion-btn"
            on:click={() => selectColor(suggestion.candidate)}
            on:keydown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                selectColor(suggestion.candidate);
                setStoreColor();
              }
            }}
          >
            <div
              class="suggestion-swatch"
              style="background: {suggestion.candidate};"
            >
              <span
                class="suggestion-scheme"
                style="color: {getContrastColor(suggestion.candidate)};"
              >
                {suggestion.scheme}
                {suggestion.candidate}
              </span>
            </div>
          </button>
        </li>
      {/each}
    </ul>
  </section>
</div>

<style lang="scss">
  .color-picker {
    position: relative;
    display: flex;
    gap: 1rem;
    justify-content: space-between;
    flex-wrap: wrap;
    z-index: 1;
  }

  .picker-wrapper {
    display: flex;
    
    gap: 0.5rem; /* Adjust gap as needed */
  }

  .color-name {
    font-size: 0.9em;
    color: var(--color-foreground-muted); /* Use a muted color */
    margin-left: 5px; /* Space between picker and name */
  }

  /* Optionally, you may remove or adjust styles for the removed .color-preview */

  /* Dropdown Palette */
  .color-dropdown {
    position: absolute;
    top: calc(100% + 0.75rem);
    left: 0;
    right: 0;
    background: var(--color-background-very-opaque);
    backdrop-filter: blur(8px);
    border: 1px solid var(--color-background);
    border-radius: 12px;
    padding: 0.75rem;
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(40px, 1fr));
    gap: 0.75rem;
    z-index: 20;
    animation: fadeSlide 0.3s ease-out;
  }

  @keyframes fadeSlide {
    from {
      opacity: 0;
      transform: translateY(-10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .swatch-item button {
    width: 40px;
    height: 40px;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    transition:
      transform 0.3s ease,
      box-shadow 0.3s ease;
    background: transparent;
    padding: 0;
  }

  .color-swatch {
    width: 100%;
    height: 100%;
    border-radius: 8px;
  }

  .swatch-item button:hover,
  .swatch-item button:focus {
    transform: scale(1.15);
    box-shadow: 0 0 10px var(--neon-pink);
    outline: none;
  }

  .checkmark {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 20px;
    height: 20px;
    fill: var(--color-foreground-inversion);
  }

  .suggestion-panel {
    animation: fadeSlide 0.5s ease-out;
    max-height: 200px;
    overflow: auto;
  }

  .suggestion-panel h3 {
    color: var(--color-background);
    margin: 0 0 0.5rem;
    font-size: 1rem;
    text-align: center;
  }

  .suggestion-list {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
    justify-content: space-between;
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .suggestion-item button {
    display: flex;
    
    border: none;
    background: transparent;
    cursor: pointer;
    padding: 0.25rem;
    border-radius: 8px;
    transition:
      transform 0.2s ease,
      background 0.2s ease;
  }

  .suggestion-item button:hover,
  .suggestion-item button:focus {
    transform: scale(1.05);
    background: var(--color-background-very-opaque);
    outline: none;
  }

  .suggestion-swatch {
    border-radius: 6px;
    padding: 5px 10px;
  }

  .suggestion-scheme {
    color: var(--color-background-inversion);
    font-size: 0.8rem;
    text-shadow: 0 0 4px var(--color-background-inversion);
  }

  .preview-panel {
    background: var(--color-background-very-opaque);
    backdrop-filter: blur(8px);
    border-radius: 12px;
    padding: 0.75rem;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
    text-align: center;
    animation: fadeSlide 0.5s ease-out;
  }

  .preview-panel h3 {
    color: var(--color-background);
    margin-bottom: 0.5rem;
    font-size: 1rem;
  }

  .preview-mockup {
    background: var(--color-background);
    border-radius: 8px;
    padding: 1rem;
    color: #333;
    font-weight: bold;
    transition: transform 0.3s ease;
  }

  .preview-mockup:hover {
    transform: scale(1.03);
  }
</style>
