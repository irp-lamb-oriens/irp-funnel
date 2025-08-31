<script lang="ts">
  export let videoUrl: string;
  export let videoPoster: string;
  export let videoAlt: string = "";

  import { onMount } from "svelte";

  let imgWrap: HTMLElement;
  let img: HTMLImageElement;
  let video: HTMLVideoElement;
  let slotWrap: HTMLElement;

  function getImgWrapLeft() {
    const left = imgWrap.getBoundingClientRect().x;

    return left;
  }

  function setVideoOpenSize() {
      const left = getImgWrapLeft();

      video.style.width = `calc(100vw - ${left}px)`;
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
  <video class="video" class:show={video ? !video?.paused : false} {onclick} bind:this={video} src={videoUrl}></video>
  <div class="wrapper">
    <div class="img-wrap" class:show={video ? !video?.paused : false} bind:this={imgWrap}>
      <img class="img" bind:this={img} src={videoPoster} alt={videoAlt}>
    </div>
    <div bind:this={slotWrap} class:show={video ? !video?.paused : false} class="slot-wrap">
      <slot />
    </div>
  </div>
</div>

<style lang="scss">
  .slot-wrap {
    overflow: hidden;
    transition: 1s transform, 2s opacity;
    opacity: 1;
    transform: translateX(0px);

    &.show {
      @media (min-width: 1024px) {
        opacity: 0;
        transition: 1s transform, 1s opacity;
        transform: translateX(50vw);
      }
    }
  }

  .re-wrap {
    position: relative;
  }

  .video {
    width: 0px;
    object-fit: cover;
    position: absolute;
    opacity: 0;
    z-index: 1;
    transition: .5s;
    cursor: pointer;
    
    &.show {
      transition: 1s;
      opacity: 1;
    }
  }
  
  .img-wrap, .video {
    &:hover {
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

    &::before {
      transition: .5s width, .5s height, .5s top, .5s left, 1s box-shadow, opacity .5s;
      transition-timing-function: cubic-bezier(0.39, -0.575, 0.565, 1);
      box-shadow: 0 0 5px -2.5px var(--color-background-inversion);
      content: "";
      --size: 75px;
      border-radius: 50%;
      width: var(--size);
      height: var(--size);
      background: var(--color-background-inversion);
      position: absolute;
      top: calc(50% - var(--size) / 2);
      left: calc(50% - var(--size) / 2);
      z-index: 1;
    }

    &::after {
      transition-timing-function: cubic-bezier(0.39, -0.575, 0.565, 1);
      transition: .75s width, .75s height, .75s top, .75s left, transform .75s, opacity .35s;
      content: "";
      --size: 25px;
      transform: rotate(0deg);
      width: var(--size);
      height: var(--size);
      background: var(--color-background);
      position: absolute;
      top: calc(50% - var(--size) / 2);
      left: calc(50% - var(--size) / 2);
      z-index: 1;
      clip-path: polygon(100% 50%, 10% 0, 10% 100%);
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
  
  .img, .video {
    border-radius: 15px;
    box-shadow: 0 0 5px -.5px var(--color-background-inversion);
  }

  .img {
    width: 100%;
    
  }

  .wrapper {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(500px, 1fr));
    place-items: center;
    @media (max-width: 1024px) {
      grid-template-columns: 1fr;
      place-content: center;
    }
  }
</style>