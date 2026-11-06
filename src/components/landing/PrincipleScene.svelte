<script lang="ts">
  /**
   * Scene 6, "A well-planned project" (no photo). On a blueprint grid the
   * sentence fills word by word, then line drawings plan the move: boxes,
   * a container, a ship, the route, the house at the end of it. The grid
   * turns from ink to paper white as the plan completes.
   */
  import { scene, seg, easeOut, easeInOut } from './scene.ts';
  import { PRINCIPLE } from './content.ts';

  let p = 0;
  const words = PRINCIPLE.title.split(' ');
  $: fill = seg(p, 0.02, 0.32) * words.length;
  $: d = (a: number, b: number) => 1 - easeInOut(seg(p, a, b));
  $: fade = (a: number, b: number) => 1 - seg(p, a, b);
  $: day = easeInOut(seg(p, 0.86, 0.98));
  $: bodyIn = easeOut(seg(p, 0.8, 0.92));
</script>

<section id="principle" class="scene" style="--len:3.6; --day:{day}" use:scene={(v) => (p = v)} aria-labelledby="principle-title">
  <div class="stage">
    <div class="grid-bg" aria-hidden="true" style="transform: translate3d(0, {-p * 80}px, 0)"></div>
    <div class="paper" aria-hidden="true" style="opacity:{day}"></div>
    <div class="wrap inner">
      <h2 class="sentence" id="principle-title">
        {#each words as w, i}
          <span class="w" style="--f:{Math.min(1, Math.max(0, fill - i))}">{w}</span>{' '}
        {/each}
      </h2>

      <svg class="plan" viewBox="0 0 900 260" aria-hidden="true">
        <!-- boxes -->
        <g style="opacity:{fade(0.5, 0.56)}">
          <path pathLength="1" style="stroke-dashoffset:{d(0.32, 0.42)}" d="M300 230 h80 v-70 h-80 z M300 160 l18 -16 h80 l-18 16 M380 160 l18 -16 v70 l-18 16" />
          <path pathLength="1" style="stroke-dashoffset:{d(0.35, 0.45)}" d="M400 230 h80 v-56 h-80 z M400 174 l16 -14 h80 l-16 14 M480 174 l16 -14 v56 l-16 14" />
          <path pathLength="1" style="stroke-dashoffset:{d(0.38, 0.48)}" d="M500 230 h70 v-90 h-70 z M535 140 v90" />
        </g>
        <!-- container (stays, rides the ship) -->
        <g style="opacity:{fade(0.74, 0.79)}; transform: translate({easeInOut(seg(p, 0.6, 0.7)) * 0}px, {-easeInOut(seg(p, 0.6, 0.7)) * 22}px)">
          <path pathLength="1" style="stroke-dashoffset:{d(0.46, 0.58)}" d="M330 210 h240 v-80 h-240 z M330 130 l30 -24 h240 l-30 24 M570 130 l30 -24 v80 l-30 24" />
          <path pathLength="1" style="stroke-dashoffset:{d(0.5, 0.6)}" d="M360 140 v62 M390 140 v62 M420 140 v62 M450 140 v62 M480 140 v62 M510 140 v62 M540 140 v62" />
        </g>
        <!-- ship -->
        <g style="opacity:{fade(0.74, 0.79)}">
          <path pathLength="1" style="stroke-dashoffset:{d(0.58, 0.7)}" d="M200 190 h520 l-50 56 h-420 z M640 190 v-60 h40 v60 M650 130 v-20 h20 v20" />
          <path pathLength="1" style="stroke-dashoffset:{d(0.62, 0.72)}" d="M150 252 q30 -10 60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0" />
        </g>
        <!-- route to the house -->
        <path class="route" pathLength="1" style="stroke-dashoffset:{d(0.76, 0.88)}" d="M40 200 C 200 120, 300 250, 450 170 S 700 110, 770 170" />
        <circle cx="40" cy="200" r="7" class="pin" style="opacity:{seg(p, 0.76, 0.78)}" />
        <path pathLength="1" style="stroke-dashoffset:{d(0.84, 0.94)}" d="M740 200 L790 156 L840 200 M752 190 V246 H828 V190 M780 246 V216 H800 V246" />
      </svg>

      <p class="body" style="opacity:{bodyIn}; transform: translateY({(1 - bodyIn) * 16}px)">{PRINCIPLE.body}</p>
    </div>
  </div>
</section>

<style lang="scss">
  @use './tokens' as *;

  .scene { @include scene-shell; background: $color-ink-strong; }
  .stage { @include stage; display: flex; align-items: center; padding-top: $header-clear; padding-bottom: 6.5rem; isolation: isolate; }
  .grid-bg {
    position: absolute; inset: -100px 0; z-index: -2;
    background-image:
      linear-gradient(rgba(2, 181, 187, 0.14) 1px, transparent 1px),
      linear-gradient(90deg, rgba(2, 181, 187, 0.14) 1px, transparent 1px),
      linear-gradient(rgba(2, 181, 187, 0.06) 1px, transparent 1px),
      linear-gradient(90deg, rgba(2, 181, 187, 0.06) 1px, transparent 1px);
    background-size: 120px 120px, 120px 120px, 24px 24px, 24px 24px;
  }
  .paper { position: absolute; inset: 0; z-index: -1; background: $color-canvas; }
  .wrap { @include container; }
  .inner { display: flex; flex-direction: column; align-items: center; text-align: center; gap: $space-6; }

  .sentence {
    margin: 0; max-width: 18ch; font: 800 clamp(2.2rem, 6vw, 5.2rem)/1.02 $font-sans; letter-spacing: -0.045em;
  }
  .w {
    display: inline-block; font-family: $font-sans;
    /* outline until spoken, then filled; ink on the paper at the end */
    color: color-mix(in srgb, transparent calc((1 - var(--f)) * 100%), color-mix(in srgb, #fff calc((1 - var(--day)) * 100%), #{$color-ink-strong}));
    -webkit-text-stroke: 1.2px color-mix(in srgb, rgba(255, 255, 255, 0.45) calc((1 - var(--day)) * 100%), #{$color-ink-strong});
    transform: translateY(calc((1 - var(--f)) * 8px));
  }
  .plan { width: min(900px, 100%); height: auto; overflow: visible;
    path { fill: none; stroke: color-mix(in srgb, #fff calc((1 - var(--day)) * 100%), #{$color-ink-strong}); stroke-width: 2.5; stroke-linecap: round; stroke-linejoin: round; stroke-dasharray: 1; }
    .route { stroke: $color-accent; stroke-width: 4; }
    .pin { fill: $color-accent; }
  }
  .body { @include body; font-size: clamp(1.05rem, 1.6vw, 1.3rem); max-width: 48ch; color: color-mix(in srgb, rgba(255, 255, 255, 0.75) calc((1 - var(--day)) * 100%), #{$color-steel}); }

  :global(.rm) {
    .stage { padding-block: $space-24; }
    .grid-bg { display: none; }
    .paper { opacity: 1 !important; }
  }
</style>
