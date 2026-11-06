<script lang="ts">
  /**
   * The journey line under How it works: a one-colour landscape about three
   * screens long that pans with the scroll, from the first step to the end
   * of the last. Three depths move at different speeds (far hills, skyline
   * and volcano; the line with its stations; near fence posts, poles and
   * grass), so the line reads as a real trip. One traveller rides the line
   * and changes form with the stage (relay.ts): a box on a hand truck, the
   * moving truck, the container ship, the container truck, the box at the
   * new front door. The line behind it is solid; the line ahead is dotted.
   *
   * Decorative (aria-hidden): the steps themselves are told in the panels.
   */
  import {
    WORLD_W, LINE_Y, STATIONS, SEA_FROM, SEA_TO,
    travellerX, formWeights, reachedStation, cameraX, barrierLift
  } from './relay.ts';
  import { clamp } from './scene.ts';

  export let r = 0;

  let w = 1200;
  $: viewW = Math.round(clamp(w, 340, 1200));
  $: tx = travellerX(r);
  $: cam = cameraX(tx, viewW);
  $: fw = formWeights(tx);
  $: reached = reachedStation(tx);
  $: lift = barrierLift(tx);
  $: spin = (tx * 2.4) % 360; // wheel roll
  $: bob = Math.sin(tx * 0.045) * 1.4; // ship on the swell
  $: pitch = Math.sin(tx * 0.045 + 0.9) * 1.2;

  const FAR = 0.45;
  const NEAR = 1.35;
  // Place a far/near element so it sits roughly by world x when the camera is there.
  const far = (x: number) => x * FAR + 250;
  const near = (x: number) => x * NEAR - 175;

  // The line: road, then the swell across the ocean, then road again.
  const sea: string[] = [];
  for (let x = SEA_FROM; x < SEA_TO; x += 36) sea.push(`Q${x + 9} ${LINE_Y - 2.4} ${x + 18} ${LINE_Y} T${x + 36} ${LINE_Y}`);
  const LINE = `M0 ${LINE_Y} H${SEA_FROM} ${sea.join(' ')} H${WORLD_W}`;

  const TREES = [70, 118, 420, 470, 640];
  const POLES = [1030, 1130, 1230, 1330];
  const PALMS = [3060, 3180, 3330, 3480, 3760, 3880];
  const GULLS = [[1760, 34], [1790, 40], [2060, 28], [2380, 36], [2410, 31]];
  // Near layer: grass tufts and fence posts on land, nothing over the sea.
  const TUFTS = Array.from({ length: 70 }, (_, i) => near(40 + i * 58)).filter((x) => {
    const wx = (x + 175) / NEAR;
    return wx < SEA_FROM - 40 || wx > SEA_TO + 40;
  });
  const fmt = (n: number) => n.toFixed(2);
</script>

