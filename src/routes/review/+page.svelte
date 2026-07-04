<script lang="ts">
	import { onMount } from 'svelte';

	// ── Backend base (mirrors src/routes/answer/+page.svelte) ──────────────────
	function getApiUrl(): string {
		if (typeof window !== 'undefined' && window.location.origin.startsWith('http://localhost')) {
			return 'http://localhost:8000';
		}
		return 'https://irp-funnel-server.onrender.com';
	}
	const API_BASE = getApiUrl();

	type State =
		| 'loading'
		| 'ready'
		| 'submitting'
		| 'google'
		| 'concern'
		| 'expired'
		| 'error';
	let state: State = 'loading';
	let errorMsg = '';

	// Opaque single-use token from the email link (?token=…). Context only —
	// the server resolves it to the client's record so the link stays anonymous.
	let token = '';

	// Context resolved from the token
	let clientName = '';

	// The rating gate
	let rating = 0;
	let hoverRating = 0;
	let message = '';

	// Positive-path payload (Google review)
	let googleReviewUrl = '';
	let submittedMessage = '';

	let logoBroken = false;
	let copied = false;

	const STAR_LABELS = ['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent'];

	function setRating(n: number) {
		rating = n;
	}

	async function loadToken() {
		state = 'loading';
		try {
			const res = await fetch(`${API_BASE}/api/action/${encodeURIComponent(token)}`);
			const data = await res.json().catch(() => ({}));
			if (!res.ok) {
				errorMsg = 'Something went wrong. Please try again later.';
				state = 'error';
				return;
			}
			if (!data || data.ok !== true) {
				state = 'expired';
				return;
			}
			clientName = (data.context && data.context.name) || '';
			state = 'ready';
		} catch {
			errorMsg = 'We could not reach the server. Please check your connection and try again.';
			state = 'error';
		}
	}

	async function submitReview() {
		if (rating < 1) {
			errorMsg = 'Please choose a star rating first.';
			return;
		}
		state = 'submitting';
		errorMsg = '';
		try {
			const res = await fetch(`${API_BASE}/api/action/${encodeURIComponent(token)}/submit`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ rating, message: message.trim() })
			});
			const data = await res.json().catch(() => ({}));
			if (!res.ok) {
				errorMsg = (data && data.error) || 'We could not save your review. Please try again.';
				state = 'ready';
				return;
			}
			if (!data || data.ok !== true) {
				state = 'expired';
				return;
			}
			if (data.action === 'google_review') {
				googleReviewUrl = data.googleReviewUrl || '';
				submittedMessage = data.reviewMessage || message.trim();
				state = 'google';
			} else {
				state = 'concern';
			}
		} catch {
			errorMsg = 'We could not reach the server. Please try again.';
			state = 'ready';
		}
	}

	async function copyMessage() {
		try {
			await navigator.clipboard.writeText(submittedMessage);
			copied = true;
			setTimeout(() => (copied = false), 2000);
		} catch {
			/* clipboard unavailable — the textarea is selectable as a fallback */
		}
	}

	onMount(() => {
		const url = new URL(window.location.href);
		token = url.searchParams.get('token') || '';
		// Strip the token from the address bar (prevents accidental sharing).
		if (url.search) history.replaceState({}, '', url.pathname);
		if (!token) {
			state = 'expired';
			return;
		}
		loadToken();
	});
</script>

