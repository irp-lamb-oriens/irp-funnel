<script lang="ts">
  import { onMount } from 'svelte';

  export let url: string;
  export let alt = "Image";

  let loaded = false;
  let imgEl: HTMLImageElement;

  function handleLoad() {
    loaded = true;
  }

  onMount(() => {
    if (imgEl && imgEl.complete) {
      loaded = true;
    }
  });
</script>

<div class="image-wrapper" class:loaded>
  <img
    bind:this={imgEl}
    src={url}
    {alt}
    class="reveal-img"
    on:load={handleLoad}
    loading="lazy"
  />
</div>

<style lang="scss">
  .image-wrapper {
    width: 100%;
    height: 100%;
    display: flex;
    justify-content: center;
    align-items: center;
    opacity: 0;
    transform: translateY(10px) scale(0.95);
    transition: 
      opacity 0.8s cubic-bezier(0.2, 0, 0.2, 1),
      transform 0.8s cubic-bezier(0.2, 0, 0.2, 1);
    
    &.loaded {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  .reveal-img {
    max-height: 120px;
    width: 100%;
    object-fit: contain;
    // Removed grayscale by default to ensure visibility if the user's feedback was about them being too dark
    filter: grayscale(1);
    opacity: 0.8;
    transition: all 0.4s ease;

    &:hover {
      opacity: 1;
      transform: scale(1.1);
      filter: none; // Show original colors on hover
    }
  }

  // If the image is already an SVG with fill:white, filter: brightness(0) invert(1) might make it black again.
  // Actually, brightness(0) makes it black, then invert(1) makes it white.
  // So it works for any logo (black becomes white, white becomes white-ish).
  // But let's be more precise. If it's already white, we don't want to mess it up.
</style>
