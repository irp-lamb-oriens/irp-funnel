<script lang="ts">
  export let videoUrl: string;
  export let videoPoster: string;
  export let videoAlt: string = "";
  /**
   * On phones, show the slot (headline + call to action) before the video, so
   * the first screen says what we do instead of opening on a poster.
   */
  export let slotFirstOnMobile = false;

  import { onMount } from "svelte";

  let imgWrap: HTMLElement;
  let img: HTMLImageElement;
  let video: HTMLVideoElement;

  function getImgWrapLeft() {
    const left = imgWrap.getBoundingClientRect().x;

    return left;
  }

  function getImgWrapTop() {
    const top = 0;
    return top;
  }

  function setVideoOpenSize() {
      const left = getImgWrapLeft();

      video.style.width = `calc(100vw - ${left * (3 / (window.innerWidth >= 518 ? 3 : 1))}px)`;
      video.style.transform = `translateX(${left /  2}px)`;
  }

  function setVideoHeight() {
    video.style.height = `${img.clientHeight}px`;
  }

  function setVideoClosedSize() {
    const left = getImgWrapLeft();

    video.style.width = `${img.clientWidth}px`;
    video.style.transform = `translateX(${left}px)`;
  }

  // Size the video to the poster. This used to run in a requestAnimationFrame
  // loop for the life of the page (reading layout and writing styles every
  // frame, even off screen), which cost every scroll frame site-wide. The
  // size only changes when the layout does or the video plays/pauses, so it
  // now updates on exactly those.
  function sync() {
    if (!video || !img || !imgWrap) return;
    // The video overlays the poster; when the poster is not first in the
    // column (slot shown first on phones) it has to follow it down.
    video.style.top = slotFirstOnMobile && window.innerWidth < 768 ? `${imgWrap.offsetTop}px` : "";
    setVideoHeight();
    if (video.paused) setVideoClosedSize();
    else setVideoOpenSize();
  }

  function onclick() {
    if (video.paused) return video.play();
    return video.pause();
  }

  onMount(() => {
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(img);
    ro.observe(imgWrap);
    ro.observe(document.documentElement);
    window.addEventListener("resize", sync);
    video.addEventListener("play", sync);
    video.addEventListener("pause", sync);
    img.addEventListener("load", sync);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", sync);
      video.removeEventListener("play", sync);
      video.removeEventListener("pause", sync);
      img.removeEventListener("load", sync);
    };
  });
</script>
<div class="re-wrap">
  <video
    loop
    playsinline
    class="video"
    class:show={video ? !video?.paused : false}
    {onclick}
    bind:this={video}
    src="https://storage.googleapis.com/videos-irp-funnels/The-Truth-About-Moving-Abroad_-What-You-Need-to-Know-Before-Taking-the-Leap.mp4"
  ></video>
  <div class="wrapper" class:slot-first={slotFirstOnMobile}>
    <div class="img-wrap" class:show={video ? !video?.paused : false} bind:this={imgWrap}>
      <img class="img" bind:this={img} src={videoPoster} alt={videoAlt}>
    </div>
    <div class:show={video ? !video?.paused : false} class="slot-wrap">
      <slot />
    </div>
  </div>
</div>

