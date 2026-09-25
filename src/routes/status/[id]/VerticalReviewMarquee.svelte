<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { googleReviews, type Review } from '../../../lib/reviews.ts';

  // ── Props ────────────────────────────────────────────────────────────────
  export let reviews: Review[] = googleReviews;
  export let columns = 3;
  export let speed = 0.04; // px per ms
  export let gap = 20;
  export let columnHeight = 520;

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

    if (isMobile) {
      let delta = 0;
      if (!hDrag.active && !reducedMotion && speed !== 0) delta += -speed * dt;
      if (!hDrag.active && Math.abs(hVel) > 0.01) {
        delta += hVel * dt;
        hVel *= Math.pow(0.95, dt / 16);
      }
      if (delta !== 0) hPos = wrap(hPos + delta, hSeg);
    } else {
      for (let i = 0; i < columns; i++) {
        const dir = i % 2 === 0 ? -1 : 1;
        let delta = 0;
        if (!drag[i]?.active && !reducedMotion && speed !== 0) {
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

  // ── Vertical drag handlers ───────────────────────────────────────────────
  function vDown(i: number, e: PointerEvent) {
    if (drag[i].active) return;
    colEls[i]?.setPointerCapture(e.pointerId);
    drag[i] = { active: true, id: e.pointerId, lastY: e.clientY, lastT: performance.now() };
    vel[i] = 0;
  }
  function vMove(i: number, e: PointerEvent) {
    if (!drag[i].active || e.pointerId !== drag[i].id) return;
    const now = performance.now();
    const dy = e.clientY - drag[i].lastY;
    const dt = Math.max(1, now - drag[i].lastT);
    vel[i] = dy / dt;
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
  }
  function hMove(e: PointerEvent) {
    if (!hDrag.active || e.pointerId !== hDrag.id) return;
    const now = performance.now();
    const dx = e.clientX - hDrag.lastX;
    const dt = Math.max(1, now - hDrag.lastT);
    hVel = dx / dt;
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
    mq.addEventListener('change', (e) => {
      isMobile = e.matches;
      measure();
    });

    ro = new ResizeObserver(() => measure());
    if (hTrack) ro.observe(hTrack);
    colTracks.forEach((t) => t && ro!.observe(t));

    measure();
    rAF = requestAnimationFrame(() => loop());
  });

  onDestroy(() => {
    if (rAF != null) cancelAnimationFrame(rAF);
    ro?.disconnect();
    mq?.removeEventListener('change', () => {});
  });
</script>

<div class="vrm" class:vrm--mobile={isMobile}>
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
          <a
            class="vrm__card"
            href={r.link}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Read ${r.name}'s Google review`}
          >
            <span class="vrm__stars" aria-hidden="true">★★★★★</span>
            <blockquote class="vrm__quote">{r.quote}</blockquote>
            <footer class="vrm__meta">
              <span class="vrm__name">{r.name}</span>
              <span class="vrm__route">{r.route}</span>
            </footer>
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
              <a
                class="vrm__card"
                href={r.link}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Read ${r.name}'s Google review`}
              >
                <span class="vrm__stars" aria-hidden="true">★★★★★</span>
                <blockquote class="vrm__quote">{r.quote}</blockquote>
                <footer class="vrm__meta">
                  <span class="vrm__name">{r.name}</span>
                  <span class="vrm__route">{r.route}</span>
                </footer>
              </a>
            {/each}
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style lang="scss">
  .vrm {
    width: 100%;
    font-family: var(--font-paragraph, 'Jost'), system-ui, sans-serif;
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

    &--t {
      top: 0;
      background: linear-gradient(to bottom, #fbfcfc 0%, transparent 100%);
    }
    &--b {
      bottom: 0;
      background: linear-gradient(to top, #fbfcfc 0%, transparent 100%);
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
      background: linear-gradient(to right, #fbfcfc 0%, transparent 100%);
    }
    &--r {
      right: 0;
      background: linear-gradient(to left, #fbfcfc 0%, transparent 100%);
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