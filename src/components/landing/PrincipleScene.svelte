<script lang="ts">
  /**
   * Scene 6, "A well-planned project" (no photo). On a blueprint grid the
   * sentence fills in word by word. Then the plan becomes the move: each
   * object is first drawn as a blueprint outline and then filled in.
   * Boxes are packed into a container, a quay crane lifts it onto the ship,
   * the ship sails to the far shore and a pin drops on the new house. The
   * grid turns from ink to paper white as the move completes.
   */
  import { scene, seg, easeOut, easeInOut, lerp } from './scene.ts';
  import { PRINCIPLE } from './content.ts';

  let p = 0;
  const words = PRINCIPLE.title.split(' ');
  $: fill = seg(p, 0.02, 0.28) * words.length;
  /** Blueprint outline still to draw (1 → 0) over [a, b]. */
  $: d = (a: number, b: number) => 1 - easeInOut(seg(p, a, b));
  /** Fill opacity over [a, b]. */
  $: f = (a: number, b: number) => easeOut(seg(p, a, b));

  // Boxes drop in, then slide into the container.
  $: drop = (k: number) => easeOut(seg(p, 0.3 + k * 0.03, 0.36 + k * 0.03));
  $: pack = easeInOut(seg(p, 0.44, 0.5));
  $: doors = easeInOut(seg(p, 0.49, 0.52));
  // Crane: lift, travel to the ship, lower; the cable follows the trolley.
  $: lift = easeInOut(seg(p, 0.52, 0.56));
  $: travel = easeInOut(seg(p, 0.56, 0.62));
  $: lower = easeInOut(seg(p, 0.62, 0.65));
  $: trolleyX = lerp(370, 600, travel);
  $: cY = -70 * lift + lerp(0, 56, lower); // container y offset
  $: sail = easeInOut(seg(p, 0.67, 0.84)) * 60;
  $: cX = 230 * travel + sail;
  $: cable = 1 - seg(p, 0.65, 0.68); // cable retracts after lowering
  $: pin = easeOut(seg(p, 0.86, 0.92));
  $: day = easeInOut(seg(p, 0.88, 0.98));
  $: bodyIn = easeOut(seg(p, 0.84, 0.94));
  const BOXES = [
    { x: 110, y: 200, w: 48, h: 50 },
    { x: 164, y: 208, w: 42, h: 42 },
    { x: 128, y: 158, w: 40, h: 42 }
  ];
</script>

