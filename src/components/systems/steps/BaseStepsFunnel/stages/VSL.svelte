<script lang="ts">
	import { get } from 'svelte/store';
	import store, { incrementStepsIndex, saveToStore, currentFunnel } from '../../../../store.ts';
	import Page from '../../../wrappers/Page/Page.svelte';
	import MarkdownText from '../../../texts/MarkdownText/MarkdownText.svelte';
	import Video from '../../../../Video/Video.svelte';
  import SubmitButton from '../../../buttons/SubmitButton/SubmitButton.svelte';
  import { videoInteractionStore } from '../../../../Video/VideoInteractionStore.ts';
  import ImageGrid from '../../../wrappers/ImageGrid/ImageGrid.svelte';
  import { browser } from '$app/environment';

	export let canReveal = false;
  export let thankYouUrl: string = '/thank-you';

	// Tracking
	let trackingData: { queryParams?: Record<string, string>; lastKnownTime?: number } = {};
  let utms: Record<string, string> = {};
  let utmCaptured = false;

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

  // Save funnel copy to localStorage when available
  $: {
    if (browser && $currentFunnel && typeof $currentFunnel.copy === 'string') {
      try {
        localStorage.setItem('funnelCopyText', $currentFunnel.copy);
        // console.log('Funnel copy saved to localStorage.');
      } catch (error) {
        console.error('Error saving funnel copy to localStorage:', error);
      }
    }
  }

  // Capture UTMs once on client
  $: if (browser && !utmCaptured) {
    try {
      const params = new URLSearchParams(location.search);
      utms = Object.fromEntries(params.entries());
      trackingData = { ...trackingData, queryParams: utms };
      localStorage.setItem('utm', JSON.stringify(utms));
    } catch { /* noop */ }
    utmCaptured = true;
  }

  // Unified CTA → Thank-You (preserves your step logic)
  function handleCTA(label: string = 'schedule_consultation') {
    videoInteractionStore.set({ type: "stop" });
    saveToStore({ stepsIndex: get(store).stepsIndex + 1 });

    if (browser) {
      const params = new URLSearchParams({
        ...utms,
        vsec: String(Math.floor(trackingData.lastKnownTime || 0)),
        cta: label,
        src: 'landing'
      });
      window.location.href = `${thankYouUrl}?${params.toString()}`;
    }
  }
</script>

<svelte:head>
  <!-- Lightweight Organization + AggregateRating schema -->
  <script type="application/ld+json">
    {JSON.stringify({
      "@context":"https://schema.org",
      "@type":"Organization",
      "name": $currentFunnel?.brand ?? "Your Brand",
      "url": typeof window !== 'undefined' ? window.location.origin : "https://yourdomain.com",
      "aggregateRating": {
        "@type":"AggregateRating",
        "ratingValue": $currentFunnel?.ratingValue ?? "4.9",
        "ratingCount": $currentFunnel?.ratingCount ?? "6403"
      }
    })}
  </script>
</svelte:head>

