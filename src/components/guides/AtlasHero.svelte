<script lang="ts">
  /**
   * Guides hero. The ink field of the home hero with a dotted globe turning
   * behind the headline. The search is the main control: as you type, the
   * globe turns to the best match and lights it, quick links to the top
   * matches appear under the field, and Enter opens the first one. The same
   * query filters the index below (bound in the page). "/" focuses the field.
   */
  import { onMount } from 'svelte';
  import Globe from '../landing/Globe.svelte';
  import { camera } from './spin.ts';
  import { IRP_COUNTRIES, matchGuides, marks, fold, type AtlasEntry } from '../../lib/data/guide-atlas.ts';

  export let guides: AtlasEntry[] = [];
  export let query = '';
  /** Opens a guide (the page decides whether the email step comes first). */
  export let open: (e: Event | null, g: AtlasEntry) => void;

  const TITLE = 'Customs rules for wherever you move next.';
  const SAMPLES = ['Portugal', 'Japan', 'Costa Rica', 'Canada', 'Thailand', 'Spain', 'New Zealand', 'Mexico', 'Germany'];

  let lon = -40;
  let lat = 14;
  let cam: ReturnType<typeof camera> | null = null;
  let input: HTMLInputElement;
  let typed = '';
  let focused = false;
  let shown = guides.length;
  let mx = 0;
  let my = 0;

  $: matches = query.trim() ? matchGuides(guides, query) : [];
  $: top = matches[0];
  $: if (cam) top ? cam.to(top.lon, top.lat) : cam.idle();
  $: markers = guides.map((g) => {
    const on = top ? g.slug === top.slug : g.slug in IRP_COUNTRIES;
    return { lon: g.lon, lat: g.lat, on, label: top && on ? g.name : undefined };
  });

  function onKey(e: KeyboardEvent) {
    if (e.key === 'Enter' && top) {
      e.preventDefault();
      open(null, top);
    } else if (e.key === 'ArrowDown' && matches.length) {
      e.preventDefault();
      document.querySelector<HTMLElement>('.hero-matches a')?.focus();
    } else if (e.key === 'Escape') {
      query = '';
    }
  }

  function onMatchKey(e: KeyboardEvent) {
    const links = Array.from(document.querySelectorAll<HTMLElement>('.hero-matches a'));
    const i = links.indexOf(e.currentTarget as HTMLElement);
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') { e.preventDefault(); links[i + 1]?.focus(); }
    if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') { e.preventDefault(); (links[i - 1] ?? input).focus(); }
  }

  function onMove(e: PointerEvent) {
    if (e.pointerType !== 'mouse') return;
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    mx = ((e.clientX - r.left) / r.width - 0.5) * 2;
    my = ((e.clientY - r.top) / r.height - 0.5) * 2;
  }

  onMount(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    cam = camera((l, p) => { lon = l; lat = p; }, [lon, lat]);

    // Placeholder that types destination names until the visitor starts typing.
    let t = 0;
    let i = 0;
    let c = 0;
    let dir = 1;
    const step = () => {
      const w = SAMPLES[i];
      c += dir;
      if (c > w.length) { dir = -1; t = window.setTimeout(step, 1500); return; }
      if (c < 0) { c = 0; dir = 1; i = (i + 1) % SAMPLES.length; t = window.setTimeout(step, 260); return; }
      typed = w.slice(0, c);
      t = window.setTimeout(step, dir > 0 ? 85 + Math.random() * 60 : 35);
    };
    if (reduce) typed = SAMPLES[0];
    else t = window.setTimeout(step, 1100);

    // Count the guides up once the strip has come in.
    const total = guides.length;
    if (!reduce) {
      shown = 0;
      const t0 = performance.now() + 900;
      const run = (now: number) => {
        const k = Math.min(1, Math.max(0, (now - t0) / 1400));
        shown = Math.round(total * (1 - Math.pow(1 - k, 4)));
        if (k < 1) requestAnimationFrame(run);
      };
      requestAnimationFrame(run);
    }

    const slash = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (e.key !== '/' || el.closest('input, textarea, [contenteditable]')) return;
      e.preventDefault();
      input?.focus();
      input?.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
    };
    window.addEventListener('keydown', slash);
    return () => {
      window.clearTimeout(t);
      cam?.destroy();
      window.removeEventListener('keydown', slash);
    };
  });
</script>

