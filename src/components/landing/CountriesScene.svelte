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
  /**
   * The globe visits the countries in the order the narrator names them
   * ("Costa Rica, Panama, Mexico, Portugal, Spain, and Colombia"), so the
   * country on screen always matches the voice.
   */
  const TOUR = ['Costa Rica', 'Panama', 'Mexico', 'Portugal', 'Spain', 'Colombia'].map((n) => list.findIndex((c) => c.name === n));
  /** Country facts shown while the globe holds on a country (IRP offices from lib/data/offices.ts). */
  const FACTS: Record<string, { capital: string; currency: string; language: string; office: string }> = {
    'Costa Rica': { capital: 'San José', currency: 'Costa Rican colón', language: 'Spanish', office: 'Alajuela and Guanacaste' },
    Spain: { capital: 'Madrid', currency: 'Euro', language: 'Spanish', office: 'Madrid' },
    Panama: { capital: 'Panama City', currency: 'Balboa and US dollar', language: 'Spanish', office: 'Panama City' },
    Portugal: { capital: 'Lisbon', currency: 'Euro', language: 'Portuguese', office: 'Guide and remote consulting' },
    Mexico: { capital: 'Mexico City', currency: 'Mexican peso', language: 'Spanish', office: 'Mexico City' },
    Colombia: { capital: 'Bogotá', currency: 'Colombian peso', language: 'Spanish', office: 'Guide and remote consulting' }
  };

  let p = 0;
  $: st = stations(seg(p, 0, 0.86), N, 0.8, 1.3);
  $: i = Math.min(N - 2, Math.floor(st.x));
  $: move = st.x - i;
  $: step = Math.round(st.x);
  $: active = TOUR[step];
  $: holding = st.x === st.at && st.hold > 0.08;
  $: out = easeInOut(seg(p, 0.86, 1));
  $: a = GEO[list[TOUR[i]].name];
  $: b = GEO[list[TOUR[Math.min(N - 1, i + 1)]].name];
  $: gLon = lerp(lerp(a[0], b[0], move), -50, out);
  $: gLat = lerp(lerp(a[1], b[1], move), 18, out);
  // Pull back a little while travelling between countries, then settle in.
  $: gScale = lerp(1.25 - 0.18 * Math.sin(Math.PI * move), 0.95, out);
  $: facts = FACTS[list[active].name];
  $: showCatch = out < 0.5;
  $: markers = list.map((c, k) => ({ lon: GEO[c.name][0], lat: GEO[c.name][1], on: k === active || out > 0.5 }));
</script>

