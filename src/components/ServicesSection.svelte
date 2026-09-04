<script lang="ts">
  // Homepage section that introduces the specialized relocation services and
  // links to each dedicated landing page. Public-facing services (Relocation
  // Tours + Real Estate) get their own landings; International Moving reuses
  // the consultation flow. Immigration, settling-in and the deeper service
  // catalogue live behind the client portal ("Full relocation support" tab),
  // not here.
  type Service = {
    key: string;
    title: string;
    description: string;
    href: string;
    cta: string;
    icon: string;
    accent: string;
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
    },
    {
      key: 'real-estate',
      title: 'Real estate due diligence',
      description:
        "We don't sell houses. We investigate which zones actually fit your life, your budget and your schools, before you sign anything expensive.",
      href: '/real-estate',
      cta: 'Get real estate due diligence',
      icon: 'estate',
      accent: '#c62426',
    },
    {
      key: 'moving',
      title: 'International moving',
      description:
        'Shipping your household, a car or a container. We map the real rules, duties and paperwork for your route so there are no surprises at the port.',
      href: '/consultation',
      cta: 'Plan your move',
      icon: 'ship',
      accent: '#02b5bb',
    },
  ];
</script>

<section id="services" class="services">
  <div class="services__inner">
    <div class="services__head">
      <h2 class="services__title">Specialized relocation services</h2>
      <p class="services__sub">
        One partner for the decisions that matter: where to live, how to move,
        and what the legal side actually requires.
      </p>
    </div>

    <div class="services__grid">
      {#each services as s (s.key)}
        <a class="services-card" href={s.href} style={`--card-accent: ${s.accent}`}>
          <span class="services-card__icon" aria-hidden="true">
            {#if s.icon === 'map'}
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 5l6 14M15 5l-6 14M4 9h16M4 15h16" stroke-linecap="round" stroke-linejoin="round"/></svg>
            {:else if s.icon === 'estate'}
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 21h18M5 21V10l7-5 7 5v11M9 21v-6h6v6" stroke-linecap="round" stroke-linejoin="round"/></svg>
            {:else}
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 16l4-6 4 3 4-8 4 11H4z" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 20h16" stroke-linecap="round"/></svg>
            {/if}
          </span>
          <h3 class="services-card__title">{s.title}</h3>
          <p class="services-card__desc">{s.description}</p>
          <span class="services-card__cta">
            {s.cta}
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="services-card__arrow"><path d="M5 12h14M13 6l6 6-6 6" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </span>
        </a>
      {/each}
    </div>
  </div>
</section>

<style lang="scss">
  .services {
    position: relative;
    padding: 4.5rem 0 5rem;
    background: linear-gradient(180deg, #f7f7f7 0%, #fbfbfc 100%);
    color: #1a1a2e;
    font-family: var(--font-paragraph, 'Jost'), system-ui, sans-serif;
  }

  .services__inner {
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 2rem;
  }

  .services__head {
    max-width: 680px;
    margin-bottom: 2.75rem;
  }

  .services__title {
    font-family: var(--font-title, 'Kiona Regular', serif);
    font-size: clamp(1.7rem, 3vw + 0.6rem, 2.6rem);
    font-weight: 700;
    letter-spacing: -0.01em;
    line-height: 1.1;
    margin: 0 0 0.8rem;
    color: var(--color-foreground, #181818);
  }

  .services__sub {
    margin: 0;
    font-size: 1.05rem;
    line-height: 1.6;
    color: #4b5563;
    max-width: 58ch;
  }

  .services__grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1.25rem;
  }

  .services-card {
    --card-accent: #02b5bb;
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 0.9rem;
    text-decoration: none;
    color: inherit;
    padding: 1.75rem 1.6rem 1.6rem;
    background: #ffffff;
    border: 1px solid rgba(0, 0, 0, 0.07);
    border-radius: 18px;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03), 0 20px 40px -22px rgba(0, 0, 0, 0.12);
    transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.3s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.25s;

    &::before {
      content: '';
      position: absolute;
      top: 0;
      left: 1.6rem;
      right: 1.6rem;
      height: 3px;
      border-radius: 0 0 3px 3px;
      background: var(--card-accent);
      opacity: 0.9;
    }

    &:hover {
      transform: translateY(-4px);
      border-color: color-mix(in srgb, var(--card-accent) 32%, transparent);
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.04), 0 32px 56px -24px color-mix(in srgb, var(--card-accent) 40%, transparent);
    }
  }

  .services-card__icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 46px;
    height: 46px;
    border-radius: 12px;
    color: var(--card-accent);
    background: color-mix(in srgb, var(--card-accent) 10%, transparent);
    svg {
      width: 24px;
      height: 24px;
    }
  }

  .services-card__title {
    font-family: var(--font-subtitle, 'Spartan Black', sans-serif);
    font-size: 1.12rem;
    font-weight: 700;
    margin: 0;
    color: var(--color-foreground, #181818);
    letter-spacing: -0.01em;
  }

  .services-card__desc {
    margin: 0;
    font-size: 0.95rem;
    line-height: 1.6;
    color: #4b5563;
    flex: 1;
  }

  .services-card__cta {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.9rem;
    font-weight: 700;
    color: var(--card-accent);
  }

  .services-card__arrow {
    width: 16px;
    height: 16px;
    transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  }
  .services-card:hover .services-card__arrow {
    transform: translateX(3px);
  }

  @media (max-width: 900px) {
    .services__grid {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 640px) {
    .services {
      padding: 3rem 0 3.5rem;
    }
    .services__inner {
      padding: 0 1.1rem;
    }
  }
</style>