<section class="hero" aria-labelledby="guides-title" on:pointermove={onMove} on:pointerleave={() => { mx = 0; my = 0; }}>
  <div class="glow" aria-hidden="true"></div>
  <div class="grid-lines" aria-hidden="true"></div>
  <div class="globe" aria-hidden="true" style="--mx:{mx}; --my:{my}">
    <Globe {lon} {lat} {markers} dot="rgba(214,250,251,0.9)" pin="rgba(214,250,251,0.38)" />
  </div>

  <div class="wrap inner">
    <p class="eyebrow enter" style="--d:80ms"><span class="dot" aria-hidden="true"></span>Country guides · {guides.length} destinations</p>
    <h1 class="title" id="guides-title" aria-label={TITLE}>
      {#each TITLE.split(' ') as w, i}
        <span class="w" aria-hidden="true"><span style="--d:{160 + i * 70}ms">{w}</span></span>{' '}
      {/each}
    </h1>
    <p class="lead enter" style="--d:620ms">
      What customs asks for, what it taxes and what it refuses, for household goods, cars and pets. Free to read; we ask for your email once.
    </p>

    <div class="search enter" style="--d:760ms" class:focused class:filled={query}>
      <label class="s-label" for="guide-search">Where are you moving?</label>
      <div class="field">
        <svg class="mag" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
        <input
          id="guide-search"
          bind:this={input}
          bind:value={query}
          type="search"
          autocomplete="off"
          spellcheck="false"
          aria-describedby="guide-search-hint"
          aria-controls="hero-matches"
          on:focus={() => (focused = true)}
          on:blur={() => (focused = false)}
          on:keydown={onKey}
        />
        {#if !query}
          <span class="ghost" aria-hidden="true">{typed}<i class="caret"></i></span>
        {/if}
        {#if query}
          <button type="button" class="clear" on:click={() => { query = ''; input.focus(); }} aria-label="Clear search">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
          </button>
        {:else}
          <kbd aria-hidden="true">/</kbd>
        {/if}
        <span class="rule" aria-hidden="true"></span>
      </div>
      <p class="hint" id="guide-search-hint" aria-live="polite">
        {#if !query}
          Country or capital city. Enter opens the first match.
        {:else if matches.length}
          {matches.length} {matches.length === 1 ? 'guide' : 'guides'} · Enter opens <b>{top.name}</b>
        {:else}
          No guide for “{query}” yet. <a href="#index">Browse all {guides.length}</a>
        {/if}
      </p>
      <ul class="hero-matches" id="hero-matches">
        {#each matches.slice(0, 5) as g, i (g.slug)}
          <li style="--i:{i}">
            <a href="/guides/{g.slug}" on:click={(e) => open(e, g)} on:keydown={onMatchKey}>
              <span class="iso">{g.iso}</span>
              <span>{#each marks(g.name, query) as part}{#if part.m}<mark>{part.t}</mark>{:else}{part.t}{/if}{/each}</span>
              {#if g.capital && !fold(g.name).includes(fold(query))}<small>{g.capital}</small>{/if}
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
            </a>
          </li>
        {/each}
      </ul>
    </div>
  </div>

  <div class="wrap strip enter" style="--d:900ms">
    <ul class="facts">
      <li><span class="value">{shown}</span><span class="label">country guides, A to Z</span></li>
      <li><span class="value">6</span><span class="label">chapters in every guide</span></li>
      <li><span class="value">6</span><span class="label">countries where IRP has a team</span></li>
    </ul>
    <a class="cue" href="#index">
      <span>Browse the index</span>
      <i aria-hidden="true"></i>
    </a>
  </div>
</section>

<style lang="scss">
  @use '../landing/tokens' as *;

  .hero {
    position: relative;
    isolation: isolate;
    overflow: hidden;
    min-height: 100vh;
    min-height: 100svh;
    display: grid;
    grid-template-rows: 1fr auto;
    grid-template-columns: minmax(0, 1fr);
    background: $color-ink-strong;
    color: $color-on-dark;
    padding-top: 8.5rem;
    padding-bottom: $space-8;
  }
  .glow {
    position: absolute; inset: -20% -10% auto; height: 130%; z-index: -2; pointer-events: none;
    background:
      radial-gradient(48% 46% at 76% 46%, rgba(2, 181, 187, 0.3), transparent 70%),
      radial-gradient(40% 40% at 8% 90%, rgba(2, 181, 187, 0.16), transparent 70%);
  }
  .grid-lines {
    position: absolute; inset: 0; z-index: -2; pointer-events: none; opacity: 0.5;
    background-image: linear-gradient(to right, rgba(255, 255, 255, 0.045) 1px, transparent 1px);
    background-size: calc(100% / 12) 100%;
    mask-image: linear-gradient(to bottom, transparent, #000 30%, #000 70%, transparent);
  }
  .globe {
    position: absolute; z-index: -1; right: -14vw; top: 50%;
    width: min(118vh, 74vw); height: min(118vh, 74vw);
    width: min(118svh, 74vw); height: min(118svh, 74vw);
    transform: translate3d(calc(var(--mx) * -14px), calc(-50% + var(--my) * -10px), 0);
    transition: transform 1.2s $ease;
    animation: globe-in 2.2s $ease 0.1s both;
    @media (max-width: 1023px) {
      right: -62vw; top: 30%; width: 130vw; height: 130vw; opacity: 0.38;
    }
  }
  @keyframes globe-in {
    from { opacity: 0; scale: 0.86; filter: blur(10px); }
    to { opacity: 1; scale: 1; filter: none; }
  }

  .wrap { @include container; }
  .inner { position: relative; display: flex; flex-direction: column; justify-content: center; gap: $space-6; padding-bottom: $space-8; }

  /* Entrances run on CSS alone, so the hero is complete before any script. */
  .enter { animation: rise 1s $ease var(--d, 0ms) both; }
  @keyframes rise { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: none; } }

  .eyebrow { @include eyebrow; color: $color-on-dark; display: inline-flex; align-items: center; gap: $space-2; }
  .dot { width: 6px; height: 6px; border-radius: 50%; background: $color-accent; box-shadow: 0 0 0 0 rgba(2, 181, 187, 0.6); animation: ping 2.4s $ease infinite; }
  @keyframes ping { 0% { box-shadow: 0 0 0 0 rgba(2, 181, 187, 0.6); } 70%, 100% { box-shadow: 0 0 0 9px rgba(2, 181, 187, 0); } }

  .title {
    margin: 0; max-width: 13ch;
    font: 800 clamp(2.6rem, 6.2vw, 5.6rem)/0.95 $font-sans; letter-spacing: -0.05em; color: #fff;
  }
  .w { display: inline-block; overflow: hidden; vertical-align: top; padding-bottom: 0.08em; margin-bottom: -0.08em; }
  .w > span { display: inline-block; animation: word 1.1s $ease var(--d) both; }
  @keyframes word { from { transform: translateY(105%) rotate(4deg); } to { transform: none; } }

  .lead { margin: 0; max-width: 46ch; font: clamp(1.02rem, 1.4vw, 1.2rem)/1.6 $font-sans; color: $color-on-dark-muted; }

  .search { max-width: 560px; margin-top: $space-2; }
  .s-label { display: block; margin-bottom: $space-2; font: 0.72rem $font-mono; letter-spacing: 0.14em; text-transform: uppercase; color: $color-accent; }
  .field { position: relative; display: flex; align-items: center; gap: $space-3; padding: 14px 4px 14px 2px; }
  .mag { flex: none; width: 26px; height: 26px; fill: none; stroke: rgba(255, 255, 255, 0.6); stroke-width: 2; stroke-linecap: round; transition: stroke 300ms, transform 500ms $ease; }
  .focused .mag { stroke: $color-accent; transform: rotate(-12deg) scale(1.08); }
  input {
    flex: 1; min-width: 0; border: 0; outline: 0; background: none; padding: 0;
    font: 700 clamp(1.5rem, 3vw, 2.25rem)/1.15 $font-sans; letter-spacing: -0.03em; color: #fff;
    caret-color: $color-accent;
    &::-webkit-search-cancel-button { display: none; }
  }
  .ghost {
    position: absolute; left: calc(26px + #{$space-3} + 2px); top: 50%; transform: translateY(-50%); pointer-events: none;
    font: 700 clamp(1.5rem, 3vw, 2.25rem)/1.15 $font-sans; letter-spacing: -0.03em; color: rgba(255, 255, 255, 0.28);
    white-space: nowrap;
  }
  .focused .ghost { color: rgba(255, 255, 255, 0.16); }
  .caret { display: inline-block; width: 2px; height: 0.9em; margin-left: 3px; vertical-align: -0.08em; background: $color-accent; animation: blink 1s steps(1) infinite; }
  @keyframes blink { 50% { opacity: 0; } }
  kbd {
    flex: none; display: grid; place-items: center; width: 28px; height: 28px; border-radius: 7px;
    border: 1px solid rgba(255, 255, 255, 0.22); font: 0.8rem $font-mono; color: rgba(255, 255, 255, 0.6);
    @media (hover: none) { display: none; }
  }
  .clear {
    flex: none; display: grid; place-items: center; width: 36px; height: 36px; border-radius: 50%; border: 0; cursor: pointer;
    background: rgba(255, 255, 255, 0.1); transition: background 200ms, transform 300ms $ease; @include focus-ring;
    svg { width: 16px; height: 16px; stroke: #fff; stroke-width: 2; stroke-linecap: round; }
    &:hover { background: rgba(255, 255, 255, 0.18); transform: rotate(90deg); }
  }
  /* Underline: a hairline that fills with teal from the left while focused. */
  .rule {
    position: absolute; left: 0; right: 0; bottom: 0; height: 2px; background: rgba(255, 255, 255, 0.18); overflow: hidden;
    &::after { content: ''; position: absolute; inset: 0; background: $color-accent; transform: scaleX(0); transform-origin: left; transition: transform 700ms $ease; }
  }
  .focused .rule::after, .filled .rule::after { transform: scaleX(1); }
  .hint {
    margin: $space-3 0 0; min-height: 1.4em; font: 0.86rem/1.4 $font-sans; color: $color-on-dark-muted;
    b { color: #fff; }
    a { color: $color-accent; }
  }
  .hero-matches {
    list-style: none; margin: $space-3 -12px 0; padding: 4px 12px; display: flex; gap: $space-2; min-height: 48px;
    overflow-x: auto; scrollbar-width: none; &::-webkit-scrollbar { display: none; }
    mask-image: linear-gradient(to right, transparent, #000 12px, #000 calc(100% - 28px), transparent);
    li { flex: none; animation: chip 500ms $ease calc(var(--i) * 45ms) both; }
    a {
      display: inline-flex; align-items: center; gap: 10px; min-height: 40px; padding: 6px 12px 6px 6px; border-radius: $radius-pill;
      background: rgba(255, 255, 255, 0.07); border: 1px solid rgba(255, 255, 255, 0.14); color: #fff; text-decoration: none;
      font: 600 0.92rem $font-sans; backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
      transition: background 250ms, border-color 250ms, transform 400ms $ease; @include focus-ring;
      svg { width: 15px; height: 15px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; opacity: 0.6; transition: transform 400ms $ease, opacity 250ms; }
      &:hover, &:focus-visible { background: rgba(2, 181, 187, 0.18); border-color: rgba(2, 181, 187, 0.6); transform: translateY(-2px);
        svg { transform: translateX(3px); opacity: 1; } }
    }
    li:first-child a { background: $color-accent; border-color: $color-accent; color: $color-ink-strong;
      .iso { background: rgba(14, 47, 54, 0.14); color: $color-ink-strong; } }
    .iso { display: grid; place-items: center; min-width: 30px; height: 28px; padding: 0 6px; border-radius: $radius-pill; background: rgba(255, 255, 255, 0.1); font: 0.68rem $font-mono; letter-spacing: 0.08em; color: $color-accent; }
    small { font: 500 0.75rem $font-sans; opacity: 0.6; margin-left: -4px; }
    mark { background: none; color: inherit; text-decoration: underline; text-decoration-thickness: 2px; text-underline-offset: 3px; }
  }
  @keyframes chip { from { opacity: 0; transform: translateY(8px) scale(0.96); } to { opacity: 1; transform: none; } }

  .strip {
    position: relative; display: grid; gap: $space-6; align-items: end; padding-top: $space-6; border-top: 1px solid $color-on-dark-hairline;
    @include lg { grid-template-columns: 1fr auto; }
  }
  .facts {
    list-style: none; margin: 0; padding: 0; display: grid; gap: $space-4;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    @include lg { gap: $space-12; grid-template-columns: repeat(3, auto); }
    li { display: flex; flex-direction: column; gap: $space-1; padding-inline-start: $space-4; border-left: 2px solid $color-accent; }
  }
  .value { font: 700 clamp(1.3rem, 2.2vw, 1.75rem) $font-sans; letter-spacing: -0.03em; font-variant-numeric: tabular-nums; }
  .label { font: 0.82rem/1.35 $font-sans; color: $color-on-dark-muted; }
  .cue {
    display: inline-flex; align-items: center; gap: $space-3; color: #fff; text-decoration: none;
    font: 0.72rem $font-mono; letter-spacing: 0.14em; text-transform: uppercase; @include focus-ring;
    i { position: relative; width: 1px; height: 44px; background: rgba(255, 255, 255, 0.2); overflow: hidden; }
    i::after { content: ''; position: absolute; left: 0; top: 0; width: 1px; height: 40%; background: $color-accent; animation: drip 1.8s $ease infinite; }
    @media (max-width: 1023px) { display: none; }
  }
  @keyframes drip { from { transform: translateY(-100%); } to { transform: translateY(260%); } }

  @media (max-width: 767px) {
    .hero { padding-top: 7.5rem; }
    .facts { gap: $space-3; }
    .facts li { padding-inline-start: $space-3; }
    .label { font-size: 0.72rem; }
  }

  @include reduced-motion {
    .enter, .w > span, .globe, .hero-matches li, .dot, .caret, .cue i::after { animation: none !important; }
    .globe { transition: none; }
  }
</style>
