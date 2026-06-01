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
  /* ── Document container ─────────────────────────────────────────────── */
  .br-document {
    font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont,
      'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    color: #0f172a;
    max-width: 780px;
    margin: 0 auto;
  }

  /* ── Generic block ──────────────────────────────────────────────────── */
  .br-block {
    margin-bottom: 0;
  }

  /* ── HTML / rich-text blocks ─────────────────────────────────────────── */
  /*
   * Qwilr exports carry heavy inline CSS. We give just a sensible baseline
   * so the variable-based styles from the export can override freely.
   */
  .br-html,
  .br-heading,
  .br-banner,
  .br-accordion {
    line-height: 1.65;
    overflow-wrap: break-word;
  }

  /* ── Quote / line-items table block ─────────────────────────────────── */
  .br-quote-table {
    padding: 28px 32px;
    background: #fff;
  }

  .br-table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 20px;
  }
  .br-table thead tr { background: #f8fafc; }
  .br-table th {
    text-align: left;
    font-size: 11px;
    font-weight: 700;
    color: #94a3b8;
    padding: 10px 16px;
    border-bottom: 2px solid #f1f5f9;
    text-transform: uppercase;
    letter-spacing: 0.07em;
  }
  .br-table th:first-child { border-radius: 8px 0 0 8px; }
  .br-table th:last-child  { border-radius: 0 8px 8px 0; }
  .br-table td {
    padding: 12px 16px;
    border-bottom: 1px solid #f1f5f9;
    vertical-align: top;
  }
  .br-table tbody tr:last-child td { border-bottom: 1px solid #e2e8f0; }

  .br-amt {
    text-align: right !important;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
  .br-item-label {
    display: block;
    color: #1e293b;
    font-size: 15px;
    font-weight: 500;
  }
  .br-item-notes {
    display: block;
    color: #94a3b8;
    font-size: 12px;
    margin-top: 3px;
  }

  /* ── Total row ────────────────────────────────────────────────────────── */
  .br-total-row td {
    padding-top: 16px;
    padding-bottom: 10px;
    font-size: 19px;
    font-weight: 800;
    color: #0f172a;
    border-top: 2px solid #e2e8f0;
    border-bottom: none;
    letter-spacing: -0.02em;
  }

  /* ── Providers ────────────────────────────────────────────────────────── */
  .br-providers { margin-bottom: 20px; }
  .br-providers-label {
    font-size: 11px;
    font-weight: 700;
    color: #94a3b8;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin: 0 0 8px;
  }
  .br-provider-tag {
    display: inline-flex;
    align-items: center;
    background: #f0fdf4;
    border: 1px solid #bbf7d0;
    color: #059669;
    font-size: 12.5px;
    font-weight: 600;
    padding: 4px 12px;
    border-radius: 999px;
    margin-right: 6px;
    margin-bottom: 6px;
  }

  /* ── Notes card ───────────────────────────────────────────────────────── */
  .br-notes-card {
    background: #f8fafc;
    border-radius: 10px;
    padding: 14px 18px;
    border-left: 3px solid #02b6bc;
  }
  .br-notes-label {
    font-size: 11px;
    font-weight: 700;
    color: #94a3b8;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin: 0 0 6px;
  }
  .br-notes-text {
    margin: 0;
    color: #334155;
    font-size: 14px;
    line-height: 1.65;
  }

  /* ── Accept block ─────────────────────────────────────────────────────── */
  .br-accept {
    padding: 28px 40px 36px;
    background: #fafbff;
    border-top: 2px solid #e2e8f0;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .br-accept-intro {
    font-size: 13.5px;
    color: #475569;
    line-height: 1.65;
    margin: 0;
  }

  .br-name-input {
    width: 100%;
    padding: 13px 16px;
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    font-size: 15px;
    box-sizing: border-box;
    background: #ffffff;
    color: #0f172a;
    font-family: inherit;
    outline: none;
    transition: border-color 0.15s, box-shadow 0.15s;
  }
  .br-name-input::placeholder { color: #94a3b8; }
  .br-name-input:focus {
    border-color: #02b6bc;
    box-shadow: 0 0 0 3px rgba(2, 182, 188, 0.12);
  }

  .br-accept-btn {
    background: linear-gradient(135deg, #02b6bc 0%, #0284c7 100%);
    color: #fff;
    border: none;
    padding: 0 32px;
    height: 56px;
    border-radius: 999px;
    font-size: 17px;
    font-weight: 800;
    cursor: pointer;
    width: 100%;
    letter-spacing: -0.01em;
    box-shadow: 0 4px 14px rgba(2, 182, 188, 0.40);
    transition: box-shadow 0.2s, transform 0.2s, filter 0.2s;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
  }
  .br-accept-btn:hover:not(:disabled) {
    box-shadow: 0 8px 28px rgba(2, 182, 188, 0.52);
    transform: translateY(-2px);
    filter: brightness(1.07);
  }
  .br-accept-btn:active:not(:disabled) {
    transform: translateY(0);
    filter: brightness(0.97);
    box-shadow: 0 2px 8px rgba(2, 182, 188, 0.32);
  }
  .br-accept-btn:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }

  .br-error-msg {
    color: #dc2626;
    font-size: 13px;
    margin: 0;
    background: #fef2f2;
    border: 1px solid #fecaca;
    padding: 9px 14px;
    border-radius: 8px;
    font-weight: 600;
  }

  /* ── Accepted confirmation ────────────────────────────────────────────── */
  .br-accepted {
    text-align: center;
    padding: 28px 24px;
    background: linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%);
    border-radius: 12px;
    border: 1px solid #bbf7d0;
  }
  .br-accepted p {
    margin: 0 0 6px;
    font-size: 20px;
    color: #059669;
    font-weight: 800;
    letter-spacing: -0.02em;
  }
  .br-accepted-sub {
    font-size: 14px;
    color: #64748b;
    line-height: 1.55;
  }

  /* ── Optional items hint ─────────────────────────────────────────────── */
  .br-optional-hint {
    font-size: 0.8rem;
    color: #64748b;
    background: #f0fdf9;
    border: 1px solid #99f6e4;
    border-radius: 8px;
    padding: 10px 14px;
    margin-bottom: 14px;
    line-height: 1.55;
  }

  /* ── Selection column ────────────────────────────────────────────────── */
  .br-sel-col {
    width: 42px;
    text-align: center;
    padding: 10px 8px !important;
    vertical-align: middle !important;
  }

  /* ── Checkbox ─────────────────────────────────────────────────────────── */
  .br-checkbox {
    width: 24px;
    height: 24px;
    border-radius: 6px;
    border: 2px solid #e2e8f0;
    background: #fff;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 13px;
    font-weight: 800;
    color: #059669;
    transition: background 0.14s, border-color 0.14s, box-shadow 0.14s;
  }
  .br-checkbox--checked {
    background: #f0fdf4;
    border-color: #059669;
    box-shadow: 0 0 0 2px rgba(5, 150, 105, 0.10);
  }
  .br-checkbox:hover:not(.br-checkbox--checked) {
    border-color: #02b6bc;
    background: #f0fdfe;
  }

  .br-required-lock {
    font-size: 13px;
    opacity: 0.55;
    display: block;
    text-align: center;
  }

  /* ── Interactive row states ──────────────────────────────────────────── */
  .br-item-row--optional { cursor: pointer; }
  .br-item-row--optional:hover { background: #fafbff; }
  .br-item-row--unselected { opacity: 0.5; }
  .br-item-row--unselected:hover { opacity: 0.7; }

  /* ── Label dim when unselected ───────────────────────────────────────── */
  .br-item-label--dim {
    color: #94a3b8;
    text-decoration: line-through;
    text-decoration-color: #cbd5e1;
  }

  .br-optional-tag {
    display: inline-block;
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: #94a3b8;
    background: #f1f5f9;
    border-radius: 4px;
    padding: 1px 6px;
    margin-left: 6px;
    vertical-align: middle;
    text-decoration: none;
  }

  .br-amt-dim { color: #94a3b8 !important; text-decoration: line-through; }

  /* ── Mobile ───────────────────────────────────────────────────────────── */
  @media (max-width: 640px) {
    .br-quote-table { padding: 20px 18px; }
    .br-table th,
    .br-table td { padding: 10px; }
    .br-accept { padding: 20px 18px 24px; }
    .br-accept-btn { font-size: 15px; height: 50px; }
  }
</style>
