<script lang="ts">
  import { writable, type Writable } from 'svelte/store';

  export let items: Array<string | number> = [];
  export let selected: string | number;
  export let label: string = '';
  export let itemToString: (item: string | number) => string = (item) => String(item);
  export let selectedStore: Writable<string | number> | undefined;

  // Writable store for selected item (fallback if selectedStore not provided)
  export const selectedItem = writable<string | number>(selected);

  // Use selectedStore if provided, otherwise use selectedItem
  $: storeToUse = selectedStore ?? selectedItem;

  function selectItem(item: string | number) {
    storeToUse.set(item);
  }
</script>

<div class="picker-wheel">
  {#if label}
    <div class="picker-label">{label}</div>
  {/if}
  <div class="wheel-list" tabindex="0">
    {#each items as item}
      <div
        class="wheel-item {item === $storeToUse ? 'selected' : ''}"
        on:click={() => selectItem(item)}
      >
        {itemToString(item)}
      </div>
    {/each}
  </div>
</div>

<style>
.picker-wheel {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 100px;
}

.picker-label {
  font-size: 1rem;
  font-weight: 500;
  margin-bottom: 8px;
  color: #fff;
  text-shadow: 0 1px 4px rgba(0,0,0,0.2);
}

.wheel-list {
  box-shadow: 0 4px 30px rgba(0,0,0,0.12);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(255,255,255,0.3);
  padding: 8px;
  max-height: 60px;
  overflow-y: auto;
  min-width: 80px;
  transition: box-shadow 0.2s;
}

.wheel-list:focus {
  box-shadow: 0 0 0 2px #aeeaff;
  outline: none;
}

.wheel-item {
  padding: 10px;
  text-align: center;
  font-size: 1.15rem;
  color: #e0e0e0;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
  user-select: none;
}

.wheel-item.selected {
  color: var(--color-foreground);
  font-weight: 600;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
  border: 1.5px solid #aeeaff;
}

.wheel-item:hover:not(.selected) {
  background: rgba(255,255,255,0.22);
  color: var(--color-foreground);
}
</style>
