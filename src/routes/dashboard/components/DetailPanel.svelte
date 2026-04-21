<script lang="ts">
  import { onMount } from 'svelte';
  import {
    selectedClient, detailPanelOpen,
    STAGE_LABELS, STAGE_ICONS, STAGE_COLORS, EMAIL_TYPES,
    updateClientStage, addNote, triggerEmail, updateClientFields,
    fetchConversations, fetchClientActions, executeClientAction
  } from '../store.ts';
  import type { ClientActionsPayload, ActionArgSchema } from '../store.ts';
  import { toasts } from '../toastStore.ts';

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
  let detailTab: 'overview' | 'notes' | 'activity' | 'emails' | 'fields' | 'conversations' | 'actions' = 'overview';
  let stageEntries = Object.entries(STAGE_LABELS);

  let conversations: any[] = [];
  let conversationsLoading = false;
  let currentSessionId = '';

  // ── Actions State ──────────────────────────────────────────────────────────
  let actionsLoading = false;
  let actionsStage = '';
  let actionsPayload: ClientActionsPayload = {};
  let expandedAction: string | null = null;
  let actionFormValues: Record<string, Record<string, any>> = {};
  let actionExecuting: Record<string, boolean> = {};
  let actionsLoadedForId = '';

  // ── Activity Log State ─────────────────────────────────────────────────────
  let activitySearch = '';
  let activityPage = 0;
  const ACTIVITY_PAGE_SIZE = 10;

  $: filteredActivity = (() => {
    const log = ($selectedClient?.activityLog || []).slice().reverse();
    if (!activitySearch.trim()) return log;
    const q = activitySearch.toLowerCase();
    return log.filter((entry: any) => {
      const text = `${entry.type} ${entry.actor || ''} ${entry.actionKey || ''} ${entry.from || ''} ${entry.to || ''} ${entry.emailType || ''}`.toLowerCase();
      return text.includes(q);
    });
  })();

  $: totalActivityPages = Math.max(1, Math.ceil(filteredActivity.length / ACTIVITY_PAGE_SIZE));
  $: pagedActivity = filteredActivity.slice(activityPage * ACTIVITY_PAGE_SIZE, (activityPage + 1) * ACTIVITY_PAGE_SIZE);

  // Reset page when search changes
  $: activitySearch, activityPage = 0;

  $: {
    if ($selectedClient) {
      if (currentSessionId && currentSessionId !== $selectedClient.id) {
        conversations = [];
        currentSessionId = '';
      }

      if (detailTab === 'conversations' && currentSessionId !== $selectedClient.id && !conversationsLoading) {
        loadConversations($selectedClient.id, $selectedClient.email);
      }

      if (detailTab === 'actions' && actionsLoadedForId !== $selectedClient.id && !actionsLoading) {
        loadActions($selectedClient.id);
      }
    }
  }

  async function loadConversations(targetId: string, targetEmail?: string) {
    conversationsLoading = true;
    currentSessionId = targetId; 
    try {
      const result = await fetchConversations(targetId, targetEmail);
      conversations = [...result]; 
    } catch (err: any) {
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
      conversations = [];
      loadConversations($selectedClient.id, $selectedClient.email);
    }
  }

  // ── Actions Logic ──────────────────────────────────────────────────────────
  async function loadActions(clientId: string) {
    actionsLoading = true;
    actionsLoadedForId = clientId;
    try {
      const { stage, actions } = await fetchClientActions(clientId);
      actionsStage = stage;
      actionsPayload = actions || {};
      
      // Initialize form values from defaults
      actionFormValues = {};
      for (const [actionKey, schema] of Object.entries(actionsPayload)) {
        actionFormValues[actionKey] = {};
        for (const [argKey, argSchema] of Object.entries(schema.args || {})) {
          actionFormValues[actionKey][argKey] = argSchema.defaultValue ?? '';
        }
      }
    } catch (err: any) {
      actionsPayload = {};
      toasts.error('Failed to load actions: ' + err.message);
    } finally {
      actionsLoading = false;
    }
  }

  function toggleAction(actionKey: string) {
    expandedAction = expandedAction === actionKey ? null : actionKey;
  }

  async function executeAction(actionKey: string) {
    if (!$selectedClient) return;
    actionExecuting = { ...actionExecuting, [actionKey]: true };

    try {
      const args = actionFormValues[actionKey] || {};
      const data = await executeClientAction($selectedClient.id, actionKey, args);
      
      toasts.success(data.result?.message || `Action "${actionKey}" executed successfully!`);
      expandedAction = null;

      // Refresh client to get updated activityLog
      // We add the new activity entry locally for instant feedback
      if ($selectedClient) {
        const newEntry = {
          type: 'action_executed',
          actionKey,
          actor: 'you',
          timestamp: new Date().toISOString(),
          success: true,
        };
        $selectedClient = {
          ...$selectedClient,
          activityLog: [...($selectedClient.activityLog || []), newEntry],
        };
      }
    } catch (err: any) {
      toasts.error(`Action failed: ${err.message}`);
    } finally {
      actionExecuting = { ...actionExecuting, [actionKey]: false };
    }
  }

  function formatActionKey(key: string): string {
    return key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
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
      <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-top: 4px;">
        <span class="detail-panel__email">{$selectedClient.email}</span>
        {#if $selectedClient.phone}
          <span class="detail-panel__phone">· {$selectedClient.phone}</span>
        {/if}
        {#if $selectedClient.sessionId}
          <span style="font-size: 11px; color: #94a3b8; font-family: monospace; display: flex; align-items: center;">· ID: {$selectedClient.sessionId.split('-')[0]}</span>
        {/if}
      </div>
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
      <button class:active={detailTab === 'actions'} on:click={() => detailTab = 'actions'}>⚡ Actions</button>
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

      <!-- ── Actions Tab ──────────────────────────── -->
      {:else if detailTab === 'actions'}
        <div class="actions-tab">
          {#if actionsLoading}
            <div class="actions-tab__loading">
              <div class="actions-tab__skeleton"></div>
              <div class="actions-tab__skeleton actions-tab__skeleton--short"></div>
              <div class="actions-tab__skeleton"></div>
            </div>
          {:else if Object.keys(actionsPayload).length === 0}
            <div class="actions-tab__empty">
              <span class="actions-tab__empty-icon">⚡</span>
              <p class="actions-tab__empty-title">No actions configured</p>
              <p class="actions-tab__empty-desc">
                No custom actions available for the <strong>{STAGE_LABELS[$selectedClient.stage] || $selectedClient.stage}</strong> stage.
              </p>
            </div>
          {:else}
            <div class="actions-tab__header">
              <span class="actions-tab__stage-badge" style="background: {STAGE_COLORS[$selectedClient.stage] || '#64748b'}">
                {STAGE_ICONS[$selectedClient.stage] || '⚡'} {STAGE_LABELS[$selectedClient.stage] || $selectedClient.stage}
              </span>
              <span class="actions-tab__count">{Object.keys(actionsPayload).length} action{Object.keys(actionsPayload).length !== 1 ? 's' : ''}</span>
            </div>

            <div class="actions-tab__list">
              {#each Object.entries(actionsPayload) as [actionKey, schema]}
                <div class="actions-card" class:actions-card--expanded={expandedAction === actionKey}>
                  <!-- svelte-ignore a11y-click-events-have-key-events -->
                  <!-- svelte-ignore a11y-no-static-element-interactions -->
                  <div class="actions-card__header" on:click={() => toggleAction(actionKey)}>
                    <div class="actions-card__info">
                      <span class="actions-card__name">{formatActionKey(actionKey)}</span>
                      <span class="actions-card__desc">{schema.description}</span>
                    </div>
                    <span class="actions-card__chevron" class:actions-card__chevron--open={expandedAction === actionKey}>▾</span>
                  </div>

                  {#if expandedAction === actionKey}
                    <div class="actions-card__body">
                      {#if Object.keys(schema.args || {}).length > 0}
                        <div class="actions-card__fields">
                          {#each Object.entries(schema.args) as [argKey, argSchema]}
                            <div class="actions-card__field">
                              <label class="actions-card__field-label">
                                {argSchema.label}
                                {#if argSchema.required}<span class="actions-card__required">*</span>{/if}
                              </label>

                              {#if argSchema.type === 'boolean'}
                                <label class="actions-card__toggle">
                                  <input
                                    type="checkbox"
                                    bind:checked={actionFormValues[actionKey][argKey]}
                                  />
                                  <span class="actions-card__toggle-track">
                                    <span class="actions-card__toggle-thumb"></span>
                                  </span>
                                  <span class="actions-card__toggle-label">
                                    {actionFormValues[actionKey][argKey] ? 'Yes' : 'No'}
                                  </span>
                                </label>
                              {:else if argSchema.type === 'enum' && argSchema.options}
                                <select
                                  class="actions-card__select"
                                  bind:value={actionFormValues[actionKey][argKey]}
                                >
                                  <option value="">Select…</option>
                                  {#each argSchema.options as opt}
                                    <option value={opt}>{opt}</option>
                                  {/each}
                                </select>
                              {:else if argSchema.type === 'number'}
                                <input
                                  type="number"
                                  class="actions-card__input"
                                  placeholder={argSchema.placeholder || ''}
                                  bind:value={actionFormValues[actionKey][argKey]}
                                />
                              {:else if argSchema.type === 'date'}
                                <input
                                  type="date"
                                  class="actions-card__input"
                                  bind:value={actionFormValues[actionKey][argKey]}
                                />
                              {:else}
                                <input
                                  type="text"
                                  class="actions-card__input"
                                  placeholder={argSchema.placeholder || ''}
                                  bind:value={actionFormValues[actionKey][argKey]}
                                />
                              {/if}
                            </div>
                          {/each}
                        </div>
                      {:else}
                        <p class="actions-card__no-args">This action requires no additional input.</p>
                      {/if}

                      <button
                        class="actions-card__execute"
                        disabled={actionExecuting[actionKey]}
                        on:click={() => executeAction(actionKey)}
                      >
                        {#if actionExecuting[actionKey]}
                          <span class="actions-card__spinner"></span>
                          Executing…
                        {:else}
                          ⚡ Execute Action
                        {/if}
                      </button>
                    </div>
                  {/if}
                </div>
              {/each}
            </div>
          {/if}
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
                <div class="detail-thread__header">
                  <div class="detail-thread__info">
                    <h3 class="detail-thread__title">Session</h3>
                    <span class="detail-thread__id">{thread.sessionId}</span>
                  </div>
                  <span class="detail-thread__date">{formatDateTime(thread.updatedAt || thread.createdAt)}</span>
                </div>
                <div class="chat-history modern-chat">
                  {#each thread.messages || [] as msg}
                    {#if msg.role !== 'system'}
                      <div class="chat-bubble-wrapper {msg.role === 'assistant' ? 'chat-bubble-wrapper--left' : 'chat-bubble-wrapper--right'}">
                        <div class="chat-bubble__avatar">
                          {msg.role === 'assistant' ? '🤖' : '👤'}
                        </div>
                        <div class="chat-bubble {msg.role === 'assistant' ? 'chat-bubble--assistant' : 'chat-bubble--user'}">
                          <span class="chat-bubble__role">{msg.role === 'assistant' ? 'Lili' : 'Client'}</span>
                          <p class="chat-bubble__text">{msg.content}</p>
                        </div>
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
          <!-- Search & Pagination Controls -->
          <div class="activity-controls">
            <input
              type="text"
              class="activity-controls__search"
              placeholder="Search activity…"
              bind:value={activitySearch}
            />
            <span class="activity-controls__count">
              {filteredActivity.length} entr{filteredActivity.length === 1 ? 'y' : 'ies'}
            </span>
          </div>

          {#each pagedActivity as entry}
            <div class="activity-entry" class:activity-entry--action={entry.type === 'action_executed'}>
              <span class="activity-entry__icon">
                {#if entry.type === 'action_executed'}⚡{:else}{getActivityIcon(entry.type)}{/if}
              </span>
              <div class="activity-entry__content">
                <span class="activity-entry__text">
                  {#if entry.type === 'action_executed'}
                    Action <strong>{entry.actionKey || 'unknown'}</strong> executed
                    {#if entry.success === false}<span class="activity-entry__fail"> (failed)</span>{/if}
                  {:else}
                    {getActivityText(entry)}
                  {/if}
                </span>
                <div class="activity-entry__meta-row">
                  {#if entry.actor}
                    <span class="activity-entry__blame">
                      <span class="activity-entry__avatar">{(entry.actor?.split('@')[0] || '?')[0].toUpperCase()}</span>
                      {entry.actor?.split('@')[0]}
                    </span>
                  {/if}
                  <span class="activity-entry__time">· {timeAgo(entry.timestamp)}</span>
                </div>
              </div>
            </div>
          {/each}

          {#if filteredActivity.length === 0}
            <p class="detail-empty">
              {activitySearch ? 'No matching activity found.' : 'No activity recorded yet.'}
            </p>
          {/if}

          <!-- Pagination -->
          {#if totalActivityPages > 1}
            <div class="activity-pagination">
              <button
                class="activity-pagination__btn"
                disabled={activityPage === 0}
                on:click={() => activityPage = Math.max(0, activityPage - 1)}
              >← Prev</button>
              <span class="activity-pagination__info">
                {activityPage + 1} / {totalActivityPages}
              </span>
              <button
                class="activity-pagination__btn"
                disabled={activityPage >= totalActivityPages - 1}
                on:click={() => activityPage = Math.min(totalActivityPages - 1, activityPage + 1)}
              >Next →</button>
            </div>
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
