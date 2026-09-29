<script lang="ts">
  /**
   * RelocationTours.svelte — "Relocation tours" page-level tab on the client
   * status page. Renders inside the centralized ServiceFunnelPanel (header
   * chrome + configurable "Book a discovery call" form). This component only
   * supplies the service-specific value-offer content.
   *
   * Layout: an editorial segmented grid. The first cell is a full-bleed
   * "manifesto" lead block spanning the full row; the three value-offer items
   * follow in an asymmetric 12-column grid (5 / 3 / 4) with ghost index
   * numerals so the section reads like a numbered index rather than a uniform
   * card row.
   */
  import ServiceFunnelPanel from './ServiceFunnelPanel.svelte';

  export let destinationCountry: string = '';

  const items = [
    {
      icon: '📍',
      index: '01',
      title: 'Neighbourhood scouting',
      body: 'Visit the areas that match your budget and lifestyle, with a local who can tell you what each one is really like to live in.',
    },
    {
      icon: '🏫',
      index: '02',
      title: 'Schools & services',
      body: 'See schools, clinics, banks, and the everyday services your family will rely on, so nothing is a surprise after you land.',
    },
    {
      icon: '🤝',
      index: '03',
      title: 'Meet the local team',
      body: 'Sit down with the partners who will handle your immigration, housing, and settling-in, so you know who you are working with.',
    },
  ];
</script>

<ServiceFunnelPanel serviceId="tours" {destinationCountry}>
  <div class="rt">
    <div class="rt__manifesto">
      <span class="rt__manifesto-tag" aria-hidden="true">✳</span>
      <p class="rt__manifesto-text">
        A private experience, not a group bus. We take one person or one couple
        at a time, and build the days around a single question: is this really
        the right move for you?
      </p>
    </div>

    <div class="rt__grid">
      {#each items as it (it.title)}
        <article
          class="rt__item"
          class:rt__item--wide={it.index === '01'}
          class:rt__item--tight={it.index === '02'}
          class:rt__item--portrait={it.index === '03'}
        >
          <div class="rt__item-head">
            <span class="rt__icon" aria-hidden="true">{it.icon}</span>
            <span class="rt__item-index" aria-hidden="true">{it.index}</span>
          </div>
          <h3 class="rt__item-title">{it.title}</h3>
          <p class="rt__item-body">{it.body}</p>
        </article>
      {/each}
    </div>

    <p class="rt__note">
      Tours run on a rotating schedule. We will match you to the next available
      dates on your discovery call.
    </p>
  </div>
</ServiceFunnelPanel>

<style lang="scss">
  .rt {
    display: flex;
    flex-direction: column;
    gap: 1.75rem;
  }

  /* Full-bleed manifesto lead — the "large pull quote" block. */
  .rt__manifesto {
    position: relative;
    display: flex;
    gap: 1.25rem;
    padding: 1.75rem 1.9rem;
    border-radius: 20px;
    background:
      radial-gradient(900px 200px at 100% 0%, rgba(var(--color-highlight-2-rgb), 0.12), transparent 60%),
      linear-gradient(135deg, #0f172a 0%, #111f2b 100%);
    color: #eaf2f7;
    overflow: hidden;
    box-shadow: 0 30px 70px -40px rgba(15, 23, 42, 0.7);
  }
  .rt__manifesto-tag {
    font-size: 1.3rem;
    line-height: 1;
    color: var(--color-highlight-2);
    flex-shrink: 0;
  }
  .rt__manifesto-text {
    margin: 0;
    font-family: var(--font-subtitle, 'Spartan Black', serif);
    font-size: clamp(1.15rem, 2.4vw, 1.6rem);
    font-weight: 700;
    line-height: 1.35;
    letter-spacing: -0.01em;
    max-width: 42ch;
    text-wrap: balance;
  }

  /* Asymmetric segmented grid: 5 / 3 / 4 columns on desktop. */
  .rt__grid {
    display: grid;
    grid-template-columns: repeat(12, 1fr);
    gap: 1.1rem;
  }
  .rt__item {
    position: relative;
    grid-column: span 4;
    padding: 1.6rem 1.7rem;
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
  .rt__item--wide { grid-column: span 5; }
  .rt__item--tight { grid-column: span 3; }
  .rt__item--portrait { grid-column: span 4; }

  .rt__item-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    margin-bottom: 1rem;
  }
  .rt__icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 42px;
    height: 42px;
    border-radius: 12px;
    font-size: 1.2rem;
    background: rgba(var(--color-highlight-2-rgb), 0.1);
    border: 1px solid rgba(var(--color-highlight-2-rgb), 0.15);
  }
  .rt__item-index {
    font-family: var(--font-subtitle, 'Spartan Black', serif);
    font-size: 2.4rem;
    line-height: 0.8;
    font-weight: 900;
    color: transparent;
    -webkit-text-stroke: 1px rgba(var(--color-highlight-2-rgb), 0.35);
    user-select: none;
  }
  .rt__item-title {
    margin: 0 0 0.5rem;
    font-family: var(--font-subtitle, 'Spartan Black', sans-serif);
    font-size: 1.05rem;
    font-weight: 700;
    color: var(--color-foreground, #181818);
  }
  .rt__item-body {
    margin: 0;
    color: #64748b;
    font-size: 0.94rem;
    line-height: 1.62;
  }
  .rt__note {
    margin: 0;
    color: #475569;
    font-size: 0.93rem;
    line-height: 1.6;
    max-width: 60ch;
    padding-left: 1rem;
    border-left: 2px solid rgba(var(--color-highlight-2-rgb), 0.35);
  }

  @media (max-width: 900px) {
    .rt__item,
    .rt__item--wide,
    .rt__item--tight,
    .rt__item--portrait { grid-column: span 6; }
  }
  @media (max-width: 620px) {
    .rt__manifesto { padding: 1.4rem 1.3rem; }
    .rt__item,
    .rt__item--wide,
    .rt__item--tight,
    .rt__item--portrait { grid-column: span 12; }
  }

  @media (prefers-reduced-motion: reduce) {
    .rt__item { transition: none; }
  }
</style>