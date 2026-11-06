<script lang="ts">
  /**
   * OnlinePaymentsPanel.svelte — Finance → Online payments.
   * ────────────────────────────────────────────────────────────────────────
   * Every payment taken through Stripe on the client portal: what came in,
   * what Stripe kept, what landed (net), and what is still clearing (ACH).
   * Each row links to the client card and to the payment in Stripe.
   *
   * The money itself is already counted where Finance always counts it — as a
   * received payment on the quote's invoice, with the Stripe fee booked as a
   * "banking fees" expense against the quote. This panel is the processor view
   * finance reconciles payouts against.
   */
  import { onMount } from 'svelte';
  import { fetchOnlinePayments, fetchStripeSetup, paymentsRefresh, selectClientById, type OnlinePaymentsReport, type StripeSetupItem } from '../store.ts';
  import StatusPill from '../../../lib/payments/StatusPill.svelte';
  import NeedsAttentionPanel from './NeedsAttentionPanel.svelte';
  import PaymentRecipientsPanel from './PaymentRecipientsPanel.svelte';
  import { statusOfPayment } from '../../../lib/payments/paymentStatus.ts';

  // Admin-only setup checklist (403 for everyone else → stays hidden).
  let setup: { items: StripeSetupItem[]; allDone: boolean } | null = null;
  fetchStripeSetup().then((r) => (setup = r)).catch(() => (setup = null));

  let report: OnlinePaymentsReport | null = null;
  let loading = true;
  let error = '';
  type Filter = 'all' | 'succeeded' | 'processing' | 'failed';
  let filter: Filter = 'all';
  const FILTERS: Array<[Filter, string]> = [['all', 'All'], ['succeeded', 'Received'], ['processing', 'On its way'], ['failed', "Didn't go through"]];

  async function load(fresh = false) {
    loading = !report;
    error = '';
    try {
      report = await fetchOnlinePayments({ fresh });
    } catch (e: any) {
      error = e?.message ?? 'Could not load online payments.';
    } finally {
      loading = false;
    }
  }
  onMount(() => load());
  let first = true;
  $: $paymentsRefresh, (first ? (first = false) : load(true));

  function fmt(n: number | null | undefined, currency = 'USD'): string {
    const v = typeof n === 'number' && Number.isFinite(n) ? n : 0;
    try { return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(v); }
    catch { return `${currency} ${v.toFixed(2)}`; }
  }
  function day(iso: string | null | undefined): string {
    if (!iso) return '—';
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  const LABEL: Record<string, string> = {
    succeeded: 'Paid', processing: 'Clearing', canceled: 'Canceled', requires_payment_method: 'Failed',
  };

  $: rows = (report?.payments ?? []).filter((p) =>
    filter === 'all' ? true
      : filter === 'failed' ? (p.status === 'requires_payment_method' || p.status === 'canceled')
      : p.status === filter,
  );
</script>

<section class="op" aria-labelledby="op-title">
  <header class="op__head">
    <div>
      <h2 id="op-title" class="op__title">Online payments</h2>
      <p class="op__sub">Card and bank payments clients made on their project page, through Stripe.</p>
    </div>
    <div class="op__controls">
      {#if report}
        <span class="op__mode" class:is-test={!report.livemode} class:is-off={!report.enabled}>
          {!report.enabled ? 'Stripe not configured' : report.livemode ? 'Live' : 'Test mode'}
        </span>
      {/if}
      <button type="button" on:click={() => load(true)} disabled={loading}>{loading ? 'Loading…' : 'Refresh'}</button>
    </div>
  </header>

  <!-- Open money problems first: they are the reason to open this page. -->
  <NeedsAttentionPanel />

  {#if setup && !setup.allDone}
    <details class="op__setup" open>
      <summary>Online payment setup · {setup.items.filter((i) => i.done).length} of {setup.items.length} done <span class="op__adminonly">only admins see this</span></summary>
      <ul>
        {#each setup.items as it (it.key)}
          <li class:done={it.done}>
            <span class="op__check" aria-hidden="true">{it.done ? '✓' : ''}</span>
            <span><strong>{it.label}</strong>{it.done ? '' : ` — ${it.why}`}{#if !it.done}<br /><span class="op__fix">How: {it.fix}</span>{/if}</span>
            <span class="op__sr">{it.done ? 'done' : 'not done'}</span>
          </li>
        {/each}
      </ul>
    </details>
  {/if}

  {#if error}
    <p class="op__error" role="alert">{error}</p>
  {:else if loading && !report}
    <p class="op__empty">Loading…</p>
  {:else if report}
    <div class="op__cards">
      <div class="op-card"><span>Paid online</span><strong>{fmt(report.totals.gross)}</strong><small>{report.totals.count} payment{report.totals.count === 1 ? '' : 's'} received</small></div>
      <div class="op-card"><span>Fees we paid</span><strong>{fmt(report.totals.fees)}</strong><small>{report.totals.gross ? ((report.totals.fees / report.totals.gross) * 100).toFixed(2) : '0.00'}% of what was paid</small></div>
      <div class="op-card op-card--net"><span>What we kept</span><strong>{fmt(report.totals.net)}</strong><small>{report.totals.refunded ? `after fees and ${fmt(report.totals.refunded)} refunded` : 'after fees'}</small></div>
      <div class="op-card"><span>On its way</span><strong>{fmt(report.totals.processing)}</strong><small>bank payments, up to 4 business days</small></div>
    </div>

    {#if report.feeBreakdown?.length}
      <div class="op__breakdown" aria-label="Fees by type">
        {#each report.feeBreakdown as f}
          <span class="op__fee"><span>{f.label}</span><strong>{fmt(f.amount)}</strong></span>
        {/each}
      </div>
    {/if}

    <div class="op__filters" role="group" aria-label="Filter payments">
      {#each FILTERS as [k, label]}
        <button type="button" class:active={filter === k} aria-pressed={filter === k} on:click={() => (filter = k)}>{label}</button>
      {/each}
    </div>

    {#if rows.length === 0}
      <p class="op__empty">{report.payments.length ? 'Nothing matches this filter.' : 'No online payments yet. They appear here the moment a client pays on their project page.'}</p>
    {:else}
      <div class="op__tablewrap">
        <table class="op__table">
          <thead>
            <tr>
              <th scope="col">Date</th>
              <th scope="col">Client</th>
              <th scope="col">For</th>
              <th scope="col">Method</th>
              <th scope="col" class="num">Amount</th>
              <th scope="col" class="num">Fee</th>
              <th scope="col" class="num">Net</th>
              <th scope="col">Status</th>
              <th scope="col"><span class="op__sr">Links</span></th>
            </tr>
          </thead>
          <tbody>
            {#each rows as p (p.paymentIntentId)}
              <tr>
                <td>{day(p.createdAt)}</td>
                <td>
                  {#if p.consultationId}
                    <button type="button" class="op__client" on:click={() => selectClientById?.(p.consultationId ?? '')}>{p.clientName || p.consultationId}</button>
                  {:else}{p.clientName ?? '—'}{/if}
                </td>
                <td>{p.quoteTitle ?? '—'}{#if p.plan}<span class="op__plan">{p.plan === 'full' ? 'Full' : 'Deposit'}</span>{/if}{#if p.invoiceNumber}<span class="op__inv">{p.invoiceNumber}</span>{/if}</td>
                <td>{p.methodLabel ?? '—'}</td>
                <td class="num">{fmt(p.amount, p.currency)}</td>
                <td class="num">
                  {p.fee != null || p.otherFees ? fmt((p.fee ?? 0) + (p.otherFees ?? 0), p.currency) : '—'}
                  {#if p.otherFees}<div class="op__subnum">incl. {fmt(p.otherFees, p.currency)} later fees</div>{/if}
                </td>
                <td class="num">{p.net != null ? fmt(p.net - (p.otherFees ?? 0), p.currency) : '—'}</td>
                <td>
                  <StatusPill status={statusOfPayment(p.status, !!p.disputedAt)} size="sm" />
                  {#if p.refundedAmount}<span class="op-chip op-chip--refund">Refunded {fmt(p.refundedAmount, p.currency)}</span>{/if}
                  {#if p.disputedAt}<span class="op-chip op-chip--requires_payment_method">Disputed</span>{/if}
                </td>
                <td class="links">
                  {#if p.dashboardUrl}<a href={p.dashboardUrl} target="_blank" rel="noopener noreferrer">Stripe ↗</a>{/if}
                  {#if p.receiptUrl}<a href={p.receiptUrl} target="_blank" rel="noopener noreferrer">Receipt ↗</a>{/if}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}

    <details class="op__who">
      <summary>Who gets told about payments</summary>
      <PaymentRecipientsPanel />
    </details>

    {#if report.otherFees?.length}
      <details class="op__other">
        <summary>Other fees Stripe charged ({report.otherFees.length}): failed payments, disputes, bank checks, currency conversion</summary>
        <div class="op__tablewrap">
          <table class="op__table">
            <thead><tr><th scope="col">Date</th><th scope="col">Charge</th><th scope="col" class="num">Amount</th><th scope="col">Details</th></tr></thead>
            <tbody>
              {#each report.otherFees as f (f.id)}
                <tr>
                  <td>{day(f.date)}</td>
                  <td>
                    {#if f.consultationId}
                      <button type="button" class="op__client" on:click={() => selectClientById?.(f.consultationId ?? '')}>{f.label}</button>
                    {:else}{f.label}{/if}
                  </td>
                  <td class="num">{f.amount < 0 ? '+' : ''}{fmt(Math.abs(f.amount))}{f.amount < 0 ? ' back' : ''}</td>
                  <td class="op__note">{f.note ?? ''}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </details>
    {/if}
  {/if}
</section>

<style>
  .op { display: flex; flex-direction: column; gap: 14px; }
  .op__head { display: flex; justify-content: space-between; align-items: flex-end; gap: 12px; flex-wrap: wrap; }
  .op__title { margin: 0; font-size: 18px; font-weight: 800; color: #0f172a; }
  .op__sub { margin: 2px 0 0; font-size: 13px; color: #64748b; }
  .op__controls { display: flex; align-items: center; gap: 10px; }
  .op__controls button { min-height: 32px; padding: 0 14px; border-radius: 8px; border: 1px solid #cbd5e1; background: #fff; font: inherit; font-size: 12.5px; font-weight: 700; cursor: pointer; }
  .op__mode { font-size: 11px; font-weight: 800; padding: 3px 10px; border-radius: 999px; color: #0d7377; background: rgba(2,182,188,0.1); border: 1px solid rgba(2,182,188,0.24); }
  .op__mode.is-test { color: #9a3412; background: #fff7ed; border-color: #fed7aa; }
  .op__mode.is-off { color: #475569; background: #f1f5f9; border-color: #e2e8f0; }
  .op__warn { margin: 0; font-size: 12.5px; color: #92400e; background: #fffbeb; border: 1px solid #fde68a; border-radius: 10px; padding: 8px 12px; }
  .op__error { color: #b42318; font-size: 13px; }
  .op__empty { color: #64748b; font-size: 13px; padding: 18px; text-align: center; background: #f8fafc; border-radius: 12px; }

  .op__cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 10px; }
  .op-card { display: flex; flex-direction: column; gap: 2px; padding: 12px 14px; background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; }
  .op-card span { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; }
  .op-card strong { font-size: 20px; font-weight: 800; color: #0f172a; font-variant-numeric: tabular-nums; }
  .op-card small { font-size: 11.5px; color: #64748b; }
  .op-card--net strong { color: #0a7c81; }

  .op__filters { display: flex; gap: 6px; flex-wrap: wrap; }
  .op__filters button { min-height: 30px; padding: 0 12px; border-radius: 999px; border: 1px solid #e2e8f0; background: #fff; font: inherit; font-size: 12px; font-weight: 700; color: #334155; cursor: pointer; }
  .op__filters button.active { background: #0a7c81; border-color: #0a7c81; color: #fff; }
  .op__filters button:focus-visible, .op__controls button:focus-visible, .op__client:focus-visible { outline: 2px solid #0a7c81; outline-offset: 2px; }

  .op__tablewrap { overflow-x: auto; border: 1px solid #e2e8f0; border-radius: 12px; background: #fff; }
  .op__table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
  .op__table th { text-align: left; font-size: 10.5px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; padding: 10px 12px; background: #f8fafc; border-bottom: 1px solid #e2e8f0; white-space: nowrap; }
  .op__table td { padding: 10px 12px; border-bottom: 1px solid #f1f5f9; color: #334155; vertical-align: top; }
  .op__table tr:last-child td { border-bottom: 0; }
  .op__table .num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .op__table .links { white-space: nowrap; }
  .op__table .links a { color: #0a7c81; font-weight: 700; text-decoration: none; margin-right: 10px; }
  .op__client { background: none; border: 0; padding: 0; font: inherit; font-weight: 700; color: #0f172a; cursor: pointer; text-align: left; text-decoration: underline; text-decoration-color: #cbd5e1; text-underline-offset: 3px; }
  .op__plan, .op__inv { display: inline-block; margin-left: 6px; font-size: 10.5px; font-weight: 700; padding: 1px 6px; border-radius: 6px; background: #f1f5f9; color: #475569; }
  .op-chip { display: inline-block; font-size: 10.5px; font-weight: 800; padding: 2px 8px; border-radius: 99px; background: #f1f5f9; color: #334155; margin: 0 4px 2px 0; }
  .op-chip--succeeded { background: #dcfce7; color: #166534; }
  .op-chip--processing { background: #e0f2fe; color: #075985; }
  .op-chip--requires_payment_method, .op-chip--canceled { background: #fef3f2; color: #b42318; }
  .op-chip--refund { background: #fef3c7; color: #92400e; }
  .op__setup { border: 1px solid #fde68a; background: #fffbeb; border-radius: 12px; padding: 10px 14px; font-size: 13px; color: #78350f; }
  .op__setup summary { cursor: pointer; font-weight: 800; display: flex; align-items: center; gap: 8px; }
  .op__setup summary:focus-visible { outline: 2px solid #0a7c81; outline-offset: 2px; border-radius: 4px; }
  .op__adminonly { font-weight: 600; font-size: 11px; color: #92400e; background: #fef3c7; border-radius: 99px; padding: 1px 8px; }
  .op__setup ul { list-style: none; margin: 10px 0 2px; padding: 0; display: grid; gap: 8px; }
  .op__setup li { display: flex; gap: 10px; align-items: flex-start; line-height: 1.45; }
  .op__setup li.done { color: #166534; }
  .op__check { flex: none; width: 18px; height: 18px; border-radius: 5px; border: 1.5px solid #d97706; display: grid; place-items: center; font-size: 12px; font-weight: 800; background: #fff; }
  .op__setup li.done .op__check { background: #16a34a; border-color: #16a34a; color: #fff; }
  .op__fix { font-size: 12px; color: #92400e; }
  .op__who summary { cursor: pointer; font-size: 13px; font-weight: 700; color: #334155; margin-bottom: 8px; }
  .op__who summary:focus-visible { outline: 2px solid #0a7c81; outline-offset: 2px; border-radius: 4px; }
  .op__breakdown { display: flex; flex-wrap: wrap; gap: 8px; }
  .op__fee { display: inline-flex; gap: 8px; align-items: baseline; padding: 5px 12px; border-radius: 999px; background: #fff7ed; border: 1px solid #fed7aa; font-size: 12px; color: #9a3412; }
  .op__fee strong { font-variant-numeric: tabular-nums; }
  .op__subnum { font-size: 10.5px; color: #b45309; }
  .op__other summary { cursor: pointer; font-size: 13px; font-weight: 700; color: #334155; margin-bottom: 8px; }
  .op__other summary:focus-visible { outline: 2px solid #0a7c81; outline-offset: 2px; border-radius: 4px; }
  .op__note { font-size: 11.5px; color: #64748b; max-width: 420px; }
  .op__sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
</style>
