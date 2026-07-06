<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { writable, get } from 'svelte/store';
  import {
    fetchQuotes,
    deleteQuote,
    QUOTE_STATUS_LABEL,
    fetchQuoteTemplates,
    inferClientTemplate,
    selectedClient,
    type QuoteTemplate,
    type InferTemplateResult,
  } from '../store.ts';
  import type { Quote } from '../store.ts';
  import QuoteEditor from './QuoteEditor.svelte';
  import PricingRequestsPanel from './PricingRequestsPanel.svelte';
  import Select, { type SelectOption } from './ui/Select.svelte';


  export let clientId: string;

  // ── State ──────────────────────────────────────────────────────────────────
  const quotes = writable<Quote[]>([]);
  let loading = true;
  let error = '';
  let showEditor = false;
  let editingQuoteId: string | null = null;

  // Remember whether the editor was open (and on which quote) per client so
  // switching Detail-Panel tabs and coming back doesn't drop an in-progress
  // quote. Pairs with QuoteEditor's own localStorage draft persistence.
  $: tabStateKey = `irp:quotes-tab:${clientId}`;
  let tabStateReady = false; // avoids persisting during the initial restore
  function persistTabState() {
    if (!browser || !tabStateReady) return;
    try {
      localStorage.setItem(tabStateKey, JSON.stringify({ showEditor, editingQuoteId }));
    } catch { /* storage unavailable — non-fatal */ }
  }
  $: tabState = [showEditor, editingQuoteId];
  $: if (tabStateReady && tabState) persistTabState();

  // ── Per-client proposal template selector ──────────────────────────────────
  let templates: QuoteTemplate[] = [];
  let templatesLoading = true;
  let selectedTemplateId = '';
  let templateSource: InferTemplateResult['source'] | null = null;
  let resolvingTemplate = false;

  $: templateOptions = templates.map((t): SelectOption => ({
    value: t.templateId,
    label: t.name,
    description: t.category ?? (t.isDefault ? 'Default proposal document' : null),
    badge: t.isDefault ? 'Default' : null,
  }));

  $: sourceBadge = (() => {
    switch (templateSource) {
      case 'manual':  return { text: '✏️ Manual',  cls: 'is-manual'  };
      case 'map':     return { text: '🗺️ Mapped',  cls: 'is-auto'    };
      case 'rules':   return { text: '🤖 Auto',    cls: 'is-auto'    };
      case 'llm':     return { text: '🤖 AI',      cls: 'is-auto'    };
      case 'default': return { text: '◇ Default',  cls: 'is-default' };
      default:        return null;
    }
  })();

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

  // ── Load templates + resolve this client's selection ───────────────────────
  async function loadTemplateSelection() {
    templatesLoading = true;
    try {
      templates = await fetchQuoteTemplates();
      const current = get(selectedClient);
      const existing =
        (current?.selectedQuoteTemplateId as string | undefined) ??
        (current?.rawDoc?.selectedQuoteTemplateId as string | undefined) ??
        '';
      const existingSource =
        (current?.selectedQuoteTemplateSource as 'manual' | 'auto' | null | undefined) ??
        (current?.rawDoc?.selectedQuoteTemplateSource as 'manual' | 'auto' | null | undefined) ??
        null;

      if (existing && existingSource === 'manual') {
        // Respect a deliberate manual override — never auto-overwrite it.
        selectedTemplateId = existing;
        templateSource = 'manual';
      } else {
        // No selection yet, OR a previous AUTO/legacy pick → re-resolve from the
        // live destination → template mapping so the default always tracks the
        // client's current destination + the latest rules. This fixes stale auto
        // picks (e.g. a Panama client still showing an old Costa Rica template).
        await autoResolveTemplate();
      }

    } catch {
      /* non-fatal — the selector just stays empty */
    } finally {
      templatesLoading = false;
    }
  }

  /** Re-run the AI/mapping auto-selector (destination → template). */
  async function autoResolveTemplate() {
    resolvingTemplate = true;
    try {
      const res = await inferClientTemplate(clientId);
      selectedTemplateId = res.templateId;
      templateSource = res.source;
    } catch {
      /* keep current selection */
    } finally {
      resolvingTemplate = false;
    }
  }

  /** Staff manually overrode the template for this client. */
  async function handleTemplateChange(e: CustomEvent<{ value: string }>) {
    const newId = e.detail.value;
    if (!newId || newId === selectedTemplateId) return;
    const prev = selectedTemplateId;
    selectedTemplateId = newId;
    templateSource = 'manual';
    try {
      await inferClientTemplate(clientId, newId);
    } catch (err: any) {
      selectedTemplateId = prev; // revert on failure
      templateSource = null;
      alert('Could not save template selection: ' + (err?.message ?? err));
    }
  }

  onMount(() => {
    // Restore whether the editor was open for THIS client (survives tab switch).
    if (browser) {
      try {
        const raw = localStorage.getItem(tabStateKey);
        if (raw) {
          const s = JSON.parse(raw);
          if (s && typeof s.showEditor === 'boolean') {
            showEditor = s.showEditor;
            editingQuoteId = typeof s.editingQuoteId === 'string' ? s.editingQuoteId : null;
          }
        }
      } catch { /* ignore malformed state */ }
    }
    tabStateReady = true;
    loadQuotes();
    loadTemplateSelection();
  });


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
    <!-- ── Pricing Requests — authored here, precede quote creation ─────── -->
    <PricingRequestsPanel {clientId} />


    <!-- ── Per-client proposal template selector (outside the quote list, ──
         inside the quoting step). Decides which proposal document this
         specific client is shown; defaults from the destination mapping. -->
    <div class="qt-template">

      <div class="qt-template__head">
        <div class="qt-template__title">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <line x1="16" y1="13" x2="8" y2="13"></line>
            <line x1="16" y1="17" x2="8" y2="17"></line>
            <polyline points="10 9 9 9 8 9"></polyline>
          </svg>
          <span>Proposal template</span>
        </div>
        {#if sourceBadge}
          <span class="qt-template__source {sourceBadge.cls}">{sourceBadge.text}</span>
        {/if}
      </div>

      <div class="qt-template__row">
        {#if templatesLoading}
          <div class="qt-template__loading">
            <span class="qt-template__dot"></span>
            <span>Loading templates…</span>
          </div>
        {:else}
          <div class="qt-template__select">
            <Select
              options={templateOptions}
              value={selectedTemplateId}
              placeholder="Choose the template this client sees…"
              searchable={templateOptions.length > 6}
              ariaLabel="Proposal template for this client"
              disabled={resolvingTemplate}
              on:change={handleTemplateChange}
            />
          </div>
          <button
            class="qt-template__redetect"
            class:is-busy={resolvingTemplate}
            title="Re-detect from the destination → template mapping"
            aria-label="Re-detect template"
            on:click={autoResolveTemplate}
            disabled={resolvingTemplate}
          >
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <polyline points="23 4 23 10 17 10"></polyline>
              <polyline points="1 20 1 14 7 14"></polyline>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
            </svg>
          </button>
        {/if}
      </div>

      <p class="qt-template__hint">
        Shown to this client inside their proposal. Defaults from the destination → template mapping; override anytime.
      </p>
    </div>

    <div class="quotes-tab__toolbar">
      <h3 class="quotes-tab__heading">Quotes</h3>
      <button class="quotes-tab__new-btn" on:click={openNewQuote}>
        New Quote +
      </button>
    </div>

    <!-- ── Inline quote editor — opens in place (above the list), instead of
         replacing the whole tab. Cancel/Save collapse it back to the list. ── -->
    {#if showEditor}
      <div class="quotes-tab__editor-inline">
        <QuoteEditor
          {clientId}
          quoteId={editingQuoteId}
          on:saved={handleEditorSaved}
          on:cancelled={handleEditorCancelled}
        />
      </div>
    {/if}

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
    {:else if $quotes.length === 0 && !showEditor}
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

  /* ── Proposal template selector card ──────────────────────────────────── */
  .qt-template {
    background: linear-gradient(180deg, #ffffff 0%, #fbfdfe 100%);
    border: 1px solid #e2e8f0;
    border-radius: 14px;
    padding: 14px 16px 12px;
    margin-bottom: 16px;
    box-shadow: 0 1px 3px rgba(15,23,42,0.05), 0 1px 10px rgba(2,181,187,0.04);
  }

  .qt-template__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 10px;
  }

  .qt-template__title {
    display: flex;
    align-items: center;
    gap: 7px;
    font-size: 12px;
    font-weight: 800;
    color: #0f172a;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
  .qt-template__title svg { color: #02b6bc; flex-shrink: 0; }

  .qt-template__source {
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.03em;
    padding: 2px 10px;
    border-radius: 999px;
    border: 1px solid transparent;
    white-space: nowrap;
    line-height: 1.6;
  }
  .qt-template__source.is-auto {
    color: #0d9488;
    background: rgba(2,182,188,0.1);
    border-color: rgba(2,182,188,0.24);
  }
  .qt-template__source.is-manual {
    color: #7c3aed;
    background: rgba(124,58,237,0.09);
    border-color: rgba(124,58,237,0.22);
  }
  .qt-template__source.is-default {
    color: #64748b;
    background: #f1f5f9;
    border-color: #e2e8f0;
  }

  .qt-template__row {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .qt-template__select { flex: 1; min-width: 0; }

  .qt-template__redetect {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 38px;
    height: 38px;
    flex-shrink: 0;
    background: #f1f5f9;
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    color: #475569;
    cursor: pointer;
    transition: background 0.14s, border-color 0.14s, color 0.14s, transform 0.14s;
  }
  .qt-template__redetect:hover:not(:disabled) {
    background: #f0fdfe;
    border-color: rgba(2,182,188,0.35);
    color: #02b6bc;
    transform: translateY(-1px);
  }
  .qt-template__redetect:disabled { opacity: 0.6; cursor: not-allowed; }
  .qt-template__redetect.is-busy svg { animation: qt-spin 0.7s linear infinite; }

  .qt-template__loading {
    display: flex;
    align-items: center;
    gap: 8px;
    color: #94a3b8;
    font-size: 12.5px;
    padding: 10px 2px;
  }
  .qt-template__dot {
    width: 14px;
    height: 14px;
    border: 2px solid #e2e8f0;
    border-top-color: #02b5bb;
    border-radius: 50%;
    animation: qt-spin 0.7s linear infinite;
    flex-shrink: 0;
  }

  .qt-template__hint {
    margin: 8px 0 0;
    font-size: 11px;
    line-height: 1.5;
    color: #94a3b8;
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

  /* ── Inline quote editor wrapper ──────────────────────────────────────────
     The editor now opens in place (above the quotes list) rather than
     replacing the whole tab. This wrapper just gives it breathing room from
     the list below. */
  .quotes-tab__editor-inline {
    margin-bottom: 16px;
  }

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
    padding: 2px 10px;
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
