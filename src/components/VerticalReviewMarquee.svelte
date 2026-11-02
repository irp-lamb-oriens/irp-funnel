<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { googleReviews, type Review } from '../lib/reviews.ts';

  // ── Props ────────────────────────────────────────────────────────────────
  export let reviews: Review[] = googleReviews;
  export let columns = 3;
  export let speed = 0.04; // px per ms
  export let gap = 20;
  export let columnHeight = 520;
  export let title = '';
  export let subtitle = '';
  export let background = '#fbfcfc';
  /** Anchor id (the homepage HeroForm links to #reviews as its proof point). */
  export let id = 'reviews';

  const COPIES = 3;

  // Round-robin distribution so each column is roughly equal height.
  $: sets = (() => {
    const out: Review[][] = Array.from({ length: columns }, () => []);
    reviews.forEach((r, i) => out[i % columns].push(r));
    return out;
  })();

  $: tripledSets = sets.map((s) =>
    s.length ? Array(COPIES).fill(0).flatMap(() => s) : [],
  );

  // Horizontal (mobile) track: all reviews, tripled.
  $: tripledAll = reviews.length
    ? Array(COPIES).fill(0).flatMap(() => reviews)
    : [];

  let isMobile = false;
  let reducedMotion = false;
  let mq: MediaQueryList | null = null;
  let onMqChange: ((e: MediaQueryListEvent) => void) | null = null;

  // ── Pause state (WCAG 2.2.2: moving content needs a pause control) ───────
  // `paused` is the visitor's explicit choice; `hoverPause` pauses while the
  // pointer or keyboard focus is inside so a review can actually be read.
  let paused = false;
  let hoverPause = false;
  let rootEl: HTMLElement;
  let io: IntersectionObserver | null = null;

  // A drag that moves the track should not also open the review link.
  let dragDistance = 0;
  let suppressClick = false;
  const CLICK_SLOP = 6;
  function onClickCapture(e: MouseEvent) {
    if (!suppressClick) return;
    e.preventDefault();
    e.stopPropagation();
    suppressClick = false;
  }

  // ── Vertical column state ────────────────────────────────────────────────
  let colEls: HTMLDivElement[] = [];
  let colTracks: HTMLDivElement[] = [];
  let pos: number[] = [];
  let seg: number[] = [];
  let vel: number[] = [];
  let drag: { active: boolean; id: number; lastY: number; lastT: number }[] = [];

  // ── Horizontal (mobile) state ────────────────────────────────────────────
  let hEl: HTMLDivElement;
  let hTrack: HTMLDivElement;
  let hPos = 0;
  let hSeg = 0;
  let hVel = 0;
  let hDrag = { active: false, id: -1, lastX: 0, lastT: 0 };

  let rAF: number | null = null;
  let ro: ResizeObserver | null = null;

  function measure() {
    if (isMobile) {
      if (!hTrack || !reviews.length) {
        hSeg = 0;
        return;
      }
      const children = Array.from(hTrack.children) as HTMLElement[];
      if (!children.length) {
        hSeg = 0;
        return;
      }
      const gapPx = parseFloat(getComputedStyle(hTrack).gap || '0') || gap;
      let w = 0;
      for (let i = 0; i < Math.min(reviews.length, children.length); i++) {
        w += children[i].getBoundingClientRect().width;
        if (i < reviews.length - 1) w += gapPx;
      }
      hSeg = w;
    } else {
      colTracks.forEach((track, i) => {
        if (!track || !sets[i]?.length) {
          seg[i] = 0;
          return;
        }
        const children = Array.from(track.children) as HTMLElement[];
        if (!children.length) {
          seg[i] = 0;
          return;
        }
        const gapPx = parseFloat(getComputedStyle(track).gap || '0') || gap;
        let h = 0;
        for (let j = 0; j < Math.min(sets[i].length, children.length); j++) {
          h += children[j].getBoundingClientRect().height;
          if (j < sets[i].length - 1) h += gapPx;
        }
        seg[i] = h;
      });
    }
  }

  function wrap(v: number, s: number) {
    if (s <= 0) return v;
    while (v <= -s) v += s;
    while (v > 0) v -= s;
    return v;
  }

  function loop(prev = performance.now()) {
    const now = performance.now();
    const dt = now - prev;

    const autoMove = !reducedMotion && !paused && !hoverPause && speed !== 0;

    if (isMobile) {
      let delta = 0;
      if (!hDrag.active && autoMove) delta += -speed * dt;
      if (!hDrag.active && Math.abs(hVel) > 0.01) {
        delta += hVel * dt;
        hVel *= Math.pow(0.95, dt / 16);
      }
      if (delta !== 0) hPos = wrap(hPos + delta, hSeg);
    } else {
      for (let i = 0; i < columns; i++) {
        const dir = i % 2 === 0 ? -1 : 1;
        let delta = 0;
        if (!drag[i]?.active && autoMove) {
          delta += dir * speed * dt;
        }
        if (!drag[i]?.active && Math.abs(vel[i]) > 0.01) {
          delta += vel[i] * dt;
          vel[i] *= Math.pow(0.95, dt / 16);
        }
        if (delta !== 0) pos[i] = wrap(pos[i] + delta, seg[i]);
      }
    }

    rAF = requestAnimationFrame(() => loop(now));
  }

  // Only spend frames while the marquee is on screen.
  function start() {
    if (rAF == null) rAF = requestAnimationFrame(() => loop());
  }
  function stop() {
    if (rAF != null) {
      cancelAnimationFrame(rAF);
      rAF = null;
    }
  }

  // ── Vertical drag handlers ───────────────────────────────────────────────
  function vDown(i: number, e: PointerEvent) {
    if (drag[i].active) return;
    colEls[i]?.setPointerCapture(e.pointerId);
    drag[i] = { active: true, id: e.pointerId, lastY: e.clientY, lastT: performance.now() };
    vel[i] = 0;
    dragDistance = 0;
    suppressClick = false;
  }
  function vMove(i: number, e: PointerEvent) {
    if (!drag[i].active || e.pointerId !== drag[i].id) return;
    const now = performance.now();
    const dy = e.clientY - drag[i].lastY;
    const dt = Math.max(1, now - drag[i].lastT);
    vel[i] = dy / dt;
    dragDistance += Math.abs(dy);
    if (dragDistance > CLICK_SLOP) suppressClick = true;
    drag[i].lastY = e.clientY;
    drag[i].lastT = now;
    pos[i] = wrap(pos[i] + dy, seg[i]);
  }
  function vUp(i: number, e: PointerEvent) {
    if (!drag[i].active || e.pointerId !== drag[i].id) return;
    colEls[i]?.releasePointerCapture(e.pointerId);
    vel[i] *= 0.22;
    drag[i].active = false;
    drag[i].id = -1;
  }

  // ── Horizontal drag handlers ─────────────────────────────────────────────
  function hDown(e: PointerEvent) {
    if (hDrag.active) return;
    hEl?.setPointerCapture(e.pointerId);
    hDrag = { active: true, id: e.pointerId, lastX: e.clientX, lastT: performance.now() };
    hVel = 0;
    dragDistance = 0;
    suppressClick = false;
  }
  function hMove(e: PointerEvent) {
    if (!hDrag.active || e.pointerId !== hDrag.id) return;
    const now = performance.now();
    const dx = e.clientX - hDrag.lastX;
    const dt = Math.max(1, now - hDrag.lastT);
    hVel = dx / dt;
    dragDistance += Math.abs(dx);
    if (dragDistance > CLICK_SLOP) suppressClick = true;
    hDrag.lastX = e.clientX;
    hDrag.lastT = now;
    hPos = wrap(hPos + dx, hSeg);
  }
  function hUp(e: PointerEvent) {
    if (!hDrag.active || e.pointerId !== hDrag.id) return;
    hEl?.releasePointerCapture(e.pointerId);
    hVel *= 0.22;
    hDrag.active = false;
    hDrag.id = -1;
  }

  onMount(() => {
    pos = Array.from({ length: columns }, () => 0);
    seg = Array.from({ length: columns }, () => 0);
    vel = Array.from({ length: columns }, () => 0);
    drag = Array.from({ length: columns }, () => ({
      active: false,
      id: -1,
      lastY: 0,
      lastT: 0,
    }));

    reducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    mq = window.matchMedia('(max-width: 768px)');
    isMobile = mq.matches;
    onMqChange = (e) => {
      isMobile = e.matches;
      measure();
    };
    mq.addEventListener('change', onMqChange);

    ro = new ResizeObserver(() => measure());
    if (hTrack) ro.observe(hTrack);
    colTracks.forEach((t) => t && ro!.observe(t));

    measure();

    if ('IntersectionObserver' in window && rootEl) {
      io = new IntersectionObserver(([entry]) => {
        if (entry.isIntersecting) start();
        else stop();
      });
      io.observe(rootEl);
    } else {
      start();
    }
  });

  onDestroy(() => {
    stop();
    ro?.disconnect();
    io?.disconnect();
    if (mq && onMqChange) mq.removeEventListener('change', onMqChange);
  });
