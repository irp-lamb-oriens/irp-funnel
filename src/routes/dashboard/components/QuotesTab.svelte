<script lang="ts">
  import { onMount } from 'svelte';
  import { writable } from 'svelte/store';
  import {
    fetchQuotes,
    deleteQuote,
    QUOTE_STATUS_LABEL,
  } from '../store.ts';
  import type { Quote } from '../store.ts';
  import QuoteEditor from './QuoteEditor.svelte';

  export let clientId: string;

  // ── State ──────────────────────────────────────────────────────────────────
  const quotes = writable<Quote[]>([]);
  let loading = true;
  let error = '';
  let showEditor = false;
  let editingQuoteId: string | null = null;

  // ── Load quotes ────────────────────────────────────────────────────────────
  async function loadQuotes() {
    loading = true;
    error = '';
    try {
      const result = await fetchQuotes(clientId);
      quotes.set(result);
    } catch (err: any) {
      error = err?.message ?? 'Error loading quotes';
    } finally {
      loading = false;
    }
  }

  onMount(() => { loadQuotes(); });

  // ── Actions ────────────────────────────────────────────────────────────────
  function openNewQuote() {
    editingQuoteId = null;
    showEditor = true;
  }

  function openEdit(quoteId: string) {
    editingQuoteId = quoteId;
    showEditor = true;
  }

  async function handleDelete(quote: Quote) {
    if (!confirm(`Delete quote "${quote.title}"? This action cannot be undone.`)) return;
    try {
      await deleteQuote(clientId, quote.quoteId);
      await loadQuotes();
    } catch (err: any) {
      alert('Error deleting: ' + (err?.message ?? err));
    }
  }

  function handleEditorSaved() {
    showEditor = false;
    editingQuoteId = null;
    loadQuotes();
  }

  function handleEditorCancelled() {
    showEditor = false;
    editingQuoteId = null;
  }

  // ── Portal URL helper ─────────────────────────────────────────────────────
  const STATUS_BASE = 'https://internationalrelocationpartner.com/status';

  function portalUrl(token: string | null): string {
    const base = `${STATUS_BASE}/${clientId}`;
    return token ? `${base}?quoteToken=${token}` : base;
  }

  function copyPortalUrl(token: string | null): void {
    const url = portalUrl(token);
    navigator.clipboard?.writeText(url).catch(() => {});
  }

  // ── Formatting helpers ─────────────────────────────────────────────────────
  function formatTotal(quote: Quote): string {
    const total = quote.total ?? quote.lineItems?.reduce((s, li) => s + (li.amount ?? 0), 0) ?? 0;
    return '$' + total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' USD';
  }

  function formatDate(iso: string): string {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch { return iso; }
  }
</script>

