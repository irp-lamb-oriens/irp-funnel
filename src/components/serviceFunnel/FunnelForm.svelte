<script lang="ts">
  /**
   * FunnelForm.svelte — the config-driven form for service funnels.
   *
   * Renders an ordered list of FunnelField components from a ServiceConfig's
   * fields, pre-filling every value from `initialValues` (derived from the
   * client's project) so the form only surfaces the fields that are still
   * missing. Conditional fields are evaluated via evaluateCondition against
   * the live draft state. Submission is delegated to the parent via
   * `onSubmit(values)` so persistence stays a single, swappable concern.
   */
  import FunnelField from './FunnelField.svelte';
  import {
    evaluateCondition,
    type ServiceFieldDef,
  } from '../../lib/serviceConfig.ts';

  export let fields: ServiceFieldDef[] = [];
  export let initialValues: Record<string, any> = {};
  export let ctaLabel: string = 'Submit';
  export let onSubmit: (values: Record<string, any>) => Promise<void> = async () => {};

  // Local draft state, seeded from initialValues and re-seeded when they change.
  let drafts: Record<string, any> = {};
  let seededSig = '';
  $: {
    const sig = fields.map((f) => `${f.id}:${JSON.stringify(initialValues[f.id] ?? '')}`).join('|');
    if (sig !== seededSig) {
      seededSig = sig;
      const next: Record<string, any> = {};
      for (const f of fields) next[f.id] = initialValues[f.id] ?? '';
      drafts = next;
    }
  }

  // Only render fields whose showWhen condition passes against current drafts.
  $: visibleFields = fields.filter((f) =>
    evaluateCondition(f.showWhen, drafts as Record<string, any>),
  );

  let saving = false;
  let errorMsg = '';

  function isFilled(f: ServiceFieldDef): boolean {
    if (!f.required) return true;
    const v = drafts[f.id];
    if (Array.isArray(v)) return v.length > 0;
    return v != null && String(v).trim() !== '';
  }

  $: canSubmit = visibleFields.every(isFilled);

  async function submit() {
    if (saving || !canSubmit) return;
    saving = true;
    errorMsg = '';
    try {
      await onSubmit({ ...drafts });
    } catch (e: any) {
      errorMsg = e?.message ?? 'Could not save your details.';
    } finally {
      saving = false;
    }
  }
</script>

<div class="fform">
  <div class="fform__fields">
    {#each visibleFields as f (f.id)}
      <div class="fform__field">
        <FunnelField
          field={f}
          value={drafts[f.id]}
          onChange={(v) => (drafts[f.id] = v)}
        />
      </div>
    {/each}
  </div>

  {#if errorMsg}
    <p class="fform__error">{errorMsg}</p>
  {/if}

  <div class="fform__actions">
    <button
      type="button"
      class="fform__submit"
      disabled={saving || !canSubmit}
      on:click={submit}
    >
      {saving ? 'Saving…' : ctaLabel}
    </button>
  </div>
</div>

<style lang="scss">
  .fform {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
    width: 100%;
  }

  .fform__fields {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .fform__field {
    width: 100%;
  }

  .fform__error {
    margin: 0;
    color: #dc2626;
    font-size: 0.85rem;
    font-weight: 600;
  }

  .fform__actions {
    display: flex;
    justify-content: flex-end;
  }

  .fform__submit {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0.75rem 1.5rem;
    border-radius: 12px;
    font-weight: 700;
    font-size: 0.92rem;
    font-family: inherit;
    cursor: pointer;
    color: #fff;
    background: linear-gradient(135deg, var(--color-highlight-2, #02b5bb) 0%, #02999e 100%);
    box-shadow: 0 14px 30px -12px rgba(2, 181, 187, 0.55);
    border: none;
    transition: filter 0.15s, transform 0.12s, opacity 0.15s;

    &:hover:not(:disabled) {
      filter: brightness(1.06);
      transform: translateY(-1px);
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      box-shadow: none;
    }
  }
</style>