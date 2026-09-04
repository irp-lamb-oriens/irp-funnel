<script lang="ts">
  import Header from '../../components/Header/Header.svelte';
  import Footer from '../../components/Footer/Footer.svelte';
  import { onMount, onDestroy } from 'svelte';
  import { initLanding, type LandingCleanup } from '$lib/animations/landing';

  const zones = [
    {
      name: 'Greater San José',
      towns: 'Escazú, Santa Ana, Heredia, Curridabat',
      note: 'City access, private hospitals, international schools, and a cooler mountain climate.',
      image: 'https://images.pexels.com/photos/2437291/pexels-photo-2437291.jpeg?auto=compress&cs=tinysrgb&w=900'
    },
    {
      name: 'Central Valley West',
      towns: 'Atenas, Grecia, San Ramón, Naranjo',
      note: 'Quieter, lower cost than Escazú, still within reach of the airport.',
      image: 'https://images.pexels.com/photos/2382681/pexels-photo-2382681.jpeg?auto=compress&cs=tinysrgb&w=900'
    },
    {
      name: 'Guanacaste coast',
      towns: 'Tamarindo, Avellanas, Conchal, Potrero, Coco',
      note: 'Beaches, strong international community, dry season and tourism cycles to plan around.',
      image: 'https://images.pexels.com/photos/1450353/pexels-photo-1450353.jpeg?auto=compress&cs=tinysrgb&w=900'
    },
    {
      name: 'Central & South Pacific',
      towns: 'Jacó, Quepos, Dominical, Uvita, Ojochal',
      note: 'Dramatically different communities; rainfall and access shift as you go south.',
      image: 'https://images.pexels.com/photos/1174732/pexels-photo-1174732.jpeg?auto=compress&cs=tinysrgb&w=900'
    },
    {
      name: 'Northern highlands',
      towns: 'La Fortuna, Lake Arenal, Tilarán',
      note: 'Volcano and lake lifestyle with real trade-offs for daily services and healthcare.',
      image: 'https://images.pexels.com/photos/2662116/pexels-photo-2662116.jpeg?auto=compress&cs=tinysrgb&w=900'
    }
  ];

  const checks = [
    { k: 'Access & roads', v: 'Year-round access, road condition, and the drive that looks fine online but not in October.' },
    { k: 'Water & utilities', v: 'Legal water source, reliability, power, and internet that actually supports your life.' },
    { k: 'Resale reality', v: 'How liquid the market is if your plans change, and what really drives value in that zone.' }
  ];

  const marquee = ['Water rights', 'Road access', 'Flood risk', 'School fit', 'Healthcare', 'Resale', 'Zoning', 'Climate'];

  let root: HTMLElement;
  let cleanup: LandingCleanup | null = null;

  onMount(async () => {
    cleanup = await initLanding(root);
  });
  onDestroy(() => cleanup?.());
</script>

<Header />

