<!--
  FieldControl.svelte
  ──────────────────────────────────────────────────────────────────────────────
  Type-aware Overview/Logistics field editor.

  A single dispatcher that renders the RIGHT editing widget for a registry
  field's `valueType`, instead of forcing every field through a bare text input:

    • enum      → a <select> dropdown populated from the operator-defined
                  "choices, comma-separated" list (stored as `options: string[]`).
    • boolean   → an on/off toggle switch (Yes / No).
    • number    → an inline click-to-edit numeric input (validated as a number).
    • date /    → the shared <DateFieldRow> calendar row (Scheduled-Call style).
      datetime
    • text /    → the classic inline click-to-edit <EditableField> text box.
      string /    (`text` renders multi-line). This is the catch-all fallback so
      email…      unknown/new value types keep working.

  Composite value types (route / property / vehicles / datetime-list) are NOT
  handled here — they keep their bespoke multi-input widgets in DetailPanel.

  Every edit flows through the shared, concurrency-safe `editField()` store
  action (same PATCH + activity-log + optimistic-store path as every other
  field), so this is a pure presentation upgrade with no new save plumbing.

  Reused by BOTH the Overview tab (DetailPanel) and the Shipment & Logistics
  card (ShipmentTrackingCard), so a field renders identically wherever it lives.
