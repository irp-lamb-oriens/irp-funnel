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
        <div class="magnetic-orb"></div>
        <div class="neon-trail"></div>
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
    width: 2.2rem;
    height: 2.2rem;

    .magnetic-orb {
      width: 10px;
      height: 10px;
      background: #ffffff;
      border-radius: 500px;
      box-shadow: 
        0 0 15px #ffffff,
        0 0 30px var(--btn-color),
        0 0 45px var(--btn-color);
      animation: magneticPulse 1.2s ease-in-out infinite;
      z-index: 2;
    }

    .neon-trail {
      position: absolute;
      width: 100%;
      height: 100%;
      border-radius: 500px;
      border: 2px solid transparent;
      border-top: 2px solid #ffffff;
      border-right: 2px solid var(--btn-color);
      filter: blur(1px);
      animation: neonSpin 0.8s cubic-bezier(0.4, 0, 0.2, 1) infinite;
    }
  }

  @keyframes neonSpin {
    0% { transform: rotate(0deg) scale(1); }
    50% { transform: rotate(180deg) scale(1.1); }
    100% { transform: rotate(360deg) scale(1); }
  }

  @keyframes magneticPulse {
    0%, 100% { 
      transform: scale(1);
      filter: brightness(1) blur(0px);
    }
    50% { 
      transform: scale(1.3);
      filter: brightness(1.5) blur(1px);
    }
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
