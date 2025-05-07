<script lang="ts">
	import { get } from 'svelte/store';
	import store, { incrementStepsIndex, saveToStore } from '../../../../store.ts';
	import Page from '../../../wrappers/Page/Page.svelte';
	import MarkdownText from '../../../texts/MarkdownText/MarkdownText.svelte';
	import Video from '../../../../Video/Video.svelte';
    import SubmitButton from '../../../buttons/SubmitButton/SubmitButton.svelte';
    import { videoInteractionStore } from '../../../../Video/VideoInteractionStore.ts';

	export let canReveal = false;

	// The Cloudflare Stream manifest URL
	const videoManifestUrl = 'https://customer-ygvpdn9is2a2i5fz.cloudflarestream.com/d2a2c9a2512a8ce37f248b49c4275762/manifest/video.m3u8';

	let videoDurationMinutes: number | null = null;
	let trackingData: { queryParams?: Record<string, string>; lastKnownTime?: number } = {};

	function handleTimeUpdate(event: CustomEvent<{ currentTime: number }>) {
		trackingData = { ...trackingData, lastKnownTime: event.detail.currentTime };
	}

	function handleEnded() {
		if (get(store).stepsIndex === 0) {
			incrementStepsIndex();
		}
	}
</script>

<Page>
	<div class="gap">
		<MarkdownText {canReveal}>
			## **I’ll show you how you can successfully** relocate to Costa Rica** without the **stress of bureaucracy,** the **overwhelm of logistics,** or the **risk of making costly mistakes.
		</MarkdownText>
	</div>
	<Video
		src={videoManifestUrl}
		autoplay={true}
		on:timeupdate={handleTimeUpdate}
		on:ended={handleEnded}
	/>
	<div class="center">
		<SubmitButton
			color="error"
			label="SCHEDULE CONSULTATION"
			callback={() => {
				videoInteractionStore.set({ type: "stop" });
				saveToStore({
					stepsIndex: $store.stepsIndex + 1
				});
			}}
			disabled={false}
		/>
		<MarkdownText {canReveal}>
			You can **only** schedule your **consultation** call from **three** to **five** days in advance.
		</MarkdownText>
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
