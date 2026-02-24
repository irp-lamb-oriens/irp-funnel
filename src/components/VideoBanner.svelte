<script lang="ts">
  export let videoUrl: string;
  export let videoPoster: string;
  export let videoAlt: string = "";

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

  function frame() {
    setVideoHeight()
    if (video ? video?.paused : true) {
      setVideoClosedSize();
    } else setVideoOpenSize();

    requestAnimationFrame(frame);
  }
  
  function onclick() {
    if (video.paused) return video.play();
    return video.pause();
  }
  
  onMount(() => {
    window.addEventListener("resize", () => {
      if (video ? video?.paused : true) {
        setVideoClosedSize();
        return;
      }
      setVideoOpenSize();
    });
    frame();
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
  <div class="wrapper">
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
