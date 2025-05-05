<script lang="ts">
import { onMount, onDestroy } from 'svelte';
import type { Writable } from 'svelte/store'; // Import Writable type

// --- Props ---
/** A writable store provided by the parent to hold the selected FileList */
export let selectedFilesStore: Writable<FileList | null>;

/** Disables the input and drop zone */
export let disabled: boolean = false;
/** Visual indicator for parent submission state (often duplicates disabled logic) */
export let isSubmitting: boolean = false; // Kept for potential distinct styling/logic
/** Hint for the browser's file picker. Default is empty ("any file"). */
export let accept: string = ""; // Default to accept any file
/** Unique ID for the input element */
export let id: string = `file-upload-${Math.random().toString(36).substring(2, 9)}`;
/** Label for the trigger button */
export let label: string = 'Choose File';
/** Label text shown within the drop zone area */
export let dropZoneLabel: string = 'or Drop File Here';

// --- Internal State & Refs ---
let fileInputRef: HTMLInputElement | null = null;
let dropZoneRef: HTMLElement | null = null;
let isDraggingOver = false;

// --- Event Handlers ---
const handleFileSelect = (event: Event) => {
    const target = event.target as HTMLInputElement;
    if (target.files && target.files.length > 0) {
    console.log('[FileInput] handleFileSelect: Files selected via input:', target.files); // Log selected files
    selectedFilesStore.set(target.files); // Update the store
    // Do NOT reset target.value here immediately. Reset only if store becomes null.
    } else {
        // If user cancels selection after having one, update store
        if ($selectedFilesStore !== null) {
        selectedFilesStore.set(null);
        }
    }
};

const triggerFileInput = () => {
    if (!disabled && !isSubmitting) {
    fileInputRef?.click();
    }
};

const handleKeyDown = (e: KeyboardEvent) => {
    if (!disabled && !isSubmitting && (e.key === 'Enter' || e.key === ' ')) {
    e.preventDefault();
    triggerFileInput();
    }
};

// --- Drag and Drop Handlers ---
const handleDragEnter = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled && !isSubmitting) {
    isDraggingOver = true;
    }
};

const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled && !isSubmitting) {
    isDraggingOver = true;
    }
};

const handleDragLeave = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (dropZoneRef && !dropZoneRef.contains(e.relatedTarget as Node)) {
        isDraggingOver = false;
    }
};

const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    isDraggingOver = false;
    if (disabled || isSubmitting) return;

    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
    console.log('[FileInput] handleDrop: Files dropped:', files); // Log dropped files
    // Note: Browser might still filter based on 'accept' during drag/drop
    // We update the store regardless of the 'accept' prop here.
    selectedFilesStore.set(files); // Update the store
        // Clear the input value in case the dropped file matches the last selected one
    if (fileInputRef) fileInputRef.value = '';
    }
};

// --- Global Drag Listeners ---
const handleWindowDragLeave = (e: DragEvent) => {
    if (
        e.clientX <= 0 ||
        e.clientY <= 0 ||
        e.clientX >= window.innerWidth ||
        e.clientY >= window.innerHeight
    ) {
        isDraggingOver = false;
    }
};

onMount(() => {
    window.addEventListener('dragenter', handleDragEnter, true);
    window.addEventListener('dragover', handleDragOver, true);
    window.addEventListener('dragleave', handleWindowDragLeave);
});

onDestroy(() => {
    window.removeEventListener('dragenter', handleDragEnter, true);
    window.removeEventListener('dragover', handleDragOver, true);
    window.removeEventListener('dragleave', handleWindowDragLeave);
});

// --- Reactive Reset ---
// When the store is externally set to null, reset the input's value
// This allows selecting the same file again after a programmatic clear.
$: if ($selectedFilesStore === null && fileInputRef) {
    fileInputRef.value = '';
}

// Reactive check for disabled state to clear dragging visual
$: if ((disabled || isSubmitting) && isDraggingOver) {
    isDraggingOver = false;
}

</script>

