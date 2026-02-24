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
  class:loading
>
  <span class="icon">
    <Svg {src} />
  </span>
  {label}
</button>

<style lang="scss">
  .icon-button {
    --btn-color: var(--color-highlight-2);
    --glow-color: rgba(var(--color-highlight-2-rgb), 0.5);
    
    border: none;
    transition: all 0.5s cubic-bezier(0.23, 1, 0.32, 1);
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

    & .icon {
      transition: all 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
      background: var(--btn-color);
      padding: 1rem;
      border-radius: 50%;
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

      &::before {
        opacity: 1;
        animation: borderRotate 2s linear infinite;
      }

      & .icon {
        transform: scale(1.1) translateX(5px);
        background: #ffffff;
        --color-foreground: var(--btn-color);
        box-shadow: 0 0 40px rgba(255, 255, 255, 0.8);

        :global(svg) {
          transform: scale(1.2);
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

    &.loading {
      & .icon {
        animation: pulse 1.5s infinite ease-in-out;
      }
    }
  }

  @keyframes pulse {
    0% { transform: scale(1); opacity: 1; }
    50% { transform: scale(0.9); opacity: 0.7; }
    100% { transform: scale(1); opacity: 1; }
  }
</style>
