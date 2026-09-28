<script lang="ts">
  /**
   * RelocationTours.svelte — "Relocation tours" page-level tab on the client
   * status page. Renders inside the centralized ServiceFunnelPanel (header
   * chrome + configurable "Book a discovery call" form). This component only
   * supplies the service-specific value-offer content.
   */
  import ServiceFunnelPanel from './ServiceFunnelPanel.svelte';

  export let destinationCountry: string = '';

  const items = [
    {
      icon: '📍',
      title: 'Neighbourhood scouting',
      body: 'Visit the areas that match your budget and lifestyle, with a local who can tell you what each one is really like to live in.',
    },
    {
      icon: '🏫',
      title: 'Schools & services',
      body: 'See schools, clinics, banks, and the everyday services your family will rely on, so nothing is a surprise after you land.',
    },
    {
      icon: '🤝',
      title: 'Meet the local team',
      body: 'Sit down with the partners who will handle your immigration, housing, and settling-in, so you know who you are working with.',
    },
  ];
</script>

<ServiceFunnelPanel serviceId="tours" {destinationCountry}>
  <div class="rt__grid">
    {#each items as it (it.title)}
      <div class="rt__item">
        <span class="rt__icon" aria-hidden="true">{it.icon}</span>
        <h3 class="rt__item-title">{it.title}</h3>
        <p class="rt__item-body">{it.body}</p>
      </div>
    {/each}
  </div>
  <p class="rt__note">
    Tours run on a rotating schedule. We will match you to the next available dates on your discovery call.
  </p>
</ServiceFunnelPanel>

<style lang="scss">
  .rt__grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1rem;
  }
  .rt__item {
    padding: 1.4rem 1.5rem;
    background: #fff;
    border: 1px solid rgba(var(--color-highlight-2-rgb), 0.16);
    border-radius: 16px;
    box-shadow: 0 16px 36px -26px rgba(15, 23, 42, 0.2);
  }
  .rt__icon {
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
  .rt__item-title {
    margin: 0 0 0.45rem;
    font-family: var(--font-subtitle, 'Spartan Black', sans-serif);
    font-size: 1rem;
    font-weight: 700;
    color: var(--color-foreground, #181818);
  }
  .rt__item-body {
    margin: 0;
    color: #64748b;
    font-size: 0.92rem;
    line-height: 1.6;
  }
  .rt__note {
    margin: 1.25rem 0 0;
    color: #475569;
    font-size: 0.93rem;
    line-height: 1.6;
    max-width: 60ch;
  }

  @media (max-width: 900px) {
    .rt__grid { grid-template-columns: repeat(2, 1fr); }
  }
  @media (max-width: 620px) {
    .rt__grid { grid-template-columns: 1fr; }
  }
</style>