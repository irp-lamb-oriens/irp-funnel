<script lang="ts">
  /**
   * Scene 2, "The rules depend on your case". One shipping container stays
   * on screen while four beats play on it: status tags, a duty sheet, the
   * customs counter (week 1 to 10) and the documents calendar (day 15 to 45).
   */
  import { scene, seg, easeOut } from './scene.ts';
  import { PROBLEM } from './content.ts';

  let p = 0;
  const N = PROBLEM.beats.length;
  const PROFILES = ['Retiree', 'Digital nomad', 'Returning citizen'];

  $: bp = seg(p, 0.03, 0.97) * N;
  $: b = Math.min(N - 1, Math.floor(bp));
  $: t = Math.min(1, bp - b);
  $: intro = easeOut(seg(p, 0, 0.06));
  $: profile = Math.min(2, Math.floor(t * 3));
  $: week = Math.min(10, 1 + Math.floor(t * 10));
  $: day = 15 + Math.round(t * 30);
  $: armDown = easeOut(seg(t, 0.02, 0.4));
  // Example estimate lines (beat 2). Amounts are shown redacted: every route is quoted separately.
  const DUTY_ROWS = [
    ['Household goods (used)', 'CIF value'],
    ['Vehicle import', 'Model, year, engine'],
    ['Port handling', 'Per container'],
    ['Customs broker and DUA', 'Flat fee'],
    ['Bonded warehouse', 'Per day']
  ];
  // Example documents (beat 4) with the day each one is ready.
  const DOCS = [
    { name: 'Passport copies', kind: 'ID', ready: 15 },
    { name: 'Apostilled birth certificate', kind: 'Apostille', ready: 24 },
    { name: 'Proof of income', kind: 'Residency', ready: 30 },
    { name: 'Vehicle title', kind: 'Vehicle', ready: 36 },
    { name: 'Packing list and inventory', kind: 'Shipping', ready: 40 },
    { name: 'Bill of lading', kind: 'Shipping', ready: 45 }
  ];
</script>

