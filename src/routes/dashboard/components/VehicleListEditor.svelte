<script lang="ts">
  /**
   * VehicleListEditor.svelte
   *
   * Add / edit / delete editor for the composite `vehicles` field
   * (`Array<{ year, make, model }>`). Renders even when the list is empty or the
   * field doesn't exist yet, so an operator can build it from scratch.
   *
   * Every change commits the WHOLE array through the shared, schema-agnostic
   * `editField()` store action (path = `consultations.N.vehicles`), the same path
   * every other Overview field uses. We intentionally pass NO `expectedOldValue`:
   * this is a single-operator bulk-list editor, and the optimistic-concurrency
   * guard adds a rapid-write race with no real benefit here.
   *
   * Local `rows` own the input values (seed-once, write-only), re-seeded from the
   * prop only on a genuine external change (client switch or a teammate's edit),
   * never when the prop echoes our own just-saved value — so typing is never
   * clobbered. Mirrors the pattern used by PricingRequestsPanel.
   */
  import { editField } from '../store.ts';
  import { toasts } from '../toastStore.ts';

  /** Consultations doc ID. */
  export let clientId: string;
  /** Dotted path to the vehicles array, e.g. "consultations.0.vehicles". */
  export let path: string;
  /** Current vehicles array (may be undefined / empty / non-existent). */
  export let vehicles: Array<{ year?: string; make?: string; model?: string }> = [];

  type Row = { year: string; make: string; model: string };

  function toRows(v: unknown): Row[] {
    return (Array.isArray(v) ? v : []).map((r: any) => ({
      year: String(r?.year ?? ''),
      make: String(r?.make ?? ''),
      model: String(r?.model ?? ''),
    }));
  }

  /** Trimmed rows with at least one non-empty field — what actually persists. */
  function cleaned(rowsIn: Row[]): Row[] {
    return rowsIn
      .map((r) => ({ year: r.year.trim(), make: r.make.trim(), model: r.model.trim() }))
      .filter((r) => r.year || r.make || r.model);
  }

  function keyOf(v: unknown): string {
    return JSON.stringify(cleaned(toRows(v)));
  }

  let rows: Row[] = toRows(vehicles);
  let syncKey = keyOf(vehicles);
  let saving = false;

  // Re-seed from the prop ONLY on a genuine external change. `syncKey` tracks the
  // last value we've synced to (updated on both external reseed and our own
  // commit), so a socket echo of our own save is a no-op and never clobbers an
  // in-progress edit.
  $: {
    const incoming = keyOf(vehicles);
    if (incoming !== syncKey) {
      rows = toRows(vehicles);
      syncKey = incoming;
    }
  }

  async function commit() {
    const next = cleaned(rows);
    saving = true;
    try {
      await editField(clientId, path, next);
      // Adopt our own value so the socket refetch echo doesn't reseed mid-edit.
      syncKey = JSON.stringify(next);
    } catch (err: any) {
      toasts.error(`Vehicles: ${err?.message ?? err}`);
    } finally {
      saving = false;
    }
  }

  function addRow() {
    rows = [...rows, { year: '', make: '', model: '' }];
    // No commit yet — an all-empty row isn't persisted until a field is filled.
  }

  function removeRow(i: number) {
    rows = rows.filter((_, idx) => idx !== i);
    commit();
  }

  function onEnter(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      (e.currentTarget as HTMLInputElement)?.blur(); // blur → on:change → commit
    }
  }
</script>

<div class="veh-editor">
  {#if rows.length > 0}
    <div class="veh-editor__rows">
      {#each rows as row, i (i)}
        <div class="veh-editor__row">
          <input
            class="veh-editor__input veh-editor__input--year"
            type="text"
            inputmode="numeric"
            placeholder="Year"
            bind:value={row.year}
            on:change={commit}
            on:keydown={onEnter}
            disabled={saving}
          />
          <input
            class="veh-editor__input"
            type="text"
            placeholder="Make"
            bind:value={row.make}
            on:change={commit}
            on:keydown={onEnter}
            disabled={saving}
          />
          <input
            class="veh-editor__input"
            type="text"
            placeholder="Model"
            bind:value={row.model}
            on:change={commit}
            on:keydown={onEnter}
            disabled={saving}
          />
          <button
            type="button"
            class="veh-editor__del"
            title="Remove this vehicle"
            aria-label="Remove vehicle"
            on:click={() => removeRow(i)}
            disabled={saving}
          >✕</button>
        </div>
      {/each}
    </div>
  {:else}
    <span class="veh-editor__empty">No vehicles</span>
  {/if}

  <div class="veh-editor__footer">
    <button type="button" class="veh-editor__add" on:click={addRow} disabled={saving}>
      + Add vehicle
    </button>
    {#if saving}<span class="veh-editor__spinner" aria-hidden="true"></span>{/if}
  </div>
</div>

<style lang="scss">
  .veh-editor {
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-width: 0;
    width: 100%;
  }

  .veh-editor__rows {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .veh-editor__row {
    display: grid;
    grid-template-columns: 4.5rem 1fr 1fr auto;
    gap: 6px;
    align-items: center;
  }

  .veh-editor__input {
    font-family: inherit;
    font-size: 0.85rem;
    color: #1e293b;
    background: #fff;
    border: 1.5px solid #e2e8f0;
    border-radius: 10px;
    padding: 0.4rem 0.6rem;
    min-width: 0;
    transition: border-color 0.15s, box-shadow 0.15s;

    &::placeholder { color: #94a3b8; }
    &:hover:not(:disabled) { border-color: #cbd5e1; }
    &:focus {
      outline: none;
      border-color: #02b5bb;
      box-shadow: 0 0 0 3px rgba(2, 181, 187, 0.15);
    }
    &:disabled { opacity: 0.6; cursor: not-allowed; }
  }

  .veh-editor__del {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    flex: none;
    border: 1.5px solid #e2e8f0;
    border-radius: 8px;
    background: #fff;
    color: #94a3b8;
    font-size: 0.8rem;
    line-height: 1;
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s, color 0.15s;

    &:hover:not(:disabled) {
      background: #fef2f2;
      border-color: #fecaca;
      color: #ef4444;
    }
    &:disabled { opacity: 0.6; cursor: not-allowed; }
  }

  .veh-editor__empty {
    font-size: 0.85rem;
    color: #94a3b8;
  }

  .veh-editor__footer {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .veh-editor__add {
    font-family: inherit;
    font-size: 0.8rem;
    font-weight: 600;
    color: #0f766e;
    background: rgba(2, 181, 187, 0.08);
    border: 1.5px solid rgba(2, 181, 187, 0.25);
    border-radius: 10px;
    padding: 0.35rem 0.7rem;
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s;

    &:hover:not(:disabled) {
      background: rgba(2, 181, 187, 0.14);
      border-color: rgba(2, 181, 187, 0.4);
    }
    &:disabled { opacity: 0.6; cursor: not-allowed; }
  }

  .veh-editor__spinner {
    width: 13px;
    height: 13px;
    flex: none;
    border: 2px solid rgba(2, 181, 187, 0.25);
    border-top-color: #02b5bb;
    border-radius: 50%;
    animation: veh-spin 0.7s linear infinite;
  }
  @keyframes veh-spin {
    to { transform: rotate(360deg); }
  }
</style>
