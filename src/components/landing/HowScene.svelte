<script lang="ts">
  /**
   * Scene 3, "How it works". The page turns sideways through three stations
   * above a journey line that pans with the scroll (MoveRelay: one-colour landscape from the old house to the new one), each holding while its own example plays:
   * 1. the consulting call (ConsultCall: speaker view, the clients in a
   *    picture-in-picture tile, live captions and the in-call chat; the
   *    60-minute ring in front);
   * 2. the written plan (a plan document with the rules that apply, the
   *    steps and the investment, accepted at the end);
   * 3. the status page (the client portal stepper moving stage by stage,
   *    with a WhatsApp update from the team).
   * Stage names on the portal are the client-visible stages of the real
   * pipeline (irp-funnel-server API/dashboard/pipeline.ts), condensed.
   */
  import { scene, seg, easeOut, stations } from './scene.ts';
  import { STEPS } from './content.ts';
  import ConsultCall from './ConsultCall.svelte';
  import MoveRelay from './MoveRelay.svelte';

  let p = 0;
  const N = STEPS.items.length;
  $: st = stations(p, N, 1.1, 0.8);
  $: x = st.x;
  $: active = Math.round(x);
  $: local = st.local;
  $: route = seg(p, 0.02, 0.98);

  const bars = Array.from({ length: 22 }, (_, i) => 0.3 + 0.7 * Math.abs(Math.sin(i * 1.7)));
  const RULES = [
    { tag: 'Compliance', title: 'Customs and import duties' },
    { tag: 'Compliance', title: 'Household goods exemptions' },
    { tag: 'Exports', title: 'Vehicle import regulations' },
    { tag: 'Immigration', title: 'Residency and visa options' }
  ];
  const STAGES = ['Consultation', 'Quote', 'Payment', 'Packing', 'Shipping', 'Arrival', 'Customs', 'Delivery'];
  const DATES = ['Mar 4', 'Mar 9', 'Mar 12', 'Apr 2', 'Apr 6', 'May 1', 'May 8', 'May 14'];
</script>

