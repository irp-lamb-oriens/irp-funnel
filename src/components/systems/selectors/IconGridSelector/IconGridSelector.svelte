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
    grid-template-columns: repeat(2, 1fr); /* 2x2 grid */
    gap: 1rem; /* Adjust gap as needed */
    max-width: 400px; /* Or adjust as needed */
    margin: auto;
  }

  .grid-item-wrapper {
    display: flex; /* To help center IconButton if its own width is less than grid cell */
    justify-content: center;
    align-items: center;
    padding: 0.5rem; /* Padding around the button for click area and visual spacing */
    border: 2px solid transparent; /* Default border */
    border-radius: 8px; /* Match IconButton or define new */
    cursor: pointer;
    transition: border-color 0.2s ease-in-out, background-color 0.2s ease-in-out;

    &:focus, &:focus-within {
      outline: 2px solid var(--color-focus, blue); /* Basic focus indicator */
    }
  }

  /* Placeholder for selected styling - you can customize this */
  .grid-item-wrapper.selected {
    border-color: var(--color-primary, #007bff); /* Example: Blue border when selected */
    background-color: rgba(0, 123, 255, 0.1); /* Example: Light blue background */
    
    /* You might want to style the IconButton itself when selected, e.g.: */
    /* :global(.icon-button) { ... } */
  }

  /* Ensure IconButton itself doesn't have pointer-events: none if it's inside a clickable wrapper */
  /* IconButton's 'active' prop is true by default, so it should be clickable. */
  /* The callback on IconButton is redundant if the wrapper handles click, but harmless. */
</style>
