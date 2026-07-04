<script lang="ts">
  /**
   * OverviewFieldsEditor.svelte
   * ────────────────────────────────────────────────────────────────────────
   * Automations → "Overview fields" configuration panel.
   *
   * Centralized, DB-backed editor for the fields surfaced on a client card's
   * Overview tab + used by the JSON import checker as advisory "expected
   * fields". Operators can add, rename, retype, reorder, toggle visibility,
   * and delete fields.
   *
   * CONTRACT (backward-compatible / additive — NOT a whitelist):
   *   • The registry is loaded async and NEVER blocks: if the server is cold
   *     or unreachable the editor simply shows what it has (seed fallback lives
   *     server-side) and every write is optimistic-with-resync-on-failure.
   *   • Deleting a field is NON-DESTRUCTIVE: it never deletes client data and
   *     never hides a field a client doc already has. It only stops offering
   *     the empty suggested slot going forward — so DELETE needs no migration
   *     guard (unlike pipeline stages).
   *   • Everything is self-contained and talks to the server exclusively
   *     through the typed helpers in ../store.ts.
   *
   * STYLING: mirrors the IRP dashboard admin dialect of the global style bible
   * — teal accent (--color-highlight-2 / #02b5bb), Jost body font, slate
   * neutrals, 16px cards, teal switches. Kept 1:1 with AutomationView so the
   * panel is indistinguishable from its host surface.
   */
  import { onMount } from 'svelte';
  import {
    fieldConfig,
    fetchOverviewFields,
    createOverviewField,
    updateOverviewField,
    reorderOverviewFields,
    deleteOverviewField,
    type FieldConfigRow,
    type FieldValueType,
    type FieldSection,
    type FieldScope,
  } from '../store.ts';

  let loading = true;
  let error = '';
  let busyId = ''; // id of the row currently mutating
  let deleteModalField: FieldConfigRow | null = null;

  // ── New-field form state ────────────────────────────────────────────────
  let showNewForm = false;
  let newLabel = '';
  let newSection: FieldSection = 'custom';
  let newValueType: FieldValueType = 'string';
  let newScope: FieldScope = 'consultation';
  let newOptions = ''; // comma-separated when valueType === 'enum'
  let creating = false;

  const VALUE_TYPES: { value: FieldValueType; label: string }[] = [
    { value: 'string', label: 'Text (short)' },
    { value: 'text', label: 'Text (long)' },
    { value: 'number', label: 'Number' },
    { value: 'boolean', label: 'Yes / No' },
    { value: 'date', label: 'Date' },
    { value: 'datetime', label: 'Date & time' },
    { value: 'enum', label: 'Choice (dropdown)' },
    { value: 'email', label: 'Email' },
    { value: 'route', label: 'Route (from → to)' },
    { value: 'property', label: 'Property type' },
    { value: 'vehicles', label: 'Vehicles list' },
    { value: 'datetime-list', label: 'Date/time list' },
  ];

  const SECTIONS: { value: FieldSection; label: string }[] = [
    { value: 'identity', label: 'Identity' },
    { value: 'route', label: 'Route' },
    { value: 'move', label: 'Move details' },
    { value: 'logistics', label: 'Logistics' },
    { value: 'meta', label: 'Meta' },
    { value: 'custom', label: 'Custom' },
  ];

  const SCOPES: { value: FieldScope; label: string }[] = [
    { value: 'consultation', label: 'Consultation' },
    { value: 'root', label: 'Client (root)' },
  ];

  $: fields = $fieldConfig;

  onMount(load);

  async function load() {
    loading = true;
    error = '';
    try {
      const rows = await fetchOverviewFields();
      fieldConfig.set([...rows].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)));
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to load Overview fields.';
    } finally {
      loading = false;
    }
  }

  async function createField() {
    const label = newLabel.trim();
    if (!label) return;
    creating = true;
    error = '';
    try {
      const options =
        newValueType === 'enum'
          ? newOptions.split(',').map((o) => o.trim()).filter(Boolean)
          : undefined;
      await createOverviewField({
        label,
        section: newSection,
        valueType: newValueType,
        scope: newScope,
        ...(options && options.length ? { options } : {}),
      });
      // Reset the form
      newLabel = '';
      newOptions = '';
      newValueType = 'string';
      newSection = 'custom';
      newScope = 'consultation';
      showNewForm = false;
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to create field.';
    } finally {
      creating = false;
    }
  }

  async function patchField(field: FieldConfigRow, updates: Partial<FieldConfigRow>) {
    busyId = field.id;
    error = '';
    try {
      await updateOverviewField(field.id, updates);
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to update field.';
      // Re-sync from server on failure so the UI never diverges.
      await load();
    } finally {
      busyId = '';
    }
  }

  /** Move a field one slot earlier/later, then persist the whole order. */
  async function moveField(field: FieldConfigRow, dir: -1 | 1) {
    const ordered = [...fields].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).map((f) => f.id);
    const idx = ordered.indexOf(field.id);
    const swap = idx + dir;
    if (idx < 0 || swap < 0 || swap >= ordered.length) return;
    [ordered[idx], ordered[swap]] = [ordered[swap], ordered[idx]];
    busyId = field.id;
    error = '';
    try {
      await reorderOverviewFields(ordered);
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to reorder fields.';
      await load();
    } finally {
      busyId = '';
    }
  }

  async function confirmDelete() {
    if (!deleteModalField) return;
    const id = deleteModalField.id;
    busyId = id;
    error = '';
    try {
      await deleteOverviewField(id);
      deleteModalField = null;
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to delete field.';
    } finally {
      busyId = '';
    }
  }
