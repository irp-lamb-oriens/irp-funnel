<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let options: Record<string, string>; // { label: value }
  export let selectedValue: string | undefined = undefined;
  export let groupName: string = "radio-options-group-" + Math.random().toString(36).substring(2, 15); // Unique group name

  const dispatch = createEventDispatcher<{ update: string }>();

  let internalSelectedValue = selectedValue;

  function handleChange(event: Event) {
    const target = event.target as HTMLInputElement;
    internalSelectedValue = target.value;
    dispatch('update', internalSelectedValue);
  }

  // React to external changes to selectedValue
  $: {
    if (selectedValue !== undefined && selectedValue !== internalSelectedValue) {
      internalSelectedValue = selectedValue;
    }
  }
</script>

<div class="options-container">
  {#each Object.entries(options) as [label, value] (value)}
    <label class="option-label">
      <input
        type="radio"
        name={groupName}
        {value}
        bind:group={internalSelectedValue}
        on:change={handleChange}
      />
      <span class="label-text">{label}</span>
    </label>
  {/each}
</div>

<style>
  .options-container {
    display: flex;
    flex-direction: column; /* Default: column. Can be overridden by parent for row display. */
    gap: 15px; /* Default gap, can be overridden */
    /* Styles from SexInputStage for a row layout (if parent applies .horizontal-options) */
    /* justify-content: center; */ /* This might be too specific for a general component */
    /* width: 100%; */ /* This might be too specific for a general component */
  }

  .option-label {
    display: flex;
    align-items: center;
    gap: 8px; /* From SexInputStage */
    font-size: 1.1em; /* From SexInputStage */
    cursor: pointer;
    padding: 8px 12px; /* Keep some padding for click area */
    border: 1px solid transparent; /* Default to transparent, can be styled by parent */
    border-radius: 4px;
    transition: background-color 0.2s ease-in-out;
  }

  .option-label:hover {
    background-color: rgba(0, 0, 0, 0.05); /* Subtle hover */
  }

  .option-label input[type="radio"] {
    accent-color: var(--color-primary, #0077b5); /* From SexInputStage, with var fallback */
    width: 18px; /* From SexInputStage */
    height: 18px; /* From SexInputStage */
    margin-right: 0; /* Gap is handled by parent .option-label */
  }

  .option-label input[type="radio"]:checked + .label-text {
    font-weight: bold;
  }
  
  .label-text {
    /* font-size is now on .option-label */
  }

  /* Example for parent to make options horizontal like in SexInputStage */
  /*
  :global(.horizontal-options.options-container) {
    flex-direction: row;
    justify-content: center;
    gap: 25px;
    width: 100%;
  }
  */
  /* If you want to apply horizontal styling directly when a prop is set:
     e.g., export let layout: 'vertical' | 'horizontal' = 'vertical';
  */
  /*
  .options-container.horizontal {
    flex-direction: row;
    justify-content: center;
    gap: 25px;
    width: 100%;
  }
  */
</style>
