<script lang="ts">
  /**
   * RealEstateAssessment.svelte — "Real estate assessment" page-level tab on
   * the client status page. Renders inside the centralized ServiceFunnelPanel
   * (header chrome + configurable "Book a discovery call" form). This component
   * only supplies the service-specific value-offer content.
   */
  import ServiceFunnelPanel from './ServiceFunnelPanel.svelte';

  export let destinationCountry: string = '';

  const steps = [
    {
      icon: '🎯',
      title: 'Match your budget',
      body: 'We map what you can actually afford against the areas and property types that fit, so you stop looking at the wrong listings.',
    },
    {
      icon: '🏘️',
      title: 'Shortlist real options',
      body: 'A focused set of homes or rentals that meet your criteria, with the local context a listing never shows.',
    },
    {
      icon: '🔍',
      title: 'Assess before you commit',
      body: 'Neighborhood, schools, commute, and resale reality, so your decision is grounded in the place, not the photos.',
    },
  ];
</script>

<ServiceFunnelPanel serviceId="realty" {destinationCountry}>
  <div class="re__list">
    {#each steps as s (s.title)}
      <div class="re__item">
        <span class="re__icon" aria-hidden="true">{s.icon}</span>
        <div class="re__body">
          <h3 class="re__title">{s.title}</h3>
          <p class="re__text">{s.body}</p>
        </div>
      </div>
    {/each}
  </div>
</ServiceFunnelPanel>

<style lang="scss">
  .re__list {
    display: flex;
    flex-direction: column;
    gap: 0.9rem;
  }
  .re__item {
    display: flex;
    gap: 1rem;
    padding: 1.25rem 1.4rem;
    background: #fff;
    border: 1px solid rgba(var(--color-highlight-2-rgb), 0.16);
    border-radius: 16px;
    box-shadow: 0 16px 36px -26px rgba(15, 23, 42, 0.2);
  }
  .re__icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    flex-shrink: 0;
    border-radius: 11px;
    font-size: 1.2rem;
    background: rgba(var(--color-highlight-2-rgb), 0.1);
  }
  .re__body { min-width: 0; }
  .re__title {
    margin: 0 0 0.4rem;
    font-family: var(--font-subtitle, 'Spartan Black', sans-serif);
    font-size: 1rem;
    font-weight: 700;
    color: var(--color-foreground, #181818);
  }
  .re__text {
    margin: 0;
    color: #64748b;
    font-size: 0.92rem;
    line-height: 1.6;
  }
</style>