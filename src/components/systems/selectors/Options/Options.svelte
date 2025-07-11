<script lang="ts">
  import { writable, type Writable } from 'svelte/store';
  import { onDestroy } from 'svelte';

  /** Options to render: { "Label": "value" } */
  export let options: Record<string, string>;

  /** Optional store supplied by the parent.
   *  If none is passed, we create a local one so the component still works standalone. */
  export let selected: Writable<string | undefined> = writable(undefined);

  /** Unique <input name> so multiple RadioOptions on the same page don’t clash. */
  export let groupName: string =
    'radio-options-group-' + Math.random().toString(36).slice(2, 15);

  /** Local mirror for bind:group on each <input>. */
  let internalSelectedValue: string | undefined;

  /* ---------- two-way wiring between store and local value ---------- */
  const unsubscribe = selected.subscribe(value => {
    if (value !== internalSelectedValue) internalSelectedValue = value;
  });

  function handleChange(event: Event) {
    const { value } = event.target as HTMLInputElement;
    internalSelectedValue = value;
    selected.set(value);          // propagate to whoever owns the store
  }

  onDestroy(unsubscribe);
</script>

<div class="options-container">
  {#each Object.entries(options) as [label, value] (value)}
    <label class="option-label">
      <input
        type="radio"
        name={groupName}
        value={value}
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
    flex-direction: column;  /* parent can override for row layout */
    gap: 15px;
  }

  .option-label {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 1.1em;
    cursor: pointer;
    padding: 8px 12px;
    border: 1px solid transparent;
    border-radius: 4px;
    transition: background-color 0.2s ease-in-out;
  }

  .option-label:hover {
    background-color: rgba(0, 0, 0, 0.05);
  }

  .option-label input[type='radio'] {
    accent-color: var(--color-primary, #0077b5);
    width: 18px;
    height: 18px;
  }

  .option-label input[type='radio']:checked + .label-text {
    font-weight: bold;
  }
</style>
