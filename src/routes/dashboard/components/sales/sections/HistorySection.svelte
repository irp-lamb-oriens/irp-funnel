<script lang="ts">
  /**
   * History — the whole book over time with the period highlighted
   * (sales-book-v3 §6.6): booked and cash per month / quarter / year, rolling
   * mean, YoY, cumulative totals, best and worst months, currency mix,
   * repeat clients and concentration.
   */
  import TrendChart from '../../metrics/charts/TrendChart.svelte';
  import { compact } from '../../metrics/charts/palette.ts';
  import { money as fmtMoney, pct, fmtStat } from '../../metrics/engine/format.ts';
  import { monthLabel } from '../../metrics/engine/period.ts';
  import { crDateKey } from '../../metrics/engine/period.ts';
  import { concentration, currencyMix, moneyHistory, repeatClients } from '../../metrics/engine/sales.ts';
  import type { Book } from '../types.ts';

  export let book: Book;

  let grain: 'month' | 'quarter' | 'year' = 'month';
  const GRAINS: Array<['month' | 'quarter' | 'year', string]> = [['month', 'Month'], ['quarter', 'Quarter'], ['year', 'Year']];
  let asTable = false;
  let showCum = false;
  const money = (n: number | null | undefined) => fmtMoney(n, book.currency);
  const label = (k: string) => (grain === 'month' ? monthLabel(k) : k);

  $: hist = book.cubeOk ? moneyHistory(book.rows, book.currency, book.firstMonth, book.nowMonth, grain) : [];
  $: keyOfMonth = (m: string) => (grain === 'month' ? m : grain === 'year' ? m.slice(0, 4) : `${m.slice(0, 4)}-Q${Math.floor((Number(m.slice(5, 7)) - 1) / 3) + 1}`);
  $: range = ((): [number, number] | null => {
    if (book.allTime || !book.months.length) return null;
    const a = hist.findIndex((h) => h.key === keyOfMonth(book.months[0]));
    const b = hist.findIndex((h) => h.key === keyOfMonth(book.months[book.months.length - 1]));
    return a >= 0 && b >= 0 ? [a, b] : null;
  })();
  $: series = showCum
    ? [
        { key: 'cumBooked', label: 'Booked, cumulative', values: hist.map((h) => h.cumBooked), kind: 'line' as const, color: '#6250d6' },
        { key: 'cumCash', label: 'Collected, cumulative', values: hist.map((h) => h.cumCash), kind: 'line' as const, color: '#00a3aa' },
      ]
    : [
        { key: 'booked', label: 'Booked', values: hist.map((h) => h.booked), color: '#6250d6' },
        { key: 'cash', label: 'Collected', values: hist.map((h) => h.cash), color: '#00a3aa' },
        ...(grain === 'month' ? [{ key: 'roll', label: 'Booked, 3-month average', values: hist.map((h) => h.rolling3Booked), kind: 'line' as const, color: '#eb6834' }] : []),
      ];
  $: complete = hist.filter((h) => !h.inProgress && h.booked > 0);
  $: best = [...complete].sort((a, b) => b.booked - a.booked).slice(0, 3);
  $: worst = [...complete].sort((a, b) => a.booked - b.booked).slice(0, 3);

  const inP = (iso: string | null | undefined) => book.allTime || (!!iso && book.months.includes(crDateKey(iso)!.slice(0, 7)));
  $: won = book.deals.filter((d) => d.acceptedAt && inP(d.acceptedAt));
  $: mix = currencyMix(book.deals, (d) => !!d.acceptedAt && inP(d.acceptedAt));
  $: conc = concentration(won, book.deals, book.currency);
  $: rep = repeatClients(book.deals.filter((d) => d.acceptedAt), book.currency);
  const sgn = (v: number | null) => (v === null ? '—' : `${v >= 0 ? '+' : ''}${Math.round(v * 100)}%`);
</script>

