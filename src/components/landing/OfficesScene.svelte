<script lang="ts">
  /**
   * Our offices (restored from the previous home's ContactSection, same
   * data: lib/data/offices.ts). A dotted map with a pin per office; hovering
   * or focusing an office lights its pin. Calm section, no pinning.
   */
  import Globe from './Globe.svelte';
  import { reveal } from './reveal.ts';
  import { locations } from '../../lib/data/offices.ts';

  // Approximate map positions for the pins (lon, lat), by office label or country.
  const GEO: Record<string, [number, number]> = {
    'United States': [-80.19, 25.77],
    Mexico: [-99.17, 19.43],
    Spain: [-3.68, 40.46],
    Alajuela: [-84.17, 10.0],
    Guanacaste: [-85.84, 10.3],
    'Panama City': [-79.52, 8.98],
    Boquete: [-82.43, 8.78]
  };

  const offices = locations.flatMap((loc) =>
    loc.details.map((d) => ({
      country: loc.country,
      label: d.label,
      lines: d.address.split(/<br\s*\/?>/i),
      email: d.email,
      geo: GEO[d.label] ?? GEO[loc.country]
    }))
  );

  let active = -1;
  $: markers = offices
    .filter((o) => o.geo)
    .map((o) => ({ lon: o.geo[0], lat: o.geo[1], on: offices[active] === o, label: o.label || o.country }));
</script>

<section id="contact" class="offices" aria-labelledby="offices-title">
  <div class="wrap">
    <header class="head" use:reveal>
      <p class="eyebrow"><span class="dot" aria-hidden="true"></span>Contact us</p>
      <h2 class="title" id="offices-title">Our offices.</h2>
      <p class="lead">
        Living abroad is a different experience for everybody. Write to the office for your destination, or book a consultation call with one of our experts.
      </p>
    </header>

    <div class="grid">
      <div class="map" aria-hidden="true">
        <Globe mode="flat" lon={-45} scale={2.3} {markers} dot="rgba(14,47,54,0.34)" pin="#0e2f36" ink="#0e2f36" />
      </div>

      <ul class="list">
        {#each locations as loc}
          <li class="country" use:reveal>
            <h3>{loc.country}</h3>
            {#each loc.details as d}
              {@const k = offices.findIndex((o) => o.country === loc.country && o.label === d.label)}
              <!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
              <address
                class:on={active === k}
                on:mouseenter={() => (active = k)}
                on:mouseleave={() => (active = -1)}
                on:focusin={() => (active = k)}
                on:focusout={() => (active = -1)}
              >
                {#if d.label}<b>{d.label}</b>{/if}
                {#each offices[k].lines as line}<span>{line}</span>{/each}
                {#if d.email}<a href={d.emailHref ?? `mailto:${d.email}`}>{d.email}</a>{/if}
              </address>
            {/each}
          </li>
        {/each}
      </ul>
    </div>
  </div>
</section>

<style lang="scss">
  @use './tokens' as *;

  .offices { @include section; background: $color-canvas; }
  .wrap { @include container; }
  .head { display: flex; flex-direction: column; gap: $space-4; max-width: 720px; margin-bottom: $space-12; @include reveal; }
  .eyebrow { @include eyebrow; display: inline-flex; align-items: center; gap: $space-2; }
  .dot { width: 6px; height: 6px; border-radius: 50%; background: $color-accent; }
  .title { @include heading-xl; }
  .lead { @include body; font-size: 1.125rem; max-width: 56ch; }

  .grid { display: grid; gap: $space-8; @include lg { grid-template-columns: minmax(0, 6fr) minmax(0, 5fr); gap: $space-12; align-items: start; } }
  .map {
    position: relative; aspect-ratio: 4 / 3; border-radius: 22px; overflow: hidden; background: $color-mist;
    @include lg { position: sticky; top: 120px; }
  }
  .list { list-style: none; margin: 0; padding: 0; display: grid; gap: $space-6; @include md { grid-template-columns: 1fr 1fr; } }
  .country {
    display: flex; flex-direction: column; gap: $space-3; padding-top: $space-4; border-top: 2px solid $color-ink-strong;
    @include reveal(14px);
    h3 { @include heading-md; font-size: 1.15rem; }
  }
  address {
    font-style: normal; display: flex; flex-direction: column; gap: 2px; padding: $space-3; margin-inline: -#{$space-3};
    border-radius: 12px; transition: background 250ms;
    b { font: 700 0.95rem $font-sans; color: $color-ink-strong; }
    span { font: 0.9rem/1.5 $font-sans; color: $color-steel; }
    a { margin-top: 4px; font: 600 0.85rem $font-sans; color: $color-accent-hover; text-decoration: none; word-break: break-all; @include focus-ring; }
    &.on { background: $color-accent-soft; }
  }
</style>
