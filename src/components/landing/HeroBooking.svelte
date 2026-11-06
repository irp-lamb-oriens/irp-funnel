<script lang="ts">
  /**
   * Section 1: book your call. HeroForm keeps all of its logic (Evo copy,
   * email and name capture, form or chat with Lili, calendar booking,
   * WhatsApp hand-off) and stays the only instance on the page. This frame
   * adds the founder line and the trust facts under it.
   */
  import HeroForm from '../HeroForm.svelte';
  import { HERO } from './content.ts';
</script>

<section class="hero" aria-label="Book your consultation call">
  <div class="glow" aria-hidden="true"></div>
  <div class="form">
    <HeroForm />
  </div>
  <div class="strip">
    <div class="founder">
      <div>
        <p class="founder-name">{HERO.founder}</p>
        <p class="founder-line">{HERO.founderLine}</p>
      </div>
    </div>
    <ul class="facts">
      {#each HERO.facts as f}
        <li><span class="value">{f.value}</span><span class="label">{f.label}</span></li>
      {/each}
    </ul>
  </div>
</section>

<style lang="scss">
  @use './tokens' as *;

  .hero {
    position: relative;
    isolation: isolate;
    background: $color-ink-strong;
    color: $color-on-dark;
    overflow: hidden;
    padding-bottom: $space-12;
  }
  .glow {
    position: absolute;
    inset: -20% -10% auto;
    height: 120%;
    z-index: -1;
    background:
      radial-gradient(50% 45% at 78% 30%, rgba(2, 181, 187, 0.35), transparent 70%),
      radial-gradient(40% 40% at 10% 80%, rgba(2, 181, 187, 0.18), transparent 70%);
    pointer-events: none;
  }
  /* Arrival highlight when a "Book your call" button brings the visitor back (reveal.ts openBooking). */
  .form :global(#hero-form-container.irp-arrive) { animation: irp-arrive 1.3s cubic-bezier(0.16, 1, 0.3, 1); }
  @keyframes -global-irp-arrive {
    0% { box-shadow: 0 0 0 0 rgba(2, 181, 187, 0.0); transform: scale(0.985); }
    35% { box-shadow: 0 0 0 10px rgba(2, 181, 187, 0.35); transform: scale(1.01); }
    100% { box-shadow: 0 0 0 28px rgba(2, 181, 187, 0); transform: none; }
  }
  @media (prefers-reduced-motion: reduce) { .form :global(#hero-form-container.irp-arrive) { animation: none; } }
  /* HeroForm draws its own dark radial vignette; on this ink field it reads as depth. */
  .form :global(.hero-banner) { background: transparent; }

  .strip {
    @include container;
    & {
      display: grid;
      gap: $space-8;
      padding-top: $space-8;
      border-top: 1px solid $color-on-dark-hairline;
    }
    @include lg { grid-template-columns: 5fr 7fr; align-items: center; }
  }
  .founder { display: flex; align-items: center; gap: $space-4; }
  .founder-name { @include eyebrow; color: $color-on-dark; }
  .founder-line { font-family: $font-sans; color: $color-on-dark-muted; margin: $space-1 0 0; line-height: 1.5; }
  .facts {
    list-style: none; margin: 0; padding: 0;
    display: grid; gap: $space-6;
    @include md { grid-template-columns: repeat(3, 1fr); }
    li { display: flex; flex-direction: column; gap: $space-1; padding-inline-start: $space-4; border-left: 2px solid $color-accent; }
  }
  .value { font-family: $font-sans; font-weight: 700; font-size: clamp(1.15rem, 2vw, 1.5rem); letter-spacing: -0.02em; }
  .label { font-family: $font-sans; font-size: 0.875rem; color: $color-on-dark-muted; }
</style>
