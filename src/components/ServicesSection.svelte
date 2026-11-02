<script lang="ts">
  // Homepage section that introduces the specialized relocation services and
  // links to each dedicated landing page. Award-winning modern treatment: an
  // asymmetric bento grid with real imagery, 3D tilt + spotlight cards, magnetic
  // CTAs and scroll-reactive reveals — all driven by the shared GSAP landing
  // engine so the motion language stays cohesive across every surface.
  import { onMount, onDestroy } from 'svelte';
  import { initLanding, type LandingCleanup } from '$lib/animations/landing';

  type Service = {
    key: string;
    title: string;
    description: string;
    href: string;
    cta: string;
    icon: string;
    accent: string;
    image: string;
    tag: string;
  };

  const services: Service[] = [
    {
      key: 'tours',
      title: 'Relocation tours',
      description:
        'A private, on-the-ground experience in Costa Rica or Panama before you commit. Test the region, the schools, the healthcare and the daily reality with someone who knows the ground.',
      href: '/relocation-tours',
      cta: 'Explore private tours',
      icon: 'map',
      accent: '#02b5bb',
      image:
        'https://images.pexels.com/photos/14510492/pexels-photo-14510492.jpeg?auto=compress&cs=tinysrgb&w=1600',
      tag: 'On the ground'
    },
    // {
    //   key: 'real-estate',
    //   title: 'Real estate due diligence',
    //   description:
    //     "We don't sell houses. We investigate which zones actually fit your life, your budget and your schools, before you sign anything expensive.",
    //   href: '/real-estate',
    //   cta: 'Get real estate due diligence',
    //   icon: 'estate',
    //   accent: '#c62426',
    //   image:
    //     'https://images.pexels.com/photos/1571460/pexels-photo-1571460.jpeg?auto=compress&cs=tinysrgb&w=1200',
    //   tag: 'Independent'
    // },
    {
      key: 'moving',
      title: 'International moving',
      description:
        'Shipping your household, a car or a container. We map the real rules, duties and paperwork for your route so there are no surprises at the port.',
      href: '/consultation',
      cta: 'Plan your move',
      icon: 'ship',
      accent: '#02b5bb',
      image:
        'https://images.pexels.com/photos/1117210/pexels-photo-1117210.jpeg?auto=compress&cs=tinysrgb&w=1200',
      tag: 'End to end'
    }
  ];

  let root: HTMLElement;
  let cleanup: LandingCleanup | null = null;

  onMount(async () => {
    cleanup = await initLanding(root);
  });
  onDestroy(() => cleanup?.());
</script>

