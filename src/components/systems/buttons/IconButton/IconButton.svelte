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
    border: none;
    transition: 0.15s;
    cursor: pointer;
    pointer-events: auto;
    user-select: none;
    color: var(--color-background);
    display: flex;
    place-items: center;
    font-size: 18px;
    border-radius: 30px;
    background: transparent;

    & .icon {
      transition: .35s;
      background: var(--color-x-gradient);
      padding: 0.5rem;
      margin-right: 1rem;
      border-radius: 50%;
      display: flex;
      place-items: center;
      justify-content: center;
      box-shadow: 0 0 10px -7px var(--color-background);
      transform: rotate(0deg);

      :global(svg) {
        width: 1.5rem;
        height: 1.5rem;
        transition: .35s;
      }
    }

    &:not(&:disabled):hover .icon {
      opacity: 1;
      // background: var(--color-x-gradient-inversion);
      --color-foreground: var(--color-background);
      // margin-right: 1.25rem;

      :global(svg) {
        transform: rotate(3.60deg);
      }	
    }

    &.inactive {
      pointer-events: none;
      opacity: 0.5;
    }
  }
</style>
