<script lang="ts">
  /** Last section: sends the visitor back to the booking form at the top (one HeroForm per page). */
  import { reveal, goToBooking } from './reveal.ts';
  import { FINAL, IMG, LILI_WHATSAPP } from './content.ts';
</script>

<section class="final" id="book" aria-labelledby="book-title">
  <div class="glow" aria-hidden="true"></div>
  <div class="wrap" use:reveal>
    <p class="eyebrow"><span class="dot" aria-hidden="true"></span>{FINAL.eyebrow}</p>
    <h2 class="title" id="book-title">{FINAL.title}</h2>
    <p class="body">{FINAL.body}</p>
    <div class="actions">
      <a class="primary" href="#hero-form" on:click={goToBooking}>{FINAL.primary} <span aria-hidden="true">↑</span></a>
      <a class="ghost" href={LILI_WHATSAPP} target="_blank" rel="noopener">{FINAL.secondary}</a>
    </div>
    <div class="sign">
      <img class="signature" src={IMG.signature} alt="Pablo Arias signature" width="184" height="81" />
      <div>
        <p class="signoff">{FINAL.signoff}</p>
        <p class="name">{FINAL.name}</p>
        <p class="role">{FINAL.role}</p>
      </div>
    </div>
  </div>
</section>

<style lang="scss">
  @use './tokens' as *;

  .final {
    position: relative; isolation: isolate; overflow: hidden;
    background: $color-ink-strong; color: $color-on-dark;
    @include section;
  }
  .glow {
    position: absolute; inset: 0; z-index: -1; pointer-events: none;
    background: radial-gradient(45% 60% at 50% 110%, rgba(2, 181, 187, 0.4), transparent 70%);
  }
  .wrap {
    @include container; max-width: 920px; text-align: center;
    display: flex; flex-direction: column; align-items: center; gap: $space-6;
    @include reveal(24px);
  }
  .eyebrow { @include eyebrow; color: $color-on-dark; display: inline-flex; align-items: center; gap: $space-2; }
  .dot { width: 6px; height: 6px; border-radius: 50%; background: $color-accent; }
  .title { @include heading-xl; color: $color-on-dark; font-size: clamp(2.3rem, 5.4vw, 4.25rem); }
  .body { font-family: $font-sans; font-size: 1.25rem; line-height: 1.6; color: $color-on-dark-muted; margin: 0; max-width: 40ch; }
  .actions { display: flex; flex-wrap: wrap; justify-content: center; gap: $space-3; margin-top: $space-2; }
  .primary { @include button-primary; & { padding-inline: $space-12; } }
  .ghost { @include button-ghost; & { color: $color-on-dark; border-color: rgba(255, 255, 255, 0.35); } &:hover { background: rgba(255, 255, 255, 0.08); } }
  .sign {
    display: flex; align-items: center; gap: $space-4; margin-top: $space-8; text-align: left;
    padding-top: $space-8; border-top: 1px solid $color-on-dark-hairline;
    img { width: 150px; height: auto; filter: invert(1); mix-blend-mode: screen; }
    p { margin: 0; font-family: $font-sans; }
  }
  .signoff { color: $color-on-dark-muted; font-size: 0.95rem; }
  .name { font-weight: 700; font-size: 1.25rem; letter-spacing: -0.01em; }
  .role { color: $color-on-dark-muted; font-size: 0.875rem; }
</style>
