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

<style lang="scss">
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
		background: rgba(2, 6, 23, 0.4);
		backdrop-filter: blur(8px);
		transition: all 0.3s ease;
	}
	.evo-drawer__panel {
		position: relative;
		width: min(860px, 92vw);
		height: 100vh;
		overflow-y: auto;
		background: rgba(15, 23, 42, 0.85);
		backdrop-filter: blur(24px);
		border-left: 1px solid rgba(255, 255, 255, 0.1);
		padding: 32px 40px 60px;
		box-shadow: -20px 0 60px rgba(0, 0, 0, 0.4);
		animation: drawerSlideIn 0.4s cubic-bezier(0.16, 1, 0.3, 1);
	}
	
	@keyframes drawerSlideIn {
		from { transform: translateX(100%); }
		to { transform: translateX(0); }
	}

	.evo-drawer__head {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 20px;
		padding-bottom: 24px;
		border-bottom: 1px solid rgba(255, 255, 255, 0.05);
	}
	.evo-drawer__head h3 {
		margin: 0 0 8px;
		font-size: 22px;
		font-weight: 800;
		color: #f8fafc;
	}
	.evo-drawer__bucket {
		margin: 0;
		font-size: 14px;
		color: #94a3b8;
		
		b {
			color: #e2e8f0;
			background: rgba(255, 255, 255, 0.1);
			padding: 2px 8px;
			border-radius: 6px;
			margin-left: 4px;
		}
	}
	.evo-drawer__close {
		background: rgba(255, 255, 255, 0.05);
		border: 1px solid rgba(255, 255, 255, 0.1);
		color: #94a3b8;
		width: 36px;
		height: 36px;
		border-radius: 10px;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 0.2s ease;

		&:hover { 
			background: rgba(239, 68, 68, 0.1); 
			color: #fca5a5;
			border-color: rgba(239, 68, 68, 0.3);
			transform: scale(1.05);
		}
	}
	
	/* Funnel */
	.evo-funnel { 
		margin-top: 16px; 
		display: flex; 
		flex-direction: column; 
		gap: 12px;
		background: rgba(2, 6, 23, 0.3);
		padding: 20px;
		border-radius: 12px;
		border: 1px solid rgba(255, 255, 255, 0.05);
	}
	.evo-funnel-step { 
		display: flex; 
		align-items: center; 
		gap: 16px; 
	}
	.evo-funnel-label { 
		width: 100px; 
		font-size: 13px; 
		font-weight: 600;
		color: #94a3b8; 
		text-align: right; 
	}
	.evo-funnel-bar { 
		flex: 1; 
		height: 16px; 
		background: rgba(255, 255, 255, 0.05); 
		border-radius: 8px; 
		overflow: hidden;
		box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.2);
	}
	.evo-funnel-fill { 
		height: 100%; 
		background: linear-gradient(90deg, #6366f1, #3b82f6); 
		border-radius: 8px; 
		transition: width 0.6s cubic-bezier(0.16, 1, 0.3, 1); 
	}
	.evo-funnel-val { 
		width: 50px; 
		font-size: 13px; 
		color: #f8fafc; 
		font-weight: 700; 
		text-align: right; 
		font-variant-numeric: tabular-nums; 
	}

	/* KPIs */
	.evo-drawer__kpis {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
		gap: 16px;
		margin: 24px 0 32px;
	}
	.evo-drawer__kpi {
		background: rgba(2, 6, 23, 0.4);
		border: 1px solid rgba(255, 255, 255, 0.05);
		border-radius: 12px;
		padding: 16px;
		display: flex;
		flex-direction: column;
		gap: 6px;
		transition: transform 0.2s ease;

		&:hover {
			transform: translateY(-2px);
			background: rgba(2, 6, 23, 0.6);
			border-color: rgba(255, 255, 255, 0.1);
		}
	}
	.evo-drawer__kpi small {
		color: #94a3b8;
		font-size: 11px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}
	.evo-drawer__kpi strong {
		color: #f8fafc;
		font-size: 18px;
		word-break: break-all;
	}
	.evo-drawer__kpi--accent { 
		border-color: rgba(16, 185, 129, 0.3); 
		background: linear-gradient(180deg, rgba(16, 185, 129, 0.05), transparent);
	}
	.evo-drawer__kpi--accent strong { color: #10b981; }
	.evo-drawer__kpi em { font-style: normal; color: #64748b; font-size: 12px; font-weight: 500; margin-left: 4px; }
	.evo-drawer__commit-msg { color: #94a3b8; font-size: 12px; display: block; margin-top: 4px; font-family: var(--font-sans, system-ui, sans-serif); }
	
	/* Tables */
	.evo-drawer__section { 
		margin-top: 32px; 
		background: rgba(2, 6, 23, 0.2);
		border-radius: 16px;
		border: 1px solid rgba(255, 255, 255, 0.05);
		padding: 24px;
	}
	.evo-drawer__section h4 {
		margin: 0 0 16px;
		font-size: 14px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: #e2e8f0;
		display: flex;
		align-items: center;
		gap: 8px;

		&::before {
			content: '';
			display: inline-block;
			width: 8px;
			height: 8px;
			background: #6366f1;
			border-radius: 50%;
		}
	}
	.evo-drawer__muted {
		color: #64748b;
		font-size: 14px;
		margin: 0;
		padding: 24px;
		text-align: center;
		background: rgba(255, 255, 255, 0.02);
		border-radius: 8px;
	}
	.evo-drawer__table {
		width: 100%;
		border-collapse: collapse;
		font-size: 13px;
	}
	.evo-drawer__table th,
	.evo-drawer__table td {
		padding: 12px 16px;
		border-bottom: 1px solid rgba(255, 255, 255, 0.05);
		text-align: left;
		color: #cbd5e1;
	}
	.evo-drawer__table th {
		background: rgba(2, 6, 23, 0.6);
		color: #94a3b8;
		font-size: 11px;
		font-weight: 600;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		white-space: nowrap;
	}
	.evo-drawer__table tbody tr {
		transition: background 0.2s ease;
		&:hover { background: rgba(255, 255, 255, 0.02); }
	}
	.evo-drawer__table tr:last-child td {
		border-bottom: none;
	}
	.mono { font-family: ui-monospace, monospace; }
	.num { text-align: right; font-variant-numeric: tabular-nums; }
	
	a { 
		color: #818cf8; 
		text-decoration: none;
		transition: color 0.2s ease;
	}
	a:hover { color: #c7d2fe; text-decoration: underline; }
</style>
