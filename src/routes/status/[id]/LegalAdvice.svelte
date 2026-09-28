<script lang="ts">
  /**
   * LegalAdvice.svelte — "Legal advice" page-level tab on the client status
   * page. Renders inside the centralized ServiceFunnelPanel (which owns the
   * header chrome + configurable "Book a discovery call" form). This component
   * only supplies the service-specific value-offer content.
   */
  import ServiceFunnelPanel from './ServiceFunnelPanel.svelte';

  export let destinationCountry: string = '';

  const matters = [
    {
      icon: '🛂',
      title: 'Residency & visas',
      body: 'The right category for your situation, the documents that must be correct, and the timeline to expect.',
    },
    {
      icon: '🏢',
      title: 'Business & incorporation',
      body: 'Corporate structure, banking, and the local compliance that keeps a new venture on solid ground.',
    },
    {
      icon: '📄',
      title: 'Contracts & property',
      body: 'Purchase agreements, leases, and the fine print that protects you before you sign.',
    },
    {
      icon: '👨‍👩‍👧',
      title: 'Family & estate',
      body: 'Wills, powers of attorney, and the arrangements that keep your family covered across borders.',
    },
  ];
</script>

<ServiceFunnelPanel serviceId="legal" {destinationCountry}>
  <div class="la__grid">
    {#each matters as m (m.title)}
      <div class="la__item">
        <span class="la__icon" aria-hidden="true">{m.icon}</span>
        <h3 class="la__title">{m.title}</h3>
        <p class="la__body">{m.body}</p>
      </div>
    {/each}
  </div>
</ServiceFunnelPanel>

<style lang="scss">
  .la__grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 1rem;
  }
  .la__item {
    padding: 1.4rem 1.5rem;
    background: #fff;
    border: 1px solid rgba(var(--color-highlight-2-rgb), 0.16);
    border-radius: 16px;
    box-shadow: 0 16px 36px -26px rgba(15, 23, 42, 0.2);
  }
  .la__icon {
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
  .la__title {
    margin: 0 0 0.45rem;
    font-family: var(--font-subtitle, 'Spartan Black', sans-serif);
    font-size: 1rem;
    font-weight: 700;
    color: var(--color-foreground, #181818);
  }
  .la__body {
    margin: 0;
    color: #64748b;
    font-size: 0.92rem;
    line-height: 1.6;
  }

  @media (max-width: 620px) {
    .la__grid { grid-template-columns: 1fr; }
  }
</style>