<script lang="ts">
  import Header from '../../components/Header/Header.svelte';
  import Footer from '../../components/Footer/Footer.svelte';
  import { onMount } from 'svelte';

  type TourWeek = { start: string; end: string };

  let enabled = false;
  let label = 'Private Relocation Experience';
  let priceNote = '';
  let weeks: TourWeek[] = [];
  let loading = true;
  let error = '';

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

  onMount(loadWeeks);
</script>

<Header />

<main class="tour">
  <section class="tour__hero">
    <div class="tour__hero-inner">
      <p class="tour__eyebrow">Private relocation experience</p>
      <h1 class="tour__title">It's not a tour. It's a reality check before you move.</h1>
      <p class="tour__sub">
        Before you buy property, ship your belongings, import a car, enroll your
        kids, or commit your savings, spend a few private days understanding what
        your real life in Costa Rica or Panama would actually look like.
      </p>
      <div class="tour__hero-ctas">
        <a class="tour__btn tour__btn--primary" href="#book">Book a private experience</a>
        <a class="tour__btn tour__btn--ghost" href="/consultation">Book a discovery call instead</a>
      </div>
    </div>
  </section>

  <section class="tour__promise">
    <div class="tour__promise-grid">
      <div class="tour__promise-item">
        <strong>One person or one couple only.</strong>
        <span>No group bus, no real estate sales pitch, no scripted itinerary.</span>
      </div>
      <div class="tour__promise-item">
        <strong>Built around one question.</strong>
        <span>"Is this really the right move for me?"</span>
      </div>
      <div class="tour__promise-item">
        <strong>One experience accepted each month.</strong>
        <span>Twelve private experiences a year. When the dates are gone, they're gone.</span>
      </div>
    </div>
  </section>

  <section class="tour__reality">
    <div class="tour__reality-inner">
      <h2 class="tour__h2">Most relocation mistakes don't look like mistakes at first.</h2>
      <p class="tour__lead">
        The house looks beautiful. The beach feels perfect. The realtor is
        enthusiastic. Then you actually move, and six months later you discover
        the questions you should have asked before you came.
      </p>
      <div class="tour__reality-grid">
        <div class="tour__reality-card">
          <h3>Choosing the wrong region</h3>
          <p>
            Costa Rica is small on a map. It does not feel small when you're
            living here. We test the region that would actually fit your life:
            healthcare, schools, climate, distance, daily services.
          </p>
        </div>
        <div class="tour__reality-card">
          <h3>Buying the wrong property</h3>
          <p>
            Access problems, water, road conditions, flooding, resale difficulty.
            A private scouting experience costs a fraction of one wrong purchase.
          </p>
        </div>
        <div class="tour__reality-card">
          <h3>A residency plan that doesn't hold</h3>
          <p>
            Misunderstood categories, missing documentation, timelines longer
            than expected. We surface this before your belongings are on the way.
          </p>
        </div>
      </div>
    </div>
  </section>

  <section class="tour__regions">
    <div class="tour__regions-inner">
      <h2 class="tour__h2">Choose the version you want to test.</h2>
      <div class="tour__regions-grid">
        <div class="tour__region">
          <h3>Central Valley & West</h3>
          <p>San José, Escazú, Santa Ana, Heredia, Grecia, San Ramón</p>
        </div>
        <div class="tour__region">
          <h3>Arenal & Northern Highlands</h3>
          <p>Grecia, San Carlos, La Fortuna, Lake Arenal, Tilarán</p>
        </div>
        <div class="tour__region">
          <h3>Central Pacific & Southern Zone</h3>
          <p>Atenas, Jacó, Quepos, Dominical, Uvita, Ojochal, San Vito</p>
        </div>
        <div class="tour__region">
          <h3>Guanacaste</h3>
          <p>Sámara, Avellanas, Tamarindo, Conchal, Potrero, Coco, Liberia</p>
        </div>
        <div class="tour__region">
          <h3>Costa Rica vs. Panama</h3>
          <p>Southern Zone, David, Boquete, Panama City. Compare before you choose.</p>
        </div>
      </div>
    </div>
  </section>

  <section id="book" class="tour__book">
    <div class="tour__book-inner">
      <h2 class="tour__h2">Book your {label}</h2>

      {#if loading}
        <p class="tour__book-note">Loading available weeks…</p>
      {:else if error}
        <p class="tour__book-note tour__book-note--error">{error}</p>
      {:else if !enabled}
        <p class="tour__book-note">
          Tours are not open for booking right now. Book a discovery call and
          we'll tell you about the next available experience.
        </p>
        <a class="tour__btn tour__btn--primary" href="/consultation">Book a discovery call</a>
      {:else if weeks.length === 0}
        <p class="tour__book-note">No upcoming weeks are published yet.</p>
      {:else}
        <p class="tour__book-note">
          Select one of the available weeks below. Each experience runs within a
          single week, accepted once, for one person or one couple.
        </p>
        <div class="tour__weeks">
          {#each weeks as w (w.start)}
            <a class="tour__week" href={`/consultation?service=relocation_tour&week=${w.start}`}>
              <span class="tour__week-dates">{fmtWeek(w)}</span>
              <span class="tour__week-cta">Reserve this week</span>
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
  }

  .tour__hero {
    padding: 5.5rem 2rem 4rem;
    background:
      radial-gradient(1200px 500px at 80% -10%, rgba(2, 181, 187, 0.12), transparent 60%),
      #0f172a;
    color: #f1f5f9;
  }
  .tour__hero-inner {
    max-width: 1000px;
    margin: 0 auto;
  }
  .tour__eyebrow {
    margin: 0 0 1rem;
    font-size: 0.78rem;
    font-weight: 700;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--color-highlight-2, #02b5bb);
  }
  .tour__title {
    font-family: var(--font-title, 'Kiona Regular', serif);
    font-size: clamp(1.9rem, 4.5vw, 3rem);
    line-height: 1.08;
    font-weight: 700;
    letter-spacing: -0.01em;
    margin: 0 0 1.4rem;
    max-width: 20ch;
    color: #f1f5f9;
  }
  .tour__sub {
    font-size: 1.15rem;
    line-height: 1.65;
    color: #cbd5e1;
    max-width: 62ch;
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
    padding: 0.85rem 1.6rem;
    border-radius: 12px;
    font-weight: 700;
    font-size: 0.95rem;
    text-decoration: none;
    transition: transform 0.15s, filter 0.15s;
  }
  .tour__btn:active { transform: translateY(1px) scale(0.99); }
  .tour__btn--primary {
    background: linear-gradient(135deg, #02b5bb 0%, #02999e 100%);
    color: #fff;
    box-shadow: 0 10px 24px -8px rgba(2, 181, 187, 0.5);
  }
  .tour__btn--primary:hover { filter: brightness(1.06); }
  .tour__btn--ghost {
    background: transparent;
    color: #e2e8f0;
    border: 1px solid rgba(255, 255, 255, 0.22);
  }
  .tour__btn--ghost:hover { background: rgba(255, 255, 255, 0.06); }

  .tour__promise {
    padding: 3.5rem 2rem;
    background: #f8fafc;
    border-bottom: 1px solid #eef2f6;
  }
  .tour__promise-grid {
    max-width: 1000px;
    margin: 0 auto;
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1.4rem;
  }
  .tour__promise-item {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .tour__promise-item strong {
    font-size: 1.1rem;
    color: #0f172a;
  }
  .tour__promise-item span {
    color: #64748b;
    line-height: 1.55;
  }

  .tour__reality,
  .tour__regions,
  .tour__book {
    padding: 4.5rem 2rem;
  }
  .tour__reality-inner,
  .tour__regions-inner,
  .tour__book-inner {
    max-width: 1000px;
    margin: 0 auto;
  }
  .tour__h2 {
    font-family: var(--font-title, 'Kiona Regular', serif);
    font-size: clamp(1.6rem, 3vw, 2.3rem);
    font-weight: 700;
    letter-spacing: -0.01em;
    color: var(--color-foreground, #181818);
    margin: 0 0 1rem;
  }
  .tour__lead {
    font-size: 1.08rem;
    line-height: 1.65;
    color: #475569;
    max-width: 62ch;
    margin: 0 0 2.25rem;
  }
  .tour__reality-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1.25rem;
  }
  .tour__reality-card {
    background: #fff;
    border: 1px solid #eef2f6;
    border-radius: 16px;
    padding: 1.5rem;
    box-shadow: 0 14px 32px -18px rgba(0, 0, 0, 0.14);
  }
  .tour__reality-card h3 {
    margin: 0 0 0.6rem;
    font-family: var(--font-subtitle, 'Spartan Black', sans-serif);
    font-size: 1rem;
    font-weight: 700;
    color: var(--color-foreground, #181818);
  }
  .tour__reality-card p {
    margin: 0;
    color: #64748b;
    line-height: 1.6;
    font-size: 0.95rem;
  }

  .tour__regions {
    background: #f8fafc;
    border-top: 1px solid #eef2f6;
  }
  .tour__regions-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 1rem;
  }
  .tour__region {
    background: #fff;
    border: 1px solid #eef2f6;
    border-radius: 14px;
    padding: 1.25rem 1.4rem;
  }
  .tour__region h3 {
    margin: 0 0 0.35rem;
    font-family: var(--font-subtitle, 'Spartan Black', sans-serif);
    color: var(--color-foreground, #181818);
    font-size: 0.98rem;
    font-weight: 700;
  }
  .tour__region p {
    margin: 0;
    color: #64748b;
    font-size: 0.9rem;
    line-height: 1.5;
  }

  .tour__book-note {
    color: #475569;
    line-height: 1.6;
    max-width: 60ch;
    margin: 0 0 1.5rem;
  }
  .tour__book-note--error { color: #c62426; }
  .tour__book-note--price {
    margin-top: 1.5rem;
    font-weight: 600;
    color: #0f172a;
  }
  .tour__weeks {
    display: flex;
    flex-direction: column;
    gap: 0.8rem;
  }
  .tour__week {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 1.1rem 1.4rem;
    border: 1px solid #eef2f6;
    border-radius: 14px;
    text-decoration: none;
    color: inherit;
    background: #fff;
    transition: border-color 0.2s, transform 0.15s, box-shadow 0.2s;
  }
  .tour__week:hover {
    border-color: rgba(2, 181, 187, 0.45);
    transform: translateY(-2px);
    box-shadow: 0 18px 36px -20px rgba(2, 181, 187, 0.35);
  }
  .tour__week-dates {
    font-weight: 700;
    color: #0f172a;
  }
  .tour__week-cta {
    color: #02b5bb;
    font-weight: 700;
    white-space: nowrap;
  }

  @media (max-width: 760px) {
    .tour__promise-grid,
    .tour__reality-grid,
    .tour__regions-grid {
      grid-template-columns: 1fr;
    }
    .tour__hero-ctas {
      flex-direction: column;
      align-items: flex-start;
    }
    .tour__week {
      flex-direction: column;
      align-items: flex-start;
    }
  }
</style>