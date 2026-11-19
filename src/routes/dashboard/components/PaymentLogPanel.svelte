<script lang="ts">
  /**
   * PaymentLogPanel.svelte — Finance → Payment log.
   * ────────────────────────────────────────────────────────────────────────
   * Every money event, newest first, exactly as recorded at the time: who or
   * what did it, how much, how, and on which client and invoice. The app never
   * edits or deletes these entries. Export gives finance (or an accountant) the
   * whole log as a spreadsheet.
   */
  import { onMount } from 'svelte';
  import { fetchPaymentLog, paymentsRefresh, selectClientById, type PaymentLogEvent } from '../store.ts';

  let events: PaymentLogEvent[] = [];
  let loading = true;
  let error = '';
  type Group = 'all' | 'money' | 'problems' | 'wires' | 'admin';
  let group: Group = 'all';
  let query = '';

  const TYPE: Record<string, { label: string; group: Group; tone: string }> = {
    received: { label: 'Received', group: 'money', tone: 'good' },
    on_its_way: { label: 'On its way', group: 'money', tone: 'info' },
    failed: { label: "Didn't go through", group: 'problems', tone: 'bad' },
    refunded: { label: 'Refunded', group: 'problems', tone: 'warn' },
    dispute_opened: { label: 'Disputed', group: 'problems', tone: 'bad' },
    dispute_funds_moved: { label: 'Dispute closed', group: 'problems', tone: 'warn' },
    overpaid: { label: 'More than agreed', group: 'problems', tone: 'bad' },
    unmatched: { label: 'Not linked to a quote', group: 'problems', tone: 'bad' },
    wire_reported: { label: 'Wire reported by client', group: 'wires', tone: 'info' },
    settings_changed: { label: 'Settings changed', group: 'admin', tone: 'neutral' },
    attention_resolved: { label: 'Marked as handled', group: 'admin', tone: 'neutral' },
  };
  const GROUPS: Array<[Group, string]> = [['all', 'All'], ['money', 'Money in'], ['problems', 'Problems'], ['wires', 'Wires reported'], ['admin', 'Settings and notes']];

  async function load() {
    error = '';
    try {
      events = (await fetchPaymentLog()).events;
    } catch (e: any) {
      error = e?.message ?? 'Could not load the payment log.';
    } finally {
      loading = false;
    }
  }
  onMount(load);
  let first = true;
  $: $paymentsRefresh, (first ? (first = false) : load());

  $: q = query.trim().toLowerCase();
  $: shown = events.filter((e) =>
    (group === 'all' || TYPE[e.type]?.group === group) &&
    (!q || [e.clientName, e.quoteTitle, e.reference, e.method, e.actor, e.note, ...(e.invoiceNumbers ?? [])].some((v) => String(v ?? '').toLowerCase().includes(q)))
  );

  function fmt(n: number | null | undefined, currency?: string | null): string {
    if (typeof n !== 'number') return '';
    try { return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'USD' }).format(n); }
    catch { return `${currency ?? ''} ${n.toFixed(2)}`; }
  }
  function when(iso: string): string {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
  }
  function who(actor: string): string {
    if (actor === 'stripe') return 'Stripe (automatic)';
    if (actor === 'client') return 'Client';
    if (actor === 'system') return 'System check';
    return actor;
  }

  function csvCell(v: unknown): string {
    const s = String(v ?? '');
    // Neutralise spreadsheet formulas in exported text.
    const safe = /^[=+\-@]/.test(s) && !/^-?\d/.test(s) ? `'${s}` : s;
    return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  }
  function exportCsv() {
    const head = ['When', 'What', 'Amount', 'Currency', 'Method', 'Client', 'Quote', 'Invoices', 'Reference', 'By', 'Note', 'Mode', 'Entry id'];
    const lines = shown.map((e) => [
      e.at, TYPE[e.type]?.label ?? e.type, e.amount ?? '', e.currency ?? '', e.method ?? '', e.clientName ?? '', e.quoteTitle ?? '',
      (e.invoiceNumbers ?? []).join(' '), e.reference ?? '', who(e.actor), e.note ?? '', e.livemode === false ? 'test' : 'live', e.id,
    ].map(csvCell).join(','));
    const blob = new Blob(['﻿' + [head.join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `irp-payment-log-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
</script>

<section class="pl" aria-labelledby="pl-title">
  <header class="pl__head">
    <div>
      <h2 id="pl-title" class="pl__title">Payment log</h2>
      <p class="pl__sub">Every payment event, as it happened. Entries are never edited or deleted.</p>
    </div>
    <div class="pl__controls">
      <button type="button" on:click={load} disabled={loading}>Refresh</button>
      <button type="button" on:click={exportCsv} disabled={!shown.length} title={!shown.length ? 'Nothing to export for this filter' : undefined}>Export {shown.length} to spreadsheet</button>
    </div>
  </header>

  <div class="pl__bar">
    <div class="pl__filters" role="group" aria-label="Show">
      {#each GROUPS as [k, label]}
        <button type="button" class:active={group === k} aria-pressed={group === k} on:click={() => (group = k)}>{label}</button>
      {/each}
    </div>
    <label class="pl__search"><span class="pl__sr">Search the log</span><input type="search" bind:value={query} placeholder="Search client, invoice, reference…" /></label>
  </div>

  {#if error}
    <p class="pl__error" role="alert">{error}</p>
  {:else if loading}
    <p class="pl__empty" aria-busy="true" role="status">Loading…</p>
  {:else if !shown.length}
    <p class="pl__empty" role="status">{events.length ? 'Nothing matches.' : 'No payment events yet. The first one appears the moment a client pays or reports a wire.'}</p>
  {:else}
    <div class="pl__wrap">
      <table class="pl__table">
        <thead>
          <tr><th scope="col">When</th><th scope="col">What</th><th scope="col" class="num">Amount</th><th scope="col">Client</th><th scope="col">Details</th><th scope="col">By</th></tr>
        </thead>
        <tbody>
          {#each shown as e (e.id)}
            <tr>
              <td class="pl__when">{when(e.at)}</td>
              <td>
                <span class="pl__type pl__type--{TYPE[e.type]?.tone ?? 'neutral'}">{TYPE[e.type]?.label ?? e.type}</span>
                {#if e.livemode === false}<span class="pl__test">Test</span>{/if}
              </td>
              <td class="num">{fmt(e.amount, e.currency)}</td>
              <td>
                {#if e.consultationId}
                  <button type="button" class="pl__client" on:click={() => selectClientById(e.consultationId ?? '')}>{e.clientName || 'Open client'}</button>
                {:else}{e.clientName ?? ''}{/if}
                {#if e.quoteTitle}<div class="pl__subtle">{e.quoteTitle}</div>{/if}
              </td>
              <td class="pl__details">
                {[e.method, (e.invoiceNumbers ?? []).join(', '), e.reference].filter(Boolean).join(' · ')}
                {#if e.note}<div class="pl__subtle">{e.note}</div>{/if}
              </td>
              <td>{who(e.actor)}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</section>

<style>
  .pl { display: flex; flex-direction: column; gap: 12px; }
  .pl__head { display: flex; justify-content: space-between; align-items: flex-end; gap: 12px; flex-wrap: wrap; }
  .pl__title { margin: 0; font-size: var(--irp-fs-xl); font-weight: 800; color: var(--irp-text); }
  .pl__sub { margin: 2px 0 0; font-size: var(--irp-fs-sm); color: var(--irp-text-dim); }
  .pl__controls { display: flex; gap: 8px; }
  .pl__controls button { min-height: 32px; padding: 0 14px; border-radius: var(--irp-r-sm); border: 1px solid var(--irp-line-strong); background: var(--irp-surface); font: inherit; font-size: var(--irp-fs-sm); font-weight: 700; cursor: pointer; }
  .pl__controls button:disabled { opacity: 0.55; cursor: not-allowed; }
  .pl__bar { display: flex; gap: 10px; justify-content: space-between; flex-wrap: wrap; align-items: center; }
  .pl__filters { display: flex; gap: 6px; flex-wrap: wrap; }
  .pl__filters button { min-height: 30px; padding: 0 12px; border-radius: var(--irp-r-full); border: 1px solid var(--irp-line); background: var(--irp-surface); font: inherit; font-size: var(--irp-fs-xs); font-weight: 700; color: var(--irp-text-2); cursor: pointer; }
  .pl__filters button.active { background: var(--irp-teal-700); border-color: var(--irp-teal-700); color: var(--irp-text-inverse); }
  .pl__search input { min-height: 32px; min-width: 240px; padding: 0 10px; border: 1px solid var(--irp-line-strong); border-radius: var(--irp-r-sm); font: inherit; font-size: var(--irp-fs-sm); }
  .pl__filters button:focus-visible, .pl__controls button:focus-visible, .pl__client:focus-visible, .pl__search input:focus { outline: 2px solid var(--irp-teal-700); outline-offset: 2px; }
  .pl__wrap { overflow-x: auto; border: 1px solid var(--irp-line); border-radius: var(--irp-r-md); background: var(--irp-surface); }
  .pl__table { width: 100%; border-collapse: collapse; font-size: var(--irp-fs-sm); }
  .pl__table th { text-align: left; font-size: var(--irp-fs-2xs); font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: var(--irp-text-dim); padding: 10px 12px; background: var(--irp-surface-2); border-bottom: 1px solid var(--irp-line); }
  .pl__table td { padding: 9px 12px; border-bottom: 1px solid var(--irp-slate-100); color: var(--irp-text-2); vertical-align: top; }
  .pl__table .num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .pl__when { white-space: nowrap; color: var(--irp-text-muted); }
  .pl__type { display: inline-block; font-size: var(--irp-fs-2xs); font-weight: 800; padding: 2px 8px; border-radius: var(--irp-r-full); white-space: nowrap; }
  .pl__type--good { background: var(--irp-green-100); color: var(--irp-green-800); }
  .pl__type--info { background: var(--irp-surface-3); color: var(--irp-blue-800); }
  .pl__type--bad { background: var(--irp-surface-3); color: var(--irp-red-700); }
  .pl__type--warn { background: var(--irp-amber-100); color: var(--irp-amber-800); }
  .pl__type--neutral { background: var(--irp-surface-3); color: var(--irp-text-2); }
  .pl__test { margin-left: 4px; font-size: var(--irp-fs-2xs); font-weight: 800; color: var(--irp-amber-800); background: var(--irp-bg); border-radius: var(--irp-r-2xs); padding: 1px 5px; }
  .pl__client { background: none; border: 0; padding: 0; font: inherit; font-weight: 700; color: var(--irp-text); cursor: pointer; text-align: left; text-decoration: underline; text-decoration-color: var(--irp-text-dim); text-underline-offset: 3px; }
  .pl__subtle { font-size: var(--irp-fs-xs); color: var(--irp-text-dim); margin-top: 2px; line-height: 1.4; }
  .pl__details { max-width: 420px; }
  .pl__empty { color: var(--irp-text-dim); font-size: var(--irp-fs-sm); padding: 18px; text-align: center; background: var(--irp-surface-2); border-radius: var(--irp-r-md); margin: 0; font-style: normal; }
  .pl__error { color: var(--irp-danger-ink); font-size: var(--irp-fs-sm); font-weight: 600; font-style: normal; }
  .pl__sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
</style>
