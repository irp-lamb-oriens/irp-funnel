<!--
  DateFieldRow.svelte
  ──────────────────────────────────────────────────────────────────────────────
  Overview-tab renderer for `date` / `datetime` fields.

  It mirrors the **Scheduled Call** field's look & feel exactly:
    • No value  → a single "📅 Set date" button (like the "Schedule" button).
    • Has value → the formatted date (+ time for `datetime`) shown read-only,
                  a "📅 Change" button to re-pick, and a small ✕ to delete.

  Why this component exists (instead of routing dates through <EditableField>):
  the old approach rendered a text-style value button whose hover tooltip +
  backdrop styling collided with the picker popup, producing a visual glitch.
  This row uses the plain schedule-row buttons (no backdrop-filter / no
  overflow-hidden value chip), so opening the calendar is glitch-free.

  Editing flows through the shared, concurrency-safe `editField()` store action
  (same PATCH + activity-log + optimistic-store path as every other field).

  Deletion is a two-step, opt-in flow owned HERE (not in the picker): clicking
  the ✕ opens a confirmation modal; confirming commits "" (unset). The picker
  modal is therefore opened with `allowClear={false}` so date removal lives in
  exactly one place.
-->
<script lang="ts">
  import { editField } from '../store.ts';
  import { toasts } from '../toastStore.ts';
  import DateFieldEditorModal from './DateFieldEditorModal.svelte';

  /** Consultations doc ID. */
  export let clientId: string;
  /** Dotted/array field path, e.g. "consultations.0.targetMoveDate". */
  export let path: string;
  /** Current stored value (ISO / "YYYY-MM-DD" / empty). */
  export let value: unknown;
  /** Human label (used in the picker header + delete confirmation). */
  export let label: string = 'Date';
  /** When true, edits a full date+time (ISO); otherwise a date-only value. */
  export let withTime: boolean = false;

  let showPicker = false;
  let showDeleteConfirm = false;
  let saving = false;

  /** Normalise the incoming value to a string for the picker + emptiness check. */
  function asString(v: unknown): string {
    if (v === null || v === undefined) return '';
    if (typeof v === 'string') return v;
    return String(v);
  }

  $: raw = asString(value).trim();
  $: hasValue = raw !== '';
  $: display = formatDisplay(raw, withTime);

  /** Pretty, human display — matches the Scheduled Call formatting style. */
  function formatDisplay(s: string, wt: boolean): string {
    if (!s) return '';
    const dOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    let d: Date | null = null;
    if (dOnly) {
      d = new Date(Number(dOnly[1]), Number(dOnly[2]) - 1, Number(dOnly[3]));
    } else {
      const parsed = new Date(s);
      if (!isNaN(parsed.getTime())) d = parsed;
    }
    if (!d) return s; // Un-parseable — show the raw value honestly.
    const datePart = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    if (wt) {
      return `${datePart} · ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
    }
    return datePart;
  }

  /** Commit a value chosen from the picker (or "" to unset). */
  async function commit(next: string) {
    showPicker = false;
    if (next === raw) return; // no-op
    await save(next);
  }

  /** Confirmed deletion → unset the field. */
  async function confirmDelete() {
    showDeleteConfirm = false;
    await save('');
  }

  async function save(next: string) {
    if (saving) return;
    saving = true;
    try {
      await editField(clientId, path, next, value);
      toasts.success(next === '' ? `${label} cleared.` : `${label} updated.`);
    } catch (err: any) {
      toasts.error(`${label}: ${err?.message ?? err}`);
    } finally {
      saving = false;
    }
  }
</script>

<div class="detail-field__schedule-row">
  {#if hasValue}
    <span class="detail-field__value detail-field__value--readonly" title={raw}>{display}</span>
    <button
      type="button"
      class="detail-field__reschedule-btn"
      title={`Change ${label.toLowerCase()}`}
      disabled={saving}
      on:click={() => (showPicker = true)}
    >
      📅 Change
    </button>
    <button
      type="button"
      class="dfr-delete"
      title={`Remove ${label.toLowerCase()}`}
      aria-label={`Remove ${label.toLowerCase()}`}
      disabled={saving}
      on:click={() => (showDeleteConfirm = true)}
    >
      ✕
    </button>
  {:else}
    <span class="detail-field__value detail-field__value--muted">No date set</span>
    <button
      type="button"
      class="detail-field__reschedule-btn detail-field__reschedule-btn--schedule"
      title={`Set ${label.toLowerCase()}`}
      disabled={saving}
      on:click={() => (showPicker = true)}
    >
      📅 Set date
    </button>
  {/if}
</div>

{#if showPicker}
  <DateFieldEditorModal
    {label}
    value={raw}
    {withTime}
    allowClear={false}
    onClose={() => (showPicker = false)}
    onCommit={commit}
  />
{/if}

{#if showDeleteConfirm}
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div
    class="dfr-confirm-overlay"
    role="presentation"
    on:click={(e) => { if (e.target === e.currentTarget) showDeleteConfirm = false; }}
  >
    <div class="dfr-confirm-card" role="alertdialog" aria-modal="true" aria-label="Confirm remove date">
      <div class="dfr-confirm-icon">🗑️</div>
      <h3 class="dfr-confirm-title">Remove this date?</h3>
      <p class="dfr-confirm-text">
        This will unset <strong>{label}</strong>. You can set it again anytime.
      </p>
      <div class="dfr-confirm-buttons">
        <button class="dfr-cancel-btn" type="button" on:click={() => (showDeleteConfirm = false)}>
          Keep it
        </button>
        <button class="dfr-danger-btn" type="button" on:click={confirmDelete} disabled={saving}>
          {saving ? 'Removing…' : 'Yes, remove'}
        </button>
      </div>
    </div>
  </div>
{/if}

<style lang="scss">
  // Small circular ✕ that sits beside the "Change" button. Danger-tinted on
  // hover so it reads as a destructive action without shouting at rest.
  .dfr-delete {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border-radius: 7px;
    border: 1.5px solid rgba(220, 38, 38, 0.28);
    background: rgba(220, 38, 38, 0.06);
    color: #dc2626;
    font-size: 11px;
    font-weight: 700;
    line-height: 1;
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s, transform 0.1s;

    &:hover:not(:disabled) {
      background: rgba(220, 38, 38, 0.14);
      border-color: #dc2626;
    }
    &:active:not(:disabled) { transform: scale(0.92); }
    &:disabled { opacity: 0.5; cursor: not-allowed; }
  }

  // ── Delete confirmation modal ──────────────────────────────────────────────
  .dfr-confirm-overlay {
    position: fixed;
    inset: 0;
    background: rgba(15, 23, 42, 0.55);
    backdrop-filter: blur(3px);
    z-index: 2200; // above the picker (2100) should it ever co-exist
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
  }
  .dfr-confirm-card {
    background: #fff;
    border-radius: 16px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.22);
    padding: 1.4rem 1.35rem;
    width: 100%;
    max-width: 320px;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 0.5rem;
  }
  .dfr-confirm-icon { font-size: 1.9rem; }
  .dfr-confirm-title { font-size: 1.05rem; font-weight: 700; color: #1e293b; margin: 0; }
  .dfr-confirm-text { font-size: 0.84rem; color: #64748b; margin: 0 0 0.5rem; line-height: 1.45; }
  .dfr-confirm-buttons { display: flex; gap: 0.55rem; }

  .dfr-cancel-btn {
    padding: 0.5rem 1.05rem;
    border: 1.5px solid #e2e8f0;
    border-radius: 10px;
    background: transparent;
    color: #64748b;
    font-size: 0.85rem;
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
    transition: background 0.15s;
    &:hover { background: #f8fafc; }
  }
  .dfr-danger-btn {
    padding: 0.5rem 1.15rem;
    border: none;
    border-radius: 10px;
    background: #dc2626;
    color: #fff;
    font-size: 0.85rem;
    font-weight: 700;
    cursor: pointer;
    font-family: inherit;
    transition: background 0.15s, opacity 0.15s;
    &:hover:not(:disabled) { background: #b91c1c; }
    &:disabled { opacity: 0.6; cursor: not-allowed; }
  }
</style>
