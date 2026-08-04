<script lang="ts">
  /**
   * FinanceLedgerPanel — what actually happened to the money.
   *
   * Two tables:
   *
   *   Settlements  every accepted quote, how much of it the client has paid,
   *                how much is still owed to providers, and the cash that
   *                leaves behind. Expanding a row opens the editor for client
   *                payments, provider bills and after-the-fact charges.
   *   Ledger       spending and earning outside any single quote, split into
   *                expense, income and investment. Investments carry a return
   *                figure so ad spend and a BNI membership can be judged on
   *                whether they paid for themselves.
   *
   * No arithmetic happens here. Every total comes from
   * GET /api/dashboard/finance/ledger, and each save reloads it, so this view
   * can never drift from the server's numbers.
   */
  import { onMount } from 'svelte';
  import {
    financeLedger,
    fetchFinanceLedger,
    saveQuoteSettlement,
    createLedgerEntry,
    updateLedgerEntry,
    deleteLedgerEntry,
    type ClientPayment,
    type ExtraCharge,
    type LedgerEntry,
    type LedgerKind,
    type ProviderPayment,
    type QuoteSettlement,
    type Recurrence,
  } from '../store.ts';

  export let currency = 'USD';

  type Tab = 'settlements' | 'ledger';
  let tab: Tab = 'settlements';

  let loading = false;
  let errorMsg = '';
  let savingQuoteId = '';

  /** Which settlement row is expanded into its editor. */
  let openQuoteId = '';
  /** Editable payment rows for the open quote, keyed by quote id. */
  let drafts: Record<string, {
    clientPayments: ClientPayment[];
    providerPayments: ProviderPayment[];
    extraCharges: ExtraCharge[];
  }> = {};

  const KINDS: Array<{ value: LedgerKind; label: string; hint: string }> = [
    { value: 'expense', label: 'Expense', hint: 'Money out that buys no return' },
    { value: 'income', label: 'Income', hint: 'Money in from outside a quote' },
    { value: 'investment', label: 'Investment', hint: 'Money out expected to earn back more' },
  ];

  const RECURRENCES: Recurrence[] = ['none', 'weekly', 'monthly', 'quarterly', 'yearly'];

  /** The new-entry form. Reset after every successful save. */
  const blankEntry = () => ({
    kind: 'expense' as LedgerKind,
    category: '',
    label: '',
    amount: '' as string | number,
    date: new Date().toISOString().slice(0, 10),
    recurrence: 'none' as Recurrence,
    returnAmount: '' as string | number,
    note: '',
  });
  let form = blankEntry();
  let formOpen = false;
  let savingEntry = false;

  async function load(): Promise<void> {
    loading = true;
    errorMsg = '';
    try {
      await fetchFinanceLedger(currency);
    } catch (err: any) {
      errorMsg = err?.message ?? 'Could not load the ledger.';
    } finally {
      loading = false;
    }
  }

  /**
   * The report is a heavy read, and this component is destroyed and recreated
   * every time the operator switches sections. Reusing what the store already
   * holds means toggling back is instant; Refresh is there for a fresh read.
   */
  onMount(() => {
    if (!$financeLedger) load();
  });

  function money(n: number | null | undefined): string {
    if (typeof n !== 'number' || !Number.isFinite(n)) return '—';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
      maximumFractionDigits: 0,
    }).format(n);
  }

  function pct(n: number | null | undefined): string {
    return typeof n === 'number' ? `${n.toFixed(1)}%` : '—';
  }

  function shortDate(iso: string | null | undefined): string {
    if (!iso) return '—';
    const d = new Date(iso);
    return Number.isNaN(d.getTime())
      ? '—'
      : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function newId(prefix: string): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  }

  /** Open a settlement row, seeding the editor from what the server returned. */
  function toggleRow(s: QuoteSettlement): void {
    if (openQuoteId === s.quoteId) {
      openQuoteId = '';
      return;
    }
    openQuoteId = s.quoteId;
    if (!drafts[s.quoteId]) {
      const saved = ($financeLedger as any)?.rawSettlements?.[s.quoteId];
      drafts[s.quoteId] = {
        clientPayments: saved?.clientPayments ?? [],
        providerPayments: saved?.providerPayments ?? [],
        extraCharges: saved?.extraCharges ?? [],
      };
      drafts = drafts;
    }
  }

  function addClientPayment(quoteId: string): void {
    drafts[quoteId].clientPayments = [
      ...drafts[quoteId].clientPayments,
      { id: newId('cp'), date: new Date().toISOString().slice(0, 10), amount: null, percent: null, received: true },
    ];
    drafts = drafts;
  }

  function addProviderPayment(quoteId: string): void {
    drafts[quoteId].providerPayments = [
      ...drafts[quoteId].providerPayments,
      { id: newId('pp'), date: new Date().toISOString().slice(0, 10), amount: null, paid: false },
    ];
    drafts = drafts;
  }

  function addExtraCharge(quoteId: string): void {
    drafts[quoteId].extraCharges = [
      ...drafts[quoteId].extraCharges,
      { id: newId('ex'), date: new Date().toISOString().slice(0, 10), amount: null, cost: 0 },
    ];
    drafts = drafts;
  }

  function removeRow(quoteId: string, list: 'clientPayments' | 'providerPayments' | 'extraCharges', id: string): void {
    drafts[quoteId][list] = (drafts[quoteId][list] as Array<{ id: string }>).filter((r) => r.id !== id) as any;
    drafts = drafts;
  }

  async function saveRow(s: QuoteSettlement): Promise<void> {
    savingQuoteId = s.quoteId;
    errorMsg = '';
    try {
      await saveQuoteSettlement(s.quoteId, {
        consultationId: s.consultationId,
        ...drafts[s.quoteId],
      });
      await load();
    } catch (err: any) {
      errorMsg = err?.message ?? 'Could not save the payments.';
    } finally {
      savingQuoteId = '';
    }
  }

  async function submitEntry(): Promise<void> {
    savingEntry = true;
    errorMsg = '';
    try {
      await createLedgerEntry({
        kind: form.kind,
        category: form.category || null,
        label: form.label || null,
        amount: Number(form.amount) || 0,
        currency,
        date: form.date ? new Date(form.date).toISOString() : null,
        recurrence: form.recurrence,
        returnAmount: form.kind === 'investment' ? Number(form.returnAmount) || 0 : 0,
        note: form.note || null,
      });
      form = blankEntry();
      formOpen = false;
      await load();
    } catch (err: any) {
      errorMsg = err?.message ?? 'Could not save the entry.';
    } finally {
      savingEntry = false;
    }
  }

  /** Record what an investment has earned back so far. */
  async function setReturn(entry: LedgerEntry, value: string): Promise<void> {
    errorMsg = '';
    try {
      await updateLedgerEntry(entry.id, { ...entry, returnAmount: Number(value) || 0 });
      await load();
    } catch (err: any) {
      errorMsg = err?.message ?? 'Could not update the entry.';
    }
  }

  async function removeEntry(id: string): Promise<void> {
    errorMsg = '';
    try {
      await deleteLedgerEntry(id);
      await load();
    } catch (err: any) {
      errorMsg = err?.message ?? 'Could not delete the entry.';
    }
  }

  /** Seed categories for the selected kind, so the field is never a blank guess. */
  $: seedCategories = $financeLedger?.categories?.[form.kind] ?? [];
