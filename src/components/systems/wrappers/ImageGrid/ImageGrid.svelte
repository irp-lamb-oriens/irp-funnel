<script lang="ts">
  import { onMount, onDestroy, tick } from 'svelte';
  import { writable } from 'svelte/store';
  import RevealingImage from './RevealingImage.svelte';

  // Public props
  export let images: string[] = [];
  export let autoplay = true;        // continuous auto-scroll
  export let speed = 0.06;           // px per ms for autoplay (positive = scroll left)
  export let gap = 28;               // px gap between items
  export let itemWidth = 'clamp(50px, 7.5vw, 70px)';
  export let throwFactor = 220;      // scales release momentum (ms-like feel)
  export let friction = 0.95;        // per-16ms decay factor for inertia

  let container: HTMLDivElement;
  let track: HTMLDivElement;

  // translation store
  const x = writable(0);

  // 3x list for seamless wrap
  const COPIES = 3;
  $: tripled = images.length ? Array(COPIES).fill(0).flatMap(() => images) : [];

  // width of a single set of images (first copy), including gaps
  let segment = 0;
  let rAF: number | null = null;
  let ro: ResizeObserver | null = null;

  function measureSegment() {
    if (!track || !images.length) { segment = 0; return; }
    const children = Array.from(track.children) as HTMLElement[];
    if (!children.length) { segment = 0; return; }

    // sum widths of the first images.length items + gaps between them
    let w = 0;
    const styles = getComputedStyle(track);
    const gapPx = parseFloat(styles.gap || '0') || gap;
    for (let i = 0; i < Math.min(images.length, children.length); i++) {
      const el = children[i];
      w += el.getBoundingClientRect().width;
      if (i < images.length - 1) w += gapPx;
    }
    segment = w;
  }

  function wrapX(v: number) {
    if (segment <= 0) return v;
    // keep x in [-segment, 0)
    while (v <= -segment) v += segment;
    while (v > 0) v -= segment;
    return v;
  }

  // drag state
  const drag = {
    active: false,
    id: -1,
    lastX: 0,
    lastT: 0,
    v: 0 // px/ms
  };

  function onPointerDown(e: PointerEvent) {
    if (drag.active) return;
    container.setPointerCapture(e.pointerId);
    drag.active = true;
    drag.id = e.pointerId;
    drag.lastX = e.clientX;
    drag.lastT = performance.now();
    drag.v = 0;
  }

  function onPointerMove(e: PointerEvent) {
    if (!drag.active || e.pointerId !== drag.id) return;
    const now = performance.now();
    const dx = e.clientX - drag.lastX;
    const dt = Math.max(1, now - drag.lastT);

    drag.v = dx / dt; // px/ms
    drag.lastX = e.clientX;
    drag.lastT = now;

    x.update((curr) => wrapX(curr + dx));
  }

  function onPointerUp(e: PointerEvent) {
    if (!drag.active || e.pointerId !== drag.id) return;
    container.releasePointerCapture(e.pointerId);
    // carry some momentum after release; scale to feel like milliseconds of travel
    drag.v *= (throwFactor / 1000);
    drag.active = false;
    drag.id = -1;
  }

  function loop(prev = performance.now()) {
    const now = performance.now();
    const dt = now - prev; // ms
    let delta = 0;

    // autoplay contribution (scrolls left by default)
    if (autoplay && speed !== 0) delta += -speed * dt;

    // inertia contribution when not dragging
    if (!drag.active && Math.abs(drag.v) > 0.02) {
      delta += drag.v * dt;
      // exponential decay based on friction per ~16ms frame
      const decay = Math.pow(friction, dt / 16);
      drag.v *= decay;
    }

    if (delta !== 0) x.update((curr) => wrapX(curr + delta));

    rAF = requestAnimationFrame(() => loop(now));
  }

  // re-measure when images or layout change
  $: (async () => {
    // wait for DOM to reflect images/tripled
    await tick();
    measureSegment();
  })();

  onMount(() => {
    // observe layout changes affecting widths/gaps
    ro = new ResizeObserver(() => measureSegment());
    if (track) ro.observe(track);

    rAF = requestAnimationFrame(() => loop());
  });

  onDestroy(() => {
    if (rAF != null) cancelAnimationFrame(rAF);
    ro?.disconnect();
  });
</script>

<div class="image-grid-container">
  <strong class="titles">Partners, Collaborations & Exceltent Reviews ⭐️⭐️⭐️⭐️⭐️</strong>
  <div
    class="carousel"
    bind:this={container}
    on:pointerdown={onPointerDown}
    on:pointermove={onPointerMove}
    on:pointerup={onPointerUp}
    on:pointercancel={onPointerUp}
    on:lostpointercapture={onPointerUp}
    style="--gap: {gap}px; --item-w: {itemWidth};"
  >
    <div
      class="track"
      bind:this={track}
    style="transform: translate3d({$x}px, 0, 0);"
  >
    {#if tripled.length === 0}
      <div class="placeholder">No images</div>
    {:else}
      {#each tripled as url, i (i + '-' + url)}
        <div class="item">
          <RevealingImage url={url} />
        </div>
      {/each}
    {/if}
  </div>
  </div>
</div>

<style lang="scss">
  .image-grid-container {
    position: relative;
  }
  .titles {
    width: 100vw;
    line-height: 2;
    display: block;
    text-align: center;
    z-index: 12;
    position: absolute;
    color: white;
    font-size: 16px;
    margin: clamp(2rem, 5vw, 4rem) auto;
    top: 0;
    left: 0;
    right: 0;
    padding: 0 1rem;
  }

  .carousel {
    width: 100%;
    overflow: hidden;
    padding: 7.5rem 1rem;
    display: flex;
    justify-content: center;
    align-items: flex-start;
    touch-action: pan-y; // allow vertical page scroll while we handle horizontal drag
    cursor: grab;
    background: blue;
    filter: grayscale(100%);
    padding-bottom: 5rem;
  }
  .carousel:active { cursor: grabbing; }

  .track {
    display: flex;
    align-items: center;
    will-change: transform;
    user-select: none;
    gap: var(--gap, 0);
  }

  .item {
    flex: 0 0 auto;
    width: var(--item-w);
    display: flex;
    justify-content: center;
    align-items: center;
    position: relative;
  }

  .item :global(img) {
    display: block;
    width: 100%;
    height: auto;
    object-fit: contain;
  }

  .placeholder {
    opacity: 0.6;
    font-size: 0.9rem;
    padding: 1rem 0.5rem;
  }

  @media (max-width: 1024px) {
    .carousel {
      padding: 5rem 1rem;
      padding-bottom: 5rem;
    }
  }
</style>
