<script lang="ts">
    import { onMount, onDestroy, afterUpdate } from 'svelte';
    import { writable } from 'svelte/store';
    import { smoothScrollTarget } from './store.ts';
  
    // ——— Public props —————————————————————
    export let ease = 0.08;   // inertia factor
    export let axis: 'y' | 'x' = 'y';
    export let clamp = false; // pixel snapping
  
    // ——— Internals ————————————————————————
    const smooth = writable(0);      // eased value
    let target = 0, current = 0;     // scalar numbers
    let raf: number;
    let contentEl: HTMLElement;      // <div class="smooth-content">
    let spacerEl: HTMLElement;       // <div class="spacer">
  
    // util
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  
    // ——— Native scroll listener ———————————
    function onScroll() {
      target = axis === 'y' ? window.scrollY : window.scrollX;
    }
  
    // ——— RAF loop ————————————————————————
    function animate() {
      current = lerp(current, target, ease);
      if (clamp) current = Math.round(current);
      smooth.set(current);
      smoothScrollTarget.set(-current);
      contentEl.style.transform =
        axis === 'y'
          ? `translate3d(0, ${-current}px, 0)`
          : `translate3d(${-current}px, 0, 0)`;
      raf = requestAnimationFrame(animate);
    }
  
    // ——— Keep spacer height in sync ———————
    let ro: ResizeObserver;
    function syncHeight() {
      const size =
        axis === 'y'
          ? contentEl.getBoundingClientRect().height
          : contentEl.getBoundingClientRect().width;
      spacerEl.style[axis === 'y' ? 'height' : 'width'] = size + 'px';
    }
  
    onMount(() => {
      if (typeof window === 'undefined') return; // SSR guard
      window.addEventListener('scroll', onScroll, { passive: true });
      onScroll();         // set initial target
      animate();          // kick off RAF
  
      // ResizeObserver → adjust spacer when content changes
      ro = new ResizeObserver(syncHeight);
      ro.observe(contentEl);
      syncHeight();
    });
  
    // keep spacer updated if slot changes after first render
    afterUpdate(syncHeight);
  </script>
  
  <style>
  .smooth-content {
    position: fixed;
    top: 0; left: 0;
    width: 100%;
    will-change: transform;
    scroll-behavior: smooth;
  }
  .spacer { /* width/height set dynamically */ }
  </style>
  
  <!-- ——— Render ——————————————————————————— -->
  <div bind:this={contentEl} class="smooth-content">
    <slot />
  </div>
  <div bind:this={spacerEl} class="spacer"></div>
  