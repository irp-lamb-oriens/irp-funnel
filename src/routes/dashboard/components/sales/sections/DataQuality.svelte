<script lang="ts">
  /**
   * DataQuality — what to fix and what every number means (sales-book-v3 §6.9).
   * Whole database (not filtered). Definitions are rendered from the code that
   * computes the numbers, so the page and the definitions can't drift.
   */
  import { MEASURES, basisLabel } from '../../metrics/engine/registry.ts';
  import { money as fmtMoney, pct } from '../../metrics/engine/format.ts';
  import { forecastCalibration, moneyBridge, P_COLLECT, SAVED_VIEWS } from '../../metrics/engine/sales.ts';
  import type { MetricsCube } from '../../metrics/engine/types.ts';
  import { NO_DRAWER, openClient } from '../openClient.ts';
  import type { Book } from '../types.ts';

  export let book: Book;
  export let excludeTest = true;
  export let cube: MetricsCube | null = null;
  export let loadedAt = '';

  const money = (n: number | null | undefined, cur = book.currency) => fmtMoney(n, cur);
  let err = '';
  async function open1(id: string | null) { err = (await openClient(id)) ?? ''; }

  $: v2 = book.v2;
  // The v2 "switch currency" note doesn't apply here: the deal book shows every currency.
  $: warnings = (v2?.warnings ?? []).filter((w) => !/not included in this/.test(w));
  $: h = v2?.health ?? null;
  $: tests = v2?.testRecords ?? [];
  $: invoiceOnly = book.deals.filter((d) => !d.consultationId);
  $: noCubeRow = book.cubeOk ? book.deals.filter((d) => !book.rowsById.has(d.key)) : [];
  $: bridgeOk = moneyBridge(book.totals).closes;
  $: cal = book.cubeOk ? forecastCalibration(book.baseRows) : null;
  $: coverage = (() => {
    const won = book.rows.filter((r) => (r.money[book.currency]?.booked ?? 0) > 0);
    const total = won.reduce((s, r) => s + r.money[book.currency].booked, 0);
    const share = (f: (r: (typeof won)[number]) => boolean) => (total > 0 ? won.filter(f).reduce((s, r) => s + r.money[book.currency].booked, 0) / total : null);
    return [
      { label: 'Provider cost recorded (margin is real)', v: share((r) => r.costKnown) },
      { label: 'Channel known', v: share((r) => !['Unknown', 'Other', 'No lead record'].includes(r.channel)) },
      { label: 'Route known', v: share((r) => r.route !== 'Unknown') },
      { label: 'Budget known', v: share((r) => r.budget !== 'Unknown') },
      { label: 'Lead record exists', v: share((r) => r.isLead) },
    ];
  })();
  const RULE: Record<string, string> = { override: 'listed by hand', email: 'test email', name: 'test name', transcript: 'test transcript' };

  const SB_DEFS: Array<[string, string]> = [
    ['Outstanding', 'Per deal: the larger of booked and invoiced, minus cash received, as of today; summed over deals not dropped. Dropped-after-acceptance balances are shown apart as "at risk".'],
    ['Invoiced, unpaid / Not yet invoiced', 'Outstanding split per deal: the part already invoiced (min of outstanding and invoiced − cash) and the rest. The two always add up to Outstanding.'],
    ['Expected cash', `Estimate: balances × chance to collect (invoiced ≤ 60 d ${pct(P_COLLECT.invoiced['0-30'])}, older ${pct(P_COLLECT.invoiced['90+'])}; not invoiced ≤ 90 d ${pct(P_COLLECT.notInvoiced['0-30'])}, older ${pct(P_COLLECT.notInvoiced['90+'])} — placeholders), plus open quotes × historical win chance by age.`],
    ['Money bases', '"When it happened" (Scoreboard, History): booked on acceptance, cash on payment, invoiced on sending. "Deals won in the period" (By segment, bridge): all money of deals first accepted in the period, cash to date. Per-lead figures live on the Metrics tab.'],
    ['Fair comparison', 'A partial month is compared on the same days, through yesterday (Costa Rica), clamped to the shorter month. Figures that cannot be cut by day say "not comparable". All time compares the last 12 complete months with the 12 before.'],
    ['Small samples', 'Rates on fewer than 15 cases print as "x of n"; medians and averages on fewer than 5 print the count only; changes are hidden when both counts are under 10.'],
    ['DSO (90 days)', 'Receivable today ÷ invoiced in the last 90 days × 90.'],
    ['Quote movement', 'Accepted quote total vs the largest option of the first quote sent, over deals won in the period; revised quotes reported apart; currency switches left out.'],
    ['Post-sale collection curve', 'For deals first accepted in a month: cumulative cash k months later ÷ booked at acceptance. Months that have not happened are blank.'],
    ['Test records', 'One rule for both tabs: test emails or names, plus a hand-kept list on the server. Hidden by default; the toggle shows them.'],
  ];
