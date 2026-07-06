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
  <span class="content-wrapper">
    {#if icon}
      <span class="icon">
        <Svg src={icon} />
      </span>
    {/if}
    <span class="label-text">{label}</span>
    <span class="corner-arrow" aria-hidden="true">
      <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <line x1="7" y1="17" x2="17" y2="7" />
        <polyline points="7 7 17 7 17 17" />
      </svg>
    </span>
  </span>
</a>

<style lang="scss">
  .nav-link {
    text-decoration: none;
    cursor: pointer;
    user-select: none;
    color: var(--color-foreground, #181818);
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    box-shadow: none;
    padding: 0.5rem 0.75rem;
    position: relative;

    .content-wrapper {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
    }

    .icon {
      display: flex;
      place-items: center;
      justify-content: center;
      padding: 0.4rem;
      border-radius: 500px;
      background: rgba(var(--color-highlight-2-rgb), 0.12);
      --color-foreground: var(--color-highlight-2);
      transition: background 0.3s ease, transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);

      :global(svg) {
        width: 1.15rem;
        height: 1.15rem;
        transition: all 0.3s ease;
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
      text-align: center;
      color: rgba(0, 0, 0, 0.65);
      transition: color 0.25s ease;
    }

    .corner-arrow {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 0;
      max-width: 0;
      opacity: 0;
      overflow: hidden;
      color: var(--color-highlight-2);
      transform: translate(-6px, 6px);
      transition: all 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
    }

    &:hover,
    &.active {
      .label-text {
        color: var(--color-highlight-2);
      }

      .icon {
        background: var(--color-highlight-2);
        --color-foreground: #ffffff;
        transform: scale(1.08);
      }

      .corner-arrow {
        width: 13px;
        max-width: 13px;
        opacity: 1;
        transform: translate(0, 0);
      }
    }

    &.active .label-text {
      font-weight: 700;
    }
  }
</style>
