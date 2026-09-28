<script lang="ts">
  /**
   * ImmigrationAdvice.svelte — "Immigration advice" page-level tab on the
   * client status page. Renders inside the centralized ServiceFunnelPanel
   * (header chrome + configurable "Book a discovery call" form). This component
   * only supplies the service-specific value-offer content.
   */
  import ServiceFunnelPanel from './ServiceFunnelPanel.svelte';

  export let destinationCountry: string = '';

  const routes = [
    {
      icon: '💵',
      title: 'Rentista',
      body: 'For people with a stable, verifiable monthly income from outside the country.',
    },
    {
      icon: '🏦',
      title: 'Pensionado',
      body: 'For retirees with a lifetime pension or social-security income.',
    },
    {
      icon: '📈',
      title: 'Inversionista',
      body: 'For those who invest a set amount in the country, in property or a recognized vehicle.',
    },
  ];
</script>

<ServiceFunnelPanel serviceId="immigration" {destinationCountry}>
  <div class="ia__list">
    {#each routes as r (r.title)}
      <article class="ia__card">
        <span class="ia__icon" aria-hidden="true">{r.icon}</span>
        <div class="ia__body">
          <h3 class="ia__card-title">{r.title}</h3>
          <p class="ia__card-text">{r.body}</p>
        </div>
      </article>
    {/each}
  </div>
  <p class="ia__note">
    Every case is different. Your discovery call tells us which category actually fits your situation.
  </p>
</ServiceFunnelPanel>

<style lang="scss">
  .ia__list {
    display: flex;
    flex-direction: column;
    gap: 0.9rem;
  }
  .ia__card {
    display: flex;
    gap: 1rem;
    padding: 1.25rem 1.4rem;
    background: #fff;
    border: 1px solid rgba(var(--color-highlight-2-rgb), 0.16);
    border-radius: 16px;
    box-shadow: 0 16px 36px -26px rgba(15, 23, 42, 0.2);
  }
  .ia__icon {
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
  .ia__body { min-width: 0; }
  .ia__card-title {
    margin: 0 0 0.4rem;
    font-family: var(--font-subtitle, 'Spartan Black', sans-serif);
    font-size: 1rem;
    font-weight: 700;
    color: var(--color-foreground, #181818);
  }
  .ia__card-text {
    margin: 0;
    color: #64748b;
    font-size: 0.92rem;
    line-height: 1.6;
  }
  .ia__note {
    margin: 1.25rem 0 0;
    color: #475569;
    font-size: 0.93rem;
    line-height: 1.6;
    max-width: 60ch;
  }
</style>