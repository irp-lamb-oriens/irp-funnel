<script lang="ts">
  /**
   * Scene 4, "What we do". Four full-screen cards stack: each new card rises
   * over the last one, which settles back, scales down and dims. Photos
   * open through a clip; documentation shows its task list, advisory a compass rose.
   */
  import { scene, seg, easeOut, easeInOut, clamp, stations } from './scene.ts';
  import { SERVICES } from './content.ts';

  let p = 0;
  const N = SERVICES.items.length;
  // card i arrives during [(i-1)/N', i/N'] in the middle 88% of the scene
  // Cards stack over the first 74% of the scene; the rest is the advisory card's compass beat.
  $: st = stations(seg(p, 0, 0.74), N, 1, 0.75);
  $: adv = seg(p, 0.7, 0.97);
  $: star = 135 * (1 - easeInOut(seg(adv, 0, 0.55)));
  $: bezel = -80 * (1 - easeInOut(seg(adv, 0.12, 0.7)));
  $: arrive = (i: number) => (i === 0 ? 1 : clamp(st.x - (i - 1)));
  $: covered = (i: number) => (i === N - 1 ? 0 : arrive(i + 1));
  // Example document tasks (documentation card).
  const TASKS = [
    { name: 'Passport copies', note: 'All travellers', tag: 'ID' },
    { name: 'Apostilled birth certificate', note: 'Request at origin', tag: 'Apostille' },
    { name: 'Proof of income letter', note: 'For residency', tag: 'Residency' },
    { name: 'Vehicle title and registration', note: 'Original, no liens', tag: 'Vehicle' },
    { name: 'Inventory and packing list', note: 'Signed, by box', tag: 'Customs' }
  ];
  // Example advice notes around the compass (advisory card).
  const ADVICE = [
    { title: 'Residency first', body: 'Your immigration status decides which duty exemptions apply.' },
    { title: 'Your vehicle', body: 'Import taxes depend on its value and age. Compare before you ship it.' },
    { title: 'Household goods', body: 'A detailed inventory, box by box, speeds up customs.' },
    { title: 'Warehouse days', body: 'Budget for bonded warehouse storage while customs reviews your shipment.' }
  ];
  $: current = Math.max(0, [...Array(N).keys()].filter((i) => arrive(i) > 0.5).pop() ?? 0);
</script>

