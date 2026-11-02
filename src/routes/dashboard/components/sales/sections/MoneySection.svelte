<script lang="ts">
  /**
   * Money — the bridge from booked to outstanding, Outstanding split into
   * parts that sum exactly to it, expected cash, receivables by client, cash
   * by method and the post-sale collection curve (sales-book-v3 §6.3).
   */
  import Waterfall from '../../metrics/charts/Waterfall.svelte';
  import BarList from '../../metrics/charts/BarList.svelte';
  import Heatmap from '../../metrics/charts/Heatmap.svelte';
  import type { BarRow, HeatCell } from '../../metrics/charts/types.ts';
  import { money as fmtMoney, pct } from '../../metrics/engine/format.ts';
  import { monthLabel } from '../../metrics/engine/period.ts';
  import { crDateKey } from '../../metrics/engine/period.ts';
  import { bookTotals, collectionCurve, expectedCash, moneyBridge, P_COLLECT, type InvoicedAge, type NotInvoicedAge } from '../../metrics/engine/sales.ts';
  import { NO_DRAWER, openClient } from '../openClient.ts';
  import type { Book } from '../types.ts';

  export let book: Book;
  export let onView: (view: string) => void = () => {};

  const money = (n: number | null | undefined) => fmtMoney(n, book.currency);
  let err = '';

  // Bridge: lifetime in All time; otherwise the deals first accepted in the period.
  $: bridgeDeals = book.allTime ? book.deals : book.deals.filter((d) => d.acceptedAt && book.months.includes(crDateKey(d.acceptedAt)!.slice(0, 7)));
  $: bt = book.allTime ? book.totals : bookTotals(bridgeDeals, book.currency);
  $: bridge = moneyBridge(bt);
  const STEP_VIEW: Record<string, string> = { outstanding: 'invoiced_unpaid', dropped: 'cancelled', credit: 'credits' };

  $: p = book.part;
  $: exp = expectedCash(p, book.baseRows, book.rows, book.currency);
  $: partMax = Math.max(1, p.invoicedUnpaid, p.notInvoiced, p.atRisk.total);
  const INV_AGES: InvoicedAge[] = ['0-30', '31-60', '61-90', '90+'];
  const NOT_AGES: NotInvoicedAge[] = ['0-30', '31-90', '90+', 'undated'];

  // Receivables by client (sent invoices with a balance, this currency).
  let showAllRecs = false;
  $: recs = book.receivables.filter((r) => r.currency === book.currency);
  $: open = recs.filter((r) => r.due > 0);
  $: credits = recs.filter((r) => r.due < 0);
  $: shownRecs = showAllRecs ? open : open.slice(0, 12);

  // Cash by payment method in the period (from dated payments).
  $: methodRows = ((): BarRow[] => {
    const m = new Map<string, number>();
    const set = new Set(book.months);
    for (const r of book.rows) for (const x of r.payments ?? []) {
      if (x.cur !== book.currency || x.amount <= 0) continue;
      const mk = crDateKey(x.at)?.slice(0, 7);
      if (!book.allTime && (!mk || !set.has(mk))) continue;
      m.set(x.method || 'unspecified', (m.get(x.method || 'unspecified') ?? 0) + x.amount);
    }
    const total = [...m.values()].reduce((a, b) => a + b, 0);
    return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ key: k, label: k, value: v, display: money(v), cells: [pct(total ? v / total : null)] }));
  })();
  $: refunds = book.rows.flatMap((r) => (r.payments ?? []).filter((x) => x.cur === book.currency && x.amount < 0 && (book.allTime || book.months.includes(crDateKey(x.at)?.slice(0, 7) ?? ''))));
  $: hasPayments = book.rows.some((r) => Array.isArray(r.payments));

  // Post-sale collection curve.
  $: curve = book.cubeOk && hasPayments ? collectionCurve(book.rows, book.currency, book.nowMonth) : null;
  $: curveCols = Array.from({ length: 7 }, (_, k) => ({ key: String(k), label: k === 0 ? 'Month 0' : `+${k}` }));
  $: curveCells = (curve?.rows ?? []).map((r) => r.cells.map((v): HeatCell => ({ value: v, n: r.deals, display: v === null ? '' : pct(v, 0) })));
  $: avgRow = curve ? [curve.average.map((v): HeatCell => ({ value: v, n: 1, display: v === null ? '' : pct(v, 0) }))] : [];

  async function open1(id: string | null) { err = (await openClient(id)) ?? ''; }
</script>

