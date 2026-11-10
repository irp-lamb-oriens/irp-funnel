<script lang="ts">
  /**
   * PartnerDetail — one partner: statement, referred clients, links, payouts
   * and settings. A right-hand drawer over the Partners tab.
   */
  import { createEventDispatcher } from 'svelte';
  import {
    updatePartner, createLink, updateLink, recordPayout, updatePayout, setOverride, clearOverride,
    attributeClient, removeAttribution, sendInvite, sendStatement, rotateToken, copyText,
    money, money2, shortDate, monthName, planLabel, TYPE_LABELS, MODEL_LABELS, STAGE_LABELS,
    type Partner, type PartnersReport, type ReferralLine, type CommissionModel, type PartnerType, type PartnerStatus,
  } from './partnersApi.ts';
  import { clients } from '../../store.ts';
  import { toasts } from '../../toastStore.ts';

  export let partner: Partner;
  export let report: PartnersReport;

  const dispatch = createEventDispatcher<{ close: void; changed: void }>();
  let tab: 'statement' | 'referrals' | 'links' | 'payouts' | 'settings' = 'statement';
  let busy = false;

  $: st = partner.statement;
  $: L = st?.lifetime;
  $: cur = st?.currency ?? 'USD';
  $: sinceYear = (st?.since || st?.firstLeadAt || '').slice(0, 4);
  $: activeLinks = partner.links.filter((l) => !l.archived);
  $: archivedLinks = partner.links.filter((l) => l.archived);

  async function run(fn: () => Promise<unknown>, ok?: string) {
    busy = true;
    try {
      await fn();
      if (ok) toasts.success(ok);
      dispatch('changed');
    } catch (e: any) {
      toasts.error(e?.message ?? 'Something went wrong.');
    } finally {
      busy = false;
    }
  }

  async function copy(text: string, what = 'Copied') {
    if (await copyText(text)) toasts.success(what);
  }

  // ── Links ──
  let linkForm = { product: 'irp', label: '', destination: '', medium: '' };
  $: previewBase = linkForm.destination || report.products?.[linkForm.product]?.baseUrl || '';
  $: preview = (() => {
    try {
      const u = new URL(previewBase);
      u.searchParams.set('refer', partner.code);
      u.searchParams.set('utm_source', partner.code);
      u.searchParams.set('utm_medium', (linkForm.medium || partner.type).toLowerCase().replace(/[^a-z0-9]+/g, '-'));
      const c = linkForm.label.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      if (c) u.searchParams.set('utm_campaign', c);
      return u.toString();
    } catch { return ''; }
  })();
  function addLink() {
    if (!linkForm.label.trim()) return toasts.error('Give the link a name, e.g. “Instagram bio”.');
    run(async () => {
      const res = await createLink(partner.id, { ...linkForm, campaign: linkForm.label });
      if (res?.link?.url) await copyText(res.link.url);
      linkForm = { product: linkForm.product, label: '', destination: '', medium: '' };
    }, 'Link created and copied');
  }

  // ── Payouts ──
  let payForm = { amount: '', date: new Date().toISOString().slice(0, 10), method: 'wire', reference: '', note: '' };
  $: if (payForm.amount === '' && L && L.balance > 0) payForm.amount = String(Math.round(L.balance * 100) / 100);
  function addPayout() {
    const amount = Number(payForm.amount);
    if (!(amount > 0)) return toasts.error('Enter the amount sent.');
    run(async () => {
      await recordPayout(partner.id, { ...payForm, amount, currency: cur });
      payForm = { amount: '', date: new Date().toISOString().slice(0, 10), method: payForm.method, reference: '', note: '' };
    }, 'Payment recorded');
  }

  // ── Referrals ──
  let overrideFor: ReferralLine | null = null;
  let overrideAmount = '';
  let overrideNote = '';
  function saveOverride(mode: 'void' | 'fixed') {
    if (!overrideFor) return;
    const key = overrideFor.dealKey;
    if (mode === 'fixed' && !(Number(overrideAmount) >= 0 && overrideAmount !== '')) return toasts.error('Enter the agreed amount.');
    run(async () => {
      await setOverride(partner.id, key, { mode, amount: mode === 'fixed' ? Number(overrideAmount) : undefined, note: overrideNote });
      overrideFor = null; overrideAmount = ''; overrideNote = '';
    }, mode === 'void' ? 'Commission voided for this client' : 'Commission fixed');
  }

  let clientQuery = '';
  $: attributed = report.attribution ?? {};
  $: clientMatches = clientQuery.trim().length < 2 ? [] : $clients
    .filter((c) => {
      const q = clientQuery.trim().toLowerCase();
      return [c.displayName, c.name, c.surname, c.email].some((v) => String(v ?? '').toLowerCase().includes(q));
    })
    .slice(0, 8);
  function credit(cid: string) {
    run(async () => {
      await attributeClient({ consultationId: cid, partnerId: partner.id, note: 'Credited from the dashboard' });
      clientQuery = '';
    }, `Client credited to ${partner.name}`);
  }

  // ── Settings ──
  let edit = initEdit(partner);
  let editFor = partner.id;
  $: if (partner.id !== editFor) { edit = initEdit(partner); editFor = partner.id; }
  function initEdit(p: Partner) {
    const c = p.commission ?? { model: 'percent_cash', rate: 10 };
    const extra = (k: string) => p.productCommissions?.[k] ?? null;
    return {
      name: p.name, email: p.email ?? '', phone: p.phone ?? '', type: p.type as PartnerType, status: p.status as PartnerStatus,
      currency: p.currency ?? 'USD', notes: p.notes ?? '', since: (p.since ?? '').slice(0, 10), monthlyReport: p.monthlyReport !== false,
      model: c.model as CommissionModel, rate: c.rate ?? 10, flat: c.flat ?? 0, months: c.months ?? 12,
      extras: ['censo', 'aiva', 'legal_partner'].map((k) => ({ key: k, on: !!extra(k), model: (extra(k)?.model ?? 'monthly_recurring') as CommissionModel, rate: extra(k)?.rate ?? 10, flat: extra(k)?.flat ?? 30, months: extra(k)?.months ?? 12 })),
      bank: { ...(p.bankDetails ?? {}) },
    };
  }
  const plan = (m: CommissionModel, rate: number, flat: number, months: number) =>
    m.startsWith('percent') ? { model: m, rate: Number(rate) } : { model: m, flat: Number(flat), months: Number(months) };
  function saveSettings() {
    const productCommissions: Record<string, unknown> = {};
    for (const x of edit.extras) if (x.on) productCommissions[x.key] = plan(x.model, x.rate, x.flat, x.months);
    run(() => updatePartner(partner.id, {
      name: edit.name, email: edit.email, phone: edit.phone, type: edit.type, status: edit.status, currency: edit.currency,
      notes: edit.notes, since: edit.since || null, monthlyReport: edit.monthlyReport,
      commission: plan(edit.model, edit.rate, edit.flat, edit.months), productCommissions, bankDetails: edit.bank,
    }), 'Saved');
  }

  const VIA: Record<string, string> = { manual: 'Credited by hand', first_touch: 'Their link (first visit)', touch: 'Their link', referred_by: 'Named them', external: 'Other product' };
