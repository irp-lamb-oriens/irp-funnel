<script lang="ts">
  /**
   * StatusLine — one consistent way to say what a group is doing right now.
   *
   *   <StatusLine state="saving" />                      → "Saving…"
   *   <StatusLine state="saved" message="Saved 2 min ago" />
   *   <StatusLine state="error" message="Couldn't load invoices." on:retry={load} />
   *
   * Announced politely to screen readers (errors assertively). `idle` renders
   * nothing, so it can sit in a header permanently.
   */
  import { createEventDispatcher } from 'svelte';

  export let state: 'idle' | 'loading' | 'saving' | 'saved' | 'error' | 'stale' = 'idle';
  export let message = '';
  /** Show a Retry button on error (dispatches `retry`). */
  export let retry = false;

  const dispatch = createEventDispatcher<{ retry: void }>();
  const DEFAULT: Record<string, string> = {
    loading: 'Loading…',
    saving: 'Saving…',
    saved: 'Saved',
    error: 'Something went wrong',
    stale: 'Out of date — refresh to update',
  };
</script>

<span
  class="irp-status irp-status--{state}"
  role={state === 'error' ? 'alert' : 'status'}
  aria-live={state === 'error' ? 'assertive' : 'polite'}
>
  {#if state !== 'idle'}
    <span class="irp-status__icon" aria-hidden="true"></span>
    <span class="irp-status__text">{message || DEFAULT[state]}</span>
    {#if state === 'error' && retry}
      <button type="button" class="irp-status__retry" on:click={() => dispatch('retry')}>Retry</button>
    {/if}
  {/if}
</span>