<div class="quotes-tab">
  {#if showEditor}
    <QuoteEditor
      {clientId}
      quoteId={editingQuoteId}
      on:saved={handleEditorSaved}
      on:cancelled={handleEditorCancelled}
    />
  {:else}
    <div class="quotes-tab__toolbar">
      <h3 class="quotes-tab__heading">Quotes</h3>
      <button class="quotes-tab__new-btn" on:click={openNewQuote}>
        New Quote +
      </button>
    </div>

    {#if loading}
      <div class="quotes-tab__loading">
        <div class="quotes-tab__spinner"></div>
        <span>Loading quotes…</span>
      </div>
    {:else if error}
      <div class="quotes-tab__error">
        ⚠️ {error}
        <button class="quotes-tab__retry" on:click={loadQuotes}>Retry</button>
      </div>
    {:else if $quotes.length === 0}
      <div class="quotes-tab__empty">
        <span class="quotes-tab__empty-icon">💰</span>
        <p class="quotes-tab__empty-title">No quotes yet</p>
        <p class="quotes-tab__empty-desc">Create the first quote for this client.</p>
      </div>
    {:else}
      <ul class="quotes-tab__list">
        {#each $quotes as quote (quote.quoteId)}
          <!-- svelte-ignore a11y-click-events-have-key-events -->
          <!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
          <li class="quotes-tab__item" on:click={() => openEdit(quote.quoteId)} role="button" tabindex="0">
            <div class="quotes-tab__item-main">
              <span class="quotes-tab__item-title">{quote.title || 'Untitled'}</span>
              <span
                class="quotes-tab__status-badge"
                style="background: {QUOTE_STATUS_LABEL[quote.status]?.color ?? '#64748b'}22; color: {QUOTE_STATUS_LABEL[quote.status]?.color ?? '#64748b'}; border-color: {QUOTE_STATUS_LABEL[quote.status]?.color ?? '#64748b'}44;"
              >
                {QUOTE_STATUS_LABEL[quote.status]?.label ?? quote.status}
              </span>
            </div>
            <div class="quotes-tab__item-meta">
              <span class="quotes-tab__item-total">{formatTotal(quote)}</span>
              <span class="quotes-tab__item-lines">{(quote.lineItems ?? []).length} line item{(quote.lineItems ?? []).length !== 1 ? 's' : ''}</span>
              <span class="quotes-tab__item-date">{formatDate(quote.createdAt)}</span>
            </div>
            <!-- Portal link — permanently visible on sent/accepted quotes ── -->
            {#if quote.status === 'sent_to_client' || quote.status === 'client_accepted'}
              <!-- svelte-ignore a11y-click-events-have-key-events -->
              <div class="quotes-tab__portal-row" on:click|stopPropagation>
                <svg class="quotes-tab__portal-icon" xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>
                <a
                  href={portalUrl(quote.clientToken ?? null)}
                  target="_blank"
                  rel="noopener noreferrer"
                  class="quotes-tab__portal-link"
                  title="Open client portal"
                  on:click|stopPropagation
                >
                  internationalrelocationpartner.com/status/{clientId}
                </a>
                <button
                  class="quotes-tab__copy-btn"
                  title="Copy portal link"
                  on:click|stopPropagation={() => copyPortalUrl(quote.clientToken ?? null)}
                  aria-label="Copy link"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                </button>
              </div>
            {/if}

            <div class="quotes-tab__item-actions">
              <button
                class="quotes-tab__action-btn quotes-tab__action-btn--edit"
                title="Edit quote"
                on:click|stopPropagation={() => openEdit(quote.quoteId)}
              >✏️</button>
              <button
                class="quotes-tab__action-btn quotes-tab__action-btn--delete"
                title="Delete quote"
                on:click|stopPropagation={() => handleDelete(quote)}
              >🗑️</button>
            </div>
          </li>
        {/each}
      </ul>
    {/if}
  {/if}
</div>

<style>
  /* ── QuotesTab — Premium Light Theme ──────────────────────────────────── */
  .quotes-tab {
    display: flex;
    flex-direction: column;
    gap: 0;
    padding: 20px 24px 24px;
    background: #f8fafc;
    min-height: 200px;
    font-feature-settings: 'cv02','cv03','cv04','cv11';
  }

  /* ── Toolbar ──────────────────────────────────────────────────────────── */
  .quotes-tab__toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 16px;
    gap: 0.5rem;
  }

  .quotes-tab__heading {
    margin: 0;
    font-size: 15px;
    font-weight: 700;
    color: #0f172a;
    letter-spacing: -0.01em;
  }

  .quotes-tab__new-btn {
    background: linear-gradient(135deg, #02b5bb 0%, #0a8a8e 100%);
    color: #fff;
    border: none;
    border-radius: 999px;
    padding: 7px 16px;
    font-size: 12.5px;
    font-weight: 700;
    cursor: pointer;
    transition: box-shadow 0.18s, transform 0.18s, filter 0.18s;
    white-space: nowrap;
    letter-spacing: 0.01em;
    box-shadow: 0 2px 8px rgba(2,181,187,0.28);
  }
  .quotes-tab__new-btn:hover {
    filter: brightness(1.07);
    box-shadow: 0 4px 16px rgba(2,181,187,0.38);
    transform: translateY(-1px);
  }
  .quotes-tab__new-btn:active { transform: translateY(0); filter: brightness(0.97); }

  /* ── Loading ──────────────────────────────────────────────────────────── */
  .quotes-tab__loading {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 28px 0;
    color: #94a3b8;
    font-size: 13.5px;
    justify-content: center;
  }

  .quotes-tab__spinner {
    width: 18px;
    height: 18px;
    border: 2px solid #e2e8f0;
    border-top-color: #02b5bb;
    border-radius: 50%;
    animation: qt-spin 0.7s linear infinite;
    flex-shrink: 0;
  }
  @keyframes qt-spin { to { transform: rotate(360deg); } }

  /* ── Error ────────────────────────────────────────────────────────────── */
  .quotes-tab__error {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 16px;
    background: #fef2f2;
    border: 1px solid #fecaca;
    border-radius: 10px;
    color: #dc2626;
    font-size: 13px;
  }

  .quotes-tab__retry {
    background: #fff;
    border: 1px solid #fca5a5;
    color: #dc2626;
    border-radius: 6px;
    padding: 3px 10px;
    font-size: 11.5px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.14s;
    margin-left: auto;
    flex-shrink: 0;
  }
  .quotes-tab__retry:hover { background: #fef2f2; }

  /* ── Empty state ──────────────────────────────────────────────────────── */
  .quotes-tab__empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 36px 16px;
    gap: 5px;
    text-align: center;
  }
  .quotes-tab__empty-icon {
    font-size: 2.25rem;
    margin-bottom: 6px;
    filter: grayscale(0.15);
  }
  .quotes-tab__empty-title {
    font-weight: 700;
    font-size: 14.5px;
    color: #0f172a;
    margin: 0;
  }
  .quotes-tab__empty-desc {
    color: #94a3b8;
    font-size: 12.5px;
    margin: 0;
  }

  /* ── List ─────────────────────────────────────────────────────────────── */
  .quotes-tab__list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  /* ── Quote item card ──────────────────────────────────────────────────── */
  .quotes-tab__item {
    display: flex;
    flex-direction: column;
    gap: 5px;
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    padding: 13px 16px 11px;
    cursor: pointer;
    transition: box-shadow 0.18s, transform 0.18s, border-color 0.18s;
    position: relative;
    box-shadow: 0 1px 3px rgba(0,0,0,0.06), 0 1px 8px rgba(0,0,0,0.04);
  }
  .quotes-tab__item:hover {
    border-color: #9fe3e6;
    box-shadow: 0 4px 16px rgba(2,181,187,0.10), 0 1px 4px rgba(0,0,0,0.06);
    transform: translateY(-1px);
  }
  .quotes-tab__item:focus-visible {
    outline: 2px solid #02b5bb;
    outline-offset: 2px;
  }

  /* ── Item main row ────────────────────────────────────────────────────── */
  .quotes-tab__item-main {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    padding-right: 64px; /* make room for action buttons */
  }

  .quotes-tab__item-title {
    font-weight: 700;
    font-size: 14px;
    color: #0f172a;
    flex: 1;
    min-width: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    letter-spacing: -0.01em;
  }

  /* ── Status badge ─────────────────────────────────────────────────────── */
  .quotes-tab__status-badge {
    font-size: 10.5px;
    font-weight: 700;
    padding: 2px 9px;
    border-radius: 999px;
    border: 1px solid;
    white-space: nowrap;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    line-height: 1.5;
  }

  /* ── Item meta row ────────────────────────────────────────────────────── */
  .quotes-tab__item-meta {
    display: flex;
    gap: 10px;
    font-size: 12px;
    color: #94a3b8;
    flex-wrap: wrap;
    align-items: center;
  }
  .quotes-tab__item-meta > span + span {
    padding-left: 10px;
    border-left: 1px solid #e2e8f0;
  }

  .quotes-tab__item-total {
    font-weight: 700;
    font-size: 13px;
    color: #0f172a;
    font-variant-numeric: tabular-nums;
  }

  .quotes-tab__item-lines {
    color: #94a3b8;
  }

  .quotes-tab__item-date {
    color: #94a3b8;
  }

  /* ── Action buttons ───────────────────────────────────────────────────── */
  .quotes-tab__item-actions {
    position: absolute;
    top: 23px;
    right: 14px;
    transform: translateY(-50%);
    display: flex;
    gap: 4px;
    opacity: 0;
    transition: opacity 0.16s;
  }
  .quotes-tab__item:hover .quotes-tab__item-actions { opacity: 1; }

  .quotes-tab__action-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    background: #f1f5f9;
    border: 1px solid #e2e8f0;
    border-radius: 7px;
    cursor: pointer;
    font-size: 13px;
    line-height: 1;
    transition: background 0.14s, border-color 0.14s, transform 0.14s;
    color: #64748b;
  }
  .quotes-tab__action-btn:hover {
    background: #e2e8f0;
    border-color: #cbd5e1;
    transform: scale(1.08);
  }
  .quotes-tab__action-btn--delete:hover {
    background: #fef2f2;
    border-color: #fecaca;
    color: #dc2626;
  }

  /* ── Portal link row (sent_to_client / client_accepted) ──────────────── */
  .quotes-tab__portal-row {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 5px 10px;
    background: #f0fdfc;
    border: 1px solid #99f6e4;
    border-radius: 7px;
    margin-top: 2px;
  }

  .quotes-tab__portal-icon {
    color: #0d9488;
    flex-shrink: 0;
  }

  .quotes-tab__portal-link {
    font-size: 11px;
    font-weight: 600;
    color: #0d9488;
    text-decoration: none;
    flex: 1;
    min-width: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    letter-spacing: 0.01em;
    transition: color 0.14s;
  }
  .quotes-tab__portal-link:hover {
    color: #0f766e;
    text-decoration: underline;
  }

  .quotes-tab__copy-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    background: transparent;
    border: 1px solid #99f6e4;
    border-radius: 5px;
    cursor: pointer;
    color: #0d9488;
    flex-shrink: 0;
    transition: background 0.14s, border-color 0.14s, transform 0.14s;
    padding: 0;
  }
  .quotes-tab__copy-btn:hover {
    background: #ccfbf1;
    border-color: #5eead4;
    transform: scale(1.1);
  }
  .quotes-tab__copy-btn:active {
    transform: scale(0.96);
  }
</style>
