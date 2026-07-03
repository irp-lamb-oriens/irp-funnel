<script lang="ts">
	import { get } from 'svelte/store';
	import store, { incrementStepsIndex, saveToStore, currentFunnel } from '../../../../store.ts';
	import Page from '../../../wrappers/Page/Page.svelte';
	import MarkdownText from '../../../texts/MarkdownText/MarkdownText.svelte';
	import Video from '../../../../Video/Video.svelte';
    import SubmitButton from '../../../buttons/SubmitButton/SubmitButton.svelte';
    import { videoInteractionStore } from '../../../../Video/VideoInteractionStore.ts';
    import { onMount } from 'svelte';
    import Brand from '../../../../Brand/Brand.svelte';
    import { browser } from '$app/environment';
    import { AGE_RANGES_BIDI } from '../../../helpers/constants.ts';

	export let canReveal = false;

	export let email: string | null = null;
	export let name: string | null = null;
	export let countryFrom: string | null = null;
	export let countryTo: string | null = null;

	// Submission state
	let isLoading = false;
	let submitError: string | null = null;
	let submitSuccess = false;

	// The video source and copy are now dynamic from the funnel store
	let trackingData: { queryParams?: Record<string, string>; lastKnownTime?: number } = {};

	function handleTimeUpdate(event: CustomEvent<{ currentTime: number }>) {
		trackingData = { ...trackingData, lastKnownTime: event.detail.currentTime };
	}

	store.subscribe((s) => {
		if (!s.stepsIndex) {
			videoInteractionStore.set({ type: "play" });
			return;
		}
		videoInteractionStore.set({ type: "stop" });
	});

	$: currentFunnel;

	// --- RELOCATION PORTAL LINK ---
	// Mirrors the server convention: the consultation doc id is the client's
	// email with `@` and `.` replaced by `_` (see bookConsultation.emailToDocId),
	// and the portal lives at `/status/{docId}` (see processEmailQueue's
	// `${FRONTEND_URL}/status/${consultationDocId}`). Computing it here lets us
	// hand the client their portal immediately on the thank-you screen — the
	// same hub the welcome email points them to.
	$: portalEmail = (email ?? $store.email ?? '').trim();
	$: portalUrl = portalEmail ? `/status/${portalEmail.replace(/[@.]/g, '_')}` : null;


	// --- SUBMIT LOGIC (from SubmitStage) ---
	let getDisplayData: () => Record<string, any>;
	let funnelCopyForDisplay: string | null = null;

	$: {
		getDisplayData = () => ({
			Name: $store.name,
			Email: $store.email,
			'Age Range': $store.age?.toString() ? AGE_RANGES_BIDI[$store.age?.toString()] || $store.age?.toString() : $store.age,
			Budget: $store.budget >= 10000 ? "over 10000" : "under 10000",
			'Square Feet': $store.squareFeet === -1 ? "I don't know" : $store.squareFeet,
			'Moving From Property Type': $store.propertyTypeFrom,
			'Moving To Property Type': $store.propertyTypeTo,
			'Reasons for Moving': $store.reasonsForMoving?.join(', '),
			'Country From': $store.countryFrom,
			'Country To': $store.countryTo,
		});
		if (browser) {
			funnelCopyForDisplay = localStorage.getItem('funnelCopyText');
		}
	}

	onMount(() => {
		console.log("ThankYouStage: Display Data:", getDisplayData());
		console.log("ThankYouStage: Funnel Copy for Display:", funnelCopyForDisplay);
		const storeData = $store;
		const apiUrl = storeData.apiURL ? storeData.apiURL() : window.location.origin;
		console.log("ThankYouStage: API URL:", apiUrl);
	});

	async function handleSubmit() {
		isLoading = true;
		submitError = null;
		submitSuccess = false;

		const storeData = $store;
		const funnelId = localStorage.getItem('currentFunnelId');
		const funnelVersion = localStorage.getItem('currentFunnelVersion');
		const funnelObjectString = localStorage.getItem('currentFunnelObject');
		const funnelCopyText = localStorage.getItem('funnelCopyText');
		const locallyStored: Record<string, any> = {};
		if (browser) {
			for (const key in localStorage) {
				if (Object.prototype.hasOwnProperty.call(localStorage, key)) {
					const value = localStorage.getItem(key);
					if (value) {
						try {
							const parsedValue = JSON.parse(value);
                            locallyStored[key] = typeof parsedValue === 'number' ? Math.round(parsedValue) : parsedValue;
						} catch (e) {
							locallyStored[key] = value;
						}
					} else {
						locallyStored[key] = value;
					}
				}
			}
		}

		function normalize(str: string) {
			return str?.toLowerCase().replace(/-/g, ' ').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
		}

		let funnelObjectParsed = null;
		if (funnelObjectString) {
			try {
				funnelObjectParsed = JSON.parse(funnelObjectString);
			} catch (e) {
				console.error("Error parsing funnelObject from localStorage:", e);
			}
		}

		const normalizedFunnelId = normalize(funnelId as string);
		let countryCode = 'CR';
		if (normalizedFunnelId?.includes('panama')) {
			countryCode = 'PA';
		} else if (normalizedFunnelId?.includes('mexico')) {
			countryCode = 'MX';
		}

		const payload = {
			...storeData,
			funnelCopy: funnelCopyText === null ? undefined : funnelCopyText, 
			utm: locallyStored,
			isUpdate: false,
			topCountries: [countryCode],
			submit: {
				...(storeData.submit || {}),
				funnelId,
				funnelVersion,
				funnelObject: funnelObjectParsed
			}
		};

		console.log("ThankYouStage: full payload before fetch (funnelId/Version from localStorage):", JSON.stringify(payload, null, 2));

		const apiUrl = storeData.apiURL ? storeData.apiURL() : window.location.origin;

		try {
			const response = await fetch(`${apiUrl}/api/create-user`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(payload),
			});

			let newsSourceId;
			const normalizedFunnelId = normalize(funnelId as string);
			newsSourceId = 'b545170e1296ecbdc6f25f676114b279db7660cdd4d3025cc75f90e81007e460';

			if (normalizedFunnelId?.includes('costa rica')) {
				newsSourceId = 'b545170e1296ecbdc6f25f676114b279db7660cdd4d3025cc75f90e81007e460';
				// this condition is extra, is just here for clarity
			} else if (normalizedFunnelId?.includes('panama')) {
				newsSourceId = '9c67a6a84c4c05fb02ffd0ec620d7fa30804c3d84e2605046306a7a7f1bfded7';
			} else if (normalizedFunnelId?.includes('mexico')) {
				newsSourceId = '460b3b4148238d1ffa62fd36a3427aac493befb047d23ee24f7a215b5274c3c4';
			}

			await fetch('https://ai-newsletter-translated.onrender.com/public-subscribe', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					configuratorId: 'consultation@internationalrelocationpartner.com',
					newsSourceId,
					email: $store.email,
					name: $store.name,
					language: 'en',
					bio: $store.reasonsForMoving?.join(', '),
				}),
			});

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({ error: 'Failed to parse error response' }));
				throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
			}

			const result = await response.json();
			console.log('Submission successful:', result);

			submitSuccess = true;
		} catch (error) {
			console.error('Submission failed:', error);
			submitError = error instanceof Error ? error.message : 'An unknown error occurred during submission.';
		} finally {
			isLoading = false;
		}
	}

	// --- REDIRECT ON SUBMIT SUCCESS ---
	let redirectTimeout: ReturnType<typeof setTimeout> | null = null;

	import { onDestroy } from 'svelte';
	onDestroy(() => {
		if (redirectTimeout) clearTimeout(redirectTimeout);
	});

	onMount(() => {
		handleSubmit();
	});