</script>

<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
<div class="scrim" on:click|self={() => dispatch('close')}>
  <aside class="drawer">
    <header class="d__head">
      <div>
        <div class="d__eyebrow">{TYPE_LABELS[partner.type] ?? partner.type} · <code>?refer={partner.code}</code></div>
        <h3>{partner.name}</h3>
        <div class="muted small">{planLabel(partner.commission, cur)}{#if partner.email} · {partner.email}{/if}</div>
      </div>
      <button class="x" aria-label="Close" on:click={() => dispatch('close')}>×</button>
    </header>

    <nav class="tabs">
      {#each [['statement', 'Statement'], ['referrals', `Clients (${L?.leads ?? 0})`], ['links', `Links (${activeLinks.length})`], ['payouts', `Payouts (${L?.payouts ?? 0})`], ['settings', 'Settings']] as [k, label]}
        <button class:active={tab === k} on:click={() => (tab = k as typeof tab)}>{label}</button>
      {/each}
    </nav>

    <div class="d__body">
      {#if tab === 'statement'}
        <div class="story">
          <div class="story__eyebrow">Since {sinceYear || 'the start'}</div>
          <p>{partner.name.split(' ')[0]} has sent us <b>{L?.leads ?? 0}</b> {L?.leads === 1 ? 'client' : 'clients'}; <b>{L?.closed ?? 0}</b> bought, bringing in <b>{money(L?.revenue, cur)}</b>.</p>
          <p>We have paid them <b>{money2(L?.paid, cur)}</b> in {L?.payouts ?? 0} {L?.payouts === 1 ? 'payment' : 'payments'}.</p>
        </div>
        <div class="minis">
          <div><span>Clicks</span><b>{L?.clicks ?? 0}</b></div>
          <div><span>Earned</span><b>{money2(L?.earned, cur)}</b></div>
          <div><span>Paid</span><b>{money2(L?.paid, cur)}</b></div>
          <div class="hl"><span>Owed now</span><b>{money2(L?.balance, cur)}</b></div>
          <div><span>Pipeline</span><b>{money(L?.pipeline, cur)}</b></div>
          <div><span>Reversed</span><b>{money(L?.cancelled, cur)}</b></div>
        </div>
        {#if Object.keys(st?.otherCurrencies ?? {}).length}
          <p class="note">Also earned in other currencies: {Object.entries(st.otherCurrencies).map(([c, v]) => money2(v, c)).join(', ')} (not in the totals above).</p>
        {/if}

        <h4>By year</h4>
        <table class="tbl">
          <thead><tr><th>Year</th><th class="num">Referrals</th><th class="num">Closed</th><th class="num">Earned</th><th class="num">Paid</th><th class="num">Reversed</th></tr></thead>
          <tbody>
            {#each st?.years ?? [] as y}
              <tr><td>{y.key}</td><td class="num">{y.leads}</td><td class="num">{y.closed}</td><td class="num">{money2(y.earned, cur)}</td><td class="num">{money2(y.paid, cur)}</td><td class="num">{y.cancelled ? money2(y.cancelled, cur) : '—'}</td></tr>
            {:else}<tr><td colspan="6" class="muted">Nothing yet.</td></tr>{/each}
          </tbody>
        </table>

        <h4>By month</h4>
        <table class="tbl">
          <thead><tr><th>Month</th><th class="num">Referrals</th><th class="num">Closed</th><th class="num">Earned</th><th class="num">Paid</th></tr></thead>
          <tbody>
            {#each (st?.months ?? []).slice(0, 24) as m}
              <tr><td>{monthName(m.key)}</td><td class="num">{m.leads}</td><td class="num">{m.closed}</td><td class="num">{money2(m.earned, cur)}</td><td class="num">{m.paid ? money2(m.paid, cur) : '—'}</td></tr>
            {:else}<tr><td colspan="5" class="muted">Nothing yet.</td></tr>{/each}
          </tbody>
        </table>

      {:else if tab === 'referrals'}
        <div class="credit">
          <label class="small b">Credit a client to {partner.name.split(' ')[0]} <span class="muted">(word of mouth, or clients from before the link)</span></label>
          <input class="input" placeholder="Search a client by name or email…" bind:value={clientQuery} />
          {#if clientMatches.length}
            <div class="matches">
              {#each clientMatches as c (c.id)}
                {@const owner = attributed[c.id]}
                <button class="match" disabled={owner?.partnerId === partner.id} on:click={() => credit(c.id)}>
                  <span>{c.displayName}<span class="muted small"> · {c.email}</span></span>
                  <span class="small muted">{owner ? (owner.partnerId === partner.id ? 'already theirs' : `now: ${report.partners.find((p) => p.id === owner.partnerId)?.name ?? 'other partner'}`) : 'credit'}</span>
                </button>
              {/each}
            </div>
          {/if}
        </div>

        <table class="tbl">
          <thead><tr><th>Client</th><th>Came</th><th>Status</th><th class="num">Paid</th><th class="num">Commission</th><th></th></tr></thead>
          <tbody>
            {#each st?.referrals ?? [] as r (r.dealKey)}
              <tr class:dim={r.stage === 'dropped' || r.override?.mode === 'void'}>
                <td><b>{r.clientName}</b>{#if r.product !== 'irp'}<span class="pill">{r.product}</span>{/if}<div class="muted small">{VIA[r.via] ?? r.via}{r.campaign ? ` · ${r.campaign}` : ''}</div></td>
                <td class="small">{shortDate(r.leadAt ?? r.attributedAt)}</td>
                <td><span class="stage stage--{r.stage}">{STAGE_LABELS[r.stage]}</span>{#if r.paidAt}<div class="muted small">{shortDate(r.paidAt)}</div>{/if}</td>
                <td class="num">{money(r.cash, r.currency)}{#if r.booked > r.cash}<div class="muted small">of {money(r.booked, r.currency)}</div>{/if}</td>
                <td class="num"><b>{money2(r.earned, r.currency)}</b>{#if r.projected > r.earned + 0.5}<div class="muted small">up to {money(r.projected, r.currency)}</div>{/if}{#if r.override}<div class="small ovr">{r.override.mode === 'void' ? 'voided' : 'fixed'}{r.override.note ? `: ${r.override.note}` : ''}</div>{/if}</td>
                <td class="actions">
                  {#if r.override}
                    <button class="btn btn--small btn--ghost" disabled={busy} on:click={() => run(() => clearOverride(partner.id, r.dealKey), 'Back to the plan')}>Reset</button>
                  {:else}
                    <button class="btn btn--small btn--ghost" on:click={() => { overrideFor = r; overrideAmount = String(r.earned); overrideNote = ''; }}>Adjust</button>
                  {/if}
                  {#if r.via === 'manual'}
                    <button class="btn btn--small btn--ghost" disabled={busy} on:click={() => run(() => removeAttribution(r.dealKey), 'Credit removed')}>Uncredit</button>
                  {/if}
                </td>
              </tr>
            {:else}
              <tr><td colspan="6" class="muted">No clients yet. Share a link from the Links tab.</td></tr>
            {/each}
          </tbody>
        </table>

        {#if overrideFor}
          <div class="ovr-box">
            <b>Adjust commission for {overrideFor.clientName}</b>
            <p class="muted small">The plan says {money2(overrideFor.earned, overrideFor.currency)}. Set an agreed amount, or void it (duplicate, client not really theirs, refund).</p>
            <div class="row3">
              <input class="input" type="number" min="0" step="0.01" bind:value={overrideAmount} placeholder="Agreed amount" />
              <input class="input" bind:value={overrideNote} placeholder="Reason (kept on record)" />
            </div>
            <div class="row-btns">
              <button class="btn btn--small btn--ghost" on:click={() => (overrideFor = null)}>Cancel</button>
              <button class="btn btn--small btn--danger" disabled={busy} on:click={() => saveOverride('void')}>Void</button>
              <button class="btn btn--small btn--primary" disabled={busy} on:click={() => saveOverride('fixed')}>Set amount</button>
            </div>
          </div>
        {/if}

      {:else if tab === 'links'}
        {#each activeLinks as l (l.id)}
          <div class="link-row">
            <div class="link-row__top">
              <b>{l.label}</b>
              <span class="muted small">{report.products?.[l.product]?.label ?? l.product} · {shortDate(l.createdAt)}</span>
            </div>
            <div class="url">{l.url}</div>
            <div class="row-btns">
              <button class="btn btn--small btn--primary" on:click={() => copy(l.url, 'Link copied')}>Copy</button>
              <button class="btn btn--small btn--ghost" disabled={busy} on:click={() => run(() => updateLink(partner.id, l.id, { archived: true }), 'Link archived')}>Archive</button>
            </div>
          </div>
        {:else}
          <p class="muted">No active link.</p>
        {/each}

        <div class="new-link">
          <h4>New link</h4>
          <p class="muted small">One link per place they share it (Instagram bio, a podcast episode, a newsletter) shows which one brings clients. All of them credit {partner.name.split(' ')[0]}.</p>
          <div class="grid2">
            <label>Name<input class="input" bind:value={linkForm.label} placeholder="Instagram bio" /></label>
            <label>Product
              <select class="input" bind:value={linkForm.product}>
                {#each Object.entries(report.products ?? {}) as [k, v]}<option value={k}>{v.label}</option>{/each}
              </select>
            </label>
            <label>Landing page <span class="muted">(optional)</span><input class="input" bind:value={linkForm.destination} placeholder={report.products?.[linkForm.product]?.baseUrl || 'https://…'} /></label>
            <label>Channel <span class="muted">(utm_medium)</span><input class="input" bind:value={linkForm.medium} placeholder={partner.type} /></label>
          </div>
          {#if preview}<div class="url url--preview">{preview}</div>{:else}<p class="note">Enter a full landing page address for this product.</p>{/if}
          <div class="row-btns"><button class="btn btn--primary" disabled={busy || !preview} on:click={addLink}>Create & copy</button></div>
        </div>
        {#if archivedLinks.length}
          <details class="archived"><summary class="muted small">{archivedLinks.length} archived</summary>
            {#each archivedLinks as l (l.id)}
              <div class="link-row link-row--old"><span>{l.label}</span><button class="btn btn--small btn--ghost" on:click={() => run(() => updateLink(partner.id, l.id, { archived: false }), 'Restored')}>Restore</button></div>
            {/each}
          </details>
        {/if}

      {:else if tab === 'payouts'}
        <div class="bank">
          <div class="b small">Bank details {#if partner.bankDetails?.updatedAt}<span class="muted">· updated {shortDate(partner.bankDetails.updatedAt)}</span>{/if}</div>
          {#if partner.bankDetails?.updatedAt}
            <dl>
              {#each [['Holder', partner.bankDetails.holderName], ['Bank', partner.bankDetails.bankName], ['Country', partner.bankDetails.country], ['Account', partner.bankDetails.accountNumber], ['IBAN', partner.bankDetails.iban], ['SWIFT', partner.bankDetails.swift], ['Routing', partner.bankDetails.routingNumber], ['PayPal', partner.bankDetails.paypalEmail], ['Prefers', partner.bankDetails.preferredMethod], ['Notes', partner.bankDetails.notes]] as [k, v]}
                {#if v}<dt>{k}</dt><dd>{v}</dd>{/if}
              {/each}
            </dl>
          {:else}
            <p class="note">They haven't added bank details yet. Send them their partner page (Settings → Send invite).</p>
          {/if}
        </div>

        <div class="new-pay">
          <h4>Record a payment we sent</h4>
          <div class="grid3">
            <label>Amount ({cur})<input class="input" type="number" min="0" step="0.01" bind:value={payForm.amount} /></label>
            <label>Date<input class="input" type="date" bind:value={payForm.date} /></label>
            <label>Method
              <select class="input" bind:value={payForm.method}>
                <option value="wire">Wire</option><option value="sinpe">SINPE</option><option value="paypal">PayPal</option><option value="zelle">Zelle</option><option value="cash">Cash</option><option value="credit">Credit on services</option><option value="other">Other</option>
              </select>
            </label>
            <label>Reference<input class="input" bind:value={payForm.reference} placeholder="Wire / transfer number" /></label>
            <label class="span2">Note<input class="input" bind:value={payForm.note} placeholder="e.g. Commission Q3: J. S., M. R." /></label>
          </div>
          <div class="row-btns"><button class="btn btn--primary" disabled={busy} on:click={addPayout}>Record payment</button></div>
        </div>

        <table class="tbl">
          <thead><tr><th>Date</th><th class="num">Amount</th><th>Method</th><th>Reference</th><th></th></tr></thead>
          <tbody>
            {#each st?.payouts ?? [] as po (po.id)}
              <tr class:dim={po.status === 'cancelled'}>
                <td>{shortDate(po.date)}</td>
                <td class="num">{money2(po.amount, po.currency ?? cur)}</td>
                <td>{po.method ?? ''}{#if po.status === 'cancelled'} <span class="pill">cancelled</span>{/if}</td>
                <td class="small">{po.reference ?? ''}{#if po.note}<div class="muted">{po.note}</div>{/if}</td>
                <td class="actions">
                  {#if po.status === 'cancelled'}
                    <button class="btn btn--small btn--ghost" disabled={busy} on:click={() => run(() => updatePayout(po.id, { status: 'paid' }), 'Restored')}>Restore</button>
                  {:else}
                    <button class="btn btn--small btn--ghost" disabled={busy} on:click={() => { if (confirm('Cancel this payment record? It stays on file but stops counting.')) run(() => updatePayout(po.id, { status: 'cancelled' }), 'Payment cancelled'); }}>Cancel</button>
                  {/if}
                </td>
              </tr>
            {:else}<tr><td colspan="5" class="muted">No payments recorded yet.</td></tr>{/each}
          </tbody>
        </table>

      {:else if tab === 'settings'}
        <div class="portal">
          <div>
            <div class="b small">Partner page</div>
            <div class="muted small">
              {partner.termsAcceptedAt ? `Accepted ${shortDate(partner.termsAcceptedAt)}` : 'Not opened yet'}{partner.portalSeenAt ? ` · last seen ${shortDate(partner.portalSeenAt)}` : ''}
            </div>
          </div>
          <div class="row-btns">
            <button class="btn btn--small btn--ghost" on:click={() => copy(partner.portalUrl, 'Partner page link copied')}>Copy page link</button>
            <button class="btn btn--small btn--primary" disabled={busy || !partner.email} title={partner.email ? '' : 'Add an email first'} on:click={() => run(() => sendInvite(partner.id), `Invite sent to ${partner.email}`)}>Send invite</button>
            <button class="btn btn--small btn--ghost" disabled={busy || !partner.email} on:click={() => run(() => sendStatement(partner.id), 'Statement sent')}>Email statement now</button>
            <button class="btn btn--small btn--ghost" disabled={busy} on:click={() => { if (confirm('Make a new partner page link? The old one stops working.')) run(() => rotateToken(partner.id), 'New page link created'); }}>New page link</button>
          </div>
        </div>

        <div class="grid2">
          <label>Name<input class="input" bind:value={edit.name} /></label>
          <label>Email<input class="input" type="email" bind:value={edit.email} /></label>
          <label>Phone / WhatsApp<input class="input" bind:value={edit.phone} /></label>
          <label>Type
            <select class="input" bind:value={edit.type}>{#each Object.entries(TYPE_LABELS) as [k, v]}<option value={k}>{v}</option>{/each}</select>
          </label>
          <label>Status
            <select class="input" bind:value={edit.status}>{#each report.statuses as s}<option value={s}>{s}</option>{/each}</select>
          </label>
          <label>Payout currency<input class="input" maxlength="3" bind:value={edit.currency} /></label>
          <label>Relationship since<input class="input" type="date" bind:value={edit.since} /></label>
          <label class="chk"><input type="checkbox" bind:checked={edit.monthlyReport} /> Email a statement on the 1st of each month</label>
        </div>

        <h4>Commission on IRP clients</h4>
        <div class="grid3">
          <label>Model<select class="input" bind:value={edit.model}>{#each Object.entries(MODEL_LABELS) as [k, v]}<option value={k}>{v}</option>{/each}</select></label>
          {#if edit.model.startsWith('percent')}
            <label>Rate %<input class="input" type="number" min="0" max="100" step="0.5" bind:value={edit.rate} /></label>
          {:else}
            <label>Amount<input class="input" type="number" min="0" bind:value={edit.flat} /></label>
            {#if edit.model === 'monthly_recurring'}<label>Months<input class="input" type="number" min="1" max="120" bind:value={edit.months} /></label>{/if}
          {/if}
        </div>

        <h4>Other products</h4>
        <p class="muted small">Their own plan for sales reported by El Censo, AIVA or Legal Partner. Off = the IRP plan applies.</p>
        {#each edit.extras as x}
          <div class="grid4">
            <label class="chk"><input type="checkbox" bind:checked={x.on} /> {report.products?.[x.key]?.label ?? x.key}</label>
            {#if x.on}
              <select class="input" bind:value={x.model}>{#each Object.entries(MODEL_LABELS) as [k, v]}<option value={k}>{v}</option>{/each}</select>
              {#if x.model.startsWith('percent')}
                <input class="input" type="number" min="0" max="100" bind:value={x.rate} placeholder="%" />
              {:else}
                <input class="input" type="number" min="0" bind:value={x.flat} placeholder="Amount" />
                {#if x.model === 'monthly_recurring'}<input class="input" type="number" min="1" bind:value={x.months} placeholder="Months" />{/if}
              {/if}
            {/if}
          </div>
        {/each}

        <h4>Bank details</h4>
        <div class="grid2">
          <label>Account holder<input class="input" bind:value={edit.bank.holderName} /></label>
          <label>Bank<input class="input" bind:value={edit.bank.bankName} /></label>
          <label>Country<input class="input" bind:value={edit.bank.country} /></label>
          <label>Account number<input class="input" bind:value={edit.bank.accountNumber} /></label>
          <label>IBAN<input class="input" bind:value={edit.bank.iban} /></label>
          <label>SWIFT<input class="input" bind:value={edit.bank.swift} /></label>
          <label>Routing (US)<input class="input" bind:value={edit.bank.routingNumber} /></label>
          <label>PayPal email<input class="input" bind:value={edit.bank.paypalEmail} /></label>
        </div>

        <label class="full">Notes<textarea class="input" rows="3" bind:value={edit.notes}></textarea></label>
        <div class="row-btns"><button class="btn btn--primary" disabled={busy} on:click={saveSettings}>Save</button></div>
      {/if}
    </div>
  </aside>
</div>

<style>
  .scrim { position: fixed; inset: 0; background: rgba(15,23,42,.35); z-index: 900; display: flex; justify-content: flex-end; }
  .drawer { width: min(820px, 100vw); height: 100%; background: #fafbfc; box-shadow: -10px 0 40px rgba(0,0,0,.15); display: flex; flex-direction: column; font-family: var(--font-paragraph, 'Jost'), system-ui, sans-serif; color: #181818; }
  .d__head { display: flex; justify-content: space-between; align-items: flex-start; padding: 1.1rem 1.4rem 0.6rem; background: #fff; }
  .d__head h3 { margin: 0.15rem 0; font-size: 1.3rem; }
  .d__eyebrow { font-size: 0.75rem; color: #0e7490; font-weight: 700; }
  .x { border: none; background: none; font-size: 1.7rem; line-height: 1; cursor: pointer; color: #64748b; }
  .tabs { display: flex; gap: 2px; padding: 0 1.1rem; background: #fff; border-bottom: 1px solid #e2e8f0; overflow-x: auto; }
  .tabs button { border: none; background: none; padding: 0.65rem 0.8rem; font: inherit; font-weight: 600; font-size: 0.85rem; color: #64748b; cursor: pointer; border-bottom: 2px solid transparent; white-space: nowrap; }
  .tabs button.active { color: #0f172a; border-bottom-color: #02b5bb; }
  .d__body { padding: 1.1rem 1.4rem 3rem; overflow-y: auto; flex: 1; }
  h4 { margin: 1.3rem 0 0.5rem; font-size: 0.9rem; }

  .story { background: linear-gradient(135deg, #ecfeff, #fff); border: 1px solid #a5f3fc; border-radius: 12px; padding: 0.9rem 1.1rem; }
  .story p { margin: 0.25rem 0; font-size: 1rem; }
  .story__eyebrow { font-size: 0.72rem; text-transform: uppercase; letter-spacing: .06em; color: #0e7490; font-weight: 700; }
  .minis { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.5rem; margin-top: 0.75rem; }
  .minis div { background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 0.55rem 0.7rem; display: flex; flex-direction: column; }
  .minis span { font-size: 0.72rem; color: #64748b; font-weight: 600; }
  .minis b { font-variant-numeric: tabular-nums; }
  .minis .hl { border-color: #02b5bb; }

  .tbl { width: 100%; border-collapse: collapse; font-size: 0.85rem; background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; }
  .tbl th { text-align: left; font-size: 0.7rem; text-transform: uppercase; letter-spacing: .04em; color: #64748b; padding: 0.45rem 0.6rem; border-bottom: 1px solid #e2e8f0; }
  .tbl td { padding: 0.5rem 0.6rem; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
  .num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .actions { white-space: nowrap; text-align: right; }
  .dim { opacity: .55; }
  .stage { font-size: 0.72rem; font-weight: 700; padding: 2px 7px; border-radius: 999px; background: #f1f5f9; color: #475569; }
  .stage--paid { background: #dcfce7; color: #166534; }
  .stage--accepted { background: #e0f2fe; color: #075985; }
  .stage--quoted { background: #ede9fe; color: #5b21b6; }
  .stage--dropped { background: #fee2e2; color: #991b1b; }
  .ovr { color: #b45309; }
  .pill { font-size: 0.68rem; font-weight: 700; padding: 1px 6px; border-radius: 999px; background: #f1f5f9; color: #475569; margin-left: 6px; text-transform: uppercase; }

  .credit { margin-bottom: 0.9rem; display: flex; flex-direction: column; gap: 0.35rem; }
  .matches { background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; }
  .match { display: flex; justify-content: space-between; width: 100%; border: none; background: none; padding: 0.5rem 0.7rem; font: inherit; cursor: pointer; text-align: left; border-bottom: 1px solid #f1f5f9; }
  .match:hover:not(:disabled) { background: #f0fdfa; }
  .match:disabled { cursor: default; opacity: .6; }
  .ovr-box { margin-top: 0.8rem; background: #fff; border: 1px solid #fcd34d; border-radius: 10px; padding: 0.8rem; }

  .link-row { background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 0.7rem 0.85rem; margin-bottom: 0.6rem; }
  .link-row__top { display: flex; justify-content: space-between; gap: 0.5rem; flex-wrap: wrap; }
  .link-row--old { display: flex; justify-content: space-between; align-items: center; padding: 0.4rem 0.7rem; }
  .url { font-family: ui-monospace, monospace; font-size: 0.78rem; background: #f1f5f9; border-radius: 6px; padding: 0.45rem 0.6rem; margin: 0.45rem 0; word-break: break-all; }
  .url--preview { background: #ecfeff; }
  .new-link, .new-pay, .bank, .portal { background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 0.85rem; margin: 0.9rem 0; }
  .new-link h4, .new-pay h4 { margin-top: 0; }
  .portal { display: flex; justify-content: space-between; align-items: center; gap: 0.75rem; flex-wrap: wrap; margin-top: 0; }
  .bank dl { display: grid; grid-template-columns: max-content 1fr; gap: 0.2rem 0.8rem; margin: 0.5rem 0 0; font-size: 0.85rem; }
  .bank dt { color: #64748b; }
  .bank dd { margin: 0; font-family: ui-monospace, monospace; }
  .archived { margin-top: 0.5rem; }

  label { display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.78rem; font-weight: 600; color: #334155; }
  label.chk { flex-direction: row; align-items: center; gap: 0.4rem; }
  label.full { margin-top: 0.8rem; }
  .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 0.6rem; }
  .grid3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.6rem; }
  .grid4 { display: grid; grid-template-columns: 1.4fr 1.4fr 1fr 1fr; gap: 0.5rem; align-items: center; margin-bottom: 0.4rem; }
  .span2 { grid-column: span 2; }
  .row3 { display: grid; grid-template-columns: 1fr 2fr; gap: 0.5rem; margin: 0.5rem 0; }
  .row-btns { display: flex; gap: 0.4rem; justify-content: flex-end; flex-wrap: wrap; margin-top: 0.6rem; }
  .input { width: 100%; box-sizing: border-box; border: 1px solid #cbd5e1; border-radius: 8px; padding: 0.45rem 0.6rem; font: inherit; font-size: 0.88rem; background: #fff; font-weight: 400; }
  .input:focus { outline: none; border-color: #02b5bb; box-shadow: 0 0 0 3px rgba(2,181,187,.15); }
  .btn { border: 1px solid transparent; border-radius: 8px; padding: 0.5rem 1rem; font: inherit; font-weight: 600; font-size: 0.85rem; cursor: pointer; }
  .btn:disabled { opacity: .5; cursor: default; }
  .btn--primary { background: #02b5bb; color: #fff; }
  .btn--primary:hover:not(:disabled) { background: #029aa0; }
  .btn--ghost { background: #fff; border-color: #e2e8f0; color: #334155; }
  .btn--danger { background: #fff; border-color: #fecaca; color: #b91c1c; }
  .btn--small { padding: 0.28rem 0.6rem; font-size: 0.76rem; }
  .muted { color: #64748b; }
  .small { font-size: 0.78rem; }
  .b { font-weight: 700; }
  .note { font-size: 0.82rem; color: #92400e; background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 0.45rem 0.65rem; }
  code { font-size: 0.85em; }
  @media (max-width: 640px) { .grid2, .grid3, .grid4, .minis { grid-template-columns: 1fr; } .span2 { grid-column: auto; } }
</style>
