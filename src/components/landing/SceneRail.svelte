<script lang="ts">
  /** Section rail: one stop per scene, the current one filled. Navigation for keyboard and pointer. */
  import { onMount } from 'svelte';
  export let stops: { id: string; label: string }[] = [];
  let active = -1;
  let visible = false;

  onMount(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      const mid = window.innerHeight / 2;
      let a = -1;
      stops.forEach((s, i) => {
        const el = document.getElementById(s.id);
        if (!el) return;
        const r = el.getBoundingClientRect();
        if (r.top <= mid && r.bottom > mid) a = i;
      });
      active = a;
      const first = document.getElementById(stops[0]?.id);
      visible = !!first && first.getBoundingClientRect().top < window.innerHeight * 0.6;
    };
    const on = () => { if (!raf) raf = requestAnimationFrame(update); };
    update();
    window.addEventListener('scroll', on, { passive: true });
    window.addEventListener('resize', on);
    return () => { window.removeEventListener('scroll', on); window.removeEventListener('resize', on); cancelAnimationFrame(raf); };
  });

  function go(e: MouseEvent, id: string) {
    const el = document.getElementById(id);
    if (!el) return;
    e.preventDefault();
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY, behavior: reduce ? 'auto' : 'smooth' });
  }
</script>

<nav class="rail" class:visible aria-label="Page sections">
  <ol>
    {#each stops as s, i}
      <li class:active={i === active} class:done={i < active}>
        <a href="#{s.id}" on:click={(e) => go(e, s.id)} aria-current={i === active ? 'step' : undefined}>
          <span class="dot" aria-hidden="true"></span>
          <span class="label">{s.label}</span>
        </a>
      </li>
    {/each}
  </ol>
</nav>

<style lang="scss">
  @use './tokens' as *;

  .rail {
    position: fixed; left: 18px; top: 50%; z-index: 60;
    transform: translate(-8px, -50%); opacity: 0; pointer-events: none;
    transition: opacity 400ms $ease, transform 500ms $ease;
    display: none;
    @media (min-width: 1280px) { display: block; }
    &.visible { opacity: 1; transform: translate(0, -50%); pointer-events: auto; }
  }
  ol {
    position: relative; list-style: none; margin: 0; padding: 10px 8px; display: flex; flex-direction: column; gap: 2px;
    border-radius: 999px; background: rgba(255, 255, 255, 0.72);
    backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
    border: 1px solid $color-hairline; box-shadow: 0 8px 24px -12px rgba(14, 47, 54, 0.3);
  }
  /* The connecting line: the route. */
  ol::before {
    content: ''; position: absolute; left: 50%; top: 18px; bottom: 18px; width: 1px;
    background: $color-hairline-strong; transform: translateX(-0.5px);
  }
  li { position: relative; }
  a {
    position: relative; display: grid; place-items: center; width: 22px; height: 22px; border-radius: 50%;
    text-decoration: none; @include focus-ring;
  }
  .dot {
    width: 7px; height: 7px; border-radius: 50%; background: $color-canvas; border: 1.5px solid $color-hairline-strong;
    transition: transform 300ms $ease, background 300ms, border-color 300ms;
  }
  .done .dot { background: $color-accent; border-color: $color-accent; }
  .active .dot { background: $color-accent; border-color: $color-ink-strong; transform: scale(1.6); }
  .label {
    position: absolute; left: 32px; top: 50%; transform: translate(-6px, -50%); white-space: nowrap;
    padding: 4px 10px; border-radius: 8px; background: $color-ink-strong; color: $color-on-dark;
    font-family: $font-mono; font-size: 0.68rem; letter-spacing: 0.1em; text-transform: uppercase;
    opacity: 0; pointer-events: none; transition: opacity 200ms, transform 300ms $ease;
  }
  a:hover .label, a:focus-visible .label { opacity: 1; transform: translate(0, -50%); }
  @include reduced-motion { .rail, .dot, .label { transition: none; } }
</style>
