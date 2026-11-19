<script lang="ts">
  /**
   * CrmLilyTab.svelte — CRM Lily AI copilot tab inside the Dashboard DetailPanel.
   *
   * Self-contained: manages its own message state, calls the Lily CRM API
   * directly using the IRP staff token. Does NOT touch the hero-form chatbot.
   *
   * Styles use --chat-* tokens from _chat.scss (no hardcoded hex values).
   */
  import { tick, onMount, onDestroy } from 'svelte';
  import { get } from 'svelte/store';
  import { irpStaffToken, getApiUrl } from '../../../lib/auth/irpStaff.ts';
  import { editField, selectedClient } from '../store.ts';
  import LilyProposalPanel from './LilyProposalPanel.svelte';
  import {
    collectPendingRows,
    conflictValue,
    messageProposalSummary,
    sameValue,
    undoPlan,
    type Decision,
    type FieldProposal,
    type ProposalRow,
    type ProposalValue,
    type Receipt,
    type ReceiptItem,
  } from './lilyProposals.ts';

  export let clientId: string;

  const API_BASE = getApiUrl();

  // ─── State ────────────────────────────────────────────────────────────────
  /*
   * Field changes Lily proposed. Lily never writes: every pending proposal is
   * gathered into the panel above the message box, where staff edit, switch
   * on/off and apply them. Applying goes through the same `editField` store
   * action as a manual edit (activity log, concurrency guard, undo, and the
   * Overview updating in place).
   */
  type Msg = { role: 'user' | 'assistant'; content: string; timestamp: string; fieldProposals?: FieldProposal[]; };
  let messages: Msg[] = [];
  let input = '';
  let loading = false;
  let historyLoaded = false;
  let scrollEl: HTMLDivElement;
  let inputEl: HTMLTextAreaElement;

  async function apiFetch(endpoint: string, opts: RequestInit = {}) {
    const token = get(irpStaffToken);
    const headers = new Headers(opts.headers);
    headers.set('Content-Type', 'application/json');
    if (token) headers.set('x-dashboard-token', token);
    const res = await fetch(`${API_BASE}${endpoint}`, { ...opts, headers });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'API Error');
    return data;
  }

  async function loadHistory() {
    if (historyLoaded || !clientId) return;
    historyLoaded = true;
    try {
      const data = await apiFetch(`/api/dashboard/clients/${clientId}/lily/history`);
      messages = (data.thread?.rawTail ?? []) as Msg[];
    } catch { /* stay empty */ }
    scrollToBottom();
  }

  async function scrollToBottom() {
    await tick();
    if (scrollEl) scrollEl.scrollTop = scrollEl.scrollHeight;
  }

  $: if (messages.length) scrollToBottom();

  onMount(() => { loadHistory(); });

  // Reset when clientId changes
  $: if (clientId) { messages = []; historyLoaded = false; resetProposalState(); loadHistory(); }

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    const msg = input.trim();
    if (!msg || loading) return;
    input = '';
    const now = new Date().toISOString();
    messages = [...messages, { role: 'user', content: msg, timestamp: now }];
    loading = true;
    try {
      const data = await apiFetch(`/api/dashboard/clients/${clientId}/lily`, {
        method: 'POST',
        body: JSON.stringify({ message: msg }),
      });
      messages = (data.rawTail ?? []) as Msg[];
    } catch {
      messages = [...messages, {
        role: 'assistant',
        content: "Sorry, Lily had trouble responding. Please try again.",
        timestamp: new Date().toISOString(),
      }];
    } finally {
      loading = false;
    }
  }

  // ─── Field proposals (confirmation panel) ─────────────────────────────────
  // Everything here is deterministic: which rows show, what gets written and
  // how the outcome is recorded. Lily's only input is the proposal itself.
  let panel: LilyProposalPanel;
  let applying = false;
  let savingId: string | null = null;
  let proposalErrors: Record<string, string> = {};
  /** Values the server reported in a 409, by path; they win over the store until saved. */
  let overrides: Record<string, unknown> = {};
  let receipt: Receipt | null = null;
  let receiptTimer: ReturnType<typeof setTimeout> | undefined;

  $: pendingRows = collectPendingRows(messages);
  $: clientDoc = $selectedClient?.id === clientId ? $selectedClient?.rawDoc : undefined;

  function resetProposalState() {
    proposalErrors = {};
    overrides = {};
    savingId = null;
    showReceipt(null);
  }

  /** The receipt stays until dismissed, the next Apply, or 15 s without Undo. */
  function showReceipt(next: Receipt | null) {
    clearTimeout(receiptTimer);
    receipt = next;
    if (next) receiptTimer = setTimeout(() => { if (receipt === next && next.undo !== 'working') receipt = null; }, 15_000);
  }
  onDestroy(() => clearTimeout(receiptTimer));

  function findProposal(id: string): FieldProposal | undefined {
    for (const m of messages) {
      const p = m.fieldProposals?.find((x) => x.id === id);
      if (p) return p;
    }
    return undefined;
  }

  /**
   * Persist the decision so the panel and chat show the same outcome after a
   * reload. Retried once; if it still fails the field is already saved, and
   * the row would come back after a reload as "Already set", so applying it
   * again only marks it done.
   */
  async function recordDecision(forClient: string, id: string, status: 'applied' | 'rejected', value?: ProposalValue) {
    const p = findProposal(id);
    if (p && forClient === clientId) {
      p.status = status;
      if (status === 'applied' && value !== undefined && !sameValue(p.newValue, value)) p.appliedValue = value;
      messages = [...messages];
    }
    const body = JSON.stringify(value === undefined ? { status } : { status, value });
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        await apiFetch(`/api/dashboard/clients/${forClient}/lily/proposals/${encodeURIComponent(id)}`, { method: 'POST', body });
        return;
      } catch { /* retry once */ }
    }
  }

  /** Resolve a row and the older duplicate proposals hidden behind it. */
  async function resolveRow(forClient: string, row: ProposalRow, status: 'applied' | 'rejected', value?: ProposalValue) {
    await recordDecision(forClient, row.proposal.id, status, value);
    for (const id of row.hiddenIds) await recordDecision(forClient, id, 'rejected');
  }

  function saveErrorText(err: any): string {
    if (conflictValue(err)) return 'Someone changed this field while you were reviewing. The current value is updated above; apply again to overwrite it.';
    return String(err?.message ?? '') || 'Could not save this field. Try again.';
  }

  /**
   * Apply one at a time so each write sees the previous one. Every write goes
   * through editField (activity log, concurrency guard, undo). Stops early if
   * the staff member switches to another client mid-way.
   */
  async function applyDecisions(decisions: Decision[]) {
    if (applying || loading) return;
    const forClient = clientId;
    applying = true;
    proposalErrors = {};
    showReceipt(null);
    const items: ReceiptItem[] = [];
    try {
      for (const d of decisions) {
        if (forClient !== clientId) break;
        const p = d.row.proposal;
        const base = { id: p.id, label: p.label, path: p.path, before: d.current, after: d.value };
        if (!d.include) {
          await resolveRow(forClient, d.row, 'rejected');
          items.push({ ...base, outcome: 'skipped' });
          continue;
        }
        savingId = p.id;
        try {
          const unchanged = sameValue(d.current, d.value);
          if (!unchanged) await editField(forClient, p.path, d.value, d.current ?? '');
          const { [p.path]: _resolved, ...rest } = overrides;
          overrides = rest;
          await resolveRow(forClient, d.row, 'applied', d.value);
          items.push({ ...base, outcome: unchanged ? 'unchanged' : 'saved' });
        } catch (err: any) {
          const conflict = conflictValue(err);
          if (conflict) overrides = { ...overrides, [p.path]: conflict.current };
          proposalErrors = { ...proposalErrors, [p.id]: saveErrorText(err) };
          items.push({ ...base, outcome: 'failed' });
        }
      }
    } finally {
      savingId = null;
      applying = false;
    }
    if (forClient !== clientId) return;
    showReceipt({ items, undo: 'idle' });
    await tick();
    if (!Object.keys(proposalErrors).length) inputEl?.focus();
  }

  /**
   * Undo puts back the value each saved field had before Apply, newest first.
   * Each revert is guarded by the value Apply wrote, so a field someone has
   * changed since is left alone and reported.
   */
  async function undoReceipt() {
    if (!receipt || receipt.undo !== 'idle' || applying) return;
    const forClient = clientId;
    const current = receipt;
    current.undo = 'working';
    receipt = { ...current };
    applying = true;
    const failed: string[] = [];
    try {
      for (const item of undoPlan(current.items)) {
        try {
          await editField(forClient, item.path, item.before === undefined ? null : item.before, item.after ?? '');
        } catch {
          failed.push(item.label);
        }
      }
    } finally {
      applying = false;
    }
    if (forClient !== clientId) return;
    showReceipt({
      ...current,
      undo: failed.length ? 'failed' : 'done',
      undoError: failed.length ? `Not reverted (changed since): ${failed.join(', ')}.` : undefined,
    });
  }

  async function discardRows(rows: ProposalRow[]) {
    if (applying || loading) return;
    const forClient = clientId;
    applying = true;
    const items: ReceiptItem[] = [];
    try {
      for (const row of rows) {
        if (forClient !== clientId) break;
        await resolveRow(forClient, row, 'rejected');
        items.push({ id: row.proposal.id, label: row.proposal.label, path: row.proposal.path, outcome: 'skipped', before: null, after: null });
      }
    } finally {
      applying = false;
    }
    if (forClient !== clientId) return;
    showReceipt({ items, undo: 'idle' });
    await tick();
    inputEl?.focus();
  }

  function reviewProposal(msg: Msg) {
    const first = msg.fieldProposals?.find((p) => p.status === 'pending');
    if (!first) return;
    // A repeated proposal is shown under the newest row for its field.
    const row = pendingRows.find((r) => r.proposal.id === first.id || r.hiddenIds.includes(first.id));
    if (row) panel?.focusProposal(row.proposal.id);
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as any);
    }
  }

  function formatTime(iso: string): string {
    if (!iso) return '';
    try { return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
    catch { return ''; }
  }
  /**
   * Lightweight Markdown → safe HTML converter.
   * Covers the patterns Lily commonly outputs: bold, italic, headers, lists, hr, code.
   */
  function md(text: string): string {
    if (!text) return '';
    let s = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Headings
    s = s.replace(/^### (.+)$/gm, '<h5 class="lily-md-h">$1</h5>');
    s = s.replace(/^## (.+)$/gm,  '<h4 class="lily-md-h">$1</h4>');
    s = s.replace(/^# (.+)$/gm,   '<h3 class="lily-md-h">$1</h3>');

    // Horizontal rule
    s = s.replace(/^---+$/gm, '<hr class="lily-md-hr">');

    // Unordered list items (group consecutive lines into <ul>)
    s = s.replace(/((?:^[-*•] .+\n?)+)/gm, (block) => {
      const items = block.trim().split('\n').map(line =>
        `<li>${line.replace(/^[-*•] /, '').trim()}</li>`
      ).join('');
      return `<ul class="lily-md-ul">${items}</ul>`;
    });

    // Ordered list items
    s = s.replace(/((?:^\d+\. .+\n?)+)/gm, (block) => {
      const items = block.trim().split('\n').map(line =>
        `<li>${line.replace(/^\d+\. /, '').trim()}</li>`
      ).join('');
      return `<ol class="lily-md-ol">${items}</ol>`;
    });

    // Bold + italic (order matters: process *** before ** before *)
    s = s.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
    s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/\*(.+?)\*/g, '<em>$1</em>');
    s = s.replace(/__(.+?)__/g, '<strong>$1</strong>');
    s = s.replace(/_(.+?)_/g, '<em>$1</em>');

    // Inline code
    s = s.replace(/`([^`]+)`/g, '<code class="lily-md-code">$1</code>');

    // Paragraphs — double newlines become paragraph breaks
    s = s.replace(/\n{2,}/g, '</p><p class="lily-md-p">');
    s = `<p class="lily-md-p">${s}</p>`;

    // Single newlines (not already block-level tags) become <br>
    s = s.replace(/([^>])\n([^<])/g, '$1<br>$2');

    // Clean up empty paragraphs
    s = s.replace(/<p class="lily-md-p"><\/p>/g, '');
    s = s.replace(/<p class="lily-md-p">(<[huo])/g, '$1');
    s = s.replace(/(<\/[huo][l4-9]>)<\/p>/g, '$1');

    return s;
  }


</script>

<div class="crm-lily">

  <!-- ── Context banner ────────────────────────────────────────────────── -->
  <div class="crm-lily__intro">
    <div class="crm-lily__intro-avatar">
      <img src="/lili.png" alt="Lily" class="crm-lily__intro-avatar-img" />
      <span class="crm-lily__intro-dot"></span>
    </div>
    <div>
      <strong class="crm-lily__intro-name">Lily — CRM Copilot</strong>
      <p class="crm-lily__intro-desc">Ask Lily to summarize this project, draft a follow-up email, identify next steps, or answer any question about this client.</p>
    </div>
  </div>

  <!-- ── Messages ──────────────────────────────────────────────────────── -->
  <div class="crm-lily__messages" bind:this={scrollEl}>
    {#if messages.length === 0}
      <div class="crm-lily__empty" role="status">
        <p>Start a conversation. Try <em>"Summarize this project"</em>, <em>"Draft a follow-up email"</em>, or give Lily details to fill in: <em>"Origin is Panama City, phone +1 502 435 1958"</em>. Her proposed changes wait in a panel above the message box, where you can edit them before anything is saved.</p>
      </div>
    {/if}

    {#each messages as msg (msg.timestamp + msg.role + msg.content.slice(0, 8))}
      {#if msg.role === 'assistant'}
        <div class="crm-lily__row crm-lily__row--lily">
          <span class="crm-lily__pip crm-lily__pip--lily">
            <img src="/lili.png" alt="Lily" class="crm-lily__pip-img" />
          </span>
          <div class="crm-lily__bubble crm-lily__bubble--lily">
            <p class="crm-lily__text crm-lily__text--html">{@html md(msg.content)}</p>
            <span class="crm-lily__time">{formatTime(msg.timestamp)}</span>
          </div>
        </div>
        {#if msg.fieldProposals?.length}
          <p class="lily-prop-note" role="status">
            <span class="lily-prop-note__dot" class:lily-prop-note__dot--pending={msg.fieldProposals.some((p) => p.status === 'pending')} aria-hidden="true"></span>
            {messageProposalSummary(msg.fieldProposals)}
            {#if msg.fieldProposals.some((p) => p.status === 'pending')}
              <button type="button" class="lily-prop-note__review" on:click={() => reviewProposal(msg)}>Review</button>
            {/if}
          </p>
        {/if}
      {:else}
        <div class="crm-lily__row crm-lily__row--staff">
          <div class="crm-lily__bubble crm-lily__bubble--staff">
            <p class="crm-lily__text crm-lily__text--html">{@html md(msg.content)}</p>
            <span class="crm-lily__time">{formatTime(msg.timestamp)}</span>
          </div>
          <span class="crm-lily__pip crm-lily__pip--staff">👤</span>
        </div>
      {/if}
    {/each}

    {#if loading}
      <div class="crm-lily__row crm-lily__row--lily">
        <span class="crm-lily__pip crm-lily__pip--lily">
          <img src="/lili.png" alt="Lily" class="crm-lily__pip-img" />
        </span>
        <div class="crm-lily__bubble crm-lily__bubble--lily crm-lily__bubble--typing">
          <span class="crm-dot"></span><span class="crm-dot"></span><span class="crm-dot"></span>
        </div>
      </div>
    {/if}
  </div>

  <!-- ── Quick-prompt chips ────────────────────────────────────────────── -->
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div class="crm-lily__chips">
    {#each [
      { label: '📅 Dates',         text: "What important dates were discussed in this client's call? Include move date, estimated arrival, and any other deadlines." },
      { label: '📦 Items',         text: "What items, furniture, or special goods did the client mention shipping? Include vehicles, artwork, fragile or unusual items." },
      { label: '💬 Concerns',      text: "What were the main concerns or hesitations this client expressed? What questions did they ask?" },
      { label: '💰 Budget',        text: "What budget did the client mention? Were any pricing expectations, comparisons, or concerns discussed?" },
      { label: '🏠 Move scope',    text: "Summarize the full scope: origin, destination, property types, number of rooms, packing preference, and estimated volume." },
    ] as chip}
      <button
        type="button"
        class="crm-lily__chip"
        disabled={loading}
        on:click={() => { input = chip.text; }}
        title={chip.text}
      >{chip.label}</button>
    {/each}
  </div>

  <!-- ── Confirmation panel: Lily's pending field changes ─────────────── -->
  <LilyProposalPanel
    bind:this={panel}
    rows={pendingRows}
    doc={clientDoc}
    {overrides}
    {savingId}
    {receipt}
    disabled={loading || applying}
    errors={proposalErrors}
    onApply={applyDecisions}
    onDiscard={discardRows}
    onUndo={undoReceipt}
    onDismissReceipt={() => showReceipt(null)}
  />

  <!-- ── Input form ────────────────────────────────────────────────────── -->
  <form class="crm-lily__form" on:submit={handleSubmit}>
    <textarea
      bind:this={inputEl}
      class="crm-lily__input"
      bind:value={input}
      on:keydown={handleKeydown}
      placeholder="Ask Lily about this client… e.g. 'What dates were discussed?' or 'Was a wooden crate for artwork mentioned?'"
      rows="2"
      disabled={loading}
    ></textarea>
    <button class="crm-lily__send" type="submit" disabled={!input.trim() || loading} title={!input.trim() ? 'Type a message first' : undefined}>
      {#if loading}
        <span class="crm-lily__spinner"></span>
      {:else}
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
      {/if}
    </button>
  </form>
</div>

<style>
  /* All colours use --chat-* tokens from _chat.scss — no hardcoded hex. */

  .crm-lily {
    display: flex;
    flex-direction: column;
    height: 100%;       /* preserves fill behaviour inside DetailPanel */
    min-height: 400px;
    gap: 0;
    background: var(--chat-glass-bg, rgba(10,12,20,0.97));
    border-radius: var(--irp-r-md);
    overflow: hidden;
    border: 1px solid var(--chat-glass-border, rgba(255,255,255,0.07));
  }

  /* ── Context banner ────────────────────────────────────────────────────── */
  .crm-lily__intro {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    background: var(--chat-glass-header, rgba(8,10,18,0.99));
    border-bottom: 1px solid var(--chat-glass-border, rgba(255,255,255,0.07));
    padding: 0.85rem 1rem;
    flex-shrink: 0;
  }

  .crm-lily__intro-avatar {
    position: relative;
    flex-shrink: 0;
    width: 36px;
    height: 36px;
  }
  .crm-lily__intro-avatar-img {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    object-fit: cover;
    border: 1.5px solid var(--chat-glass-border-glow, rgba(2,181,187,0.3));
    display: block;
  }
  .crm-lily__intro-dot {
    position: absolute;
    bottom: 0;
    right: 0;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--irp-green-400);
    border: 2px solid var(--chat-glass-header, rgba(8,10,18,0.99));
    box-shadow: 0 0 5px rgba(74,222,128,0.6);
  }
  .crm-lily__intro-name {
    display: block;
    color: var(--chat-color-lily, var(--irp-accent-ink));
    font-weight: 700;
    font-size: var(--irp-fs-sm);
    margin-bottom: 2px;
  }
  .crm-lily__intro-desc {
    margin: 0;
    font-size: var(--irp-fs-xs);
    color: var(--chat-text-secondary, rgba(255,255,255,0.55));
    line-height: 1.4;
  }

  /* ── Messages ──────────────────────────────────────────────────────────── */
  .crm-lily__messages {
    flex: 1;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    padding: 0.85rem;
    min-height: 0;
    scrollbar-width: thin;
    scrollbar-color: var(--chat-scrollbar-thumb, rgba(2,181,187,0.25)) transparent;
  }
  .crm-lily__messages::-webkit-scrollbar { width: 4px; }
  .crm-lily__messages::-webkit-scrollbar-thumb {
    background: var(--chat-scrollbar-thumb, rgba(2,181,187,0.25));
    border-radius: 2px;
  }

  .crm-lily__empty {
    text-align: center;
    color: var(--irp-text-dim);
    font-size: var(--irp-fs-sm);
    padding: 1.5rem 1rem;
    font-style: normal;
  }
  .crm-lily__empty p { margin: 0; }

  .crm-lily__row {
    display: flex;
    align-items: flex-end;
    gap: 0.4rem;
  }
  .crm-lily__row--staff { flex-direction: row-reverse; }

  /* ── Field proposals: one status line under the Lily bubble that proposed them.
     The editable list itself lives in LilyProposalPanel, above the message box. */
  .lily-prop-note {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    margin: -0.2rem 0 0 calc(24px + 0.4rem); /* clear the avatar pip */
    font-size: var(--irp-fs-2xs);
    font-weight: 600;
    color: var(--chat-text-secondary, rgba(255,255,255,0.55));
  }
  .lily-prop-note__dot {
    width: 6px;
    height: 6px;
    flex: none;
    border-radius: 50%;
    background: var(--chat-text-dim, rgba(255,255,255,0.35));
  }
  .lily-prop-note__dot--pending { background: var(--chat-color-lily, var(--irp-accent)); box-shadow: 0 0 6px rgba(2,181,187,0.7); }
  .lily-prop-note__review {
    padding: 0 0.3rem;
    border: none;
    border-radius: var(--irp-r-2xs);
    background: none;
    font: inherit;
    color: var(--chat-color-lily, var(--irp-accent-ink));
    text-decoration: underline;
    cursor: pointer;
  }
  .lily-prop-note__review:focus-visible {
    outline: 2px solid var(--chat-color-lily, var(--irp-accent));
    outline-offset: 2px;
  }

  /* ── Avatar pip ──────────────────────────────────────────────────────── */
  .crm-lily__pip {
    font-size: var(--irp-fs-md);
    flex-shrink: 0;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }
  .crm-lily__pip--lily {
    background: var(--chat-bubble-lily, rgba(255,255,255,0.06));
    border: 1px solid var(--chat-bubble-lily-border, rgba(2,181,187,0.18));
  }
  .crm-lily__pip--staff {
    background: var(--chat-bubble-staff, rgba(245,158,11,0.18));
    border: 1px solid var(--chat-bubble-staff-border, rgba(245,158,11,0.3));
    font-size: var(--irp-fs-xs);
  }
  .crm-lily__pip-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    border-radius: 50%;
  }

  /* ── Bubbles ──────────────────────────────────────────────────────────── */
  .crm-lily__bubble {
    max-width: 82%;
    padding: 0.5rem 0.75rem;
    border-radius: var(--irp-r-md);
    font-size: var(--irp-fs-sm);
    line-height: 1.55;
  }
  .crm-lily__bubble--lily {
    background: var(--chat-bubble-lily, rgba(255,255,255,0.06));
    border: 1px solid var(--chat-bubble-lily-border, rgba(2,181,187,0.18));
    border-bottom-left-radius: var(--irp-r-2xs);
    color: var(--chat-text-primary, rgba(255,255,255,0.92));
  }
  .crm-lily__bubble--staff {
    background: var(--chat-bubble-staff, rgba(245,158,11,0.18));
    border: 1px solid var(--chat-bubble-staff-border, rgba(245,158,11,0.3));
    border-bottom-right-radius: var(--irp-r-2xs);
    color: var(--chat-text-primary, rgba(255,255,255,0.92));
  }
  .crm-lily__bubble--typing {
    display: flex;
    align-items: center;
    gap: 3px;
    padding: 0.75rem 0.85rem;
  }

  .crm-lily__text {
    margin: 0;
    white-space: pre-wrap;
    word-break: break-word;
    color: inherit;
  }

  /* Markdown-rendered content styles */
  :global(.crm-lily__text--html) {
    p, .lily-md-p { margin: 0 0 0.4em; }
    p:last-child, .lily-md-p:last-child { margin-bottom: 0; }
    strong { font-weight: 700; color: inherit; }
    em { font-style: italic; }
    h3.lily-md-h, h4.lily-md-h, h5.lily-md-h {
      margin: 0.5em 0 0.25em;
      font-weight: 700;
      font-size: 0.9em;
      color: inherit;
      line-height: 1.3;
    }
    ul.lily-md-ul, ol.lily-md-ol {
      margin: 0.3em 0;
      padding-left: 1.3em;
    }
    ul.lily-md-ul li, ol.lily-md-ol li { margin-bottom: 2px; font-size: var(--irp-fs-md); }
    code.lily-md-code {
      background: rgba(255,255,255,0.12);
      padding: 1px 5px;
      border-radius: var(--irp-r-2xs);
      font-size: 0.82em;
      font-family: monospace;
    }
    hr.lily-md-hr {
      border: none;
      border-top: 1px solid rgba(255,255,255,0.15);
      margin: 0.5em 0;
    }
  }
  .crm-lily__time {
    display: block;
    font-size: var(--irp-fs-2xs);
    color: var(--chat-text-dim, rgba(255,255,255,0.35));
    margin-top: 3px;
    text-align: right;
  }

  /* ── Typing dots ──────────────────────────────────────────────────────── */
  .crm-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--chat-color-lily, var(--irp-accent));
    animation: chat-dot-bounce 1.2s ease-in-out infinite;
  }
  .crm-dot:nth-child(2) { animation-delay: 0.2s; }
  .crm-dot:nth-child(3) { animation-delay: 0.4s; }

  /* ── Chips ────────────────────────────────────────────────────────────── */
  .crm-lily__chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.32rem;
    padding: 0.5rem 0.85rem 0.3rem;
    border-top: 1px solid var(--chat-glass-border, rgba(255,255,255,0.07));
    flex-shrink: 0;
    background: rgba(255,255,255,0.02);
  }
  .crm-lily__chip {
    padding: 4px 10px;
    border: 1px solid var(--chat-chip-border, rgba(2,181,187,0.32));
    border-radius: var(--irp-r-xl);
    background: transparent;
    color: var(--chat-chip-text, var(--irp-accent-ink));
    font-size: var(--irp-fs-xs);
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
    white-space: nowrap;
    transition: background 0.15s, border-color 0.15s;
  }
  .crm-lily__chip:hover:not(:disabled) {
    background: var(--chat-chip-hover-bg, rgba(2,181,187,0.12));
    border-color: var(--chat-color-lily, var(--irp-accent));
  }
  .crm-lily__chip:disabled { opacity: 0.35; cursor: not-allowed; }

  /* ── Form ─────────────────────────────────────────────────────────────── */
  .crm-lily__form {
    display: flex;
    align-items: flex-end;
    gap: 0.4rem;
    border-top: 1px solid var(--chat-glass-border, rgba(255,255,255,0.07));
    padding: 0.6rem 0.85rem;
    flex-shrink: 0;
    background: var(--chat-glass-bg, rgba(10,12,20,0.97));
  }
  .crm-lily__input {
    flex: 1;
    resize: none;
    border: 1.5px solid var(--chat-glass-border, rgba(255,255,255,0.07));
    border-radius: var(--irp-r-sm);
    padding: 0.45rem 0.7rem;
    font-size: var(--irp-fs-sm);
    font-family: inherit;
    line-height: 1.4;
    outline: none;
    background: var(--chat-glass-input-bg, rgba(255,255,255,0.05));
    color: var(--chat-text-primary, rgba(255,255,255,0.92));
    transition: border-color 0.2s;
  }
  .crm-lily__input:focus {
    border-color: var(--chat-glass-input-focus, rgba(2,181,187,0.3));
    background: rgba(255,255,255,0.07);
  }
  .crm-lily__input::placeholder { color: var(--chat-text-dim, rgba(255,255,255,0.35)); }
  .crm-lily__input:disabled { opacity: 0.5; }

  .crm-lily__send {
    width: 34px;
    height: 34px;
    border-radius: var(--irp-r-sm);
    background: var(--chat-send-bg, var(--irp-accent));
    color: var(--irp-text-inverse);
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    transition: background 0.15s, transform 0.15s;
  }
  .crm-lily__send:hover:not(:disabled) {
    background: var(--chat-send-hover, var(--irp-accent-hover));
    transform: scale(1.05);
  }
  .crm-lily__send:disabled { opacity: 0.4; cursor: not-allowed; }

  .crm-lily__spinner {
    width: 13px;
    height: 13px;
    border: 2px solid rgba(255,255,255,0.35);
    border-top-color: var(--irp-slate-0);
    border-radius: 50%;
    animation: chat-spin 0.7s linear infinite;
  }
</style>