<Page>
	{#if $currentFunnel}
    <!-- New top fold: eyebrow → headline → subhead → primary CTA -->
    <div class="hero center">
      <span class="eyebrow">
        {$currentFunnel.eyebrow ?? 'New Appointment Revealed'}
        <span class="eyebrow-dot"></span>
      </span>

      <h1 class="headline">
        {$currentFunnel.copy}
      </h1>

      <p class="subhead">
        {$currentFunnel.subhead ?? 'Schedule your strategy consult. No fluff—see your gaps, your numbers, your plan.'}
      </p>

      <SubmitButton
        color="error"
        label="SCHEDULE CONSULTATION"
        callback={() => handleCTA('hero_cta')}
        disabled={false}
      />

      <div class="arrow-bounce" aria-hidden="true">⬇</div>
    </div>
		<Video
			src={$currentFunnel.videoSrc}
			on:timeupdate={handleTimeUpdate}
			on:ended={handleEnded}
		/>

    <!-- Simple proof strip -->
    <div class="center proof">
      <div
        class="rating"
        aria-label="{($currentFunnel?.ratingValue ?? '4.9')} out of 5 from {($currentFunnel?.ratingCount ?? '6403')} reviews"
      >
        ★★★★★ {($currentFunnel?.ratingValue ?? '4.9')}/5 · {($currentFunnel?.ratingCount ?? '6,403')} reviews
      </div>
    </div>

		<div class="center">
			<SubmitButton
				color="error"
				label="SCHEDULE CONSULTATION"
				callback={() => handleCTA('below_video_cta')}
				disabled={false}
			/>
			<div class="gap">
				<MarkdownText {canReveal}>
					You can **only** schedule your **consultation** call from **three** to **five** days in advance.
				</MarkdownText>
			</div>
		</div>
	{:else}
		<div class="center">
			<p class="error-message">Loading video...</p>
		</div>
	{/if}

	<ImageGrid images={[
		"icons/partners/AAH.svg",
		"icons/partners/AAE.webp",
		"icons/partners/AAK.svg",
		"icons/partners/AAB.svg",
		"icons/partners/AAC.svg",
		"icons/partners/AAA.png",
		"icons/partners/AAD.svg",
		"icons/partners/AAF.svg",
		"icons/partners/AAG.svg",
		"icons/partners/AAI.svg",
		"icons/partners/AAJ.png",
	]}/>

  <footer class="legal">
    <a href="/terms">Terms of Use</a> · <a href="/privacy">Privacy Policy</a>
  </footer>
</Page>

<style>
	.pt	{ padding-top: 100px; }

	.center {
		display: grid;
		place-items: center;
		text-align: center;
		max-width: 500px;
		margin: auto;
		grid-gap: 25px;
	}

  .hero.center { max-width: 1024px; margin-top: 24px; gap: 14px; padding: 0 2rem; }

  .eyebrow {
    font-size: 0.875rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    opacity: 0.9;
    position: relative;
	color: var(--color-background);
  }
  .eyebrow-dot {
    display: inline-block;
    width: 0.5em; height: 0.5em;
    border-radius: 50%;
    background: greenyellow;
    margin-left: 0.4em;
    animation: pulse 1.6s infinite;
  }

  .headline {
    font-size: clamp(36px, 6vw, 50px);
    line-height: 1.1;
    margin: 0;
	font-family: var(--font-subtitle);
  }
  .subhead {
    font-size: clamp(16px, 2vw, 18px);
    opacity: 0.9;
    margin: 0;
	color: var(--color-background);
  }
  .arrow-bounce {
    font-size: 100px;
    animation: bounce 1.4s infinite;
    margin-top: 6px;
	color: greenyellow;
  }

	video {
		position: relative;
		display: block;
		width: 100%;
		max-width: 1024px;
		min-height: 512px;
		margin: auto;
		height: auto;
		background-size: cover;
		object-fit: cover;
	}

	/* Scoped error message (fixes global <p> selector bug) */
	.error-message {
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		color: white;
		z-index: 1;
		background-color: rgba(0, 0, 0, 0.5);
		padding: 1em;
		border-radius: 8px;
	}

	.login-overlay {
		z-index: 2;
		display: flex;
		gap: 10px;
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
	.login-button.google { background-color: #db4437; }
	.login-button.facebook { background-color: #4267b2; }
	.login-button.linkedin { background-color: #0077b5; }

	.login-button:hover { opacity: 0.9; }

	.gap {
		max-width: 1024px;
		margin: auto;
		padding: 25px;
	}

  .proof .rating { font-weight: 600; opacity: 0.9; margin-bottom: 1rem; }

  .legal { 
	text-align: center; opacity: 0.7; padding: 24px 0 16px; font-size: 0.85rem;
	a {color: var(--color-highlight)}	
}

  @keyframes bounce {
    0%,100% { transform: translateY(0) }
    50% { transform: translateY(6px) }
  }
  @keyframes pulse {
    0%,100% { opacity: 0.3 }
    50% { opacity: 1 }
  }
</style>
