<script lang="ts">
  import type { MouseEventHandler } from "svelte/elements";

  // Props for the glassmorphic submit button
  export let disabled: boolean = false;
  export let loading: boolean = false;
  export let active: boolean = true;
  export let label: string = "Submit";
  export let callback: MouseEventHandler<HTMLButtonElement> = () => {};
  /**
   * Color meaning for the button.
   * Options: 'primary' | 'success' | 'error' | 'warning' | 'info'
   */
  export let color: 'primary' | 'success' | 'error' | 'warning' | 'info' = 'primary';
</script>

<button
  {disabled}
  class="submit-button {active ? 'active' : 'inactive'} {color}"
  on:click={callback}
  class:loading
>
  {label}
</button>

<style lang="scss">
  .submit-button {
    backdrop-filter: blur(6px);
    border: none;
    padding: 0.75rem min(15vw, 150px);
    transition: 0.15s;
    cursor: pointer;
    pointer-events: auto;
    user-select: none;
    color: var(--color-background-inversion);
    display: flex;
    font-size: 18px;
    border-radius: 30px;
    background: var(--color-x-gradient-inversion);
    box-shadow: 0 0 10px -7px var(--color-background);

    &:not(&:disabled):hover { 
      opacity: 1;
      box-shadow: 0px 0px 10px -7.5px var(--color-background);
      color: var(--color-background);
      background: var(--color-x-gradient);
      padding: 0.75rem min(17.5vw, 175px);
    }

    &.success:not(&:disabled):hover {
      background: linear-gradient(90deg, #e943a0 0%, #9d38f9 100%);
      color: #fff;
    }
    &.error:not(&:disabled):hover {
      background: linear-gradient(90deg, #19f0f0 0%, #58ffb0 100%);
      color: #222;
    }
    &.warning:not(&:disabled):hover {
      background: linear-gradient(90deg, #1e6ff7 0%, #00ffd2 100%);
      color: #fff;
    }
    &.info:not(&:disabled):hover {
      background: linear-gradient(90deg, #f2cc56 0%, #ed802f 100%);
      color: #222;
    }

    &.inactive {
      pointer-events: none;
      opacity: 0.5;
    }

    &.primary {
      /* Default style, already applied above */
    }
    &.success {
      background: linear-gradient(90deg, #43e97b 0%, #38f9d7 100%);
      color: #fff;
    }
    &.error {
      background: linear-gradient(90deg, #ff5858 0%, #db4437 100%);
      color: #fff;
    }
    &.warning {
      background: linear-gradient(90deg, #f7971e 0%, #ffd200 100%);
      color: #222;
    }
    &.info {
      background: linear-gradient(90deg, #56ccf2 0%, #2f80ed 100%);
      color: #fff;
    }
  }
</style>
