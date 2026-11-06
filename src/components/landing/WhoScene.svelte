<script lang="ts">
  /**
   * Scene 9, "Who we serve". Four boarding passes in a deck. Each quarter of
   * the scroll sends the top pass off the screen and brings the next one
   * forward; on the last pass the stub tears off and turns into the booking
   * button.
   */
  import { scene, seg, easeOut, clamp, stations } from './scene.ts';
  import { rewindToBooking } from './reveal.ts';
  import { WHO } from './content.ts';

  let p = 0;
  const N = WHO.rows.length;
  // Example routes, one per audience (airport codes and cities).
  const ROUTES = [
    { from: 'DFW', fromCity: 'Dallas', to: 'SJO', toCity: 'San José', date: '14 MAR', seat: '02A', zone: '1' },
    { from: 'LAX', fromCity: 'Los Angeles', to: 'LIS', toCity: 'Lisbon', date: '03 APR', seat: '11C', zone: '2' },
    { from: 'IND', fromCity: 'Indianapolis', to: 'FAO', toCity: 'Faro', date: '22 MAY', seat: '07F', zone: '1' },
    { from: 'MAD', fromCity: 'Madrid', to: 'BOG', toCity: 'Bogotá', date: '09 JUN', seat: '04D', zone: '3' }
  ];
  /** Deterministic barcode widths and QR modules (decorative). */
  const BARS = Array.from({ length: 64 }, (_, k) => 1 + ((k * 37 + 11) % 4));
  const QR = Array.from({ length: 21 * 21 }, (_, k) => {
    const x = k % 21, y = Math.floor(k / 21);
    const finder = (fx: number, fy: number) => x >= fx && x < fx + 7 && y >= fy && y < fy + 7;
    if (finder(0, 0) || finder(14, 0) || finder(0, 14)) {
      const lx = x < 7 ? x : x - 14, ly = y < 7 ? y : y - 14;
      return lx === 0 || lx === 6 || ly === 0 || ly === 6 || (lx >= 2 && lx <= 4 && ly >= 2 && ly <= 4);
    }
    return ((x * 7 + y * 13 + x * y) % 5) < 2;
  });
  $: st = stations(seg(p, 0, 0.82), N, 1, 0.8);
  $: off = (i: number) => (i === N - 1 ? 0 : clamp(st.x - i));
  $: top = Math.min(N - 1, [...Array(N).keys()].filter((i) => off(i) < 0.5)[0] ?? N - 1);
  $: tear = easeOut(seg(p, 0.8, 0.94));
</script>

