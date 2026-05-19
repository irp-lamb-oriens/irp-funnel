<script lang="ts">
  /**
   * CrmLilyTab.svelte — CRM Lily AI copilot tab inside the Dashboard DetailPanel.
   *
   * Self-contained: manages its own message state, calls the Lily CRM API
   * directly using the IRP staff token. Does NOT touch the hero-form chatbot.
   */
  import { tick, onMount } from 'svelte';
  import { get } from 'svelte/store';
  import { irpStaffToken, getApiUrl } from '../../../lib/auth/irpStaff.ts';

  export let clientId: string;

  const API_BASE = getApiUrl();

  // ─── State ────────────────────────────────────────────────────────────────
  type Msg = { role: 'user' | 'assistant'; content: string; timestamp: string; };
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
</script>

<div class="crm-lily">
  <div class="crm-lily__intro">
    <span class="crm-lily__leaf">🌿</span>
    <div>
      <strong>Lily — CRM Copilot</strong>
      <p>Ask Lily to summarize this project, draft a follow-up email, identify next steps, or answer any question about this client.</p>
    </div>
  </div>

  <div class="crm-lily__messages" bind:this={scrollEl}>
    {#if messages.length === 0}
      <div class="crm-lily__empty">
        <p>Start a conversation. Try <em>"Summarize this project"</em> or <em>"Draft a follow-up email"</em>.</p>
      </div>
    {/if}

    {#each messages as msg (msg.timestamp + msg.role + msg.content.slice(0, 8))}
      {#if msg.role === 'assistant'}
        <div class="crm-lily__row crm-lily__row--lily">
          <span class="crm-lily__pip">🌿</span>
          <div class="crm-lily__bubble crm-lily__bubble--lily">
            <p class="crm-lily__text">{msg.content}</p>
            <span class="crm-lily__time">{formatTime(msg.timestamp)}</span>
          </div>
        </div>
      {:else}
        <div class="crm-lily__row crm-lily__row--staff">
          <div class="crm-lily__bubble crm-lily__bubble--staff">
            <p class="crm-lily__text">{msg.content}</p>
            <span class="crm-lily__time">{formatTime(msg.timestamp)}</span>
          </div>
          <span class="crm-lily__pip">👤</span>
        </div>
      {/if}
    {/each}

    {#if loading}
      <div class="crm-lily__row crm-lily__row--lily">
        <span class="crm-lily__pip">🌿</span>
        <div class="crm-lily__bubble crm-lily__bubble--lily crm-lily__bubble--typing">
          <span class="dot"></span><span class="dot"></span><span class="dot"></span>
        </div>
      </div>
    {/if}
  </div>

  <form class="crm-lily__form" on:submit={handleSubmit}>
    <textarea
      class="crm-lily__input"
      bind:value={input}
      on:keydown={handleKeydown}
      placeholder="Ask Lily about this client…"
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
  .crm-lily {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 400px;
    gap: 0.75rem;
  }

  .crm-lily__intro {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    background: linear-gradient(135deg, rgba(2,181,187,0.07) 0%, rgba(2,181,187,0.03) 100%);
    border: 1px solid rgba(2,181,187,0.2);
    border-radius: 10px;
    padding: 0.85rem 1rem;
    font-size: 0.82rem;
    color: #475569;
    line-height: 1.5;
    flex-shrink: 0;
  }

  .crm-lily__intro strong {
    display: block;
    color: #02b5bb;
    font-weight: 700;
    font-size: 0.88rem;
    margin-bottom: 2px;
  }

  .crm-lily__intro p { margin: 0; }
  .crm-lily__leaf { font-size: 1.25rem; flex-shrink: 0; }

  .crm-lily__messages {
    flex: 1;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    padding: 0.25rem 0;
    min-height: 150px;
  }

  .crm-lily__empty {
    text-align: center;
    color: #94a3b8;
    font-size: 0.83rem;
    padding: 1.5rem 1rem;
    font-style: italic;
    p { margin: 0; }
  }

  .crm-lily__row {
    display: flex;
    align-items: flex-end;
    gap: 0.4rem;
    &--staff { flex-direction: row-reverse; }
  }

  .crm-lily__pip {
    font-size: 0.95rem;
    flex-shrink: 0;
    width: 22px;
    text-align: center;
  }

  .crm-lily__bubble {
    max-width: 80%;
    padding: 0.55rem 0.75rem;
    border-radius: 12px;
    font-size: 0.85rem;
    line-height: 1.55;

    &--lily {
      background: #f0fafa;
      border: 1px solid rgba(2,181,187,0.2);
      border-bottom-left-radius: 3px;
      color: #334155;
    }
    &--staff {
      background: #02b5bb;
      color: #fff;
      border-bottom-right-radius: 3px;
    }
    &--typing {
      display: flex;
      align-items: center;
      gap: 3px;
      padding: 0.75rem 1rem;
    }
  }

  .crm-lily__text {
    margin: 0;
    white-space: pre-wrap;
    word-break: break-word;
  }

  .crm-lily__time {
    display: block;
    font-size: 0.65rem;
    opacity: 0.45;
    margin-top: 3px;
    text-align: right;
  }

  .crm-lily__form {
    display: flex;
    align-items: flex-end;
    gap: 0.4rem;
    border-top: 1px solid rgba(0,0,0,0.08);
    padding-top: 0.6rem;
    flex-shrink: 0;
  }

  .crm-lily__input {
    flex: 1;
    resize: none;
    border: 1.5px solid rgba(2,181,187,0.3);
    border-radius: 8px;
    padding: 0.5rem 0.75rem;
    font-size: 0.85rem;
    font-family: inherit;
    line-height: 1.4;
    outline: none;
    transition: border-color 0.2s;
    &:focus { border-color: #02b5bb; }
    &::placeholder { color: #b0c4c4; }
    &:disabled { opacity: 0.6; }
  }

  .crm-lily__send {
    width: 36px;
    height: 36px;
    border-radius: 8px;
    background: #02b5bb;
    color: #fff;
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    transition: background 0.15s;
    &:hover:not(:disabled) { background: #019fa4; }
    &:disabled { opacity: 0.5; cursor: not-allowed; }
  }

  .crm-lily__spinner {
    width: 14px;
    height: 14px;
    border: 2px solid rgba(255,255,255,0.35);
    border-top-color: #fff;
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
  }

  .dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #02b5bb;
    animation: bounce 1.2s ease-in-out infinite;
    &:nth-child(2) { animation-delay: 0.2s; }
    &:nth-child(3) { animation-delay: 0.4s; }
  }

  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes bounce {
    0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
    30% { transform: translateY(-4px); opacity: 1; }
  }
</style>
