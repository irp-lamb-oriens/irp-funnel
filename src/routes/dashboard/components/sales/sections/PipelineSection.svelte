<script lang="ts">
  /**
   * Pipeline — as of today: open quotes by age with their win chance, stalled
   * quotes, what was won and lost in the period, the value lost by reason,
   * cancellations after acceptance and how much quotes move before a "yes"
   * (sales-book-v3 §6.4). Conversion by segment lives on the Metrics tab.
   */
  import { money as fmtMoney, pct, fmtStat } from '../../metrics/engine/format.ts';
  import { crDateKey } from '../../metrics/engine/period.ts';
  import { isStalled, lossValue, openQuoteBuckets, quoteMovement, quotesPerWonDeal } from '../../metrics/engine/sales.ts';
  import { openClient } from '../openClient.ts';
  import type { Book } from '../types.ts';

  export let book: Book;
  export let onView: (view: string) => void = () => {};

  const money = (n: number | null | undefined, cur = book.currency) => fmtMoney(n, cur);
  const inP = (iso: string | null | undefined) => book.allTime || (!!iso && book.months.includes(crDateKey(iso)!.slice(0, 7)));
  let err = '';
  async function open1(id: string | null) { err = (await openClient(id)) ?? ''; }

  $: buckets = book.cubeOk ? openQuoteBuckets(book.rows, book.baseRows, book.currency) : [];
  $: openRows = book.rows.filter((r) => r.openQuote).sort((a, b) => (b.openQuote!.total - a.openQuote!.total));
  $: openShown = openRows.slice(0, 12);
  // Selected currency first (amounts in different currencies are not comparable), then by size.
  const curFirst = (a: { currency: string }, b: { currency: string }) => Number(b.currency === book.currency) - Number(a.currency === book.currency);
  $: won = book.deals.filter((d) => d.acceptedAt && inP(d.acceptedAt)).sort((a, b) => curFirst(a, b) || b.booked - a.booked);
  $: lost = book.deals.filter((d) => d.status === 'dropped' && inP(d.lastActivityAt)).sort((a, b) => curFirst(a, b) || (b.firstQuoteTotal ?? 0) - (a.firstQuoteTotal ?? 0));
  $: loss = lossValue(book.deals, book.currency, book.allTime ? null : book.months);
  $: wonAll = book.deals.filter((d) => d.acceptedAt && inP(d.acceptedAt));
  $: qm = quoteMovement(wonAll, book.currency);
  $: qpw = quotesPerWonDeal(wonAll);
  $: stages = (() => {
    const m = new Map<string, { n: number; value: number }>();
    for (const r of book.rows) {
      if (!r.isLead || r.status === 'paid' || r.status === 'dropped' || r.status === 'partially_paid') continue;
      if (!book.allTime && !(r.leadMonth && book.months.includes(r.leadMonth))) continue;
      const k = r.stageLabel ?? '(none)';
      const a = m.get(k) ?? { n: 0, value: 0 };
      a.n++;
      if (r.openQuote?.cur === book.currency) a.value += r.openQuote.total;
      m.set(k, a);
    }
    return [...m.entries()].map(([k, a]) => ({ k, ...a })).sort((a, b) => b.n - a.n);
  })();
  const sgn = (v: number | null) => (v === null ? '—' : `${v >= 0 ? '+' : ''}${Math.round(v * 1000) / 10}%`);
</script>