<section id="services" class="scene" style="--len:3.6" use:scene={(v) => (p = v)} aria-labelledby="services-title">
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
              <!-- Documentation: the task list for one example move -->
              {@const done = Math.floor(easeOut(seg(a, 0.35, 1)) * TASKS.length + 0.001)}
              <div class="tasks">
                <header><p class="tasks-title">Documents for your move</p><span class="tasks-count">{done} of {TASKS.length} ready</span></header>
                <span class="tasks-bar"><i style="transform: scaleX({done / TASKS.length})"></i></span>
                <ul>
                  {#each TASKS as task, k}
                    <li class:done={k < done}>
                      <span class="box">{k < done ? '✓' : ''}</span>
                      <span class="t-name">{task.name}<small>{task.note}</small></span>
                      <span class="t-tag">{task.tag}</span>
                    </li>
                  {/each}
                </ul>
                <p class="tasks-foot">Example · Each list depends on your status and destination</p>
              </div>
            {:else}
              <!-- Advisory: the rose turns to north, the bezel follows it, advice appears around -->
              <div class="advisory">
                <svg class="rose" viewBox="0 0 240 240">
                  <g style="transform: rotate({bezel}deg); transform-origin: 120px 120px">
                    <circle cx="120" cy="120" r="112" class="rim" />
                    <circle cx="120" cy="120" r="96" class="rim2" />
                    {#each Array(72) as _, k}<line x1="120" y1="10" x2="120" y2={k % 18 === 0 ? 30 : k % 6 === 0 ? 24 : 17} transform="rotate({k * 5} 120 120)" class:major={k % 18 === 0} />{/each}
                    {#each ['N', 'E', 'S', 'W'] as l, k}<text x="120" y="50" text-anchor="middle" transform="rotate({k * 90} 120 120)" class:north-l={k === 0}>{l}</text>{/each}
                  </g>
                  <g style="transform: rotate({star}deg); transform-origin: 120px 120px">
                    {#each [0, 45, 90, 135, 180, 225, 270, 315] as r, k}
                      {@const len = k % 2 === 0 ? 84 : 54}
                      <g transform="rotate({r} 120 120)">
                        <path d="M120 {120 - len} L{k % 2 === 0 ? 131 : 127} 120 L120 120 Z" class="pt-a" />
                        <path d="M120 {120 - len} L{k % 2 === 0 ? 109 : 113} 120 L120 120 Z" class="pt-b" />
                      </g>
                    {/each}
                    {#each [22.5, 67.5, 112.5, 157.5, 202.5, 247.5, 292.5, 337.5] as r}
                      <path d="M120 84 L124 120 L116 120 Z" transform="rotate({r} 120 120)" class="pt-c" />
                    {/each}
                    <path d="M120 36 L131 120 L120 120 Z" class="north" />
                  </g>
                  <circle cx="120" cy="120" r="7" class="hub" />
                </svg>
                <p class="adv-tag" style="opacity:{seg(adv, 0.2, 0.35)}">Example advice · move to Costa Rica</p>
                {#each ADVICE as note, k}
                  {@const f = easeOut(seg(adv, 0.3 + k * 0.13, 0.48 + k * 0.13))}
                  <div class="note n{k}" style="opacity:{f}; transform: translateY({(1 - f) * 14}px) scale({0.96 + f * 0.04})">
                    <b>{note.title}</b><span>{note.body}</span>
                  </div>
                {/each}
              </div>
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
  .tasks {
    width: min(400px, 92%); padding: 20px 20px 16px; border-radius: 14px; background: #fff; color: $color-ink;
    box-shadow: 0 40px 60px -30px rgba(14, 47, 54, 0.45); font-family: $font-sans;
    header { display: flex; justify-content: space-between; align-items: baseline; }
    ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
    li { display: grid; grid-template-columns: 22px 1fr auto; gap: 10px; align-items: center; padding: 9px 0; border-top: 1px solid $color-hairline; transition: opacity 300ms; }
    li.done .t-name { color: $color-muted; text-decoration: line-through; text-decoration-color: rgba(14, 47, 54, 0.3); }
  }
  .tasks-title { margin: 0; font: 700 0.95rem $font-sans; color: $color-ink-strong; }
  .tasks-count { font: 0.68rem $font-mono; letter-spacing: 0.06em; color: $color-accent-hover; font-variant-numeric: tabular-nums; }
  .tasks-bar { display: block; height: 5px; margin: 10px 0 8px; border-radius: 3px; background: $color-mist; overflow: hidden;
    i { display: block; height: 100%; background: $color-accent; transform-origin: left; transition: transform 300ms $ease; } }
  .box { width: 20px; height: 20px; border-radius: 6px; border: 2px solid $color-hairline-strong; display: grid; place-items: center; font: 800 0.7rem $font-sans; color: $color-ink-strong; transition: all 250ms $ease; }
  .done .box { background: $color-accent; border-color: $color-accent; transform: scale(1.05); }
  .t-name { font: 600 0.85rem $font-sans; color: $color-ink-strong; display: flex; flex-direction: column; transition: color 250ms;
    small { font: 0.68rem $font-sans; color: $color-muted; text-decoration: none; } }
  .t-tag { font: 0.58rem $font-mono; letter-spacing: 0.1em; text-transform: uppercase; color: $color-accent-hover; background: $color-accent-soft; padding: 3px 7px; border-radius: 4px; }
  .tasks-foot { margin: 10px 0 0; font: 0.65rem $font-sans; color: $color-muted; }

  .advisory { position: relative; width: 100%; height: 100%; display: grid; place-items: center; }
  .rose { width: min(300px, 56%);
    .rim { fill: rgba(255, 255, 255, 0.04); stroke: rgba(255, 255, 255, 0.4); stroke-width: 2; }
    .rim2 { fill: none; stroke: rgba(255, 255, 255, 0.15); stroke-width: 1; }
    line { stroke: rgba(255, 255, 255, 0.35); stroke-width: 1.2; }
    line.major { stroke: #fff; stroke-width: 2; }
    .pt-a { fill: #e9f3f4; } .pt-b { fill: #8fb3b8; } .pt-c { fill: rgba(255, 255, 255, 0.35); }
    .north { fill: $color-accent; }
    text { fill: #fff; font: 700 13px $font-mono; }
    .north-l { fill: $color-accent; }
    .hub { fill: $color-ink-strong; stroke: #fff; stroke-width: 3; }
  }
  .adv-tag { position: absolute; top: 2%; left: 50%; transform: translateX(-50%); margin: 0; white-space: nowrap;
    font: 0.65rem $font-mono; letter-spacing: 0.12em; text-transform: uppercase; color: $color-accent; }
  .note { position: absolute; width: min(220px, 40%); padding: 10px 12px; border-radius: 12px; background: rgba(255, 255, 255, 0.96); color: $color-ink;
    box-shadow: 0 20px 40px -20px rgba(0, 0, 0, 0.6); display: flex; flex-direction: column; gap: 2px; text-align: left;
    b { font: 700 0.8rem $font-sans; color: $color-ink-strong; } span { font: 0.74rem/1.4 $font-sans; color: $color-steel; } }
  .n0 { left: 2%; top: 12%; } .n1 { right: 2%; top: 18%; } .n2 { left: 4%; bottom: 10%; } .n3 { right: 2%; bottom: 6%; }

  :global(.rm) {
    .stage { padding-block: $space-24; }
    .deck { display: flex; flex-direction: column; gap: $space-6; }
    .card { position: relative; inset: auto; transform: none !important; filter: none !important; min-height: 60vh; }
    .count { display: none; }
  }
</style>
