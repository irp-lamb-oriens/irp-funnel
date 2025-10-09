<!-- Video.svelte -->
<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import Loading from "./Loading.svelte";
  import { autoLoad } from "./videoLoader.js";
  import type { AutoLoaderResult } from "./types.js";

  let videoEl: HTMLVideoElement;
  let container: HTMLDivElement;

  /** Public props */
  export let src: string | null = null;
  export let poster = "/video-lightbox1b-480x590.jpg";
  export let lazy = true;           // only attach src when in view
  export let spinnerDelay = 150;    // ms before showing spinner (prevents flicker)

  /** Local state */
  let isMobile = false;
  let hasMetadata = false;   // whether loadedmetadata fired for current src
  let canPlay = false;
  let playing = false;
  let interactionDone = false; // becomes true after user activates full playback
  let justActivated = false;
  let clickCooldownUntil = 0;
  let error: string | null = null;
  let lastSrc = "";
  let inView = true; // managed by IO when lazy=true
  let activeLoader: AutoLoaderResult | null = null;
  let abortController: AbortController | null = null;

  type NetState = 'idle'|'loading'|'metadata'|'ready'|'buffering'|'error';
  let netState: NetState = 'idle';

  // === Montage (preview) mode ===
  // Plays tiny 1/8s snippets at evenly spaced points, looping until user hits Play.
  let montageMode = false;
  const snippetLen = 0.125;            // seconds
  const montageSlots = 12;             // number of evenly spaced snippet positions
  let montageStarts: number[] = [];    // computed after metadata
  let montageIndex = 0;
  let segmentEnd = 0;                  // current snippet end time (seconds)

  function buildMontageStops() {
    montageStarts = [];
    if (!videoEl || !isFinite(videoEl.duration) || videoEl.duration <= 0) return;
    const dur = videoEl.duration;
    const maxStart = Math.max(0, dur - snippetLen);
    const slots = Math.max(2, montageSlots);
    for (let i = 0; i < slots; i++) {
      // Evenly spaced from 0 to maxStart (exclude exact end to avoid clamp churn)
      montageStarts.push((maxStart * i) / slots);
    }
    if (montageStarts.length === 0) montageStarts = [0];
  }

  function setSegment(i: number) {
    if (!videoEl || montageStarts.length === 0) return;
    montageIndex = (i + montageStarts.length) % montageStarts.length;
    const start = montageStarts[montageIndex];
    segmentEnd = Math.min(start + snippetLen, Math.max(0, videoEl.duration || 0));
    try { videoEl.currentTime = start; } catch {}
  }

  function startMontage() {
    if (!videoEl) return;
    buildMontageStops();
    montageMode = true;
    playing = true;
    videoEl.muted = true;     // required for autoplay
    videoEl.volume = 0;
    // Kick off playback and jump to first snippet
    setSegment(0);
    videoEl.play().catch(() => { playing = false; /* ignore, will retry on canplay */ });
  }

  function stopMontageAndPlayFromStartUnmuted() {
    if (!videoEl) return;
    montageMode = false;
    interactionDone = true;
    justActivated = true;
    clickCooldownUntil = Date.now() + 400;
    setTimeout(() => (justActivated = false), 400);

    try { videoEl.pause(); } catch {}
    videoEl.muted = false;
    videoEl.volume = 1;
    try { videoEl.currentTime = 0; } catch {}
    videoEl.play().then(() => (playing = true)).catch(() => (playing = false));
  }

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

  async function resetForNewSrcState() {
    if (abortController) {
      abortController.abort();
      abortController = null;
    }
    if (activeLoader?.teardown) {
      await activeLoader.teardown();
    }
    activeLoader = null;
    hasMetadata = false;
    canPlay = false;
    error = null;
    montageMode = false;
    montageStarts = [];
    montageIndex = 0;
    segmentEnd = 0;
    interactionDone = false;
    playing = false;
  }

  /** React to src + inView (lazy) changes */
  $: {
    const newSrc = (src ?? '').trim();

    if (!videoEl) {
      // not mounted yet
    } else if (newSrc && newSrc !== lastSrc && (inView || !lazy)) {
      (async () => {
        await resetForNewSrcState();
        lastSrc = newSrc;
        netState = 'loading';
        scheduleSpinner();
        abortController = new AbortController();
        try {
          // Prioritize direct loading and use autoLoad as a fallback system.
          videoEl.src = newSrc;
          videoEl.muted = true; // ensure autoplay eligibility
          videoEl.load(); // kick off load pipeline
        } catch (e) {
          const err = e as Error;
          error = err.message;
          netState = 'error';
          hideSpinner();
        }
      })();
    } else if (!newSrc) {
        (async () => {
            try { videoEl.pause(); } catch {}
            await resetForNewSrcState();
            lastSrc = "";
            videoEl.removeAttribute("src");
            videoEl.load();
            netState = 'idle';
            hideSpinner();
        })();
    }
  }

  /** Activation / playback */
  function tryPlay() {
    // Called from overlay (if shown). We use it to exit montage and play normally.
    stopMontageAndPlayFromStartUnmuted();
  }

  function togglePlay(e: Event) {
    e.stopPropagation();
    if (justActivated || Date.now() < clickCooldownUntil) return;

    if (montageMode) {
      // User explicitly wants full playback
      stopMontageAndPlayFromStartUnmuted();
      return;
    }

    if (playing) {
      videoEl.pause();
      playing = false;
    } else {
      videoEl.play().then(() => (playing = true)).catch(() => (playing = false));
    }
  }

  /** Media events → state transitions */
  function onLoadStart() { netState = 'loading'; scheduleSpinner(); }
  function onLoadedMetadata() {
    hasMetadata = true; error = null; netState = 'metadata'; hideSpinner();
    buildMontageStops();
  }
  function onCanPlay() {
    canPlay = true; netState = 'ready'; hideSpinner();
    // Autoplay muted + montage, only if user hasn't interacted yet
    if (!interactionDone && !montageMode) startMontage();
  }
  function onPlaying() { playing = true; if (netState !== 'ready') netState = 'ready'; hideSpinner(); }
  function onWaiting() { if (playing) { netState = 'buffering'; scheduleSpinner(); } }
  function onStalled() { if (playing) { netState = 'buffering'; scheduleSpinner(); } }
  function onTimeUpdate() {
    if (playing && netState === 'buffering') { netState = 'ready'; hideSpinner(); }

    // Advance montage snippets while in preview mode
    if (montageMode && videoEl && isFinite(segmentEnd) && segmentEnd > 0) {
      // Small epsilon to avoid stutter loops
      if (videoEl.currentTime >= segmentEnd - 0.01) {
        setSegment((montageIndex + 1) % Math.max(1, montageStarts.length));
        // Ensure playback continues after seek
        videoEl.play().catch(() => {});
      }
    }
  }
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
    const checkWindow = () => {
      if (typeof window !== 'undefined') {
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
      } else {
        setTimeout(checkWindow, 50); // Check again in 50ms
      }
    };
    checkWindow();
  });

  onMount(() => {
    const savedTime = localStorage.getItem("videoCurrentTime");
    if (savedTime) {
      const time = parseFloat(savedTime);
      if (isFinite(time)) {
        // Wait for metadata to be loaded before setting currentTime
        const setTime = () => {
          if (videoEl.readyState >= 1) {
            videoEl.currentTime = time;
          } else {
            videoEl.addEventListener('loadedmetadata', () => videoEl.currentTime = time, { once: true });
          }
        };
        setTime();
      }
    }

    const interval = setInterval(() => {
      if (videoEl && !videoEl.paused && isFinite(videoEl.currentTime)) {
        localStorage.setItem("videoCurrentTime", videoEl.currentTime.toString());
      }
    }, 1000);

    // Cleanup when the component is destroyed
    return () => {
      clearInterval(interval);
    };
  });

  onDestroy(() => {
    if (typeof window !== 'undefined') {
      window.removeEventListener("beforeunload", onPageUnload);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    }
    hideSpinner();
    resetForNewSrcState();
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
    autoplay            
    preload="metadata"
    muted              
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
  {:else if hasMetadata && !interactionDone && !montageMode}
    <!-- If you still want a hint before autoplay starts for some edge case -->
    <div class="overlay" on:click={tryPlay}>
      {isMobile ? "Tap to play with sound" : "Click to activate sound"}
    </div>
  {/if}

  <button
    on:click|stopPropagation={togglePlay}
    class="video--play-button"
    class:hidden={!montageMode ? playing : false}  
    aria-label={playing && !montageMode ? "Pause" : "Play"}>
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
      background: transparent; /* don't block preview */
      color: #fff;
      font: 600 clamp(1rem, 3vw, 1.5rem)/1.2 sans-serif;
      display: grid;
      place-items: center;
      cursor: pointer;
      user-select: none;
      pointer-events: none; /* purely informational in preview */
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
