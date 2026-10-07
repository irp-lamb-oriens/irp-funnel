<script lang="ts">
  export let originCity = '';
  export let originCountry = '';
  export let destinationCity = '';
  export let destinationCountry = '';
  export let editing = false;
  export let editable = true;

  $: originLabel = [originCity, originCountry].filter(Boolean).join(', ') || 'Origin';
  $: destinationLabel = [destinationCity, destinationCountry].filter(Boolean).join(', ') || 'Destination';
</script>

<div class="route-path" class:route-path--editing={editing}>
  <!-- Origin endpoint -->
  <div class="route-path__endpoint route-path__endpoint--origin">
    <span class="route-path__beacon" aria-hidden="true">
      <span class="route-path__beacon-ring"></span>
      <span class="route-path__beacon-core"></span>
    </span>
    <div class="route-path__meta">
      <span class="route-path__eyebrow">Origin</span>
      {#if editing && editable}
        <div class="route-path__inputs">
          <input class="route-path__input" type="text" placeholder="City, State/Province" bind:value={originCity} />
          <input class="route-path__input" type="text" placeholder="Country" bind:value={originCountry} />
        </div>
      {:else}
        <span class="route-path__value">{originLabel}</span>
      {/if}
    </div>
  </div>

  <!-- Animated flight path -->
  <div class="route-path__flight" aria-hidden="true">
    <svg class="route-path__svg" viewBox="0 0 600 100" preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id="rp-grad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="#02b5bb" stop-opacity="0.25" />
          <stop offset="50%" stop-color="#02b5bb" stop-opacity="0.95" />
          <stop offset="100%" stop-color="#02b5bb" stop-opacity="0.25" />
        </linearGradient>
      </defs>
      <!-- Dashed guide track -->
      <path
        id="rp-track"
        class="route-path__track"
        d="M 10 50 C 150 8, 450 8, 590 50"
      />
      <!-- Self-drawing solid path -->
      <path
        class="route-path__draw"
        d="M 10 50 C 150 8, 450 8, 590 50"
        pathLength="1"
      />
      <!-- Travelling plane -->
      <g class="route-path__plane">
        <circle class="route-path__plane-glow" r="9" />
        <path
          class="route-path__plane-shape"
          d="M -11 -6 L 11 0 L -11 6 L -4 0 Z"
        />
        <animateMotion dur="4.5s" repeatCount="indefinite" rotate="auto">
          <mpath href="#rp-track" />
        </animateMotion>
      </g>
    </svg>
  </div>

  <!-- Destination endpoint -->
  <div class="route-path__endpoint route-path__endpoint--destination">
    <span class="route-path__beacon route-path__beacon--dest" aria-hidden="true">
      <span class="route-path__beacon-ring"></span>
      <span class="route-path__beacon-core"></span>
    </span>
    <div class="route-path__meta">
      <span class="route-path__eyebrow">Destination</span>
      {#if editing && editable}
        <div class="route-path__inputs">
          <input class="route-path__input" type="text" placeholder="City, State/Province" bind:value={destinationCity} />
          <input class="route-path__input" type="text" placeholder="Country" bind:value={destinationCountry} />
        </div>
      {:else}
        <span class="route-path__value">{destinationLabel}</span>
      {/if}
    </div>
  </div>
</div>

<style lang="scss">
  .route-path {
    display: flex;
    align-items: center;
    gap: 1rem;
    width: 100%;
    padding: 1.25rem 1.5rem;
    background: linear-gradient(135deg, rgba(2, 181, 187, 0.05) 0%, #ffffff 45%, #ffffff 55%, rgba(2, 181, 187, 0.05) 100%);
    border: 1px solid rgba(2, 181, 187, 0.18);
    border-radius: 16px;
    position: relative;
    overflow: hidden;

    // Soft ambient halo behind the whole route
    &::before {
      content: '';
      position: absolute;
      inset: 0;
      background: radial-gradient(ellipse 60% 120% at 50% 50%, rgba(2, 181, 187, 0.08), transparent 70%);
      pointer-events: none;
    }

    &__endpoint {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      flex-shrink: 0;
      position: relative;
      z-index: 1;
      max-width: 220px;

      &--destination {
        flex-direction: row-reverse;
        text-align: right;
      }
    }

    &__beacon {
      position: relative;
      width: 18px;
      height: 18px;
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    &__beacon-core {
      position: relative;
      z-index: 1;
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: radial-gradient(circle at 50% 40%, #7df0f5 0%, #02b5bb 60%, #018d92 100%);
      box-shadow: 0 0 0 3px #ffffff, 0 0 10px rgba(2, 181, 187, 0.55);
    }

    &__beacon-ring {
      position: absolute;
      inset: 0;
      border-radius: 50%;
      border: 2px solid rgba(2, 181, 187, 0.5);
      animation: rp-ring 2.4s ease-out infinite;
    }

    // Destination beacon pulses with a second, delayed ring for an "arrival" feel
    &__beacon--dest .route-path__beacon-ring {
      animation: rp-ring 2.4s ease-out infinite, rp-ring 2.4s ease-out 1.2s infinite;
    }

    &__meta {
      display: flex;
      flex-direction: column;
      gap: 0.2rem;
      min-width: 0;
    }

    &__eyebrow {
      font-size: 0.62rem;
      font-weight: 800;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: #0a7e82;
    }

    &__value {
      font-size: 0.95rem;
      font-weight: 600;
      color: #0f172a;
      line-height: 1.3;
      word-break: break-word;
    }

    &__inputs {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
    }

    &__input {
      width: 100%;
      min-width: 140px;
      padding: 0.4rem 0.6rem;
      font-size: 0.85rem;
      font-family: inherit;
      color: #0f172a;
      background: #ffffff;
      border: 1px solid rgba(2, 181, 187, 0.3);
      border-radius: 8px;
      outline: none;
      transition: border-color 0.2s ease, box-shadow 0.2s ease;

      &:focus {
        border-color: #02b5bb;
        box-shadow: 0 0 0 3px rgba(2, 181, 187, 0.15);
      }
    }

    &__flight {
      flex: 1;
      min-width: 0;
      position: relative;
      z-index: 1;
    }

    &__svg {
      display: block;
      width: 100%;
      height: 64px;
      overflow: visible;
    }

    &__track {
      fill: none;
      stroke: rgba(2, 181, 187, 0.22);
      stroke-width: 1.5;
      stroke-dasharray: 3 7;
      stroke-linecap: round;
    }

    &__draw {
      fill: none;
      stroke: url(#rp-grad);
      stroke-width: 2.5;
      stroke-linecap: round;
      stroke-dasharray: 1;
      stroke-dashoffset: 1;
      animation: rp-draw 2.2s cubic-bezier(0.65, 0, 0.35, 1) 0.2s forwards;
    }

    &__plane {
      opacity: 0;
      animation: rp-plane-in 0.6s ease 0.4s forwards;
    }

    &__plane-glow {
      fill: rgba(2, 181, 187, 0.18);
    }

    &__plane-shape {
      fill: #ffffff;
      stroke: #02b5bb;
      stroke-width: 1.5;
      stroke-linejoin: round;
      filter: drop-shadow(0 1px 3px rgba(2, 181, 187, 0.5));
    }
  }

  @keyframes rp-draw {
    to { stroke-dashoffset: 0; }
  }

  @keyframes rp-plane-in {
    to { opacity: 1; }
  }

  @keyframes rp-ring {
    0%   { transform: scale(0.6); opacity: 0.8; }
    100% { transform: scale(2.4); opacity: 0; }
  }

  // Responsive: stack endpoints above/below the path on narrow screens
  @media (max-width: 560px) {
    .route-path {
      flex-direction: column;
      gap: 0.75rem;
      align-items: stretch;
    }

    .route-path__endpoint {
      max-width: none;
      flex-direction: row;
      text-align: left;

      &--destination {
        flex-direction: row;
        text-align: left;
      }
    }

    .route-path__flight {
      order: 2;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .route-path__draw,
    .route-path__plane,
    .route-path__beacon-ring {
      animation: none !important;
    }
    .route-path__draw { stroke-dashoffset: 0; }
    .route-path__plane { opacity: 1; }
  }
</style>
