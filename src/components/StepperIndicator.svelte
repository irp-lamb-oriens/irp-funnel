<script lang="ts">
  /**
   * StepperIndicator.svelte — two-level progress indicator for the onboarding.
   *
   * Level 1 (form) shows which service questionnaire the user is in, derived
   * from the `serviceLabels` provided (e.g. ["International Shipping",
   * "Legal advice"]). It renders a centered section header carrying the active
   * service's name plus a "Section X of Y" counter when more than one service
   * is present, so the lead always knows which upper-level section is on
   * screen, not just which step.
   *
   * Level 2 (step) shows "Step {stepIndex + 1} of {stepCount}" plus a thin
   * progress bar. `stepCount` is expected to be >= 1; a 0/1 count still renders
   * without error.
   *
   * Styling consumes the global style-bible tokens (--color-highlight-2,
   * --font-subtitle/--font-paragraph) and reads on both the dark glass surfaces
   * (HeroForm, ServiceIntakeForm) and the light status-page shell by leaning on
   * currentColor + low-alpha borders rather than hardcoded text colors.
   */
  export let serviceLabels: string[] = [];
  export let activeServiceIndex: number = 0;
  export let stepIndex: number = 0;
  export let stepCount: number = 1;

  $: safeIndex = Math.min(Math.max(activeServiceIndex, 0), Math.max(serviceLabels.length - 1, 0));
  $: currentStep = Math.max(stepIndex, 0);
  $: totalSteps = Math.max(stepCount, 1);
  $: progressPct = Math.min(100, Math.max(0, ((currentStep + 1) / totalSteps) * 100));
  $: activeLabel = serviceLabels[safeIndex] || '';
  $: sectionCount = Math.max(serviceLabels.length, 1);
  $: sectionPosition = safeIndex + 1;
</script>

<div class="step-ind" aria-label="Form progress">
  {#if activeLabel}
    <div class="step-ind__section">
      <span class="step-ind__section-name">{activeLabel}</span>
      <span class="step-ind__section-pos">Section {sectionPosition} of {sectionCount}</span>
    </div>
  {/if}

  <div class="step-ind__forms">
    {#each serviceLabels as label, i (label)}
      <span
        class="step-ind__form-pill"
        class:step-ind__form-pill--active={i === safeIndex}
        aria-current={i === safeIndex ? 'true' : undefined}
      >
        {label}
      </span>
    {/each}
  </div>

  <div class="step-ind__step-row">
    <span class="step-ind__step-label">
      Step {currentStep + 1} of {totalSteps}
    </span>
    <div class="step-ind__bar" aria-hidden="true">
      <span class="step-ind__bar-fill" style="width: {progressPct}%"></span>
    </div>
  </div>
</div>

<style lang="scss">
  .step-ind {
    display: flex;
    flex-direction: column;
    gap: 0.7rem;
    width: 100%;
  }

  .step-ind__section {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
    text-align: center;
  }

  .step-ind__section-name {
    font-family: var(--font-subtitle, 'Spartan Black', serif);
    font-size: 1.05rem;
    font-weight: 800;
    letter-spacing: 0.04em;
    color: #fff;
  }

  .step-ind__section-pos {
    font-family: var(--font-paragraph, 'Jost'), sans-serif;
    font-size: 0.72rem;
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--color-highlight-2, #02b5bb);
  }

  .step-ind__forms {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 0.5rem;
  }

  .step-ind__form-pill {
    font-family: var(--font-subtitle, 'Spartan Black', serif);
    font-size: 0.7rem;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    padding: 0.32rem 0.7rem;
    border-radius: 999px;
    color: currentColor;
    opacity: 0.5;
    border: 1px solid currentColor;
    transition: opacity 0.2s ease, background 0.2s ease, border-color 0.2s ease;

    &--active {
      opacity: 1;
      color: #041e1e;
      background: var(--color-highlight-2, #02b5bb);
      border-color: var(--color-highlight-2, #02b5bb);
    }
  }

  .step-ind__step-row {
    display: flex;
    align-items: center;
    gap: 0.8rem;
  }

  .step-ind__step-label {
    font-family: var(--font-paragraph, 'Jost'), sans-serif;
    font-size: 0.8rem;
    font-weight: 600;
    letter-spacing: 0.02em;
    color: rgba(255,255,255,0.7);
    white-space: nowrap;
  }

  .step-ind__bar {
    flex: 1;
    height: 4px;
    border-radius: 999px;
    background: currentColor;
    opacity: 0.18;
    overflow: hidden;
  }

  .step-ind__bar-fill {
    display: block;
    height: 100%;
    border-radius: inherit;
    background: var(--color-highlight-2, #02b5bb);
    transition: width 0.35s cubic-bezier(0.23, 1, 0.32, 1);
  }

  @media (prefers-reduced-motion: reduce) {
    .step-ind__bar-fill {
      transition: none;
    }
  }
</style>