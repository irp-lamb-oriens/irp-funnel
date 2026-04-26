<!--
  EvoTimelineGraph.svelte
  ────────────────────────────────────────────────────────────────────────────
  Horizontal timeline: X axis = time bucket (day/week/month/year), Y axis =
  component×variant track. Nodes are sized by exposure count and colored by
  conversion lift. Clicking a node opens the Node drawer (drill-down).

  Pure SVG, no external chart library — keeps the bundle small and gives us
  full control over commit-hash annotations.
-->
<script lang="ts">
	import { evoTimeline, timelineByVariant, fetchNode, evoFilters, fmtPct } from './evoStore.ts';
	import type { TimelinePoint } from './evoStore.ts';

	const ROW_HEIGHT = 36;
	const HEADER_HEIGHT = 32;
	const LEFT_PAD = 180;
	const TOP_PAD = 24;
	const RIGHT_PAD = 24;
	const MIN_RADIUS = 4;
	const MAX_RADIUS = 18;

	// State for collapsed components
	let collapsedComponents: Set<string> = new Set();
	function toggleComponent(compKey: string) {
		if (collapsedComponents.has(compKey)) {
			collapsedComponents.delete(compKey);
		} else {
			collapsedComponents.add(compKey);
		}
		collapsedComponents = collapsedComponents;
	}

	// Group tracks by ComponentKey first
	$: groupedTracks = (() => {
		const groups = new Map<string, Array<{ variantKey: string, points: TimelinePoint[] }>>();
		for (const [trackKey, points] of $timelineByVariant.entries()) {
			const [compKey, variantKey] = trackKey.split('|');
			if (!groups.has(compKey)) groups.set(compKey, []);
			groups.get(compKey)!.push({ variantKey, points });
		}
		
		// Sort components alphabetically, and variants within them
		const sorted = [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
		for (const [, variants] of sorted) {
			variants.sort((a, b) => a.variantKey.localeCompare(b.variantKey));
		}
		return sorted;
	})();

	$: buckets = [...new Set($evoTimeline.map((p) => p.bucket))].sort();
	$: maxExposures = Math.max(1, ...$evoTimeline.map((p) => p.exposures));

	// Calculate visible Y positions for elements based on collapse state
	$: layout = (() => {
		let currentY = TOP_PAD;
		const headers: Array<{ compKey: string, y: number }> = [];
		const visibleTracks: Array<{ compKey: string, variantKey: string, y: number, points: TimelinePoint[] }> = [];

		for (const [compKey, variants] of groupedTracks) {
			headers.push({ compKey, y: currentY });
			currentY += HEADER_HEIGHT;

			if (!collapsedComponents.has(compKey)) {
				for (const v of variants) {
					visibleTracks.push({
						compKey,
						variantKey: v.variantKey,
						y: currentY + ROW_HEIGHT / 2,
						points: v.points
					});
					currentY += ROW_HEIGHT;
				}
			}
		}

		return { headers, visibleTracks, totalHeight: currentY + TOP_PAD };
	})();

	$: width = Math.max(600, LEFT_PAD + RIGHT_PAD + Math.max(1, buckets.length) * 60);
	$: height = Math.max(200, layout.totalHeight);

	function xFor(bucket: string): number {
		const idx = buckets.indexOf(bucket);
		if (idx < 0) return LEFT_PAD;
		const usable = width - LEFT_PAD - RIGHT_PAD;
		const step = buckets.length === 1 ? usable / 2 : usable / (buckets.length - 1);
		return LEFT_PAD + idx * step;
	}
	function yFor(trackIndex: number): number {
		return TOP_PAD + trackIndex * ROW_HEIGHT + ROW_HEIGHT / 2;
	}
	function rFor(p: TimelinePoint): number {
		const f = p.exposures / maxExposures;
		return MIN_RADIUS + f * (MAX_RADIUS - MIN_RADIUS);
	}
	function colorFor(p: TimelinePoint): string {
		// Color scale: engagement rate maps from cold (blue) to hot (green).
		const eng = p.exposures ? p.interactions / p.exposures : 0;
		const clamped = Math.min(1, Math.max(0, eng));
		// lerp between indigo (#6366f1) and emerald (#34d399)
		const r = Math.round(0x63 + (0x34 - 0x63) * clamped);
		const g = Math.round(0x66 + (0xd3 - 0x66) * clamped);
		const b = Math.round(0xf1 + (0x99 - 0xf1) * clamped);
		return `rgb(${r}, ${g}, ${b})`;
	}

	async function onNodeClick(p: TimelinePoint) {
		$evoFilters = {
			...$evoFilters,
			granularity: $evoFilters.granularity,
			componentKey: p.componentKey,
			versionKey: p.versionKey,
			commitHash: p.commitHash,
		};
		await fetchNode(p.componentKey, p.versionKey, p.commitHash, p.bucket);
	}

	// Gather distinct commit hashes per bucket — rendered as subtle vertical markers.
	$: commitMarkers = (() => {
		const seen = new Map<string, { bucket: string; commitHash: string; commitMessage: string }>();
		for (const p of $evoTimeline) {
			const key = `${p.bucket}|${p.commitHash}`;
			if (!seen.has(key)) seen.set(key, { bucket: p.bucket, commitHash: p.commitHash, commitMessage: p.commitMessage });
		}
		return [...seen.values()];
	})();
</script>

<section class="evo-timeline">
	<header>
		<h3>Evolution timeline</h3>
		<p>
			Each row is a (component × variant) track. Node size = exposures, node color = engagement rate
			(indigo → green). Click a node to open the drill-down.
		</p>
	</header>

	{#if tracks.length === 0}
		<div class="evo-timeline__empty">
			No timeline data yet — instrument a component with <code>trackExposure()</code> + <code>trackInteraction()</code>
			and refresh.
		</div>
	{:else}
		<div class="evo-timeline__scroll">
			<svg
				{width}
				{height}
				viewBox="0 0 {width} {height}"
				preserveAspectRatio="none"
				role="img"
				aria-label="Evo timeline"
			>
				<!-- Commit markers (vertical dashed lines) -->
				{#each commitMarkers as m}
					<g class="evo-commit-marker">
						<line
							x1={xFor(m.bucket)}
							x2={xFor(m.bucket)}
							y1={TOP_PAD - 8}
							y2={height - TOP_PAD + 8}
							stroke="#475569"
							stroke-dasharray="3 3"
							stroke-width="1"
							opacity="0.5"
						/>
					</g>
				{/each}

				<!-- X axis labels -->
				{#each buckets as b}
					<text x={xFor(b)} y={height - 6} text-anchor="middle" fill="#94a3b8" font-size="11">
						{b}
					</text>
				{/each}

				<!-- Component Headers (Collapsible) -->
				{#each layout.headers as h}
					<g 
						class="evo-component-header" 
						on:click={() => toggleComponent(h.compKey)}
						role="button"
						tabindex="0"
					>
						<rect 
							x="0" 
							y={h.y} 
							width={LEFT_PAD - 10} 
							height={HEADER_HEIGHT - 4} 
							rx="4" 
							fill="rgba(255,255,255,0.03)" 
						/>
						<text 
							x="12" 
							y={h.y + HEADER_HEIGHT / 2 + 4} 
							fill="#f8fafc" 
							font-size="12" 
							font-weight="600"
						>
							{collapsedComponents.has(h.compKey) ? '▶' : '▼'} {h.compKey}
						</text>
					</g>
				{/each}

				<!-- Visible Tracks -->
				{#each layout.visibleTracks as track}
					<g class="evo-track">
						<!-- Variant name on the left -->
						<text 
							x={LEFT_PAD - 15} 
							y={track.y + 4} 
							text-anchor="end" 
							fill="#94a3b8" 
							font-size="11"
						>
							{track.variantKey}
						</text>
						
						<!-- Background track line -->
						<line
							x1={LEFT_PAD}
							x2={width - RIGHT_PAD}
							y1={track.y}
							y2={track.y}
							stroke="#1e293b"
							stroke-width="4"
							class="evo-track-line"
						>
							<title>{track.compKey} · {track.variantKey}</title>
						</line>
						
						<!-- Data nodes -->
						{#each track.points as p}
							<g class="evo-node" on:click={() => onNodeClick(p)} role="button" tabindex="0">
								<title>
									{p.componentKey} · {p.versionKey} · {p.commitHash?.slice(0, 8)}
									{'\n'}bucket: {p.bucket}
									{'\n'}exposures: {p.exposures}
									{'\n'}interactions: {p.interactions}
									{'\n'}visitors: {p.uniqueVisitors}
									{'\n'}engagement: {fmtPct(p.exposures ? p.interactions / p.exposures : 0)}
								</title>
								<circle
									cx={xFor(p.bucket)}
									cy={track.y}
									r={rFor(p)}
									fill={colorFor(p)}
									stroke="#020617"
									stroke-width="1.5"
								/>
							</g>
						{/each}
					</g>
				{/each}
			</svg>
		</div>

		<div class="evo-legend">
			<span class="evo-legend__dot" style="background: #6366f1;" />
			low engagement
			<span class="evo-legend__dot" style="background: #9ba0eb;" />
			<span class="evo-legend__dot" style="background: #6cbac8;" />
			<span class="evo-legend__dot" style="background: #34d399;" />
			high engagement
			<span class="evo-legend__spacer" />
			<span class="evo-legend__dot evo-legend__dot--sm" style="background: #94a3b8;" /> few exposures
			<span class="evo-legend__dot evo-legend__dot--lg" style="background: #94a3b8;" /> many exposures
		</div>
	{/if}
</section>

<style lang="scss">
	.evo-timeline {
		background: rgba(15, 23, 42, 0.4);
		border: 1px solid rgba(255, 255, 255, 0.05);
		border-radius: 16px;
		padding: 24px;
		margin-bottom: 24px;
		backdrop-filter: blur(12px);
		box-shadow: 0 4px 24px -8px rgba(0, 0, 0, 0.5);
	}
	.evo-timeline header h3 {
		margin: 0 0 6px;
		font-size: 18px;
		font-weight: 700;
		color: #f8fafc;
	}
	.evo-timeline header p {
		font-size: 14px;
		color: #94a3b8;
		margin: 0 0 20px;
		max-width: 600px;
		line-height: 1.5;
	}
	.evo-timeline__empty {
		padding: 32px;
		text-align: center;
		color: #64748b;
		font-size: 14px;
		background: rgba(2, 6, 23, 0.5);
		border-radius: 12px;
		border: 1px dashed rgba(255, 255, 255, 0.1);
	}
	.evo-timeline__empty code {
		background: rgba(255, 255, 255, 0.1);
		padding: 2px 6px;
		border-radius: 4px;
		font-family: ui-monospace, monospace;
		font-size: 13px;
		color: #e2e8f0;
	}
	.evo-timeline__scroll {
		overflow-x: auto;
		overflow-y: hidden;
		background: rgba(2, 6, 23, 0.3);
		border-radius: 12px;
		border: 1px solid rgba(255, 255, 255, 0.05);
		padding: 16px;
	}
	.evo-component-header {
		cursor: pointer;
		transition: opacity 0.2s ease;
	}
	.evo-component-header:hover rect {
		fill: rgba(255, 255, 255, 0.08);
	}
	.evo-node circle {
		cursor: pointer;
		transition: all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
		transform-origin: center;
		transform-box: fill-box;
	}
	.evo-node:hover circle {
		filter: brightness(1.3) drop-shadow(0 4px 12px rgba(99, 102, 241, 0.4));
		transform: scale(1.2);
		stroke: #fff;
		stroke-width: 2px;
	}
	.evo-legend {
		display: flex;
		align-items: center;
		gap: 10px;
		margin-top: 16px;
		font-size: 12px;
		color: #94a3b8;
		font-weight: 500;
	}
	.evo-legend__dot {
		display: inline-block;
		width: 10px;
		height: 10px;
		border-radius: 50%;
		box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.2);
	}
	.evo-legend__dot--sm { width: 6px; height: 6px; }
	.evo-legend__dot--lg { width: 14px; height: 14px; }
	.evo-legend__spacer { width: 24px; }
</style>
