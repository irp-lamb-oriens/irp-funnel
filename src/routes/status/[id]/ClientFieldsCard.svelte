<script lang="ts">
  /**
   * ClientFieldsCard.svelte — "Your details" on the client status page.
   * ────────────────────────────────────────────────────────────────────────
   * Renders the operator-configured, client-visible Overview fields
   * (Automations → Overview fields, with the "Client" switch on). Fields the
   * operator additionally marked "Editable" render as inputs the client can
   * change + save; the rest are read-only. Fully data-driven from the
   * `clientFields` store (populated by fetchProject) — zero hardcoded fields.
   *
   * Self-contained: reads the projectId from the route params and persists via
   * the shared `saveClientFields` store action (PATCH /details, server-validated
   * against the same registry). Renders nothing when there are no client fields,
   * so it's invisible until an operator opts a field in — fully backward compatible.
   */
  import { page } from '$app/stores';
  import { clientFields, saveClientFields } from './store.ts';

  $: projectId = $page.params.id;

  // Local editable drafts, keyed by field id. Seeded from the store and
  // re-seeded whenever the store changes (e.g. after a save or refetch).
  let drafts: Record<string, string> = {};
  let seededSig = '';
  $: {
    const sig = ($clientFields || []).map((f) => `${f.id}:${String(f.value ?? '')}`).join('|');
    if (sig !== seededSig) {
      seededSig = sig;
      const next: Record<string, string> = {};
      for (const f of $clientFields || []) next[f.id] = f.value == null ? '' : String(f.value);
      drafts = next;
    }
  }

  $: editableFields = ($clientFields || []).filter((f) => f && f.editable);
  $: hasEditable = editableFields.length > 0;

  let saving = false;
  let savedMsg = '';
  let errorMsg = '';

  /** Whether any editable field's draft differs from its stored value. */
  $: dirty = editableFields.some(
    (f) => (drafts[f.id] ?? '') !== (f.value == null ? '' : String(f.value)),
  );

  function coerce(valueType: string, raw: string): unknown {
    if (valueType === 'number') {
      const n = Number(raw);
      return Number.isFinite(n) ? n : null;
    }
    if (valueType === 'boolean') return raw === 'true' || raw === 'yes' || raw === '1';
    return raw;
  }

  /** Pretty read-only display of a value. */
  function display(f: any): string {
    const v = f?.value;
    if (v == null || v === '') return '—';
    if (f.valueType === 'boolean') return v === true || v === 'true' ? 'Yes' : 'No';
    return String(v);
  }

  async function save() {
    if (!projectId || saving || !dirty) return;
    saving = true;
    savedMsg = '';
    errorMsg = '';
    try {
      const values: Record<string, unknown> = {};
      for (const f of editableFields) {
        const raw = drafts[f.id] ?? '';
        if (raw !== (f.value == null ? '' : String(f.value))) {
          values[f.id] = coerce(f.valueType, raw);
        }
      }
      if (Object.keys(values).length === 0) return;
      await saveClientFields(projectId, values);
      savedMsg = 'Saved ✓';
      setTimeout(() => (savedMsg = ''), 2500);
    } catch (e: any) {
      errorMsg = e?.message ?? 'Could not save your changes.';
    } finally {
      saving = false;
    }
  }
</script>

