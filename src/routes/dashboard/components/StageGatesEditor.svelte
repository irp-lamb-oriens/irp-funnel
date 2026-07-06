<script lang="ts">
  /**
   * StageGatesEditor.svelte — Configure generic, chainable STAGE-GATE rules.
   *
   * A Stage Gate blocks moving a client INTO a target stage until a chain of
   * conditions is met (numeric or otherwise), chained with all/any logic. This
   * is ADDITIVE to the email-automation rules — it never touches them. Lives in
   * Automations → Stages, below the stage cards.
   *
   * Each rule: targetStage + logic (all/any) + conditions[] (fact op value) +
   * a block message shown to the operator when a move is refused.
   */
  import { onMount } from 'svelte';
  import {
    STAGE_LABELS,
    fetchStageGates,
    saveStageGate,
    patchStageGate,
    deleteStageGate,
    fetchStageGateMeta,
    GATE_OPERATOR_LABELS,
    type StageGateRule,
    type GateCondition,
    type GateFact,
    type StageGateMeta,
    type GateOperator,
    type GateLogic,
  } from '../store.ts';

  /** Active stage ids in board order (passed by the parent so options match the board). */
  export let stageIds: string[] = [];

  let rules: StageGateRule[] = [];
  let meta: StageGateMeta | null = null;
  let loading = true;
  let error = '';
  let busyId = '';

  // ── New-rule draft ─────────────────────────────────────────────────────────
  let draftOpen = false;
  let draftStage = '';
  let draftLogic: GateLogic = 'all';
  let draftLabel = '';
  let draftMessage = '';
  let draftConditions: GateCondition[] = [];

  $: valuelessOps = new Set(meta?.valuelessOperators ?? []);
  $: stageOptions = (stageIds.length ? stageIds : Object.keys(STAGE_LABELS));
  $: rulesByStage = rules.reduce<Record<string, StageGateRule[]>>((acc, r) => {
    (acc[r.targetStage] ||= []).push(r);
    return acc;
  }, {});

  function stageLabel(id: string): string { return STAGE_LABELS[id] || id; }

  /** Merged fact options: curated facts + a `field:` free-path escape hatch. */
  $: factOptions = [
    ...(meta?.facts ?? []).map((f: GateFact) => ({ value: f.key, label: f.label, hint: f.hint })),
    { value: 'field:', label: 'Custom field path (field:…)', hint: 'Any consultation field, e.g. field:originCity' },
  ];

  async function load() {
    loading = true;
    error = '';
    try {
      const [r, m] = await Promise.all([fetchStageGates(), fetchStageGateMeta()]);
      rules = r;
      meta = m;
    } catch (e: any) {
      error = e?.message ?? 'Failed to load stage gates.';
    } finally {
      loading = false;
    }
  }
  onMount(load);

  function newCondition(): GateCondition {
    const firstFact = meta?.facts?.[0]?.key ?? 'pricing_requests_sent';
    return { fact: firstFact, operator: 'gte', value: 1 };
  }

  function openDraft(targetStage = '') {
    draftOpen = true;
    draftStage = targetStage || stageOptions[0] || '';
    draftLogic = 'all';
    draftLabel = '';
    draftMessage = '';
    draftConditions = [newCondition()];
  }
  function cancelDraft() { draftOpen = false; draftConditions = []; }

  function addDraftCondition() { draftConditions = [...draftConditions, newCondition()]; }
  function removeDraftCondition(i: number) {
    draftConditions = draftConditions.filter((_, idx) => idx !== i);
  }

  /** When a condition switches to a "field:" fact, keep the typed path suffix. */
  function onFactChange(i: number, value: string) {
    const c = draftConditions[i];
    draftConditions[i] = { ...c, fact: value === 'field:' ? 'field:' : value };
    draftConditions = [...draftConditions];
  }
  function isFieldFact(fact: string): boolean { return fact.startsWith('field:'); }

  async function saveDraft() {
    if (!draftStage) { error = 'Choose a target stage.'; return; }
    const conditions = draftConditions
      .map((c) => ({
        fact: c.fact.trim(),
        operator: c.operator,
        ...(valuelessOps.has(c.operator) ? {} : { value: c.value ?? '' }),
      }))
      .filter((c) => c.fact && c.fact !== 'field:');
    if (!conditions.length) { error = 'Add at least one complete condition.'; return; }
    busyId = 'new';
    error = '';
    try {
      const saved = await saveStageGate({
        targetStage: draftStage,
        logic: draftLogic,
        conditions,
        message: draftMessage.trim(),
        label: draftLabel.trim() || `Gate for ${stageLabel(draftStage)}`,
        enabled: true,
      });
      rules = [...rules, saved];
      cancelDraft();
    } catch (e: any) {
      error = e?.message ?? 'Failed to save the gate.';
    } finally {
      busyId = '';
    }
  }

  async function toggleRule(rule: StageGateRule) {
    busyId = rule.id;
    try {
      const updated = await patchStageGate(rule.id, { enabled: !rule.enabled });
      rules = rules.map((r) => (r.id === updated.id ? updated : r));
    } catch (e: any) {
      error = e?.message ?? 'Failed to update the gate.';
    } finally {
      busyId = '';
    }
  }

  async function removeRule(rule: StageGateRule) {
    if (!confirm(`Delete the gate "${rule.label}"? This cannot be undone.`)) return;
    busyId = rule.id;
    try {
      await deleteStageGate(rule.id);
      rules = rules.filter((r) => r.id !== rule.id);
    } catch (e: any) {
      error = e?.message ?? 'Failed to delete the gate.';
    } finally {
      busyId = '';
    }
  }

  function describeCondition(c: GateCondition): string {
    const factLabel = isFieldFact(c.fact)
      ? c.fact.slice('field:'.length)
      : (meta?.facts.find((f) => f.key === c.fact)?.label ?? c.fact);
    const opLabel = GATE_OPERATOR_LABELS[c.operator as GateOperator] ?? c.operator;
    return valuelessOps.has(c.operator)
      ? `${factLabel} ${opLabel}`
      : `${factLabel} ${opLabel} ${c.value ?? ''}`;
  }