<section id="who" class="scene" style="--len:4" use:scene={(v) => (p = v)} aria-labelledby="who-title">
  <div class="stage">
    <div class="wrap grid">
      <div class="copy">
        <p class="eyebrow"><span class="dot" aria-hidden="true"></span>{WHO.eyebrow}</p>
        <h2 class="title" id="who-title">{WHO.title}</h2>
        <ol class="names">
          {#each WHO.rows as r, i}<li class:on={top === i}>{r.who}</li>{/each}
        </ol>
        <a class="primary cta" class:in={tear > 0.6} href="#hero-form" on:click={rewindToBooking}>{WHO.cta}</a>
      </div>

      <ul class="deck">
        {#each WHO.rows as r, i}
          {@const o = off(i)}
          {@const depth = Math.max(0, i - top)}
          <li
            class="pass"
            style="z-index:{N - i}; transform: translate3d(calc({o} * -115vw), {depth * 18 - o * 60}px, 0) rotate({o * -22 + depth * 1.5}deg) scale({1 - depth * 0.04}); opacity:{depth > 2 ? 0 : 1 - seg(o, 0.55, 0.95)}"
          >
            <div class="main">
              <div class="band">
                <span class="brand"><span class="mark">IRP</span>International Relocation Partner</span>
                <span class="kind">Boarding pass</span>
              </div>
              <div class="pax"><span class="lbl">Passenger</span><h3>{r.who}</h3></div>
              <div class="route">
                <div><b class="iata">{ROUTES[i].from}</b><span class="city">{ROUTES[i].fromCity}</span></div>
                <svg viewBox="0 0 120 24" aria-hidden="true"><path d="M2 12 H104" class="dash" /><path d="M96 5 L114 12 L96 19 L100 12 Z" class="plane" /></svg>
                <div class="to"><b class="iata">{ROUTES[i].to}</b><span class="city">{ROUTES[i].toCity}</span></div>
              </div>
              <p class="line">{r.body}</p>
              <div class="fields">
                <div><span class="lbl">Flight</span><b>IRP 060</b></div>
                <div><span class="lbl">Date</span><b>{ROUTES[i].date}</b></div>
                <div><span class="lbl">Gate</span><b>Call</b></div>
                <div><span class="lbl">Zone</span><b>{ROUTES[i].zone}</b></div>
                <div><span class="lbl">Seat</span><b>{ROUTES[i].seat}</b></div>
              </div>
              <div class="pdf417" aria-hidden="true">{#each BARS as w}<i style="width:{w}px"></i>{/each}</div>
            </div>
            <div class="stub" style={i === N - 1 ? `transform: translate(${tear * 40}px, ${tear * 30}px) rotate(${tear * 14}deg); opacity:${1 - tear}` : ''}>
              <span class="lbl">Passenger</span><b class="stub-name">{r.who}</b>
              <div class="stub-route"><b>{ROUTES[i].from}</b><span>→</span><b>{ROUTES[i].to}</b></div>
              <div class="stub-row"><div><span class="lbl">Seat</span><b>{ROUTES[i].seat}</b></div><div><span class="lbl">Gate</span><b>Call</b></div></div>
              <svg class="qr" viewBox="0 0 21 21" aria-hidden="true">{#each QR as on, k}{#if on}<rect x={k % 21} y={Math.floor(k / 21)} width="1" height="1" />{/if}{/each}</svg>
            </div>
          </li>
        {/each}
      </ul>
    </div>
  </div>
</section>

<style lang="scss">
  @use './tokens' as *;

  .scene { @include scene-shell; background: $color-canvas; }
  .stage { @include stage; display: flex; align-items: center; padding-top: $header-clear; padding-bottom: 6.5rem; overflow: hidden; }
  .wrap { @include container; }
  .grid { display: grid; gap: $space-8; align-items: center; width: 100%;
    @include lg { grid-template-columns: minmax(0, 4fr) minmax(0, 6fr); gap: $space-16; }
  }
  .copy { display: flex; flex-direction: column; gap: $space-4; align-items: flex-start; }
  .eyebrow { @include eyebrow; display: inline-flex; align-items: center; gap: $space-2; }
  .dot { width: 6px; height: 6px; border-radius: 50%; background: $color-accent; }
  .title { @include heading-xl; font-size: clamp(1.9rem, 3.6vw, 3rem); }
  .names { list-style: none; margin: $space-2 0 0; padding: 0; display: flex; flex-direction: column; gap: 4px;
    li { font: 700 clamp(1.05rem, 1.6vw, 1.3rem) $font-sans; color: rgba(14, 47, 54, 0.25); transition: color 300ms, transform 400ms $ease;
      &.on { color: $color-ink-strong; transform: translateX(10px); }
    }
    @media (max-width: 1023px) { display: none; }
  }
  .primary { @include button-primary; }
  .cta { opacity: 0; transform: translateY(10px); pointer-events: none; transition: opacity 400ms, transform 500ms $ease;
    &.in { opacity: 1; transform: none; pointer-events: auto; }
  }

  .deck { list-style: none; margin: 0; padding: 0; position: relative; height: min(390px, 56vh); height: min(390px, 56svh); }
  .pass {
    position: absolute; inset: 0; display: grid; grid-template-columns: 1fr 170px; border-radius: 18px;
    background: transparent; color: $color-ink; filter: drop-shadow(0 30px 30px rgba(14, 47, 54, 0.28));
    transform-origin: 50% 100%; will-change: transform; transition: opacity 300ms; font-family: $font-sans;
    /* perforation notches */
    -webkit-mask: radial-gradient(circle 11px at calc(100% - 170px) 0, transparent 98%, #000) top / 100% 51% no-repeat,
                  radial-gradient(circle 11px at calc(100% - 170px) 100%, transparent 98%, #000) bottom / 100% 51% no-repeat;
    mask: radial-gradient(circle 11px at calc(100% - 170px) 0, transparent 98%, #000) top / 100% 51% no-repeat,
          radial-gradient(circle 11px at calc(100% - 170px) 100%, transparent 98%, #000) bottom / 100% 51% no-repeat;
    @media (max-width: 640px) { grid-template-columns: 1fr; -webkit-mask: none; mask: none; .stub { display: none; } }
  }
  .main { background: #fbfaf7; border-radius: 18px 0 0 18px; padding: 0 0 14px; display: flex; flex-direction: column; gap: 8px; min-width: 0; border-right: 2px dashed rgba(14, 47, 54, 0.25); }
  .band { display: flex; align-items: center; justify-content: space-between; padding: 10px 20px; border-radius: 18px 0 0 0; background: $color-ink-strong; color: #fff; }
  .brand { display: inline-flex; align-items: center; gap: 8px; font: 700 0.72rem $font-sans; }
  .mark { padding: 2px 6px; border-radius: 4px; background: $color-accent; color: $color-ink-strong; font: 800 0.6rem $font-mono; }
  .kind { font: 0.62rem $font-mono; letter-spacing: 0.16em; text-transform: uppercase; color: $color-accent; }
  .pax { padding: 4px 20px 0; h3 { margin: 0; font: 800 clamp(1.2rem, 2.2vw, 1.6rem)/1.1 $font-sans; letter-spacing: -0.02em; color: $color-ink-strong; text-transform: uppercase; } }
  .route { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 12px; padding: 0 20px;
    svg { width: 100%; height: 24px; } .dash { fill: none; stroke: rgba(14, 47, 54, 0.35); stroke-width: 2; stroke-dasharray: 4 5; } .plane { fill: $color-accent-hover; }
    .to { text-align: right; } }
  .iata { display: block; font: 800 clamp(1.8rem, 3.4vw, 2.6rem)/1 $font-sans; letter-spacing: -0.03em; color: $color-ink-strong; }
  .city { font: 0.7rem $font-sans; color: $color-muted; }
  .line { margin: 0; padding: 0 20px; font: 0.82rem/1.45 $font-sans; color: $color-steel; }
  .fields { display: grid; grid-template-columns: repeat(5, auto); justify-content: space-between; gap: 8px; padding: 8px 20px 0; border-top: 1px solid $color-hairline; margin: 0 0 0;
    b { display: block; font: 800 0.9rem $font-mono; color: $color-ink-strong; } }
  .lbl { display: block; font: 0.55rem $font-mono; letter-spacing: 0.14em; text-transform: uppercase; color: $color-muted; }
  .pdf417 { display: flex; gap: 1px; height: 26px; margin: 0 20px; opacity: 0.85; i { background: $color-ink-strong; } }
  .stub { position: relative; padding: 46px 16px 14px; display: flex; flex-direction: column; gap: 6px; align-items: flex-start; background: #f4f1ea; border-radius: 0 18px 18px 0;
    b { font-family: $font-sans; color: $color-ink-strong; } }
  .stub-name { font: 800 0.8rem/1.15 $font-sans; text-transform: uppercase; }
  .stub-route { display: flex; gap: 6px; align-items: baseline; b { font: 800 1.1rem $font-sans; } span { color: $color-accent-hover; } }
  .stub-row { display: flex; gap: 16px; b { font: 800 0.8rem $font-mono; } }
  .qr { width: 64px; height: 64px; margin-top: auto; rect { fill: $color-ink-strong; } }

  :global(.rm) {
    .stage { padding-block: $space-24; }
    .deck { height: auto; display: flex; flex-direction: column; gap: $space-4; }
    .pass { position: relative; inset: auto; transform: none !important; opacity: 1 !important; }
    .cta { opacity: 1; transform: none; pointer-events: auto; }
    .stub { transform: none !important; opacity: 1 !important; }
  }
</style>
