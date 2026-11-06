<script lang="ts">
  /**
   * Scene 9, "Who we serve". Four boarding passes in a deck. Each quarter of
   * the scroll sends the top pass off the screen and brings the next one
   * forward; on the last pass the stub tears off and turns into the booking
   * button.
   */
  import { scene, seg, easeOut, clamp, stations } from './scene.ts';
  import { goToBooking } from './reveal.ts';
  import { WHO } from './content.ts';

  let p = 0;
  const N = WHO.rows.length;
  const ROUTES = [
    ['Home', 'Abroad'],
    ['Anywhere', 'Abroad'],
    ['Home', 'New country'],
    ['Abroad', 'Home']
  ];
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
        <a class="primary cta" class:in={tear > 0.6} href="#hero-form" on:click={goToBooking}>{WHO.cta}</a>
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
              <div class="pass-top">
                <span class="airline">IRP · Boarding pass</span>
                <span class="seat">{String(i + 1).padStart(2, '0')}</span>
              </div>
              <div class="route">
                <div><span class="lbl">From</span><b>{ROUTES[i][0]}</b></div>
                <svg viewBox="0 0 80 20" aria-hidden="true"><path d="M2 10 H70 M62 4 L72 10 L62 16" /></svg>
                <div><span class="lbl">To</span><b>{ROUTES[i][1]}</b></div>
              </div>
              <div class="pax"><span class="lbl">Passenger</span><h3>{r.who}</h3></div>
              <p>{r.body}</p>
            </div>
            <div class="stub" style={i === N - 1 ? `transform: translate(${tear * 40}px, ${tear * 30}px) rotate(${tear * 14}deg); opacity:${1 - tear}` : ''}>
              <span class="lbl">Gate</span><b>60-min call</b>
              <span class="bars" aria-hidden="true">{#each Array(18) as _, k}<i style="width:{(k * 7) % 3 + 1}px"></i>{/each}</span>
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

  .deck { list-style: none; margin: 0; padding: 0; position: relative; height: min(360px, 46svh); }
  .pass {
    position: absolute; inset: 0; display: grid; grid-template-columns: 1fr 140px; border-radius: 20px; overflow: hidden;
    background: $color-ink-strong; color: $color-on-dark; box-shadow: 0 40px 70px -40px rgba(14, 47, 54, 0.7);
    transform-origin: 50% 100%; will-change: transform; transition: opacity 300ms;
    &:nth-child(even) { background: #0f3f47; }
    @media (max-width: 640px) { grid-template-columns: 1fr; .stub { display: none; } }
  }
  .main { padding: clamp(1.25rem, 3vw, 2rem); display: flex; flex-direction: column; gap: $space-3; min-width: 0; }
  .pass-top { display: flex; justify-content: space-between; }
  .airline { font: 0.72rem $font-mono; letter-spacing: 0.14em; text-transform: uppercase; color: $color-accent; }
  .seat { font: 700 0.9rem $font-mono; color: $color-on-dark-muted; }
  .route { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: $space-3;
    b { display: block; font: 800 clamp(1.1rem, 2vw, 1.5rem) $font-sans; letter-spacing: -0.02em; }
    svg { width: 100%; height: 20px; path { fill: none; stroke: $color-accent; stroke-width: 2; stroke-dasharray: 4 4; } }
  }
  .lbl { display: block; font: 0.65rem $font-mono; letter-spacing: 0.14em; text-transform: uppercase; color: $color-on-dark-muted; }
  .pax h3 { margin: 2px 0 0; font: 800 clamp(1.5rem, 3vw, 2.25rem)/1.05 $font-sans; letter-spacing: -0.03em; color: $color-on-dark; }
  .main p { @include body; color: $color-on-dark-muted; font-size: 1rem; }
  .stub {
    position: relative; padding: 1.5rem 1rem; display: flex; flex-direction: column; gap: 6px; align-items: flex-start;
    border-left: 2px dashed rgba(255, 255, 255, 0.25); background: rgba(255, 255, 255, 0.04);
    b { font: 800 1rem $font-sans; }
  }
  .bars { margin-top: auto; display: flex; gap: 2px; height: 44px; align-items: stretch; i { background: rgba(255, 255, 255, 0.7); } }

  :global(.rm) {
    .stage { padding-block: $space-24; }
    .deck { height: auto; display: flex; flex-direction: column; gap: $space-4; }
    .pass { position: relative; inset: auto; transform: none !important; opacity: 1 !important; }
    .cta { opacity: 1; transform: none; pointer-events: auto; }
    .stub { transform: none !important; opacity: 1 !important; }
  }
</style>
