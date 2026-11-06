<script lang="ts">
  /**
   * Scene 7, "What your project includes". The list on the left lights one
   * item at a time while the Project Planner on the right builds the part
   * it describes: costs, the timeline, the specialist, the scope note, and
   * at the end the Accept button presses itself.
   */
  import { scene, seg, easeOut } from './scene.ts';
  import { INCLUDES } from './content.ts';

  let p = 0;
  const N = INCLUDES.items.length;
  $: ip = seg(p, 0.04, 0.9) * N;
  $: a = Math.min(N - 1, Math.floor(ip));
  $: part = (i: number) => easeOut(seg(ip, i, i + 0.6));
  $: accepted = p > 0.93;
  const COSTS = ['Moving and shipping', 'Duties and port fees', 'Documentation', 'Consulting'];
  const STEPS = ['Call', 'Plan', 'Documents', 'Customs', 'Delivery'];
</script>

<section id="includes" class="scene" style="--len:4" use:scene={(v) => (p = v)} aria-labelledby="includes-title">
  <div class="stage">
    <div class="wrap grid">
      <div class="copy">
        <p class="eyebrow"><span class="dot" aria-hidden="true"></span>{INCLUDES.eyebrow}</p>
        <h2 class="title" id="includes-title">{INCLUDES.title}</h2>
        <ol class="list">
          {#each INCLUDES.items as f, i}
            <li class:on={a === i} class:done={a > i}>
              <span class="idx">0{i + 1}</span>
              <div>
                <h3>{f.title}</h3>
                <p>{f.body}</p>
              </div>
            </li>
          {/each}
        </ol>
      </div>

      <figure class="planner" aria-hidden="true" style="transform: perspective(1400px) rotateY({(1 - easeOut(seg(p, 0, 0.12))) * -18}deg) translateY({(1 - easeOut(seg(p, 0, 0.12))) * 40}px)">
        <header class="pl-head">
          <span class="pl-logo">IRP</span>
          <div><p class="pl-title">Project Planner</p><p class="pl-sub">Example</p></div>
          <span class="pl-status" class:ok={accepted}>{accepted ? 'Accepted' : 'Draft'}</span>
        </header>

        <div class="pl-block" style="opacity:{0.25 + 0.75 * part(0)}">
          <p class="pl-label">Estimated costs</p>
          {#each COSTS as c, k}
            <div class="pl-row"><span>{c}</span><i style="transform: scaleX({easeOut(seg(ip, k * 0.12, k * 0.12 + 0.5)) * (0.4 + ((k * 37) % 50) / 100)})"></i></div>
          {/each}
        </div>

        <div class="pl-block" style="opacity:{0.25 + 0.75 * part(1)}">
          <p class="pl-label">Timeline</p>
          <div class="pl-steps">
            {#each STEPS as s, k}<span class:lit={ip - 1 > k * 0.15}>{s}</span>{/each}
          </div>
        </div>

        <div class="pl-split">
          <div class="pl-block pl-person" style="opacity:{0.25 + 0.75 * part(2)}; transform: translateY({(1 - part(2)) * 12}px)">
            <span class="badge">CS</span>
            <div><p class="pl-label">Your consulting specialist</p><p class="pl-text">Questions, payments and timing</p></div>
          </div>
          <div class="pl-block pl-note" style="opacity:{part(3)}; transform: translateX({(1 - part(3)) * 30}px)">
            <p class="pl-label">Scope change</p>
            <p class="pl-text">We confirm with you before the bill changes.</p>
          </div>
        </div>

        <div class="pl-foot">
          <span class="accept" class:pressed={accepted}>{accepted ? '✓ Accepted' : 'Accept project'}</span>
        </div>
      </figure>
    </div>
  </div>
</section>

<style lang="scss">
  @use './tokens' as *;

  .scene { @include scene-shell; background: $color-canvas; }
  .stage { @include stage; display: flex; align-items: center; padding-top: $header-clear; padding-bottom: 6.5rem; }
  .wrap { @include container; }
  .grid { display: grid; gap: $space-8; align-items: center; width: 100%;
    @include lg { grid-template-columns: minmax(0, 5fr) minmax(0, 6fr); gap: $space-16; }
  }
  .copy { display: flex; flex-direction: column; gap: $space-4; }
  .eyebrow { @include eyebrow; display: inline-flex; align-items: center; gap: $space-2; }
  .dot { width: 6px; height: 6px; border-radius: 50%; background: $color-accent; }
  .title { @include heading-xl; font-size: clamp(1.9rem, 3.6vw, 3rem); }
  .list { list-style: none; margin: $space-4 0 0; padding: 0; display: flex; flex-direction: column; border-top: 1px solid $color-hairline; }
  .list li {
    display: grid; grid-template-columns: 40px 1fr; gap: $space-3; padding: $space-4 0; border-bottom: 1px solid $color-hairline;
    opacity: 0.35; transition: opacity 400ms $ease;
    h3 { @include heading-md; font-size: clamp(1.1rem, 1.6vw, 1.35rem); }
    p { @include body; font-size: 0.975rem; max-height: 0; overflow: hidden; opacity: 0; transition: max-height 500ms $ease, opacity 400ms, margin 500ms $ease; }
    &.on { opacity: 1; p { max-height: 6rem; opacity: 1; margin-top: $space-2; } }
    &.done { opacity: 0.6; }
  }
  .idx { font: 0.75rem $font-mono; color: $color-accent-hover; padding-top: 4px; }

  .planner {
    margin: 0; padding: clamp(1.25rem, 2.4vw, 2rem); border-radius: 18px; background: #fff; border: 1px solid $color-hairline;
    box-shadow: 0 50px 90px -50px rgba(14, 47, 54, 0.5); display: flex; flex-direction: column; gap: $space-4;
    transform-origin: left center; will-change: transform;
    @media (max-width: 1023px) { display: none; }
  }
  .pl-head { display: flex; align-items: center; gap: $space-3; padding-bottom: $space-3; border-bottom: 1px solid $color-hairline; }
  .pl-logo { width: 40px; height: 40px; border-radius: 10px; display: grid; place-items: center; background: $color-ink-strong; color: $color-accent; font: 800 0.8rem $font-mono; }
  .pl-title { margin: 0; font: 700 1rem $font-sans; color: $color-ink-strong; }
  .pl-sub { margin: 0; font: 0.7rem $font-mono; letter-spacing: 0.12em; text-transform: uppercase; color: $color-muted; }
  .pl-status { margin-left: auto; padding: 5px 12px; border-radius: 999px; font: 700 0.75rem $font-sans; background: $color-mist; color: $color-steel; transition: all 400ms $ease;
    &.ok { background: #e8f4ef; color: #1f7a5c; }
  }
  .pl-block { transition: opacity 300ms; }
  .pl-label { margin: 0 0 8px; font: 0.7rem $font-mono; letter-spacing: 0.12em; text-transform: uppercase; color: $color-ink-strong; }
  .pl-row { display: grid; grid-template-columns: 170px 1fr; gap: 12px; align-items: center; padding: 6px 0;
    span { font: 0.9rem $font-sans; color: $color-ink; }
    i { height: 8px; border-radius: 4px; background: linear-gradient(90deg, $color-accent, rgba(2, 181, 187, 0.4)); transform-origin: left; }
  }
  .pl-steps { display: flex; gap: 6px;
    span { flex: 1; text-align: center; padding: 8px 4px; border-radius: 8px; background: $color-mist; font: 600 0.75rem $font-sans; color: $color-muted; transition: all 300ms $ease; }
    span.lit { background: $color-ink-strong; color: #fff; }
  }
  .pl-split { display: grid; grid-template-columns: 1fr 1fr; gap: $space-3; }
  .pl-person { display: flex; gap: 12px; align-items: center; padding: 12px; border-radius: 12px; background: $color-mist; }
  .badge { width: 44px; height: 44px; flex: none; border-radius: 50%; display: grid; place-items: center; background: $color-accent; color: $color-ink-strong; font: 800 0.85rem $font-sans; }
  .pl-text { margin: 0; font: 0.85rem/1.4 $font-sans; color: $color-steel; }
  .pl-note { padding: 12px; border-radius: 12px; border: 1px dashed $color-red; background: #fbecea; .pl-label { color: $color-red; } }
  .pl-foot { display: flex; justify-content: flex-end; padding-top: $space-3; border-top: 1px solid $color-hairline; }
  .accept { padding: 10px 22px; border-radius: 999px; background: $color-ink-strong; color: #fff; font: 700 0.9rem $font-sans; transition: all 350ms $ease;
    &.pressed { background: $color-accent; color: $color-ink-strong; transform: scale(0.96); box-shadow: 0 0 0 6px rgba(2, 181, 187, 0.2); }
  }

  :global(.rm) {
    .stage { padding-block: $space-24; }
    .list li { opacity: 1; p { max-height: none; opacity: 1; margin-top: $space-2; } }
    .planner { transform: none !important; }
  }
</style>
