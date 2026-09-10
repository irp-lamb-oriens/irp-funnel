<script lang="ts">
  import Header from '../../components/Header/Header.svelte';
  import Footer from '../../components/Footer/Footer.svelte';
  import ServiceIntakeForm from '../../components/ServiceIntakeForm.svelte';
  import { onMount, onDestroy } from 'svelte';
  import { initLanding, type LandingCleanup } from '$lib/animations/landing';

  type TourWeek = { start: string; end: string };

  let enabled = false;
  let label = 'Private Relocation Experience';
  let priceNote = '';
  let weeks: TourWeek[] = [];
  let loading = true;
  let error = '';

  let root: HTMLElement;
  let cleanup: LandingCleanup | null = null;

  const apiBase = () =>
    typeof window !== 'undefined' && window.location.origin.startsWith('http://localhost')
      ? 'http://localhost:8000'
      : 'https://irp-funnel-server.onrender.com';

  async function loadWeeks() {
    loading = true;
    error = '';
    try {
      const res = await fetch(`${apiBase()}/api/tour-weeks`);
      if (!res.ok) throw new Error('Unable to load tour availability.');
      const data = await res.json();
      enabled = !!data.enabled;
      label = data.label || 'Private Relocation Experience';
      priceNote = data.priceNote || '';
      weeks = Array.isArray(data.weeks) ? data.weeks : [];
    } catch (e: any) {
      error = e?.message ?? 'Unable to load tour availability.';
    } finally {
      loading = false;
    }
  }

  function fmtWeek(w: TourWeek): string {
    const s = new Date(`${w.start}T00:00:00`);
    const e = new Date(`${w.end}T00:00:00`);
    const opts: Intl.DateTimeFormatOptions = { month: 'long', day: 'numeric' };
    return `${s.toLocaleDateString('en-US', opts)} – ${e.toLocaleDateString('en-US', opts)}`;
  }

  const realities = [
    {
      n: '01',
      title: 'Choosing the wrong region',
      body: 'Costa Rica is small on a map. It does not feel small when you live here. We test the region that fits your life: healthcare, schools, climate, distance, daily services.',
      image:
        'https://images.pexels.com/photos/1006965/pexels-photo-1006965.jpeg?auto=compress&cs=tinysrgb&w=900'
    },
    {
      n: '02',
      title: 'Buying the wrong property',
      body: 'Access problems, water, road conditions, flooding, resale difficulty. A private scouting experience costs a fraction of one wrong purchase.',
      image:
        'https://images.pexels.com/photos/280222/pexels-photo-280222.jpeg?auto=compress&cs=tinysrgb&w=900'
    },
    {
      n: '03',
      title: "A residency plan that doesn't hold",
      body: 'Misunderstood categories, missing documentation, timelines longer than expected. We surface this before your belongings are on the way.',
      image:
        'https://images.pexels.com/photos/4386366/pexels-photo-4386366.jpeg?auto=compress&cs=tinysrgb&w=900'
    }
  ];

  const regions = [
    { name: 'Central Valley & West', towns: 'San José, Escazú, Santa Ana, Heredia, Grecia, San Ramón', image: 'https://images.pexels.com/photos/2382681/pexels-photo-2382681.jpeg?auto=compress&cs=tinysrgb&w=900' },
    { name: 'Arenal & Northern Highlands', towns: 'Grecia, San Carlos, La Fortuna, Lake Arenal, Tilarán', image: 'https://images.pexels.com/photos/2662116/pexels-photo-2662116.jpeg?auto=compress&cs=tinysrgb&w=900' },
    { name: 'Central Pacific & Southern Zone', towns: 'Atenas, Jacó, Quepos, Dominical, Uvita, Ojochal', image: 'https://images.pexels.com/photos/1174732/pexels-photo-1174732.jpeg?auto=compress&cs=tinysrgb&w=900' },
    { name: 'Guanacaste', towns: 'Sámara, Avellanas, Tamarindo, Conchal, Potrero, Coco, Liberia', image: 'https://images.pexels.com/photos/1450353/pexels-photo-1450353.jpeg?auto=compress&cs=tinysrgb&w=900' },
    { name: 'Costa Rica vs. Panama', towns: 'Southern Zone, David, Boquete, Panama City. Compare before you choose.', image: 'https://images.pexels.com/photos/338504/pexels-photo-338504.jpeg?auto=compress&cs=tinysrgb&w=900' }
  ];

  const promises = [
    { k: 'One couple only', v: 'No group bus, no real estate sales pitch, no scripted itinerary.' },
    { k: 'Built around one question', v: '"Is this really the right move for me?"' },
    { k: 'One experience a month', v: "Twelve private experiences a year. When the dates are gone, they're gone." }
  ];

  const marquee = ['Healthcare', 'Schools', 'Climate', 'Cost of living', 'Residency', 'Community', 'Safety', 'Daily reality'];

  onMount(async () => {
    await loadWeeks();
    cleanup = await initLanding(root);
  });
  onDestroy(() => cleanup?.());
