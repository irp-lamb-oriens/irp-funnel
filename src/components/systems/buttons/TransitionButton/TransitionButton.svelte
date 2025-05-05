<script lang="ts">
  import type { MouseEventHandler } from "svelte/elements";

  // Define whether the button is active or inactive
  export let active: boolean;
  export let direction: -1 | 1;
  export let callback: MouseEventHandler<HTMLButtonElement>;
</script>

<div class="transition-button {direction < 0 ? 'previous' : 'next'}">
  <button class:active class:inactive={!active} onclick={callback}>
    <span class="arrow">
      <!-- SVG arrow pointing down -->
      <svg width="24" height="24" viewBox="0 0 24 24">
        <path d="M12 16l-6-6h12z" />
      </svg>
    </span>
  </button>
</div>

<style lang="scss">
  .transition-button {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    width: 100vw;
    height: 100vh;
    display: grid;
    place-items: center;
    justify-content: center;
    pointer-events: none;

    @media (max-width: 1024px) {
      &.previous button {
        top: 25px;
        transform: rotate(180deg);
      }

      &.next button {
        bottom: 25px;
        transform: rotate(0deg);
      }
    }

    @media (min-width: 1025px) {
      &.previous button {
        left: 25px;
        transform: rotate(90deg);
      }

      &.next button {
        right: 25px;
        transform: rotate(-90deg);
      }
    }
  }

  button {
    position: absolute;
    background: var(--color-background-very-opaque); // Glassmorphism effect
    backdrop-filter: blur(6px);
    padding: 0.5rem 5rem;
    opacity: 0.75; // Base opacity
    transition: 0.3s;
    box-shadow: 0 0 10px -6.5px var(--color-background);
    border: 0;
    cursor: pointer;
    border-radius: 5px;

    &:hover {
      background: var(--color-background-very-opaque-inversion); // Glassmorphism effect

      box-shadow: 0 0 10px -8px var(--color-background);

      .arrow svg path {
        fill: var(
          --color-background
        ); // Arrow color transitions to pure white on hover
      }
    }

    &.active {
      pointer-events: all;
      opacity: 1;
    }

    &.inactive {
      pointer-events: none;
      opacity: 0;
    }

    .arrow {
      display: flex;
      justify-content: center;
      

      svg {
        width: 24px;
        height: 24px;

        path {
          fill: var(--color-background-opaque);
          transition: fill 0.3s ease;
          animation: arrow-pulse 2s infinite;
        }
      }
    }
  }

  @keyframes arrow-pulse {
    0% {
      transform: translateY(-5px);
      opacity: 0;
    }
    15% {
      transform: translateY(-5px);
      opacity: 1;
    }
    75% {
      transform: translateY(2.5px);
      opacity: 1;
    }
    100% {
      transform: translateY(2.5px);
      opacity: 0;
    }
  }
</style>
