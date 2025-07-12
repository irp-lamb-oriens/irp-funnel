<script lang="ts">
	import { writable, type Writable } from 'svelte/store';
	import { onDestroy } from 'svelte';

	export let options: Record<string, string>;
	export let selected: Writable<string | undefined> = writable(undefined);
	export let groupName =
		'radio-options-group-' + Math.random().toString(36).slice(2, 15);

	let internalSelected: string | undefined;

	const unsub = selected.subscribe(v => {
		if (v !== internalSelected) internalSelected = v;
	});

	function handleChange(e: Event) {
		const { value } = e.target as HTMLInputElement;
		console.log('[Options] user picked', value);   // DEBUG
		internalSelected = value;
		selected.set(value);
	}

	onDestroy(unsub);
</script>

<div class="options-container">
	{#each Object.entries(options) as [label, value] (value)}
		<label class="option-label">
			<input
				type="radio"
				name={groupName}
				value={value}
				bind:group={internalSelected}
				on:change={handleChange} />
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
