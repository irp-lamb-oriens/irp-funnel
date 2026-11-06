<script lang="ts">
  /**
   * Scene 8, "Your project timeline". The accepted planner drops into the
   * timeline, then the route runs down through each step: done steps tick,
   * the current one pulses, the progress figure counts up.
   */
  import { scene, seg, easeOut, easeInOut } from './scene.ts';
  import { TIMELINE } from './content.ts';

  let p = 0;
  const N = TIMELINE.steps.length;
  $: drop = easeInOut(seg(p, 0.02, 0.18));
  $: run = seg(p, 0.16, 0.9);
  $: reached = run * (N - 1);
  $: current = Math.min(N - 1, Math.floor(reached + 0.02));
  $: pct = Math.round(run * 100);
</script>

<section id="timeline" class="scene" style="--len:3" use:scene={(v) => (p = v)} aria-labelledby="timeline-title">
  <div class="stage">
    <div class="wrap grid">
      <div class="copy">
        <p class="eyebrow"><span class="dot" aria-hidden="true"></span>{TIMELINE.eyebrow}</p>
        <h2 class="title" id="timeline-title">{TIMELINE.title}</h2>
        <p class="lead">{TIMELINE.body}</p>
        <p class="pct" aria-hidden="true"><b>{pct}</b>%<span>of the example project</span></p>
      </div>

      <div class="board">
        <div class="chip" aria-hidden="true" style="opacity:{1 - seg(p, 0.16, 0.2)}; transform: translate({(1 - drop) * 60}px, {(1 - drop) * -120 + drop * 64}px) rotate({(1 - drop) * 8}deg) scale({1 - drop * 0.2})">
          ✓ Project Planner accepted
        </div>
        <div class="steps-wrap">
        <span class="rail" aria-hidden="true"><i style="transform: scaleY({run})"></i></span>
        <ol class="steps">
          {#each TIMELINE.steps as s, i}
            {@const state = i < current || (i === N - 1 && run >= 1) ? 'done' : i === current ? 'now' : 'next'}
            <li class="step {state}">
              <span class="marker" aria-hidden="true">{state === 'done' ? '✓' : ''}</span>
              <span class="name">{s.title}</span>
              <span class="meta">{state === 'done' ? 'Done' : state === 'now' ? 'In progress' : 'Next'}</span>
            </li>
          {/each}
        </ol>
        </div>
      </div>
    </div>
  </div>
</section>

<style lang="scss">
  @use './tokens' as *;

  .scene { @include scene-shell; background: $color-mist; }
  .stage { @include stage; display: flex; align-items: center; padding-top: $header-clear; padding-bottom: 6.5rem; }
  .wrap { @include container; }
  .grid { display: grid; gap: $space-8; align-items: center; width: 100%;
    @include lg { grid-template-columns: minmax(0, 5fr) minmax(0, 6fr); gap: $space-16; }
  }
  .copy { display: flex; flex-direction: column; gap: $space-4; }
  .eyebrow { @include eyebrow; display: inline-flex; align-items: center; gap: $space-2; }
  .dot { width: 6px; height: 6px; border-radius: 50%; background: $color-accent; }
  .title { @include heading-xl; font-size: clamp(1.9rem, 3.6vw, 3rem); }
  .lead { @include body; max-width: 42ch; }
  .pct { margin: $space-4 0 0; display: flex; align-items: baseline; gap: 4px; font: 700 1.5rem $font-sans; color: $color-ink-strong;
    b { font: 800 clamp(3.5rem, 8vw, 6.5rem)/0.9 $font-sans; letter-spacing: -0.05em; font-variant-numeric: tabular-nums; }
    span { margin-left: $space-3; font: 0.75rem $font-mono; letter-spacing: 0.1em; text-transform: uppercase; color: $color-muted; }
  }

  .board { position: relative; @include card; padding: clamp(1.5rem, 3vw, 2.5rem); box-shadow: 0 50px 90px -50px rgba(14, 47, 54, 0.45); }
  .chip {
    position: absolute; left: 50%; top: -18px; margin-left: -120px; width: 240px; z-index: 2; text-align: center;
    padding: 10px 14px; border-radius: 999px; background: $color-accent; color: $color-ink-strong; font: 700 0.85rem $font-sans;
    box-shadow: 0 20px 30px -15px rgba(14, 47, 54, 0.5);
  }
  .steps-wrap { position: relative; }
  .steps { list-style: none; margin: 0; padding: 0; position: relative; }
  .rail { position: absolute; left: 17px; top: 28px; bottom: 28px; width: 3px; border-radius: 2px; background: $color-hairline;
    i { position: absolute; inset: 0; background: $color-accent; transform-origin: top; border-radius: 2px; }
  }
  .step { position: relative; display: grid; grid-template-columns: 38px 1fr auto; gap: $space-4; align-items: center; padding: clamp(0.7rem, 1.6vh, 1.1rem) 0; }
  .marker { width: 36px; height: 36px; border-radius: 50%; display: grid; place-items: center; background: #fff; border: 2px solid $color-hairline-strong;
    font-size: 0.9rem; color: $color-ink-strong; z-index: 1; transition: all 350ms $ease; }
  .name { font: 600 clamp(1rem, 1.5vw, 1.2rem) $font-sans; color: $color-muted; transition: color 300ms; }
  .meta { font: 0.7rem $font-mono; letter-spacing: 0.1em; text-transform: uppercase; color: $color-muted; }
  .done { .marker { background: $color-accent; border-color: $color-accent; } .name { color: $color-ink-strong; } }
  .now {
    .marker { border: 3px solid $color-accent; animation: pulse 1.6s ease-out infinite; }
    .name { color: $color-ink-strong; font-weight: 800; }
    .meta { color: $color-accent-hover; }
  }
  @keyframes pulse { 0% { box-shadow: 0 0 0 0 rgba(2, 181, 187, 0.45); } 100% { box-shadow: 0 0 0 14px rgba(2, 181, 187, 0); } }

  :global(.rm) {
    .stage { padding-block: $space-24; }
    .chip { display: none; }
    .now .marker { animation: none; }
  }
</style>