<main class="estate" bind:this={root}>
  <!-- ── HERO ─────────────────────────────────────────────────────────── -->
  <section class="estate__hero">
    <div class="estate__hero-media" aria-hidden="true">
      <img
        data-parallax="0.2"
        src="https://images.pexels.com/photos/1546168/pexels-photo-1546168.jpeg?auto=compress&cs=tinysrgb&w=1800"
        alt=""
      />
      <span class="estate__hero-scrim"></span>
    </div>
    <div class="estate__hero-inner">
      <p class="estate__eyebrow" data-animate="up">Real estate due diligence</p>
      <h1 class="estate__title" data-animate="up" data-animate-delay="0.05">
        We don't sell you a house. We investigate the zone before you commit.
      </h1>
      <p class="estate__sub" data-animate="up" data-animate-delay="0.12">
        Before you look at listings, understand which part of Costa Rica or Panama
        actually fits your daily life: schools, healthcare, climate, traffic, and
        what a normal Wednesday looks like there.
      </p>
      <a class="estate__btn" href="/consultation?service=real_estate" data-animate="up" data-animate-delay="0.18" data-magnetic>
        Book a due diligence call
      </a>
    </div>
  </section>

  <!-- ── MARQUEE ──────────────────────────────────────────────────────── -->
  <div class="estate__marquee" data-marquee aria-hidden="true">
    <div class="estate__marquee-track">
      {#each [...marquee, ...marquee] as m}
        <span class="estate__marquee-item">{m}<i>◆</i></span>
      {/each}
    </div>
  </div>

  <!-- ── CHECKS ───────────────────────────────────────────────────────── -->
  <section class="estate__checks">
    <div class="estate__checks-inner">
      <h2 class="estate__h2" data-animate="up">What we actually pull apart</h2>
      <p class="estate__lead" data-animate="up" data-animate-delay="0.06">
        The listing photos never show the problems. We look at the things that
        decide whether a place is a home or an expensive mistake.
      </p>
      <div class="estate__checks-grid">
        {#each checks as c, i (c.k)}
          <div class="ccard" data-animate="up" data-animate-delay={`${i * 0.05}`}>
            <span class="ccard__mark" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </span>
            <h3>{c.k}</h3>
            <p>{c.v}</p>
          </div>
        {/each}
      </div>
    </div>
  </section>

  <!-- ── ZONES ────────────────────────────────────────────────────────── -->
  <section class="estate__zones">
    <div class="estate__zones-inner">
      <h2 class="estate__h2" data-animate="up">The zones we map with you</h2>
      <div class="estate__zones-grid">
        {#each zones as z, i (z.name)}
          <div
            class="zone"
            class:zone--wide={i === 0 || i === 3}
            data-animate="scale"
            data-animate-delay={`${(i % 3) * 0.05}`}
            data-tilt
          >
            <span class="zone__media" aria-hidden="true">
              <img src={z.image} alt="" loading="lazy" />
              <span class="zone__scrim"></span>
            </span>
            <div class="zone__body">
              <h3 class="zone__name">{z.name}</h3>
              <p class="zone__towns">{z.towns}</p>
              <p class="zone__note">{z.note}</p>
            </div>
          </div>
        {/each}
      </div>
    </div>
  </section>

  <!-- ── CTA ──────────────────────────────────────────────────────────── -->
  <section class="estate__cta">
    <div class="estate__cta-inner">
      <h2 class="estate__h2 estate__h2--light" data-animate="up">
        The expensive mistake is choosing wrong, not asking first.
      </h2>
      <p class="estate__cta-sub" data-animate="up" data-animate-delay="0.06">
        A short advice call before you chase listings can save you from the wrong
        town, the wrong school, or a property you can't easily resell.
      </p>
      <a class="estate__btn" href="/consultation?service=real_estate" data-animate="up" data-animate-delay="0.1" data-magnetic>
        Book a due diligence call
      </a>
    </div>
  </section>
</main>

<Footer />

<style lang="scss">
  .estate {
    font-family: var(--font-paragraph, 'Jost'), system-ui, sans-serif;
    color: #1a1a2e;
    background: #fff;
    overflow: hidden;
  }

  /* ── HERO ─────────────────────────────────────────────────────────── */
  .estate__hero {
    position: relative;
    display: flex;
    align-items: flex-end;
    min-height: 100dvh;
    padding: 6rem 2rem 4.5rem;
    color: #f1f5f9;
    isolation: isolate;
  }
  .estate__hero-media {
    position: absolute;
    inset: 0;
    z-index: -1;
    overflow: hidden;
    background: #0f172a;
    img {
      position: absolute;
      inset: -12% 0;
      width: 100%;
      height: 124%;
      object-fit: cover;
      will-change: transform;
    }
  }
  .estate__hero-scrim {
    position: absolute;
    inset: 0;
    background:
      radial-gradient(1100px 560px at 12% 6%, rgba(var(--color-highlight-1-rgb), 0.32), transparent 55%),
      linear-gradient(180deg, rgba(15, 23, 42, 0.4) 0%, rgba(15, 23, 42, 0.8) 72%, rgba(15, 23, 42, 0.95) 100%);
  }
  .estate__hero-inner {
    max-width: 1000px;
    margin: 0 auto;
    width: 100%;
  }
  .estate__eyebrow {
    margin: 0 0 1rem;
    font-size: 0.78rem;
    font-weight: 700;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: var(--color-highlight-1, #c62426);
  }
  .estate__title {
    font-family: var(--font-title, 'Kiona Regular', serif);
    font-size: clamp(2.2rem, 6vw, 4.2rem);
    line-height: 1.02;
    font-weight: 700;
    letter-spacing: -0.02em;
    margin: 0 0 1.4rem;
    max-width: 20ch;
    color: #fff;
    text-shadow: 0 2px 30px rgba(0, 0, 0, 0.3);
  }
  .estate__sub {
    font-size: 1.15rem;
    line-height: 1.65;
    color: #dbe4ee;
    max-width: 60ch;
    margin: 0 0 2rem;
  }
  .estate__btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0.95rem 1.8rem;
    border-radius: 14px;
    font-weight: 700;
    font-size: 0.98rem;
    text-decoration: none;
    background: linear-gradient(135deg, var(--color-highlight-1, #c62426) 0%, #9f1d1e 100%);
    color: #fff;
    box-shadow: 0 16px 34px -12px rgba(var(--color-highlight-1-rgb), 0.6);
    will-change: transform;
  }
  .estate__btn:hover { filter: brightness(1.07); }

  /* ── MARQUEE ──────────────────────────────────────────────────────── */
  .estate__marquee {
    overflow: hidden;
    background: var(--color-foreground, #181818);
    padding: 0.9rem 0;
    white-space: nowrap;
  }
  .estate__marquee-track {
    display: inline-flex;
    gap: 2.4rem;
    will-change: transform;
  }
  .estate__marquee-item {
    display: inline-flex;
    align-items: center;
    gap: 2.4rem;
    font-family: var(--font-subtitle, 'Spartan Black', sans-serif);
    font-size: 1rem;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: #f1f5f9;
    i { color: var(--color-highlight-1, #c62426); font-style: normal; }
  }

  /* ── SECTIONS ─────────────────────────────────────────────────────── */
  .estate__checks,
  .estate__zones {
    padding: 5.5rem 2rem;
  }
  .estate__checks-inner,
  .estate__zones-inner,
  .estate__cta-inner {
    max-width: 1100px;
    margin: 0 auto;
  }
  .estate__h2 {
    font-family: var(--font-title, 'Kiona Regular', serif);
    font-size: clamp(1.8rem, 3.4vw, 2.7rem);
    font-weight: 700;
    letter-spacing: -0.02em;
    line-height: 1.08;
    color: var(--color-foreground, #181818);
    margin: 0 0 1rem;
    max-width: 24ch;
  }
  .estate__h2--light { color: #fff; }
  .estate__lead {
    font-size: 1.1rem;
    line-height: 1.65;
    color: #475569;
    max-width: 62ch;
    margin: 0 0 2.5rem;
  }

  /* ── CHECK CARDS ──────────────────────────────────────────────────── */
  .estate__checks-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1.25rem;
  }
  .ccard {
    padding: 1.6rem;
    border-radius: 18px;
    background: #fff;
    border: 1px solid #eef2f6;
    box-shadow: 0 18px 40px -26px rgba(0, 0, 0, 0.14);
    h3 {
      margin: 0.9rem 0 0.5rem;
      font-family: var(--font-subtitle, 'Spartan Black', sans-serif);
      font-size: 1.05rem;
      font-weight: 700;
      color: var(--color-foreground, #181818);
    }
    p { margin: 0; color: #64748b; line-height: 1.6; font-size: 0.94rem; }
  }
  .ccard__mark {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 42px;
    height: 42px;
    border-radius: 12px;
    color: var(--color-highlight-1, #c62426);
    background: rgba(var(--color-highlight-1-rgb), 0.1);
    svg { width: 22px; height: 22px; }
  }

  /* ── ZONE BENTO ───────────────────────────────────────────────────── */
  .estate__zones-grid {
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    gap: 1rem;
    margin-top: 2rem;
  }
  .zone {
    position: relative;
    grid-column: span 2;
    min-height: 260px;
    border-radius: 18px;
    overflow: hidden;
    isolation: isolate;
    color: #fff;
    background: #0f172a;
    box-shadow: 0 24px 50px -30px rgba(15, 23, 42, 0.5);
    transform-style: preserve-3d;
    will-change: transform;
  }
  .zone--wide { grid-column: span 3; }
  .zone__media {
    position: absolute;
    inset: 0;
    z-index: -1;
    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      transform: scale(1.05);
      transition: transform 0.9s cubic-bezier(0.16, 1, 0.3, 1);
    }
  }
  .zone:hover .zone__media img { transform: scale(1.11); }
  .zone__scrim {
    position: absolute;
    inset: 0;
    background:
      linear-gradient(180deg, rgba(15, 23, 42, 0.05) 0%, rgba(15, 23, 42, 0.72) 60%, rgba(15, 23, 42, 0.94) 100%),
      linear-gradient(90deg, rgba(var(--color-highlight-1-rgb), 0.28), transparent 55%);
  }
  .zone__body {
    position: absolute;
    inset: auto 0 0 0;
    padding: 1.4rem 1.5rem;
    transform: translateZ(26px);
  }
  .zone__name {
    margin: 0 0 0.3rem;
    font-family: var(--font-subtitle, 'Spartan Black', sans-serif);
    font-size: 1.1rem;
    font-weight: 700;
    color: #fff;
  }
  .zone__towns {
    margin: 0 0 0.5rem;
    font-size: 0.82rem;
    font-weight: 600;
    letter-spacing: 0.02em;
    color: #fca5a5;
  }
  .zone__note {
    margin: 0;
    color: rgba(226, 232, 240, 0.85);
    font-size: 0.9rem;
    line-height: 1.5;
    max-height: 0;
    opacity: 0;
    overflow: hidden;
    transition: max-height 0.5s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.4s ease;
  }
  .zone--wide .zone__note { max-height: 6rem; opacity: 1; }
  .zone:hover .zone__note { max-height: 6rem; opacity: 1; }

  /* ── CTA ──────────────────────────────────────────────────────────── */
  .estate__cta {
    position: relative;
    padding: 5.5rem 2rem 6rem;
    background:
      radial-gradient(900px 480px at 80% 0%, rgba(var(--color-highlight-1-rgb), 0.22), transparent 60%),
      #0f172a;
    color: #f1f5f9;
  }
  .estate__cta-sub {
    font-size: 1.1rem;
    line-height: 1.65;
    color: #cbd5e1;
    max-width: 60ch;
    margin: 0 0 2rem;
  }

  @media (max-width: 900px) {
    .estate__checks-grid { grid-template-columns: 1fr; }
    .zone, .zone--wide { grid-column: span 3; }
  }

  @media (max-width: 760px) {
    .estate__hero { min-height: 92dvh; padding: 5rem 1.3rem 3.5rem; }
    .estate__zones-grid { grid-template-columns: 1fr; }
    .zone, .zone--wide { grid-column: auto; }
    .zone__note { max-height: 6rem; opacity: 1; }
  }

  @media (prefers-reduced-motion: reduce) {
    .zone__media img, .zone__note { transition: none; }
  }
</style>