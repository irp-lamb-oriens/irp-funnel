<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import gsap from 'gsap';
  import { writable, get } from 'svelte/store';
  import RevealingImage from './RevealingImage.svelte';

  // Public props
  export let images: string[] = [];
  export let autoplay = true;        // continuous auto-scroll
  export let speed = 0.06;           // px per ms for autoplay
  export let gap = 28;               // px gap between items
  export let itemWidth = 'clamp(180px, 22vw, 260px)';
  export let throwFactor = 220;      // ms-scale for release momentum
  export let friction = 0.95;        // per-16ms decay factor for inertia

  let container: HTMLDivElement;
  let track: HTMLDivElement;

  // Tripled list so we can wrap seamlessly
  $: tripled = images.length ? [...images, ...images, ...images] : [];

  // Writable store for X translation (required for Svelte $store syntax)
  const x = writable(0);

  let segment = 0;        // width of a single set of images
  let dragging = false;   
  let pointerId: number | null = null;
  let lastX = 0;          // last pointer x
  let lastT = 0;          // last timestamp (ms)
  let velocity = 0;       // px per ms, updated while dragging
  let ro: ResizeObserver;
  let releaseTween: gsap.core.Tween | null = null;
  let tickerFn: () => void;

  function measure() {
    if (!track) return;
    // The track contains 3 copies of the list; divide to get one segment's width
    segment = track.scrollWidth / 3;
    x.set(-segment);
  }

  onMount(() => {
    measure();
    ro = new ResizeObserver(measure);
    ro.observe(track);

    lastT = performance.now();
    tickerFn = () => {
      const now = performance.now();
      const dt = now - lastT; // ms
      lastT = now;

      if (!dragging && segment) {
        // decay previously captured velocity for a smooth glide
        const decay = Math.pow(friction, dt / 16);
        velocity *= decay;

        const auto = autoplay ? -speed * dt : 0;
        const delta = auto + velocity * dt;

        const nx = wrap(get(x) + delta);
        x.set(nx);
      }
    };

    gsap.ticker.add(tickerFn);
  });

  onDestroy(() => {
    ro && ro.disconnect();
    tickerFn && gsap.ticker.remove(tickerFn);
    releaseTween && releaseTween.kill();
  });

  function wrap(nx: number) {
    if (!segment) return nx;
    // Keep x in [-2*segment, 0) so we always have items on both sides
    while (nx <= -2 * segment) nx += segment;
    while (nx >= 0) nx -= segment;
    return nx;
  }

  function onPointerDown(e: PointerEvent) {
    if (pointerId !== null) return; // already dragging
    pointerId = e.pointerId;
    container.setPointerCapture(pointerId);
    dragging = true;
    velocity = 0; // reset inertia
    lastX = e.clientX;
    lastT = performance.now();
    if (releaseTween) { releaseTween.kill(); releaseTween = null; }
  }

  function onPointerMove(e: PointerEvent) {
    if (!dragging || e.pointerId !== pointerId) return;
    const now = performance.now();
    const dx = e.clientX - lastX;
    const dt = Math.max(1, now - lastT);

    const nx = wrap(get(x) + dx);
    x.set(nx);

    velocity = dx / dt; // px per ms
    lastX = e.clientX;
    lastT = now;
  }

  function onPointerUp(e: PointerEvent) {
    if (e.pointerId !== pointerId) return;
    container.releasePointerCapture(pointerId);
    pointerId = null;
    dragging = false;

    // Throw with a little elastic bounce using GSAP
    const start = get(x);
    const target = wrap(start + velocity * throwFactor);
    const proxy = { v: start };
    releaseTween = gsap.to(proxy, {
      v: target,
      duration: 0.8,
      ease: 'elastic.out(0.6, 0.5)',
      onUpdate: () => x.set(wrap(proxy.v)),
      onComplete: () => { releaseTween = null; }
    });
  }
</script>

<div 
  class="carousel"
  bind:this={container}
  on:pointerdown={onPointerDown}
  on:pointermove={onPointerMove}
  on:pointerup={onPointerUp}
  on:pointercancel={onPointerUp}
  on:lostpointercapture={onPointerUp}
>
  <div 
    class="track" 
    bind:this={track}
    style="transform: translate3d({$x}px, 0, 0); gap: {gap}px; --item-w: {itemWidth};"
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

<style lang="scss">
  .carousel {
    width: 100%;
    overflow: hidden;
    padding: 3.5rem 1rem;
    display: flex;
    justify-content: center;
    align-items: flex-start;
    margin: 5rem 0;
    touch-action: pan-y; // allow vertical page scroll while we handle horizontal drag
    cursor: grab;
    filter: grayscale(100%);
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
    .carousel { padding: 2rem 1rem; }
  }
</style>
