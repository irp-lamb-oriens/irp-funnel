<script lang="ts">
  /**
   * ImmigrationAdvice.svelte — "Immigration advice" page-level tab on the
   * client status page. Renders inside the centralized ServiceFunnelPanel
   * (header chrome + configurable "Book a discovery call" form). This component
   * only supplies the service-specific value-offer content.
   *
   * Layout: a numbered vertical index. Each residency route is a full-width
   * editorial row with a ghost numeral on the left rail, a divider hairline,
   * and generous whitespace — resembling a magazine contents index rather than
   * a stack of identical cards.
   */
  import ServiceFunnelPanel from './ServiceFunnelPanel.svelte';

  export let destinationCountry: string = '';

  const routes = [
    {
      icon: '💵',
      index: '01',
      title: 'Rentista',
      body: 'For people with a stable, verifiable monthly income from outside the country.',
    },
    {
      icon: '🏦',
      index: '02',
      title: 'Pensionado',
      body: 'For retirees with a lifetime pension or social-security income.',
    },
    {
      icon: '📈',
      index: '03',
      title: 'Inversionista',
      body: 'For those who invest a set amount in the country, in property or a recognized vehicle.',
    },
  ];
</script>

<ServiceFunnelPanel serviceId="immigration" {destinationCountry}>
  <div class="ia">
    <ol class="ia__index">
      {#each routes as r (r.title)}
        <li class="ia__row">
          <span class="ia__num" aria-hidden="true">{r.index}</span>
          <span class="ia__icon" aria-hidden="true">{r.icon}</span>
          <div class="ia__body">
            <h3 class="ia__title">{r.title}</h3>
            <p class="ia__text">{r.body}</p>
          </div>
        </li>
      {/each}
    </ol>

    <p class="ia__note">
      Every case is different. Your discovery call tells us which category
      actually fits your situation.
    </p>
  </div>
</ServiceFunnelPanel>

<style lang="scss">
  .ia {
    display: flex;
    flex-direction: column;
    gap: 1.75rem;
  }

  .ia__index {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
  }

  .ia__row {
    display: grid;
    grid-template-columns: auto auto 1fr;
    align-items: start;
    gap: 1.15rem;
    padding: 1.55rem 0.25rem;
    border-bottom: 1px solid rgba(15, 23, 42, 0.07);
    transition: background 0.2s ease, padding-left 0.2s ease;

    &:first-child { border-top: 1px solid rgba(15, 23, 42, 0.07); }

    &:hover {
      background: rgba(var(--color-highlight-2-rgb), 0.03);
      padding-left: 0.8rem;
    }
  }

  .ia__num {
    font-family: var(--font-subtitle, 'Spartan Black', serif);
    font-size: 2rem;
    line-height: 1;
    font-weight: 900;
    color: transparent;
    -webkit-text-stroke: 1px rgba(var(--color-highlight-2-rgb), 0.4);
    user-select: none;
    padding-top: 0.05rem;
    min-width: 2.6rem;
  }

  .ia__icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 42px;
    height: 42px;
    border-radius: 12px;
    font-size: 1.15rem;
    background: rgba(var(--color-highlight-2-rgb), 0.1);
    border: 1px solid rgba(var(--color-highlight-2-rgb), 0.15);
  }

  .ia__body { min-width: 0; }

  .ia__title {
    margin: 0 0 0.35rem;
    font-family: var(--font-subtitle, 'Spartan Black', sans-serif);
    font-size: 1.1rem;
    font-weight: 700;
    color: var(--color-foreground, #181818);
  }

  .ia__text {
    margin: 0;
    color: #64748b;
    font-size: 0.94rem;
    line-height: 1.6;
    max-width: 60ch;
  }

  .ia__note {
    margin: 0;
    color: #475569;
    font-size: 0.93rem;
    line-height: 1.6;
    max-width: 60ch;
    padding-left: 1rem;
    border-left: 2px solid rgba(var(--color-highlight-2-rgb), 0.35);
  }

  @media (max-width: 620px) {
    .ia__row { grid-template-columns: auto 1fr; }
    .ia__num { display: none; }
  }

  @media (prefers-reduced-motion: reduce) {
    .ia__row { transition: none; }
  }
</style>