</script>

<section class="sg">
  <div class="sg__head">
    <div>
      <h3 class="sg__title">🚦 Move-in gates</h3>
      <p class="sg__sub">
        Block moving a client INTO a stage until conditions are met (e.g. a pricing request
        has been sent). These run alongside — never replace — the email automations above.
      </p>
    </div>
    {#if !draftOpen}
      <button class="sg__add" on:click={() => openDraft()} disabled={loading}>+ New gate</button>
    {/if}
  </div>

  {#if error}<div class="sg__err">{error}</div>{/if}
  {#if loading}
    <div class="sg__loading">Loading gates…</div>
  {/if}

  <!-- ── New gate draft ──────────────────────────────────────────────────── -->
  {#if draftOpen}
    <div class="sg__draft">
      <div class="sg__draft-grid">
        <label class="sg__field">
          <span>Target stage (block moves INTO)</span>
          <select bind:value={draftStage}>
            {#each stageOptions as s}<option value={s}>{stageLabel(s)}</option>{/each}
          </select>
        </label>
        <label class="sg__field">
          <span>Label</span>
          <input type="text" bind:value={draftLabel} placeholder="e.g. Requires a sent pricing request" />
        </label>
        <label class="sg__field">
          <span>Chain logic</span>
          <select bind:value={draftLogic}>
            <option value="all">ALL conditions must pass (AND)</option>
            <option value="any">ANY condition passes (OR)</option>
          </select>
        </label>
      </div>

      <div class="sg__conds">
        {#each draftConditions as c, i (i)}
          <div class="sg__cond">
            <select class="sg__cond-fact" value={isFieldFact(c.fact) ? 'field:' : c.fact} on:change={(e) => onFactChange(i, e.currentTarget.value)}>
              {#each factOptions as f}<option value={f.value}>{f.label}</option>{/each}
            </select>
            {#if isFieldFact(c.fact)}
              <input
                class="sg__cond-path"
                type="text"
                value={c.fact.slice('field:'.length)}
                placeholder="field path (e.g. originCity)"
                on:input={(e) => { draftConditions[i] = { ...c, fact: 'field:' + e.currentTarget.value.trim() }; draftConditions = [...draftConditions]; }}
              />
            {/if}
            <select class="sg__cond-op" bind:value={c.operator}>
              {#each (meta?.operators ?? []) as op}<option value={op}>{GATE_OPERATOR_LABELS[op] ?? op}</option>{/each}
            </select>
            {#if !valuelessOps.has(c.operator)}
              <input class="sg__cond-val" type="text" bind:value={c.value} placeholder="value" />
            {/if}
            <button class="sg__cond-remove" title="Remove condition" on:click={() => removeDraftCondition(i)} disabled={draftConditions.length === 1}>✕</button>
          </div>
        {/each}
        <button class="sg__cond-add" on:click={addDraftCondition}>+ Add condition</button>
      </div>

      <label class="sg__field">
        <span>Block message (shown to the operator)</span>
        <input type="text" bind:value={draftMessage} placeholder="e.g. Send a pricing request before quoting this client." />
      </label>

      <div class="sg__draft-foot">
        <button class="sg__cancel" on:click={cancelDraft} disabled={busyId === 'new'}>Cancel</button>
        <button class="sg__save" on:click={saveDraft} disabled={busyId === 'new'}>{busyId === 'new' ? 'Saving…' : 'Save gate'}</button>
      </div>
    </div>
  {/if}

  <!-- ── Existing gates, grouped by stage ────────────────────────────────── -->
  {#if !loading && rules.length === 0 && !draftOpen}
    <div class="sg__empty">No move-in gates yet. Moves are never blocked until you add one.</div>
  {/if}

  {#each Object.keys(rulesByStage) as stageId (stageId)}
    <div class="sg__group">
      <div class="sg__group-head">→ {stageLabel(stageId)}</div>
      {#each rulesByStage[stageId] as rule (rule.id)}
        <div class="sg__rule" class:sg__rule--off={!rule.enabled}>
          <div class="sg__rule-main">
            <span class="sg__rule-label">{rule.label}</span>
            <span class="sg__rule-logic">{rule.logic === 'any' ? 'ANY' : 'ALL'}</span>
          </div>
          <ul class="sg__rule-conds">
            {#each rule.conditions as c}<li>{describeCondition(c)}</li>{/each}
          </ul>
          {#if rule.message}<p class="sg__rule-msg">“{rule.message}”</p>{/if}
          <div class="sg__rule-actions">
            <button class="sg__switch" class:sg__switch--on={rule.enabled} on:click={() => toggleRule(rule)} disabled={busyId === rule.id} title={rule.enabled ? 'Enabled — click to disable' : 'Disabled — click to enable'}>
              <span class="sg__switch-knob"></span>
            </button>
            <button class="sg__del" on:click={() => removeRule(rule)} disabled={busyId === rule.id} title="Delete gate">✕</button>
          </div>
        </div>
      {/each}
    </div>
  {/each}
</section>

<style lang="scss">
  .sg {
    font-family: var(--font-paragraph, 'Jost'), system-ui, sans-serif;
    background: #fff; border: 1px solid #e2e8f0; border-radius: 16px;
    padding: 1.35rem 1.5rem; margin-top: 1.1rem;
    box-shadow: 0 1px 3px rgba(0,0,0,0.06), 0 8px 32px rgba(0,0,0,0.04);
  }
  .sg__head { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; }
  .sg__title { margin: 0 0 0.2rem; font-size: 0.98rem; font-weight: 800; color: #0f172a; }
  .sg__sub { margin: 0; color: #64748b; font-size: 0.78rem; line-height: 1.5; max-width: 620px; }
  .sg__add {
    background: linear-gradient(135deg, #02b5bb, #0d9488); color: #fff; border: none;
    border-radius: 10px; padding: 0.5rem 0.95rem; font-weight: 700; font-size: 0.82rem;
    cursor: pointer; white-space: nowrap; font-family: inherit;
  }
  .sg__add:hover:not(:disabled) { filter: brightness(1.07); }
  .sg__add:disabled { opacity: 0.6; cursor: default; }
  .sg__err { margin: 0.8rem 0 0; color: #b91c1c; font-size: 0.82rem; }
  .sg__loading, .sg__empty { color: #94a3b8; font-size: 0.85rem; padding: 0.9rem 0; }

  .sg__draft { border: 1px solid rgba(2,181,187,0.25); border-radius: 14px; padding: 1rem; margin: 1rem 0; background: #fbfefe; }
  .sg__draft-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.75rem; margin-bottom: 0.8rem; }
  @media (max-width: 720px) { .sg__draft-grid { grid-template-columns: 1fr; } }
  .sg__field { display: flex; flex-direction: column; gap: 0.3rem; margin-bottom: 0.6rem; }
  .sg__field > span { font-size: 0.68rem; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.06em; }
  .sg__field input, .sg__field select {
    border: 1px solid #e2e8f0; border-radius: 9px; padding: 0.45rem 0.6rem; font-size: 0.84rem;
    font-family: inherit; color: #0f172a; background: #fff;
  }
  .sg__field input:focus, .sg__field select:focus { outline: none; border-color: #02b5bb; box-shadow: 0 0 0 3px rgba(2,181,187,0.12); }

  .sg__conds { display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 0.7rem; }
  .sg__cond { display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap; }
  .sg__cond select, .sg__cond input {
    border: 1px solid #e2e8f0; border-radius: 8px; padding: 0.4rem 0.55rem; font-size: 0.82rem;
    font-family: inherit; color: #0f172a; background: #fff;
  }
  .sg__cond-fact { flex: 1; min-width: 150px; }
  .sg__cond-path { flex: 1; min-width: 130px; }
  .sg__cond-op { min-width: 130px; }
  .sg__cond-val { width: 110px; }
  .sg__cond-remove {
    background: none; border: 1px solid #e2e8f0; color: #94a3b8; border-radius: 7px;
    width: 28px; height: 28px; cursor: pointer; flex-shrink: 0;
  }
  .sg__cond-remove:hover:not(:disabled) { background: #fee2e2; color: #b91c1c; border-color: #fecaca; }
  .sg__cond-remove:disabled { opacity: 0.4; cursor: default; }
  .sg__cond-add {
    align-self: flex-start; background: rgba(2,181,187,0.08); color: #0d9488;
    border: 1px dashed rgba(2,181,187,0.4); border-radius: 8px; padding: 0.4rem 0.8rem;
    font-weight: 700; font-size: 0.78rem; cursor: pointer; font-family: inherit;
  }
  .sg__cond-add:hover { background: rgba(2,181,187,0.14); }

  .sg__draft-foot { display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 0.6rem; }
  .sg__cancel { background: none; border: 1px solid #e2e8f0; color: #64748b; border-radius: 9px; padding: 0.45rem 0.9rem; font-weight: 600; font-size: 0.82rem; cursor: pointer; font-family: inherit; }
  .sg__cancel:hover:not(:disabled) { background: #f1f5f9; }
  .sg__save { background: linear-gradient(135deg, #02b5bb, #0d9488); color: #fff; border: none; border-radius: 9px; padding: 0.45rem 1.1rem; font-weight: 800; font-size: 0.82rem; cursor: pointer; font-family: inherit; }
  .sg__save:hover:not(:disabled) { filter: brightness(1.07); }
  .sg__save:disabled, .sg__cancel:disabled { opacity: 0.6; cursor: default; }

  .sg__group { margin-top: 1rem; }
  .sg__group-head { font-size: 0.8rem; font-weight: 800; color: #0d9488; margin-bottom: 0.4rem; }
  .sg__rule { border: 1px solid #e2e8f0; border-radius: 12px; padding: 0.7rem 0.9rem; margin-bottom: 0.5rem; position: relative; background: #fff; }
  .sg__rule--off { opacity: 0.55; }
  .sg__rule-main { display: flex; align-items: center; gap: 0.5rem; }
  .sg__rule-label { font-weight: 700; color: #0f172a; font-size: 0.85rem; }
  .sg__rule-logic { font-size: 0.64rem; font-weight: 800; color: #7c3aed; background: rgba(124,58,237,0.09); border: 1px solid rgba(124,58,237,0.2); border-radius: 999px; padding: 1px 8px; }
  .sg__rule-conds { margin: 0.4rem 0 0; padding-left: 1.1rem; color: #475569; font-size: 0.8rem; }
  .sg__rule-conds li { margin: 0.1rem 0; }
  .sg__rule-msg { margin: 0.4rem 0 0; color: #94a3b8; font-size: 0.78rem; font-style: italic; }
  .sg__rule-actions { position: absolute; top: 0.65rem; right: 0.7rem; display: flex; align-items: center; gap: 0.5rem; }
  .sg__del { background: none; border: none; color: #94a3b8; cursor: pointer; font-size: 0.85rem; padding: 2px 6px; border-radius: 6px; }
  .sg__del:hover:not(:disabled) { background: #fee2e2; color: #b91c1c; }

  .sg__switch { width: 34px; height: 19px; border-radius: 999px; border: none; background: #cbd5e1; position: relative; cursor: pointer; transition: background 0.15s; padding: 0; }
  .sg__switch--on { background: #02b5bb; }
  .sg__switch-knob { position: absolute; top: 2px; left: 2px; width: 15px; height: 15px; border-radius: 50%; background: #fff; transition: transform 0.15s; box-shadow: 0 1px 2px rgba(0,0,0,0.2); }
  .sg__switch--on .sg__switch-knob { transform: translateX(15px); }
  .sg__switch:disabled { opacity: 0.6; cursor: default; }
</style>
