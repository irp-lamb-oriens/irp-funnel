<!--
  LilyProposalPanel.svelte — the confirmation panel above Lily's message box.

  Lily (the model) only proposes field changes. This panel gathers every pending
  proposal in the thread into one list. Staff switch each change on or off, edit
  the proposed value and press Apply (or ⌘/Ctrl+Enter). Parsing and validation
  are deterministic (lilyProposals.ts); the parent (CrmLilyTab) does the writing
  and hands back a receipt, which offers Undo.
-->
<script lang="ts">
  import { onDestroy } from 'svelte';
  import { slide } from 'svelte/transition';
  import { flip } from 'svelte/animate';
  import {
    draftOf,
    formatValue,
    isEmptyValue,
    opOf,
    parseDraft,
    readPath,
    receiptHeadline,
    sameValue,
    typeOf,
    undoPlan,
    type Decision,
    type FieldProposal,
    type ProposalRow,
    type Receipt,
  } from './lilyProposals.ts';

  /** Pending proposals, one row per field (collectPendingRows). */
  export let rows: ProposalRow[] = [];
  /** The client document, for each field's live current value. */
  export let doc: Record<string, any> | undefined = undefined;
  /** Values the server reported in a 409 conflict, by path. They win over `doc`. */
  export let overrides: Record<string, unknown> = {};
  /** Lily is replying or a save is running: nothing can be changed. */
  export let disabled = false;
  /** The proposal being written right now. */
  export let savingId: string | null = null;
  /** Save errors from the parent, keyed by proposal id. */
  export let errors: Record<string, string> = {};
  /** What the last Apply did. */
  export let receipt: Receipt | null = null;
  export let onApply: (decisions: Decision[]) => void = () => {};
  export let onDiscard: (rows: ProposalRow[]) => void = () => {};
  export let onUndo: () => void = () => {};
  export let onDismissReceipt: () => void = () => {};

  const reducedMotion =
    typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const dur = reducedMotion ? 0 : 180;
  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

  let rootEl: HTMLElement;
  let collapsed = false;
  let drafts: Record<string, string> = {};
  let included: Record<string, boolean> = {};

  // Rows Lily adds while the panel is open get a short highlight.
  let mounted = false;
  let fresh = new Set<string>();
  const timers: ReturnType<typeof setTimeout>[] = [];
  onDestroy(() => timers.forEach(clearTimeout));

  /** New proposals start switched on, with Lily's value in the editor. */
  function initRows(list: ProposalRow[]) {
    let changed = false;
    const d = { ...drafts };
    const inc = { ...included };
    const added: string[] = [];
    for (const r of list) {
      const id = r.proposal.id;
      if (!(id in d)) { d[id] = draftOf(r.proposal); changed = true; added.push(id); }
      if (!(id in inc)) { inc[id] = true; changed = true; }
    }
    if (changed) { drafts = d; included = inc; }
    if (mounted && added.length && !reducedMotion) {
      fresh = new Set([...fresh, ...added]);
      collapsed = false;
      timers.push(setTimeout(() => { fresh = new Set([...fresh].filter((id) => !added.includes(id))); }, 1600));
    }
    mounted = true;
  }
  $: initRows(rows);

  function currentOf(p: FieldProposal): unknown {
    if (p.path in overrides) return overrides[p.path];
    if (!doc) return p.oldValue;
    const live = readPath(doc, p.path);
    return live === undefined ? p.oldValue : live;
  }

  $: parsed = Object.fromEntries(rows.map((r) => [r.proposal.id, parseDraft(r.proposal, drafts[r.proposal.id] ?? '')]));
  $: onCount = rows.filter((r) => included[r.proposal.id]).length;
  $: offCount = rows.length - onCount;
  $: invalidOn = rows.some((r) => included[r.proposal.id] && !parsed[r.proposal.id]?.ok);
  $: canApply = !disabled && !invalidOn && rows.length > 0;
  $: undoable = receipt ? undoPlan(receipt.items).length > 0 : false;
  $: savedLabels = receipt ? receipt.items.filter((i) => i.outcome === 'saved').map((i) => i.label) : [];

  function toggle(id: string) {
    included = { ...included, [id]: !included[id] };
  }

  function setAll(on: boolean) {
    included = Object.fromEntries(rows.map((r) => [r.proposal.id, on]));
  }

  function resetDraft(p: FieldProposal) {
    drafts = { ...drafts, [p.id]: draftOf(p) };
  }

  function setDraft(id: string, value: string) {
    drafts = { ...drafts, [id]: value };
  }

  function apply() {
    if (!canApply) return;
    onApply(rows.map((row) => {
      const res = parsed[row.proposal.id];
      return {
        row,
        include: !!included[row.proposal.id],
        value: res?.ok ? res.value : null,
        current: currentOf(row.proposal),
      };
    }));
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      apply();
    }
  }

  function onFieldKeydown(e: KeyboardEvent, p: FieldProposal) {
    if (e.key === 'Escape' && drafts[p.id] !== draftOf(p)) {
      e.stopPropagation();
      resetDraft(p);
    }
  }

  /** Open the panel and put focus on one proposal's row (from the chat's "Review"). */
  export function focusProposal(id: string) {
    collapsed = false;
    setTimeout(() => {
      const el = rootEl?.querySelector<HTMLElement>(`[data-proposal="${CSS.escape(id)}"] .lily-panel__input, [data-proposal="${CSS.escape(id)}"] .lily-switch`);
      el?.focus();
      el?.scrollIntoView({ block: 'nearest', behavior: reducedMotion ? 'auto' : 'smooth' });
    }, dur);
  }

  function inputType(p: FieldProposal): string {
    const t = typeOf(p);
    return t === 'number' ? 'number' : t === 'date' ? 'date' : 'text';
  }
