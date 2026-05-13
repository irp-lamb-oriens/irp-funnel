<script lang="ts">
  import { onMount, onDestroy, tick } from 'svelte';
  import { writable } from 'svelte/store';
  import RevealingImage from './RevealingImage.svelte';
  import { useVariant, trackExposure, trackInteraction, identify } from '../../../../lib/evo/index.ts';

  const EVO_COMPONENT = 'Collaborations';

  const evoVariant = useVariant(EVO_COMPONENT);

  import { activeVariants } from '../../../../lib/evo/client.ts';
  $: evoCopyVariantStr = $activeVariants[EVO_COMPONENT] || useVariant(EVO_COMPONENT);

  // Public props
  export let images: string[] = [];
  export let autoplay = true;
  export let speed = 0.05;
  export let gap = 60;
  export let itemWidth = 'clamp(100px, 12vw, 150px)';
  export let throwFactor = 220;
  export let friction = 0.95;

  let container: HTMLDivElement;
  let track: HTMLDivElement;

  const x = writable(0);

  const COPIES = 3;
  $: tripled = images.length ? Array(COPIES).fill(0).flatMap(() => images) : [];

  let segment = 0;
  let rAF: number | null = null;
  let ro: ResizeObserver | null = null;

  function measureSegment() {
    if (!track || !images.length) { segment = 0; return; }
    const children = Array.from(track.children) as HTMLElement[];
    if (!children.length) { segment = 0; return; }

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
    while (v <= -segment) v += segment;
    while (v > 0) v -= segment;
    return v;
  }

  const drag = {
    active: false,
    id: -1,
    lastX: 0,
    lastT: 0,
    v: 0
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

    drag.v = dx / dt;
    drag.lastX = e.clientX;
    drag.lastT = now;

    x.update((curr) => wrapX(curr + dx));
  }

  function onPointerUp(e: PointerEvent) {
    if (!drag.active || e.pointerId !== drag.id) return;
    container.releasePointerCapture(e.pointerId);
    drag.v *= (throwFactor / 1000);
    drag.active = false;
    drag.id = -1;
  }

  function loop(prev = performance.now()) {
    const now = performance.now();
    const dt = now - prev;
    let delta = 0;

    if (autoplay && !drag.active && speed !== 0) delta += -speed * dt;

    if (!drag.active && Math.abs(drag.v) > 0.01) {
      delta += drag.v * dt;
      const decay = Math.pow(friction, dt / 16);
      drag.v *= decay;
    }
    if (evoCopyVariantStr === 'v1-collaborations' && delta !== 0) x.update((curr) => wrapX(curr + delta));

    rAF = requestAnimationFrame(() => loop(now));
  }

  let rADs: number[] = [];
  let direction = 0;
  let velocity = 0;

  function loopArrowDown(e: PointerEvent, n = 0) {
    // Accelerate over time, but with diminishing return
    direction = Math.sign(e.x - window.innerWidth / 2);
    x.update((curr) => wrapX(curr + velocity));

    velocity += direction;

    rADs.push(requestAnimationFrame(() => loopArrowDown(e, n)));
  }

  function onArrowDown(e: PointerEvent) {
    loopArrowDown(e);
  }

  function loopArrowUp() {
    x.update((curr) => wrapX(curr + velocity));
    if (Math.abs(velocity) > Math.abs(direction)) {
      velocity -= direction * friction;
      requestAnimationFrame(() => loopArrowUp());
    }
  }

  function onArrowUp() {
    // velocity = 0;
    // direction = 0;

    loopArrowUp();

    if (rADs.length) rADs.forEach((rAD) => cancelAnimationFrame(rAD));
  }

  $: if (tripled.length) {
    tick().then(measureSegment);
  }

  onMount(() => {
    ro = new ResizeObserver(() => measureSegment());
    if (track) ro.observe(track);
    rAF = requestAnimationFrame(() => loop());
  });

  onDestroy(() => {
    if (rAF != null) cancelAnimationFrame(rAF);
    ro?.disconnect();
  });
</script>

