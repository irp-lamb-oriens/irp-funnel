<script lang="ts">
  /**
   * PaymentRecipientsPanel.svelte — who on the team gets an email, and when.
   * ────────────────────────────────────────────────────────────────────────
   * One table for every money message: rows are people, columns are events.
   * Everyone can see it (so nobody wonders who was told); only admins change
   * it. A save that would leave an event with nobody is refused, and every
   * change is written to the payment log with who made it.
   */
  import { onMount } from 'svelte';
  import {
    authEmail,
    fetchContractRecipients,
    fetchPaymentRecipients,
    saveContractRecipients,
    savePaymentRecipients,
    type PaymentEventGroup,
  } from '../store.ts';
  import { ADMIN_EMAILS } from '../access.ts';
  import { toasts } from '../toastStore.ts';

  type Col = PaymentEventGroup | 'contract';
  const COLS: Array<{ key: Col; label: string; help: string }> = [
    { key: 'money_in', label: 'Money received or on its way', help: 'A payment arrived, or a bank payment was started.' },
    { key: 'problems', label: 'Problems', help: "A payment didn't go through, a refund, a dispute, money not linked to a quote, or more received than agreed." },
    { key: 'wire_reported', label: 'Client says they sent a wire', help: 'Someone must check the bank and confirm it.' },
    { key: 'contract', label: 'Contract signed', help: 'A copy of the signed agreement PDF.' },
  ];

  interface Row { email: string; on: Record<Col, boolean> }
  let rows: Row[] = [];
  let usingDefaults = false;
  let updatedAt: string | null = null;
  let updatedBy: string | null = null;
  let loading = true;
  let error = '';
  let saving = false;
  let dirty = false;
  let newEmail = '';
  let addError = '';

  $: isAdmin = ADMIN_EMAILS.includes(String($authEmail ?? '').toLowerCase());

  function emptyOn(): Record<Col, boolean> {
    return { money_in: false, problems: false, wire_reported: false, contract: false };
  }

  async function load() {
    loading = true;
    error = '';
    try {
      const [pay, contract] = await Promise.all([fetchPaymentRecipients(), fetchContractRecipients().catch(() => ({ recipients: [] as string[] }))]);
      const map = new Map<string, Row>();
      const touch = (email: string) => {
        const e = email.toLowerCase();
        if (!map.has(e)) map.set(e, { email: e, on: emptyOn() });
        return map.get(e)!;
      };
      usingDefaults = !pay.configured;
      if (pay.configured) {
        for (const p of pay.people) for (const ev of p.events) touch(p.email).on[ev] = true;
      } else {
        for (const g of Object.keys(pay.defaults) as PaymentEventGroup[]) for (const e of pay.defaults[g]) touch(e).on[g] = true;
      }
      for (const e of contract.recipients) touch(e).on.contract = true;
      rows = [...map.values()].sort((a, b) => a.email.localeCompare(b.email));
      updatedAt = pay.updatedAt;
      updatedBy = pay.updatedBy;
      dirty = false;
    } catch (e: any) {
      error = e?.message ?? 'Could not load the list.';
    } finally {
      loading = false;
    }
  }
  onMount(load);

  function toggle(r: Row, c: Col) {
    if (!isAdmin) return;
    r.on[c] = !r.on[c];
    rows = rows;
    dirty = true;
  }

  function addPerson() {
    const e = newEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) { addError = 'Enter a full email address.'; return; }
    if (rows.some((r) => r.email === e)) { addError = 'That person is already on the list.'; return; }
    rows = [...rows, { email: e, on: emptyOn() }];
    newEmail = '';
    addError = '';
    dirty = true;
  }

  function removePerson(r: Row) {
    rows = rows.filter((x) => x !== r);
    dirty = true;
  }

  $: missing = (['money_in', 'problems', 'wire_reported'] as Col[]).filter((c) => !rows.some((r) => r.on[c]));

  async function save() {
    if (missing.length) return;
    saving = true;
    error = '';
    try {
      await savePaymentRecipients(
        rows
          .map((r) => ({ email: r.email, events: (['money_in', 'problems', 'wire_reported'] as PaymentEventGroup[]).filter((g) => r.on[g]) }))
          .filter((p) => p.events.length),
      );
      await saveContractRecipients(rows.filter((r) => r.on.contract).map((r) => r.email));
      toasts.success?.('Saved. The change is recorded in the payment log.');
      await load();
    } catch (e: any) {
      error = e?.message ?? 'Could not save.';
    } finally {
      saving = false;
    }
  }

  function day(iso: string | null): string {
    if (!iso) return '';
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
</script>

<section class="pr" aria-labelledby="pr-title">
  <header class="pr__head">
    <h3 id="pr-title" class="pr__title">Who gets told about payments</h3>
    <p class="pr__sub">
      Each ticked person gets an email when that happens. The client always gets their own email too.
      {#if !isAdmin}<strong>Only admins can change this list.</strong>{/if}
    </p>
    {#if usingDefaults}
      <p class="pr__note">This is the standard list (the sales and pricing desks). Change it and save to set your own.</p>
    {:else if updatedAt}
      <p class="pr__note">Last changed {day(updatedAt)}{updatedBy ? ` by ${updatedBy}` : ''}.</p>
    {/if}
  </header>

  {#if loading}
    <p class="pr__muted" aria-busy="true">Loading…</p>
  {:else}
    <div class="pr__wrap">
      <table class="pr__table">
        <caption class="pr__sr">People and the payment emails they receive</caption>
        <thead>
          <tr>
            <th scope="col">Person</th>
            {#each COLS as c}
              <th scope="col"><span>{c.label}</span><span class="pr__help">{c.help}</span></th>
            {/each}
            {#if isAdmin}<th scope="col"><span class="pr__sr">Remove</span></th>{/if}
          </tr>
        </thead>
        <tbody>
          {#each rows as r (r.email)}
            <tr>
              <th scope="row">{r.email}</th>
              {#each COLS as c}
                <td>
                  <input
                    type="checkbox"
                    checked={r.on[c.key]}
                    disabled={!isAdmin}
                    on:change={() => toggle(r, c.key)}
                    aria-label={`${r.email}: ${c.label}`}
                  />
                </td>
              {/each}
              {#if isAdmin}
                <td><button type="button" class="pr__remove" on:click={() => removePerson(r)} aria-label={`Remove ${r.email}`}>Remove</button></td>
              {/if}
            </tr>
          {/each}
        </tbody>
      </table>
    </div>

    {#if isAdmin}
      <div class="pr__add">
        <label for="pr-new">Add a person</label>
        <div class="pr__addrow">
          <input id="pr-new" type="email" bind:value={newEmail} placeholder="name@internationalrelocationpartner.com" on:keydown={(e) => e.key === 'Enter' && addPerson()} />
          <button type="button" class="pr__btn" on:click={addPerson}>Add</button>
        </div>
        {#if addError}<p class="pr__error" role="alert">{addError}</p>{/if}
      </div>
      {#if missing.length}
        <p class="pr__error" role="alert">Tick at least one person for: {missing.map((m) => COLS.find((c) => c.key === m)?.label).join(', ')}. Otherwise those emails would reach nobody.</p>
      {/if}
      {#if error}<p class="pr__error" role="alert">{error}</p>{/if}
      <div class="pr__actions">
        <button type="button" class="pr__btn" on:click={load} disabled={saving || !dirty}>Undo changes</button>
        <button type="button" class="pr__btn pr__btn--primary" on:click={save} disabled={saving || !dirty || missing.length > 0}>{saving ? 'Saving…' : 'Save list'}</button>
      </div>
    {/if}
  {/if}
</section>

<style>
  .pr { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px 16px; display: grid; gap: 10px; }
  .pr__title { margin: 0; font-size: 15px; font-weight: 800; color: #0f172a; }
  .pr__sub { margin: 2px 0 0; font-size: 13px; color: #475569; line-height: 1.5; }
  .pr__note { margin: 4px 0 0; font-size: 12px; color: #64748b; }
  .pr__wrap { overflow-x: auto; border: 1px solid #e2e8f0; border-radius: 10px; }
  .pr__table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
  .pr__table th, .pr__table td { padding: 8px 10px; border-bottom: 1px solid #f1f5f9; text-align: center; vertical-align: middle; }
  .pr__table thead th { background: #f8fafc; font-size: 11.5px; font-weight: 800; color: #334155; vertical-align: bottom; }
  .pr__table thead th span { display: block; }
  .pr__help { font-weight: 500; color: #64748b; font-size: 11px; margin-top: 2px; max-width: 170px; margin-inline: auto; }
  .pr__table th[scope='row'], .pr__table thead th:first-child { text-align: left; font-weight: 600; color: #0f172a; }
  .pr__table input[type='checkbox'] { width: 18px; height: 18px; accent-color: #0a7c81; cursor: pointer; }
  .pr__table input:disabled { cursor: not-allowed; }
  .pr__table input:focus-visible, .pr__btn:focus-visible, .pr__remove:focus-visible { outline: 2px solid #0a7c81; outline-offset: 2px; }
  .pr__remove { background: none; border: 0; color: #b42318; font: inherit; font-size: 12px; font-weight: 700; cursor: pointer; text-decoration: underline; }
  .pr__add { display: grid; gap: 4px; }
  .pr__add label { font-size: 12px; font-weight: 700; color: #334155; }
  .pr__addrow { display: flex; gap: 8px; }
  .pr__addrow input { flex: 1; min-height: 34px; padding: 0 10px; border: 1px solid #cbd5e1; border-radius: 8px; font: inherit; font-size: 13px; }
  .pr__addrow input:focus { outline: 2px solid #0a7c81; border-color: #0a7c81; }
  .pr__actions { display: flex; gap: 8px; justify-content: flex-end; }
  .pr__btn { min-height: 34px; padding: 0 14px; border-radius: 8px; border: 1px solid #cbd5e1; background: #fff; font: inherit; font-size: 12.5px; font-weight: 700; cursor: pointer; }
  .pr__btn--primary { background: #0a7c81; border-color: #0a7c81; color: #fff; }
  .pr__btn:disabled { opacity: 0.55; cursor: not-allowed; }
  .pr__error { margin: 0; font-size: 12.5px; color: #b42318; }
  .pr__muted { margin: 0; font-size: 12.5px; color: #64748b; }
  .pr__sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
</style>
