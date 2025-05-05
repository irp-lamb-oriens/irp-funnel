<script lang="ts">
	import { onMount, onDestroy, tick } from 'svelte'; // Import tick
	import Hls from 'hls.js';
	import { page } from '$app/stores'; // Import page store for query params
	import { get } from 'svelte/store'; // Import get for reading store value
	import store, { incrementStepsIndex } from '../../../../store.ts'; // Import store and increment function - Added .ts extension
	import Centered from '../../../wrappers/Centered/Centered.svelte';
	import Page from '../../../wrappers/Page/Page.svelte';
    import MarkdownText from '../../../texts/MarkdownText/MarkdownText.svelte';

    export let canReveal = false;

	let videoElement: HTMLVideoElement;
	let error: string | null = null;
	let hls: Hls | null = null;
	let videoDurationMinutes: number | null = null; // Variable to store duration in minutes

	// Local object to store tracking data
	let trackingData: { queryParams?: Record<string, string>; lastKnownTime?: number } = {};

	// Function to handle time updates
	const handleTimeUpdate = () => {
		if (videoElement) {
			trackingData = { ...trackingData, lastKnownTime: videoElement.currentTime };
			// Log the data for now (can be sent to server later)
			// console.log('Tracking Data:', trackingData);
		}
	};

	// Function to handle video ending
	const handleVideoEnded = () => {
		console.log("Video ended.");
		// Check if current step is 0 before incrementing
		if (get(store).stepsIndex === 0) {
		  console.log("Incrementing step index from VSL.");
		  incrementStepsIndex();
		}
	};

  // The Cloudflare Stream manifest URL
  const videoManifestUrl = 'https://customer-ygvpdn9is2a2i5fz.cloudflarestream.com/d2a2c9a2512a8ce37f248b49c4275762/manifest/video.m3u8';
  // It seems Cloudflare Stream might protect direct blob fetching of the manifest or segments.
  // A more common Cloudflare approach for direct video files (not HLS/DASH streams) would be R2 or standard CDN.
  // If the video was a single MP4 file hosted on Cloudflare (e.g., R2), this blob approach would be more straightforward.
  // Let's try fetching the manifest URL directly, though typically video players handle HLS manifests internally.
  // Fetching the entire video content as a single blob is generally not recommended for HLS/DASH streams.
  // The browser's native video player or libraries like HLS.js are designed to handle these manifests efficiently.

  // Sticking to the request for "blob loading", we'll fetch and create a blob URL.
  // Note: This might not work as expected with M3U8 manifests, as the player needs to interpret the manifest,
  // not just play a single blob. A better approach for HLS would be using HLS.js library.
	// However, fulfilling the "blob loading" request literally:

	// let objectUrl: string | null = null; // Blob logic removed as it's not suitable for HLS

	onMount(async () => {
		// Make onMount async again
		await tick(); // Wait for the video element to be bound

		// Get query parameters
		const queryParams: Record<string, string> = {};
		$page.url.searchParams.forEach((value, key) => {
			queryParams[key] = value;
		});
		trackingData = { ...trackingData, queryParams };
		console.log('Initial Tracking Data (with query params):', trackingData);


		try {
			// NOTE: Fetching an M3U8 manifest like this and setting it as a blob src
			// will likely NOT work as intended. The browser expects a video file blob,
      // not a manifest file blob. HLS/DASH players handle manifest fetching and segment loading.
      // For a *direct video file* (e.g., .mp4) this approach would work.
      // Let's simulate fetching *if* it were a direct file for demonstration.
			// We will keep the original manifest URL for the video tag for now,
			// as the blob approach is problematic for HLS.

			// If you had a direct MP4 URL like: const directVideoUrl = '.../video.mp4';
      // const response = await fetch(directVideoUrl);
      // if (!response.ok) {
      //   throw new Error(`HTTP error! status: ${response.status}`);
      // }
      // const videoBlob = await response.blob();
			// objectUrl = URL.createObjectURL(videoBlob);
			// videoSrc = objectUrl; // Don't set src directly when using HLS.js

			// --- HLS.js Integration ---
			if (videoElement) {
				if (Hls.isSupported()) {
					console.log('HLS.js is supported, initializing...');
					hls = new Hls();
					hls.loadSource(videoManifestUrl);
					hls.attachMedia(videoElement);
					hls.on(Hls.Events.MANIFEST_PARSED, () => {
						console.log('HLS Manifest parsed, video should be ready.');
						if (videoElement?.duration) {
							videoDurationMinutes = Math.ceil(videoElement.duration / 60);
						}
						// videoElement?.classList.add('loaded'); // Remove class addition
						// isLoading = false; // Remove isLoading update
						videoElement?.addEventListener('timeupdate', handleTimeUpdate); // Add listener
						videoElement?.addEventListener('ended', handleVideoEnded); // Add ended listener for HLS.js
					});
					hls.on(Hls.Events.ERROR, (event, data) => {
						if (data.fatal) {
							switch (data.type) {
								case Hls.ErrorTypes.NETWORK_ERROR:
									console.error('Fatal network error encountered:', data);
									error = 'Network error loading video.';
									break;
								case Hls.ErrorTypes.MEDIA_ERROR:
									console.error('Fatal media error encountered:', data);
									error = 'Media error loading video.';
									hls?.recoverMediaError(); // Attempt recovery
									break;
								default:
									console.error('Fatal HLS error:', data);
									error = 'Error loading video.';
									hls?.destroy(); // Destroy instance on unrecoverable error
									hls = null;
									break;
							}
						} else {
							console.warn('Non-fatal HLS error:', data);
						}
						// isLoading = false; // Remove isLoading update
					});
				} else if (videoElement.canPlayType('application/vnd.apple.mpegurl')) {
					// Native HLS support (e.g., Safari)
					console.log('Native HLS support detected.');
					videoElement.src = videoManifestUrl; // Set src directly for native support
					videoElement.addEventListener('loadedmetadata', () => {
						console.log('Video metadata loaded (native HLS).');
						if (videoElement?.duration) {
							videoDurationMinutes = Math.ceil(videoElement.duration / 60);
						}
						// videoElement?.classList.add('loaded'); // Remove class addition
						// isLoading = false; // Remove isLoading update
						videoElement?.addEventListener('timeupdate', handleTimeUpdate); // Add listener
						videoElement?.addEventListener('ended', handleVideoEnded); // Add ended listener for native HLS
					});
					videoElement.addEventListener('error', (e) => {
						console.error('Native HLS playback error:', e);
						error = 'Error loading video (native).';
						// isLoading = false; // Remove isLoading update
					});
					// Removed duplicate error listener
				} else {
					console.error('HLS is not supported in this browser.');
					error = 'HLS video playback is not supported in this browser.';
					// isLoading = false; // Remove isLoading update
				}
			} else {
				// This path should *really* not be reached now
				console.error('Video element not found after tick.');
				error = 'Video element initialization failed.';
				// isLoading = false; // Remove isLoading update
			}
		} catch (err) {
			console.error('Error during component mount:', err);
			error = 'Failed to initialize video component.';
			// isLoading = false; // Remove isLoading update
		}
	});

	onDestroy(() => {
		// Clean up HLS.js instance
		if (hls) {
			console.log('Destroying HLS instance.');
			hls.destroy();
			hls = null;
		}
		// Remove event listeners
		videoElement?.removeEventListener('timeupdate', handleTimeUpdate);
		videoElement?.removeEventListener('ended', handleVideoEnded); // Remove ended listener
		console.log('Final Tracking Data on Destroy:', trackingData);

		// Clean up blob URL if it was ever used (though it shouldn't be with HLS)
		// if (objectUrl) {
		//   URL.revokeObjectURL(objectUrl);
		// }
	});
</script>

<!-- Removed #if isLoading block -->
{#if error}
	<p style="color: red;">{error}</p>
{/if}
<Page>
	<div class="gap">
		{#if videoDurationMinutes}
			<MarkdownText {canReveal}>
				In the next {videoDurationMinutes} minutes,
			</MarkdownText>
		{/if}

		<MarkdownText {canReveal}>
			## **I’ll show you how you can successfully** relocate to Costa Rica** without the **stress of bureaucracy,** the **overwhelm of logistics,** or the **risk of making costly mistakes.
		</MarkdownText>
	</div>

	<!-- Video tag is always rendered now -->
	<video bind:this={videoElement} autoplay loop playsinline controls></video>
</Page>


<style>
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
