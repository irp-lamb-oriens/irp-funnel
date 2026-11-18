<script lang="ts">
  /**
   * The index: every guide, A to Z, as an editorial list.
   *
   * Desktop: a sticky "lens" on the left holds a globe that turns to the
   * country being read. It follows the row crossing the middle of the screen
   * as you scroll, and the row under the pointer or keyboard focus while you
   * hover. A reticle locks on at the centre and the country's facts set in
   * underneath. The list on the right is grouped by letter, with a letter
   * rail on the far right that tracks where you are.
   *
   * A sticky bar carries a filter field (the same query as the hero search),
   * region tabs with a sliding indicator and live counts, and the result
   * count. The bar steps down below the site header whenever the header
   * shows (it hides on scroll down, returns on scroll up).
   *
   * The lens is decorative (aria-hidden); every fact it shows is in the row.
   */
  import { onMount, tick } from 'svelte';
  import Globe from '../landing/Globe.svelte';
  import { reveal } from '../landing/reveal.ts';
  import { LILI_WHATSAPP } from '../landing/content.ts';
  import { camera } from './spin.ts';
  import {
    REGIONS,
    IRP_COUNTRIES,
    matchGuides,
    marks,
    initial,
    coords,
    type AtlasEntry,
    type Region
  } from '../../lib/data/guide-atlas.ts';

  export let guides: AtlasEntry[] = [];
  export let query = '';
  export let open: (e: Event | null, g: AtlasEntry) => void;

  type Tab = 'All' | Region;
  const TABS: Tab[] = ['All', ...REGIONS];
  const ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  const order = new Map(guides.map((g, i) => [g.slug, i + 1]));

  let region: Tab = 'All';
  let hovered: string | null = null;
  let scrolled: string | null = null;
  let headerShown = true;
  let stuck = false;
  let tabEls: Record<string, HTMLElement> = {};
  let tabsEl: HTMLElement;
  let ind = { x: 0, w: 0 };
  let listEl: HTMLElement;
  let sentinel: HTMLElement;
  let lon = guides[0]?.lon ?? 0;
  let lat = guides[0]?.lat ?? 0;
  let cam: ReturnType<typeof camera> | null = null;
  let reduce = false;

  // Sorted by name already (the page sorts); matchGuides keeps relevance order,
  // so re-sort the filtered list alphabetically for the A to Z.
  $: byQuery = query.trim() ? matchGuides(guides, query).sort((a, b) => (order.get(a.slug) ?? 0) - (order.get(b.slug) ?? 0)) : guides;
  $: filtered = region === 'All' ? byQuery : byQuery.filter((g) => g.region === region);
  $: counts = Object.fromEntries(TABS.map((t) => [t, t === 'All' ? byQuery.length : byQuery.filter((g) => g.region === t).length])) as Record<Tab, number>;
  $: groups = group(filtered);
  $: letters = new Set(groups.map((g) => g.letter));
  $: bySlug = new Map(filtered.map((g) => [g.slug, g]));
  $: active = (hovered && bySlug.get(hovered)) || (scrolled && bySlug.get(scrolled)) || filtered[0];
  $: railLetter = active ? initial(active.name) : '';
  $: if (cam && active) cam.to(active.lon, active.lat);
  $: markers = filtered.map((g) => ({ lon: g.lon, lat: g.lat, on: g.slug === active?.slug }));
  $: region, tabEls, measure();

  function group(list: AtlasEntry[]) {
    const out: { letter: string; items: AtlasEntry[] }[] = [];
    for (const g of list) {
      const L = initial(g.name);
      if (out.at(-1)?.letter !== L) out.push({ letter: L, items: [] });
      out.at(-1)!.items.push(g);
    }
    return out;
  }

  function measure() {
    const el = tabEls[region];
    if (el) ind = { x: el.offsetLeft, w: el.offsetWidth };
  }

  /** After the filter changes, bring the top of the list back into view if the reader is deep in it. */
  async function toList() {
    await tick();
    if (!listEl) return;
    const top = listEl.getBoundingClientRect().top;
    if (top < 0) window.scrollTo({ top: window.scrollY + top - 170, behavior: reduce ? 'auto' : 'smooth' });
  }

  function setRegion(r: Tab) {
    region = r;
    hovered = null;
    tabEls[r]?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: reduce ? 'auto' : 'smooth' });
    toList();
  }

  function jump(L: string) {
    const el = document.getElementById(`letter-${L}`);
    el?.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' });
  }

  function clearAll() {
    query = '';
    region = 'All';
  }

  // Which row is crossing the middle of the screen.
  const io =
    typeof window !== 'undefined'
      ? new IntersectionObserver(
          (entries) => {
            for (const e of entries) if (e.isIntersecting) scrolled = (e.target as HTMLElement).dataset.slug ?? null;
          },
          { rootMargin: '-42% 0px -57% 0px' }
        )
      : null;

  function track(node: HTMLElement, slug: string) {
    node.dataset.slug = slug;
    io?.observe(node);
    return {
      update(s: string) { node.dataset.slug = s; },
      destroy() { io?.unobserve(node); }
    };
  }

  /** Lens text entrance: rise out of a soft blur. */
  function settle(_node: Element, { delay = 0 }: { delay?: number } = {}) {
    return {
      delay,
      duration: reduce ? 0 : 650,
      css: (t: number) => {
        const e = 1 - Math.pow(1 - t, 3);
        return `opacity:${e};transform:translateY(${(1 - e) * 16}px);filter:blur(${(1 - e) * 6}px)`;
      }
    };
  }

  onMount(() => {
    reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    cam = camera((l, p) => { lon = l; lat = p; }, [lon, lat], { ease: 0.09, limit: 72 });
    if (active) cam.to(active.lon, active.lat);

    // Mirror the header's hide-on-scroll so the bar sits under it when it shows.
    let last = window.scrollY;
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        const y = window.scrollY;
        const d = y - last;
        if (Math.abs(d) < 6) return;
        headerShown = !(d > 0 && y > 100);
        last = y;
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    const so = new IntersectionObserver(([e]) => (stuck = !e.isIntersecting && e.boundingClientRect.top < 0));
    so.observe(sentinel);
    const ro = new ResizeObserver(measure);
    ro.observe(tabsEl);
    return () => {
      window.removeEventListener('scroll', onScroll);
      so.disconnect();
      ro.disconnect();
      io?.disconnect();
      cam?.destroy();
    };
  });
