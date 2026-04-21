<script lang="ts">
  import { toasts } from '../toastStore.ts';
  import { fly, fade } from 'svelte/transition';
</script>

{#if $toasts.length > 0}
  <div class="toast-container">
    {#each $toasts as toast (toast.id)}
      <!-- svelte-ignore a11y-click-events-have-key-events -->
      <!-- svelte-ignore a11y-no-static-element-interactions -->
      <div
        class="toast toast--{toast.type}"
        in:fly={{ x: 320, duration: 350, opacity: 0 }}
        out:fade={{ duration: 250 }}
        on:click={() => toasts.dismiss(toast.id)}
      >
        <span class="toast__icon">
          {#if toast.type === 'success'}✓{:else if toast.type === 'error'}✕{:else}ℹ{/if}
        </span>
        <span class="toast__message">{toast.message}</span>
        <button class="toast__close" on:click|stopPropagation={() => toasts.dismiss(toast.id)}>×</button>
      </div>
    {/each}
  </div>
{/if}

<style>
  .toast-container {
    position: fixed;
    bottom: 24px;
    right: 24px;
    z-index: 10000;
    display: flex;
    flex-direction: column-reverse;
    gap: 10px;
    max-width: 420px;
    pointer-events: none;
  }

  .toast {
    pointer-events: all;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 18px;
    border-radius: 14px;
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.18), 0 2px 8px rgba(0, 0, 0, 0.08);
    cursor: pointer;
    font-family: var(--font-paragraph, 'Jost', sans-serif);
    font-size: 14px;
    line-height: 1.4;
    border: 1px solid rgba(255, 255, 255, 0.15);
    transition: transform 0.2s ease, opacity 0.2s ease;
  }

  .toast:hover {
    transform: translateX(-4px);
  }

  .toast--success {
    background: linear-gradient(135deg, rgba(2, 181, 187, 0.92), rgba(5, 150, 105, 0.92));
    color: white;
  }

  .toast--error {
    background: linear-gradient(135deg, rgba(198, 36, 38, 0.92), rgba(220, 38, 38, 0.92));
    color: white;
  }

  .toast--info {
    background: linear-gradient(135deg, rgba(99, 102, 241, 0.92), rgba(129, 140, 248, 0.92));
    color: white;
  }

  .toast__icon {
    flex-shrink: 0;
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.2);
    font-weight: 700;
    font-size: 14px;
  }

  .toast__message {
    flex: 1;
    font-weight: 500;
  }

  .toast__close {
    flex-shrink: 0;
    background: none;
    border: none;
    color: rgba(255, 255, 255, 0.7);
    font-size: 20px;
    cursor: pointer;
    padding: 0 2px;
    line-height: 1;
    transition: color 0.15s;
  }

  .toast__close:hover {
    color: white;
  }
</style>
