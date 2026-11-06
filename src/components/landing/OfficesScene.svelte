<script lang="ts">
  /**
   * Our offices (same data as the previous home's ContactSection:
   * lib/data/offices.ts). The map stays in view while the office cards
   * scroll past; as each card reaches the middle of the screen the map
   * flies to that office (OfficeMap). Every address stays in normal reading
   * order, so the map is decoration and is hidden from screen readers.
   * On small screens the map shows all offices at once, without flying.
   */
  import { onDestroy, onMount } from 'svelte';
  import OfficeMap from './OfficeMap.svelte';
  import { reveal } from './reveal.ts';
  import { locations } from '../../lib/data/offices.ts';

  /**
   * Where the camera stops for each country (centre and visible width in
   * degrees) and the office the plane lands on (`at`): Miami, Mexico City,
   * Alajuela, Panama City, Madrid.
   */
  const STOP: Record<string, { lon: number; lat: number; width: number; at: { lon: number; lat: number } }> = {
    'United States': { lon: -80.19, lat: 25.77, width: 16, at: { lon: -80.19, lat: 25.77 } },
    Mexico: { lon: -99.13, lat: 19.43, width: 16, at: { lon: -99.17, lat: 19.43 } },
    'Costa Rica': { lon: -84.85, lat: 10.0, width: 5.2, at: { lon: -84.17, lat: 10.0 } },
    Panamá: { lon: -80.9, lat: 8.75, width: 6.2, at: { lon: -79.52, lat: 8.98 } },
    Spain: { lon: -3.7, lat: 40.42, width: 16, at: { lon: -3.68, lat: 40.46 } }
  };
  /** Pin position and short place name per office (by label, else by country). */
  const PLACE: Record<string, { lon: number; lat: number; name: string }> = {
    'United States': { lon: -80.19, lat: 25.77, name: 'Miami' },
    Mexico: { lon: -99.17, lat: 19.43, name: 'Mexico City' },
    Alajuela: { lon: -84.17, lat: 10.0, name: 'Alajuela' },
    Guanacaste: { lon: -85.84, lat: 10.3, name: 'Tamarindo' },
    'Panama City': { lon: -79.52, lat: 8.98, name: 'Panama City' },
    Boquete: { lon: -82.43, lat: 8.78, name: 'Boquete' },
    Spain: { lon: -3.68, lat: 40.46, name: 'Madrid' }
  };
  const ZONE: Record<string, string> = {
    'United States': 'America/New_York',
    Mexico: 'America/Mexico_City',
    'Costa Rica': 'America/Costa_Rica',
    Panamá: 'America/Panama',
    Spain: 'Europe/Madrid'
  };

  const stops = locations.map((l) => STOP[l.country] ?? { lon: -45, lat: 24, width: 118 });
  const offices = locations.flatMap((loc, i) =>
    loc.details.map((d) => ({
      country: loc.country,
      stop: i,
      label: d.label,
      lines: d.address.split(/<br\s*\/?>/i),
      email: d.email,
      emailHref: d.emailHref,
      soon: /^coming soon/i.test(d.address),
      place: PLACE[d.label] ?? PLACE[loc.country]
    }))
  );
  const pins = offices.filter((o) => o.place).map((o) => ({ lon: o.place.lon, lat: o.place.lat, label: o.place.name, stop: o.stop }));
  const pinOf = (o: (typeof offices)[number]) => pins.findIndex((p) => p.label === o.place?.name && p.stop === o.stop);

  let section: HTMLElement;
  let cards: HTMLElement[] = [];
  let t = -1; // smoothed camera position
  let target = -1;
  let hot = -1;
  let wide = false;
  let reduce = false;
  let times: string[] = locations.map(() => '');
  let raf = 0;
  let visible = false;
  let io: IntersectionObserver | null = null;
  let clock = 0;

  $: current = Math.round(Math.max(0, Math.min(locations.length - 1, t)));
  $: tourOn = wide && t > -0.5;

  /** Camera position from where the cards sit around the middle of the screen. */
  function measure() {
    if (!wide || !cards.length) return -1;
    const mid = window.innerHeight * 0.5;
    const c = cards.map((el) => {
      const r = el.getBoundingClientRect();
      return r.top + r.height / 2;
    });
    if (mid <= c[0]) {
      const before = Math.max(0, Math.min(1, (c[0] - mid) / (window.innerHeight * 0.6)));
      return -before;
    }
    for (let i = 0; i < c.length - 1; i++) {
      if (mid <= c[i + 1]) return i + (mid - c[i]) / (c[i + 1] - c[i]);
    }
    return c.length - 1;
  }

  function loop() {
    cancelAnimationFrame(raf);
    const frame = () => {
      target = measure();
      const d = target - t;
      if (reduce) t = Math.round(target);
      else t = Math.abs(d) < 0.002 ? target : t + d * 0.14;
      if (visible) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
  }

  function tick() {
    times = locations.map((l) => {
      try {
        return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZone: ZONE[l.country] }).format(new Date());
      } catch {
        return '';
      }
    });
  }

  onMount(() => {
    reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const mq = window.matchMedia('(min-width: 1024px)');
    const setWide = () => {
      wide = mq.matches;
      if (!wide) t = -1;
    };
    setWide();
    mq.addEventListener?.('change', setWide);
    tick();
    clock = window.setInterval(tick, 30000);
    io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible) loop();
    });
    io.observe(section);
    return () => mq.removeEventListener?.('change', setWide);
  });

  onDestroy(() => {
    if (typeof window === 'undefined') return;
    io?.disconnect();
    cancelAnimationFrame(raf);
    window.clearInterval(clock);
  });
