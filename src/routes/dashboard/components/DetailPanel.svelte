<script lang="ts">
  import { onMount } from 'svelte';
  import {
    selectedClient, detailPanelOpen,
    STAGE_LABELS, STAGE_ICONS, STAGE_COLORS, EMAIL_TYPES,
    SHIPPING_MODE_LABEL, PACKING_TIER_LABEL,
    selectedSentEmailId,
    presendEmail,
    authEmail,
    updateClientStage, addNote, triggerEmail, updateClientFields,
    fetchConversations, fetchClientActions, fetchClientActionsForStage,
    executeClientAction,
    fetchEmailPreview,
    extractInsights,
    triggerConversationRefetch,
  } from '../store.ts';
  import type { ClientActionsPayload, ActionArgSchema } from '../store.ts';
  import { toasts } from '../toastStore.ts';
  import CardFieldsAccordion from './CardFieldsAccordion.svelte';
  import CardHistory from './CardHistory.svelte';
  import EditableField from './EditableField.svelte';
  import TranscriptPaster from './TranscriptPaster.svelte';
  import { exactTime, relativeTime } from '../utils/relativeTime.ts';

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
  let detailTab: 'overview' | 'insights' | 'journey' | 'notes' | 'activity' | 'emails' | 'conversations' | 'actions' = 'overview';
  let stageEntries = Object.entries(STAGE_LABELS);

  // ── Pipeline-stage chip + popover (replaces the giant emoji strip) ─────
  let stagePopoverOpen = false;
  function toggleStagePopover() { stagePopoverOpen = !stagePopoverOpen; }
  async function chooseStage(stageKey: string) {
    if (!$selectedClient) return;
    stagePopoverOpen = false;
    await handleStageChange($selectedClient.id, stageKey);
  }

  // ── Insights tab state ─────────────────────────────────────────────────
  let insightsExtracting = false;
  let manualTranscriptText = '';
  let showAdvancedFields = false;

  /**
   * Index of the **latest** consultations[] entry. The Overview fields edit
   * the latest consultation in place, so we need its array index for the
   * dotted path strings sent to PATCH /clients/:id/field.
   *
   * `consultationCount` is the array length; latest index = length - 1.
   */
  $: latestIdx = Math.max(0, ($selectedClient?.consultationCount ?? 1) - 1);

  /**
   * "Has some kind of transcript text" — used for the Insights empty-state
   * messaging. We're more honest than the previous "no transcript yet" copy:
   * we show a different sub-heading depending on whether the client is in
   * post-call territory (we expect a transcript) or pre-call (we don't).
   */
  $: hasSomeTranscript = !!(
    $selectedClient?.transcript ||
    $selectedClient?.meetingNotes?.text
  );
  $: isPostCallStage = !!(
    $selectedClient?.stage &&
    String($selectedClient.stage).startsWith('sales_post_')
  );
  async function reExtractInsights(force = true) {
    if (!$selectedClient) return;
    insightsExtracting = true;
    try {
      const insights = await extractInsights($selectedClient.id, {
        force,
        manualText: manualTranscriptText.trim() ? manualTranscriptText.trim() : undefined,
      });
      if (insights) {
        toasts.success(
          `Extracted: ${insights.shippingMode ?? '—'} / ${insights.packingTier ?? '—'}`,
        );
      } else {
        toasts.error('Extraction returned no result.');
      }
      manualTranscriptText = '';
    } catch (err: any) {
      toasts.error(`Extraction failed: ${err?.message ?? err}`);
    } finally {
      insightsExtracting = false;
    }
  }

  let conversations: any[] = [];
  let conversationsLoading = false;
  let currentSessionId = '';

  $: if ($triggerConversationRefetch > 0 && detailTab === 'conversations' && $selectedClient) {
    loadConversations($selectedClient.id, $selectedClient.email, true);
  }

  // ── Actions State ──────────────────────────────────────────────────────────
  let actionsLoading = false;
  let actionsStage = '';
  /** The client's real pipeline stage — used for the "current stage" badge. */
  let actionsClientStage = '';
  /** The stage currently shown in the cross-stage selector (defaults to client's stage). */
  let selectedActionsStage = '';
  let actionsPayload: ClientActionsPayload = {};
  let expandedAction: string | null = null;
  let actionFormValues: Record<string, Record<string, any>> = {};
  let actionExecuting: Record<string, boolean> = {};
  let actionsLoadedForId = '';

  // ── Email pre-send state ───────────────────────────────────────────────────
  /** True while fetching the email preview from the backend. */
  let emailPreviewing = false;

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

  async function loadConversations(targetId: string, targetEmail?: string, isBackgroundRefresh = false) {
    if (!isBackgroundRefresh) conversationsLoading = true;
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
      const { stage, clientStage, actions } = await fetchClientActions(clientId);
      actionsStage = stage;
      actionsClientStage = clientStage || stage;
      // Default the selector to the client's current stage on first load
      if (!selectedActionsStage) selectedActionsStage = actionsClientStage;
      actionsPayload = actions || {};
      initActionFormValues();
    } catch (err: any) {
      actionsPayload = {};
      toasts.error('Failed to load actions: ' + err.message);
    } finally {
      actionsLoading = false;
    }
  }

  /**
   * Load actions for a specific stage (cross-stage selector).
   * Called when the operator changes the stage dropdown in the Actions tab.
   */
  async function loadActionsForSelectedStage(stage: string) {
    if (!$selectedClient) return;
    actionsLoading = true;
    expandedAction = null;
    try {
      const { actions } = await fetchClientActionsForStage($selectedClient.id, stage);
      actionsStage = stage;
      actionsPayload = actions || {};
      initActionFormValues();
    } catch (err: any) {
      actionsPayload = {};
      toasts.error('Failed to load actions: ' + err.message);
    } finally {
      actionsLoading = false;
    }
  }

  function initActionFormValues() {
    actionFormValues = {};
    for (const [actionKey, schema] of Object.entries(actionsPayload)) {
      actionFormValues[actionKey] = {};
      for (const [argKey, argSchema] of Object.entries(schema.args || {})) {
        actionFormValues[actionKey][argKey] = argSchema.defaultValue ?? '';
      }
    }
  }

  /** Handle cross-stage selector change. */
  async function handleActionsStageChange(e: Event) {
    const newStage = (e.target as HTMLSelectElement).value;
    selectedActionsStage = newStage;
    await loadActionsForSelectedStage(newStage);
  }

  /**
   * Email pre-send preview — Step 1 of the 2-step send flow.
   * Fetches a rendered preview of the email from the backend and opens
   * the EmailPreviewDrawer in pre-send mode instead of firing immediately.
   */
  async function handlePreviewEmail() {
    if (!selectedEmailType || !$selectedClient) return;
    emailPreviewing = true;
    emailSentMessage = '';
    try {
      const preview = await fetchEmailPreview($selectedClient.id, selectedEmailType);
      presendEmail.set({
        clientId: $selectedClient.id,
        emailType: selectedEmailType,
        clientEmail: preview.clientEmail,
        subject: preview.subject,
        bodyHtml: preview.bodyHtml,
        context: preview.context,
      });
      // Don't reset selectedEmailType here — let the user decide in the drawer
    } catch (err: any) {
      toasts.error(`Couldn't load preview: ${err?.message ?? err}`);
    } finally {
      emailPreviewing = false;
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
      <h2
        class:detail-panel__title--missing-name={!$selectedClient.nameKnown}
        title={!$selectedClient.nameKnown ? 'First name not provided — only surname/email known' : `${$selectedClient.name} ${$selectedClient.surname}`.trim()}
      >
        {#if !$selectedClient.nameKnown}<span class="detail-panel__name-badge" aria-label="First name unknown">?</span>{/if}{$selectedClient.displayName || $selectedClient.email}
      </h2>

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

    <!-- Stage Chip + Popover (replaces the giant emoji-strip selector). -->
    <!-- Click the chip to open a popover with the full stage grid. -->
    <div class="detail-stage detail-stage--collapsed">
      <button
        type="button"
        class="detail-panel__stage-chip"
        style="background: {STAGE_COLORS[$selectedClient.stage]}20; border-color: {STAGE_COLORS[$selectedClient.stage]}; color: {STAGE_COLORS[$selectedClient.stage]}"
        on:click={toggleStagePopover}
        disabled={stageChanging}
        title="Click to change pipeline stage"
      >
        <span>{STAGE_ICONS[$selectedClient.stage]}</span>
        <span>{STAGE_LABELS[$selectedClient.stage]}</span>
        <span class="detail-panel__stage-chip-caret">▾</span>
      </button>

      {#if stagePopoverOpen}
        <div class="detail-panel__stage-popover" role="presentation" on:click|stopPropagation>
          <div class="detail-panel__stage-popover-grid">
            {#each stageEntries as [stageKey, stageLabel]}
              <button
                class="detail-panel__stage-popover-dot"
                class:active={$selectedClient.stage === stageKey}
                style="background: {$selectedClient.stage === stageKey ? STAGE_COLORS[stageKey] : 'transparent'}; border-color: {STAGE_COLORS[stageKey]}"
                title={stageLabel}
                disabled={stageChanging}
                on:click={() => chooseStage(stageKey)}
              >
                <span>{STAGE_ICONS[stageKey]}</span>
              </button>
            {/each}
          </div>
        </div>
      {/if}
    </div>

    <!-- Tabs -->
    <nav class="detail-tabs">
      <button class:active={detailTab === 'overview'} on:click={() => detailTab = 'overview'}>Overview</button>
      <button class:active={detailTab === 'journey'} on:click={() => detailTab = 'journey'}>🛣 Journey</button>
      <button class:active={detailTab === 'insights'} on:click={() => detailTab = 'insights'}>📝 Insights</button>
      <button class:active={detailTab === 'actions'} on:click={() => detailTab = 'actions'}>⚡ Actions</button>
      <button class:active={detailTab === 'conversations'} on:click={() => detailTab = 'conversations'}>Conversations</button>
      <button class:active={detailTab === 'notes'} on:click={() => detailTab = 'notes'}>Notes ({($selectedClient.agentNotes?.length || 0) + ($selectedClient.chatbotNotes?.length || 0)})</button>
      <button class:active={detailTab === 'activity'} on:click={() => detailTab = 'activity'}>Activity</button>
      <button class:active={detailTab === 'emails'} on:click={() => detailTab = 'emails'}>Emails</button>
    </nav>

    <div class="detail-content">
      <!-- ── Overview Tab — every field inline-editable ──────────────── -->
      <!--
        Each row is a click-to-edit `<EditableField>` whose `path` targets the
        latest `consultations[N]` entry on the Firestore doc. The PATCH endpoint
        coerces the type and writes the activity log so any change is undoable
        from the Activity tab.
      -->
      {#if detailTab === 'overview'}
        <div class="detail-overview detail-fields">
          <!-- Route is two values; render them as a pair of editable chips. -->
          <div class="detail-field detail-field--full">
            <span class="detail-field__label">Route</span>
            <div class="detail-field__route">
              <EditableField
                clientId={$selectedClient.id}
                path={`consultations.${latestIdx}.originCity`}
                value={$selectedClient.originCity}
                label="Origin city"
                placeholder="—"
              />
              <span class="detail-field__route-sep">,</span>
              <EditableField
                clientId={$selectedClient.id}
                path={`consultations.${latestIdx}.originCountry`}
                value={$selectedClient.originCountry}
                label="Origin country"
                placeholder="—"
              />
              <span class="detail-field__route-arrow">→</span>
              <EditableField
                clientId={$selectedClient.id}
                path={`consultations.${latestIdx}.destinationCity`}
                value={$selectedClient.destinationCity}
                label="Destination city"
                placeholder="—"
              />
              <span class="detail-field__route-sep">,</span>
              <EditableField
                clientId={$selectedClient.id}
                path={`consultations.${latestIdx}.destinationCountry`}
                value={$selectedClient.destinationCountry}
                label="Destination country"
                placeholder="—"
              />
            </div>
          </div>

          <div class="detail-field">
            <span class="detail-field__label">Budget</span>
            <EditableField
              clientId={$selectedClient.id}
              path={`consultations.${latestIdx}.budget`}
              value={$selectedClient.budget}
              label="Budget"
              placeholder="—"
            />
          </div>

          <div class="detail-field">
            <span class="detail-field__label">Move Size</span>
            <EditableField
              clientId={$selectedClient.id}
              path={`consultations.${latestIdx}.size`}
              value={$selectedClient.size}
              label="Move size"
              placeholder="—"
            />
          </div>

          <div class="detail-field">
            <span class="detail-field__label">Immigration Status</span>
            <EditableField
              clientId={$selectedClient.id}
              path={`consultations.${latestIdx}.immigrationStatus`}
              value={$selectedClient.immigrationStatus}
              label="Immigration status"
              placeholder="—"
            />
          </div>

          <div class="detail-field">
            <span class="detail-field__label">Property</span>
            <div class="detail-field__route">
              <EditableField
                clientId={$selectedClient.id}
                path={`consultations.${latestIdx}.propertyTypeFrom`}
                value={$selectedClient.propertyTypeFrom}
                label="From"
                placeholder="—"
              />
              <span class="detail-field__route-arrow">→</span>
              <EditableField
                clientId={$selectedClient.id}
                path={`consultations.${latestIdx}.propertyTypeTo`}
                value={$selectedClient.propertyTypeTo}
                label="To"
                placeholder="—"
              />
            </div>
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
              <span class="detail-field__value detail-field__value--readonly" title="Set via Calendar — not editable here">
                {formatDateTime($selectedClient.scheduling[0])}
              </span>
            </div>
          {/if}

          {#if $selectedClient.callOutcome}
            <div class="detail-field">
              <span class="detail-field__label">Call Outcome</span>
              <EditableField
                clientId={$selectedClient.id}
                path={`callOutcome`}
                value={$selectedClient.callOutcome}
                label="Call outcome"
                placeholder="—"
              />
            </div>
          {/if}

          <div class="detail-field detail-field--full">
            <span class="detail-field__label">Call Transcript</span>
            {#if $selectedClient.transcript}
              <EditableField
                clientId={$selectedClient.id}
                path={`transcript`}
                value={$selectedClient.transcript}
                label="Transcript"
                multiline
                placeholder="No transcript"
              />
            {/if}
            <TranscriptPaster clientId={$selectedClient.id} />
          </div>

          <div class="detail-field">
            <span class="detail-field__label">Phone</span>
            <EditableField
              clientId={$selectedClient.id}
              path={`phone`}
              value={$selectedClient.phone}
              label="Phone"
              placeholder="—"
            />
          </div>

          <div class="detail-field">
            <span class="detail-field__label">Drip Active</span>
            <EditableField
              clientId={$selectedClient.id}
              path={`dripEnabled`}
              value={$selectedClient.dripEnabled}
              label="Drip enabled"
              placeholder="—"
            />
          </div>

          <div class="detail-field">
            <span class="detail-field__label">Consultations</span>
            <span class="detail-field__value detail-field__value--readonly" title="Computed from consultations[] length">
              {$selectedClient.consultationCount}
            </span>
          </div>

          <div class="detail-field">
            <span class="detail-field__label">Created</span>
            <span class="detail-field__value detail-field__value--readonly" title="First consultation timestamp — read-only">
              {formatDate($selectedClient.createdAt)}
            </span>
          </div>

          <!-- ── Advanced fields (every other top-level Firestore key) ── -->
          <div class="detail-field detail-field--full">
            <button
              type="button"
              class="detail-overview__advanced-toggle"
              on:click={() => (showAdvancedFields = !showAdvancedFields)}
            >
              {showAdvancedFields ? '▾' : '▸'} Advanced fields ({Object.keys($selectedClient.rawDoc || {}).length} total)
            </button>
            {#if showAdvancedFields}
              <div class="detail-overview__advanced">
                <CardFieldsAccordion
                  clientId={$selectedClient.id}
                  rawDoc={$selectedClient.rawDoc}
                />
                <details class="detail-custom-fields-add">
                  <summary>+ Add a new custom field</summary>
                  <form class="detail-custom-fields__form" on:submit|preventDefault={handleAddCustomField}>
                    <input type="text" bind:value={newFieldKey} placeholder="Field name (e.g. petPolicy)" class="detail-cf-input" />
                    <input type="text" bind:value={newFieldValue} placeholder="Value" class="detail-cf-input" />
                    <button type="submit" disabled={!newFieldKey.trim() || !newFieldValue.trim()}>Add</button>
                  </form>
                  <p class="detail-custom-fields-add__hint">
                    The new field will be added under <code>customFields.&lt;name&gt;</code>.
                  </p>
                </details>
              </div>
            {/if}
          </div>
        </div>

      <!-- ── Journey Tab — chronological merge of EVERY event we know about ─ -->
      <!--
        Why this exists: operators wanted ONE pane of glass that shows the
        end-to-end timeline for a client — emails sent, calls scheduled,
        notes added, transcripts pulled, AI-insights extracted, stage moves,
        and any operator action — without bouncing between Activity, Emails,
        Notes, and Conversations tabs.
        Source data:
          - $selectedClient.activityLog (already merged: stage_change,
            email_triggered, note_added, action_executed, gemini_notes_received,
            insights_extracted, field_update, …)
          - scheduling[] from latest consultation (calls)
          - meetingNotes (Gemini-pulled transcript landing event)
          - createdAt (genesis row)
        We render newest-first to match how the rest of the panel works.
      -->
      {:else if detailTab === 'journey'}
        {@const sc = $selectedClient}
        {@const events = (() => {
          // Build a unified, sorted-desc timeline. Each entry is normalized to
          // { ts, kind, icon, title, subtitle?, raw? }. We tolerate missing
          // timestamps by falling back to "—".
          const out: Array<{ ts: string; kind: string; icon: string; title: string; subtitle?: string; tone?: 'ok' | 'warn' | 'info'; raw?: any }> = [];
          // Genesis row
          if (sc.createdAt) {
            out.push({
              ts: sc.createdAt,
              kind: 'created',
              icon: '🌱',
              title: 'Client record created',
              subtitle: 'First consultation captured',
              tone: 'info',
            });
          }
          // Scheduled calls (every entry on scheduling[])
          for (const iso of sc.scheduling || []) {
            if (!iso) continue;
            const isFuture = new Date(iso).getTime() > Date.now();
            out.push({
              ts: iso,
              kind: 'call_scheduled',
              icon: isFuture ? '📅' : '📞',
              title: isFuture ? 'Consultation call scheduled' : 'Consultation call held',
              subtitle: isFuture ? 'Upcoming — calendar event live' : 'Past meeting',
              tone: isFuture ? 'info' : 'ok',
            });
          }
          // Gemini meeting-notes landing
          if (sc.meetingNotes?.fetched && sc.meetingNotes.fetchedAt) {
            out.push({
              ts: sc.meetingNotes.fetchedAt,
              kind: 'gemini_notes',
              icon: '✨',
              title: 'Gemini meeting notes pulled',
              subtitle: sc.meetingNotes.docTitle ? `Doc: ${sc.meetingNotes.docTitle}` : 'Plain text persisted',
              tone: 'ok',
            });
          }
          // ActivityLog entries (the workhorse — heterogeneous union, so we
          // widen to `any` and pull keys defensively. Each variant has its
          // own field set per the server-side activityLog writers in
          // irp-funnel-server/API/dashboard/clientHelpers.ts).
          for (const eRaw of sc.activityLog || []) {
            const e: any = eRaw;
            if (!e || typeof e !== 'object') continue;
            const ts = e.timestamp || e.at || '';
            switch (e.type) {
              case 'stage_change':
                out.push({
                  ts,
                  kind: 'stage_change',
                  icon: '🚦',
                  title: `Stage moved to ${(e.to && STAGE_LABELS[e.to as keyof typeof STAGE_LABELS]) || e.to || '?'}`,
                  subtitle: e.from ? `from ${(STAGE_LABELS[e.from as keyof typeof STAGE_LABELS] ?? e.from)}` : undefined,
                  tone: 'info',
                  raw: e,
                });
                break;
              case 'email_triggered':
              case 'email_sent':
                out.push({
                  ts,
                  kind: 'email',
                  icon: '📧',
                  title: e.emailType ? `Email sent — ${e.emailType}` : 'Email sent',
                  subtitle: e.actor ? `by ${e.actor}` : undefined,
                  tone: 'ok',
                  raw: e,
                });
                break;
              case 'note_added':
                out.push({
                  ts,
                  kind: 'note',
                  icon: '📝',
                  title: 'Note added',
                  subtitle: e.author ? `by ${e.author}` : (e.actor ? `by ${e.actor}` : undefined),
                  tone: 'info',
                  raw: e,
                });
                break;
              case 'action_executed':
                out.push({
                  ts,
                  kind: 'action',
                  icon: e.success === false ? '❌' : '⚡',
                  title: e.actionKey ? `Action — ${e.actionKey.replace(/_/g, ' ')}` : 'Action executed',
                  subtitle: e.actor ? `by ${e.actor}` : undefined,
                  tone: e.success === false ? 'warn' : 'ok',
                  raw: e,
                });
                break;
              case 'gemini_notes_received':
                out.push({
                  ts,
                  kind: 'gemini_received',
                  icon: '🛰',
                  title: 'Gemini notes received',
                  subtitle: e.eventId ? `event ${String(e.eventId).slice(0, 8)}…` : undefined,
                  tone: 'ok',
                  raw: e,
                });
                break;
              case 'insights_extracted':
                out.push({
                  ts,
                  kind: 'insights',
                  icon: '🧠',
                  title: 'AI insights extracted',
                  subtitle: `${e.shippingMode ?? '—'} / ${e.packingTier ?? '—'} (conf ${(((e.confidence ?? 0) * 100) | 0)}%)`,
                  tone: 'ok',
                  raw: e,
                });
                break;
              case 'field_update':
                out.push({
                  ts,
                  kind: 'field',
                  icon: '✏️',
                  title: `Fields updated: ${(e.fields || []).join(', ') || '?'}`,
                  subtitle: e.actor ? `by ${e.actor}` : undefined,
                  tone: 'info',
                  raw: e,
                });
                break;
              default:
                out.push({
                  ts,
                  kind: e.type || 'other',
                  icon: '•',
                  title: e.type || 'Event',
                  subtitle: e.actor ? `by ${e.actor}` : undefined,
                  tone: 'info',
                  raw: e,
                });
            }
          }
          // Sort newest-first; missing timestamps go to the bottom.
          out.sort((a, b) => {
            const at = a.ts ? new Date(a.ts).getTime() : 0;
            const bt = b.ts ? new Date(b.ts).getTime() : 0;
            return bt - at;
          });
          return out;
        })()}

        <div class="detail-journey">
          {#if events.length === 0}
            <div class="detail-journey__empty">
              <span class="detail-journey__empty-icon">🛣</span>
              <p class="detail-journey__empty-title">No journey events yet</p>
              <p class="detail-journey__empty-desc">
                Stage moves, sent emails, scheduled calls, AI extractions, and
                operator actions will appear here as they happen.
              </p>
            </div>
          {:else}
            <ol class="detail-journey__list">
              {#each events as ev}
                <li class="detail-journey__item detail-journey__item--{ev.tone || 'info'}">
                  <span class="detail-journey__icon" aria-hidden="true">{ev.icon}</span>
                  <div class="detail-journey__body">
                    <div class="detail-journey__title">{ev.title}</div>
                    {#if ev.subtitle}
                      <div class="detail-journey__subtitle">{ev.subtitle}</div>
                    {/if}
                  </div>
                  <span class="detail-journey__time" title={ev.ts ? exactTime(ev.ts) : ''}>
                    {ev.ts ? relativeTime(ev.ts) : '—'}
                  </span>
                </li>
              {/each}
            </ol>
          {/if}
        </div>

      <!-- ── Insights Tab (AI-extracted shipping mode + packing tier) ─── -->
      {:else if detailTab === 'insights'}
        <div class="detail-insights">
          {#if $selectedClient.transcriptInsights}
            {@const ins = $selectedClient.transcriptInsights}
            <div class="detail-insights__hero">
              <div class="detail-insights__hero-row">
                <span class="detail-insights__ai-label">AI</span>
                {#if ins.shippingMode && SHIPPING_MODE_LABEL[ins.shippingMode]}
                  <span class="detail-insights__mode-chip">
                    <span>{SHIPPING_MODE_LABEL[ins.shippingMode].icon}</span>
                    <span>{SHIPPING_MODE_LABEL[ins.shippingMode].label}</span>
                  </span>
                {:else}
                  <span class="detail-insights__mode-chip detail-insights__mode-chip--unset">No shipping mode inferred</span>
                {/if}
                {#if ins.packingTier && PACKING_TIER_LABEL[ins.packingTier]}
                  <span class="detail-insights__tier-chip">
                    <span>{PACKING_TIER_LABEL[ins.packingTier].icon}</span>
                    <span>{PACKING_TIER_LABEL[ins.packingTier].label}</span>
                  </span>
                {/if}
              </div>

              <div class="detail-insights__confidence-row">
                <span class="detail-insights__confidence-label">Confidence</span>
                <span class="detail-insights__confidence-bar-wrap" style="--conf:{Math.round((ins.confidence || 0) * 100)}%">
                  <span class="detail-insights__confidence-bar"></span>
                </span>
                <span class="detail-insights__confidence-pct">{Math.round((ins.confidence || 0) * 100)}%</span>
              </div>
            </div>

            {#if ins.reasoning}
              <div class="detail-insights__reasoning">
                <strong>Reasoning:</strong> {ins.reasoning}
              </div>
            {/if}

            {#if Object.keys(ins.extractedFields || {}).length > 0}
              <div class="detail-insights__extracted">
                <h4>Extracted facts</h4>
                <div class="detail-insights__extracted-grid">
                  {#each Object.entries(ins.extractedFields) as [k, v]}
                    <div class="detail-insights__extracted-row">
                      <span class="detail-insights__extracted-key">{k}</span>
                      <span class="detail-insights__extracted-val">{Array.isArray(v) ? v.join(', ') : (v ?? '—')}</span>
                    </div>
                  {/each}
                </div>
              </div>
            {/if}

            <div class="detail-insights__meta">
              <span title={exactTime(ins.generatedAt)}>Generated {relativeTime(ins.generatedAt)}</span>
              <span class="detail-insights__source">· source: <code>{ins.source}</code></span>
              <span class="detail-insights__source">· model: <code>{ins.model}</code></span>
            </div>
          {:else if hasSomeTranscript}
            <!--
              We have transcript material but no AI insights yet — most likely
              the Gemini-extractor hasn't been triggered, or it ran and
              returned no_source_text. Tell the operator and let them re-run.
            -->
            <div class="detail-insights__empty">
              <span class="detail-insights__empty-icon">⚙️</span>
              <p class="detail-insights__empty-title">Transcript ready — insights pending</p>
              <p class="detail-insights__empty-desc">
                We have transcript material on file but the AI hasn't classified
                this client yet. Click <strong>Re-extract</strong> below to run
                the shipping-mode + packing-tier classifier now.
              </p>
            </div>
          {:else if isPostCallStage}
            <!--
              Client is in a post-call stage but we have NO transcript text.
              The Gemini meeting-notes poller probably hasn't fetched yet —
              point the operator at the right action instead of saying
              the misleading "no transcript yet".
            -->
            <div class="detail-insights__empty">
              <span class="detail-insights__empty-icon">⏳</span>
              <p class="detail-insights__empty-title">Waiting for Gemini meeting notes</p>
              <p class="detail-insights__empty-desc">
                This client is in <strong>{STAGE_LABELS[$selectedClient.stage]}</strong>,
                but the Google Meet transcript hasn't been pulled yet. The next
                polling cycle will fetch it automatically — or you can paste the
                transcript text below to extract insights right now.
              </p>
            </div>
          {:else}
            <!-- Pre-call client — insights aren't expected yet. -->
            <div class="detail-insights__empty">
              <span class="detail-insights__empty-icon">📝</span>
              <p class="detail-insights__empty-title">No call yet — no insights expected</p>
              <p class="detail-insights__empty-desc">
                The AI classifies shipping mode + packing tier from the call
                transcript. Once <strong>{$selectedClient.displayName || 'this client'}</strong>
                completes the consultation call (and Gemini transcribes it),
                insights will appear here automatically.
              </p>
            </div>
          {/if}

          <div class="detail-insights__manual">
            <h4>Manual transcript paste (optional)</h4>
            <textarea
              class="detail-insights__manual-textarea"
              placeholder="Paste a transcript snippet here, then click Extract to classify shipping mode + packing tier."
              bind:value={manualTranscriptText}
              rows="4"
            ></textarea>
            <div class="detail-insights__actions">
              <button
                type="button"
                class="detail-insights__extract-btn"
                disabled={insightsExtracting}
                on:click={() => reExtractInsights(true)}
              >
                {#if insightsExtracting}
                  <span class="actions-card__spinner"></span>
                  Extracting…
                {:else}
                  🔄 Re-extract from transcript
                {/if}
              </button>
            </div>
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
              <!-- ── Cross-stage selector ──────────────────────────────────── -->
              <div class="actions-tab__stage-selector-wrap" title="Run actions from any pipeline stage">
                <label class="actions-tab__stage-selector-label" for="actions-stage-select">Stage:</label>
                <select
                  id="actions-stage-select"
                  class="actions-tab__stage-select"
                  value={selectedActionsStage}
                  on:change={handleActionsStageChange}
                  disabled={actionsLoading}
                >
                  {#each Object.entries(STAGE_LABELS) as [stageKey, stageLabel]}
                    <option value={stageKey}>{stageLabel}</option>
                  {/each}
                </select>
                {#if selectedActionsStage && selectedActionsStage !== actionsClientStage}
                  <span class="actions-tab__cross-stage-hint" title="Showing actions from a different stage">
                    ↔ cross-stage
                  </span>
                {/if}
              </div>
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

      <!-- ── Activity Tab — natural-language audit log w/ Undo ────────── -->
      {:else if detailTab === 'activity'}
        <div class="detail-activity">
          <CardHistory
            clientId={$selectedClient.id}
            activityLog={$selectedClient.activityLog}
            limit={50}
          />
        </div>

      <!-- ── Emails Tab — sent history + send-from-template ─────────────── -->
      <!--
        We surface BOTH (a) every email we've already sent — derived from the
        activityLog — AND (b) the trigger-a-new-email form. The history list
        is the operator's "what have we already said to this person" view,
        previously buried inside the Activity tab.
      -->
      {:else if detailTab === 'emails'}
        {@const sentEmails = ($selectedClient.activityLog || [])
          .filter((e: any) => e && (e.type === 'email_triggered' || e.type === 'email_sent'))
          .slice()
          .reverse()}
        <div class="detail-emails">
          <div class="detail-emails__history">
            <h4 class="detail-emails__history-title">
              📨 Sent emails ({sentEmails.length})
            </h4>
            {#if sentEmails.length === 0}
              <p class="detail-empty">No emails sent yet.</p>
            {:else}
              <ol class="detail-emails__history-list">
                {#each sentEmails as e}
                  {@const isInferred = !!(e as any).inferred}
                  {@const sentEmailId = (e as any).sentEmailId as string | undefined}
                  <!-- svelte-ignore a11y-click-events-have-key-events -->
                  <!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
                  <li
                    class="detail-emails__history-item"
                    class:detail-emails__history-item--inferred={isInferred}
                    class:detail-emails__history-item--clickable={!!sentEmailId}
                    title={
                      sentEmailId
                        ? 'Click to preview the rendered email'
                        : isInferred
                          ? `Inferred from stage history (${(e as any).reason || 'no reason recorded'}) — no rendered snapshot yet. Run scripts/backfill-render-inferred-emails.ts to render.`
                          : 'No snapshot saved (this email pre-dates the saveSentEmail wiring).'
                    }
                    on:click={() => sentEmailId && selectedSentEmailId.set(sentEmailId)}
                    role={sentEmailId ? 'button' : undefined}
                    tabindex={sentEmailId ? 0 : undefined}
                  >
                    <span class="detail-emails__history-icon">{isInferred ? '🔮' : '📧'}</span>
                    <div class="detail-emails__history-body">
                      <div class="detail-emails__history-type">
                        {(EMAIL_TYPES.find(t => t.value === e.emailType)?.label) || e.emailType || 'Email'}
                        {#if isInferred}
                          <span class="detail-emails__history-inferred-badge">inferred</span>
                        {/if}
                      </div>
                      <div class="detail-emails__history-meta">
                        {#if isInferred}
                          backfilled from stage history
                        {:else}
                          {e.actor ? `by ${e.actor}` : 'system'}
                        {/if}
                      </div>
                    </div>
                    <span class="detail-emails__history-time" title={e.timestamp ? exactTime(e.timestamp) : ''}>
                      {e.timestamp ? relativeTime(e.timestamp) : '—'}
                    </span>
                  </li>
                {/each}
              </ol>
            {/if}
          </div>

          <div class="detail-emails__send">
            <p class="detail-emails__desc">Send a new email from a template:</p>
            <div class="detail-emails__form">
              <select bind:value={selectedEmailType} class="detail-emails__select">
                <option value="">Choose email type…</option>
                {#each EMAIL_TYPES as et}
                  <option value={et.value}>{et.label}</option>
                {/each}
              </select>
              <!-- ── 2-step flow: "Preview & Send" opens the pre-send drawer ── -->
              <button
                class="detail-emails__btn detail-emails__btn--preview"
                disabled={emailPreviewing || !selectedEmailType}
                on:click={handlePreviewEmail}
                title="Preview the rendered email before it's sent"
              >
                {#if emailPreviewing}
                  <span class="actions-card__spinner"></span>
                  Loading…
                {:else}
                  👁 Preview & Send
                {/if}
              </button>
            </div>
            {#if emailSentMessage}
              <div class="detail-emails__message" class:success={emailSentMessage.startsWith('✓')} class:fail={emailSentMessage.startsWith('✗')}>
                {emailSentMessage}
              </div>
            {/if}
          </div>
        </div>

      {/if}
    </div>
  </aside>
{/if}
