<script lang="ts">
  import { onMount } from 'svelte';
  import {
    selectedClient, detailPanelOpen,
    STAGE_LABELS, STAGE_ICONS, STAGE_COLORS, EMAIL_TYPES,
    updateClientStage, addNote, triggerEmail, updateClientFields,
    fetchConversations
  } from '../store.ts';

  export let stageChanging: boolean;
  export let handleStageChange: (clientId: string, newStage: string) => Promise<void>;
  export let closeDetail: () => void;
  export let timeAgo: (iso: string) => string;
  export let formatDateTime: (iso: string) => string;
  export let formatDate: (iso: string) => string;
  export let getActivityIcon: (type: string) => string;
  export let getActivityText: (entry: any) => string;

  let newNote = '';
  let noteLoading = false;
  let selectedEmailType = '';
  let emailSending = false;
  let emailSentMessage = '';
  let newFieldKey = '';
  let newFieldValue = '';
  let detailTab: 'overview' | 'notes' | 'activity' | 'emails' | 'fields' | 'conversations' = 'overview';
  let stageEntries = Object.entries(STAGE_LABELS);

  let conversations: any[] = [];
  let conversationsLoading = false;
  let currentSessionId = '';

  $: {
    if ($selectedClient) {
      if (currentSessionId && currentSessionId !== $selectedClient.id) {
        conversations = [];
        currentSessionId = '';
      }

      if (detailTab === 'conversations' && currentSessionId !== $selectedClient.id && !conversationsLoading) {
        loadConversations($selectedClient.id, $selectedClient.email);
      }
    }
  }

  async function loadConversations(targetId: string, targetEmail?: string) {
    conversationsLoading = true;
    currentSessionId = targetId; 
    
    console.log(`[DEBUG UI] Attempting to load conversations for ${targetEmail || targetId}`);
    try {
      const result = await fetchConversations(targetId, targetEmail);
      console.log(`[DEBUG UI] Fetched successfully:`, result);
      conversations = [...result]; 
    } catch (err: any) {
      console.error('[DEBUG UI] Failed to load conversations:', err);
      conversations = [];
      if (err.message && (err.message.includes('Session expired') || err.message.includes('Authentication'))) {
        closeDetail();
      }
    } finally {
      conversationsLoading = false;
    }
  }

  function forceManualLoad() {
    if ($selectedClient) {
      conversations = []; // Clear current DOM fully
      loadConversations($selectedClient.id, $selectedClient.email);
    }
  }

  async function handleAddNote() {
    if (!newNote.trim() || !$selectedClient) return;
    noteLoading = true;
    try {
      await addNote($selectedClient.id, newNote.trim());
      newNote = '';
    } catch (err: any) {
      alert('Failed to add note: ' + err.message);
    } finally {
      noteLoading = false;
    }
  }

  async function handleTriggerEmail() {
    if (!selectedEmailType || !$selectedClient) return;
    emailSending = true;
    emailSentMessage = '';
    try {
      await triggerEmail($selectedClient.id, selectedEmailType);
      emailSentMessage = `✓ ${EMAIL_TYPES.find(e => e.value === selectedEmailType)?.label} sent!`;
      selectedEmailType = '';
    } catch (err: any) {
      emailSentMessage = `✗ Failed: ${err.message}`;
    } finally {
      emailSending = false;
    }
  }

  async function handleAddCustomField() {
    if (!newFieldKey.trim() || !newFieldValue.trim() || !$selectedClient) return;
    try {
      await updateClientFields($selectedClient.id, { [newFieldKey.trim()]: newFieldValue.trim() });
      newFieldKey = '';
      newFieldValue = '';
    } catch (err: any) {
      alert('Failed: ' + err.message);
    }
  }
</script>

