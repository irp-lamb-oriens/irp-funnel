<script lang="ts">
  /**
   * BlockRenderer.svelte
   * Maps an ordered QuoteBlock[] to rendered Svelte components.
   *
   * Design contract:
   *   - `html` blocks: sanitize + {@html} (staff-authored CMS content)
   *   - `quoteTable` blocks: interactive line-items table using quote.lineItems
   *   - `accept` blocks: accept CTA; manages own acceptedByInput state,
   *     dispatches `accept` event up to QuoteView
   *   - All other block types: gracefully skipped (forward-compatible)
   *
   * Section tabs (Phase 2 — additive, backward-compatible):
   *   When blocks carry `section` labels, the parent (status +page.svelte)
   *   passes the `activeSection` prop to show only blocks belonging to that
   *   section. When `activeSection` is null/undefined OR when no blocks have
   *   sections, all blocks render in the original single-flow mode.
   *
   * Backward compatibility guarantee:
   *   If blocks is empty or absent, QuoteView never mounts this component.
   *   This component never touches legacy fields.
   */

  import { createEventDispatcher } from 'svelte';
  import type { Quote, QuoteBlock, QuoteLineItem } from '../../dashboard/store.ts';
  import { sanitizeHtml } from './sanitizeHtml.ts';
  import { renderMarkdown } from './renderMarkdown.ts';
  import { aggregateByCurrency, formatMoney } from '$lib/money.ts';
  import { buildMergeContext, renderMergeFields } from '$lib/mergeFields.ts';

  export let blocks: QuoteBlock[];
  export let quote: Quote;
  export let accepted: boolean;
  export let accepting: boolean;
  export let acceptError: string;
  /** Client/project data for merge-field substitution at render-time.
   *  Populated from the `$project` store in QuoteView. Defaults to {} (no-op). */
  export let clientSummary: Record<string, any> = {};
  /**
   * Active section id (string from block.section).
   * When provided: only blocks matching this section are rendered.
   * When null/undefined: all blocks render (legacy single-flow mode).
   * The status page Header drives this via the tabchange event.
   */
  export let activeSection: string | null = null;

  /**
   * When true, render the ENTIRE document regardless of section labels
   * (ignores `activeSection`). Used by the status page to show the full
   * proposal pre-quote, when the per-section navigation tabs aren't present.
   */
  export let showAllSections = false;

  // Internal only — BlockRenderer owns the input value for the accept block
  let acceptedByInput = '';

  // Binding-consent checkbox for the accept block (client electronic signature).
  let consentChecked = false;
  /** True when an IRP staff member is viewing — they cannot accept for the client. */
  export let isStaff = false;
  /** Link to the binding Quote Acceptance Terms page. */
  export let legalUrl = '/legal/quote-acceptance';

  const dispatch = createEventDispatcher<{
    accept: { acceptedBy: string; selectedLineItemIds: string[]; consent: boolean }
  }>();


  // ── Section filtering ─────────────────────────────────────────────────────
  // If any block has a section label → use section-filtered mode.
  // Otherwise → legacy single-flow (all blocks visible).
  $: hasSections = blocks.some(b => !!b.section);

  // Template-preview mode: the status page renders the proposal template with a
  // stub quote (quoteId === 'template-preview'). In that mode the `accept` block
  // is non-functional (no real quote/token) and would DUPLICATE the dedicated
  // "Accept" section of the portal. Hide it so there is exactly ONE acceptance
  // path for the client (no double-acceptance).
  $: isTemplatePreview = quote?.quoteId === 'template-preview';

  $: visibleBlocks = (() => {
    let bs = showAllSections
      ? blocks // full document — ignore section filtering (pre-quote proposal)
      : (hasSections && activeSection)
        ? blocks.filter(b => b.section === activeSection)
        : (hasSections && !activeSection)
          ? blocks.filter(b => !b.section) // fallback: show unsectioned blocks
          : blocks; // legacy mode: all blocks
    if (isTemplatePreview) bs = bs.filter(b => b.type !== 'accept');
    return bs;
  })();



  // ── Phase 3: interactive line-item selection ─────────────────────────────
  // Required items (isOptional = false/absent) are always selected.
  // Optional items start unchecked — client toggles them in the quoteTable.
  // Reassignment (not mutation) drives Svelte reactivity.
  let _selectedIds: Set<string> = new Set(
    quote.lineItems.filter(li => !li.isOptional).map(li => li.lineId),
  );

  $: hasOptionalItems = quote.lineItems.some(li => !!li.isOptional);

  // ── Client price helper ───────────────────────────────────────────────────
  // The server pre-computes `clientPrice` (cost + margin) on the public endpoint.
  // Provider cost (`amount`), margin % and margin mode are NEVER sent to the client.
  // For old quotes still in transition, falls back to `item.amount` (backward compat).
  function displayPrice(item: QuoteLineItem): number {
    return (item as any).clientPrice ?? item.amount ?? 0;
  }

  // Map line items so aggregateByCurrency sees client-facing prices.
  $: clientPriceItems = quote.lineItems.map(li => ({ ...li, amount: displayPrice(li) }));

  /**
   * Dynamic totals: per-currency buckets for selected line items.
   * Uses client prices (never provider cost / margin detail).
   * Recalculates every time _selectedIds is reassigned.
   */
  $: currencyBuckets = aggregateByCurrency(clientPriceItems, _selectedIds);

  /** Flat merge context derived from the client summary prop. */
  $: mergeCtx = buildMergeContext(clientSummary);

  function toggleItem(lineId: string, isOptional: boolean) {
    if (!isOptional) return; // required items cannot be deselected
    const next = new Set(_selectedIds);
    if (next.has(lineId)) next.delete(lineId);
    else next.add(lineId);
    _selectedIds = next; // reassign triggers $: reactivity
  }

  function handleAcceptClick() {
    dispatch('accept', {
      acceptedBy: acceptedByInput,
      selectedLineItemIds: [..._selectedIds],
      consent: consentChecked,
    });
  }

