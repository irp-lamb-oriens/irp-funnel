<script lang="ts">
  import VideoBanner from "./VideoBanner.svelte";
  import CTAButton from "./Header/CTAButton.svelte";

  export let videoUrl: string = "https://storage.googleapis.com/videos-irp-funnels/The-Truth-About-Moving-Abroad_-What-You-Need-to-Know-Before-Taking-the-Leap.mp4";
  export let imageUrl: string = "/video-lightbox1b-480x590.jpg";
  export let imageAlt: string = "video-lightbox1b";
</script>

<section class="home-banner">
  <VideoBanner
    videoUrl={videoUrl}
    videoPoster={imageUrl}
    videoAlt={imageAlt}
  >
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
  </VideoBanner>
</section>

<style lang="scss">
.home-banner {
  background: #f8f8f8;
  padding: 2.5rem 0;
  .row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 2.5rem;
    transition: gap 0.6s cubic-bezier(.77,0,.18,1);
    &.expanded {
      gap: 0;
    }
  }
  .col-image {
    flex: 1 1 40ch;
    display: flex;
    justify-content: center;
    min-width: 0;
    position: relative;
    transition: flex-basis 0.7s cubic-bezier(.77,0,.18,1), width 0.7s cubic-bezier(.77,0,.18,1);
    z-index: 2;
    .media-container {
      position: relative;
      width: min(100vw, 480px);
      aspect-ratio: 480/590;
      display: flex;
      align-items: center;
      justify-content: center;
      user-select: none;
      transition: width 0.5s cubic-bezier(.77,0,.18,1), aspect-ratio 0.5s cubic-bezier(.77,0,.18,1);
    }
    .row.expanded .col-image .media-container {
      width: 100%;
      aspect-ratio: auto;
      height: 100%;
      max-width: none;
    }
    .media-image {
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.08);
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
      cursor: pointer;
      transition: filter 0.3s;
      &:focus-visible {
        outline: 2px solid var(--color-highlight-1);
      }
    }
    .play-btn {
      position: absolute;
      left: 50%;
      top: 50%;
      z-index: 2;
      transform: translate(-50%, -50%);
      background: none;
      border: none;
      outline: none;
      cursor: pointer;
      transition: transform 0.3s;
      &:hover, &:focus-visible {
        transform: translate(-50%, -50%) scale(1.12);
      }
    }
    .video-wrapper {
      width: 100%;
      height: 100%;
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #000;
      border-radius: 8px;
      animation: expandIn 0.5s cubic-bezier(.77,0,.18,1);
      transition: width 0.5s cubic-bezier(.77,0,.18,1), height 0.5s cubic-bezier(.77,0,.18,1);
      .media-video {
        width: 100%;
        height: 100%;
        border-radius: 8px;
        background: #000;
        outline: none;
        object-fit: cover;
      }
      .play-btn.over-video {
        position: absolute;
        left: 50%;
        top: 50%;
        z-index: 10;
        transform: translate(-50%, -50%);
        background: none;
        border: none;
        cursor: pointer;
        opacity: 0.85;
        transition: opacity 0.2s;
        &:hover, &:focus-visible {
          opacity: 1;
        }
      }
      .close-btn {
        position: absolute;
        top: 1rem;
        right: 1rem;
        background: rgba(0,0,0,0.5);
        border: none;
        border-radius: 50%;
        width: 2.5rem;
        height: 2.5rem;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        z-index: 10;
        transition: background 0.2s;
        &:hover, &:focus-visible {
          background: rgba(0,0,0,0.8);
        }
        svg {
          display: block;
        }
      }
    }
    .row.expanded .col-image .video-wrapper {
      width: 100%;
      height: 100%;
      max-width: none;
      max-height: none;
    }
  }
  .col-content {
    flex: 1 1 40ch;
    min-width: 0;
    padding: 0 1rem;
    display: flex;
    flex-direction: column;
    justify-content: center;
    transition: flex-basis 0.7s cubic-bezier(.77,0,.18,1), width 0.7s cubic-bezier(.77,0,.18,1), opacity 0.5s cubic-bezier(.77,0,.18,1);
    &.collapsed {
      flex-basis: 0 !important;
      width: 0 !important;
      min-width: 0 !important;
      opacity: 0;
      pointer-events: none;
      overflow: hidden;
    }
  }
  @media (max-width: 1200px) {
    .row {
      flex-direction: column;
      gap: 1.5rem;
      &.expanded {
        gap: 1.5rem;
      }
    }
    .col-image, .col-content {
      flex: 1 1 100%;
      width: 100%;
      min-width: 0;
      padding: 0;
      opacity: 1 !important;
      pointer-events: auto !important;
      overflow: visible !important;
    }
    .col-content.collapsed {
      opacity: 1 !important;
      pointer-events: auto !important;
      overflow: visible !important;
      width: 100% !important;
      flex-basis: 100% !important;
    }
    .media-container {
      width: 100vw;
      max-width: 480px;
    }
    .video-wrapper {
      width: 100%;
      max-width: 100vw;
    }
  }
  @media (max-width: 700px) {
    padding: 1.2rem 0;
    .media-container {
      max-width: 100vw;
    }
    .video-wrapper {
      max-width: 100vw;
    }
  }
}

@keyframes expandIn {
  from { opacity: 0; transform: scale(0.98);}
  to { opacity: 1; transform: scale(1);}
}
</style>
