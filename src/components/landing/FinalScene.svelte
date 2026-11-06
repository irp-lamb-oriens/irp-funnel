<script lang="ts">
  /**
   * Scene 13, back to booking. The closing line sets word by word, Pablo's
   * signature writes itself, and "Book your call" rewinds the whole page
   * to the booking form at the top.
   */
  import { scene, seg, easeOut } from './scene.ts';
  import { rewindToBooking } from './reveal.ts';
  import { FINAL, IMG, LILI_WHATSAPP } from './content.ts';

  let p = 0;
  const words = FINAL.title.split(' ');
  $: wf = seg(p, 0.04, 0.4) * words.length;
  $: bodyIn = easeOut(seg(p, 0.36, 0.5));
  $: actions = easeOut(seg(p, 0.46, 0.6));
  $: sign = seg(p, 0.55, 0.85);
</script>

<section id="book" class="scene" style="--len:2.4" use:scene={(v) => (p = v)} aria-labelledby="book-title">
  <div class="stage">
    <div class="glow" aria-hidden="true" style="opacity:{0.4 + p * 0.6}; transform: scale({0.9 + p * 0.2})"></div>
    <div class="wrap inner">
      <p class="eyebrow"><span class="dot" aria-hidden="true"></span>{FINAL.eyebrow}</p>
      <h2 class="title" id="book-title">
        {#each words as w, i}
          {@const f = Math.min(1, Math.max(0, wf - i))}
          <span class="w" style="opacity:{0.12 + f * 0.88}; transform: translateY({(1 - f) * 0.25}em)">{w}</span>{' '}
        {/each}
      </h2>
      <p class="body" style="opacity:{bodyIn}; transform: translateY({(1 - bodyIn) * 14}px)">{FINAL.body}</p>
      <div class="actions" style="opacity:{actions}; transform: translateY({(1 - actions) * 14}px)">
        <a class="primary" href="#hero-form" on:click={rewindToBooking}>{FINAL.primary} <span aria-hidden="true">↑</span></a>
        <a class="ghost" href={LILI_WHATSAPP} target="_blank" rel="noopener">{FINAL.secondary}</a>
      </div>
      <div class="sign">
        <p class="signoff">{FINAL.signoff}</p>
        <img src={IMG.signature} alt="Signature of {FINAL.name}" width="184" height="81" style="clip-path: inset(0 {(1 - sign) * 100}% 0 0)" />
        <p class="name">{FINAL.name}</p>
        <p class="role">{FINAL.role}</p>
      </div>
    </div>
  </div>
</section>

<style lang="scss">
  @use './tokens' as *;

  .scene { @include scene-shell; background: $color-ink-strong; color: $color-on-dark; }
  .stage { @include stage; display: flex; align-items: center; padding-top: $header-clear; padding-bottom: 6.5rem; isolation: isolate; }
  .glow { position: absolute; inset: 0; z-index: -1; pointer-events: none;
    background: radial-gradient(45% 55% at 50% 105%, rgba(2, 181, 187, 0.45), transparent 70%); }
  .wrap { @include container; }
  .inner { max-width: 1000px; text-align: center; display: flex; flex-direction: column; align-items: center; gap: $space-6; }
  .eyebrow { @include eyebrow; color: $color-on-dark; display: inline-flex; align-items: center; gap: $space-2; }
  .dot { width: 6px; height: 6px; border-radius: 50%; background: $color-accent; }
  .title { margin: 0; font: 800 clamp(2.5rem, 6.4vw, 5.5rem)/1 $font-sans; letter-spacing: -0.045em; }
  .w { display: inline-block; font-family: $font-sans; will-change: transform, opacity; }
  .body { margin: 0; font: clamp(1.1rem, 1.8vw, 1.4rem)/1.55 $font-sans; color: $color-on-dark-muted; max-width: 36ch; }
  .actions { display: flex; flex-wrap: wrap; justify-content: center; gap: $space-3; }
  .primary { @include button-primary; & { padding-inline: $space-12; } }
  .ghost { @include button-ghost; & { color: $color-on-dark; border-color: rgba(255, 255, 255, 0.35); } &:hover { background: rgba(255, 255, 255, 0.08); } }
  .sign { display: flex; flex-direction: column; align-items: center; gap: 4px; margin-top: $space-4; padding-top: $space-6; border-top: 1px solid $color-on-dark-hairline;
    p { margin: 0; font-family: $font-sans; }
    img { width: 220px; height: auto; }
  }
  .signoff { color: $color-on-dark-muted; font-size: 0.95rem; }
  .name { font-weight: 700; font-size: 1.15rem; }
  .role { color: $color-on-dark-muted; font-size: 0.85rem; }

  :global(.rm) {
    .stage { padding-block: $space-24; }
    .w, .body, .actions { opacity: 1 !important; transform: none !important; }
    .sign img { clip-path: none !important; }
  }
</style>
