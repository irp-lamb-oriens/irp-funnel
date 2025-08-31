<script lang="ts">
  import { onMount } from "svelte";
  export let src: string;
  export let alt: string = "";
  export let width: number | string = "100%";
  export let height: number | string = "auto";
  export let zoom: number = 2;

  let container: HTMLDivElement;
  let img: HTMLImageElement;
  let glass: HTMLDivElement;
  let showGlass = false;
  let glassX = 0;
  let glassY = 0;

  function getCursorPos(e: MouseEvent | TouchEvent) {
    let x = 0, y = 0;
    let rect = img.getBoundingClientRect();
    if (e instanceof MouseEvent) {
      x = e.clientX - rect.left;
      y = e.clientY - rect.top;
    } else if (e.touches && e.touches.length > 0) {
      x = e.touches[0].clientX - rect.left;
      y = e.touches[0].clientY - rect.top;
    }
    x = Math.max(0, Math.min(x, img.width));
    y = Math.max(0, Math.min(y, img.height));
    return { x, y };
  }

  function moveMagnifier(e: MouseEvent | TouchEvent) {
    showGlass = true;
    const { x, y } = getCursorPos(e);
    glassX = x;
    glassY = y;

    // Set background position of glass
    if (glass && img) {
      const bw = glass.offsetWidth / 2;
      const bh = glass.offsetHeight / 2;
      let bgX = x * zoom - bw;
      let bgY = y * zoom - bh;
      glass.style.left = `${x - bw}px`;
      glass.style.top = `${y - bh}px`;
      glass.style.backgroundPosition = `-${bgX}px -${bgY}px`;
    }
  }

  function hideMagnifier() {
    showGlass = false;
  }

  onMount(() => {
    // Prevent image drag
    if (img) img.ondragstart = () => false;
  });
</script>

<div
  class="magnifier-container"
  bind:this={container}
  on:mousemove={moveMagnifier}
  on:mouseleave={hideMagnifier}
  on:touchmove={moveMagnifier}
  on:touchend={hideMagnifier}
>
  <img
    bind:this={img}
    src={src}
    alt={alt}
    width={width}
    height={height}
    class="magnifier-image"
    draggable="false"
    on:mouseenter={() => (showGlass = true)}
    on:mouseleave={hideMagnifier}
  />
  {#if showGlass}
    <div
      bind:this={glass}
      class="magnifier-glass"
      style="
        left: {glassX - 60}px;
        top: {glassY - 60}px;
        background-image: url('{src}');
        background-repeat: no-repeat;
        background-size: {img ? img.width * zoom : 0}px {img ? img.height * zoom : 0}px;
        background-position: -{(glassX * zoom) - 60}px -{(glassY * zoom) - 60}px;
      "
    ></div>
  {/if}
</div>

<style lang="scss">
.magnifier-container {
  position: relative;
  display: inline-block;
  overflow: hidden;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
  max-width: 100%;
  cursor: zoom-in;

  .magnifier-image {
    display: block;
    width: 100%;
    height: auto;
    user-select: none;
    pointer-events: auto;
  }

  .magnifier-glass {
    position: absolute;
    pointer-events: none;
    border: 2px solid #aaa;
    border-radius: 50%;
    width: 120px;
    height: 120px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.18);
    background-color: rgba(255,255,255,0.1);
    background-repeat: no-repeat;
    z-index: 10;
    transition: box-shadow 0.2s;
    background-size: cover;
  }
}
</style>
