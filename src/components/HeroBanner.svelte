<script lang="ts">
  import { onMount } from "svelte";
  import CTAButton from "./Header/CTAButton.svelte";
  export let videoUrl: string = "https://storage.googleapis.com/videos-irp-funnels/The-Truth-About-Moving-Abroad_-What-You-Need-to-Know-Before-Taking-the-Leap.mp4";
  export let imageUrl: string = "/video-lightbox1b-480x590.jpg";
  export let imageAlt: string = "video-lightbox1b";

  let isPlaying = false;
  let isHovered = false;
  let isVideoPlaying = false;
  let videoEl: HTMLVideoElement | null = null;

  function playVideo() {
    isPlaying = true;
    setTimeout(() => {
      videoEl?.play();
    }, 100);
  }

  function replayVideo() {
    if (videoEl) {
      videoEl.currentTime = 0;
      videoEl.play();
    }
  }

  function resetVideo() {
    isPlaying = false;
    isVideoPlaying = false;
    if (videoEl) {
      videoEl.currentTime = 0;
      videoEl.pause();
    }
  }
</script>

<section class="home-banner">
  <div class="row">
    <div class="col col-image">
      <div
        class="media-container"
        on:mouseenter={() => isHovered = true}
        on:mouseleave={() => isHovered = false}
      >
        {#if !isPlaying}
          <img
            class="media-image {isHovered ? 'hovered' : ''}"
            src={imageUrl}
            alt={imageAlt}
            width="480"
            height="590"
            on:click={playVideo}
            draggable="false"
          />
          <button
            class="play-btn {isHovered ? 'hovered' : ''}"
            aria-label="Play video"
            on:click={playVideo}
            tabindex="0"
            type="button"
          >
            <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
              <circle cx="32" cy="32" r="32" fill="rgba(0,0,0,0.55)" />
              <polygon points="26,20 48,32 26,44" fill="#fff"/>
            </svg>
          </button>
        {:else}
          <div class="video-wrapper">
            <video
              bind:this={videoEl}
              class="media-video"
              src={videoUrl}
              poster={imageUrl}
              preload="auto"
              playsinline
              controls
              on:play={() => isVideoPlaying = true}
              on:pause={() => isVideoPlaying = false}
              on:ended={resetVideo}
            />
            <button
              class="play-btn over-video {isHovered ? 'hovered' : ''} {isVideoPlaying ? 'hidden' : ''}"
              aria-label="Replay video"
              on:click={replayVideo}
              tabindex="0"
              type="button"
            >
              <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
                <circle cx="32" cy="32" r="32" fill="rgba(0,0,0,0.55)" />
                <polygon points="26,20 48,32 26,44" fill="#fff"/>
              </svg>
            </button>
          </div>
        {/if}
      </div>
    </div>
    <div class="col col-content">
      <h6>Every move is led by professionals with more than 14 years of experience</h6>
      <h1 class="moto">Personalized relocation assistance <br/> delivered through well planned, <br/> tracked and executed projects!</h1>
      <h4>Relocation services for expats, newcomers and retirees:</h4>
      <ul>
        <li class="service">International Moving Services</li>
        <li class="service">Package Forwarding</li>
        <li class="service">Automobile & Boat Shipping</li>
      </ul>
      <div class="button-row">
        <CTAButton label="Schedule Consultation" href="/consultation/" variant="primary" />
        <CTAButton label="Download Relocation Checklist" href="/free-resources/" variant="secondary" target="_blank" />
      </div>
    </div>
  </div>
</section>

<style lang="scss">
.home-banner {
  background: #f8f8f8;
  padding: 2.5rem 0;
  .row {
    align-items: center;
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(500px, 1fr));
  }
  .col-image {
    flex: 1 1 40%;
    display: flex;
    justify-content: center;
    .media-container {
      position: relative;
      width: 480px;
      height: 590px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      user-select: none;
      .media-image,
      .media-video {
        border-radius: 8px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.08);
        max-width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
        transition: transform 0.5s cubic-bezier(.77,0,.18,1), filter 0.4s;
      }
      .media-image {
        z-index: 1;
        filter: brightness(0.95);
        transition: transform 0.5s cubic-bezier(.77,0,.18,1), filter 0.4s;
      }
      .media-image.hovered {
        transform: scale(1.04) translateY(-8px) rotate(-1.5deg);
        filter: brightness(1.05) saturate(1.1);
      }
      .play-btn {
        position: absolute;
        left: 50%;
        top: 50%;
        z-index: 2;
        transform: translate(-50%, -50%) scale(1) rotate(0deg);
        opacity: 1;
        background: none;
        border: none;
        outline: none;
        cursor: pointer;
        transition:
          opacity 0.35s cubic-bezier(.77,0,.18,1),
          transform 0.5s cubic-bezier(.77,0,.18,1);
        will-change: opacity, transform;
        pointer-events: auto;
      }
      .play-btn.hovered {
        transform: translate(-50%, -60%) scale(1.12) rotate(-6deg);
        opacity: 0.92;
      }
      .play-btn.over-video {
        z-index: 3;
        pointer-events: auto;
        transition:
          opacity 0.35s cubic-bezier(.77,0,.18,1),
          transform 0.5s cubic-bezier(.77,0,.18,1);
      }
      .play-btn.over-video.hidden {
        opacity: 0;
        transform: translate(-50%, -30%) scale(0.7) rotate(8deg);
        pointer-events: none;
      }
      .play-btn.over-video.hovered:not(.hidden) {
        opacity: 1;
        transform: translate(-50%, -50%) scale(1.08) rotate(-8deg);
      }
      .video-wrapper {
        width: 100%;
        height: 100%;
        position: relative;
        z-index: 1;
        .media-video {
          width: 100%;
          height: 100%;
          object-fit: cover;
          border-radius: 8px;
          background: #000;
        }
      }
    }
  }
  .col-content {
    flex: 1 1 60%;
    h6 {
      color: var(--color-highlight-2);
      font-size: 1.1rem;
      font-weight: 700;
      margin-bottom: 1rem;
      letter-spacing: 0.02em;
    }
    h1 {
      font-size: 2.5rem;
      font-weight: 800;
      margin-bottom: 1.2rem;
      color: #222;
      text-align: left;
    }
    h4 {
      color: var(--color-highlight-1);
      font-size: 1.3rem;
      margin-bottom: 0.8rem;
      font-weight: 700;
    }
    ul {
      margin-bottom: 1.2rem;
      li {
        font-size: 1.1rem;
        margin-bottom: 0.3rem;
        text-align: left;
      }
    }
  }
}
.button-row {
  display: flex;
  gap: 1rem;
  margin-top: 1.2rem;
  flex-wrap: wrap;
}
.cta-btn, .primary-btn {
  background: var(--color-highlight-1);
  color: #fff;
  display: inline-block;
  border-radius: 4px;
  padding: 0.5rem 1.2rem;
  font-weight: 600;
  text-decoration: none;
  transition: background 0.15s, color 0.15s;
  cursor: pointer;
  &:hover {
    background: var(--color-outline);
  }
}
.primary-btn {
  background: var(--color-highlight-1);
  color: #fff;
}
@media (max-width: 1200px) {
  .row {
    flex-direction: column;
    padding: 0 1rem;
  }
  .col, .col-content, .col-image {
    flex: 1 1 100%;
    min-width: 0;
    text-align: center;
  }
}
@media (max-width: 700px) {
  .home-banner {
    padding: 1.2rem 0;
  }
}
</style>
