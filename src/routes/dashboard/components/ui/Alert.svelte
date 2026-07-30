<script lang="ts">
  /**
   * Alert.svelte — Centralized inline alert component.
   *
   * Replaces every bespoke `.alert-error`, `.av-msg--error`, `.qe-error`,
   * `.iem-error`, `.rfoot-error` class scattered across the dashboard with
   * ONE configurable, slot-based, token-driven component.
   *
   * Usage:
   *   <Alert type="error">Each contact needs a name.</Alert>
   *   <Alert type="success">Provider created.</Alert>
   *   <Alert type="warning" dismissible on:dismiss={handler}>Slot was taken.</Alert>
   *   <Alert type="info" compact>3 pre-existing errors (unrelated).</Alert>
   *
   * Props:
   *   type        'error' | 'success' | 'warning' | 'info'  (default: 'error')
   *   compact     boolean — smaller padding + font for inline/footer use
   *   dismissible boolean — show a ✕ close button (dispatches 'dismiss')
   *
   * Slots:
   *   default — the message content (text or rich HTML)
   *
   * Backward compatible: existing `.alert.alert-error` CSS in ProvidersView
   * still works; this component is additive (new code imports it, old code
   * keeps working until migrated).
   */
  import { createEventDispatcher } from 'svelte';

  export let type: 'error' | 'success' | 'warning' | 'info' = 'error';
  export let compact: boolean = false;
  export let dismissible: boolean = false;

  const dispatch = createEventDispatcher<{ dismiss: void }>();

  const ICON: Record<string, string> = {
    error:   '✕',
    success: '✓',
    warning: '⚠',
    info:    'ℹ',
  };
</script>

{#if $$slots.default}
  <div
    class="ui-alert ui-alert--{type}"
    class:ui-alert--compact={compact}
    role={type === 'error' ? 'alert' : 'status'}
  >
    <span class="ui-alert__icon" aria-hidden="true">{ICON[type]}</span>
    <span class="ui-alert__body"><slot /></span>
    {#if dismissible}
      <button
        type="button"
        class="ui-alert__close"
        on:click={() => dispatch('dismiss')}
        aria-label="Dismiss"
      >✕</button>
    {/if}
  </div>
{/if}

<style>
  /* ── Token-driven, cohesive with _tokens.scss ──────────────────────────── */
  .ui-alert {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 12px 16px;
    border-radius: var(--irp-r-sm, 8px);
    font-size: 13.5px;
    font-weight: 600;
    line-height: 1.5;
    font-family: var(--irp-font, inherit);
    animation: ui-alert-in 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  @keyframes ui-alert-in {
    from { opacity: 0; transform: translateY(-4px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  .ui-alert--compact {
    padding: 8px 12px;
    font-size: 12.5px;
    border-radius: var(--irp-r-xs, 6px);
  }

  /* ── Type variants ─────────────────────────────────────────────────────── */
  .ui-alert--error {
    background: linear-gradient(135deg, #fef2f2, #fff5f5);
    color: #b91c1c;
    border: 1px solid #fecaca;
    border-left: 3px solid #dc2626;
  }

  .ui-alert--success {
    background: linear-gradient(135deg, #f0fdf4, #f5fff8);
    color: #166534;
    border: 1px solid #bbf7d0;
    border-left: 3px solid #16a34a;
  }

  .ui-alert--warning {
    background: linear-gradient(135deg, #fffbeb, #fffdf5);
    color: #92400e;
    border: 1px solid #fde68a;
    border-left: 3px solid #f59e0b;
  }

  .ui-alert--info {
    background: linear-gradient(135deg, #eff6ff, #f5f8ff);
    color: #1e40af;
    border: 1px solid #bfdbfe;
    border-left: 3px solid #3b82f6;
  }

  /* ── Icon ───────────────────────────────────────────────────────────────── */
  .ui-alert__icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    font-size: 11px;
    font-weight: 800;
    flex-shrink: 0;
    line-height: 1;
  }

  .ui-alert--error   .ui-alert__icon { background: rgba(220, 38, 38, 0.12); color: #dc2626; }
  .ui-alert--success .ui-alert__icon { background: rgba(22, 163, 74, 0.12); color: #16a34a; }
  .ui-alert--warning .ui-alert__icon { background: rgba(245, 158, 11, 0.12); color: #d97706; }
  .ui-alert--info    .ui-alert__icon { background: rgba(59, 130, 246, 0.12); color: #3b82f6; }

  .ui-alert--compact .ui-alert__icon {
    width: 18px;
    height: 18px;
    font-size: 9px;
  }

  /* ── Body ───────────────────────────────────────────────────────────────── */
  .ui-alert__body {
    flex: 1;
    min-width: 0;
  }

  /* ── Dismiss button ─────────────────────────────────────────────────────── */
  .ui-alert__close {
    flex-shrink: 0;
    width: 22px;
    height: 22px;
    border-radius: 6px;
    border: none;
    background: rgba(0, 0, 0, 0.06);
    color: inherit;
    font-size: 11px;
    font-weight: 700;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0.6;
    transition: opacity 0.14s, background 0.14s;
  }
  .ui-alert__close:hover {
    opacity: 1;
    background: rgba(0, 0, 0, 0.1);
  }
</style>
