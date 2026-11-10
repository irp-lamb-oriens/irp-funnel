<script lang="ts">
  /**
   * /partner/[token] — a partner's private page (influencers, media, experts).
   *
   * The token in the URL is the credential (emailed from the dashboard). Shows
   * their links, every client they referred (initials only), what each earned
   * them, every payment we sent, the "since we started" totals, and a form for
   * the bank details we pay into. Backend: GET/PUT /api/partner-portal/:token.
   */
  import { onMount } from 'svelte';
  import { page } from '$app/stores';

  // Public token pages call the API server directly (see provider-rate/+page.svelte).
  function getApiUrl(): string {
    if (typeof window !== 'undefined' && window.location.origin.startsWith('http://localhost')) return 'http://localhost:8000';
    return 'https://irp-funnel-server.onrender.com';
  }
  const API = getApiUrl();

  $: token = $page.params.token ?? '';

  type Stage = 'lead' | 'quoted' | 'accepted' | 'paid' | 'dropped';
  interface PortalData {
    partner: { name: string; code: string; type: string; status: string; email: string; phone: string; currency: string; commission: { model: string; rate?: number; flat?: number; months?: number }; monthlyReport: boolean; termsAcceptedAt: string | null; since: string | null };
    links: Array<{ id: string; label: string; product: string; campaign: string; url: string; createdAt: string }>;
    products: Array<{ id: string; label: string; baseUrl: string }>;
    bank: Record<string, string | null>;
    statement: {
      currency: string;
      lifetime: { clicks: number; leads: number; closed: number; earned: number; paid: number; balance: number; pipeline: number; cancelled: number; revenue: number; payouts: number };
      years: Array<{ key: string; leads: number; closed: number; earned: number; paid: number }>;
      months: Array<{ key: string; leads: number; closed: number; earned: number; paid: number }>;
      referrals: Array<{ dealKey: string; product: string; clientLabel: string; leadAt: string | null; paidAt: string | null; stage: Stage; currency: string; earned: number; projected: number; voided: boolean }>;
      payouts: Array<{ id: string; amount: number; currency: string; date: string; method: string; reference: string }>;
      since: string | null;
      firstLeadAt: string | null;
    };
  }

  let state: 'loading' | 'ready' | 'error' = 'loading';
  let errorMsg = '';
  let data: PortalData | null = null;
  let tab: 'overview' | 'clients' | 'payments' | 'links' | 'bank' = 'overview';

  async function load() {
    try {
      const res = await fetch(`${API}/api/partner-portal/${encodeURIComponent(token)}`);
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error || 'Could not load your page.');
      data = body;
      bank = {
        holderName: body.bank.holderName ?? '', bankName: body.bank.bankName ?? '', country: body.bank.country ?? '',
        accountNumber: body.bank.accountNumberMasked ?? '', iban: body.bank.ibanMasked ?? '', swift: body.bank.swift ?? '',
        routingNumber: body.bank.routingNumberMasked ?? '', paypalEmail: body.bank.paypalEmail ?? '',
        preferredMethod: body.bank.preferredMethod || 'wire', notes: body.bank.notes ?? '',
      };
      phone = body.partner.phone ?? '';
      monthlyReport = body.partner.monthlyReport;
      if (!body.partner.termsAcceptedAt) tab = 'bank';
      state = 'ready';
    } catch (e: any) {
      errorMsg = e?.message ?? 'Could not load your page.';
      state = 'error';
    }
  }
  onMount(load);

  // ── formatting ──
  $: cur = data?.statement.currency ?? 'USD';
  const fmt = (n: number, c = cur, d = 2) => {
    try { return new Intl.NumberFormat('en-US', { style: 'currency', currency: c, minimumFractionDigits: d, maximumFractionDigits: d }).format(n ?? 0); } catch { return `${c} ${(n ?? 0).toFixed(d)}`; }
  };
  const day = (iso: string | null) => {
    if (!iso) return '—';
    const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso}T12:00:00Z` : iso);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };
  const monthName = (k: string) => {
    if (!/^\d{4}-\d{2}$/.test(k)) return k;
    const [y, m] = k.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, 15)).toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  };
  const STAGE: Record<Stage, string> = { lead: 'Talking to us', quoted: 'Got a quote', accepted: 'Said yes', paid: 'Bought', dropped: 'Did not buy' };
  $: plan = (() => {
    const c = data?.partner.commission;
    if (!c) return '';
    if (c.model === 'percent_cash') return `${c.rate}% of everything your clients pay`;
    if (c.model === 'percent_margin') return `${c.rate}% of our margin on your clients`;
    if (c.model === 'flat_per_sale') return `${fmt(c.flat ?? 0, cur, 0)} for every client who buys`;
    return `${fmt(c.flat ?? 0, cur, 0)} a month for ${c.months || 12} months per client`;
  })();
  $: L = data?.statement.lifetime;
  $: sinceYear = (data?.statement.since || data?.statement.firstLeadAt || '').slice(0, 4);

  // ── copy ──
  let copied = '';
  async function copy(text: string, id: string) {
    try { await navigator.clipboard.writeText(text); copied = id; setTimeout(() => (copied = ''), 1800); } catch { /* ignore */ }
  }

  // ── bank / profile ──
  let bank: Record<string, string> = {};
  let phone = '';
  let monthlyReport = true;
  let accept = false;
  let saving = false;
  let saved = '';
  async function saveBank() {
    saving = true; saved = '';
    try {
      const res = await fetch(`${API}/api/partner-portal/${encodeURIComponent(token)}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bank, phone, monthlyReport, acceptTerms: accept || undefined }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || 'Could not save.');
      saved = 'Saved. Thank you!';
      await load();
      tab = 'overview';
    } catch (e: any) {
      saved = e?.message ?? 'Could not save.';
    } finally {
      saving = false;
    }
  }

  // ── new link ──
  let newLink = { product: 'irp', label: '', destination: '' };
  let linkMsg = '';
  async function makeLink() {
    linkMsg = '';
    if (!newLink.label.trim()) { linkMsg = 'Give it a name, e.g. "YouTube description".'; return; }
    const res = await fetch(`${API}/api/partner-portal/${encodeURIComponent(token)}/links`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...newLink, campaign: newLink.label }),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) { linkMsg = body?.error || 'Could not create the link.'; return; }
    if (data) data = { ...data, links: [...data.links, body.link] };
    copy(body.link.url, body.link.id);
    newLink = { product: newLink.product, label: '', destination: '' };
  }