{#if ($clientFields || []).length > 0}
  <section class="cfc">
    <div class="cfc__head">
      <h3 class="cfc__title">Your details</h3>
      {#if hasEditable}
        <p class="cfc__sub">You can update the fields marked editable below.</p>
      {/if}
    </div>

    <div class="cfc__grid">
      {#each $clientFields as f (f.id)}
        <div class="cfc__row" class:cfc__row--editable={f.editable}>
          <span class="cfc__label">{f.label}</span>

          {#if !f.editable}
            <span class="cfc__value">{display(f)}</span>
          {:else if f.valueType === 'boolean'}
            <select class="cfc__input" bind:value={drafts[f.id]} disabled={saving}>
              <option value="true">Yes</option>
              <option value="false">No</option>
            </select>
          {:else if f.valueType === 'enum' && Array.isArray(f.options) && f.options.length}
            <select class="cfc__input" bind:value={drafts[f.id]} disabled={saving}>
              <option value="">Select…</option>
              {#each f.options as opt}
                <option value={opt}>{opt}</option>
              {/each}
            </select>
          {:else if f.valueType === 'text'}
            <textarea class="cfc__input" rows="3" bind:value={drafts[f.id]} placeholder={f.placeholder || ''} disabled={saving}></textarea>
          {:else if f.valueType === 'number'}
            <input class="cfc__input" type="number" bind:value={drafts[f.id]} placeholder={f.placeholder || ''} disabled={saving} />
          {:else if f.valueType === 'date'}
            <input class="cfc__input" type="date" bind:value={drafts[f.id]} disabled={saving} />
          {:else if f.valueType === 'datetime'}
            <input class="cfc__input" type="datetime-local" bind:value={drafts[f.id]} disabled={saving} />
          {:else if f.valueType === 'email'}
            <input class="cfc__input" type="email" bind:value={drafts[f.id]} placeholder={f.placeholder || ''} disabled={saving} />
          {:else}
            <input class="cfc__input" type="text" bind:value={drafts[f.id]} placeholder={f.placeholder || ''} disabled={saving} />
          {/if}
        </div>
      {/each}
    </div>

    {#if hasEditable}
      <div class="cfc__actions">
        {#if errorMsg}<span class="cfc__msg cfc__msg--err">{errorMsg}</span>{/if}
        {#if savedMsg}<span class="cfc__msg cfc__msg--ok">{savedMsg}</span>{/if}
        <button class="cfc__save" on:click={save} disabled={saving || !dirty}>
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    {/if}
  </section>
{/if}

<style>
  .cfc {
    background: #fff;
    border: 1px solid #e2e8f0;
    border-radius: 16px;
    padding: 1.25rem 1.4rem;
    box-shadow: 0 2px 12px rgba(15, 23, 42, 0.05);
    margin: 1rem 0;
    font-family: 'Jost', system-ui, sans-serif;
  }
  .cfc__head { margin-bottom: 1rem; }
  .cfc__title { margin: 0; font-size: 1.05rem; font-weight: 800; color: #0f172a; letter-spacing: -0.01em; }
  .cfc__sub { margin: 0.25rem 0 0; font-size: 0.82rem; color: #64748b; }

  .cfc__grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 0.9rem 1.2rem; }
  .cfc__row { display: flex; flex-direction: column; gap: 0.3rem; }
  .cfc__label {
    font-size: 0.66rem; font-weight: 800; color: #94a3b8;
    text-transform: uppercase; letter-spacing: 0.07em;
  }
  .cfc__value { font-size: 0.95rem; color: #1e293b; font-weight: 600; padding: 0.15rem 0; }
  .cfc__input {
    padding: 0.55rem 0.7rem; border: 1.5px solid #e2e8f0; border-radius: 10px;
    font-size: 0.9rem; font-family: inherit; color: #0f172a; background: #fff;
    transition: border-color 0.15s, box-shadow 0.15s;
  }
  .cfc__input:focus {
    outline: none; border-color: #02b5bb; box-shadow: 0 0 0 3px rgba(2, 181, 187, 0.12);
  }
  .cfc__input:disabled { opacity: 0.6; }

  .cfc__actions { display: flex; align-items: center; justify-content: flex-end; gap: 0.8rem; margin-top: 1.1rem; }
  .cfc__msg { font-size: 0.82rem; font-weight: 600; }
  .cfc__msg--ok { color: #059669; }
  .cfc__msg--err { color: #dc2626; }
  .cfc__save {
    padding: 0.6rem 1.4rem; border: none; border-radius: 10px;
    background: linear-gradient(135deg, #02b5bb 0%, #02999e 100%); color: #fff;
    font-size: 0.9rem; font-weight: 800; cursor: pointer; font-family: inherit;
    box-shadow: 0 2px 10px rgba(2, 181, 187, 0.3);
    transition: filter 0.15s, transform 0.12s, opacity 0.15s;
  }
  .cfc__save:hover:not(:disabled) { filter: brightness(1.06); transform: translateY(-1px); }
  .cfc__save:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
