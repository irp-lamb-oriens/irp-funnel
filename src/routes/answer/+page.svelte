<script lang="ts">
	import { onMount } from 'svelte';

	// ── Backend base (mirrors src/routes/status/[id]/store.ts) ─────────────────
	function getApiUrl(): string {
		if (typeof window !== 'undefined' && window.location.origin.startsWith('http://localhost')) {
			return 'http://localhost:8000';
		}
		return 'https://irp-funnel-server.onrender.com';
	}
	const API_BASE = getApiUrl();

	type State = 'loading' | 'auth' | 'ready' | 'submitting' | 'sent' | 'error';
	let state: State = 'loading';
	let errorMsg = '';

	// Context absorbed from the email link, then stripped from the address bar
	// so it is never shared or leaked. These are CONTEXT ONLY — never a write
	// credential. The real authority is the authenticated email (see server).
	let intendedConsultationId = '';
	let emailType = '';

	// Identity / greeting (signer's OWN record — never the addressed recipient)
	let clientName = '';

	// The single, centered message box
	let message = '';

	// Inline OTP sign-in gate (only shown when there is no existing session)
	let email = '';
	let code = '';
	let otpSent = false;
	let otpBusy = false;
	let otpError = '';

	let logoBroken = false;

	// Inject BOTH known session tokens so a visitor already signed into the
	// client portal (x-client-token) OR the staff dashboard (x-dashboard-token)
	// is recognized transparently — single sign-on, no second login.
	function authHeaders(): Record<string, string> {
		const h: Record<string, string> = { 'Content-Type': 'application/json' };
		if (typeof window !== 'undefined') {
			const ct = localStorage.getItem('client_token');
			const dt = localStorage.getItem('dashboard_token');
			if (ct) h['x-client-token'] = ct;
			if (dt) h['x-dashboard-token'] = dt;
		}
		return h;
	}

	async function checkAuth() {
		state = 'loading';
		try {
			const res = await fetch(`${API_BASE}/api/client/answer`, { headers: authHeaders() });
			if (res.status === 401) {
				state = 'auth';
				return;
			}
			if (!res.ok) {
				errorMsg = 'Something went wrong. Please try again later.';
				state = 'error';
				return;
			}
			const data = await res.json();
			clientName = (data && data.clientName) || '';
			state = 'ready';
		} catch {
			errorMsg = 'We could not reach the server. Please check your connection and try again.';
			state = 'error';
		}
	}

	async function requestCode() {
		otpError = '';
		const e = email.trim().toLowerCase();
		if (!e || !e.includes('@')) {
			otpError = 'Please enter a valid email address.';
			return;
		}
		otpBusy = true;
		try {
			const res = await fetch(`${API_BASE}/api/client/answer/request-otp`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email: e })
			});
			const data = await res.json().catch(() => ({}));
			if (!res.ok) {
				otpError = (data && data.error) || 'Could not send the code. Please try again.';
				return;
			}
			otpSent = true;
		} catch {
			otpError = 'We could not reach the server. Please try again.';
		} finally {
			otpBusy = false;
		}
	}

	async function verifyCode() {
		otpError = '';
		const e = email.trim().toLowerCase();
		const c = code.trim();
		if (!c) {
			otpError = 'Please enter the code from your email.';
			return;
		}
		otpBusy = true;
		try {
			const res = await fetch(`${API_BASE}/api/client/answer/verify-otp`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email: e, code: c })
			});
			const data = await res.json().catch(() => ({}));
			if (!res.ok || !(data && data.token)) {
				otpError = (data && data.error) || 'Invalid or expired code.';
				return;
			}
			// Store under the shared client-portal key so the session also unlocks
			// the /status portal (and vice-versa) — single sign-on.
			localStorage.setItem('client_token', data.token);
			await checkAuth();
		} catch {
			otpError = 'We could not reach the server. Please try again.';
		} finally {
			otpBusy = false;
		}
	}

	async function submitMessage() {
		if (!message.trim()) {
			errorMsg = 'Please type a message before sending.';
			return;
		}
		state = 'submitting';
		errorMsg = '';
		try {
			const res = await fetch(`${API_BASE}/api/client/answer`, {
				method: 'POST',
				headers: authHeaders(),
				body: JSON.stringify({
					message: message.trim(),
					emailType,
					intendedConsultationId
				})
			});
			if (res.status === 401) {
				state = 'auth';
				return;
			}
			const data = await res.json().catch(() => ({}));
			if (!res.ok) {
				errorMsg = (data && data.error) || 'We could not save your message. Please try again.';
				state = 'ready';
				return;
			}
			state = 'sent';
		} catch {
			errorMsg = 'We could not reach the server. Please try again.';
			state = 'ready';
		}
	}

	onMount(() => {
		const url = new URL(window.location.href);
		intendedConsultationId = url.searchParams.get('consultationId') || '';
		emailType = url.searchParams.get('e') || '';
		// Strip context + token from the address bar (prevents accidental sharing).
		if (url.search) history.replaceState({}, '', url.pathname);
		checkAuth();
	});
