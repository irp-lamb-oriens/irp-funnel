<script lang="ts">
  /**
   * QuotePaymentsPanel.svelte — money state of each accepted quote, in the
   * client card's Quotes tab.
   * ────────────────────────────────────────────────────────────────────────
   * Answers the questions ops ask the moment a client signs:
   *   • Has this client paid? How much, how, and is it cleared?
   *   • What is still owed, and against which part of the schedule?
   *   • The client says they wired it — record it and start the project.
   *
   * Online (Stripe) payments arrive here by themselves (webhook / reconcile →
   * socket → `paymentsRefresh`). A wire is confirmed with "Confirm money that arrived",
   * which goes through the same server path as Stripe: invoice payment, stage
   * move to Initial Payment on the first payment, team + client emails.
   */
  import { onMount } from 'svelte';
  import {
    fetchClientPayments,
    recordQuotePayment,
    paymentsRefresh,
    type QuotePaymentsRow,
  } from '../store.ts';
  import { toasts } from '../toastStore.ts';
  import { selectedClient } from '../store.ts';
  import StatusPill from '../../../lib/payments/StatusPill.svelte';
  import { statusOfPayment, type PayStatus } from '../../../lib/payments/paymentStatus.ts';

  export let clientId: string;

  let rows: QuotePaymentsRow[] = [];
  let enabled = false;
  let livemode = true;
  let webhook = false;
  let loading = true;
  let error = '';
  let loadedFor = '';

  async function load(quiet = false) {
    if (!quiet) loading = true;
    error = '';
    try {
      const res = await fetchClientPayments(clientId);
      rows = res.quotes;
      enabled = res.enabled;
      livemode = res.livemode;
      webhook = res.webhook;
      loadedFor = clientId;
    } catch (e: any) {
      error = e?.message ?? 'Could not load payments';
    } finally {
      loading = false;
    }
  }

  onMount(() => load());
  $: if (clientId && loadedFor && clientId !== loadedFor) load();
  // Live: a webhook or a teammate's recorded wire refreshes this panel.
  let firstTick = true;
  $: $paymentsRefresh, (firstTick ? (firstTick = false) : load(true));

  function fmt(n: number | null | undefined, currency = 'USD'): string {
    const v = typeof n === 'number' && Number.isFinite(n) ? n : 0;
    try { return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(v); }
    catch { return `${currency} ${v.toFixed(2)}`; }
  }
  function day(iso: string | null | undefined): string {
    if (!iso) return '—';
    // A bare YYYY-MM-DD is a calendar day, not UTC midnight (which would show
    // the day before in Costa Rica).
    const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso}T12:00:00` : iso);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  $: who = (($selectedClient as any)?.displayName || ($selectedClient as any)?.name || '').split(' ')[0] || 'The client';

  /** `n` business days after an ISO date (Mon–Fri). */
  function addBusinessDays(iso: string | null | undefined, n: number): string | null {
    if (!iso) return null;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    let left = n;
    while (left > 0) {
      d.setDate(d.getDate() + 1);
      if (d.getDay() !== 0 && d.getDay() !== 6) left--;
    }
    return d.toISOString();
  }
  function daysSince(iso: string | null | undefined): number {
    if (!iso) return 0;
    const t = new Date(iso).getTime();
    return Number.isNaN(t) ? 0 : Math.floor((Date.now() - t) / 86_400_000);
  }

  /**
   * Where a deal stands, said in one sentence, with the ONE thing to do now
   * (Payments UX plan → Staff: client card). Figures come after this line.
   */
  type Main = 'copy' | 'confirm' | 'stripe' | 'none';
  interface DealState { status: PayStatus; pill: string; line: string; main: Main; mainLabel: string }
  function stateOf(r: QuotePaymentsRow, name: string): DealState {
    const s = r.summary;
    const cur = s.currency;
    const latest = r.payments[0] ?? null;
    const disputed = r.payments.find((p) => p.disputedAt);
    const notice = r.transferNotices[r.transferNotices.length - 1] ?? null;
    const next = s.options.find((o) => o.plan === 'next') ?? s.options[0] ?? null;
    if (disputed) {
      return { status: 'problem', pill: 'Disputed', line: `${name}'s bank disputed ${fmt(disputed.amount, cur)}. Respond in Stripe before the deadline Stripe shows.`, main: 'stripe', mainLabel: 'Respond in Stripe' };
    }
    if (s.fullyPaid) {
      const kept = fmt(r.netReceived ?? s.received, cur);
      return { status: 'received', pill: 'Paid in full', line: r.fees?.total ? `Paid in full. Fees we paid: ${fmt(r.fees.total, cur)}. What we kept: ${kept}.` : 'Paid in full. Nothing left to collect.', main: 'none', mainLabel: '' };
    }
    if (s.processing > 0) {
      const p = r.payments.find((x) => x.status === 'processing');
      const by = addBusinessDays(p?.createdAt, 4);
      return { status: 'on_its_way', pill: 'On its way', line: `${fmt(s.processing, cur)} from ${p?.methodLabel ?? 'a bank account'} is on its way${by ? `, expected by ${day(by)}` : ''}. Nothing to do; the project starts when it arrives.`, main: 'none', mainLabel: '' };
    }
    if (notice && (!s.received || new Date(notice.reportedAt) > new Date(latest?.createdAt ?? 0))) {
      return { status: 'due', pill: 'Wire to confirm', line: `${name} says they sent ${notice.amount ? fmt(notice.amount, cur) : 'a wire'} by wire${notice.sentOn ? ` on ${day(notice.sentOn)}` : ''}. Check Chase, then confirm it here.`, main: 'confirm', mainLabel: 'Confirm money that arrived' };
    }
    if (s.received > 0) {
      const depositDone = s.schedule.length > 1 && s.schedule[0]?.status === 'paid';
      return { status: 'received', pill: depositDone ? 'Deposit received' : 'Partly paid', line: `${depositDone ? 'Deposit received. Project started.' : `${fmt(s.received, cur)} received.`} ${fmt(s.outstanding, cur)} left to pay${s.schedule.length > 1 ? ', due at pickup' : ''}.`, main: 'copy', mainLabel: 'Copy payment link for the rest' };
    }
    if (latest?.status === 'requires_payment_method' && latest.failureMessage) {
      return { status: 'problem', pill: "Didn't go through", line: `${name}'s payment didn't go through on ${day(latest.createdAt)}. They saw why and can try again.`, main: 'copy', mainLabel: 'Copy payment link to resend' };
    }
    const waited = daysSince(r.acceptedAt);
    if (waited >= 2) {
      return { status: 'due', pill: 'No payment yet', line: `No payment ${waited} days after signing. A friendly reminder with the payment link usually works.`, main: 'copy', mainLabel: 'Copy payment link' };
    }
    return { status: 'due', pill: 'Waiting for payment', line: `Waiting for ${next ? `the ${fmt(next.amount, cur)} ${s.schedule.length > 1 ? 'deposit' : 'payment'}` : 'payment'}. ${name} was asked to pay right after signing.`, main: 'copy', mainLabel: 'Copy payment link' };
  }

  // ── Copy the client's payment link ─────────────────────────────────────
  let copied = '';
  async function copyLink(r: QuotePaymentsRow) {
    if (!r.payUrl) return;
    try { await navigator.clipboard.writeText(r.payUrl); } catch { /* ignore */ }
    copied = r.quoteId;
    setTimeout(() => { if (copied === r.quoteId) copied = ''; }, 1600);
  }

  // ── Record a wire / other payment ──────────────────────────────────────
  let formFor = '';
  let fAmount = '';
  let fDate = '';
  let fMethod = 'Bank wire';
  let fRef = '';
  let fNotify = true;
  let fBankFee = '';
  let fFeeBy: 'irp' | 'client' = 'irp';
  $: feeNum = Number(String(fBankFee).replace(/[$,\s]/g, '')) || 0;
  $: amtNum = Number(String(fAmount).replace(/[$,\s]/g, '')) || 0;
  let saving = false;
  let formError = '';

  let requestId = '';
  let overpayAsk: { outstanding: number } | null = null;
  let overpayOk = false;

  function openForm(r: QuotePaymentsRow) {
    formFor = r.quoteId;
    // A fresh id per confirmation: a double click or a retry after a timeout
    // reuses it, so the server records the money once.
    requestId = (crypto as any)?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    overpayAsk = null;
    overpayOk = false;
    const next = r.summary.options.find((o) => o.plan === 'next') ?? r.summary.options[0];
    const lastNotice = r.transferNotices[r.transferNotices.length - 1];
    fAmount = String(lastNotice?.amount ?? next?.amount ?? '');
    fDate = new Date().toISOString().slice(0, 10);
    fMethod = 'Bank wire';
    fRef = lastNotice?.reference ?? '';
    fNotify = true;
    fBankFee = '';
    fFeeBy = 'irp';
    formError = '';
  }

  async function submit(r: QuotePaymentsRow) {
    const amount = Number(String(fAmount).replace(/[$,\s]/g, ''));
    if (!Number.isFinite(amount) || amount <= 0) { formError = 'Enter the amount that arrived.'; return; }
    saving = true;
    formError = '';
    try {
      const res = await recordQuotePayment(clientId, r.quoteId, {
        amount, date: fDate, method: fMethod, reference: fRef.trim() || undefined, notifyClient: fNotify,
        bankFee: feeNum > 0 ? feeNum : undefined, feeCoveredBy: fFeeBy,
        requestId, confirmOverpay: overpayOk,
      });
      if (res.duplicate) {
        toasts.success?.('This payment was already recorded. Nothing was added twice.');
        formFor = '';
        await load(true);
        return;
      }
      toasts.success?.(
        res.stageMoved
          ? `Credited ${fmt(res.credited ?? amount)} on ${res.invoiceNumbers?.join(', ') ?? res.invoiceNumber}. Client moved to Initial Payment.`
          : `Credited ${fmt(res.credited ?? amount)} on ${res.invoiceNumbers?.join(', ') ?? res.invoiceNumber}.`,
      );
      formFor = '';
      await load(true);
    } catch (e: any) {
      if (e?.data?.code === 'over_outstanding') {
        overpayAsk = { outstanding: Number(e.data.outstanding) || 0 };
        formError = '';
        return;
      }
      formError = e?.message ?? 'Could not record the payment';
    } finally {
      saving = false;
    }
  }
