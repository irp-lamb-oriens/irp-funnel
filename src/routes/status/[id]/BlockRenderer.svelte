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
   * Backward compatibility guarantee:
   *   If blocks is empty or absent, QuoteView never mounts this component.
   *   This component never touches legacy fields.
   */

  import { createEventDispatcher } from 'svelte';
  import type { Quote, QuoteBlock } from '../../dashboard/store.ts';
  import { sanitizeHtml } from './sanitizeHtml.ts';

  export let blocks: QuoteBlock[];
  export let quote: Quote;
  export let accepted: boolean;
  export let accepting: boolean;
  export let acceptError: string;

  // Internal only — BlockRenderer owns the input value for the accept block
  let acceptedByInput = '';

  const dispatch = createEventDispatcher<{
    accept: { acceptedBy: string; selectedLineItemIds: string[] }
  }>();

  // ── Phase 3: interactive line-item selection ─────────────────────────────
  // Required items (isOptional = false/absent) are always selected.
  // Optional items start unchecked — client toggles them in the quoteTable.
  // Reassignment (not mutation) drives Svelte reactivity.
  let _selectedIds: Set<string> = new Set(
    quote.lineItems.filter(li => !li.isOptional).map(li => li.lineId),
  );

  $: hasOptionalItems = quote.lineItems.some(li => !!li.isOptional);

  /**
   * Dynamic total: sum of all selected (checked) line items.
   * Recalculates every time _selectedIds is reassigned.
   */
  $: dynamicTotal = quote.lineItems.reduce((sum, li) => {
    return _selectedIds.has(li.lineId) ? sum + li.amount : sum;
  }, 0);

  function toggleItem(lineId: string, isOptional: boolean) {
    if (!isOptional) return; // required items cannot be deselected
    const next = new Set(_selectedIds);
    if (next.has(lineId)) next.delete(lineId);
    else next.add(lineId);
    _selectedIds = next; // reassign triggers $: reactivity
  }

  function fmt(amount: number, currency: string): string {
    return `$${amount.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} ${currency}`;
  }

  function handleAcceptClick() {
    dispatch('accept', {
      acceptedBy: acceptedByInput,
      selectedLineItemIds: [..._selectedIds],
    });
  }
</script>

