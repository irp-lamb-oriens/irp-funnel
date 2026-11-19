<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { browser } from '$app/environment';
  import { writable, get } from 'svelte/store';
  import {
    fetchQuotes,
    deleteQuote,
    duplicateQuote,
    QUOTE_STATUS_LABEL,
    fetchQuoteTemplates,
    inferClientTemplate,
    selectedClient,
    createInvoiceFromQuote,
    downloadContractPdf,
    type QuoteTemplate,
    type InferTemplateResult,
  } from '../store.ts';
  import type { Quote } from '../store.ts';
  import QuoteEditor from './QuoteEditor.svelte';
  import PricingRequestsPanel from './PricingRequestsPanel.svelte';
  import QuotePaymentsPanel from './QuotePaymentsPanel.svelte';
  import Select, { type SelectOption } from './ui/Select.svelte';
  import { buildQuoteContext } from '../utils/quoteContext.ts';
  import { chosenOptions, isAcceptedQuote, optionCount, optionsLabel, quoteValue } from '$lib/quoteValue.ts';


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

  // ── Duplicate a quote's configuration into a new draft ────────────────────
  let duplicatingQuoteId: string | null = null;

  async function handleDuplicate(quote: Quote) {
    if (duplicatingQuoteId) return;
    duplicatingQuoteId = quote.quoteId;
    try {
      const copy = await duplicateQuote(clientId, quote.quoteId);
      await loadQuotes();
      // Open the freshly-created copy so the operator can review/adjust it.
      openEdit(copy.quoteId);
    } catch (err: any) {
      alert('Error duplicating: ' + (err?.message ?? err));
    } finally {
      duplicatingQuoteId = null;
    }
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

  // ── Clipboard ─────────────────────────────────────────────────────────────
  // Which quote was copied last, and in which mode, so the button can flash a
  // confirmation. Cleared on a timer; the timer is replaced (not stacked) when
  // the operator copies again before the previous one elapsed.
  let copiedKey: string | null = null;
  let copiedTimer: ReturnType<typeof setTimeout> | null = null;

  function flagCopied(key: string): void {
    copiedKey = key;
    if (copiedTimer) clearTimeout(copiedTimer);
    copiedTimer = setTimeout(() => {
      copiedKey = null;
      copiedTimer = null;
    }, 1800);
  }

  /**
   * `navigator.clipboard` is unavailable outside a secure context and in some
   * embedded webviews, so fall back to a hidden textarea + execCommand.
   */
  async function writeClipboard(text: string): Promise<boolean> {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch { /* fall through to the legacy path */ }

    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }

  async function copyPortalUrl(quote: Quote): Promise<void> {
    const ok = await writeClipboard(portalUrl(quote.clientToken ?? null));
    if (ok) flagCopied(`link:${quote.quoteId}`);
  }

  /**
   * Copy the generated quote link together with the whole overview context:
   * the client's details, the quote itself, its line items and the providers
   * behind it. Internal cost/margin is included because this is a staff-only
   * surface and operators paste it into internal handoffs.
   */
  async function copyQuoteContext(quote: Quote): Promise<void> {
    const text = buildQuoteContext(quote, get(selectedClient), {
      portalUrl: portalUrl(quote.clientToken ?? null),
      includeInternalPricing: true,
    });
    const ok = await writeClipboard(text);
    if (ok) flagCopied(`ctx:${quote.quoteId}`);
  }

  onDestroy(() => {
    if (copiedTimer) clearTimeout(copiedTimer);
  });

  // ── Create invoice from an accepted quote ─────────────────────────────────
  let creatingInvoice = false;
  let invoiceMsg = '';

  async function handleCreateInvoice(quote: Quote) {
    if (creatingInvoice) return;
    creatingInvoice = true;
    invoiceMsg = '';
    try {
      const client = get(selectedClient);
      await createInvoiceFromQuote({
        quoteId: quote.quoteId,
        consultationId: clientId,
        clientName: client?.displayName || client?.name || undefined,
        clientEmail: client?.email || undefined,
      });
      invoiceMsg = 'Invoice created. Open Finance → Invoices to review and send it.';
    } catch (err: any) {
      invoiceMsg = 'Could not create the invoice: ' + (err?.message ?? err);
    } finally {
      creatingInvoice = false;
    }
  }

  // ── Download the signed service agreement (accepted quotes) ───────────────
  // Tracked per quote id so a row that is downloading never disables the button
  // on the other accepted quotes in the list.
  let downloadingContractId: string | null = null;

  async function handleDownloadContract(quote: Quote) {
    if (downloadingContractId) return;
    downloadingContractId = quote.quoteId;
    invoiceMsg = '';
    try {
      await downloadContractPdf(clientId, quote.quoteId);
    } catch (err: any) {
      invoiceMsg = 'Could not download the contract: ' + (err?.message ?? err);
    } finally {
      downloadingContractId = null;
    }
  }

  // ── Formatting helpers ─────────────────────────────────────────────────────
  /**
   * The quote's amount: what the client agreed to once accepted, "N options"
   * while it still offers choices (its stored total adds every option up), and
   * the plain total otherwise.
   */
  function formatTotal(quote: Quote): string {
    const value = quoteValue(quote);
    if (value == null && optionCount(quote) > 0) return optionsLabel(optionCount(quote));
    const total = value ?? quote.lineItems?.reduce((s, li) => s + (li.amount ?? 0), 0) ?? 0;
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
          <div class="qt-template__loading" role="status">
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
      <!-- Key on the quote id so switching which quote is edited (or New Quote)
           remounts the editor and re-runs its load. Without this, the editor is
           reused in place and only loads on first mount — clicking Edit on
           another quote while it's already open would appear to do nothing. -->
      {#key editingQuoteId}
        <div class="quotes-tab__editor-inline">
          <QuoteEditor
            {clientId}
            quoteId={editingQuoteId}
            on:saved={handleEditorSaved}
            on:cancelled={handleEditorCancelled}
          />
        </div>
      {/key}
    {/if}


    <!-- ── Payments on accepted quotes (Stripe + recorded wires) ───────── -->
    {#if $quotes.some((q) => q.status === 'client_accepted')}
      <QuotePaymentsPanel {clientId} />
    {/if}

    {#if loading}

      <div class="quotes-tab__loading" role="status">
        <div class="quotes-tab__spinner"></div>
        <span>Loading quotes…</span>
      </div>
    {:else if error}
      <div class="quotes-tab__error" role="alert">
        ⚠️ {error}
        <button class="quotes-tab__retry" on:click={loadQuotes}>Retry</button>
      </div>
    {:else if $quotes.length === 0 && !showEditor}
      <div class="quotes-tab__empty" role="status">
        <span class="quotes-tab__empty-icon">💰</span>
        <p class="quotes-tab__empty-title">No quotes yet</p>
        <p class="quotes-tab__empty-desc">Create the first quote for this client.</p>
      </div>

    {:else}
      <ul class="quotes-tab__list">
        {#each $quotes as quote (quote.quoteId)}
          <!-- Accepted = status client_accepted or an acceptance timestamp (an
               older editor reset accepted quotes to draft on save). -->
          {@const shownStatus = isAcceptedQuote(quote) ? 'client_accepted' : quote.status}
          <!-- svelte-ignore a11y-click-events-have-key-events -->
          <!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
          <li class="quotes-tab__item" on:click={() => openEdit(quote.quoteId)} role="button" tabindex="0">
            <div class="quotes-tab__item-main">
              <span class="quotes-tab__item-title">{quote.title || 'Untitled'}</span>
              <span
                class="quotes-tab__status-badge"
                style="background: {QUOTE_STATUS_LABEL[shownStatus]?.color ?? '#64748b'}22; color: {QUOTE_STATUS_LABEL[shownStatus]?.color ?? '#64748b'}; border-color: {QUOTE_STATUS_LABEL[shownStatus]?.color ?? '#64748b'}44;"
              >
                {QUOTE_STATUS_LABEL[shownStatus]?.label ?? quote.status}
              </span>
            </div>
            <div class="quotes-tab__item-meta">
              <span class="quotes-tab__item-total">{formatTotal(quote)}</span>
              {#if chosenOptions(quote).length}
                <span class="quotes-tab__item-choice" title="The option the client accepted. Invoices bill this one.">
                  ✓ {chosenOptions(quote).join(' + ')}
                </span>
              {/if}
              <span class="quotes-tab__item-lines">{(quote.lineItems ?? []).length} line item{(quote.lineItems ?? []).length !== 1 ? 's' : ''}</span>
              <span class="quotes-tab__item-date">{formatDate(quote.createdAt)}</span>
            </div>
            <!-- Portal link — permanently visible on sent/accepted quotes ── -->
            {#if quote.status === 'sent_to_client' || shownStatus === 'client_accepted'}
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
                  class:is-copied={copiedKey === `link:${quote.quoteId}`}
                  title="Copy portal link only"
                  on:click|stopPropagation={() => copyPortalUrl(quote)}
                  aria-label="Copy portal link only"
                >
                  {#if copiedKey === `link:${quote.quoteId}`}
                    <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"></polyline></svg>
                  {:else}
                    <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                  {/if}
                </button>
                <!-- Link + the whole overview: client details, quote, line
                     items and providers, ready to paste into a handoff. -->
                <button
                  class="quotes-tab__context-btn"
                  class:is-copied={copiedKey === `ctx:${quote.quoteId}`}
                  title="Copy the link plus the full client and quote overview"
                  on:click|stopPropagation={() => copyQuoteContext(quote)}
                >
                  {#if copiedKey === `ctx:${quote.quoteId}`}
                    <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"></polyline></svg>
                    <span>Copied</span>
                  {:else}
                    <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
                    <span>Copy context</span>
                  {/if}
                </button>
                {#if shownStatus === 'client_accepted'}
                  <button
                    class="quotes-tab__invoice-btn"
                    title="Create invoice from this accepted quote"
                    on:click|stopPropagation={() => handleCreateInvoice(quote)}
                    disabled={creatingInvoice}
                  >
                    {creatingInvoice ? 'Creating…' : 'Create invoice'}
                  </button>
                  <button
                    class="quotes-tab__contract-btn"
                    title="Download the signed service agreement for this quote"
                    on:click|stopPropagation={() => handleDownloadContract(quote)}
                    disabled={downloadingContractId === quote.quoteId}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                    <span>{downloadingContractId === quote.quoteId ? 'Preparing…' : 'Contract PDF'}</span>
                  </button>
                {/if}
              </div>
            {/if}

            {#if invoiceMsg}
              <p class="quotes-tab__invoice-msg">{invoiceMsg}</p>
            {/if}

            <div class="quotes-tab__item-actions">
              <button
                class="quotes-tab__action-btn quotes-tab__action-btn--edit"
                title="Edit quote"
                on:click|stopPropagation={() => openEdit(quote.quoteId)}
              >✏️</button>
              <button
                class="quotes-tab__action-btn quotes-tab__action-btn--duplicate"
                title="Duplicate quote"
                aria-label="Duplicate quote"
                disabled={duplicatingQuoteId === quote.quoteId}
                on:click|stopPropagation={() => handleDuplicate(quote)}
              >{duplicatingQuoteId === quote.quoteId ? '…' : '⧉'}</button>
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
    background: var(--irp-surface-2);
    min-height: 200px;
    font-feature-settings: 'cv02','cv03','cv04','cv11';
  }

  /* ── Proposal template selector card ──────────────────────────────────── */
  .qt-template {
    background: linear-gradient(180deg, var(--irp-surface) 0%, var(--irp-bg) 100%);
    border: 1px solid var(--irp-line);
    border-radius: var(--irp-r-lg);
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
    font-size: var(--irp-fs-xs);
    font-weight: 800;
    color: var(--irp-text);
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
  .qt-template__title svg { color: var(--irp-accent-ink); flex-shrink: 0; }

  .qt-template__source {
    font-size: var(--irp-fs-2xs);
    font-weight: 800;
    letter-spacing: 0.03em;
    padding: 2px 10px;
    border-radius: var(--irp-r-full);
    border: 1px solid transparent;
    white-space: nowrap;
    line-height: 1.6;
  }
  .qt-template__source.is-auto {
    color: var(--irp-accent-ink);
    background: rgba(2,182,188,0.1);
    border-color: rgba(2,182,188,0.24);
  }
  .qt-template__source.is-manual {
    color: var(--irp-violet-600);
    background: rgba(124,58,237,0.09);
    border-color: rgba(124,58,237,0.22);
  }
  .qt-template__source.is-default {
    color: var(--irp-text-dim);
    background: var(--irp-surface-3);
    border-color: var(--irp-line);
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
    background: var(--irp-surface-3);
    border: 1px solid var(--irp-line);
    border-radius: var(--irp-r-md);
    color: var(--irp-text-muted);
    cursor: pointer;
    transition: background 0.14s, border-color 0.14s, color 0.14s, transform 0.14s;
  }
  .qt-template__redetect:hover:not(:disabled) {
    background: var(--irp-surface-2);
    border-color: rgba(2,182,188,0.35);
    color: var(--irp-accent-ink);
    transform: translateY(-1px);
  }
  .qt-template__redetect:disabled { opacity: 0.6; cursor: not-allowed; }
  .qt-template__redetect.is-busy svg { animation: qt-spin 0.7s linear infinite; }

  .qt-template__loading {
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--irp-text-dim);
    font-size: var(--irp-fs-sm);
    padding: 10px 2px;
  }
  .qt-template__dot {
    width: 14px;
    height: 14px;
    border: 2px solid var(--irp-line);
    border-top-color: var(--irp-accent);
    border-radius: 50%;
    animation: qt-spin 0.7s linear infinite;
    flex-shrink: 0;
  }

  .qt-template__hint {
    margin: 8px 0 0;
    font-size: var(--irp-fs-2xs);
    line-height: 1.5;
    color: var(--irp-text-dim);
    font-style: normal;
  }

  /* ── Toolbar ──────────────────────────────────────────────────────────── */
  .quotes-tab__toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 16px;
    gap: 0.5rem;
  }


  .quotes-tab__heading { /* shared anatomy */ margin: 0; font-size: var(--irp-fs-md); font-weight: 700; line-height: 1.3; letter-spacing: -0.01em; color: var(--irp-text); text-transform: none; margin: 0; }

  .quotes-tab__new-btn {
    background: linear-gradient(135deg, var(--irp-accent) 0%, var(--irp-teal-700) 100%);
    color: var(--irp-text-inverse);
    border: none;
    border-radius: var(--irp-r-full);
    padding: 7px 16px;
    font-size: var(--irp-fs-sm);
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
    color: var(--irp-text-dim);
    font-size: var(--irp-fs-md);
    justify-content: center;
  }

  .quotes-tab__spinner {
    width: 18px;
    height: 18px;
    border: 2px solid var(--irp-line);
    border-top-color: var(--irp-accent);
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
    background: var(--irp-surface-3);
    border: 1px solid var(--irp-red-200);
    border-radius: var(--irp-r-md);
    color: var(--irp-red-600);
    font-size: var(--irp-fs-sm);
  }

  .quotes-tab__retry {
    background: var(--irp-surface);
    border: 1px solid var(--irp-red-300);
    color: var(--irp-red-600);
    border-radius: var(--irp-r-xs);
    padding: 3px 10px;
    font-size: var(--irp-fs-xs);
    font-weight: 600;
    cursor: pointer;
    transition: background 0.14s;
    margin-left: auto;
    flex-shrink: 0;
  }
  .quotes-tab__retry:hover { background: var(--irp-surface-3); }

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
    font-size: var(--irp-fs-md);
    color: var(--irp-text);
    margin: 0;
  }
  .quotes-tab__empty-desc {
    color: var(--irp-text-dim);
    font-size: var(--irp-fs-sm);
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
    background: var(--irp-surface);
    border: 1px solid var(--irp-line);
    border-radius: var(--irp-r-md);
    padding: 13px 16px 11px;
    cursor: pointer;
    transition: box-shadow 0.18s, transform 0.18s, border-color 0.18s;
    position: relative;
    box-shadow: 0 1px 3px rgba(0,0,0,0.06), 0 1px 8px rgba(0,0,0,0.04);
  }
  .quotes-tab__item:hover {
    border-color: var(--irp-teal-200);
    box-shadow: 0 4px 16px rgba(2,181,187,0.10), 0 1px 4px rgba(0,0,0,0.06);
    transform: translateY(-1px);
  }
  .quotes-tab__item:focus-visible {
    outline: 2px solid var(--irp-accent);
    outline-offset: 2px;
  }

  /* ── Item main row ────────────────────────────────────────────────────── */
  .quotes-tab__item-main {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    padding-right: 96px; /* make room for the edit / duplicate / delete buttons */
  }

  .quotes-tab__item-title {
    font-weight: 700;
    font-size: var(--irp-fs-md);
    color: var(--irp-text);
    flex: 1;
    min-width: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    letter-spacing: -0.01em;
  }

  /* ── Status badge ─────────────────────────────────────────────────────── */
  .quotes-tab__status-badge {
    font-size: var(--irp-fs-2xs);
    font-weight: 700;
    padding: 2px 10px;
    border-radius: var(--irp-r-full);
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
    font-size: var(--irp-fs-xs);
    color: var(--irp-text-dim);
    flex-wrap: wrap;
    align-items: center;
  }
  .quotes-tab__item-meta > span + span {
    padding-left: 10px;
    border-left: 1px solid var(--irp-line);
  }

  .quotes-tab__item-choice {
    padding: 1px 8px;
    border-radius: var(--irp-r-full);
    background: var(--irp-accent-subtle);
    color: var(--irp-accent-ink);
    font-size: var(--irp-fs-xs);
    font-weight: 700;
  }
  .quotes-tab__item-total {
    font-weight: 700;
    font-size: var(--irp-fs-sm);
    color: var(--irp-text);
    font-variant-numeric: tabular-nums;
  }

  .quotes-tab__item-lines {
    color: var(--irp-text-dim);
  }

  .quotes-tab__item-date {
    color: var(--irp-text-dim);
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
    background: var(--irp-surface-3);
    border: 1px solid var(--irp-line);
    border-radius: var(--irp-r-sm);
    cursor: pointer;
    font-size: var(--irp-fs-sm);
    line-height: 1;
    transition: background 0.14s, border-color 0.14s, transform 0.14s;
    color: var(--irp-text-dim);
  }
  .quotes-tab__action-btn:hover {
    background: var(--irp-surface-4);
    border-color: var(--irp-line-strong);
    transform: scale(1.08);
  }
  .quotes-tab__action-btn--duplicate:hover {
    background: var(--irp-surface-3);
    border-color: var(--irp-blue-200);
    color: var(--irp-blue-600);
  }
  .quotes-tab__action-btn--duplicate:disabled {
    opacity: 0.55;
    cursor: wait;
    transform: none;
  }
  .quotes-tab__action-btn--delete:hover {
    background: var(--irp-surface-3);
    border-color: var(--irp-red-200);
    color: var(--irp-red-600);
  }

  /* ── Portal link row (sent_to_client / client_accepted) ──────────────── */
  .quotes-tab__portal-row {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 5px 10px;
    background: var(--irp-surface-2);
    border: 1px solid var(--irp-green-200);
    border-radius: var(--irp-r-sm);
    margin-top: 2px;
  }

  .quotes-tab__portal-icon {
    color: var(--irp-accent-ink);
    flex-shrink: 0;
  }

  .quotes-tab__portal-link {
    font-size: var(--irp-fs-2xs);
    font-weight: 600;
    color: var(--irp-accent-ink);
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
    color: var(--irp-accent-ink);
    text-decoration: underline;
  }

  .quotes-tab__copy-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    background: transparent;
    border: 1px solid var(--irp-green-200);
    border-radius: var(--irp-r-xs);
    cursor: pointer;
    color: var(--irp-accent-ink);
    flex-shrink: 0;
    transition: background 0.14s, border-color 0.14s, transform 0.14s;
    padding: 0;
  }
  .quotes-tab__copy-btn:hover {
    background: var(--irp-green-100);
    border-color: var(--irp-green-300);
    transform: scale(1.1);
  }
  .quotes-tab__copy-btn:active {
    transform: scale(0.96);
  }
  .quotes-tab__copy-btn.is-copied {
    background: var(--irp-accent-hover);
    border-color: var(--irp-accent-hover);
    color: var(--irp-text-inverse);
  }

  /* ── Copy-full-context button ────────────────────────────────────────── */
  .quotes-tab__context-btn {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 3px 9px;
    background: var(--irp-surface);
    border: 1px solid var(--irp-green-200);
    border-radius: var(--irp-r-xs);
    color: var(--irp-accent-ink);
    font-family: inherit;
    font-size: var(--irp-fs-2xs);
    font-weight: 700;
    letter-spacing: 0.01em;
    cursor: pointer;
    white-space: nowrap;
    flex-shrink: 0;
    transition: background 0.14s, border-color 0.14s, color 0.14s, transform 0.14s;
  }
  .quotes-tab__context-btn svg { flex-shrink: 0; }
  .quotes-tab__context-btn:hover {
    background: var(--irp-green-100);
    border-color: var(--irp-green-300);
    transform: translateY(-1px);
  }
  .quotes-tab__context-btn:active { transform: translateY(0); }
  .quotes-tab__context-btn.is-copied {
    background: var(--irp-accent-hover);
    border-color: var(--irp-accent-hover);
    color: var(--irp-text-inverse);
  }

  @media (prefers-reduced-motion: reduce) {
    .quotes-tab__copy-btn,
    .quotes-tab__context-btn { transition: none; }
    .quotes-tab__copy-btn:hover,
    .quotes-tab__context-btn:hover { transform: none; }
  }

  /* ── Create-invoice button (accepted quotes) ─────────────────────────── */
  .quotes-tab__invoice-btn {
    padding: 3px 10px;
    background: linear-gradient(135deg, var(--irp-accent) 0%, var(--irp-teal-700) 100%);
    border: none;
    border-radius: var(--irp-r-xs);
    color: var(--irp-text-inverse);
    font-family: inherit;
    font-size: var(--irp-fs-2xs);
    font-weight: 700;
    cursor: pointer;
    white-space: nowrap;
    flex-shrink: 0;
    transition: filter 0.14s, transform 0.14s;
  }
  .quotes-tab__invoice-btn:hover:not(:disabled) {
    filter: brightness(1.07);
    transform: translateY(-1px);
  }
  .quotes-tab__invoice-btn:disabled { opacity: 0.6; cursor: wait; }

  /* ── Contract-download button (accepted quotes) ──────────────────────── */
  .quotes-tab__contract-btn {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 3px 10px;
    background: linear-gradient(135deg, var(--irp-green-600) 0%, var(--irp-green-700) 100%);
    border: none;
    border-radius: var(--irp-r-xs);
    color: var(--irp-text-inverse);
    font-family: inherit;
    font-size: var(--irp-fs-2xs);
    font-weight: 700;
    cursor: pointer;
    white-space: nowrap;
    flex-shrink: 0;
    transition: filter 0.14s, transform 0.14s;
  }
  .quotes-tab__contract-btn:hover:not(:disabled) {
    filter: brightness(1.07);
    transform: translateY(-1px);
  }
  .quotes-tab__contract-btn:disabled { opacity: 0.6; cursor: wait; }

  @media (prefers-reduced-motion: reduce) {
    .quotes-tab__invoice-btn,
    .quotes-tab__contract-btn { transition: none; }
    .quotes-tab__invoice-btn:hover,
    .quotes-tab__contract-btn:hover { transform: none; }
  }

  .quotes-tab__invoice-msg {
    margin: 2px 0 0;
    font-size: var(--irp-fs-2xs);
    color: var(--irp-accent-ink);
    line-height: 1.4;
  }
</style>
