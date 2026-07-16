<script lang="ts">
  import { onMount } from 'svelte';
  import { get } from 'svelte/store';

  import {
    STAGE_LABELS,
    RULE_CONDITION_LABELS,
    fetchAutomationMeta,
    fetchAutomationRules,
    saveAutomationRule,
    patchAutomationRule,
    deleteAutomationRule,
    fetchAutomationTemplates,
    saveAutomationTemplate,
    deleteAutomationTemplate,
    previewAutomationTemplate,
    fetchRecipientRules,
    saveRecipientRule,
    fetchStages,

    createStage,
    updateStage,
    reorderStages,
    deleteStage,
    countStageClients,
    migrateStageClients,
    type AutomationMeta,
    type StageEmailRule,
    type EmailTemplateRow,
    type EmailRecipientRule,
    type TeamRecipient,
    type RuleCondition,
    type RuleMode,
    type StageConfigRow,
    mergeFieldOptions,
    fieldConfig,
    loadOverviewFields,
  } from '../store.ts';

  import OverviewFieldsEditor from './OverviewFieldsEditor.svelte';
  import StageGatesEditor from './StageGatesEditor.svelte';
  import LiveHtmlEditor from '$lib/LiveHtmlEditor.svelte';



  // ── State ──────────────────────────────────────────────────────────────
  let meta: AutomationMeta | null = null;
  let rules: StageEmailRule[] = [];
  let templates: EmailTemplateRow[] = [];
  let loading = true;
  let error = '';
  let tab: 'stages' | 'templates' | 'fields' | 'recipients' = 'stages';
  let busyId = ''; // id of the row currently saving (disables its controls)

  // ── Recipients state (per-email-type team CC/BCC exclusions) ─────────────
  // `recipientMap[emailType]` is the live Set of excluded team addresses for
  // that type. Toggling a checkbox recomputes the set + persists it.
  let teamRecipients: TeamRecipient[] = [];
  let recipientMap: Record<string, Set<string>> = {};
  let recipientBusy = ''; // `${emailType}::${email}` while a toggle is saving


  // ── Stage configuration state ───────────────────────────────────────────
  let stages: StageConfigRow[] = [];
  let stageBusyId = '';           // id of the stage row currently mutating
  let stageError = '';
  // Add-stage draft
  let newStageLabel = '';
  let newStageInsertAfter = '';   // '' = append at end
  let addingStage = false;
  // Delete-with-migration modal
  let deleteModalStage: StageConfigRow | null = null;
  let deleteClientCount = 0;
  let deletePrevId: string | null = null;
  let deleteNextId: string | null = null;
  let deleteMigrateTo = '';       // '' until operator picks a destination
  let deleteBusy = false;
  let deleteError = '';
  // Standalone "migrate all clients" modal
  let migrateModalStage: StageConfigRow | null = null;
  let migrateClientCount = 0;
  let migrateTargetId = '';
  let migrateBusy = false;
  let migrateError = '';
  let migrateResult = '';

  /** Active stages only (the ones shown as board columns). */
  $: activeStages = stages.filter((s) => s.active !== false).sort((a, b) => a.order - b.order);


  // Per-stage inline "add rule" drafts (keyed by stage id)
  type RuleDraft = { emailType: string; condition: RuleCondition; mode: RuleMode; delayHours: number };
  let ruleDrafts: Record<string, RuleDraft> = {};

  // Template editor
  let editingType = '';
  let editSubject = '';
  let editBody = '';
  let editLabel = '';
  let previewHtml = '';
  let previewLoading = false;
  let savingTemplate = false;

  function stageLabel(stage: string): string {
    return STAGE_LABELS[stage] || stage;
  }

  function emailTypeLabel(value: string): string {
    const t = meta?.emailTypes.find((e) => e.value === value);
    return t?.label || value;
  }

  async function loadAll() {
    loading = true;
    error = '';
    try {
      const [m, r, t, s, rec] = await Promise.all([
        fetchAutomationMeta(),
        fetchAutomationRules(),
        fetchAutomationTemplates(),
        fetchStages().catch(() => [] as StageConfigRow[]),
        fetchRecipientRules().catch(() => ({ rules: [] as EmailRecipientRule[], teamRecipients: [] as TeamRecipient[] })),
      ]);
      meta = m;
      rules = r;
      templates = t;
      stages = s;
      applyRecipientData(rec.rules, rec.teamRecipients);
    } catch (e: any) {
      error = e?.message ?? 'Failed to load automation config.';
    } finally {
      loading = false;
    }
  }

  /** Rebuild the local exclusion map + team pool from a fetch. */
  function applyRecipientData(rulesIn: EmailRecipientRule[], pool: TeamRecipient[]) {
    // Prefer the meta pool when present (single fetch already has it); fall back
    // to the dedicated endpoint's pool so the tab works even if meta lacked it.
    teamRecipients = (meta?.teamRecipients?.length ? meta.teamRecipients : pool) ?? [];
    const map: Record<string, Set<string>> = {};
    for (const r of rulesIn) {
      map[r.emailType] = new Set(r.excludedRecipients ?? []);
    }
    recipientMap = map;
  }

  /**
   * Toggle whether `email` is excluded from `emailType`'s team CC/BCC, then
   * persist the new exclusion set. Optimistic: the checkbox flips immediately.
   */
  async function toggleExclusion(emailType: string, email: string) {
    const key = `${emailType}::${email}`;
    recipientBusy = key;
    error = '';
    const current = new Set(recipientMap[emailType] ?? []);
    if (current.has(email)) current.delete(email);
    else current.add(email);
    try {
      const saved = await saveRecipientRule(emailType, [...current]);
      recipientMap = { ...recipientMap, [emailType]: new Set(saved.excludedRecipients ?? []) };
    } catch (e: any) {
      error = e?.message ?? 'Failed to update recipients.';
    } finally {
      recipientBusy = '';
    }
  }

  /** True when `email` is currently excluded from `emailType`. */
  function isExcluded(emailType: string, email: string): boolean {
    return recipientMap[emailType]?.has(email) ?? false;
  }

  onMount(() => {
    loadAll();
    // Ensure the Overview Field Registry is loaded so the template editor's
    // merge-field picker (`$mergeFieldOptions`) is populated. Non-blocking and
    // idempotent — skipped when the dashboard boot already hydrated it.
    if (get(fieldConfig).length === 0) loadOverviewFields().catch(() => {});
  });



  // ── Stage configuration actions ──────────────────────────────────────────
  async function reloadStages() {
    try {
      stages = await fetchStages();
    } catch (e: any) {
      stageError = e?.message ?? 'Failed to load stages.';
    }
  }

  /** Move a stage one slot earlier/later among the ACTIVE columns, then persist. */
  async function moveStage(stage: StageConfigRow, dir: -1 | 1) {
    const ordered = activeStages.map((s) => s.id);
    const idx = ordered.indexOf(stage.id);
    const swap = idx + dir;
    if (idx < 0 || swap < 0 || swap >= ordered.length) return;
    [ordered[idx], ordered[swap]] = [ordered[swap], ordered[idx]];
    stageBusyId = stage.id;
    stageError = '';
    try {
      stages = await reorderStages(ordered);
    } catch (e: any) {
      stageError = e?.message ?? 'Failed to reorder stages.';
    } finally {
      stageBusyId = '';
    }
  }

  /** Persist an inline edit to a single stage field. */
  async function patchStage(stage: StageConfigRow, updates: Partial<StageConfigRow>) {
    stageBusyId = stage.id;
    stageError = '';
    try {
      await updateStage(stage.id, updates);
      await reloadStages();
    } catch (e: any) {
      stageError = e?.message ?? 'Failed to update stage.';
    } finally {
      stageBusyId = '';
    }
  }

  async function addStage() {
    stageError = '';
    const label = newStageLabel.trim();
    if (!label) { stageError = 'Enter a name for the new stage.'; return; }
    addingStage = true;
    try {
      const res = await createStage({
        label,
        ...(newStageInsertAfter ? { insertAfterId: newStageInsertAfter } : {}),
      });
      stages = res.stages;
      newStageLabel = '';
      newStageInsertAfter = '';
    } catch (e: any) {
      stageError = e?.message ?? 'Failed to add stage.';
    } finally {
      addingStage = false;
    }
  }

  // ── Delete-with-migration ─────────────────────────────────────────────────
  async function openDeleteModal(stage: StageConfigRow) {
    deleteModalStage = stage;
    deleteMigrateTo = '';
    deleteError = '';
    deleteClientCount = 0;
    deletePrevId = null;
    deleteNextId = null;
    try {
      const info = await countStageClients(stage.id);
      deleteClientCount = info.count;
      deletePrevId = info.previousStageId;
      deleteNextId = info.nextStageId;
    } catch (e: any) {
      deleteError = e?.message ?? 'Could not count clients in this column.';
    }
  }

  function closeDeleteModal() {
    deleteModalStage = null;
    deleteBusy = false;
  }

  async function confirmDelete() {
    if (!deleteModalStage) return;
    // When clients exist, a destination MUST be chosen first.
    if (deleteClientCount > 0 && !deleteMigrateTo) {
      deleteError = 'Choose where to move the clients before deleting.';
      return;
    }
    deleteBusy = true;
    deleteError = '';
    try {
      await deleteStage(deleteModalStage.id, deleteClientCount > 0 ? deleteMigrateTo : undefined);
      await reloadStages();
      closeDeleteModal();
    } catch (e: any) {
      deleteError = e?.message ?? 'Failed to delete stage.';
      deleteBusy = false;
    }
  }

  // ── Standalone "migrate all clients" ───────────────────────────────────────
  async function openMigrateModal(stage: StageConfigRow) {
    migrateModalStage = stage;
    migrateTargetId = '';
    migrateError = '';
    migrateResult = '';
    migrateClientCount = 0;
    try {
      const info = await countStageClients(stage.id);
      migrateClientCount = info.count;
    } catch (e: any) {
      migrateError = e?.message ?? 'Could not count clients in this column.';
    }
  }

  function closeMigrateModal() {
    migrateModalStage = null;
    migrateBusy = false;
  }

  async function confirmMigrate() {
    if (!migrateModalStage || !migrateTargetId) {
      migrateError = 'Pick a destination column.';
      return;
    }
    migrateBusy = true;
    migrateError = '';
    try {
      const res = await migrateStageClients(migrateModalStage.id, migrateTargetId);
      migrateResult = `Moved ${res.migrated} of ${res.total} clients.` + (res.failed ? ` (${res.failed} failed)` : '');
      await reloadStages();
    } catch (e: any) {
      migrateError = e?.message ?? 'Migration failed.';
    } finally {
      migrateBusy = false;
    }
  }


  // ── Rule actions ─────────────────────────────────────────────────────────
  async function toggleRule(rule: StageEmailRule) {
    busyId = rule.id;
    try {
      const updated = await patchAutomationRule(rule.id, { enabled: !rule.enabled });
      rules = rules.map((r) => (r.id === updated.id ? updated : r));
    } catch (e: any) {
      error = e?.message ?? 'Failed to update rule.';
    } finally {
      busyId = '';
    }
  }

  async function changeRuleMode(rule: StageEmailRule, mode: RuleMode) {
    busyId = rule.id;
    try {
      const updated = await patchAutomationRule(rule.id, { mode });
      rules = rules.map((r) => (r.id === updated.id ? updated : r));
    } catch (e: any) {
      error = e?.message ?? 'Failed to update rule.';
    } finally {
      busyId = '';
    }
  }

  async function changeRuleCondition(rule: StageEmailRule, condition: RuleCondition) {
    busyId = rule.id;
    try {
      const updated = await patchAutomationRule(rule.id, { condition });
      rules = rules.map((r) => (r.id === updated.id ? updated : r));
    } catch (e: any) {
      error = e?.message ?? 'Failed to update rule.';
    } finally {
      busyId = '';
    }
  }

  async function changeRuleDelay(rule: StageEmailRule, delayHours: number) {
    busyId = rule.id;
    try {
      const updated = await patchAutomationRule(rule.id, { delayHours });
      rules = rules.map((r) => (r.id === updated.id ? updated : r));
    } catch (e: any) {
      error = e?.message ?? 'Failed to update rule.';
    } finally {
      busyId = '';
    }
  }

  async function removeRule(rule: StageEmailRule) {
    if (!confirm(`Delete the rule "${rule.label}"? This cannot be undone.`)) return;
    busyId = rule.id;
    try {
      await deleteAutomationRule(rule.id);
      rules = rules.filter((r) => r.id !== rule.id);
    } catch (e: any) {
      error = e?.message ?? 'Failed to delete rule.';
    } finally {
      busyId = '';
    }
  }

  async function addRuleForStage(stageId: string) {
    const d = ruleDrafts[stageId];
    if (!d || !d.emailType) {
      stageError = 'Pick an email type to add a rule.';
      return;
    }
    busyId = `add:${stageId}`;
    stageError = '';
    try {
      const saved = await saveAutomationRule({
        triggerStage: stageId,
        emailType: d.emailType,
        condition: d.condition,
        mode: d.mode,
        delayHours: Number(d.delayHours) || 0,
        enabled: true,
      });
      // upsert into local list (replace if the id already existed)
      const idx = rules.findIndex((r) => r.id === saved.id);
      if (idx >= 0) rules[idx] = saved;
      else rules = [...rules, saved];
      rules = [...rules];
      d.delayHours = 0;
    } catch (e: any) {
      stageError = e?.message ?? 'Failed to add rule.';
    } finally {
      busyId = '';
    }
  }

  // ── Template actions ───────────────────────────────────────────────────────
  function openTemplate(t: EmailTemplateRow) {
    editingType = t.emailType;
    editSubject = t.subject;
    editBody = t.bodyHtml;
    editLabel = t.label;
    previewHtml = '';
    refreshPreview();
  }

  function closeTemplate() {
    editingType = '';
    previewHtml = '';
  }

  let previewTimer: ReturnType<typeof setTimeout> | null = null;
  function refreshPreview() {
    if (previewTimer) clearTimeout(previewTimer);
    previewTimer = setTimeout(async () => {
      if (!editingType) return;
      previewLoading = true;
      try {
        previewHtml = await previewAutomationTemplate(editingType, { bodyHtml: editBody });
      } catch {
        previewHtml = '<p style="color:#c62426">Preview unavailable.</p>';
      } finally {
        previewLoading = false;
      }
    }, 400);
  }

  async function saveTemplate() {
    savingTemplate = true;
    error = '';
    try {
      const saved = await saveAutomationTemplate(editingType, {
        subject: editSubject,
        bodyHtml: editBody,
        label: editLabel,
        enabled: true,
      });
      templates = templates.map((t) => (t.emailType === saved.emailType ? saved : t));
      closeTemplate();
    } catch (e: any) {
      error = e?.message ?? 'Failed to save template.';
    } finally {
      savingTemplate = false;
    }
  }

  async function toggleTemplate(t: EmailTemplateRow) {
    busyId = t.emailType;
    try {
      const saved = await saveAutomationTemplate(t.emailType, {
        subject: t.subject,
        bodyHtml: t.bodyHtml,
        label: t.label,
        enabled: !t.enabled,
      });
      templates = templates.map((x) => (x.emailType === saved.emailType ? saved : x));
    } catch (e: any) {
      error = e?.message ?? 'Failed to update template.';
    } finally {
      busyId = '';
    }
  }

  async function revertTemplate(t: EmailTemplateRow) {
    if (!confirm(`Revert "${t.label}" to the built-in default? Your custom subject/body will be removed.`)) return;
    busyId = t.emailType;
    try {
      await deleteAutomationTemplate(t.emailType);
      templates = await fetchAutomationTemplates();
    } catch (e: any) {
      error = e?.message ?? 'Failed to revert template.';
    } finally {
      busyId = '';
    }
  }

  // Group rules by trigger stage so each stage card can show its own automations.
  $: rulesByStage = rules.reduce<Record<string, StageEmailRule[]>>((acc, r) => {
    (acc[r.triggerStage] ||= []).push(r);
    return acc;
  }, {});

  // Rules whose trigger stage no longer exists in the centralized config.
  $: activeStageIds = new Set(activeStages.map((s) => s.id));
  $: orphanRuleStages = Object.keys(rulesByStage)
    .filter((id) => !activeStageIds.has(id))
    .sort((a, b) => stageLabel(a).localeCompare(stageLabel(b)));

  // Ensure every stage has an inline "add rule" draft ready for binding.
  $: if (meta) {
    for (const s of stages) {
      if (!ruleDrafts[s.id]) {
        ruleDrafts[s.id] = {
          emailType: meta.emailTypes[0]?.value ?? '',
          condition: 'always',
          mode: 'suggest',
          delayHours: 0,
        };
      }
    }
  }