</script>

<div class="br-document">
  {#each visibleBlocks as block (block.id)}

    {#if block.type === 'html' && block.html}
      <!-- ── Free-form HTML block — merge-fields substituted at render-time -->
      <div class="br-block br-html">
        {@html sanitizeHtml(renderMergeFields(block.html, mergeCtx))}
      </div>

    {:else if block.type === 'heading' && block.html}
      <!-- ── Heading block ─────────────────────────────────────────────── -->
      <div class="br-block br-heading">
        {@html sanitizeHtml(renderMergeFields(block.html, mergeCtx))}
      </div>

    {:else if block.type === 'banner' && block.html}
      <!-- ── Banner / hero block ───────────────────────────────────────── -->
      <div class="br-block br-banner">
        {@html sanitizeHtml(renderMergeFields(block.html, mergeCtx))}
      </div>

    {:else if block.type === 'accordion' && block.html}
      <!-- ── Accordion / expandable sections block ─────────────────────── -->
      <div class="br-block br-accordion">
        {@html sanitizeHtml(renderMergeFields(block.html, mergeCtx))}
      </div>

    {:else if block.type === 'quoteTable'}
      <!-- ── Interactive line-items table (Phase 3) ─────────────────────
           Optional items show a checkbox the client can toggle.
           Required items are always checked (non-interactive).
           The total updates reactively as items are checked/unchecked. -->
      {#if Array.isArray(quote.lineItems) && quote.lineItems.length > 0}
        <div class="br-block br-quote-table">
          {#if hasOptionalItems}
            <p class="br-optional-hint">
              ☑ Check the services you'd like to include. <strong>Required</strong> services are always included.
            </p>
          {/if}

          <table class="br-table">
            <thead>
              <tr>
                {#if hasOptionalItems}<th class="br-sel-col"></th>{/if}
                <th>Service</th>
                <th class="br-amt">Amount</th>
              </tr>
            </thead>
            <tbody>
              {#each quote.lineItems as item (item.lineId)}
                {@const isSelected = _selectedIds.has(item.lineId)}
                <tr
                  class="br-item-row"
                  class:br-item-row--optional={!!item.isOptional}
                  class:br-item-row--unselected={!!item.isOptional && !isSelected}
                  on:click={() => toggleItem(item.lineId, !!item.isOptional)}
                >
                  {#if hasOptionalItems}
                    <td class="br-sel-col">
                      {#if item.isOptional}
                        <button
                          class="br-checkbox"
                          class:br-checkbox--checked={isSelected}
                          on:click|stopPropagation={() => toggleItem(item.lineId, true)}
                          aria-label="{isSelected ? 'Remove' : 'Add'} {item.label}"
                          title="{item.isOptional ? 'Optional service — click to ' + (isSelected ? 'remove' : 'add') : 'Required service'}"
                        >
                          {#if isSelected}✓{:else}&thinsp;{/if}
                        </button>
                      {:else}
                        <span class="br-required-lock" title="Required service — always included">🔒</span>
                      {/if}
                    </td>
                  {/if}
                  <td>
                    <span class="br-item-label" class:br-item-label--dim={!!item.isOptional && !isSelected}>
                      {item.label}
                      {#if item.isOptional && !isSelected}<span class="br-optional-tag">Optional</span>{/if}
                    </span>
                    {#if item.notes}
                      <div class="br-item-notes md-prose">{@html renderMarkdown(item.notes)}</div>
                    {/if}
                  </td>
                  <td class="br-amt" class:br-amt-dim={!!item.isOptional && !isSelected}>
                    {formatMoney(displayPrice(item), item.currency)}
                  </td>
                </tr>
              {/each}
            </tbody>
            <tfoot>
              {#each currencyBuckets as bucket, i (bucket.currency)}
                <tr class="br-total-row" class:br-total-row--first={i === 0}>
                  {#if hasOptionalItems}<td></td>{/if}
                  <td>
                    <strong>{i === 0 ? 'Selected total' : '\u00a0'}</strong>
                    {#if currencyBuckets.length > 1}
                      <span class="br-currency-badge">{bucket.currency}</span>
                    {/if}
                  </td>
                  <td class="br-amt"><strong>{formatMoney(bucket.amount, bucket.currency)}</strong></td>
                </tr>
              {/each}
              {#if currencyBuckets.length === 0}
                <tr class="br-total-row">
                  {#if hasOptionalItems}<td></td>{/if}
                  <td><strong>Selected total</strong></td>
                  <td class="br-amt"><strong>$0.00</strong></td>
                </tr>
              {/if}
            </tfoot>
          </table>

          {#if (quote as any).clientDescription}
            <div class="br-notes-card br-client-description">
              <p class="br-notes-label">About this service</p>
              <div class="br-notes-text md-prose">{@html renderMarkdown((quote as any).clientDescription)}</div>
            </div>
          {/if}
        </div>
      {:else}
        <!-- quoteTable block but quote has no line items — show placeholder in portal  -->
        <div class="br-block br-quote-table-placeholder">
          <p>💰 Pricing will appear here once your quote is prepared.</p>
        </div>
      {/if}

    {:else if block.type === 'accept'}
      <!-- ── Accept CTA block ───────────────────────────────────────────── -->
      <div class="br-block br-accept">
        {#if !accepted && quote.status !== 'client_accepted'}
          {#if isStaff}
            <div class="br-staff-notice">
              <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
              <span>You're viewing this as IRP staff. Only the client named on this project can accept the quote.</span>
            </div>
          {:else}
            <p class="br-accept-intro">
              To accept, type your <strong>full legal name</strong> and tick the box below. Accepting is a
              <a href={legalUrl} target="_blank" rel="noopener noreferrer" class="br-legal-link">legally binding agreement</a>.
            </p>
            <input
              class="br-name-input"
              type="text"
              bind:value={acceptedByInput}
              placeholder="Write Your Full Legal Name Here"
              autocomplete="name"
            />
            <label class="br-consent" class:br-consent--checked={consentChecked}>
              <input type="checkbox" class="br-consent__check" bind:checked={consentChecked} />
              <span class="br-consent__text">I confirm I am the named client and I have read and agree to the
                <a href={legalUrl} target="_blank" rel="noopener noreferrer" class="br-legal-link">binding Quote Acceptance Terms</a>.
                Typing my name and ticking this box is my electronic signature.</span>
            </label>
            {#if acceptError}
              <p class="br-error-msg">{acceptError}</p>
            {/if}
            <button
              class="br-accept-btn"
              on:click={handleAcceptClick}
              disabled={accepting || !acceptedByInput.trim() || !consentChecked}
            >
              {accepting ? 'Processing...' : '✅ Accept quote'}
            </button>
          {/if}
        {:else}


          <div class="br-accepted">
            <p>🎉 <strong>Quote accepted!</strong></p>
            <p class="br-accepted-sub">
              Your agreement is signed. One step left — <a href="#payment">reserve your move below</a>.
            </p>
          </div>
        {/if}
      </div>

    {/if}
      <!-- Providers, internal notes, costs and margin are intentionally hidden from the client.
           All other block types (image, testimonials, reviews, partners, …)
         are intentionally skipped here — forward-compatible: future deploys
         that know how to render them will replace this component. -->

  {/each}
</div>

<style>
  /* ═══════════════════════════════════════════════════════════════════════
   * BlockRenderer — Ultra-Modern IRP Design System
   * Design tokens: teal #02b6bc | font: Jost | radius: 12-16px
   * All measurements use rem/px hybrid for consistent rhythm.
   * ═══════════════════════════════════════════════════════════════════════ */

  /* ── Document root ───────────────────────────────────────────────────── */
  .br-document {
    font-family: 'Jost', 'Inter', system-ui, -apple-system, sans-serif;
    font-feature-settings: 'cv02', 'cv03', 'cv04', 'cv11';
    color: #0f172a;
    max-width: 820px;
    margin: 0 auto;
  }

  /* ── Generic block ───────────────────────────────────────────────────── */
  .br-block { margin-bottom: 0; }

  /* ── HTML / rich-text blocks (Qwilr exports carry inline CSS) ────────── */
  .br-html, .br-heading, .br-banner, .br-accordion {
    line-height: 1.7;
    overflow-wrap: break-word;
  }

  /* ── Quote table placeholder (when template shown but no quote yet) ──── */
  .br-quote-table-placeholder {
    padding: 32px 36px;
    background: #f8fafc;
    border: 1.5px dashed #e2e8f0;
    border-radius: 12px;
    text-align: center;
    color: #64748b;   /* raised from #94a3b8 (~2.5:1) → #64748b (~4.8:1) */
    font-size: 0.9rem;
  }

  /* ═══════════════ QUOTE TABLE — INTERACTIVE ════════════════════════════ */

  .br-quote-table {
    padding: 32px 36px;
    background: #ffffff;
    border-radius: 0;
  }

  /* Optional services hint bar */
  .br-optional-hint {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    font-size: 0.825rem;
    font-weight: 500;
    color: #0d9488;
    background: linear-gradient(135deg, #f0fdfe 0%, #ecfdf5 100%);
    border: 1px solid rgba(2, 182, 188, 0.2);
    border-left: 3px solid #02b6bc;
    border-radius: 10px;
    padding: 12px 16px;
    margin-bottom: 20px;
    line-height: 1.5;
  }

  /* Table skeleton */
  .br-table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 24px;
  }

  .br-table thead tr {
    background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
  }

  .br-table th {
    text-align: left;
    font-size: 10.5px;
    font-weight: 800;
    color: #475569;   /* raised from #94a3b8 (~2.5:1) → #475569 (~7.5:1) on gradient header */
    padding: 10px 16px;
    border-bottom: 2px solid #e2e8f0;
    text-transform: uppercase;
    letter-spacing: 0.1em;
  }
  .br-table th:first-child { border-radius: 10px 0 0 10px; }
  .br-table th:last-child  { border-radius: 0 10px 10px 0; }

  .br-table td {
    padding: 14px 16px;
    border-bottom: 1px solid #f1f5f9;
    vertical-align: middle;
    transition: background 0.12s;
  }
  .br-table tbody tr:last-child td { border-bottom: 1px solid #e2e8f0; }

  /* Amount column */
  .br-amt {
    text-align: right !important;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
    font-weight: 600;
    font-size: 15px;
    color: #1e293b;
  }

  /* Service label within td */
  .br-item-label {
    display: block;
    color: #1e293b;
    font-size: 14.5px;
    font-weight: 600;
    letter-spacing: -0.01em;
    line-height: 1.4;
  }
  .br-item-notes {
    display: block;
    color: #64748b;   /* raised from #94a3b8 (~2.5:1) → #64748b (~4.8:1) */
    font-size: 11.5px;
    margin-top: 3px;
    font-weight: 400;
  }

  /* ── Total row ─────────────────────────────────────────────────────────── */
  .br-total-row td {
    padding-top: 18px;
    padding-bottom: 12px;
    font-size: 20px;
    font-weight: 900;
    color: #0f172a;
    border-top: 2px solid #e2e8f0;
    border-bottom: none;
    letter-spacing: -0.025em;
  }
  .br-total-row .br-amt {
    font-size: 20px;
    font-weight: 900;
    color: #02b6bc;
  }

  /* Multi-currency badge */
  .br-currency-badge {
    display: inline-block;
    font-size: 9.5px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #0d9488;
    background: rgba(2, 182, 188, 0.09);
    border: 1px solid rgba(2, 182, 188, 0.25);
    border-radius: 5px;
    padding: 2px 6px;
    margin-left: 8px;
    vertical-align: middle;
  }

  /* ── Selection column ──────────────────────────────────────────────────── */
  .br-sel-col {
    width: 44px;
    text-align: center;
    padding: 14px 8px !important;
    vertical-align: middle !important;
  }

  /* ── Custom checkbox ───────────────────────────────────────────────────── */
  .br-checkbox {
    width: 22px; height: 22px;
    border-radius: 7px;
    border: 2px solid #e2e8f0;
    background: #fafbfc;
    cursor: pointer;
    display: inline-flex; align-items: center; justify-content: center;
    font-size: 12px; font-weight: 900; color: #fff;
    transition: background 0.15s cubic-bezier(0.34, 1.56, 0.64, 1), border-color 0.15s, box-shadow 0.15s, transform 0.12s cubic-bezier(0.34, 1.56, 0.64, 1);
    position: relative; overflow: hidden;
  }
  .br-checkbox--checked {
    background: linear-gradient(135deg, #02b6bc 0%, #0e9f8e 100%);
    border-color: #02b6bc;
    box-shadow: 0 0 0 3px rgba(2, 182, 188, 0.15), 0 2px 8px rgba(2, 182, 188, 0.30);
    transform: scale(1.08);
  }
  .br-checkbox:hover:not(.br-checkbox--checked) {
    border-color: #02b6bc; background: #f0fdfe;
    box-shadow: 0 0 0 3px rgba(2, 182, 188, 0.10); transform: scale(1.05);
  }
  .br-required-lock { font-size: 12px; opacity: 0.35; display: block; text-align: center; line-height: 1; }

  /* ── Interactive row states ────────────────────────────────────────────── */
  .br-item-row { transition: background 0.1s, opacity 0.2s; }
  .br-item-row--optional { cursor: pointer; }
  .br-item-row--optional:hover { background: rgba(2, 182, 188, 0.04); }
  .br-item-row--unselected { opacity: 0.45; }
  .br-item-row--unselected:hover { opacity: 0.65; }
  .br-item-label--dim { color: #64748b; text-decoration: line-through; text-decoration-color: #cbd5e1; text-decoration-thickness: 1.5px; }  /* #94a3b8→#64748b */
  .br-optional-tag { display: inline-block; font-size: 9.5px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.09em; color: #64748b; background: #f1f5f9; border-radius: 4px; padding: 2px 7px; margin-left: 7px; vertical-align: middle; text-decoration: none !important; }  /* #94a3b8→#64748b */
  .br-amt-dim { color: #64748b !important; text-decoration: line-through; text-decoration-color: #cbd5e1; text-decoration-thickness: 1.5px; }  /* #94a3b8→#64748b */

  /* ── Notes card ──────────────────────────────────────────────────────── */
  .br-notes-card { background: linear-gradient(135deg, #f8fafc 0%, #f1fdfe 100%); border-radius: 12px; padding: 16px 20px; border-left: 3px solid #02b6bc; box-shadow: inset 0 1px 0 rgba(255,255,255,0.9); }
  .br-notes-label { font-size: 10.5px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.1em; margin: 0 0 7px; }  /* #94a3b8→#64748b */
  .br-notes-text { margin: 0; color: #334155; font-size: 14px; line-height: 1.7; }
  .br-client-description { background: linear-gradient(135deg, #f0f9ff 0%, #f0fdfe 100%); border-left-color: #0ea5e9; margin-top: 16px; }
  .br-client-description .br-notes-label { color: #0284c7; }
  .br-client-description .br-notes-text { color: #1e293b; font-size: 14.5px; }

  /* ═══════════════════════ ACCEPT CTA BLOCK ════════════════════════════ */
  .br-accept {
    padding: 32px 40px 40px;
    background: linear-gradient(180deg, #f8faff 0%, #f0fdfe 100%);
    border-top: 1px solid rgba(2, 182, 188, 0.15);
    display: flex; flex-direction: column; gap: 16px;
    position: relative; overflow: hidden;
  }
  .br-accept::before {
    content: ''; position: absolute; top: -40px; left: 50%; transform: translateX(-50%);
    width: 300px; height: 120px;
    background: radial-gradient(ellipse, rgba(2, 182, 188, 0.08) 0%, transparent 70%);
    pointer-events: none;
  }
  .br-accept-intro { font-size: 13.5px; font-weight: 450; color: #475569; line-height: 1.7; margin: 0; }
  /* Staff notice — amber, matches the document's light theme */
  .br-staff-notice {
    display: flex; align-items: center; gap: 10px;
    font-size: 13px; font-weight: 600; color: #9a3412;
    background: linear-gradient(135deg, #fff7ed 0%, #fffbf5 100%);
    border: 1px solid #fed7aa; border-radius: 12px;
    padding: 13px 15px; margin: 0; line-height: 1.5;
  }
  .br-staff-notice svg { flex-shrink: 0; color: #ea8a3c; }
  /* Binding-consent row — teal accent, consistent with .br-accept */
  .br-consent {
    display: flex; align-items: flex-start; gap: 11px;
    padding: 13px 15px; background: #f8fafc;
    border: 1.5px solid #e2e8f0; border-radius: 12px; cursor: pointer;
    transition: border-color 0.16s ease, background 0.16s ease, box-shadow 0.16s ease;
  }
  .br-consent:hover { border-color: rgba(2, 182, 188, 0.45); background: #f0fdfe; }
  .br-consent--checked {
    border-color: rgba(2, 182, 188, 0.55);
    background: linear-gradient(135deg, rgba(2, 182, 188, 0.07) 0%, #f0fdfe 100%);
    box-shadow: 0 0 0 3px rgba(2, 182, 188, 0.1);
  }
  .br-consent__check { margin-top: 2px; width: 18px; height: 18px; accent-color: #02b6bc; flex-shrink: 0; cursor: pointer; }
  .br-consent__text { font-size: 13px; color: #475569; line-height: 1.55; }
  .br-legal-link { color: #0a7e82; font-weight: 700; text-decoration: none; border-bottom: 1px solid rgba(10, 126, 130, 0.32); transition: border-color 0.15s ease; }  /* #02b6bc→#0a7e82: passes AA (~4.7:1) */
  .br-legal-link:hover { border-color: #0a7e82; }

  .br-name-input {
    width: 100%; padding: 14px 18px; border: 1.5px solid #e2e8f0; border-radius: 12px;
    font-size: 15px; font-family: inherit; box-sizing: border-box;
    background: #ffffff; color: #0f172a; outline: none;
    transition: border-color 0.18s, box-shadow 0.18s;
    box-shadow: 0 1px 3px rgba(0,0,0,0.04);
  }
  .br-name-input::placeholder { color: #64748b; }  /* #94a3b8→#64748b */
  .br-name-input:focus { border-color: #02b6bc; box-shadow: 0 0 0 4px rgba(2, 182, 188, 0.12), 0 1px 3px rgba(0,0,0,0.04); }
  .br-accept-btn {
    background: linear-gradient(135deg, #02b6bc 0%, #08a89e 60%, #0e9f8e 100%);
    color: #fff; border: none; padding: 0 36px; height: 58px;
    border-radius: 999px; font-size: 16.5px; font-weight: 800; font-family: inherit;
    letter-spacing: 0.01em; cursor: pointer; width: 100%;
    display: inline-flex; align-items: center; justify-content: center; gap: 10px;
    box-shadow: 0 4px 16px rgba(2, 182, 188, 0.40), 0 1px 0 rgba(255,255,255,0.15) inset;
    transition: box-shadow 0.22s cubic-bezier(0.34, 1.56, 0.64, 1), transform 0.18s cubic-bezier(0.34, 1.56, 0.64, 1), filter 0.15s;
    position: relative; overflow: hidden;
  }
  .br-accept-btn::after {
    content: ''; position: absolute; top: 0; left: -100%; width: 60%; height: 100%;
    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.18), transparent);
    transition: left 0.5s ease; pointer-events: none;
  }
  .br-accept-btn:hover:not(:disabled) { box-shadow: 0 10px 32px rgba(2, 182, 188, 0.50), 0 1px 0 rgba(255,255,255,0.15) inset; transform: translateY(-2px) scale(1.01); filter: brightness(1.06); }
  .br-accept-btn:hover:not(:disabled)::after { left: 120%; }
  .br-accept-btn:active:not(:disabled) { transform: translateY(0) scale(0.99); filter: brightness(0.97); box-shadow: 0 4px 12px rgba(2, 182, 188, 0.35); }
  .br-accept-btn:disabled { opacity: 0.55; cursor: not-allowed; transform: none; }
  .br-error-msg { display: flex; align-items: center; gap: 8px; color: #dc2626; font-size: 13px; font-weight: 600; margin: 0; background: #fef2f2; border: 1px solid #fecaca; padding: 10px 16px; border-radius: 10px; }

  /* ── Accepted celebration ──────────────────────────────────────────────── */
  .br-accepted { text-align: center; padding: 32px 28px; background: linear-gradient(135deg, #ecfdf5 0%, #f0fdfe 100%); border-radius: 16px; border: 1px solid rgba(2, 182, 188, 0.25); box-shadow: 0 4px 16px rgba(2, 182, 188, 0.12), inset 0 1px 0 rgba(255,255,255,0.8); animation: br-celebration-pop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both; }
  @keyframes br-celebration-pop { 0% { opacity: 0; transform: scale(0.9) translateY(10px); } 100% { opacity: 1; transform: scale(1) translateY(0); } }
  .br-accepted p { margin: 0 0 6px; font-size: 21px; font-weight: 900; color: #0d9488; letter-spacing: -0.025em; }
  .br-accepted-sub { font-size: 14px; color: #64748b; line-height: 1.6; font-weight: 400; }

  /* ── Mobile ─────────────────────────────────────────────────────────────── */
  @media (max-width: 640px) {
    .br-quote-table { padding: 20px 18px; }
    .br-table th, .br-table td { padding: 11px 10px; }
    .br-accept { padding: 24px 20px 28px; }
    .br-accept-btn { font-size: 15px; height: 52px; }
  }
</style>
