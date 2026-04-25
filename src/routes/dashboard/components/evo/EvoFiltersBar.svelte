<!--
  EvoFiltersBar.svelte
  ────────────────────────────────────────────────────────────────────────────
  Single filter bar that drives the shared `evoFilters` store. Changes here
  automatically propagate to the timeline, leaderboard and node drill-down.
-->
<script lang="ts">
	import {
		evoFilters,
		evoComponents,
		DEFAULT_FILTERS,
		fetchLeaderboard,
		fetchTimeline,
		fetchSegments,
	} from './evoStore.ts';

	async function apply() {
		await Promise.all([fetchTimeline(), fetchLeaderboard(), fetchSegments()]);
	}
	function reset() {
		$evoFilters = { ...DEFAULT_FILTERS };
		void apply();
	}

	$: component = $evoComponents.find((c) => c.componentKey === $evoFilters.componentKey);
	$: variants = component?.variants ?? [];
</script>

<div class="evo-filters">
	<div class="evo-filters__row">
		<label>
			<span>Granularity</span>
			<select bind:value={$evoFilters.granularity}>
				<option value="day">Daily</option>
				<option value="week">Weekly</option>
				<option value="month">Monthly</option>
				<option value="year">Yearly</option>
			</select>
		</label>

		<label>
			<span>Component</span>
			<select bind:value={$evoFilters.componentKey}>
				<option value="">All components</option>
				{#each $evoComponents as c}
					<option value={c.componentKey}>{c.componentKey}</option>
				{/each}
			</select>
		</label>

		<label>
			<span>Variant</span>
			<select bind:value={$evoFilters.versionKey} disabled={!variants.length}>
				<option value="">All variants</option>
				{#each variants as v}
					<option value={v.key}>{v.label || v.key}</option>
				{/each}
			</select>
		</label>

		<label>
			<span>Commit</span>
			<input type="text" bind:value={$evoFilters.commitHash} placeholder="commit hash (optional)" />
		</label>

		<label>
			<span>Sort by</span>
			<select bind:value={$evoFilters.sortBy}>
				<option value="conversionRate">Conversion %</option>
				<option value="revenueUsd">Pipeline Value (USD)</option>
				<option value="paidVisitors">Consultations</option>
				<option value="engagementRate">Engagement %</option>
				<option value="exposures">Exposures</option>
			</select>
		</label>

		<label>
			<span>Segment by</span>
			<select bind:value={$evoFilters.segmentBy} on:change={apply}>
				<option value="">None (Global)</option>
				<option value="originCountry">Origin Country</option>
				<option value="destinationCountry">Destination Country</option>
				<option value="pagePath">Page Path</option>
			</select>
		</label>
	</div>

	<div class="evo-filters__row evo-filters__row--secondary">
		<label>
			<span>From</span>
			<input type="date" bind:value={$evoFilters.from} />
		</label>
		<label>
			<span>To</span>
			<input type="date" bind:value={$evoFilters.to} />
		</label>
		<label>
			<span>Min sample</span>
			<input type="number" min="0" bind:value={$evoFilters.minSampleSize} />
		</label>
		<label>
			<span>Attribution window (days)</span>
			<input type="number" min="1" max="365" bind:value={$evoFilters.attributionWindowDays} />
		</label>
		<label>
			<span>Paid origin</span>
			<input type="text" bind:value={$evoFilters.paidOriginCountry} placeholder="US, ES, CR…" />
		</label>
		<label>
			<span>Paid destination</span>
			<input type="text" bind:value={$evoFilters.paidDestinationCountry} placeholder="US, ES, CR…" />
		</label>

		<div class="evo-filters__actions">
			<button class="evo-btn evo-btn--primary" type="button" on:click={apply}>Apply</button>
			<button class="evo-btn" type="button" on:click={reset}>Reset</button>
		</div>
	</div>
</div>

<style>
	.evo-filters {
		background: #0f172a;
		border: 1px solid #1e293b;
		border-radius: 12px;
		padding: 16px;
		margin-bottom: 18px;
	}
	.evo-filters__row {
		display: flex;
		flex-wrap: wrap;
		gap: 12px;
		align-items: flex-end;
	}
	.evo-filters__row + .evo-filters__row {
		margin-top: 12px;
	}
	.evo-filters label {
		display: flex;
		flex-direction: column;
		gap: 4px;
		font-size: 11px;
		color: #94a3b8;
		min-width: 140px;
	}
	.evo-filters input,
	.evo-filters select {
		background: #020617;
		color: #e2e8f0;
		border: 1px solid #334155;
		border-radius: 6px;
		padding: 6px 8px;
		font-size: 13px;
	}
	.evo-filters input:focus,
	.evo-filters select:focus {
		outline: none;
		border-color: #6366f1;
	}
	.evo-filters__actions {
		display: flex;
		gap: 8px;
		margin-left: auto;
	}
	.evo-btn {
		padding: 8px 14px;
		background: #1e293b;
		color: #e2e8f0;
		border: 1px solid #334155;
		border-radius: 6px;
		cursor: pointer;
		font-size: 13px;
	}
	.evo-btn:hover {
		background: #334155;
	}
	.evo-btn--primary {
		background: linear-gradient(135deg, #6366f1, #8b5cf6);
		border-color: transparent;
	}
	.evo-btn--primary:hover {
		filter: brightness(1.15);
	}
</style>
