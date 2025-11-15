<script lang="ts">
  import { writable, type Writable } from 'svelte/store';

  export let node: { name: string; value: string };
  export let selectedTags: Writable<string[]>;
  export let toggleTag: (tag: string) => void;

  let isSelected: boolean;
  selectedTags.subscribe(tags => {
    isSelected = tags.includes(node.value);
  });
</script>

<button
  class="tag-button"
  class:selected={isSelected}
  on:click={() => toggleTag(node.value)}
>
  {node.name}
</button>

<style lang="scss">
  .tag-button {
    padding: 8px 16px;
    border-radius: 20px;
    border: 1px solid #ccd0d5;
    background-color: #ffffff;
    color: #050505;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease-in-out;

    &:hover {
      background-color: #e4e6eb;
    }

    &.selected {
      background-color: #1877f2;
      color: #ffffff;
      border-color: #1877f2;

      &:hover {
        background-color: #166fe5;
      }
    }
  }
</style>
