<script lang="ts">
  /**
   * ProviderResponsesPanel.svelte
   * ────────────────────────────────────────────────────────────────────────────
   * Per-client "Providers" tab — P2 (responses field-map) + P3 (best-option calc).
   *
   * P2 — Vendor responses + rate field-map:
   *   • Lists every quoteRequest for this client. Non-responders are shown greyed;
   *     responders show their submitted rate. A pending badge counts unreviewed
   *     responses.
   *   • Editable field-map: the operator can type a corrected value WITHOUT losing
   *     the vendor-submitted one, so we display "vendor said X → changed to Y".
   *
   * P3 — Best-option calc (deterministic, no AI):
   *   • effective = rate ÷ (1 + providerScore × w)  — lower wins. Unrated vendors
   *     use their raw rate. The lowest effective is flagged BEST.
   *   • Expected margin default 20%, EDITABLE inline here. For each rate we show
   *     the minimum client price to hit that margin, and — when a quote already
   *     exists — flag rates that push margin below the threshold + note collisions
   *     against the provider currently on the quote.
   *
   * Fully additive: reads the RFQ pipeline via providerRfqDashboardRouter; never
   * mutates the provider-facing flow.
   */

  import { onMount } from 'svelte';
  import {
    fetchQuoteRequests,
    updateQuoteRequestOverride,
    setRfqExpectedMargin,
    fetchQuotes,
    type QuoteRequestRow,
  } from '../store.ts';
  import { toasts } from '../toastStore.ts';
  import StarRating from './StarRating.svelte';

  export let client: any = null;

  /**
   * Score weight `w` in the best-option formula effective = rate ÷ (1 + score·w).
   * A 5★ provider gets a 25% ranking boost (rate ÷ 1.25). Deterministic constant.
   */
  const SCORE_WEIGHT = 0.05;

  let rows: QuoteRequestRow[] = [];
  let expectedMarginPct = 20;
  let pendingReviewCount = 0;
  let loading = false;
  let loadError = '';

  // Reference quote (newest) for the margin / collision checks.
  let quoteClientTotal: number | null = null;
  let quoteProviderIds: string[] = [];

  // Inline edit buffers keyed by requestId.
  let editing: Record<string, { price: string; currency: string; notes: string }> = {};
  let savingId = '';
  let marginInput = '20';
  let marginSaving = false;

  // ── Load ──────────────────────────────────────────────────────────────────
  async function load() {
    if (!client?.id) return;
    loading = true;
    loadError = '';
    try {
      const [res, quotes] = await Promise.all([
        fetchQuoteRequests(client.id),
        fetchQuotes(client.id).catch(() => []),
      ]);
      rows = res.quoteRequests;
      expectedMarginPct = res.expectedMarginPct;
      marginInput = String(expectedMarginPct);
      pendingReviewCount = res.pendingReviewCount;

      // Newest quote drives margin/collision context (best-effort).
      const q = (quotes as any[])[0];
      if (q) {
        quoteClientTotal = typeof q.total === 'number' ? q.total : null;
        quoteProviderIds = Array.isArray(q.providerIds) ? q.providerIds : [];
      } else {
        quoteClientTotal = null; quoteProviderIds = [];
      }
    } catch (err: any) {
      loadError = err?.message ?? String(err);
    } finally {
      loading = false;
    }
  }

  onMount(load);

  // ── Derived per-row calc ────────────────────────────────────────────────────
  interface Calc {
    row: QuoteRequestRow;
    responded: boolean;
    vendorRate: number | null;
    /** The rate we actually use: operator override if present, else vendor. */
    effectiveRate: number | null;
    overridden: boolean;
    score: number;
    /** Score-weighted ranking metric (lower = better). */
    weighted: number | null;
    /** Minimum client price to hit the expected margin. */
    impliedClientPrice: number | null;
    /** Margin % achieved if this rate were used against the current quote total. */
    marginVsQuote: number | null;
    belowThreshold: boolean;
    isCurrentProvider: boolean;
    isBest: boolean;
  }

  $: calcs = (() => {
    const list: Calc[] = rows.map((row) => {
      const vendorRate = row.providerResponse?.price ?? null;
      const override = row.operatorOverride?.price ?? null;
      const effectiveRate = override != null ? override : vendorRate;
      const responded = vendorRate != null || override != null;
      const score = typeof row.providerScore === 'number' ? row.providerScore : 0;
      const weighted = effectiveRate != null ? effectiveRate / (1 + score * SCORE_WEIGHT) : null;
      const margin = expectedMarginPct / 100;
      const impliedClientPrice =
        effectiveRate != null && margin < 1 ? effectiveRate / (1 - margin) : null;
      const marginVsQuote =
        effectiveRate != null && quoteClientTotal && quoteClientTotal > 0
          ? ((quoteClientTotal - effectiveRate) / quoteClientTotal) * 100
          : null;
      return {
        row,
        responded,
        vendorRate,
        effectiveRate,
        overridden: override != null,
        score,
        weighted,
        impliedClientPrice,
        marginVsQuote,
        belowThreshold: marginVsQuote != null && marginVsQuote < expectedMarginPct,
        isCurrentProvider: quoteProviderIds.includes(row.providerId),
        isBest: false,
      };
    });
    // Flag the best (lowest weighted) among responders.
    let bestIdx = -1;
    let bestVal = Infinity;
    list.forEach((c, i) => {
      if (c.weighted != null && c.weighted < bestVal) { bestVal = c.weighted; bestIdx = i; }
    });
    if (bestIdx >= 0) list[bestIdx].isBest = true;
    return list;
  })();

  $: respondedCalcs = calcs.filter((c) => c.responded);
  $: waitingCalcs = calcs.filter((c) => !c.responded);

  function money(v: number | null, currency?: string | null): string {
    if (v == null) return '—';
    return `${currency ? currency + ' ' : ''}${v.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  }

  // ── Editing the operator override (field-map) ───────────────────────────────
  function startEdit(row: QuoteRequestRow) {
    const o = row.operatorOverride;
    const v = row.providerResponse;
    editing = {
      ...editing,
      [row.requestId]: {
        price: String((o?.price ?? v?.price) ?? ''),
        currency: (o?.currency ?? v?.currency) ?? 'USD',
        notes: o?.notes ?? '',
      },
    };
  }
  function cancelEdit(requestId: string) {
    const { [requestId]: _drop, ...rest } = editing;
    editing = rest;
  }
  async function saveEdit(row: QuoteRequestRow) {
    const buf = editing[row.requestId];
    if (!buf) return;
    savingId = row.requestId;
    try {
      const priceNum = buf.price.trim() === '' ? null : Number(buf.price);
      await updateQuoteRequestOverride(client.id, row.requestId, {
        price: priceNum,
        currency: buf.currency.trim() || null,
        notes: buf.notes,
        markReviewed: true,
      });
      cancelEdit(row.requestId);
      await load();
      toasts.success('Rate updated.');
    } catch (err: any) {
      toasts.error(`Update failed: ${err?.message ?? err}`);
    } finally {
      savingId = '';
    }
  }
  async function clearOverride(row: QuoteRequestRow) {
    savingId = row.requestId;
    try {
      await updateQuoteRequestOverride(client.id, row.requestId, { clearOverride: true });
      await load();
      toasts.success('Reverted to the vendor-submitted rate.');
    } catch (err: any) {
      toasts.error(`Failed: ${err?.message ?? err}`);
    } finally {
      savingId = '';
    }
  }
  async function markReviewed(row: QuoteRequestRow) {
    savingId = row.requestId;
    try {
      await updateQuoteRequestOverride(client.id, row.requestId, { markReviewed: true });
      await load();
    } catch (err: any) {
      toasts.error(`Failed: ${err?.message ?? err}`);
    } finally {
      savingId = '';
    }
  }

  // ── Expected margin ─────────────────────────────────────────────────────────
  async function saveMargin() {
    const n = Number(marginInput);
    if (!isFinite(n)) { marginInput = String(expectedMarginPct); return; }
    marginSaving = true;
    try {
      expectedMarginPct = await setRfqExpectedMargin(client.id, n);
      marginInput = String(expectedMarginPct);
    } catch (err: any) {
      toasts.error(`Couldn't save margin: ${err?.message ?? err}`);
      marginInput = String(expectedMarginPct);
    } finally {
      marginSaving = false;
    }
  }

  const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
    pending:   { label: 'Awaiting reply', cls: 'st-pending' },
    accepted:  { label: 'Responded',      cls: 'st-accepted' },
    declined:  { label: 'Declined',       cls: 'st-declined' },
    expired:   { label: 'Expired',        cls: 'st-expired' },
    selected:  { label: 'Selected',       cls: 'st-selected' },
    confirmed: { label: 'Confirmed',      cls: 'st-selected' },
  };
