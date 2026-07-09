<script lang="ts">
  /**
   * PricingRequestsPanel.svelte — Internal "Pricing Request" authoring + history.
   *
   * Lives inside the Quotes tab, ABOVE the quote list, because a Pricing Request
   * precedes quote creation. An operator:
   *   1. presses "+ New Pricing Request" → a draft is created (auto-numbered),
   *      its origin/destination header auto-filled from the client's data;
   *   2. adds one or more Options (each with an AI-drafted, editable service line
   *      + a freeform bullet list);
   *   3. presses "Request Quote" → the request is emailed to the pricing desk
   *      (pricing@ + support2@) and collapses into the numbered history.
   *
   * Sent requests render as collapsible "Request N (date) ▸ Option 1..M" entries.
   * Also surfaces the stage-gate BLOCK banner (`stageBlockNotice`) when a Kanban
   * move into this client's next column was refused for unmet requirements.
   */
  import { onMount } from 'svelte';
  import {
    stageBlockNotice,
    fetchPricingRequests,

    createPricingRequest,
    updatePricingRequest,
    addPricingRequestOption,
    sendPricingRequest,
    deletePricingRequest,
    type PricingRequest,
    type PricingRequestOption,
  } from '../store.ts';
  import { toasts } from '../toastStore.ts';

  export let clientId: string;

  let requests: PricingRequest[] = [];
  let loading = true;
  let error = '';
  let busy = false;
  /** requestId of the draft currently being authored (only one at a time). */
  let draftId: string | null = null;
  /** Expanded state for sent-request history entries, keyed by requestId. */
  let expanded: Record<string, boolean> = {};

  $: draft = requests.find((r) => r.requestId === draftId && r.status === 'draft') ?? null;
  $: sentRequests = requests.filter((r) => r.status === 'sent').sort((a, b) => b.index - a.index);
  $: existingDraft = requests.find((r) => r.status === 'draft') ?? null;
  /** This client's stage block (if the last blocked move was for this client). */
  $: myBlock = $stageBlockNotice && $stageBlockNotice.clientId === clientId ? $stageBlockNotice : null;

  async function load() {
    loading = true;
    error = '';
    try {
      requests = await fetchPricingRequests(clientId);
      // Auto-resume an in-progress draft if one exists.
      if (!draftId && existingDraft) draftId = existingDraft.requestId;
    } catch (err: any) {
      error = err?.message ?? 'Failed to load pricing requests.';
    } finally {
      loading = false;
    }
  }

  onMount(load);

  async function startNewRequest() {
    if (existingDraft) { draftId = existingDraft.requestId; return; }
    busy = true;
    try {
      const created = await createPricingRequest(clientId);
      requests = [...requests, created];
      draftId = created.requestId;
    } catch (err: any) {
      toasts.error(err?.message ?? 'Could not create the pricing request.');
    } finally {
      busy = false;
    }
  }

  /** Persist the current draft's header + options (debounced by the caller). */
  async function persistDraft() {
    if (!draft) return;
    try {
      const saved = await updatePricingRequest(clientId, draft.requestId, {
        originNotes: draft.originNotes,
        destinationNotes: draft.destinationNotes,
        originLabel: draft.originLabel,
        destinationLabel: draft.destinationLabel,
        options: draft.options,
      });
      requests = requests.map((r) => (r.requestId === saved.requestId ? saved : r));
    } catch (err: any) {
      toasts.error(err?.message ?? 'Could not save changes.');
    }
  }

  let saveTimer: ReturnType<typeof setTimeout> | null = null;
  function scheduleSave() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(persistDraft, 700);
  }

  async function addOption() {
    if (!draft) return;
    busy = true;
    try {
      const { options } = await addPricingRequestOption(clientId, draft.requestId);
      requests = requests.map((r) => (r.requestId === draft!.requestId ? { ...r, options } : r));
    } catch (err: any) {
      toasts.error(err?.message ?? 'Could not add an option.');
    } finally {
      busy = false;
    }
  }

  function removeOption(optionId: string) {
    if (!draft) return;
    const options = draft.options
      .filter((o) => o.optionId !== optionId)
      .map((o, i) => ({ ...o, index: i + 1 }));
    requests = requests.map((r) => (r.requestId === draft!.requestId ? { ...r, options } : r));
    scheduleSave();
  }

  /** Bind a bullet-list textarea (one item per line) back onto an option. */
  function setOptionItems(optionId: string, text: string) {
    if (!draft) return;
    const items = text.split('\n').map((s) => s.trim()).filter(Boolean);
    updateOption(optionId, { items });
  }

  function updateOption(optionId: string, patch: Partial<PricingRequestOption>) {
    if (!draft) return;
    const options = draft.options.map((o) => (o.optionId === optionId ? { ...o, ...patch } : o));
    requests = requests.map((r) => (r.requestId === draft!.requestId ? { ...r, options } : r));
    scheduleSave();
  }

  async function requestQuote() {
    if (!draft) return;
    busy = true;
    try {
      // Flush any pending edits first so the email carries the latest content.
      if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
      const sent = await sendPricingRequest(clientId, draft.requestId, {
        originNotes: draft.originNotes,
        destinationNotes: draft.destinationNotes,
        options: draft.options,
      });
      requests = requests.map((r) => (r.requestId === sent.requestId ? sent : r));
      draftId = null;
      expanded[sent.requestId] = true;
      toasts.success(`Pricing Request #${sent.index} sent to the pricing desk.`);
    } catch (err: any) {
      toasts.error(err?.message ?? 'Could not send the pricing request.');
    } finally {
      busy = false;
    }
  }

  async function discardDraft() {
    if (!draft) return;
    if (!confirm('Discard this draft pricing request?')) return;
    busy = true;
    try {
      await deletePricingRequest(clientId, draft.requestId);
      requests = requests.filter((r) => r.requestId !== draft!.requestId);
      draftId = null;
    } catch (err: any) {
      toasts.error(err?.message ?? 'Could not discard the draft.');
    } finally {
      busy = false;
    }
  }

  function toggleExpanded(requestId: string) {
    expanded[requestId] = !expanded[requestId];
    expanded = { ...expanded };
  }

  function fmtDate(iso: string | null): string {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch { return iso; }
  }

  function itemsToText(items: string[]): string {
    return (items ?? []).join('\n');
  }
