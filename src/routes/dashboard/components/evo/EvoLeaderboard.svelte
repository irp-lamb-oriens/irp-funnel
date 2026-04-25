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
								{row.commitHash?.slice(0, 8) || '—'}
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

<style>
	.evo-leaderboard {
		background: #0f172a;
		border: 1px solid #1e293b;
		border-radius: 12px;
		padding: 16px 18px;
	}
	.evo-leaderboard__head {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 18px;
		margin-bottom: 12px;
	}
	.evo-leaderboard__head h3 {
		font-size: 16px;
		color: #e2e8f0;
		margin: 0 0 4px;
	}
	.evo-leaderboard__head p {
		font-size: 12px;
		color: #94a3b8;
		margin: 0;
	}
	.evo-leaderboard__totals {
		display: flex;
		flex-wrap: wrap;
		gap: 14px;
		font-size: 12px;
		color: #94a3b8;
	}
	.evo-leaderboard__totals b {
		color: #e2e8f0;
		font-weight: 600;
	}
	.evo-leaderboard__empty {
		color: #64748b;
		font-size: 13px;
		padding: 24px;
		text-align: center;
		background: #020617;
		border-radius: 8px;
	}
	.evo-leaderboard__table-wrap {
		overflow-x: auto;
	}
	.evo-leaderboard__table {
		width: 100%;
		border-collapse: collapse;
		font-size: 12px;
	}
	.evo-leaderboard__table th,
	.evo-leaderboard__table td {
		padding: 8px 10px;
		border-bottom: 1px solid #1e293b;
		color: #cbd5e1;
		text-align: left;
	}
	.evo-leaderboard__table th {
		color: #94a3b8;
		font-weight: 600;
		font-size: 11px;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		background: #020617;
	}
	.rank { width: 32px; }
	.num { text-align: right; font-variant-numeric: tabular-nums; }
	.num--bold { font-weight: 700; color: #e2e8f0; }
	.mono { font-family: ui-monospace, monospace; }
	.evo-pill {
		background: rgba(99, 102, 241, 0.18);
		border: 1px solid rgba(99, 102, 241, 0.4);
		color: #c7d2fe;
		padding: 2px 8px;
		border-radius: 999px;
		font-size: 11px;
	}
	.winner {
		background: linear-gradient(90deg, rgba(16, 185, 129, 0.14), transparent);
	}
	.winner td { color: #bbf7d0; }
	.candidate {
		background: linear-gradient(90deg, rgba(251, 191, 36, 0.1), transparent);
	}
	.baseline td {
		color: #cbd5e1;
		background: rgba(148, 163, 184, 0.04);
	}
	.evo-verdict {
		display: inline-block;
		padding: 2px 8px;
		border-radius: 999px;
		font-size: 10.5px;
		font-weight: 600;
		border: 1px solid transparent;
		white-space: nowrap;
	}
	.evo-sig { font-size: 11px; color: #94a3b8; }
	.positive { color: #34d399; }
	.negative { color: #f87171; }
	.evo-commit-msg { color: #64748b; margin-left: 4px; font-size: 10px; }
	.evo-btn-link {
		background: transparent;
		border: none;
		color: #818cf8;
		cursor: pointer;
		font-size: 12px;
	}
	.evo-btn-link:hover { color: #c7d2fe; }
</style>