</script>

<Header />

<main class="tour" bind:this={root}>
  <!-- ── HERO ─────────────────────────────────────────────────────────── -->
  <section class="tour__hero">
    <div class="tour__hero-media" aria-hidden="true">
      <img
        data-parallax="0.2"
        src="https://images.pexels.com/photos/2166553/pexels-photo-2166553.jpeg?auto=compress&cs=tinysrgb&w=1800"
        alt=""
      />
      <span class="tour__hero-scrim"></span>
    </div>
    <div class="tour__hero-inner">
      <p class="tour__eyebrow" data-animate="up">Private relocation experience</p>
      <h1 class="tour__title" data-animate="up" data-animate-delay="0.05">
        It's not a tour. It's a reality check before you move.
      </h1>
      <p class="tour__sub" data-animate="up" data-animate-delay="0.12">
        Before you buy property, ship your belongings, import a car, enroll your
        kids, or commit your savings, spend a few private days understanding what
        your real life in Costa Rica or Panama would actually look like.
      </p>
      <div class="tour__hero-ctas" data-animate="up" data-animate-delay="0.18">
        <a class="tour__btn tour__btn--primary" href="#book" data-magnetic>Book a private experience</a>
        <a class="tour__btn tour__btn--ghost" href="/consultation" data-magnetic data-magnetic-strength="0.25">Book a discovery call instead</a>
      </div>
    </div>
  </section>

  <!-- ── KINETIC MARQUEE ──────────────────────────────────────────────── -->
  <div class="tour__marquee" data-marquee aria-hidden="true">
    <div class="tour__marquee-track">
      {#each [...marquee, ...marquee] as m}
        <span class="tour__marquee-item">{m}<i>◆</i></span>
      {/each}
    </div>
  </div>

  <!-- ── PROMISE ──────────────────────────────────────────────────────── -->
  <section class="tour__promise">
    <div class="tour__promise-grid">
      {#each promises as p (p.k)}
        <div class="tour__promise-item" data-animate="up">
          <strong>{p.k}</strong>
          <span>{p.v}</span>
        </div>
      {/each}
    </div>
  </section>

  <!-- ── REALITY ──────────────────────────────────────────────────────── -->
  <section class="tour__reality">
    <div class="tour__reality-inner">
      <h2 class="tour__h2" data-animate="up">Most relocation mistakes don't look like mistakes at first.</h2>
      <p class="tour__lead" data-animate="up" data-animate-delay="0.06">
        The house looks beautiful. The beach feels perfect. The realtor is
        enthusiastic. Then you actually move, and six months later you discover
        the questions you should have asked before you came.
      </p>
      <div class="tour__reality-grid">
        {#each realities as r (r.n)}
          <article class="rcard" data-animate="scale" data-tilt>
            <span class="rcard__media" aria-hidden="true">
              <img src={r.image} alt="" loading="lazy" />
            </span>
            <span class="rcard__num">{r.n}</span>
            <div class="rcard__body">
              <h3>{r.title}</h3>
              <p>{r.body}</p>
            </div>
          </article>
        {/each}
      </div>
    </div>
  </section>

  <!-- ── REGIONS ──────────────────────────────────────────────────────── -->
  <section class="tour__regions">
    <div class="tour__regions-inner">
      <h2 class="tour__h2" data-animate="up">Choose the version you want to test.</h2>
      <div class="tour__regions-grid">
        {#each regions as region, i (region.name)}
          <div
            class="region"
            class:region--wide={i === 0 || i === 3}
            data-animate="up"
            data-animate-delay={`${(i % 3) * 0.05}`}
            data-tilt
          >
            <span class="region__media" aria-hidden="true">
              <img src={region.image} alt="" loading="lazy" />
              <span class="region__scrim"></span>
            </span>
            <div class="region__body">
              <h3>{region.name}</h3>
              <p>{region.towns}</p>
            </div>
          </div>
        {/each}
      </div>
    </div>
  </section>

  <!-- ── BOOK ─────────────────────────────────────────────────────────── -->
  <section id="book" class="tour__book">
    <div class="tour__book-inner">
      <h2 class="tour__h2 tour__h2--light" data-animate="up">Book your {label}</h2>

      {#if loading}
        <p class="tour__book-note">Loading available weeks…</p>
      {:else if error}
        <p class="tour__book-note tour__book-note--error">{error}</p>
      {:else if !enabled}
        <p class="tour__book-note" data-animate="up">
          Tours are not open for booking right now. Leave your details and we'll
          tell you about the next available experience.
        </p>
        <div class="tour__book-form">
          <ServiceIntakeForm serviceType="relocation_tour" />
        </div>
      {:else if weeks.length === 0}
        <p class="tour__book-note">No upcoming weeks are published yet.</p>
      {:else}
        <p class="tour__book-note" data-animate="up">
          Select one of the available weeks below. Each experience runs within a
          single week, accepted once, for one person or one couple.
        </p>
        <div class="tour__weeks">
          {#each weeks as w (w.start)}
            <a
              class="tour__week"
              href={`/consultation?service=relocation_tour&week=${w.start}`}
              data-animate="up"
              data-tilt
            >
              <span class="tour__week-dates">{fmtWeek(w)}</span>
              <span class="tour__week-cta">Reserve this week
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M5 12h14M13 6l6 6-6 6" stroke-linecap="round" stroke-linejoin="round"/></svg>
              </span>
            </a>
          {/each}
        </div>
        {#if priceNote}
          <p class="tour__book-note tour__book-note--price">{priceNote}</p>
        {/if}
      {/if}
    </div>
  </section>
</main>

<Footer />

<style lang="scss">
  .tour {
    color: #1a1a2e;
    font-family: var(--font-paragraph, 'Jost'), system-ui, sans-serif;
    background: #fff;
    overflow: hidden;
  }

  /* ── HERO ─────────────────────────────────────────────────────────── */
  .tour__hero {
    position: relative;
    display: flex;
    align-items: flex-end;
    min-height: 100dvh;
    padding: 6rem 2rem 4.5rem;
    color: #f1f5f9;
    isolation: isolate;
  }
  .tour__hero-media {
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
  .tour__hero-scrim {
    position: absolute;
    inset: 0;
    background:
      radial-gradient(1200px 600px at 82% 8%, rgba(var(--color-highlight-2-rgb), 0.28), transparent 55%),
      linear-gradient(180deg, rgba(15, 23, 42, 0.35) 0%, rgba(15, 23, 42, 0.78) 70%, rgba(15, 23, 42, 0.94) 100%);
  }
  .tour__hero-inner {
    max-width: 1000px;
    margin: 0 auto;
    width: 100%;
  }
  .tour__eyebrow {
    margin: 0 0 1rem;
    font-size: 0.78rem;
    font-weight: 700;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: var(--color-highlight-2, #02b5bb);
  }
  .tour__title {
    font-family: var(--font-title, 'Kiona Regular', serif);
    font-size: clamp(2.2rem, 6vw, 4.2rem);
    line-height: 1.02;
    font-weight: 700;
    letter-spacing: -0.02em;
    margin: 0 0 1.4rem;
    max-width: 18ch;
    color: #fff;
    text-shadow: 0 2px 30px rgba(0, 0, 0, 0.3);
  }
  .tour__sub {
    font-size: 1.15rem;
    line-height: 1.65;
    color: #dbe4ee;
    max-width: 60ch;
    margin: 0 0 2rem;
  }
  .tour__hero-ctas {
    display: flex;
    flex-wrap: wrap;
    gap: 0.9rem;
  }

  .tour__btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0.95rem 1.8rem;
    border-radius: 14px;
    font-weight: 700;
    font-size: 0.98rem;
    text-decoration: none;
    will-change: transform;
  }
  .tour__btn--primary {
    background: linear-gradient(135deg, #02b5bb 0%, #02999e 100%);
    color: #fff;
    box-shadow: 0 16px 34px -12px rgba(2, 181, 187, 0.6);
  }
  .tour__btn--primary:hover { filter: brightness(1.07); }
  .tour__btn--ghost {
    background: rgba(255, 255, 255, 0.08);
    color: #eef4f8;
    border: 1px solid rgba(255, 255, 255, 0.28);
    backdrop-filter: blur(8px);
  }
  .tour__btn--ghost:hover { background: rgba(255, 255, 255, 0.14); }

  /* ── MARQUEE ──────────────────────────────────────────────────────── */
  .tour__marquee {
    overflow: hidden;
    background: var(--color-foreground, #181818);
    padding: 0.9rem 0;
    white-space: nowrap;
  }
  .tour__marquee-track {
    display: inline-flex;
    gap: 2.4rem;
    will-change: transform;
  }
  .tour__marquee-item {
    display: inline-flex;
    align-items: center;
    gap: 2.4rem;
    font-family: var(--font-subtitle, 'Spartan Black', sans-serif);
    font-size: 1rem;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: #f1f5f9;
    i { color: var(--color-highlight-2, #02b5bb); font-style: normal; }
  }

  /* ── PROMISE ──────────────────────────────────────────────────────── */
  .tour__promise {
    padding: 4rem 2rem;
    background: #f8fafc;
    border-bottom: 1px solid #eef2f6;
  }
  .tour__promise-grid {
    max-width: 1000px;
    margin: 0 auto;
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 2rem;
  }
  .tour__promise-item {
    display: flex;
    flex-direction: column;
    gap: 0.55rem;
    padding-left: 1.1rem;
    border-left: 3px solid var(--color-highlight-2, #02b5bb);
    strong {
      font-family: var(--font-subtitle, 'Spartan Black', sans-serif);
      font-size: 1.1rem;
      color: #0f172a;
    }
    span { color: #64748b; line-height: 1.55; }
  }

  /* ── SECTIONS ─────────────────────────────────────────────────────── */
  .tour__reality,
  .tour__regions {
    padding: 5.5rem 2rem;
  }
  .tour__reality-inner,
  .tour__regions-inner,
  .tour__book-inner {
    max-width: 1100px;
    margin: 0 auto;
  }
  .tour__h2 {
    font-family: var(--font-title, 'Kiona Regular', serif);
    font-size: clamp(1.8rem, 3.4vw, 2.7rem);
    font-weight: 700;
    letter-spacing: -0.02em;
    line-height: 1.08;
    color: var(--color-foreground, #181818);
    margin: 0 0 1rem;
    max-width: 22ch;
  }
  .tour__h2--light { color: #fff; }
  .tour__lead {
    font-size: 1.1rem;
    line-height: 1.65;
    color: #475569;
    max-width: 62ch;
    margin: 0 0 2.5rem;
  }

  /* ── REALITY CARDS ────────────────────────────────────────────────── */
  .tour__reality-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1.25rem;
  }
  .rcard {
    position: relative;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    min-height: 380px;
    padding: 1.6rem;
    border-radius: 20px;
    overflow: hidden;
    isolation: isolate;
    color: #fff;
    background: #0f172a;
    box-shadow: 0 26px 54px -30px rgba(15, 23, 42, 0.55);
    transform-style: preserve-3d;
    will-change: transform;
  }
  .rcard__media {
    position: absolute;
    inset: 0;
    z-index: -1;
    &::after {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(180deg, rgba(15, 23, 42, 0.1) 0%, rgba(15, 23, 42, 0.72) 60%, rgba(15, 23, 42, 0.95) 100%);
    }
    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      transform: scale(1.06);
      transition: transform 0.9s cubic-bezier(0.16, 1, 0.3, 1);
    }
  }
  .rcard:hover .rcard__media img { transform: scale(1.12); }
  .rcard__num {
    position: absolute;
    top: 1.1rem;
    right: 1.3rem;
    font-family: var(--font-subtitle, 'Spartan Black', sans-serif);
    font-size: 2.4rem;
    line-height: 1;
    color: rgba(255, 255, 255, 0.22);
  }
  .rcard__body {
    transform: translateZ(28px);
    h3 {
      margin: 0 0 0.5rem;
      font-family: var(--font-subtitle, 'Spartan Black', sans-serif);
      font-size: 1.18rem;
      font-weight: 700;
      color: #fff;
    }
    p { margin: 0; color: rgba(226, 232, 240, 0.85); line-height: 1.55; font-size: 0.94rem; }
  }

  /* ── REGIONS (image bento) ────────────────────────────────────────── */
  .tour__regions {
    background: linear-gradient(180deg, #f8fafc 0%, #ffffff 100%);
    border-top: 1px solid #eef2f6;
  }
  .tour__regions-grid {
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    gap: 1rem;
    margin-top: 2rem;
  }
  .region {
    position: relative;
    grid-column: span 2;
    min-height: 220px;
    border-radius: 18px;
    overflow: hidden;
    isolation: isolate;
    color: #fff;
    background: #0f172a;
    box-shadow: 0 22px 46px -28px rgba(15, 23, 42, 0.5);
    transform-style: preserve-3d;
    will-change: transform;
  }
  .region--wide { grid-column: span 3; }
  .region__media {
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
  .region:hover .region__media img { transform: scale(1.11); }
  .region__scrim {
    position: absolute;
    inset: 0;
    background: linear-gradient(180deg, rgba(15, 23, 42, 0.05) 0%, rgba(15, 23, 42, 0.72) 62%, rgba(15, 23, 42, 0.92) 100%);
  }
  .region__body {
    position: absolute;
    inset: auto 0 0 0;
    padding: 1.3rem 1.4rem;
    transform: translateZ(24px);
    h3 {
      margin: 0 0 0.25rem;
      font-family: var(--font-subtitle, 'Spartan Black', sans-serif);
      font-size: 1.02rem;
      font-weight: 700;
      color: #fff;
    }
    p { margin: 0; font-size: 0.85rem; line-height: 1.45; color: rgba(226, 232, 240, 0.82); }
  }

  /* ── BOOK ─────────────────────────────────────────────────────────── */
  .tour__book {
    position: relative;
    padding: 5.5rem 2rem 6rem;
    background:
      radial-gradient(900px 500px at 20% 0%, rgba(var(--color-highlight-2-rgb), 0.2), transparent 60%),
      #0f172a;
    color: #f1f5f9;
  }
  .tour__book-note {
    color: #cbd5e1;
    line-height: 1.6;
    max-width: 60ch;
    margin: 0 0 1.6rem;
  }
  .tour__book-note--error { color: #fda4a4; }
  .tour__book-form {
    margin-top: 1.5rem;
    padding: 2rem;
    border-radius: 1.5rem;
    background: rgba(15, 23, 42, 0.55);
    border: 1px solid rgba(255, 255, 255, 0.08);
    backdrop-filter: blur(10px);
  }
  .tour__book-note--price {
    margin-top: 1.6rem;
    font-weight: 600;
    color: #f1f5f9;
  }
  .tour__weeks {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 0.9rem;
  }
  .tour__week {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 1.25rem 1.5rem;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 16px;
    text-decoration: none;
    color: #fff;
    background: rgba(255, 255, 255, 0.04);
    backdrop-filter: blur(6px);
    transform-style: preserve-3d;
    will-change: transform;
    transition: border-color 0.25s, background 0.25s;
  }
  .tour__week:hover {
    border-color: rgba(var(--color-highlight-2-rgb), 0.6);
    background: rgba(var(--color-highlight-2-rgb), 0.1);
  }
  .tour__week-dates {
    font-family: var(--font-subtitle, 'Spartan Black', sans-serif);
    font-weight: 700;
    color: #fff;
  }
  .tour__week-cta {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    color: var(--color-highlight-2, #02b5bb);
    font-weight: 700;
    white-space: nowrap;
    svg { width: 16px; height: 16px; }
  }

  @media (max-width: 900px) {
    .tour__reality-grid { grid-template-columns: 1fr; }
    .region, .region--wide { grid-column: span 3; }
  }

  @media (max-width: 760px) {
    .tour__hero { min-height: 92dvh; padding: 5rem 1.3rem 3.5rem; }
    .tour__promise-grid,
    .tour__weeks { grid-template-columns: 1fr; }
    .tour__regions-grid { grid-template-columns: 1fr; }
    .region, .region--wide { grid-column: auto; }
    .tour__hero-ctas { flex-direction: column; align-items: stretch; }
    .tour__week { flex-direction: column; align-items: flex-start; }
  }

  @media (prefers-reduced-motion: reduce) {
    .rcard__media img, .region__media img { transition: none; }
  }
</style>