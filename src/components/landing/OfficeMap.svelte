<script lang="ts">
  /**
   * The offices map: real coastlines and borders in a paper-atlas style,
   * with a camera that flies from office to office (drawing: mapRender.ts).
   *
   * `t` is a continuous position along the tour: -1 is the overview, 0..n-1
   * are the stops, fractions are flights in between. Pins and the plane are
   * HTML so they stay crisp and can pulse without redrawing the map.
   *
   * Performance: where the browser supports it the canvas is handed to a
   * worker (officeMap.worker.ts) and drawn there, so a trackpad scroll never
   * waits on the map; the worker reports where the pins and the plane landed
   * in each frame it drew. Otherwise the same renderer runs here, at most
   * once per animation frame.
   */
  import { onDestroy, onMount } from 'svelte';
  import { MapRenderer, type Frame, type FrameOut, type MapData, type Pin, type Stop } from './mapRender.ts';

  export let stops: Stop[] = [];
  export let pins: Pin[] = [];
  export let t = -1;
  /** Pin highlighted from the list (hover or focus), or -1. */
  export let hot = -1;
  export let overview: Stop = { lon: -45, lat: 24, width: 118 };

  let wrap: HTMLDivElement;
  let canvas: HTMLCanvasElement;
  let W = 0;
  let H = 0;
  let screenPins: FrameOut['pins'] = [];
  let plane: FrameOut['plane'] = { x: 0, y: 0, a: 0, vis: false };
  let shownT = t; // the tour position of the frame on screen
  let ro: ResizeObserver | null = null;
  let raf = 0;
  let worker: Worker | null = null;
  let local: MapRenderer | null = null;
  let ready = false;

  const DATA = '/landing/offices-map.json';

  function apply(o: FrameOut) {
    screenPins = o.pins;
    plane = o.plane;
    shownT = o.t;
  }

  function frame(): Frame {
    // Retina is capped at 1.5x: the map is decoration, and this keeps each
    // frame's pixel count (and fill cost) down by almost half.
    return { t, W, H, dpr: Math.min(1.5, window.devicePixelRatio || 1) };
  }

  onMount(() => {
    const offscreen =
      typeof Worker !== 'undefined' && typeof OffscreenCanvas !== 'undefined' && 'transferControlToOffscreen' in canvas;
    if (offscreen) {
      try {
        worker = new Worker(new URL('./officeMap.worker.ts', import.meta.url), { type: 'module' });
        const oc = canvas.transferControlToOffscreen();
        worker.onmessage = (e: MessageEvent<FrameOut>) => apply(e.data);
        worker.postMessage(
          { type: 'init', canvas: oc, stops, pins, overview, dataUrl: new URL(DATA, location.href).href },
          [oc]
        );
      } catch {
        worker?.terminate();
        worker = null;
      }
    }
    if (!worker) {
      local = new MapRenderer(canvas, stops, pins, overview);
      fetch(DATA)
        .then((r) => r.json())
        .then((d: MapData) => {
          local?.setData(d);
          schedule();
        })
        .catch(() => {});
    }
    ready = true;
    ro = new ResizeObserver(() => {
      W = wrap.clientWidth;
      H = wrap.clientHeight;
    });
    ro.observe(wrap);
  });

  onDestroy(() => {
    ro?.disconnect();
    worker?.terminate();
    if (typeof window !== 'undefined') cancelAnimationFrame(raf);
  });

  $: if (ready) schedule(t, W, H);
  function schedule(..._deps: unknown[]) {
    if (typeof window === 'undefined' || raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      const f = frame();
      if (worker) worker.postMessage({ type: 'frame', ...f });
      else if (local) apply(local.render(f));
    });
  }

  $: active = Math.round(Math.max(-1, Math.min(stops.length - 1, shownT)));
  $: settled = Math.abs(shownT - Math.round(shownT)) < 0.12;
</script>

<div class="omap" bind:this={wrap}>
  <canvas bind:this={canvas}></canvas>
  {#each pins as p, k}
    {@const sp = screenPins[k]}
    {#if sp}
      <span
        class="pin"
        class:on={(p.stop === active && settled) || hot === k}
        class:show={sp.vis}
        style="transform: translate3d({sp.x}px, {sp.y}px, 0)"
      >
        <i class="halo"></i><i class="dot"></i>
        <b class="tag">{p.label}</b>
      </span>
    {/if}
  {/each}
  {#if plane.vis}
    <svg class="plane" viewBox="0 0 24 24" style="transform: translate3d({plane.x}px, {plane.y}px, 0) rotate({plane.a}rad)">
      <path style="fill:#0e2f36" d="M21.5 12c0-.7-.6-1.2-1.3-1.2h-5.4L10 3.4H8.2l2.4 7.4H5.6L4 8.6H2.6l1 3.4-1 3.4H4l1.6-2.2h5l-2.4 7.4H10l4.8-7.4h5.4c.7 0 1.3-.5 1.3-1.2z" />
    </svg>
  {/if}
  <span class="credit">Natural Earth</span>
</div>

<style lang="scss">
  @use './tokens' as *;

  .omap { position: relative; width: 100%; height: 100%; overflow: hidden; background: linear-gradient(#dcefef, #bcdcdf); }
  canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }

  .pin {
    position: absolute; left: 0; top: 0; width: 0; height: 0; opacity: 0; transition: opacity 250ms;
    &.show { opacity: 1; }
    .dot {
      position: absolute; left: -5px; top: -5px; width: 10px; height: 10px; border-radius: 50%;
      background: $color-ink-strong; box-shadow: 0 0 0 2.5px #fff, 0 3px 8px rgba(14, 47, 54, 0.45);
      transition: transform 300ms $ease, background 300ms;
    }
    .halo { position: absolute; left: -16px; top: -16px; width: 32px; height: 32px; border-radius: 50%; background: rgba(2, 181, 187, 0.35); opacity: 0; transform: scale(0.4); }
    .tag {
      position: absolute; left: 12px; top: -11px; white-space: nowrap; padding: 4px 9px; border-radius: 99px;
      background: #fff; color: $color-ink-strong; font: 700 0.7rem $font-sans; box-shadow: 0 6px 16px -6px rgba(14, 47, 54, 0.45);
      opacity: 0; transform: translateX(-4px); transition: opacity 250ms, transform 350ms $ease; pointer-events: none;
    }
    &.on {
      z-index: 2;
      .dot { background: $color-accent; transform: scale(1.25); }
      .halo { animation: halo 1.8s $ease infinite; }
      .tag { opacity: 1; transform: none; }
    }
  }
  @keyframes halo { 0% { opacity: 0.9; transform: scale(0.4); } 100% { opacity: 0; transform: scale(1.4); } }
  .plane { position: absolute; left: -11px; top: -11px; width: 22px; height: 22px; transform-origin: 11px 11px; filter: drop-shadow(0 3px 4px rgba(14, 47, 54, 0.35)); }
  .credit { position: absolute; right: 10px; bottom: 8px; font: 0.6rem $font-sans; color: rgba(14, 47, 54, 0.5); }

  @include reduced-motion { .pin.on .halo { animation: none; opacity: 0.5; transform: scale(1); } }
</style>
