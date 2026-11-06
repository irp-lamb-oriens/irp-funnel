<script lang="ts">
  /**
   * Scene 3, "How it works". The page turns sideways through three stations
   * on one route line, each holding while its own example plays:
   * 1. the consulting call (two people on a video call, the 60-minute ring,
   *    the live transcript being written as they talk);
   * 2. the written plan (a plan document with the rules that apply, the
   *    steps and the investment, accepted at the end);
   * 3. the status page (the client portal stepper moving stage by stage,
   *    with a WhatsApp update from the team).
   * Stage names on the portal are the client-visible stages of the real
   * pipeline (irp-funnel-server API/dashboard/pipeline.ts), condensed.
   */
  import { scene, seg, easeOut, stations } from './scene.ts';
  import { STEPS } from './content.ts';

  let p = 0;
  const N = STEPS.items.length;
  $: st = stations(p, N, 1.1, 0.8);
  $: x = st.x;
  $: active = Math.round(x);
  $: local = st.local;
  $: route = seg(p, 0.02, 0.98);

  const bars = Array.from({ length: 22 }, (_, i) => 0.3 + 0.7 * Math.abs(Math.sin(i * 1.7)));
  // Example transcript of the call (station 1).
  const TRANSCRIPT = [
    { who: 'IRP', text: 'Tell me about your move. Where are you headed?' },
    { who: 'You', text: 'San José, Costa Rica, next spring. We are retiring.' },
    { who: 'IRP', text: 'Then we start with the pensionado residency. It changes what you pay at customs.' },
    { who: 'You', text: 'Can we bring our SUV?' },
    { who: 'IRP', text: 'Yes. Import taxes depend on its value and year. I will put the numbers in your plan.' },
    { who: 'You', text: 'And our two dogs?' }
  ];
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
                  {@const shown = TRANSCRIPT.filter((_, k) => lp > 0.04 + k * 0.14).length}
                  {@const typing = shown > 0 ? Math.min(1, (lp - (0.04 + (shown - 1) * 0.14)) / 0.12) : 0}
                  <div class="call">
                    <div class="meet">
                      <div class="meet-bar"><span class="rec"></span>Consultation call · Example<span class="meet-time">{String(Math.floor(lp * 60)).padStart(2, '0')}:00 / 60:00</span></div>
                      <div class="meet-grid">
                        <div class="tiles">
                          <figure class="tile" class:talk={shown > 0 && TRANSCRIPT[shown - 1].who === 'IRP' && typing < 1}>
                            <svg viewBox="0 0 200 130" class="person">
                              <defs>
                                <linearGradient id="how-roomA" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1b5a63" /><stop offset="1" stop-color="#0c3339" /></linearGradient>
                                <radialGradient id="how-skinA" cx="0.4" cy="0.35" r="0.7"><stop offset="0" stop-color="#e2b48f" /><stop offset="1" stop-color="#b98361" /></radialGradient>
                                <linearGradient id="how-shirtA" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f4f7f8" /><stop offset="1" stop-color="#cfd9dc" /></linearGradient>
                              </defs>
                              <rect width="200" height="130" fill="url(#how-roomA)" />
                              <rect x="12" y="14" width="56" height="76" rx="2" fill="#123e44" />
                              {#each [0, 1, 2] as row}
                                <rect x="12" y={38 + row * 25} width="56" height="3" fill="#0a2a2e" />
                                {#each [0, 1, 2, 3, 4] as b}<rect x={15 + b * 10} y={18 + row * 25} width="7" height="20" rx="1" fill={['#c8a06e', '#7fc8cc', '#e9f3f4', '#c62426', '#8fb3b8'][(b + row) % 5]} opacity="0.75" />{/each}
                              {/each}
                              <circle cx="178" cy="22" r="26" fill="#ffd9a0" opacity="0.12" />
                              <path d="M58 130 C60 98 80 86 100 86 C120 86 140 98 142 130 Z" style="fill:url(#how-shirtA)" />
                              <path d="M90 88 L100 104 L110 88" style="fill:none" stroke="#9fb0b8" stroke-width="2" />
                              <rect x="92" y="74" width="16" height="16" rx="6" fill="#b98361" />
                              <ellipse cx="100" cy="58" rx="19" ry="22" fill="url(#how-skinA)" />
                              <path d="M80 56 C80 32 120 30 121 54 C116 44 104 40 92 44 C86 46 82 50 80 56 Z" style="fill:#2a211c" />
                              <ellipse cx="93" cy="60" rx="2" ry="2.4" fill="#2a211c" /><ellipse cx="107" cy="60" rx="2" ry="2.4" fill="#2a211c" />
                              <path d="M94 70 Q100 74 106 70" style="fill:none" stroke="#7a4b35" stroke-width="2" stroke-linecap="round" />
                              <path d="M79 58 C77 30 123 30 121 58" style="fill:none" stroke="#10232a" stroke-width="3.5" />
                              <rect x="75" y="54" width="7" height="13" rx="3" fill="#10232a" />
                              <path d="M79 66 Q82 78 92 76" style="fill:none" stroke="#10232a" stroke-width="2" />
                            </svg>
                            <figcaption>IRP consultant</figcaption>
                          </figure>
                          <figure class="tile" class:talk={shown > 0 && TRANSCRIPT[shown - 1].who === 'You' && typing < 1}>
                            <svg viewBox="0 0 200 130" class="person">
                              <defs>
                                <linearGradient id="how-roomB" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f3eadc" /><stop offset="1" stop-color="#dccbb0" /></linearGradient>
                                <radialGradient id="how-skinB" cx="0.4" cy="0.35" r="0.7"><stop offset="0" stop-color="#f1cfb0" /><stop offset="1" stop-color="#cf9f7d" /></radialGradient>
                                <radialGradient id="how-skinC" cx="0.4" cy="0.35" r="0.7"><stop offset="0" stop-color="#e8bf9c" /><stop offset="1" stop-color="#bf8a66" /></radialGradient>
                              </defs>
                              <rect width="200" height="130" fill="url(#how-roomB)" />
                              <rect x="138" y="12" width="48" height="40" rx="2" fill="#fbf6ec" stroke="#c9b28f" stroke-width="3" />
                              <path d="M162 12 V52 M138 32 H186" style="fill:none" stroke="#c9b28f" stroke-width="2" />
                              <path d="M20 112 C14 92 22 78 28 70 C30 84 34 94 30 112 Z" style="fill:#6f9d6b" />
                              <path d="M30 112 C34 92 44 84 52 80 C48 94 42 104 38 112 Z" style="fill:#87b383" />
                              <rect x="18" y="108" width="26" height="22" rx="3" fill="#b5654b" />
                              <path d="M48 130 C50 104 64 94 80 94 C96 94 110 104 112 130 Z" style="fill:#577590" />
                              <ellipse cx="80" cy="70" rx="16" ry="19" fill="url(#how-skinB)" />
                              <path d="M63 70 C60 46 100 44 97 70 C94 58 84 54 78 54 C70 55 65 60 63 70 Z" style="fill:#c9c2b8" />
                              <ellipse cx="74" cy="71" rx="1.8" ry="2.1" fill="#3b302a" /><ellipse cx="86" cy="71" rx="1.8" ry="2.1" fill="#3b302a" />
                              <path d="M75 80 Q80 83 85 80" style="fill:none" stroke="#9c6a52" stroke-width="1.8" stroke-linecap="round" />
                              <path d="M100 130 C102 100 118 90 136 90 C154 90 168 100 170 130 Z" style="fill:#b5654b" />
                              <ellipse cx="136" cy="66" rx="16" ry="19" fill="url(#how-skinC)" />
                              <path d="M117 74 C110 44 160 40 156 72 C154 60 146 52 136 52 C126 52 120 60 117 74 Z" style="fill:#6b4a33" />
                              <path d="M117 74 C116 86 120 92 124 94 L122 74 Z M156 72 C158 84 154 92 150 94 L151 72 Z" style="fill:#6b4a33" />
                              <ellipse cx="130" cy="68" rx="1.8" ry="2.1" fill="#3b302a" /><ellipse cx="142" cy="68" rx="1.8" ry="2.1" fill="#3b302a" />
                              <path d="M131 77 Q136 80 141 77" style="fill:none" stroke="#8f5c43" stroke-width="1.8" stroke-linecap="round" />
                            </svg>
                            <figcaption>You</figcaption>
                          </figure>
                        </div>
                        <div class="transcript">
                          <p class="tr-head"><span class="tr-dot"></span>Transcript · live</p>
                          <ol class="tr-lines">
                            {#each TRANSCRIPT.slice(0, shown) as line, k}
                              <li class:irp={line.who === 'IRP'}>
                                <b>{line.who}</b>
                                <span>{k === shown - 1 ? line.text.slice(0, Math.ceil(line.text.length * typing)) : line.text}{#if k === shown - 1 && typing < 1}<i class="caret"></i>{/if}</span>
                              </li>
                            {/each}
                          </ol>
                          <p class="tr-foot">Saved to your file</p>
                        </div>
                      </div>
                      <div class="meet-tools"><i></i><i></i><i class="end"></i></div>
                    </div>
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
      <svg class="route" viewBox="0 0 1000 40" preserveAspectRatio="none" aria-hidden="true">
        <path d="M0 20 C 160 4, 330 36, 500 20 S 840 4, 1000 20" pathLength="1" style="stroke-dashoffset:{1 - route}" />
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
  .title { @include heading-xl; font-size: clamp(1.9rem, 3.6vw, 3rem); max-width: 24ch; }

  .viewport { position: relative; flex: 1; min-height: 0; overflow: hidden; display: flex; flex-direction: column; }
  .track { list-style: none; margin: 0; padding: 0; display: flex; width: calc(var(--n) * 100vw); flex: 1; min-height: 0; will-change: transform; }
  .panel { position: relative; width: 100vw; flex: none; display: flex; align-items: center; }
  .ghost {
    position: absolute; right: 4vw; bottom: -4vh; font: 800 clamp(10rem, 30vw, 26rem) $font-sans; line-height: 0.8;
    letter-spacing: -0.06em; color: transparent; -webkit-text-stroke: 1.5px rgba(14, 47, 54, 0.1); pointer-events: none;
  }
  .panel-grid {
    @include container; position: relative; display: grid; gap: $space-6; align-items: center;
    @include lg { grid-template-columns: minmax(0, 4fr) minmax(0, 7fr); gap: $space-12; }
  }
  .text {
    display: flex; flex-direction: column; gap: $space-3;
    opacity: 0.25; transform: translateY(10px); transition: opacity 500ms $ease, transform 600ms $ease;
    h3 { @include heading-xl; font-size: clamp(1.8rem, 3.2vw, 2.6rem); }
    p { @include body; font-size: 1.1rem; max-width: 40ch; }
  }
  .active .text { opacity: 1; transform: none; }
  .how-step { font-family: $font-mono; font-size: 0.75rem; letter-spacing: 0.12em; text-transform: uppercase; color: $color-accent-hover; }
  .art { display: grid; place-items: center; min-height: 0; }

  /* ── 1. Call ───────────────────────────── */
  .call { position: relative; width: min(640px, 100%); padding-bottom: 40px; }
  .meet { border-radius: 16px; overflow: hidden; background: #0b1f24; box-shadow: 0 40px 70px -35px rgba(14, 47, 54, 0.6); }
  .meet-bar { display: flex; align-items: center; gap: 8px; padding: 10px 14px; font: 0.68rem $font-mono; letter-spacing: 0.08em; text-transform: uppercase; color: rgba(255, 255, 255, 0.7); }
  .rec { width: 8px; height: 8px; border-radius: 50%; background: #e5484d; animation: blink 1.4s infinite; }
  @keyframes blink { 50% { opacity: 0.3; } }
  .meet-time { margin-left: auto; font-variant-numeric: tabular-nums; }
  .meet-grid { display: grid; grid-template-columns: 1.15fr 1fr; gap: 6px; padding: 0 6px; }
  .tiles { display: grid; grid-template-rows: 1fr 1fr; gap: 6px; }
  .tile { position: relative; margin: 0; border-radius: 10px; overflow: hidden; outline: 2px solid transparent; outline-offset: -2px; transition: outline-color 200ms;
    &.talk { outline-color: $color-accent; }
    .person { display: block; width: 100%; height: auto; }
    figcaption { position: absolute; left: 8px; bottom: 8px; padding: 3px 8px; border-radius: 6px; background: rgba(0, 0, 0, 0.55); color: #fff; font: 600 0.66rem $font-sans; }
  }
  .transcript { display: flex; flex-direction: column; border-radius: 10px; background: #fff; padding: 10px 12px; min-height: 0; overflow: hidden; }
  .tr-head { margin: 0 0 8px; display: flex; align-items: center; gap: 6px; font: 700 0.6rem $font-mono; letter-spacing: 0.12em; text-transform: uppercase; color: $color-ink-strong; }
  .tr-dot { width: 7px; height: 7px; border-radius: 50%; background: #e5484d; animation: blink 1.4s infinite; }
  .tr-lines { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; justify-content: flex-end; gap: 6px; flex: 1; overflow: hidden;
    li { display: grid; grid-template-columns: 28px 1fr; gap: 6px; font: 0.68rem/1.4 $font-sans; color: $color-ink; animation: tr-in 300ms $ease both; }
    b { font: 700 0.58rem $font-mono; color: $color-muted; padding-top: 2px; }
    li.irp b { color: $color-accent-hover; } }
  @keyframes tr-in { from { opacity: 0; transform: translateY(6px); } }
  .caret { display: inline-block; width: 1px; height: 0.9em; margin-left: 1px; background: $color-ink-strong; vertical-align: -1px; animation: blink 0.9s steps(1) infinite; }
  .tr-foot { margin: 8px 0 0; padding-top: 6px; border-top: 1px solid $color-hairline; font: 0.58rem $font-mono; letter-spacing: 0.08em; text-transform: uppercase; color: $color-muted; }
  .meet-tools { display: flex; justify-content: center; gap: 10px; padding: 8px 0 12px;
    i { width: 30px; height: 30px; border-radius: 50%; background: rgba(255, 255, 255, 0.12); }
    i.end { width: 44px; border-radius: 15px; background: #e5484d; } }
  .ring-wrap { position: absolute; right: -24px; bottom: -6px; width: 150px; padding: 14px; border-radius: 22px; background: #fff;
    box-shadow: 0 30px 50px -20px rgba(14, 47, 54, 0.45); display: grid; place-items: center; gap: 8px; }
  .ring { width: 100px; transform: rotate(-90deg);
    circle { fill: none; stroke-width: 7; }
    .track-c { stroke: rgba(14, 47, 54, 0.1); }
    .fill-c { stroke: $color-accent; stroke-linecap: round; stroke-dasharray: 1; } }
  .ring-label { position: absolute; top: 14px; height: 100px; display: grid; place-content: center; text-align: center;
    b { font: 800 2rem $font-sans; color: $color-ink-strong; line-height: 1; letter-spacing: -0.04em; }
    span { font: 0.62rem $font-mono; text-transform: uppercase; letter-spacing: 0.14em; color: $color-muted; } }
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

  .route { flex: none; width: 100%; height: 40px; margin-top: $space-4; overflow: visible;
    path { fill: none; stroke: $color-ink-strong; stroke-width: 2; stroke-dasharray: 1; vector-effect: non-scaling-stroke; }
    circle { fill: $color-accent-soft; stroke: $color-hairline-strong; stroke-width: 2; vector-effect: non-scaling-stroke; transition: fill 300ms; }
    circle.lit { fill: $color-accent; stroke: $color-ink-strong; } }

  @media (max-width: 1023px) {
    .ghost { font-size: 9rem; bottom: auto; top: 0; }
    .panel { align-items: flex-start; padding-top: $space-4; }
    .art { transform: scale(0.78); transform-origin: top center; }
    .text p { font-size: 1rem; }
    .ring-wrap { right: 0; }
  }

  :global(.rm) {
    .stage { padding-block: $space-24; }
    .viewport { overflow: visible; }
    .track { width: auto; transform: none !important; flex-direction: column; gap: $space-16; margin-top: $space-12; }
    .panel { width: auto; }
    .text { opacity: 1; transform: none; }
    .ghost, .route { display: none; }
    .wave i.live, .rec { animation: none; }
  }
</style>
