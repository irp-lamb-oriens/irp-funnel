<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { immigrationStatuses } from './immigrationStatuses.js';
  import { immigrationStatusStore } from './store.js';

  export let buttonRef: HTMLButtonElement;

  let isOpen = false;
  let selectedStatus: { code: string; name: string } | null = null;
  let dropdownRef: HTMLElement;

  function toggleDropdown() {
    isOpen = !isOpen;
  }

  function selectStatus(status: { code: string; name: string }) {
    selectedStatus = status;
    immigrationStatusStore.set(status.code);
    isOpen = false;
  }

  function handleClickOutside(event: MouseEvent) {
    if (isOpen && dropdownRef && !dropdownRef.contains(event.target as Node)) {
      isOpen = false;
    }
  }

  onMount(() => {
    document.addEventListener('click', handleClickOutside);
  });

  onDestroy(() => {
    document.removeEventListener('click', handleClickOutside);
  });
</script>

<div class="relative font-sans z-10" bind:this={dropdownRef}>
  <button
    type="button"
    bind:this={buttonRef}
    on:click={toggleDropdown}
    class="country-select-button"
  >
    <span class="truncate">{selectedStatus ? selectedStatus.name : 'Select Immigration Status'}</span>
    <svg
      class="w-4 h-4 transform transition-transform duration-200 {isOpen ? 'rotate-180' : ''}"
      fill="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path d="M7 10l5 5 5-5z" />
    </svg>
  </button>
  {#if isOpen}
    <ul class="absolute w-full max-w-xs mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-64 overflow-y-auto z-20">
      {#each immigrationStatuses as status}
        <li
          class="px-4 py-2 text-sm flex items-center gap-2 cursor-pointer transition-colors duration-150 ease-in-out hover:bg-gray-100"
          on:click={() => selectStatus(status)}
        >
          <span class="truncate">{status.name}</span>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style lang="scss">
  .country-select-button {
    width: 100%;
    max-width: 20rem; /* max-w-xs */
    padding: 0.5rem 1rem; /* px-4 py-2 */
    font-size: 0.875rem; /* text-sm */
    background: #f5f5f5;
    border: 1px solid #d1d5db; /* border border-gray-300 */
    border-radius: 0.5rem; /* rounded-lg */
    transition: all 200ms ease-in-out;
    display: flex;
    align-items: center;
    justify-content: space-between;

    &:focus {
      outline: 2px solid transparent;
      outline-offset: 2px;
      --tw-ring-color: #3b82f6; /* focus:ring-blue-500 */
      box-shadow: 0 0 0 2px var(--tw-ring-color);
      border-color: #3b82f6; /* focus:border-blue-500 */
    }
  }
</style>