{#if $detailPanelOpen && $selectedClient}
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div class="detail-overlay" on:click={closeDetail} role="presentation"></div>
  <aside class="detail-panel">
    <div class="detail-panel__header">
      <button class="detail-panel__close" on:click={closeDetail}>✕</button>
      <h2>{$selectedClient.name} {$selectedClient.surname}</h2>
      <span class="detail-panel__email">{$selectedClient.email}</span>
      {#if $selectedClient.phone}
        <span class="detail-panel__phone">{$selectedClient.phone}</span>
      {/if}
    </div>

    <!-- Stage Selector -->
    <div class="detail-stage">
      <label>Pipeline Stage</label>
      <div class="detail-stage__pipeline">
        {#each stageEntries as [stageKey, stageLabel]}
          <button
            class="detail-stage__dot"
            class:active={$selectedClient.stage === stageKey}
            style="background: {$selectedClient.stage === stageKey ? STAGE_COLORS[stageKey] : 'transparent'}; border-color: {STAGE_COLORS[stageKey]}"
            title={stageLabel}
            disabled={stageChanging}
            on:click={() => handleStageChange($selectedClient?.id || '', stageKey)}
          >
            <span class="detail-stage__dot-icon">{STAGE_ICONS[stageKey]}</span>
          </button>
        {/each}
      </div>
      <span class="detail-stage__current" style="color: {STAGE_COLORS[$selectedClient.stage]}">
        {STAGE_LABELS[$selectedClient.stage]}
      </span>
    </div>

    <!-- Tabs -->
    <nav class="detail-tabs">
      <button class:active={detailTab === 'overview'} on:click={() => detailTab = 'overview'}>Overview</button>
      <button class:active={detailTab === 'conversations'} on:click={() => detailTab = 'conversations'}>Conversations</button>
      <button class:active={detailTab === 'notes'} on:click={() => detailTab = 'notes'}>Notes ({($selectedClient.agentNotes?.length || 0) + ($selectedClient.chatbotNotes?.length || 0)})</button>
      <button class:active={detailTab === 'activity'} on:click={() => detailTab = 'activity'}>Activity</button>
      <button class:active={detailTab === 'emails'} on:click={() => detailTab = 'emails'}>Emails</button>
      <button class:active={detailTab === 'fields'} on:click={() => detailTab = 'fields'}>Fields</button>
    </nav>

    <div class="detail-content">
      <!-- ── Overview Tab ─────────────────────────── -->
      {#if detailTab === 'overview'}
        <div class="detail-fields">
          <div class="detail-field">
            <span class="detail-field__label">Route</span>
            <span class="detail-field__value">
              {$selectedClient.originCity}, {$selectedClient.originCountry} → {$selectedClient.destinationCity}, {$selectedClient.destinationCountry}
            </span>
          </div>
          <div class="detail-field">
            <span class="detail-field__label">Budget</span>
            <span class="detail-field__value">{$selectedClient.budget || '—'}</span>
          </div>
          <div class="detail-field">
            <span class="detail-field__label">Move Size</span>
            <span class="detail-field__value">{$selectedClient.size || '—'}</span>
          </div>
          <div class="detail-field">
            <span class="detail-field__label">Immigration Status</span>
            <span class="detail-field__value">{$selectedClient.immigrationStatus || '—'}</span>
          </div>
          <div class="detail-field">
            <span class="detail-field__label">Property</span>
            <span class="detail-field__value">{$selectedClient.propertyTypeFrom || '—'} → {$selectedClient.propertyTypeTo || '—'}</span>
          </div>
          {#if $selectedClient.vehicles?.length}
            <div class="detail-field">
              <span class="detail-field__label">Vehicles</span>
              <div class="detail-field__value">
                {#each $selectedClient.vehicles as v}
                  <span class="detail-field__tag">{v.year} {v.make} {v.model}</span>
                {/each}
              </div>
            </div>
          {/if}
          {#if $selectedClient.scheduling?.length}
            <div class="detail-field">
              <span class="detail-field__label">Scheduled Call</span>
              <span class="detail-field__value">{formatDateTime($selectedClient.scheduling[0])}</span>
            </div>
          {/if}
          {#if $selectedClient.callOutcome}
            <div class="detail-field">
              <span class="detail-field__label">Call Outcome</span>
              <span class="detail-field__value">{$selectedClient.callOutcome}</span>
            </div>
          {/if}
          {#if $selectedClient.transcript}
            <div class="detail-field detail-field--full">
              <span class="detail-field__label">Call Transcript</span>
              <div class="detail-field__transcript">{$selectedClient.transcript}</div>
            </div>
          {/if}
          <div class="detail-field">
            <span class="detail-field__label">Consultations</span>
            <span class="detail-field__value">{$selectedClient.consultationCount}</span>
          </div>
          <div class="detail-field">
            <span class="detail-field__label">Created</span>
            <span class="detail-field__value">{formatDate($selectedClient.createdAt)}</span>
          </div>
          <div class="detail-field">
            <span class="detail-field__label">Drip Active</span>
            <span class="detail-field__value">{$selectedClient.dripEnabled ? '✅ Yes' : '❌ No'}</span>
          </div>
        </div>

      <!-- ── Conversations Tab ─────────────────────────── -->
      {:else if detailTab === 'conversations'}
        <div class="detail-conversations">
          <div style="margin-bottom: 16px; padding: 12px; background: #eef2ff; border: 1px solid #c7d2fe; border-radius: 8px; display: flex; align-items: center; justify-content: space-between;">
            <div>
              <p style="margin: 0 0 4px 0; font-weight: bold; color: #3730a3; font-size: 13px;">Debug Logs Active (F12)</p>
              <p style="margin: 0; font-size: 12px; color: #4f46e5;">Array Length: {conversations.length}</p>
            </div>
            <button on:click={forceManualLoad} disabled={conversationsLoading} style="padding: 6px 12px; background: #4f46e5; color: white; border: none; border-radius: 4px; font-size: 12px; cursor: pointer; font-weight: 600;">
              {conversationsLoading ? 'Fetching...' : 'Force Manual Fetch'}
            </button>
          </div>

          {#if conversationsLoading}
            <div class="dashboard__loading">
              <div class="spinner" style="width: 24px; height: 24px; border-width: 2px;"></div>
              <p style="margin-top: 8px;">Loading conversations...</p>
            </div>
          {:else if conversations.length === 0}
            <p class="detail-empty">No conversations found.</p>
          {:else}
            {#each conversations as thread, i}
              <div class="detail-thread">
                <h3 class="detail-thread__title">
                  Session {thread.sessionId} 
                  <span class="detail-thread__date">({formatDateTime(thread.updatedAt || thread.createdAt)})</span>
                </h3>
                <div class="chat-history">
                  {#each thread.messages || [] as msg}
                    {#if msg.role !== 'system'}
                      <div class="chat-msg chat-msg--{msg.role}">
                        <span class="chat-msg__role">{msg.role === 'assistant' ? '🤖 Lili' : '👤 Client'}:</span>
                        <span class="chat-msg__content">{msg.content}</span>
                      </div>
                    {/if}
                  {/each}
                </div>
              </div>
            {/each}
          {/if}
        </div>

      <!-- ── Notes Tab ────────────────────────────── -->
      {:else if detailTab === 'notes'}
        <div class="detail-notes">
          <form class="detail-notes__form" on:submit|preventDefault={handleAddNote}>
            <textarea
              bind:value={newNote}
              placeholder="Add a note…"
              class="detail-notes__input"
              rows="3"
            ></textarea>
            <button type="submit" class="detail-notes__btn" disabled={noteLoading || !newNote.trim()}>
              {noteLoading ? 'Adding…' : 'Add Note'}
            </button>
          </form>
          <div class="detail-notes__list">
            
            {#if $selectedClient.chatbotNotes && $selectedClient.chatbotNotes.length > 0}
              <div class="detail-note detail-note--ai">
                <div class="detail-note__meta">
                  <span class="detail-note__author">🤖 AI Assistant</span>
                  <span class="detail-note__time">Chatbot</span>
                </div>
                <ul class="detail-note__ai-list">
                  {#each $selectedClient.chatbotNotes as aiNote}
                    <li>{aiNote}</li>
                  {/each}
                </ul>
              </div>
            {/if}

            {#each ($selectedClient.agentNotes || []).slice().reverse() as note}
              <div class="detail-note">
                <div class="detail-note__meta">
                  <span class="detail-note__author">👤 {note.author?.split('@')[0]}</span>
                  <span class="detail-note__time">{timeAgo(note.createdAt)}</span>
                </div>
                <div class="detail-note__text">{note.text}</div>
              </div>
            {/each}
            
            {#if !($selectedClient.agentNotes?.length) && !($selectedClient.chatbotNotes?.length)}
              <p class="detail-empty">No notes yet.</p>
            {/if}
          </div>
        </div>

      <!-- ── Activity Tab ─────────────────────────── -->
      {:else if detailTab === 'activity'}
        <div class="detail-activity">
          {#each ($selectedClient.activityLog || []).slice().reverse() as entry}
            <div class="activity-entry">
              <span class="activity-entry__icon">{getActivityIcon(entry.type)}</span>
              <div class="activity-entry__content">
                <span class="activity-entry__text">{getActivityText(entry)}</span>
                <span class="activity-entry__meta">{entry.actor?.split('@')[0]} · {timeAgo(entry.timestamp)}</span>
              </div>
            </div>
          {/each}
          {#if !$selectedClient.activityLog?.length}
            <p class="detail-empty">No activity recorded yet.</p>
          {/if}
        </div>

      <!-- ── Emails Tab ───────────────────────────── -->
      {:else if detailTab === 'emails'}
        <div class="detail-emails">
          <p class="detail-emails__desc">Send an email to this client from a template:</p>
          <div class="detail-emails__form">
            <select bind:value={selectedEmailType} class="detail-emails__select">
              <option value="">Choose email type…</option>
              {#each EMAIL_TYPES as et}
                <option value={et.value}>{et.label}</option>
              {/each}
            </select>
            <button
              class="detail-emails__btn"
              disabled={emailSending || !selectedEmailType}
              on:click={handleTriggerEmail}
            >
              {emailSending ? 'Sending…' : 'Send Email'}
            </button>
          </div>
          {#if emailSentMessage}
            <div class="detail-emails__message" class:success={emailSentMessage.startsWith('✓')} class:fail={emailSentMessage.startsWith('✗')}>
              {emailSentMessage}
            </div>
          {/if}
        </div>

      <!-- ── Custom Fields Tab ────────────────────── -->
      {:else if detailTab === 'fields'}
        <div class="detail-custom-fields">
          <div class="detail-custom-fields__list">
            {#each Object.entries($selectedClient.customFields || {}) as [key, value]}
              <div class="detail-custom-field">
                <span class="detail-custom-field__key">{key}</span>
                <span class="detail-custom-field__value">{value}</span>
              </div>
            {/each}
            {#if !Object.keys($selectedClient.customFields || {}).length}
              <p class="detail-empty">No custom fields yet.</p>
            {/if}
          </div>
          <form class="detail-custom-fields__form" on:submit|preventDefault={handleAddCustomField}>
            <input type="text" bind:value={newFieldKey} placeholder="Field name" class="detail-cf-input" />
            <input type="text" bind:value={newFieldValue} placeholder="Value" class="detail-cf-input" />
            <button type="submit" disabled={!newFieldKey.trim() || !newFieldValue.trim()}>Add</button>
          </form>
        </div>
      {/if}
    </div>
  </aside>
{/if}