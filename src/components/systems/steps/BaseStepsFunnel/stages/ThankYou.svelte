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

	export let canReveal = false;

	export let email: string | null = null;
	export let name: string | null = null;
	export let countryFrom: string | null = null;
	export let countryTo: string | null = null;

	// The video source and copy are now dynamic from the funnel store
	let trackingData: { queryParams?: Record<string, string>; lastKnownTime?: number } = {};

	function handleTimeUpdate(event: CustomEvent<{ currentTime: number }>) {
		trackingData = { ...trackingData, lastKnownTime: event.detail.currentTime };
	}

	function handleEnded() {
		if (get(store).stepsIndex === 0) {
			incrementStepsIndex();
		}
	}

	store.subscribe((s) => {
		if (!s.stepsIndex) {
			videoInteractionStore.set({ type: "play" });
			
			return;
		}
		
		videoInteractionStore.set({ type: "stop" });
	});

	$: currentFunnel;

	// onMount(() => {
	// 	setTimeout(() => {
	// 		console.log("$currentFunnel hoa", $currentFunnel)
	// 	}, 2e3)
	// })
</script>

<Page>
	<div>

		<div class="gap center">
			<MarkdownText {canReveal}>
				### Welcome to **International Relocation Partner**
	
				## You've **scheduled** a **call** with us.
			</MarkdownText>
			<div class="center">
				<SubmitButton
					color="error"
					label="NEXT STEPS"
					callback={() => {
						videoInteractionStore.set({ type: "stop" });
						saveToStore({
							stepsIndex: $store.stepsIndex + 1
						});
					}}
					disabled={false}
				/>
			</div>
			{#if email || name || countryFrom || countryTo}
				<div class="thankyou-details">
					{#if name}<div><b>Name:</b> {name}</div>{/if}
					{#if email}<div><b>Email:</b> {email}</div>{/if}
					{#if countryFrom}<div><b>From:</b> {countryFrom}</div>{/if}
					{#if countryTo}<div><b>To:</b> {countryTo}</div>{/if}
				</div>
			{/if}
			{#key $currentFunnel}
				<Video src={$currentFunnel?.thankYouSrc as string}/>
			{/key}
		</div>
	</div>
</Page>


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
		
		@media (max-width: 1024px) {
			padding: 25px;
		}
	}
</style>