<div class="image-grid-outer">
  <div class="glass-container">
    <div class="header">
      <span class="stars">⭐️⭐️⭐️⭐️⭐️</span>
      <h3 class="titles">Partners, Collaborations & Excellent Reviews</h3>
    </div>

    {#if evoCopyVariantStr === 'v2-collaborations'}
      <div class="arrows">
        <button class="arrows__arrow arrow-left" 
        on:pointerdown={onArrowDown}
        on:pointerup={onArrowUp}
        >&lt;</button>
        <button class="arrows__arrow arrow-right" 
        on:pointerdown={onArrowDown}
        on:pointerup={onArrowUp}
        >&gt;</button>
      </div>  
    {/if}

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
      <div class="mask-overlay left"></div>
      <div class="mask-overlay right"></div>
      
      <div
        class="track"
        bind:this={track}
        style="transform: translate3d({$x}px, 0, 0);"
      >
        {#each tripled as url, i (i + '-' + url)}
          <div class="item">
            <RevealingImage {url} />
          </div>
        {/each}
      </div>
    </div>
  </div>
</div>

<style lang="scss">
  .arrows {
    display: inline-flex;
    justify-content: space-between;
    width: 100%;
    max-width: 1600px;
    margin: -5rem auto 1rem;
    padding: 0 max(2rem, 5vw);
    height: 0;
    position: relative;
    top: 7.5rem;
    z-index: 10000;
    
    &__arrow {
      background: rgba(255, 255, 255, 0.02);
      border: none;
      color: rgba(255, 255, 255, 0.8);
      font-size: 1.5rem;
      padding: 0.5rem 1rem 2.55rem;
      cursor: pointer;
      transition: background 0.3s ease, box-shadow 0.5s ease, color 0.35s ease, border 0.4s ease-out;
      border-radius: 50%;
      width: 3.05rem;
      place-content: center;
      border: 1px solid #ffffff4d;
      box-shadow: inset 0 0 0 0 rgba(255, 255, 255, 0.678), 0 0 0 0 white;


      &:hover {
        background: rgba(255, 255, 255, 0.05);
        box-shadow: inset 0 0 0 50px rgba(255, 255, 255, 0.955);
        color: black;
        border: 1px solid #ffffff;
      }
    }
  }

  .image-grid-outer {
    position: relative;
    width: 100%;
    padding: 6rem 0;
    background: linear-gradient(to bottom, #000, #111, #000);
    overflow: hidden;
  }

  .glass-container {
    width: 100%;
    max-width: 1600px;
    margin: 0 auto;
    background: rgba(255, 255, 255, 0.02);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border-top: 1px solid rgba(255, 255, 255, 0.05);
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    padding: 4rem 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 3rem;
  }

  .header {
    text-align: center;
    
    .stars {
      display: block;
      font-size: 1.2rem;
      margin-bottom: 0.75rem;
      letter-spacing: 6px;
      opacity: 0.9;
    }

    .titles {
      font-family: var(--font-title, serif);
      font-size: clamp(0.9rem, 2vw, 1.1rem);
      color: rgba(255, 255, 255, 0.8);
      letter-spacing: 0.2em;
      text-transform: uppercase;
      margin: 0;
      font-weight: 300;
    }
  }

  .carousel {
    width: 100%;
    height: 150px; // Explicit height to ensure visibility
    position: relative;
    cursor: grab;
    touch-action: pan-y;
    overflow: hidden;
    display: flex;
    align-items: center;
    
    &:active { cursor: grabbing; }

    .mask-overlay {
      position: absolute;
      top: 0;
      bottom: 0;
      width: 20%;
      z-index: 10;
      pointer-events: none;
      
      &.left {
        left: 0;
        background: linear-gradient(to right, #080808 0%, transparent 100%);
      }
      &.right {
        right: 0;
        background: linear-gradient(to left, #080808 0%, transparent 100%);
      }
    }
  }

  .track {
    display: flex;
    align-items: center;
    will-change: transform;
    user-select: none;
    gap: var(--gap, 0);
    position: absolute;
    left: 0;
    height: 100%;
  }

  .item {
    flex: 0 0 auto;
    width: var(--item-w);
    height: 100%;
    display: flex;
    justify-content: center;
    align-items: center;
    user-select: none;
    pointer-events: none;
  }

  @media (max-width: 768px) {
    .glass-container {
      padding: 3rem 0;
      background: transparent;
      backdrop-filter: none;
    }
    .carousel {
      height: 100px;
    }
  }
</style>