<div class="journey" bind:clientWidth={w} aria-hidden="true">
  <svg viewBox="0 0 {viewW} 100" preserveAspectRatio="xMidYMid meet">
    <defs>
      <clipPath id="jl-done"><rect x="-10" y="0" width={tx + 10} height="100" /></clipPath>
      <clipPath id="jl-ahead"><rect x={tx} y="0" width={WORLD_W} height="100" /></clipPath>
    </defs>

    <!-- ── Far layer: hills, a skyline, the horizon at sea, the volcano ── -->
    <g class="far" transform="translate({fmt(-cam * FAR)} 0)">
      <path d="M0 58 C80 46 150 52 230 48 S380 40 460 50 S600 44 700 52" />
      {#each [[300, 10], [320, 14], [342, 8], [360, 13]] as [x, h]}
        <path d="M{x} 50 V{50 - h} L{x + 8} {44 - h} L{x + 16} {50 - h} V50" />
      {/each}
      <path d="M690 52 C760 44 820 50 900 47" />
      <!-- city skyline behind the port of departure -->
      <path d="M{far(1420)} 52 V36 H{far(1420) + 10} V30 H{far(1420) + 18} V40 H{far(1420) + 26} V24 H{far(1420) + 34} V44 H{far(1420) + 44} V34 H{far(1420) + 52} V52" />
      <!-- horizon and a far island at sea -->
      <path d="M{far(1600)} 60 H{far(2700)}" />
      <path d="M{far(2120)} 60 C{far(2140)} 54 {far(2170)} 53 {far(2200)} 60" />
      <!-- volcano with a cloud cap, then hills -->
      <path d="M{far(3150)} 60 L{far(3250)} 30 Q{far(3262)} 26 {far(3274)} 30 L{far(3380)} 60" />
      <path d="M{far(3230)} 24 q6 -6 14 -2 q8 -6 16 0 q8 -1 8 5 h-38 q-6 -1 0 -3z" class="cloud" />
      <path d="M{far(3400)} 60 C{far(3480)} 48 {far(3560)} 54 {far(3640)} 50 S{far(3800)} 46 {far(3900)} 56" />
    </g>

    <!-- ── The line, its stations and the landscape on it ──────────────── -->
    <g class="world" transform="translate({fmt(-cam)} 0)">
      <path class="line ahead" d={LINE} clip-path="url(#jl-ahead)" />
      <path class="line done" d={LINE} clip-path="url(#jl-done)" />

      <!-- old house, trees, packed boxes -->
      <g transform="translate(232 {LINE_Y})">
        <path d="M-24 0 V-24 L0 -40 L24 -24 V0" />
        <path d="M12 -32 V-38 H17 V-28" />
        <rect x="-5" y="-14" width="10" height="14" />
        <rect x="-18" y="-19" width="8" height="7" />
        <rect x="28" y="-9" width="11" height="9" />
        <rect x="30" y="-17" width="8" height="8" />
      </g>
      {#each TREES as x}
        <g transform="translate({x} {LINE_Y})"><path d="M0 0 V-12" /><circle cx="0" cy="-19" r="8" /></g>
      {/each}

      <!-- loading depot -->
      <g transform="translate(842 {LINE_Y})">
        <path d="M-42 0 V-26 L-21 -36 V-26 L0 -36 V-26 L21 -36 V-26 L42 -36 V0" />
        <rect x="-32" y="-16" width="16" height="16" />
        <rect x="-8" y="-16" width="16" height="16" />
        <path d="M-32 -11 H-16 M-32 -6 H-16 M-8 -11 H8 M-8 -6 H8" class="thin" />
      </g>

      <!-- power line along the highway -->
      {#each POLES as x, i}
        <g transform="translate({x} {LINE_Y})"><path d="M0 0 V-38 M-7 -34 H7" /></g>
        {#if i < POLES.length - 1}
          <path class="thin" d="M{x - 6} {LINE_Y - 34} Q{x + 50} {LINE_Y - 26} {POLES[i + 1] - 6} {LINE_Y - 34}" />
          <path class="thin" d="M{x + 6} {LINE_Y - 34} Q{x + 50} {LINE_Y - 26} {POLES[i + 1] + 6} {LINE_Y - 34}" />
        {/if}
      {/each}

      <!-- port of departure: container stack and ship-to-shore crane -->
      <g transform="translate(1440 {LINE_Y})">
        <rect x="-26" y="-10" width="24" height="10" /><rect x="-2" y="-10" width="24" height="10" />
        <rect x="-14" y="-20" width="24" height="10" />
      </g>
      <g transform="translate(1570 {LINE_Y})">
        <path d="M-14 0 V-50 M14 0 V-50 M-28 -50 H58 M-14 -24 L14 -50 M14 -24 L-14 -50" />
        <path d="M44 -50 V-30" class="thin" /><rect x="38" y="-30" width="12" height="6" />
      </g>

      <!-- gulls over open water -->
      {#each GULLS as [x, y]}
        <path class="thin" d="M{x} {y} q3 -3 6 0 q3 -3 6 0" />
      {/each}

      <!-- port of arrival and customs -->
      <g transform="translate(2740 {LINE_Y})">
        <path d="M-14 0 V-50 M14 0 V-50 M-58 -50 H28 M-14 -24 L14 -50 M14 -24 L-14 -50" />
      </g>
      <g transform="translate(2878 {LINE_Y})">
        <rect x="-12" y="-26" width="24" height="26" />
        <path d="M-16 -26 H16" class="bold" />
        <rect x="-7" y="-21" width="14" height="8" />
      </g>
      <g transform="translate(2840 {LINE_Y})">
        <path d="M0 0 V-10" class="bold" />
        <g transform="translate(0 -9) rotate({-78 * lift})">
          <path d="M0 0 H34" class="bold" />
          <path d="M5 0 H33" class="dash" />
        </g>
      </g>

      <!-- tropical stretch and the new home -->
      {#each PALMS as x, i}
        <g transform="translate({x} {LINE_Y}) scale({i % 2 ? 0.85 : 1})">
          <path d="M0 0 C-1 -12 1 -22 5 -30" />
          <path d="M5 -30 C-2 -34 -8 -32 -12 -27 M5 -30 C0 -38 -6 -40 -10 -39 M5 -30 C10 -38 16 -38 20 -35 M5 -30 C12 -31 17 -27 19 -22" class="thin" />
        </g>
      {/each}
      <g transform="translate(3650 {LINE_Y})">
        <path d="M-26 0 V-24 M26 0 V-24 M-31 -24 L-18 -38 H18 L31 -24 Z" />
        <rect x="-21" y="-15" width="9" height="15" />
        <rect x="2" y="-18" width="16" height="9" />
        <path d="M10 -18 V-9" class="thin" />
      </g>

      <!-- station ticks and labels -->
      {#each STATIONS as s, i}
        <path d="M{s.x} {LINE_Y + 4} V{LINE_Y + 8}" class="tick" class:lit={i <= reached} />
        <text x={s.x} y={LINE_Y + 21} class="label" class:lit={i <= reached}>{s.label}</text>
      {/each}

      <!-- ── The traveller ─────────────────────────────────────────── -->
      <g class="trav" transform="translate({fmt(tx)} {LINE_Y})">
        {#if fw.dolly > 0}
          <g style="opacity:{fw.dolly}">
            <rect class="solid" x="-6" y="-17" width="15" height="14" />
            <path class="cut" d="M1.5 -17 V-3" />
            <path d="M-9 -24 L-8 -2 H10" />
            <circle class="solid" cx="-7" cy="-1.6" r="2.6" />
          </g>
        {/if}
        {#if fw.truck > 0}
          <g style="opacity:{fw.truck}">
            <rect class="solid" x="-30" y="-25" width="33" height="20" />
            <path class="solid" d="M4 -5 V-18 H12 L19 -11 V-5 Z" />
            <path class="cut" d="M7 -16 H11 L15 -12 H7 Z" />
            <path class="cut" d="M-26 -9 H-1" />
            {#each [-21, -8, 12] as cx}
              <g transform="translate({cx} -3.6) rotate({spin})">
                <circle class="solid" r="3.6" /><path class="cut" d="M-2 0 H2" />
              </g>
            {/each}
          </g>
        {/if}
        {#if fw.ship > 0}
          <g style="opacity:{fw.ship}" transform="translate(0 {fmt(bob)}) rotate({fmt(pitch)})">
            <path class="solid" d="M-42 -9 H46 L38 1 H-35 Z" />
            {#each [[-32, -17], [-16, -17], [0, -17], [-24, -25], [-8, -25]] as [x, y]}
              <rect class="solid" x={x} y={y} width="15" height="7.4" />
            {/each}
            <path class="solid" d="M22 -9 V-27 H32 V-9 Z" />
            <path class="cut" d="M24 -23 H30" />
            <path d="M27 -27 V-33" />
            <path class="thin" d="M-50 -1 h-10 M-48 3 h-16" />
          </g>
        {/if}
        {#if fw.rig > 0}
          <g style="opacity:{fw.rig}">
            <rect class="solid" x="-36" y="-24" width="42" height="17" />
            <path class="cut" d="M-30 -21 V-10 M-24 -21 V-10 M-18 -21 V-10 M-12 -21 V-10 M-6 -21 V-10 M0 -21 V-10" />
            <path d="M-38 -5.5 H8" />
            <path class="solid" d="M7 -5 V-18 H15 L22 -11 V-5 Z" />
            <path class="cut" d="M10 -16 H14 L18 -12 H10 Z" />
            {#each [-30, -22, 15] as cx}
              <g transform="translate({cx} -3.6) rotate({spin})">
                <circle class="solid" r="3.6" /><path class="cut" d="M-2 0 H2" />
              </g>
            {/each}
          </g>
        {/if}
        {#if fw.box > 0}
          <g style="opacity:{fw.box}">
            <rect class="solid" x="-7" y="-15" width="15" height="15" />
            <path class="cut" d="M0.5 -15 V0 M-7 -11 H8" />
          </g>
        {/if}
      </g>
    </g>

    <!-- ── Near layer: grass and posts sliding past faster ─────────── -->
    <g class="near" transform="translate({fmt(-cam * NEAR)} 0)">
      {#each TUFTS as x, i}
        <path d="M{x} 99 q-0.6 -5 -3 -8 M{x + 2} 99 q0 -6 1.2 -{9 + (i % 3) * 2} M{x + 4} 99 q0.8 -4 3.6 -6" />
      {/each}
    </g>
  </svg>
</div>

<style lang="scss">
  @use './tokens' as *;

  .journey {
    position: relative;
    flex: none;
    width: 100%;
    margin-top: $space-4;
    color: $color-ink-strong;
    --paper: #{$color-accent-soft};
  }
  svg {
    display: block;
    width: 100%;
    height: auto;
    max-height: 120px;
    overflow: hidden;
    // The landscape comes in and leaves through soft edges.
    -webkit-mask-image: linear-gradient(90deg, transparent, #000 7%, #000 93%, transparent);
    mask-image: linear-gradient(90deg, transparent, #000 7%, #000 93%, transparent);
  }

  // One colour, line-art: everything is stroked in ink unless marked solid.
  path,
  rect,
  circle {
    fill: none;
    stroke: currentColor;
    stroke-width: 1.4;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .thin {
    stroke-width: 0.9;
  }
  .bold {
    stroke-width: 2.2;
  }
  .dash {
    stroke: var(--paper);
    stroke-width: 1.1;
    stroke-dasharray: 4 5;
  }
  .far {
    opacity: 0.22;
    path {
      stroke-width: 1.2;
    }
  }
  .near {
    opacity: 0.32;
  }
  .world > g:not(.trav),
  .world > path:not(.line):not(.tick) {
    opacity: 0.62;
  }
  .line.done {
    stroke-width: 2;
  }
  .line.ahead {
    stroke-width: 1.4;
    stroke-dasharray: 0.1 6;
    opacity: 0.45;
  }
  .tick {
    opacity: 0.35;
    &.lit {
      opacity: 1;
    }
  }
  .label {
    font: 600 7.6px $font-mono;
    letter-spacing: 1.2px;
    text-transform: uppercase;
    text-anchor: middle;
    fill: currentColor;
    stroke: none;
    opacity: 0.4;
    transition: opacity 300ms;
    &.lit {
      opacity: 1;
    }
  }
  // The traveller: solid ink silhouettes with details cut out in the page colour.
  .trav {
    .solid {
      fill: currentColor;
      stroke: none;
    }
    .cut {
      stroke: var(--paper);
      stroke-width: 1.2;
    }
  }
  .cloud {
    fill: none;
  }

  @media (max-width: 1023px) {
    // Sits over the bottom of the panels on small screens: give it the page
    // colour so an example running long never shows through the landscape.
    .journey {
      z-index: 1;
      background: linear-gradient(transparent, var(--paper) 18%);
    }
  }
  @media (max-width: 760px) {
    svg {
      -webkit-mask-image: linear-gradient(90deg, transparent, #000 4%, #000 96%, transparent);
      mask-image: linear-gradient(90deg, transparent, #000 4%, #000 96%, transparent);
    }
  }
</style>
