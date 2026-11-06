<script lang="ts">
  /**
   * Scene 8, "Your status page". A Relocation Portal window, modelled on the
   * real client status page (routes/status/[id]): the Current Status stepper
   * with the client-visible stages of the pipeline, the date each stage was
   * reached, stars on completed stages (clients rate each stage), and the
   * Activity Log. Scrolling moves the project forward one stage at a time;
   * the stepper pans so the current stage stays in view, as on the portal.
   */
  import { scene, seg, easeOut } from './scene.ts';
  import { TIMELINE } from './content.ts';

  let p = 0;
  const STAGES = TIMELINE.stages;
  const N = STAGES.length;
  const STEP_W = 112;
  // Example dates, one per stage.
  const DATES = ['Mar 4', 'Mar 5', 'Mar 7', 'Mar 9', 'Mar 11', 'Mar 12', 'Apr 2', 'Apr 4', 'Apr 6', 'Apr 29', 'May 1', 'May 6', 'May 8', 'May 13', 'May 14', 'May 15'];

  $: run = seg(p, 0.06, 0.92) * (N - 1);
  $: cur = Math.min(N - 1, Math.floor(run + 0.0001));
  $: pan = Math.max(0, (run - 2.2) * STEP_W);
  $: pct = Math.round((cur / (N - 1)) * 100);
  $: log = Array.from({ length: Math.min(4, cur) }, (_, k) => cur - k).filter((k) => k > 0);
  $: winIn = easeOut(seg(p, 0, 0.08));
</script>