</script>

<div class="pr">
  <header class="pr-head">
    <div>
      <h3 class="pr-title">
        📥 Provider responses
        {#if pendingReviewCount > 0}
          <span class="pr-pending" title="Responses awaiting your review">{pendingReviewCount} new</span>
        {/if}
      </h3>
      <p class="pr-sub">Track vendor rates, correct them without losing the original, and let the score-weighted calc rank the best option.</p>
    </div>
    <button type="button" class="pr-refresh" on:click={load} disabled={loading}>{loading ? '…' : '↺ Refresh'}</button>
  </header>

  <!-- Expected margin -->
  <div class="pr-margin">
    <label for="pr-margin-input">Expected margin</label>
    <div class="pr-margin__field">
      <input
        id="pr-margin-input"
        type="number" min="0" max="95" step="1"
        bind:value={marginInput}
        on:blur={saveMargin}
        on:keydown={(e) => e.key === 'Enter' && saveMargin()}
      />
      <span>%</span>
      {#if marginSaving}<span class="pr-margin__saving">saving…</span>{/if}
    </div>
    <span class="pr-margin__hint">Rates that push margin below this against the current quote are flagged.</span>
  </div>

  {#if loadError}
    <p class="pr-err">⚠ {loadError}</p>
  {:else if loading && rows.length === 0}
    <p class="pr-hint">Loading responses…</p>
  {:else if rows.length === 0}
    <div class="pr-empty">
      <span class="pr-empty__icon">📭</span>
      <p>No RFQs have been sent for this client yet. Use “Request rates from providers” above to start.</p>
    </div>
  {:else}
    <!-- ── Responded (the field-map + calc) ── -->
    {#if respondedCalcs.length}
      <div class="pr-table" role="table">
        <div class="pr-tr pr-tr--head" role="row">
          <span role="columnheader">Provider</span>
          <span role="columnheader">Rate</span>
          <span role="columnheader" title="Score-weighted effective price — lower wins">Effective</span>
          <span role="columnheader" title="Minimum client price to hit the expected margin">Min. client price</span>
          <span role="columnheader">Flags</span>
          <span role="columnheader"></span>
        </div>
        {#each respondedCalcs as c (c.row.requestId)}
          {@const r = c.row}
          <div class="pr-tr" class:pr-tr--best={c.isBest} class:pr-tr--warn={c.belowThreshold} role="row">
            <!-- Provider -->
            <span class="pr-cell pr-cell--prov" role="cell">
              <span class="pr-prov-name">{r.providerName}</span>
              <span class="pr-prov-meta">
                <StarRating value={r.providerScore} readonly size={12} />
                {#if !r.reviewedAt}<span class="pr-dot" title="Unreviewed"></span>{/if}
              </span>
            </span>

            <!-- Rate (field-map) -->
            <span class="pr-cell" role="cell">
              {#if editing[r.requestId]}
                <div class="pr-edit">
                  <input class="pr-edit__cur" bind:value={editing[r.requestId].currency} placeholder="USD" aria-label="Currency" />
                  <input class="pr-edit__price" type="number" bind:value={editing[r.requestId].price} placeholder="0" aria-label="Rate" />
                </div>
                <input class="pr-edit__notes" bind:value={editing[r.requestId].notes} placeholder="Note (optional)" aria-label="Note" />
                <div class="pr-edit__actions">
                  <button type="button" class="pr-btn pr-btn--sm pr-btn--primary" on:click={() => saveEdit(r)} disabled={savingId === r.requestId}>Save</button>
                  <button type="button" class="pr-btn pr-btn--sm" on:click={() => cancelEdit(r.requestId)}>Cancel</button>
                </div>
              {:else}
                <span class="pr-rate">{money(c.effectiveRate, r.operatorOverride?.currency ?? r.providerResponse?.currency)}</span>
                {#if c.overridden && c.vendorRate != null && c.vendorRate !== c.effectiveRate}
                  <span class="pr-delta" title="Vendor-submitted value">vendor said {money(c.vendorRate, r.providerResponse?.currency)}</span>
                {/if}
              {/if}
            </span>

            <!-- Effective -->
            <span class="pr-cell" role="cell">
              <span class="pr-eff">{money(c.weighted ? Math.round(c.weighted * 100) / 100 : null)}</span>
              {#if c.score > 0}<span class="pr-eff-note">×score {c.score}</span>{/if}
            </span>

            <!-- Implied client price -->
            <span class="pr-cell" role="cell">
              <span class="pr-implied">{money(c.impliedClientPrice ? Math.round(c.impliedClientPrice) : null)}</span>
              {#if c.marginVsQuote != null}
                <span class="pr-margin-vs" class:below={c.belowThreshold}>
                  {c.marginVsQuote >= 0 ? '' : '−'}{Math.abs(Math.round(c.marginVsQuote))}% vs quote
                </span>
              {/if}
            </span>

            <!-- Flags -->
            <span class="pr-cell pr-cell--flags" role="cell">
              {#if c.isBest}<span class="pr-flag pr-flag--best">★ Best</span>{/if}
              {#if c.isCurrentProvider}<span class="pr-flag pr-flag--current">On quote</span>{/if}
              {#if c.belowThreshold}<span class="pr-flag pr-flag--warn">Below margin</span>{/if}
            </span>

            <!-- Actions -->
            <span class="pr-cell pr-cell--actions" role="cell">
              {#if !editing[r.requestId]}
                <button type="button" class="pr-btn pr-btn--sm" on:click={() => startEdit(r)} title="Edit / correct the rate">Edit</button>
                {#if c.overridden}
                  <button type="button" class="pr-btn pr-btn--sm pr-btn--ghost" on:click={() => clearOverride(r)} disabled={savingId === r.requestId} title="Revert to the vendor's value">Revert</button>
                {:else if !r.reviewedAt}
                  <button type="button" class="pr-btn pr-btn--sm pr-btn--ghost" on:click={() => markReviewed(r)} disabled={savingId === r.requestId} title="Mark reviewed">✓</button>
                {/if}
              {/if}
            </span>
          </div>
        {/each}
      </div>
    {:else}
      <p class="pr-hint">No vendor has submitted a rate yet.</p>
    {/if}

    <!-- ── Awaiting / non-responders ── -->
    {#if waitingCalcs.length}
      <div class="pr-waiting">
        <div class="pr-waiting__label">Awaiting a reply ({waitingCalcs.length})</div>
        <div class="pr-waiting__chips">
          {#each waitingCalcs as c (c.row.requestId)}
            {@const s = STATUS_LABEL[c.row.status] ?? { label: c.row.status, cls: '' }}
            <span class="pr-wchip {s.cls}" title={s.label}>
              {c.row.providerName}
              <span class="pr-wchip__st">{s.label}</span>
            </span>
          {/each}
        </div>
      </div>
    {/if}
  {/if}
</div>

<style>
  /* Token-driven scoped-var layer — cohesive with the dashboard --irp-* tokens
     (safe fallbacks keep it working outside :root too). */
  .pr {
    /* Bound to the global style-bible tokens (teal --color-highlight-2, Jost)
       with the slate neutral scale used across the CRM dashboard. */
    --pr-accent:        var(--color-highlight-2, #02b5bb);
    --pr-accent-hover:  #02999e;
    --pr-accent-subtle: rgba(2, 181, 187, 0.10);
    --pr-surface:       #ffffff;
    --pr-surface-2:     #f8fafc;
    --pr-surface-3:     #f1f5f9;
    --pr-border:        #e2e8f0;
    --pr-border-focus:  rgba(2, 181, 187, 0.5);
    --pr-text:          #0f172a;
    --pr-text-2:        #334155;
    --pr-text-muted:    #64748b;
    --pr-text-dim:      #94a3b8;
    --pr-danger:        var(--color-highlight-1, #c62426);
    --pr-warning:       #d97706;
    --pr-warn-bg:       #fffbeb;
    --pr-warn-border:   #fde68a;
    --pr-warn-text:     #b45309;
    --pr-ok-bg:         #f0fdf4;
    --pr-ok-border:     #bbf7d0;
    --pr-ok-text:       #16a34a;
    --pr-t:             150ms cubic-bezier(0.16, 1, 0.3, 1);
    /* Self-contained card, cohesive with AdminView / AutomationView surfaces */
    padding: 16px 18px 20px;
    margin-top: 16px;
    border: 1px solid var(--pr-border);
    border-radius: 16px;
    background: var(--pr-surface);
    box-shadow: 0 1px 3px rgba(0,0,0,0.06), 0 8px 24px rgba(0,0,0,0.05);
    font-family: var(--font-paragraph, 'Jost'), system-ui, sans-serif;
    color: var(--pr-text);
  }


  .pr-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin: 12px 0 10px; }
  .pr-title { margin: 0 0 3px; font-size: 15px; font-weight: 800; color: var(--pr-text); display: flex; align-items: center; gap: var(--irp-sp-2, 8px); }
  .pr-pending { font-size: 10px; font-weight: 800; color: var(--pr-warn-text); background: var(--pr-warn-bg); border: 1px solid var(--pr-warn-border); padding: 2px 8px; border-radius: var(--irp-r-full, 9999px); }
  .pr-sub { margin: 0; font-size: 12px; color: var(--pr-text-muted); line-height: 1.45; max-width: 620px; }
  .pr-refresh { border: 1px solid var(--pr-border); background: var(--pr-surface); border-radius: var(--irp-r-full, 9999px); padding: 5px 12px; font-size: 12px; font-weight: 700; color: var(--pr-text-muted); cursor: pointer; white-space: nowrap; transition: border-color var(--pr-t), color var(--pr-t); }
  .pr-refresh:hover { border-color: var(--pr-border-focus); color: var(--pr-accent-hover); }

  .pr-margin { display: flex; flex-wrap: wrap; align-items: center; gap: var(--irp-sp-2, 8px); padding: 10px 12px; background: var(--pr-surface-2); border: 1px solid var(--pr-border); border-radius: var(--irp-r-md, 12px); margin-bottom: 12px; }
  .pr-margin label { font-size: 12px; font-weight: 700; color: var(--pr-text-2); }
  .pr-margin__field { display: inline-flex; align-items: center; gap: 4px; }
  .pr-margin__field input { width: 62px; padding: 5px 8px; border: 1px solid var(--pr-border); border-radius: var(--irp-r-xs, 6px); font-size: 13px; text-align: right; background: var(--pr-surface); color: var(--pr-text); }
  .pr-margin__field input:focus { border-color: var(--pr-accent); outline: none; box-shadow: 0 0 0 3px var(--pr-accent-subtle); }
  .pr-margin__saving { font-size: 11px; color: var(--pr-text-dim); }
  .pr-margin__hint { font-size: 11px; color: var(--pr-text-dim); flex: 1 1 200px; }

  .pr-hint { font-size: 12px; color: var(--pr-text-dim); margin: var(--irp-sp-2, 8px) 0; }
  .pr-err { font-size: 12px; color: var(--pr-danger); margin: var(--irp-sp-2, 8px) 0; }
  .pr-empty { display: flex; align-items: center; gap: 12px; padding: 18px; background: var(--pr-surface-2); border: 1px dashed var(--pr-border); border-radius: var(--irp-r-md, 12px); color: var(--pr-text-muted); font-size: 13px; }
  .pr-empty__icon { font-size: 22px; }

  .pr-table { display: flex; flex-direction: column; border: 1px solid var(--pr-border); border-radius: var(--irp-r-md, 12px); overflow: hidden; }
  .pr-tr { display: grid; grid-template-columns: 1.4fr 1.3fr 0.9fr 1.1fr 1fr 0.9fr; gap: 10px; padding: 10px 12px; border-bottom: 1px solid var(--pr-border); align-items: start; }
  .pr-tr:last-child { border-bottom: none; }
  .pr-tr--head { background: var(--pr-surface-2); font-size: 10.5px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.04em; color: var(--pr-text-muted); align-items: center; }
  .pr-tr--best { background: linear-gradient(90deg, rgba(16,185,129,.08), transparent); }
  .pr-tr--warn { background: linear-gradient(90deg, rgba(245,158,11,.09), transparent); }

  .pr-cell { font-size: 12.5px; color: var(--pr-text); display: flex; flex-direction: column; gap: 3px; min-width: 0; }
  .pr-cell--prov { gap: 4px; }
  .pr-prov-name { font-weight: 700; }
  .pr-prov-meta { display: inline-flex; align-items: center; gap: 6px; }
  .pr-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--pr-warning); display: inline-block; }

  .pr-rate { font-weight: 700; }
  .pr-delta { font-size: 10.5px; color: var(--pr-warn-text); }
  .pr-eff { font-weight: 700; color: var(--pr-accent-hover); }
  .pr-eff-note, .pr-margin-vs, .pr-implied { font-size: 10.5px; color: var(--pr-text-dim); }
  .pr-implied { color: var(--pr-text); font-weight: 600; font-size: 12.5px; }
  .pr-margin-vs.below { color: #b45309; font-weight: 700; }

  .pr-cell--flags { flex-direction: row; flex-wrap: wrap; gap: 4px; align-items: flex-start; }
  .pr-flag { font-size: 10px; font-weight: 800; padding: 2px 7px; border-radius: var(--irp-r-full, 9999px); white-space: nowrap; }
  .pr-flag--best { background: var(--pr-ok-bg); border: 1px solid var(--pr-ok-border); color: var(--pr-ok-text); }
  .pr-flag--current { background: #eff6ff; border: 1px solid #bfdbfe; color: #1e40af; }
  .pr-flag--warn { background: var(--pr-warn-bg); border: 1px solid var(--pr-warn-border); color: var(--pr-warn-text); }

  .pr-cell--actions { flex-direction: row; gap: 4px; }
  .pr-btn { border: 1px solid var(--pr-border); background: var(--pr-surface); border-radius: var(--irp-r-xs, 6px); padding: 4px 10px; font-size: 11.5px; font-weight: 700; color: var(--pr-text-muted); cursor: pointer; transition: border-color var(--pr-t), color var(--pr-t), filter var(--pr-t); }
  .pr-btn:hover:not(:disabled) { border-color: var(--pr-border-focus); color: var(--pr-accent-hover); }
  .pr-btn--sm { padding: 3px 8px; }
  .pr-btn--primary { background: linear-gradient(135deg, #02b5bb 0%, #02999e 100%); border-color: transparent; color: #fff; box-shadow: 0 2px 8px rgba(2,181,187,0.30); }
  .pr-btn--primary:hover:not(:disabled) { filter: brightness(1.06); color: #fff; }
  .pr-btn--ghost { background: var(--pr-surface-2); }
  .pr-btn:disabled { opacity: .5; cursor: not-allowed; }

  .pr-edit { display: flex; gap: 4px; }
  .pr-edit__cur { width: 48px; }
  .pr-edit__price { flex: 1; min-width: 60px; }
  .pr-edit__cur, .pr-edit__price, .pr-edit__notes { padding: 4px 7px; border: 1px solid var(--pr-border); border-radius: var(--irp-r-xs, 6px); font-size: 12px; background: var(--pr-surface); color: var(--pr-text); }
  .pr-edit__notes { width: 100%; margin-top: 4px; }
  .pr-edit__cur:focus, .pr-edit__price:focus, .pr-edit__notes:focus { border-color: var(--pr-accent); outline: none; }
  .pr-edit__actions { display: flex; gap: 4px; margin-top: 5px; }

  .pr-waiting { margin-top: 14px; }
  .pr-waiting__label { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.04em; color: var(--pr-text-muted); margin-bottom: 6px; }
  .pr-waiting__chips { display: flex; flex-wrap: wrap; gap: 6px; }
  .pr-wchip { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; background: var(--pr-surface-2); border: 1px solid var(--pr-border); border-radius: var(--irp-r-full, 9999px); font-size: 12px; font-weight: 600; color: var(--pr-text-muted); }
  .pr-wchip__st { font-size: 10px; font-weight: 700; color: var(--pr-text-dim); }
  .pr-wchip.st-declined { opacity: .65; }
  .pr-wchip.st-expired { opacity: .55; text-decoration: line-through; }
  .pr-wchip.st-selected { background: var(--pr-ok-bg); border-color: var(--pr-ok-border); color: var(--pr-ok-text); }
</style>
