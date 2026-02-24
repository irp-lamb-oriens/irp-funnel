<script lang="ts">
  import type { MouseEventHandler } from "svelte/elements";
  import Svg from "../../../SVG/SVG.svelte";

  export let disabled: boolean = false;
  export let loading: boolean = false;
  export let active: boolean = true;
  export let label: string = "";
  export let src: string;
  export let callback: MouseEventHandler<HTMLButtonElement> = () => {};
</script>

<button
  {disabled}
  class="icon-button {active ? 'active' : 'inactive'}"
  on:click={callback}
  class:is-loading={loading}
>
  <div class="content-wrapper {loading ? 'is-loading' : ''}">
    {#if loading}
      <div class="ultra-modern-loader">
        <div class="magnetic-orb">
          <div class="inner-core"></div>
          <div class="pulse-ring"></div>
        </div>
        <div class="neon-trail"></div>
        <div class="particle-field">
          {#each Array(6) as _, i}
            <div class="particle p-{i}"></div>
          {/each}
        </div>
      </div>
    {:else}
      <span class="icon">
        <Svg {src} />
      </span>
      {#if label}
        <span class="label-text">{label}</span>
      {/if}
    {/if}
  </div>
</button>

<style lang="scss">
  .icon-button {
    --btn-color: var(--color-highlight-2);
    --glow-color: rgba(var(--color-highlight-2-rgb), 0.5);
    
    border: none;
    transition: all 0.5s cubic-bezier(0.23, 1, 0.32, 1), width 0.3s ease, padding 0.3s ease;
    cursor: pointer;
    pointer-events: auto;
    user-select: none;
    color: #ffffff;
    display: flex;
    align-items: center;
    gap: 1.25rem;
    font-size: 1.2rem;
    font-weight: 800;
    border-radius: 4rem;
    background: rgba(255, 255, 255, 0.05);
    padding: 0.75rem 2rem 0.75rem 0.75rem;
    border: 1px solid rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(20px);
    position: relative;
    overflow: visible; // Allow glow to spill out

    &::before {
      content: '';
      position: absolute;
      inset: -2px;
      border-radius: 4rem;
      padding: 2px;
      background: linear-gradient(45deg, var(--btn-color), transparent, var(--btn-color));
      -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
      mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
      -webkit-mask-composite: xor;
      mask-composite: exclude;
      opacity: 0.5;
      transition: opacity 0.3s ease;
    }

    .icon {
      transition: all 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
      background: var(--btn-color);
      padding: 1rem;
      border-radius: 500px;
      display: flex;
      place-items: center;
      justify-content: center;
      box-shadow: 
        0 0 20px var(--glow-color),
        inset 0 0 10px rgba(255, 255, 255, 0.5);
      --color-foreground: #000000;
      position: relative;
      z-index: 2;

      :global(svg) {
        width: 1.75rem;
        height: 1.75rem;
        transition: all 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
        fill: var(--color-foreground) !important;
        filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2));
      }
      
      :global(path) {
        fill: var(--color-foreground) !important;
      }
    }

    &:not(&:disabled):hover {
      background: rgba(255, 255, 255, 0.1);
      border-color: rgba(255, 255, 255, 0.3);
      transform: translateY(-5px) scale(1.05);
      box-shadow: 
        0 30px 60px -12px rgba(0, 0, 0, 0.5),
        0 0 30px var(--glow-color);
      padding: 0.75rem 1.5rem 0.75rem 0.75rem;

      &::before {
        opacity: 1;
        animation: borderRotate 2s linear infinite;
      }

      .icon {
        transform: scale(1.1) translateX(5px);
        background: #ffffff;
        --color-foreground: var(--btn-color);
        box-shadow: 0 0 40px rgba(255, 255, 255, 0.8);
        padding: 1rem 2.5rem;

        :global(svg) {
          transform: scale(1.05);
        }
      }
    }

    &:active {
      transform: translateY(-2px) scale(0.98);
      transition-duration: 0.1s;
    }

    @keyframes borderRotate {
      from { filter: hue-rotate(0deg); }
      to { filter: hue-rotate(360deg); }
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      filter: grayscale(1);
    }

    &.inactive {
      pointer-events: none;
      opacity: 0.5;
    }

    &.is-loading {
      pointer-events: none;
      cursor: wait;
      padding: 0.75rem;
      width: 3.5rem;
      height: 3.5rem;
      min-width: unset;
      justify-content: center;
      border-radius: 500px;
      background: rgba(255, 255, 255, 0.1);
      box-shadow: 
        0 0 30px rgba(var(--color-highlight-2-rgb), 0.4),
        inset 0 0 15px rgba(255, 255, 255, 0.2);

      &::before {
        border-radius: 500px;
        opacity: 1;
        animation: borderRotate 1s linear infinite;
        background: conic-gradient(from 0deg, var(--btn-color), transparent, #ffffff, var(--btn-color));
      }
    }
  }

  .content-wrapper {
    display: flex;
    align-items: center;
    gap: 1.25rem;
    width: 100%;
    justify-content: flex-start;
    transition: all 0.5s cubic-bezier(0.23, 1, 0.32, 1);

    &.is-loading {
      gap: 0;
      justify-content: center;
    }
  }

  .ultra-modern-loader {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 2.5rem;
    height: 2.5rem;

    .magnetic-orb {
      position: relative;
      width: 12px;
      height: 12px;
      background: #ffffff;
      border-radius: 50%;
      z-index: 2;
      box-shadow: 
        0 0 20px #ffffff,
        0 0 40px var(--btn-color);
      
      .inner-core {
        position: absolute;
        inset: 2px;
        background: var(--btn-color);
        border-radius: 50%;
        filter: brightness(1.5);
        animation: corePulse 0.8s ease-in-out infinite alternate;
      }

      .pulse-ring {
        position: absolute;
        inset: -10px;
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 50%;
        animation: ringPulse 1.5s cubic-bezier(0.23, 1, 0.32, 1) infinite;
      }
    }

    .neon-trail {
      position: absolute;
      inset: 0;
      border-radius: 50%;
      border: 2px solid transparent;
      border-top: 2px solid #ffffff;
      border-right: 2px solid var(--btn-color);
      border-bottom: 2px solid rgba(var(--color-highlight-2-rgb), 0.3);
      filter: drop-shadow(0 0 5px var(--btn-color));
      animation: ultraSpin 0.6s linear infinite;
    }

    .particle-field {
      position: absolute;
      inset: -5px;
      
      .particle {
        position: absolute;
        width: 2px;
        height: 2px;
        background: #ffffff;
        border-radius: 50%;
        opacity: 0;

        @for $i from 0 through 5 {
          &.p-#{$i} {
            --rot: #{$i * 60}deg;
            left: 50%;
            top: 50%;
            animation: particleFly 1s ease-out infinite;
            animation-delay: #{$i * 0.15}s;
          }
        }
      }
    }
  }

  @keyframes ultraSpin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  @keyframes corePulse {
    from { transform: scale(0.8); opacity: 0.5; }
    to { transform: scale(1.1); opacity: 1; }
  }

  @keyframes ringPulse {
    0% { transform: scale(0.5); opacity: 1; }
    100% { transform: scale(1.5); opacity: 0; }
  }

  @keyframes particleFly {
    0% { transform: rotate(var(--rot)) translateY(0); opacity: 0; }
    50% { opacity: 1; }
    100% { transform: rotate(var(--rot)) translateY(-20px); opacity: 0; }
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  @keyframes loadingSpin {
    0% { transform: scale(1); }
    50% { transform: scale(1.05); }
    100% { transform: scale(1); }
  }

  @keyframes glowPulse {
    0%, 100% { filter: brightness(1) blur(0px); }
    50% { filter: brightness(1.5) blur(2px); }
  }

  @keyframes shimmer {
    0% { background-position: -200% 0; }
    100% { background-position: 200% 0; }
  }

  @keyframes pulse {
    0% { transform: scale(1); opacity: 1; }
    50% { transform: scale(0.9); opacity: 0.7; }
    100% { transform: scale(1); opacity: 1; }
  }
</style>
