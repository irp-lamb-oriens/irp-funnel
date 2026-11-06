<script lang="ts">
  /**
   * Scene 3, "How it works". The page turns sideways: four stations on one
   * route line (call, plan, timeline, arrival), each with its own small
   * animation, driven by the scroll.
   */
  import { scene, seg, easeOut, stations } from './scene.ts';
  import { STEPS } from './content.ts';

  let p = 0;
  const N = STEPS.items.length;
  $: st = stations(p, N, 1, 0.8);
  $: x = st.x;
  $: active = Math.round(x);
  $: local = st.local;
  $: route = seg(p, 0.02, 0.98);
  const bars = Array.from({ length: 24 }, (_, i) => 0.3 + 0.7 * Math.abs(Math.sin(i * 1.7)));
</script>

<section id="how" class="scene" style="--len:4.5" use:scene={(v) => (p = v)} aria-labelledby="how-title">
  <div class="stage">
    <header class="head wrap">
      <p class="eyebrow"><span class="dot" aria-hidden="true"></span>{STEPS.eyebrow}</p>
      <h2 class="title" id="how-title">{STEPS.title}</h2>
    </header>

    <div class="viewport">
      <ol class="track" style="--n:{N}; transform: translate3d(calc({-x} * 100vw), 0, 0)">
        {#each STEPS.items as s, i}
          {@const lp = local(i)}
          <li class="panel" class:active={active === i}>
            <span class="ghost" aria-hidden="true" style="transform: translateX({(i - x) * -18}vw)">0{i + 1}</span>
            <div class="panel-grid">
              <div class="text">
                <span class="step">Step {i + 1} of {N}</span>
                <h3>{s.title}</h3>
                <p>{s.body}</p>
              </div>
              <div class="art" aria-hidden="true">
                {#if i === 0}
                  <div class="call">
                    <svg viewBox="0 0 120 120" class="ring">
                      <circle cx="60" cy="60" r="52" class="track-c" />
                      <circle cx="60" cy="60" r="52" class="fill-c" pathLength="1" style="stroke-dashoffset:{1 - easeOut(lp)}" />
                    </svg>
                    <div class="ring-label"><b>60</b><span>min</span></div>
                    <div class="wave">
                      {#each bars as h, k}<i style="--h:{h}; --k:{k}" class:live={active === 0}></i>{/each}
                    </div>
                  </div>
                {:else if i === 1}
                  <div class="doc">
                    <p class="doc-title">Project Planner</p>
                    {#each [0.92, 0.7, 0.84, 0.55, 0.76, 0.62] as w, k}
                      <i style="width:{w * 100}%; transform: scaleX({easeOut(seg(lp, k * 0.1, k * 0.1 + 0.45))})"></i>
                    {/each}
                    <span class="doc-btn" class:pressed={lp > 0.85}>{lp > 0.85 ? 'Accepted' : 'Accept'}</span>
                  </div>
                {:else if i === 2}
                  <div class="tl">
                    {#each ['Call', 'Plan', 'Documents', 'Customs', 'Delivery'] as label, k}
                      {@const on = lp > k * 0.18 + 0.05}
                      <div class="tl-row" class:on>
                        <span class="tl-dot">{on ? '✓' : ''}</span><span>{label}</span>
                      </div>
                    {/each}
                  </div>
                {:else}
                  <svg class="house" viewBox="0 0 200 180">
                    <path pathLength="1" style="stroke-dashoffset:{1 - easeOut(seg(lp, 0, 0.7))}" d="M20 90 L100 22 L180 90 M40 74 V160 H160 V74 M85 160 V112 H115 V160" />
                    <g class="check" style="opacity:{seg(lp, 0.65, 0.9)}; transform: scale({0.6 + 0.4 * easeOut(seg(lp, 0.65, 0.95))})">
                      <circle cx="160" cy="40" r="22" />
                      <path d="M150 40 l7 7 l13 -14" />
                    </g>
                  </svg>
                {/if}
              </div>
            </div>
          </li>
        {/each}
      </ol>
      <svg class="route" viewBox="0 0 1000 40" preserveAspectRatio="none" aria-hidden="true">
        <path d="M0 20 C 120 4, 220 36, 333 20 S 560 4, 666 20 S 880 36, 1000 20" pathLength="1" style="stroke-dashoffset:{1 - route}" />
        {#each Array(N) as _, i}
          <circle cx={(i / (N - 1)) * 1000} cy="20" r="6" class:lit={route >= i / (N - 1) - 0.01} />
        {/each}
      </svg>
    </div>
  </div>
</section>

<style lang="scss">
  @use './tokens' as *;

  .scene { @include scene-shell; background: $color-accent-soft; }
  .stage { @include stage; display: flex; flex-direction: column; padding-top: $header-clear; padding-bottom: 6.5rem; }
  .wrap { @include container; }
  .head { display: flex; flex-direction: column; gap: $space-3; flex: none; }
  .eyebrow { @include eyebrow; display: inline-flex; align-items: center; gap: $space-2; }
  .dot { width: 6px; height: 6px; border-radius: 50%; background: $color-accent; }
  .title { @include heading-xl; font-size: clamp(1.9rem, 3.6vw, 3rem); max-width: 22ch; }

  .viewport { position: relative; flex: 1; min-height: 0; overflow: hidden; display: flex; flex-direction: column; }
  .track { list-style: none; margin: 0; padding: 0; display: flex; width: calc(var(--n) * 100vw); flex: 1; min-height: 0; will-change: transform; }
  .panel { position: relative; width: 100vw; flex: none; display: flex; align-items: center; }
  .ghost {
    position: absolute; right: 4vw; bottom: -4vh; font: 800 clamp(10rem, 30vw, 26rem) $font-sans; line-height: 0.8;
    letter-spacing: -0.06em; color: transparent; -webkit-text-stroke: 1.5px rgba(14, 47, 54, 0.12); pointer-events: none;
  }
  .panel-grid {
    @include container; position: relative; display: grid; gap: $space-6; align-items: center;
    @include lg { grid-template-columns: minmax(0, 5fr) minmax(0, 6fr); gap: $space-16; }
  }
  .text {
    display: flex; flex-direction: column; gap: $space-3;
    opacity: 0.25; transform: translateY(10px); transition: opacity 500ms $ease, transform 600ms $ease;
    h3 { @include heading-xl; font-size: clamp(1.8rem, 3.4vw, 2.75rem); }
    p { @include body; font-size: 1.125rem; max-width: 42ch; }
  }
  .active .text { opacity: 1; transform: none; }
  .step { font-family: $font-mono; font-size: 0.75rem; letter-spacing: 0.12em; text-transform: uppercase; color: $color-accent-hover; }
  .art { display: grid; place-items: center; min-height: 0; }

  /* Station 1: the call */
  .call { position: relative; display: grid; place-items: center; gap: $space-6; }
  .ring { width: clamp(150px, 20vw, 230px); transform: rotate(-90deg);
    circle { fill: none; stroke-width: 6; }
    .track-c { stroke: rgba(14, 47, 54, 0.1); }
    .fill-c { stroke: $color-accent; stroke-linecap: round; stroke-dasharray: 1; }
  }
  .ring-label { position: absolute; top: 0; height: clamp(150px, 20vw, 230px); display: grid; place-content: center; text-align: center;
    b { font: 800 clamp(2.5rem, 4vw, 3.5rem) $font-sans; color: $color-ink-strong; line-height: 1; letter-spacing: -0.04em; }
    span { font: 0.75rem $font-mono; text-transform: uppercase; letter-spacing: 0.14em; color: $color-muted; }
  }
  .wave { display: flex; align-items: center; gap: 4px; height: 48px;
    i { width: 5px; height: calc(var(--h) * 100%); border-radius: 3px; background: $color-ink-strong; opacity: 0.8; transform: scaleY(0.4); transition: transform 400ms; }
    i.live { animation: talk 900ms ease-in-out infinite; animation-delay: calc(var(--k) * -73ms); }
  }
  @keyframes talk { 0%, 100% { transform: scaleY(0.35); } 50% { transform: scaleY(1); } }

  /* Station 2: the plan */
  .doc {
    width: min(360px, 80vw); padding: 24px; border-radius: 14px; background: #fff; border: 1px solid $color-hairline;
    box-shadow: 0 30px 60px -30px rgba(14, 47, 54, 0.35); display: flex; flex-direction: column; gap: 12px;
    .doc-title { margin: 0 0 4px; font: 700 0.75rem $font-mono; text-transform: uppercase; letter-spacing: 0.12em; color: $color-ink-strong; }
    i { display: block; height: 9px; border-radius: 5px; background: $color-mist; transform-origin: left; }
    i:nth-of-type(odd) { background: rgba(2, 181, 187, 0.35); }
  }
  .doc-btn {
    align-self: flex-start; margin-top: 6px; padding: 8px 18px; border-radius: 999px; font: 700 0.85rem $font-sans;
    border: 1px solid $color-hairline-strong; color: $color-ink-strong; transition: all 300ms $ease;
    &.pressed { background: $color-accent; border-color: $color-accent; transform: scale(0.97); }
  }

  /* Station 3: the timeline */
  .tl { display: flex; flex-direction: column; gap: 6px; width: min(340px, 80vw); position: relative;
    &::before { content: ''; position: absolute; left: 15px; top: 16px; bottom: 16px; width: 2px; background: $color-hairline-strong; }
  }
  .tl-row { position: relative; display: flex; align-items: center; gap: 14px; padding: 8px 0; font: 600 1.05rem $font-sans; color: $color-muted; transition: color 300ms; span { font-family: $font-sans; } }
  .tl-dot { width: 32px; height: 32px; border-radius: 50%; display: grid; place-items: center; background: #fff; border: 2px solid $color-hairline-strong; font-size: 0.85rem; transition: all 300ms $ease; }
  .tl-row.on { color: $color-ink-strong; .tl-dot { background: $color-accent; border-color: $color-accent; transform: scale(1.05); } }

  /* Station 4: arrival */
  .house { width: min(300px, 70vw); overflow: visible;
    path { fill: none; stroke: $color-ink-strong; stroke-width: 5; stroke-linecap: round; stroke-linejoin: round; stroke-dasharray: 1; }
    .check { transform-origin: 160px 40px; circle { fill: $color-accent; } path { stroke: $color-ink-strong; stroke-dasharray: none; stroke-width: 4; } }
  }

  .route { flex: none; width: 100%; height: 40px; margin-top: $space-4; overflow: visible;
    path { fill: none; stroke: $color-ink-strong; stroke-width: 2; stroke-dasharray: 1; vector-effect: non-scaling-stroke; }
    circle { fill: $color-accent-soft; stroke: $color-hairline-strong; stroke-width: 2; vector-effect: non-scaling-stroke; transition: fill 300ms; }
    circle.lit { fill: $color-accent; stroke: $color-ink-strong; }
  }

  @media (max-width: 1023px) {
    .ghost { font-size: 9rem; bottom: auto; top: 0; }
    .panel { align-items: flex-start; padding-top: $space-6; }
    .art { transform: scale(0.85); transform-origin: top center; }
  }

  :global(.rm) {
    .stage { padding-block: $space-24; }
    .viewport { overflow: visible; }
    .track { width: auto; transform: none !important; flex-direction: column; gap: $space-16; margin-top: $space-12; }
    .panel { width: auto; }
    .text { opacity: 1; transform: none; }
    .ghost, .route { display: none; }
  }
</style>
