<script lang="ts">
  /**
   * InterculturalCoaching.svelte — "Intercultural coaching" page-level tab on
   * the client status page. Shown only when the client's destination country is
   * in the operator-configured destination-services list (e.g. Costa Rica).
   *
   * This is a placeholder value-offer surface for now. The copy is intentionally
   * generic until the real intercultural-coaching content is supplied.
   */
  export let destinationCountry: string = '';
</script>

<section class="ic">
  <div class="ic__head">
    <p class="ic__eyebrow">Intercultural coaching</p>
    <h2 class="ic__title">Settle in, not just move in</h2>
    <p class="ic__lead">
      The paperwork is only half of a move. How people communicate, do business,
      and build trust in {destinationCountry || 'your destination'} can be very
      different from what you are used to. Coaching closes that gap before it
      costs you time or goodwill.
    </p>
  </div>

  <div class="ic__grid">
    <div class="ic__item">
      <span class="ic__icon" aria-hidden="true">🗣️</span>
      <h3 class="ic__item-title">Communication norms</h3>
      <p class="ic__item-body">
        How directness, formality, and small talk actually work, so your first
        conversations land the way you intend.
      </p>
    </div>
    <div class="ic__item">
      <span class="ic__icon" aria-hidden="true">🤝</span>
      <h3 class="ic__item-title">Business & social etiquette</h3>
      <p class="ic__item-body">
        The unspoken rules for meetings, relationships, and everyday
        interactions that no guidebook spells out.
      </p>
    </div>
    <div class="ic__item">
      <span class="ic__icon" aria-hidden="true">🏡</span>
      <h3 class="ic__item-title">Daily life & expectations</h3>
      <p class="ic__item-body">
        Pace, punctuality, and the small practical rhythms that shape how a day
        actually feels once you live there.
      </p>
    </div>
  </div>

  <div class="ic__foot">
    <p class="ic__foot-note">
      Coaching is tailored to your family and your destination. Book a call to
      see how it fits your move.
    </p>
    <a class="ic__cta" href="/consultation">Book a discovery call</a>
  </div>
</section>

<style lang="scss">
  .ic {
    font-family: var(--font-paragraph, 'Jost'), system-ui, sans-serif;
    color: #1a1a2e;
  }
  .ic__head { margin-bottom: 1.75rem; }
  .ic__eyebrow {
    margin: 0 0 0.7rem;
    font-size: 0.7rem;
    font-weight: 700;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: var(--color-highlight-2, #02b5bb);
  }
  .ic__title {
    margin: 0 0 0.6rem;
    font-family: var(--font-title, 'Kiona Regular', serif);
    font-size: clamp(1.6rem, 2.6vw, 2.1rem);
    font-weight: 700;
    letter-spacing: -0.02em;
    color: var(--color-foreground, #181818);
  }
  .ic__lead {
    margin: 0;
    color: #475569;
    line-height: 1.6;
    max-width: 62ch;
  }

  .ic__grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1rem;
    margin-bottom: 1.75rem;
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

  .ic__foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
    padding-top: 1.5rem;
    border-top: 1px solid rgba(var(--color-highlight-2-rgb), 0.14);
  }
  .ic__foot-note {
    margin: 0;
    color: #475569;
    font-size: 0.95rem;
  }
  .ic__cta {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0.75rem 1.5rem;
    border-radius: 12px;
    font-weight: 700;
    font-size: 0.92rem;
    text-decoration: none;
    color: #fff;
    background: linear-gradient(135deg, var(--color-highlight-2, #02b5bb) 0%, #02999e 100%);
    box-shadow: 0 14px 30px -12px rgba(var(--color-highlight-2-rgb), 0.55);
  }
  .ic__cta:hover { filter: brightness(1.06); }

  @media (max-width: 900px) {
    .ic__grid { grid-template-columns: repeat(2, 1fr); }
  }
  @media (max-width: 620px) {
    .ic__grid { grid-template-columns: 1fr; }
  }
</style>