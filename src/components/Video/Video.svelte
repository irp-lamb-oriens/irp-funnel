<!-- Video.svelte -->
<script lang="ts">
  import { onMount, onDestroy } from "svelte";

  /* ---------- refs & props ---------- */
  let videoEl: HTMLVideoElement;
  let container: HTMLDivElement;

  export let src: string;
  export let poster = "miniatura de video 9s.png";

  /* ---------- state ---------- */
  let isMobile = false;
  let canPlay = false;
  let playing = false;
  let interactionDone = false;

  // anti-doble-clic (absorbe clics rápidos)
  let justActivated = false;
  let clickCooldownUntil = 0;

  let error: string | null = null;

  /* ---------- helpers ---------- */
  function gtagEvent(name: string, params: Record<string, any>) {
    if (typeof gtag === 'function') {
      gtag('event', name, params, { transport_type: 'beacon' });
    }
  }

  function tryPlay() {
    if (!canPlay || !videoEl) return;
    videoEl.muted = false;
    videoEl.volume = 1;
    interactionDone = true;
    playing = true;
    justActivated = true;
    clickCooldownUntil = Date.now() + 400;
    setTimeout(() => (justActivated = false));
    removeActivationListeners();
    videoEl.play().catch(console.error);
  }

  function togglePlay(e: Event) {
    e.stopPropagation();
    if (justActivated || Date.now() < clickCooldownUntil) return;
    if (playing) {
      videoEl.pause();
      playing = false;
    } else {
      videoEl.play().then(() => (playing = true)).catch(console.error);
    }
  }

  /* Custom video event handlers */
  function onPause() {
    gtagEvent('video_pause', {
      video_src: src,
      video_current_time: Math.floor(videoEl.currentTime),
      video_duration: Math.floor(videoEl.duration)
    });
  }

  function onEnded() {
    gtagEvent('video_complete', {
      video_src: src,
      video_duration: Math.floor(videoEl.duration)
    });
  }

  function onPageUnload() {
    if (playing && videoEl) {
      gtagEvent('video_exit', {
        video_src: src,
        video_current_time: Math.floor(videoEl.currentTime),
        video_duration: Math.floor(videoEl.duration)
      });
    }
  }

  function onVisibilityChange() {
    if (document.hidden) {
      onPageUnload();
    }
  }

  /* ---------- activation listeners ---------- */
  function addActivationListeners() {
    if (isMobile) {
      container.addEventListener('touchstart', tryPlay, { once: true });
    } else {
      container.addEventListener('pointerdown', tryPlay, { once: true });
      window.addEventListener('keydown', tryPlay, { once: true });
    }
  }
  function removeActivationListeners() {
    container.removeEventListener('touchstart', tryPlay);
    container.removeEventListener('pointerdown', tryPlay);
    window.removeEventListener('keydown', tryPlay);
  }

  /* ---------- lifecycle ---------- */
  onMount(() => {
    isMobile = matchMedia('(pointer: coarse)').matches;
    if (videoEl) {
      videoEl.muted = true;
      videoEl.src = src;
      videoEl.addEventListener('loadedmetadata', () => (canPlay = true));
      videoEl.addEventListener('error', () => (error = 'Video format not supported or failed to load.'));
      videoEl.addEventListener('pause', onPause);
      videoEl.addEventListener('ended', onEnded);
    }
    addActivationListeners();
    window.addEventListener('beforeunload', onPageUnload);
    document.addEventListener('visibilitychange', onVisibilityChange);
  });

  onDestroy(() => {
    removeActivationListeners();
    if (videoEl) {
      videoEl.removeEventListener('pause', onPause);
      videoEl.removeEventListener('ended', onEnded);
    }
    window.removeEventListener('beforeunload', onPageUnload);
    document.removeEventListener('visibilitychange', onVisibilityChange);
  });
</script>

{#if error}
  <p style="color:red">{error}</p>
{/if}

<div class="video" bind:this={container}>
  {#if !interactionDone}
    <div class="overlay">
      {isMobile ? 'Tap to play with sound' : 'Click to activate sound'}
    </div>
  {/if}
  <video
    bind:this={videoEl}
    class="hero-banner-video"
    playsinline
    {poster}
    on:click={togglePlay} />
  <button
    on:click|stopPropagation={togglePlay}
    class="video--play-button {playing ? 'false' : ''}">
    <div class="play-container">
      <img class="ghost" src="./icons/play.svg" alt="video play button" />
      <img src="./icons/play.svg" alt="video play button" />
    </div>
  </button>
</div>

<style lang="scss">
.video {
  position: relative;
  display: flex;
  place-items: center;
  justify-content: center;
  margin: 15px 0 100px;

  .overlay {
    position: absolute;
    inset: 0;
    z-index: 2;
    background: var(--color-background);
    color: #fff;
    font: 600 clamp(1rem, 3vw, 1.5rem)/1.2 sans-serif;
    display: grid;
    place-items: center;
    cursor: pointer;
    user-select: none;
  }

  .play-container { position: relative; }

  .ghost {
    position: absolute;
    inset: 0;
    opacity: 0.875;
    filter: blur(5px);
  }

  .video--play-button {
    cursor: pointer;
    border: 0;
    padding: 0;
    background: transparent;
    position: absolute;
    mix-blend-mode: difference;
    z-index: 3;
    transition: var(--transition-shortest-duration);

    &.false {
      opacity: 0;
      pointer-events: none;
    }

    &:hover { transform: scale(1.05); }

    &:active {
      transform: scale(1.2);
      opacity: 0.5;
      .ghost { animation: fade-grow var(--transition-shortest-duration) ease-out; }
    }
  }
}

@keyframes fade-grow {
  100% { opacity: 0; transform: scale(1.5625, 1.6875); }
}

.hero-banner-video {
  object-fit: cover;
  width: 100%;
  height: clamp(50vw, 100vh, min(50vh, 80vh));
}
</style>
