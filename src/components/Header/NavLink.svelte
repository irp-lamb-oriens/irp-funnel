<script lang="ts">
  import { page } from "$app/stores";
  import Svg from "../SVG/SVG.svelte";

  export let href: string;
  export let label: string;
  export let icon: string | undefined = undefined;
  export let isExternal: boolean = false;
  export let callback: (e: MouseEvent) => void = () => {};

  $: active = $page.url.pathname === href;
</script>

<a
  {href}
  class="nav-link {active ? 'active' : ''}"
  on:click={callback}
  rel={isExternal ? "noopener noreferrer" : undefined}
  target={isExternal ? "_blank" : undefined}
>
  <div class="content-wrapper">
    {#if icon}
      <span class="icon">
        <Svg src={icon} />
      </span>
    {/if}
    <span class="label-text">{label}</span>
  </div>
</a>

<style lang="scss">
  .nav-link {
    --btn-color: var(--color-highlight-2);
    --glow-color: rgba(var(--color-highlight-2-rgb), 0.5);
    
    text-decoration: none;
    transition: all 0.5s cubic-bezier(0.23, 1, 0.32, 1), width 0.3s ease, padding 0.3s ease;
    cursor: pointer;
    user-select: none;
    color: #ffffff;
    display: flex;
    align-items: center;
    border-radius: 4rem;
    background: rgba(255, 255, 255, 0.05);
    padding: 0.5rem 1.25rem 0.5rem 0.5rem;
    border: 1px solid rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(20px);
    position: relative;
    overflow: visible;

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
      opacity: 0.3;
      transition: opacity 0.3s ease;
    }

    .content-wrapper {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      position: relative;
      z-index: 2;
    }

    .icon {
      transition: all 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
      background: rgba(var(--color-highlight-2-rgb), 0.2);
      padding: 0.5rem;
      border-radius: 500px;
      display: flex;
      place-items: center;
      justify-content: center;
      box-shadow: 
        0 0 10px rgba(var(--color-highlight-2-rgb), 0.2),
        inset 0 0 5px rgba(255, 255, 255, 0.2);
      --color-foreground: #ffffff;
      position: relative;
      z-index: 2;

      :global(svg) {
        width: 1.25rem;
        height: 1.25rem;
        transition: all 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
        fill: var(--color-foreground) !important;
      }
      
      :global(path) {
        fill: var(--color-foreground) !important;
      }
    }

    .label-text {
      font-size: 0.9rem;
      font-weight: 600;
      letter-spacing: 0.02em;
      transition: all 0.3s ease;
      color: rgba(255, 255, 255, 0.7);
    }

    &:hover, &.active {
      background: rgba(255, 255, 255, 0.1);
      border-color: rgba(255, 255, 255, 0.3);
            box-shadow: 
        0 10px 20px -5px rgba(0, 0, 0, 0.3),
        0 0 15px var(--glow-color);

      &::before {
        opacity: 1;
        animation: borderRotate 3s linear infinite;
      }

      .icon {
        transform: scale(1.1);
        background: var(--btn-color);
        --color-foreground: #000000;
        box-shadow: 0 0 20px rgba(var(--color-highlight-2-rgb), 0.8);

        :global(svg) {
          transform: scale(1.1);
        }
      }

      .label-text {
        color: #ffffff;
      }
    }

    &.active {
      background: rgba(var(--color-highlight-2-rgb), 0.1);
      border-color: rgba(var(--color-highlight-2-rgb), 0.4);
      
      &::before {
        opacity: 0.8;
      }
      
      .icon {
        background: var(--btn-color);
        --color-foreground: #000000;
      }
      
      .label-text {
        color: #ffffff;
      }
    }

    @keyframes borderRotate {
      from { filter: hue-rotate(0deg); }
      to { filter: hue-rotate(360deg); }
    }
  }
</style>
