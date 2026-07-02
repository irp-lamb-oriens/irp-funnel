<script lang="ts">
  import { onMount } from 'svelte';
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
    type AutomationMeta,
    type StageEmailRule,
    type EmailTemplateRow,
    type RuleCondition,
    type RuleMode,
  } from '../store.ts';

  // ── State ──────────────────────────────────────────────────────────────
  let meta: AutomationMeta | null = null;
  let rules: StageEmailRule[] = [];
  let templates: EmailTemplateRow[] = [];
  let loading = true;
  let error = '';
  let tab: 'rules' | 'templates' = 'rules';
  let busyId = ''; // id of the row currently saving (disables its controls)

  // New-rule draft
  let draft = {
    triggerStage: '',
    emailType: '',
    condition: 'always' as RuleCondition,
    mode: 'suggest' as RuleMode,
    delayHours: 0,
  };
  let addingRule = false;
  let addError = '';

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
      [meta, rules, templates] = await Promise.all([
        fetchAutomationMeta(),
        fetchAutomationRules(),
        fetchAutomationTemplates(),
      ]);
      if (meta.stages.length) draft.triggerStage = meta.stages[0];
      if (meta.emailTypes.length) draft.emailType = meta.emailTypes[0].value;
    } catch (e: any) {
      error = e?.message ?? 'Failed to load automation config.';
    } finally {
      loading = false;
    }
  }

  onMount(loadAll);

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

  async function addRule() {
    addError = '';
    if (!draft.triggerStage || !draft.emailType) {
      addError = 'Pick both a stage and an email type.';
      return;
    }
    addingRule = true;
    try {
      const saved = await saveAutomationRule({
        triggerStage: draft.triggerStage,
        emailType: draft.emailType,
        condition: draft.condition,
        mode: draft.mode,
        delayHours: Number(draft.delayHours) || 0,
        enabled: true,
      });
      // upsert into local list (replace if the id already existed)
      const idx = rules.findIndex((r) => r.id === saved.id);
      if (idx >= 0) rules[idx] = saved;
      else rules = [...rules, saved];
      rules = [...rules];
    } catch (e: any) {
      addError = e?.message ?? 'Failed to add rule.';
    } finally {
      addingRule = false;
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

  // Group rules by trigger stage for a tidy display
  $: rulesByStage = rules.reduce<Record<string, StageEmailRule[]>>((acc, r) => {
    (acc[r.triggerStage] ||= []).push(r);
    return acc;
  }, {});
  $: stageOrder = Object.keys(rulesByStage).sort((a, b) => stageLabel(a).localeCompare(stageLabel(b)));
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
    <button class="av-tab" class:av-tab--active={tab === 'rules'} on:click={() => (tab = 'rules')}>
      ⚙️ Stage rules
    </button>
    <button class="av-tab" class:av-tab--active={tab === 'templates'} on:click={() => (tab = 'templates')}>
      ✉️ Email templates
    </button>
  </div>

  {#if loading}
    <div class="av-loading">Loading automation config…</div>
  {:else if tab === 'rules'}
    <!-- ── Add rule ──────────────────────────────────────────────────── -->
    <section class="av-card av-add">
      <h3 class="av-card-title">Add a rule</h3>
      <div class="av-add-grid">
        <label class="av-field">
          <span>Stage</span>
          <select bind:value={draft.triggerStage}>
            {#each (meta?.stages ?? []) as s}
              <option value={s}>{stageLabel(s)}</option>
            {/each}
          </select>
        </label>
        <label class="av-field">
          <span>Email</span>
          <select bind:value={draft.emailType}>
            {#each (meta?.emailTypes ?? []) as e}
              <option value={e.value}>{e.label}</option>
            {/each}
          </select>
        </label>
        <label class="av-field">
          <span>Condition</span>
          <select bind:value={draft.condition}>
            {#each (meta?.conditions ?? []) as c}
              <option value={c}>{RULE_CONDITION_LABELS[c] ?? c}</option>
            {/each}
          </select>
        </label>
        <label class="av-field">
          <span>Mode</span>
          <select bind:value={draft.mode}>
            <option value="suggest">Suggest (you confirm)</option>
            <option value="auto">Auto-send</option>
          </select>
        </label>
        <label class="av-field">
          <span>Delay (h)</span>
          <input type="number" min="0" bind:value={draft.delayHours} />
        </label>
        <button class="save-btn" on:click={addRule} disabled={addingRule}>
          {addingRule ? 'Adding…' : '+ Add rule'}
        </button>
      </div>
      {#if addError}<div class="av-msg av-msg--error av-msg--sm">{addError}</div>{/if}
    </section>

    <!-- ── Rules list ────────────────────────────────────────────────── -->
    {#if rules.length === 0}
      <div class="av-empty">No rules configured yet.</div>
    {:else}
      {#each stageOrder as stage}
        <section class="av-card">
          <h3 class="av-card-title av-stage-title">{stageLabel(stage)}</h3>
          <div class="av-table-wrap">
            <table class="av-table">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Condition</th>
                  <th>Mode</th>
                  <th>Delay</th>
                  <th>On</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {#each rulesByStage[stage] as rule (rule.id)}
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
        </section>
      {/each}
    {/if}
  {:else}
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
  {/if}
</div>

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
          <label class="av-field av-field--grow">
            <span>Body (HTML — supports <code>{'{{field}}'}</code> placeholders)</span>
            <textarea bind:value={editBody} on:input={refreshPreview}></textarea>
          </label>
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
  }
  .av-card-title {
    margin: 0 0 0.9rem;
    font-size: 0.95rem;
    font-weight: 700;
    color: #0f172a;
    letter-spacing: -0.01em;
  }
  .av-stage-title {
    color: #02999e;
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
  }
  .av-stage-title::before {
    content: '';
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--color-highlight-2, #02b5bb);
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
  .av-field input,
  .av-field textarea {
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
  .av-field input:focus,
  .av-field textarea:focus {
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
  .av-edit-col textarea {
    flex: 1;
    min-height: 280px;
    font-family: 'SF Mono', 'Fira Code', ui-monospace, monospace;
    font-size: 0.8rem;
    line-height: 1.5;
    resize: vertical;
  }
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

  /* ── Responsive ─────────────────────────────────────────────────────── */
  @media (max-width: 900px) {
    .av-add-grid { grid-template-columns: 1fr 1fr; }
    .av-drawer__body { grid-template-columns: 1fr; }
  }
</style>
