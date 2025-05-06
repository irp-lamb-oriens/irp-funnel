<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import Hls from "hls.js";
  import { videoInteractionStore } from "./VideoInteractionStore.ts";
  import type { VideoEvent } from "./VideoInteractionStore.ts";

  let videoElement: HTMLVideoElement;
  export let src: string;
  export let autoplay: boolean = false;
  export let poster: string = "miniatura de video 9s.png";

  let hls: Hls | null = null;
  let error: string | null = null;
  let isVideoPaused: boolean = false;
  let videoDurationMinutes: number | null = null;
  let isMuted: boolean = true;
  let interactionHandled = false;
  let videoContainer: HTMLDivElement;

  function handleUserInteraction() {
    if (interactionHandled) return;
    interactionHandled = true;
    isMuted = false;
    if (videoElement) {
      videoElement.muted = false;
      videoElement.volume = 1;
      videoElement.play();
    }
    videoInteractionStore.set({ type: "interaction" });
    // Remove listeners
    videoContainer?.removeEventListener("mouseover", handleUserInteraction);
    videoContainer?.removeEventListener("click", handleUserInteraction);
    window.removeEventListener("scroll", handleUserInteraction);
  }

  function setIsVideoPaused() {
    const { currentTime, paused, ended } = videoElement;
    isVideoPaused = currentTime > 0 && !paused && !ended;
  }

  function changeVideo() {
    setIsVideoPaused();
    if (!isVideoPaused) videoElement.play();
    if (isVideoPaused) videoElement.pause();
  }

  function handleTimeUpdate() {
    videoInteractionStore.set({ type: "timeupdate", currentTime: videoElement.currentTime });
  }

  function handleEnded() {
    isVideoPaused = true;
    videoInteractionStore.set({ type: "ended" });
  }

  let unsubscribe: () => void;

  function handleExternalVideoEvent(event: VideoEvent | null) {
    if (!event) return;
    if (event.type === "stop" && videoElement) {
      videoElement.pause();
      videoElement.currentTime = 0;
      isVideoPaused = true;
    }
  }

  onMount(() => {
    unsubscribe = videoInteractionStore.subscribe(handleExternalVideoEvent);
    if (videoElement) {
      // Set volume to max

      if (Hls.isSupported()) {
        hls = new Hls();
        hls.loadSource(src);
        hls.attachMedia(videoElement);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          if (autoplay) {
            videoElement.play();
            videoElement.volume = 1;
          }
          if (videoElement?.duration) {
            videoDurationMinutes = Math.ceil(videoElement.duration / 60);
          }
        });
        hls.on(Hls.Events.ERROR, (event, data) => {
          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                error = "Network error loading video.";
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                error = "Media error loading video.";
                hls?.recoverMediaError();
                break;
              default:
                error = "Error loading video.";
                hls?.destroy();
                hls = null;
                break;
            }
          }
        });
      } else if (videoElement.canPlayType("application/vnd.apple.mpegurl")) {
        // Safari support
        videoElement.src = src;
        videoElement.addEventListener("loadedmetadata", () => {
          if (autoplay) {
            videoElement.play();
          }
          if (videoElement?.duration) {
            videoDurationMinutes = Math.ceil(videoElement.duration / 60);
          }
        });
        videoElement.addEventListener("error", () => {
          error = "Error loading video (native).";
        });
      } else {
        error = "HLS video playback is not supported in this browser.";
      }

      videoElement.addEventListener("timeupdate", handleTimeUpdate);
      videoElement.addEventListener("ended", handleEnded);
    }

    // Add user interaction listeners for unmuting and playing with sound
    videoContainer?.addEventListener("mouseover", handleUserInteraction, { once: true });
    videoContainer?.addEventListener("click", handleUserInteraction, { once: true });
    window.addEventListener("scroll", handleUserInteraction, { once: true });
  });

  onDestroy(() => {
    if (unsubscribe) unsubscribe();
    if (hls) {
      hls.destroy();
      hls = null;
    }
    videoElement?.removeEventListener("timeupdate", handleTimeUpdate);
    videoElement?.removeEventListener("ended", handleEnded);
  });
</script>
  
  {#if error}
    <p style="color: red;">{error}</p>
  {/if}
  <div class="video" bind:this={videoContainer} on:click={changeVideo}>
    <video
      bind:this={videoElement}
      class="hero-banner-video"
      id="videoPlayer"
      {poster}
      {autoplay}
      playsinline
      muted={isMuted}
    />
    <button on:click={changeVideo} class="video--play-button {isVideoPaused}">
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
      margin: 150px 0 100px;
  
      &::after {
        content: "";
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        display: block;
        z-index: 1;
        width: 100%;
        height: 100%;
      }
  
      .play-container {
        position: relative;
      }
  
      .ghost {
        position: absolute;
        top: 0;
        left: 0;
        opacity: 0.875;
        filter: blur(5px);
      }
  
      &--play-button {
        cursor: pointer;
        border: 0;
        margin: 0;
        padding: 0;
        background: transparent;
        position: absolute;
        transition: var(--transition-shortest-duration);
        filter: invert(0);
        mix-blend-mode: difference;
  
        &.false {
          opacity: 0;
        }
  
        &:hover {
          transform: scale(1.05);
        }
  
        &:active {
          transform: scale(1.2);
          opacity: 0.5;
  
          .ghost {
            animation: fade-grow var(--transition-shortest-duration) ease-out;
          }
        }
      }
    }
  
    @keyframes fade-grow {
      100% {
        opacity: 0;
        transform: scale(calc(1.25 * 1.25), calc(1.35 * 1.25));
      }
    }
  
    .hero-banner-video {
      object-fit: cover;
      width: 100%;
      height: clamp(50vw, 100vh, min(50vh, 80vh));
    }
  </style>
