<!-- Video.svelte -->
<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import Loading from "./Loading.svelte";

  let videoEl: HTMLVideoElement;
  let container: HTMLDivElement;

  /** Public props */
  export let src: string | null = null;
  export let poster = "miniatura de video 9s.png";
  export let lazy = true;           // only attach src when in view
  export let spinnerDelay = 150;    // ms before showing spinner (prevents flicker)

  /** Local state */
  let isMobile = false;
  let hasMetadata = false;   // whether loadedmetadata fired for current src
  let canPlay = false;
  let playing = false;
  let interactionDone = false;
  let justActivated = false;
  let clickCooldownUntil = 0;
  let error: string | null = null;
  let lastSrc = "";
  let inView = true; // managed by IO when lazy=true

  type NetState = 'idle'|'loading'|'metadata'|'ready'|'buffering'|'error';
  let netState: NetState = 'idle';

  // Spinner with hysteresis (delay-in, instant-out)
  let showSpinner = false;
  let spinnerTimer: number | null = null;
  function scheduleSpinner() {
    if (spinnerTimer) clearTimeout(spinnerTimer);
    spinnerTimer = window.setTimeout(() => (showSpinner = true), spinnerDelay);
  }
  function hideSpinner() {
    if (spinnerTimer) clearTimeout(spinnerTimer);
    spinnerTimer = null;
    showSpinner = false;
  }

  // Optional GA
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  function gtagEvent(name: string, params: Record<string, any>) {
    if (typeof gtag === "function") {
      gtag("event", name, { ...params, transport_type: "beacon" });
    }
  }

  function resetForNewSrcState() {
    hasMetadata = false;
    canPlay = false;
    error = null;
  }

  /** React to src + inView (lazy) changes */
  $: {
    const newSrc = (src ?? '').trim();

    if (!videoEl) {
      // not mounted yet
    } else if (!newSrc || (lazy && !inView)) {
      // Idle: detach to abort network and avoid misleading spinner
      try { videoEl.pause(); } catch {}
      playing = false;
      resetForNewSrcState();
      lastSrc = "";
      videoEl.removeAttribute("src");
      videoEl.load();
      netState = 'idle';
      hideSpinner();
    } else if (newSrc !== lastSrc) {
      // Abort previous fetch cleanly, then set new source
      try { videoEl.pause(); } catch {}
      playing = false;
      videoEl.removeAttribute("src");
      videoEl.load();

      lastSrc = newSrc;
      resetForNewSrcState();
      videoEl.muted = true; // will unmute on user gesture
      videoEl.src = newSrc;
      videoEl.load();       // kick off load pipeline
      netState = 'loading';
      scheduleSpinner();
    }
  }

  /** Activation / playback */
  function tryPlay() {
    if (!canPlay || !videoEl) return;
    videoEl.muted = false;
    videoEl.volume = 1;
    interactionDone = true;
    playing = true;
    justActivated = true;
    clickCooldownUntil = Date.now() + 400;
    setTimeout(() => (justActivated = false), 400);
    videoEl.play().catch(() => { playing = false; });
  }

  function togglePlay(e: Event) {
    e.stopPropagation();
    if (justActivated || Date.now() < clickCooldownUntil) return;
    if (playing) {
      videoEl.pause();
      playing = false;
    } else {
      videoEl.play().then(() => (playing = true)).catch(() => (playing = false));
    }
  }

  /** Media events → state transitions */
  function onLoadStart() { netState = 'loading'; scheduleSpinner(); }
  function onLoadedMetadata() { hasMetadata = true; error = null; netState = 'metadata'; hideSpinner(); }
  function onCanPlay() { canPlay = true; netState = 'ready'; hideSpinner(); }
  function onPlaying() { playing = true; if (netState !== 'ready') netState = 'ready'; hideSpinner(); }
  function onWaiting() { if (playing) { netState = 'buffering'; scheduleSpinner(); } }
  function onStalled() { if (playing) { netState = 'buffering'; scheduleSpinner(); } }
  function onTimeUpdate() { if (playing && netState === 'buffering') { netState = 'ready'; hideSpinner(); } }
  function onError() {
    hasMetadata = false; canPlay = false; playing = false;
    netState = 'error'; hideSpinner();
    error = "Video failed to load or is not supported.";
  }

  /** Analytics */
  function onPause() {
    playing = false;
    if (!hasMetadata || !src) return;
    gtagEvent("video_pause", {
      video_src: src,
      video_current_time: Math.floor(videoEl.currentTime),
      video_duration: Math.floor(videoEl.duration)
    });
  }
  function onEnded() {
    playing = false;
    if (!hasMetadata || !src) return;
    gtagEvent("video_complete", {
      video_src: src,
      video_duration: Math.floor(videoEl.duration)
    });
  }
  function onPageUnload() {
    if (playing && videoEl && hasMetadata && src) {
      gtagEvent("video_exit", {
        video_src: src,
        video_current_time: Math.floor(videoEl.currentTime),
        video_duration: Math.floor(videoEl.duration)
      });
    }
  }
  function onVisibilityChange() {
    if (document.hidden) onPageUnload();
  }

  /** Lifecycle */
  onMount(() => {
    isMobile = matchMedia("(pointer: coarse)").matches;

    // Lazy: only consider in-view as eligible to load
    if (lazy) {
      const io = new IntersectionObserver(
        ([entry]) => { inView = entry.isIntersecting; },
        { threshold: 0.1 }
      );
      if (container) io.observe(container);
      // cleanup
      onDestroy(() => io.disconnect());
    }

    window.addEventListener("beforeunload", onPageUnload);
    document.addEventListener("visibilitychange", onVisibilityChange);
  });

  onDestroy(() => {
    window.removeEventListener("beforeunload", onPageUnload);
    document.removeEventListener("visibilitychange", onVisibilityChange);
    hideSpinner();
  });
</script>

<div class="video" bind:this={container}>
  {#if error}
    <p class="error">{error}</p>
  {/if}

  <!-- Always mounted; visibility by state -->
  <video
    bind:this={videoEl}
    class="hero-banner-video"
    class:ready={hasMetadata}
    playsinline
    preload="metadata"
    {poster}
    on:loadstart={onLoadStart}
    on:loadedmetadata={onLoadedMetadata}
    on:canplay={onCanPlay}
    on:playing={onPlaying}
    on:waiting={onWaiting}
    on:stalled={onStalled}
    on:timeupdate={onTimeUpdate}
    on:error={onError}
    on:pause={onPause}
    on:ended={onEnded}
    on:click={togglePlay} />

  {#if !src}
    <div class="overlay">No video source</div>
  {:else if showSpinner}
    <Loading />
  {:else if hasMetadata && !interactionDone}
    <div class="overlay" on:click={tryPlay}>
      {isMobile ? "Tap to play with sound" : "Click to activate sound"}
    </div>
  {/if}

  <button
    on:click|stopPropagation={togglePlay}
    class="video--play-button"
    class:hidden={playing}
    aria-label={playing ? "Pause" : "Play"}>
    <div class="play-container">
      <img class="ghost" src="./icons/play.svg" alt="" />
      <img src="./icons/play.svg" alt="Play video" />
    </div>
  </button>
</div>

<style lang="scss">
  .error { color: red; }

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

      &.hidden {
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
    opacity: 0;
    transition: opacity 200ms ease;
  }
  .hero-banner-video.ready { opacity: 1; }
</style>
