<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { fade, slide } from 'svelte/transition';
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

<div class="immigration-dropdown-container" bind:this={dropdownRef}>
  <button
    type="button"
    bind:this={buttonRef}
    on:click={toggleDropdown}
    class="immigration-select-button"
  >
    <span class="selected-value">{selectedStatus ? selectedStatus.name : 'Select Immigration Status'}</span>
    <svg
      class="chevron {isOpen ? 'open' : ''}"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
    </svg>
  </button>
  {#if isOpen}
    <ul class="dropdown-list" in:slide={{ duration: 300, axis: 'y' }} out:fade={{ duration: 150 }}>
      {#each immigrationStatuses as status}
        <li
          class="dropdown-item"
          class:selected={selectedStatus?.code === status.code}
          on:click={() => selectStatus(status)}
        >
          <span class="truncate">{status.name}</span>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style lang="scss">
  .immigration-dropdown-container {
    position: relative;
    width: 100%;
    z-index: 100;
  }

  .immigration-select-button {
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

    &:hover {
      background: rgba(255, 255, 255, 0.1);
      color: #ffffff;
    }

    &.selected {
      background: var(--color-highlight-2);
      color: #000;
      font-weight: 600;
    }
  }
</style>