<section id="problem" class="scene" style="--len:4.2" use:scene={(v) => (p = v)} aria-labelledby="problem-title">
  <div class="stage">
    <div class="glow" style="transform: translate3d({(p - 0.5) * 30}%, 0, 0)" aria-hidden="true"></div>
    <div class="wrap grid">
      <div class="copy">
        <p class="eyebrow"><span class="dot" aria-hidden="true"></span>{PROBLEM.eyebrow}</p>
        <h2 class="title" id="problem-title">{PROBLEM.title}</h2>
        <p class="lead">{PROBLEM.lead}</p>

        <div class="counter" aria-hidden="true">
          <span class="num">0{b + 1}</span><span class="of">/ 0{N}</span>
          <span class="bars">
            {#each PROBLEM.beats as _, i}
              <i><b style="transform: scaleX({i < b ? 1 : i === b ? t : 0})"></b></i>
            {/each}
          </span>
        </div>

        <ol class="beats">
          {#each PROBLEM.beats as beat, i}
            <li class="beat" class:on={i === b}>
              <span class="tag">{beat.tag}</span>
              <h3>{beat.title}</h3>
              <p>{beat.body}</p>
            </li>
          {/each}
        </ol>
      </div>

      <div class="visual" aria-hidden="true" style="opacity:{intro}; transform: translateY({(1 - intro) * 40}px) scale({0.94 + intro * 0.06})">
        <svg class="container" viewBox="0 0 520 380">
          <defs>
            <linearGradient id="pc-front" x1="0" x2="1"><stop offset="0" stop-color="#0b8d92" /><stop offset="1" stop-color="#077176" /></linearGradient>
            <linearGradient id="pc-side" x1="0" x2="1"><stop offset="0" stop-color="#055b60" /><stop offset="1" stop-color="#044a4e" /></linearGradient>
          </defs>
          <ellipse cx="260" cy="350" rx="230" ry="22" fill="rgba(0,0,0,0.35)" />
          <polygon points="70,150 190,90 450,170 330,230" fill="#13a8ad" />
          <g transform="matrix(1,0.3077,0,1,0,0)">
            <rect x="70" y="128.46" width="260" height="100" fill="url(#pc-front)" />
            {#each Array(12) as _, i}<rect x={82 + i * 20} y="132" width="8" height="92" fill="rgba(255,255,255,0.07)" />{/each}
            <g class="stamp" style="opacity:{b === 0 ? 1 : 0.0}">
              <rect x="104" y="160" width="190" height="38" rx="4" fill="none" stroke="#fff" stroke-width="2" stroke-dasharray="5 4" />
              <text x="199" y="184" text-anchor="middle">RULES FOR: {PROFILES[profile].toUpperCase()}</text>
            </g>
          </g>
          <g transform="matrix(1,-0.5,0,1,0,0)">
            <rect x="330" y="395" width="120" height="100" fill="url(#pc-side)" />
            <line x1="390" y1="397" x2="390" y2="493" stroke="rgba(255,255,255,0.18)" stroke-width="2" />
            {#each [345, 365, 415, 435] as x}<line x1={x} y1="400" x2={x} y2="490" stroke="rgba(255,255,255,0.22)" stroke-width="2" />{/each}
          </g>
          <!-- customs barrier -->
          <g class="barrier" style="opacity:{b === 2 ? 1 : 0}">
            <!-- post (static) -->
            <rect x="8" y="246" width="24" height="112" rx="4" fill="#d9e1e6" />
            <rect x="4" y="350" width="32" height="10" rx="3" fill="#9fb0b8" />
            <!-- arm: rotates on the pivot where it meets the post -->
            <g class="arm" style="transform: rotate({b === 2 ? -80 * (1 - armDown) : -80}deg)">
              <rect x="20" y="255" width="470" height="18" rx="9" fill="#fff" />
              {#each Array(10) as _, i}<rect x={34 + i * 46} y="255" width="22" height="18" fill="#c62426" />{/each}
              <circle cx="482" cy="264" r="5" fill="#c62426" />
            </g>
            <circle cx="20" cy="264" r="11" fill="#9fb0b8" />
            <circle cx="20" cy="264" r="4" fill="#0e2f36" />
          </g>
        </svg>

        <!-- beat 1: status tags -->
        <ul class="tags" class:on={b === 0}>
          {#each PROFILES as name, i}
            <li class:shown={t > i * 0.3 + 0.02 || b > 0} class:current={profile === i}>{name}</li>
          {/each}
        </ul>

        <!-- beat 2: duties and fees estimate (example document) -->
        <div class="sheet" class:on={b === 1} style="transform: translate({b === 1 ? 0 : -40}px, {b === 1 ? 0 : 30}px) rotate({b === 1 ? 2.5 : 10}deg)">
          <div class="doc-head">
            <span class="doc-logo">IRP</span>
            <div><p class="doc-org">International Relocation Partner</p><p class="doc-kind">Duties and fees estimate</p></div>
            <span class="doc-ref">Example</span>
          </div>
          <dl class="doc-meta">
            <div><dt>Route</dt><dd>Dallas, TX → San José, CR</dd></div>
            <div><dt>Status</dt><dd>Pensionado</dd></div>
          </dl>
          <table>
            <thead><tr><th>Item</th><th>Basis</th><th>Amount</th></tr></thead>
            <tbody>
              {#each DUTY_ROWS as row, i}
                {@const f = b === 1 ? easeOut(seg(t, 0.08 + i * 0.12, 0.3 + i * 0.12)) : 0}
                <tr style="opacity:{0.15 + 0.85 * f}">
                  <td>{row[0]}</td><td>{row[1]}</td><td><i style="transform: scaleX({f})"></i></td>
                </tr>
              {/each}
            </tbody>
          </table>
          <div class="doc-foot">
            <span>Varies with your immigration status and route</span>
            <span class="doc-stamp" style="opacity:{b === 1 ? seg(t, 0.75, 0.9) : 0}">Estimate</span>
          </div>
        </div>

        <!-- beat 3: customs counter -->
        <div class="weeks" class:on={b === 2}>
          <span class="weeks-label">Customs</span>
          <span class="weeks-num">Week {week}</span>
          <span class="ticks">{#each Array(10) as _, i}<i class:lit={i < week}></i>{/each}</span>
        </div>

        <!-- beat 4: documents in transit (example) -->
        <div class="cal" class:on={b === 3}>
          <div class="cal-head">
            <p class="cal-title">Documents in transit</p>
            <p class="cal-day">Day <b>{day}</b> <span>of 45</span></p>
          </div>
          <span class="cal-bar"><i style="transform: scaleX({(day - 15) / 30})"></i><em style="left:0">15</em><em style="right:0">45</em></span>
          <ul class="docs">
            {#each DOCS as d}
              {@const done = b === 3 && day >= d.ready}
              <li class:done>
                <span class="doc-ic" aria-hidden="true"><i></i><i></i><i></i></span>
                <span class="doc-name">{d.name}<small>{d.kind}</small></span>
                <span class="doc-state">{done ? 'Ready' : 'In transit'}</span>
              </li>
            {/each}
          </ul>
        </div>
      </div>
    </div>
  </div>
</section>

<style lang="scss">
  @use './tokens' as *;

  .scene { @include scene-shell; background: $color-ink-strong; color: $color-on-dark; }
  .stage { @include stage; display: flex; align-items: center; padding-top: $header-clear; padding-bottom: 7rem; }
  .glow {
    position: absolute; inset: -30% -20%; pointer-events: none;
    background: radial-gradient(40% 40% at 70% 55%, rgba(2, 181, 187, 0.28), transparent 70%);
  }
  .wrap { @include container; position: relative; }
  .grid {
    display: grid; gap: $space-8; align-items: center;
    @include lg { grid-template-columns: minmax(0, 5fr) minmax(0, 7fr); gap: $space-16; }
  }
  .copy { display: flex; flex-direction: column; gap: $space-4; }
  .eyebrow { @include eyebrow; color: $color-on-dark; display: inline-flex; align-items: center; gap: $space-2; }
  .dot { width: 6px; height: 6px; border-radius: 50%; background: $color-red; }
  .title { @include heading-xl; color: $color-on-dark; font-size: clamp(2rem, 4vw, 3.25rem); }
  .lead { @include body; color: $color-on-dark-muted; max-width: 46ch; @media (max-height: 760px) { display: none; } }

  .counter { display: flex; align-items: baseline; gap: $space-2; margin-top: $space-4; font-family: $font-mono; }
  .num { font-size: 1.5rem; font-weight: 700; color: $color-accent; }
  .of { font-size: 0.8rem; color: $color-on-dark-muted; }
  .bars { display: flex; gap: 6px; margin-left: $space-4; flex: 1; max-width: 220px;
    i { flex: 1; height: 3px; background: rgba(255, 255, 255, 0.15); border-radius: 2px; overflow: hidden; }
    b { display: block; height: 100%; background: $color-accent; transform-origin: left; }
  }

  .beats { list-style: none; margin: 0; padding: 0; display: grid; min-height: 9.5rem; }
  .beat {
    grid-area: 1 / 1; display: flex; flex-direction: column; gap: $space-2;
    opacity: 0; transform: translateY(14px); visibility: hidden;
    transition: opacity 450ms $ease, transform 600ms $ease, visibility 0s 450ms;
    &.on { opacity: 1; transform: none; visibility: visible; transition-delay: 120ms, 120ms, 0s; }
    h3 { @include heading-md; color: $color-on-dark; font-size: clamp(1.4rem, 2.4vw, 2rem); }
    p { @include body; color: $color-on-dark-muted; max-width: 44ch; }
  }
  .tag { font-family: $font-mono; font-size: 0.72rem; letter-spacing: 0.14em; text-transform: uppercase; color: $color-accent; }

  /* Visual */
  .visual { position: relative; width: 100%; max-width: 640px; justify-self: center; aspect-ratio: 520 / 420; }
  .container { width: 100%; height: auto; overflow: visible; animation: float 6s ease-in-out infinite; }
  @keyframes float { 50% { transform: translateY(-8px); } }
  .stamp { transition: opacity 400ms; text { fill: #fff; font: 700 13px $font-mono; letter-spacing: 0.08em; } }
  .barrier { transition: opacity 400ms; }
  .arm { transform-origin: 20px 264px; transform-box: view-box; }

  .on { opacity: 1 !important; visibility: visible !important; }
  .tags, .sheet, .weeks, .cal { position: absolute; opacity: 0; visibility: hidden; transition: opacity 450ms $ease, transform 700ms $ease, visibility 0s 450ms; }
  .tags.on, .sheet.on, .weeks.on, .cal.on { transition-delay: 0s; }

  .tags {
    right: 0; top: 0; list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; align-items: flex-end;
    li {
      font-family: $font-sans; font-weight: 700; font-size: 0.9rem; padding: 8px 14px; border-radius: 999px;
      background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255, 255, 255, 0.2); color: $color-on-dark-muted;
      opacity: 0; transform: translateX(24px) rotate(4deg); transition: opacity 400ms, transform 600ms $ease, background 300ms, color 300ms;
      &.shown { opacity: 1; transform: none; }
      &.current { background: $color-accent; color: $color-ink-strong; border-color: $color-accent; }
    }
  }
  .sheet {
    right: -2%; top: -4%; width: min(330px, 58%); padding: 18px 18px 14px; border-radius: 4px;
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0) 0 96%, rgba(14, 47, 54, 0.04) 96%),
      #fdfcf8;
    color: $color-ink; box-shadow: 0 2px 0 rgba(0,0,0,0.05), 0 40px 60px -25px rgba(0, 0, 0, 0.7);
    font-family: $font-sans;
    &::after { content: ''; position: absolute; right: 0; top: 0; border-width: 0 18px 18px 0; border-style: solid; border-color: $color-ink-strong #e8e4da; }
  }
  .doc-head { display: flex; align-items: center; gap: 10px; padding-bottom: 10px; border-bottom: 2px solid $color-ink-strong; }
  .doc-logo { width: 30px; height: 30px; border-radius: 6px; display: grid; place-items: center; background: $color-ink-strong; color: $color-accent; font: 800 0.6rem $font-mono; }
  .doc-org { margin: 0; font: 700 0.7rem $font-sans; color: $color-ink-strong; }
  .doc-kind { margin: 0; font: 0.62rem $font-mono; letter-spacing: 0.1em; text-transform: uppercase; color: $color-muted; }
  .doc-ref { margin-left: auto; font: 0.58rem $font-mono; letter-spacing: 0.1em; text-transform: uppercase; color: $color-red; border: 1px solid $color-red; padding: 2px 6px; border-radius: 3px; }
  .doc-meta { margin: 10px 0 8px; display: grid; grid-template-columns: 1.4fr 1fr; gap: 6px;
    dt { font: 0.55rem $font-mono; letter-spacing: 0.12em; text-transform: uppercase; color: $color-muted; }
    dd { margin: 0; font: 600 0.72rem $font-sans; color: $color-ink-strong; }
  }
  table { width: 100%; border-collapse: collapse; font-size: 0.7rem;
    th { text-align: left; font: 0.55rem $font-mono; letter-spacing: 0.1em; text-transform: uppercase; color: $color-muted; padding: 4px 0; border-bottom: 1px solid $color-hairline-strong; }
    td { padding: 6px 4px 6px 0; border-bottom: 1px dotted $color-hairline-strong; color: $color-ink; font-family: $font-sans; }
    td:nth-child(2) { color: $color-muted; }
    td:last-child { width: 26%; }
    i { display: block; height: 8px; border-radius: 2px; background: repeating-linear-gradient(90deg, $color-ink-strong 0 6px, #2c4a51 6px 9px); transform-origin: left; }
    tr { transition: opacity 200ms; }
  }
  .doc-foot { display: flex; justify-content: space-between; align-items: center; gap: 8px; margin-top: 10px;
    span:first-child { font: 0.6rem $font-sans; color: $color-muted; max-width: 60%; }
  }
  .doc-stamp { font: 800 0.8rem $font-sans; letter-spacing: 0.12em; text-transform: uppercase; color: $color-red; border: 2px solid $color-red; padding: 3px 10px; border-radius: 4px; transform: rotate(-8deg); transition: opacity 300ms; }
  .weeks {
    left: 0; right: 0; bottom: -2%; display: flex; flex-direction: column; align-items: center; gap: 8px; text-align: center;
    .weeks-label { font: 0.72rem $font-mono; letter-spacing: 0.14em; text-transform: uppercase; color: $color-on-dark-muted; }
    .weeks-num { font: 700 clamp(2.5rem, 6vw, 4.5rem) $font-sans; letter-spacing: -0.04em; line-height: 1; font-variant-numeric: tabular-nums; }
    .ticks { display: flex; gap: 5px; i { width: 22px; height: 6px; border-radius: 3px; background: rgba(255, 255, 255, 0.15); transition: background 200ms; } i.lit { background: $color-red; } }
  }
  .cal {
    right: -2%; top: -2%; width: min(340px, 60%); padding: 16px; border-radius: 14px;
    background: #fff; color: $color-ink; box-shadow: 0 40px 60px -25px rgba(0, 0, 0, 0.7); font-family: $font-sans;
  }
  .cal-head { display: flex; justify-content: space-between; align-items: baseline; }
  .cal-title { margin: 0; font: 700 0.7rem $font-mono; letter-spacing: 0.1em; text-transform: uppercase; color: $color-ink-strong; }
  .cal-day { margin: 0; font: 0.75rem $font-sans; color: $color-muted; b { font: 800 1.3rem $font-sans; color: $color-ink-strong; font-variant-numeric: tabular-nums; } }
  .cal-bar { position: relative; display: block; height: 6px; margin: 10px 0 18px; border-radius: 3px; background: $color-mist;
    i { position: absolute; inset: 0; border-radius: 3px; background: $color-accent; transform-origin: left; }
    em { position: absolute; top: 9px; font: normal 0.58rem $font-mono; color: $color-muted; }
  }
  .docs { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
  .docs li { display: grid; grid-template-columns: 26px 1fr auto; gap: 10px; align-items: center; padding: 7px 8px; border-radius: 8px; border: 1px solid $color-hairline; transition: background 300ms, border-color 300ms;
    &.done { background: #e8f4ef; border-color: rgba(31, 122, 92, 0.3); .doc-state { color: #1f7a5c; } .doc-state::before { content: '✓ '; } }
  }
  .doc-ic { width: 22px; height: 28px; border-radius: 3px; background: $color-mist; border: 1px solid $color-hairline-strong; display: flex; flex-direction: column; gap: 3px; padding: 5px 4px;
    i { height: 2px; background: $color-hairline-strong; } }
  .doc-name { font: 600 0.78rem $font-sans; color: $color-ink-strong; display: flex; flex-direction: column;
    small { font: 0.58rem $font-mono; letter-spacing: 0.1em; text-transform: uppercase; color: $color-muted; } }
  .doc-state { font: 700 0.68rem $font-sans; color: $color-muted; white-space: nowrap; }

  @media (max-width: 1023px) {
    .stage { align-items: flex-start; padding-bottom: 6rem; }
    .lead { display: none; }
    .visual { max-width: 420px; }
    .beats { min-height: 8rem; }
  }

  /* Reduced motion: every beat listed, the container alone. */
  :global(.rm) {
    .stage { padding-block: $space-24; }
    .beats { gap: $space-8; min-height: 0; }
    .beat { grid-area: auto; opacity: 1; transform: none; visibility: visible; }
    .counter, .tags, .sheet, .weeks, .cal, .stamp, .barrier { display: none; }
    .container { animation: none; }
  }
</style>
