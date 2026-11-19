<script lang="ts">
  /**
   * NeedsAttentionPanel.svelte — money problems that are still open.
   * ────────────────────────────────────────────────────────────────────────
   * Computed by the server from the records each time, so an item disappears
   * by itself when the problem is fixed. Items that can't fix themselves are
   * closed with "Mark as handled", which asks for a short note and writes it
   * to the permanent payment log.
   */
  import { onMount } from 'svelte';
  import { fetchNeedsAttention, resolveAttention, paymentsRefresh, selectClientById, type AttentionItem } from '../store.ts';
  import { toasts } from '../toastStore.ts';

  let items: AttentionItem[] = [];
  let loading = true;
  let error = '';
  let openKey = '';
  let note = '';
  let saving = false;
  let noteError = '';

  async function load() {
    error = '';
    try {
      items = (await fetchNeedsAttention()).items;
    } catch (e: any) {
      error = e?.message ?? 'Could not check for problems.';
    } finally {
      loading = false;
    }
  }
  onMount(load);
  let first = true;
  $: $paymentsRefresh, (first ? (first = false) : load());

  function fmt(n: number | null | undefined, currency = 'USD'): string {
    if (typeof n !== 'number') return '';
    try { return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'USD' }).format(n); }
    catch { return `${currency} ${n.toFixed(2)}`; }
  }
  function ago(iso: string | null | undefined): string {
    if (!iso) return '';
    const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
    return d <= 0 ? 'today' : d === 1 ? 'yesterday' : `${d} days ago`;
  }

  async function handled(it: AttentionItem) {
    if (note.trim().length < 5) { noteError = 'Write a short note on what was done, so others can see it later.'; return; }
    saving = true;
    noteError = '';
    try {
      await resolveAttention(it, note.trim());
      toasts.success?.('Marked as handled. The note is in the payment log.');
      openKey = '';
      note = '';
      await load();
    } catch (e: any) {
      noteError = e?.message ?? 'Could not save.';
    } finally {
      saving = false;
    }
  }
</script>

