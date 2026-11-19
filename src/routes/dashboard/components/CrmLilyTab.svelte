<script lang="ts">
  /**
   * CrmLilyTab.svelte — CRM Lily AI copilot tab inside the Dashboard DetailPanel.
   *
   * Self-contained: manages its own message state, calls the Lily CRM API
   * directly using the IRP staff token. Does NOT touch the hero-form chatbot.
   *
   * Styles use --chat-* tokens from _chat.scss (no hardcoded hex values).
   */
  import { tick, onMount } from 'svelte';
  import { get } from 'svelte/store';
  import { irpStaffToken, getApiUrl } from '../../../lib/auth/irpStaff.ts';
  import { editField } from '../store.ts';

  export let clientId: string;

  const API_BASE = getApiUrl();

  // ─── State ────────────────────────────────────────────────────────────────
  /**
   * A field change Lily proposed. Lily never writes: each proposal is approved
   * or skipped here, and an approval goes through the same `editField` store
   * action as a manual edit (activity log, concurrency guard, undo, and the
   * Overview updating in place).
   */
  type FieldProposal = {
    id: string;
    key: string;
    label: string;
    path: string;
    oldValue: unknown;
    newValue: string | number | boolean;
    status: 'pending' | 'applied' | 'rejected';
  };
  type Msg = { role: 'user' | 'assistant'; content: string; timestamp: string; fieldProposals?: FieldProposal[]; };
  let messages: Msg[] = [];
  let input = '';
  let loading = false;
  let historyLoaded = false;
  let scrollEl: HTMLDivElement;

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
  $: if (clientId) { messages = []; historyLoaded = false; loadHistory(); }

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

  // ─── Field proposals ─────────────────────────────────────────
  let proposalBusy: Record<string, boolean> = {};
  let proposalError: Record<string, string> = {};

  function isEmptyValue(v: unknown): boolean {
    return v === undefined || v === null || v === '';
  }

  function formatValue(v: unknown): string {
    if (typeof v === 'boolean') return v ? 'Yes' : 'No';
    return typeof v === 'string' ? v : JSON.stringify(v);
  }

  function pendingProposals(msg: Msg): FieldProposal[] {
    return (msg.fieldProposals ?? []).filter((p) => p.status === 'pending');
  }

  /** Persist the decision so the card shows the same outcome after a reload. */
  async function recordDecision(p: FieldProposal, status: 'applied' | 'rejected') {
    p.status = status;
    messages = [...messages];
    try {
      await apiFetch(`/api/dashboard/clients/${clientId}/lily/proposals/${encodeURIComponent(p.id)}`, {
        method: 'POST',
        body: JSON.stringify({ status }),
      });
    } catch { /* the decision already took effect; only its bookkeeping failed */ }
  }

  async function approveProposal(p: FieldProposal) {
    if (p.status !== 'pending' || proposalBusy[p.id]) return;
    proposalBusy = { ...proposalBusy, [p.id]: true };
    proposalError = { ...proposalError, [p.id]: '' };
    try {
      await editField(clientId, p.path, p.newValue, p.oldValue ?? '');
      await recordDecision(p, 'applied');
    } catch (err: any) {
      const text = String(err?.message ?? '');
      proposalError = {
        ...proposalError,
        [p.id]: /concurrent|changed/i.test(text)
          ? 'This field was changed after Lily read it. Check the Overview, then ask Lily again.'
          : (text || 'Could not save this field. Try again.'),
      };
    } finally {
      proposalBusy = { ...proposalBusy, [p.id]: false };
    }
  }

  async function skipProposal(p: FieldProposal) {
    if (p.status !== 'pending' || proposalBusy[p.id]) return;
    await recordDecision(p, 'rejected');
  }

  /** Approve one at a time so each write sees the previous one. */
  async function approveAll(msg: Msg) {
    for (const p of pendingProposals(msg)) await approveProposal(p);
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
      <div class="crm-lily__empty">
        <p>Start a conversation. Try <em>"Summarize this project"</em>, <em>"Draft a follow-up email"</em>, or give Lily details to fill in: <em>"Origin is Panama City, phone +1 502 435 1958"</em>. She asks you to confirm each field before anything is saved.</p>
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
          {@const pending = pendingProposals(msg)}
          <section class="lily-prop" aria-label="Field changes proposed by Lily">
            <header class="lily-prop__head">
              <span class="lily-prop__title">
                {#if pending.length}
                  Lily wants to update {pending.length} {pending.length === 1 ? 'field' : 'fields'}
                {:else}
                  Field changes reviewed
                {/if}
              </span>
              {#if pending.length > 1}
                <button type="button" class="lily-prop__btn lily-prop__btn--approve" disabled={loading} on:click={() => approveAll(msg)}>
                  Approve all
                </button>
              {/if}
            </header>
            <ul class="lily-prop__list">
              {#each msg.fieldProposals as p (p.id)}
                <li class="lily-prop__item" class:lily-prop__item--done={p.status !== 'pending'}>
                  <div class="lily-prop__field">
                    <span class="lily-prop__label">{p.label}</span>
                    <span class="lily-prop__change">
                      <span class="lily-prop__old" class:lily-prop__old--empty={isEmptyValue(p.oldValue)}>
                        {isEmptyValue(p.oldValue) ? 'Empty' : formatValue(p.oldValue)}
                      </span>
                      <span class="lily-prop__arrow" aria-hidden="true">→</span>
                      <span class="lily-prop__new">{formatValue(p.newValue)}</span>
                    </span>
                    {#if proposalError[p.id]}
                      <span class="lily-prop__error" role="alert">{proposalError[p.id]}</span>
                    {/if}
                  </div>
                  <div class="lily-prop__actions">
                    {#if p.status === 'applied'}
                      <span class="lily-prop__state lily-prop__state--applied">✓ Saved</span>
                    {:else if p.status === 'rejected'}
                      <span class="lily-prop__state">Skipped</span>
                    {:else}
                      <button type="button" class="lily-prop__btn" disabled={loading || proposalBusy[p.id]} on:click={() => skipProposal(p)}>
                        Skip
                      </button>
                      <button type="button" class="lily-prop__btn lily-prop__btn--approve" disabled={loading || proposalBusy[p.id]} on:click={() => approveProposal(p)}>
                        {proposalBusy[p.id] ? 'Saving…' : 'Approve'}
                      </button>
                    {/if}
                  </div>
                </li>
              {/each}
            </ul>
          </section>
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

  <!-- ── Input form ────────────────────────────────────────────────────── -->
  <form class="crm-lily__form" on:submit={handleSubmit}>
    <textarea
      class="crm-lily__input"
      bind:value={input}
      on:keydown={handleKeydown}
      placeholder="Ask Lily about this client… e.g. 'What dates were discussed?' or 'Was a wooden crate for artwork mentioned?'"
      rows="2"
      disabled={loading}
    ></textarea>
    <button class="crm-lily__send" type="submit" disabled={!input.trim() || loading}>
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
    color: var(--chat-text-secondary, rgba(255,255,255,0.5));
    font-size: var(--irp-fs-sm);
    padding: 1.5rem 1rem;
    font-style: italic;
  }
  .crm-lily__empty p { margin: 0; }

  .crm-lily__row {
    display: flex;
    align-items: flex-end;
    gap: 0.4rem;
  }
  .crm-lily__row--staff { flex-direction: row-reverse; }

  /* ── Field proposals ──────────────────────────────────────────
     Lily proposes, staff confirms. The card sits under Lily's bubble, aligned
     with it, and uses the same glass surface and teal accent. */
  .lily-prop {
    margin-left: calc(24px + 0.4rem); /* clear the avatar pip */
    max-width: calc(82% + 2rem);
    border: 1px solid var(--chat-bubble-lily-border, rgba(2,181,187,0.18));
    border-left: 2px solid var(--chat-color-lily, var(--irp-accent));
    border-radius: var(--irp-r-sm);
    background: var(--chat-bubble-lily, rgba(255,255,255,0.06));
    overflow: hidden;
  }
  .lily-prop__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    padding: 0.5rem 0.75rem;
    border-bottom: 1px solid var(--chat-glass-border, rgba(255,255,255,0.07));
  }
  .lily-prop__title {
    font-size: var(--irp-fs-xs);
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--chat-color-lily, var(--irp-accent-ink));
  }
  .lily-prop__list { list-style: none; margin: 0; padding: 0; }
  .lily-prop__item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    padding: 0.55rem 0.75rem;
  }
  .lily-prop__item + .lily-prop__item {
    border-top: 1px solid var(--chat-glass-border, rgba(255,255,255,0.07));
  }
  .lily-prop__item--done { opacity: 0.72; }
  .lily-prop__field { display: flex; flex-direction: column; gap: 0.15rem; min-width: 0; }
  .lily-prop__label {
    font-size: var(--irp-fs-2xs);
    font-weight: 600;
    color: var(--chat-text-secondary, rgba(255,255,255,0.55));
  }
  .lily-prop__change {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0.35rem;
    font-size: var(--irp-fs-sm);
    line-height: 1.4;
    overflow-wrap: anywhere;
  }
  .lily-prop__old {
    color: var(--chat-text-secondary, rgba(255,255,255,0.55));
    text-decoration: line-through;
  }
  .lily-prop__old--empty {
    color: var(--chat-text-dim, rgba(255,255,255,0.35));
    font-style: italic;
    text-decoration: none;
  }
  .lily-prop__arrow { color: var(--chat-text-dim, rgba(255,255,255,0.35)); }
  .lily-prop__new { color: var(--chat-text-primary, rgba(255,255,255,0.92)); font-weight: 600; }
  .lily-prop__error { font-size: var(--irp-fs-xs); color: var(--chat-color-staff, var(--irp-amber-700)); }
  .lily-prop__actions { display: flex; align-items: center; gap: 0.4rem; flex-shrink: 0; }
  .lily-prop__btn {
    font: inherit;
    font-size: var(--irp-fs-xs);
    font-weight: 600;
    padding: 0.3rem 0.7rem;
    border-radius: var(--irp-r-xs);
    border: 1px solid var(--chat-glass-border, rgba(255,255,255,0.14));
    background: transparent;
    color: var(--chat-text-secondary, rgba(255,255,255,0.55));
    cursor: pointer;
    white-space: nowrap;
    transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
  }
  .lily-prop__btn:hover:not(:disabled) {
    color: var(--chat-text-primary, rgba(255,255,255,0.92));
    border-color: var(--chat-text-secondary, rgba(255,255,255,0.55));
  }
  .lily-prop__btn--approve {
    background: var(--chat-color-lily, var(--irp-accent));
    border-color: var(--chat-color-lily, var(--irp-accent));
    color: var(--irp-text);
  }
  .lily-prop__btn--approve:hover:not(:disabled) {
    color: var(--irp-text);
    border-color: var(--chat-color-lily, var(--irp-accent));
    filter: brightness(1.12);
  }
  .lily-prop__btn:focus-visible {
    outline: 2px solid var(--chat-color-lily, var(--irp-accent));
    outline-offset: 2px;
  }
  .lily-prop__btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .lily-prop__state {
    font-size: var(--irp-fs-xs);
    font-weight: 600;
    color: var(--chat-text-secondary, rgba(255,255,255,0.55));
  }
  .lily-prop__state--applied { color: var(--chat-color-lily, var(--irp-accent-ink)); }
  @media (max-width: 520px) {
    .lily-prop { margin-left: 0; max-width: 100%; }
    .lily-prop__item { flex-direction: column; align-items: stretch; }
    .lily-prop__actions { justify-content: flex-end; }
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
