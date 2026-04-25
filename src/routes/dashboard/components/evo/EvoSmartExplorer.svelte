<!--
  EvoSmartExplorer.svelte
  ────────────────────────────────────────────────────────────────────────────
  Free-text "ask a question, get the leaderboard" panel. Submits the query
  to POST /api/evo/explore which parses intent into filters and returns the
  ranked result. Shows the parsed filters as an explanation panel so upper
  management can audit what was understood before trusting the numbers.
-->
<script lang="ts">
	import { evoExplorerQuery, evoExplorerResult, runExplorer, evoLoading } from './evoStore.ts';
	import EvoLeaderboard from './EvoLeaderboard.svelte';

	const SUGGESTIONS = [
		'Which HeroForm variant drove the most sales last month?',
		'Best weekly conversion in the last 90 days',
		'Most engaged variant last year',
		'HeroForm v3-warm-copy sales from US this year',
		'Monthly conversion minimum 50 visitors last 6 months',
	];

	async function submit() {
		if (!$evoExplorerQuery.trim()) return;
		await runExplorer($evoExplorerQuery);
	}
	function applySuggestion(s: string) {
		$evoExplorerQuery = s;
		void submit();
	}
</script>

<section class="evo-explorer">
	<header>
		<h3>Smart explorer</h3>
		<p>
			Ask in plain English — the parser turns it into concrete filters + a ranked leaderboard. All
			decisions are shown so you can justify the numbers to upper management.
		</p>
	</header>

	<form class="evo-explorer__form" on:submit|preventDefault={submit}>
		<input
			type="text"
			bind:value={$evoExplorerQuery}
			placeholder='Try: "Which HeroForm variant drove the most sales last month?"'
			class="evo-explorer__input"
		/>
		<button class="evo-explorer__btn" type="submit" disabled={$evoLoading}>
			{$evoLoading ? 'Analyzing…' : 'Ask'}
		</button>
	</form>

	<div class="evo-explorer__suggestions">
		{#each SUGGESTIONS as s}
			<button class="evo-explorer__chip" type="button" on:click={() => applySuggestion(s)}>{s}</button>
		{/each}
	</div>

	{#if $evoExplorerResult}
		<div class="evo-explorer__parsed">
			<h4>Interpreted as:</h4>
			<ul>
				{#each $evoExplorerResult.parsed.explanation as line}
					<li>{line}</li>
				{/each}
			</ul>
			{#if $evoExplorerResult.parsed.unresolved.length > 0}
				<p class="evo-explorer__unresolved">
					⚠ Couldn't resolve: {$evoExplorerResult.parsed.unresolved.join(', ')}
				</p>
			{/if}
		</div>

		<EvoLeaderboard
			rows={$evoExplorerResult.rows}
			title="Answer"
			subtitle={`Based on "${$evoExplorerResult.query}".`}
		/>
	{/if}
</section>

<style>
	.evo-explorer {
		background: #0f172a;
		border: 1px solid #1e293b;
		border-radius: 12px;
		padding: 16px 18px;
		margin-bottom: 18px;
	}
	.evo-explorer header h3 {
		margin: 0 0 4px;
		font-size: 16px;
		color: #e2e8f0;
	}
	.evo-explorer header p {
		margin: 0 0 12px;
		font-size: 12px;
		color: #94a3b8;
	}
	.evo-explorer__form {
		display: flex;
		gap: 8px;
	}
	.evo-explorer__input {
		flex: 1;
		background: #020617;
		color: #e2e8f0;
		border: 1px solid #334155;
		border-radius: 8px;
		padding: 10px 12px;
		font-size: 14px;
	}
	.evo-explorer__input:focus {
		outline: none;
		border-color: #6366f1;
	}
	.evo-explorer__btn {
		background: linear-gradient(135deg, #6366f1, #8b5cf6);
		color: #fff;
		border: none;
		border-radius: 8px;
		padding: 0 16px;
		cursor: pointer;
		font-size: 13px;
		font-weight: 600;
	}
	.evo-explorer__btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}
	.evo-explorer__suggestions {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		margin-top: 10px;
	}
	.evo-explorer__chip {
		background: rgba(99, 102, 241, 0.1);
		border: 1px solid rgba(99, 102, 241, 0.3);
		color: #c7d2fe;
		padding: 4px 10px;
		border-radius: 999px;
		font-size: 11px;
		cursor: pointer;
	}
	.evo-explorer__chip:hover {
		background: rgba(99, 102, 241, 0.2);
	}
	.evo-explorer__parsed {
		margin-top: 16px;
		padding: 10px 14px;
		background: #020617;
		border: 1px solid #1e293b;
		border-radius: 8px;
	}
	.evo-explorer__parsed h4 {
		margin: 0 0 6px;
		font-size: 11px;
		color: #94a3b8;
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}
	.evo-explorer__parsed ul {
		margin: 0;
		padding-left: 18px;
		font-size: 12px;
		color: #cbd5e1;
	}
	.evo-explorer__unresolved {
		color: #fbbf24;
		font-size: 12px;
		margin: 8px 0 0;
	}
</style>
