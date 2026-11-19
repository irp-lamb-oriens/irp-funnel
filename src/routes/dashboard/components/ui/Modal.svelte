<!--
  ui/Modal.svelte — shared overlay + card shell.

  Usage:
    <Modal open={showForm} on:close={handleClose} title="New Provider" size="md">
      <p>Body content here.</p>
      <svelte:fragment slot="footer">
        <button on:click={handleClose}>Cancel</button>
        <button on:click={handleSave}>Save</button>
      </svelte:fragment>
    </Modal>

  Props:
    open       boolean   Show/hide the modal (two-way bindable).
    title      string    Header text. Omit for a header-less modal.
    size       'sm'|'md'|'lg'|'xl'|'full'  Max-width preset. Default 'md'.
    closable   boolean   Show the X button + allow overlay click-to-close. Default true.

  Slots:
    default    Modal body.
    header     Override the entire header row.
    footer     Sticky footer row (buttons, alerts, etc.).

  Events:
    close      Fired when the user dismisses (overlay click, X, or Escape).
-->
<script lang="ts">
  import { createEventDispatcher, onMount, onDestroy } from 'svelte';
  import { fade, fly } from 'svelte/transition';

  export let open = false;
  export let title = '';
  export let size: 'sm' | 'md' | 'lg' | 'xl' | 'full' = 'md';
  export let closable = true;

  const dispatch = createEventDispatcher<{ close: void }>();

  function requestClose() {
    if (!closable) return;
    dispatch('close');
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' && open) requestClose();
  }

  onMount(() => {
    if (typeof window !== 'undefined') window.addEventListener('keydown', onKeydown);
  });
  onDestroy(() => {
    if (typeof window !== 'undefined') window.removeEventListener('keydown', onKeydown);
  });

  // Lock body scroll while open
  $: if (typeof document !== 'undefined') {
    document.body.style.overflow = open ? 'hidden' : '';
  }
</script>

{#if open}
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <div
    class="irp-modal-overlay"
    role="presentation"
    on:click|self={requestClose}
    transition:fade={{ duration: 160 }}
  >
    <div
      class="irp-modal irp-modal--{size}"
      role="dialog"
      aria-modal="true"
      aria-label={title || 'Dialog'}
      transition:fly={{ y: 24, duration: 200 }}
    >
      <!-- Header -->
      <slot name="header">
        {#if title || closable}
          <header class="irp-modal__header">
            {#if title}<h3 class="irp-modal__title">{title}</h3>{/if}
            {#if closable}
              <button class="irp-modal__close" on:click={requestClose} aria-label="Close">✕</button>
            {/if}
          </header>
        {/if}
      </slot>

      <!-- Body -->
      <div class="irp-modal__body">
        <slot />
      </div>

      <!-- Footer -->
      <slot name="footer" />
    </div>
  </div>
{/if}

<style>
  /* ── Overlay ─────────────────────────────────────────────────────────── */
  .irp-modal-overlay {
    position: fixed;
    inset: 0;
    z-index: 1000;
    background: rgba(6, 13, 13, 0.55);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding: 40px 16px;
    overflow-y: auto;
  }

  /* ── Card ─────────────────────────────────────────────────────────────── */
  .irp-modal {
    background: var(--irp-surface);
    border: 1px solid var(--irp-border);
    border-radius: var(--irp-r-xl);
    width: 100%;
    margin: auto;
    max-height: calc(100vh - 80px);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: 0 24px 70px rgba(6, 13, 13, 0.30);
  }

  .irp-modal--sm  { max-width: 420px; }
  .irp-modal--md  { max-width: 600px; }
  .irp-modal--lg  { max-width: 800px; }
  .irp-modal--xl  { max-width: 1040px; }
  .irp-modal--full { max-width: calc(100vw - 32px); }

  /* ── Header ──────────────────────────────────────────────────────────── */
  .irp-modal__header {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 20px 24px;
    border-bottom: 1px solid var(--irp-border);
    flex-shrink: 0;
    background: linear-gradient(180deg, var(--irp-bg) 0%, var(--irp-surface) 100%);
  }
  /* Brand accent bar, matching the existing provider modal. */
  .irp-modal__header::before {
    content: "";
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 4px;
    background: linear-gradient(180deg, var(--irp-accent) 0%, var(--irp-teal-900) 100%);
  }

  .irp-modal__title {
    margin: 0;
    font-size: var(--irp-fs-xl);
    font-weight: 700;
    color: var(--irp-text);
    line-height: 1.3;
  }

  .irp-modal__close {
    background: var(--irp-surface-3);
    border: none;
    width: 32px;
    height: 32px;
    border-radius: var(--irp-r-sm);
    color: var(--irp-text-muted);
    font-size: var(--irp-fs-lg);
    cursor: pointer;
    flex-shrink: 0;
    transition: background 0.12s, color 0.12s;
    line-height: 1;
  }
  .irp-modal__close:hover {
    background: var(--irp-surface-4);
    color: var(--irp-text);
  }

  /* ── Body ─────────────────────────────────────────────────────────────── */
  .irp-modal__body {
    flex: 1 1 auto;
    overflow-y: auto;
    padding: 24px;
  }

  /* ── Footer (slot) ───────────────────────────────────────────────────── */
  :global(.irp-modal__footer) {
    padding: 16px 24px;
    border-top: 1px solid var(--irp-border);
    background: var(--irp-bg);
    display: flex;
    flex-direction: column;
    gap: 10px;
    flex-shrink: 0;
  }
  :global(.irp-modal__footer-actions) {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
  }
</style>