{#if err}<p class="mh-alert mh-alert--error" role="alert">{err}</p>{/if}

<div class="mh-grid-2">
  <div class="mh-card">
    <h4 class="mh-card__h">Money bridge · {book.allTime ? 'every deal' : `deals won in ${book.rangeLabel}`}</h4>
    {#if bt.deals}
      <Waterfall steps={bridge.steps} format={(n) => money(n)} selectable={Object.keys(STEP_VIEW)} caption="From booked to outstanding"
        on:select={(e) => onView(STEP_VIEW[e.detail.key])} />
      <p class="mh-hint sb-gap">
        Booked {bt.invoicedAboveBooked ? '+ invoiced above booked ' : ''}− collected {bt.credit ? '+ client credit ' : ''}= what is still owed{bt.droppedBalance ? ', minus balances of deals dropped after acceptance (not owed)' : ''}.
        {#if !bridge.closes}<strong class="mh-bad"> The bridge does not close — see Data quality.</strong>{/if}
        {#if Object.keys(bt.otherCurrencies).length}<br />Not included: {Object.entries(bt.otherCurrencies).map(([c, o]) => `${o.deals} deal${o.deals === 1 ? '' : 's'} in ${c}`).join(', ')}.{/if}
      </p>
    {:else}
      <p class="mh-empty">No {book.currency} deals {book.allTime ? '' : `won in ${book.rangeLabel}`}.</p>
    {/if}
  </div>

  <div class="mh-card">
    <h4 class="mh-card__h">Outstanding, explained · {money(p.total)} as of today</h4>
    <ul class="sb-parts">
      <li>
        <button class="sb-part" on:click={() => onView('invoiced_unpaid')}>
          <span class="sb-part__label">Invoiced, unpaid</span>
          <span class="sb-part__bar" aria-hidden="true"><span style="width:{(p.invoicedUnpaid / partMax) * 100}%"></span></span>
          <span class="sb-part__value">{money(p.invoicedUnpaid)}</span>
        </button>
        <span class="sb-part__ages">{#each INV_AGES as a}{#if p.invoicedByAge[a]}<span class:mh-bad={a === '61-90' || a === '90+'}>{a} d: {money(p.invoicedByAge[a])}</span>{/if}{/each}</span>
      </li>
      <li>
        <button class="sb-part" on:click={() => onView('not_invoiced')}>
          <span class="sb-part__label">Accepted, not invoiced</span>
          <span class="sb-part__bar sb-part__bar--b" aria-hidden="true"><span style="width:{(p.notInvoiced / partMax) * 100}%"></span></span>
          <span class="sb-part__value">{money(p.notInvoiced)}</span>
        </button>
        <span class="sb-part__ages">{#each NOT_AGES as a}{#if p.notInvoicedByAge[a]}<span class:mh-bad={a === '90+'}>{a === 'undated' ? 'no acceptance date' : `${a} d since accepted`}: {money(p.notInvoicedByAge[a])}</span>{/if}{/each}</span>
      </li>
      {#if p.atRisk.total}
        <li>
          <button class="sb-part sb-part--risk" on:click={() => onView('cancelled')}>
            <span class="sb-part__label">At risk: dropped after acceptance</span>
            <span class="sb-part__bar sb-part__bar--risk" aria-hidden="true"><span style="width:{(p.atRisk.total / partMax) * 100}%"></span></span>
            <span class="sb-part__value">{money(p.atRisk.total)}</span>
          </button>
          <span class="sb-part__ages">{p.atRisk.deals.length} deal{p.atRisk.deals.length === 1 ? '' : 's'} · not counted in Outstanding</span>
        </li>
      {/if}
    </ul>
    {#if p.paidOutsideInvoices > 0}
      <p class="mh-hint">{money(p.paidOutsideInvoices)} of open invoice balances is already covered by payments logged in Finance (not on the invoice). Mark those invoices paid to clean up.</p>
    {/if}

    <h4 class="mh-card__h sb-mt">Expected cash · estimate</h4>
    <table class="mh-table mh-table--compact">
      <tbody>
        <tr><th scope="row">From invoiced balances</th><td class="num">{money(exp.fromInvoiced)}</td></tr>
        <tr><th scope="row">From balances not yet invoiced</th><td class="num">{money(exp.fromNotInvoiced)}</td></tr>
        <tr><th scope="row">From {exp.openQuotes} open quote{exp.openQuotes === 1 ? '' : 's'}</th><td class="num">{money(exp.fromOpenQuotes)} <span class="mh-muted">± {money(exp.quoteSd)}</span></td></tr>
      </tbody>
      <tfoot><tr><th scope="row">Expected</th><td class="num">{money(exp.total)}</td></tr></tfoot>
    </table>
    <p class="mh-hint">Collection chances are placeholders until history measures them: invoiced ≤ 60 d {pct(P_COLLECT.invoiced['0-30'])}, older {pct(P_COLLECT.invoiced['90+'])}; not invoiced ≤ 90 d {pct(P_COLLECT.notInvoiced['0-30'])}, older {pct(P_COLLECT.notInvoiced['90+'])}. The ± covers open quotes only.{exp.excludedAtRisk ? ` ${money(exp.excludedAtRisk)} at risk is left out.` : ''}</p>
  </div>
</div>

<div class="mh-grid-32 sb-mt">
  <div>
    <h4 class="mh-sub">Receivables by client <span class="mh-muted">· sent invoices with a balance, oldest first</span></h4>
    {#if !book.v2?.receivables}
      <p class="mh-empty">Needs the server update (per-invoice receivables).</p>
    {:else if !open.length}
      <p class="mh-empty">No sent {book.currency} invoice is waiting for payment.</p>
    {:else}
      <div class="mh-table-wrap">
        <table class="mh-table sb-cards">
          <thead><tr><th scope="col">Client</th><th scope="col">Invoice</th><th scope="col">Sent</th><th scope="col" class="num">Total</th><th scope="col" class="num">Received</th><th scope="col" class="num">Due</th><th scope="col" class="num">Age</th></tr></thead>
          <tbody>
            {#each shownRecs as r (r.invoiceId)}
              {@const d = book.deals.find((x) => x.key === r.dealKey)}
              <tr>
                <th scope="row" data-label="Client">
                  {#if d?.consultationId}<button class="sb-name" on:click={() => open1(d.consultationId)}>{r.name}</button>{:else}<span title={NO_DRAWER}>{r.name}</span>{/if}
                </th>
                <td data-label="Invoice">{r.number ?? '—'}</td>
                <td data-label="Sent">{r.sentAt ? new Date(r.sentAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit', timeZone: 'America/Costa_Rica' }) : '—'}</td>
                <td class="num" data-label="Total">{money(r.total)}</td>
                <td class="num" data-label="Received">{money(r.received)}</td>
                <td class="num sb-owed" data-label="Due">{money(r.due)}</td>
                <td class="num" data-label="Age" class:mh-bad={(r.ageDays ?? 0) > 60}>{r.ageDays ?? '—'} d</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
      {#if open.length > 12}<button class="mh-btn mh-btn--sm sb-mt-s" on:click={() => (showAllRecs = !showAllRecs)}>{showAllRecs ? 'Show fewer' : `Show all ${open.length}`}</button>{/if}
      {#if credits.length}<p class="mh-hint sb-mt-s">Credits (client overpaid): {credits.map((c) => `${c.name} ${money(-c.due)}`).join(' · ')}</p>{/if}
    {/if}
  </div>
  <div>
    <h4 class="mh-sub">Cash by payment method <span class="mh-muted">· {book.rangeLabel}</span></h4>
    {#if !hasPayments}
      <p class="mh-empty">Needs the server update (dated payments).</p>
    {:else if methodRows.length}
      <BarList rows={methodRows} labelHeader="Method" valueLabel="Cash" columns={['Share']} caption="Cash by payment method" />
    {:else}
      <p class="mh-empty">No cash received in {book.rangeLabel}.</p>
    {/if}
    {#if refunds.length}<p class="mh-hint">Refunds: {refunds.length} · {money(refunds.reduce((a, r) => a - r.amount, 0))}</p>{/if}
  </div>
</div>

<div class="sb-mt">
  <h4 class="mh-sub">Post-sale collection curve <span class="mh-muted">· share of booked collected k months after acceptance, by acceptance month</span></h4>
  {#if !curve}
    <p class="mh-empty">{book.cubeOk ? 'Needs the server update (dated payments).' : 'Segment data unavailable.'}</p>
  {:else if !curve.rows.length}
    <p class="mh-empty">No {book.currency} deals accepted in the last 12 complete months.</p>
  {:else}
    <Heatmap rowLabels={curve.rows.map((r) => ({ key: r.month, label: `${monthLabel(r.month, true)} · ${r.deals}` }))} colLabels={curveCols} cells={curveCells} rowHeader="Accepted · deals" domain={[0, 1]} caption="Cumulative share of booked collected by months after acceptance" />
    <Heatmap rowLabels={[{ key: 'avg', label: 'Weighted average' }]} colLabels={curveCols} cells={avgRow} rowHeader="" domain={[0, 1]} caption="Average collection curve" />
    <p class="mh-hint">Blank = not happened yet. Deposits paid before acceptance count in month 0 ({curve.rows.reduce((a, r) => a + r.depositsBefore, 0)} such payments). {#if curve.cancelled.deals}{curve.cancelled.deals} deal{curve.cancelled.deals === 1 ? '' : 's'} dropped after acceptance left out ({money(curve.cancelled.cash)} collected of {money(curve.cancelled.booked)}).{/if}</p>
  {/if}
</div>