</script>

<div class="fl">
  <nav class="fl__tabs">
    <button class:active={tab === 'settlements'} on:click={() => (tab = 'settlements')}>
      Settlements
      {#if $financeLedger}<span class="fl__count">{$financeLedger.settlementTotals.n}</span>{/if}
    </button>
    <button class:active={tab === 'ledger'} on:click={() => (tab = 'ledger')}>
      Ledger
      {#if $financeLedger}<span class="fl__count">{$financeLedger.entries.length}</span>{/if}
    </button>
    <button class="fl__reload" on:click={load} disabled={loading}>
      {loading ? 'Loading…' : 'Refresh'}
    </button>
  </nav>

  {#if errorMsg}
    <p class="fl__error">{errorMsg}</p>
  {/if}

  {#if !$financeLedger}
    <p class="fl__empty">{loading ? 'Reading the accepted quotes…' : 'No data yet.'}</p>
  {:else if tab === 'settlements'}
    {@const t = $financeLedger.settlementTotals}
    <section class="fl__cards">
      <article class="c c--in">
        <h4>Collected</h4>
        <p class="c__big">{money(t.collected)}</p>
        <span>of {money(t.billedTotal)} billed</span>
      </article>
      <article class="c c--owed">
        <h4>Clients still owe</h4>
        <p class="c__big">{money(t.clientOutstanding)}</p>
        <span>{t.n - t.fullySettled} of {t.n} quotes open</span>
      </article>
      <article class="c c--out">
        <h4>We still owe providers</h4>
        <p class="c__big">{money(t.providerOutstanding)}</p>
        <span>{money(t.providerPaid)} already paid</span>
      </article>
      <article class="c c--cash">
        <h4>Net cash</h4>
        <p class="c__big">{money(t.netCash)}</p>
        <span>expected margin {money(t.expectedMargin)}</span>
      </article>
    </section>

    <div class="fl__panel">
      {#if $financeLedger.settlements.length === 0}
        <p class="fl__empty">No accepted quotes yet.</p>
      {:else}
        <table class="fl__table">
          <thead>
            <tr>
              <th>Client</th>
              <th>Accepted</th>
              <th>Billed</th>
              <th>Paid</th>
              <th>%</th>
              <th>Client owes</th>
              <th>We owe</th>
              <th>Net cash</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {#each $financeLedger.settlements as s (s.quoteId)}
              <tr class:settled={s.fullySettled}>
                <td class="fl__name">{s.clientName ?? s.quoteId}</td>
                <td>{shortDate(s.acceptedAt)}</td>
                <td>{money(s.billedTotal)}</td>
                <td>{money(s.collected)}</td>
                <td>
                  <span class="bar" title="{pct(s.collectedPct)} collected">
                    <span class="bar__fill" style="width: {Math.min(100, s.collectedPct ?? 0)}%"></span>
                  </span>
                  {pct(s.collectedPct)}
                </td>
                <td class:owing={s.clientOutstanding > 0}>{money(s.clientOutstanding)}</td>
                <td class:owing={s.providerOutstanding > 0}>{money(s.providerOutstanding)}</td>
                <td class:negative={s.netCash < 0}>{money(s.netCash)}</td>
                <td>
                  <button class="fl__link" on:click={() => toggleRow(s)}>
                    {openQuoteId === s.quoteId ? 'Close' : 'Payments'}
                  </button>
                </td>
              </tr>

              {#if openQuoteId === s.quoteId && drafts[s.quoteId]}
                <tr class="fl__editor-row">
                  <td colspan="9">
                    <div class="ed">
                      <div class="ed__col">
                        <h5>Client payments</h5>
                        <p class="ed__hint">
                          Enter an amount or a percentage of the {money(s.contractValue)} contract.
                          Untick "received" for an instalment that has not arrived: only received
                          money counts as collected.
                        </p>
                        {#each drafts[s.quoteId].clientPayments as p (p.id)}
                          <div class="ed__row">
                            <input type="date" bind:value={p.date} />
                            <input type="number" placeholder="Amount" bind:value={p.amount} />
                            <input type="number" placeholder="%" bind:value={p.percent} />
                            <input type="text" placeholder="Method" bind:value={p.method} />
                            <label><input type="checkbox" bind:checked={p.received} /> received</label>
                            <button class="ed__x" on:click={() => removeRow(s.quoteId, 'clientPayments', p.id)}>✕</button>
                          </div>
                        {/each}
                        <button class="ed__add" on:click={() => addClientPayment(s.quoteId)}>+ Payment</button>
                      </div>

                      <div class="ed__col">
                        <h5>Provider bills</h5>
                        <p class="ed__hint">
                          Quoted provider cost is {money(s.providerCost)}. A bill only counts as
                          money out once it is ticked as paid.
                        </p>
                        {#each drafts[s.quoteId].providerPayments as p (p.id)}
                          <div class="ed__row">
                            <input type="date" bind:value={p.date} />
                            <input type="text" placeholder="Provider" bind:value={p.providerName} />
                            <input type="number" placeholder="Amount" bind:value={p.amount} />
                            <label><input type="checkbox" bind:checked={p.paid} /> paid</label>
                            <button class="ed__x" on:click={() => removeRow(s.quoteId, 'providerPayments', p.id)}>✕</button>
                          </div>
                        {/each}
                        <button class="ed__add" on:click={() => addProviderPayment(s.quoteId)}>+ Bill</button>
                      </div>

                      <div class="ed__col">
                        <h5>Charged afterwards</h5>
                        <p class="ed__hint">
                          Anything billed after acceptance. Cost defaults to 0, which makes the
                          charge pure margin. Set a cost when the charge is not free to us.
                        </p>
                        {#each drafts[s.quoteId].extraCharges as e (e.id)}
                          <div class="ed__row">
                            <input type="date" bind:value={e.date} />
                            <input type="text" placeholder="Description" bind:value={e.description} />
                            <input type="number" placeholder="Charged" bind:value={e.amount} />
                            <input type="number" placeholder="Our cost" bind:value={e.cost} />
                            <button class="ed__x" on:click={() => removeRow(s.quoteId, 'extraCharges', e.id)}>✕</button>
                          </div>
                        {/each}
                        <button class="ed__add" on:click={() => addExtraCharge(s.quoteId)}>+ Charge</button>
                      </div>

                      <div class="ed__actions">
                        <button
                          class="ed__save"
                          on:click={() => saveRow(s)}
                          disabled={savingQuoteId === s.quoteId}
                        >
                          {savingQuoteId === s.quoteId ? 'Saving…' : 'Save payments'}
                        </button>
                      </div>
                    </div>
                  </td>
                </tr>
              {/if}
            {/each}
          </tbody>
        </table>
      {/if}
    </div>
  {:else}
    {@const r = $financeLedger}
    <section class="fl__cards">
      <article class="c c--cash">
        <h4>Left to reinvest</h4>
        <p class="c__big">{money(r.reinvestable.remaining)}</p>
        <span>{money(r.reinvestable.realisedMargin)} banked, {money(r.reinvestable.spent)} spent</span>
      </article>
      <article class="c c--out">
        <h4>Expenses</h4>
        <p class="c__big">{money(r.totals.expense)}</p>
        <span>{money(r.totals.recurringMonthly)} committed per month</span>
      </article>
      <article class="c c--inv">
        <h4>Invested</h4>
        <p class="c__big">{money(r.totals.investment)}</p>
        <span>{money(r.totals.investmentReturn)} earned back</span>
      </article>
      <article class="c c--in">
        <h4>Other income</h4>
        <p class="c__big">{money(r.totals.income)}</p>
        <span>outside any quote</span>
      </article>
    </section>

    <div class="fl__panel">
      <div class="fl__panel-head">
        <h4>Entries</h4>
        <button class="ed__save" on:click={() => (formOpen = !formOpen)}>
          {formOpen ? 'Cancel' : '+ Add entry'}
        </button>
      </div>

      {#if formOpen}
        <div class="form">
          <label>
            Type
            <select bind:value={form.kind}>
              {#each KINDS as k}<option value={k.value}>{k.label}</option>{/each}
            </select>
          </label>
          <label>
            Category
            <input list="fl-categories" bind:value={form.category} placeholder="ads, payroll…" />
            <datalist id="fl-categories">
              {#each seedCategories as c}<option value={c}></option>{/each}
            </datalist>
          </label>
          <label>Description<input type="text" bind:value={form.label} /></label>
          <label>Amount<input type="number" bind:value={form.amount} /></label>
          <label>Date<input type="date" bind:value={form.date} /></label>
          <label>
            Repeats
            <select bind:value={form.recurrence}>
              {#each RECURRENCES as rec}<option value={rec}>{rec}</option>{/each}
            </select>
          </label>
          {#if form.kind === 'investment'}
            <label>Earned back<input type="number" bind:value={form.returnAmount} /></label>
          {/if}
          <label class="form__wide">Note<input type="text" bind:value={form.note} /></label>
          <button class="ed__save" on:click={submitEntry} disabled={savingEntry}>
            {savingEntry ? 'Saving…' : 'Save entry'}
          </button>
          <p class="ed__hint form__wide">
            {KINDS.find((k) => k.value === form.kind)?.hint}. Categories are suggestions, so type
            anything that fits how you think about the money.
          </p>
        </div>
      {/if}

      {#if r.entries.length === 0}
        <p class="fl__empty">Nothing recorded yet.</p>
      {:else}
        <table class="fl__table">
          <thead>
            <tr>
              <th>Date</th><th>Type</th><th>Category</th><th>Description</th>
              <th>Amount</th><th>Repeats</th><th>Earned back</th><th></th>
            </tr>
          </thead>
          <tbody>
            {#each r.entries as e (e.id)}
              <tr>
                <td>{shortDate(e.date)}</td>
                <td><span class="pill pill--{e.kind}">{e.kind}</span></td>
                <td>{e.category ?? '—'}</td>
                <td>{e.label ?? '—'}</td>
                <td>{money(e.amount)}</td>
                <td>{e.recurrence && e.recurrence !== 'none' ? e.recurrence : '—'}</td>
                <td>
                  {#if e.kind === 'investment'}
                    <input
                      class="ed__inline"
                      type="number"
                      value={e.returnAmount ?? 0}
                      on:change={(ev) => setReturn(e, ev.currentTarget.value)}
                    />
                  {:else}—{/if}
                </td>
                <td><button class="ed__x" on:click={() => removeEntry(e.id)}>✕</button></td>
              </tr>
            {/each}
          </tbody>
        </table>
      {/if}
    </div>

    {#if r.byCategory.length > 0}
      <div class="fl__panel">
        <h4>By category</h4>
        <table class="fl__table">
          <thead>
            <tr><th>Type</th><th>Category</th><th>Entries</th><th>Amount</th><th>Earned back</th><th>Net</th><th>ROI</th></tr>
          </thead>
          <tbody>
            {#each r.byCategory as c (c.kind + c.category)}
              <tr>
                <td><span class="pill pill--{c.kind}">{c.kind}</span></td>
                <td>{c.category}</td>
                <td>{c.n}</td>
                <td>{money(c.amount)}</td>
                <td>{c.kind === 'investment' ? money(c.returned) : '—'}</td>
                <td class:negative={(c.netReturn ?? 0) < 0}>
                  {c.netReturn === null ? '—' : money(c.netReturn)}
                </td>
                <td class:negative={(c.roiPct ?? 0) < 0}>{c.roiPct === null ? '—' : pct(c.roiPct)}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}

    {#if r.skippedCurrency > 0}
      <p class="fl__empty">
        {r.skippedCurrency} entries are in another currency and are not counted in {r.baseCurrency}.
      </p>
    {/if}
  {/if}
</div>

<style>
  /* Same palette as FinanceView and AdminView: #fafbfc canvas, white cards on
     #e2e8f0 borders, teal accent, Jost through --font-paragraph. */
  .fl {
    font-family: var(--font-paragraph, 'Jost'), system-ui, sans-serif;
    color: var(--irp-text, #181818);
  }

  .fl__tabs {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-bottom: 1.25rem;
    background: #fff;
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    padding: 4px;
    width: fit-content;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
  }

  .fl__tabs button {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.46rem 1.1rem;
    background: none;
    border: none;
    border-radius: 7px;
    color: #64748b;
    font-family: inherit;
    font-size: 0.84rem;
    font-weight: 600;
    cursor: pointer;
    transition: color 0.14s cubic-bezier(0.4, 0, 0.2, 1), background 0.14s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .fl__tabs button:hover { background: #f1f5f9; color: #475569; }

  .fl__tabs button.active {
    background: linear-gradient(135deg, rgba(2, 181, 187, 0.12) 0%, rgba(139, 92, 246, 0.08) 100%);
    color: #02999e;
    border: 1px solid rgba(2, 181, 187, 0.2);
  }

  .fl__count {
    background: linear-gradient(135deg, #02b5bb, #02999e);
    color: #fff;
    border-radius: 999px;
    font-size: 0.68rem;
    font-weight: 800;
    padding: 0.1em 0.55em;
  }

  .fl__reload { margin-left: 0.5rem; color: #94a3b8; }

  .fl__error {
    padding: 0.6rem 1rem;
    border-radius: 8px;
    background: #fef2f2;
    border: 1px solid #fecaca;
    color: #dc2626;
    font-size: 0.82rem;
    font-weight: 600;
  }

  .fl__empty {
    color: #94a3b8;
    font-size: 0.85rem;
    font-style: italic;
    padding: 0.5rem 0;
  }

  .fl__cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 1rem;
    margin-bottom: 1rem;
  }

  .c {
    padding: 1.15rem 1.25rem;
    border-radius: 16px;
    background: #fff;
    border: 1px solid #e2e8f0;
    border-top: 3px solid #e2e8f0;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06), 0 8px 32px rgba(0, 0, 0, 0.04);
  }

  .c--in { border-top-color: #10b981; }
  .c--owed { border-top-color: #f59e0b; }
  .c--out { border-top-color: #ef4444; }
  .c--cash { border-top-color: #02b5bb; }
  .c--inv { border-top-color: #8b5cf6; }

  .c h4 {
    margin: 0 0 0.5rem;
    font-size: 0.7rem;
    font-weight: 800;
    color: #94a3b8;
    text-transform: uppercase;
    letter-spacing: 0.1em;
  }

  .c__big {
    margin: 0 0 0.3rem;
    font-size: 1.6rem;
    font-weight: 800;
    color: #0f172a;
    letter-spacing: -0.03em;
    font-variant-numeric: tabular-nums;
  }

  .c span { font-size: 0.72rem; color: #94a3b8; }

  .fl__panel {
    padding: 1.5rem;
    border-radius: 16px;
    background: #fff;
    border: 1px solid #e2e8f0;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06), 0 8px 32px rgba(0, 0, 0, 0.04);
    margin-bottom: 1rem;
    overflow-x: auto;
  }

  .fl__panel-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
  }

  .fl__panel h4 {
    margin: 0 0 1rem;
    font-size: 0.7rem;
    font-weight: 800;
    color: #94a3b8;
    text-transform: uppercase;
    letter-spacing: 0.1em;
  }

  .fl__panel-head h4 { margin: 0; }

  .fl__table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.82rem;
  }

  .fl__table thead tr { background: #f8fafc; }

  .fl__table th {
    text-align: left;
    padding: 0.6rem 0.8rem;
    color: #94a3b8;
    font-size: 0.68rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.09em;
    white-space: nowrap;
    border-bottom: 1px solid #e2e8f0;
  }

  .fl__table td {
    padding: 0.6rem 0.8rem;
    color: #334155;
    border-bottom: 1px solid #f1f5f9;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  .fl__table tbody tr:hover { background: #fafbff; }
  .fl__table tr.settled { color: #94a3b8; }
  .fl__name { font-weight: 600; color: #0f172a; }
  .owing { color: #d97706; font-weight: 600; }
  .negative { color: #dc2626; font-weight: 600; }

  .bar {
    display: inline-block;
    width: 46px;
    height: 5px;
    border-radius: 999px;
    background: #f1f5f9;
    overflow: hidden;
    vertical-align: middle;
    margin-right: 0.35rem;
  }

  .bar__fill {
    display: block;
    height: 100%;
    border-radius: 999px;
    background: linear-gradient(90deg, #02b5bb, #10b981);
  }

  .pill {
    display: inline-block;
    padding: 0.16em 0.6em;
    border-radius: 999px;
    font-size: 0.68rem;
    font-weight: 700;
    border: 1px solid transparent;
  }

  .pill--expense { background: #fef2f2; color: #dc2626; border-color: #fecaca; }
  .pill--income { background: #f0fdf4; color: #16a34a; border-color: #bbf7d0; }
  .pill--investment { background: #ede9fe; color: #7c3aed; border-color: #c4b5fd; }

  .fl__link {
    background: none;
    border: none;
    color: #02999e;
    font-family: inherit;
    font-size: 0.8rem;
    font-weight: 700;
    cursor: pointer;
    padding: 0;
  }

  .fl__link:hover { text-decoration: underline; }

  .fl__editor-row td { background: #f8fafc; white-space: normal; }

  .ed {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 1.25rem;
    padding: 0.5rem 0;
  }

  .ed h5 {
    margin: 0 0 0.3rem;
    font-size: 0.75rem;
    font-weight: 800;
    color: #0f172a;
  }

  .ed__hint {
    margin: 0 0 0.6rem;
    font-size: 0.72rem;
    color: #94a3b8;
    font-style: italic;
    line-height: 1.5;
  }

  .ed__row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.35rem;
    margin-bottom: 0.35rem;
  }

  .ed__row input[type='text'],
  .ed__row input[type='number'],
  .ed__row input[type='date'],
  .form input,
  .form select,
  .ed__inline {
    padding: 0.4rem 0.55rem;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    background: #fff;
    color: #0f172a;
    font-family: inherit;
    font-size: 0.8rem;
    min-width: 0;
    transition: border-color 0.14s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.14s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .ed__row input[type='number'], .ed__inline { width: 96px; }
  .ed__row input[type='text'] { flex: 1; min-width: 120px; }

  .ed__row input:focus,
  .form input:focus,
  .form select:focus,
  .ed__inline:focus {
    outline: none;
    border-color: rgba(2, 181, 187, 0.48);
    box-shadow: 0 0 0 3px rgba(2, 181, 187, 0.1);
  }

  .ed__row label {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    font-size: 0.75rem;
    color: #475569;
    white-space: nowrap;
  }

  .ed__row input[type='checkbox'] { accent-color: #02b5bb; }

  .ed__add {
    margin-top: 0.2rem;
    padding: 0.32rem 0.8rem;
    background: #f1f5f9;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    color: #475569;
    font-family: inherit;
    font-size: 0.76rem;
    font-weight: 700;
    cursor: pointer;
  }

  .ed__add:hover { background: #e2e8f0; color: #1e293b; }

  .ed__x {
    width: 24px;
    height: 24px;
    border-radius: 6px;
    border: 1px solid rgba(239, 68, 68, 0.2);
    background: rgba(239, 68, 68, 0.05);
    color: #ef4444;
    font-size: 0.7rem;
    cursor: pointer;
    flex-shrink: 0;
  }

  .ed__x:hover { background: rgba(239, 68, 68, 0.12); }

  .ed__actions { grid-column: 1 / -1; }

  .ed__save {
    padding: 0.5rem 1.2rem;
    background: linear-gradient(135deg, #02b5bb 0%, #02999e 100%);
    border: none;
    border-radius: 10px;
    color: #fff;
    font-family: inherit;
    font-size: 0.82rem;
    font-weight: 700;
    cursor: pointer;
    box-shadow: 0 2px 8px rgba(2, 181, 187, 0.3);
    transition: filter 0.14s cubic-bezier(0.4, 0, 0.2, 1), transform 0.14s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .ed__save:hover:not(:disabled) { filter: brightness(1.06); transform: translateY(-1px); }
  .ed__save:disabled { opacity: 0.55; cursor: wait; }

  .form {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    gap: 0.75rem;
    align-items: end;
    padding: 1rem;
    margin-bottom: 1rem;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
  }

  .form label {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    font-size: 0.7rem;
    font-weight: 800;
    color: #94a3b8;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  .form__wide { grid-column: 1 / -1; }
</style>
