<!--
  EvoLeaderboard.svelte
  ────────────────────────────────────────────────────────────────────────────
  The canonical "which version drove the most sales" answer view.
  Ranked table of (component, version, commit) tuples with exposure /
  interaction / paid counts, conversion rate, engagement rate and a
  lift-vs-control delta.
-->
<script lang="ts">
	import {
		evoLeaderboard,
		fmtPct,
		fmtSignedPct,
		fmtUsd,
		winnerBadgeLabel,
		winnerBadgeColor,
	} from './evoStore.ts';
	import type { AttributionRow } from './evoStore.ts';

	export let rows: AttributionRow[] | null = null;
	export let title = 'Leaderboard';
	export let subtitle = 'Ranked (component × variant × commit) combinations — winners first.';
	export let onExpand: ((row: AttributionRow) => void) | null = null;

	$: displayRows = rows ?? $evoLeaderboard?.rows ?? [];
	$: totals = $evoLeaderboard?.totals;

	function fmtP(p: number): string {
		if (!isFinite(p)) return '—';
		if (p < 0.001) return 'p<.001';
		if (p < 0.01) return `p=${p.toFixed(3)}`;
		if (p < 1) return `p=${p.toFixed(2)}`;
		return 'p=—';
	}
</script>

<section class="evo-leaderboard">
	<header class="evo-leaderboard__head">
		<div>
			<h3>{title}</h3>
			<p>{subtitle}</p>
		</div>
		{#if totals}
      <div class="evo-leaderboard__totals">
        <span>Σ exposures: <b>{totals.exposures.toLocaleString()}</b></span>
        <span>Σ interactions: <b>{totals.interactions.toLocaleString()}</b></span>
        <span>Σ visitors: <b>{totals.uniqueVisitors.toLocaleString()}</b></span>
        <span>Σ consultations: <b>{totals.paidVisitors.toLocaleString()}</b></span>
        <span>Σ pipeline value: <b>{fmtUsd(totals.revenueUsd ?? 0)}</b></span>
      </div>
		{/if}
	</header>

	{#if displayRows.length === 0}
		<div class="evo-leaderboard__empty">
			No rows match these filters yet. Either widen the time range, relax min sample size,
			or wait for more traffic to accumulate.
		</div>
	{:else}
		<div class="evo-leaderboard__table-wrap">
			<table class="evo-leaderboard__table">
				<thead>
					<tr>
						<th class="rank">#</th>
						<th>Component</th>
						<th>Variant</th>
						<th>Verdict</th>
						<th>Commit</th>
            <th class="num">Visitors</th>
            <th class="num">Consultations</th>
            <th class="num">Pipeline Val</th>
            <th class="num">Conv %</th>
						<th class="num">Lift</th>
						<th class="num">Significance</th>
						<th />
					</tr>
				</thead>
				<tbody>
					{#each displayRows as row, i}
						<tr
							class:winner={row.winner === 'confirmed_winner'}
							class:candidate={row.winner === 'candidate_winner'}
							class:baseline={row.isBaseline}
						>
							<td class="rank">{i + 1}</td>
							<td class="mono">{row.componentKey}</td>
							<td class="mono"><span class="evo-pill">{row.versionKey}</span></td>
							<td>
								<span
									class="evo-verdict"
									style="background: {winnerBadgeColor(row.winner)}22; color: {winnerBadgeColor(row.winner)}; border-color: {winnerBadgeColor(row.winner)}55"
								>
									{winnerBadgeLabel(row.winner)}
								</span>
							</td>
							<td class="mono" title={row.commitMessage}>
								{row.commitHash?.split(',')[0]?.trim()?.slice(0, 8) || '—'}
								{#if row.commitHash?.includes(',')}
									<small class="evo-commit-msg" style="display:inline; margin-left: 2px;">+{row.commitHash.split(',').length - 1}</small>
								{/if}
								{#if row.commitMessage}
									<small class="evo-commit-msg">· {row.commitMessage}</small>
								{/if}
							</td>
							<td class="num">{row.uniqueVisitors.toLocaleString()}</td>
							<td class="num num--bold">{row.paidVisitors.toLocaleString()}</td>
							<td class="num num--bold">{fmtUsd(row.revenueUsd)}</td>
							<td class="num">{fmtPct(row.conversionRate)}</td>
							<td
								class="num"
								class:positive={row.liftVsControl > 0}
								class:negative={row.liftVsControl < 0}
							>
								{row.isBaseline ? '—' : fmtSignedPct(row.liftVsControl)}
							</td>
							<td class="num evo-sig" title={`z=${row.zScore.toFixed(2)}`}>
								{row.isBaseline ? 'baseline' : fmtP(row.pValue)}
							</td>
							<td>
								{#if onExpand}
									<button class="evo-btn-link" on:click={() => onExpand(row)}>Drill in →</button>
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</section>

<style lang="scss">
	.evo-leaderboard {
		background: rgba(15, 23, 42, 0.6);
		border: 1px solid rgba(255, 255, 255, 0.05);
		border-radius: 16px;
		padding: 24px;
		backdrop-filter: blur(12px);
		box-shadow: 0 4px 24px -8px rgba(0, 0, 0, 0.5);
	}
	.evo-leaderboard__head {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 20px;
		margin-bottom: 20px;
	}
	.evo-leaderboard__head h3 {
		font-size: 18px;
		font-weight: 700;
		color: #f8fafc;
		margin: 0 0 6px;
	}
	.evo-leaderboard__head p {
		font-size: 14px;
		color: #94a3b8;
		margin: 0;
	}
	.evo-leaderboard__totals {
		display: flex;
		flex-wrap: wrap;
		gap: 16px;
		font-size: 13px;
		color: #94a3b8;
		background: rgba(2, 6, 23, 0.4);
		padding: 10px 16px;
		border-radius: 8px;
		border: 1px solid rgba(255, 255, 255, 0.05);
	}
	.evo-leaderboard__totals b {
		color: #e2e8f0;
		font-weight: 700;
		margin-left: 4px;
	}
	.evo-leaderboard__empty {
		color: #94a3b8;
		font-size: 14px;
		padding: 40px;
		text-align: center;
		background: rgba(2, 6, 23, 0.5);
		border-radius: 12px;
		border: 1px dashed rgba(255, 255, 255, 0.1);
	}
	.evo-leaderboard__table-wrap {
		overflow-x: auto;
		border-radius: 12px;
		border: 1px solid rgba(255, 255, 255, 0.05);
		background: rgba(2, 6, 23, 0.3);
	}
	.evo-leaderboard__table {
		width: 100%;
		border-collapse: collapse;
		font-size: 13px;
	}
	.evo-leaderboard__table th,
	.evo-leaderboard__table td {
		padding: 14px 16px;
		border-bottom: 1px solid rgba(255, 255, 255, 0.05);
		text-align: left;
		transition: background 0.2s ease;
	}
	.evo-leaderboard__table th {
		color: #94a3b8;
		font-weight: 600;
		font-size: 12px;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		background: rgba(2, 6, 23, 0.8);
		border-bottom: 1px solid rgba(255, 255, 255, 0.1);
		white-space: nowrap;
	}
	.evo-leaderboard__table tr:last-child td {
		border-bottom: none;
	}
	.evo-leaderboard__table tbody tr:hover {
		background: rgba(255, 255, 255, 0.02);
	}
	.rank { width: 40px; color: #64748b; font-weight: 600; }
	.num { text-align: right; font-variant-numeric: tabular-nums; }
	.num--bold { font-weight: 700; color: #f8fafc; }
	.mono { font-family: ui-monospace, monospace; color: #cbd5e1; }
	.evo-pill {
		background: rgba(99, 102, 241, 0.1);
		border: 1px solid rgba(99, 102, 241, 0.3);
		color: #a5b4fc;
		padding: 4px 10px;
		border-radius: 999px;
		font-size: 12px;
		font-weight: 500;
		white-space: nowrap;
	}
	.winner {
		background: linear-gradient(90deg, rgba(16, 185, 129, 0.1), rgba(16, 185, 129, 0.02));
	}
	.winner td { color: #bbf7d0; }
	.candidate {
		background: linear-gradient(90deg, rgba(251, 191, 36, 0.08), rgba(251, 191, 36, 0.01));
	}
	.baseline td {
		color: #94a3b8;
		background: rgba(2, 6, 23, 0.4);
	}
	.evo-verdict {
		display: inline-flex;
		align-items: center;
		padding: 4px 10px;
		border-radius: 999px;
		font-size: 11px;
		font-weight: 700;
		border: 1px solid transparent;
		white-space: nowrap;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}
	.evo-sig { font-size: 12px; color: #64748b; font-weight: 500; }
	.positive { color: #10b981; font-weight: 600; }
	.negative { color: #ef4444; font-weight: 600; }
	.evo-commit-msg { 
		color: #64748b; 
		margin-left: 6px; 
		font-size: 11px;
		font-family: var(--font-sans, system-ui, sans-serif);
		display: block;
		margin-top: 4px;
	}
	.evo-btn-link {
		background: rgba(99, 102, 241, 0.1);
		border: 1px solid rgba(99, 102, 241, 0.2);
		color: #818cf8;
		cursor: pointer;
		font-size: 12px;
		font-weight: 600;
		padding: 6px 12px;
		border-radius: 6px;
		transition: all 0.2s ease;
		white-space: nowrap;

		&:hover { 
			background: rgba(99, 102, 241, 0.2);
			border-color: rgba(99, 102, 241, 0.4);
			color: #e0e7ff; 
		}
	}
</style>