<section id="how" class="scene" style="--len:4.2" use:scene={(v) => (p = v)} aria-labelledby="how-title">
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
                <span class="how-step">Step {i + 1} of {N}</span>
                <h3>{s.title}</h3>
                <p>{s.body}</p>
              </div>
              <div class="art" aria-hidden="true">
                {#if i === 0}
                  <!-- 1. The call: two people on a video call, a live transcript, the ring in front -->
                  <div class="call">
                    <ConsultCall {lp} live={active === 0} />
                    <div class="ring-wrap">
                      <svg viewBox="0 0 120 120" class="ring">
                        <circle cx="60" cy="60" r="52" class="track-c" />
                        <circle cx="60" cy="60" r="52" class="fill-c" pathLength="1" style="stroke-dashoffset:{1 - easeOut(lp)}" />
                      </svg>
                      <div class="ring-label"><b>60</b><span>min</span></div>
                      <div class="wave">
                        {#each bars as h, k}<i style="--h:{h}; --k:{k}" class:live={active === 0}></i>{/each}
                      </div>
                    </div>
                  </div>
                {:else if i === 1}
                  <!-- 2. The written plan (example document) -->
                  <div class="plan">
                    <header class="plan-head">
                      <span class="plan-logo">IRP</span>
                      <div><p class="plan-org">International Relocation Partner</p><p class="plan-kind">Relocation plan · Example</p></div>
                    </header>
                    <dl class="plan-meta">
                      <div><dt>Client</dt><dd>Example client</dd></div>
                      <div><dt>Route</dt><dd>Dallas, TX → San José, CR</dd></div>
                      <div><dt>Status</dt><dd>Pensionado</dd></div>
                    </dl>
                    <p class="plan-label">Rules that apply to you</p>
                    <ul class="rules">
                      {#each RULES as r, k}
                        {@const f = easeOut(seg(lp, 0.05 + k * 0.1, 0.25 + k * 0.1))}
                        <li style="opacity:{f}; transform: translateX({(1 - f) * 16}px)"><em>{r.tag}</em>{r.title}<span class="tick">✓</span></li>
                      {/each}
                    </ul>
                    <div class="plan-row">
                      <div>
                        <p class="plan-label">Steps</p>
                        <ol class="plan-steps">{#each ['Packing', 'Shipping', 'Customs', 'Delivery'] as s2, k}<li class:on={lp > 0.5 + k * 0.06}>{s2}</li>{/each}</ol>
                      </div>
                      <div class="invest">
                        <p class="plan-label">Project investment</p>
                        <i style="transform: scaleX({easeOut(seg(lp, 0.62, 0.8))})"></i>
                      </div>
                    </div>
                    <span class="accept" class:pressed={lp > 0.86}>{lp > 0.86 ? '✓ Accepted' : 'Accept plan'}</span>
                  </div>
                {:else}
                  <!-- 3. The status page (client portal, example) -->
                  {@const cur = Math.min(STAGES.length - 1, Math.floor(lp * (STAGES.length - 0.01)))}
                  <div class="status-wrap">
                  <div class="portal">
                    <div class="chrome"><i></i><i></i><i></i><span>Your Relocation Portal</span></div>
                    <div class="portal-body">
                      <p class="portal-label">Current Status</p>
                      <ol class="stepper">
                        {#each STAGES as s3, k}
                          <li class:done={k < cur} class:now={k === cur}>
                            <span class="c"></span><b>{s3}</b><small>{k <= cur ? DATES[k] : ''}</small>
                          </li>
                        {/each}
                      </ol>
                      <div class="portal-grid">
                        <div class="log">
                          <p class="portal-label">Activity Log</p>
                          {#each [Math.max(0, cur - 1), cur] as k, j (k + '-' + j)}
                            <p class="log-row"><span>→</span>Moved to <b>{STAGES[k]}</b><em>{DATES[k]}</em></p>
                          {/each}
                        </div>
                        <span class="lily-btn">Chat with Lily</span>
                      </div>
                    </div>
                  </div>
                  <div class="wa" class:in={lp > 0.35}>
                    <span class="wa-ic">✆</span>
                    <div><b>IRP team · WhatsApp</b><p>Your move is now at {STAGES[cur]}. Details are on your status page.</p></div>
                  </div>
                  </div>
                {/if}
              </div>
            </div>
          </li>
        {/each}
      </ol>
      <MoveRelay r={route} />
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
  .title { @include heading-xl; font-size: clamp(1.9rem, 3.6vw, 3rem); max-width: 24ch; }

  .viewport { position: relative; flex: 1; min-height: 0; overflow: hidden; display: flex; flex-direction: column; }
  .track { list-style: none; margin: 0; padding: 0; display: flex; width: calc(var(--n) * 100vw); flex: 1; min-height: 0; will-change: transform; }
  .panel { position: relative; width: 100vw; flex: none; display: flex; align-items: center; }
  .ghost {
    position: absolute; right: 4vw; bottom: -4vh; font: 800 clamp(10rem, 30vw, 26rem) $font-sans; line-height: 0.8;
    letter-spacing: -0.06em; color: transparent; -webkit-text-stroke: 1.5px rgba(14, 47, 54, 0.1); pointer-events: none;
  }
  .panel-grid {
    @include container;
    & { position: relative; display: grid; gap: $space-6; align-items: center; }
    @include lg { grid-template-columns: minmax(0, 4fr) minmax(0, 7fr); gap: $space-12; }
  }
  .text {
    display: flex; flex-direction: column; gap: $space-3;
    opacity: 0.25; transform: translateY(10px); transition: opacity 500ms $ease, transform 600ms $ease;
    h3 { @include heading-xl; font-size: clamp(1.8rem, 3.2vw, 2.6rem); }
    p { @include body; font-size: 1.1rem; max-width: 40ch; }
  }
  .active .text { opacity: 1; transform: none; }
  .how-step { font-family: $font-mono; font-size: 0.75rem; letter-spacing: 0.12em; text-transform: uppercase; color: #04767b; }
  .art { display: grid; place-items: center; min-height: 0; }

  /* ── 1. Call ───────────────────────────── */
  .call { position: relative; width: min(700px, 100%); padding-bottom: 28px; }
  @keyframes blink { 50% { opacity: 0.3; } }
  /* The 60-minute card: compact, floating off the photo's top-right corner (clear of the transcript). */
  .ring-wrap { position: absolute; right: -28px; top: 16px; z-index: 2; padding: 10px 14px 10px 10px; border-radius: 18px; background: #fff;
    box-shadow: 0 30px 50px -20px rgba(14, 47, 54, 0.45); display: grid; grid-template-columns: 64px auto; align-items: center; gap: 10px; }
  .ring { grid-area: 1 / 1; width: 64px; transform: rotate(-90deg);
    circle { fill: none; stroke-width: 9; }
    .track-c { stroke: rgba(14, 47, 54, 0.1); }
    .fill-c { stroke: $color-accent; stroke-linecap: round; stroke-dasharray: 1; } }
  .ring-label { grid-area: 1 / 1; display: grid; place-content: center; text-align: center;
    b { font: 800 1.3rem $font-sans; color: $color-ink-strong; line-height: 1; letter-spacing: -0.04em; }
    span { font: 0.5rem $font-mono; text-transform: uppercase; letter-spacing: 0.14em; color: $color-muted; } }
  .wave { display: flex; align-items: center; gap: 2px; height: 24px;
    i { width: 3px; height: calc(var(--h) * 100%); border-radius: 2px; background: $color-ink-strong; opacity: 0.8; transform: scaleY(0.4); }
    i.live { animation: talk 900ms ease-in-out infinite; animation-delay: calc(var(--k) * -73ms); } }
  @keyframes talk { 0%, 100% { transform: scaleY(0.35); } 50% { transform: scaleY(1); } }

  /* ── 2. Plan document ─────────────────── */
  .plan {
    position: relative; width: min(470px, 100%); padding: 22px 24px 20px; border-radius: 4px; background: #fdfcf8;
    box-shadow: 0 2px 0 rgba(0, 0, 0, 0.04), 0 50px 80px -40px rgba(14, 47, 54, 0.55); font-family: $font-sans; transform: rotate(-1deg);
    &::after { content: ''; position: absolute; right: 0; top: 0; border-width: 0 22px 22px 0; border-style: solid; border-color: $color-accent-soft #e9e4d8; }
  }
  .plan-head { display: flex; align-items: center; gap: 10px; padding-bottom: 10px; border-bottom: 2px solid $color-ink-strong; }
  .plan-logo { width: 34px; height: 34px; border-radius: 7px; display: grid; place-items: center; background: $color-ink-strong; color: $color-accent; font: 800 0.65rem $font-mono; }
  .plan-org { margin: 0; font: 700 0.8rem $font-sans; color: $color-ink-strong; }
  .plan-kind { margin: 0; font: 0.62rem $font-mono; letter-spacing: 0.1em; text-transform: uppercase; color: $color-muted; }
  .plan-meta { margin: 10px 0; display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px;
    dt { font: 0.55rem $font-mono; letter-spacing: 0.12em; text-transform: uppercase; color: $color-muted; }
    dd { margin: 0; font: 600 0.72rem $font-sans; color: $color-ink-strong; } }
  .plan-label { margin: 8px 0 6px; font: 700 0.6rem $font-mono; letter-spacing: 0.12em; text-transform: uppercase; color: $color-ink-strong; }
  .rules { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 5px;
    li { display: flex; align-items: center; gap: 8px; padding: 7px 10px; border-radius: 6px; background: #fff; border: 1px solid $color-hairline; font: 600 0.78rem $font-sans; color: $color-ink-strong; }
    em { font: normal 0.55rem $font-mono; letter-spacing: 0.08em; text-transform: uppercase; color: $color-accent-hover; background: $color-accent-soft; padding: 2px 6px; border-radius: 4px; }
    .tick { margin-left: auto; color: #1f7a5c; } }
  .plan-row { display: grid; grid-template-columns: 1.3fr 1fr; gap: 12px; }
  .plan-steps { list-style: none; margin: 0; padding: 0; display: flex; gap: 4px;
    li { flex: 1; text-align: center; padding: 5px 2px; border-radius: 4px; background: $color-mist; font: 600 0.62rem $font-sans; color: $color-muted; transition: all 300ms; }
    li.on { background: $color-ink-strong; color: #fff; } }
  .invest i { display: block; height: 22px; border-radius: 3px; background: repeating-linear-gradient(90deg, $color-ink-strong 0 8px, #2c4a51 8px 12px); transform-origin: left; }
  .accept { display: inline-block; margin-top: 14px; padding: 8px 18px; border-radius: 999px; background: $color-ink-strong; color: #fff; font: 700 0.8rem $font-sans; transition: all 300ms $ease;
    &.pressed { background: $color-accent; color: $color-ink-strong; transform: scale(0.96); } }

  /* ── 3. Status portal ─────────────────── */
  .portal { position: relative; width: 100%; border-radius: 14px; overflow: hidden; background: #fff; border: 1px solid $color-hairline; box-shadow: 0 50px 80px -40px rgba(14, 47, 54, 0.55); font-family: $font-sans; }
  .chrome { display: flex; align-items: center; gap: 6px; padding: 10px 12px; background: $color-ink-strong; color: #fff;
    i { width: 9px; height: 9px; border-radius: 50%; background: rgba(255, 255, 255, 0.25); }
    span { margin-left: 8px; font: 700 0.75rem $font-sans; } }
  .portal-body { padding: 16px 18px 18px; }
  .portal-label { margin: 0 0 10px; font: 700 0.6rem $font-mono; letter-spacing: 0.12em; text-transform: uppercase; color: $color-ink-strong; }
  .stepper { list-style: none; margin: 0 0 14px; padding: 0; display: grid; grid-template-columns: repeat(8, 1fr); position: relative;
    &::before { content: ''; position: absolute; left: 6%; right: 6%; top: 7px; height: 2px; background: $color-hairline; }
    li { position: relative; display: flex; flex-direction: column; align-items: center; gap: 4px; text-align: center; }
    .c { width: 16px; height: 16px; border-radius: 50%; background: #fff; border: 2px solid $color-hairline-strong; z-index: 1; transition: all 300ms $ease; }
    b { font: 600 0.58rem $font-sans; color: $color-muted; }
    small { font: 0.52rem $font-mono; color: $color-muted; min-height: 0.7rem; }
    li.done .c { background: $color-accent; border-color: $color-accent; }
    li.done b { color: $color-ink-strong; }
    li.now .c { border: 3px solid $color-accent; box-shadow: 0 0 0 5px rgba(2, 181, 187, 0.2); }
    li.now b { color: $color-ink-strong; font-weight: 800; } }
  .portal-grid { display: grid; grid-template-columns: 1fr auto; gap: 12px; align-items: end; }
  .log-row { margin: 0; padding: 6px 0; border-top: 1px solid $color-hairline; display: flex; gap: 8px; align-items: baseline; font: 0.72rem $font-sans; color: $color-steel;
    span { color: $color-accent-hover; font-weight: 800; } b { color: $color-ink-strong; } em { margin-left: auto; font: normal 0.6rem $font-mono; color: $color-muted; } }
  .lily-btn { padding: 8px 14px; border-radius: 999px; background: $color-accent; color: $color-ink-strong; font: 700 0.72rem $font-sans; }
  .status-wrap { position: relative; width: min(600px, 100%); }
  .wa { position: absolute; right: -28px; top: -54px; width: 260px; z-index: 2; display: flex; gap: 10px; padding: 10px 12px; border-radius: 12px; background: #fff;
    box-shadow: 0 20px 40px -15px rgba(14, 47, 54, 0.45); border: 1px solid $color-hairline;
    opacity: 0; transform: translateY(-14px) scale(0.96); transition: opacity 400ms, transform 500ms $ease;
    &.in { opacity: 1; transform: none; }
    b { font: 700 0.68rem $font-sans; color: #1f7a5c; } p { margin: 2px 0 0; font: 0.72rem/1.35 $font-sans; color: $color-ink; } }
  .wa-ic { width: 28px; height: 28px; flex: none; border-radius: 50%; display: grid; place-items: center; background: #25d366; color: #fff; font-size: 0.9rem; }

  /* Short desktop screens: shrink the examples so they stay clear of the heading and the relay diorama. */
  @media (min-width: 1024px) and (max-height: 820px) { .art { transform: scale(0.84); } }
  @media (min-width: 1024px) and (max-height: 700px) { .art { transform: scale(0.74); } }

  @media (max-width: 1023px) {
    .ghost { font-size: 9rem; bottom: auto; top: 0; }
    .panel { align-items: flex-start; padding-top: $space-4; }
    .art { transform: scale(0.78); transform-origin: top center; }
    /* The plan is the tallest example; keep it clear of the journey line. */
    .art:has(.plan) { transform: scale(0.64); }
    .text p { font-size: 1rem; }
    .ring-wrap { display: none; }
  }

  :global(.rm) {
    .stage { padding-block: $space-24; }
    .viewport { overflow: visible; }
    .track { width: auto; transform: none !important; flex-direction: column; gap: $space-16; margin-top: $space-12; }
    .panel { width: auto; }
    .text { opacity: 1; transform: none; }
    .ghost { display: none; }
    .wave i.live { animation: none; }
  }
</style>
