<script lang="ts">
  /**
   * Scene 2, "The rules depend on your case". One shipping container stays
   * on screen while four beats play on it: status tags, a duty sheet, the
   * customs counter (week 1 to 10) and the documents calendar (day 15 to 45).
   */
  import { scene, seg, easeOut, easeInOut } from './scene.ts';
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
  // After week 10 the arm lifts and the barrier fades with it, so the move to
  // beat 4 mirrors the way it came in (down while fading in).
  $: armUp = b === 2 ? easeInOut(seg(t, 0.88, 1)) : 0;
  $: armAngle = b === 2 ? -80 * (1 - armDown * (1 - armUp)) : -80;
  // Example estimate lines (beat 2). Amounts are shown redacted: every route is quoted separately.
  const DUTY_ROWS = [
    ['Household goods (used)', 'CIF value'],
    ['Vehicle import', 'Model, year, engine'],
    ['Port handling', 'Per container'],
    ['Customs broker and DUA', 'Flat fee'],
    ['Bonded warehouse', 'Per day']
  ];
  // Example documents (beat 4), in the order they arrive, with the day each
  // one is ready. They land on a stack; the last (the apostille) stays on top.
  const DOCS = [
    { name: 'Passport', kind: 'passport', ready: 15 },
    { name: 'Criminal record certificate', kind: 'police', ready: 21 },
    { name: 'Pension income statement', kind: 'income', ready: 27 },
    { name: 'Vehicle title', kind: 'vtitle', ready: 33 },
    { name: 'Bill of lading', kind: 'lading', ready: 39 },
    { name: 'Birth certificate with apostille', kind: 'apostille', ready: 45 }
  ];
  const TILT = [-1.6, 1.2, -0.8, 1.6, -1.2, 0.6];
  // Layout of beat 4: ready papers stack at the top (each lands one header
  // strip lower than the last); the papers still in transit wait as a queue
  // of placeholder rows *below* the stack and slide up as the stack grows, so
  // a placeholder never sits on top of a ready paper.
  const STEP = 38; // header strip visible per paper in the stack
  const PAPER = 176; // full paper height
  const GAP = 10; // stack → queue
  const QROW = 38; // queue row pitch
  $: readyN = b === 3 ? DOCS.filter((d) => day >= d.ready).length : 0;
  $: stackH = readyN ? (readyN - 1) * STEP + PAPER + GAP : 0;
  // DOCS are in ready order, so a paper's stack slot is its index.
  const docY = (k: number, n: number, sh: number) => (k < n ? k * STEP : sh + (k - n) * QROW);
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
          <g class="barrier" style="opacity:{b === 2 ? 1 - armUp : 0}">
            <!-- post (static) -->
            <rect x="8" y="246" width="24" height="112" rx="4" fill="#d9e1e6" />
            <rect x="4" y="350" width="32" height="10" rx="3" fill="#9fb0b8" />
            <!-- arm: rotates on the pivot where it meets the post -->
            <g class="arm" style="transform: rotate({armAngle}deg)">
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
          <div class="pile">
            {#each DOCS as d, k}
              {@const done = b === 3 && day >= d.ready}
              <div class="doc {d.kind}" class:done style="--r:{TILT[k]}deg; transform: translateY({docY(k, readyN, stackH)}px)">
                <span class="ghost"><svg viewBox="0 0 24 24"><path style="fill:currentColor" d="M21.5 12c0-.7-.6-1.2-1.3-1.2h-5.4L10 3.4H8.2l2.4 7.4H5.6L4 8.6H2.6l1 3.4-1 3.4H4l1.6-2.2h5l-2.4 7.4H10l4.8-7.4h5.4c.7 0 1.3-.5 1.3-1.2z" /></svg>{d.name}</span>
                <div class="paper">
                  {#if d.kind === 'passport'}
                    <div class="pp-cover"><i class="pp-emblem"></i><b>Passport</b><span>Pasaporte</span></div>
                    <div class="pp-page"><span class="pp-photo"></span><span class="pp-lines"><i></i><i></i><i></i></span><code>P&lt;USAREED&lt;&lt;JILL&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;</code></div>
                  {:else if d.kind === 'police'}
                    <div class="hd"><i class="seal blue"></i><b>Criminal record certificate</b><small>No record found</small></div>
                  {:else if d.kind === 'income'}
                    <div class="hd bank"><i class="bank-mark"></i><b>Pension income statement</b><small>Monthly benefit</small></div>
                  {:else if d.kind === 'vtitle'}
                    <div class="hd"><b>Certificate of title</b><small>Motor vehicle · VIN ••••4352</small></div>
                  {:else if d.kind === 'lading'}
                    <div class="hd"><b class="mono">Bill of lading</b><small class="mono">Original · Port Everglades → Moín</small></div>
                  {:else}
                    <div class="ap">
                      <p class="ap-title">Apostille</p>
                      <p class="ap-sub">(Convention de La Haye du 5 octobre 1961)</p>
                      <ol class="ap-lines">
                        <li><span>1.</span>Country: <i></i></li>
                        <li><span>2.</span>This public document has been signed by <i></i></li>
                        <li><span>3.</span>acting in the capacity of <i></i></li>
                        <li><span>4.</span>bears the seal of <i></i></li>
                      </ol>
                      <span class="ap-seal"><i></i></span>
                    </div>
                  {/if}
                </div>
                <span class="chip">{done ? `Ready · day ${d.ready}` : 'In transit'}</span>
              </div>
            {/each}
          </div>
          <p class="pile-count">{readyN} of {DOCS.length} ready <span>· Example</span></p>
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
  .wrap { @include container; & { position: relative; } }
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
  /* The stack: each paper lands a little lower than the last, so every header stays in view.
     Papers still in transit queue below it and move up as it grows (see docY).
     Tallest moment: 5 × 38 + 176 + 10 = 376px (constant for 1–5 ready). */
  .pile { position: relative; height: 376px; margin-top: 4px; }
  .doc { position: absolute; left: 0; right: 0; top: 0; height: 176px; transition: transform 650ms cubic-bezier(0.22, 1, 0.36, 1); }
  .ghost {
    position: absolute; inset: 0 0 auto 0; height: 34px; display: flex; align-items: center; gap: 8px; padding: 0 12px;
    border: 1.5px dashed $color-hairline-strong; border-radius: 8px; color: $color-muted; font: 600 0.68rem $font-sans;
    transition: opacity 300ms;
    svg { width: 14px; height: 14px; flex: none; color: $color-accent-hover; }
  }
  .paper {
    position: absolute; inset: 0; border-radius: 6px; overflow: hidden; background: #fff;
    box-shadow: 0 -1px 0 rgba(14, 47, 54, 0.06), 0 10px 22px -10px rgba(14, 47, 54, 0.45), 0 1px 2px rgba(14, 47, 54, 0.15);
    opacity: 0; transform: translateY(14px) rotate(calc(var(--r) * 3)) scale(0.985);
    transition: opacity 260ms ease, transform 600ms cubic-bezier(0.22, 1.2, 0.36, 1);
  }
  .doc.done .paper { opacity: 1; transform: rotate(var(--r)); }
  .doc.done .ghost { opacity: 0; }
  .chip {
    position: absolute; right: 8px; top: 7px; z-index: 2; padding: 3px 8px; border-radius: 99px;
    font: 700 0.58rem $font-sans; letter-spacing: 0.02em; white-space: nowrap;
    background: $color-mist; color: $color-muted; transition: background 300ms, color 300ms;
  }
  .doc.done .chip { background: #e3f4ec; color: #1f7a5c; }
  .doc.done .chip::before { content: '✓ '; }

  /* Header strips: what each paper is, at a glance */
  .hd {
    display: flex; flex-direction: column; justify-content: center; gap: 1px; height: 34px; padding: 0 92px 0 12px; position: relative;
    b { font: 700 0.74rem $font-sans; color: $color-ink-strong; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    small { font: 0.56rem $font-sans; color: $color-muted; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .mono { font-family: $font-mono; letter-spacing: 0.06em; text-transform: uppercase; }
  }
  .police .paper { border-top: 3px solid #23468c; }
  .police .hd { padding-left: 38px; }
  .seal { position: absolute; left: 10px; top: 6px; width: 20px; height: 20px; border-radius: 50%; }
  .seal.blue { background: radial-gradient(circle, #fff 30%, #23468c 32% 44%, #fff 46% 56%, #23468c 58%); }
  .income .paper { background: linear-gradient(#fff, #fff) padding-box; }
  .hd.bank { background: linear-gradient(90deg, #0b4f55, #127a80); padding-left: 38px; b, small { color: #fff; } small { opacity: 0.8; } }
  .bank-mark { position: absolute; left: 12px; top: 9px; width: 16px; height: 16px; border-radius: 4px; background: rgba(255, 255, 255, 0.9); clip-path: polygon(50% 0, 100% 35%, 100% 100%, 0 100%, 0 35%); }
  .vtitle .paper { background: repeating-linear-gradient(45deg, #eef6ee 0 4px, #f7fbf7 4px 8px); box-shadow: inset 0 0 0 4px #b9d8bd, 0 10px 22px -10px rgba(14, 47, 54, 0.45); }
  .vtitle .hd b { font-family: Georgia, 'Times New Roman', serif; font-size: 0.8rem; color: #24532c; }
  .lading .paper { background: #fbfaf6; background-image: linear-gradient(rgba(14, 47, 54, 0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(14, 47, 54, 0.12) 1px, transparent 1px); background-size: 100% 22px, 33.3% 100%; background-position: 0 34px, 0 0; }
  .passport .paper { display: grid; grid-template-columns: 92px 1fr; background: #f1ecf3; }
  .pp-cover {
    position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px;
    background: linear-gradient(160deg, #24345e, #18233f); color: #d8b75d; text-align: center;
    b { font: 700 0.62rem Georgia, serif; letter-spacing: 0.16em; text-transform: uppercase; }
    span { font: 0.5rem Georgia, serif; letter-spacing: 0.12em; text-transform: uppercase; opacity: 0.85; }
  }
  .pp-emblem { width: 26px; height: 26px; border-radius: 50%; border: 1.5px solid #d8b75d; background: radial-gradient(circle, transparent 45%, rgba(216, 183, 93, 0.5) 46% 50%, transparent 52%); margin-bottom: 4px; }
  .pp-page {
    position: relative; padding: 12px 12px 10px; display: grid; grid-template-columns: 38px 1fr; gap: 6px 10px; align-content: start;
    background: repeating-radial-gradient(circle at 80% 30%, #f1ecf3 0 3px, #e9e2ee 3px 4px);
    code { grid-column: 1 / -1; margin-top: 40px; font: 600 0.5rem/1.3 'Courier New', monospace; letter-spacing: 0.08em; color: #3a3a46; white-space: nowrap; overflow: hidden; }
  }
  .pp-photo { width: 38px; height: 48px; border-radius: 3px; background: linear-gradient(#c9c2cf, #b7afbf); }
  .pp-lines { display: flex; flex-direction: column; gap: 6px; padding-top: 4px; i { height: 4px; border-radius: 2px; background: #cfc7d6; } i:nth-child(2) { width: 70%; } i:nth-child(3) { width: 50%; } }

  /* The apostille: the page everyone recognises once they have needed one */
  .apostille .paper { background: #fbf7ec; box-shadow: inset 0 0 0 5px #fbf7ec, inset 0 0 0 6px #c9b88f, 0 12px 26px -10px rgba(14, 47, 54, 0.5); }
  .ap { position: relative; padding: 28px 16px 10px; text-align: center; } /* clears the Ready chip */
  .ap-title { margin: 0; font: 700 1rem Georgia, 'Times New Roman', serif; letter-spacing: 0.2em; text-transform: uppercase; color: #3c3322; }
  .ap-sub { margin: 1px 0 8px; font: italic 0.56rem Georgia, serif; color: #6b5d41; }
  .ap-lines {
    margin: 0; padding: 0 70px 0 0; list-style: none; text-align: left; display: grid; gap: 4px;
    li { display: flex; gap: 4px; align-items: baseline; font: 0.54rem Georgia, serif; color: #4d4330; white-space: nowrap; }
    i { flex: 1; min-width: 16px; border-bottom: 1px dotted #a8997a; }
  }
  .ap-seal {
    position: absolute; right: 16px; bottom: -6px; width: 54px; height: 54px; border-radius: 50%;
    background: radial-gradient(circle at 40% 35%, #e0564e, #a3201f 70%); box-shadow: 0 4px 8px rgba(120, 20, 20, 0.35);
    i { position: absolute; inset: 7px; border-radius: 50%; border: 1.5px dashed rgba(255, 255, 255, 0.55); }
    &::before, &::after { content: ''; position: absolute; top: 44px; width: 12px; height: 26px; background: #a3201f; clip-path: polygon(0 0, 100% 0, 100% 100%, 50% 78%, 0 100%); }
    &::before { left: 12px; transform: rotate(14deg); }
    &::after { right: 12px; transform: rotate(-14deg); }
  }
  .pile-count { margin: 8px 0 0; font: 700 0.7rem $font-sans; color: $color-ink-strong; span { font-weight: 400; color: $color-muted; } }

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