{#if loading}
  <p class="na__muted" aria-busy="true">Checking for payment problems…</p>
{:else if error}
  <p class="na__error" role="alert">{error} <button type="button" on:click={load}>Try again</button></p>
{:else if items.length === 0}
  <p class="na__clear"><span aria-hidden="true">✓</span> No payment problems need attention.</p>
{:else}
  <section class="na" aria-labelledby="na-title">
    <h3 id="na-title" class="na__title">Needs attention <span class="na__count">{items.length}</span></h3>
    <ul>
      {#each items as it (it.key)}
        <li class="na__item na__item--{it.severity}">
          <div class="na__main">
            <p class="na__head">
              <span class="na__icon" aria-hidden="true">!</span>
              <strong>{it.title}</strong>
              {#if it.amount}<span class="na__amt">{fmt(it.amount, it.currency ?? 'USD')}</span>{/if}
            </p>
            <p class="na__who">
              {#if it.consultationId}
                <button type="button" class="na__client" on:click={() => selectClientById(it.consultationId ?? '')}>{it.clientName || 'Open client'}</button>
              {/if}
              {#if it.quoteTitle}<span> · {it.quoteTitle}</span>{/if}
              {#if it.since}<span class="na__since"> · {ago(it.since)}</span>{/if}
            </p>
            <p class="na__detail">{it.detail}</p>
          </div>
          <div class="na__actions">
            {#if it.dashboardUrl}<a class="na__btn" href={it.dashboardUrl} target="_blank" rel="noopener noreferrer">Open in Stripe ↗</a>{/if}
            {#if openKey !== it.key}
              <button type="button" class="na__btn" on:click={() => { openKey = it.key; note = ''; noteError = ''; }}>Mark as handled</button>
            {/if}
          </div>
          {#if openKey === it.key}
            <div class="na__form">
              <label for="na-note-{it.key}">What was done?</label>
              <textarea id="na-note-{it.key}" rows="2" bind:value={note} placeholder="e.g. Called Jane, the second wire was a duplicate; refunded $3,500 in Stripe."></textarea>
              {#if noteError}<p class="na__error" role="alert">{noteError}</p>{/if}
              <div class="na__actions">
                <button type="button" class="na__btn" on:click={() => (openKey = '')} disabled={saving}>Cancel</button>
                <button type="button" class="na__btn na__btn--primary" on:click={() => handled(it)} disabled={saving}>{saving ? 'Saving…' : 'Save and close'}</button>
              </div>
            </div>
          {/if}
        </li>
      {/each}
    </ul>
  </section>
{/if}

<style>
  .na { border: 1px solid var(--irp-red-200); background: var(--irp-surface); border-radius: var(--irp-r-md); padding: 12px 14px; }
  .na__title { margin: 0 0 10px; display: flex; align-items: center; gap: 8px; font-size: var(--irp-fs-md); font-weight: 800; color: var(--irp-text); }
  .na__count { min-width: 22px; height: 22px; border-radius: var(--irp-r-full); background: var(--irp-red-700); color: var(--irp-text-inverse); font-size: var(--irp-fs-xs); display: inline-grid; place-items: center; padding: 0 6px; }
  .na ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
  .na__item { display: grid; grid-template-columns: 1fr auto; gap: 8px 14px; padding: 10px 12px; border-radius: var(--irp-r-md); border-left: 4px solid var(--irp-red-700); background: var(--irp-surface-3); }
  .na__item--medium { border-left-color: var(--irp-amber-600); background: var(--irp-bg); }
  .na__main { min-width: 0; }
  .na__head { margin: 0; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font-size: var(--irp-fs-md); color: var(--irp-text); }
  .na__icon { width: 18px; height: 18px; border-radius: 50%; background: var(--irp-red-700); color: var(--irp-text-inverse); font-size: var(--irp-fs-xs); font-weight: 900; display: inline-grid; place-items: center; }
  .na__item--medium .na__icon { background: var(--irp-amber-600); }
  .na__amt { font-weight: 800; font-variant-numeric: tabular-nums; }
  .na__who { margin: 2px 0 0; font-size: var(--irp-fs-sm); color: var(--irp-text-muted); }
  .na__since { color: var(--irp-text-dim); }
  .na__client { background: none; border: 0; padding: 0; font: inherit; font-weight: 700; color: var(--irp-text); text-decoration: underline; text-underline-offset: 3px; cursor: pointer; }
  .na__detail { margin: 4px 0 0; font-size: var(--irp-fs-sm); line-height: 1.5; color: var(--irp-text-2); }
  .na__actions { display: flex; gap: 6px; align-items: flex-start; flex-wrap: wrap; justify-content: flex-end; }
  .na__btn { min-height: 32px; padding: 0 12px; border-radius: var(--irp-r-sm); border: 1px solid var(--irp-line-strong); background: var(--irp-surface); font: inherit; font-size: var(--irp-fs-xs); font-weight: 700; color: var(--irp-text); cursor: pointer; text-decoration: none; display: inline-flex; align-items: center; white-space: nowrap; }
  .na__btn--primary { background: var(--irp-teal-700); border-color: var(--irp-teal-700); color: var(--irp-text-inverse); }
  .na__btn:focus-visible, .na__client:focus-visible { outline: 2px solid var(--irp-teal-700); outline-offset: 2px; }
  .na__btn:disabled { opacity: 0.6; cursor: wait; }
  .na__form { grid-column: 1 / -1; display: grid; gap: 6px; }
  .na__form label { font-size: var(--irp-fs-xs); font-weight: 700; color: var(--irp-text-2); }
  .na__form textarea { font: inherit; font-size: var(--irp-fs-sm); padding: 8px 10px; border: 1px solid var(--irp-line-strong); border-radius: var(--irp-r-sm); resize: vertical; }
  .na__form textarea:focus { outline: 2px solid var(--irp-teal-700); border-color: var(--irp-teal-700); }
  .na__muted { margin: 0; font-size: var(--irp-fs-sm); color: var(--irp-text-dim); }
  .na__clear { margin: 0; font-size: var(--irp-fs-sm); color: var(--irp-green-800); background: var(--irp-surface-2); border: 1px solid var(--irp-green-200); border-radius: var(--irp-r-md); padding: 8px 12px; }
  .na__error { margin: 0; color: var(--irp-red-700); font-size: var(--irp-fs-sm); }
  @media (max-width: 720px) { .na__item { grid-template-columns: 1fr; } .na__actions { justify-content: flex-start; } }
</style>
