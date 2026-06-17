<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  import { get } from 'svelte/store';
  import {
    fetchQuote,
    createQuote,
    updateQuote,
    getApiUrl,
    authToken,
    authEmail,
    submitQuoteForApproval,
    approveQuote,
    requestQuoteChanges,
    addQuoteComment,
    resolveQuoteComment,
    sendQuoteToClient,
    // Dynamic permission store — falls back to static QUOTE_APPROVERS list
    // when Firestore hasn't been loaded yet (zero regression).
    canApproveQuotes,
    liveActionPermissions,
    fetchLiveActionPermissions,
    QUOTE_STATUS_LABEL,
    // ── Margin & insights ──
    extractInsights,
    selectedClient,
    PACKING_TIER_LABEL,
    // ── Line-item templates (pricing presets) ──
    fetchQuoteLineTemplates,
    createQuoteLineTemplate,
    updateQuoteLineTemplate,
    deleteQuoteLineTemplate,
  } from '../store.ts';
  import type { Quote, QuoteLineItem, QuoteLineTemplate } from '../store.ts';

  import { aggregateByCurrency } from '$lib/money.ts';

  export let clientId: string;
  export let quoteId: string | null = null;

  const dispatch = createEventDispatcher<{ saved: void; cancelled: void }>();

  // ── Form state ─────────────────────────────────────────────────────────────
  let title = '';
  let notes = '';
  let lineItems: QuoteLineItem[] = [];
  let providerIds: string[] = [];
  let providerSnapshots: Quote['providerSnapshots'] = [];

  // ── Provider search ────────────────────────────────────────────────────────
  let providerSearchQuery = '';
  let providerSearchResults: Array<{ id: string; name: string; country: string; modality: string; serviceCategory: string }> = [];
  let providerSearchLoading = false;
  let providerDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  // ── UI state ───────────────────────────────────────────────────────────────
  let saving = false;
  let loadingQuote = false;
  let errorMsg = '';

  // ── Margin & project config ────────────────────────────────────────────────
  let serviceType = '';
  let serviceTypeError = false;
  let serviceTypeEl: HTMLSelectElement | null = null;
  let refreshingInsights = false;
  let insightsHint = '';
  let defaultMarginPct = 20;
  let clientDescription = '';

  // ── Approval workflow state ────────────────────────────────────────────────
  let quote: Quote | null = null;
  let noteToApprovers = '';
  let sentLink = '';
  let newCommentText = '';
  let showChangesRequest = false;
  let changesComment = '';
  // Alias error to errorMsg for approval handlers
  $: error = errorMsg;

  // ── Margin math ────────────────────────────────────────────────────────────
  function lineClientPrice(li: QuoteLineItem): number {
    const cost = Number(li.amount) || 0;
    // Flat mode: clientPrice = cost + marginFlat
    if (li.marginMode === 'flat') {
      return Math.round((cost + (Number(li.marginFlat) || 0)) * 100) / 100;
    }
    // Percentage mode (default): clientPrice = cost × (1 + marginPct/100)
    const m = typeof li.marginPct === 'number' ? li.marginPct : 20;
    return Math.round(cost * (1 + m / 100) * 100) / 100;
  }
  $: costSubtotal = lineItems.reduce((s, li) => s + (Number(li.amount) || 0), 0);
  $: clientTotal  = lineItems.reduce((s, li) => s + lineClientPrice(li), 0);
  $: earnings     = Math.round((clientTotal - costSubtotal) * 100) / 100;
  $: total        = clientTotal; // total = client-facing number (used in payload)
  // Per-currency buckets kept for the currency selector in handleSave
  $: totalBuckets = aggregateByCurrency(lineItems, null);

  // ── Line item helpers ──────────────────────────────────────────────────────
  function makeLineId(): string {
    return 'li_' + Math.random().toString(36).slice(2, 10);
  }

  function addLine() {
    lineItems = [
      ...lineItems,
      { lineId: makeLineId(), label: '', amount: 0, marginPct: defaultMarginPct, marginMode: 'pct' as const, marginFlat: null, currency: 'USD', providerId: null, notes: null },
    ];
  }

  function removeLine(lineId: string) {
    lineItems = lineItems.filter(li => li.lineId !== lineId);
  }

  function updateLine(lineId: string, field: keyof QuoteLineItem, value: any) {
    lineItems = lineItems.map(li => li.lineId === lineId ? { ...li, [field]: value } : li);
  }

  // ── Line-item templates (pricing presets) ───────────────────────────────────
  let lineTemplates: QuoteLineTemplate[] = [];
  let lineTemplatesLoading = false;
  let selectedLineTemplateId = '';

  // Manage / edit panel state
  let manageOpen = false;
  let tmplEditingId: string | null = null; // null → creating a new template
  let tmplName = '';
  let tmplCurrency = 'USD';
  let tmplLinesText = '';
  let tmplSaving = false;
  let tmplError = '';

  async function loadLineTemplates() {
    lineTemplatesLoading = true;
    try {
      lineTemplates = await fetchQuoteLineTemplates();
    } catch {
      lineTemplates = []; // non-fatal — the selector simply shows no presets
    } finally {
      lineTemplatesLoading = false;
    }
  }

  /** True when every current line is still blank (no label and no amount). */
  function linesAreBlank(): boolean {
    return lineItems.every(li => !String(li.label ?? '').trim() && !(Number(li.amount) > 0));
  }

  /** Seed the quote's line items from a saved template (labels only; amounts stay editable at 0). */
  function applyLineTemplate(templateId: string) {
    const tmpl = lineTemplates.find(t => t.templateId === templateId);
    if (!tmpl) { selectedLineTemplateId = ''; return; }
    if (!linesAreBlank()) {
      const ok = confirm(`Replace the current ${lineItems.length} line item(s) with the "${tmpl.name}" template?`);
      if (!ok) { selectedLineTemplateId = ''; return; }
    }
    const cur = tmpl.currency || 'USD';
    lineItems = tmpl.lines.map(label => ({
      lineId: makeLineId(),
      label,
      amount: 0,
      marginPct: defaultMarginPct,
      marginMode: 'pct' as const,
      marginFlat: null,
      currency: cur,
      providerId: null,
      notes: null,
    }));
    if (lineItems.length === 0) addLine();
    selectedLineTemplateId = ''; // reset so the same template can be re-applied
  }

  // ── Manage panel actions ─────────────────────────────────────────────────────
  function openCreateTemplate() {
    tmplEditingId = null;
    tmplName = '';
    tmplCurrency = 'USD';
    tmplLinesText = '';
    tmplError = '';
    manageOpen = true;
  }

  function openEditTemplate(t: QuoteLineTemplate) {
    tmplEditingId = t.templateId;
    tmplName = t.name;
    tmplCurrency = t.currency || 'USD';
    tmplLinesText = (t.lines ?? []).join('\n');
    tmplError = '';
    manageOpen = true;
  }

  /** Quick "save the lines I just built as a reusable template". */
  function seedTemplateFromCurrentLines() {
    tmplEditingId = null;
    tmplName = '';
    tmplCurrency = lineItems[0]?.currency || 'USD';
    tmplLinesText = lineItems.map(li => li.label).filter(l => String(l ?? '').trim()).join('\n');
    tmplError = '';
    manageOpen = true;
  }

  async function saveTemplate() {
    const name = tmplName.trim();
    const lines = tmplLinesText.split('\n').map(l => l.trim()).filter(Boolean);
    if (!name) { tmplError = 'Template name is required.'; return; }
    if (lines.length === 0) { tmplError = 'Add at least one line.'; return; }
    tmplSaving = true;
    tmplError = '';
    try {
      if (tmplEditingId) {
        await updateQuoteLineTemplate(tmplEditingId, { name, currency: tmplCurrency, lines });
      } else {
        await createQuoteLineTemplate({ name, currency: tmplCurrency, lines });
      }
      await loadLineTemplates();
      manageOpen = false;
    } catch (err: any) {
      tmplError = 'Error saving template: ' + (err?.message ?? err);
    } finally {
      tmplSaving = false;
    }
  }

  async function removeTemplate(t: QuoteLineTemplate) {
    if (!confirm(`Delete the "${t.name}" template? This cannot be undone.`)) return;
    try {
      await deleteQuoteLineTemplate(t.templateId);
      if (tmplEditingId === t.templateId) openCreateTemplate();
      await loadLineTemplates();
    } catch (err: any) {
      tmplError = 'Error deleting template: ' + (err?.message ?? err);
    }
  }


  // ── Load existing quote ────────────────────────────────────────────────────
  async function loadQuote() {
    if (!quoteId) {
      // New quote — start with one empty line
      quote = null;
      addLine();
      return;
    }
    loadingQuote = true;
    errorMsg = '';
    try {
      const q = await fetchQuote(clientId, quoteId);
      quote = q;
      title = q.title ?? '';
      notes = q.notes ?? '';
      serviceType = q.serviceType ?? '';
      defaultMarginPct = typeof q.defaultMarginPct === 'number' ? q.defaultMarginPct : 20;
      clientDescription = q.clientDescription ?? '';
      lineItems = (q.lineItems ?? []).map(li => ({
        ...li,
        marginPct: typeof li.marginPct === 'number' ? li.marginPct : 20,
        marginMode: li.marginMode === 'flat' ? 'flat' as const : 'pct' as const,
        marginFlat: typeof li.marginFlat === 'number' ? li.marginFlat : null,
      }));
      providerIds = [...(q.providerIds ?? [])];
      providerSnapshots = [...(q.providerSnapshots ?? [])];
      if (lineItems.length === 0) addLine();
    } catch (err: any) {
      errorMsg = 'Error loading quote: ' + (err?.message ?? err);
    } finally {
      loadingQuote = false;
    }
  }

  // ── Service-type: auto-populate from transcriptInsights ─────────────────
  async function resolveServiceType() {
    if (serviceType) return; // already set from existing quote or explicit selection
    const insights = get(selectedClient)?.transcriptInsights;
    if (insights?.packingTier) {
      serviceType = insights.packingTier;
      return;
    }
    if (!insights) {
      // No insights yet — try on-demand extraction
      refreshingInsights = true;
      insightsHint = 'Detecting service type from call notes…';
      try {
        const result = await extractInsights(clientId);
        if (result?.packingTier) {
          serviceType = result.packingTier;
          insightsHint = '';
        } else {
          insightsHint = 'Could not auto-detect. Please select a service type manually.';
        }
      } catch {
        insightsHint = 'Detection unavailable. Please select a service type manually.';
      } finally {
        refreshingInsights = false;
      }
    } else {
      // Has insights but packingTier is null
      insightsHint = 'Service type not detected in notes. Please select manually.';
    }
  }

  onMount(async () => {
    await loadQuote();
    resolveServiceType();
    loadLineTemplates(); // non-fatal; populates the template selector

    // Eagerly hydrate the live action-permissions store so canApproveQuotes
    // switches from the static fallback to the live Firestore map on first render.
    // Non-fatal: if the fetch fails, the static QUOTE_APPROVERS list is used.
    if ($liveActionPermissions === null) {
      try {
        const permissions = await fetchLiveActionPermissions();
        if (permissions !== null) liveActionPermissions.set(permissions);
      } catch { /* non-fatal — static fallback remains */ }
    }
  });

  // ── Provider search ────────────────────────────────────────────────────────
  function onProviderSearchInput() {
    if (providerDebounceTimer) clearTimeout(providerDebounceTimer);
    const q = providerSearchQuery.trim();
    if (!q) { providerSearchResults = []; return; }
    providerDebounceTimer = setTimeout(() => searchProviders(q), 300);
  }

  async function searchProviders(q: string) {
    providerSearchLoading = true;
    try {
      const token = get(authToken);
      // Fetch all providers; filter client-side so a missing ?search= param
      // doesn't silently return 0 results on the server.
      const url = `${getApiUrl()}/api/dashboard/providers`;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['x-dashboard-token'] = token;
      const res = await fetch(url, { headers });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const qLower = q.toLowerCase();
      providerSearchResults = (data.providers ?? data ?? [])
        .filter((p: any) => p.name?.toLowerCase().includes(qLower))
        .slice(0, 10)
        .map((p: any) => ({
          id: p.id,
          name: p.name ?? '',
          // Normalize to the flat fields QuoteEditor template expects
          country:         (p.originRegions?.[0] ?? p.destinationRegions?.[0] ?? ''),
          modality:        (p.shippingModalities?.[0] ?? ''),
          serviceCategory: (p.serviceCategories?.[0] ?? ''),
        }));
    } catch (err: any) {
      providerSearchResults = [];
    } finally {
      providerSearchLoading = false;
    }
  }

  function toggleProvider(provider: { id: string; name: string; country: string; modality: string; serviceCategory: string }) {
    if (providerIds.includes(provider.id)) {
      providerIds = providerIds.filter(id => id !== provider.id);
      providerSnapshots = providerSnapshots.filter(s => s.id !== provider.id);
    } else {
      providerIds = [...providerIds, provider.id];
      providerSnapshots = [...providerSnapshots, {
        id: provider.id,
        name: provider.name,
        country: provider.country,
        modality: provider.modality,
        serviceCategory: provider.serviceCategory,
      }];
    }
  }

  function removeProvider(id: string) {
    providerIds = providerIds.filter(pid => pid !== id);
    providerSnapshots = providerSnapshots.filter(s => s.id !== id);
  }

  // ── Save ───────────────────────────────────────────────────────────────────
  async function handleSave() {
    if (!title.trim()) { errorMsg = 'Title is required.'; return; }
    if (!serviceType) {
      serviceTypeError = true;
      errorMsg = 'Service type is required before saving this quote.';
      serviceTypeEl?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    saving = true;
    errorMsg = '';
    try {
      const payload: Partial<Quote> = {
        title: title.trim(),
        notes: notes.trim() || null,
        lineItems,
        providerIds,
        providerSnapshots,
        total: clientTotal,
        costSubtotal,
        earnings,
        serviceType,
        defaultMarginPct,
        clientDescription: clientDescription.trim() || null,
        currency: totalBuckets.length === 1 ? totalBuckets[0].currency : (totalBuckets[0]?.currency ?? 'USD'),
        status: 'draft',
      };
      if (quoteId) {
        await updateQuote(clientId, quoteId, payload);
      } else {
        await createQuote(clientId, payload);
      }
      dispatch('saved');
    } catch (err: any) {
      errorMsg = 'Error saving: ' + (err?.message ?? err);
    } finally {
      saving = false;
    }
  }

  async function handleSubmitForApproval() {
    if (!quote) return;
    saving = true;
    errorMsg = '';
    try {
      await submitQuoteForApproval(clientId, quote.quoteId, noteToApprovers);
      noteToApprovers = '';
      // Reload quote to reflect new status
      if (quoteId) quote = await fetchQuote(clientId, quoteId);
    } catch (e: any) {
      errorMsg = e.message ?? 'Error submitting for approval';
    } finally {
      saving = false;
    }
  }

  async function handleApprove() {
    if (!quote) return;
    saving = true;
    errorMsg = '';
    try {
      await approveQuote(clientId, quote.quoteId);
      if (quoteId) quote = await fetchQuote(clientId, quoteId);
    } catch (e: any) {
      errorMsg = e.message ?? 'Error approving quote';
    } finally {
      saving = false;
    }
  }

  async function handleRequestChanges() {
    if (!quote || !changesComment.trim()) return;
    saving = true;
    errorMsg = '';
    try {
      await requestQuoteChanges(clientId, quote.quoteId, changesComment);
      changesComment = '';
      showChangesRequest = false;
      if (quoteId) quote = await fetchQuote(clientId, quoteId);
    } catch (e: any) {
      errorMsg = e.message ?? 'Error requesting changes';
    } finally {
      saving = false;
    }
  }

  async function handleAddComment() {
    if (!quote || !newCommentText.trim()) return;
    saving = true;
    errorMsg = '';
    try {
      await addQuoteComment(clientId, quote.quoteId, newCommentText);
      newCommentText = '';
      if (quoteId) quote = await fetchQuote(clientId, quoteId);
    } catch (e: any) {
      errorMsg = e.message ?? 'Error adding comment';
    } finally {
      saving = false;
    }
  }

  async function handleResolveComment(commentId: string) {
    if (!quote) return;
    saving = true;
    errorMsg = '';
    try {
      await resolveQuoteComment(clientId, quote.quoteId, commentId);
      if (quoteId) quote = await fetchQuote(clientId, quoteId);
    } catch (e: any) {
      errorMsg = e.message ?? 'Error resolving comment';
    } finally {
      saving = false;
    }
  }

  async function handleSendToClient() {
    if (!quote) return;
    saving = true;
    error = '';
    try {
      const result = await sendQuoteToClient(clientId, quote.quoteId);
      sentLink = result.statusPageUrl;
      if (quoteId) quote = await fetchQuote(clientId, quoteId);
    } catch (e: any) {
      error = e.message ?? 'Error sending to client';
    } finally {
      saving = false;
    }
  }

  function handleCancel() {
    dispatch('cancelled');
  }

  function formatTotal(n: number): string {
    return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' USD';
  }
</script>

<div class="quote-editor">
  <div class="quote-editor__header">
    <h3 class="quote-editor__title">{quoteId ? 'Edit Quote' : 'New Quote'}</h3>
  </div>

  {#if loadingQuote}
    <div class="quote-editor__loading">
      <div class="qe-spinner"></div>
      <span>Loading…</span>
    </div>
  {:else}
    <div class="quote-editor__body">

      <!-- Title -->
      <div class="qe-field">
        <label class="qe-label" for="qe-title">Title <span class="qe-required">*</span></label>
        <input
          id="qe-title"
          class="qe-input"
          type="text"
          placeholder="Initial Quote"
          bind:value={title}
        />
      </div>

      <!-- Service type (required) — auto-populated from AI transcript insights -->
      <div class="qe-field" class:qe-field--error={serviceTypeError}>
        <label class="qe-label qe-label--required" for="qe-service-type">
          Service type
          {#if refreshingInsights}<span class="qe-insights-spinner" title="Detecting from call notes…"></span>{/if}
        </label>
        <select
          id="qe-service-type"
          class="qe-select"
          class:qe-select--error={serviceTypeError}
          bind:this={serviceTypeEl}
          bind:value={serviceType}
          on:change={() => { serviceTypeError = false; insightsHint = ''; }}
        >
          <option value="">— Select service type —</option>
          {#each Object.entries(PACKING_TIER_LABEL) as [key, meta]}
            <option value={key}>{meta.icon} {meta.label}</option>
          {/each}
        </select>
        {#if serviceTypeError}
          <p class="qe-field-error">⚠ Service type is required before saving this quote.</p>
        {:else if insightsHint}
          <p class="qe-field-hint">{refreshingInsights ? '⏳' : 'ℹ️'} {insightsHint}</p>
        {/if}
      </div>

      <!-- Default margin (applies to new lines; per-line override available in table) -->
      <div class="qe-field qe-field--inline">
        <label class="qe-label" for="qe-default-margin">Default margin %</label>
        <div class="qe-pct-wrap qe-pct-wrap--field">
          <input
            id="qe-default-margin"
            class="qe-input qe-input--num qe-input--pct"
            type="number"
            min="0"
            max="500"
            step="1"
            bind:value={defaultMarginPct}
          />
          <span class="qe-pct-sym">%</span>
        </div>
        <p class="qe-field-hint">Applied to all new lines. Each line can be adjusted individually in the table.</p>
      </div>

      <!-- Line items -->
      <div class="qe-field">
        <div class="qe-lines-head">
          <label class="qe-label">Quote line items</label>
          <div class="qe-tmpl-bar">
            <div class="qe-tmpl-select-wrap">
              <span class="qe-tmpl-spark" aria-hidden="true">✦</span>
              <select
                class="qe-tmpl-select"
                bind:value={selectedLineTemplateId}
                on:change={() => selectedLineTemplateId && applyLineTemplate(selectedLineTemplateId)}
                disabled={lineTemplatesLoading}
                title="Apply a saved line-item template"
              >
                <option value="">{lineTemplatesLoading ? 'Loading templates…' : 'Apply a template…'}</option>
                {#each lineTemplates as t (t.templateId)}
                  <option value={t.templateId}>{t.name} · {t.lines.length} lines</option>
                {/each}
              </select>
            </div>
            <button
              type="button"
              class="qe-tmpl-manage-btn"
              on:click={openCreateTemplate}
              title="Create, edit or delete line-item templates"
            >
              <span class="qe-tmpl-manage-gear" aria-hidden="true">⚙</span> Manage
            </button>
          </div>
        </div>
        {#if lineItems.length > 0}

          <div class="qe-lines-wrap">
            <table class="qe-lines-table">
              <thead>
                <tr>
                  <th class="qe-th-desc">Description</th>
                  <th class="qe-th-num">Cost</th>
                  <th class="qe-th-pct">Margin %</th>
                  <th class="qe-th-num qe-th-price">Client price</th>
                  <th class="qe-th-cur">Currency</th>
                  <th class="qe-th-notes">Notes</th>
                  <th class="qe-th-del"></th>
                </tr>
              </thead>
              <tbody>
                {#each lineItems as li (li.lineId)}
                  <tr>
                    <td>
                      <input
                        class="qe-input qe-input--sm"
                        type="text"
                        placeholder="Description"
                        value={li.label}
                        on:input={(e) => updateLine(li.lineId, 'label', (e.target as HTMLInputElement).value)}
                      />
                    </td>
                    <td>
                      <input
                        class="qe-input qe-input--sm qe-input--num"
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        value={li.amount}
                        on:input={(e) => updateLine(li.lineId, 'amount', parseFloat((e.target as HTMLInputElement).value) || 0)}
                      />
                    </td>
                    <td class="qe-td-pct">
                      <div class="qe-margin-cell">
                        <!-- Mode toggle: % or flat currency -->
                        <button
                          type="button"
                          class="qe-margin-mode-btn"
                          class:qe-margin-mode-btn--pct={li.marginMode !== 'flat'}
                          title="{li.marginMode === 'flat' ? 'Flat amount — click to switch to %' : 'Percentage — click to switch to flat amount'}"
                          on:click={() => updateLine(li.lineId, 'marginMode', li.marginMode === 'flat' ? 'pct' : 'flat')}
                        >{li.marginMode === 'flat' ? (li.currency || '$') : '%'}</button>
                        {#if li.marginMode === 'flat'}
                          <input
                            class="qe-input qe-input--sm qe-input--num qe-input--margin"
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="0.00"
                            value={typeof li.marginFlat === 'number' ? li.marginFlat : 0}
                            on:input={(e) => updateLine(li.lineId, 'marginFlat', parseFloat((e.target as HTMLInputElement).value) || 0)}
                          />
                        {:else}
                          <input
                            class="qe-input qe-input--sm qe-input--num qe-input--margin"
                            type="number"
                            min="0"
                            max="500"
                            step="1"
                            placeholder="20"
                            value={typeof li.marginPct === 'number' ? li.marginPct : 20}
                            on:input={(e) => updateLine(li.lineId, 'marginPct', parseFloat((e.target as HTMLInputElement).value) || 0)}
                          />
                        {/if}
                      </div>
                    </td>
                    <td class="qe-td-price">
                      <span class="qe-computed-price">{lineClientPrice(li).toFixed(2)}</span>
                    </td>
                    <td>
                      <select
                        class="qe-select qe-select--sm"
                        value={li.currency}
                        on:change={(e) => updateLine(li.lineId, 'currency', (e.target as HTMLSelectElement).value)}
                      >
                        <option value="USD">USD</option>
                        <option value="EUR">EUR</option>
                        <option value="MXN">MXN</option>
                        <option value="CRC">CRC</option>
                      </select>
                    </td>
                    <td>
                      <input
                        class="qe-input qe-input--sm"
                        type="text"
                        placeholder="Optional note"
                        value={li.notes ?? ''}
                        on:input={(e) => updateLine(li.lineId, 'notes', (e.target as HTMLInputElement).value || null)}
                      />
                    </td>
                    <td>
                      <button
                        type="button"
                        class="qe-del-btn"
                        title="Remove line"
                        on:click={() => removeLine(li.lineId)}
                      >✕</button>
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {/if}
        <button type="button" class="qe-add-line-btn" on:click={addLine}>
          + Add line
        </button>
      </div>

      <!-- Finance footer: internal Cost subtotal · Client total · Earnings -->
      <div class="qe-finance-footer">
        <div class="qe-finance-cell qe-finance-cell--cost">
          <span class="qe-finance-label">Cost subtotal</span>
          <span class="qe-finance-value">{costSubtotal.toFixed(2)}</span>
          <span class="qe-finance-hint">IRP pays</span>
        </div>
        <div class="qe-finance-sep"></div>
        <div class="qe-finance-cell qe-finance-cell--total">
          <span class="qe-finance-label">Client total</span>
          <span class="qe-finance-value qe-finance-value--accent">{clientTotal.toFixed(2)}</span>
          <span class="qe-finance-hint">Client pays</span>
        </div>
        <div class="qe-finance-sep"></div>
        <div class="qe-finance-cell qe-finance-cell--earn">
          <span class="qe-finance-label">Earnings</span>
          <span class="qe-finance-value qe-finance-value--earn">{earnings.toFixed(2)}</span>
          <span class="qe-finance-hint">IRP margin</span>
        </div>
      </div>

      <!-- Provider search -->
      <div class="qe-field">
        <label class="qe-label" for="qe-prov-search">Providers (optional)</label>

        <!-- Selected providers as tags -->
        {#if providerSnapshots.length > 0}
          <div class="qe-provider-tags">
            {#each providerSnapshots as snap (snap.id)}
              <span class="qe-provider-tag">
                {snap.name}
                <button type="button" class="qe-provider-tag__remove" on:click={() => removeProvider(snap.id)}>✕</button>
              </span>
            {/each}
          </div>
        {/if}

        <div class="qe-provider-search">
          <input
            id="qe-prov-search"
            class="qe-input"
            type="text"
            placeholder="Search provider…"
            bind:value={providerSearchQuery}
            on:input={onProviderSearchInput}
          />
          {#if providerSearchLoading}
            <span class="qe-provider-searching">Searching…</span>
          {/if}
          {#if providerSearchResults.length > 0}
            <div class="qe-provider-results">
              {#each providerSearchResults as provider (provider.id)}
                <label class="qe-provider-result">
                  <input
                    type="checkbox"
                    checked={providerIds.includes(provider.id)}
                    on:change={() => toggleProvider(provider)}
                  />
                  <span class="qe-provider-result__name">{provider.name}</span>
                  <span class="qe-provider-result__meta">{provider.country} · {provider.modality}</span>
                </label>
              {/each}
            </div>
          {/if}
        </div>
      </div>

      <!-- Client description (broad summary shown to client; no cost/margin detail) -->
      <div class="qe-field">
        <label class="qe-label" for="qe-client-desc">
          Client description
          <span class="qe-label-badge">client-visible</span>
        </label>
        <textarea
          id="qe-client-desc"
          class="qe-textarea"
          placeholder="E.g. Full-service international relocation from Texas to Costa Rica — origin packing, ocean freight, customs clearance, and door-to-door delivery."
          rows="4"
          bind:value={clientDescription}
        ></textarea>
        <p class="qe-field-hint">Describe the scope shown to the client. Providers, costs, and margins are never shown.</p>
      </div>

      <!-- Notes -->
      <div class="qe-field">
        <label class="qe-label" for="qe-notes">Internal note</label>
        <textarea
          id="qe-notes"
          class="qe-textarea"
          placeholder="Internal note…"
          rows="3"
          bind:value={notes}
        ></textarea>
      </div>

      <!-- Error message -->
      {#if errorMsg}
        <div class="qe-error">{errorMsg}</div>
      {/if}

      <!-- Approval workflow section -->
      {#if quote}
        <div class="approval-section">
          <!-- Status banner -->
          <div class="status-banner status-{quote.status}">
            <strong>Status:</strong>
            {QUOTE_STATUS_LABEL[quote.status]?.label ?? quote.status}
            {#if quote.status === 'approved'}<span class="check">✓</span>{/if}
          </div>

          <!-- Approver actions (only visible to approvers when pending_approval) -->
          <!-- canApproveQuotes: uses live Firestore data when loaded, falls back to static QUOTE_APPROVERS list -->
          {#if quote.status === 'pending_approval' && $authEmail && $canApproveQuotes}
            <div class="approver-actions">
              <p class="approver-hint">You're an approver — you can approve or request changes:</p>
              <div class="btn-row">
                <button class="btn-approve" on:click={handleApprove} disabled={saving}>
                  ✅ Approve quote
                </button>
                <button class="btn-changes" on:click={() => showChangesRequest = true} disabled={saving}>
                  ✏️ Request changes
                </button>
              </div>
              {#if showChangesRequest}
                <div class="changes-request-box">
                  <textarea bind:value={changesComment} placeholder="Describe what changes are needed..." rows="3"></textarea>
                  <div class="btn-row">
                    <button class="btn-changes" on:click={handleRequestChanges} disabled={!changesComment.trim() || saving}>
                      Submit change request
                    </button>
                    <button class="btn-cancel-small" on:click={() => { showChangesRequest = false; changesComment = ''; }}>
                      Cancel
                    </button>
                  </div>
                </div>
              {/if}
            </div>
          {/if}

          <!-- Submit for approval button (visible to all when draft or changes_requested) -->
          {#if quote.status === 'draft' || quote.status === 'changes_requested'}
            <div class="submit-approval-section">
              <label class="field-label">Note for approvers (optional)</label>
              <input type="text" bind:value={noteToApprovers} placeholder="E.g. Prices verified, ready for approval" />
              <button class="btn-submit-approval" on:click={handleSubmitForApproval} disabled={saving}>
                📨 Submit for approval
              </button>
            </div>
          {/if}

          <!-- Send to client (only when approved) -->
          {#if quote.status === 'approved' || quote.status === 'sent_to_client'}
            <div class="send-to-client-section">
              {#if quote.status === 'approved'}
                <button class="btn-send-client" on:click={handleSendToClient} disabled={saving}>
                  📤 Send quote to client
                </button>
              {:else if quote.status === 'sent_to_client'}
                <div class="sent-confirmation">
                  <span class="sent-badge">📨 Sent to client</span>
                  {#if quote.sentToClientAt}
                    <span class="sent-date">{new Date(quote.sentToClientAt).toLocaleString('es')}</span>
                  {/if}
                </div>
              {/if}
              {#if sentLink}
                <p class="sent-link-label">Client link:</p>
                <a href={sentLink} target="_blank" class="sent-link">{sentLink}</a>
              {/if}
            </div>
          {/if}

          <!-- Comments thread -->
          {#if Array.isArray(quote.comments) && quote.comments.length > 0}
            <div class="comments-section">
              <h4 class="section-title">Comments</h4>
              {#each quote.comments as comment (comment.commentId)}
                <div class="comment-item" class:resolved={comment.resolved}>
                  <div class="comment-header">
                    <strong>{comment.authorEmail}</strong>
                    <span class="comment-date">{new Date(comment.createdAt).toLocaleString('es')}</span>
                    {#if comment.resolved}
                      <span class="resolved-badge">Resolved ✓</span>
                    {:else}
                      <button class="resolve-btn" on:click={() => handleResolveComment(comment.commentId)}>
                        Mark as resolved
                      </button>
                    {/if}
                  </div>
                  <p class="comment-text">{comment.text}</p>
                </div>
              {/each}
            </div>
          {/if}

          <!-- Add comment -->
          <div class="add-comment-section">
            <input type="text" bind:value={newCommentText} placeholder="Add a comment..." on:keydown={e => e.key === 'Enter' && handleAddComment()} />
            <button class="btn-comment" on:click={handleAddComment} disabled={!newCommentText.trim() || saving}>
              💬
            </button>
          </div>

          <!-- Change log (collapsible) -->
          {#if Array.isArray(quote.changeLog) && quote.changeLog.length > 0}
            <details class="changelog-section">
              <summary>Change history ({quote.changeLog.length})</summary>
              {#each [...quote.changeLog].reverse() as entry (entry.changeId)}
                <div class="log-entry">
                  <span class="log-actor">{entry.actor}</span>
                  <span class="log-summary">{entry.summary}</span>
                  <span class="log-date">{new Date(entry.timestamp).toLocaleString('es')}</span>
                </div>
              {/each}
            </details>
          {/if}
        </div>
      {/if}

      <!-- ── Line-item template manager (modal) ─────────────────────────────── -->
      {#if manageOpen}
        <div class="qe-tmpl-backdrop" on:click|self={() => (manageOpen = false)} role="presentation">
          <div class="qe-tmpl-modal" role="dialog" aria-modal="true" aria-label="Line-item templates">
            <div class="qe-tmpl-modal__head">
              <div class="qe-tmpl-modal__titlewrap">
                <span class="qe-tmpl-modal__spark" aria-hidden="true">✦</span>
                <h4 class="qe-tmpl-modal__title">Line-item templates</h4>
              </div>
              <button type="button" class="qe-tmpl-modal__close" on:click={() => (manageOpen = false)} aria-label="Close">✕</button>
            </div>

            <div class="qe-tmpl-modal__body">
              <!-- Saved templates list -->
              <div class="qe-tmpl-listcol">
                <div class="qe-tmpl-listcol__head">
                  <span class="qe-tmpl-listcol__label">Saved templates</span>
                  <button type="button" class="qe-tmpl-newbtn" class:is-active={tmplEditingId === null} on:click={openCreateTemplate}>+ New</button>
                </div>
                {#if lineTemplatesLoading}
                  <div class="qe-tmpl-empty">Loading…</div>
                {:else if lineTemplates.length === 0}
                  <div class="qe-tmpl-empty">No templates yet. Create your first one →</div>
                {:else}
                  <div class="qe-tmpl-list">
                    {#each lineTemplates as t (t.templateId)}
                      <div class="qe-tmpl-row" class:is-editing={tmplEditingId === t.templateId}>
                        <button type="button" class="qe-tmpl-row__main" on:click={() => openEditTemplate(t)} title="Edit this template">
                          <span class="qe-tmpl-row__name">
                            {t.name}
                            {#if t.isDefault}<span class="qe-tmpl-badge">default</span>{/if}
                          </span>
                          <span class="qe-tmpl-row__meta">{t.lines.length} lines · {t.currency}</span>
                        </button>
                        <button type="button" class="qe-tmpl-row__del" on:click={() => removeTemplate(t)} title="Delete template" aria-label="Delete template">🗑</button>
                      </div>
                    {/each}
                  </div>
                {/if}
              </div>

              <!-- Editor form -->
              <div class="qe-tmpl-formcol">
                <div class="qe-tmpl-formcol__head">
                  <span class="qe-tmpl-formcol__label">{tmplEditingId ? 'Edit template' : 'New template'}</span>
                  <button type="button" class="qe-tmpl-fromlines" on:click={seedTemplateFromCurrentLines} title="Pre-fill the lines below from the current quote">
                    ⤵ Use current lines
                  </button>
                </div>
                <div class="qe-tmpl-form__row">
                  <div class="qe-tmpl-form__field qe-tmpl-form__field--grow">
                    <label class="qe-label" for="qe-tmpl-name">Name</label>
                    <input id="qe-tmpl-name" class="qe-input qe-input--sm" type="text" placeholder="e.g. Costa Rica — Standard" bind:value={tmplName} />
                  </div>
                  <div class="qe-tmpl-form__field">
                    <label class="qe-label" for="qe-tmpl-cur">Currency</label>
                    <select id="qe-tmpl-cur" class="qe-select qe-select--sm" bind:value={tmplCurrency}>
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                      <option value="MXN">MXN</option>
                      <option value="CRC">CRC</option>
                    </select>
                  </div>
                </div>
                <div class="qe-tmpl-form__field">
                  <label class="qe-label" for="qe-tmpl-lines">Lines <span class="qe-tmpl-form__hint">one per line</span></label>
                  <textarea
                    id="qe-tmpl-lines"
                    class="qe-textarea qe-tmpl-textarea"
                    rows="12"
                    placeholder={"Fondo Compensacion\nOrigin Services\nFlete Internacional\n…"}
                    bind:value={tmplLinesText}
                  ></textarea>
                </div>
                {#if tmplError}<p class="qe-field-error">⚠ {tmplError}</p>{/if}
              </div>
            </div>

            <div class="qe-tmpl-modal__foot">
              <button type="button" class="qe-btn qe-btn--cancel" on:click={() => (manageOpen = false)} disabled={tmplSaving}>Close</button>
              <button type="button" class="qe-btn qe-btn--save" on:click={saveTemplate} disabled={tmplSaving}>
                {#if tmplSaving}<span class="qe-btn-spinner"></span> Saving…{:else}{tmplEditingId ? 'Save changes' : 'Create template'}{/if}
              </button>
            </div>
          </div>
        </div>
      {/if}

      <!-- Action buttons -->
      <div class="qe-actions">
        <button
          type="button"
          class="qe-btn qe-btn--save"
          disabled={saving}
          on:click={handleSave}
        >

          {#if saving}
            <span class="qe-btn-spinner"></span> Saving…
          {:else}
            💾 Save draft
          {/if}
        </button>
        <button
          type="button"
          class="qe-btn qe-btn--cancel"
          disabled={saving}
          on:click={handleCancel}
        >
          Cancel
        </button>
      </div>
    </div>
  {/if}
</div>

<style>
  /* ══════════════════════════════════════════════════════════════════════════
     QuoteEditor — IRP Design System
     Tokens: --irp-accent (#02b5bb), --font-paragraph (Jost), --irp-surface/border/text
     ══════════════════════════════════════════════════════════════════════════ */
  .quote-editor {
    background: var(--irp-surface, #ffffff);
    border: 1px solid var(--irp-border, rgba(0,0,0,0.08));
    border-radius: 16px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    box-shadow: 0 1px 3px rgba(0,0,0,0.06), 0 4px 20px rgba(0,0,0,0.05);
    font-family: var(--font-paragraph, 'Jost'), system-ui, sans-serif;
    color: var(--irp-text, #181818);
  }

  /* ── Header ───────────────────────────────────────────────────────────── */
  .quote-editor__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 24px;
    border-bottom: 1px solid #e2e8f0;
    background: #ffffff;
    position: sticky;
    top: 0;
    z-index: 10;
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
  }

  .quote-editor__title {
    margin: 0;
    font-size: 17px;
    font-weight: 800;
    letter-spacing: -0.03em;
    background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  /* ── Loading ──────────────────────────────────────────────────────────── */
  .quote-editor__loading {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 32px;
    color: #94a3b8;
    font-size: 13.5px;
    justify-content: center;
  }

  .qe-spinner {
    width: 18px;
    height: 18px;
    border: 2px solid #e2e8f0;
    border-top-color: #02b5bb;
    border-radius: 50%;
    animation: qe-spin 0.7s linear infinite;
    flex-shrink: 0;
  }
  @keyframes qe-spin { to { transform: rotate(360deg); } }

  /* ── Body ─────────────────────────────────────────────────────────────── */
  .quote-editor__body {
    padding: 24px;
    display: flex;
    flex-direction: column;
    gap: 20px;
    overflow-y: auto;
  }

  /* ── Field ────────────────────────────────────────────────────────────── */
  .qe-field {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .qe-field--total {
    flex-direction: row;
    align-items: center;
    gap: 12px;
    padding: 14px 18px;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 10px;
  }

  .qe-label {
    font-size: 11px;
    font-weight: 700;
    color: #94a3b8;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  .qe-required { color: #ef4444; }

  /* ── Inputs ───────────────────────────────────────────────────────────── */
  .qe-input {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    color: #0f172a;
    font-size: 14px;
    padding: 10px 14px;
    outline: none;
    transition: border-color 0.15s, box-shadow 0.15s;
    width: 100%;
    box-sizing: border-box;
    font-family: inherit;
  }
  .qe-input::placeholder { color: #94a3b8; }
  .qe-input:focus {
    border-color: rgba(2,181,187,0.48);
    box-shadow: 0 0 0 3px rgba(2,181,187,0.12);
    background: #ffffff;
  }
  .qe-input--sm { padding: 7px 10px; font-size: 13px; }
  .qe-input--num { text-align: right; max-width: 100px; font-variant-numeric: tabular-nums; }

  /* ── Select ───────────────────────────────────────────────────────────── */
  .qe-select {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    color: #0f172a;
    font-size: 14px;
    padding: 10px 10px;
    outline: none;
    cursor: pointer;
    width: 100%;
    font-family: inherit;
    transition: border-color 0.15s, box-shadow 0.15s;
  }
  .qe-select:focus {
    border-color: rgba(2,181,187,0.48);
    box-shadow: 0 0 0 3px rgba(2,181,187,0.12);
  }
  .qe-select--sm { padding: 7px 8px; font-size: 13px; }

  /* ── Textarea ─────────────────────────────────────────────────────────── */
  .qe-textarea {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    color: #0f172a;
    font-size: 14px;
    padding: 10px 14px;
    outline: none;
    resize: vertical;
    transition: border-color 0.15s, box-shadow 0.15s;
    width: 100%;
    box-sizing: border-box;
    font-family: inherit;
    line-height: 1.6;
  }
  .qe-textarea::placeholder { color: #94a3b8; }
  .qe-textarea:focus {
    border-color: rgba(2,181,187,0.48);
    box-shadow: 0 0 0 3px rgba(2,181,187,0.12);
    background: #ffffff;
  }

  /* ── Line items table ─────────────────────────────────────────────────── */
  .qe-lines-wrap {
    overflow-x: auto;
    border-radius: 10px;
    border: 1px solid #e2e8f0;
    background: #ffffff;
  }

  .qe-lines-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
    color: #0f172a;
  }

  .qe-lines-table th {
    background: #f8fafc;
    color: #94a3b8;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    padding: 9px 12px;
    text-align: left;
    border-bottom: 2px solid #f1f5f9;
  }
  .qe-th-num { text-align: right; }

  .qe-lines-table td {
    padding: 7px 8px;
    border-bottom: 1px solid #f8fafc;
    vertical-align: middle;
  }

  .qe-lines-table tbody tr:hover td { background: #fafbff; }
  .qe-lines-table tr:last-child td { border-bottom: none; }

  /* ── Delete line button ───────────────────────────────────────────────── */
  .qe-del-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    color: #94a3b8;
    cursor: pointer;
    font-size: 11px;
    padding: 0;
    border-radius: 6px;
    line-height: 1;
    transition: background 0.12s, color 0.12s, border-color 0.12s;
  }
  .qe-del-btn:hover {
    background: #fef2f2;
    border-color: #fecaca;
    color: #dc2626;
  }

  /* ── Add line button ──────────────────────────────────────────────────── */
  .qe-add-line-btn {
    background: none;
    border: 1.5px dashed rgba(2,181,187,0.22);
    color: #02b5bb;
    font-size: 12.5px;
    font-weight: 700;
    padding: 7px 14px;
    border-radius: 8px;
    cursor: pointer;
    transition: border-color 0.15s, color 0.15s, background 0.15s;
    align-self: flex-start;
    margin-top: 4px;
    letter-spacing: 0.01em;
  }
  .qe-add-line-btn:hover {
    border-color: #02b5bb;
    background: rgba(2,181,187,0.08);
    color: #02999e;
  }

  /* ── Total display ────────────────────────────────────────────────────── */
  .qe-total {
    font-size: 22px;
    font-weight: 800;
    color: #0f172a;
    font-variant-numeric: tabular-nums;
    letter-spacing: -0.03em;
    margin-left: auto;
  }

  /* ── Provider tags ────────────────────────────────────────────────────── */
  .qe-provider-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 6px;
  }

  .qe-provider-tag {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    background: rgba(2,181,187,0.08);
    border: 1px solid rgba(2,181,187,0.22);
    color: #02999e;
    font-size: 12px;
    font-weight: 600;
    padding: 3px 10px;
    border-radius: 999px;
    transition: background 0.14s;
  }
  .qe-provider-tag:hover { background: rgba(2,181,187,0.14); }

  .qe-provider-tag__remove {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: none;
    border: none;
    color: rgba(2,181,187,0.48);
    cursor: pointer;
    font-size: 11px;
    padding: 0;
    line-height: 1;
    opacity: 0.8;
    border-radius: 50%;
    transition: opacity 0.12s, color 0.12s;
  }
  .qe-provider-tag__remove:hover { opacity: 1; color: #02999e; }

  /* ── Provider search box ──────────────────────────────────────────────── */
  .qe-provider-search {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 0;
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    overflow: hidden;
  }
  .qe-provider-search .qe-input {
    border: none;
    border-radius: 0;
    background: #ffffff;
  }
  .qe-provider-search .qe-input:focus {
    box-shadow: none;
    border-bottom: 1px solid rgba(2,181,187,0.22);
  }

  .qe-provider-searching {
    font-size: 11.5px;
    color: #94a3b8;
    padding: 6px 14px;
    background: #f8fafc;
  }

  .qe-provider-results {
    background: #ffffff;
    border-top: 1px solid #e2e8f0;
    max-height: 180px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
  }

  .qe-provider-result {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 9px 14px;
    cursor: pointer;
    font-size: 13px;
    color: #0f172a;
    transition: background 0.12s;
    border-bottom: 1px solid #f1f5f9;
  }
  .qe-provider-result:last-child { border-bottom: none; }
  .qe-provider-result:hover { background: #f8fafc; }
  .qe-provider-result input[type="checkbox"] { accent-color: #02b5bb; flex-shrink: 0; }
  .qe-provider-result__name { font-weight: 600; flex: 1; color: #0f172a; }
  .qe-provider-result__meta { color: #94a3b8; font-size: 11.5px; white-space: nowrap; }

  /* ── Error message ────────────────────────────────────────────────────── */
  .qe-error {
    background: #fef2f2;
    border: 1px solid #fecaca;
    border-radius: 8px;
    color: #dc2626;
    font-size: 13px;
    font-weight: 600;
    padding: 10px 14px;
  }

  /* ── Actions row ──────────────────────────────────────────────────────── */
  .qe-actions {
    display: flex;
    gap: 10px;
    padding: 16px 24px;
    border-top: 1px solid #e2e8f0;
    background: #ffffff;
    margin: 0 -24px -20px;
  }

  .qe-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    border: none;
    border-radius: 999px;
    font-size: 14px;
    font-weight: 700;
    padding: 10px 22px;
    cursor: pointer;
    transition: box-shadow 0.18s, transform 0.18s, filter 0.18s, background 0.15s;
    letter-spacing: -0.01em;
  }
  .qe-btn:disabled { opacity: 0.55; cursor: not-allowed; transform: none !important; }

  .qe-btn--save {
    background: linear-gradient(135deg, #02b5bb 0%, #02999e 100%);
    color: #fff;
    box-shadow: 0 2px 8px rgba(2,181,187,0.28);
  }
  .qe-btn--save:not(:disabled):hover {
    filter: brightness(1.07);
    box-shadow: 0 4px 16px rgba(2,181,187,0.38);
    transform: translateY(-1px);
  }

  .qe-btn--cancel {
    background: #f1f5f9;
    color: #475569;
    border: 1px solid #e2e8f0;
  }
  .qe-btn--cancel:not(:disabled):hover {
    background: #e2e8f0;
    color: #0f172a;
    transform: translateY(-1px);
  }

  .qe-btn-spinner {
    display: inline-block;
    width: 13px;
    height: 13px;
    border: 2px solid rgba(255,255,255,0.35);
    border-top-color: #fff;
    border-radius: 50%;
    animation: qe-spin 0.6s linear infinite;
  }

  /* ── Approval workflow ────────────────────────────────────────────────── */
  .approval-section {
    margin-top: 4px;
    border-top: 2px solid #f1f5f9;
    padding-top: 20px;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  /* Status banner */
  .status-banner {
    padding: 10px 16px;
    border-radius: 10px;
    font-size: 13.5px;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 8px;
    border: 1px solid transparent;
  }
  .status-banner.status-draft {
    background: #f1f5f9;
    color: #64748b;
    border-color: #e2e8f0;
  }
  .status-banner.status-pending_approval {
    background: #fffbeb;
    color: #d97706;
    border-color: #fde68a;
  }
  .status-banner.status-changes_requested {
    background: #fef2f2;
    color: #dc2626;
    border-color: #fecaca;
  }
  .status-banner.status-approved {
    background: #f0fdf4;
    color: #16a34a;
    border-color: #bbf7d0;
  }
  .status-banner.status-sent_to_client {
    background: rgba(2,181,187,0.07);
    color: #02999e;
    border-color: rgba(2,181,187,0.22);
  }
  .status-banner.status-client_accepted {
    background: #f0fdf4;
    color: #059669;
    border-color: #6ee7b7;
  }
  .check { color: #16a34a; }

  /* Approver actions box */
  .approver-actions {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .approver-hint {
    font-size: 12.5px;
    color: #64748b;
    margin: 0;
    font-weight: 500;
  }
  .btn-row { display: flex; gap: 8px; flex-wrap: wrap; }

  .btn-approve {
    background: linear-gradient(135deg, #16a34a 0%, #059669 100%);
    color: #fff;
    border: none;
    padding: 9px 18px;
    border-radius: 8px;
    cursor: pointer;
    font-weight: 700;
    font-size: 13px;
    transition: filter 0.15s, box-shadow 0.15s;
    box-shadow: 0 2px 8px rgba(22,163,74,0.22);
  }
  .btn-approve:hover:not(:disabled) {
    filter: brightness(1.08);
    box-shadow: 0 4px 14px rgba(22,163,74,0.30);
  }

  .btn-changes {
    background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
    color: #fff;
    border: none;
    padding: 9px 18px;
    border-radius: 8px;
    cursor: pointer;
    font-weight: 700;
    font-size: 13px;
    transition: filter 0.15s, box-shadow 0.15s;
    box-shadow: 0 2px 8px rgba(245,158,11,0.22);
  }
  .btn-changes:hover:not(:disabled) {
    filter: brightness(1.08);
    box-shadow: 0 4px 14px rgba(245,158,11,0.30);
  }

  .btn-cancel-small {
    background: #f1f5f9;
    color: #475569;
    border: 1px solid #e2e8f0;
    padding: 9px 18px;
    border-radius: 8px;
    cursor: pointer;
    font-size: 13px;
    font-weight: 600;
    transition: background 0.14s;
  }
  .btn-cancel-small:hover { background: #e2e8f0; color: #0f172a; }

  .changes-request-box {
    margin-top: 4px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .changes-request-box textarea {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    color: #0f172a;
    font-size: 13.5px;
    padding: 10px 14px;
    outline: none;
    resize: vertical;
    width: 100%;
    box-sizing: border-box;
    font-family: inherit;
    line-height: 1.6;
    transition: border-color 0.15s, box-shadow 0.15s;
  }
  .changes-request-box textarea:focus {
    border-color: rgba(2,181,187,0.48);
    box-shadow: 0 0 0 3px rgba(2,181,187,0.12);
    background: #fff;
  }

  /* Submit for approval */
  .submit-approval-section {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 16px;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
  }
  .submit-approval-section input[type="text"] {
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    color: #0f172a;
    font-size: 13.5px;
    padding: 9px 14px;
    outline: none;
    width: 100%;
    box-sizing: border-box;
    font-family: inherit;
    transition: border-color 0.15s, box-shadow 0.15s;
  }
  .submit-approval-section input[type="text"]:focus {
    border-color: rgba(2,181,187,0.48);
    box-shadow: 0 0 0 3px rgba(2,181,187,0.12);
  }

  .field-label {
    font-size: 11px;
    font-weight: 700;
    color: #94a3b8;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  .btn-submit-approval {
    background: linear-gradient(135deg, #02b5bb 0%, #02999e 100%);
    color: #fff;
    border: none;
    padding: 9px 18px;
    border-radius: 8px;
    cursor: pointer;
    font-weight: 700;
    font-size: 13px;
    width: fit-content;
    box-shadow: 0 2px 8px rgba(2,181,187,0.25);
    transition: filter 0.15s, box-shadow 0.15s;
  }
  .btn-submit-approval:hover:not(:disabled) {
    filter: brightness(1.07);
    box-shadow: 0 4px 14px rgba(2,181,187,0.35);
  }

  /* Send to client section */
  .send-to-client-section {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 16px;
    background: #f0fdf4;
    border: 1px solid #bbf7d0;
    border-radius: 12px;
  }

  .btn-send-client {
    background: linear-gradient(135deg, #0d9488 0%, #059669 100%);
    color: #fff;
    border: none;
    padding: 10px 20px;
    border-radius: 8px;
    cursor: pointer;
    font-weight: 700;
    font-size: 13.5px;
    width: fit-content;
    box-shadow: 0 2px 8px rgba(13,148,136,0.25);
    transition: filter 0.15s, box-shadow 0.15s;
  }
  .btn-send-client:hover:not(:disabled) {
    filter: brightness(1.08);
    box-shadow: 0 4px 14px rgba(13,148,136,0.32);
  }

  .sent-confirmation { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  .sent-badge {
    color: #059669;
    font-weight: 700;
    font-size: 13.5px;
    background: #d1fae5;
    padding: 4px 12px;
    border-radius: 999px;
    border: 1px solid #6ee7b7;
  }
  .sent-date { color: #64748b; font-size: 12px; }
  .sent-link-label { font-size: 11.5px; color: #94a3b8; margin: 0; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; }
  .sent-link { font-size: 12px; color: #02b5bb; word-break: break-all; text-decoration: underline; }

  /* Comments section */
  .comments-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .section-title {
    font-size: 11px;
    font-weight: 700;
    color: #94a3b8;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin: 0 0 4px;
  }

  .comment-item {
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-left: 3px solid #02b5bb;
    padding: 12px 14px;
    border-radius: 8px;
    transition: opacity 0.15s;
  }
  .comment-item.resolved {
    opacity: 0.5;
    border-left-color: #94a3b8;
  }
  .comment-header {
    display: flex;
    gap: 8px;
    align-items: center;
    flex-wrap: wrap;
    margin-bottom: 5px;
    font-size: 12px;
    color: #64748b;
  }
  .comment-header strong { color: #0f172a; }
  .comment-text { margin: 0; font-size: 13px; color: #334155; line-height: 1.55; }
  .comment-date { font-size: 11px; color: #94a3b8; }
  .resolved-badge {
    color: #059669;
    font-size: 11px;
    font-weight: 700;
    background: #d1fae5;
    padding: 1px 7px;
    border-radius: 999px;
    border: 1px solid #6ee7b7;
  }
  .resolve-btn {
    background: #f1f5f9;
    border: 1px solid #e2e8f0;
    color: #64748b;
    padding: 2px 10px;
    border-radius: 5px;
    cursor: pointer;
    font-size: 11px;
    font-weight: 600;
    transition: background 0.12s, color 0.12s;
  }
  .resolve-btn:hover { background: #e2e8f0; color: #0f172a; }

  /* Add comment row */
  .add-comment-section {
    display: flex;
    gap: 8px;
    align-items: stretch;
  }
  .add-comment-section input {
    flex: 1;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    color: #0f172a;
    font-size: 13.5px;
    padding: 9px 14px;
    outline: none;
    font-family: inherit;
    transition: border-color 0.15s, box-shadow 0.15s;
  }
  .add-comment-section input:focus {
    border-color: rgba(2,181,187,0.48);
    box-shadow: 0 0 0 3px rgba(2,181,187,0.12);
    background: #fff;
  }
  .add-comment-section input::placeholder { color: #94a3b8; }
  .btn-comment {
    background: rgba(2,181,187,0.08);
    border: 1px solid rgba(2,181,187,0.22);
    color: #02b5bb;
    padding: 9px 14px;
    border-radius: 8px;
    cursor: pointer;
    font-size: 16px;
    font-weight: 700;
    line-height: 1;
    transition: background 0.14s, border-color 0.14s;
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  .btn-comment:hover:not(:disabled) { background: rgba(2,181,187,0.14); border-color: rgba(2,181,187,0.35); }
  .btn-comment:disabled { opacity: 0.5; cursor: not-allowed; }

  /* Changelog */
  .changelog-section { margin-top: 4px; }
  .changelog-section summary {
    cursor: pointer;
    font-size: 11.5px;
    color: #94a3b8;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    padding: 4px 0;
    user-select: none;
    list-style: none;
  }
  .changelog-section summary::-webkit-details-marker { display: none; }
  .changelog-section summary::before {
    content: '▸ ';
    font-size: 10px;
    display: inline-block;
    transition: transform 0.15s;
  }
  .changelog-section[open] summary::before { transform: rotate(90deg); }

  .log-entry {
    display: flex;
    gap: 8px;
    padding: 5px 0;
    font-size: 11.5px;
    color: #64748b;
    border-bottom: 1px solid #f1f5f9;
    flex-wrap: wrap;
    align-items: baseline;
  }
  .log-actor {
    color: #02b5bb;
    font-weight: 700;
    font-family: 'SF Mono', 'JetBrains Mono', 'Fira Code', monospace;
    font-size: 11px;
  }
  .log-summary { flex: 1; color: #334155; }
  .log-date { color: #94a3b8; font-size: 10.5px; white-space: nowrap; }

  /* ── Service-type field ─────────────────────────────────────────────────── */
  .qe-label--required::after { content: ' *'; color: #ef4444; font-size: 11px; }
  .qe-field--error .qe-label,
  .qe-field--error .qe-label--required { color: #dc2626; }
  .qe-select--error {
    border-color: #ef4444 !important;
    box-shadow: 0 0 0 3px rgba(239,68,68,0.15) !important;
  }
  .qe-field-error {
    margin: 5px 0 0;
    font-size: 12px;
    color: #dc2626;
    font-weight: 600;
    animation: qe-shake 0.3s ease;
  }
  @keyframes qe-shake {
    0%,100% { transform: translateX(0); }
    25%      { transform: translateX(-4px); }
    75%      { transform: translateX(4px); }
  }
  .qe-field-hint { margin: 5px 0 0; font-size: 11.5px; color: #64748b; line-height: 1.4; }
  .qe-insights-spinner {
    display: inline-block;
    width: 12px; height: 12px;
    border: 2px solid rgba(2,181,187,0.2);
    border-top-color: #02b5bb;
    border-radius: 50%;
    animation: qe-spin 0.7s linear infinite;
    vertical-align: middle;
    margin-left: 4px;
  }

  /* ── Margin % column / field ────────────────────────────────────────────── */
  .qe-pct-wrap { display: flex; align-items: center; gap: 3px; }
  .qe-pct-wrap--field { gap: 6px; }
  .qe-pct-sym { font-size: 12px; color: #64748b; font-weight: 600; flex-shrink: 0; }
  .qe-input--pct { width: 68px !important; max-width: 68px; }
  /* ── Margin mode cell (per-line toggle % ↔ flat $) ── */
  .qe-margin-cell { display: flex; align-items: center; gap: 3px; }
  .qe-input--margin { width: 68px !important; max-width: 68px; }
  .qe-margin-mode-btn {
    display: inline-flex; align-items: center; justify-content: center;
    min-width: 28px; height: 28px; padding: 0 5px;
    border-radius: 6px;
    border: 1.5px solid #e2e8f0;
    background: #f8fafc;
    color: #64748b;
    font-size: 11px; font-weight: 700;
    cursor: pointer;
    transition: background 0.12s, border-color 0.12s, color 0.12s;
    flex-shrink: 0; white-space: nowrap;
  }
  .qe-margin-mode-btn--pct {
    background: rgba(2,181,187,0.08);
    border-color: rgba(2,181,187,0.25);
    color: #02b5bb;
  }
  .qe-margin-mode-btn:hover {
    background: rgba(2,181,187,0.12);
    border-color: rgba(2,181,187,0.38);
    color: #02999e;
  }
  .qe-th-pct  { width: 110px; }
  .qe-th-price { width: 108px; color: #02b5bb !important; }
  .qe-th-cur  { width: 82px; }
  .qe-th-notes { min-width: 130px; }
  .qe-th-del  { width: 36px; }
  .qe-td-pct  { white-space: nowrap; }
  .qe-td-price { text-align: right; }
  .qe-computed-price {
    display: inline-block;
    min-width: 72px;
    padding: 4px 8px;
    background: rgba(2,181,187,0.07);
    border: 1px solid rgba(2,181,187,0.18);
    border-radius: 6px;
    font-size: 13px;
    font-weight: 700;
    color: #02b5bb;
    text-align: right;
    font-variant-numeric: tabular-nums;
  }

  /* ── Finance footer ─────────────────────────────────────────────────────── */
  .qe-finance-footer {
    display: flex;
    align-items: stretch;
    border-radius: 14px;
    overflow: hidden;
    border: 1px solid var(--irp-border, rgba(0,0,0,0.08));
    background: var(--irp-surface, #fff);
    box-shadow: 0 2px 12px rgba(0,0,0,0.04);
    margin-top: 4px;
  }
  .qe-finance-cell {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 14px 20px 12px;
    gap: 3px;
  }
  .qe-finance-cell--total { background: rgba(2,181,187,0.04); }
  .qe-finance-cell--earn  { background: rgba(34,197,94,0.04); }
  .qe-finance-sep { width: 1px; background: var(--irp-border, rgba(0,0,0,0.08)); flex-shrink: 0; }
  .qe-finance-label {
    font-size: 9.5px;
    font-weight: 700;
    letter-spacing: 0.07em;
    text-transform: uppercase;
    color: #94a3b8;
  }
  .qe-finance-value {
    font-size: 20px;
    font-weight: 800;
    color: var(--irp-text, #181818);
    font-variant-numeric: tabular-nums;
    line-height: 1;
  }
  .qe-finance-value--accent { color: #02b5bb; }
  .qe-finance-value--earn   { color: #22c55e; }
  .qe-finance-hint { font-size: 10px; color: #94a3b8; font-weight: 500; }

  /* ── Client description badge ───────────────────────────────────────────── */
  .qe-label-badge {
    display: inline-block;
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    padding: 2px 6px;
    border-radius: 20px;
    background: rgba(2,181,187,0.10);
    color: #02b5bb;
    border: 1px solid rgba(2,181,187,0.22);
    vertical-align: middle;
    margin-left: 6px;
  }

  /* ── Default margin inline row ──────────────────────────────────────────── */
  .qe-field--inline {
    flex-direction: row;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }
  .qe-field--inline .qe-label { margin: 0; white-space: nowrap; }
  .qe-field--inline .qe-field-hint { flex: 1 0 100%; }

  /* ══════════════════════════════════════════════════════════════════════════
     Line-item templates — selector bar + manager modal (ultra-modern, on-brand)
     ══════════════════════════════════════════════════════════════════════════ */
  .qe-lines-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
  }

  .qe-tmpl-bar {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  /* Template apply dropdown — pill with a leading spark glyph */
  .qe-tmpl-select-wrap {
    position: relative;
    display: inline-flex;
    align-items: center;
  }
  .qe-tmpl-spark {
    position: absolute;
    left: 11px;
    font-size: 11px;
    color: #02b5bb;
    pointer-events: none;
    filter: drop-shadow(0 0 4px rgba(2,181,187,0.35));
  }
  .qe-tmpl-select {
    appearance: none;
    -webkit-appearance: none;
    background:
      linear-gradient(135deg, rgba(2,181,187,0.06), rgba(2,181,187,0.02)),
      #ffffff;
    border: 1px solid rgba(2,181,187,0.28);
    border-radius: 999px;
    color: #0b3b3d;
    font-family: inherit;
    font-size: 12.5px;
    font-weight: 600;
    padding: 7px 30px 7px 28px;
    cursor: pointer;
    outline: none;
    transition: border-color 0.15s, box-shadow 0.15s, background 0.15s;
    background-repeat: no-repeat;
  }
  .qe-tmpl-select:hover:not(:disabled) {
    border-color: rgba(2,181,187,0.5);
    box-shadow: 0 2px 10px rgba(2,181,187,0.16);
  }
  .qe-tmpl-select:focus {
    border-color: rgba(2,181,187,0.6);
    box-shadow: 0 0 0 3px rgba(2,181,187,0.14);
  }
  .qe-tmpl-select:disabled { opacity: 0.6; cursor: progress; }

  /* Manage button — subtle ghost that lifts on hover */
  .qe-tmpl-manage-btn {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 999px;
    color: #475569;
    font-family: inherit;
    font-size: 12.5px;
    font-weight: 700;
    padding: 7px 14px;
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s, color 0.15s, transform 0.15s;
  }
  .qe-tmpl-manage-btn:hover {
    background: rgba(2,181,187,0.08);
    border-color: rgba(2,181,187,0.3);
    color: #02999e;
    transform: translateY(-1px);
  }
  .qe-tmpl-manage-gear { font-size: 12px; line-height: 1; }

  /* ── Modal ───────────────────────────────────────────────────────────────── */
  .qe-tmpl-backdrop {
    position: fixed;
    inset: 0;
    z-index: 1000;
    background: rgba(11,59,61,0.34);
    backdrop-filter: blur(5px);
    -webkit-backdrop-filter: blur(5px);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    animation: qe-tmpl-fade 0.18s ease;
  }
  @keyframes qe-tmpl-fade { from { opacity: 0; } to { opacity: 1; } }

  .qe-tmpl-modal {
    width: min(760px, 100%);
    max-height: min(86vh, 720px);
    display: flex;
    flex-direction: column;
    background: #ffffff;
    border: 1px solid rgba(2,181,187,0.16);
    border-radius: 18px;
    overflow: hidden;
    box-shadow: 0 24px 70px rgba(11,59,61,0.28), 0 4px 18px rgba(0,0,0,0.08);
    animation: qe-tmpl-pop 0.2s cubic-bezier(0.16,1,0.3,1);
  }
  @keyframes qe-tmpl-pop {
    from { opacity: 0; transform: translateY(10px) scale(0.985); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
  }

  .qe-tmpl-modal__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid #eef2f6;
    background: linear-gradient(135deg, rgba(2,181,187,0.07), rgba(2,181,187,0));
  }
  .qe-tmpl-modal__titlewrap { display: flex; align-items: center; gap: 9px; }
  .qe-tmpl-modal__spark {
    font-size: 14px;
    color: #02b5bb;
    filter: drop-shadow(0 0 6px rgba(2,181,187,0.4));
  }
  .qe-tmpl-modal__title {
    margin: 0;
    font-size: 15px;
    font-weight: 800;
    letter-spacing: -0.02em;
    color: #0b3b3d;
  }
  .qe-tmpl-modal__close {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    border-radius: 9px;
    border: 1px solid #e2e8f0;
    background: #ffffff;
    color: #94a3b8;
    cursor: pointer;
    font-size: 13px;
    transition: background 0.12s, color 0.12s, border-color 0.12s;
  }
  .qe-tmpl-modal__close:hover { background: #fef2f2; border-color: #fecaca; color: #dc2626; }

  .qe-tmpl-modal__body {
    display: grid;
    grid-template-columns: 248px 1fr;
    gap: 0;
    min-height: 0;
    flex: 1;
    overflow: hidden;
  }

  /* Saved templates column */
  .qe-tmpl-listcol {
    display: flex;
    flex-direction: column;
    border-right: 1px solid #eef2f6;
    background: #fbfdfe;
    min-height: 0;
  }
  .qe-tmpl-listcol__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 14px 8px;
  }
  .qe-tmpl-listcol__label,
  .qe-tmpl-formcol__label {
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.09em;
    text-transform: uppercase;
    color: #94a3b8;
  }
  .qe-tmpl-newbtn {
    background: rgba(2,181,187,0.08);
    border: 1px solid rgba(2,181,187,0.22);
    color: #02999e;
    border-radius: 7px;
    font-size: 11.5px;
    font-weight: 700;
    padding: 4px 10px;
    cursor: pointer;
    transition: background 0.13s, border-color 0.13s;
  }
  .qe-tmpl-newbtn:hover, .qe-tmpl-newbtn.is-active {
    background: rgba(2,181,187,0.16);
    border-color: rgba(2,181,187,0.4);
  }

  .qe-tmpl-empty {
    padding: 18px 14px;
    color: #94a3b8;
    font-size: 12px;
    line-height: 1.5;
  }

  .qe-tmpl-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 0 8px 12px;
    overflow-y: auto;
  }
  .qe-tmpl-row {
    display: flex;
    align-items: stretch;
    gap: 2px;
    border-radius: 10px;
    border: 1px solid transparent;
    transition: background 0.12s, border-color 0.12s;
  }
  .qe-tmpl-row:hover { background: #ffffff; border-color: #e2e8f0; }
  .qe-tmpl-row.is-editing {
    background: #ffffff;
    border-color: rgba(2,181,187,0.4);
    box-shadow: 0 0 0 3px rgba(2,181,187,0.1);
  }
  .qe-tmpl-row__main {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
    align-items: flex-start;
    background: none;
    border: none;
    cursor: pointer;
    padding: 9px 10px;
    text-align: left;
    min-width: 0;
  }
  .qe-tmpl-row__name {
    font-size: 13px;
    font-weight: 700;
    color: #0f172a;
    display: flex;
    align-items: center;
    gap: 6px;
    max-width: 100%;
  }
  .qe-tmpl-badge {
    font-size: 8.5px;
    font-weight: 800;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: #02999e;
    background: rgba(2,181,187,0.12);
    border: 1px solid rgba(2,181,187,0.25);
    border-radius: 20px;
    padding: 1px 6px;
  }
  .qe-tmpl-row__meta { font-size: 11px; color: #94a3b8; }
  .qe-tmpl-row__del {
    align-self: center;
    background: none;
    border: none;
    color: #cbd5e1;
    cursor: pointer;
    font-size: 13px;
    padding: 6px 9px;
    border-radius: 8px;
    transition: background 0.12s, color 0.12s;
  }
  .qe-tmpl-row__del:hover { background: #fef2f2; color: #dc2626; }

  /* Editor form column */
  .qe-tmpl-formcol {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 14px 16px 16px;
    overflow-y: auto;
    min-height: 0;
  }
  .qe-tmpl-formcol__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  }
  .qe-tmpl-fromlines {
    background: none;
    border: 1px dashed rgba(2,181,187,0.3);
    color: #02999e;
    border-radius: 7px;
    font-size: 11px;
    font-weight: 700;
    padding: 4px 9px;
    cursor: pointer;
    transition: background 0.13s, border-color 0.13s;
  }
  .qe-tmpl-fromlines:hover { background: rgba(2,181,187,0.08); border-color: rgba(2,181,187,0.5); }

  .qe-tmpl-form__row { display: flex; gap: 10px; align-items: flex-end; }
  .qe-tmpl-form__field { display: flex; flex-direction: column; gap: 5px; }
  .qe-tmpl-form__field--grow { flex: 1; }
  .qe-tmpl-form__hint { text-transform: none; letter-spacing: 0; color: #cbd5e1; font-weight: 600; margin-left: 4px; }
  .qe-tmpl-textarea {
    font-family: 'SF Mono', 'JetBrains Mono', 'Fira Code', ui-monospace, monospace;
    font-size: 12.5px;
    line-height: 1.7;
    min-height: 180px;
  }

  .qe-tmpl-modal__foot {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 10px;
    padding: 14px 20px;
    border-top: 1px solid #eef2f6;
    background: #fbfdfe;
  }

  @media (max-width: 560px) {
    .qe-tmpl-modal__body { grid-template-columns: 1fr; }
    .qe-tmpl-listcol { border-right: none; border-bottom: 1px solid #eef2f6; max-height: 180px; }
  }
</style>