</script>

<section class="ofe">
  <header class="ofe-head">
    <div>
      <h3 class="ofe-title">Overview fields</h3>
      <p class="ofe-sub">
        Configure which fields appear on a client’s Overview tab and act as
        advisory “expected fields” for JSON imports. These are additive —
        deleting a field never removes data a client already has, and imports
        with extra fields are always accepted.
      </p>
    </div>
    <button class="save-btn" on:click={() => (showNewForm = !showNewForm)}>
      {showNewForm ? 'Cancel' : '＋ Add field'}
    </button>
  </header>

  {#if error}
    <div class="ofe-msg ofe-msg--error">{error}</div>
  {/if}

  {#if showNewForm}
    <div class="ofe-add">
      <div class="ofe-add-grid">
        <label class="ofe-field">
          <span>Label</span>
          <input
            type="text"
            bind:value={newLabel}
            placeholder="e.g. Insurance taken"
            on:keydown={(e) => e.key === 'Enter' && createField()}
          />
        </label>
        <label class="ofe-field">
          <span>Type</span>
          <select bind:value={newValueType}>
            {#each VALUE_TYPES as t}
              <option value={t.value}>{t.label}</option>
            {/each}
          </select>
        </label>
        <label class="ofe-field">
          <span>Section</span>
          <select bind:value={newSection}>
            {#each SECTIONS as s}
              <option value={s.value}>{s.label}</option>
            {/each}
          </select>
        </label>
        <label class="ofe-field">
          <span>Scope</span>
          <select bind:value={newScope}>
            {#each SCOPES as s}
              <option value={s.value}>{s.label}</option>
            {/each}
          </select>
        </label>
      </div>
      {#if newValueType === 'enum'}
        <label class="ofe-field ofe-field--full">
          <span>Choices (comma-separated)</span>
          <input type="text" bind:value={newOptions} placeholder="Yes, No, Pending" />
        </label>
      {/if}
      <div class="ofe-add-actions">
        <button class="save-btn" disabled={creating || !newLabel.trim()} on:click={createField}>
          {creating ? 'Adding…' : 'Add field'}
        </button>
      </div>
    </div>
  {/if}

  {#if loading}
    <div class="ofe-empty">Loading Overview fields…</div>
  {:else if fields.length === 0}
    <div class="ofe-empty">No Overview fields configured yet. Add one to get started.</div>
  {:else}
    <div class="ofe-table-wrap">
      <table class="ofe-table">
        <thead>
          <tr>
            <th class="ofe-col-order">Order</th>
            <th>Label</th>
            <th>Type</th>
            <th>Section</th>
            <th class="ofe-col-toggle" title="Shown to the client on their status page (“Your details”)">Client Visible</th>
            <th class="ofe-col-toggle" title="Client can edit this field from their status page (requires Client Visible)">Client Editable</th>
            <th class="ofe-col-toggle" title="Shown on the internal Overview tab">Active</th>
            <th class="ofe-col-actions"></th>
          </tr>
        </thead>
        <tbody>
          {#each fields as field, i (field.id)}
            <tr class:ofe-row--busy={busyId === field.id} class:ofe-row--off={field.active === false}>
              <td class="ofe-col-order">
                <div class="ofe-order-cell">
                  <button
                    class="ofe-move"
                    title="Move up"
                    disabled={i === 0 || busyId === field.id}
                    on:click={() => moveField(field, -1)}>▲</button
                  >
                  <button
                    class="ofe-move"
                    title="Move down"
                    disabled={i === fields.length - 1 || busyId === field.id}
                    on:click={() => moveField(field, 1)}>▼</button
                  >
                </div>
              </td>
              <td class="ofe-label-cell">
                <input
                  class="ofe-name"
                  type="text"
                  value={field.label}
                  disabled={busyId === field.id}
                  on:change={(e) => patchField(field, { label: e.currentTarget.value })}
                />
                {#if field.isSeed}<span class="ofe-badge" title="Seeded default">seed</span>{/if}
                <code class="ofe-id">{field.id}</code>
              </td>
              <td>
                <select
                  value={field.valueType}
                  disabled={busyId === field.id}
                  on:change={(e) => patchField(field, { valueType: e.currentTarget.value as FieldValueType })}
                >
                  {#each VALUE_TYPES as t}
                    <option value={t.value}>{t.label}</option>
                  {/each}
                </select>
              </td>
              <td>
                <select
                  value={field.section}
                  disabled={busyId === field.id}
                  on:change={(e) => patchField(field, { section: e.currentTarget.value as FieldSection })}
                >
                  {#each SECTIONS as s}
                    <option value={s.value}>{s.label}</option>
                  {/each}
                </select>
              </td>
              <td class="ofe-col-toggle">
                <button
                  class="ofe-switch"
                  class:ofe-switch--on={field.clientVisible === true}
                  on:click={() => patchField(field, { clientVisible: !(field.clientVisible === true) })}
                  disabled={busyId === field.id}
                  title={field.clientVisible === true ? 'Visible to client — click to hide' : 'Hidden from client — click to show'}
                  aria-label={field.clientVisible === true ? 'Client-visible' : 'Not client-visible'}
                >
                  <span class="ofe-switch__knob"></span>
                </button>
              </td>
              <td class="ofe-col-toggle">
                <button
                  class="ofe-switch"
                  class:ofe-switch--on={field.clientEditable === true}
                  on:click={() => patchField(field, { clientEditable: !(field.clientEditable === true) })}
                  disabled={busyId === field.id || field.clientVisible !== true || field.readOnly === true}
                  title={field.readOnly === true
                    ? 'Read-only fields can’t be client-editable'
                    : field.clientVisible !== true
                      ? 'Make the field client-visible first'
                      : field.clientEditable === true ? 'Client can edit — click to lock' : 'Read-only for client — click to allow editing'}
                  aria-label={field.clientEditable === true ? 'Client-editable' : 'Not client-editable'}
                >
                  <span class="ofe-switch__knob"></span>
                </button>
              </td>
              <td class="ofe-col-toggle">
                <button
                  class="ofe-switch"
                  class:ofe-switch--on={field.active !== false}
                  on:click={() => patchField(field, { active: field.active === false })}
                  disabled={busyId === field.id}
                  title={field.active === false ? 'Inactive — click to activate' : 'Active — click to deactivate'}
                  aria-label={field.active === false ? 'Inactive' : 'Active'}
                >
                  <span class="ofe-switch__knob"></span>
                </button>
              </td>

              <td class="ofe-col-actions">
                <button
                  class="remove-btn"
                  title="Delete field (client data is kept)"
                  disabled={busyId === field.id}
                  on:click={() => (deleteModalField = field)}>✕</button
                >
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</section>

<!-- ── Delete confirmation modal (non-destructive) ─────────────────────── -->
{#if deleteModalField}
  <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
  <div class="ofe-modal-backdrop" on:click={() => (deleteModalField = null)} role="presentation">
    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <div class="ofe-modal" on:click|stopPropagation role="dialog" aria-modal="true" tabindex="-1">
      <header class="ofe-modal__head">
        <h3>Delete “{deleteModalField.label}”</h3>
        <button class="ofe-close" on:click={() => (deleteModalField = null)} aria-label="Close">✕</button>
      </header>
      <div class="ofe-modal__body">
        <p class="ofe-modal-note">
          This removes the suggested field from the Overview tab and the import
          checker going forward. It is <strong>non-destructive</strong>: any
          client that already has a value for
          <code>{deleteModalField.id}</code> keeps it, and it still shows under
          the client’s advanced/raw fields. No client migration is needed.
        </p>
      </div>
      <footer class="ofe-modal__foot">
        <button class="reload-btn" on:click={() => (deleteModalField = null)}>Cancel</button>
        <button
          class="remove-btn-wide"
          disabled={busyId === deleteModalField.id}
          on:click={confirmDelete}
        >
          {busyId === deleteModalField.id ? 'Deleting…' : 'Delete field'}
        </button>
      </footer>
    </div>
  </div>
{/if}

<style lang="scss">
  /* Cohesive with the IRP dashboard admin surfaces + global style bible:
     teal accent (--color-highlight-2 / #02b5bb), Jost body font, slate neutrals.
     Kept 1:1 with AutomationView so this panel reads as part of the same surface. */
  .ofe {
    display: flex;
    flex-direction: column;
    gap: 1.1rem;
    color: var(--color-foreground, #181818);
    font-family: var(--font-paragraph, 'Jost'), system-ui, sans-serif;
  }

  .ofe-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1.25rem;
  }
  .ofe-title {
    margin: 0 0 0.3rem;
    font-size: 0.95rem;
    font-weight: 700;
    color: #0f172a;
    letter-spacing: -0.01em;
  }
  .ofe-sub {
    margin: 0;
    color: #64748b;
    font-size: 0.82rem;
    max-width: 680px;
    line-height: 1.5;
  }

  /* ── Add-field panel ─────────────────────────────────────────────────── */
  .ofe-add {
    background: #f8fafc;
    border: 1px dashed #cbd5e1;
    border-radius: 12px;
    padding: 1rem 1.1rem;
    display: flex;
    flex-direction: column;
    gap: 0.85rem;
  }
  .ofe-add-grid {
    display: grid;
    grid-template-columns: 2fr 1fr 1fr 1fr;
    gap: 0.7rem;
    align-items: end;
  }
  .ofe-add-actions {
    display: flex;
    justify-content: flex-end;
  }

  /* ── Fields (label above input, teal focus) ─────────────────────────── */
  .ofe-field {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
  }
  .ofe-field--full { grid-column: 1 / -1; }
  .ofe-field > span {
    font-size: 0.68rem;
    font-weight: 800;
    color: #94a3b8;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }
  .ofe-field select,
  .ofe-field input {
    padding: 0.5rem 0.6rem;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    font-size: 0.85rem;
    font-family: inherit;
    color: #0f172a;
    background: #fff;
    transition: border-color 0.14s, box-shadow 0.14s;
  }
  .ofe-field select:focus,
  .ofe-field input:focus {
    outline: none;
    border-color: rgba(2, 181, 187, 0.48);
    box-shadow: 0 0 0 3px rgba(2, 181, 187, 0.10);
  }

  .ofe-empty {
    text-align: center;
    color: #94a3b8;
    padding: 2rem;
    font-size: 0.9rem;
    letter-spacing: 0.02em;
  }

  /* ── Table ──────────────────────────────────────────────────────────── */
  .ofe-table-wrap {
    overflow-x: auto;
    border-radius: 10px;
    border: 1px solid #e2e8f0;
  }
  .ofe-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.84rem;
  }
  .ofe-table thead tr { background: #f8fafc; }
  .ofe-table th {
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
  .ofe-table td {
    padding: 0.5rem 0.7rem;
    border-bottom: 1px solid #f1f5f9;
    vertical-align: middle;
    color: #334155;
  }
  .ofe-table tbody tr:last-child td { border-bottom: none; }
  .ofe-table tr:hover { background: #fafbff; }
  .ofe-row--busy td { opacity: 0.55; }
  .ofe-row--off td { opacity: 0.6; }
  .ofe-table select {
    padding: 0.35rem 0.45rem;
    border: 1px solid #e2e8f0;
    border-radius: 7px;
    font-size: 0.8rem;
    font-family: inherit;
    color: #0f172a;
    background: #fff;
  }
  .ofe-table select:focus {
    outline: none;
    border-color: rgba(2, 181, 187, 0.48);
    box-shadow: 0 0 0 2px rgba(2, 181, 187, 0.12);
  }

  .ofe-col-order { width: 64px; white-space: nowrap; }
  .ofe-col-toggle { width: 72px; text-align: center; }
  .ofe-col-actions { width: 48px; text-align: right; }

  .ofe-order-cell { display: flex; gap: 0.25rem; }
  .ofe-move {
    width: 22px; height: 22px; border-radius: 6px;
    border: 1px solid #e2e8f0; background: #f8fafc; color: #475569;
    font-size: 0.6rem; cursor: pointer; line-height: 1;
    display: inline-flex; align-items: center; justify-content: center;
    transition: background 0.14s, border-color 0.14s;
  }
  .ofe-move:hover:not(:disabled) { background: #e2e8f0; border-color: #cbd5e1; }
  .ofe-move:disabled { opacity: 0.3; cursor: default; }

  .ofe-label-cell { min-width: 220px; }
  .ofe-name {
    width: 200px; max-width: 100%;
    padding: 0.35rem 0.45rem; border: 1px solid #e2e8f0; border-radius: 7px;
    font-size: 0.84rem; font-family: inherit; color: #0f172a; background: #fff;
    transition: border-color 0.14s, box-shadow 0.14s;
  }
  .ofe-name:focus {
    outline: none; border-color: rgba(2, 181, 187, 0.48);
    box-shadow: 0 0 0 2px rgba(2, 181, 187, 0.12);
  }
  .ofe-id {
    display: inline-block;
    margin-left: 0.4rem;
    font-size: 0.65rem; color: #94a3b8; background: #f1f5f9;
    border-radius: 4px; padding: 0.05rem 0.4rem;
    font-family: 'SF Mono', 'Fira Code', ui-monospace, monospace;
  }

  /* ── Badge (mirrors .av-badge) ──────────────────────────────────────── */
  .ofe-badge {
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

  /* ── Switch (teal on-state, mirrors .av-switch) ─────────────────────── */
  .ofe-switch {
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
  .ofe-switch__knob {
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
  .ofe-switch--on {
    background: var(--color-highlight-2, #02b5bb);
    box-shadow: 0 0 0 1px rgba(2, 181, 187, 0.25);
  }
  .ofe-switch--on .ofe-switch__knob { left: 19px; }
  .ofe-switch:disabled { opacity: 0.55; cursor: default; }

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

  /* ── Shared buttons (mirror .save-btn / .reload-btn) ────────────────── */
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
    transition: background 0.14s, color 0.14s, border-color 0.14s;
  }
  .reload-btn:hover:not(:disabled) { background: #e2e8f0; color: #1e293b; }

  /* ── Messages (mirror .av-msg) ──────────────────────────────────────── */
  .ofe-msg {
    padding: 0.6rem 1rem;
    border-radius: 8px;
    font-size: 0.82rem;
    font-weight: 600;
  }
  .ofe-msg--error {
    background: #fef2f2;
    color: #dc2626;
    border: 1px solid #fecaca;
  }

  /* ── Modal (mirrors .av-modal) ──────────────────────────────────────── */
  .ofe-modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(15, 23, 42, 0.45);
    z-index: 1100;
    display: flex;
    align-items: center;
    justify-content: center;
    animation: ofe-fade 0.18s ease;
  }
  @keyframes ofe-fade { from { opacity: 0; } to { opacity: 1; } }
  .ofe-modal {
    width: min(460px, 94vw);
    background: #fff;
    border-radius: 16px;
    box-shadow: 0 24px 64px rgba(0, 0, 0, 0.28);
    display: flex;
    flex-direction: column;
    font-family: var(--font-paragraph, 'Jost'), system-ui, sans-serif;
    animation: ofe-fade 0.18s ease;
  }
  .ofe-modal__head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.1rem 1.4rem;
    border-bottom: 1px solid #e2e8f0;
  }
  .ofe-modal__head h3 { margin: 0; font-size: 1rem; font-weight: 700; color: #0f172a; }
  .ofe-close {
    background: none;
    border: none;
    font-size: 1.05rem;
    cursor: pointer;
    color: #64748b;
    line-height: 1;
    transition: color 0.14s;
  }
  .ofe-close:hover { color: #0f172a; }
  .ofe-modal__body { padding: 1.2rem 1.4rem; }
  .ofe-modal-note { margin: 0; font-size: 0.86rem; color: #334155; line-height: 1.55; }
  .ofe-modal-note code {
    background: #f1f5f9;
    padding: 0 0.3em;
    border-radius: 4px;
    font-size: 0.9em;
  }
  .ofe-modal__foot {
    display: flex;
    justify-content: flex-end;
    gap: 0.7rem;
    padding: 1.1rem 1.4rem;
    border-top: 1px solid #e2e8f0;
  }
  .remove-btn-wide {
    padding: 0.55rem 1.2rem;
    border-radius: 10px;
    border: 1px solid rgba(198, 36, 38, 0.25);
    background: #c62426;
    color: #fff;
    font-size: 0.85rem;
    font-weight: 700;
    cursor: pointer;
    font-family: inherit;
    transition: filter 0.14s, transform 0.14s;
  }
  .remove-btn-wide:hover:not(:disabled) { filter: brightness(1.06); transform: translateY(-1px); }
  .remove-btn-wide:disabled { opacity: 0.55; cursor: wait; }

  /* ── Responsive ─────────────────────────────────────────────────────── */
  @media (max-width: 900px) {
    .ofe-add-grid { grid-template-columns: 1fr 1fr; }
  }
</style>
