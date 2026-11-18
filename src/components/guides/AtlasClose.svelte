<script lang="ts">
  /**
   * Close: from reading the rules to planning the move. Same ink field and
   * bottom glow as the home's closing scene. The line sets word by word as
   * it comes into view; below it, the six countries where IRP has a team,
   * as a list like the home's country navigation.
   */
  import { reveal } from '../landing/reveal.ts';
  import { LILI_WHATSAPP } from '../landing/content.ts';

  const TITLE = 'A guide tells you the rules. We plan the move around them.';
  const TEAM = [
    { name: 'Costa Rica', href: '/costa-rica', note: 'Alajuela and Guanacaste', tours: true },
    { name: 'Panama', href: '/panama', note: 'Panama City', tours: true },
    { name: 'Mexico', href: '/mexico', note: 'Mexico City' },
    { name: 'Spain', href: '/spain', note: 'Madrid' },
    { name: 'Portugal', href: '/portugal', note: 'Remote consulting' },
    { name: 'Colombia', href: '/colombia', note: 'Remote consulting' }
  ];
</script>

<section class="close" aria-labelledby="close-title">
  <div class="glow" aria-hidden="true"></div>
  <div class="wrap inner">
    <div class="copy" use:reveal>
      <p class="eyebrow"><span class="dot" aria-hidden="true"></span>Free consultation</p>
      <h2 class="title" id="close-title" aria-label={TITLE}>
        {#each TITLE.split(' ') as w, i}
          <span class="w" aria-hidden="true"><span style="--i:{i}">{w}</span></span>{' '}
        {/each}
      </h2>
      <p class="body">In a 60-minute call we go through the rules that apply to your shipment, your car and your pets, and write you a plan with the steps and the cost.</p>
      <div class="actions">
        <a class="primary" href="/consultation">Book a consultation <span aria-hidden="true">→</span></a>
        <a class="ghost" href={LILI_WHATSAPP} target="_blank" rel="noopener">Message Lily on WhatsApp</a>
      </div>
    </div>

    <nav class="team" aria-label="Countries where IRP has a team" use:reveal>
      <p class="team-label">Where we have a team</p>
      <ol>
        {#each TEAM as c, i}
          <li style="--i:{i}">
            <a href={c.href}>
              <span class="c-n">0{i + 1}</span>
              <span class="c-name">{c.name}</span>
              <span class="c-note">{c.note}{#if c.tours}<em>Tours</em>{/if}</span>
              <i aria-hidden="true">→</i>
            </a>
          </li>
        {/each}
      </ol>
    </nav>
  </div>
</section>

<style lang="scss">
  @use '../landing/tokens' as *;

  .close { position: relative; isolation: isolate; overflow: hidden; background: $color-ink-strong; color: $color-on-dark; @include section; }
  .glow { position: absolute; inset: 0; z-index: -1; pointer-events: none;
    background: radial-gradient(50% 60% at 30% 110%, rgba(2, 181, 187, 0.42), transparent 70%); }
  .wrap { @include container; }
  .inner { display: grid; gap: $space-16; @include lg { grid-template-columns: 1.15fr 0.85fr; gap: $space-24; align-items: end; } }
  .copy { display: flex; flex-direction: column; gap: $space-6; align-items: flex-start; }
  .eyebrow { @include eyebrow; color: $color-on-dark; display: inline-flex; align-items: center; gap: $space-2; }
  .dot { width: 6px; height: 6px; border-radius: 50%; background: $color-accent; }
  .title { margin: 0; font: 800 clamp(2.2rem, 4.6vw, 4rem)/1 $font-sans; letter-spacing: -0.045em; }
  .w { display: inline-block; overflow: hidden; vertical-align: top; padding-bottom: 0.08em; margin-bottom: -0.08em; }
  .w > span { display: inline-block; transform: translateY(105%); transition: transform 1s $ease calc(var(--i) * 55ms); }
  .copy:global(.is-in) .w > span { transform: none; }
  .body { margin: 0; max-width: 46ch; font: clamp(1.02rem, 1.5vw, 1.2rem)/1.6 $font-sans; color: $color-on-dark-muted;
    opacity: 0; transform: translateY(14px); transition: opacity 800ms $ease 450ms, transform 900ms $ease 450ms; }
  .actions { display: flex; flex-wrap: wrap; gap: $space-3;
    opacity: 0; transform: translateY(14px); transition: opacity 800ms $ease 600ms, transform 900ms $ease 600ms; }
  .copy:global(.is-in) .body, .copy:global(.is-in) .actions { opacity: 1; transform: none; }
  .primary { @include button-primary; & { padding-inline: $space-8; }
    span { display: inline-block; transition: transform 400ms $ease; } &:hover span { transform: translateX(4px); } }
  .ghost { @include button-ghost; & { color: $color-on-dark; border-color: rgba(255, 255, 255, 0.35); } &:hover { background: rgba(255, 255, 255, 0.08); } }

  .team-label { @include eyebrow; color: $color-on-dark-muted; margin-bottom: $space-3; }
  ol { list-style: none; margin: 0; padding: 0; border-top: 1px solid $color-on-dark-hairline; }
  li { border-bottom: 1px solid $color-on-dark-hairline;
    opacity: 0; transform: translateY(12px); transition: opacity 600ms $ease calc(200ms + var(--i) * 70ms), transform 800ms $ease calc(200ms + var(--i) * 70ms); }
  .team:global(.is-in) li { opacity: 1; transform: none; }
  a { display: grid; grid-template-columns: 32px 1fr auto 20px; align-items: center; gap: $space-3; padding: 14px 0; color: #fff; text-decoration: none; @include focus-ring;
    @media (max-width: 480px) { grid-template-columns: 28px 1fr 20px; .c-note { display: none; } } }
  .c-n { font: 0.68rem $font-mono; color: $color-on-dark-muted; }
  .c-name { font: 700 1.15rem $font-sans; letter-spacing: -0.02em; transition: transform 500ms $ease; }
  .c-note { display: inline-flex; align-items: center; gap: 8px; font: 0.8rem $font-sans; color: $color-on-dark-muted;
    em { font: normal 0.58rem $font-mono; letter-spacing: 0.12em; text-transform: uppercase; color: $color-accent; border: 1px solid $color-accent; padding: 2px 7px; border-radius: 99px; } }
  i { font-style: normal; transition: transform 400ms $ease, color 300ms; }
  a:hover { .c-name { transform: translateX(6px); } i { transform: translateX(5px); color: $color-accent; } }

  @include reduced-motion {
    .w > span, .body, .actions, li { transform: none !important; opacity: 1 !important; transition: none !important; }
  }
</style>