</script>

<div class="pr-panel">
  <!-- ── Stage-gate BLOCK banner (surfaces refused Kanban moves here too) ── -->
  {#if myBlock}
    <div class="pr-block" role="alert">
      <div class="pr-block__head">
        <span class="pr-block__icon">🚫</span>
        <span class="pr-block__title">
          Can't move to “{myBlock.targetStageLabel}” yet
        </span>
        <button class="pr-block__close" title="Dismiss" on:click={() => stageBlockNotice.set(null)}>✕</button>
      </div>
      {#each myBlock.blockedBy as b (b.ruleId)}
        <div class="pr-block__rule">
          <p class="pr-block__msg">{b.message}</p>
          {#if b.unmet?.length}
            <ul class="pr-block__unmet">
              {#each b.unmet as u}<li>{u}</li>{/each}
            </ul>
          {/if}
        </div>
      {/each}
    </div>
  {/if}

  <div class="pr-head">
    <div class="pr-head__title">
      <span class="pr-head__icon">🧾</span>
      <span>Pricing Requests</span>
    </div>
    {#if !draft}
      <button class="pr-new-btn" on:click={startNewRequest} disabled={busy}>+ New Pricing Request</button>
    {/if}
  </div>
  <p class="pr-sub">
    Author a shipment request and send it to the pricing desk. Each request is numbered and
    keeps its options for reference.
  </p>

  {#if loading}
    <div class="pr-loading">Loading pricing requests…</div>
  {:else if error}
    <div class="pr-error">⚠️ {error} <button class="pr-retry" on:click={load}>Retry</button></div>
  {/if}

  <!-- ── Draft authoring ─────────────────────────────────────────────────── -->
  {#if draft}
    <div class="pr-draft">
      <div class="pr-draft__head">
        <span class="pr-draft__badge">Request #{draft.index} · Draft</span>
      </div>

      <!-- Origin / destination header (auto-filled, editable notes) -->
      <div class="pr-grid">
        <label class="pr-field">
          <span class="pr-label">Origin</span>
          <input class="pr-input" bind:value={draft.originLabel} on:input={scheduleSave} placeholder="City, ST ZIP, Country" />
          <textarea class="pr-textarea pr-textarea--sm" bind:value={draft.originNotes} on:input={scheduleSave} placeholder="Origin notes (optional)…" rows="2"></textarea>
        </label>
        <label class="pr-field">
          <span class="pr-label">Destination</span>
          <input class="pr-input" bind:value={draft.destinationLabel} on:input={scheduleSave} placeholder="City, ZIP, Country" />
          <textarea class="pr-textarea pr-textarea--sm" bind:value={draft.destinationNotes} on:input={scheduleSave} placeholder="Destination notes (optional)…" rows="2"></textarea>
        </label>
      </div>

      <!-- Options -->
      <div class="pr-options">
        {#each draft.options as opt (opt.optionId)}
          <div class="pr-option">
            <div class="pr-option__head">
              <span class="pr-option__num">Option {opt.index}</span>
              <button class="pr-option__remove" title="Remove option" on:click={() => removeOption(opt.optionId)}>✕</button>
            </div>
            <label class="pr-field">
              <span class="pr-label pr-label--muted">Service (AI-suggested placeholder — editable)</span>
              <input
                class="pr-input pr-input--service"
                value={opt.serviceLine}
                on:input={(e) => updateOption(opt.optionId, { serviceLine: e.currentTarget.value })}
                placeholder="e.g. 20 ft Container (up to 28 m³) – Door-to-Door – Full Professional Packing"
              />
            </label>
            <label class="pr-field">
              <span class="pr-label pr-label--muted">Include (one line per item)</span>
              <textarea
                class="pr-textarea"
                value={itemsToText(opt.items)}
                on:input={(e) => setOptionItems(opt.optionId, e.currentTarget.value)}
                placeholder={'Loading\nExport customs clearance\nOcean freight\nImport customs clearance\nDelivery to final residence\nUnloading'}
                rows="5"
              ></textarea>
            </label>
          </div>
        {/each}

        <button class="pr-add-option" on:click={addOption} disabled={busy}>
          + Create Option
        </button>
      </div>

      <div class="pr-draft__foot">
        <button class="pr-discard" on:click={discardDraft} disabled={busy}>Discard</button>
        <button class="pr-request-btn" on:click={requestQuote} disabled={busy}>
          {busy ? 'Sending…' : 'Request Quote →'}
        </button>
      </div>
    </div>
  {/if}

  <!-- ── Sent history (collapsible) ──────────────────────────────────────── -->
  {#if sentRequests.length > 0}
    <div class="pr-history">
      {#each sentRequests as req (req.requestId)}
        <div class="pr-hist-item">
          <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
          <div class="pr-hist-head" on:click={() => toggleExpanded(req.requestId)} role="button" tabindex="0">
            <span class="pr-hist-caret" class:pr-hist-caret--open={expanded[req.requestId]}>▸</span>
            <span class="pr-hist-title">Request {req.index}</span>
            <span class="pr-hist-meta">{req.options.length} option{req.options.length === 1 ? '' : 's'} · {fmtDate(req.sentAt)}</span>
            <span class="pr-hist-sent">Sent</span>
          </div>
          {#if expanded[req.requestId]}
            <div class="pr-hist-body">
              {#if req.originLabel || req.destinationLabel}
                <p class="pr-hist-route">
                  {req.originLabel || '—'}{req.originNotes ? ` (${req.originNotes})` : ''}
                  → {req.destinationLabel || '—'}{req.destinationNotes ? ` (${req.destinationNotes})` : ''}
                </p>
              {/if}
              {#each req.options as opt (opt.optionId)}
                <div class="pr-hist-option">
                  <p class="pr-hist-option__title">Option {opt.index} · {opt.serviceLine || '—'}</p>
                  {#if opt.items?.length}
                    <ul class="pr-hist-option__items">
                      {#each opt.items as it}<li>{it}</li>{/each}
                    </ul>
                  {/if}
                </div>
              {/each}
            </div>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</div>

<style lang="scss">
  /* Cohesive with the IRP dashboard: teal accent (#02b5bb), Jost, slate neutrals. */
  .pr-panel {
    font-family: var(--font-paragraph, 'Jost'), system-ui, sans-serif;
    margin: 0 0 1.25rem;
  }

  /* ── Block banner ──────────────────────────────────────────────────────── */
  .pr-block {
    border: 1px solid #fecaca;
    background: linear-gradient(135deg, #fef2f2, #fff);
    border-radius: 14px;
    padding: 0.85rem 1rem;
    margin: 0 0 1rem;
  }
  .pr-block__head { display: flex; align-items: center; gap: 0.5rem; }
  .pr-block__icon { font-size: 1rem; }
  .pr-block__title { font-weight: 800; color: #b91c1c; font-size: 0.92rem; flex: 1; }
  .pr-block__close {
    background: none; border: none; color: #b91c1c; cursor: pointer; font-size: 0.95rem;
    padding: 2px 6px; border-radius: 6px;
  }
  .pr-block__close:hover { background: rgba(185, 28, 28, 0.1); }
  .pr-block__rule { margin-top: 0.5rem; }
  .pr-block__msg { margin: 0; color: #7f1d1d; font-size: 0.85rem; line-height: 1.45; }
  .pr-block__unmet { margin: 0.35rem 0 0; padding-left: 1.15rem; color: #b91c1c; font-size: 0.8rem; }
  .pr-block__unmet li { margin: 0.1rem 0; }

  /* ── Header ────────────────────────────────────────────────────────────── */
  .pr-head { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; }
  .pr-head__title { display: flex; align-items: center; gap: 0.45rem; font-weight: 800; color: #0f172a; font-size: 0.98rem; }
  .pr-head__icon { font-size: 1.05rem; }
  .pr-sub { margin: 0.3rem 0 0.9rem; color: #64748b; font-size: 0.78rem; line-height: 1.5; max-width: 560px; }

  .pr-new-btn {
    background: linear-gradient(135deg, #02b5bb, #0d9488);
    color: #fff; border: none; border-radius: 10px; padding: 0.5rem 0.95rem;
    font-weight: 700; font-size: 0.82rem; cursor: pointer; font-family: inherit;
    box-shadow: 0 1px 3px rgba(2, 181, 187, 0.25);
    transition: transform 0.12s ease, box-shadow 0.12s ease;
  }
  .pr-new-btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(2, 181, 187, 0.3); }
  .pr-new-btn:disabled { opacity: 0.6; cursor: default; }

  .pr-loading, .pr-error { color: #64748b; font-size: 0.85rem; padding: 0.6rem 0; }
  .pr-error { color: #b91c1c; }
  .pr-retry { margin-left: 0.5rem; background: none; border: 1px solid #fca5a5; color: #b91c1c; border-radius: 7px; padding: 2px 9px; cursor: pointer; font-size: 0.78rem; }

  /* ── Draft ─────────────────────────────────────────────────────────────── */
  .pr-draft {
    border: 1px solid rgba(2, 181, 187, 0.25);
    background: #fff;
    border-radius: 16px;
    padding: 1.1rem 1.15rem;
    margin: 0.4rem 0 1rem;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05), 0 8px 28px rgba(2, 181, 187, 0.06);
  }
  .pr-draft__head { margin-bottom: 0.85rem; }
  .pr-draft__badge {
    display: inline-block; background: rgba(2, 181, 187, 0.1); color: #0d9488;
    border: 1px solid rgba(2, 181, 187, 0.25); border-radius: 999px;
    padding: 3px 12px; font-size: 0.75rem; font-weight: 700;
  }

  .pr-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.9rem; margin-bottom: 1rem; }
  @media (max-width: 620px) { .pr-grid { grid-template-columns: 1fr; } }

  .pr-field { display: flex; flex-direction: column; gap: 0.35rem; }
  .pr-label { font-size: 0.68rem; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.06em; }
  .pr-label--muted { color: #a9b6c6; text-transform: none; letter-spacing: 0; font-weight: 600; font-size: 0.72rem; }

  .pr-input, .pr-textarea {
    width: 100%; box-sizing: border-box; border: 1px solid #e2e8f0; border-radius: 10px;
    padding: 0.5rem 0.7rem; font-size: 0.85rem; font-family: inherit; color: #0f172a;
    background: #fafbfc; transition: border-color 0.14s ease, box-shadow 0.14s ease; resize: vertical;
  }
  .pr-input:focus, .pr-textarea:focus {
    outline: none; border-color: #02b5bb; box-shadow: 0 0 0 3px rgba(2, 181, 187, 0.12); background: #fff;
  }
  .pr-input--service { font-weight: 600; }
  .pr-textarea--sm { margin-top: 0.35rem; }

  /* ── Options ───────────────────────────────────────────────────────────── */
  .pr-options { display: flex; flex-direction: column; gap: 0.75rem; }
  .pr-option {
    border: 1px solid #eef2f7; background: #f8fafc; border-radius: 12px; padding: 0.85rem 0.9rem;
    display: flex; flex-direction: column; gap: 0.6rem;
  }
  .pr-option__head { display: flex; align-items: center; justify-content: space-between; }
  .pr-option__num { font-weight: 800; color: #0f172a; font-size: 0.82rem; }
  .pr-option__remove {
    background: none; border: none; color: #94a3b8; cursor: pointer; font-size: 0.85rem;
    padding: 2px 7px; border-radius: 6px;
  }
  .pr-option__remove:hover { background: #fee2e2; color: #b91c1c; }

  .pr-add-option {
    align-self: flex-start; background: rgba(2, 181, 187, 0.08); color: #0d9488;
    border: 1px dashed rgba(2, 181, 187, 0.4); border-radius: 10px; padding: 0.5rem 0.95rem;
    font-weight: 700; font-size: 0.8rem; cursor: pointer; font-family: inherit; margin-top: 0.15rem;
  }
  .pr-add-option:hover:not(:disabled) { background: rgba(2, 181, 187, 0.14); }
  .pr-add-option:disabled { opacity: 0.6; cursor: default; }

  .pr-draft__foot { display: flex; align-items: center; justify-content: flex-end; gap: 0.6rem; margin-top: 1rem; }
  .pr-discard {
    background: none; border: 1px solid #e2e8f0; color: #64748b; border-radius: 10px;
    padding: 0.5rem 0.95rem; font-weight: 600; font-size: 0.82rem; cursor: pointer; font-family: inherit;
  }
  .pr-discard:hover:not(:disabled) { background: #f1f5f9; }
  .pr-request-btn {
    background: linear-gradient(135deg, #02b5bb, #0d9488); color: #fff; border: none;
    border-radius: 10px; padding: 0.55rem 1.2rem; font-weight: 800; font-size: 0.85rem;
    cursor: pointer; font-family: inherit; box-shadow: 0 1px 3px rgba(2, 181, 187, 0.25);
  }
  .pr-request-btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(2, 181, 187, 0.3); }
  .pr-request-btn:disabled { opacity: 0.6; cursor: default; }

  /* ── History (collapsible) ─────────────────────────────────────────────── */
  .pr-history { display: flex; flex-direction: column; gap: 0.5rem; margin-top: 0.5rem; }
  .pr-hist-item { border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; background: #fff; }
  .pr-hist-head {
    display: flex; align-items: center; gap: 0.6rem; padding: 0.65rem 0.9rem; cursor: pointer;
    user-select: none; transition: background 0.12s ease;
  }
  .pr-hist-head:hover { background: #f8fafc; }
  .pr-hist-caret { color: #94a3b8; font-size: 0.8rem; transition: transform 0.15s ease; }
  .pr-hist-caret--open { transform: rotate(90deg); }
  .pr-hist-title { font-weight: 800; color: #0f172a; font-size: 0.86rem; }
  .pr-hist-meta { color: #94a3b8; font-size: 0.76rem; flex: 1; }
  .pr-hist-sent {
    background: rgba(34, 197, 94, 0.1); color: #16a34a; border: 1px solid rgba(34, 197, 94, 0.25);
    border-radius: 999px; padding: 2px 10px; font-size: 0.7rem; font-weight: 700;
  }
  .pr-hist-body { padding: 0.3rem 0.95rem 0.9rem; border-top: 1px solid #f1f5f9; }
  .pr-hist-route { color: #475569; font-size: 0.8rem; font-weight: 600; margin: 0.6rem 0 0.5rem; }
  .pr-hist-option { margin: 0.55rem 0 0; }
  .pr-hist-option__title { margin: 0; font-weight: 700; color: #0f172a; font-size: 0.82rem; }
  .pr-hist-option__items { margin: 0.3rem 0 0; padding-left: 1.15rem; color: #475569; font-size: 0.8rem; }
  .pr-hist-option__items li { margin: 0.12rem 0; }
</style>
