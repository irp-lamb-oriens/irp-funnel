<script lang="ts">
  /**
   * Record a decision (admins). Stores the decision, the note and a snapshot
   * of the evidence. It does NOT change traffic: shipping is retiring the
   * other version in code (spec §6.10).
   */
  import { createEventDispatcher, onMount } from 'svelte';
  import { recordEvoDecision } from '../../../store.ts';
  import type { ExperimentAnalysis } from '../engine/experiment.ts';
  import { armLabel } from '../engine/join.ts';
  import { STATE_LABEL } from '../engine/rules.ts';
  import { evidence } from './words.ts';

  export let a: ExperimentAnalysis;
  const dispatch = createEventDispatcher<{ close: void; recorded: void }>();

  const OPTIONS = [
    { k: 'ship', l: 'Ship a version' },
    { k: 'keep_control', l: 'Keep the control' },
    { k: 'stop', l: 'Stop (no meaningful difference)' },
    { k: 'extend', l: 'Keep running' },
    { k: 'investigate', l: 'Investigate (data problem)' },
    { k: 'revert', l: 'Revert the last decision' },
  ] as const;
  const suggested: Record<string, (typeof OPTIONS)[number]['k']> = { ready: 'ship', keep_control: 'keep_control', no_difference: 'stop', data_problem: 'investigate', guardrail_hold: 'extend' };

  let decision: (typeof OPTIONS)[number]['k'] = suggested[a.decision.state] ?? 'extend';
  let variant = a.decision.leader ?? a.def.control;
  let note = '';
  let busy = false;
  let error = '';
  let dialog: HTMLDivElement;

  async function save() {
    busy = true;
    error = '';
    try {
      await recordEvoDecision({
        componentKey: a.def.componentKey,
        decision,
        variant: decision === 'ship' ? variant : undefined,
        note: note.trim(),
        snapshot: {
          state: a.decision.state,
          evidence: evidence(a),
          primary: a.primary.arms.map((r) => ({ arm: r.arm, n: r.n, x: r.x })),
          decidedAt: new Date(a.decidedAt).toISOString(),
        },
      });
      dispatch('recorded');
    } catch (err: any) {
      error = err?.message ?? 'Could not save the decision.';
    } finally {
      busy = false;
    }
  }
  onMount(() => dialog?.querySelector('select')?.focus());
</script>

<div class="evo-modal" role="presentation" on:click|self={() => dispatch('close')} on:keydown={(e) => e.key === 'Escape' && dispatch('close')}>
  <div class="evo-modal__box" role="dialog" aria-modal="true" aria-labelledby="evo-rec-h" bind:this={dialog}>
    <h3 id="evo-rec-h">Record a decision · {a.def.title}</h3>
    <p class="mh-hint">Current verdict: <b>{STATE_LABEL[a.decision.state]}</b>. {evidence(a)}</p>
    <label class="mh-control"><span class="mh-label">Decision</span>
      <select class="mh-input" bind:value={decision}>{#each OPTIONS as o}<option value={o.k}>{o.l}</option>{/each}</select>
    </label>
    {#if decision === 'ship'}
      <label class="mh-control"><span class="mh-label">Version to ship</span>
        <select class="mh-input" bind:value={variant}>{#each a.arms as k}<option value={k}>{armLabel(a.def, k)}</option>{/each}</select>
      </label>
      <p class="evo-modal__note">This records the decision. Traffic stays 50/50 until a developer retires the other version in the registry.</p>
    {/if}
    <label class="mh-control"><span class="mh-label">Note (why)</span>
      <textarea class="mh-input" rows="3" maxlength="1000" bind:value={note} placeholder="e.g. Urgent copy wins on clicks; leads unaffected."></textarea>
    </label>
    {#if error}<p class="mh-bad">{error}</p>{/if}
    <div class="evo-modal__btns">
      <button class="mh-btn" on:click={() => dispatch('close')}>Cancel</button>
      <button class="mh-btn mh-btn--primary" on:click={save} disabled={busy || !note.trim()}>{busy ? 'Saving…' : 'Record decision'}</button>
    </div>
  </div>
</div>