</script>

<svelte:head>
	<title>Send us a message · International Relocation Partner</title>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="an-root">
	<header class="an-header">
		{#if !logoBroken}
			<img
				class="an-logo"
				src="/IRP-LOGO.jpg"
				alt="International Relocation Partner"
				on:error={() => (logoBroken = true)}
			/>
		{/if}
		<span class="an-brand">International Relocation Partner</span>
	</header>

	<main class="an-main">
		{#if state === 'loading'}
			<div class="an-card an-card--center">
				<div class="an-spinner" aria-hidden="true"></div>
				<p class="an-muted">One moment…</p>
			</div>
		{:else if state === 'auth'}
			<div class="an-card">
				<span class="an-eyebrow">🔒 Secure message</span>
				<h1 class="an-title">Verify it's you</h1>
				<p class="an-subtitle">
					So your message is saved securely to your file, please confirm your email address.
				</p>

				{#if !otpSent}
					<label class="an-label" for="an-email">Your email</label>
					<input
						id="an-email"
						class="an-input"
						type="email"
						autocomplete="email"
						placeholder="you@example.com"
						bind:value={email}
						on:keydown={(e) => e.key === 'Enter' && requestCode()}
					/>
					<button class="an-btn an-btn--primary" disabled={otpBusy} on:click={requestCode}>
						{otpBusy ? 'Sending…' : 'Send me a code'}
					</button>
				{:else}
					<p class="an-subtitle">
						We sent a 6-digit code to <strong class="an-highlight">{email}</strong>. Enter it below.
					</p>
					<label class="an-label" for="an-code">Verification code</label>
					<input
						id="an-code"
						class="an-input an-code"
						inputmode="numeric"
						autocomplete="one-time-code"
						placeholder="······"
						bind:value={code}
						on:keydown={(e) => e.key === 'Enter' && verifyCode()}
					/>
					<button class="an-btn an-btn--primary" disabled={otpBusy} on:click={verifyCode}>
						{otpBusy ? 'Verifying…' : 'Verify & continue'}
					</button>
					<button class="an-link" type="button" on:click={() => (otpSent = false)}>
						Use a different email
					</button>
				{/if}

				{#if otpError}
					<p class="an-error">{otpError}</p>
				{/if}
			</div>
		{:else if state === 'ready' || state === 'submitting'}
			<div class="an-card">
				<span class="an-eyebrow">✍️ Your message</span>
				<h1 class="an-title">
					{clientName ? `Hi ${clientName},` : 'Hi there,'}
				</h1>
				<p class="an-subtitle">
					Have a question or anything to tell us? Type your message below — your relocation team
					reads every one.
				</p>

				<textarea
					class="an-textarea"
					rows="7"
					placeholder="Type your message here…"
					bind:value={message}
					disabled={state === 'submitting'}
				></textarea>

				{#if errorMsg}
					<p class="an-error">{errorMsg}</p>
				{/if}

				<button
					class="an-btn an-btn--primary"
					disabled={state === 'submitting' || !message.trim()}
					on:click={submitMessage}
				>
					<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
					{state === 'submitting' ? 'Sending…' : 'Send message'}
				</button>

				<p class="an-privacy-note">Your message is saved privately to your relocation file at IRP.</p>
			</div>
		{:else if state === 'sent'}
			<div class="an-card an-card--center">
				<div class="an-check" aria-hidden="true">✓</div>
				<h1 class="an-title">Message sent</h1>
				<p class="an-subtitle">
					Thank you{clientName ? `, ${clientName}` : ''}. Your relocation team has it and will be in
					touch.
				</p>
			</div>
		{:else}
			<div class="an-card an-card--center">
				<h1 class="an-title">Something went wrong</h1>
				<p class="an-subtitle">{errorMsg}</p>
				<button class="an-btn an-btn--primary" on:click={checkAuth}>Try again</button>
			</div>
		{/if}
	</main>

	<footer class="an-footer">
		<span>Powered by</span><strong>International Relocation Partner</strong>
	</footer>
</div>

<style>
	/* ── Cohesive with the provider token-pages (quote-accept / provider-rate)
	   and the global brand tokens in routes/styles/global.scss:
	     --color-highlight-2 : #02b5bb  (brand teal — primary accent)
	     --color-highlight-1 : #c62426  (brand red  — errors/alerts)
	   Dark glassmorphic surface, teal accent, "Powered by" footer.        ── */
	:global(body) {
		margin: 0;
		padding: 0;
		background: #020d10;
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
		-webkit-font-smoothing: antialiased;
		color: #f1f5f9;
		min-height: 100vh;
	}

	.an-root {
		min-height: 100vh;
		display: flex;
		flex-direction: column;
		align-items: center;
		background:
			radial-gradient(ellipse 80% 60% at 50% -10%, rgba(var(--color-highlight-2-rgb), 0.09) 0%, transparent 60%),
			linear-gradient(180deg, #020d10 0%, #031319 100%);
		padding: 0 1rem 3rem;
	}

	.an-header {
		width: 100%;
		max-width: 520px;
		display: flex;
		align-items: center;
		gap: 0.65rem;
		padding: 1.5rem 0 0;
		margin-bottom: 2rem;
	}

	.an-logo {
		height: 30px;
		width: auto;
		border-radius: 6px;
		opacity: 0.95;
	}

	.an-brand {
		font-size: 0.75rem;
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: rgba(241, 245, 249, 0.45);
	}

	.an-main {
		width: 100%;
		max-width: 520px;
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
	}

	.an-card {
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

	.an-card--center {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		padding: 3rem 1.75rem;
	}

	.an-eyebrow {
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

	.an-title {
		font-size: 1.3rem;
		font-weight: 800;
		color: #f8fafc;
		margin: 0 0 0.5rem;
		line-height: 1.25;
	}

	.an-subtitle {
		font-size: 0.85rem;
		color: rgba(241, 245, 249, 0.5);
		line-height: 1.6;
		margin: 0 0 1.25rem;
	}

	.an-muted {
		font-size: 0.85rem;
		color: rgba(241, 245, 249, 0.5);
		line-height: 1.6;
		margin: 0.75rem 0 0;
	}

	.an-highlight {
		color: var(--color-highlight-2);
		font-weight: 700;
	}

	.an-label {
		display: block;
		text-align: left;
		font-size: 0.63rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: rgba(241, 245, 249, 0.5);
		margin: 0 0 0.5rem;
	}

	.an-input {
		width: 100%;
		box-sizing: border-box;
		padding: 0.8rem 0.9rem;
		font-size: 1rem;
		background: rgba(255, 255, 255, 0.04);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 10px;
		color: #f1f5f9;
		margin-bottom: 1rem;
		transition:
			border-color 0.15s ease,
			box-shadow 0.15s ease;
	}

	.an-input::placeholder {
		color: rgba(241, 245, 249, 0.3);
	}

	.an-code {
		text-align: center;
		letter-spacing: 0.5rem;
		font-family: 'SF Mono', 'Fira Code', ui-monospace, monospace;
		font-size: 1.4rem;
	}

	.an-input:focus,
	.an-textarea:focus {
		outline: none;
		border-color: rgba(var(--color-highlight-2-rgb), 0.55);
		box-shadow: 0 0 0 3px rgba(var(--color-highlight-2-rgb), 0.15);
	}

	.an-textarea {
		width: 100%;
		box-sizing: border-box;
		padding: 0.9rem 1rem;
		font-size: 1rem;
		line-height: 1.6;
		background: rgba(255, 255, 255, 0.04);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 12px;
		resize: vertical;
		min-height: 150px;
		color: #f1f5f9;
		font-family: inherit;
		margin-bottom: 1.1rem;
	}

	.an-textarea::placeholder {
		color: rgba(241, 245, 249, 0.3);
	}

	.an-btn {
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
		transition:
			filter 0.15s ease,
			transform 0.05s ease,
			opacity 0.15s ease;
	}

	.an-btn--primary {
		color: #020d10;
		background: var(--color-highlight-2);
		box-shadow: 0 6px 20px rgba(var(--color-highlight-2-rgb), 0.35);
	}

	.an-btn--primary:hover:not(:disabled) {
		filter: brightness(1.06);
	}

	.an-btn:active:not(:disabled) {
		transform: translateY(1px);
	}

	.an-btn:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}

	.an-link {
		display: block;
		margin: 0.9rem auto 0;
		background: none;
		border: none;
		color: rgba(241, 245, 249, 0.55);
		font-size: 0.82rem;
		cursor: pointer;
		text-decoration: underline;
	}

	.an-link:hover {
		color: var(--color-highlight-2);
	}

	.an-error {
		color: #fca5a5;
		font-size: 0.82rem;
		margin: 0.9rem 0 0;
		padding: 0.6rem 0.8rem;
		background: rgba(var(--color-highlight-1-rgb), 0.1);
		border: 1px solid rgba(var(--color-highlight-1-rgb), 0.3);
		border-radius: 9px;
	}

	.an-privacy-note {
		font-size: 0.7rem;
		color: rgba(241, 245, 249, 0.35);
		text-align: center;
		margin: 0.9rem 0 0;
	}

	.an-check {
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

	.an-spinner {
		width: 36px;
		height: 36px;
		border: 3px solid rgba(255, 255, 255, 0.1);
		border-top-color: var(--color-highlight-2);
		border-radius: 50%;
		animation: an-spin 0.8s linear infinite;
	}

	.an-footer {
		margin-top: 2rem;
		display: flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.72rem;
		color: rgba(241, 245, 249, 0.3);
	}

	.an-footer strong {
		color: rgba(241, 245, 249, 0.5);
		font-weight: 700;
	}

	@keyframes an-spin {
		to {
			transform: rotate(360deg);
		}
	}
</style>
