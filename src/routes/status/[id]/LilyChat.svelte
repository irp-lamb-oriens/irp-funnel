<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { project, sendLilyMessage, lilyMessages, lilyLoading } from './store.ts';

  export let projectId: string;

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
</script>

<section class="lily-chat">
  <div class="lily-chat__header">
    <div class="lily-chat__avatar">🌿</div>
    <div>
      <div class="lily-chat__name">Lily</div>
      <div class="lily-chat__subtitle">Your Relocation Concierge — ask me anything about your move</div>
    </div>
  </div>

  <div class="lily-chat__messages" bind:this={scrollEl}>
    {#if $lilyMessages.length === 0}
      <div class="lily-chat__empty">
        <div class="lily-chat__empty-icon">💬</div>
        <p>Hi {$project?.name ? $project.name.split(' ')[0] : 'there'}! I'm Lily, your dedicated concierge for this relocation. Ask me anything — packing, timelines, documents, or next steps.</p>
      </div>
    {/if}

    {#each $lilyMessages as msg (msg.timestamp + '-' + msg.role)}
      {#if msg.role === 'assistant'}
        <div class="lily-chat__row lily-chat__row--lily">
          <span class="lily-chat__pip lily-chat__pip--lily">🌿</span>
          <div class="lily-chat__bubble lily-chat__bubble--lily">
            <span class="lily-chat__author">Lily</span>
            <p class="lily-chat__text">{msg.content}</p>
            <span class="lily-chat__time">{formatTime(msg.timestamp)}</span>
          </div>
        </div>
      {:else}
        <div class="lily-chat__row lily-chat__row--user">
          <div class="lily-chat__bubble lily-chat__bubble--user">
            {#if msg.authorType === 'staff'}
              <span class="lily-chat__author lily-chat__author--staff">{msg.author ?? 'IRP Team'} <span class="lily-chat__staff-pill">Staff</span></span>
            {:else}
              <span class="lily-chat__author">{msg.author ?? 'You'}</span>
            {/if}
            <p class="lily-chat__text">{msg.content}</p>
            <span class="lily-chat__time">{formatTime(msg.timestamp)}</span>
          </div>
          <span class="lily-chat__pip lily-chat__pip--user">{msg.authorType === 'staff' ? '👤' : '🙋'}</span>
        </div>
      {/if}
    {/each}

    {#if $lilyLoading}
      <div class="lily-chat__row lily-chat__row--lily">
        <span class="lily-chat__pip lily-chat__pip--lily">🌿</span>
        <div class="lily-chat__bubble lily-chat__bubble--lily lily-chat__bubble--typing">
          <span class="typing-dot"></span>
          <span class="typing-dot"></span>
          <span class="typing-dot"></span>
        </div>
      </div>
    {/if}
  </div>

  <!-- ── Quick-prompt chips for clients ──────────────────────────────── -->
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
  .lily-chat {
    display: flex;
    flex-direction: column;
    border-radius: 16px;
    overflow: hidden;
    border: 1.5px solid rgba(2, 181, 187, 0.25);
    background: #fff;
    box-shadow: 0 4px 24px rgba(2, 181, 187, 0.08);

    &__header {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 1rem 1.25rem;
      background: linear-gradient(135deg, #02b5bb 0%, #019fa4 100%);
      color: #fff;
    }

    &__avatar {
      font-size: 1.5rem;
      width: 40px;
      height: 40px;
      background: rgba(255,255,255,0.2);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    &__name {
      font-weight: 700;
      font-size: 1rem;
    }

    &__subtitle {
      font-size: 0.78rem;
      opacity: 0.85;
      margin-top: 1px;
    }

    &__messages {
      flex: 1;
      overflow-y: auto;
      padding: 1.25rem;
      min-height: 200px;
      max-height: 400px;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    &__empty {
      text-align: center;
      color: #64748b;
      padding: 1.5rem 1rem;
      &-icon { font-size: 2rem; margin-bottom: 0.5rem; }
      p { font-size: 0.9rem; line-height: 1.5; margin: 0; }
    }

    &__row {
      display: flex;
      align-items: flex-end;
      gap: 0.5rem;
      &--user { flex-direction: row-reverse; }
    }

    &__pip {
      font-size: 1.1rem;
      flex-shrink: 0;
      width: 28px;
      text-align: center;
    }

    &__bubble {
      max-width: 72%;
      padding: 0.65rem 0.9rem;
      border-radius: 14px;
      position: relative;

      &--lily {
        background: #f0fafa;
        border: 1px solid rgba(2, 181, 187, 0.2);
        border-bottom-left-radius: 4px;
      }

      &--user {
        background: #02b5bb;
        color: #fff;
        border-bottom-right-radius: 4px;
      }

      &--typing {
        display: flex;
        align-items: center;
        gap: 4px;
        padding: 0.9rem 1.1rem;
        min-width: 60px;
      }
    }

    &__author {
      display: block;
      font-size: 0.7rem;
      font-weight: 600;
      margin-bottom: 2px;
      opacity: 0.7;
      &--staff { opacity: 1; }
    }

    &__staff-pill {
      font-size: 0.6rem;
      background: rgba(2, 181, 187, 0.15);
      color: #02b5bb;
      padding: 1px 5px;
      border-radius: 4px;
      font-weight: 700;
      letter-spacing: 0.02em;
      text-transform: uppercase;
      vertical-align: middle;
      margin-left: 3px;
    }

    &__text {
      margin: 0;
      font-size: 0.9rem;
      line-height: 1.55;
      white-space: pre-wrap;
      word-break: break-word;
    }

    &__time {
      display: block;
      font-size: 0.68rem;
      opacity: 0.5;
      margin-top: 4px;
      text-align: right;
    }

    &__chips {
      display: flex;
      flex-wrap: wrap;
      gap: 0.4rem;
      padding: 0.6rem 1rem 0.2rem;
      background: #fafffe;
      border-top: 1px solid rgba(2, 181, 187, 0.1);
    }

    &__chip {
      padding: 5px 12px;
      border: 1px solid rgba(2, 181, 187, 0.4);
      border-radius: 20px;
      background: transparent;
      color: #02b5bb;
      font-size: 0.78rem;
      font-weight: 600;
      cursor: pointer;
      font-family: inherit;
      white-space: nowrap;
      transition: background 0.15s, color 0.15s;
      &:hover:not(:disabled) { background: rgba(2, 181, 187, 0.1); }
      &:disabled { opacity: 0.4; cursor: not-allowed; }
    }

    &__form {
      display: flex;
      align-items: flex-end;
      gap: 0.5rem;
      padding: 0.75rem 1rem;
      border-top: 1px solid rgba(2, 181, 187, 0.15);
      background: #fafffe;
    }

    &__input {
      flex: 1;
      resize: none;
      border: 1.5px solid rgba(2, 181, 187, 0.3);
      border-radius: 10px;
      padding: 0.6rem 0.9rem;
      font-size: 0.9rem;
      font-family: inherit;
      line-height: 1.4;
      outline: none;
      transition: border-color 0.2s;

      &:focus { border-color: #02b5bb; }
      &::placeholder { color: #b0c4c4; }
      &:disabled { opacity: 0.6; }
    }

    &__send {
      width: 40px;
      height: 40px;
      border-radius: 10px;
      background: #02b5bb;
      color: #fff;
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.2s, opacity 0.2s;
      flex-shrink: 0;

      &:hover:not(:disabled) { background: #019fa4; }
      &:disabled { opacity: 0.5; cursor: not-allowed; }
    }

    &__spinner {
      width: 16px;
      height: 16px;
      border: 2px solid rgba(255,255,255,0.4);
      border-top-color: #fff;
      border-radius: 50%;
      animation: lily-spin 0.7s linear infinite;
    }
  }

  .typing-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #02b5bb;
    animation: lily-bounce 1.2s ease-in-out infinite;
    &:nth-child(2) { animation-delay: 0.2s; }
    &:nth-child(3) { animation-delay: 0.4s; }
  }

  @keyframes lily-bounce {
    0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
    30%           { transform: translateY(-5px); opacity: 1; }
  }

  @keyframes lily-spin {
    to { transform: rotate(360deg); }
  }
</style>