<section id="countries" class="scene" style="--len:5" use:scene={(v) => (p = v)} aria-labelledby="countries-title">
  <span id="countries-we-serve" class="anchor-alias" aria-hidden="true"></span>
  <div class="stage">
    <div class="globe-wrap" style="transform: translate3d({(1 - out) * 8}vw, 0, 0)">
      <Globe lon={gLon} lat={gLat} scale={gScale} {markers} dot="rgba(214,250,251,0.95)" />
    </div>
    <div class="wrap layer">
      <header class="head">
        <p class="eyebrow"><span class="dot" aria-hidden="true"></span>{COUNTRIES.eyebrow}</p>
        <h2 class="title" id="countries-title">{COUNTRIES.title}</h2>
      </header>

      <div class="big" aria-hidden="true">
        {#each list as c, k}
          <span class="name" class:on={k === active && out < 0.5}>
            <small>0{TOUR.indexOf(k) + 1} / 0{N}{c.tours ? ' · Tours' : ''}</small>{c.name}
          </span>
        {/each}
        <dl class="facts" class:on={holding && out < 0.5}>
          <div><dt>Capital</dt><dd>{facts.capital}</dd></div>
          <div><dt>Currency</dt><dd>{facts.currency}</dd></div>
          <div><dt>Language</dt><dd>{facts.language}</dd></div>
          <div><dt>IRP</dt><dd>{facts.office}</dd></div>
          {#if list[active].tours}<div class="tour"><dt>Tours</dt><dd>Private relocation tours</dd></div>{/if}
        </dl>
      </div>

      <nav class="list" aria-label="Country guides">
        <!-- One note per country, in tour order; the one for the country on screen is shown.
             All stay in the reading order for screen readers. -->
        <div class="note">
        <section class="catch" class:done={!showCatch} aria-labelledby="catch-title">
          <header class="cc-head">
            <h3 class="cc-title" id="catch-title">{COUNTRIES.catchHeading}</h3>
            <span class="cc-year">{COUNTRIES.catchYear}</span>
          </header>
          <!-- Which country of the tour we are on: one segment each, the current one fills. -->
          <div class="cc-steps" aria-hidden="true">
            {#each TOUR as k, n}
              <i class:past={TOUR.indexOf(active) > n} class:now={k === active}></i>
            {/each}
          </div>
          <div class="cc-stack">
            {#each TOUR as k}
              {@const c = list[k]}
              <div class="cc-country" class:on={k === active && showCatch}>
                <h4 class="cc-name">{c.name}</h4>
                <dl class="cc-facts">
                  {#each COUNTRIES.catches[c.name] as f, j}
                    <div class="cc-fact" style="--j:{j}">
                      <dt class="cc-stat">{f.stat}</dt>
                      <dd><b>{f.label}</b><span>{f.text}</span></dd>
                    </div>
                  {/each}
                </dl>
              </div>
            {/each}
          </div>
        </section>
        <p class="lead" class:on={!showCatch}>{COUNTRIES.lead}</p>
        </div>
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
  /* Kept for old links to /#countries-we-serve. */
  .anchor-alias { position: absolute; top: 0; left: 0; }
  .globe-wrap { position: absolute; left: -12vw; top: 50%; width: min(118vh, 92vw); width: min(118svh, 92vw); height: min(118vh, 92vw); height: min(118svh, 92vw); margin-top: calc(min(118vh, 92vw) / -2); margin-top: calc(min(118svh, 92vw) / -2); will-change: transform; }
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

  .facts {
    grid-area: 1 / 1; align-self: start; justify-self: start; margin: clamp(20px, 5vh, 56px) 0 0; padding: 14px 16px; border-radius: 14px; display: grid; grid-template-columns: repeat(2, minmax(120px, auto)); gap: 10px 22px;
    background: rgba(8, 36, 42, 0.72); border: 1px solid rgba(127, 227, 230, 0.25);
    backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
    opacity: 0; transform: translateY(12px); transition: opacity 450ms $ease, transform 600ms $ease;
    &.on { opacity: 1; transform: none; transition-delay: 120ms; }
    dt { font: 0.58rem $font-mono; letter-spacing: 0.14em; text-transform: uppercase; color: $color-accent; }
    dd { margin: 2px 0 0; font: 600 0.9rem $font-sans; color: #fff; }
    .tour dd { color: $color-accent; }
    @media (max-width: 1023px) { display: none; }
  }
  .list {
    position: absolute; right: 0; top: 50%; transform: translateY(-46%); width: min(380px, 32vw);
    margin-right: $space-8; display: flex; flex-direction: column; gap: $space-4;
    @media (max-width: 1023px) { position: static; transform: none; width: auto; margin: $space-6 0 0; }
  }
  .lead { @include body; color: $color-on-dark-muted; font-size: 0.95rem; }
  /* The note area holds the catch card during the tour and the lead at the end, in the same spot. */
  .note { display: grid; align-items: end; > * { grid-area: 1 / 1; } }
  .note .lead { opacity: 0; transition: opacity 400ms $ease 150ms; &.on { opacity: 1; } }

  /* What catches people out: a quiet spec sheet. All six countries sit in the
     same grid cell, so the card keeps one height and nothing below it moves. */
  .catch {
    position: relative; padding: 16px 18px 6px; border-radius: 20px;
    background: rgba(255, 255, 255, 0.06); border: 1px solid rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(20px) saturate(140%); -webkit-backdrop-filter: blur(20px) saturate(140%);
    box-shadow: 0 30px 60px -40px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.06);
    transition: opacity 500ms $ease, transform 600ms $ease;
    &.done { opacity: 0; transform: translateY(-8px) scale(0.98); pointer-events: none; }
  }
  .cc-head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }
  .cc-title { margin: 0; font: 600 0.82rem $font-sans; letter-spacing: -0.005em; color: rgba(255, 255, 255, 0.92); }
  .cc-year { font: 500 0.7rem $font-mono; letter-spacing: 0.06em; color: rgba(255, 255, 255, 0.5); }
  .cc-steps {
    display: grid; grid-template-columns: repeat(6, 1fr); gap: 4px; margin: 10px 0 2px;
    i { position: relative; height: 2px; border-radius: 2px; background: rgba(255, 255, 255, 0.14); overflow: hidden; }
    i::after { content: ''; position: absolute; inset: 0; background: #fff; transform: scaleX(0); transform-origin: left; transition: transform 700ms $ease; }
    i.past::after { transform: scaleX(1); opacity: 0.45; }
    i.now::after { transform: scaleX(1); }
  }
  .cc-stack { display: grid; > * { grid-area: 1 / 1; } }
  /* Hidden countries are only transparent (not display:none), so screen readers still read all six in order. */
  .cc-country {
    opacity: 0; pointer-events: none; transition: opacity 280ms ease;
    &.on { opacity: 1; pointer-events: auto; transition: opacity 300ms ease 80ms; }
  }
  .cc-name { margin: 12px 0 2px; font: 700 1.15rem/1.2 $font-sans; letter-spacing: -0.02em; color: #fff; }
  .cc-facts { margin: 0; }
  .cc-fact {
    display: grid; grid-template-columns: 96px minmax(0, 1fr); gap: 12px; align-items: baseline;
    padding: 11px 0; border-top: 1px solid rgba(255, 255, 255, 0.08);
    &:first-child { border-top: none; }
    opacity: 0; transform: translateY(8px); filter: blur(3px);
    transition: opacity 320ms ease, transform 520ms $ease, filter 320ms ease;
  }
  .cc-country.on .cc-fact { opacity: 1; transform: none; filter: none; transition-delay: calc(120ms + var(--j) * 70ms); }
  .cc-stat {
    font: 600 1.02rem/1.25 $font-sans; letter-spacing: -0.02em; color: #fff; font-variant-numeric: tabular-nums;
    overflow-wrap: anywhere;
  }
  .cc-fact dd {
    margin: 0; display: flex; flex-direction: column; gap: 2px;
    b { font: 500 0.82rem/1.35 $font-sans; color: rgba(255, 255, 255, 0.92); }
    span { font: 400 0.76rem/1.45 $font-sans; color: rgba(255, 255, 255, 0.62); }
  }
  /* Short screens: keep the figures and their labels, drop the second line. */
  @media (min-width: 1024px) and (max-height: 820px) {
    .cc-fact { padding: 8px 0; }
    .cc-fact dd span { display: none; }
    .cc-name { margin-top: 8px; }
    a { padding: 7px 0; }
  }
  ol { list-style: none; margin: 0; padding: 0; border-top: 1px solid $color-on-dark-hairline;
    @media (max-width: 1023px) { display: grid; grid-template-columns: 1fr 1fr; column-gap: $space-4; }
  }
  li { border-bottom: 1px solid $color-on-dark-hairline; opacity: 0.45; transition: opacity 300ms; &.on { opacity: 1; } }
  a {
    display: flex; align-items: center; gap: $space-3; padding: 9px 0; color: #fff; text-decoration: none;
    font: 700 1rem $font-sans; @include focus-ring;
    span { font-family: $font-sans; }
    em { font: normal 0.62rem $font-mono; letter-spacing: 0.12em; text-transform: uppercase; color: $color-accent; border: 1px solid $color-accent; padding: 2px 7px; border-radius: 99px; }
    i { margin-left: auto; font-style: normal; transition: transform 300ms $ease; }
    &:hover i { transform: translateX(5px); color: $color-accent; }
  }

  @media (max-width: 1023px) {
    .globe-wrap { left: 50%; top: 58%; width: 130vw; height: 130vw; margin-left: -65vw; margin-top: -65vw; opacity: 0.7; }
  }

  :global(.rm) {
    .stage { min-height: 100vh; min-height: 100svh; }
    .layer { min-height: 100vh; min-height: 100svh; }
    .big { display: none; }
    .list { position: static; transform: none; width: auto; margin: $space-8 0 0; }
    li { opacity: 1; }
    .note > * { grid-area: auto; }
    .note .lead { opacity: 1; }
    .catch.done { opacity: 1; transform: none; pointer-events: auto; }
    .cc-steps { display: none; }
    .cc-stack { gap: 6px; }
    .cc-country { grid-area: auto; opacity: 1; }
    .cc-fact { opacity: 1; transform: none; filter: none; }
  }
  @include reduced-motion { .cc-fact, .cc-country, .cc-steps i::after { transition: none !important; } }
</style>