<div class="br-document">
  {#each blocks as block (block.id)}

    {#if block.type === 'html' && block.html}
      <!-- ── Free-form HTML block — Qwilr-style text sections ─────────── -->
      <div class="br-block br-html">
        {@html sanitizeHtml(block.html)}
      </div>

    {:else if block.type === 'heading' && block.html}
      <!-- ── Heading block (alternative to putting heading in html) ─────── -->
      <div class="br-block br-heading">
        {@html sanitizeHtml(block.html)}
      </div>

    {:else if block.type === 'banner' && block.html}
      <!-- ── Banner / hero block with optional background ──────────────── -->
      <div class="br-block br-banner">
        {@html sanitizeHtml(block.html)}
      </div>

    {:else if block.type === 'accordion' && block.html}
      <!-- ── Accordion / expandable sections block ─────────────────────── -->
      <div class="br-block br-accordion">
        {@html sanitizeHtml(block.html)}
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
              ☑ Marcá los servicios que querés incluir. Los servicios <strong>requeridos</strong> siempre se incluyen.
            </p>
          {/if}

          <table class="br-table">
            <thead>
              <tr>
                {#if hasOptionalItems}<th class="br-sel-col"></th>{/if}
                <th>Servicio</th>
                <th class="br-amt">Monto</th>
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
                          aria-label="{isSelected ? 'Quitar' : 'Agregar'} {item.label}"
                          title="{item.isOptional ? 'Servicio opcional — hacé click para ' + (isSelected ? 'quitar' : 'agregar') : 'Servicio requerido'}"
                        >
                          {#if isSelected}✓{:else}&thinsp;{/if}
                        </button>
                      {:else}
                        <span class="br-required-lock" title="Servicio requerido — siempre incluido">🔒</span>
                      {/if}
                    </td>
                  {/if}
                  <td>
                    <span class="br-item-label" class:br-item-label--dim={!!item.isOptional && !isSelected}>
                      {item.label}
                      {#if item.isOptional && !isSelected}<span class="br-optional-tag">Opcional</span>{/if}
                    </span>
                    {#if item.notes}
                      <span class="br-item-notes">{item.notes}</span>
                    {/if}
                  </td>
                  <td class="br-amt" class:br-amt-dim={!!item.isOptional && !isSelected}>
                    {fmt(item.amount, item.currency)}
                  </td>
                </tr>
              {/each}
            </tbody>
            <tfoot>
              <tr class="br-total-row">
                {#if hasOptionalItems}<td></td>{/if}
                <td><strong>Total seleccionado</strong></td>
                <td class="br-amt"><strong>{fmt(dynamicTotal, quote.currency)}</strong></td>
              </tr>
            </tfoot>
          </table>

          {#if Array.isArray(quote.providerSnapshots) && quote.providerSnapshots.length > 0}
            <div class="br-providers">
              <p class="br-providers-label">Operadores asignados</p>
              {#each quote.providerSnapshots as p}
                <span class="br-provider-tag">{p.name} · {p.country}</span>
              {/each}
            </div>
          {/if}

          {#if quote.notes}
            <div class="br-notes-card">
              <p class="br-notes-label">Nota del equipo</p>
              <p class="br-notes-text">{quote.notes}</p>
            </div>
          {/if}
        </div>
      {/if}

    {:else if block.type === 'accept'}
      <!-- ── Accept CTA block ───────────────────────────────────────────── -->
      <div class="br-block br-accept">
        {#if !accepted && quote.status !== 'client_accepted'}
          <p class="br-accept-intro">
            Al hacer clic en <strong>Aceptar cotización</strong>, confirmás que revisaste
            los precios y alcance aquí indicados y que estás de acuerdo con proceder.
          </p>
          <input
            class="br-name-input"
            type="text"
            bind:value={acceptedByInput}
            placeholder="Tu nombre completo (opcional)"
          />
          {#if acceptError}
            <p class="br-error-msg">{acceptError}</p>
          {/if}
          <button
            class="br-accept-btn"
            on:click={handleAcceptClick}
            disabled={accepting}
          >
            {accepting ? 'Procesando...' : '✅ Aceptar cotización'}
          </button>
        {:else}
          <div class="br-accepted">
            <p>🎉 <strong>¡Cotización aceptada!</strong></p>
            <p class="br-accepted-sub">
              Nuestro equipo se pondrá en contacto para coordinar los próximos pasos.
            </p>
          </div>
        {/if}
      </div>

    {/if}
    <!-- All other block types (image, testimonials, reviews, partners, …)
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
    color: #94a3b8;
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
    color: #94a3b8;
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

  /* ── Selection column ──────────────────────────────────────────────────── */
  .br-sel-col {
    width: 44px;
    text-align: center;
    padding: 14px 8px !important;
    vertical-align: middle !important;
  }

  /* ── Custom checkbox ───────────────────────────────────────────────────── */
  .br-checkbox {
    width: 22px;
    height: 22px;
    border-radius: 7px;
    border: 2px solid #e2e8f0;
    background: #fafbfc;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    font-weight: 900;
    color: #fff;
    transition:
      background 0.15s cubic-bezier(0.34, 1.56, 0.64, 1),
      border-color 0.15s,
      box-shadow 0.15s,
      transform 0.12s cubic-bezier(0.34, 1.56, 0.64, 1);
    position: relative;
    overflow: hidden;
  }

  .br-checkbox--checked {
    background: linear-gradient(135deg, #02b6bc 0%, #0e9f8e 100%);
    border-color: #02b6bc;
    box-shadow:
      0 0 0 3px rgba(2, 182, 188, 0.15),
      0 2px 8px rgba(2, 182, 188, 0.30);
    transform: scale(1.08);
  }

  .br-checkbox:hover:not(.br-checkbox--checked) {
    border-color: #02b6bc;
    background: #f0fdfe;
    box-shadow: 0 0 0 3px rgba(2, 182, 188, 0.10);
    transform: scale(1.05);
  }

  .br-required-lock {
    font-size: 12px;
    opacity: 0.35;
    display: block;
    text-align: center;
    line-height: 1;
  }

  /* ── Interactive row states ────────────────────────────────────────────── */
  .br-item-row { transition: background 0.1s, opacity 0.2s; }
  .br-item-row--optional { cursor: pointer; }
  .br-item-row--optional:hover { background: rgba(2, 182, 188, 0.04); }
  .br-item-row--unselected { opacity: 0.45; }
  .br-item-row--unselected:hover { opacity: 0.65; }

  /* Strikethrough when deselected */
  .br-item-label--dim {
    color: #94a3b8;
    text-decoration: line-through;
    text-decoration-color: #cbd5e1;
    text-decoration-thickness: 1.5px;
  }

  .br-optional-tag {
    display: inline-block;
    font-size: 9.5px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.09em;
    color: #94a3b8;
    background: #f1f5f9;
    border-radius: 4px;
    padding: 2px 7px;
    margin-left: 7px;
    vertical-align: middle;
    text-decoration: none !important;
  }

  .br-amt-dim {
    color: #94a3b8 !important;
    text-decoration: line-through;
    text-decoration-color: #cbd5e1;
    text-decoration-thickness: 1.5px;
  }

  /* ── Provider chips ──────────────────────────────────────────────────── */
  .br-providers { margin-bottom: 20px; }
  .br-providers-label {
    font-size: 10.5px;
    font-weight: 800;
    color: #94a3b8;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    margin: 0 0 10px;
  }
  .br-provider-tag {
    display: inline-flex;
    align-items: center;
    background: rgba(2, 182, 188, 0.07);
    border: 1px solid rgba(2, 182, 188, 0.20);
    color: #0d9488;
    font-size: 12px;
    font-weight: 600;
    padding: 5px 13px;
    border-radius: 999px;
    margin-right: 6px;
    margin-bottom: 6px;
    letter-spacing: 0.01em;
  }

  /* ── Notes card ──────────────────────────────────────────────────────── */
  .br-notes-card {
    background: linear-gradient(135deg, #f8fafc 0%, #f1fdfe 100%);
    border-radius: 12px;
    padding: 16px 20px;
    border-left: 3px solid #02b6bc;
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.9);
  }
  .br-notes-label {
    font-size: 10.5px;
    font-weight: 800;
    color: #94a3b8;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    margin: 0 0 7px;
  }
  .br-notes-text {
    margin: 0;
    color: #334155;
    font-size: 14px;
    line-height: 1.7;
  }

  /* ═══════════════════════ ACCEPT CTA BLOCK ════════════════════════════ */

  .br-accept {
    padding: 32px 40px 40px;
    background: linear-gradient(180deg, #f8faff 0%, #f0fdfe 100%);
    border-top: 1px solid rgba(2, 182, 188, 0.15);
    display: flex;
    flex-direction: column;
    gap: 16px;
    position: relative;
    overflow: hidden;
  }

  /* Subtle teal glow behind accept section */
  .br-accept::before {
    content: '';
    position: absolute;
    top: -40px;
    left: 50%;
    transform: translateX(-50%);
    width: 300px;
    height: 120px;
    background: radial-gradient(ellipse, rgba(2, 182, 188, 0.08) 0%, transparent 70%);
    pointer-events: none;
  }

  .br-accept-intro {
    font-size: 13.5px;
    font-weight: 450;
    color: #475569;
    line-height: 1.7;
    margin: 0;
  }

  .br-name-input {
    width: 100%;
    padding: 14px 18px;
    border: 1.5px solid #e2e8f0;
    border-radius: 12px;
    font-size: 15px;
    font-family: inherit;
    box-sizing: border-box;
    background: #ffffff;
    color: #0f172a;
    outline: none;
    transition: border-color 0.18s, box-shadow 0.18s;
    box-shadow: 0 1px 3px rgba(0,0,0,0.04);
  }
  .br-name-input::placeholder { color: #94a3b8; }
  .br-name-input:focus {
    border-color: #02b6bc;
    box-shadow:
      0 0 0 4px rgba(2, 182, 188, 0.12),
      0 1px 3px rgba(0,0,0,0.04);
  }

  /* IRP teal Book Your Move CTA */
  .br-accept-btn {
    background: linear-gradient(135deg, #02b6bc 0%, #08a89e 60%, #0e9f8e 100%);
    color: #fff;
    border: none;
    padding: 0 36px;
    height: 58px;
    border-radius: 999px;
    font-size: 16.5px;
    font-weight: 800;
    font-family: inherit;
    letter-spacing: 0.01em;
    cursor: pointer;
    width: 100%;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    box-shadow:
      0 4px 16px rgba(2, 182, 188, 0.40),
      0 1px 0 rgba(255,255,255,0.15) inset;
    transition:
      box-shadow 0.22s cubic-bezier(0.34, 1.56, 0.64, 1),
      transform 0.18s cubic-bezier(0.34, 1.56, 0.64, 1),
      filter 0.15s;
    position: relative;
    overflow: hidden;
  }

  /* Shimmer sweep on hover */
  .br-accept-btn::after {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 60%;
    height: 100%;
    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.18), transparent);
    transition: left 0.5s ease;
    pointer-events: none;
  }

  .br-accept-btn:hover:not(:disabled) {
    box-shadow:
      0 10px 32px rgba(2, 182, 188, 0.50),
      0 1px 0 rgba(255,255,255,0.15) inset;
    transform: translateY(-2px) scale(1.01);
    filter: brightness(1.06);
  }
  .br-accept-btn:hover:not(:disabled)::after { left: 120%; }

  .br-accept-btn:active:not(:disabled) {
    transform: translateY(0) scale(0.99);
    filter: brightness(0.97);
    box-shadow: 0 4px 12px rgba(2, 182, 188, 0.35);
  }
  .br-accept-btn:disabled {
    opacity: 0.55;
    cursor: not-allowed;
    transform: none;
  }

  .br-error-msg {
    display: flex;
    align-items: center;
    gap: 8px;
    color: #dc2626;
    font-size: 13px;
    font-weight: 600;
    margin: 0;
    background: #fef2f2;
    border: 1px solid #fecaca;
    padding: 10px 16px;
    border-radius: 10px;
  }

  /* ── Accepted celebration ──────────────────────────────────────────────── */
  .br-accepted {
    text-align: center;
    padding: 32px 28px;
    background: linear-gradient(135deg, #ecfdf5 0%, #f0fdfe 100%);
    border-radius: 16px;
    border: 1px solid rgba(2, 182, 188, 0.25);
    box-shadow:
      0 4px 16px rgba(2, 182, 188, 0.12),
      inset 0 1px 0 rgba(255,255,255,0.8);
    animation: br-celebration-pop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both;
  }

  @keyframes br-celebration-pop {
    0%   { opacity: 0; transform: scale(0.9) translateY(10px); }
    100% { opacity: 1; transform: scale(1) translateY(0); }
  }

  .br-accepted p {
    margin: 0 0 6px;
    font-size: 21px;
    font-weight: 900;
    color: #0d9488;
    letter-spacing: -0.025em;
  }
  .br-accepted-sub {
    font-size: 14px;
    color: #64748b;
    line-height: 1.6;
    font-weight: 400;
  }

  /* ── Mobile ─────────────────────────────────────────────────────────────── */
  @media (max-width: 640px) {
    .br-quote-table { padding: 20px 18px; }
    .br-table th, .br-table td { padding: 11px 10px; }
    .br-accept { padding: 24px 20px 28px; }
    .br-accept-btn { font-size: 15px; height: 52px; }
  }
</style>
