<script lang="ts">
  /**
   * ImmigrationAdvice.svelte — "Immigration advice" page-level tab on the
   * client status page. Shown only when the client's destination country is in
   * the operator-configured destination-services list (e.g. Costa Rica).
   *
   * This is a placeholder mini-blog for now: the three most important Costa
   * Rica immigration categories (rentista, pensionado, inversionista) plus a
   * "Book a discovery call" CTA. The copy is intentionally generic until the
   * real immigration content is supplied.
   */
  export let destinationCountry: string = '';
</script>

<section class="ia">
  <div class="ia__head">
    <p class="ia__eyebrow">Immigration advice</p>
    <h2 class="ia__title">Your path to residency in {destinationCountry || 'your destination'}</h2>
    <p class="ia__lead">
      The right category depends on your income, your savings, and what you plan
      to do once you arrive. These are the three most common routes.
    </p>
  </div>

  <div class="ia__list">
    <article class="ia__card">
      <span class="ia__icon" aria-hidden="true">💵</span>
      <div class="ia__body">
        <h3 class="ia__card-title">Rentista</h3>
        <p class="ia__card-text">
          For people with a stable, verifiable monthly income from outside the
          country. You prove a minimum monthly amount and commit to it for a set
          period.
        </p>
      </div>
    </article>

    <article class="ia__card">
      <span class="ia__icon" aria-hidden="true">🏦</span>
      <div class="ia__body">
        <h3 class="ia__card-title">Pensionado</h3>
        <p class="ia__card-text">
          For retirees with a lifetime pension or social-security income. A
          lower monthly threshold than rentista, with the same residency
          benefits.
        </p>
      </div>
    </article>

    <article class="ia__card">
      <span class="ia__icon" aria-hidden="true">📈</span>
      <div class="ia__body">
        <h3 class="ia__card-title">Inversionista</h3>
        <p class="ia__card-text">
          For those who invest a minimum amount in the country, whether in real
          estate, a business, or a recognised investment vehicle.
        </p>
      </div>
    </article>
  </div>

  <div class="ia__foot">
    <p class="ia__foot-note">
      Every case is different. A discovery call lets us tell you which category
      actually fits your situation.
    </p>
    <a class="ia__cta" href="/consultation">Book a discovery call</a>
  </div>
</section>

<style lang="scss">
  .ia {
    font-family: var(--font-paragraph, 'Jost'), system-ui, sans-serif;
    color: #1a1a2e;
  }
  .ia__head { margin-bottom: 1.75rem; }
  .ia__eyebrow {
    margin: 0 0 0.7rem;
    font-size: 0.7rem;
    font-weight: 700;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: var(--color-highlight-2, #02b5bb);
  }
  .ia__title {
    margin: 0 0 0.6rem;
    font-family: var(--font-title, 'Kiona Regular', serif);
    font-size: clamp(1.6rem, 2.6vw, 2.1rem);
    font-weight: 700;
    letter-spacing: -0.02em;
    color: var(--color-foreground, #181818);
  }
  .ia__lead {
    margin: 0;
    color: #475569;
    line-height: 1.6;
    max-width: 62ch;
  }

  .ia__list {
    display: flex;
    flex-direction: column;
    gap: 0.9rem;
    margin-bottom: 1.75rem;
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

  .ia__foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
    padding-top: 1.5rem;
    border-top: 1px solid rgba(var(--color-highlight-2-rgb), 0.14);
  }
  .ia__foot-note {
    margin: 0;
    color: #475569;
    font-size: 0.95rem;
  }
  .ia__cta {
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
  .ia__cta:hover { filter: brightness(1.06); }
</style>