</script>

<div>
	<Brand />
	<div class="gap center">
		<MarkdownText {canReveal}>
			### Welcome to **International Relocation Partner**

			## You've **scheduled** a **call** with us.
		</MarkdownText>
		{#if email || name || countryFrom || countryTo}
			<div class="thankyou-details">
				{#if name}<div><b>Name:</b> {name}</div>{/if}
				{#if email}<div><b>Email:</b> {email}</div>{/if}
				{#if countryFrom}<div><b>From:</b> {countryFrom}</div>{/if}
				{#if countryTo}<div><b>To:</b> {countryTo}</div>{/if}
			</div>
		{/if}

		{#if portalUrl}
			<div class="portal-card">
				<span class="portal-card__glow" aria-hidden="true"></span>
				<span class="portal-card__badge" aria-hidden="true">🏠</span>
				<h3 class="portal-card__title">Your Relocation Portal is ready</h3>
				<p class="portal-card__copy">
					Everything about your move now lives in one place — track every stage, view your
					quote, chat with our assistant Lily, and message our team. We've also emailed you
					the link so it's always one tap away.
				</p>
				<a class="portal-card__cta" href={portalUrl}>
					<span>Access your relocation system</span>
					<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
						<path d="M5 12h14" />
						<path d="m12 5 7 7-7 7" />
					</svg>
				</a>
				<span class="portal-card__pillars">
					Track your move · View your quote · Chat with Lily
				</span>
			</div>
		{/if}

	</div>
</div>



<style>
	.center {
		display: grid;
		place-items: center;
		text-align: center;
		max-width: 500px;
		margin: auto;
		grid-gap: 25px;
	}

	video {
		/* opacity: 0; */ /* Removed initial hidden state */
		/* transition: opacity 0.5s ease-in-out; */ /* Removed transition */
		/* Ensure video covers the entire screen */
		position: relative;
		display: block;
		width: 100%;
		max-width: 1024px;
		min-height: 512px;
		margin: auto;
		height: auto;
		/* z-index: -1; */ /* Removed z-index */
		background-size: cover;
		/* transition: 1s opacity; */ /* Handled by opacity transition above */
		object-fit: cover; /* Cover the area, potentially cropping */
	}

	/* video.loaded { */ /* Removed loaded class style */
		/* opacity: 1; */
	/* } */

	/* Optional: Style for the error state */
	p {
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		color: white; /* Adjust color for visibility over video */
		z-index: 1; /* Ensure text is above video */
		background-color: rgba(0, 0, 0, 0.5); /* Optional background for readability */
		padding: 1em;
		border-radius: 8px;
	}

	.login-overlay {
		z-index: 2; /* Ensure buttons are above video and error message */
		display: flex;
		gap: 10px; /* Space between buttons */
		padding: 10px 15px;
		border-radius: 8px;
	}

	.login-button {
		padding: 8px 15px;
		border: none;
		border-radius: 5px;
		cursor: pointer;
		font-weight: bold;
		color: white;
	}

	.login-button.google {
		background-color: #db4437;
	}
	.login-button.facebook {
		background-color: #4267b2;
	}
	.login-button.linkedin {
		background-color: #0077b5;
	}

	.login-button:hover {
		opacity: 0.9;
	}
	.gap {
		max-width: 1024px;
		margin: auto;
		padding: 5rem 0;
		
		@media (max-width: 1024px) {
			padding: 25px;
		}
	}

	/* --- Relocation Portal CTA card ---
	   Token-driven so it stays in lockstep with the brand palette and the
	   status portal it links to: teal = var(--color-highlight-2), ink text =
	   var(--color-foreground), Kiona titles + Jost body via the font tokens. */
	.portal-card {
		position: relative;
		isolation: isolate;
		overflow: hidden;
		width: 100%;
		max-width: 460px;
		margin: 8px auto 0;
		padding: 34px 28px 30px;
		background:
			linear-gradient(
				160deg,
				rgba(var(--color-highlight-2-rgb), 0.10) 0%,
				rgba(var(--color-highlight-2-rgb), 0.03) 46%,
				var(--color-background) 100%
			);
		border: 1px solid rgba(var(--color-highlight-2-rgb), 0.28);
		border-radius: 22px;
		text-align: center;
		box-shadow:
			0 18px 44px -22px rgba(var(--color-highlight-2-rgb), 0.55),
			0 2px 0 0 rgba(255, 255, 255, 0.7) inset;
		-webkit-backdrop-filter: blur(6px);
		backdrop-filter: blur(6px);
	}

	/* Soft aurora accent — a modern, GPU-cheap radial glow in the corner. */
	.portal-card__glow {
		position: absolute;
		top: -45%;
		right: -25%;
		width: 70%;
		height: 110%;
		background: radial-gradient(
			closest-side,
			rgba(var(--color-highlight-2-rgb), 0.40),
			rgba(var(--color-highlight-2-rgb), 0) 70%
		);
		filter: blur(8px);
		z-index: -1;
		pointer-events: none;
	}

	.portal-card__badge {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 56px;
		height: 56px;
		margin-bottom: 14px;
		font-size: 28px;
		line-height: 1;
		border-radius: 50%;
		background: rgba(var(--color-highlight-2-rgb), 0.14);
		box-shadow:
			0 0 0 1px rgba(var(--color-highlight-2-rgb), 0.30) inset,
			0 8px 20px -10px rgba(var(--color-highlight-2-rgb), 0.65);
	}

	.portal-card__title {
		margin: 0 0 10px;
		font-family: var(--font-title);
		font-size: 24px;
		font-weight: 600;
		line-height: 1.15;
		letter-spacing: -0.01em;
		color: var(--color-foreground);
	}

	.portal-card__copy {
		/* neutralise the absolute-positioned global <p> rule above */
		position: static;
		transform: none;
		background: none;
		padding: 0;
		z-index: auto;
		margin: 0 auto 22px;
		max-width: 380px;
		font-family: var(--font-paragraph);
		font-size: 15px;
		line-height: 1.65;
		color: rgba(24, 24, 24, 0.74);
	}

	.portal-card__cta {
		display: inline-flex;
		align-items: center;
		gap: 10px;
		padding: 15px 30px;
		border-radius: 999px;
		font-family: var(--font-paragraph);
		font-size: 15px;
		font-weight: 600;
		letter-spacing: 0.2px;
		text-decoration: none;
		color: #020d10;
		/* solid fallback first; the color-mix gradient enhances where supported */
		background: var(--color-highlight-2);
		background: linear-gradient(
			180deg,
			color-mix(in srgb, var(--color-highlight-2) 88%, white) 0%,
			var(--color-highlight-2) 100%
		);

		box-shadow:
			0 12px 26px -10px rgba(var(--color-highlight-2-rgb), 0.70),
			0 0 0 1px rgba(var(--color-highlight-2-rgb), 0.40) inset;
		transition:
			transform 0.18s ease,
			box-shadow 0.18s ease,
			filter 0.18s ease;
	}

	.portal-card__cta svg {
		transition: transform 0.18s ease;
	}

	.portal-card__cta:hover {
				filter: saturate(1.05);
		box-shadow:
			0 18px 34px -12px rgba(var(--color-highlight-2-rgb), 0.80),
			0 0 0 1px rgba(var(--color-highlight-2-rgb), 0.55) inset;
	}

	.portal-card__cta:hover svg {
		transform: translateX(4px);
	}

	.portal-card__cta:focus-visible {
		outline: 2px solid var(--color-highlight-2);
		outline-offset: 3px;
	}

	.portal-card__pillars {
		display: block;
		margin-top: 16px;
		font-family: var(--font-paragraph);
		font-size: 11px;
		font-weight: 600;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: rgba(var(--color-highlight-2-rgb), 0.85);
	}

	@media (prefers-reduced-motion: reduce) {
		.portal-card__cta,
		.portal-card__cta svg {
			transition: none;
		}
	}
</style>


