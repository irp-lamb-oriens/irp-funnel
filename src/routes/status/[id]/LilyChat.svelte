<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { project, sendLilyMessage, lilyMessages, lilyLoading } from './store.ts';

  export let projectId: string;

  // ── Configuration props (all defaulted so existing callers need 0 changes) ─
  /** When true, renders a group-chat layout with per-participant styled bubbles,
   *  a participants bar in the header, and author names above each message. */
  export let groupChat = false;
  /** When true, the messages container grows with flex instead of being capped
   *  at a fixed max-height. Use inside a flex-parent like the lily-drawer. */
  export let fillContainer = false;
  /** Optional callback — when provided, a close (×) button is shown in the
   *  header so the parent can close the drawer without needing a separate
   *  FAB overlay. */
  export let onClose: (() => void) | null = null;

  let input = '';
  let scrollEl: HTMLDivElement;

  async function scrollToBottom() {
    await tick();
    if (scrollEl) scrollEl.scrollTop = scrollEl.scrollHeight;
  }

  $: if ($lilyMessages.length) scrollToBottom();

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    const msg = input.trim();
    if (!msg || $lilyLoading) return;
    input = '';
    await sendLilyMessage(projectId, msg);
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as any);
    }
  }

  function formatTime(iso: string): string {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch { return ''; }
  }

  /** Map message → participant kind for colour/icon purposes. */
  function getParticipantKind(msg: any): 'lily' | 'staff' | 'client' {
    if (msg.role === 'assistant') return 'lily';
    if (msg.authorType === 'staff') return 'staff';
    return 'client';
  }

  /** Display name for a message bubble. */
  function getAuthorLabel(msg: any): string {
    if (msg.role === 'assistant') return 'Lily';
    if (msg.authorType === 'staff') return msg.author ?? 'IRP Team';
    return msg.author ?? ($project?.name ? $project.name.split(' ')[0] : 'You');
  }

  /**
   * Lightweight Markdown → safe HTML converter.
   * Covers the patterns Lily commonly outputs: bold, italic, headers, lists, hr, code.
   * Input comes from our own LLM so XSS risk is low, but we still avoid innerHTML
   * injection of untrusted attribute values.
   */
  function md(text: string): string {
    if (!text) return '';
    let s = text
      // Escape raw < > in text that aren't already tags
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

<section class="lily-chat" class:lily-chat--group={groupChat} class:lily-chat--fill={fillContainer}>

  <!-- ── Header ─────────────────────────────────────────────────────── -->
  <div class="lily-chat__header">
    <div class="lily-chat__header-avatar-wrap">
      <img src="/lili.png" alt="Lily" class="lily-chat__header-avatar" />
      <span class="lily-chat__header-dot"></span>
    </div>
    <div class="lily-chat__header-info">
      <div class="lily-chat__header-name">Lily</div>
      <div class="lily-chat__header-sub">
        {#if groupChat}
          <span class="lily-chat__header-group-label">Group · Lily, You, IRP Team</span>
        {:else}
          Your Relocation Concierge
        {/if}
      </div>
    </div>
    {#if groupChat}
      <!-- Stacked participant avatars -->
      <div class="lily-chat__participants">
        <span class="lily-chat__participant lily-chat__participant--lily" title="Lily (AI)">🌿</span>
        <span class="lily-chat__participant lily-chat__participant--client" title="You">🙋</span>
        <span class="lily-chat__participant lily-chat__participant--staff" title="IRP Team">👤</span>
      </div>
    {/if}
    {#if onClose}
      <button class="lily-chat__close-btn" on:click={onClose} aria-label="Close chat" type="button">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    {/if}
  </div>

  <!-- ── Messages ───────────────────────────────────────────────────── -->
  <div class="lily-chat__messages" bind:this={scrollEl}>
    {#if $lilyMessages.length === 0}
      <div class="lily-chat__empty">
        <div class="lily-chat__empty-icon">💬</div>
        <p>Hi {$project?.name ? $project.name.split(' ')[0] : 'there'}! I'm Lily, your dedicated concierge for this relocation. Ask me anything — packing, timelines, documents, or next steps.</p>
      </div>
    {/if}

    {#each $lilyMessages as msg (msg.timestamp + '-' + msg.role)}
      {@const kind = getParticipantKind(msg)}
      {@const isMe = kind === 'client'}
      <div class="lily-chat__row lily-chat__row--{kind}" class:lily-chat__row--right={isMe}>
        {#if !isMe}
          <span class="lily-chat__pip lily-chat__pip--{kind}">
            {#if kind === 'lily'}<img src="/lili.png" alt="Lily" class="lily-chat__pip-img" />{:else}👤{/if}
          </span>
        {/if}
        <div class="lily-chat__bubble-wrap">
          {#if groupChat}
            <span class="lily-chat__author lily-chat__author--{kind}">{getAuthorLabel(msg)}{#if kind === 'staff'}&nbsp;<span class="lily-chat__staff-pill">Staff</span>{/if}</span>
          {:else if msg.authorType === 'staff'}
            <span class="lily-chat__author lily-chat__author--staff">{msg.author ?? 'IRP Team'}&nbsp;<span class="lily-chat__staff-pill">Staff</span></span>
          {/if}
          <div class="lily-chat__bubble lily-chat__bubble--{kind}">
            <p class="lily-chat__text lily-chat__text--html">{@html md(msg.content)}</p>
            <span class="lily-chat__time">{formatTime(msg.timestamp)}</span>
          </div>
        </div>
        {#if isMe}
          <span class="lily-chat__pip lily-chat__pip--client">🙋</span>
        {/if}
      </div>
    {/each}

    {#if $lilyLoading}
      <div class="lily-chat__row lily-chat__row--lily">
        <span class="lily-chat__pip lily-chat__pip--lily">
          <img src="/lili.png" alt="Lily" class="lily-chat__pip-img" />
        </span>
        <div class="lily-chat__bubble-wrap">
          <div class="lily-chat__bubble lily-chat__bubble--lily lily-chat__bubble--typing">
            <span class="lily-dot"></span>
            <span class="lily-dot"></span>
            <span class="lily-dot"></span>
          </div>
        </div>
      </div>
    {/if}
  </div>

  <!-- ── Quick-prompt chips ─────────────────────────────────────────── -->
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div class="lily-chat__chips">
    {#each [
      { label: '📅 My dates',       text: "What are the important dates for my move? Include my move date and estimated arrival at destination." },
      { label: '📦 Packing tips',   text: "What are the most important packing tips for an international move? What should I be careful about?" },
      { label: '📋 Documents',      text: "What documents will I need for customs and the move to my destination?" },
      { label: '💰 What to expect', text: "Can you give me an overview of the typical costs involved in an international relocation?" },
    ] as chip}
      <button
        type="button"
        class="lily-chat__chip"
        disabled={$lilyLoading}
        on:click={() => { input = chip.text; }}
        title={chip.text}
      >{chip.label}</button>
    {/each}
  </div>

  <!-- ── Input form ─────────────────────────────────────────────────── -->
  <form class="lily-chat__form" on:submit={handleSubmit}>
    <textarea
      class="lily-chat__input"
      bind:value={input}
      on:keydown={handleKeydown}
      placeholder="Ask Lily a question about your move…"
      rows="2"
      disabled={$lilyLoading}
    ></textarea>
    <button class="lily-chat__send" type="submit" disabled={!input.trim() || $lilyLoading}>
      {#if $lilyLoading}
        <span class="lily-chat__spinner"></span>
      {:else}
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
      {/if}
    </button>
  </form>
</section>

<style lang="scss">
  /* ── Root: all colours reference --chat-* tokens from _chat.scss ──────────
     No hex values here. If brand palette changes → update _chat.scss only. */

  .lily-chat {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--chat-glass-bg);
    border-radius: 16px;
    overflow: hidden;
    border: 1px solid var(--chat-glass-border);
    box-shadow:
      0 0 0 1px var(--chat-glass-border-glow),
      0 24px 64px rgba(0, 0, 0, 0.55),
      inset 0 1px 0 rgba(255,255,255,0.04);

    // ── fill mode — used inside the lily-drawer flex container ─────────────
    &--fill {
      border-radius: 0; // drawer already has border-radius
      border: none;
      box-shadow: none;
    }
  }

  /* ── Header ─────────────────────────────────────────────────────────────── */
  .lily-chat__header {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.9rem 1.1rem;
    background: var(--chat-glass-header);
    border-bottom: 1px solid var(--chat-glass-border);
    flex-shrink: 0;
    position: relative;
    overflow: hidden;

    // Subtle teal gradient shimmer in header
    &::after {
      content: '';
      position: absolute;
      top: 0; left: 0; right: 0; bottom: 0;
      background: linear-gradient(90deg, transparent, rgba(2,181,187,0.04), transparent);
      pointer-events: none;
    }
  }

  .lily-chat__header-avatar-wrap {
    position: relative;
    flex-shrink: 0;
  }

  .lily-chat__header-avatar {
    width: 38px;
    height: 38px;
    border-radius: 50%;
    object-fit: cover;
    border: 2px solid var(--chat-glass-border-glow);
    display: block;
  }

  .lily-chat__header-dot {
    position: absolute;
    bottom: 0;
    right: 0;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: #4ade80;
    border: 2px solid var(--chat-glass-header);
    box-shadow: 0 0 0 0 rgba(74, 222, 128, 0.4);
    animation: chat-header-pulse 2s ease-in-out infinite;
  }

  .lily-chat__header-info {
    flex: 1;
    min-width: 0;
  }

  .lily-chat__header-name {
    font-size: 0.9rem;
    font-weight: 700;
    color: var(--chat-text-primary);
    line-height: 1.2;
  }

  .lily-chat__header-sub {
    font-size: 0.72rem;
    color: var(--chat-text-secondary);
    margin-top: 2px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .lily-chat__header-group-label {
    color: var(--chat-color-lily);
    font-weight: 600;
  }

  /* ── Group-chat participants bar ────────────────────────────────────────── */
  .lily-chat__participants {
    display: flex;
    align-items: center;
    flex-direction: row-reverse;
  }

  .lily-chat__participant {
    width: 26px;
    height: 26px;
    border-radius: 50%;
    border: 2px solid var(--chat-glass-header);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.75rem;
    margin-left: -8px;
    flex-shrink: 0;
    &--lily   { background: rgba(2, 181, 187, 0.25);  }
    &--client { background: rgba(99, 102, 241, 0.25); }
    &--staff  { background: rgba(245, 158, 11, 0.25); }
  }

  /* ── Messages area ───────────────────────────────────────────────────────── */
  .lily-chat__messages {
    flex: 1;
    overflow-y: auto;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.65rem;
    min-height: 0; // critical for flex: 1 to work correctly inside flex parent
    scrollbar-width: thin;
    scrollbar-color: var(--chat-scrollbar-thumb) var(--chat-scrollbar-track);
    &::-webkit-scrollbar { width: 4px; }
    &::-webkit-scrollbar-thumb { background: var(--chat-scrollbar-thumb); border-radius: 2px; }

    // When NOT in fill mode, apply a max-height cap (legacy inline chat)
    .lily-chat:not(.lily-chat--fill) & {
      max-height: 400px;
    }
  }

  /* ── Empty state ────────────────────────────────────────────────────────── */
  .lily-chat__empty {
    text-align: center;
    color: var(--chat-text-secondary);
    padding: 2rem 1rem;
    &-icon { font-size: 2.2rem; margin-bottom: 0.5rem; }
    p { font-size: 0.88rem; line-height: 1.55; margin: 0; }
  }

  /* ── Message rows ────────────────────────────────────────────────────────── */
  .lily-chat__row {
    display: flex;
    align-items: flex-end;
    gap: 0.45rem;
    animation: chat-bubble-in 0.22s cubic-bezier(0.23, 1, 0.32, 1) both;

    &--right {
      flex-direction: row-reverse;
    }
  }

  /* ── Avatar pip ─────────────────────────────────────────────────────────── */
  .lily-chat__pip {
    flex-shrink: 0;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1rem;
    overflow: hidden;

    &--lily   { background: rgba(2, 181, 187, 0.15); border: 1px solid rgba(2, 181, 187, 0.3); }
    &--client { background: rgba(99, 102, 241, 0.15); border: 1px solid rgba(99, 102, 241, 0.3); font-size: 0.85rem; }
    &--staff  { background: rgba(245, 158, 11, 0.15); border: 1px solid rgba(245, 158, 11, 0.3); font-size: 0.85rem; }
  }

  .lily-chat__pip-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    border-radius: 50%;
  }

  /* ── Bubble wrap + author ────────────────────────────────────────────────── */
  .lily-chat__bubble-wrap {
    display: flex;
    flex-direction: column;
    max-width: 76%;
    gap: 3px;
  }

  .lily-chat__author {
    font-size: 0.68rem;
    font-weight: 700;
    letter-spacing: 0.02em;
    padding-left: 4px;

    &--lily   { color: var(--chat-color-lily); }
    &--client { color: var(--chat-color-client); }
    &--staff  { color: var(--chat-color-staff); }

    .lily-chat__row--right & { text-align: right; padding-left: 0; padding-right: 4px; }
  }

  .lily-chat__staff-pill {
    font-size: 0.58rem;
    background: rgba(245, 158, 11, 0.2);
    color: var(--chat-color-staff);
    padding: 1px 5px;
    border-radius: 4px;
    font-weight: 700;
    letter-spacing: 0.03em;
    text-transform: uppercase;
    vertical-align: middle;
  }

  /* ── Bubbles ─────────────────────────────────────────────────────────────── */
  .lily-chat__bubble {
    padding: 0.6rem 0.85rem;
    border-radius: 14px;
    position: relative;

    &--lily {
      background: var(--chat-bubble-lily);
      border: 1px solid var(--chat-bubble-lily-border);
      border-bottom-left-radius: 4px;
      color: var(--chat-text-primary);
    }

    &--client {
      background: var(--chat-bubble-client);
      border: 1px solid var(--chat-bubble-client-border);
      border-bottom-right-radius: 4px;
      color: var(--chat-text-primary);
    }

    &--staff {
      background: var(--chat-bubble-staff);
      border: 1px solid var(--chat-bubble-staff-border);
      border-bottom-right-radius: 4px;
      color: var(--chat-text-primary);
    }

    &--typing {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 0.9rem 1rem;
      min-width: 58px;
    }
  }

  /* ── Text & timestamp ───────────────────────────────────────────────────── */
  .lily-chat__text {
    margin: 0;
    font-size: 0.88rem;
    line-height: 1.55;
    white-space: pre-wrap;
    word-break: break-word;
    color: inherit;
  }

  /* Markdown-rendered content styles */
  :global(.lily-chat__text--html) {
    p, .lily-md-p { margin: 0 0 0.4em; &:last-child { margin-bottom: 0; } }
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
      li { margin-bottom: 2px; font-size: 0.88rem; }
    }
    code.lily-md-code {
      background: rgba(255,255,255,0.12);
      padding: 1px 5px;
      border-radius: 4px;
      font-size: 0.82em;
      font-family: monospace;
    }
    hr.lily-md-hr {
      border: none;
      border-top: 1px solid rgba(255,255,255,0.15);
      margin: 0.5em 0;
    }
  }

  .lily-chat__time {
    display: block;
    font-size: 0.65rem;
    color: var(--chat-text-dim);
    margin-top: 4px;
    text-align: right;
  }

  /* ── Typing dots ────────────────────────────────────────────────────────── */
  .lily-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--chat-color-lily);
    animation: chat-dot-bounce 1.2s ease-in-out infinite;
    &:nth-child(2) { animation-delay: 0.2s; }
    &:nth-child(3) { animation-delay: 0.4s; }
  }

  /* ── Quick-prompt chips ─────────────────────────────────────────────────── */
  .lily-chat__chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    padding: 0.55rem 0.85rem 0.3rem;
    background: rgba(255, 255, 255, 0.02);
    border-top: 1px solid var(--chat-glass-border);
    flex-shrink: 0;
  }

  .lily-chat__chip {
    padding: 5px 11px;
    border: 1px solid var(--chat-chip-border);
    border-radius: 20px;
    background: transparent;
    color: var(--chat-chip-text);
    font-size: 0.76rem;
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
    white-space: nowrap;
    transition: background 0.15s, border-color 0.15s;
    &:hover:not(:disabled) {
      background: var(--chat-chip-hover-bg);
      border-color: var(--chat-color-lily);
    }
    &:disabled { opacity: 0.35; cursor: not-allowed; }
  }

  /* ── Input form ─────────────────────────────────────────────────────────── */
  .lily-chat__form {
    display: flex;
    align-items: flex-end;
    gap: 0.5rem;
    padding: 0.7rem 0.85rem;
    border-top: 1px solid var(--chat-glass-border);
    background: var(--chat-glass-bg);
    flex-shrink: 0;
  }

  .lily-chat__input {
    flex: 1;
    resize: none;
    border: 1.5px solid var(--chat-glass-border);
    border-radius: 10px;
    padding: 0.55rem 0.85rem;
    font-size: 0.88rem;
    font-family: inherit;
    line-height: 1.4;
    outline: none;
    background: var(--chat-glass-input-bg);
    color: var(--chat-text-primary);
    transition: border-color 0.2s;

    &:focus { border-color: var(--chat-glass-input-focus); background: rgba(255,255,255,0.07); }
    &::placeholder { color: var(--chat-text-dim); }
    &:disabled { opacity: 0.5; }
  }

  .lily-chat__send {
    width: 40px;
    height: 40px;
    border-radius: 10px;
    background: var(--chat-send-bg);
    color: #fff;
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.2s, opacity 0.2s, transform 0.15s;
    flex-shrink: 0;

    &:hover:not(:disabled) { background: var(--chat-send-hover); transform: scale(1.05); }
    &:disabled { opacity: 0.4; cursor: not-allowed; }
  }

  .lily-chat__spinner {
    width: 16px;
    height: 16px;
    border: 2px solid rgba(255,255,255,0.35);
    border-top-color: #fff;
    border-radius: 50%;
    animation: chat-spin 0.7s linear infinite;
  }

  /* ── Close button (shown when onClose prop is provided) ─────────────────── */
  .lily-chat__close-btn {
    flex-shrink: 0;
    background: none;
    border: none;
    color: rgba(255,255,255,0.4);
    cursor: pointer;
    padding: 6px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: color 0.2s, background 0.2s;
    margin-left: auto;
    &:hover {
      color: rgba(255,255,255,0.9);
      background: rgba(255,255,255,0.08);
    }
  }
</style>
