<script lang="ts">
  /**
   * RelocationTours.svelte — "Relocation tours" page-level tab on the client
   * status page. Shown only when the client's destination country is in the
   * operator-configured destination-services list (e.g. Costa Rica).
   *
   * This is a placeholder value-offer surface for now: it paraphrases the
   * public relocation-tours offering and ends with a "Book a discovery call"
   * call-to-action. The CTA is intentionally a simple mailto/consultation link
   * until the dedicated tour intake form is wired up.
   */
  export let destinationCountry: string = '';
</script>

<section class="rt">
  <div class="rt__head">
    <p class="rt__eyebrow">Relocation tours</p>
    <h2 class="rt__title">See {destinationCountry || 'your destination'} before you commit</h2>
    <p class="rt__lead">
      A private, guided tour of the areas you are considering. We walk the
      neighbourhoods, meet the local contacts, and map the practical details so
      your move is grounded in what the place is actually like, not a brochure.
    </p>
  </div>

  <div class="rt__grid">
    <div class="rt__item">
      <span class="rt__icon" aria-hidden="true">📍</span>
      <h3 class="rt__item-title">Neighbourhood scouting</h3>
      <p class="rt__item-body">
        Visit the areas that match your budget and lifestyle, with a local who
        can tell you what each one is really like to live in.
      </p>
    </div>
    <div class="rt__item">
      <span class="rt__icon" aria-hidden="true">🏫</span>
      <h3 class="rt__item-title">Schools & services</h3>
      <p class="rt__item-body">
        See schools, clinics, banks, and the everyday services your family will
        rely on, so nothing is a surprise after you land.
      </p>
    </div>
    <div class="rt__item">
      <span class="rt__icon" aria-hidden="true">🤝</span>
      <h3 class="rt__item-title">Meet the local team</h3>
      <p class="rt__item-body">
        Sit down with the partners who will handle your immigration, housing,
        and settling-in, so you know who you are working with.
      </p>
    </div>
  </div>

  <div class="rt__foot">
    <p class="rt__foot-note">
      Tours run on a rotating schedule. Book a discovery call and we will match
      you to the next available dates.
    </p>
    <a class="rt__cta" href="/consultation">Book a discovery call</a>
  </div>
</section>

<style lang="scss">
  .rt {
    font-family: var(--font-paragraph, 'Jost'), system-ui, sans-serif;
    color: #1a1a2e;
  }
  .rt__head { margin-bottom: 1.75rem; }
  .rt__eyebrow {
    margin: 0 0 0.7rem;
    font-size: 0.7rem;
    font-weight: 700;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: var(--color-highlight-2, #02b5bb);
  }
  .rt__title {
    margin: 0 0 0.6rem;
    font-family: var(--font-title, 'Kiona Regular', serif);
    font-size: clamp(1.6rem, 2.6vw, 2.1rem);
    font-weight: 700;
    letter-spacing: -0.02em;
    color: var(--color-foreground, #181818);
  }
  .rt__lead {
    margin: 0;
    color: #475569;
    line-height: 1.6;
    max-width: 62ch;
  }

  .rt__grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1rem;
    margin-bottom: 1.75rem;
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

  .rt__foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
    padding-top: 1.5rem;
    border-top: 1px solid rgba(var(--color-highlight-2-rgb), 0.14);
  }
  .rt__foot-note {
    margin: 0;
    color: #475569;
    font-size: 0.95rem;
  }
  .rt__cta {
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
  .rt__cta:hover { filter: brightness(1.06); }

  @media (max-width: 900px) {
    .rt__grid { grid-template-columns: repeat(2, 1fr); }
  }
  @media (max-width: 620px) {
    .rt__grid { grid-template-columns: 1fr; }
  }
</style>