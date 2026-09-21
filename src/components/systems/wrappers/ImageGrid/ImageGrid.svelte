<script lang="ts">
  import { onMount, onDestroy, tick } from 'svelte';
  import { writable } from 'svelte/store';
  import RevealingImage from './RevealingImage.svelte';
  import { useVariant, trackExposure, trackInteraction, identify } from '../../../../lib/evo/index.ts';
  import { formState } from '../../../systems/inputs/Calendar/formStore.js';

  const EVO_COMPONENT = 'Collaborations';

  import { activeVariants } from '../../../../lib/evo/client.ts';
  $: evoCopyVariantStr = $activeVariants[EVO_COMPONENT] || useVariant(EVO_COMPONENT);

  const FULL_STARS = [0, 1, 2, 3];

  onMount(() => {
    trackExposure(EVO_COMPONENT, evoCopyVariantStr, { variantLabel: evoCopyVariantStr });
  });

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
    const cleanEmail = $formState.email.trim();
    identify(cleanEmail);
    trackInteraction(EVO_COMPONENT, evoCopyVariantStr, 'carrousel_drag', { view: 'rotating' });
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
    const cleanEmail = $formState.email.trim();
    identify(cleanEmail);
    trackInteraction(EVO_COMPONENT, evoCopyVariantStr, 'carrousel_arrow_click', { view: 'static' });
    // Prevent the browser from turning the press into a scroll/pan gesture, which
    // would fire `pointercancel` on touch and strand the held-arrow animation.
    e.preventDefault();
    if (e.currentTarget instanceof HTMLElement && e.currentTarget.setPointerCapture) {
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    loopArrowDown(e);
  }

  function loopArrowUp() {
    x.update((curr) => wrapX(curr + velocity));
    if (Math.abs(velocity) > Math.abs(direction)) {
      velocity -= direction * friction;
      requestAnimationFrame(() => loopArrowUp());
    }
  }

  function onArrowUp(e?: PointerEvent) {
    if (e && e.currentTarget instanceof HTMLElement && e.currentTarget.hasPointerCapture?.(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }

    loopArrowUp();

    if (rADs.length) {
      rADs.forEach((rAD) => cancelAnimationFrame(rAD));
      rADs = [];
    }
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
      <div class="rating" aria-label="Rated 4.8 out of 5 stars">
        <span class="rating__stars" aria-hidden="true">
          {#each FULL_STARS as _}
            <svg class="rating__star" viewBox="0 0 24 24"><path d="M12 2.34l2.91 5.9 6.51.95-4.7 4.6 1.11 6.48L12 17.63l-5.83 3.07 1.11-6.49-4.71-4.59 6.5-.95L12 2.34z"/></svg>
          {/each}
          <span class="rating__star--half">
            <svg class="rating__star-half-base" viewBox="0 0 24 24"><path d="M12 2.34l2.91 5.9 6.51.95-4.7 4.6 1.11 6.48L12 17.63l-5.83 3.07 1.11-6.49-4.71-4.59 6.5-.95L12 2.34z"/></svg>
            <svg class="rating__star-half-fill" viewBox="0 0 24 24"><path d="M12 2.34l2.91 5.9 6.51.95-4.7 4.6 1.11 6.48L12 17.63l-5.83 3.07 1.11-6.49-4.71-4.59 6.5-.95L12 2.34z"/></svg>
          </span>
        </span>
        <span class="rating__value">4.8 <span class="rating__source">Google Reviews</span></span>
      </div>
      <h3 class="titles">Partners, Collaborations & Excellent Reviews</h3>
    </div>

    {#if evoCopyVariantStr === 'v2-collaborations'}
      <div class="arrows">
        <button class="arrows__arrow arrow-left" 
        on:pointerdown={onArrowDown}
        on:pointerup={onArrowUp}
        on:pointercancel={onArrowUp}
        on:lostpointercapture={onArrowUp}
        >&lt;</button>
        <button class="arrows__arrow arrow-right" 
        on:pointerdown={onArrowDown}
        on:pointerup={onArrowUp}
        on:pointercancel={onArrowUp}
        on:lostpointercapture={onArrowUp}
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
      touch-action: none;
      -webkit-user-select: none;
      user-select: none;
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
    padding: 4.5rem 0 0;
    background: #060606;
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

    .rating {
      display: inline-flex;
      align-items: center;
      gap: 0.6rem;
      margin-bottom: 0.85rem;
    }

    .rating__stars {
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }

    .rating__star {
      width: 19px;
      height: 19px;
      fill: #ffc107;
    }

    // Target the <path> children directly. A global rule in SVG.scss sets
    // `path { fill: var(--color-foreground) }`, which overrides the inherited
    // svg-level fill. `!important` pins the star gold so no global fill wins.
    .rating__star path {
      fill: #ffc107 !important;
    }

    .rating__star--half {
      position: relative;
      display: inline-block;
      width: 19px;
      height: 19px;
    }

    .rating__star-half-base,
    .rating__star-half-fill {
      position: absolute;
      left: 0;
      top: 0;
      width: 19px;
      height: 19px;
    }

    .rating__star-half-base path { fill: rgba(255, 255, 255, 0.2) !important; }
    .rating__star-half-fill {
      clip-path: inset(0 50% 0 0);
    }
    .rating__star-half-fill path { fill: #ffc107 !important; }

    .rating__value {
      font-size: 0.95rem;
      font-weight: 700;
      color: #fff;
      letter-spacing: 0.02em;
      line-height: 1;
    }

    .rating__source {
      font-weight: 400;
      color: rgba(255, 255, 255, 0.72);
    }

    .titles {
      font-family: var(--font-title, serif);
      font-size: clamp(0.9rem, 2vw, 1.1rem);
      color: rgba(255, 255, 255, 0.72);
      letter-spacing: 0.2em;
      text-transform: uppercase;
      margin: 0;
      font-weight: 300;
      padding: 0 1rem 1rem;
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
        background: linear-gradient(to right, #060606 0%, transparent 100%);
      }
      &.right {
        right: 0;
        background: linear-gradient(to left, #060606 0%, transparent 100%);
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