</script>

<div class="automation-view">
  <div class="av-header">
    <div>
      <h2 class="av-title">Email Automations</h2>
      <p class="av-subtitle">
        Configure — per pipeline stage — which email fires, under which condition, and whether it
        sends automatically or waits for you to confirm. The retired “private feedback” columns are
        now just automatic rules attached to the preceding real stage.
      </p>
    </div>
    <button class="reload-btn" on:click={loadAll} disabled={loading}>↺ Refresh</button>
  </div>

  {#if error}
    <div class="av-msg av-msg--error">{error}</div>
  {/if}

  <div class="av-tabs">
    <button class="av-tab" class:av-tab--active={tab === 'stages'} on:click={() => (tab = 'stages')}>
      🗂️ Stages &amp; rules
    </button>
    <button class="av-tab" class:av-tab--active={tab === 'templates'} on:click={() => (tab = 'templates')}>
      ✉️ Email templates
    </button>
    <button class="av-tab" class:av-tab--active={tab === 'fields'} on:click={() => (tab = 'fields')}>
      🧩 Overview fields
    </button>
    <button class="av-tab" class:av-tab--active={tab === 'recipients'} on:click={() => (tab = 'recipients')}>
      🚫 Recipients
    </button>
  </div>


  {#if loading}
    <div class="av-loading">Loading automation config…</div>
  {:else if tab === 'templates'}
    <!-- ── Templates ─────────────────────────────────────────────────── -->
    {#if templates.length === 0}
      <div class="av-empty">No email templates found.</div>
    {:else}
      <section class="av-card">
        <div class="av-table-wrap">
          <table class="av-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Subject</th>
                <th>Status</th>
                <th>On</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {#each templates as t (t.emailType)}
                <tr class:av-row--off={!t.enabled}>
                  <td class="av-email-cell">{t.label}<div class="av-type">{t.emailType}</div></td>
                  <td class="av-subject">{t.subject || '—'}</td>
                  <td>
                    {#if t.isCustom}
                      <span class="av-badge av-badge--custom">custom</span>
                    {:else if t.hasOverride}
                      <span class="av-badge av-badge--override">edited</span>
                    {:else}
                      <span class="av-badge">default</span>
                    {/if}
                  </td>
                  <td>
                    <button
                      class="av-switch"
                      class:av-switch--on={t.enabled}
                      on:click={() => toggleTemplate(t)}
                      disabled={busyId === t.emailType}
                      aria-label={t.enabled ? 'Enabled' : 'Disabled'}
                    >
                      <span class="av-switch__knob"></span>
                    </button>
                  </td>
                  <td class="av-actions">
                    <button class="av-link" on:click={() => openTemplate(t)}>Edit</button>
                    {#if t.hasOverride && !t.isCustom}
                      <button class="av-link av-link--danger" on:click={() => revertTemplate(t)}>Revert</button>
                    {/if}
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </section>
    {/if}
  {:else if tab === 'fields'}
    <!-- ── Overview-field registry (centralized, DB-backed; advisory/additive) ── -->
    <section class="av-card">
      <OverviewFieldsEditor />
    </section>
  {:else if tab === 'recipients'}
    <!-- ── Per-email-type team CC/BCC exclusions ──────────────────────── -->
    <p class="av-subtitle" style="margin-bottom:1.1rem">
      Every automated client email is, by default, copied to the internal team
      (CC/BCC). Tick a box to <strong>exclude</strong> that teammate from a
      specific email — e.g. keep the pre-call shipping guide off the pricing
      desk. Unticked = they still receive it. Changes save instantly.
    </p>

    {#if templates.length === 0 || teamRecipients.length === 0}
      <div class="av-empty">No email types or team recipients to configure.</div>
    {:else}
      <section class="av-card">
        <div class="av-table-wrap">
          <table class="av-table av-recip-table">
            <thead>
              <tr>
                <th>Email</th>
                {#each teamRecipients as tr (tr.email)}
                  <th class="av-recip-col" title={tr.email}>{tr.label}</th>
                {/each}
              </tr>
            </thead>
            <tbody>
              {#each templates as t (t.emailType)}
                <tr>
                  <td class="av-email-cell">{t.label}<div class="av-type">{t.emailType}</div></td>
                  {#each teamRecipients as tr (tr.email)}
                    <td class="av-recip-cell">
                      <label class="av-recip-check" title={`Exclude ${tr.label} from "${t.label}"`}>
                        <input
                          type="checkbox"
                          checked={isExcluded(t.emailType, tr.email)}
                          disabled={recipientBusy === `${t.emailType}::${tr.email}`}
                          on:change={() => toggleExclusion(t.emailType, tr.email)}
                        />
                      </label>
                    </td>
                  {/each}
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </section>
    {/if}
  {:else if tab === 'stages'}

    <!-- ── Unified: every centralized stage + its automation rules ─────── -->
    <p class="av-subtitle" style="margin-bottom:1.1rem">
      One place for the whole pipeline: reorder, rename, set each column’s SLA,
      choose whether clients see it, and manage the automated emails that fire on
      it. To remove a column you must first move its clients elsewhere — nobody
      ever falls off the board.
    </p>

    {#if stageError}<div class="av-msg av-msg--error">{stageError}</div>{/if}

    <!-- Add a stage -->
    <section class="av-card av-add">
      <h3 class="av-card-title">Add a stage</h3>
      <div class="av-add-grid av-add-grid--stage">
        <label class="av-field">
          <span>Name</span>
          <input type="text" placeholder="e.g. Handover to Ops" bind:value={newStageLabel} />
        </label>
        <label class="av-field">
          <span>Insert after</span>
          <select bind:value={newStageInsertAfter}>
            <option value="">— End of pipeline —</option>
            {#each activeStages as s}
              <option value={s.id}>{s.label}</option>
            {/each}
          </select>
        </label>
        <button class="save-btn" on:click={addStage} disabled={addingStage}>
          {addingStage ? 'Adding…' : '+ Add stage'}
        </button>
      </div>
    </section>

    {#if activeStages.length === 0}
      <div class="av-empty">No stages configured yet.</div>
    {:else}
      {#each activeStages as stage, i (stage.id)}
        <section class="av-card av-stage-card">
          <div class="av-stage-head">
            <div class="av-order-cell">
              <button class="av-move" on:click={() => moveStage(stage, -1)} disabled={i === 0 || stageBusyId === stage.id} title="Move up">🔥</button>
              <button class="av-move" on:click={() => moveStage(stage, 1)} disabled={i === activeStages.length - 1 || stageBusyId === stage.id} title="Move down">▼</button>
            </div>
            <span class="av-stage-emoji">{stage.icon || '📌'}</span>
            <div class="av-stage-idwrap">
              <input
                class="av-stage-name"
                type="text"
                value={stage.label}
                on:change={(e) => patchStage(stage, { label: e.currentTarget.value })}
                disabled={stageBusyId === stage.id}
              />
              <code class="av-stage-id">{stage.id}</code>
            </div>
            <div class="av-stage-controls">
              <label class="av-inline-field">
                <span>SLA</span>
                <input
                  class="av-delay"
                  type="number"
                  min="0"
                  value={stage.slaDays ?? ''}
                  placeholder="—"
                  on:change={(e) => patchStage(stage, { slaDays: e.currentTarget.value === '' ? null : Number(e.currentTarget.value) })}
                  disabled={stageBusyId === stage.id}
                /><span class="av-unit">d</span>
              </label>
              <label class="av-inline-field">
                <span>Client-visible</span>
                <button
                  class="av-switch"
                  class:av-switch--on={!stage.hiddenFromClient}
                  on:click={() => patchStage(stage, { hiddenFromClient: !stage.hiddenFromClient })}
                  disabled={stageBusyId === stage.id}
                  aria-label={stage.hiddenFromClient ? 'Hidden from client' : 'Visible to client'}
                  title={stage.hiddenFromClient ? 'Hidden from the client status page' : 'Visible on the client status page'}
                >
                  <span class="av-switch__knob"></span>
                </button>
              </label>
              <button class="av-link" on:click={() => openMigrateModal(stage)}>Migrate…</button>
              <button class="remove-btn" on:click={() => openDeleteModal(stage)} disabled={stageBusyId === stage.id} title="Delete stage">✕</button>
            </div>
          </div>

          <div class="av-stage-rules">
            {#if (rulesByStage[stage.id] ?? []).length}
              <div class="av-table-wrap">
                <table class="av-table">
                  <thead>
                    <tr>
                      <th>Automated email</th>
                      <th>Condition</th>
                      <th>Mode</th>
                      <th>Delay</th>
                      <th>On</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {#each rulesByStage[stage.id] as rule (rule.id)}
                      <tr class:av-row--off={!rule.enabled}>
                        <td class="av-email-cell">
                          {emailTypeLabel(rule.emailType)}
                          {#if rule.isSeed}<span class="av-badge" title="Seeded default">seed</span>{/if}
                        </td>
                        <td>
                          <select
                            value={rule.condition}
                            on:change={(e) => changeRuleCondition(rule, e.currentTarget.value as RuleCondition)}
                            disabled={busyId === rule.id}
                          >
                            {#each (meta?.conditions ?? []) as c}
                              <option value={c}>{RULE_CONDITION_LABELS[c] ?? c}</option>
                            {/each}
                          </select>
                        </td>
                        <td>
                          <select
                            value={rule.mode}
                            on:change={(e) => changeRuleMode(rule, e.currentTarget.value as RuleMode)}
                            disabled={busyId === rule.id}
                          >
                            <option value="suggest">Suggest</option>
                            <option value="auto">Auto</option>
                          </select>
                        </td>
                        <td class="av-delay-cell">
                          <input
                            class="av-delay"
                            type="number"
                            min="0"
                            value={rule.delayHours}
                            on:change={(e) => changeRuleDelay(rule, Number(e.currentTarget.value) || 0)}
                            disabled={busyId === rule.id}
                          /><span class="av-unit">h</span>
                        </td>
                        <td>
                          <button
                            class="av-switch"
                            class:av-switch--on={rule.enabled}
                            on:click={() => toggleRule(rule)}
                            disabled={busyId === rule.id}
                            title={rule.enabled ? 'Enabled — click to disable' : 'Disabled — click to enable'}
                            aria-label={rule.enabled ? 'Enabled' : 'Disabled'}
                          >
                            <span class="av-switch__knob"></span>
                          </button>
                        </td>
                        <td>
                          <button class="remove-btn" on:click={() => removeRule(rule)} disabled={busyId === rule.id} title="Delete rule">✕</button>
                        </td>
                      </tr>
                    {/each}
                  </tbody>
                </table>
              </div>
            {:else}
              <div class="av-stage-norules">No automated emails fire on this stage yet.</div>
            {/if}

            {#if ruleDrafts[stage.id]}
              <div class="av-add-rule">
                <span class="av-add-rule__label">＋ Email</span>
                <select class="av-add-rule__field" bind:value={ruleDrafts[stage.id].emailType}>
                  {#each (meta?.emailTypes ?? []) as e}
                    <option value={e.value}>{e.label}</option>
                  {/each}
                </select>
                <select class="av-add-rule__field" bind:value={ruleDrafts[stage.id].condition}>
                  {#each (meta?.conditions ?? []) as c}
                    <option value={c}>{RULE_CONDITION_LABELS[c] ?? c}</option>
                  {/each}
                </select>
                <select class="av-add-rule__field" bind:value={ruleDrafts[stage.id].mode}>
                  <option value="suggest">Suggest</option>
                  <option value="auto">Auto</option>
                </select>
                <input class="av-add-rule__delay" type="number" min="0" bind:value={ruleDrafts[stage.id].delayHours} title="Delay (hours)" /><span class="av-unit">h</span>
                <button class="av-add-rule__btn" on:click={() => addRuleForStage(stage.id)} disabled={busyId === `add:${stage.id}`}>
                  {busyId === `add:${stage.id}` ? 'Adding…' : 'Add'}
                </button>
              </div>
            {/if}
          </div>
        </section>
      {/each}

      {#if orphanRuleStages.length}
        <section class="av-card av-stage-card av-stage-card--orphan">
          <h3 class="av-card-title">⚠️ Rules on retired stages</h3>
          <p class="av-subtitle" style="margin:0 0 0.7rem">
            These automation rules point at stages that are no longer in the pipeline.
            They stay dormant until you re-create the stage or delete the rule.
          </p>
          {#each orphanRuleStages as ostage (ostage)}
            <div class="av-orphan-group">
              <code class="av-stage-id">{ostage}</code>
              {#each rulesByStage[ostage] as rule (rule.id)}
                <div class="av-orphan-rule">
                  <span>{emailTypeLabel(rule.emailType)}</span>
                  <button class="remove-btn" on:click={() => removeRule(rule)} disabled={busyId === rule.id} title="Delete rule">✕</button>
                </div>
              {/each}
            </div>
          {/each}
        </section>
      {/if}

      <!-- ── Generic stage-GATE rules (block moves until conditions met) ── -->
      <StageGatesEditor stageIds={activeStages.map((s) => s.id)} />
    {/if}
  {/if}
</div>


<!-- ── Delete-with-migration modal ─────────────────────────────────────── -->
{#if deleteModalStage}
  <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
  <div class="av-modal-backdrop" on:click={closeDeleteModal} role="presentation">
    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <div class="av-modal" on:click|stopPropagation role="dialog" aria-modal="true" tabindex="-1">
      <header class="av-drawer__head">
        <h3>Delete “{deleteModalStage.label}”</h3>
        <button class="av-close" on:click={closeDeleteModal} aria-label="Close">✕</button>
      </header>
      <div class="av-modal__body">
        {#if deleteClientCount > 0}
          <p class="av-modal-note">
            <strong>{deleteClientCount}</strong> client{deleteClientCount === 1 ? '' : 's'} are currently in this column.
            They will NOT be deleted — choose where to move them first:
          </p>
          <label class="av-field">
            <span>Move clients to</span>
            <select bind:value={deleteMigrateTo}>
              <option value="">— Select a destination —</option>
              {#if deletePrevId}<option value="__previous__">◀ Previous column ({stageLabel(deletePrevId)})</option>{/if}
              {#if deleteNextId}<option value="__next__">Next column ▶ ({stageLabel(deleteNextId)})</option>{/if}
              <option disabled>──────────</option>
              {#each activeStages.filter((s) => s.id !== deleteModalStage?.id) as s}
                <option value={s.id}>{s.label}</option>
              {/each}
            </select>
          </label>
        {:else}
          <p class="av-modal-note">This column has no clients. It can be deleted safely.</p>
        {/if}
        {#if deleteError}<div class="av-msg av-msg--error av-msg--sm">{deleteError}</div>{/if}
      </div>
      <footer class="av-drawer__foot">
        <button class="reload-btn" on:click={closeDeleteModal}>Cancel</button>
        <button class="remove-btn-wide" on:click={confirmDelete} disabled={deleteBusy}>
          {deleteBusy ? 'Deleting…' : (deleteClientCount > 0 ? 'Migrate & delete' : 'Delete stage')}
        </button>
      </footer>
    </div>
  </div>
{/if}

<!-- ── Migrate-all-clients modal ───────────────────────────────────────── -->
{#if migrateModalStage}
  <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
  <div class="av-modal-backdrop" on:click={closeMigrateModal} role="presentation">
    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <div class="av-modal" on:click|stopPropagation role="dialog" aria-modal="true" tabindex="-1">
      <header class="av-drawer__head">
        <h3>Move clients out of “{migrateModalStage.label}”</h3>
        <button class="av-close" on:click={closeMigrateModal} aria-label="Close">✕</button>
      </header>
      <div class="av-modal__body">
        <p class="av-modal-note">
          <strong>{migrateClientCount}</strong> client{migrateClientCount === 1 ? '' : 's'} in this column.
          Pick where to move them all:
        </p>
        <label class="av-field">
          <span>Destination column</span>
          <select bind:value={migrateTargetId}>
            <option value="">— Select a destination —</option>
            {#each activeStages.filter((s) => s.id !== migrateModalStage?.id) as s}
              <option value={s.id}>{s.label}</option>
            {/each}
          </select>
        </label>
        {#if migrateResult}<div class="av-msg av-msg--sm" style="background:#f0fdf4;color:#166534;border:1px solid #bbf7d0">{migrateResult}</div>{/if}
        {#if migrateError}<div class="av-msg av-msg--error av-msg--sm">{migrateError}</div>{/if}
      </div>
      <footer class="av-drawer__foot">
        <button class="reload-btn" on:click={closeMigrateModal}>Close</button>
        <button class="save-btn" on:click={confirmMigrate} disabled={migrateBusy || migrateClientCount === 0}>
          {migrateBusy ? 'Moving…' : 'Move all clients'}
        </button>
      </footer>
    </div>
  </div>
{/if}

<!-- ── Template editor drawer ──────────────────────────────────────────── -->
{#if editingType}
  <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
  <div class="av-drawer-backdrop" on:click={closeTemplate} on:keydown={(e) => e.key === 'Escape' && closeTemplate()} role="presentation">
    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <div class="av-drawer" on:click|stopPropagation role="dialog" aria-modal="true" tabindex="-1">
      <header class="av-drawer__head">
        <h3>Edit template — {emailTypeLabel(editingType)}</h3>
        <button class="av-close" on:click={closeTemplate} aria-label="Close">✕</button>
      </header>
      <div class="av-drawer__body">
        <div class="av-edit-col">
          <label class="av-field">
            <span>Label</span>
            <input type="text" bind:value={editLabel} />
          </label>
          <label class="av-field">
            <span>Subject</span>
            <input type="text" bind:value={editSubject} />
          </label>
          <div class="av-field av-field--grow">
            <span>Body — edit visually, insert client fields, or switch to HTML</span>
            <LiveHtmlEditor
              bind:value={editBody}
              fields={$mergeFieldOptions}
              minHeight="320px"
              placeholder="Compose this email…"
              on:input={refreshPreview}
            />
          </div>

        </div>
        <div class="av-preview-col">
          <div class="av-preview-head">Live preview {#if previewLoading}<span class="av-spin">…</span>{/if}</div>
          <div class="av-preview-frame">
            {@html previewHtml}
          </div>
        </div>
      </div>
      <footer class="av-drawer__foot">
        <button class="reload-btn" on:click={closeTemplate}>Cancel</button>
        <button class="save-btn" on:click={saveTemplate} disabled={savingTemplate}>
          {savingTemplate ? 'Saving…' : '💾 Save template'}
        </button>
      </footer>
    </div>
  </div>
{/if}

<style lang="scss">
  /* Cohesive with the IRP dashboard admin surfaces + global style bible:
     teal accent (--color-highlight-2 / #02b5bb), Jost body font, slate neutrals. */
  .automation-view {
    padding: 2.5rem 2rem;
    max-width: 1140px;
    margin: 0 auto;
    background: var(--irp-bg, #fafbfc);
    color: var(--color-foreground, #181818);
    font-family: var(--font-paragraph, 'Jost'), system-ui, sans-serif;
  }

  /* ── Header ─────────────────────────────────────────────────────────── */
  .av-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 1.25rem;
    margin-bottom: 1.5rem;
  }
  .av-title {
    font-size: 1.55rem;
    font-weight: 800;
    color: #0f172a;
    margin: 0 0 0.3rem;
    letter-spacing: -0.025em;
  }
  .av-subtitle {
    margin: 0;
    color: #64748b;
    font-size: 0.82rem;
    max-width: 680px;
    line-height: 1.5;
  }

  /* ── Tabs (mirrors .admin-tabs) ─────────────────────────────────────── */
  .av-tabs {
    display: flex;
    gap: 0;
    margin-bottom: 1.5rem;
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    padding: 4px;
    width: fit-content;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
  }
  .av-tab {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.46rem 1.1rem;
    background: none;
    border: none;
    border-radius: 7px;
    color: #64748b;
    font-size: 0.84rem;
    font-weight: 600;
    letter-spacing: 0.01em;
    cursor: pointer;
    font-family: inherit;
    transition: color 0.14s cubic-bezier(0.4, 0, 0.2, 1), background 0.14s cubic-bezier(0.4, 0, 0.2, 1);
  }
  .av-tab:hover { background: #f1f5f9; color: #475569; }
  .av-tab--active {
    background: linear-gradient(135deg, rgba(2, 181, 187, 0.12) 0%, rgba(2, 181, 187, 0.06) 100%);
    color: #02999e;
    border: 1px solid rgba(2, 181, 187, 0.20);
    box-shadow: 0 1px 3px rgba(2, 181, 187, 0.12);
  }

  /* ── Cards ──────────────────────────────────────────────────────────── */
  .av-card {
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 16px;
    padding: 1.35rem 1.5rem;
    margin-bottom: 1.1rem;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06), 0 8px 32px rgba(0, 0, 0, 0.04);
    overflow: auto;
  }
  .av-card-title {
    margin: 0 0 0.9rem;
    font-size: 0.95rem;
    font-weight: 700;
    color: #0f172a;
    letter-spacing: -0.01em;
  }
  .av-loading,
  .av-empty {
    text-align: center;
    color: #94a3b8;
    padding: 2.75rem;
    font-size: 0.9rem;
    letter-spacing: 0.02em;
  }

  /* ── Add-rule grid ──────────────────────────────────────────────────── */
  .av-add-grid {
    display: grid;
    grid-template-columns: repeat(5, 1fr) auto;
    gap: 0.7rem;
    align-items: end;
  }

  /* ── Fields ─────────────────────────────────────────────────────────── */
  .av-field {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
  }
  .av-field > span {
    font-size: 0.68rem;
    font-weight: 800;
    color: #94a3b8;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }
  .av-field code {
    background: #f1f5f9;
    padding: 0 0.3em;
    border-radius: 4px;
    font-size: 0.9em;
    text-transform: none;
  }
  .av-field select,
  .av-field input {
    padding: 0.5rem 0.6rem;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    font-size: 0.85rem;
    font-family: inherit;
    color: #0f172a;
    background: #f8fafc;
    transition: border-color 0.14s, box-shadow 0.14s;
  }
  .av-field select:focus,
  .av-field input:focus {

    outline: none;
    border-color: rgba(2, 181, 187, 0.48);
    box-shadow: 0 0 0 3px rgba(2, 181, 187, 0.10);
    background: #fff;
  }

  /* ── Table ──────────────────────────────────────────────────────────── */
  .av-table-wrap {
    overflow-x: auto;
    border-radius: 10px;
    border: 1px solid #e2e8f0;
  }
  .av-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.84rem;
  }
  .av-table thead tr { background: #f8fafc; }
  .av-table th {
    text-align: left;
    color: #94a3b8;
    font-size: 0.68rem;
    text-transform: uppercase;
    letter-spacing: 0.09em;
    font-weight: 700;
    padding: 0.55rem 0.7rem;
    border-bottom: 1px solid #e2e8f0;
    white-space: nowrap;
  }
  .av-table td {
    padding: 0.5rem 0.7rem;
    border-bottom: 1px solid #f1f5f9;
    vertical-align: middle;
    color: #334155;
  }
  .av-table tbody tr:last-child td { border-bottom: none; }
  .av-table tr:hover { background: #fafbff; }
  .av-row--off td { opacity: 0.5; }
  .av-table select,
  .av-table input {
    padding: 0.35rem 0.45rem;
    border: 1px solid #e2e8f0;
    border-radius: 7px;
    font-size: 0.8rem;
    font-family: inherit;
    color: #0f172a;
    background: #fff;
  }
  .av-table select:focus,
  .av-table input:focus {
    outline: none;
    border-color: rgba(2, 181, 187, 0.48);
    box-shadow: 0 0 0 2px rgba(2, 181, 187, 0.12);
  }
  .av-email-cell { font-weight: 600; color: #0f172a; }
  .av-delay-cell { white-space: nowrap; }
  .av-delay { width: 3.2rem; }
  .av-unit { color: #94a3b8; font-size: 0.75rem; margin-left: 0.25rem; }
  .av-type { color: #94a3b8; font-size: 0.7rem; margin-top: 0.1rem; }
  .av-subject { color: #475569; font-size: 0.82rem; }

  /* ── Recipients matrix ──────────────────────────────────────────────── */
  .av-recip-table th.av-recip-col,
  .av-recip-table td.av-recip-cell { text-overflow: ellipsis; width: 100%; text-align: center; white-space: nowrap; }
  .av-recip-col { max-width: 120px; }
  .av-recip-check {
    display: inline-flex; align-items: center; justify-content: center; cursor: pointer;
  }
  .av-recip-check input {
    width: 17px; height: 17px; cursor: pointer;
    accent-color: #c62426; /* red = "excluded" — matches the destructive palette */
  }
  .av-recip-check input:disabled { cursor: wait; opacity: 0.55; }


  /* ── Badges ─────────────────────────────────────────────────────────── */
  .av-badge {
    display: inline-block;
    background: #f1f5f9;
    color: #64748b;
    border: 1px solid #e2e8f0;
    border-radius: 999px;
    padding: 0.08rem 0.55rem;
    font-size: 0.63rem;
    font-weight: 800;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    margin-left: 0.35rem;
  }
  .av-badge--override { background: #fffbeb; color: #d97706; border-color: #fde68a; }
  .av-badge--custom { background: rgba(2, 181, 187, 0.08); color: #02999e; border-color: rgba(2, 181, 187, 0.25); }

  /* ── Switch (teal on-state, on-brand) ───────────────────────────────── */
  .av-switch {
    width: 40px;
    height: 23px;
    border-radius: 999px;
    background: #cbd5e1;
    border: none;
    position: relative;
    cursor: pointer;
    padding: 0;
    transition: background 0.16s cubic-bezier(0.4, 0, 0.2, 1);
  }
  .av-switch__knob {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 19px;
    height: 19px;
    border-radius: 50%;
    background: #fff;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
    transition: left 0.16s cubic-bezier(0.4, 0, 0.2, 1);
  }
  .av-switch--on {
    background: var(--color-highlight-2, #02b5bb);
    box-shadow: 0 0 0 1px rgba(2, 181, 187, 0.25);
  }
  .av-switch--on .av-switch__knob { left: 19px; }
  .av-switch:disabled { opacity: 0.55; cursor: default; }

  /* ── Remove button (mirrors .remove-btn) ────────────────────────────── */
  .remove-btn {
    width: 27px;
    height: 27px;
    border-radius: 6px;
    border: 1px solid rgba(198, 36, 38, 0.2);
    background: rgba(198, 36, 38, 0.05);
    color: #c62426;
    font-size: 0.72rem;
    font-weight: 800;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition: background 0.14s, border-color 0.14s, transform 0.14s;
  }
  .remove-btn:hover:not(:disabled) {
    background: rgba(198, 36, 38, 0.12);
    border-color: rgba(198, 36, 38, 0.35);
    transform: scale(1.08);
  }
  .remove-btn:disabled { opacity: 0.4; cursor: default; }

  /* ── Link buttons ───────────────────────────────────────────────────── */
  .av-actions { white-space: nowrap; }
  .av-link {
    background: none;
    border: none;
    color: #02999e;
    cursor: pointer;
    font-size: 0.82rem;
    font-weight: 700;
    font-family: inherit;
    margin-right: 0.6rem;
    padding: 0;
    transition: color 0.14s;
  }
  .av-link:hover { text-decoration: underline; }
  .av-link--danger { color: #c62426; }

  /* ── Shared buttons (mirror .save-btn / .reload-btn from AdminView) ─── */
  .save-btn {
    padding: 0.55rem 1.3rem;
    background: linear-gradient(135deg, #02b5bb 0%, #02999e 100%);
    border: none;
    border-radius: 10px;
    color: #fff;
    font-size: 0.85rem;
    font-weight: 700;
    letter-spacing: 0.02em;
    cursor: pointer;
    font-family: inherit;
    white-space: nowrap;
    box-shadow: 0 2px 8px rgba(2, 181, 187, 0.30);
    transition: filter 0.14s, transform 0.14s, box-shadow 0.14s;
  }
  .save-btn:hover:not(:disabled) {
    filter: brightness(1.06);
    transform: translateY(-1px);
    box-shadow: 0 4px 16px rgba(2, 181, 187, 0.40);
  }
  .save-btn:active:not(:disabled) { transform: translateY(0); }
  .save-btn:disabled { opacity: 0.55; cursor: wait; }

  .reload-btn {
    padding: 0.5rem 1rem;
    background: #f1f5f9;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    color: #475569;
    font-size: 0.82rem;
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
    white-space: nowrap;
    flex-shrink: 0;
    transition: background 0.14s, color 0.14s, border-color 0.14s;
  }
  .reload-btn:hover:not(:disabled) { background: #e2e8f0; color: #1e293b; }
  .reload-btn:disabled { opacity: 0.4; cursor: default; }

  /* ── Status messages (mirror .save-msg) ─────────────────────────────── */
  .av-msg {
    padding: 0.6rem 1rem;
    border-radius: 8px;
    font-size: 0.82rem;
    font-weight: 600;
    margin-bottom: 1rem;
  }
  .av-msg--sm { margin-top: 0.7rem; margin-bottom: 0; }
  .av-msg--error {
    background: #fef2f2;
    color: #dc2626;
    border: 1px solid #fecaca;
  }

  /* ── Drawer ─────────────────────────────────────────────────────────── */
  .av-drawer-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(15, 23, 42, 0.45);
    z-index: 1000;
    display: flex;
    justify-content: flex-end;
    animation: av-fade 0.18s ease;
  }
  @keyframes av-fade { from { opacity: 0; } to { opacity: 1; } }
  .av-drawer {
    width: min(940px, 94vw);
    height: 100%;
    background: #ffffff;
    display: flex;
    flex-direction: column;
    box-shadow: -8px 0 40px rgba(0, 0, 0, 0.18);
    font-family: var(--font-paragraph, 'Jost'), system-ui, sans-serif;
    animation: av-slide 0.22s cubic-bezier(0.34, 1.56, 0.64, 1);
  }
  @keyframes av-slide { from { transform: translateX(24px); opacity: 0.6; } to { transform: translateX(0); opacity: 1; } }
  .av-drawer__head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.1rem 1.4rem;
    border-bottom: 1px solid #e2e8f0;
  }
  .av-drawer__head h3 { margin: 0; font-size: 1rem; font-weight: 700; color: #0f172a; }
  .av-close {
    background: none;
    border: none;
    font-size: 1.05rem;
    cursor: pointer;
    color: #64748b;
    line-height: 1;
    transition: color 0.14s;
  }
  .av-close:hover { color: #0f172a; }
  .av-drawer__body {
    flex: 1;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1.1rem;
    padding: 1.4rem;
    overflow: auto;
  }
  .av-drawer__foot {
    display: flex;
    justify-content: flex-end;
    gap: 0.7rem;
    padding: 1.1rem 1.4rem;
    border-top: 1px solid #e2e8f0;
  }
  .av-edit-col {
    display: flex;
    flex-direction: column;
    gap: 0.85rem;
  }
  .av-edit-col .av-field--grow { flex: 1; }

  .av-preview-col {
    display: flex;
    flex-direction: column;
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    overflow: hidden;
    background: #fff;
  }
  .av-preview-head {
    background: #f8fafc;
    padding: 0.55rem 0.9rem;
    font-size: 0.72rem;
    font-weight: 800;
    color: #94a3b8;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    border-bottom: 1px solid #e2e8f0;
  }
  .av-preview-frame {
    flex: 1;
    overflow: auto;
    padding: 1.1rem;
    background: #fff;
  }
  .av-spin { color: var(--color-highlight-2, #02b5bb); }

  /* ── Stage configuration extras ─────────────────────────────────────── */
  .av-add-grid--stage { grid-template-columns: 2fr 2fr auto; }
  .av-order-cell { white-space: nowrap; display: flex; gap: 0.25rem; }
  .av-move {
    width: 22px; height: 22px; border-radius: 6px;
    border: 1px solid #e2e8f0; background: #f8fafc; color: #475569;
    font-size: 0.6rem; cursor: pointer; line-height: 1;
    display: inline-flex; align-items: center; justify-content: center;
    transition: background 0.14s, border-color 0.14s;
  }
  .av-move:hover:not(:disabled) { background: #e2e8f0; border-color: #cbd5e1; }
  .av-move:disabled { opacity: 0.3; cursor: default; }
  .av-stage-emoji { margin-right: 0.4rem; }
  .av-stage-name {
    width: 200px; max-width: 100%;
    padding: 0.35rem 0.45rem; border: 1px solid #e2e8f0; border-radius: 7px;
    font-size: 0.84rem; font-family: inherit; color: #0f172a; background: #fff;
  }
  .av-stage-name:focus {
    outline: none; border-color: rgba(2, 181, 187, 0.48);
    box-shadow: 0 0 0 2px rgba(2, 181, 187, 0.12);
  }

  /* ── Unified stage card (config header + its automation rules) ───────── */
  .av-stage-card { padding: 1.1rem 1.25rem; }
  .av-stage-card--orphan { border-color: #fde68a; background: #fffdf5; }
  .av-stage-head { display: flex; align-items: center; gap: 0.7rem; flex-wrap: wrap; }
  .av-stage-idwrap { display: flex; flex-direction: column; gap: 0.2rem; min-width: 180px; }
  .av-stage-id {
    font-size: 0.65rem; color: #94a3b8; background: #f1f5f9;
    border-radius: 4px; padding: 0.05rem 0.4rem; width: fit-content;
    font-family: 'SF Mono', 'Fira Code', ui-monospace, monospace;
  }
  .av-stage-controls { display: flex; align-items: center; gap: 0.9rem; margin-left: auto; flex-wrap: wrap; }
  .av-inline-field { display: flex; align-items: center; gap: 0.35rem; }
  .av-inline-field > span {
    font-size: 0.62rem; font-weight: 800; color: #94a3b8;
    text-transform: uppercase; letter-spacing: 0.07em;
  }
  .av-inline-field .av-delay {
    padding: 0.3rem 0.4rem; border: 1px solid #e2e8f0; border-radius: 7px;
    font-size: 0.8rem; font-family: inherit; color: #0f172a; background: #fff;
  }
  .av-stage-rules { margin-top: 1rem; border-top: 1px dashed #e2e8f0; padding-top: 0.9rem; }
  .av-stage-norules { color: #94a3b8; font-size: 0.8rem; padding: 0.3rem 0.1rem; font-style: italic; }
  .av-add-rule {
    display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;
    margin-top: 0.8rem; padding: 0.6rem 0.7rem;
    background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 10px;
  }
  .av-add-rule__label {
    font-size: 0.72rem; font-weight: 800; color: #02999e;
    text-transform: uppercase; letter-spacing: 0.05em; margin-right: 0.2rem;
  }
  .av-add-rule__field,
  .av-add-rule__delay {
    padding: 0.35rem 0.45rem; border: 1px solid #e2e8f0; border-radius: 7px;
    font-size: 0.8rem; font-family: inherit; color: #0f172a; background: #fff;
  }
  .av-add-rule__delay { width: 3.2rem; }
  .av-add-rule__field:focus,
  .av-add-rule__delay:focus {
    outline: none; border-color: rgba(2, 181, 187, 0.48);
    box-shadow: 0 0 0 2px rgba(2, 181, 187, 0.12);
  }
  .av-add-rule__btn {
    padding: 0.4rem 0.9rem; background: linear-gradient(135deg, #02b5bb 0%, #02999e 100%);
    border: none; border-radius: 8px; color: #fff; font-size: 0.8rem;
    font-weight: 700; cursor: pointer; font-family: inherit;
    transition: filter 0.14s, transform 0.14s;
  }
  .av-add-rule__btn:hover:not(:disabled) { filter: brightness(1.06); transform: translateY(-1px); }
  .av-add-rule__btn:disabled { opacity: 0.55; cursor: wait; }
  .av-orphan-group { margin-bottom: 0.7rem; }
  .av-orphan-rule {
    display: flex; align-items: center; justify-content: space-between;
    gap: 0.7rem; padding: 0.35rem 0.2rem; border-bottom: 1px solid #f1f5f9;
    font-size: 0.83rem; color: #334155;
  }

  /* ── Modals (delete-with-migration + migrate-all) ───────────────────── */
  .av-modal-backdrop {
    position: fixed; inset: 0;
    background: rgba(15, 23, 42, 0.45);
    z-index: 1100;
    display: flex; align-items: center; justify-content: center;
    animation: av-fade 0.18s ease;
  }
  .av-modal {
    width: min(460px, 94vw);
    background: #fff; border-radius: 16px;
    box-shadow: 0 24px 64px rgba(0, 0, 0, 0.28);
    display: flex; flex-direction: column;
    font-family: var(--font-paragraph, 'Jost'), system-ui, sans-serif;
    animation: av-fade 0.18s ease;
  }
  .av-modal__body { padding: 1.2rem 1.4rem; display: flex; flex-direction: column; gap: 0.8rem; }
  .av-modal-note { margin: 0; font-size: 0.86rem; color: #334155; line-height: 1.5; }
  .remove-btn-wide {
    padding: 0.55rem 1.2rem; border-radius: 10px;
    border: 1px solid rgba(198, 36, 38, 0.25);
    background: #c62426; color: #fff;
    font-size: 0.85rem; font-weight: 700; cursor: pointer; font-family: inherit;
    transition: filter 0.14s, transform 0.14s;
  }
  .remove-btn-wide:hover:not(:disabled) { filter: brightness(1.06); transform: translateY(-1px); }
  .remove-btn-wide:disabled { opacity: 0.55; cursor: wait; }

  /* ── Responsive ─────────────────────────────────────────────────────── */
  @media (max-width: 900px) {
    .av-add-grid { grid-template-columns: 1fr 1fr; }
    .av-drawer__body { grid-template-columns: 1fr; }
  }
</style>
