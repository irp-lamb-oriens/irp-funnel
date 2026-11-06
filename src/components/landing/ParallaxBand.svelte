<script lang="ts">
  /** Full-bleed photo band with a glass panel (ILP ParallaxBand). Transform only; off under reduced motion. */
  import { onMount } from 'svelte';
  import { reveal } from './reveal.ts';
  export let id = '';
  export let image: string;
  export let title: string;
  export let body: string;
  export let mark = '';
  export let align: 'left' | 'right' = 'left';
  /** Photo fills only the right part on wide screens (for photos whose subject is centered). */
  export let split = false;

  let section: HTMLElement;
  let bg: HTMLElement;

  $: parts = mark && body.includes(mark) ? body.split(mark) : [body];

  onMount(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      const r = section.getBoundingClientRect();
      const vh = window.innerHeight;
      const p = Math.min(1, Math.max(0, (vh - r.top) / (vh + r.height)));
      bg.style.transform = `translate3d(0, ${(p - 0.5) * 24}%, 0) scale(${1.12 - Math.abs(p - 0.5) * 0.12})`;
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      cancelAnimationFrame(raf);
    };
  });
</script>

<section class="band {align}" class:split id={id || undefined} bind:this={section}>
  <div class="bg" bind:this={bg} style="background-image: url('{image}')" role="img" aria-label=""></div>
  <div class="inner">
    <div class="glass" use:reveal>
      <h2 class="title">{title}</h2>
      <p class="body">
        {#if parts.length > 1}{parts[0]}<mark>{mark}</mark>{parts[1]}{:else}{body}{/if}
      </p>
    </div>
  </div>
</section>

<style lang="scss">
  @use './tokens' as *;

  .band { position: relative; overflow: hidden; min-height: 78vh; display: flex; align-items: center; isolation: isolate; }
  .bg {
    position: absolute; inset: -18% 0; z-index: -1;
    background-size: cover; background-position: center;
    transform: scale(1.12); will-change: transform;
    &::after { content: ''; position: absolute; inset: 0; background: linear-gradient(90deg, rgba(14, 47, 54, 0.55), rgba(14, 47, 54, 0.1)); }
  }
  .split {
    @include lg {
      background: $color-ink-strong;
      .bg { left: 34%; background-position: center 30%; }
      .bg::after { background: linear-gradient(90deg, $color-ink-strong 0%, rgba(14, 47, 54, 0.35) 22%, rgba(14, 47, 54, 0) 45%); }
    }
  }
  .right .bg::after { background: linear-gradient(270deg, rgba(14, 47, 54, 0.55), rgba(14, 47, 54, 0.1)); }
  .inner { @include container; display: flex; }
  .right .inner { justify-content: flex-end; }
  .glass {
    max-width: 560px; padding: clamp(1.75rem, 4vw, 3rem);
    border-radius: $radius-lg; border: 1px solid rgba(255, 255, 255, 0.4);
    background: rgba(255, 255, 255, 0.78);
    backdrop-filter: blur(18px) saturate(140%); -webkit-backdrop-filter: blur(18px) saturate(140%);
    display: flex; flex-direction: column; gap: $space-4;
    @include reveal(24px);
    @media (prefers-reduced-transparency: reduce) { background: $color-canvas; backdrop-filter: none; }
  }
  .title { @include heading-xl; font-size: clamp(1.8rem, 3.6vw, 2.75rem); }
  .body { @include body; color: $color-ink; font-size: 1.125rem; }
  mark {
    background: linear-gradient($color-accent, $color-accent) no-repeat 0 100% / 0% 3px;
    color: inherit; padding-bottom: 2px;
    transition: background-size 900ms $ease 500ms;
  }
  .glass:global(.is-in) mark { background-size: 100% 3px; }
</style>