</script>

<section id="contact" class="offices" bind:this={section} aria-labelledby="offices-title">
  <div class="wrap">
    <header class="head" use:reveal>
      <p class="eyebrow"><span class="dot" aria-hidden="true"></span>Contact us</p>
      <h2 class="title" id="offices-title">Our offices.</h2>
      <p class="lead">
        Living abroad is a different experience for everybody. Write to the office for your destination, or book a consultation call with one of our experts.
      </p>
    </header>

    <div class="grid">
      <div class="map-col" aria-hidden="true">
        <div class="map">
          <OfficeMap {stops} {pins} {t} {hot} />
          <div class="hud" class:on={tourOn}>
            <span class="hud-n">0{current + 1} / 0{locations.length}</span>
            <b class="hud-country">{locations[current].country}</b>
            {#if times[current]}<span class="hud-time">{times[current]} local time</span>{/if}
          </div>
        </div>
      </div>

      <ol class="cards">
        {#each locations as loc, i}
          <li class="card" class:on={tourOn && i === current} bind:this={cards[i]}>
            <div class="card-in" use:reveal>
              <p class="card-n" aria-hidden="true">0{i + 1}</p>
              <h3>{loc.country}</h3>
              {#if times[i]}<p class="card-time"><span class="tz-dot" aria-hidden="true"></span>{times[i]} local time</p>{/if}
              {#each loc.details as d}
                {@const o = offices.find((x) => x.stop === i && x.label === d.label)}
                {#if o}
                  <!-- Hover and focus light the office's pin on the map (decoration only). -->
                  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
                  <address
                    class:on={hot === pinOf(o)}
                    on:mouseenter={() => (hot = pinOf(o))}
                    on:mouseleave={() => (hot = -1)}
                    on:focusin={() => (hot = pinOf(o))}
                    on:focusout={() => (hot = -1)}
                  >
                    {#if d.label}<b>{d.label}{#if o.soon}<em>Coming soon</em>{/if}</b>{/if}
                    {#each o.lines as line}<span>{line}</span>{/each}
                    {#if d.email}<a href={d.emailHref ?? `mailto:${d.email}`}>{d.email}</a>{/if}
                  </address>
                {/if}
              {/each}
            </div>
          </li>
        {/each}
      </ol>
    </div>
  </div>
</section>

<style lang="scss">
  @use './tokens' as *;

  .offices { @include section; & { background: $color-canvas; } }
  .wrap { @include container; }
  .head { display: flex; flex-direction: column; gap: $space-4; max-width: 720px; margin-bottom: $space-12; @include reveal; }
  .eyebrow { @include eyebrow; display: inline-flex; align-items: center; gap: $space-2; }
  .dot { width: 6px; height: 6px; border-radius: 50%; background: $color-accent; }
  .title { @include heading-xl; }
  .lead { @include body; font-size: 1.125rem; max-width: 56ch; }

  .grid { display: grid; gap: $space-8; @include lg { grid-template-columns: minmax(0, 7fr) minmax(0, 4fr); gap: $space-12; align-items: start; } }

  .map-col { position: relative; @include lg { align-self: stretch; } }
  .map {
    position: relative; aspect-ratio: 4 / 3; border-radius: 24px; overflow: hidden;
    box-shadow: 0 40px 80px -50px rgba(14, 47, 54, 0.55), 0 0 0 1px $color-hairline;
    @include lg {
      position: sticky; top: calc(#{$header-clear} + 8px);
      aspect-ratio: auto; height: calc(100vh - #{$header-clear} - 40px); height: calc(100svh - #{$header-clear} - 40px);
    }
  }
  .hud {
    position: absolute; left: 18px; top: 18px; display: flex; flex-direction: column; gap: 2px;
    padding: 12px 16px; border-radius: 16px; background: rgba(255, 255, 255, 0.86);
    backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); box-shadow: 0 14px 30px -18px rgba(14, 47, 54, 0.5);
    opacity: 0; transform: translateY(-6px); transition: opacity 400ms $ease, transform 500ms $ease;
    &.on { opacity: 1; transform: none; }
  }
  .hud-n { font: 600 0.65rem $font-mono; letter-spacing: 0.14em; color: #04767b; }
  .hud-country { font: 800 1.5rem/1.1 $font-sans; letter-spacing: -0.03em; color: $color-ink-strong; }
  .hud-time { font: 0.75rem $font-sans; color: $color-steel; font-variant-numeric: tabular-nums; }

  .cards { list-style: none; margin: 0; padding: 0; display: grid; gap: $space-6; @include md { grid-template-columns: 1fr 1fr; } @include lg { display: block; } }
  .card {
    @include lg { min-height: 62vh; min-height: 62svh; display: flex; align-items: center; }
  }
  .card-in {
    position: relative; width: 100%; display: flex; flex-direction: column; gap: $space-3; padding: $space-6 0 0;
    border-top: 2px solid $color-ink-strong; @include reveal(14px);
    h3 { @include heading-md; font-size: clamp(1.3rem, 2vw, 1.75rem); }
    @include lg {
      & { padding: $space-6; border-top: none; border-radius: 20px; border: 1px solid $color-hairline; background: #fff; transition: border-color 400ms, box-shadow 400ms, transform 500ms $ease; }
    }
  }
  .card.on .card-in { border-color: rgba(2, 181, 187, 0.55); box-shadow: 0 30px 60px -36px rgba(14, 47, 54, 0.45); transform: translateX(-6px); }
  .card-n { margin: 0; font: 600 0.7rem $font-mono; letter-spacing: 0.14em; color: #04767b; }
  .card-time { margin: 0; display: inline-flex; align-items: center; gap: 8px; font: 0.85rem $font-sans; color: $color-steel; font-variant-numeric: tabular-nums; }
  .tz-dot { width: 7px; height: 7px; border-radius: 50%; background: $color-accent; box-shadow: 0 0 0 3px $color-accent-soft; }
  address {
    font-style: normal; display: flex; flex-direction: column; gap: 2px; padding: $space-3; margin-inline: -#{$space-3};
    border-radius: 12px; transition: background 250ms;
    b { display: inline-flex; align-items: center; gap: 8px; flex-wrap: wrap; font: 700 0.95rem $font-sans; color: $color-ink-strong; }
    em { font: normal 600 0.62rem $font-mono; letter-spacing: 0.1em; text-transform: uppercase; color: #04767b; border: 1px solid currentColor; padding: 2px 7px; border-radius: 99px; }
    span { font: 0.9rem/1.5 $font-sans; color: $color-steel; }
    a { margin-top: 4px; font: 600 0.85rem $font-sans; color: #04767b; text-decoration: none; overflow-wrap: anywhere; @include focus-ring; &:hover { text-decoration: underline; } }
    &.on { background: $color-accent-soft; }
  }
</style>