</script>

<!-- Pointer/focus listeners only pause the auto-scroll while someone is reading;
     the click-capture only cancels a link click that was really a drag. Neither
     is a control in its own right, so the section stays non-interactive. -->
<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_noninteractive_element_interactions -->
<section
  {id}
  class="vrm"
  class:vrm--mobile={isMobile}
  style="--vrm-bg: {background}; background: {background};"
  aria-labelledby={title ? `${id}-title` : undefined}
  aria-label={title ? undefined : 'Customer reviews'}
  bind:this={rootEl}
  on:pointerenter={() => (hoverPause = true)}
  on:pointerleave={() => (hoverPause = false)}
  on:focusin={() => (hoverPause = true)}
  on:focusout={(e) => {
    if (!rootEl.contains(e.relatedTarget as Node)) hoverPause = false;
  }}
  on:click|capture={onClickCapture}
>
  {#if title || subtitle}
    <div class="vrm__head">
      {#if title}<h2 class="vrm__title" id="{id}-title">{title}</h2>{/if}
      {#if subtitle}<p class="vrm__subtitle">{subtitle}</p>{/if}
    </div>
  {/if}

  {#if !reducedMotion && speed !== 0}
    <div class="vrm__controls">
      <button
        type="button"
        class="vrm__pause"
        aria-pressed={paused}
        on:click={() => (paused = !paused)}
      >
        {#if paused}
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z" fill="currentColor" /></svg>
          Play reviews
        {:else}
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h4v14H7zM13 5h4v14h-4z" fill="currentColor" /></svg>
          Pause reviews
        {/if}
      </button>
    </div>
  {/if}

  {#if isMobile}
    <!-- ── Mobile: single horizontal marquee ─────────────────────────────── -->
    <div
      class="vrm__h"
      bind:this={hEl}
      on:pointerdown={hDown}
      on:pointermove={hMove}
      on:pointerup={hUp}
      on:pointercancel={hUp}
      on:lostpointercapture={hUp}
    >
      <div class="vrm__h-mask vrm__h-mask--l"></div>
      <div class="vrm__h-mask vrm__h-mask--r"></div>
      <div
        class="vrm__h-track"
        bind:this={hTrack}
        style="transform: translate3d({hPos}px, 0, 0); gap: {gap}px;"
      >
        {#each tripledAll as r, i (i + '-' + r.name)}
          {@const isCopy = i >= reviews.length}
          <a
            class="vrm__card"
            href={r.link}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Read ${r.name}'s Google review (opens in a new tab)`}
            aria-hidden={isCopy ? 'true' : undefined}
            tabindex={isCopy ? -1 : undefined}
          >
            <span class="vrm__stars" aria-hidden="true">★★★★★</span>
            <blockquote class="vrm__quote">{r.quote}</blockquote>
            <span class="vrm__meta">
              <span class="vrm__name">{r.name}</span>
              <span class="vrm__route">{r.route}</span>
            </span>
          </a>
        {/each}
      </div>
    </div>
  {:else}
    <!-- ── Desktop: alternating vertical columns ─────────────────────────── -->
    <div class="vrm__cols">
      {#each sets as set, i (i)}
        <div
          class="vrm__col"
          bind:this={colEls[i]}
          on:pointerdown={(e) => vDown(i, e)}
          on:pointermove={(e) => vMove(i, e)}
          on:pointerup={(e) => vUp(i, e)}
          on:pointercancel={(e) => vUp(i, e)}
          on:lostpointercapture={(e) => vUp(i, e)}
          style="height: {columnHeight}px;"
        >
          <div class="vrm__mask vrm__mask--t"></div>
          <div class="vrm__mask vrm__mask--b"></div>
          <div
            class="vrm__track"
            bind:this={colTracks[i]}
            style="transform: translate3d(0, {pos[i] ?? 0}px, 0); gap: {gap}px;"
          >
            {#each tripledSets[i] as r, j (j + '-' + r.name)}
              {@const isCopy = j >= set.length}
              <a
                class="vrm__card"
                href={r.link}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Read ${r.name}'s Google review (opens in a new tab)`}
                aria-hidden={isCopy ? 'true' : undefined}
                tabindex={isCopy ? -1 : undefined}
              >
                <span class="vrm__stars" aria-hidden="true">★★★★★</span>
                <blockquote class="vrm__quote">{r.quote}</blockquote>
                <span class="vrm__meta">
                  <span class="vrm__name">{r.name}</span>
                  <span class="vrm__route">{r.route}</span>
                </span>
              </a>
            {/each}
          </div>
        </div>
      {/each}
    </div>
  {/if}
</section>

<style lang="scss">
  .vrm {
    width: 100%;
    box-sizing: border-box;
    /* Side gutter so cards and the pause control never touch the viewport. */
    padding-inline: clamp(1rem, 3vw, 2rem);
    font-family: var(--font-paragraph, 'Jost'), system-ui, sans-serif;
  }
  /* Mobile marquee stays edge-to-edge (the fades handle the edges). */
  .vrm--mobile .vrm__h {
    margin-inline: calc(-1 * clamp(1rem, 3vw, 2rem));
    width: auto;
  }

  .vrm__head {
    text-align: center;
    margin-bottom: 2rem;
  }

  .vrm__controls {
    display: flex;
    justify-content: flex-end;
    margin: -0.75rem 0 0.75rem;
  }
  .vrm__pause {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.45rem 0.9rem;
    border-radius: 999px;
    border: 1px solid #d5dde6;
    background: #fff;
    color: #334155;
    font: inherit;
    font-size: 0.82rem;
    font-weight: 600;
    cursor: pointer;
    transition: border-color 0.2s, color 0.2s;

    svg {
      width: 14px;
      height: 14px;
    }
    &:hover {
      border-color: var(--color-highlight-2, #02b5bb);
      color: #0f172a;
    }
    &:focus-visible {
      outline: 2px solid var(--color-highlight-2, #02b5bb);
      outline-offset: 2px;
    }
  }
  .vrm__title {
    font-family: var(--font-title, 'Kiona Regular', serif);
    font-size: clamp(1.8rem, 3.4vw, 2.7rem);
    font-weight: 700;
    letter-spacing: -0.02em;
    line-height: 1.08;
    color: var(--color-foreground, #181818);
    margin: 0 0 0.6rem;
  }
  .vrm__subtitle {
    font-size: 1.1rem;
    line-height: 1.65;
    color: #475569;
    max-width: 62ch;
    margin: 0 auto;
  }

  /* ── Desktop columns ─────────────────────────────────────────────────── */
  .vrm__cols {
    display: flex;
    gap: 1.25rem;
    align-items: flex-start;
  }

  .vrm__col {
    flex: 1 1 0;
    min-width: 0;
    position: relative;
    overflow: hidden;
    cursor: grab;
    touch-action: pan-x;
    border-radius: 18px;

    &:active {
      cursor: grabbing;
    }
  }

  .vrm__mask {
    position: absolute;
    left: 0;
    right: 0;
    height: 18%;
    z-index: 10;
    pointer-events: none;

    /* Fades match whatever background the page passes in (was hard-coded
       #fbfcfc, which showed as grey bands on the homepage's white). */
    &--t {
      top: 0;
      background: linear-gradient(to bottom, var(--vrm-bg, #fbfcfc) 0%, transparent 100%);
    }
    &--b {
      bottom: 0;
      background: linear-gradient(to top, var(--vrm-bg, #fbfcfc) 0%, transparent 100%);
    }
  }

  .vrm__track {
    display: flex;
    flex-direction: column;
    will-change: transform;
    user-select: none;
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
  }

  /* ── Mobile horizontal ───────────────────────────────────────────────── */
  .vrm__h {
    position: relative;
    overflow: hidden;
    cursor: grab;
    touch-action: pan-y;
    width: 100%;

    &:active {
      cursor: grabbing;
    }
  }

  .vrm__h-mask {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 12%;
    z-index: 10;
    pointer-events: none;

    &--l {
      left: 0;
      background: linear-gradient(to right, var(--vrm-bg, #fbfcfc) 0%, transparent 100%);
    }
    &--r {
      right: 0;
      background: linear-gradient(to left, var(--vrm-bg, #fbfcfc) 0%, transparent 100%);
    }
  }

  .vrm__h-track {
    display: flex;
    align-items: stretch;
    will-change: transform;
    user-select: none;
    position: relative;
    left: 0;
  }

  /* ── Card ────────────────────────────────────────────────────────────── */
  .vrm__card {
    display: flex;
    flex-direction: column;
    gap: 0.85rem;
    padding: 1.6rem;
    border-radius: 18px;
    background: #fff;
    border: 1px solid #e8eef5;
    box-shadow: 0 18px 40px -30px rgba(15, 23, 42, 0.45);
    color: #1a1a2e;
    text-decoration: none;
    transition: border-color 0.3s, box-shadow 0.3s;
    flex: 0 0 auto;
    width: 100%;
    box-sizing: border-box;

    &:hover {
      border-color: rgba(2, 181, 187, 0.35);
      box-shadow: 0 26px 54px -28px rgba(15, 23, 42, 0.5);
    }
    &:focus-visible {
      outline: 2px solid var(--color-highlight-2, #02b5bb);
      outline-offset: -2px;
    }
  }

  .vrm__stars {
    color: #f59e0b;
    font-size: 0.95rem;
    letter-spacing: 0.12em;
  }

  .vrm__quote {
    margin: 0;
    font-size: 0.94rem;
    line-height: 1.6;
    color: #475569;
    flex: 1;
  }

  .vrm__meta {
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
    padding-top: 0.75rem;
    border-top: 1px solid #eef2f6;
  }

  .vrm__name {
    font-family: var(--font-subtitle, 'Spartan Black', sans-serif);
    font-weight: 700;
    color: #0f172a;
    font-size: 0.9rem;
  }

  .vrm__route {
    font-size: 0.8rem;
    color: #64748b;
  }

  /* Mobile: fixed card width so the horizontal track scrolls */
  .vrm--mobile .vrm__card {
    width: min(320px, 82vw);
  }
</style>