{#if !book.cubeOk}
  <p class="mh-empty">Segment data unavailable — history needs it.</p>
{:else}
  <div class="mh-tools sb-hist-tools">
    <div class="mh-seg" role="group" aria-label="Group by">
      {#each GRAINS as [g, l]}
        <button aria-pressed={grain === g} on:click={() => (grain = g)}>{l}</button>
      {/each}
    </div>
    <div class="mh-seg" role="group" aria-label="Values">
      <button aria-pressed={!showCum} on:click={() => (showCum = false)}>Per {grain}</button>
      <button aria-pressed={showCum} on:click={() => (showCum = true)}>Cumulative</button>
    </div>
    <div class="mh-seg" role="group" aria-label="Show as">
      <button aria-pressed={!asTable} on:click={() => (asTable = false)}>Chart</button>
      <button aria-pressed={asTable} on:click={() => (asTable = true)}>Table</button>
    </div>
  </div>

  {#if !asTable}
    <TrendChart labels={hist.map((h) => label(h.key))} {series} format={(n) => compact(n)} height={240} highlightRange={range}
      caption="Booked and collected per {grain}, {book.currency}" />
    <p class="mh-hint">{range ? `Shaded: ${book.rangeLabel}. ` : ''}Booked is dated by acceptance, collected by payment date. The last {grain} is in progress.</p>
  {:else}
    <div class="mh-table-wrap sb-hist-table">
      <table class="mh-table mh-table--compact">
        <thead><tr><th scope="col">{grain === 'month' ? 'Month' : grain === 'quarter' ? 'Quarter' : 'Year'}</th><th scope="col" class="num">Leads</th><th scope="col" class="num">Won</th><th scope="col" class="num">Booked</th><th scope="col" class="num">Collected</th><th scope="col" class="num">Margin %</th><th scope="col" class="num">Avg deal</th>{#if grain === 'month'}<th scope="col" class="num">3-mo avg</th>{/if}<th scope="col" class="num">Last year</th><th scope="col" class="num">YoY</th></tr></thead>
        <tbody>
          {#each [...hist].reverse() as h (h.key)}
            <tr class:sb-hl={range && hist.indexOf(h) >= range[0] && hist.indexOf(h) <= range[1]}>
              <th scope="row">{label(h.key)}{#if h.inProgress} <span class="mh-muted">in progress</span>{/if}</th>
              <td class="num">{h.leads}</td><td class="num">{h.won}</td><td class="num">{money(h.booked)}</td><td class="num">{money(h.cash)}</td>
              <td class="num">{pct(h.marginPct)}</td><td class="num">{fmtStat('average', h.avgDeal, h.won, { fmt: (v) => money(v) }).text}</td>
              {#if grain === 'month'}<td class="num">{money(h.rolling3Booked)}</td>{/if}
              <td class="num">{money(h.lastYearBooked)}</td><td class="num" class:mh-good={(h.yoyPct ?? 0) > 0} class:mh-bad={(h.yoyPct ?? 0) < 0}>{sgn(h.yoyPct)}</td>
            </tr>
          {/each}
        </tbody>
        <tfoot><tr><th scope="row">Total</th><td class="num">{hist.reduce((a, h) => a + h.leads, 0)}</td><td class="num">{hist.reduce((a, h) => a + h.won, 0)}</td><td class="num">{money(hist[hist.length - 1]?.cumBooked)}</td><td class="num">{money(hist[hist.length - 1]?.cumCash)}</td><td colspan={grain === 'month' ? 5 : 4}></td></tr></tfoot>
      </table>
    </div>
  {/if}

  <div class="mh-grid-2 sb-mt">
    <div class="mh-card">
      <h4 class="mh-card__h">Best and worst complete {grain}s by booked</h4>
      {#if complete.length >= 2}
        <div class="sb-bestworst">
          <ol>{#each best as h}<li><strong>{label(h.key)}</strong> {money(h.booked)} <span class="mh-muted">· {h.won} won</span></li>{/each}</ol>
          <ol>{#each worst as h}<li><strong>{label(h.key)}</strong> {money(h.booked)} <span class="mh-muted">· {h.won} won</span></li>{/each}</ol>
        </div>
      {:else}<p class="mh-empty">Not enough history yet.</p>{/if}
    </div>
    <div class="mh-card">
      <h4 class="mh-card__h">Dependence · deals won in {book.rangeLabel}</h4>
      <table class="mh-table mh-table--compact">
        <tbody>
          <tr><th scope="row">Top 3 deals' share of booked</th><td class="num">{conc.top3DealShare === null ? `needs ≥ 10 deals (${conc.wonDeals})` : pct(conc.top3DealShare)}</td></tr>
          <tr><th scope="row">Largest client's share of booked</th><td class="num">{conc.topClientBookedShare === null ? '—' : `${pct(conc.topClientBookedShare)} · ${conc.topClient}`}</td></tr>
          <tr><th scope="row">Largest debtor's share of outstanding</th><td class="num">{conc.topClientOutstandingShare === null ? '—' : `${pct(conc.topClientOutstandingShare)} · ${conc.topDebtor}`}</td></tr>
          <tr><th scope="row">Repeat clients (all time)</th><td class="num">{rep.repeat} of {rep.clients}{rep.repeatBookedShare !== null && rep.repeat ? ` · ${pct(rep.repeatBookedShare)} of booked` : ''}</td></tr>
          {#if rep.repeat}<tr><th scope="row">Months between a client's deals (median)</th><td class="num">{fmtStat('median', rep.medianMonthsBetween, rep.repeat, { fmt: (v) => v.toFixed(1) }).text}</td></tr>{/if}
          <tr><th scope="row">Currency mix of booked</th><td class="num">{mix.length ? mix.map((x) => `${x.currency} ${x.deals}`).join(' · ') : '—'}</td></tr>
        </tbody>
      </table>
      <p class="mh-hint">A client is matched by email (else name), so a returning client with a new email counts as new.</p>
    </div>
  </div>
{/if}

<style>
  .sb-hist-tools { margin-bottom: 0.6rem; }
  .sb-hist-table { max-height: 460px; overflow: auto; }
</style>
