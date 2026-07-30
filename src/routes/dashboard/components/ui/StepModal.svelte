<!--
  ui/StepModal.svelte — centralized multi-step modal.

  Wraps <Modal> and adds the glowing step rail, reactive per-step validation
  gates, and side arrow navigation. Visually matches the step rail already used
  by ClientImportExportModal so every wizard in the dashboard looks identical.

  Usage:
    <script>
      $: steps = [
        { id: 'identity', label: 'Identity', valid: !!name.trim(), hint: 'Name is required.' },
        { id: 'contacts', label: 'Contacts', valid: contactsOk,    hint: 'Each contact needs a name and a valid email.' },
        { id: 'review',   label: 'Review' },
      ];
    </script>

    <StepModal
      open={showForm}
      title="New Provider"
      {steps}
      bind:current
      {submitting}
      submitLabel="Create Provider"
      error={error}
      on:close={cancel}
      on:submit={save}
      let:current
    >
      {#if current === 0}
        ...identity fields...
      {:else if current === 1}
        ...contact rows...
      {/if}
    </StepModal>

  Props:
    open        boolean  Show/hide.
    title       string   Header text.
    steps       StepDef[] { id, label, valid?, hint? }. `valid: false` gates Next.
    current     number   Active step index (bindable).
    size        Modal size preset. Default 'lg'.
    submitting  boolean  Disables nav + shows the busy label on the submit button.
    submitLabel string   Label for the final-step primary button.
    error       string   Rendered as a compact <Alert> above the nav.

  Slot props:
    current     The active step index, so the consumer can branch on it.

  Events:
    close   User dismissed the modal.
    submit  User confirmed on the final step (only fires when every step is valid).
-->
<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { fly } from 'svelte/transition';
  import Modal from './Modal.svelte';
  import Alert from './Alert.svelte';

  /** One step in the wizard. Not exported: `export` here would become a prop. */
  interface StepDef {
    id: string;
    label: string;
    /** `false` blocks Next / Submit. Absent or true means the step is complete. */
    valid?: boolean;
    /** Shown when the operator tries to advance past an invalid step. */
    hint?: string;
  }

  export let open = false;
  export let title = '';
  export let steps: StepDef[] = [];
  export let current = 0;
  export let size: 'sm' | 'md' | 'lg' | 'xl' | 'full' = 'lg';
  export let submitting = false;
  export let submitLabel = 'Save';
  export let error = '';

  const dispatch = createEventDispatcher<{ close: void; submit: void }>();

  /** Direction of the last move, so the body slides the natural way. */
  let direction: 1 | -1 = 1;
  /** Set when the operator tries to advance past an incomplete step. */
  let gateHint = '';

  const isValid = (s: StepDef | undefined): boolean => s?.valid !== false;

  $: total = steps.length;
  $: isFirst = current === 0;
  $: isLast = current === total - 1;
  $: canAdvance = isValid(steps[current]);
  $: allValid = steps.every(isValid);
  /** Fill the rail through the furthest step reached. */
  $: railProgress = total > 1 ? (current / (total - 1)) * 100 : 100;

  /** Clear the gate hint as soon as the operator fixes the step. */
  $: if (canAdvance) gateHint = '';

  function goTo(index: number) {
    if (index < 0 || index >= total || index === current) return;
    // Moving forward requires every step in between to be complete.
    if (index > current) {
      for (let i = current; i < index; i++) {
        if (!isValid(steps[i])) {
          current = i;
          gateHint = steps[i].hint || `Complete "${steps[i].label}" first.`;
          return;
        }
      }
    }
    direction = index > current ? 1 : -1;
    gateHint = '';
    current = index;
  }

  function next() {
    if (!canAdvance) {
      gateHint = steps[current]?.hint || 'Complete this step to continue.';
      return;
    }
    goTo(current + 1);
  }

  function back() {
    goTo(current - 1);
  }

  function submit() {
    const firstInvalid = steps.findIndex((s) => !isValid(s));
    if (firstInvalid !== -1) {
      direction = firstInvalid > current ? 1 : -1;
      current = firstInvalid;
      gateHint = steps[firstInvalid].hint || `Complete "${steps[firstInvalid].label}" first.`;
      return;
    }
    dispatch('submit');
  }

  function handleClose() {
    dispatch('close');
  }
</script>

<Modal {open} {title} {size} on:close={handleClose}>
  <svelte:fragment slot="header">
    <header class="sm-head">
      <div class="sm-head__text">
        <h3 class="sm-head__title">{title}</h3>
        {#if steps[current]}
          <p class="sm-head__sub">
            Step {current + 1} of {total} · {steps[current].label}
          </p>
        {/if}
      </div>
      <button class="sm-head__close" type="button" on:click={handleClose} aria-label="Close">✕</button>
    </header>

    <!-- Step rail -->
    <div class="sm-rail">
      <div class="sm-rail-track">
        <div class="sm-rail-fill" style="width: {railProgress}%"></div>
      </div>
      <div class="sm-rail-steps">
        {#each steps as step, i}
          {@const active = i === current}
          {@const passed = i < current}
          <button
            type="button"
            class="sm-rail-step"
            class:active
            class:passed
            on:click={() => goTo(i)}
            disabled={submitting}
            aria-current={active ? 'step' : undefined}
            aria-label="Go to step {i + 1}: {step.label}"
          >
            <span class="sm-rail-dot">
              {#if active}<span class="sm-rail-dot__pulse"></span>{/if}
              {passed ? '✓' : i + 1}
            </span>
            <span class="sm-rail-label">{step.label}</span>
          </button>
        {/each}
      </div>
    </div>
  </svelte:fragment>

  <!-- Body: side arrows flank the active step's fields -->
  <div class="sm-stage">
    <button
      type="button"
      class="sm-arrow sm-arrow--prev"
      on:click={back}
      disabled={isFirst || submitting}
      aria-label="Previous step"
    >‹</button>

    {#key current}
      <div class="sm-panel" in:fly={{ x: direction * 22, duration: 200 }}>
        <slot {current} />
      </div>
    {/key}

    <button
      type="button"
      class="sm-arrow sm-arrow--next"
      on:click={next}
      disabled={isLast || submitting}
      class:sm-arrow--blocked={!canAdvance}
      aria-label="Next step"
    >›</button>
  </div>

  <svelte:fragment slot="footer">
    <div class="irp-modal__footer">
      {#if error}
        <Alert type="error" compact>{error}</Alert>
      {:else if gateHint}
        <Alert type="warning" compact>{gateHint}</Alert>
      {/if}

      <div class="sm-nav">
        <button class="sm-btn sm-btn--ghost" type="button" on:click={handleClose} disabled={submitting}>
          Cancel
        </button>

        <div class="sm-nav__right">
          {#if !isFirst}
            <button class="sm-btn sm-btn--ghost" type="button" on:click={back} disabled={submitting}>
              ‹ Back
            </button>
          {/if}

          {#if isLast}
            <button
              class="sm-btn sm-btn--primary"
              type="button"
              on:click={submit}
              disabled={submitting || !allValid}
            >
              {submitting ? 'Saving…' : submitLabel}
            </button>
          {:else}
            <button
              class="sm-btn sm-btn--primary"
              type="button"
              on:click={next}
              disabled={submitting || !canAdvance}
            >
              Next ›
            </button>
          {/if}
        </div>
      </div>
    </div>
  </svelte:fragment>
</Modal>

<style>
  /* ── Header ──────────────────────────────────────────────────────────── */
  .sm-head {
    position: relative;
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    padding: 20px 24px 14px;
    background: linear-gradient(180deg, #fbfdfd 0%, #ffffff 100%);
    flex-shrink: 0;
  }
  .sm-head::before {
    content: "";
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 4px;
    background: linear-gradient(180deg, #02b5bb 0%, #0b3b3d 100%);
  }
  .sm-head__title {
    margin: 0;
    font-size: 17px;
    font-weight: 700;
    color: #111;
  }
  .sm-head__sub {
    margin: 3px 0 0;
    font-size: 12.5px;
    font-weight: 600;
    color: #64748b;
  }
  .sm-head__close {
    background: #f3f4f6;
    border: none;
    width: 32px;
    height: 32px;
    border-radius: 8px;
    font-size: 15px;
    color: #6b7280;
    cursor: pointer;
    flex-shrink: 0;
    transition: background 0.12s, color 0.12s;
  }
  .sm-head__close:hover { background: #e5e7eb; color: #111; }

  /* ── Step rail (mirrors ClientImportExportModal) ─────────────────────── */
  .sm-rail {
    padding: 0.2rem 1.8rem 0.9rem;
    border-bottom: 1px solid #eef0f2;
    background: #fff;
    flex-shrink: 0;
  }
  .sm-rail-track {
    position: relative;
    height: 3px;
    border-radius: 3px;
    background: #eef2f7;
    margin: 0 22px;
    overflow: hidden;
  }
  .sm-rail-fill {
    position: absolute;
    inset: 0;
    background: linear-gradient(90deg, #02b5bb, #4338ca);
    border-radius: 3px;
    transition: width 0.5s cubic-bezier(0.4, 0, 0.2, 1);
  }
  .sm-rail-steps {
    display: flex;
    justify-content: space-between;
    margin-top: -13px;
  }
  .sm-rail-step {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.35rem;
    opacity: 0.5;
    transition: opacity 0.25s;
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    font-family: inherit;
  }
  .sm-rail-step:disabled { cursor: default; }
  .sm-rail-step.active, .sm-rail-step.passed { opacity: 1; }
  .sm-rail-dot {
    position: relative;
    width: 26px;
    height: 26px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.72rem;
    font-weight: 800;
    background: #fff;
    border: 2px solid #e2e8f0;
    color: #94a3b8;
    transition: background 0.25s, color 0.25s, border-color 0.25s, transform 0.25s;
  }
  .sm-rail-step.active .sm-rail-dot {
    background: linear-gradient(135deg, #02b5bb, #4338ca);
    border-color: transparent;
    color: #fff;
    transform: scale(1.12);
    box-shadow: 0 4px 14px rgba(67, 56, 202, 0.35);
  }
  .sm-rail-step.passed .sm-rail-dot {
    background: #ecfeff;
    border-color: #a5f3fc;
    color: #0e7490;
  }
  .sm-rail-step:not(.active):not(:disabled):hover .sm-rail-dot {
    border-color: #02b5bb;
    color: #0e7490;
  }
  .sm-rail-dot__pulse {
    position: absolute;
    inset: -5px;
    border-radius: 50%;
    border: 2px solid #4338ca;
    opacity: 0.5;
    animation: sm-dot-pulse 1.6s ease-out infinite;
  }
  @keyframes sm-dot-pulse {
    0%   { transform: scale(0.9); opacity: 0.55; }
    100% { transform: scale(1.5); opacity: 0; }
  }
  .sm-rail-label {
    font-size: 0.72rem;
    font-weight: 700;
    color: #475569;
    letter-spacing: 0.01em;
    white-space: nowrap;
  }
  .sm-rail-step.active .sm-rail-label { color: #3730a3; }

  /* ── Stage: arrows flanking the active panel ─────────────────────────── */
  .sm-stage {
    display: grid;
    grid-template-columns: 34px 1fr 34px;
    align-items: start;
    gap: 10px;
  }
  .sm-panel { min-width: 0; }

  .sm-arrow {
    position: sticky;
    top: 40%;
    width: 34px;
    height: 34px;
    border-radius: 50%;
    border: 1px solid #e2e8f0;
    background: #fff;
    color: #475569;
    font-size: 20px;
    line-height: 1;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.15s, border-color 0.15s, color 0.15s, transform 0.15s, box-shadow 0.15s;
    box-shadow: 0 1px 3px rgba(0,0,0,0.05);
  }
  .sm-arrow:hover:not(:disabled) {
    background: rgba(2, 181, 187, 0.08);
    border-color: #02b5bb;
    color: #0b3b3d;
    transform: scale(1.08);
    box-shadow: 0 4px 12px rgba(2, 181, 187, 0.2);
  }
  .sm-arrow:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }
  /* Current step incomplete: the forward arrow reads as gated, not broken. */
  .sm-arrow--blocked:not(:disabled) {
    border-color: #fde68a;
    color: #b45309;
    background: #fffbeb;
  }
  .sm-arrow--blocked:not(:disabled):hover {
    background: #fef3c7;
    border-color: #f59e0b;
    color: #92400e;
  }

  /* ── Footer nav ──────────────────────────────────────────────────────── */
  .sm-nav {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }
  .sm-nav__right {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-left: auto;
  }

  .sm-btn {
    padding: 10px 20px;
    border-radius: 10px;
    font-weight: 600;
    font-size: 14px;
    cursor: pointer;
    font-family: inherit;
    transition: transform 0.15s ease, box-shadow 0.15s ease, background 0.15s ease, border-color 0.15s ease;
  }
  .sm-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; box-shadow: none; }

  .sm-btn--ghost {
    background: transparent;
    color: #374151;
    border: 1px solid #d1d5db;
    font-weight: 500;
  }
  .sm-btn--ghost:hover:not(:disabled) { background: #f3f4f6; border-color: #cbd5e1; }

  .sm-btn--primary {
    background: linear-gradient(135deg, #0b3b3d 0%, #060D0D 60%);
    color: #fff;
    border: none;
    box-shadow: 0 2px 8px rgba(6, 13, 13, 0.22);
  }
  .sm-btn--primary:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 6px 18px rgba(2, 181, 187, 0.28);
  }
  .sm-btn:focus-visible { outline: none; box-shadow: 0 0 0 3px rgba(2, 181, 187, 0.35); }

  @media (max-width: 640px) {
    .sm-stage { grid-template-columns: 1fr; }
    .sm-arrow { display: none; }
    .sm-rail-label { display: none; }
  }
</style>