{#if err}<p class="mh-alert mh-alert--error" role="alert">{err}</p>{/if}

<div class="mh-grid-2">
  <div>
    <h4 class="mh-sub">Open quotes by age <span class="mh-muted">· {book.currency}, largest option per lead</span></h4>
    {#if !book.cubeOk}
      <p class="mh-empty">Segment data unavailable.</p>
    {:else}
      <table class="mh-table mh-table--compact">
        <thead><tr><th scope="col">Age</th><th scope="col" class="num">Quotes</th><th scope="col" class="num">Value</th><th scope="col" class="num">Chance to win</th><th scope="col" class="num">Expected</th></tr></thead>
        <tbody>
          {#each buckets as b}
            <tr><th scope="row">{b.label}</th><td class="num">{b.count}</td><td class="num">{money(b.value)}</td><td class="num">{pct(b.p, 0)}</td><td class="num">{money(b.value * b.p)}</td></tr>
          {/each}
        </tbody>
        <tfoot><tr><th scope="row">Total</th><td class="num">{buckets.reduce((a, b) => a + b.count, 0)}</td><td class="num">{money(buckets.reduce((a, b) => a + b.value, 0))}</td><td></td><td class="num">{money(buckets.reduce((a, b) => a + b.value * b.p, 0))}</td></tr></tfoot>
      </table>
      <p class="mh-hint">Chance = the historical share of quotes still open at that age that were later accepted (all non-test leads; 0 when fewer than 5 cases). Quotes older than 90 days are treated as lost.</p>
    {/if}
  </div>
  <div>
    <h4 class="mh-sub">Biggest open quotes <button class="mh-link" on:click={() => onView('open_quotes')}>all in the deal book →</button></h4>
    {#if openShown.length}
      <table class="mh-table mh-table--compact sb-cards">
        <thead><tr><th scope="col">Client</th><th scope="col" class="num">Quote</th><th scope="col" class="num">Age</th><th scope="col" class="num">Quiet</th></tr></thead>
        <tbody>
          {#each openShown as r (r.id)}
            <tr>
              <th scope="row" data-label="Client"><button class="sb-name" on:click={() => open1(r.isLead ? r.id : null)}>{r.name}</button>{#if isStalled(r)} <span class="sb-flag">stalled</span>{/if}</th>
              <td class="num" data-label="Quote">{money(r.openQuote?.total, r.openQuote?.cur)}</td>
              <td class="num" data-label="Age">{r.openQuote?.ageDays == null ? '—' : `${Math.round(r.openQuote.ageDays)} d`}</td>
              <td class="num" data-label="Quiet" class:mh-bad={(r.daysSinceActivity ?? 0) > 14}>{r.daysSinceActivity === null ? '—' : `${Math.round(r.daysSinceActivity)} d`}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    {:else}
      <p class="mh-empty">No open quotes.</p>
    {/if}
  </div>
</div>

<div class="mh-grid-2 sb-mt">
  <div>
    <h4 class="mh-sub">Won in {book.rangeLabel} <span class="mh-muted">· {won.length}</span></h4>
    {#if won.length}
      <ul class="sb-list">
        {#each won.slice(0, 8) as d (d.key)}
          <li><button class="sb-name" on:click={() => open1(d.consultationId)} disabled={!d.consultationId}>{d.name}</button><span>{money(d.booked, d.currency)}{#if d.service} · {d.service}{/if}</span></li>
        {/each}
      </ul>
    {:else}<p class="mh-empty">None.</p>{/if}
  </div>
  <div>
    <h4 class="mh-sub">Lost in {book.rangeLabel} <span class="mh-muted">· {lost.length}</span></h4>
    {#if lost.length}
      <ul class="sb-list">
        {#each lost.slice(0, 8) as d (d.key)}
          <li><button class="sb-name" on:click={() => open1(d.consultationId)} disabled={!d.consultationId}>{d.name}</button><span>{d.firstQuoteTotal ? money(d.firstQuoteTotal, d.currency) : 'no quote'} · {d.cancelledAfterAcceptance ? 'after acceptance' : d.stageLabel ?? '—'}</span></li>
        {/each}
      </ul>
    {:else}<p class="mh-empty">None.</p>{/if}
  </div>
</div>

<div class="mh-grid-2 sb-mt">
  <div class="mh-card">
    <h4 class="mh-card__h">Value lost · {book.rangeLabel}</h4>
    {#if loss.byReason.length}
      <table class="mh-table mh-table--compact">
        <thead><tr><th scope="col">Reason</th><th scope="col" class="num">Deals</th><th scope="col" class="num">Quoted value</th></tr></thead>
        <tbody>{#each loss.byReason as x}<tr><th scope="row">{x.label}</th><td class="num">{x.deals}</td><td class="num">{money(x.value)}</td></tr>{/each}</tbody>
      </table>
      <p class="mh-hint">Quoted value = the largest option of the first quote. By stage they sat in: {loss.byStage.slice(0, 4).map((x) => `${x.key} ${x.deals}`).join(' · ')}.</p>
    {:else}<p class="mh-empty">No deals lost after a quote.</p>{/if}
    <p class="mh-hint">
      Cancelled after acceptance: {loss.cancelledAfterAcceptance.deals} deal{loss.cancelledAfterAcceptance.deals === 1 ? '' : 's'} ({money(loss.cancelledAfterAcceptance.booked)} booked){#if loss.cancelledAfterAcceptance.rate !== null} · {fmtStat('rate', loss.cancelledAfterAcceptance.rate, wonAll.filter((d) => d.currency === book.currency).length, { num: loss.cancelledAfterAcceptance.deals }).text} of deals won{/if}.
      {#if loss.cancelledAfterAcceptance.deals}<button class="mh-link" on:click={() => onView('cancelled')}>See them →</button>{/if}
    </p>
  </div>
  <div class="mh-card">
    <h4 class="mh-card__h">How quotes move before a "yes" · {book.rangeLabel}</h4>
    <table class="mh-table mh-table--compact">
      <tbody>
        <tr><th scope="row">Median change, first quote → accepted</th><td class="num">{fmtStat('median', qm.median, qm.n, { fmt: sgn }).text}</td></tr>
        <tr><th scope="row">Accepted the first quote as sent</th><td class="num">{fmtStat('median', qm.sameQuote.median, qm.sameQuote.n, { fmt: sgn }).text} <span class="mh-muted">({qm.sameQuote.n})</span></td></tr>
        <tr><th scope="row">Accepted a revised quote</th><td class="num">{fmtStat('median', qm.revised.median, qm.revised.n, { fmt: sgn }).text} <span class="mh-muted">({qm.revised.n})</span></td></tr>
        <tr><th scope="row">Went lower · same · higher</th><td class="num">{qm.down} · {qm.same} · {qm.up}</td></tr>
        <tr><th scope="row">Quotes per won deal (median)</th><td class="num">{fmtStat('median', qpw.value, qpw.n).text}</td></tr>
      </tbody>
    </table>
    <p class="mh-hint">Revised quotes can change scope, not only price.{qm.currencySwitches ? ` ${qm.currencySwitches} deal${qm.currencySwitches === 1 ? '' : 's'} changed currency and are left out.` : ''}</p>
  </div>
</div>

{#if stages.length}
  <div class="sb-mt">
    <h4 class="mh-sub">Where open leads sit now <span class="mh-muted">· leads of {book.rangeLabel} not yet paid or dropped</span></h4>
    <div class="mh-table-wrap">
      <table class="mh-table mh-table--compact">
        <thead><tr><th scope="col">Stage</th><th scope="col" class="num">Leads</th><th scope="col" class="num">Open quote value</th></tr></thead>
        <tbody>{#each stages.slice(0, 12) as x}<tr><th scope="row">{x.k}</th><td class="num">{x.n}</td><td class="num">{x.value ? money(x.value) : '—'}</td></tr>{/each}</tbody>
      </table>
    </div>
  </div>
{/if}