</script>

{#if err}<p class="mh-alert mh-alert--error" role="alert">{err}</p>{/if}

<div class="mh-grid-2">
  <div class="mh-card">
    <h4 class="mh-card__h">Things to check</h4>
    {#if warnings.length}
      <ul class="sb-warn">{#each warnings as w}<li>{w}</li>{/each}</ul>
    {:else if v2}
      <p class="mh-hint">All sources agree.</p>
    {/if}
    {#if !bridgeOk}<p class="mh-bad">The money bridge does not close for {book.currency} — a deal's figures disagree. Check deals with mixed currencies.</p>{/if}
    {#if h}
      <table class="mh-table mh-table--compact">
        <caption class="sr-only">Paid clients by source and data gaps</caption>
        <tbody>
          <tr><th scope="row">Clients with a recorded payment</th><td class="num">{h.paidByPayments}</td></tr>
          <tr><th scope="row">Clients flagged “payment confirmed”</th><td class="num">{h.paidByConfirmedFlag}</td></tr>
          <tr><th scope="row">Paid but not flagged confirmed</th><td class="num">{h.paidWithoutConfirmedFlag}</td></tr>
          <tr><th scope="row">Finance payments matched to an invoice payment (counted once)</th><td class="num">{h.duplicateSettlementPayments}</td></tr>
          <tr><th scope="row">Payments with no date</th><td class="num">{h.undatedPayments}</td></tr>
          <tr><th scope="row">Leads with no date</th><td class="num">{h.undatedLeads}</td></tr>
          <tr><th scope="row">Invoices not linked to a lead</th><td class="num">{h.orphanInvoices}</td></tr>
          <tr><th scope="row">Invoice-only clients (no lead card)</th><td class="num">{invoiceOnly.length}</td></tr>
          {#if book.cubeOk}<tr><th scope="row">Deals without segment data</th><td class="num">{noCubeRow.length}</td></tr>{/if}
          <tr><th scope="row">Legacy payment counter</th><td class="num">{h.paidByCounters ?? '—'}</td></tr>
        </tbody>
      </table>
      {#if h.confirmedWithoutPayment.length}<p class="mh-hint sb-mt-s"><strong>Flagged confirmed, no payment recorded:</strong> {h.confirmedWithoutPayment.slice(0, 15).join(', ')}{h.confirmedWithoutPayment.length > 15 ? '…' : ''}</p>{/if}
      {#if h.currencyMismatchDeals.length}<p class="mh-hint"><strong>Mixed currencies:</strong> {h.currencyMismatchDeals.slice(0, 12).join(', ')}</p>{/if}
      {#if h.creditInvoices.length}<p class="mh-hint"><strong>Overpaid invoices:</strong> {h.creditInvoices.join(', ')}</p>{/if}
      {#if invoiceOnly.length}<p class="mh-hint"><strong>Invoice-only clients</strong> ({NO_DRAWER.toLowerCase()}): {invoiceOnly.slice(0, 12).map((d) => d.name).join(', ')}</p>{/if}
    {/if}
  </div>

  <div class="mh-card">
    <h4 class="mh-card__h">Test records · {excludeTest ? 'hidden' : 'shown'} ({tests.length})</h4>
    {#if !v2?.testRecords}
      <p class="mh-empty">Needs the server update.</p>
    {:else if tests.length}
      <table class="mh-table mh-table--compact sb-cards">
        <thead><tr><th scope="col">Record</th><th scope="col">Caught by</th><th scope="col" class="num">Booked</th><th scope="col" class="num">Cash</th></tr></thead>
        <tbody>
          {#each tests as t (t.key)}
            <tr><th scope="row" data-label="Record"><button class="sb-name" on:click={() => open1(t.key)}>{t.name}</button></th><td data-label="Caught by">{RULE[t.rule] ?? t.rule}</td><td class="num" data-label="Booked">{t.currency ? money(t.booked, t.currency) : '—'}</td><td class="num" data-label="Cash">{t.currency ? money(t.cash, t.currency) : '—'}</td></tr>
          {/each}
        </tbody>
      </table>
      <p class="mh-hint">A real client caught by mistake? Add its id to <code>REAL_IDS</code> in <code>irp-funnel-server/API/finance/testRecordOverrides.ts</code>. A test record that slips through goes in <code>TEST_IDS</code>.</p>
    {:else}
      <p class="mh-hint">No test records found.</p>
    {/if}

    <h4 class="mh-card__h sb-mt">Coverage · share of booked ({book.currency}) with…</h4>
    <table class="mh-table mh-table--compact">
      <tbody>{#each coverage as c}<tr><th scope="row">{c.label}</th><td class="num" class:mh-bad={c.v !== null && c.v < 0.75}>{pct(c.v)}</td></tr>{/each}</tbody>
    </table>

    <h4 class="mh-card__h sb-mt">Forecast check</h4>
    {#if cal}
      <p class="mh-hint">Quotes first sent 60–180 days ago: the win curve learnt from older quotes predicted <strong>{cal.predicted}</strong> wins; <strong>{cal.actual}</strong> happened ({cal.tested} quotes). {Math.abs(cal.actual - cal.predicted) > Math.max(2, cal.predicted * 0.3) ? 'The forecast is off — read Expected cash with care.' : 'Close enough to trust as a rough guide.'}</p>
    {:else}
      <p class="mh-hint">Not enough quote history to back-test the forecast yet.</p>
    {/if}
  </div>
</div>

<details class="sb-defs sb-mt">
  <summary>Definitions · every number on this page</summary>
  <dl>
    {#each SB_DEFS as [k, d]}<dt>{k}</dt><dd>{d}</dd>{/each}
    {#each MEASURES as m (m.key)}<dt>{m.label} <span class="mh-muted">· {basisLabel(m)}</span></dt><dd>{m.def}</dd>{/each}
  </dl>
  <h5 class="mh-card__h">Deal book views</h5>
  <ul class="sb-viewdefs">{#each SAVED_VIEWS as v}<li><strong>{v.label}</strong>: {v.rule}</li>{/each}</ul>
</details>

<p class="mh-hint sb-dev">
  Sources loaded {loadedAt ? new Date(loadedAt).toLocaleString('en-US', { timeZone: 'America/Costa_Rica' }) : '—'} · report built {v2 ? new Date(v2.generatedAt).toLocaleTimeString('en-US', { timeZone: 'America/Costa_Rica' }) : '—'} · segment data {cube ? `schema ${cube.schemaVersion}, ${cube.rows.length} rows` : 'unavailable'} · deals {v2?.deals.length ?? '—'} · receivables {v2?.receivables?.length ?? 'n/a'}{cube?.warnings.length ? ` · notes: ${cube.warnings.join(' · ')}` : ''}
</p>

<style>
  .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
</style>
