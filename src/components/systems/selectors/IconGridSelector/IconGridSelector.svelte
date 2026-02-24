<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import IconButton from '../../buttons/IconButton/IconButton.svelte';

  type Option = {
    value: string;
    label: string;
    iconSrc: string;
  };

  export let options: Option[] = [];
  export let selectedValue: string | undefined = undefined; // Allow undefined for no initial selection
  // export let groupName: string = "icon-grid-selector-" + Math.random().toString(36).substring(2, 9);

  const dispatch = createEventDispatcher<{ update: string }>();

  function handleClick(value: string) {
    if (selectedValue !== value) {
      selectedValue = value;
      dispatch('update', selectedValue);
    }
  }
</script>

<div class="icon-grid-selector">
  {#each options as option (option.value)}
    <div 
      class="grid-item-wrapper"
      class:selected={selectedValue === option.value}
      on:click={() => handleClick(option.value)}
      on:keydown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleClick(option.value); }}
      role="radio"
      aria-checked={selectedValue === option.value}
      tabindex={0}
      aria-label={option.label}
    >
      <IconButton
        src={option.iconSrc}
        label={option.label}
        callback={() => handleClick(option.value)} 
        active={true} 
      />
    </div>
  {/each}
</div>

<style lang="scss">
  .icon-grid-selector {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 1.25rem;
    max-width: 500px;
    margin: auto;
    width: 100%;
  }

  .grid-item-wrapper {
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 4px;
    border: 2px solid transparent;
    border-radius: 2.25rem;
    cursor: pointer;
    transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    outline: none;

    &:hover {
      transform: translateY(-2px);
    }

    &.selected {
      border-color: var(--color-highlight-2);
      background: rgba(var(--color-highlight-2-rgb), 0.1);
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3);

      :global(.icon-button) {
        background: rgba(var(--color-highlight-2-rgb), 0.15);
        border-color: rgba(var(--color-highlight-2-rgb), 0.3);
      }
    }

    &:focus-visible {
      box-shadow: 0 0 0 4px rgba(var(--color-highlight-2-rgb), 0.2);
    }
  }
  /* IconButton's 'active' prop is true by default, so it should be clickable. */
  /* The callback on IconButton is redundant if the wrapper handles click, but harmless. */
</style>