<section id="services" class="services" bind:this={root} aria-labelledby="services-title">
  <div class="services__glow" data-parallax="0.12" aria-hidden="true"></div>

  <div class="services__inner">
    <div class="services__head">
      <p class="services__eyebrow" data-animate="up">What we actually do</p>
      <h2 class="services__title" id="services-title" data-animate="up" data-animate-delay="0.05">
        Specialized relocation services
      </h2>
      <p class="services__sub" data-animate="up" data-animate-delay="0.1">
        One partner for the decisions that matter: where to live, how to move,
        and what the legal side actually requires.
      </p>
    </div>

    <div class="services__grid">
      {#each services as s, i (s.key)}
        <a
          class="scard"
          class:scard--feature={i === 0}
          href={s.href}
          style={`--card-accent: ${s.accent}`}
          data-animate="scale"
          data-animate-delay={`${i * 0.06}`}
          data-tilt
        >
          <span class="scard__media" aria-hidden="true">
            <img src={s.image} alt="" loading="lazy" decoding="async" width="1200" height="800" />
            <span class="scard__scrim"></span>
          </span>

          <span class="scard__tag">{s.tag}</span>

          <span class="scard__body">
            <span class="scard__icon" aria-hidden="true">
              {#if s.icon === 'map'}
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M9 5l6 14M15 5l-6 14M4 9h16M4 15h16" stroke-linecap="round" stroke-linejoin="round"/></svg>
              {:else if s.icon === 'estate'}
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 21h18M5 21V10l7-5 7 5v11M9 21v-6h6v6" stroke-linecap="round" stroke-linejoin="round"/></svg>
              {:else}
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 16l4-6 4 3 4-8 4 11H4z" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 20h16" stroke-linecap="round"/></svg>
              {/if}
            </span>
            <h3 class="scard__title">{s.title}</h3>
            <p class="scard__desc">{s.description}</p>
            <span class="scard__cta">
              {s.cta}
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" class="scard__arrow"><path d="M5 12h14M13 6l6 6-6 6" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </span>
          </span>
        </a>
      {/each}
    </div>
  </div>
</section>

<style lang="scss">
  .services {
    position: relative;
    overflow: hidden;
    padding: 5.5rem 0 6rem;
    background:
      radial-gradient(1200px 600px at 85% -10%, rgba(var(--color-highlight-2-rgb), 0.08), transparent 60%),
      linear-gradient(180deg, #f7f8f9 0%, #ffffff 100%);
    color: #1a1a2e;
    font-family: var(--font-paragraph, 'Jost'), system-ui, sans-serif;
  }

  .services__glow {
    position: absolute;
    top: -18%;
    left: -10%;
    width: 46vw;
    height: 46vw;
    max-width: 640px;
    max-height: 640px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(var(--color-highlight-1-rgb), 0.1), transparent 62%);
    pointer-events: none;
    z-index: 0;
  }

  .services__inner {
    position: relative;
    z-index: 1;
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 2rem;
  }

  .services__head {
    max-width: 720px;
    margin-bottom: 3rem;
  }
  .services__eyebrow {
    margin: 0 0 0.9rem;
    font-size: 0.74rem;
    font-weight: 700;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: var(--color-highlight-2, #02b5bb);
  }
  .services__title {
    font-family: var(--font-title, 'Kiona Regular', serif);
    font-size: clamp(2rem, 3.4vw + 0.6rem, 3.2rem);
    font-weight: 700;
    letter-spacing: -0.02em;
    line-height: 1.05;
    margin: 0 0 1rem;
    color: var(--color-foreground, #181818);
  }
  .services__sub {
    margin: 0;
    font-size: 1.08rem;
    line-height: 1.65;
    color: #4b5563;
    max-width: 60ch;
  }

  // ── Asymmetric bento: feature card spans two columns / two rows ─────────
  .services__grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    grid-auto-rows: 1fr;
    gap: 1.25rem;
  }

  .scard {
    --card-accent: #02b5bb;
    position: relative;
    display: flex;
    align-items: flex-end;
    min-height: 340px;
    padding: 1.6rem;
    text-decoration: none;
    color: #fff;
    border-radius: 22px;
    overflow: hidden;
    isolation: isolate;
    background: #0f172a;
    box-shadow: 0 30px 60px -34px rgba(15, 23, 42, 0.5);
    transform-style: preserve-3d;
    will-change: transform;
    transition: box-shadow 0.4s cubic-bezier(0.16, 1, 0.3, 1);

    // spotlight that follows the cursor (fed by --mx/--my/--spot from JS)
    &::after {
      content: '';
      position: absolute;
      inset: 0;
      z-index: 3;
      pointer-events: none;
      opacity: calc(var(--spot, 0) * 0.9);
      background: radial-gradient(
        260px circle at var(--mx, 50%) var(--my, 50%),
        color-mix(in srgb, var(--card-accent) 40%, transparent),
        transparent 60%
      );
      mix-blend-mode: soft-light;
      transition: opacity 0.3s ease;
    }

    &:hover {
      box-shadow:
        0 40px 80px -34px color-mix(in srgb, var(--card-accent) 55%, rgba(15, 23, 42, 0.6));
    }
  }
  .scard--feature {
    grid-column: span 2;
    grid-row: span 2;
    min-height: 100%;
  }
  /* With only two services live, the second card would sit in row 1 and leave
     an empty cell under it. Let it run the full height beside the feature. */
  .scard:nth-child(2):last-child {
    grid-row: span 2;
  }

  /* Keyboard parity: everything hover reveals, focus reveals too. */
  .scard:focus-visible {
    outline: 3px solid var(--card-accent);
    outline-offset: 4px;
  }
  .scard:focus-visible .scard__media img { transform: scale(1.14); }
  .scard:focus-visible .scard__desc {
    max-height: 8rem;
    opacity: 1;
    margin-top: 0.1rem;
  }
  .scard:focus-visible .scard__arrow { transform: translateX(5px); }

  .scard__media {
    position: absolute;
    inset: 0;
    z-index: 0;
    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      transform: scale(1.08);
      transition: transform 0.9s cubic-bezier(0.16, 1, 0.3, 1);
      filter: saturate(1.05);
    }
  }
  .scard:hover .scard__media img { transform: scale(1.14); }

  .scard__scrim {
    position: absolute;
    inset: 0;
    background:
      linear-gradient(180deg, rgba(15, 23, 42, 0.15) 0%, rgba(15, 23, 42, 0.55) 55%, rgba(15, 23, 42, 0.9) 100%),
      linear-gradient(90deg, color-mix(in srgb, var(--card-accent) 34%, transparent), transparent 55%);
  }

  .scard__tag {
    position: absolute;
    top: 1.1rem;
    left: 1.1rem;
    z-index: 2;
    padding: 0.32rem 0.7rem;
    font-size: 0.66rem;
    font-weight: 700;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: #fff;
    background: rgba(255, 255, 255, 0.14);
    border: 1px solid rgba(255, 255, 255, 0.28);
    border-radius: 999px;
    backdrop-filter: blur(6px);
  }

  .scard__body {
    position: relative;
    z-index: 2;
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    transform: translateZ(30px);
  }
  .scard__icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    margin-bottom: 0.2rem;
    border-radius: 13px;
    color: #fff;
    background: color-mix(in srgb, var(--card-accent) 78%, transparent);
    box-shadow: 0 10px 22px -10px color-mix(in srgb, var(--card-accent) 90%, transparent);
    svg { width: 22px; height: 22px; }
  }
  .scard__title {
    font-family: var(--font-subtitle, 'Spartan Black', sans-serif);
    font-size: 1.3rem;
    font-weight: 700;
    letter-spacing: -0.01em;
    margin: 0;
    color: #fff;
  }
  .scard--feature .scard__title { font-size: clamp(1.5rem, 2.4vw, 2rem); }
  .scard__desc {
    margin: 0;
    font-size: 0.95rem;
    line-height: 1.6;
    color: rgba(241, 245, 249, 0.82);
    max-width: 44ch;
    max-height: 0;
    opacity: 0;
    overflow: hidden;
    transition: max-height 0.5s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.4s ease, margin 0.4s ease;
  }
  .scard--feature .scard__desc { max-height: 8rem; opacity: 1; }
  .scard:hover .scard__desc {
    max-height: 8rem;
    opacity: 1;
    margin-top: 0.1rem;
  }
  .scard__cta {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    margin-top: 0.4rem;
    font-size: 0.9rem;
    font-weight: 700;
    color: #fff;
  }
  .scard__arrow {
    width: 17px;
    height: 17px;
    transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  }
  .scard:hover .scard__arrow { transform: translateX(5px); }

  @media (max-width: 900px) {
    .services__grid { grid-template-columns: 1fr; }
    .scard { min-height: 300px; }
    .scard--feature,
    .scard:nth-child(2):last-child { grid-column: auto; grid-row: auto; }
    .scard__desc { max-height: 8rem; opacity: 1; } // reveal on touch
  }

  @media (max-width: 640px) {
    .services { padding: 3.5rem 0 4rem; }
    .services__inner { padding: 0 1.1rem; }
  }

  @media (prefers-reduced-motion: reduce) {
    .scard, .scard__media img, .scard__desc, .scard__arrow { transition: none; }
    .scard:hover .scard__media img,
    .scard:focus-visible .scard__media img { transform: scale(1.08); }
    .scard:hover .scard__arrow,
    .scard:focus-visible .scard__arrow { transform: none; }
  }
</style>