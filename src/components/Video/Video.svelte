<!-- Video.svelte -->
<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import Hls from "hls.js";

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
  let justActivated = false;          // ignora el click de la misma pulsación
  let clickCooldownUntil = 0;        // ignora clics en los próximos N ms

  let hls: Hls | null = null;
  let error: string | null = null;

  /* ---------- helpers ---------- */
  async function tryPlay() {
    if (!canPlay || !videoEl) return;

    try {
      if (isMobile && !playing) await videoEl.play();
      videoEl.muted = false;
      videoEl.volume = 1;

      interactionDone = true;
      playing = true;

      /* ── absorción de clices rápidos ── */
      justActivated = true;                    // ignora click del mismo gesto
      clickCooldownUntil = Date.now() + 400;   // y los que lleguen en 400 ms
      setTimeout(() => (justActivated = false)); // libera tras el tick

      removeActivationListeners();
    } catch (err) {
      console.error("play() bloqueado:", err);
    }
  }

  function togglePlay(e: Event) {
    e.stopPropagation();

    /* descarta: 1) click del mismo gesto  2) clics dentro del cooldown */
    if (justActivated || Date.now() < clickCooldownUntil) return;

    if (playing) {
      videoEl.pause();
      playing = false;
    } else {
      videoEl.play().then(() => (playing = true)).catch(console.error);
    }
  }

  /* ---------- activation listeners ---------- */
  function addActivationListeners() {
    if (isMobile) {
      container.addEventListener("touchstart", tryPlay, { once: true });
    } else {
      container.addEventListener("pointerdown", tryPlay, { once: true });
      window.addEventListener("keydown", tryPlay, { once: true });
    }
  }
  function removeActivationListeners() {
    container.removeEventListener("touchstart", tryPlay);
    container.removeEventListener("pointerdown", tryPlay);
    window.removeEventListener("keydown", tryPlay);
  }

  /* ---------- lifecycle ---------- */
  onMount(() => {
    isMobile = matchMedia("(pointer: coarse)").matches;

    if (videoEl) {
      videoEl.muted = true;
      if (!isMobile) videoEl.autoplay = true;          // desktop: autoplay silenciado
      initHls();
    }

    addActivationListeners();
  });

  onDestroy(() => {
    removeActivationListeners();
    hls?.destroy();
  });

  function initHls() {
    if (Hls.isSupported()) {
      hls = new Hls();
      hls.loadSource(src);
      hls.attachMedia(videoEl);
      hls.on(Hls.Events.MANIFEST_PARSED, () => (canPlay = true));
      hls.on(Hls.Events.ERROR, (_e, d) => (error = d.details ?? "HLS error"));
    } else if (videoEl.canPlayType("application/vnd.apple.mpegurl")) {
      videoEl.src = src;
      videoEl.addEventListener("loadedmetadata", () => (canPlay = true));
    } else {
      error = "HLS no soportado.";
    }
  }
</script>

{#if error}
  <p style="color:red">{error}</p>
{/if}

<div class="video" bind:this={container}>
  {#if !interactionDone}
    <div class="overlay">
      {isMobile ? "Tap to play with sound" : "Click to activate sound"}
    </div>
  {/if}

  <video
    bind:this={videoEl}
    class="hero-banner-video"
    playsinline
    {poster}
    on:click={togglePlay} />

  <!-- botón “play” con icono + ghost -->
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
    background: rgba(0, 0, 0, 0.45);
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
