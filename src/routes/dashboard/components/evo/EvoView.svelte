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

<style lang="scss">
	.evo-view {
		padding: 32px 40px 80px;
		background: linear-gradient(180deg, #020617 0%, #090f24 100%);
		min-height: calc(100vh - 60px);
		color: #f8fafc;
		font-family: var(--font-sans, system-ui, sans-serif);
	}
	.evo-view__header {
		margin-bottom: 32px;
	}
	.evo-view__header h2 {
		font-size: 28px;
		font-weight: 800;
		margin: 0 0 12px;
		background: linear-gradient(135deg, #fff 0%, #94a3b8 100%);
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		letter-spacing: -0.02em;
	}
	.evo-view__header p {
		font-size: 15px;
		color: #cbd5e1;
		margin: 0;
		max-width: 720px;
		line-height: 1.6;
		font-weight: 400;
	}
	.evo-view__error {
		background: rgba(239, 68, 68, 0.1);
		border: 1px solid rgba(239, 68, 68, 0.3);
		color: #fca5a5;
		padding: 14px 20px;
		border-radius: 12px;
		font-size: 14px;
		margin-bottom: 24px;
		backdrop-filter: blur(8px);
	}
	.evo-view__loading {
		color: #94a3b8;
		font-size: 14px;
		text-align: center;
		padding: 20px 0 30px;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 12px;

		&::after {
			content: "";
			width: 16px;
			height: 16px;
			border: 2px solid #334155;
			border-top-color: #818cf8;
			border-radius: 50%;
			animation: evoSpin 0.8s linear infinite;
		}
	}
	.evo-segments-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(480px, 1fr));
		gap: 32px;
		margin-top: 32px;
	}
	.evo-segment-card {
		min-width: 0;
		animation: evoFadeInUp 0.6s cubic-bezier(0.16, 1, 0.3, 1);
	}

	@keyframes evoSpin {
		to { transform: rotate(360deg); }
	}
	@keyframes evoFadeInUp {
		from { opacity: 0; transform: translateY(16px); }
		to { opacity: 1; transform: translateY(0); }
	}
</style>