</script>

{#if loading && !rows.length}
  <div class="qp qp--loading" aria-busy="true">Loading payments…</div>
{:else if error}
  <div class="qp qp--error" role="alert">⚠️ {error} <button type="button" on:click={() => load()}>Retry</button></div>
{:else if rows.length}
  <section class="qp" aria-labelledby="qp-title">
    <header class="qp__head">
      <h3 id="qp-title" class="qp__title">
        <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>
        Payments
      </h3>
      {#if !enabled}
        <span class="qp__mode is-off">Online payments off</span>
      {:else if !livemode}
        <span class="qp__mode is-test">Test mode</span>
      {/if}
    </header>

    {#each rows as r (r.quoteId)}
      {@const st = stateOf(r, who)}
      {@const s = r.summary}
      <article class="qp-card">
        <div class="qp-card__top">
          <div class="qp-card__name">
            <span class="qp-card__title">{r.title || 'Accepted quote'}</span>
            <span class="qp-card__sub">Accepted {day(r.acceptedAt)}</span>
          </div>
          <StatusPill status={st.status} label={st.pill} size="sm" />
        </div>

        <!-- Where it stands + the one thing to do now -->
        <div class="qp-now qp-now--{st.status}">
          <p class="qp-now__line">{st.line}</p>
          {#if st.main === 'copy' && r.payUrl}
            <button type="button" class="qp-btn qp-btn--primary" on:click={() => copyLink(r)}>{copied === r.quoteId ? '✓ Link copied' : st.mainLabel}</button>
          {:else if st.main === 'confirm' && formFor !== r.quoteId}
            <button type="button" class="qp-btn qp-btn--primary" on:click={() => openForm(r)}>{st.mainLabel}</button>
          {:else if st.main === 'stripe'}
            {@const dp = r.payments.find((p) => p.disputedAt)}
            {#if dp?.dashboardUrl}<a class="qp-btn qp-btn--primary" href={dp.dashboardUrl} target="_blank" rel="noopener noreferrer">{st.mainLabel} ↗</a>{/if}
          {/if}
        </div>

        <div class="qp-meter" role="img" aria-label={`${fmt(s.received, s.currency)} received of ${fmt(s.agreedTotal, s.currency)}`}>
          {#each s.schedule as seg}
            <span class="qp-meter__seg qp-meter__seg--{seg.status}" style="flex-grow:{seg.percent}" title={`${seg.label} ${seg.percent}% · ${fmt(seg.amount, s.currency)} · ${seg.status}`}></span>
          {/each}
        </div>

        <dl class="qp-figs">
          <div><dt>Agreed</dt><dd>{fmt(s.agreedTotal, s.currency)}</dd></div>
          <div><dt>Received</dt><dd class="is-good">{fmt(s.received, s.currency)}</dd></div>
          {#if s.processing > 0}<div><dt>On its way</dt><dd class="is-info">{fmt(s.processing, s.currency)}</dd></div>{/if}
          <div><dt>Left to pay</dt><dd>{fmt(s.outstanding, s.currency)}</dd></div>
          {#if r.fees?.total}
            <div title="What Stripe or the bank charged IRP on this deal">
              <dt>Fees we paid</dt><dd class="is-cost">−{fmt(r.fees.total, s.currency)}</dd>
            </div>
            <div title="Received minus fees"><dt>What we kept</dt><dd>{fmt(r.netReceived, s.currency)}</dd></div>
          {/if}
        </dl>
        {#if r.fees?.items?.length}
          <details class="qp-fees">
            <summary>{r.fees.items.length} fee{r.fees.items.length === 1 ? '' : 's'} on this deal{r.fees.bank ? ` · ${fmt(r.fees.stripe, s.currency)} Stripe, ${fmt(r.fees.bank, s.currency)} bank` : ''}</summary>
            <ul>
              {#each r.fees.items as f}
                <li><span>{f.label}</span><span class="qp-fees__amt">{f.amount < 0 ? '+' : '−'}{fmt(Math.abs(f.amount), s.currency)}</span><span class="qp-fees__date">{day(f.date)}</span></li>
              {/each}
            </ul>
          </details>
        {/if}

        {#if r.payments.length}
          <ul class="qp-list" aria-label="Online payments">
            {#each r.payments as p (p.paymentIntentId)}
              <li>
                <span class="qp-list__amt">{fmt(p.amount, p.currency)}</span>
                <span class="qp-list__meta">
                  {[p.methodLabel ?? 'Online', day(p.createdAt), p.invoiceNumber, p.fee || p.otherFees ? `fees ${fmt((p.fee ?? 0) + (p.otherFees ?? 0), p.currency)}` : null].filter(Boolean).join(' · ')}
                  {#if p.failureMessage && p.status !== 'succeeded'}<br /><span class="qp-list__err">{p.failureMessage}</span>{/if}
                  {#if p.disputedAt}<br /><span class="qp-list__err">Disputed {day(p.disputedAt)}</span>{/if}
                </span>
                <StatusPill status={statusOfPayment(p.status, !!p.disputedAt)} size="sm" />
                {#if p.dashboardUrl}<a class="qp-link" href={p.dashboardUrl} target="_blank" rel="noopener noreferrer">Stripe ↗</a>{/if}
              </li>
            {/each}
          </ul>
        {/if}

        {#each st.main === 'confirm' ? [] : r.transferNotices as n}
          <p class="qp-notice">🏦 {`${who} says they sent a wire${n.sentOn ? ` on ${day(n.sentOn)}` : ` (told us ${day(n.reportedAt)})`}${n.amount ? ` for ${fmt(n.amount, s.currency)}` : ''}${n.reference ? ` · ref “${n.reference}”` : ''}.`}</p>
        {/each}

        <div class="qp-actions">
          {#if r.payUrl && !s.fullyPaid && st.main !== 'copy'}
            <button type="button" class="qp-btn" on:click={() => copyLink(r)}>{copied === r.quoteId ? '✓ Link copied' : 'Copy payment link'}</button>
          {/if}
          {#if !s.fullyPaid && formFor !== r.quoteId && st.main !== 'confirm'}
            <button type="button" class="qp-btn" on:click={() => openForm(r)}>Confirm money that arrived</button>
          {/if}
        </div>

        {#if formFor === r.quoteId}
          <form class="qp-form" on:submit|preventDefault={() => submit(r)}>
            <h4 class="qp-form__title">Confirm money that arrived</h4>
            <p class="qp-form__hint">For wires, Zelle, checks and cash. Card and bank payments made online show up here by themselves.</p>
            <div class="qp-form__grid">
              <label>Amount that landed ({s.currency})<input inputmode="decimal" bind:value={fAmount} on:input={() => { overpayAsk = null; overpayOk = false; }} required /></label>
              <label>Date received<input type="date" bind:value={fDate} required /></label>
              <label>Method
                <select bind:value={fMethod}>
                  <option>Bank wire</option><option>ACH transfer</option><option>Zelle</option><option>Check</option><option>Cash</option><option>Other</option>
                </select>
              </label>
              <label>Reference<input bind:value={fRef} placeholder="Bank confirmation #" /></label>
              <label>Bank fees deducted<input inputmode="decimal" bind:value={fBankFee} placeholder="0.00" /></label>
            </div>
            {#if feeNum > 0}
              <fieldset class="qp-form__fee">
                <legend>Who covers the {fmt(feeNum, s.currency)} fee?</legend>
                <label><input type="radio" bind:group={fFeeBy} value="irp" /> IRP absorbs it — credit the client {fmt(amtNum + feeNum, s.currency)} and book the fee as a cost of this deal</label>
                <label><input type="radio" bind:group={fFeeBy} value="client" /> Client still owes it — credit {fmt(amtNum, s.currency)}</label>
              </fieldset>
            {/if}
            <label class="qp-form__check"><input type="checkbox" bind:checked={fNotify} /> Email the client a payment confirmation</label>
            {#if overpayAsk}
              <div class="qp-form__warn" role="alert">
                <p><strong>That is more than the {fmt(overpayAsk.outstanding, s.currency)} left to pay.</strong> Check the amount for a typo (for example 35,000 instead of 3,500).</p>
                <label class="qp-form__check"><input type="checkbox" bind:checked={overpayOk} /> The amount is correct; the client paid more than what was left</label>
              </div>
            {/if}
            {#if formError}<p class="qp-form__err" role="alert">{formError}</p>{/if}
            <div class="qp-actions">
              <button type="button" class="qp-btn" on:click={() => (formFor = '')} disabled={saving}>Cancel</button>
              <button type="submit" class="qp-btn qp-btn--primary" disabled={saving || (!!overpayAsk && !overpayOk)}>{saving ? 'Saving…' : `Confirm ${fmt(fFeeBy === 'irp' ? amtNum + feeNum : amtNum, s.currency)} received`}</button>
            </div>
          </form>
        {/if}
      </article>
    {/each}
  </section>
{/if}

<style>
  .qp {
    background: #fff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 14px 16px; margin-bottom: 16px;
    box-shadow: 0 1px 3px rgba(15,23,42,0.05), 0 1px 10px rgba(2,181,187,0.04);
  }
  .qp--loading, .qp--error { font-size: 12.5px; color: #64748b; }
  .qp--error { color: #b42318; }
  .qp--error button { margin-left: 8px; font: inherit; font-size: 12px; cursor: pointer; }
  .qp__head { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 8px; }
  .qp__title { margin: 0; display: flex; align-items: center; gap: 7px; font-size: 12px; font-weight: 800; color: #0f172a; text-transform: uppercase; letter-spacing: 0.06em; }
  .qp__title svg { color: #02b6bc; }
  .qp__mode { font-size: 10.5px; font-weight: 800; padding: 2px 10px; border-radius: 999px; color: #0d7377; background: rgba(2,182,188,0.1); border: 1px solid rgba(2,182,188,0.24); }
  .qp__mode.is-test { color: #9a3412; background: #fff7ed; border-color: #fed7aa; }
  .qp__mode.is-off { color: #475569; background: #f1f5f9; border-color: #e2e8f0; }
  .qp-now { display: grid; gap: 8px; margin: 0 0 12px; padding: 10px 12px; border-radius: 10px; border-left: 3px solid #94a3b8; background: #f8fafc; }
  .qp-now--received { border-left-color: #16a34a; background: #f0fdf4; }
  .qp-now--on_its_way { border-left-color: #0369a1; background: #f0f9ff; }
  .qp-now--problem { border-left-color: #b42318; background: #fef3f2; }
  .qp-now__line { margin: 0; font-size: 13.5px; line-height: 1.5; color: #0f172a; }
  .qp-now .qp-btn { justify-self: start; display: inline-flex; align-items: center; text-decoration: none; }
  .qp-form__title { margin: 0 0 4px; font-size: 13.5px; font-weight: 800; color: #0f172a; }

  .qp-card { border-top: 1px solid #eef2f7; padding-top: 12px; margin-top: 10px; }
  .qp-card:first-of-type { border-top: 0; margin-top: 0; padding-top: 4px; }
  .qp-card__top { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; margin-bottom: 10px; }
  .qp-card__name { display: flex; flex-direction: column; min-width: 0; }
  .qp-card__title { font-size: 13.5px; font-weight: 700; color: #0f172a; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .qp-card__sub { font-size: 11.5px; color: #64748b; }

  .qp-pill { font-size: 11px; font-weight: 800; padding: 3px 10px; border-radius: 999px; white-space: nowrap; }
  .qp-pill--paid { background: #dcfce7; color: #166534; }
  .qp-pill--deposit { background: #ccfbf1; color: #115e59; }
  .qp-pill--clearing { background: #e0f2fe; color: #075985; }
  .qp-pill--wire { background: #fef3c7; color: #92400e; }
  .qp-pill--due { background: #f1f5f9; color: #334155; }

  .qp-meter { display: flex; gap: 3px; height: 8px; margin-bottom: 10px; }
  .qp-meter__seg { border-radius: 99px; background: #e2e8f0; }
  .qp-meter__seg--paid { background: #0a7c81; }
  .qp-meter__seg--processing { background: repeating-linear-gradient(45deg, #5eb8bb 0 5px, #9ad6d8 5px 10px); }
  .qp-meter__seg--partial { background: linear-gradient(90deg, #0a7c81 50%, #e2e8f0 50%); }

  .qp-figs { display: grid; grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); gap: 8px; margin: 0 0 10px; }
  .qp-figs div { background: #f8fafc; border-radius: 10px; padding: 8px 10px; }
  .qp-figs dt { font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; }
  .qp-figs dd { margin: 2px 0 0; font-size: 14px; font-weight: 800; color: #0f172a; font-variant-numeric: tabular-nums; }
  .qp-figs dd.is-good { color: #0a7c81; }
  .qp-figs dd.is-info { color: #075985; }
  .qp-figs dd.is-cost { color: #b45309; }
  .qp-fees { margin: 0 0 10px; font-size: 12px; color: #475569; }
  .qp-fees summary { cursor: pointer; font-weight: 700; color: #334155; padding: 2px 0; }
  .qp-fees summary:focus-visible { outline: 2px solid #0a7c81; outline-offset: 2px; border-radius: 4px; }
  .qp-fees ul { list-style: none; margin: 6px 0 0; padding: 0; display: grid; gap: 4px; }
  .qp-fees li { display: flex; gap: 10px; }
  .qp-fees li > span:first-child { flex: 1; }
  .qp-fees__amt { font-weight: 700; color: #b45309; font-variant-numeric: tabular-nums; }
  .qp-fees__date { color: #94a3b8; min-width: 84px; text-align: right; }
  .qp-form__fee { border: 1px solid #e2e8f0; border-radius: 10px; padding: 8px 10px; margin: 0 0 10px; display: grid; gap: 6px; }
  .qp-form__fee legend { font-size: 11.5px; font-weight: 700; color: #334155; padding: 0 4px; }
  .qp-form .qp-form__fee label { flex-direction: row; align-items: flex-start; gap: 8px; font-weight: 500; font-size: 12px; }
  .qp-form .qp-form__fee input { min-height: auto; width: 16px; height: 16px; padding: 0; margin: 1px 0 0; flex: none; accent-color: #0a7c81; }

  .qp-list { list-style: none; margin: 0 0 10px; padding: 0; display: grid; gap: 6px; }
  .qp-list li { display: flex; align-items: center; gap: 10px; font-size: 12.5px; padding: 8px 10px; border: 1px solid #eef2f7; border-radius: 10px; }
  .qp-list__amt { font-weight: 800; color: #0f172a; font-variant-numeric: tabular-nums; min-width: 84px; }
  .qp-list__meta { flex: 1; color: #475569; line-height: 1.4; }
  .qp-list__err { color: #b42318; }
  .qp-chip { font-size: 10.5px; font-weight: 800; padding: 2px 8px; border-radius: 99px; background: #f1f5f9; color: #334155; }
  .qp-chip--succeeded { background: #dcfce7; color: #166534; }
  .qp-chip--processing { background: #e0f2fe; color: #075985; }
  .qp-chip--requires_payment_method, .qp-chip--canceled { background: #fef3f2; color: #b42318; }
  .qp-link { font-size: 12px; font-weight: 700; color: #0a7c81; text-decoration: none; white-space: nowrap; }
  .qp-link:hover { text-decoration: underline; }

  .qp-notice { margin: 0 0 8px; font-size: 12.5px; color: #92400e; background: #fffbeb; border: 1px solid #fde68a; border-radius: 10px; padding: 8px 10px; }

  .qp-actions { display: flex; flex-wrap: wrap; gap: 8px; justify-content: flex-end; }
  .qp-btn {
    min-height: 32px; padding: 0 14px; border-radius: 8px; border: 1px solid #cbd5e1; background: #fff; color: #0f172a;
    font: inherit; font-size: 12px; font-weight: 700; cursor: pointer;
  }
  .qp-btn:hover:not(:disabled) { border-color: #0a7c81; color: #0a7c81; }
  .qp-btn--primary { background: linear-gradient(135deg, #0a8a8e 0%, #0a7c81 100%); color: #fff; border-color: transparent; }
  .qp-btn--primary:hover:not(:disabled) { color: #fff; filter: brightness(1.06); }
  .qp-btn:disabled { opacity: 0.6; cursor: wait; }
  .qp-btn:focus-visible, .qp-link:focus-visible { outline: 2px solid #0a7c81; outline-offset: 2px; }

  .qp-form { margin-top: 10px; padding: 12px; border-radius: 12px; background: #f8fafc; border: 1px solid #e2e8f0; }
  .qp-form__hint { margin: 0 0 10px; font-size: 12px; color: #475569; line-height: 1.45; }
  .qp-form__grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 10px; margin-bottom: 10px; }
  .qp-form label { display: flex; flex-direction: column; gap: 4px; font-size: 11.5px; font-weight: 700; color: #334155; }
  .qp-form input, .qp-form select { min-height: 34px; padding: 0 10px; border: 1px solid #cbd5e1; border-radius: 8px; font: inherit; font-size: 13px; font-weight: 500; background: #fff; color: #0f172a; }
  .qp-form input:focus, .qp-form select:focus { outline: 2px solid #0a7c81; outline-offset: 0; border-color: #0a7c81; }
  .qp-form .qp-form__check { flex-direction: row; align-items: center; gap: 8px; font-weight: 600; margin-bottom: 10px; }
  .qp-form__check input { min-height: auto; width: 16px; height: 16px; accent-color: #0a7c81; }
  .qp-form__warn { margin: 0 0 10px; padding: 8px 10px; border-radius: 8px; background: #fffbeb; border: 1px solid #fde68a; font-size: 12px; color: #78350f; }
  .qp-form__warn p { margin: 0 0 6px; line-height: 1.45; }
  .qp-form__err { margin: 0 0 8px; color: #b42318; font-size: 12px; }
</style>
