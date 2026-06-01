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
    QUOTE_APPROVERS_EMAILS,
    QUOTE_STATUS_LABEL,
  } from '../store.ts';
  import type { Quote, QuoteLineItem } from '../store.ts';

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

  // ── Approval workflow state ────────────────────────────────────────────────
  let quote: Quote | null = null;
  let noteToApprovers = '';
  let sentLink = '';
  let newCommentText = '';
  let showChangesRequest = false;
  let changesComment = '';
  // Alias error to errorMsg for approval handlers
  $: error = errorMsg;

  // ── Computed total ─────────────────────────────────────────────────────────
  $: total = lineItems.reduce((sum, li) => sum + (Number(li.amount) || 0), 0);

  // ── Line item helpers ──────────────────────────────────────────────────────
  function makeLineId(): string {
    return 'li_' + Math.random().toString(36).slice(2, 10);
  }

  function addLine() {
    lineItems = [
      ...lineItems,
      { lineId: makeLineId(), label: '', amount: 0, currency: 'USD', providerId: null, notes: null },
    ];
  }

  function removeLine(lineId: string) {
    lineItems = lineItems.filter(li => li.lineId !== lineId);
  }

  function updateLine(lineId: string, field: keyof QuoteLineItem, value: any) {
    lineItems = lineItems.map(li => li.lineId === lineId ? { ...li, [field]: value } : li);
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
      lineItems = (q.lineItems ?? []).map(li => ({ ...li }));
      providerIds = [...(q.providerIds ?? [])];
      providerSnapshots = [...(q.providerSnapshots ?? [])];
      if (lineItems.length === 0) addLine();
    } catch (err: any) {
      errorMsg = 'Error al cargar cotización: ' + (err?.message ?? err);
    } finally {
      loadingQuote = false;
    }
  }

  onMount(() => { loadQuote(); });

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
    if (!title.trim()) { errorMsg = 'El título es obligatorio.'; return; }
    saving = true;
    errorMsg = '';
    try {
      const payload: Partial<Quote> = {
        title: title.trim(),
        notes: notes.trim() || null,
        lineItems,
        providerIds,
        providerSnapshots,
        total,
        currency: 'USD',
        status: 'draft',
      };
      if (quoteId) {
        await updateQuote(clientId, quoteId, payload);
      } else {
        await createQuote(clientId, payload);
      }
      dispatch('saved');
    } catch (err: any) {
      errorMsg = 'Error al guardar: ' + (err?.message ?? err);
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
      errorMsg = e.message ?? 'Error al enviar para aprobación';
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
      errorMsg = e.message ?? 'Error al aprobar';
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
      errorMsg = e.message ?? 'Error al solicitar cambios';
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
      errorMsg = e.message ?? 'Error al agregar comentario';
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
      errorMsg = e.message ?? 'Error al resolver comentario';
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
      error = e.message ?? 'Error al enviar al cliente';
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
    <h3 class="quote-editor__title">{quoteId ? 'Editar Cotización' : 'Nueva Cotización'}</h3>
  </div>

  {#if loadingQuote}
    <div class="quote-editor__loading">
      <div class="qe-spinner"></div>
      <span>Cargando…</span>
    </div>
  {:else}
    <div class="quote-editor__body">

      <!-- Title -->
      <div class="qe-field">
        <label class="qe-label" for="qe-title">Título <span class="qe-required">*</span></label>
        <input
          id="qe-title"
          class="qe-input"
          type="text"
          placeholder="Cotización Inicial"
          bind:value={title}
        />
      </div>

      <!-- Line items -->
      <div class="qe-field">
        <label class="qe-label">Líneas de cotización</label>
        {#if lineItems.length > 0}
          <div class="qe-lines-wrap">
            <table class="qe-lines-table">
              <thead>
                <tr>
                  <th>Descripción</th>
                  <th class="qe-th-num">Monto</th>
                  <th>Moneda</th>
                  <th>Notas</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {#each lineItems as li (li.lineId)}
                  <tr>
                    <td>
                      <input
                        class="qe-input qe-input--sm"
                        type="text"
                        placeholder="Descripción"
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
                        placeholder="Nota opcional"
                        value={li.notes ?? ''}
                        on:input={(e) => updateLine(li.lineId, 'notes', (e.target as HTMLInputElement).value || null)}
                      />
                    </td>
                    <td>
                      <button
                        type="button"
                        class="qe-del-btn"
                        title="Eliminar línea"
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
          + Agregar línea
        </button>
      </div>

      <!-- Total display -->
      <div class="qe-field qe-field--total">
        <span class="qe-label">Total estimado</span>
        <span class="qe-total">{formatTotal(total)}</span>
      </div>

      <!-- Provider search -->
      <div class="qe-field">
        <label class="qe-label" for="qe-prov-search">Proveedores (opcional)</label>

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
            placeholder="Buscar proveedor…"
            bind:value={providerSearchQuery}
            on:input={onProviderSearchInput}
          />
          {#if providerSearchLoading}
            <span class="qe-provider-searching">Buscando…</span>
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

      <!-- Notes -->
      <div class="qe-field">
        <label class="qe-label" for="qe-notes">Nota interna</label>
        <textarea
          id="qe-notes"
          class="qe-textarea"
          placeholder="Nota interna…"
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
            <strong>Estado:</strong>
            {QUOTE_STATUS_LABEL[quote.status]?.label ?? quote.status}
            {#if quote.status === 'approved'}<span class="check">✓</span>{/if}
          </div>

          <!-- Approver actions (only visible to approvers when pending_approval) -->
          {#if quote.status === 'pending_approval' && $authEmail && QUOTE_APPROVERS_EMAILS.has($authEmail)}
            <div class="approver-actions">
              <p class="approver-hint">Sos aprobador/a — podés aprobar o pedir cambios:</p>
              <div class="btn-row">
                <button class="btn-approve" on:click={handleApprove} disabled={saving}>
                  ✅ Aprobar cotización
                </button>
                <button class="btn-changes" on:click={() => showChangesRequest = true} disabled={saving}>
                  ✏️ Pedir cambios
                </button>
              </div>
              {#if showChangesRequest}
                <div class="changes-request-box">
                  <textarea bind:value={changesComment} placeholder="Describí qué cambios se necesitan..." rows="3"></textarea>
                  <div class="btn-row">
                    <button class="btn-changes" on:click={handleRequestChanges} disabled={!changesComment.trim() || saving}>
                      Enviar solicitud de cambios
                    </button>
                    <button class="btn-cancel-small" on:click={() => { showChangesRequest = false; changesComment = ''; }}>
                      Cancelar
                    </button>
                  </div>
                </div>
              {/if}
            </div>
          {/if}

          <!-- Submit for approval button (visible to all when draft or changes_requested) -->
          {#if quote.status === 'draft' || quote.status === 'changes_requested'}
            <div class="submit-approval-section">
              <label class="field-label">Nota para los aprobadores (opcional)</label>
              <input type="text" bind:value={noteToApprovers} placeholder="Ej: Precios verificados, listo para aprobación" />
              <button class="btn-submit-approval" on:click={handleSubmitForApproval} disabled={saving}>
                📨 Enviar para aprobación
              </button>
            </div>
          {/if}

          <!-- Send to client (only when approved) -->
          {#if quote.status === 'approved' || quote.status === 'sent_to_client'}
            <div class="send-to-client-section">
              {#if quote.status === 'approved'}
                <button class="btn-send-client" on:click={handleSendToClient} disabled={saving}>
                  📤 Enviar cotización al cliente
                </button>
              {:else if quote.status === 'sent_to_client'}
                <div class="sent-confirmation">
                  <span class="sent-badge">📨 Enviada al cliente</span>
                  {#if quote.sentToClientAt}
                    <span class="sent-date">{new Date(quote.sentToClientAt).toLocaleString('es')}</span>
                  {/if}
                </div>
              {/if}
              {#if sentLink}
                <p class="sent-link-label">Enlace del cliente:</p>
                <a href={sentLink} target="_blank" class="sent-link">{sentLink}</a>
              {/if}
            </div>
          {/if}

          <!-- Comments thread -->
          {#if Array.isArray(quote.comments) && quote.comments.length > 0}
            <div class="comments-section">
              <h4 class="section-title">Comentarios</h4>
              {#each quote.comments as comment (comment.commentId)}
                <div class="comment-item" class:resolved={comment.resolved}>
                  <div class="comment-header">
                    <strong>{comment.authorEmail}</strong>
                    <span class="comment-date">{new Date(comment.createdAt).toLocaleString('es')}</span>
                    {#if comment.resolved}
                      <span class="resolved-badge">Resuelto ✓</span>
                    {:else}
                      <button class="resolve-btn" on:click={() => handleResolveComment(comment.commentId)}>
                        Marcar resuelto
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
            <input type="text" bind:value={newCommentText} placeholder="Agregar comentario..." on:keydown={e => e.key === 'Enter' && handleAddComment()} />
            <button class="btn-comment" on:click={handleAddComment} disabled={!newCommentText.trim() || saving}>
              💬
            </button>
          </div>

          <!-- Change log (collapsible) -->
          {#if Array.isArray(quote.changeLog) && quote.changeLog.length > 0}
            <details class="changelog-section">
              <summary>Historial de cambios ({quote.changeLog.length})</summary>
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

      <!-- Action buttons -->
      <div class="qe-actions">
        <button
          type="button"
          class="qe-btn qe-btn--save"
          disabled={saving}
          on:click={handleSave}
        >
          {#if saving}
            <span class="qe-btn-spinner"></span> Guardando…
          {:else}
            💾 Guardar borrador
          {/if}
        </button>
        <button
          type="button"
          class="qe-btn qe-btn--cancel"
          disabled={saving}
          on:click={handleCancel}
        >
          Cancelar
        </button>
      </div>
    </div>
  {/if}
</div>

<style>
  /* ── QuoteEditor — Premium Light Theme ───────────────────────────────── */
  .quote-editor {
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 16px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    box-shadow: 0 1px 3px rgba(0,0,0,0.07), 0 4px 24px rgba(0,0,0,0.06);
    font-feature-settings: 'cv02','cv03','cv04','cv11';
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
    border-top-color: #6366f1;
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
    border-color: #818cf8;
    box-shadow: 0 0 0 3px rgba(99,102,241,0.10);
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
    border-color: #818cf8;
    box-shadow: 0 0 0 3px rgba(99,102,241,0.10);
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
    border-color: #818cf8;
    box-shadow: 0 0 0 3px rgba(99,102,241,0.10);
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
    border: 1.5px dashed #c7d2fe;
    color: #6366f1;
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
    border-color: #6366f1;
    background: #eef2ff;
    color: #4f46e5;
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
    background: #eef2ff;
    border: 1px solid #c7d2fe;
    color: #4f46e5;
    font-size: 12px;
    font-weight: 600;
    padding: 3px 10px;
    border-radius: 999px;
    transition: background 0.14s;
  }
  .qe-provider-tag:hover { background: #e0e7ff; }

  .qe-provider-tag__remove {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: none;
    border: none;
    color: #818cf8;
    cursor: pointer;
    font-size: 11px;
    padding: 0;
    line-height: 1;
    opacity: 0.8;
    border-radius: 50%;
    transition: opacity 0.12s, color 0.12s;
  }
  .qe-provider-tag__remove:hover { opacity: 1; color: #4f46e5; }

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
    border-bottom: 1px solid #c7d2fe;
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
  .qe-provider-result input[type="checkbox"] { accent-color: #6366f1; flex-shrink: 0; }
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
    background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
    color: #fff;
    box-shadow: 0 2px 8px rgba(99,102,241,0.28);
  }
  .qe-btn--save:not(:disabled):hover {
    filter: brightness(1.07);
    box-shadow: 0 4px 16px rgba(99,102,241,0.38);
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
    background: #eff6ff;
    color: #2563eb;
    border-color: #bfdbfe;
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
    border-color: #818cf8;
    box-shadow: 0 0 0 3px rgba(99,102,241,0.10);
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
    border-color: #818cf8;
    box-shadow: 0 0 0 3px rgba(99,102,241,0.10);
  }

  .field-label {
    font-size: 11px;
    font-weight: 700;
    color: #94a3b8;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  .btn-submit-approval {
    background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
    color: #fff;
    border: none;
    padding: 9px 18px;
    border-radius: 8px;
    cursor: pointer;
    font-weight: 700;
    font-size: 13px;
    width: fit-content;
    box-shadow: 0 2px 8px rgba(99,102,241,0.25);
    transition: filter 0.15s, box-shadow 0.15s;
  }
  .btn-submit-approval:hover:not(:disabled) {
    filter: brightness(1.07);
    box-shadow: 0 4px 14px rgba(99,102,241,0.35);
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
  .sent-link { font-size: 12px; color: #6366f1; word-break: break-all; text-decoration: underline; }

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
    border-left: 3px solid #6366f1;
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
    border-color: #818cf8;
    box-shadow: 0 0 0 3px rgba(99,102,241,0.10);
    background: #fff;
  }
  .add-comment-section input::placeholder { color: #94a3b8; }
  .btn-comment {
    background: #eef2ff;
    border: 1px solid #c7d2fe;
    color: #6366f1;
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
  .btn-comment:hover:not(:disabled) { background: #e0e7ff; border-color: #a5b4fc; }
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
    color: #6366f1;
    font-weight: 700;
    font-family: ui-monospace, 'Cascadia Mono', 'Segoe UI Mono', monospace;
    font-size: 11px;
  }
  .log-summary { flex: 1; color: #334155; }
  .log-date { color: #94a3b8; font-size: 10.5px; white-space: nowrap; }
</style>