<section id="principle" class="scene" style="--len:3.8; --day:{day}" use:scene={(v) => (p = v)} aria-labelledby="principle-title">
  <div class="stage">
    <div class="grid-bg" aria-hidden="true" style="transform: translate3d(0, {-p * 80}px, 0)"></div>
    <div class="paper" aria-hidden="true" style="opacity:{day}"></div>
    <div class="wrap inner">
      <h2 class="sentence" id="principle-title">
        {#each words as w, i}
          <span class="w" style="--f:{Math.min(1, Math.max(0, fill - i))}">{w}</span>{' '}
        {/each}
      </h2>

      <svg class="plan" viewBox="0 0 1000 320" aria-hidden="true">
        <defs>
          <linearGradient id="pr-sea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0f6d74" /><stop offset="1" stop-color="#0a4b51" /></linearGradient>
          <linearGradient id="pr-cont" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#13a8ad" /><stop offset="1" stop-color="#0a7f84" /></linearGradient>
          <linearGradient id="pr-wall-shade" x1="0" y1="0" x2="1" y2="0"><stop offset="0.55" stop-color="#000" stop-opacity="0" /><stop offset="1" stop-color="#000" stop-opacity="0.12" /></linearGradient>
          <!-- the gap between the quays; open upwards so the swell is never cut -->
          <clipPath id="pr-sea-clip"><rect x="470" y="200" width="390" height="120" /></clipPath>
          <linearGradient id="pr-swell" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1a8e95" /><stop offset="1" stop-color="#0b5359" /></linearGradient>
        </defs>

        <!-- sea first (back swell); the front swell and the quays are drawn after the ship -->
        <g class="land" style="opacity:{f(0.28, 0.34)}">
          <g clip-path="url(#pr-sea-clip)">
            <rect x="470" y="268" width="392" height="52" fill="url(#pr-sea)" />
            <path class="swell back" d="M392 258 q40 -12 80 0 t80 0 t80 0 t80 0 t80 0 t80 0 t80 0 t80 0 t80 0 t80 0 t80 0 t80 0 t80 0 t80 0 V320 H392 Z" style="fill:url(#pr-sea)" />
            <path class="crest" d="M392 258 q40 -12 80 0 t80 0 t80 0 t80 0 t80 0 t80 0 t80 0 t80 0 t80 0 t80 0 t80 0 t80 0 t80 0 t80 0" />
          </g>
        </g>

        <!-- boxes: outline, fill, drop in, then slide into the container -->
        {#each BOXES as bx, k}
          <g style="transform: translate({pack * (340 - bx.x - k * 10)}px, {(1 - drop(k)) * -40 + pack * (k === 2 ? 34 : 0)}px); opacity:{(1 - pack) * (0.2 + 0.8 * drop(k))}">
            <rect x={bx.x} y={bx.y} width={bx.w} height={bx.h} rx="2" class="box" style="fill-opacity:{f(0.33 + k * 0.03, 0.38 + k * 0.03)}" />
            <path d="M{bx.x} {bx.y} l8 -7 h{bx.w} l-8 7 z" class="box-top" style="fill-opacity:{f(0.33 + k * 0.03, 0.38 + k * 0.03)}" />
            <rect x={bx.x + bx.w / 2 - 4} y={bx.y} width="8" height={bx.h} class="tape" style="opacity:{f(0.35 + k * 0.03, 0.4 + k * 0.03)}" />
            <rect x={bx.x} y={bx.y} width={bx.w} height={bx.h} rx="2" class="ol" pathLength="1" style="stroke-dashoffset:{d(0.3 + k * 0.03, 0.35 + k * 0.03)}" />
          </g>
        {/each}

        <!-- crane (quay to ship) -->
        <g class="crane" style="opacity:{f(0.4, 0.46)}">
          <path class="ol steel" pathLength="1" style="stroke-dashoffset:{d(0.38, 0.46)}" d="M270 250 V70 M300 250 V70 M270 160 L300 130 M270 130 L300 160 M250 70 H720 M250 62 H420 M300 70 L380 40 L420 62" />
          <rect x={trolleyX - 14} y="64" width="28" height="12" rx="2" class="trolley" />
          <line x1={trolleyX} y1="76" x2={trolleyX} y2={lerp(76, 190 + cY, cable)} class="cable" />
        </g>

        <!-- ship -->
        <g style="transform: translateX({sail}px)">
          <g class="ship" style="opacity:{f(0.46, 0.54)}">
            <path class="hull" d="M500 236 H790 L760 276 H520 Z" />
            <path class="hull-red" d="M512 262 H770 L760 276 H520 Z" />
            <rect x="512" y="196" width="46" height="40" class="bridge" />
            {#each [0, 1, 2] as wdw}<rect x={518 + wdw * 13} y="204" width="9" height="7" class="window" />{/each}
            <rect x="528" y="178" width="14" height="18" class="funnel" />
          </g>
          <path class="ol" pathLength="1" style="stroke-dashoffset:{d(0.44, 0.52)}" d="M500 236 H790 L760 276 H520 Z M512 196 h46 v40 h-46 z" />
          <path class="wake" style="opacity:{seg(p, 0.67, 0.72) * (1 - seg(p, 0.84, 0.9))}" d="M500 268 q-30 -4 -60 0 q-20 3 -40 0" />
        </g>

        <!-- the front swell passes over the hull, so the ship sits in the water -->
        <g class="land" clip-path="url(#pr-sea-clip)" style="opacity:{f(0.28, 0.34)}">
          <path class="swell front" d="M392 266 q40 -10 80 0 t80 0 t80 0 t80 0 t80 0 t80 0 t80 0 t80 0 t80 0 t80 0 t80 0 t80 0 t80 0 t80 0 V320 H392 Z" style="fill:url(#pr-swell)" />
        </g>
        <g class="land" style="opacity:{f(0.28, 0.34)}">
          <rect x="0" y="250" width="472" height="70" class="quay" />
          <rect x="858" y="250" width="142" height="70" class="quay" />
          <rect x="858" y="250" width="142" height="6" class="quay-edge" />
          <rect x="0" y="250" width="472" height="6" class="quay-edge" />
        </g>

        <!-- container: packed, lifted, carried, sailed -->
        <g style="transform: translate({cX}px, {cY}px)">
          <g style="opacity:{f(0.42, 0.48)}">
            <rect x="290" y="190" width="160" height="60" rx="2" fill="url(#pr-cont)" />
            {#each Array(12) as _, r}<rect x={300 + r * 12} y="194" width="5" height="52" fill="rgba(255,255,255,0.12)" />{/each}
            <path d="M290 190 l10 -8 h160 l-10 8 z" class="cont-top" />
            <rect x={450 - 30 * (1 - doors)} y="190" width={30 * (1 - doors)} height="60" class="door-open" />
            <line x1="420" y1="194" x2="420" y2="246" class="door-line" style="opacity:{doors}" />
          </g>
          <rect x="290" y="190" width="160" height="60" rx="2" class="ol" pathLength="1" style="stroke-dashoffset:{d(0.4, 0.46)}" />
        </g>

        <!-- house and pin on the far shore (drawn after the sea so it sits on the shore) -->
        <g class="house" style="opacity:{f(0.8, 0.86)}">
          <!-- palm -->
          <path d="M986 250 C984 222 982 200 986 178" class="palm-trunk" />
          <path d="M986 180 C972 170 958 172 948 182 C962 176 974 178 986 182 Z M986 180 C998 168 1012 168 1020 176 C1008 174 996 176 986 182 Z M986 180 C980 164 970 156 958 156 C970 162 978 170 984 182 Z" class="palm-leaf" />
          <!-- garden path and lawn -->
          <rect x="866" y="244" width="124" height="6" class="lawn" />
          <!-- main volume -->
          <rect x="878" y="204" width="72" height="44" class="house-wall" />
          <rect x="878" y="204" width="72" height="44" class="house-shade" />
          <!-- side volume -->
          <rect x="944" y="218" width="34" height="30" class="house-wall2" />
          <rect x="940" y="214" width="42" height="5" class="house-slab" />
          <!-- roof with overhang -->
          <path d="M870 208 L914 178 L958 208 Z" class="house-roof" />
          <path d="M914 178 L958 208 L950 208 L914 184 Z" class="roof-shade" />
          <!-- windows and door -->
          <rect x="886" y="214" width="20" height="16" rx="1" class="glass" />
          <path d="M896 214 V230 M886 222 H906" class="mullion" />
          <rect x="952" y="226" width="20" height="12" rx="1" class="glass" />
          <rect x="918" y="220" width="16" height="28" rx="1" class="house-door" />
          <circle cx="931" cy="235" r="1.2" class="knob" />
          <rect x="912" y="246" width="28" height="4" class="step" />
          <circle cx="938" cy="216" r="2" class="lamp" />
        </g>
        <path class="ol" pathLength="1" style="stroke-dashoffset:{d(0.78, 0.84)}" d="M870 208 L914 178 L958 208 M878 204 V248 H950 V204 M944 218 H978 V248" />
        <g class="pin" style="opacity:{pin}; transform: translateY({(1 - pin) * -40}px)">
          <path d="M922 108 c-14 0 -24 10 -24 24 c0 18 24 38 24 38 s24 -20 24 -38 c0 -14 -10 -24 -24 -24 z" />
          <circle cx="922" cy="132" r="8" class="pin-hole" />
        </g>
      </svg>

      <p class="body" style="opacity:{bodyIn}; transform: translateY({(1 - bodyIn) * 16}px)">{PRINCIPLE.body}</p>
    </div>
  </div>
</section>

<style lang="scss">
  @use './tokens' as *;

  .scene { @include scene-shell; background: $color-ink-strong; }
  .stage { @include stage; display: flex; align-items: center; padding-top: $header-clear; padding-bottom: 6.5rem; isolation: isolate; }
  .grid-bg {
    position: absolute; inset: -100px 0; z-index: -2;
    background-image:
      linear-gradient(rgba(2, 181, 187, 0.14) 1px, transparent 1px),
      linear-gradient(90deg, rgba(2, 181, 187, 0.14) 1px, transparent 1px),
      linear-gradient(rgba(2, 181, 187, 0.06) 1px, transparent 1px),
      linear-gradient(90deg, rgba(2, 181, 187, 0.06) 1px, transparent 1px);
    background-size: 120px 120px, 120px 120px, 24px 24px, 24px 24px;
  }
  .paper { position: absolute; inset: 0; z-index: -1; background: $color-canvas; }
  .wrap { @include container; }
  .inner { display: flex; flex-direction: column; align-items: center; text-align: center; gap: $space-4; width: 100%; }

  .sentence { margin: 0; max-width: 20ch; font: 800 clamp(2rem, 5.2vw, 4.6rem)/1.02 $font-sans; letter-spacing: -0.045em; }
  .w {
    display: inline-block; font-family: $font-sans;
    color: #fff; /* fallback where color-mix is unsupported (see @supports below) */
    color: color-mix(in srgb, transparent calc((1 - var(--f)) * 100%), color-mix(in srgb, #fff calc((1 - var(--day)) * 100%), #{$color-ink-strong}));
    -webkit-text-stroke: 1.2px color-mix(in srgb, rgba(255, 255, 255, 0.45) calc((1 - var(--day)) * 100%), #{$color-ink-strong});
    transform: translateY(calc((1 - var(--f)) * 8px));
  }

  .plan { width: min(1000px, 100%); height: auto; overflow: visible; }
  .ol {
    fill: none; stroke: #7fe3e6; stroke: color-mix(in srgb, #7fe3e6 calc((1 - var(--day)) * 100%), #{$color-ink-strong});
    stroke-width: 1.6; stroke-dasharray: 1; stroke-linecap: round; stroke-linejoin: round;
  }
  .steel { stroke-width: 3; }
  .quay { fill: #24454c; }
  /* Swell: two layers drift at different speeds by exactly one wavelength, so the loop is seamless. */
  .swell, .crest { animation: swell 4.2s linear infinite; }
  .swell.front { opacity: 0.88; animation-duration: 2.8s; }
  .crest { fill: none; stroke: rgba(255, 255, 255, 0.55); stroke-width: 2; stroke-linecap: round; }
  @keyframes swell { to { transform: translateX(-80px); } }
  .box { fill: #c8a06e; stroke: none; }
  .box-top { fill: #e0bd8b; }
  .tape { fill: #ead7b0; }
  .crane .trolley { fill: $color-accent; }
  .cable { stroke: #d9e1e6; stroke-width: 1.5; }
  .hull { fill: #10333a; }
  .hull-red { fill: $color-red; }
  .bridge { fill: #f2f5f6; }
  .window { fill: #7fc8cc; }
  .funnel { fill: $color-red; }
  .wake { fill: none; stroke: rgba(255, 255, 255, 0.6); stroke-width: 2; stroke-linecap: round; }
  .cont-top { fill: #33c2c6; }
  .door-open { fill: #06555a; }
  .door-line { stroke: rgba(255, 255, 255, 0.5); stroke-width: 1.5; }
  .quay-edge { fill: #2f5960; }
  .house-wall { fill: #f6f1e7; }
  .house-shade { fill: url(#pr-wall-shade); }
  .house-wall2 { fill: #e8dfcf; }
  .house-slab { fill: #c9bba3; }
  .house-roof { fill: #b8432f; }
  .roof-shade { fill: #8f3020; }
  .house-door { fill: #6b4a33; }
  .knob { fill: #e9c46a; }
  .glass { fill: #9fd8dc; stroke: #f6f1e7; stroke-width: 1.5; }
  .mullion { fill: none; stroke: #f6f1e7; stroke-width: 1.5; }
  .step { fill: #c9bba3; }
  .lamp { fill: #ffe7a8; filter: drop-shadow(0 0 4px #ffd36b); }
  .lawn { fill: #6f9d6b; }
  .palm-trunk { fill: none; stroke: #8a6a45; stroke-width: 4; stroke-linecap: round; }
  .palm-leaf { fill: #4f8f5a; }
  .pin path { fill: $color-accent; }
  .pin-hole { fill: #fff; }

  .body { @include body; font-size: clamp(1.05rem, 1.6vw, 1.3rem); max-width: 48ch; color: rgba(255, 255, 255, 0.75); color: color-mix(in srgb, rgba(255, 255, 255, 0.75) calc((1 - var(--day)) * 100%), #{$color-steel}); }

  /* Browsers without color-mix (Safari < 16.2): the scene stays ink, the text white. */
  @supports not (color: color-mix(in srgb, red, blue)) {
    .paper { display: none; }
  }

  @include reduced-motion { .swell, .crest { animation: none; } }

  :global(.rm) {
    .stage { padding-block: $space-24; }
    .grid-bg { display: none; }
    .paper { opacity: 1 !important; }
  }
</style>
