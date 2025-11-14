<script lang="ts">
  import { immigrationStatuses } from './immigrationStatuses.js';
  import { immigrationStatusStore } from './store.js';

  export let buttonRef: HTMLButtonElement;

  let isOpen = false;
  let selectedStatus: { code: string; name: string } | null = null;

  function toggleDropdown() {
    isOpen = !isOpen;
  }

  function selectStatus(status: { code: string; name: string }) {
    selectedStatus = status;
    immigrationStatusStore.set(status.code);
    isOpen = false;
  }
</script>

<div class="immigration-status-picker">
  <button bind:this={buttonRef} on:click={toggleDropdown} class="picker-button">
    {selectedStatus ? selectedStatus.name : 'Select Immigration Status'}
  </button>
  {#if isOpen}
    <div class="status-list">
      {#each immigrationStatuses as status}
        <div class="status-item" on:click={() => selectStatus(status)}>
          {status.name}
        </div>
      {/each}
    </div>
  {/if}
</div>

<style lang="scss">
  .immigration-status-picker {
    position: relative;
    width: 100%;
  }
  .picker-button {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid #ccc;
    border-radius: 4px;
    background-color: #fff;
    text-align: left;
    cursor: pointer;
  }
  .status-list {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    background-color: #fff;
    border: 1px solid #ccc;
    border-top: none;
    border-radius: 0 0 4px 4px;
    max-height: 200px;
    overflow-y: auto;
    z-index: 10;
  }
  .status-item {
    padding: 0.75rem;
    cursor: pointer;
    &:hover {
      background-color: #f0f0f0;
    }
  }
</style>
