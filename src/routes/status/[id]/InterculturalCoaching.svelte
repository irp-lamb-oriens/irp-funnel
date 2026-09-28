<script lang="ts">
  /**
   * InterculturalCoaching.svelte — "Intercultural coaching" page-level tab on
   * the client status page. Renders inside the centralized ServiceFunnelPanel
   * (header chrome + configurable "Book a discovery call" form). This component
   * only supplies the service-specific value-offer content.
   */
  import ServiceFunnelPanel from './ServiceFunnelPanel.svelte';

  export let destinationCountry: string = '';

  const items = [
    {
      icon: '🗣️',
      title: 'Communication norms',
      body: 'How directness, formality, and small talk actually work, so your first conversations land the way you intend.',
    },
    {
      icon: '🤝',
      title: 'Business & social etiquette',
      body: 'The unspoken rules for meetings, relationships, and everyday interactions that no guidebook spells out.',
    },
    {
      icon: '🏡',
      title: 'Daily life & expectations',
      body: 'Pace, punctuality, and the small practical rhythms that shape how a day actually feels once you live there.',
    },
  ];
</script>

<ServiceFunnelPanel serviceId="coaching" {destinationCountry}>
  <div class="ic__grid">
    {#each items as it (it.title)}
      <div class="ic__item">
        <span class="ic__icon" aria-hidden="true">{it.icon}</span>
        <h3 class="ic__item-title">{it.title}</h3>
        <p class="ic__item-body">{it.body}</p>
      </div>
    {/each}
  </div>
  <p class="ic__note">
    Coaching is tailored to your family and your destination. Book a call to see how it fits your move.
  </p>
</ServiceFunnelPanel>

<style lang="scss">
  .ic__grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1rem;
  }
  .ic__item {
    padding: 1.4rem 1.5rem;
    background: #fff;
    border: 1px solid rgba(var(--color-highlight-2-rgb), 0.16);
    border-radius: 16px;
    box-shadow: 0 16px 36px -26px rgba(15, 23, 42, 0.2);
  }
  .ic__icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    margin-bottom: 0.7rem;
    border-radius: 11px;
    font-size: 1.2rem;
    background: rgba(var(--color-highlight-2-rgb), 0.1);
  }
  .ic__item-title {
    margin: 0 0 0.45rem;
    font-family: var(--font-subtitle, 'Spartan Black', sans-serif);
    font-size: 1rem;
    font-weight: 700;
    color: var(--color-foreground, #181818);
  }
  .ic__item-body {
    margin: 0;
    color: #64748b;
    font-size: 0.92rem;
    line-height: 1.6;
  }
  .ic__note {
    margin: 1.25rem 0 0;
    color: #475569;
    font-size: 0.93rem;
    line-height: 1.6;
    max-width: 60ch;
  }

  @media (max-width: 900px) {
    .ic__grid { grid-template-columns: repeat(2, 1fr); }
  }
  @media (max-width: 620px) {
    .ic__grid { grid-template-columns: 1fr; }
  }
</style>