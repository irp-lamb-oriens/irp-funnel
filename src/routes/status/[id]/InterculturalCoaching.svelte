<script lang="ts">
  /**
   * InterculturalCoaching.svelte — "Intercultural coaching" page-level tab on
   * the client status page. Renders inside the centralized ServiceFunnelPanel
   * (header chrome + configurable "Book a discovery call" form). This component
   * only supplies the service-specific value-offer content.
   *
   * Layout: a staggered editorial grid where each item is a full-height cell
   * with a ghost index numeral and a numbered keyword strip, alternating
   * vertical rhythm so the section reads as a composed poster rather than a
   * uniform three-card row.
   */
  import ServiceFunnelPanel from './ServiceFunnelPanel.svelte';

  export let destinationCountry: string = '';

  const items = [
    {
      icon: '🗣️',
      index: '01',
      title: 'Communication norms',
      body: 'How directness, formality, and small talk actually work, so your first conversations land the way you intend.',
    },
    {
      icon: '🤝',
      index: '02',
      title: 'Business & social etiquette',
      body: 'The unspoken rules for meetings, relationships, and everyday interactions that no guidebook spells out.',
    },
    {
      icon: '🏡',
      index: '03',
      title: 'Daily life & expectations',
      body: 'Pace, punctuality, and the small practical rhythms that shape how a day actually feels once you live there.',
    },
  ];
</script>

<ServiceFunnelPanel serviceId="coaching" {destinationCountry}>
  <div class="ic">
    <div class="ic__grid">
      {#each items as it, i (it.title)}
        <article class="ic__item" class:ic__item--tall={i % 2 === 1}>
          <span class="ic__ghost" aria-hidden="true">{it.index}</span>
          <span class="ic__icon" aria-hidden="true">{it.icon}</span>
          <h3 class="ic__title">{it.title}</h3>
          <p class="ic__body">{it.body}</p>
        </article>
      {/each}
    </div>

    <p class="ic__note">
      Coaching is tailored to your family and your destination. Book a call to
      see how it fits your move.
    </p>
  </div>
</ServiceFunnelPanel>

<style lang="scss">
  .ic {
    display: flex;
    flex-direction: column;
    gap: 1.75rem;
  }

  .ic__grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1.1rem;
    align-items: start;
  }

  .ic__item {
    position: relative;
    padding: 1.6rem 1.6rem 1.75rem;
    background: #fff;
    border: 1px solid rgba(var(--color-highlight-2-rgb), 0.16);
    border-radius: 18px;
    box-shadow: 0 18px 40px -30px rgba(15, 23, 42, 0.3);
    overflow: hidden;
    transition: transform 0.22s ease, box-shadow 0.22s ease, border-color 0.22s ease;

    &:hover {
      transform: translateY(-4px);
      border-color: rgba(var(--color-highlight-2-rgb), 0.34);
      box-shadow: 0 26px 55px -32px rgba(15, 23, 42, 0.45);
    }
  }

  /* Alternating vertical offset for a composed, staggered rhythm. */
  .ic__item--tall {
    margin-top: 2rem;
  }

  .ic__ghost {
    position: absolute;
    top: 0.7rem;
    right: 1.1rem;
    font-family: var(--font-subtitle, 'Spartan Black', serif);
    font-size: 3rem;
    line-height: 1;
    font-weight: 900;
    color: transparent;
    -webkit-text-stroke: 1px rgba(var(--color-highlight-2-rgb), 0.22);
    pointer-events: none;
    user-select: none;
  }

  .ic__icon {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    margin-bottom: 1.1rem;
    border-radius: 13px;
    font-size: 1.25rem;
    background: rgba(var(--color-highlight-2-rgb), 0.1);
    border: 1px solid rgba(var(--color-highlight-2-rgb), 0.15);
  }

  .ic__title {
    position: relative;
    margin: 0 0 0.5rem;
    font-family: var(--font-subtitle, 'Spartan Black', sans-serif);
    font-size: 1.05rem;
    font-weight: 700;
    color: var(--color-foreground, #181818);
  }

  .ic__body {
    position: relative;
    margin: 0;
    color: #64748b;
    font-size: 0.94rem;
    line-height: 1.62;
  }

  .ic__note {
    margin: 0;
    color: #475569;
    font-size: 0.93rem;
    line-height: 1.6;
    max-width: 60ch;
    padding-left: 1rem;
    border-left: 2px solid rgba(var(--color-highlight-2-rgb), 0.35);
  }

  @media (max-width: 900px) {
    .ic__grid { grid-template-columns: repeat(2, 1fr); }
    .ic__item--tall { margin-top: 0; }
  }
  @media (max-width: 620px) {
    .ic__grid { grid-template-columns: 1fr; }
  }

  @media (prefers-reduced-motion: reduce) {
    .ic__item { transition: none; }
  }
</style>