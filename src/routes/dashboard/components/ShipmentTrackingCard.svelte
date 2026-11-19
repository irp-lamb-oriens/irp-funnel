<script lang="ts">
  /**
   * ShipmentTrackingCard.svelte
   * ─────────────────────────────────────────────────────────────────────────
   *
   * Field-agnostic, backward-compatible "Shipment & Logistics" summary card
   * shown inside the Overview tab of the Detail Panel.
   *
   * It reads optional fields from the raw consultation document — if none of
   * them are set the card simply shows a friendly "Not yet configured" state
   * and an "Activate ETA loop" CTA. No crashes, no empty cards.
   *
   * All values are read-only; the operator edits them via the Fields tab
   * (using the existing editField() schema-agnostic editor) or via the
   * three registry actions that map to this system:
   *   - ops_loading.confirm_pickup_details
   *   - ops_exporting.start_eta_loop
   *   - ops_destination_arrival.confirm_eta
   */

  import { onMount } from 'svelte';
  import { get } from 'svelte/store';
  import type { Client } from '../store.ts';
  import { fieldConfig, loadOverviewFields, type FieldConfigRow } from '../store.ts';
  import FieldControl from './FieldControl.svelte';

  export let client: Client;

  // Warm the shared Overview Field Registry once (cached across mounts) so we
  // can surface any operator-added "Logistics" fields below. Non-fatal.
  onMount(() => {
    if (get(fieldConfig).length === 0) loadOverviewFields().catch(() => {/* non-fatal */});
  });

  // ── Field readers (all optional) ─────────────────────────────────────────
  $: raw = (client as any)?.rawDoc ?? client ?? {};
  $: clientId = (client as any)?.id ?? '';
  // Index of the latest consultations[] entry — the write target for
  // consultation-scoped registry fields (mirrors DetailPanel's latestIdx).
  $: latestIdx = Math.max(
    0,
    (Array.isArray(raw?.consultations) ? raw.consultations.length : (client as any)?.consultationCount ?? 1) - 1,
  );

  // Operator-added Logistics fields from the Overview Field Registry — every
  // active `section === "logistics"` row that ISN'T a built-in seed (scheduling
  // / callOutcome / dripEnabled already render in the Overview tab). These show
  // here ALWAYS, editable, even before a value exists — so a field like
  // "Container Number (Bill of Lading)" appears the moment it's added.
  $: logisticsFields = ($fieldConfig || []).filter(
    (f) => f.section === 'logistics' && f.active !== false && !f.isSeed,
  );

  /** Dotted PATCH path for a registry field, from its scope. */
  function fieldPath(f: FieldConfigRow): string {
    return f.scope === 'root' ? f.id : `consultations.${latestIdx}.${f.id}`;
  }
  /** Read the current value for a registry field from the raw client doc. */
  function fieldValue(f: FieldConfigRow): unknown {
    return fieldPath(f)
      .split('.')
      .reduce((acc: any, k) => (acc == null ? undefined : acc[k]), raw);
  }


  // Shipment method
  $: shippingMethod        = raw.shippingMethod        ?? raw.confirmedShippingMethod        ?? null;
  $: confirmedShippingMethod = raw.confirmedShippingMethod ?? null;
  $: estimatedVolumeCBM    = raw.estimatedVolumeCBM    ?? null;
  $: confirmedVolumeCBM    = raw.confirmedVolumeCBM    ?? null;
  $: serviceScope          = raw.serviceScope          ?? null;

  // Dates
  $: moveDate              = raw.moveDate              ?? null;
  $: packingDate           = raw.packingDate           ?? null;
  $: loadingDate           = raw.loadingDate           ?? null;
  $: etd                   = raw.etd                   ?? null;
  $: eta                   = raw.eta                   ?? null;
  $: transitTimeDays       = raw.transitTimeDays       ?? null;
  $: etdConfirmedAt        = raw.etdConfirmedAt        ?? null;
  $: etaConfirmedAt        = raw.etaConfirmedAt        ?? null;

  // Agents
  $: originAgentEmail      = raw.originAgentEmail      ?? null;
  $: destinationAgentEmail = raw.destinationAgentEmail ?? null;

  // ETA loop state
  $: shipmentTracking      = raw.shipmentTracking      ?? null;
  $: loopStatus            = shipmentTracking?.status  ?? null;
  $: escalationLevel       = shipmentTracking?.escalationLevel ?? null;

  // ── Derived states ────────────────────────────────────────────────────────
  $: hasAnyData = !!(shippingMethod || estimatedVolumeCBM || moveDate || etd || eta || originAgentEmail || serviceScope);

  // Determines whether the card is "active" (ops filled in key fields)
  $: isActive = loopStatus === 'active';
  $: isArrived = loopStatus === 'arrived';

  // ── Display helpers ───────────────────────────────────────────────────────
  const METHOD_ICONS: Record<string, { icon: string; label: string }> = {
    air:       { icon: '✈️', label: 'Air Freight'  },
    land_fcl:  { icon: '🚛', label: 'Land FCL'     },
    land_ltl:  { icon: '🚛', label: 'Land LTL'     },
    ocean_fcl: { icon: '🚢', label: 'Ocean FCL'    },
    ocean_lcl: { icon: '🚢', label: 'Ocean LCL'    },
  };
  const SCOPE_LABELS: Record<string, { icon: string; label: string }> = {
    full_service:   { icon: '🛡️', label: 'Full Service (door-to-door)' },
    self_pack_load: { icon: '👥', label: 'Self-Pack + Loading Support' },
    self_pack_diy:  { icon: '👤', label: 'Self-Pack DIY'               },
  };

  function fmtDate(iso: string | null): string {
    if (!iso) return '—';
    try { return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
    catch { return iso; }
  }

  function loopStatusConfig(level: string | null, status: string | null): { color: string; dot: string; label: string } {
    if (status === 'arrived')  return { color: '#059669', dot: '🟢', label: 'ETA Confirmed — Arrived'        };
    if (status === 'paused')   return { color: '#6b7280', dot: '⏸️', label: 'Loop Paused'                     };
    if (!status)               return { color: '#9ca3af', dot: '⚪', label: 'Not activated'                   };
    if (level === 'sales')     return { color: '#dc2626', dot: '🔴', label: 'Escalated to Sales'              };
    if (level === 'ops')       return { color: '#d97706', dot: '🟠', label: 'Escalated to Ops'               };
    return                            { color: '#2563eb', dot: '🔵', label: 'Pinging Provider'               };
  }

  $: loopCfg = loopStatusConfig(escalationLevel, loopStatus);

  // Date rail nodes
  const DATE_NODES = [
    { key: 'moveDate',    label: 'Move',    icon: '🗓️'  },
    { key: 'packingDate', label: 'Packing', icon: '📦'  },
    { key: 'loadingDate', label: 'Loading', icon: '🏗️'  },
    { key: 'etd',         label: 'ETD',     icon: '🚢'  },
    { key: 'eta',         label: 'ETA',     icon: '🛬'  },
  ];
</script>

<div class="stc">
  <!-- Header -->
  <div class="stc__header">
    <span class="stc__title">📦 Shipping Details</span>
    {#if loopStatus}
      <span class="stc__loop-pill" style="--loop-color: {loopCfg.color}">
        {loopCfg.dot} {loopCfg.label}
      </span>
    {/if}
  </div>

  {#if !hasAnyData}
    <!-- Not-yet-configured hint. The fields below STILL render (empty, "—") so
         operators can always SEE the shipment + logistics fields regardless of
         whether the ETA-loop actions have run yet. -->
    <div class="stc__hint">
      No shipment milestones recorded yet — fill the logistics fields below, or use
      the <strong>Actions tab</strong> (confirm pickup details · start ETA loop).
    </div>
  {/if}

    <!-- Method + Scope row -->

    <div class="stc__row">
      <!-- Shipping method -->
      <div class="stc__cell">
        <span class="stc__cell-label">Method</span>
        <span class="stc__cell-value stc__method">
          {#if shippingMethod && METHOD_ICONS[shippingMethod]}
            {METHOD_ICONS[shippingMethod].icon} {METHOD_ICONS[shippingMethod].label}
            {#if confirmedShippingMethod}
              <span class="stc__confirmed-badge">✓ confirmed</span>
            {/if}
          {:else if shippingMethod}
            {shippingMethod}
          {:else}
            <span class="stc__na">—</span>
          {/if}
        </span>
      </div>

      <!-- Service scope -->
      <div class="stc__cell">
        <span class="stc__cell-label">Service scope</span>
        <span class="stc__cell-value">
          {#if serviceScope && SCOPE_LABELS[serviceScope]}
            {SCOPE_LABELS[serviceScope].icon} {SCOPE_LABELS[serviceScope].label}
          {:else if serviceScope}
            {serviceScope}
          {:else}
            <span class="stc__na">—</span>
          {/if}
        </span>
      </div>

      <!-- Volume -->
      <div class="stc__cell">
        <span class="stc__cell-label">Volume</span>
        <span class="stc__cell-value">
          {#if confirmedVolumeCBM}
            <strong>{confirmedVolumeCBM} m³</strong>
            <span class="stc__confirmed-badge">✓ confirmed</span>
          {:else if estimatedVolumeCBM}
            {estimatedVolumeCBM} m³ <span class="stc__na">(est.)</span>
          {:else}
            <span class="stc__na">—</span>
          {/if}
        </span>
      </div>
    </div>

    <!-- Date rail -->
    <div class="stc__date-rail">
      {#each DATE_NODES as node, i}
        {@const val = raw[node.key] ?? null}
        <div class="stc__date-node" class:stc__date-node--set={!!val}>
          <div class="stc__date-icon">{node.icon}</div>
          <div class="stc__date-label">{node.label}</div>
          <div class="stc__date-value">{fmtDate(val)}</div>
          {#if i < DATE_NODES.length - 1}
            <!-- connector line drawn via CSS -->
          {/if}
        </div>
      {/each}
    </div>

    <!-- Agents -->
    {#if originAgentEmail || destinationAgentEmail}
      <div class="stc__agents">
        {#if originAgentEmail}
          <span class="stc__agent">
            <span class="stc__agent-role">Origin agent</span>
            <a href="mailto:{originAgentEmail}" class="stc__agent-email">{originAgentEmail}</a>
          </span>
        {/if}
        {#if destinationAgentEmail}
          <span class="stc__agent">
            <span class="stc__agent-role">Destination agent</span>
            <a href="mailto:{destinationAgentEmail}" class="stc__agent-email">{destinationAgentEmail}</a>
          </span>
        {/if}
      </div>
    {/if}

    <!-- Transit time + ETA confirmation -->
    {#if transitTimeDays || etaConfirmedAt || etdConfirmedAt}
      <div class="stc__row stc__row--meta">
        {#if transitTimeDays}
          <div class="stc__cell">
            <span class="stc__cell-label">Transit time</span>
            <span class="stc__cell-value">{transitTimeDays} days</span>
          </div>
        {/if}
        {#if etdConfirmedAt}
          <div class="stc__cell">
            <span class="stc__cell-label">ETD confirmed</span>
            <span class="stc__cell-value stc__confirmed-text">{fmtDate(etdConfirmedAt)}</span>
          </div>
        {/if}
        {#if etaConfirmedAt}
          <div class="stc__cell">
            <span class="stc__cell-label">ETA confirmed</span>
            <span class="stc__cell-value stc__confirmed-text">{fmtDate(etaConfirmedAt)}</span>
          </div>
        {/if}
      </div>
    {/if}

  <!-- ── Custom Logistics fields (Overview Field Registry) ────────────────────
       Operator-added fields with section "Logistics" render here as always-
       visible editable slots — even before a value exists — so a field like
       "Container Number (Bill of Lading)" is visible + fillable regardless of
       whether any shipment action has run. -->
  {#if logisticsFields.length > 0}
    <div class="stc__custom">
      <div class="stc__custom-title">Logistics details</div>
      <div class="stc__custom-grid">
        {#each logisticsFields as f (f.id)}
          <div class="stc__custom-field">
            <span class="stc__cell-label">{f.label}</span>
            <!-- Type-aware editor: enum → dropdown, boolean → switch,
                 number → numeric input, date/datetime → calendar row, else
                 text box. Identical to how the field renders on the Overview
                 tab, so a logistics field looks the same wherever it lives. -->
            <FieldControl
              clientId={clientId}
              path={fieldPath(f)}
              value={fieldValue(f)}
              valueType={f.valueType}
              label={f.label}
              options={f.options || []}
              placeholder={f.placeholder || '—'}
              readonly={f.readOnly === true}
            />
          </div>
        {/each}
      </div>
    </div>
  {/if}
</div>


<style>
  .stc {
    background: var(--irp-surface-2);
    border: 1px solid var(--irp-line);
    border-radius: var(--irp-r-md);
    padding: 16px;
    margin: 16px 0;
    font-family: inherit;
  }

  .stc__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 14px;
    gap: 8px;
    flex-wrap: wrap;
  }

  .stc__title {
    font-size: var(--irp-fs-sm);
    font-weight: 700;
    color: var(--irp-text);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .stc__loop-pill {
    font-size: var(--irp-fs-2xs);
    font-weight: 600;
    color: var(--loop-color, var(--irp-text-2));
    background: color-mix(in srgb, var(--loop-color, var(--irp-slate-700)) 10%, white);
    border: 1px solid color-mix(in srgb, var(--loop-color, var(--irp-slate-700)) 25%, white);
    border-radius: var(--irp-r-full);
    padding: 2px 8px;
    white-space: nowrap;
  }

  /* Empty state */
  .stc__empty {
    text-align: center;
    padding: 12px 0 4px;
    color: var(--irp-text-dim);
    font-size: var(--irp-fs-sm);
    line-height: 1.5;
  }
  .stc__empty p { margin: 0 0 6px; }
  .stc__empty-hint { font-size: var(--irp-fs-xs); color: var(--irp-text-faint); }

  /* Row of cells */
  .stc__row {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
    margin-bottom: 14px;
  }
  .stc__row--meta { margin-top: 10px; }

  .stc__cell {
    flex: 1 1 120px;
    min-width: 0;
  }
  .stc__cell-label {
    display: block;
    font-size: var(--irp-fs-2xs);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--irp-text-faint);
    margin-bottom: 3px;
  }
  .stc__cell-value {
    font-size: var(--irp-fs-sm);
    color: var(--irp-text);
    display: flex;
    align-items: center;
    gap: 5px;
    flex-wrap: wrap;
  }
  .stc__method { font-size: var(--irp-fs-md); }
  .stc__na { color: var(--irp-slate-300); }

  .stc__confirmed-badge {
    font-size: var(--irp-fs-2xs);
    font-weight: 600;
    background: var(--irp-green-100);
    color: var(--irp-green-800);
    border-radius: var(--irp-r-2xs);
    padding: 1px 5px;
  }
  .stc__confirmed-text { color: var(--irp-green-600); font-weight: 600; }

  /* Date rail */
  .stc__date-rail {
    display: flex;
    gap: 0;
    align-items: flex-start;
    margin-bottom: 14px;
    overflow-x: auto;
    padding-bottom: 4px;
    position: relative;
  }
  .stc__date-node {
    flex: 1 1 0;
    min-width: 60px;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    position: relative;
  }
  /* Connector line between nodes */
  .stc__date-node + .stc__date-node::before {
    content: '';
    position: absolute;
    top: 12px;
    left: -50%;
    width: 100%;
    height: 2px;
    background: var(--irp-surface-4);
    z-index: 0;
  }
  .stc__date-node--set + .stc__date-node--set::before {
    background: var(--irp-green-200);
  }

  .stc__date-icon {
    font-size: var(--irp-fs-xl);
    margin-bottom: 4px;
    position: relative;
    z-index: 1;
    background: var(--irp-surface-2);
    padding: 0 2px;
    line-height: 1;
  }
  .stc__date-node--set .stc__date-icon {
    filter: none;
  }
  .stc__date-node:not(.stc__date-node--set) .stc__date-icon {
    opacity: 0.3;
  }

  .stc__date-label {
    font-size: var(--irp-fs-2xs);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--irp-text-faint);
    margin-bottom: 2px;
  }
  .stc__date-node--set .stc__date-label { color: var(--irp-text-2); }

  .stc__date-value {
    font-size: var(--irp-fs-2xs);
    color: var(--irp-text-dim);
    white-space: nowrap;
  }
  .stc__date-node--set .stc__date-value { color: var(--irp-text); font-weight: 600; }

  /* Agent emails */
  .stc__agents {
    display: flex;
    gap: 14px;
    flex-wrap: wrap;
    padding: 10px 12px;
    background: var(--irp-surface-3);
    border: 1px solid var(--irp-blue-200);
    border-radius: var(--irp-r-sm);
    margin-bottom: 10px;
  }
  .stc__agent {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }
  .stc__agent-role {
    font-size: var(--irp-fs-2xs);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--irp-blue-700);
  }
  .stc__agent-email {
    font-size: var(--irp-fs-xs);
    color: var(--irp-blue-500);
    text-decoration: none;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .stc__agent-email:hover { text-decoration: underline; }

  /* Not-yet-configured hint (shown above the always-rendered fields) */
  .stc__hint {
    font-size: var(--irp-fs-xs);
    line-height: 1.5;
    color: var(--irp-amber-800);
    background: var(--irp-bg);
    border: 1px solid var(--irp-amber-200);
    border-radius: var(--irp-r-sm);
    padding: 8px 12px;
    margin-bottom: 14px;
  }
  .stc__hint strong { color: var(--irp-amber-900); font-weight: 700; }

  /* Custom Logistics fields (Overview Field Registry) */
  .stc__custom {
    margin-top: 6px;
    padding-top: 12px;
    border-top: 1px dashed var(--irp-line);
  }
  .stc__custom-title {
    font-size: var(--irp-fs-2xs);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--irp-text-dim);
    margin-bottom: 10px;
  }
  .stc__custom-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 10px 14px;
  }
  .stc__custom-field {
    display: flex;
    flex-direction: column;
    gap: 3px;
    min-width: 0;
  }
</style>