</script>

<section id="index" class="index" aria-labelledby="index-title">
  <div class="wrap">
    <header class="head" use:reveal>
      <div>
        <p class="eyebrow"><span class="dot" aria-hidden="true"></span>The index</p>
        <h2 class="title" id="index-title">{guides.length} countries, A&nbsp;to&nbsp;Z.</h2>
      </div>
      <p class="intro">Scroll and the globe follows you round the world. Every guide opens on the same six chapters, so you know where to look.</p>
    </header>
  </div>

  <div class="sentinel" bind:this={sentinel} aria-hidden="true"></div>
  <div class="bar" class:stuck class:lowered={headerShown && stuck}>
    <div class="wrap bar-inner">
      <label class="filter">
        <span class="sr-only">Filter countries</span>
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
        <input type="search" placeholder="Filter by country or capital" bind:value={query} on:input={toList} autocomplete="off" spellcheck="false" />
        {#if query}
          <button type="button" class="x" on:click={() => (query = '')} aria-label="Clear filter">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
          </button>
        {/if}
      </label>
      <div class="tabs" bind:this={tabsEl} role="group" aria-label="Region">
        <span class="ind" aria-hidden="true" style="transform: translateX({ind.x}px); width: {ind.w}px"></span>
        {#each TABS as t}
          <button
            type="button"
            bind:this={tabEls[t]}
            class:on={region === t}
            aria-pressed={region === t}
            disabled={counts[t] === 0 && region !== t}
            on:click={() => setRegion(t)}
          >{t}<sup>{counts[t]}</sup></button>
        {/each}
      </div>
      <p class="count" aria-live="polite"><b>{filtered.length}</b><span> of {guides.length}</span></p>
    </div>
  </div>

  <div class="wrap body-grid" bind:this={listEl}>
    <aside class="lens" aria-hidden="true">
      <div class="lens-card">
        <div class="lens-globe">
          <Globe {lon} {lat} {markers} dot="rgba(214,250,251,0.85)" pin="rgba(214,250,251,0.32)" />
          {#key active?.slug}
            <span class="reticle"><i></i><i></i><i></i><i></i></span>
          {/key}
        </div>
        <div class="lens-info">
          {#if active}
            {#key active.slug}
              <div class="lens-text">
                <p class="lens-kicker" in:settle><span>{active.iso}</span>{active.region}{#if IRP_COUNTRIES[active.slug]}<em>IRP team</em>{/if}</p>
                <p class="lens-name" in:settle={{ delay: 40 }}>{active.name}</p>
                <dl in:settle={{ delay: 90 }}>
                  <div><dt>Capital</dt><dd>{active.capital || '—'}</dd></div>
                  <div><dt>Position</dt><dd>{coords(active.lat, active.lon)}</dd></div>
                  <div><dt>Prohibited</dt><dd>{active.prohibited} listed</dd></div>
                  <div><dt>Restricted</dt><dd>{active.restricted} listed</dd></div>
                </dl>
              </div>
            {/key}
          {/if}
        </div>
      </div>
    </aside>

    <div class="list-col">
      {#if filtered.length}
        {#each groups as grp (grp.letter)}
          <section class="group" id="letter-{grp.letter}" aria-labelledby="letter-h-{grp.letter}">
            <h3 class="letter" id="letter-h-{grp.letter}"><span>{grp.letter}</span><small>{grp.items.length}</small></h3>
            <ol class="rows">
              {#each grp.items as g, j (g.slug)}
                {@const irp = IRP_COUNTRIES[g.slug]}
                <li class="row" class:active={g.slug === active?.slug} use:reveal use:track={g.slug} style="--d:{Math.min(j, 6) * 45}ms">
                  <a
                    href="/guides/{g.slug}"
                    on:click={(e) => open(e, g)}
                    on:pointerenter={() => (hovered = g.slug)}
                    on:pointerleave={() => (hovered = null)}
                    on:focus={() => (hovered = g.slug)}
                    on:blur={() => (hovered = null)}
                  >
                    <span class="n" aria-hidden="true">{String(order.get(g.slug)).padStart(3, '0')}</span>
                    <span class="name">
                      <span class="roll">
                        <span class="a">{#each marks(g.name, query) as part}{#if part.m}<mark>{part.t}</mark>{:else}{part.t}{/if}{/each}</span>
                        <span class="b" aria-hidden="true">{g.name}</span>
                      </span>
                      {#if irp}<em class="tag">IRP team</em>{/if}
                      <span class="sub"><span class="iso">{g.iso}</span>{g.region}{#if g.capital}<i aria-hidden="true">·</i>{#each marks(g.capital, query) as part}{#if part.m}<mark>{part.t}</mark>{:else}{part.t}{/if}{/each}{/if}</span>
                    </span>
                    <span class="stats">
                      <span><b>{g.prohibited}</b> prohibited</span>
                      <span><b>{g.restricted}</b> restricted</span>
                    </span>
                    <span class="go" aria-hidden="true">
                      <svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
                      <svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
                    </span>
                  </a>
                </li>
              {/each}
            </ol>
          </section>
        {/each}
      {:else}
        <div class="empty">
          <p class="e-title">No guide for “{query}”{region !== 'All' ? ` in ${region}` : ''}.</p>
          <p class="e-body">Try the country's English name or its capital. Or ask Lily: she can tell you what applies to your move.</p>
          <div class="e-actions">
            <button type="button" class="ghost" on:click={clearAll}>Clear filters</button>
            <a class="primary" href={LILI_WHATSAPP} target="_blank" rel="noopener">Ask Lily on WhatsApp</a>
          </div>
        </div>
      {/if}
    </div>

    <nav class="rail" aria-label="Jump to letter">
      {#each ALPHA as L}
        <button type="button" class:on={L === railLetter} disabled={!letters.has(L)} on:click={() => jump(L)} aria-label="Countries starting with {L}">{L}</button>
      {/each}
    </nav>
  </div>
</section>

<style lang="scss">
  @use '../landing/tokens' as *;

  $deep-teal: #00757b;

  .index { position: relative; background: $color-canvas; padding-top: $space-16; padding-bottom: $space-24;
    @include md { padding-top: $space-24; } }
  .wrap { @include container; }
  .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }

  .head { display: grid; gap: $space-6; align-items: end; padding-bottom: $space-12; @include reveal(18px);
    @include lg { grid-template-columns: 1.2fr 0.8fr; } }
  .eyebrow { @include eyebrow; display: inline-flex; align-items: center; gap: $space-2; margin-bottom: $space-4; }
  .dot { width: 6px; height: 6px; border-radius: 50%; background: $color-accent; }
  .title { @include heading-xl; font-size: clamp(2.4rem, 6vw, 5rem); letter-spacing: -0.05em; line-height: 0.95; }
  .intro { @include body; max-width: 40ch; }

  /* ── Sticky bar ─────────────────────────────────────────── */
  .sentinel { height: 1px; }
  .bar {
    position: sticky; top: 0; z-index: 30; padding-block: 12px;
    transition: top 600ms $ease, background 300ms, box-shadow 300ms;
    &.stuck {
      background: rgba(255, 255, 255, 0.82); backdrop-filter: blur(16px) saturate(160%); -webkit-backdrop-filter: blur(16px) saturate(160%);
      box-shadow: 0 1px 0 $color-hairline;
    }
    &.lowered { top: 84px; }
  }
  .bar-inner { display: grid; gap: $space-3; align-items: center;
    grid-template-columns: minmax(0, 1fr) auto;
    @include lg { grid-template-columns: minmax(220px, 300px) minmax(0, 1fr) auto; gap: $space-6; } }
  .filter {
    position: relative; display: flex; align-items: center; gap: 10px; height: 46px; padding: 0 8px 0 16px; border-radius: $radius-pill;
    background: $color-mist; border: 1px solid transparent; transition: border-color 250ms, background 250ms, box-shadow 250ms;
    &:focus-within { background: #fff; border-color: $color-accent; box-shadow: 0 0 0 4px rgba(2, 181, 187, 0.14); }
    svg { flex: none; width: 18px; height: 18px; fill: none; stroke: $color-muted; stroke-width: 2; stroke-linecap: round; }
    input { flex: 1; min-width: 0; border: 0; outline: 0; background: none; font: 500 0.98rem $font-sans; color: $color-ink-strong;
      &::placeholder { color: $color-muted; } &::-webkit-search-cancel-button { display: none; } }
    @media (max-width: 1023px) { grid-column: 1 / -1; }
  }
  .x { flex: none; display: grid; place-items: center; width: 30px; height: 30px; border: 0; border-radius: 50%; background: rgba(14, 47, 54, 0.08); cursor: pointer; @include focus-ring;
    svg { width: 14px; height: 14px; stroke: $color-ink-strong; } }
  .tabs {
    position: relative; display: flex; gap: 2px; padding: 4px; border-radius: $radius-pill; background: $color-mist;
    overflow-x: auto; scrollbar-width: none; &::-webkit-scrollbar { display: none; }
    justify-self: start; max-width: 100%;
    button {
      position: relative; z-index: 1; flex: none; display: inline-flex; align-items: flex-start; gap: 3px; height: 38px; padding: 0 14px; align-items: center;
      border: 0; border-radius: $radius-pill; background: none; cursor: pointer; white-space: nowrap;
      font: 600 0.9rem $font-sans; color: $color-steel; transition: color 300ms; @include focus-ring;
      &:hover:not(:disabled) { color: $color-ink-strong; }
      &.on { color: $color-ink-strong; }
      &:disabled { opacity: 0.35; cursor: default; }
    }
    sup { font: 0.62rem $font-mono; color: $color-muted; transform: translateY(-4px); font-variant-numeric: tabular-nums; }
    .on sup { color: $deep-teal; }
  }
  .ind { position: absolute; left: 0; top: 4px; bottom: 4px; border-radius: $radius-pill; background: #fff; box-shadow: 0 1px 2px rgba(14, 47, 54, 0.12), 0 6px 16px -8px rgba(14, 47, 54, 0.3); transition: transform 550ms $ease, width 550ms $ease; }
  .count { margin: 0; font: 0.75rem $font-mono; letter-spacing: 0.1em; text-transform: uppercase; color: $color-muted; white-space: nowrap;
    b { font: 800 1.35rem $font-sans; letter-spacing: -0.03em; color: $color-ink-strong; margin-right: 4px; font-variant-numeric: tabular-nums; }
    @media (max-width: 1023px) { grid-row: 2; grid-column: 2; } }

  /* ── Body grid: lens, list, rail ────────────────────────── */
  .body-grid { display: grid; gap: $space-8; padding-top: $space-8;
    @include lg { grid-template-columns: minmax(0, 0.85fr) minmax(0, 1.4fr) 22px; gap: $space-12; } }

  .lens { display: none; @include lg { display: block; } }
  .lens-card {
    position: sticky; top: 168px; height: calc(100vh - 200px); height: calc(100svh - 200px); min-height: 520px; max-height: 760px;
    display: grid; grid-template-rows: minmax(0, 1fr) auto; border-radius: 28px; overflow: hidden; isolation: isolate;
    background: radial-gradient(120% 80% at 50% 35%, #15474f 0%, $color-ink-strong 62%); color: #fff;
    box-shadow: 0 40px 80px -50px rgba(14, 47, 54, 0.8);
    &::after { content: ''; position: absolute; inset: 0; border-radius: inherit; pointer-events: none; box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08), inset 0 0 0 1px rgba(255, 255, 255, 0.05); }
  }
  .lens-globe { position: relative; min-height: 0; margin: 12px 12px 0; }
  .reticle {
    position: absolute; left: 50%; top: 50%; width: 64px; height: 64px; margin: -32px 0 0 -32px; pointer-events: none;
    animation: lock 900ms $ease both;
    i { position: absolute; width: 14px; height: 14px; border: 2px solid $color-accent; }
    i:nth-child(1) { left: 0; top: 0; border-right: 0; border-bottom: 0; }
    i:nth-child(2) { right: 0; top: 0; border-left: 0; border-bottom: 0; }
    i:nth-child(3) { left: 0; bottom: 0; border-right: 0; border-top: 0; }
    i:nth-child(4) { right: 0; bottom: 0; border-left: 0; border-top: 0; }
  }
  @keyframes lock { 0% { opacity: 0; transform: scale(1.9) rotate(45deg); } 55% { opacity: 1; } 100% { opacity: 1; transform: none; } }
  .lens-info { position: relative; display: grid; padding: 0 28px 28px; min-height: 196px; align-items: end; }
  .lens-text { grid-area: 1 / 1; }
  .lens-kicker {
    display: flex; align-items: center; gap: 10px; margin: 0 0 8px; font: 0.7rem $font-mono; letter-spacing: 0.14em; text-transform: uppercase; color: rgba(255, 255, 255, 0.7);
    span { padding: 3px 7px; border-radius: 6px; background: rgba(2, 181, 187, 0.18); color: $color-accent; }
    em { font-style: normal; padding: 3px 8px; border: 1px solid $color-accent; border-radius: $radius-pill; color: $color-accent; }
  }
  .lens-name { margin: 0; font: 800 clamp(2rem, 3.4vw, 3.2rem)/0.98 $font-sans; letter-spacing: -0.05em; text-wrap: balance; }
  .lens-text dl { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 20px; margin: 20px 0 0; padding-top: 16px; border-top: 1px solid rgba(255, 255, 255, 0.12);
    dt { font: 0.6rem $font-mono; letter-spacing: 0.14em; text-transform: uppercase; color: rgba(255, 255, 255, 0.5); }
    dd { margin: 3px 0 0; font: 600 0.92rem $font-sans; font-variant-numeric: tabular-nums; } }

  /* ── List ───────────────────────────────────────────────── */
  .list-col { min-width: 0; }
  .group {
    scroll-margin-top: 170px; display: grid; gap: 0 $space-6; padding-bottom: $space-8;
    @include md { grid-template-columns: 72px minmax(0, 1fr); }
  }
  .letter {
    margin: 0; display: flex; align-items: baseline; gap: 8px; padding: $space-4 0 $space-2;
    @include md { position: sticky; top: 168px; align-self: start; flex-direction: column; gap: 2px; padding: 14px 0 0; }
    span { font: 800 clamp(2.4rem, 4vw, 3.6rem)/0.9 $font-sans; letter-spacing: -0.05em; color: transparent; -webkit-text-stroke: 1.5px $color-ink-strong; }
    small { font: 0.68rem $font-mono; letter-spacing: 0.1em; color: $color-muted; }
  }
  .rows { list-style: none; margin: 0; padding: 0; border-top: 1px solid $color-hairline-strong; }
  .row {
    position: relative; border-bottom: 1px solid $color-hairline;
    @include reveal(14px, var(--d));
    &::before { content: ''; position: absolute; left: -1px; top: 14px; bottom: 14px; width: 3px; border-radius: 3px; background: $color-accent; transform: scaleY(0); transition: transform 500ms $ease; z-index: 1; }
    &.active::before { transform: scaleY(1); }
  }
  .row a {
    position: relative; isolation: isolate; display: grid; align-items: center; gap: $space-4;
    grid-template-columns: 40px minmax(0, 1fr) 44px; padding: 18px 8px 18px 14px; color: $color-ink-strong; text-decoration: none;
    @include md { grid-template-columns: 48px minmax(0, 1fr) 44px; }
    @media (min-width: 1180px) { grid-template-columns: 48px minmax(0, 1fr) 128px 44px; }
    @include focus-ring;
    &:focus-visible { outline-offset: -2px; border-radius: 10px; }
    /* Hover wash: a mist panel that wipes in from the left. */
    &::before { content: ''; position: absolute; inset: 4px 0; z-index: -1; border-radius: 14px; background: $color-mist; transform: scaleX(0); transform-origin: left; transition: transform 600ms $ease; }
  }
  .n { font: 0.72rem $font-mono; letter-spacing: 0.04em; color: $color-muted; font-variant-numeric: tabular-nums; transition: color 300ms; }
  .name { min-width: 0; display: flex; flex-wrap: wrap; align-items: center; column-gap: 12px; row-gap: 2px; }
  .roll { display: inline-grid; overflow: hidden; padding-block: 0.06em; max-width: 100%; }
  .a, .b {
    grid-area: 1 / 1; font: 700 clamp(1.3rem, 1.9vw, 1.8rem)/1.12 $font-sans; letter-spacing: -0.035em;
    transition: transform 650ms $ease;
  }
  .b { transform: translateY(110%); color: $deep-teal; }
  mark { background: linear-gradient(transparent 62%, rgba(2, 181, 187, 0.35) 62%); color: inherit; border-radius: 2px; }
  .tag { font: normal 0.6rem $font-mono; letter-spacing: 0.12em; text-transform: uppercase; color: $deep-teal; border: 1px solid $color-accent; padding: 3px 8px; border-radius: $radius-pill; }
  .sub { flex-basis: 100%; display: flex; align-items: center; gap: 8px; margin-top: 4px; font: 0.68rem $font-mono; letter-spacing: 0.1em; text-transform: uppercase; color: $color-steel;
    i { font-style: normal; color: $color-muted; } }
  .iso { display: inline-grid; place-items: center; min-width: 28px; height: 20px; padding: 0 5px; border-radius: 6px; background: $color-mist; color: $color-ink-strong; transition: background 300ms; }
  .stats { display: none; flex-direction: column; gap: 2px; font: 0.8rem $font-sans; color: $color-muted;
    b { font-weight: 700; color: $color-ink-strong; font-variant-numeric: tabular-nums; }
    @media (min-width: 1180px) { display: flex; } }
  .go {
    position: relative; display: grid; place-items: center; width: 44px; height: 44px; border-radius: 50%; overflow: hidden;
    border: 1px solid $color-hairline-strong; transition: background 400ms $ease, border-color 400ms, transform 500ms $ease;
    svg { grid-area: 1 / 1; width: 18px; height: 18px; fill: none; stroke: $color-ink-strong; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; transition: transform 550ms $ease; }
    svg:last-child { transform: translateX(-180%); }
  }

  /* Hover and keyboard focus share one treatment. */
  @mixin lit {
    &::before { transform: scaleX(1); }
    .n { color: $deep-teal; }
    .a { transform: translateY(-110%); }
    .b { transform: none; }
    .iso { background: #fff; }
    .go { background: $color-accent; border-color: $color-accent; transform: rotate(-8deg);
      svg:first-child { transform: translateX(180%); }
      svg:last-child { transform: none; } }
  }
  @include hover-only { .row a:hover { @include lit; } }
  .row a:focus-visible { @include lit; }

  .empty {
    padding: $space-16 $space-8; text-align: center; border-radius: 24px; background: $color-mist;
    display: flex; flex-direction: column; align-items: center; gap: $space-4;
    .e-title { margin: 0; font: 800 clamp(1.6rem, 3vw, 2.4rem)/1.05 $font-sans; letter-spacing: -0.04em; color: $color-ink-strong; }
    .e-body { @include body; max-width: 44ch; }
  }
  .e-actions { display: flex; flex-wrap: wrap; justify-content: center; gap: $space-3; }
  .primary { @include button-primary; }
  .ghost { @include button-ghost; }

  /* ── Letter rail ────────────────────────────────────────── */
  .rail {
    display: none;
    @include lg { position: sticky; top: 168px; align-self: start; display: flex; flex-direction: column; align-items: center; gap: 1px; }
    button {
      position: relative; width: 22px; height: 20px; border: 0; padding: 0; background: none; cursor: pointer;
      font: 600 0.66rem $font-mono; color: $color-steel; transition: color 250ms, transform 400ms $ease; @include focus-ring;
      &:disabled { color: rgba(14, 47, 54, 0.2); cursor: default; }
      &:hover:not(:disabled) { color: $color-ink-strong; transform: scale(1.35); }
      &.on { color: $color-ink-strong; transform: scale(1.25); }
      &.on::before { content: ''; position: absolute; left: -10px; top: 50%; width: 6px; height: 6px; margin-top: -3px; border-radius: 50%; background: $color-accent; }
    }
    @media (max-height: 720px) { button { height: 16px; } }
  }

  @include reduced-motion {
    .reticle { animation: none; }
    .a, .b, .go, .go svg, .row a::before, .ind, .row::before { transition: none; }
  }
</style>
