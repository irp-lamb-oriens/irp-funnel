<script lang="ts">
  /**
   * EditableField.svelte
   *
   * Inline-editable field row. Click the value → it turns into an input,
   * Enter or blur saves, Escape cancels. Calls the schema-agnostic
   * `editField()` store action which:
   *   1. PATCHes /api/dashboard/clients/:id/field on the server
   *   2. Appends a `field_edit` audit row to activityLog
   *   3. Mirrors the change into local stores
   *
   * Concurrency-safe: the server refuses the write with 409 if another
   * operator changed the value since this card last loaded.
   */

  import { createEventDispatcher } from 'svelte';
  import { editField, humanizeFieldLabel } from '../store.ts';
  import { toasts } from '../toastStore.ts';

  /** Consultations doc ID. */
  export let clientId: string;
  /** Dotted/array field path, e.g. "originCity" or "consultations.0.budget". */
  export let path: string;
  /** Current value (used for both display and optimistic concurrency). */
  export let value: unknown;
  /** Optional human label override; otherwise derived via humanizeFieldLabel. */
  export let label: string | undefined = undefined;
  /** Set to true to render as a multi-line textarea. */
  export let multiline: boolean = false;
  /** Disable in-place editing and render value-only. */
  export let readonly: boolean = false;
  /** Visual variant: "row" (label + value side-by-side) or "inline" (just value). */
  export let variant: 'row' | 'inline' = 'row';
  /**
   * Placeholder string rendered when the underlying value is null/undefined/"".
   * Defaults to an em-dash so the row never visually disappears, but callers
   * may want a more specific hint (e.g. `"e.g. $5,000"` for the budget field).
   */
  export let placeholder: string = '—';

  const dispatch = createEventDispatcher<{
    saved: { path: string; oldValue: unknown; newValue: unknown };
    error: { message: string };
  }>();

  let editing = false;
  let saving = false;
  let draft: string = stringifyValue(value);
  let inputEl: HTMLInputElement | HTMLTextAreaElement | null = null;

  $: resolvedLabel = label ?? humanizeFieldLabel(path);
  $: displayValue = formatValue(value);
  $: isEmpty = value === null || value === undefined || value === '';

  function stringifyValue(v: unknown): string {
    if (v === null || v === undefined) return '';
    if (typeof v === 'string') return v;
    if (typeof v === 'number' || typeof v === 'boolean') return String(v);
    try {
      return JSON.stringify(v);
    } catch {
      return String(v);
    }
  }

  function formatValue(v: unknown): string {
    if (v === null || v === undefined || v === '') return placeholder;
    if (typeof v === 'string') return v;
    if (typeof v === 'number' || typeof v === 'boolean') return String(v);
    if (Array.isArray(v)) {
      if (v.length === 0) return '[]';
      return `[${v.length} item${v.length === 1 ? '' : 's'}]`;
    }
    if (typeof v === 'object') {
      try {
        return JSON.stringify(v);
      } catch {
        return '{…}';
      }
    }
    return String(v);
  }

  function startEdit(e?: Event) {
    if (readonly || saving) return;
    if (e) e.stopPropagation();
    draft = stringifyValue(value);
    editing = true;
    // Focus on next tick
    setTimeout(() => inputEl?.focus(), 0);
  }

  function cancelEdit() {
    editing = false;
    draft = stringifyValue(value);
  }

  async function commitEdit() {
    const original = stringifyValue(value);
    if (draft === original) {
      editing = false;
      return;
    }

    saving = true;
    try {
      // For booleans / numbers / objects, attempt JSON-parse; fall back to raw string
      let parsed: unknown = draft;
      const trimmed = draft.trim();
      if (typeof value === 'boolean' || typeof value === 'number' || (typeof value === 'object' && value !== null)) {
        try {
          parsed = JSON.parse(trimmed);
        } catch {
          parsed = draft;
        }
      } else if (trimmed === 'true' || trimmed === 'false') {
        // bare boolean string for previously-empty fields
        parsed = trimmed === 'true';
      }

      const result = await editField(clientId, path, parsed, value);
      editing = false;
      dispatch('saved', { path, oldValue: result.oldValue, newValue: result.newValue });
    } catch (err: any) {
      const msg: string = err?.message || 'Failed to save';
      toasts.error(`${resolvedLabel}: ${msg}`);
      dispatch('error', { message: msg });
      // Keep the user's edit visible so they can retry
    } finally {
      saving = false;
    }
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault();
      cancelEdit();
    } else if (e.key === 'Enter' && !multiline) {
      e.preventDefault();
      commitEdit();
    } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      commitEdit();
    }
  }
</script>

<div class="editable-field" class:editable-field--inline={variant === 'inline'} class:editable-field--editing={editing} class:editable-field--readonly={readonly}>
  {#if variant === 'row'}
    <span class="editable-field__label" title={path}>{resolvedLabel}</span>
  {/if}

  <div class="editable-field__value-wrap">
    {#if editing}
      {#if multiline}
        <textarea
          bind:this={inputEl}
          bind:value={draft}
          class="editable-field__input editable-field__input--multiline"
          on:keydown={onKey}
          on:blur={commitEdit}
          rows="3"
          disabled={saving}
        ></textarea>
      {:else}
        <input
          bind:this={inputEl}
          bind:value={draft}
          class="editable-field__input"
          on:keydown={onKey}
          on:blur={commitEdit}
          disabled={saving}
        />
      {/if}
      {#if saving}
        <span class="editable-field__spinner" aria-hidden="true"></span>
      {/if}
    {:else}
      <!-- svelte-ignore a11y-click-events-have-key-events -->
      <button
        type="button"
        class="editable-field__value"
        class:editable-field__value--empty={isEmpty}
        on:click|stopPropagation={startEdit}
        title={readonly ? 'Read-only' : 'Click to edit'}
        disabled={readonly}
      >
        {displayValue}
        {#if !readonly}<span class="editable-field__pencil" aria-hidden="true">✎</span>{/if}
      </button>
    {/if}
  </div>
</div>