-->
<script lang="ts">
  import { editField } from '../store.ts';
  import { toasts } from '../toastStore.ts';
  import EditableField from './EditableField.svelte';
  import DateFieldRow from './DateFieldRow.svelte';

  /** Consultations doc ID. */
  export let clientId: string;
  /** Dotted/array field path, e.g. "consultations.0.budget". */
  export let path: string;
  /** Current stored value. */
  export let value: unknown;
  /** Registry value type — drives which widget renders. */
  export let valueType: string = 'string';
  /** Human label (used in toasts + tooltips + a11y). */
  export let label: string = '';
  /** Operator-defined choices for enum fields (comma-separated in the editor). */
  export let options: string[] = [];
  /** Placeholder shown when the value is empty. */
  export let placeholder: string = '—';
  /** Render value-only (no editing) — for computed / derived fields. */
  export let readonly: boolean = false;

  let saving = false;

  // ── Shared helpers ─────────────────────────────────────────────────────────
  function asString(v: unknown): string {
    if (v === null || v === undefined) return '';
    return String(v);
  }

  /** Commit `next` through the concurrency-safe editField() path (+ toasts). */
  async function commit(next: unknown, successMsg: string): Promise<void> {
    if (saving) return;
    saving = true;
    try {
      await editField(clientId, path, next, value);
      toasts.success(successMsg);
    } catch (err: any) {
      toasts.error(`${label}: ${err?.message ?? err}`);
    } finally {
      saving = false;
    }
  }

  // ── enum (choice dropdown) ───────────────────────────────────────────────
  $: current = asString(value);
  // Never silently drop a stored value that's no longer in the option list —
  // surface it as a selectable (legacy) entry so operators still see it.
  $: enumOptions =
    current && !options.includes(current) ? [current, ...options] : options;

  async function onEnumChange(e: Event): Promise<void> {
    const next = (e.target as HTMLSelectElement).value;
    if (next === current) return;
    await commit(next, next === '' ? `${label} cleared.` : `${label} updated.`);
  }

  // ── boolean (switch) ─────────────────────────────────────────────────────
  function toBool(v: unknown): boolean {
    if (typeof v === 'boolean') return v;
    if (typeof v === 'number') return v !== 0;
    if (typeof v === 'string') {
      const s = v.trim().toLowerCase();
      return s === 'true' || s === '1' || s === 'yes' || s === 'on';
    }
    return false;
  }
  $: boolOn = toBool(value);
  async function toggleBool(): Promise<void> {
    const next = !boolOn;
    await commit(next, `${label}: ${next ? 'Yes' : 'No'}.`);
  }

  // ── number (inline numeric edit) ─────────────────────────────────────────
  let numEditing = false;
  let numDraft = '';
  let numInput: HTMLInputElement | null = null;
  $: numDisplay = asString(value).trim();

  function startNum(): void {
    if (saving) return;
    numDraft = numDisplay;
    numEditing = true;
    setTimeout(() => numInput?.focus(), 0);
  }
  function cancelNum(): void {
    numEditing = false;
    numDraft = numDisplay;
  }
  async function commitNum(): Promise<void> {
    const t = numDraft.trim();
    let next: unknown;
    if (t === '') {
      next = ''; // clear
    } else {
      const n = Number(t);
      if (Number.isNaN(n)) {
        toasts.error(`${label}: “${t}” is not a number.`);
        return;
      }
      next = n;
    }
    if (asString(next) === numDisplay) {
      numEditing = false;
      return;
    }
    numEditing = false;
    await commit(next, t === '' ? `${label} cleared.` : `${label} updated.`);
  }
  function numKey(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      e.preventDefault();
      cancelNum();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      commitNum();
    }
  }

  // ── read-only display formatting ─────────────────────────────────────────
  function fmtDate(s: string, withTime: boolean): string {
    if (!s) return '—';
    const dOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    let d: Date | null = null;
    if (dOnly) d = new Date(Number(dOnly[1]), Number(dOnly[2]) - 1, Number(dOnly[3]));
    else {
      const parsed = new Date(s);
      if (!isNaN(parsed.getTime())) d = parsed;
    }
    if (!d) return s;
    const datePart = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    return withTime
      ? `${datePart}, ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
      : datePart;
  }
  function fmtReadonly(v: unknown, vt: string): string {
    const s = asString(v).trim();
    if (s === '') return '—';
    if (vt === 'boolean') return toBool(v) ? 'Yes' : 'No';
    if (vt === 'date') return fmtDate(s, false);
    if (vt === 'datetime') return fmtDate(s, true);
    return s;
  }
</script>

{#if readonly}
  <span class="detail-field__value detail-field__value--readonly">{fmtReadonly(value, valueType)}</span>

{:else if valueType === 'enum'}
  <div class="fc-select-wrap">
    <select
      class="fc-select"
      class:fc-select--empty={current === ''}
      value={current}
      disabled={saving}
      on:change={onEnumChange}
      title={`Choose ${label.toLowerCase()}`}
    >
      <option value="">—</option>
      {#each enumOptions as opt}
        <option value={opt}>{opt}</option>
      {/each}
    </select>
    {#if saving}<span class="fc-spinner" aria-hidden="true"></span>{/if}
  </div>

{:else if valueType === 'boolean'}
  <div class="fc-bool">
    <button
      type="button"
      role="switch"
      aria-checked={boolOn}
      aria-label={label}
      class="fc-switch"
      class:fc-switch--on={boolOn}
      disabled={saving}
      on:click={toggleBool}
      title={`Toggle ${label.toLowerCase()}`}
    >
      <span class="fc-knob"></span>
    </button>
    <span class="fc-bool-state" class:fc-bool-state--on={boolOn}>{boolOn ? 'Yes' : 'No'}</span>
  </div>

{:else if valueType === 'number'}
  <div class="fc-num">
    {#if numEditing}
      <input
        bind:this={numInput}
        bind:value={numDraft}
        class="fc-num-input"
        type="number"
        inputmode="decimal"
        on:keydown={numKey}
        on:blur={commitNum}
        disabled={saving}
      />
      {#if saving}<span class="fc-spinner" aria-hidden="true"></span>{/if}
    {:else}
      <!-- svelte-ignore a11y-click-events-have-key-events -->
      <button
        type="button"
        class="fc-num-value"
        class:fc-num-value--empty={numDisplay === ''}
        on:click|stopPropagation={startNum}
        title="Click to edit"
      >
        {numDisplay === '' ? placeholder : numDisplay}
        <span class="fc-pencil" aria-hidden="true">✎</span>
      </button>
      {#if saving}<span class="fc-spinner" aria-hidden="true"></span>{/if}
    {/if}
  </div>

{:else if valueType === 'date' || valueType === 'datetime'}
  <DateFieldRow {clientId} {path} {value} {label} withTime={valueType === 'datetime'} />

{:else}
  <EditableField {clientId} {path} {value} {label} multiline={valueType === 'text'} {placeholder} />
{/if}

<style lang="scss">
  // ── enum: styled native <select> ───────────────────────────────────────────
  .fc-select-wrap {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
  }
  .fc-select {
    appearance: none;
    -webkit-appearance: none;
    font-family: inherit;
    font-size: 0.85rem;
    font-weight: 500;
    color: #1e293b;
    background-color: #fff;
    // Chevron drawn via inline SVG so no icon font is needed.
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 10px center;
    border: 1.5px solid #e2e8f0;
    border-radius: 10px;
    padding: 0.4rem 1.9rem 0.4rem 0.7rem;
    cursor: pointer;
    max-width: 100%;
    transition: border-color 0.15s, box-shadow 0.15s;

    &:hover:not(:disabled) { border-color: #cbd5e1; }
    &:focus {
      outline: none;
      border-color: #02b5bb;
      box-shadow: 0 0 0 3px rgba(2, 181, 187, 0.15);
    }
    &:disabled { opacity: 0.6; cursor: not-allowed; }
    &.fc-select--empty { color: #94a3b8; }
  }

  // ── boolean: toggle switch ─────────────────────────────────────────────────
  .fc-bool {
    display: inline-flex;
    align-items: center;
    gap: 10px;
  }
  .fc-switch {
    position: relative;
    width: 42px;
    height: 24px;
    flex: none;
    border: none;
    border-radius: 999px;
    background: #cbd5e1;
    cursor: pointer;
    padding: 0;
    transition: background 0.18s ease;

    &:focus-visible {
      outline: none;
      box-shadow: 0 0 0 3px rgba(2, 181, 187, 0.25);
    }
    &:disabled { opacity: 0.6; cursor: not-allowed; }
    &.fc-switch--on { background: #02b5bb; }
  }
  .fc-knob {
    position: absolute;
    top: 3px;
    left: 3px;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: #fff;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
    transition: transform 0.18s ease;
  }
  .fc-switch--on .fc-knob { transform: translateX(18px); }

  .fc-bool-state {
    font-size: 0.85rem;
    font-weight: 600;
    color: #94a3b8;
    &.fc-bool-state--on { color: #0f766e; }
  }

  // ── number: inline click-to-edit ───────────────────────────────────────────
  .fc-num {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
  }
  .fc-num-input {
    font-family: inherit;
    font-size: 0.85rem;
    color: #1e293b;
    background: #fff;
    border: 1.5px solid #02b5bb;
    border-radius: 10px;
    padding: 0.4rem 0.6rem;
    width: 8rem;
    max-width: 100%;
    box-shadow: 0 0 0 3px rgba(2, 181, 187, 0.15);
    &:focus { outline: none; }
    &:disabled { opacity: 0.6; }
  }
  .fc-num-value {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-family: inherit;
    font-size: 0.85rem;
    font-weight: 500;
    color: #1e293b;
    background: transparent;
    border: 1.5px solid transparent;
    border-radius: 10px;
    padding: 0.4rem 0.6rem;
    cursor: pointer;
    text-align: left;
    transition: background 0.15s, border-color 0.15s;

    &:hover {
      background: #f1f5f9;
      border-color: #e2e8f0;
    }
    &.fc-num-value--empty { color: #94a3b8; }
  }
  .fc-pencil {
    font-size: 0.72rem;
    opacity: 0;
    transition: opacity 0.15s;
  }
  .fc-num-value:hover .fc-pencil { opacity: 0.6; }

  // ── shared saving spinner ──────────────────────────────────────────────────
  .fc-spinner {
    width: 13px;
    height: 13px;
    flex: none;
    border: 2px solid rgba(2, 181, 187, 0.25);
    border-top-color: #02b5bb;
    border-radius: 50%;
    animation: fc-spin 0.7s linear infinite;
  }
  @keyframes fc-spin {
    to { transform: rotate(360deg); }
  }
</style>