<svelte:head>
	<title>How was your move? · International Relocation Partner</title>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="rv-root">
	<header class="rv-header">
		{#if !logoBroken}
			<img
				class="rv-logo"
				src="/IRP-LOGO.jpg"
				alt="International Relocation Partner"
				on:error={() => (logoBroken = true)}
			/>
		{/if}
		<span class="rv-brand">International Relocation Partner</span>
	</header>

	<main class="rv-main">
		{#if state === 'loading'}
			<div class="rv-card rv-card--center">
				<div class="rv-spinner" aria-hidden="true"></div>
				<p class="rv-muted">One moment…</p>
			</div>
		{:else if state === 'ready' || state === 'submitting'}
			<div class="rv-card">
				<span class="rv-eyebrow">🏁 Your move is complete</span>
				<h1 class="rv-title">
					{clientName ? `How did we do, ${clientName}?` : 'How did we do?'}
				</h1>
				<p class="rv-subtitle">
					Your honest take means the world to us — and to the next family planning the same leap.
				</p>

				<!-- Star rating -->
				<div class="rv-stars" role="radiogroup" aria-label="Rate your experience from 1 to 5 stars">
					{#each [1, 2, 3, 4, 5] as n}
						<button
							type="button"
							class="rv-star"
							class:rv-star--on={(hoverRating || rating) >= n}
							role="radio"
							aria-checked={rating === n}
							aria-label={`${n} star${n > 1 ? 's' : ''}`}
							disabled={state === 'submitting'}
							on:mouseenter={() => (hoverRating = n)}
							on:mouseleave={() => (hoverRating = 0)}
							on:focus={() => (hoverRating = n)}
							on:blur={() => (hoverRating = 0)}
							on:click={() => setRating(n)}
						>
							★
						</button>
					{/each}
				</div>

				<p class="rv-star-label">{STAR_LABELS[hoverRating || rating] || 'Tap a star'}</p>

				<label class="rv-label" for="rv-msg">Tell us more (optional)</label>
				<textarea
					id="rv-msg"
					class="rv-textarea"
					rows="5"
					placeholder="What went well? What could have been smoother?"
					bind:value={message}
					disabled={state === 'submitting'}
				></textarea>

				{#if errorMsg}
					<p class="rv-error">{errorMsg}</p>
				{/if}

				<button
					class="rv-btn rv-btn--primary"
					disabled={state === 'submitting' || rating < 1}
					on:click={submitReview}
				>
					{state === 'submitting' ? 'Sending…' : 'Submit my review'}
				</button>

				<p class="rv-privacy-note">Your feedback goes straight to your relocation team at IRP.</p>
			</div>
		{:else if state === 'google'}
			<div class="rv-card rv-card--center">
				<div class="rv-celebrate" aria-hidden="true">🌟</div>
				<h1 class="rv-title">Thank you{clientName ? `, ${clientName}` : ''}!</h1>
				<p class="rv-subtitle">
					We're so glad we got it right. Would you share that with others on Google? It only takes a
					few seconds — and it helps families who are exactly where you were.
				</p>

				{#if submittedMessage}
					<div class="rv-copybox">
						<span class="rv-copybox__label">Your words — copy &amp; paste them into Google:</span>
						<textarea class="rv-copybox__text" rows="4" readonly>{submittedMessage}</textarea>
						<button class="rv-btn rv-btn--ghost" type="button" on:click={copyMessage}>
							{copied ? '✓ Copied' : 'Copy my words'}
						</button>
					</div>
				{/if}

				<a
					class="rv-btn rv-btn--primary"
					href={googleReviewUrl}
					target="_blank"
					rel="noopener noreferrer"
				>
					Leave a Google review →
				</a>
			</div>
		{:else if state === 'concern'}
			<div class="rv-card rv-card--center">
				<div class="rv-check" aria-hidden="true">✓</div>
				<h1 class="rv-title">Thank you for being honest{clientName ? `, ${clientName}` : ''}</h1>
				<p class="rv-subtitle">
					We've shared your feedback directly with our team, and someone will personally reach out
					to make things right. We genuinely appreciate you giving us the chance.
				</p>
			</div>
		{:else if state === 'expired'}
			<div class="rv-card rv-card--center">
				<div class="rv-check rv-check--muted" aria-hidden="true">✓</div>
				<h1 class="rv-title">This review has already been submitted</h1>
				<p class="rv-subtitle">
					Thank you — we've already received your feedback. There's nothing more you need to do.
				</p>
			</div>
		{:else}
			<div class="rv-card rv-card--center">
				<h1 class="rv-title">Something went wrong</h1>
				<p class="rv-subtitle">{errorMsg}</p>
				<button class="rv-btn rv-btn--primary" on:click={loadToken}>Try again</button>
			</div>
		{/if}
	</main>

	<footer class="rv-footer">
		<span>Powered by</span><strong>International Relocation Partner</strong>
	</footer>
</div>

<style>
	/* Cohesive with /answer + provider token pages: dark glassmorphic surface,
	   teal accent, "Powered by" footer. Brand tokens from routes/styles/global.scss. */
	:global(body) {
		margin: 0;
		padding: 0;
		background: #020d10;
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
		-webkit-font-smoothing: antialiased;
		color: #f1f5f9;
		min-height: 100vh;
	}

	.rv-root {
		min-height: 100vh;
		display: flex;
		flex-direction: column;
		align-items: center;
		background:
			radial-gradient(ellipse 80% 60% at 50% -10%, rgba(var(--color-highlight-2-rgb), 0.09) 0%, transparent 60%),
			linear-gradient(180deg, #020d10 0%, #031319 100%);
		padding: 0 1rem 3rem;
	}

	.rv-header {
		width: 100%;
		max-width: 520px;
		display: flex;
		align-items: center;
		gap: 0.65rem;
		padding: 1.5rem 0 0;
		margin-bottom: 2rem;
	}

	.rv-logo {
		height: 30px;
		width: auto;
		border-radius: 6px;
		opacity: 0.95;
	}

	.rv-brand {
		font-size: 0.75rem;
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: rgba(241, 245, 249, 0.45);
	}

	.rv-main {
		width: 100%;
		max-width: 520px;
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
	}

	.rv-card {
		background: rgba(255, 255, 255, 0.03);
		border: 1px solid rgba(var(--color-highlight-2-rgb), 0.15);
		border-radius: 20px;
		padding: 2rem 1.75rem;
		box-shadow:
			0 8px 48px rgba(0, 0, 0, 0.4),
			inset 0 1px 0 rgba(255, 255, 255, 0.05);
		backdrop-filter: blur(24px);
		-webkit-backdrop-filter: blur(24px);
	}

	.rv-card--center {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		padding: 3rem 1.75rem;
	}

	.rv-eyebrow {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		font-size: 0.67rem;
		font-weight: 700;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--color-highlight-2);
		margin-bottom: 0.75rem;
	}

	.rv-title {
		font-size: 1.3rem;
		font-weight: 800;
		color: #f8fafc;
		margin: 0 0 0.5rem;
		line-height: 1.25;
	}

	.rv-subtitle {
		font-size: 0.85rem;
		color: rgba(241, 245, 249, 0.5);
		line-height: 1.6;
		margin: 0 0 1.25rem;
	}

	.rv-muted {
		font-size: 0.85rem;
		color: rgba(241, 245, 249, 0.5);
		line-height: 1.6;
		margin: 0.75rem 0 0;
	}

	/* Stars */
	.rv-stars {
		display: flex;
		justify-content: center;
		gap: 0.35rem;
		margin: 0.5rem 0 0.4rem;
	}

	.rv-star {
		background: none;
		border: none;
		cursor: pointer;
		font-size: 2.6rem;
		line-height: 1;
		padding: 0 0.1rem;
		color: rgba(255, 255, 255, 0.18);
		transition:
			color 0.12s ease,
			transform 0.08s ease;
	}

	.rv-star--on {
		color: #f5b50a;
		text-shadow: 0 0 18px rgba(245, 181, 10, 0.45);
	}

	.rv-star:hover:not(:disabled) {
		transform: scale(1.12);
	}

	.rv-star:disabled {
		cursor: default;
	}

	.rv-star-label {
		text-align: center;
		font-size: 0.78rem;
		font-weight: 700;
		letter-spacing: 0.04em;
		color: rgba(245, 181, 10, 0.9);
		margin: 0 0 1.25rem;
		min-height: 1rem;
	}

	.rv-label {
		display: block;
		text-align: left;
		font-size: 0.63rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: rgba(241, 245, 249, 0.5);
		margin: 0 0 0.5rem;
	}

	.rv-textarea {
		width: 100%;
		box-sizing: border-box;
		padding: 0.9rem 1rem;
		font-size: 1rem;
		line-height: 1.6;
		background: rgba(255, 255, 255, 0.04);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 12px;
		resize: vertical;
		min-height: 120px;
		color: #f1f5f9;
		font-family: inherit;
		margin-bottom: 1.1rem;
	}

	.rv-textarea::placeholder {
		color: rgba(241, 245, 249, 0.3);
	}

	.rv-textarea:focus {
		outline: none;
		border-color: rgba(var(--color-highlight-2-rgb), 0.55);
		box-shadow: 0 0 0 3px rgba(var(--color-highlight-2-rgb), 0.15);
	}

	.rv-btn {
		width: 100%;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		padding: 0.85rem 1.25rem;
		font-size: 0.95rem;
		font-weight: 700;
		border: none;
		border-radius: 12px;
		cursor: pointer;
		text-decoration: none;
		box-sizing: border-box;
		transition:
			filter 0.15s ease,
			transform 0.05s ease,
			opacity 0.15s ease;
	}

	.rv-btn--primary {
		color: #020d10;
		background: var(--color-highlight-2);
		box-shadow: 0 6px 20px rgba(var(--color-highlight-2-rgb), 0.35);
	}

	.rv-btn--primary:hover:not(:disabled) {
		filter: brightness(1.06);
	}

	.rv-btn--ghost {
		color: #f1f5f9;
		background: rgba(255, 255, 255, 0.06);
		border: 1px solid rgba(255, 255, 255, 0.12);
		margin-bottom: 1rem;
	}

	.rv-btn:active:not(:disabled) {
		transform: translateY(1px);
	}

	.rv-btn:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}

	.rv-error {
		color: #fca5a5;
		font-size: 0.82rem;
		margin: 0.9rem 0 0;
		padding: 0.6rem 0.8rem;
		background: rgba(var(--color-highlight-1-rgb), 0.1);
		border: 1px solid rgba(var(--color-highlight-1-rgb), 0.3);
		border-radius: 10px;
	}

	.rv-privacy-note {
		font-size: 0.7rem;
		color: rgba(241, 245, 249, 0.35);
		text-align: center;
		margin: 0.9rem 0 0;
	}

	.rv-copybox {
		width: 100%;
		text-align: left;
		margin: 0.4rem 0 1.4rem;
	}

	.rv-copybox__label {
		display: block;
		font-size: 0.63rem;
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: rgba(241, 245, 249, 0.5);
		margin: 0 0 0.5rem;
	}

	.rv-copybox__text {
		width: 100%;
		box-sizing: border-box;
		padding: 0.8rem 0.9rem;
		font-size: 0.9rem;
		line-height: 1.55;
		background: rgba(255, 255, 255, 0.04);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 10px;
		resize: vertical;
		color: #f1f5f9;
		font-family: inherit;
		margin-bottom: 0.6rem;
	}

	.rv-celebrate {
		font-size: 52px;
		line-height: 1;
		margin-bottom: 0.75rem;
	}

	.rv-check {
		width: 56px;
		height: 56px;
		border-radius: 50%;
		background: rgba(var(--color-highlight-2-rgb), 0.12);
		color: var(--color-highlight-2);
		font-size: 28px;
		font-weight: 700;
		display: flex;
		align-items: center;
		justify-content: center;
		margin-bottom: 1.1rem;
	}

	.rv-check--muted {
		background: rgba(255, 255, 255, 0.06);
		color: rgba(241, 245, 249, 0.5);
	}

	.rv-spinner {
		width: 36px;
		height: 36px;
		border: 3px solid rgba(255, 255, 255, 0.1);
		border-top-color: var(--color-highlight-2);
		border-radius: 50%;
		animation: rv-spin 0.8s linear infinite;
	}

	.rv-footer {
		margin-top: 2rem;
		display: flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.72rem;
		color: rgba(241, 245, 249, 0.3);
	}

	.rv-footer strong {
		color: rgba(241, 245, 249, 0.5);
		font-weight: 700;
	}

	@keyframes rv-spin {
		to {
			transform: rotate(360deg);
		}
	}
</style>
