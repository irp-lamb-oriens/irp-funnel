<script lang="ts">
  /**
   * RealEstateAssessment.svelte — "Real estate assessment" page-level tab on
   * the client status page. Renders inside the centralized ServiceFunnelPanel
   * (header chrome + configurable "Book a discovery call" form). This component
   * only supplies the service-specific value-offer content.
   *
   * Layout: a connected process "rail" — three steps laid out as a horizontal
   * editorial sequence joined by a progress hairline, each with a ghost step
   * numeral. The whole reads as a timeline rather than a stacked list.
   */
  import ServiceFunnelPanel from './ServiceFunnelPanel.svelte';

  export let destinationCountry: string = '';

  const steps = [
    {
      icon: '🎯',
      index: '01',
      title: 'Match your budget',
      body: 'We map what you can actually afford against the areas and property types that fit, so you stop looking at the wrong listings.',
    },
    {
      icon: '🏘️',
      index: '02',
      title: 'Shortlist real options',
      body: 'A focused set of homes or rentals that meet your criteria, with the local context a listing never shows.',
    },
    {
      icon: '🔍',
      index: '03',
      title: 'Assess before you commit',
      body: 'Neighborhood, schools, commute, and resale reality, so your decision is grounded in the place, not the photos.',
    },
  ];
</script>

<ServiceFunnelPanel serviceId="realty" {destinationCountry}>
  <div class="re">
    <ol class="re__rail">
      {#each steps as s, i (s.title)}
        <li class="re__step">
          <div class="re__step-top">
            <span class="re__icon" aria-hidden="true">{s.icon}</span>
            <span class="re__num" aria-hidden="true">{s.index}</span>
          </div>
          <h3 class="re__title">{s.title}</h3>
          <p class="re__text">{s.body}</p>
          {#if i < steps.length - 1}
            <span class="re__connector" aria-hidden="true"></span>
          {/if}
        </li>
      {/each}
    </ol>
  </div>
</ServiceFunnelPanel>

<style lang="scss">
  .re {
    width: 100%;
  }

  .re__rail {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0;
    counter-reset: re;
  }

  .re__step {
    position: relative;
    padding: 1.75rem 1.75rem 2rem;
    background: #fff;
    border-top: 1px solid rgba(var(--color-highlight-2-rgb), 0.16);
    border-bottom: 1px solid rgba(var(--color-highlight-2-rgb), 0.16);

    /* Continuity: adjacent cells share their inner side border via this rule. */
    & + .re__step {
      border-left: 1px solid rgba(var(--color-highlight-2-rgb), 0.16);
    }

    &:first-child { border-left: 1px solid rgba(var(--color-highlight-2-rgb), 0.16); border-radius: 20px 0 0 20px; }
    &:last-child { border-right: 1px solid rgba(var(--color-highlight-2-rgb), 0.16); border-radius: 0 20px 20px 0; }

    transition: background 0.2s ease;

    &:hover {
      background: rgba(var(--color-highlight-2-rgb), 0.03);
    }
  }

  .re__step-top {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    margin-bottom: 1.1rem;
  }

  .re__icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    border-radius: 50%;
    font-size: 1.25rem;
    background: rgba(var(--color-highlight-2-rgb), 0.1);
    border: 1px solid rgba(var(--color-highlight-2-rgb), 0.18);
  }

  .re__num {
    font-family: var(--font-subtitle, 'Spartan Black', serif);
    font-size: 2.2rem;
    line-height: 1;
    font-weight: 900;
    color: transparent;
    -webkit-text-stroke: 1px rgba(var(--color-highlight-2-rgb), 0.32);
    user-select: none;
  }

  .re__title {
    margin: 0 0 0.5rem;
    font-family: var(--font-subtitle, 'Spartan Black', sans-serif);
    font-size: 1.05rem;
    font-weight: 700;
    color: var(--color-foreground, #181818);
  }

  .re__text {
    margin: 0;
    color: #64748b;
    font-size: 0.94rem;
    line-height: 1.62;
  }

  /* Joining chevron between steps on wide screens. */
  .re__connector {
    position: absolute;
    top: 50%;
    right: -11px;
    transform: translateY(-50%);
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: var(--color-highlight-2);
    border: 3px solid #fbfcfc;
    z-index: 2;
    box-shadow: 0 0 0 1px rgba(var(--color-highlight-2-rgb), 0.35);
  }

  @media (max-width: 860px) {
    .re__rail { grid-template-columns: 1fr; gap: 0.9rem; }
    .re__step,
    .re__step:first-child,
    .re__step:last-child {
      border: 1px solid rgba(var(--color-highlight-2-rgb), 0.16);
      border-radius: 18px;
    }
    .re__step + .re__step { border-left: 1px solid rgba(var(--color-highlight-2-rgb), 0.16); }
    .re__connector { display: none; }
  }

  @media (prefers-reduced-motion: reduce) {
    .re__step { transition: none; }
  }
</style>