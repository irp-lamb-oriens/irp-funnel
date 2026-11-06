<script lang="ts">
  /**
   * Page hero for every CountryLayout page (countries, guides, news, contact,
   * legal). Same props as before; `eyebrow` is new and optional.
   *
   * The photo is a real <img> (not a fixed CSS background) so it can be the
   * page's LCP element, gets a responsive srcset for Pexels URLs, and doesn't
   * repaint on every scroll frame the way background-attachment: fixed did.
   */
  export let text: string;
  export let url: string | undefined = undefined;
  export let subtitle: string | undefined = undefined;
  export let eyebrow: string | undefined = undefined;

  // Pexels serves any width through ?w=; build a srcset from the same photo.
  function srcsetFor(src: string | undefined): string | undefined {
    if (!src || !/^https:\/\/images\.pexels\.com\//.test(src)) return undefined;
    const base = src.split('?')[0];
    return [800, 1280, 1920, 2600]
      .map((w) => `${base}?auto=compress&cs=tinysrgb&w=${w} ${w}w`)
      .join(', ');
  }

  $: srcset = srcsetFor(url);
  $: words = (text ?? '').split(/\s+/).filter(Boolean);
  // Long titles (article headlines) step down a size so they stay on 2–4 lines.
  $: long = (text ?? '').length > 42;
</script>

<section class="hero-section" class:has-photo={!!url} class:long>
  {#if url}
    <div class="hero-media" aria-hidden="true">
      <img
        src={url}
        {srcset}
        sizes="100vw"
        alt=""
        fetchpriority="high"
        decoding="async"
      />
    </div>
  {/if}
  <div class="hero-inner">
    {#if eyebrow}
      <p class="hero-eyebrow">{eyebrow}</p>
    {/if}
    <h1 aria-label={text}>
      {#each words as w, i}
        <span class="w" aria-hidden="true" style="--i:{i}">{w}</span>{' '}
      {/each}
    </h1>
    {#if subtitle}
      <p class="hero-subtitle">{subtitle}</p>
    {/if}
  </div>
</section>

<style lang="scss">
  $ink: #0e2f36;
  $teal: #02b5bb;
  $sans: 'Helvetica Neue', Helvetica, Arial, 'Segoe UI', sans-serif;
  $mono: 'SFMono-Regular', Menlo, Consolas, monospace;
  $ease: cubic-bezier(0.16, 1, 0.3, 1);

  .hero-section {
    position: relative;
    isolation: isolate;
    overflow: hidden;
    display: flex;
    align-items: flex-end;
    min-height: clamp(340px, 48vh, 560px);
    padding: clamp(4rem, 10vh, 7rem) 0 clamp(2.25rem, 5vh, 4rem);
    background: $ink;
    color: #fff;
    font-family: $sans;
    // global.scss gives every element var(--font-paragraph); scope it here.
    --font-paragraph: #{$sans};
  }

  .hero-media {
    position: absolute;
    inset: 0;
    z-index: -1;
    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
      transform-origin: 60% 40%;
      animation: hero-settle 1.8s $ease both;
    }
    // Legibility scrim: heavier at the bottom-left where the type sits.
    &::after {
      content: '';
      position: absolute;
      inset: 0;
      background:
        linear-gradient(180deg, rgba(14, 47, 54, 0.1) 0%, rgba(14, 47, 54, 0.35) 45%, rgba(9, 30, 35, 0.88) 100%),
        linear-gradient(90deg, rgba(9, 30, 35, 0.55) 0%, rgba(9, 30, 35, 0) 65%);
    }
  }

  .hero-inner {
    width: min(1200px, 100% - 2 * clamp(1.25rem, 4vw, 3rem));
    margin: 0 auto;
  }

  .hero-eyebrow {
    margin: 0 0 1.1rem;
    font: 600 0.75rem/1 $mono;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: #7fe3e6;
    animation: hero-rise 0.9s $ease both;
  }

  h1 {
    margin: 0;
    max-width: 15ch;
    font: 700 clamp(2.75rem, 7.4vw, 6.25rem) / 0.98 $sans;
    letter-spacing: -0.045em;
    color: #fff;
    text-wrap: balance;
    .long & {
      max-width: 24ch;
      font-size: clamp(2rem, 4.6vw, 3.9rem);
      line-height: 1.04;
      letter-spacing: -0.035em;
    }
  }

  .w {
    display: inline-block;
    animation: hero-rise 0.9s $ease both;
    animation-delay: calc(0.08s + var(--i) * 0.05s);
  }

  .hero-subtitle {
    margin: 1.4rem 0 0;
    max-width: 52ch;
    font: 400 clamp(1.05rem, 1.6vw, 1.3rem) / 1.5 $sans;
    color: rgba(255, 255, 255, 0.82);
    text-wrap: pretty;
    animation: hero-rise 0.9s $ease 0.3s both;
  }

  // No photo: a quiet ink band with the same typographic treatment.
  .hero-section:not(.has-photo) {
    min-height: clamp(300px, 42vh, 460px);
    background:
      radial-gradient(800px 400px at 85% 10%, rgba(2, 181, 187, 0.22), transparent 70%),
      $ink;
  }

  @keyframes hero-rise {
    from {
      opacity: 0;
      transform: translateY(0.45em);
    }
  }
  @keyframes hero-settle {
    from {
      transform: scale(1.08);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .hero-media img,
    .w,
    .hero-eyebrow,
    .hero-subtitle {
      animation: none;
    }
  }
</style>
