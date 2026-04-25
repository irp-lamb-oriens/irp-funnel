<!--
  EvoNodeDrawer.svelte
  ────────────────────────────────────────────────────────────────────────────
  Side drawer opened when a timeline node is clicked. Shows:
    • the (component, variant, commit, bucket) tuple in focus
    • aggregate counts + conversion rate
    • list of participating visitors + whether they paid
    • list of paid emails linked to that variant (with budget/route context)
    • commit metadata (message, GitHub link)
-->
<script lang="ts">
	import { evoNodeDrilldown, fmtPct } from './evoStore.ts';
	export let onClose: () => void;
	export let githubRepoUrl = 'https://github.com/irp-lamb-oriens/irp-parent-funnel';

	$: drill = $evoNodeDrilldown;

	function commitLink(hash: string): string {
		return `${githubRepoUrl}/commit/${hash}`;
	}

	function fmtDate(iso: string): string {
		if (!iso) return '—';
		return new Date(iso).toLocaleString(undefined, {
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
		});
	}
</script>

{#if drill}
	<div class="evo-drawer" role="dialog" aria-label="Evo node drill-down">
		<div class="evo-drawer__backdrop" on:click={onClose} role="button" tabindex="-1" />
		<aside class="evo-drawer__panel">
			<header class="evo-drawer__head">
				<div>
					<h3>Node drill-down</h3>
					<p class="evo-drawer__bucket">Bucket: <b>{drill.bucket}</b></p>
				</div>
				<button class="evo-drawer__close" on:click={onClose}>✕</button>
			</header>

			{#if drill.row}
				<section class="evo-drawer__kpis">
					<div class="evo-drawer__kpi">
						<small>Component × variant</small>
						<strong class="mono">{drill.row.componentKey} · {drill.row.versionKey}</strong>
					</div>
					<div class="evo-drawer__kpi">
						<small>Commit</small>
						<strong class="mono">
							<a href={commitLink(drill.row.commitHash)} target="_blank" rel="noopener noreferrer">
								{drill.row.commitHash.slice(0, 8) || '—'}
							</a>
						</strong>
						{#if drill.row.commitMessage}<small class="evo-drawer__commit-msg">{drill.row.commitMessage}</small>{/if}
					</div>
					<div class="evo-drawer__kpi">
						<small>Exposures</small>
						<strong>{drill.row.exposures.toLocaleString()}</strong>
					</div>
					<div class="evo-drawer__kpi">
						<small>Interactions</small>
						<strong>{drill.row.interactions.toLocaleString()}</strong>
					</div>
					<div class="evo-drawer__kpi evo-drawer__kpi--accent">
						<small>Consultations</small>
						<strong>{drill.row.paidVisitors.toLocaleString()} <em>of {drill.row.uniqueVisitors}</em></strong>
					</div>
					<div class="evo-drawer__kpi evo-drawer__kpi--accent">
						<small>Conversion</small>
						<strong>{fmtPct(drill.row.conversionRate)}</strong>
					</div>
				</section>

				<section class="evo-drawer__section">
					<h4>Consultations attributed to this variant</h4>
					{#if drill.row.paidEmails.length === 0}
						<p class="evo-drawer__muted">No consultations matched yet in the attribution window.</p>
					{:else}
						<table class="evo-drawer__table">
							<thead>
								<tr>
									<th>Email</th>
									<th>Name</th>
									<th>Route</th>
									<th>Budget</th>
									<th>Paid at</th>
									<th>Stage</th>
								</tr>
							</thead>
							<tbody>
								{#each drill.row.paidEmails as p}
									<tr>
										<td class="mono">{p.email}</td>
										<td>{p.name || '—'}</td>
										<td>{p.originCountry || '—'} → {p.destinationCountry || '—'}</td>
										<td>{p.budget || '—'}</td>
										<td>{fmtDate(p.paidAt)}</td>
										<td>{p.stage || '—'}</td>
									</tr>
								{/each}
							</tbody>
						</table>
					{/if}
				</section>
			{/if}

			{#if drill.row}
				<section class="evo-drawer__section">
					<h4>Conversion Funnel</h4>
					<div class="evo-funnel">
						<div class="evo-funnel-step">
							<div class="evo-funnel-label">Exposed</div>
							<div class="evo-funnel-bar">
								<div class="evo-funnel-fill" style="width: 100%"></div>
							</div>
							<div class="evo-funnel-val">{drill.row.funnel.exposed.toLocaleString()}</div>
						</div>
						<div class="evo-funnel-step">
							<div class="evo-funnel-label">Interacted</div>
							<div class="evo-funnel-bar">
								<div class="evo-funnel-fill" style="width: {drill.row.funnel.exposed ? (drill.row.funnel.interacted / drill.row.funnel.exposed) * 100 : 0}%"></div>
							</div>
							<div class="evo-funnel-val">{drill.row.funnel.interacted.toLocaleString()}</div>
						</div>
						<div class="evo-funnel-step">
							<div class="evo-funnel-label">Consultation</div>
							<div class="evo-funnel-bar">
								<div class="evo-funnel-fill" style="width: {drill.row.funnel.exposed ? (drill.row.funnel.paid / drill.row.funnel.exposed) * 100 : 0}%"></div>
							</div>
							<div class="evo-funnel-val">{drill.row.funnel.paid.toLocaleString()}</div>
						</div>
					</div>
				</section>
			{/if}

			<section class="evo-drawer__section">
				<h4>Visitors exposed in this bucket ({drill.visitors.length})</h4>
				{#if drill.visitors.length === 0}
					<p class="evo-drawer__muted">No visitors recorded for this bucket.</p>
				{:else}
					<table class="evo-drawer__table">
						<thead>
							<tr>
								<th>Visitor ID</th>
								<th>Email</th>
								<th>First seen</th>
								<th class="num">Interactions</th>
							</tr>
						</thead>
						<tbody>
							{#each drill.visitors as v}
								<tr>
									<td class="mono">{v.visitorId.slice(0, 16)}…</td>
									<td class="mono">{v.email || '—'}</td>
									<td>{fmtDate(v.firstSeen)}</td>
									<td class="num">{v.interactions}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				{/if}
			</section>
		</aside>
	</div>
{/if}

<style>
	.evo-drawer {
		position: fixed;
		inset: 0;
		z-index: 100;
		display: flex;
		justify-content: flex-end;
	}
	.evo-drawer__backdrop {
		position: absolute;
		inset: 0;
		background: rgba(2, 6, 23, 0.55);
		backdrop-filter: blur(2px);
	}
	.evo-drawer__panel {
		position: relative;
		width: min(860px, 92vw);
		height: 100vh;
		overflow-y: auto;
		background: #0f172a;
		border-left: 1px solid #1e293b;
		padding: 20px 22px 40px;
		box-shadow: -20px 0 60px rgba(0, 0, 0, 0.4);
	}
	.evo-drawer__head {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 16px;
		padding-bottom: 14px;
		border-bottom: 1px solid #1e293b;
	}
	.evo-drawer__head h3 {
		margin: 0;
		font-size: 16px;
		color: #e2e8f0;
	}
	.evo-drawer__bucket {
		margin: 4px 0 0;
		font-size: 12px;
		color: #94a3b8;
	}
	.evo-drawer__close {
		background: transparent;
		border: 1px solid #334155;
		color: #94a3b8;
	}
	.evo-drawer__close {
		width: 32px;
		height: 32px;
		border-radius: 8px;
		cursor: pointer;
	}
	.evo-drawer__close:hover { background: #1e293b; color: #e2e8f0; }

	.evo-funnel { margin-top: 12px; display: flex; flex-direction: column; gap: 8px; }
	.evo-funnel-step { display: flex; align-items: center; gap: 12px; }
	.evo-funnel-label { width: 80px; font-size: 11px; color: #94a3b8; text-align: right; }
	.evo-funnel-bar { flex: 1; height: 12px; background: rgba(255,255,255,0.05); border-radius: 6px; overflow: hidden; }
	.evo-funnel-fill { height: 100%; background: #6366f1; border-radius: 6px; transition: width 0.3s ease; }
	.evo-funnel-val { width: 40px; font-size: 11px; color: #e2e8f0; font-weight: 600; text-align: right; font-variant-numeric: tabular-nums; }

	.evo-drawer__kpis {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 10px;
		margin: 18px 0 22px;
	}
	.evo-drawer__kpi {
		background: #020617;
		border: 1px solid #1e293b;
		border-radius: 8px;
		padding: 10px 12px;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.evo-drawer__kpi small {
		color: #94a3b8;
		font-size: 10px;
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}
	.evo-drawer__kpi strong {
		color: #e2e8f0;
		font-size: 14px;
		word-break: break-all;
	}
	.evo-drawer__kpi--accent { border-color: rgba(16, 185, 129, 0.4); }
	.evo-drawer__kpi--accent strong { color: #bbf7d0; }
	.evo-drawer__kpi em { font-style: normal; color: #94a3b8; font-size: 11px; font-weight: 400; }
	.evo-drawer__commit-msg { color: #64748b; font-size: 11px; }
	.evo-drawer__section { margin-top: 18px; }
	.evo-drawer__section h4 {
		margin: 0 0 8px;
		font-size: 12px;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: #94a3b8;
	}
	.evo-drawer__muted {
		color: #64748b;
		font-size: 12px;
		margin: 0;
	}
	.evo-drawer__table {
		width: 100%;
		border-collapse: collapse;
		font-size: 12px;
	}
	.evo-drawer__table th,
	.evo-drawer__table td {
		padding: 6px 10px;
		border-bottom: 1px solid #1e293b;
		text-align: left;
		color: #cbd5e1;
	}
	.evo-drawer__table th {
		background: #020617;
		color: #94a3b8;
		font-size: 10px;
		letter-spacing: 0.05em;
		text-transform: uppercase;
	}
	.mono { font-family: ui-monospace, monospace; }
	.num { text-align: right; font-variant-numeric: tabular-nums; }
	a { color: #818cf8; }
	a:hover { color: #c7d2fe; }
</style>
