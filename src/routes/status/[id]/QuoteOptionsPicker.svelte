<script lang="ts">
  /**
   * QuoteOptionsPicker — the client's choice on a quote that offers options.
   *
   *   required groups → packages, exactly ONE is chosen (radio)
   *   optional groups → add-ons, each ticked independently (checkbox)
   *   fixed groups    → always billed, shown as "included", never a choice
   *
   * Each option shows its own price and the running total is only what is
   * selected — never the sum of every option offered. Shared by the classic
   * quote view and the block-based proposal (BlockRenderer `quoteTable`), so a
   * quote with options is presented the same way wherever the client sees it.
   */
  import { renderMarkdown } from './renderMarkdown.ts';

  export let groups: any[] = [];
  export let currency = 'USD';
  /** The chosen package (bind). */
  export let selectedRequiredGroupId = '';
  /** The ticked add-ons (bind). Reassigned, never mutated, so Svelte reacts. */
  export let selectedOptionalGroupIds: Set<string> = new Set();
  /** True once accepted: the choice is shown but can no longer change. */
  export let locked = false;

  $: requiredGroups = groups.filter((g) => g.role === 'required');
  $: optionalGroups = groups.filter((g) => g.role === 'optional');
  $: fixedGroups = groups.filter((g) => g.role === 'fixed');

  function groupClientTotal(g: any): number {
    return (Array.isArray(g?.lineItems) ? g.lineItems : []).reduce(
      (sum: number, li: any) => sum + (li.clientPrice ?? li.amount ?? 0),
      0,
    );
  }

  function toggleOptionalGroup(groupId: string) {
    const next = new Set(selectedOptionalGroupIds);
    next.has(groupId) ? next.delete(groupId) : next.add(groupId);
    selectedOptionalGroupIds = next;
  }

  $: liveTotal = [
    ...fixedGroups,
    ...requiredGroups.filter((g) => g.groupId === selectedRequiredGroupId),
    ...optionalGroups.filter((g) => selectedOptionalGroupIds.has(g.groupId)),
  ].reduce((sum, g) => sum + groupClientTotal(g), 0);

  // Unique per instance so two pickers on one page never share a radio group.
  const radioName = `qv-required-group-${Math.random().toString(36).slice(2, 8)}`;

  function formatCurrency(amount: number, cur: string): string {
    return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${cur}`;
  }
</script>

<div class="qv-groups">
  {#if fixedGroups.length > 0}
    <!-- Fixed groups: always billed, never a choice. Plain, non-interactive
         "included in every quote" rows. -->
    <p class="qv-groups-heading">Included in every quote</p>
    <div class="qv-groups-list">
      {#each fixedGroups as g (g.groupId)}
        <div class="qv-group qv-group--fixed">
          <span class="qv-group__marker qv-group__marker--fixed" aria-hidden="true">🔒</span>
          <span class="qv-group__body">
            <span class="qv-group__top">
              <span class="qv-group__title">{g.title}</span>
              <span class="qv-group__price">{formatCurrency(groupClientTotal(g), currency)}</span>
            </span>
            {#if g.description}
              <div class="qv-group__desc md-prose">{@html renderMarkdown(g.description)}</div>
            {/if}
          </span>
        </div>
      {/each}
    </div>
  {/if}


  {#if requiredGroups.length > 0}

    <p class="qv-groups-heading">
      {requiredGroups.length > 1 ? 'Choose your package' : 'Your package'}
    </p>
    <div class="qv-groups-list" role="radiogroup" aria-label="Choose your package">
      {#each requiredGroups as g (g.groupId)}
        <label class="qv-group" class:qv-group--active={selectedRequiredGroupId === g.groupId}>
          <input
            type="radio"
            class="qv-group__input"
            name={radioName}
            value={g.groupId}
            checked={selectedRequiredGroupId === g.groupId}
            disabled={locked}
            on:change={() => (selectedRequiredGroupId = g.groupId)}
          />
          <span class="qv-group__marker qv-group__marker--radio" aria-hidden="true"></span>
          <span class="qv-group__body">
            <span class="qv-group__top">
              <span class="qv-group__title">{g.title}</span>
              <span class="qv-group__price">{formatCurrency(groupClientTotal(g), currency)}</span>
            </span>
            {#if g.description}
              <div class="qv-group__desc md-prose">{@html renderMarkdown(g.description)}</div>
            {/if}
          </span>
        </label>
      {/each}
    </div>
  {/if}

  {#if optionalGroups.length > 0}
    <p class="qv-groups-heading qv-groups-heading--addons">Optional add-ons</p>
    <div class="qv-groups-list">
      {#each optionalGroups as g (g.groupId)}
        <label class="qv-group" class:qv-group--active={selectedOptionalGroupIds.has(g.groupId)}>
          <input
            type="checkbox"
            class="qv-group__input"
            checked={selectedOptionalGroupIds.has(g.groupId)}
            disabled={locked}
            on:change={() => toggleOptionalGroup(g.groupId)}
          />
          <span class="qv-group__marker qv-group__marker--check" aria-hidden="true"></span>
          <span class="qv-group__body">
            <span class="qv-group__top">
              <span class="qv-group__title">{g.title}</span>
              <span class="qv-group__price">+{formatCurrency(groupClientTotal(g), currency)}</span>
            </span>
            {#if g.description}
              <div class="qv-group__desc md-prose">{@html renderMarkdown(g.description)}</div>
            {/if}
          </span>
        </label>
      {/each}
    </div>
  {/if}

  <div class="qv-live-total">
    <span class="qv-live-total__label">Selected total</span>
    <span class="qv-live-total__value">{formatCurrency(liveTotal, currency)}</span>
  </div>
</div>

<style>
  /* ── Phase 5 — package / add-on selection cards ───────────────────────── */
  .qv-groups { margin-bottom: 24px; }
  .qv-groups-heading {
    font-size: 11px;
    font-weight: 700;
    color: #475569;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    margin: 0 0 10px;
  }
  .qv-groups-heading--addons { margin-top: 22px; }
  /* Space each section (included → packages → add-ons) from the one above. */
  .qv-groups-list + .qv-groups-heading { margin-top: 22px; }
  .qv-groups-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .qv-group {
    display: flex;
    align-items: flex-start;
    gap: 13px;
    padding: 14px 16px;
    background: #ffffff;
    border: 1.5px solid #e2e8f0;
    border-radius: 14px;
    cursor: pointer;
    transition: border-color 0.18s cubic-bezier(0.22, 0.61, 0.36, 1),
                background 0.18s cubic-bezier(0.22, 0.61, 0.36, 1),
                box-shadow 0.18s cubic-bezier(0.22, 0.61, 0.36, 1),
                transform 0.18s cubic-bezier(0.22, 0.61, 0.36, 1);
  }
  /* Brand teal sourced from the global design tokens (global.scss) per the
     style bible — `--color-highlight-2` (#02b5bb) + its rgb channel token. */
  .qv-group:hover {
    border-color: rgba(var(--color-highlight-2-rgb), 0.45);
    box-shadow: 0 6px 18px -8px rgba(var(--color-highlight-2-rgb), 0.4);
    transform: translateY(-1px);
  }
  .qv-group--active {
    border-color: rgba(var(--color-highlight-2-rgb), 0.6);
    background: linear-gradient(135deg, rgba(var(--color-highlight-2-rgb), 0.06) 0%, #f0fdfe 100%);
    box-shadow: 0 0 0 3px rgba(var(--color-highlight-2-rgb), 0.1);
  }
  .qv-group--active:hover {
    box-shadow: 0 0 0 3px rgba(var(--color-highlight-2-rgb), 0.1), 0 6px 18px -8px rgba(var(--color-highlight-2-rgb), 0.45);
  }
  /* Locked-in look once the quote is accepted — no pointer affordance. */
  .qv-group:has(.qv-group__input:disabled) {
    cursor: default;
    transform: none;
    box-shadow: none;
  }

  /* ── Fixed group — always billed, never a client choice (no interaction). ── */
  .qv-group--fixed {
    cursor: default;
    background: #f8fafc;
    border-style: dashed;
    border-color: #e2e8f0;
  }
  .qv-group--fixed:hover { transform: none; box-shadow: none; border-color: #e2e8f0; }
  .qv-group__marker--fixed {
    border: none;
    background: transparent;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    line-height: 1;
    filter: grayscale(0.2);
    opacity: 0.75;
  }


  /* Visually-hidden native input — the custom marker mirrors its state. */
  .qv-group__input {
    position: absolute;
    opacity: 0;
    width: 1px;
    height: 1px;
    pointer-events: none;
  }
  .qv-group__marker {
    flex-shrink: 0;
    width: 20px;
    height: 20px;
    margin-top: 1px;
    border: 2px solid #cbd5e1;
    background: #ffffff;
    transition: border-color 0.16s ease, background 0.16s ease;
    position: relative;
  }
  .qv-group__marker--radio { border-radius: 999px; }
  .qv-group__marker--check { border-radius: 6px; }
  .qv-group--active .qv-group__marker { border-color: var(--color-highlight-2); background: var(--color-highlight-2); }
  /* Radio inner dot */
  .qv-group--active .qv-group__marker--radio::after {
    content: '';
    position: absolute;
    inset: 4px;
    border-radius: 999px;
    background: #ffffff;
  }
  /* Checkbox tick */
  .qv-group--active .qv-group__marker--check::after {
    content: '';
    position: absolute;
    left: 6px;
    top: 2px;
    width: 5px;
    height: 10px;
    border: solid #ffffff;
    border-width: 0 2.5px 2.5px 0;
    transform: rotate(45deg);
  }
  .qv-group__input:focus-visible + .qv-group__marker {
    box-shadow: 0 0 0 3px rgba(var(--color-highlight-2-rgb), 0.3);
  }
  .qv-group__input:disabled ~ .qv-group__body { opacity: 0.85; }
  .qv-group__body { flex: 1; min-width: 0; }
  .qv-group__top {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
  }
  .qv-group__title {
    font-size: 15px;
    font-weight: 700;
    color: #0f172a;
    letter-spacing: -0.01em;
  }
  .qv-group__price {
    font-size: 15px;
    font-weight: 800;
    color: #0f172a;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
  /* Staff-authored, client-visible per-group description (below the title). */
  .qv-group__desc {
    display: block;
    margin-top: 6px;
    font-size: 13px;
    color: #475569;
    line-height: 1.5;
  }
  /* Live, reactive total that updates as packages / add-ons are toggled. */
  .qv-live-total {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 18px;
    padding-top: 16px;
    border-top: 2px solid #e2e8f0;
  }
  .qv-live-total__label {
    font-size: 19px;
    font-weight: 800;
    color: #0f172a;
    letter-spacing: -0.02em;
  }
  .qv-live-total__value {
    font-size: 19px;
    font-weight: 800;
    color: #0f172a;
    letter-spacing: -0.02em;
    font-variant-numeric: tabular-nums;
  }

  @media (max-width: 640px) {
    /* Disable the hover-lift on touch so cards don't feel "stuck" after a tap. */
    .qv-group { padding: 13px 14px; }
    .qv-group:hover { transform: none; box-shadow: none; }
    .qv-group--active:hover { box-shadow: 0 0 0 3px rgba(var(--color-highlight-2-rgb), 0.1); }
    .qv-group__title,
    .qv-group__price { font-size: 14.5px; }
  }
</style>
