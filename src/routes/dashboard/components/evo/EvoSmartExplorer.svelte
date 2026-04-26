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

<style lang="scss">
	.evo-explorer {
		background: rgba(15, 23, 42, 0.4);
		border: 1px solid rgba(255, 255, 255, 0.05);
		border-radius: 16px;
		padding: 24px;
		margin-bottom: 24px;
		backdrop-filter: blur(12px);
		box-shadow: 0 4px 24px -8px rgba(0, 0, 0, 0.5);
	}
	.evo-explorer header h3 {
		margin: 0 0 6px;
		font-size: 18px;
		font-weight: 700;
		color: #f8fafc;
		display: flex;
		align-items: center;
		gap: 8px;

		&::before {
			content: '✨';
			font-size: 16px;
		}
	}
	.evo-explorer header p {
		margin: 0 0 20px;
		font-size: 14px;
		color: #94a3b8;
		max-width: 600px;
		line-height: 1.5;
	}
	.evo-explorer__form {
		display: flex;
		gap: 12px;
	}
	.evo-explorer__input {
		flex: 1;
		background: rgba(2, 6, 23, 0.5);
		color: #f8fafc;
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 10px;
		padding: 14px 18px;
		font-size: 15px;
		transition: all 0.2s ease;
		box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.2);

		&::placeholder {
			color: #475569;
		}
	}
	.evo-explorer__input:focus {
		outline: none;
		border-color: #6366f1;
		background: rgba(2, 6, 23, 0.8);
		box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15), inset 0 2px 4px rgba(0, 0, 0, 0.2);
	}
	.evo-explorer__btn {
		background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
		color: #fff;
		border: none;
		border-radius: 10px;
		padding: 0 24px;
		cursor: pointer;
		font-size: 14px;
		font-weight: 600;
		letter-spacing: 0.02em;
		transition: all 0.2s ease;
		box-shadow: 0 4px 12px rgba(99, 102, 241, 0.2);

		&:hover:not(:disabled) {
			transform: translateY(-1px);
			box-shadow: 0 6px 16px rgba(99, 102, 241, 0.3);
			filter: brightness(1.1);
		}
	}
	.evo-explorer__btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
		box-shadow: none;
	}
	.evo-explorer__suggestions {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		margin-top: 16px;
	}
	.evo-explorer__chip {
		background: rgba(99, 102, 241, 0.05);
		border: 1px solid rgba(99, 102, 241, 0.2);
		color: #a5b4fc;
		padding: 6px 12px;
		border-radius: 999px;
		font-size: 12px;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s ease;

		&:hover {
			background: rgba(99, 102, 241, 0.15);
			border-color: rgba(99, 102, 241, 0.4);
			color: #e0e7ff;
			transform: translateY(-1px);
		}
	}
	.evo-explorer__parsed {
		margin-top: 24px;
		padding: 16px 20px;
		background: rgba(2, 6, 23, 0.4);
		border: 1px solid rgba(255, 255, 255, 0.05);
		border-radius: 12px;
	}
	.evo-explorer__parsed h4 {
		margin: 0 0 10px;
		font-size: 12px;
		color: #94a3b8;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		font-weight: 600;
	}
	.evo-explorer__parsed ul {
		margin: 0;
		padding-left: 20px;
		font-size: 13px;
		color: #cbd5e1;
		line-height: 1.6;

		li {
			margin-bottom: 4px;
		}
	}
	.evo-explorer__unresolved {
		color: #fbbf24;
		font-size: 13px;
		margin: 12px 0 0;
		padding: 8px 12px;
		background: rgba(251, 191, 36, 0.1);
		border-radius: 6px;
		border: 1px solid rgba(251, 191, 36, 0.2);
	}
</style>
