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

<style lang="scss">
	.evo-filters {
		background: rgba(15, 23, 42, 0.4);
		border: 1px solid rgba(255, 255, 255, 0.05);
		border-radius: 16px;
		padding: 24px;
		margin-bottom: 24px;
		backdrop-filter: blur(12px);
		box-shadow: 0 4px 24px -8px rgba(0, 0, 0, 0.5);
	}
	.evo-filters__row {
		display: flex;
		flex-wrap: wrap;
		gap: 16px;
		align-items: flex-end;
	}
	.evo-filters__row + .evo-filters__row {
		margin-top: 20px;
		padding-top: 20px;
		border-top: 1px solid rgba(255, 255, 255, 0.05);
	}
	.evo-filters label {
		display: flex;
		flex-direction: column;
		gap: 8px;
		font-size: 12px;
		font-weight: 600;
		color: #94a3b8;
		min-width: 160px;
		flex: 1;
	}
	.evo-filters input,
	.evo-filters select {
		background: rgba(2, 6, 23, 0.5);
		color: #f8fafc;
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 8px;
		padding: 10px 12px;
		font-size: 14px;
		transition: all 0.2s ease;
		appearance: none;

		&:focus {
			outline: none;
			border-color: #6366f1;
			background: rgba(2, 6, 23, 0.8);
			box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15);
		}
	}
	.evo-filters select {
		background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2394a3b8'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E");
		background-repeat: no-repeat;
		background-position: right 12px center;
		background-size: 16px;
		padding-right: 40px;
	}
	.evo-filters__actions {
		display: flex;
		gap: 12px;
		margin-left: auto;
		flex: 0 0 auto;
	}
	.evo-btn {
		padding: 10px 20px;
		background: rgba(255, 255, 255, 0.05);
		color: #e2e8f0;
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 8px;
		cursor: pointer;
		font-size: 14px;
		font-weight: 600;
		transition: all 0.2s ease;

		&:hover {
			background: rgba(255, 255, 255, 0.1);
			transform: translateY(-1px);
		}
	}
	.evo-btn--primary {
		background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
		border-color: transparent;
		color: #fff;
		box-shadow: 0 4px 12px rgba(99, 102, 241, 0.2);

		&:hover {
			filter: brightness(1.1);
			box-shadow: 0 6px 16px rgba(99, 102, 241, 0.3);
		}
	}
</style>
