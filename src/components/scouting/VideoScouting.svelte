<script lang="ts">
  import { writable } from 'svelte/store';

  const coverHidden = writable(false);

  function hideCover() {
    coverHidden.set(true);
  }
</script>

<section class="video-section">
  <div class="row">
    <div class="col">
      <div class="video-wrapper" on:mouseenter={hideCover} on:click={hideCover} on:touchstart={hideCover}>
        <div class="cover" class:hidden={$coverHidden}>
          <div class="play-button"></div>
          <img src="/cover-riviera-maya-scout-trip.png" alt="Riviera Maya Scout Trip" />
        </div>
        <iframe class="youtube-video" width="560" height="315" src="https://www.youtube.com/embed/D7s95eodVH8?si=p7TUsZPXIudls_T_" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
      </div>
    </div>
  </div>
</section>

<style lang="scss">
  /* Video Section */
  .video-section {
    padding: 3rem 0;
    background: #fff;
    .row {
      display: flex;
      flex-wrap: wrap;
      max-width: 1200px;
      margin: 0 auto;
      padding: 0 2rem;
      align-items: flex-start;
      gap: 2rem;
    }
    .col {
      flex: 1 1 100%;
      min-width: 0;
    }
    .video-wrapper {
      position: relative;
      padding-bottom: 56.25%; /* 16:9 */
      height: 0;
      overflow: hidden;
      max-width: 100%;
      border-radius: 12px;
      box-shadow: 0 8px 25px rgba(0,0,0,0.1);
      
      .cover {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 1;
        transition: opacity 0.3s ease;
        pointer-events: none;

        &.hidden {
          opacity: 0;
        }

        img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          border-radius: 12px;
        }

        .play-button {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 80px;
          height: 80px;
          background-color: white;
          border-radius: 50%;
          mix-blend-mode: screen;
          pointer-events: none;

          &::after {
            content: '';
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-40%, -50%);
            width: 0;
            height: 0;
            border-top: 20px solid transparent;
            border-bottom: 20px solid transparent;
            border-left: 30px solid black;
          }
        }
      }

      .youtube-video {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
      }
    }
  }
  @media (max-width: 768px) {
    .video-section {
      padding: 2rem 0;
      .row {
        padding: 0 1rem;
      }
    }
  }
</style>