</script>

<svelte:head>
  <title>Partner page · International Relocation Partner</title>
  <meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="pp">
  <header class="pp__top">
    <img src="/IRP-LOGO.jpg" alt="IRP" height="34" />
    <span>Partner Program</span>
  </header>

  {#if state === 'loading'}
    <div class="pp__card center">Loading your statement…</div>
  {:else if state === 'error'}
    <div class="pp__card center">
      <h2>We couldn't open this page</h2>
      <p>{errorMsg}</p>
    </div>
  {:else if data && L}
    <section class="hero">
      <div class="hero__eyebrow">Hi {data.partner.name.split(' ')[0]}</div>
      <h1>Since {sinceYear || 'we started'}, you have sent us <em>{L.leads}</em> {L.leads === 1 ? 'client' : 'clients'}{#if L.closed}, and <em>{L.closed}</em> bought{/if}.</h1>
      <p>We have paid you <b>{fmt(L.paid)}</b> in {L.payouts} {L.payouts === 1 ? 'payment' : 'payments'}.{#if L.balance > 0.009} You have <b>{fmt(L.balance)}</b> earned and on its way.{/if}</p>
      <p class="hero__plan">Your commission: {plan}.</p>
    </section>

    <section class="stats">
      <div><span>Link visits</span><b>{L.clicks}</b></div>
      <div><span>Clients referred</span><b>{L.leads}</b></div>
      <div><span>Bought</span><b>{L.closed}</b></div>
      <div><span>Earned</span><b>{fmt(L.earned, cur, 0)}</b></div>
      <div><span>Paid to you</span><b>{fmt(L.paid, cur, 0)}</b></div>
      <div class="hl"><span>Owed to you</span><b>{fmt(L.balance, cur, 0)}</b></div>
    </section>
    {#if L.pipeline > 0.5}<p class="muted center">Plus about {fmt(L.pipeline, cur, 0)} more as your clients finish paying.</p>{/if}

    <nav class="tabs">
      {#each [['overview', 'By month'], ['clients', 'Your clients'], ['payments', 'Payments'], ['links', 'Your links'], ['bank', data.bank.updatedAt ? 'Bank details' : 'Add bank details']] as [k, label]}
        <button class:active={tab === k} class:attn={k === 'bank' && !data.bank.updatedAt} on:click={() => (tab = k as typeof tab)}>{label}</button>
      {/each}
    </nav>

    <section class="pp__card">
      {#if tab === 'overview'}
        {#if data.statement.years.length}
          <table>
            <thead><tr><th>Year</th><th class="num">Referred</th><th class="num">Bought</th><th class="num">Earned</th><th class="num">Paid</th></tr></thead>
            <tbody>{#each data.statement.years as y}<tr><td><b>{y.key}</b></td><td class="num">{y.leads}</td><td class="num">{y.closed}</td><td class="num">{fmt(y.earned)}</td><td class="num">{fmt(y.paid)}</td></tr>{/each}</tbody>
          </table>
          <table class="mt">
            <thead><tr><th>Month</th><th class="num">Referred</th><th class="num">Bought</th><th class="num">Earned</th><th class="num">Paid</th></tr></thead>
            <tbody>{#each data.statement.months.slice(0, 24) as m}<tr><td>{monthName(m.key)}</td><td class="num">{m.leads}</td><td class="num">{m.closed}</td><td class="num">{fmt(m.earned)}</td><td class="num">{m.paid ? fmt(m.paid) : '—'}</td></tr>{/each}</tbody>
          </table>
        {:else}
          <p class="muted">Nothing yet. Share your link and every person who reaches us through it shows up here.</p>
        {/if}

      {:else if tab === 'clients'}
        <p class="muted small">Initials only, to protect your clients' privacy.</p>
        <table>
          <thead><tr><th>Client</th><th>Since</th><th>Status</th><th class="num">Your commission</th></tr></thead>
          <tbody>
            {#each data.statement.referrals as r (r.dealKey)}
              <tr class:dim={r.voided || r.stage === 'dropped'}>
                <td><b>{r.clientLabel}</b>{#if r.product !== 'irp'}<span class="tag">{r.product}</span>{/if}</td>
                <td>{day(r.leadAt)}</td>
                <td><span class="stage stage--{r.stage}">{STAGE[r.stage]}</span></td>
                <td class="num">{fmt(r.earned, r.currency)}{#if r.projected > r.earned + 0.5}<div class="muted small">up to {fmt(r.projected, r.currency, 0)}</div>{/if}</td>
              </tr>
            {:else}<tr><td colspan="4" class="muted">No clients yet.</td></tr>{/each}
          </tbody>
        </table>

      {:else if tab === 'payments'}
        <table>
          <thead><tr><th>Date</th><th class="num">Amount</th><th>Method</th><th>Reference</th></tr></thead>
          <tbody>
            {#each data.statement.payouts as p (p.id)}
              <tr><td>{day(p.date)}</td><td class="num"><b>{fmt(p.amount, p.currency)}</b></td><td>{p.method}</td><td class="small">{p.reference}</td></tr>
            {:else}<tr><td colspan="4" class="muted">No payments yet.</td></tr>{/each}
          </tbody>
          {#if data.statement.payouts.length}<tfoot><tr><td>Total</td><td class="num"><b>{fmt(L.paid)}</b></td><td colspan="2"></td></tr></tfoot>{/if}
        </table>

      {:else if tab === 'links'}
        <p class="muted small">Every link credits you. Make one per place you share it to see which works best.</p>
        {#each data.links as l (l.id)}
          <div class="link">
            <div class="link__top"><b>{l.label}</b><button class="btn btn--small" on:click={() => copy(l.url, l.id)}>{copied === l.id ? 'Copied ✓' : 'Copy'}</button></div>
            <div class="url">{l.url}</div>
          </div>
        {/each}
        <div class="newlink">
          <div class="grid">
            <label>Name<input bind:value={newLink.label} placeholder="Instagram bio" /></label>
            <label>Site
              <select bind:value={newLink.product}>{#each data.products as p}<option value={p.id}>{p.label}</option>{/each}</select>
            </label>
            <label class="span">Page <span class="muted">(optional)</span><input bind:value={newLink.destination} placeholder={data.products.find((p) => p.id === newLink.product)?.baseUrl} /></label>
          </div>
          {#if linkMsg}<p class="err">{linkMsg}</p>{/if}
          <button class="btn" on:click={makeLink}>Create my link</button>
        </div>

      {:else if tab === 'bank'}
        <form on:submit|preventDefault={saveBank}>
          <p class="muted small">Where we send your commission. Saved numbers are shown masked; leave them as they are to keep them.</p>
          <div class="grid">
            <label>Preferred method
              <select bind:value={bank.preferredMethod}>
                <option value="wire">Bank wire</option><option value="sinpe">SINPE (Costa Rica)</option><option value="paypal">PayPal</option><option value="zelle">Zelle</option><option value="other">Other</option>
              </select>
            </label>
            <label>Account holder name<input bind:value={bank.holderName} autocomplete="name" /></label>
            <label>Bank<input bind:value={bank.bankName} /></label>
            <label>Country<input bind:value={bank.country} autocomplete="country-name" /></label>
            <label>Account number<input bind:value={bank.accountNumber} /></label>
            <label>IBAN<input bind:value={bank.iban} /></label>
            <label>SWIFT / BIC<input bind:value={bank.swift} /></label>
            <label>Routing number (US)<input bind:value={bank.routingNumber} /></label>
            <label>PayPal / Zelle email<input type="email" bind:value={bank.paypalEmail} /></label>
            <label>Phone / WhatsApp<input bind:value={phone} autocomplete="tel" /></label>
            <label class="span">Anything else we need to know<textarea rows="2" bind:value={bank.notes}></textarea></label>
          </div>
          <label class="chk"><input type="checkbox" bind:checked={monthlyReport} /> Email me my statement every month</label>
          {#if !data.partner.termsAcceptedAt}
            <label class="chk"><input type="checkbox" bind:checked={accept} /> I agree to the commission above and to IRP crediting me only for clients who arrive through my links or whom IRP confirms I referred.</label>
          {/if}
          {#if saved}<p class="ok">{saved}</p>{/if}
          <button class="btn" type="submit" disabled={saving || (!data.partner.termsAcceptedAt && !accept)}>{saving ? 'Saving…' : 'Save'}</button>
        </form>
      {/if}
    </section>
    <p class="foot">Questions about a commission? Reply to your statement email or write to luisarmando@internationalrelocationpartner.com.</p>
  {/if}
</div>

<style>
  :global(body) { background: #f4f6f8; }
  .pp { max-width: 860px; margin: 0 auto; padding: 1.25rem 1rem 3rem; font-family: var(--font-paragraph, 'Jost'), system-ui, sans-serif; color: #0f172a; }
  .pp__top { display: flex; align-items: center; gap: 0.6rem; margin-bottom: 1.5rem; }
  .pp__top img { border-radius: 6px; }
  .pp__top span { font-size: 0.78rem; letter-spacing: .08em; text-transform: uppercase; font-weight: 700; color: #02b5bb; }
  .pp__card { background: #fff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 1.1rem 1.2rem; box-shadow: 0 1px 3px rgba(0,0,0,.04); }
  .center { text-align: center; }
  .hero { background: linear-gradient(135deg, #0e7490 0%, #02b5bb 100%); color: #fff; border-radius: 16px; padding: 1.5rem 1.6rem; }
  .hero__eyebrow { font-size: 0.8rem; text-transform: uppercase; letter-spacing: .08em; opacity: .85; font-weight: 700; }
  .hero h1 { font-size: clamp(1.3rem, 3.4vw, 1.9rem); line-height: 1.25; margin: 0.35rem 0 0.6rem; font-weight: 600; }
  .hero em { font-style: normal; font-weight: 800; }
  .hero p { margin: 0.2rem 0; font-size: 1.02rem; }
  .hero__plan { opacity: .85; font-size: 0.9rem !important; margin-top: 0.6rem !important; }
  .stats { display: grid; grid-template-columns: repeat(6, 1fr); gap: 0.55rem; margin: 1rem 0 0.5rem; }
  .stats div { background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 0.65rem 0.7rem; display: flex; flex-direction: column; }
  .stats span { font-size: 0.72rem; color: #64748b; font-weight: 600; }
  .stats b { font-size: 1.15rem; font-variant-numeric: tabular-nums; }
  .stats .hl { border-color: #02b5bb; }
  .tabs { display: flex; gap: 0.3rem; margin: 1rem 0 0.6rem; overflow-x: auto; }
  .tabs button { border: 1px solid #e2e8f0; background: #fff; border-radius: 999px; padding: 0.45rem 0.95rem; font: inherit; font-weight: 600; font-size: 0.85rem; color: #475569; cursor: pointer; white-space: nowrap; }
  .tabs button.active { background: #0f172a; color: #fff; border-color: #0f172a; }
  .tabs button.attn:not(.active) { border-color: #f59e0b; color: #92400e; }
  table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
  th { text-align: left; font-size: 0.72rem; text-transform: uppercase; letter-spacing: .04em; color: #64748b; padding: 0.45rem 0.5rem; border-bottom: 1px solid #e2e8f0; }
  td { padding: 0.55rem 0.5rem; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
  tfoot td { border-bottom: none; font-weight: 700; }
  .num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .mt { margin-top: 1.2rem; }
  .dim { opacity: .55; }
  .muted { color: #64748b; }
  .small { font-size: 0.8rem; }
  .tag { font-size: 0.68rem; font-weight: 700; text-transform: uppercase; background: #f1f5f9; padding: 1px 6px; border-radius: 999px; margin-left: 6px; }
  .stage { font-size: 0.75rem; font-weight: 700; padding: 2px 8px; border-radius: 999px; background: #f1f5f9; color: #475569; white-space: nowrap; }
  .stage--paid { background: #dcfce7; color: #166534; }
  .stage--accepted { background: #e0f2fe; color: #075985; }
  .stage--quoted { background: #ede9fe; color: #5b21b6; }
  .stage--dropped { background: #fee2e2; color: #991b1b; }
  .link { border: 1px solid #e2e8f0; border-radius: 10px; padding: 0.7rem 0.8rem; margin-bottom: 0.6rem; }
  .link__top { display: flex; justify-content: space-between; align-items: center; }
  .url { font-family: ui-monospace, monospace; font-size: 0.78rem; background: #f1f5f9; border-radius: 6px; padding: 0.45rem 0.6rem; margin-top: 0.45rem; word-break: break-all; }
  .newlink { border-top: 1px solid #e2e8f0; margin-top: 1rem; padding-top: 1rem; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.65rem; margin-bottom: 0.8rem; }
  .span { grid-column: span 2; }
  label { display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.8rem; font-weight: 600; color: #334155; }
  label.chk { flex-direction: row; align-items: flex-start; gap: 0.5rem; font-weight: 500; margin: 0.5rem 0; }
  input:not([type='checkbox']), select, textarea { border: 1px solid #cbd5e1; border-radius: 8px; padding: 0.55rem 0.65rem; font: inherit; font-size: 0.92rem; font-weight: 400; background: #fff; }
  input:focus, select:focus, textarea:focus { outline: none; border-color: #02b5bb; box-shadow: 0 0 0 3px rgba(2,181,187,.15); }
  .btn { background: #02b5bb; color: #fff; border: none; border-radius: 8px; padding: 0.6rem 1.2rem; font: inherit; font-weight: 700; cursor: pointer; }
  .btn:disabled { opacity: .5; cursor: default; }
  .btn--small { padding: 0.3rem 0.75rem; font-size: 0.8rem; }
  .ok { color: #166534; font-weight: 600; }
  .err { color: #b91c1c; font-size: 0.85rem; }
  .foot { text-align: center; color: #94a3b8; font-size: 0.8rem; margin-top: 1.5rem; }
  @media (max-width: 680px) { .stats { grid-template-columns: repeat(2, 1fr); } .grid { grid-template-columns: 1fr; } .span { grid-column: auto; } }
</style>
