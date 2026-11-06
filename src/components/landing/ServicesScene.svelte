<script lang="ts">
  /**
   * Scene 4, "What we do". Four full-screen cards stack: each new card rises
   * over the last one, which settles back, scales down and dims. Photos
   * open through a clip; documentation gets a stamp, advisory a compass.
   */
  import { scene, seg, easeOut, clamp, stations } from './scene.ts';
  import { SERVICES } from './content.ts';

  let p = 0;
  const N = SERVICES.items.length;
  // card i arrives during [(i-1)/N', i/N'] in the middle 88% of the scene
  $: st = stations(p, N, 1, 0.8);
  $: arrive = (i: number) => (i === 0 ? 1 : clamp(st.x - (i - 1)));
  $: covered = (i: number) => (i === N - 1 ? 0 : arrive(i + 1));
  $: current = Math.max(0, [...Array(N).keys()].filter((i) => arrive(i) > 0.5).pop() ?? 0);
</script>

<section id="services" class="scene" style="--len:4.6" use:scene={(v) => (p = v)} aria-labelledby="services-title">
  <div class="stage">
    <header class="head wrap">
      <p class="eyebrow"><span class="dot" aria-hidden="true"></span>{SERVICES.eyebrow}</p>
      <h2 class="title" id="services-title">{SERVICES.title}</h2>
      <p class="count" aria-hidden="true">0{current + 1} <span>/ 0{N}</span></p>
    </header>
    <ul class="deck">
      {#each SERVICES.items as s, i}
        {@const a = arrive(i)}
        {@const c = covered(i)}
        <li
          class="card"
          class:dark={i % 2 === 1}
          class:current={current === i}
          style="transform: translate3d(0, {(1 - a) * 125}%, 0) scale({1 - c * 0.08}); filter: brightness({1 - c * 0.35}); z-index:{i + 1}"
        >
          <div class="body">
            <span class="tag">{s.tag}</span>
            <h3>{s.title}</h3>
            <p>{s.body}</p>
            <a class="link" href={s.href} tabindex={current === i ? 0 : -1}>{s.cta} <span aria-hidden="true">→</span></a>
          </div>
          <div class="media" aria-hidden="true">
            {#if s.image}
              <div class="photo" style="clip-path: inset({(1 - easeOut(seg(a, 0.3, 1))) * 50}% round 18px)">
                <img src={s.image} alt="" loading="lazy" decoding="async" style="transform: scale({1.25 - 0.25 * a + c * 0.05})" />
              </div>
            {:else if i === 2}
              {@const press = easeOut(seg(a, 0.55, 0.95))}
              <div class="paper">
                {#each [0.9, 0.75, 0.82, 0.6, 0.7] as w}<i style="width:{w * 100}%"></i>{/each}
                <div class="stamp" style="opacity:{press}; transform: rotate(-12deg) scale({2.2 - 1.2 * press})">
                  <span>Documents</span><b>Ready to send</b>
                </div>
              </div>
            {:else}
              <svg class="compass" viewBox="0 0 220 220">
                <circle cx="110" cy="110" r="96" class="rim" />
                {#each Array(36) as _, k}<line x1="110" y1="20" x2="110" y2={k % 9 === 0 ? 38 : 28} transform="rotate({k * 10} 110 110)" />{/each}
                {#each ['N', 'E', 'S', 'W'] as l, k}<text x="110" y="56" text-anchor="middle" transform="rotate({k * 90} 110 110)">{l}</text>{/each}
                <g style="transform: rotate({(1 - easeOut(a)) * 220 + Math.sin(a * 12) * (1 - a) * 30 + 38}deg); transform-origin: 110px 110px">
                  <path d="M110 40 L122 110 L110 120 L98 110 Z" class="n" />
                  <path d="M110 180 L98 110 L110 100 L122 110 Z" class="s" />
                </g>
                <circle cx="110" cy="110" r="6" class="hub" />
              </svg>
            {/if}
          </div>
        </li>
      {/each}
    </ul>
  </div>
</section>

<style lang="scss">
  @use './tokens' as *;

  .scene { @include scene-shell; background: $color-canvas; }
  .stage { @include stage; display: flex; flex-direction: column; padding-top: $header-clear; padding-bottom: 6.5rem; }
  .wrap { @include container; }
  .head { display: grid; grid-template-columns: 1fr auto; align-items: end; column-gap: $space-6; row-gap: $space-3; flex: none; margin-bottom: $space-6; }
  .eyebrow { @include eyebrow; grid-column: 1 / -1; display: inline-flex; align-items: center; gap: $space-2; }
  .dot { width: 6px; height: 6px; border-radius: 50%; background: $color-accent; }
  .title { @include heading-xl; font-size: clamp(1.9rem, 3.6vw, 3rem); }
  .count { margin: 0; font: 700 1.5rem $font-mono; color: $color-ink-strong; span { font-size: 0.8rem; color: $color-muted; } }

  .deck { @include container; list-style: none; margin: 0 auto; padding-block: 0; position: relative; flex: 1; min-height: 0; }
  .card {
    position: absolute; inset: 0 $space-4; border-radius: 22px; overflow: hidden;
    background: $color-mist; border: 1px solid $color-hairline;
    display: grid; grid-template-columns: 1fr; will-change: transform;
    transform-origin: 50% 0%;
    @include md { inset: 0 $space-8; }
    @media (min-width: 1280px) { inset: 0 4.5rem; }
    @include lg { grid-template-columns: minmax(0, 5fr) minmax(0, 7fr); }
    &.dark { background: $color-ink-strong; border-color: transparent; color: $color-on-dark;
      h3 { color: $color-on-dark; } p { color: $color-on-dark-muted; } .link { color: $color-on-dark; } .tag { color: $color-accent; }
    }
  }
  .body {
    padding: clamp(1.5rem, 4vw, 3.5rem); display: flex; flex-direction: column; justify-content: center; gap: $space-4;
    h3 { @include heading-xl; font-size: clamp(1.9rem, 3.8vw, 3.25rem); }
    p { @include body; font-size: 1.125rem; max-width: 40ch; }
  }
  .tag { font-family: $font-mono; font-size: 0.72rem; letter-spacing: 0.14em; text-transform: uppercase; color: $color-accent-hover; }
  .link { align-self: flex-start; font: 700 1rem $font-sans; color: $color-ink-strong; text-decoration: none; border-bottom: 2px solid $color-accent; padding-bottom: 2px; @include focus-ring; }
  .media { position: relative; min-height: 0; display: grid; place-items: center; padding: $space-4;
    @media (max-width: 1023px) { display: none; }
  }
  .photo { position: absolute; inset: $space-4; border-radius: 18px; overflow: hidden;
    img { width: 100%; height: 100%; object-fit: cover; display: block; will-change: transform; }
  }
  .paper {
    position: relative; width: min(340px, 80%); aspect-ratio: 0.77; padding: 32px 28px; border-radius: 8px; background: #fff;
    box-shadow: 0 40px 60px -30px rgba(14, 47, 54, 0.4); display: flex; flex-direction: column; gap: 14px;
    i { height: 9px; border-radius: 5px; background: $color-mist; }
  }
  .stamp {
    position: absolute; right: -10%; bottom: 14%; padding: 10px 16px; border: 3px solid $color-red; border-radius: 8px;
    color: $color-red; display: flex; flex-direction: column; align-items: center; background: rgba(255, 255, 255, 0.85);
    span { font: 0.65rem $font-mono; letter-spacing: 0.16em; text-transform: uppercase; }
    b { font: 800 1.2rem $font-sans; text-transform: uppercase; letter-spacing: 0.02em; }
  }
  .compass { width: min(320px, 80%);
    .rim { fill: rgba(255, 255, 255, 0.04); stroke: rgba(255, 255, 255, 0.35); stroke-width: 2; }
    line { stroke: rgba(255, 255, 255, 0.4); stroke-width: 2; }
    text { fill: #fff; font: 700 14px $font-mono; }
    .n { fill: $color-accent; } .s { fill: rgba(255, 255, 255, 0.6); } .hub { fill: #fff; }
  }

  :global(.rm) {
    .stage { padding-block: $space-24; }
    .deck { display: flex; flex-direction: column; gap: $space-6; }
    .card { position: relative; inset: auto; transform: none !important; filter: none !important; min-height: 60vh; }
    .count { display: none; }
  }
</style>
