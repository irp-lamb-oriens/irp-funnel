<!--
  EvoView.svelte
  ────────────────────────────────────────────────────────────────────────────
  Top-level view for the "Evo" dashboard section — the evolutionary UI
  sales-attribution observatory.

  Composition (top to bottom):
    1. EvoSmartExplorer  — ask a question in plain English
    2. EvoFiltersBar     — manual filter controls (drives the rest of the view)
    3. EvoTimelineGraph  — the clickable timeline; click a node to open the drawer
    4. EvoLeaderboard    — ranked winners under current filters
    5. EvoNodeDrawer     — overlay that appears when a timeline node is clicked
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import EvoFiltersBar from './EvoFiltersBar.svelte';
	import EvoSmartExplorer from './EvoSmartExplorer.svelte';
	import EvoTimelineGraph from './EvoTimelineGraph.svelte';
	import EvoLeaderboard from './EvoLeaderboard.svelte';
	import EvoNodeDrawer from './EvoNodeDrawer.svelte';
	import {
		evoNodeDrilldown,
		evoSegmented,
		evoLoading,
		evoError,
		fetchComponents,
		fetchTimeline,
		fetchLeaderboard,
		fetchNode,
	} from './evoStore.ts';
	import type { AttributionRow } from './evoStore.ts';

	onMount(async () => {
		await fetchComponents();
		await Promise.all([fetchTimeline(), fetchLeaderboard()]);
	});

	function closeDrawer() {
		evoNodeDrilldown.set(null);
	}

	async function expandLeaderboardRow(row: AttributionRow) {
		// Use the current granularity's most-recent bucket as the drill-in target.
		// If we don't have timeline data yet, this falls back to a sane empty result.
		await fetchNode(row.componentKey, row.versionKey, row.commitHash, '*all*');
	}
</script>

<div class="evo-view">
	<div class="evo-view__header">
		<h2>Evo — evolutionary UI sales attribution</h2>
		<p>
			Every UI variant you ship is logged with exposures, interactions and the commit it was introduced
			in. Evo joins that with paid consultations to show which (component × variant × commit) combination
			actually drove sales — with the users behind every number.
		</p>
	</div>

	{#if $evoError}
		<div class="evo-view__error">{$evoError}</div>
	{/if}

	<EvoSmartExplorer />
	<EvoFiltersBar />

	{#if $evoLoading}
		<div class="evo-view__loading">Loading…</div>
	{/if}

	<EvoTimelineGraph />
	
		{#if $evoSegmented && $evoSegmented.segments.length > 0}
			<div class="evo-segments-grid">
				{#each $evoSegmented.segments as seg}
					<div class="evo-segment-card">
						<EvoLeaderboard
							rows={seg.rows}
							title={seg.segment}
							subtitle={`${seg.totals.uniqueVisitors} visitors · ${seg.totals.paidVisitors} consultations`}
							onExpand={expandLeaderboardRow}
						/>
					</div>
				{/each}
			</div>
		{:else}
		<EvoLeaderboard onExpand={expandLeaderboardRow} />
	{/if}

	<EvoNodeDrawer onClose={closeDrawer} />
</div>

<style>
	.evo-view {
		padding: 20px 24px 60px;
		background: #020617;
		min-height: calc(100vh - 60px);
		color: #e2e8f0;
	}
	.evo-view__header h2 {
		font-size: 22px;
		margin: 0 0 6px;
		color: #e2e8f0;
	}
	.evo-view__header p {
		font-size: 13px;
		color: #94a3b8;
		margin: 0 0 20px;
		max-width: 880px;
		line-height: 1.5;
	}
	.evo-view__error {
		background: rgba(239, 68, 68, 0.12);
		border: 1px solid rgba(239, 68, 68, 0.4);
		color: #fca5a5;
		padding: 10px 14px;
		border-radius: 8px;
		font-size: 13px;
		margin-bottom: 16px;
	}
	.evo-view__loading {
		color: #94a3b8;
		font-size: 12px;
		text-align: center;
		padding: 8px 0 18px;
	}
	.evo-segments-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
		gap: 24px;
	}
	.evo-segment-card {
		min-width: 0;
	}
</style>
