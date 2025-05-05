<script lang="ts">
  import type { MouseEventHandler } from "svelte/elements";

  // Props for the glassmorphic submit button
  export let disabled: boolean = false;
  export let loading: boolean = false;
  export let active: boolean = true;
  export let label: string = "Submit";
  export let callback: MouseEventHandler<HTMLButtonElement> = () => {};
</script>

<button
  {disabled}
  class="submit-button {active ? 'active' : 'inactive'}"
  on:click={callback}
  class:loading
>
  {label}
</button>

<style lang="scss">
  .submit-button {
    backdrop-filter: blur(6px);
    border: none;
    padding: 0.75rem 1.5rem;
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
      padding: 0.75rem 1.75rem;
    }

    &.inactive {
      pointer-events: none;
      opacity: 0.5;
    }
  }
</style>
