<script lang="ts">
  import Header from '../../components/Header/Header.svelte';
  import Footer from '../../components/Footer/Footer.svelte';

  const zones = [
    {
      name: 'Greater San José',
      towns: 'Escazú, Santa Ana, Heredia, Curridabat',
      note: 'City access, private hospitals, international schools, and a cooler mountain climate.',
    },
    {
      name: 'Central Valley West',
      towns: 'Atenas, Grecia, San Ramón, Naranjo',
      note: 'Quieter, lower cost than Escazú, still within reach of the airport.',
    },
    {
      name: 'Guanacaste coast',
      towns: 'Tamarindo, Avellanas, Conchal, Potrero, Coco',
      note: 'Beaches, strong international community, dry season and tourism cycles to plan around.',
    },
    {
      name: 'Central & South Pacific',
      towns: 'Jacó, Quepos, Dominical, Uvita, Ojochal',
      note: 'Dramatically different communities; rainfall and access shift as you go south.',
    },
    {
      name: 'Northern highlands',
      towns: 'La Fortuna, Lake Arenal, Tilarán',
      note: 'Volcano and lake lifestyle with real trade-offs for daily services and healthcare.',
    },
  ];
</script>

<Header />

<main class="estate">
  <section class="estate__hero">
    <div class="estate__hero-inner">
      <p class="estate__eyebrow">Real estate due diligence</p>
      <h1 class="estate__title">We don't sell you a house. We investigate the zone before you commit.</h1>
      <p class="estate__sub">
        Before you look at listings, understand which part of Costa Rica or Panama
        actually fits your daily life: schools, healthcare, climate, traffic, and
        what a normal Wednesday looks like there.
      </p>
      <a class="estate__btn" href="/consultation?service=real_estate">Book a due diligence call</a>
    </div>
  </section>

  <section class="estate__zones">
    <div class="estate__zones-inner">
      <h2 class="estate__h2">The zones we map with you</h2>
      <div class="estate__zones-grid">
        {#each zones as z (z.name)}
          <div class="estate-card">
            <h3 class="estate-card__name">{z.name}</h3>
            <p class="estate-card__towns">{z.towns}</p>
            <p class="estate-card__note">{z.note}</p>
          </div>
        {/each}
      </div>
    </div>
  </section>

  <section class="estate__cta">
    <div class="estate__cta-inner">
      <h2 class="estate__h2">The expensive mistake is choosing wrong, not asking first.</h2>
      <p class="estate__cta-sub">
        A short advice call before you chase listings can save you from the wrong
        town, the wrong school, or a property you can't easily resell.
      </p>
      <a class="estate__btn" href="/consultation?service=real_estate">Book a due diligence call</a>
    </div>
  </section>
</main>

<Footer />

<style lang="scss">
  .estate {
    font-family: var(--font-paragraph, 'Jost'), system-ui, sans-serif;
    color: #1a1a2e;
    background: #fff;
  }

  .estate__hero {
    padding: 5.5rem 2rem 4rem;
    background:
      radial-gradient(1000px 480px at 15% -10%, rgba(198, 36, 38, 0.14), transparent 60%),
      #0f172a;
    color: #f1f5f9;
  }
  .estate__hero-inner,
  .estate__zones-inner,
  .estate__cta-inner {
    max-width: 1000px;
    margin: 0 auto;
  }
  .estate__eyebrow {
    margin: 0 0 1rem;
    font-size: 0.78rem;
    font-weight: 700;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: #f87171;
  }
  .estate__title {
    font-size: clamp(2rem, 4.5vw, 3.4rem);
    line-height: 1.05;
    font-weight: 900;
    letter-spacing: -0.02em;
    margin: 0 0 1.4rem;
    max-width: 20ch;
  }
  .estate__sub {
    font-size: 1.15rem;
    line-height: 1.65;
    color: #cbd5e1;
    max-width: 62ch;
    margin: 0 0 2rem;
  }
  .estate__btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0.85rem 1.6rem;
    border-radius: 12px;
    font-weight: 700;
    font-size: 0.95rem;
    text-decoration: none;
    background: linear-gradient(135deg, #e11d48 0%, #be123c 100%);
    color: #fff;
    box-shadow: 0 10px 24px -8px rgba(225, 29, 72, 0.5);
    transition: filter 0.15s, transform 0.15s;
  }
  .estate__btn:hover { filter: brightness(1.06); }
  .estate__btn:active { transform: translateY(1px) scale(0.99); }

  .estate__zones {
    padding: 4.5rem 2rem;
  }
  .estate__cta {
    padding: 4.5rem 2rem 5rem;
    background: #f8fafc;
    border-top: 1px solid #eef2f6;
    text-align: left;
  }
  .estate__h2 {
    font-size: clamp(1.6rem, 3vw, 2.3rem);
    font-weight: 900;
    letter-spacing: -0.02em;
    color: #111827;
    margin: 0 0 1rem;
  }
  .estate__cta-sub {
    font-size: 1.08rem;
    line-height: 1.65;
    color: #475569;
    max-width: 60ch;
    margin: 0 0 2rem;
  }
  .estate__zones-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 1rem;
    margin-top: 2rem;
  }
  .estate-card {
    background: #fff;
    border: 1px solid #eef2f6;
    border-radius: 14px;
    padding: 1.3rem 1.4rem;
    box-shadow: 0 14px 32px -18px rgba(0, 0, 0, 0.1);
  }
  .estate-card__name {
    margin: 0 0 0.35rem;
    font-size: 1.05rem;
    color: #0f172a;
  }
  .estate-card__towns {
    margin: 0 0 0.5rem;
    font-size: 0.86rem;
    color: #e11d48;
    font-weight: 600;
  }
  .estate-card__note {
    margin: 0;
    color: #64748b;
    font-size: 0.92rem;
    line-height: 1.55;
  }

  @media (max-width: 700px) {
    .estate__zones-grid {
      grid-template-columns: 1fr;
    }
  }
</style>