<style lang="scss">
  .slot-wrap {
    transition: opacity 1s ease-in-out, transform 0.5s ease-in-out; /* Shorthand */
    opacity: 1;
    transform: translateX(0px);
    width: 100%;

    &.show {
      @media (min-width: 1024px) {
        opacity: 0;
        transition: opacity 0.5s ease-in-out, transform 0.5s ease-in-out; /* Shorthand */
        transform: translateX(50vw);
      }
    }
  }

  .re-wrap {
    @media (max-width: 1024px) {
      padding: 0 1rem;
    }
  }

  .video {
    width: 0px;
    object-fit: cover;
    position: absolute;
    opacity: 0;
    z-index: 1;
    border-radius: 2rem;
    box-shadow: 0 30px 60px -12px rgba(0, 0, 0, 0.5);
    border: 1px solid rgba(255, 255, 255, 0.1);
    transition: opacity 0.5s ease-in-out .5s, width 0.5s ease-in-out 0s, transform 0.5s ease-in-out 0s; /* Shorthand */
    cursor: pointer;
    top: 0;
    
    &.show {
      transition: opacity 0.5s ease-in-out 0s, width 0.5s ease-in-out 0s, transform 0.5s ease-in-out 0s; /* Shorthand */
      opacity: 1;
    }
  }

  .video:hover + .wrapper .img-wrap {
      &::before {
        --size: 100px;
        box-shadow: 0 0 50px var(--color-background);
        transition: .35s width, .35s height, .35s top, .35s left, .25s box-shadow, opacity .5s;
      }
      &::after {
        transition: .5s width, .5s height, .5s top, .5s left, transform .5s, opacity .35s;
        --size: 30px;
        transform: rotate(-15deg);
      }
    }

  .img-wrap {
    display: flex;
    place-content: center;
    cursor: pointer;
    position: relative;
    transition-delay: 1s opacity;

    &::before, &::after {
      pointer-events: none;
    }

    &::before {
      transition: 0.5s width, 0.5s height, 0.5s top, 0.5s left, 1s box-shadow,
        opacity 0.5s;
      transition-timing-function: cubic-bezier(0.39, -0.575, 0.565, 1);
      box-shadow: 0 10px 30px -5px rgba(0, 0, 0, 0.3);
      content: "";
      --size: 85px;
      border-radius: 50%;
      width: var(--size);
      height: var(--size);
      background: rgba(var(--color-highlight-2-rgb), 0.9);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      position: absolute;
      top: calc(50% - var(--size) / 2);
      left: calc(50% - var(--size) / 2);
      z-index: 1;
      border: 1px solid rgba(255, 255, 255, 0.3);
    }

    &::after {
      transition-timing-function: cubic-bezier(0.39, -0.575, 0.565, 1);
      transition: 0.75s width, 0.75s height, 0.75s top, 0.75s left,
        transform 0.75s, opacity 0.35s;
      content: "";
      --size: 30px;
      transform: rotate(0deg);
      width: var(--size);
      height: var(--size);
      background: #ffffff;
      position: absolute;
      top: calc(50% - var(--size) / 2);
      left: calc(50% - var(--size) / 2);
      z-index: 1;
      clip-path: polygon(100% 50%, 15% 0, 15% 100%);
    }

    &.show {
      opacity: 0;
      transition-delay: 0s opacity;

      &::before, &::after {
        opacity: 0;
      }

      &:hover {
        &::before, &::after {
          opacity: 1;
        }
      }
    }
  }
  
  .video {
    width: 0px;
    object-fit: cover;
    position: absolute;
    opacity: 0;
    z-index: 10;
    transition: opacity 0.5s ease-in-out 0.5s, width 0.5s ease-in-out 0s,
      transform 0.5s ease-in-out 0s;
    cursor: pointer;

    &.show {
      transition: opacity 0.5s ease-in-out 0s, width 0.5s ease-in-out 0s,
        transform 0.5s ease-in-out 0s;
      opacity: 1;
    }
  }

  .img {
    width: 100%;
    border-radius: 2rem;
    box-shadow: 0 30px 60px -12px rgba(0, 0, 0, 0.5);
    border: 1px solid rgba(255, 255, 255, 0.1);
    transition: transform 0.8s cubic-bezier(0.23, 1, 0.32, 1);
  }

  .img-wrap:hover .img {
    transform: scale(1.02);
  }

  .wrapper.slot-first .slot-wrap {
    @media (max-width: 767px) { order: -1; margin-bottom: 1.25rem; }
  }
  .wrapper {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(500px, 1fr));
    place-items: center;
    @media (max-width: 1024px) {
      grid-template-columns: 1fr;
      place-content: center;
      display: flex;
      flex-direction: column;
    }
  }
</style>
