<script lang="ts">
  /**
   * LegalAdvice.svelte — "Legal advice" page-level tab on the client status
   * page. Renders inside the centralized ServiceFunnelPanel (which owns the
   * header chrome + configurable "Book a discovery call" form). This component
   * only supplies the service-specific value-offer content.
   *
   * Layout: a 2×2 editorial quad with a heavy top "cap" cell. Four matters are
   * arranged as masonry-style cards; each carries a corner ghost numeral and
   * a hairline top rule so the section reads as a composed grid of ledgers
   * rather than a uniform card field.
   */
  import ServiceFunnelPanel from './ServiceFunnelPanel.svelte';

  export let destinationCountry: string = '';

  const matters = [
    {
      icon: '🛂',
      index: '01',
      title: 'Residency & visas',
      body: 'The right category for your situation, the documents that must be correct, and the timeline to expect.',
    },
    {
      icon: '🏢',
      index: '02',
      title: 'Business & incorporation',
      body: 'Corporate structure, banking, and the local compliance that keeps a new venture on solid ground.',
    },
    {
      icon: '📄',
      index: '03',
      title: 'Contracts & property',
      body: 'Purchase agreements, leases, and the fine print that protects you before you sign.',
    },
    {
      icon: '👨‍👩‍👧',
      index: '04',
      title: 'Family & estate',
      body: 'Wills, powers of attorney, and the arrangements that keep your family covered across borders.',
    },
  ];
</script>

<ServiceFunnelPanel serviceId="legal" {destinationCountry}>
  <div class="la">
    <div class="la__grid">
      {#each matters as m (m.title)}
        <article class="la__item">
          <div class="la__head">
            <span class="la__icon" aria-hidden="true">{m.icon}</span>
            <span class="la__num" aria-hidden="true">{m.index}</span>
          </div>
          <h3 class="la__title">{m.title}</h3>
          <p class="la__body">{m.body}</p>
          <span class="la__rule" aria-hidden="true"></span>
        </article>
      {/each}
    </div>
  </div>
</ServiceFunnelPanel>

<style lang="scss">
  .la {
    width: 100%;
  }

  .la__grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 1.1rem;
  }

  .la__item {
    position: relative;
    padding: 1.6rem 1.7rem 1.8rem;
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

  .la__head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    margin-bottom: 1rem;
  }

  .la__icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    border-radius: 13px;
    font-size: 1.25rem;
    background: rgba(var(--color-highlight-2-rgb), 0.1);
    border: 1px solid rgba(var(--color-highlight-2-rgb), 0.15);
  }

  .la__num {
    font-family: var(--font-subtitle, 'Spartan Black', serif);
    font-size: 2.3rem;
    line-height: 0.85;
    font-weight: 900;
    color: transparent;
    -webkit-text-stroke: 1px rgba(var(--color-highlight-2-rgb), 0.32);
    user-select: none;
  }

  .la__title {
    margin: 0 0 0.5rem;
    font-family: var(--font-subtitle, 'Spartan Black', sans-serif);
    font-size: 1.05rem;
    font-weight: 700;
    color: var(--color-foreground, #181818);
  }

  .la__body {
    margin: 0;
    color: #64748b;
    font-size: 0.94rem;
    line-height: 1.62;
  }

  /* Bottom hairline accent anchored to the card's lower edge. */
  .la__rule {
    position: absolute;
    left: 1.7rem;
    right: 1.7rem;
    bottom: 0;
    height: 2px;
    background: linear-gradient(
      90deg,
      var(--color-highlight-2),
      rgba(var(--color-highlight-2-rgb), 0)
    );
    opacity: 0;
    transition: opacity 0.2s ease;
  }
  .la__item:hover .la__rule { opacity: 1; }

  @media (max-width: 620px) {
    .la__grid { grid-template-columns: 1fr; }
  }

  @media (prefers-reduced-motion: reduce) {
    .la__item { transition: none; }
  }
</style>