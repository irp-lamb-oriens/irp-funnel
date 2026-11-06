<script lang="ts">
  /**
   * Scene 10, "Six countries". A dotted globe turns to each country in
   * order, holding on it while its name sets in large type; Costa Rica and
   * Panama carry a Tours pin. At the end the globe pulls back with all six
   * lit. The country list on the right is the real navigation.
   */
  import { scene, seg, easeInOut, lerp, stations } from './scene.ts';
  import Globe from './Globe.svelte';
  import { COUNTRIES } from './content.ts';

  const GEO: Record<string, [number, number]> = {
    'Costa Rica': [-84.1, 9.9],
    Panama: [-80.1, 8.6],
    Mexico: [-102.5, 23.6],
    Portugal: [-8.2, 39.6],
    Spain: [-3.7, 40.4],
    Colombia: [-74.3, 4.6]
  };
  const list = COUNTRIES.list;
  const N = list.length;

  let p = 0;
  $: st = stations(seg(p, 0, 0.86), N, 1, 0.7);
  $: i = Math.min(N - 2, Math.floor(st.x));
  $: move = st.x - i;
  $: active = Math.round(st.x);
  $: out = easeInOut(seg(p, 0.86, 1));
  $: a = GEO[list[i].name];
  $: b = GEO[list[Math.min(N - 1, i + 1)].name];
  $: gLon = lerp(lerp(a[0], b[0], move), -50, out);
  $: gLat = lerp(lerp(a[1], b[1], move), 18, out);
  $: gScale = lerp(1.25, 0.95, out);
  $: markers = list.map((c, k) => ({ lon: GEO[c.name][0], lat: GEO[c.name][1], on: k === active || out > 0.5 }));
</script>

<section id="countries" class="scene" style="--len:5" use:scene={(v) => (p = v)} aria-labelledby="countries-title">
  <div class="stage">
    <div class="globe-wrap" style="transform: translate3d({(1 - out) * 8}vw, 0, 0)">
      <Globe lon={gLon} lat={gLat} scale={gScale} {markers} />
    </div>
    <div class="wrap layer">
      <header class="head">
        <p class="eyebrow"><span class="dot" aria-hidden="true"></span>{COUNTRIES.eyebrow}</p>
        <h2 class="title" id="countries-title">{COUNTRIES.title}</h2>
      </header>

      <div class="big" aria-hidden="true">
        {#each list as c, k}
          <span class="name" class:on={k === active && out < 0.5}>
            <small>0{k + 1} / 0{N}{c.tours ? ' · Tours' : ''}</small>{c.name}
          </span>
        {/each}
      </div>

      <nav class="list" aria-label="Country guides">
        <p class="lead">{COUNTRIES.lead}</p>
        <ol>
          {#each list as c, k}
            <li class:on={k === active || out > 0.5}>
              <a href={c.href}><span>{c.name}</span>{#if c.tours}<em>Tours</em>{/if}<i aria-hidden="true">→</i></a>
            </li>
          {/each}
        </ol>
      </nav>
    </div>
  </div>
</section>

<style lang="scss">
  @use './tokens' as *;

  .scene { @include scene-shell; background: radial-gradient(120% 80% at 30% 50%, #12424b 0%, $color-ink-strong 60%); color: $color-on-dark; }
  .stage { @include stage; }
  .globe-wrap { position: absolute; left: -12vw; top: 50%; width: min(118svh, 92vw); height: min(118svh, 92vw); margin-top: calc(min(118svh, 92vw) / -2); will-change: transform; }
  .wrap { @include container; }
  .layer { position: relative; height: 100%; display: grid; grid-template-rows: auto 1fr; padding-top: $header-clear; padding-bottom: 6.5rem; }
  .head { display: flex; flex-direction: column; gap: $space-3; }
  .eyebrow { @include eyebrow; color: $color-on-dark; display: inline-flex; align-items: center; gap: $space-2; }
  .dot { width: 6px; height: 6px; border-radius: 50%; background: $color-accent; }
  .title { @include heading-xl; color: $color-on-dark; font-size: clamp(1.9rem, 3.6vw, 3rem); }

  .big { position: relative; display: grid; align-items: end; pointer-events: none; }
  .name {
    grid-area: 1 / 1; display: flex; flex-direction: column; gap: $space-2;
    font: 800 clamp(3.2rem, 11vw, 10rem)/0.9 $font-sans; letter-spacing: -0.055em; color: #fff;
    opacity: 0; transform: translateY(40px); filter: blur(8px);
    transition: opacity 500ms $ease, transform 700ms $ease, filter 500ms $ease;
    &.on { opacity: 1; transform: none; filter: none; }
    small { font: 0.8rem $font-mono; letter-spacing: 0.14em; text-transform: uppercase; color: $color-accent; }
  }

  .list {
    position: absolute; right: 0; top: 50%; transform: translateY(-30%); width: min(320px, 34vw);
    margin-right: $space-8; display: flex; flex-direction: column; gap: $space-4;
    @media (max-width: 1023px) { position: static; transform: none; width: auto; margin: $space-6 0 0; .lead { display: none; } }
  }
  .lead { @include body; color: $color-on-dark-muted; font-size: 0.95rem; }
  ol { list-style: none; margin: 0; padding: 0; border-top: 1px solid $color-on-dark-hairline;
    @media (max-width: 1023px) { display: grid; grid-template-columns: 1fr 1fr; column-gap: $space-4; }
  }
  li { border-bottom: 1px solid $color-on-dark-hairline; opacity: 0.45; transition: opacity 300ms; &.on { opacity: 1; } }
  a {
    display: flex; align-items: center; gap: $space-3; padding: 12px 0; color: #fff; text-decoration: none;
    font: 700 1.1rem $font-sans; @include focus-ring;
    span { font-family: $font-sans; }
    em { font: normal 0.62rem $font-mono; letter-spacing: 0.12em; text-transform: uppercase; color: $color-accent; border: 1px solid $color-accent; padding: 2px 7px; border-radius: 99px; }
    i { margin-left: auto; font-style: normal; transition: transform 300ms $ease; }
    &:hover i { transform: translateX(5px); color: $color-accent; }
  }

  @media (max-width: 1023px) {
    .globe-wrap { left: 50%; top: 58%; width: 130vw; height: 130vw; margin-left: -65vw; margin-top: -65vw; opacity: 0.7; }
  }

  :global(.rm) {
    .stage { min-height: 100svh; }
    .layer { min-height: 100svh; }
    .big { display: none; }
    .list { position: static; transform: none; width: auto; margin: $space-8 0 0; }
    li { opacity: 1; }
  }
</style>