</script>

{#if rows.length || receipt}
  <!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
  <section
    class="lily-panel"
    aria-label="Field changes proposed by Lily"
    bind:this={rootEl}
    on:keydown={onKeydown}
    transition:slide={{ duration: dur }}
  >
    {#if receipt}
      <div class="lily-receipt" class:lily-receipt--warn={receipt.items.some((i) => i.outcome === 'failed') || receipt.undo === 'failed'} role="status" aria-live="polite">
        <span class="lily-receipt__icon" aria-hidden="true">{receipt.undo === 'done' ? '↺' : '✓'}</span>
        <div class="lily-receipt__text">
          <strong>{receipt.undo === 'done' ? 'Changes reverted' : receiptHeadline(receipt.items)}</strong>
          {#if receipt.undo === 'failed'}
            <span class="lily-receipt__sub">{receipt.undoError || 'Some changes could not be reverted.'}</span>
          {:else if receipt.undo !== 'done' && savedLabels.length}
            <span class="lily-receipt__sub">{savedLabels.join(', ')}</span>
          {/if}
        </div>
        {#if undoable && receipt.undo === 'idle'}
          <button type="button" class="lily-panel__btn" disabled={disabled} on:click={onUndo}>Undo</button>
        {:else if receipt.undo === 'working'}
          <span class="lily-receipt__sub" role="status">Reverting…</span>
        {/if}
        <button type="button" class="lily-panel__icon-btn" aria-label="Dismiss" on:click={onDismissReceipt}>×</button>
      </div>
    {/if}

    {#if rows.length}
      <header class="lily-panel__head">
        <button
          type="button"
          class="lily-panel__toggle"
          aria-expanded={!collapsed}
          aria-controls="lily-panel-body"
          on:click={() => (collapsed = !collapsed)}
        >
          <span class="lily-panel__spark" aria-hidden="true">
            <img src="/lili.png" alt="" class="lily-panel__avatar" />
          </span>
          <span class="lily-panel__title">Lily proposes</span>
          <span class="lily-panel__count">{rows.length}</span>
          <span class="lily-panel__chevron" class:lily-panel__chevron--closed={collapsed} aria-hidden="true">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
          </span>
        </button>

        {#if collapsed}
          <span class="lily-panel__peek" aria-hidden="true">
            {#each rows.slice(0, 3) as r (r.proposal.id)}<span class="lily-panel__peek-chip">{r.proposal.label}</span>{/each}
            {#if rows.length > 3}<span class="lily-panel__peek-more">+{rows.length - 3}</span>{/if}
          </span>
          <!-- An invalid value is only visible when open: clicking opens the list instead. -->
          <button
            type="button"
            class="lily-panel__btn lily-panel__btn--primary"
            disabled={disabled}
            title={invalidOn ? 'A value needs fixing first' : undefined}
            on:click={() => (invalidOn ? (collapsed = false) : apply())}
          >
            {invalidOn ? 'Review' : onCount ? `Apply ${onCount}` : 'Skip all'}
          </button>
        {:else if rows.length > 1}
          <button type="button" class="lily-panel__link" {disabled} on:click={() => setAll(offCount > 0)}>
            {offCount > 0 ? 'Turn all on' : 'Turn all off'}
          </button>
        {/if}
      </header>

      {#if !collapsed}
        <div id="lily-panel-body" transition:slide={{ duration: dur }}>
          <ul class="lily-panel__list">
            {#each rows as row (row.proposal.id)}
              {@const p = row.proposal}
              {@const on = !!included[p.id]}
              {@const current = currentOf(p)}
              {@const res = parsed[p.id]}
              <li
                class="lily-panel__row"
                class:lily-panel__row--off={!on}
                class:lily-panel__row--fresh={fresh.has(p.id)}
                class:lily-panel__row--saving={savingId === p.id}
                data-proposal={p.id}
                animate:flip={{ duration: dur }}
                transition:slide={{ duration: dur }}
              >
                <button
                  type="button"
                  role="switch"
                  aria-checked={on}
                  aria-label={`Include the change to ${p.label}`}
                  class="lily-switch"
                  class:lily-switch--on={on}
                  {disabled}
                  on:click={() => toggle(p.id)}
                ><span class="lily-switch__knob"></span></button>

                <div class="lily-panel__field">
                  <span class="lily-panel__label">
                    {p.label}
                    {#if opOf(p) === 'clear'}<span class="lily-panel__badge lily-panel__badge--clear">Clear</span>
                    {:else if isEmptyValue(current)}<span class="lily-panel__badge">New</span>{/if}
                    {#if row.hiddenIds.length}<span class="lily-panel__hint" title="Lily proposed this field more than once; only the latest is shown.">latest of {row.hiddenIds.length + 1}</span>{/if}
                  </span>
                  <div class="lily-panel__change">
                    <span
                      class="lily-panel__old"
                      class:lily-panel__old--blank={isEmptyValue(current)}
                      title={formatValue(current)}
                    >{formatValue(current)}</span>
                    <span class="lily-panel__arrow" aria-hidden="true">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
                    </span>
                    {#if opOf(p) === 'clear'}
                      <span class="lily-panel__new lily-panel__new--blank">Empty</span>
                    {:else if typeOf(p) === 'boolean'}
                      <div class="lily-seg" role="radiogroup" aria-label={`New value for ${p.label}`}>
                        {#each [['true', 'Yes'], ['false', 'No']] as [v, text]}
                          <button
                            type="button"
                            role="radio"
                            aria-checked={drafts[p.id] === v}
                            class="lily-seg__opt lily-panel__input"
                            class:lily-seg__opt--on={drafts[p.id] === v}
                            disabled={disabled || !on}
                            on:click={() => setDraft(p.id, v)}
                          >{text}</button>
                        {/each}
                      </div>
                    {:else if typeOf(p) === 'enum' && p.options?.length}
                      <select
                        class="lily-panel__input"
                        value={drafts[p.id] ?? ''}
                        on:change={(e) => setDraft(p.id, e.currentTarget.value)}
                        on:keydown={(e) => onFieldKeydown(e, p)}
                        disabled={disabled || !on}
                        aria-label={`New value for ${p.label}`}
                      >
                        {#if !p.options.includes(drafts[p.id] ?? '')}<option value={drafts[p.id] ?? ''} disabled>{drafts[p.id] || 'Choose…'}</option>{/if}
                        {#each p.options as opt}<option value={opt}>{opt}</option>{/each}
                      </select>
                    {:else if typeOf(p) === 'text'}
                      <textarea
                        class="lily-panel__input"
                        rows="2"
                        value={drafts[p.id] ?? ''}
                        on:input={(e) => setDraft(p.id, e.currentTarget.value)}
                        on:keydown={(e) => onFieldKeydown(e, p)}
                        disabled={disabled || !on}
                        aria-label={`New value for ${p.label}`}
                        aria-invalid={on && res && !res.ok}
                      ></textarea>
                    {:else}
                      <input
                        class="lily-panel__input"
                        type={inputType(p)}
                        value={drafts[p.id] ?? ''}
                        on:input={(e) => setDraft(p.id, e.currentTarget.value)}
                        on:keydown={(e) => onFieldKeydown(e, p)}
                        disabled={disabled || !on}
                        aria-label={`New value for ${p.label}`}
                        aria-invalid={on && res && !res.ok}
                      />
                    {/if}
                    {#if opOf(p) !== 'clear' && drafts[p.id] !== draftOf(p)}
                      <button type="button" class="lily-panel__link" {disabled} on:click={() => resetDraft(p)} title="Back to Lily's value (Esc)">
                        Reset
                      </button>
                    {/if}
                  </div>
                  {#if savingId === p.id}
                    <span class="lily-panel__note" role="status"><span class="lily-spinner" aria-hidden="true"></span>Saving…</span>
                  {:else if errors[p.id]}
                    <span class="lily-panel__error" role="alert">{errors[p.id]}</span>
                  {:else if on && res && !res.ok}
                    <span class="lily-panel__error" role="alert">{res.error}</span>
                  {:else if on && res?.ok && sameValue(current, res.value)}
                    <span class="lily-panel__note" role="status">Already set to this value. Applying just marks it done.</span>
                  {/if}
                </div>
              </li>
            {/each}
          </ul>

          <footer class="lily-panel__foot">
            <span class="lily-panel__summary">
              {#if offCount}{offCount} off · will be skipped{:else}Nothing is saved until you apply{/if}
            </span>
            <div class="lily-panel__actions">
              <button type="button" class="lily-panel__btn" {disabled} on:click={() => onDiscard(rows)}>Discard all</button>
              <button type="button" class="lily-panel__btn lily-panel__btn--primary" disabled={!canApply} on:click={apply}>
                {#if savingId}<span class="lily-spinner lily-spinner--on-accent" aria-hidden="true"></span>Saving…
                {:else if onCount}Apply {onCount}{:else}Skip all{/if}
                <kbd class="lily-kbd" aria-hidden="true">{isMac ? '⌘' : 'Ctrl'}↵</kbd>
              </button>
            </div>
          </footer>
        </div>
      {/if}
    {/if}
  </section>
{/if}

<style>
  /* Same glass surface and teal accent as the chat; design tokens only. */
  .lily-panel {
    flex-shrink: 0;
    margin: 0 0.85rem 0.55rem;
    border: 1px solid var(--chat-bubble-lily-border, rgba(2,181,187,0.22));
    border-radius: var(--irp-r-md);
    background:
      linear-gradient(180deg, rgba(2,181,187,0.07), rgba(2,181,187,0) 56px),
      var(--chat-bubble-lily, rgba(255,255,255,0.05));
    box-shadow: 0 10px 28px -14px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.04);
    overflow: hidden;
  }

  /* ── Receipt (after Apply) ─────────────────────────────────────────── */
  .lily-receipt {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.5rem 0.6rem 0.5rem 0.75rem;
    background: rgba(74,222,128,0.07);
    border-bottom: 1px solid var(--chat-glass-border, rgba(255,255,255,0.07));
  }
  .lily-receipt:last-child { border-bottom: none; }
  .lily-receipt--warn { background: var(--irp-warning-bg); }
  .lily-receipt__icon {
    display: grid;
    place-items: center;
    width: 22px;
    height: 22px;
    flex: none;
    border-radius: 50%;
    background: var(--irp-green-400);
    color: var(--irp-text-inverse);
    font-size: var(--irp-fs-xs);
    font-weight: 800;
  }
  .lily-receipt--warn .lily-receipt__icon { background: var(--irp-warning-ink); }
  .lily-receipt__text { display: flex; flex-direction: column; min-width: 0; flex: 1; }
  .lily-receipt__text strong { font-size: var(--irp-fs-sm); color: var(--chat-text-primary, rgba(255,255,255,0.92)); }
  .lily-receipt__sub {
    font-size: var(--irp-fs-xs);
    color: var(--chat-text-secondary, rgba(255,255,255,0.55));
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* ── Header ─────────────────────────────────────────────────────────── */
  .lily-panel__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    padding: 0.45rem 0.6rem;
    min-height: 40px;
  }
  .lily-panel__toggle {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    padding: 0.15rem 0.25rem 0.15rem 0.1rem;
    border: none;
    border-radius: var(--irp-r-xs);
    background: none;
    font: inherit;
    cursor: pointer;
    color: var(--chat-color-lily, var(--irp-accent-ink));
  }
  .lily-panel__spark { position: relative; display: inline-flex; }
  .lily-panel__avatar {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    object-fit: cover;
    border: 1px solid var(--chat-glass-border-glow, rgba(2,181,187,0.4));
  }
  .lily-panel__title {
    font-size: var(--irp-fs-xs);
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
  .lily-panel__count {
    display: inline-grid;
    place-items: center;
    min-width: 20px;
    height: 20px;
    padding: 0 6px;
    border-radius: var(--irp-r-full);
    background: var(--chat-color-lily, var(--irp-accent));
    color: var(--irp-text-inverse);
    font-size: var(--irp-fs-2xs);
    font-weight: 800;
    font-variant-numeric: tabular-nums;
  }
  .lily-panel__chevron { display: inline-flex; color: var(--chat-text-secondary, rgba(255,255,255,0.55)); transition: transform 0.18s ease; }
  .lily-panel__chevron--closed { transform: rotate(-90deg); }

  .lily-panel__peek {
    display: flex;
    gap: 0.3rem;
    min-width: 0;
    flex: 1;
    overflow: hidden;
    mask-image: linear-gradient(90deg, black 75%, transparent);
    -webkit-mask-image: linear-gradient(90deg, black 75%, transparent);
  }
  .lily-panel__peek-chip, .lily-panel__peek-more {
    padding: 2px 8px;
    border-radius: var(--irp-r-full);
    border: 1px solid var(--chat-glass-border, rgba(255,255,255,0.1));
    font-size: var(--irp-fs-2xs);
    color: var(--chat-text-secondary, rgba(255,255,255,0.55));
    white-space: nowrap;
  }

  /* ── Rows ───────────────────────────────────────────────────────────── */
  .lily-panel__list {
    list-style: none;
    margin: 0;
    padding: 0;
    max-height: min(320px, 40vh);
    overflow-y: auto;
    border-top: 1px solid var(--chat-glass-border, rgba(255,255,255,0.07));
    scrollbar-width: thin;
    scrollbar-color: var(--chat-scrollbar-thumb, rgba(2,181,187,0.25)) transparent;
  }
  .lily-panel__row {
    position: relative;
    display: flex;
    align-items: flex-start;
    gap: 0.65rem;
    padding: 0.55rem 0.7rem;
    transition: background 0.15s ease;
  }
  .lily-panel__row + .lily-panel__row { border-top: 1px solid var(--chat-glass-border, rgba(255,255,255,0.06)); }
  .lily-panel__row:hover { background: rgba(255,255,255,0.025); }
  .lily-panel__row--off .lily-panel__field { opacity: 0.45; }
  .lily-panel__row--saving::before,
  .lily-panel__row--fresh::before {
    content: '';
    position: absolute;
    inset: 0 auto 0 0;
    width: 2px;
    background: var(--chat-color-lily, var(--irp-accent));
  }
  .lily-panel__row--fresh { animation: lily-fresh 1.6s ease-out; }
  @keyframes lily-fresh {
    0% { background: rgba(2,181,187,0.18); }
    100% { background: transparent; }
  }

  .lily-panel__field { display: flex; flex-direction: column; gap: 0.25rem; min-width: 0; flex: 1; transition: opacity 0.15s ease; }
  .lily-panel__label {
    display: inline-flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.35rem;
    font-size: var(--irp-fs-2xs);
    font-weight: 700;
    letter-spacing: 0.02em;
    color: var(--chat-text-secondary, rgba(255,255,255,0.6));
  }
  .lily-panel__badge {
    padding: 0 0.4rem;
    border-radius: var(--irp-r-full);
    background: var(--irp-accent-subtle, rgba(2,181,187,0.14));
    color: var(--chat-color-lily, var(--irp-accent-ink));
    font-size: var(--irp-fs-2xs);
    font-weight: 700;
  }
  .lily-panel__badge--clear { background: var(--irp-warning-bg); color: var(--irp-warning-ink); }
  .lily-panel__hint { font-weight: 500; color: var(--chat-text-dim, rgba(255,255,255,0.35)); }

  .lily-panel__change {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.4rem;
    font-size: var(--irp-fs-sm);
    line-height: 1.4;
  }
  .lily-panel__old {
    max-width: 38%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--chat-text-secondary, rgba(255,255,255,0.55));
    text-decoration: line-through;
    text-decoration-color: rgba(255,255,255,0.3);
  }
  .lily-panel__old--blank { text-decoration: none; color: var(--irp-text-dim); font-style: italic; }
  .lily-panel__arrow { display: inline-flex; color: var(--chat-color-lily, var(--irp-accent)); flex: none; }
  .lily-panel__new { color: var(--chat-text-primary, rgba(255,255,255,0.92)); font-weight: 600; }
  .lily-panel__new--blank { color: var(--irp-warning-ink); }

  .lily-panel__input {
    flex: 1;
    min-width: 8rem;
    padding: 0.3rem 0.55rem;
    font: inherit;
    font-size: var(--irp-fs-sm);
    font-weight: 600;
    color: var(--chat-text-primary, rgba(255,255,255,0.92));
    background: var(--chat-glass-input-bg, rgba(255,255,255,0.05));
    border: 1px solid var(--chat-glass-border, rgba(255,255,255,0.14));
    border-radius: var(--irp-r-xs);
    outline: none;
    resize: vertical;
    transition: border-color 0.15s ease, box-shadow 0.15s ease, background 0.15s ease;
  }
  .lily-panel__input:hover:not(:disabled) { border-color: rgba(255,255,255,0.24); }
  .lily-panel__input:focus,
  .lily-panel__input:focus-visible {
    outline: none;
    border-color: var(--chat-color-lily, var(--irp-accent));
    box-shadow: 0 0 0 3px rgba(2,181,187,0.2);
    background: rgba(255,255,255,0.07);
  }
  .lily-panel__input[aria-invalid='true'] { border-color: var(--irp-danger-ink); }
  .lily-panel__input:disabled { opacity: 0.6; cursor: not-allowed; }
  select.lily-panel__input { cursor: pointer; }
  select.lily-panel__input option { color: var(--irp-text); background: var(--irp-surface-2, var(--irp-surface)); }

  /* Yes / No segmented control for boolean fields. */
  .lily-seg { display: inline-flex; gap: 2px; padding: 2px; border-radius: var(--irp-r-sm); background: rgba(255,255,255,0.05); }
  .lily-seg__opt.lily-panel__input {
    flex: none;
    min-width: 3.4rem;
    border-color: transparent;
    background: transparent;
    color: var(--chat-text-secondary, rgba(255,255,255,0.55));
    cursor: pointer;
  }
  .lily-seg__opt--on.lily-panel__input { background: var(--chat-color-lily, var(--irp-accent)); color: var(--irp-text-inverse); }

  .lily-panel__error { font-size: var(--irp-fs-xs); color: var(--irp-danger-ink); font-weight: 600; }
  .lily-panel__note {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    font-size: var(--irp-fs-xs);
    color: var(--chat-text-secondary, rgba(255,255,255,0.55));
  }

  /* ── Footer ─────────────────────────────────────────────────────────── */
  .lily-panel__foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    padding: 0.5rem 0.6rem 0.5rem 0.75rem;
    border-top: 1px solid var(--chat-glass-border, rgba(255,255,255,0.07));
    background: rgba(0,0,0,0.12);
  }
  .lily-panel__summary { font-size: var(--irp-fs-xs); color: var(--chat-text-secondary, rgba(255,255,255,0.55)); }
  .lily-panel__actions { display: flex; gap: 0.4rem; flex-shrink: 0; }

  .lily-panel__btn {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    font: inherit;
    font-size: var(--irp-fs-xs);
    font-weight: 700;
    padding: 0.35rem 0.8rem;
    border-radius: var(--irp-r-sm);
    border: 1px solid var(--chat-glass-border, rgba(255,255,255,0.14));
    background: transparent;
    color: var(--chat-text-secondary, rgba(255,255,255,0.6));
    cursor: pointer;
    white-space: nowrap;
    transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease, transform 0.1s ease;
  }
  .lily-panel__btn:hover:not(:disabled) { color: var(--chat-text-primary, rgba(255,255,255,0.92)); border-color: rgba(255,255,255,0.28); }
  .lily-panel__btn:active:not(:disabled) { transform: translateY(1px); }
  .lily-panel__btn--primary {
    background: var(--chat-color-lily, var(--irp-accent));
    border-color: var(--chat-color-lily, var(--irp-accent));
    color: var(--irp-text-inverse);
    box-shadow: 0 4px 14px -6px rgba(2,181,187,0.7);
  }
  .lily-panel__btn--primary:hover:not(:disabled) { color: var(--irp-text-inverse); border-color: var(--chat-color-lily, var(--irp-accent)); filter: brightness(1.08); }
  .lily-panel__btn:disabled { opacity: 0.45; cursor: not-allowed; box-shadow: none; }

  .lily-kbd {
    padding: 0 0.3rem;
    border-radius: var(--irp-r-2xs);
    background: rgba(0,0,0,0.18);
    font: inherit;
    font-size: var(--irp-fs-2xs);
    font-weight: 600;
    opacity: 0.8;
  }

  .lily-panel__link {
    padding: 0.1rem 0.3rem;
    border: none;
    border-radius: var(--irp-r-2xs);
    background: none;
    font: inherit;
    font-size: var(--irp-fs-2xs);
    font-weight: 600;
    color: var(--chat-chip-text, var(--irp-accent-ink));
    cursor: pointer;
  }
  .lily-panel__link:hover:not(:disabled) { text-decoration: underline; }
  .lily-panel__link:disabled { opacity: 0.5; cursor: not-allowed; }

  .lily-panel__icon-btn {
    display: grid;
    place-items: center;
    width: 24px;
    height: 24px;
    flex: none;
    border: none;
    border-radius: var(--irp-r-xs);
    background: none;
    color: var(--chat-text-secondary, rgba(255,255,255,0.55));
    font-size: var(--irp-fs-md);
    cursor: pointer;
  }
  .lily-panel__icon-btn:hover { background: rgba(255,255,255,0.06); color: var(--chat-text-primary, rgba(255,255,255,0.92)); }

  .lily-panel__toggle:focus-visible,
  .lily-panel__btn:focus-visible,
  .lily-panel__link:focus-visible,
  .lily-panel__icon-btn:focus-visible {
    outline: 2px solid var(--chat-color-lily, var(--irp-accent));
    outline-offset: 2px;
  }

  /* ── Include / skip switch (same shape as FieldControl's boolean switch) ── */
  .lily-switch {
    position: relative;
    flex: none;
    width: 34px;
    height: 20px;
    margin-top: 1.05rem;
    padding: 0;
    border: none;
    border-radius: var(--irp-r-full);
    background: var(--irp-slate-300);
    cursor: pointer;
    transition: background 0.18s ease;
  }
  .lily-switch:focus-visible { outline: none; box-shadow: 0 0 0 3px rgba(2, 181, 187, 0.35); }
  .lily-switch:disabled { opacity: 0.6; cursor: not-allowed; }
  .lily-switch--on { background: var(--chat-color-lily, var(--irp-accent)); }
  .lily-switch__knob {
    position: absolute;
    top: 3px;
    left: 3px;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: var(--irp-surface);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
    transition: transform 0.18s cubic-bezier(0.3, 1.4, 0.6, 1);
  }
  .lily-switch--on .lily-switch__knob { transform: translateX(14px); }

  .lily-spinner {
    width: 11px;
    height: 11px;
    border: 2px solid rgba(255,255,255,0.25);
    border-top-color: var(--chat-color-lily, var(--irp-accent));
    border-radius: 50%;
    animation: lily-spin 0.7s linear infinite;
  }
  .lily-spinner--on-accent { border-color: rgba(0,0,0,0.2); border-top-color: var(--irp-text-inverse); }
  @keyframes lily-spin { to { transform: rotate(360deg); } }

  @media (prefers-reduced-motion: reduce) {
    .lily-panel__row--fresh { animation: none; }
    .lily-switch__knob, .lily-panel__chevron, .lily-panel__btn { transition: none; }
    .lily-spinner { animation-duration: 2s; }
  }

  @media (max-width: 520px) {
    .lily-panel { margin: 0 0.5rem 0.5rem; }
    .lily-panel__foot { flex-direction: column; align-items: stretch; }
    .lily-panel__actions { justify-content: flex-end; }
    .lily-panel__old { max-width: 100%; }
    .lily-kbd { display: none; }
  }
</style>