<section id="timeline" class="scene" style="--len:3.6" use:scene={(v) => (p = v)} aria-labelledby="timeline-title">
  <div class="stage">
    <div class="wrap grid">
      <div class="copy">
        <p class="eyebrow"><span class="dot" aria-hidden="true"></span>{TIMELINE.eyebrow}</p>
        <h2 class="title" id="timeline-title">{TIMELINE.title}</h2>
        <p class="lead">{TIMELINE.body}</p>
        <p class="pct" aria-hidden="true"><b>{pct}</b>%<span>{STAGES[cur]}</span></p>
      </div>

      <figure class="portal" aria-hidden="true" style="opacity:{winIn}; transform: perspective(1600px) rotateX({(1 - winIn) * 10}deg) translateY({(1 - winIn) * 40}px)">
        <div class="chrome">
          <i></i><i></i><i></i>
          <span class="url">Your Relocation Portal</span>
          <span class="user">Example client</span>
        </div>
        <div class="body">
          <header class="ph">
            <div><p class="ph-eyebrow">Relocation Portal</p><p class="ph-title">Dallas, TX → San José, Costa Rica</p></div>
            <span class="lily">Chat with Lily</span>
          </header>

          <p class="label">Current Status</p>
          <div class="stepper-wrap">
            <div class="stepper" style="width:{N * STEP_W}px; transform: translate3d({-pan}px, 0, 0)">
              <span class="rail"><i style="transform: scaleX({run / (N - 1)})"></i></span>
              {#each STAGES as s, k}
                <div class="st" class:done={k < cur} class:now={k === cur} style="width:{STEP_W}px">
                  <span class="circle">{k < cur ? '✓' : ''}</span>
                  <b>{s}</b>
                  <small>{k <= cur ? DATES[k] : ''}</small>
                  {#if k < cur}<span class="stars">★★★★★</span>{/if}
                </div>
              {/each}
            </div>
          </div>

          <div class="cols">
            <div class="activity">
              <p class="label">Activity Log</p>
              <ul>
                {#each log as k (k)}
                  <li><span class="arrow">→</span><p>Moved from <strong>{STAGES[k - 1]}</strong> to <strong>{STAGES[k]}</strong></p><em>{DATES[k]}</em></li>
                {/each}
              </ul>
            </div>
            <div class="next">
              <p class="label">Up next</p>
              <p class="next-stage">{STAGES[Math.min(N - 1, cur + 1)]}</p>
              <p class="next-note">Our team will update you on WhatsApp.</p>
            </div>
          </div>
        </div>
      </figure>
    </div>
  </div>
</section>

<style lang="scss">
  @use './tokens' as *;

  .scene { @include scene-shell; background: $color-mist; }
  .stage { @include stage; display: flex; align-items: center; padding-top: $header-clear; padding-bottom: 6.5rem; }
  .wrap { @include container; }
  .grid { display: grid; gap: $space-8; align-items: center; width: 100%;
    @include lg { grid-template-columns: minmax(0, 4fr) minmax(0, 7fr); gap: $space-12; } }
  .copy { display: flex; flex-direction: column; gap: $space-4; }
  .eyebrow { @include eyebrow; display: inline-flex; align-items: center; gap: $space-2; }
  .dot { width: 6px; height: 6px; border-radius: 50%; background: $color-accent; }
  .title { @include heading-xl; font-size: clamp(1.9rem, 3.4vw, 2.9rem); }
  .lead { @include body; max-width: 42ch; }
  .pct { margin: $space-2 0 0; display: flex; align-items: baseline; gap: 4px; font: 700 1.4rem $font-sans; color: $color-ink-strong;
    b { font: 800 clamp(3rem, 7vw, 5.5rem)/0.9 $font-sans; letter-spacing: -0.05em; font-variant-numeric: tabular-nums; }
    span { margin-left: $space-3; font: 0.72rem $font-mono; letter-spacing: 0.1em; text-transform: uppercase; color: $color-muted; } }

  .portal { margin: 0; border-radius: 16px; overflow: hidden; background: #fff; border: 1px solid $color-hairline; font-family: $font-sans;
    box-shadow: 0 60px 100px -50px rgba(14, 47, 54, 0.55); transform-origin: 50% 100%; will-change: transform; }
  .chrome { display: flex; align-items: center; gap: 6px; padding: 10px 14px; background: $color-ink-strong; color: #fff;
    i { width: 10px; height: 10px; border-radius: 50%; background: rgba(255, 255, 255, 0.25); }
    .url { margin-left: 10px; font: 700 0.78rem $font-sans; }
    .user { margin-left: auto; font: 0.7rem $font-sans; color: rgba(255, 255, 255, 0.7); } }
  .body { padding: 18px 20px 20px; }
  .ph { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding-bottom: 14px; border-bottom: 1px solid $color-hairline; margin-bottom: 14px; }
  .ph-eyebrow { margin: 0; font: 0.6rem $font-mono; letter-spacing: 0.12em; text-transform: uppercase; color: $color-accent-hover; }
  .ph-title { margin: 2px 0 0; font: 700 1rem $font-sans; color: $color-ink-strong; }
  .lily { padding: 8px 14px; border-radius: 999px; background: $color-accent; color: $color-ink-strong; font: 700 0.72rem $font-sans; white-space: nowrap; }
  .label { margin: 0 0 10px; font: 700 0.6rem $font-mono; letter-spacing: 0.12em; text-transform: uppercase; color: $color-ink-strong; }

  .stepper-wrap { position: relative; overflow: hidden; margin: 0 -20px 16px; padding: 4px 20px 6px;
    -webkit-mask-image: linear-gradient(90deg, transparent, #000 4%, #000 90%, transparent);
    mask-image: linear-gradient(90deg, transparent, #000 4%, #000 90%, transparent); }
  .stepper { list-style: none; margin: 0; padding: 0; display: flex; position: relative; will-change: transform; transition: transform 500ms $ease; }
  .rail { position: absolute; left: 56px; right: 56px; top: 12px; height: 3px; border-radius: 2px; background: $color-hairline;
    i { position: absolute; inset: 0; background: $color-accent; transform-origin: left; border-radius: 2px; } }
  .stepper .st { position: relative; flex: none; display: flex; flex-direction: column; align-items: center; gap: 4px; text-align: center; padding: 0 6px; }
  .circle { width: 26px; height: 26px; border-radius: 50%; display: grid; place-items: center; background: #fff; border: 2px solid $color-hairline-strong;
    font: 800 0.7rem $font-sans; color: $color-ink-strong; z-index: 1; transition: all 350ms $ease; }
  .stepper b { font: 600 0.66rem/1.25 $font-sans; color: $color-muted; min-height: 2.5em; }
  .stepper small { font: 0.58rem $font-mono; color: $color-muted; min-height: 0.8rem; }
  .stars { font-size: 0.55rem; letter-spacing: 1px; color: #f5a623; }
  .done .circle { background: $color-accent; border-color: $color-accent; }
  .done b { color: $color-ink-strong; }
  .now .circle { border: 3px solid $color-accent; animation: pulse 1.6s ease-out infinite; }
  .now b { color: $color-ink-strong; font-weight: 800; }
  @keyframes pulse { 0% { box-shadow: 0 0 0 0 rgba(2, 181, 187, 0.45); } 100% { box-shadow: 0 0 0 12px rgba(2, 181, 187, 0); } }

  .cols { display: grid; grid-template-columns: 1.5fr 1fr; gap: 16px; }
  .activity ul { list-style: none; margin: 0; padding: 0; min-height: 150px; }
  .activity li { display: grid; grid-template-columns: 18px 1fr auto; gap: 8px; align-items: baseline; padding: 8px 0; border-top: 1px solid $color-hairline;
    animation: slide 450ms $ease both;
    p { margin: 0; font: 0.74rem/1.35 $font-sans; color: $color-steel; strong { color: $color-ink-strong; } }
    em { font: normal 0.6rem $font-mono; color: $color-muted; } }
  .arrow { color: $color-accent-hover; font-weight: 800; }
  @keyframes slide { from { opacity: 0; transform: translateY(-8px); } }
  .next { padding: 12px; border-radius: 12px; background: $color-mist; align-self: start; }
  .next-stage { margin: 0; font: 800 0.95rem $font-sans; color: $color-ink-strong; }
  .next-note { margin: 4px 0 0; font: 0.7rem/1.4 $font-sans; color: $color-steel; }

  @media (max-width: 1023px) {
    .cols { grid-template-columns: 1fr; }
    .next { display: none; }
  }
  @include reduced-motion { .now .circle, .activity li { animation: none; } .stepper { transition: none; } }

  :global(.rm) {
    .stage { padding-block: $space-24; }
    .portal { opacity: 1 !important; transform: none !important; }
  }
</style>
