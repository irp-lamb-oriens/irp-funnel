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
							locallyStored[key] = JSON.parse(value);
						} catch (e) {
							locallyStored[key] = value;
						}
					} else {
						locallyStored[key] = value;
					}
				}
			}
		}

		let funnelObjectParsed = null;
		if (funnelObjectString) {
			try {
				funnelObjectParsed = JSON.parse(funnelObjectString);
			} catch (e) {
				console.error("Error parsing funnelObject from localStorage:", e);
			}
		}

		const payload = {
			...storeData,
			funnelCopy: funnelCopyText === null ? undefined : funnelCopyText, 
			...locallyStored,
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

			function normalize(str: string) {
				return str?.toLowerCase().replace(/-/g, ' ').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
			}

			let newsSourceId;
			const normalizedFunnelId = normalize(funnelId as string);
			if (normalizedFunnelId.includes('costa rica')) {
				newsSourceId = 'b545170e1296ecbdc6f25f676114b279db7660cdd4d3025cc75f90e81007e460';
			} else if (normalizedFunnelId.includes('panama')) {
				newsSourceId = '9c67a6a84c4c05fb02ffd0ec620d7fa30804c3d84e2605046306a7a7f1bfded7';
			} else if (normalizedFunnelId.includes('mexico')) {
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

	$: if (submitSuccess) {
		if (redirectTimeout) clearTimeout(redirectTimeout);
		redirectTimeout = setTimeout(() => {
			window.location.href = "https://www.internationalrelocationpartner.com?from=thankyou";
		}, 3000);
	}

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
</style>