<div
bind:this={dropZoneRef}
class="file-drop-zone"
class:drag-over={isDraggingOver && !disabled && !isSubmitting}
class:disabled={disabled || isSubmitting}
on:dragenter={handleDragEnter}
on:dragover={handleDragOver}
on:dragleave={handleDragLeave}
on:drop={handleDrop}
aria-disabled={disabled || isSubmitting}
>
<button
    class="file-input-label"
    class:disabled={disabled || isSubmitting}
    type="button"
    aria-disabled={disabled || isSubmitting}
    aria-describedby={isDraggingOver && !disabled && !isSubmitting ? `${id}-drop-instructions` : undefined}
    tabindex={disabled || isSubmitting ? -1 : 0}
    on:click={triggerFileInput}
    on:keydown={handleKeyDown}
    disabled={disabled || isSubmitting}
>
    {label}
</button>
<span class="drop-zone-label" aria-hidden="true">{dropZoneLabel}</span>

{#if isDraggingOver && !disabled && !isSubmitting}
    <div id={`${id}-drop-instructions`} class="visually-hidden">
    Release mouse to drop files
    </div>
{/if}

<input
    bind:this={fileInputRef}
    {id}
    class="visually-hidden"
    type="file"
    {accept}
    on:change={handleFileSelect}
    disabled={disabled || isSubmitting}
    aria-hidden="true"
    tabindex="-1"
/>
</div>

<style>
/* Styles remain the same as before */
.file-drop-zone {
    display: flex;
    flex-direction: column;
    
    justify-content: center;
    padding: 1.5rem 1rem;
    border: 2px dashed var(--color-border, #ccc);
    border-radius: var(--radius-md, 8px);
    background-color: var(--color-background-secondary, #f8f8f8);
    transition: background-color 0.2s ease-in-out, border-color 0.2s ease-in-out;
    text-align: center;
    min-height: 100px;
}

.file-drop-zone.drag-over {
    border-color: var(--color-primary, #007bff);
    background-color: var(--color-primary-light, #e7f3ff);
}

.file-drop-zone.disabled {
    opacity: 0.6;
    cursor: not-allowed;
    border-color: var(--color-border-disabled, #ddd);
    background-color: var(--color-background-disabled, #eee);
}

    /* Ensure drag-over style doesn't apply when disabled */
.file-drop-zone.disabled.drag-over {
    border-color: var(--color-border-disabled, #ddd); /* Revert border */
    background-color: var(--color-background-disabled, #eee); /* Revert background */
}

.file-input-label {
    background: none;
    color: inherit;
    border: none;
    padding: 0;
    font: inherit;
    cursor: pointer;
    outline: inherit;
    display: inline-block;
    padding: var(--spacing-xs, 0.5rem) var(--spacing-md, 1rem);
    background-color: var(--color-primary, #007bff);
    color: var(--color-primary-contrast, #fff);
    border-radius: var(--radius-sm, 4px);
    cursor: pointer;
    transition: background-color 0.2s ease;
    font-weight: 500;
    margin-bottom: var(--spacing-xs, 0.5rem);
}

.file-input-label:hover:not(:disabled), /* Check native disabled */
.file-input-label:focus:not(:disabled) {
    background-color: var(--color-primary-dark, #0056b3);
    outline: 2px solid var(--color-focus-ring, #0056b3);
    outline-offset: 2px;
}

/* Style using native :disabled pseudo-class */
.file-input-label:disabled {
    background-color: var(--color-disabled, #ccc);
    cursor: not-allowed;
    opacity: 0.7;
    outline: none; /* Remove focus ring when disabled */
}
    /* --- Redundant .disabled class removed for button --- */
    /* .file-input-label.disabled { ... } */


.drop-zone-label {
    font-size: var(--font-size-sm, 0.875rem);
    color: var(--color-text-secondary, #666);
}

.file-drop-zone.disabled .drop-zone-label {
    color: var(--color-text-disabled, #999);
}

.visually-hidden {
    border: 0;
    clip: rect(0 0 0 0);
    height: 1px;
    margin: -1px;
    overflow: hidden;
    padding: 0;
    position: absolute;
    width: 1px;
    white-space: nowrap;
}
</style>
