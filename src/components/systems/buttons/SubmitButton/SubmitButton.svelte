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
    {label.replace(/_/g, "⠀")}
  {/if}
</button>

<style lang="scss">
  .submit-button {
    backdrop-filter: blur(6px);
    border: none;
    padding: 0.75rem min(10vw, 100px);
    transition: all 0.3s cubic-bezier(0.23, 1, 0.32, 1);
    cursor: pointer;
    pointer-events: auto;
    user-select: none;
    color: var(--color-background-inversion);
    display: flex;
    font-size: 18px;
    background: var(--color-x-gradient-inversion);
    box-shadow: 0 0 10px -7px var(--color-background);
    position: relative;
    overflow: hidden;
    justify-content: center;
    align-items: center;

    &:not(&:disabled):hover { 
      opacity: 1;
      box-shadow: 0px 0px 10px -7.5px var(--color-background);
      color: var(--color-background);
      background: var(--color-x-gradient);
      padding: 0.75rem min(12.5vw, 125px);
      box-shadow: inset 0 0 0 1px var(--color-background);
    }

    &.loading {
      pointer-events: none;
      cursor: wait;
      padding: 0.75rem min(5vw, 50px) !important;
      
      .ultra-modern-loader {
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 1.8rem;
        height: 1.8rem;

        .magnetic-orb {
          position: relative;
          width: 8px;
          height: 8px;
          background: #ffffff;
          border-radius: 50%;
          z-index: 2;
          box-shadow: 
            0 0 15px #ffffff,
            0 0 30px rgba(255, 255, 255, 0.5);
          
          .inner-core {
            position: absolute;
            inset: 1.5px;
            background: var(--color-highlight-2);
            border-radius: 50%;
            filter: brightness(1.2);
            animation: corePulse 0.8s ease-in-out infinite alternate;
          }

          .pulse-ring {
            position: absolute;
            inset: -8px;
            border: 1px solid rgba(255, 255, 255, 0.3);
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
          border-right: 2px solid rgba(255, 255, 255, 0.4);
          filter: drop-shadow(0 0 3px rgba(255, 255, 255, 0.8));
          animation: ultraSpin 0.6s linear infinite;
        }

        .particle-field {
          position: absolute;
          inset: -4px;
          
          .particle {
            position: absolute;
            width: 1.5px;
            height: 1.5px;
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
      100% { transform: rotate(var(--rot)) translateY(-15px); opacity: 0; }
    }

    &.success:not(&:disabled):hover {
      background: linear-gradient(90deg, #e943a0 0%, #9d38f9 100%);
      color: #fff;
    }
    &.error:not(&:disabled):hover {
      background: linear-gradient(90deg, #02b6bc 0%, #2ea3f2 100%);
      color: #222;
      box-shadow: inset 0 0 0 1px var(--color-foreground);
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
      background: linear-gradient(90deg, #c62326 0%, #db4437 100%);
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
