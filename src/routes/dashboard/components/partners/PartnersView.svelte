<script lang="ts">
  /**
   * PartnersView — the UTM / referral-partner program (Partners tab).
   *
   * One row per influencer, media outlet, expert or teacher: the link they
   * share, how many people clicked, how many became clients, what that earned
   * them and what we have wired them. Everything comes from
   * GET /api/dashboard/partners; commission is computed on the server from the
   * same deals the Sales Report shows, so this view does no money math.
   */
  import { onMount } from 'svelte';
  import {
    partnersReport, fetchPartners, createPartner, attributeClient, copyText,
    money, planLabel, TYPE_LABELS, MODEL_LABELS,
    type Partner, type PartnerType, type CommissionModel,
  } from './partnersApi.ts';
  import PartnerDetail from './PartnerDetail.svelte';
  import { toasts } from '../../toastStore.ts';
  import { onViewShown, REVALIDATE_AFTER_MS } from '../../utils/viewLifecycle.ts';

  let loading = false;
  let errorMsg = '';
  let loadedAt = 0;
  let query = '';
  let statusFilter: 'live' | 'all' = 'live';
  let openId: string | null = null;
  let dismissed = new Set<string>();

  async function load(fresh = false) {
    loading = true;
    errorMsg = '';
    try {
      await fetchPartners(fresh);
      loadedAt = Date.now();
    } catch (e: any) {
      errorMsg = e?.message ?? 'Could not load partners.';
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    if (!$partnersReport) load();
    else loadedAt = Date.now();
    try { dismissed = new Set(JSON.parse(localStorage.getItem('irpPartnerSuggestionsDismissed') || '[]')); } catch { /* storage blocked */ }
  });
  onViewShown('partners', () => {
    if (Date.now() - loadedAt > REVALIDATE_AFTER_MS) load();
  });

  $: report = $partnersReport;
  $: t = report?.totals;
  $: year = new Date().getFullYear();
  $: rows = (report?.partners ?? [])
    .filter((p) => statusFilter === 'all' || p.status !== 'archived')
    .filter((p) => {
      const q = query.trim().toLowerCase();
      if (!q) return true;
      return [p.name, p.code, p.email, p.type].some((v) => String(v ?? '').toLowerCase().includes(q));
    })
    .sort((a, b) => (b.statement?.lifetime.balance ?? 0) - (a.statement?.lifetime.balance ?? 0) || (b.statement?.lifetime.leads ?? 0) - (a.statement?.lifetime.leads ?? 0));
  $: openPartner = openId ? report?.partners.find((p) => p.id === openId) ?? null : null;
  $: suggestions = (report?.suggestions ?? []).filter((s) => !dismissed.has(s.consultationId));
  $: partnerName = (id: string) => report?.partners.find((p) => p.id === id)?.name ?? id;

  // ── New partner ──
  let showNew = false;
  let saving = false;
  let form = blankForm();
  function blankForm() {
    return {
      name: '', email: '', phone: '', type: 'influencer' as PartnerType, code: '',
      model: 'percent_cash' as CommissionModel, rate: 10, flat: 30, months: 12,
      product: 'irp', destination: '', notes: '', since: '',
    };
  }

  async function submitNew() {
    if (!form.name.trim()) return;
    saving = true;
    try {
      const commission = form.model.startsWith('percent')
        ? { model: form.model, rate: Number(form.rate) }
        : { model: form.model, flat: Number(form.flat), months: Number(form.months) };
      const res = await createPartner({
        name: form.name, email: form.email, phone: form.phone, type: form.type, code: form.code || undefined,
        commission, product: form.product, destination: form.destination || undefined, notes: form.notes,
        since: form.since || undefined,
      });
      toasts.success(`${form.name} added. Their link is ready to copy.`);
      showNew = false;
      form = blankForm();
      await load();
      openId = res?.partner?.id ?? null;
    } catch (e: any) {
      toasts.error(e?.message ?? 'Could not create the partner.');
    } finally {
      saving = false;
    }
  }

  async function copyMain(p: Partner) {
    const link = p.links.find((l) => !l.archived);
    if (!link) return toasts.error('This partner has no active link yet.');
    if (await copyText(link.url)) toasts.success('Link copied');
  }

  async function acceptSuggestion(s: { consultationId: string; partnerId: string }) {
    try {
      await attributeClient({ consultationId: s.consultationId, partnerId: s.partnerId, note: 'Confirmed from "Referred by"' });
      toasts.success(`Credited to ${partnerName(s.partnerId)}`);
      await load();
    } catch (e: any) {
      toasts.error(e?.message ?? 'Could not credit the client.');
    }
  }
  function dismissSuggestion(cid: string) {
    dismissed = new Set([...dismissed, cid]);
    try { localStorage.setItem('irpPartnerSuggestionsDismissed', JSON.stringify([...dismissed])); } catch { /* ignore */ }
  }

  const STATUS_TONE: Record<string, string> = { active: 'ok', invited: 'warn', paused: 'muted', archived: 'muted' };
</script>

<div class="pv">
  <header class="pv__head">
    <div>
      <h2>Partners</h2>
      <p class="pv__sub">Tagged links for influencers, media and experts. Every client they bring, what it earned them, and what we have paid.</p>
    </div>
    <div class="pv__actions">
      <button class="btn btn--ghost" on:click={() => load(true)} disabled={loading}>{loading ? 'Loading…' : 'Refresh'}</button>
      <button class="btn btn--primary" on:click={() => (showNew = true)}>+ New partner</button>
    </div>
  </header>

  {#if errorMsg}<div class="pv__error">{errorMsg} <button class="link" on:click={() => load(true)}>Retry</button></div>{/if}

  {#if !report && loading}
    <div class="pv__empty">Reading clients, quotes and payments…</div>
  {:else if report}
    <section class="kpis">
      <div class="kpi"><span>Active partners</span><b>{t?.partners ?? 0}</b></div>
      <div class="kpi"><span>Referrals {year}</span><b>{t?.yearLeads ?? 0}</b><small>{t?.monthLeads ?? 0} this month</small></div>
      <div class="kpi"><span>Closed {year}</span><b>{t?.yearClosed ?? 0}</b><small>{t?.closed ?? 0} all time</small></div>
      <div class="kpi"><span>Commission earned {year}</span><b>{money(t?.yearEarned)}</b><small>{money(t?.earned)} all time</small></div>
      <div class="kpi"><span>Paid out {year}</span><b>{money(t?.yearPaid)}</b><small>{money(t?.paid)} all time</small></div>
      <div class="kpi kpi--accent"><span>Owed now</span><b>{money(t?.balance)}</b><small>{money(t?.pipeline)} more in pipeline</small></div>
    </section>

    {#if suggestions.length}
      <section class="card sugg">
        <div class="card__title">Clients who named a partner but came without a link</div>
        <p class="muted">They typed it in "How did you hear about us". Credit them if it is right.</p>
        {#each suggestions.slice(0, 8) as s (s.consultationId)}
          <div class="sugg__row">
            <span><b>{s.clientName}</b> wrote “{s.referredBy}”</span>
            <span class="sugg__btns">
              <button class="btn btn--small btn--primary" on:click={() => acceptSuggestion(s)}>Credit to {partnerName(s.partnerId)}</button>
              <button class="btn btn--small btn--ghost" on:click={() => dismissSuggestion(s.consultationId)}>Not them</button>
            </span>
          </div>
        {/each}
      </section>
    {/if}

    <section class="card">
      <div class="toolbar">
        <input class="input" placeholder="Search partners…" bind:value={query} />
        <label class="muted small"><input type="checkbox" checked={statusFilter === 'all'} on:change={(e) => (statusFilter = e.currentTarget.checked ? 'all' : 'live')} /> Show archived</label>
      </div>

      {#if rows.length === 0}
        <div class="pv__empty">
          {#if (report.partners ?? []).length === 0}
            No partners yet. Add the first one: they get a link to share, a private page with their numbers, and a monthly statement by email.
          {:else}No partner matches.{/if}
        </div>
      {:else}
        <div class="table-wrap">
          <table class="tbl">
            <thead>
              <tr>
                <th>Partner</th><th>Plan</th><th class="num">Clicks</th><th class="num">Referrals</th><th class="num">Closed</th>
                <th class="num">Earned</th><th class="num">Paid</th><th class="num">Owed</th><th>Status</th><th></th>
              </tr>
            </thead>
            <tbody>
              {#each rows as p (p.id)}
                {@const L = p.statement?.lifetime}
                <tr class="row" on:click={() => (openId = p.id)}>
                  <td>
                    <div class="who"><b>{p.name}</b><span class="muted small">{TYPE_LABELS[p.type] ?? p.type} · <code>{p.code}</code></span></div>
                  </td>
                  <td class="small">{planLabel(p.commission, p.currency ?? 'USD')}</td>
                  <td class="num">{L?.clicks ?? 0}</td>
                  <td class="num">{L?.leads ?? 0}</td>
                  <td class="num">{L?.closed ?? 0}</td>
                  <td class="num">{money(L?.earned, p.statement?.currency)}</td>
                  <td class="num">{money(L?.paid, p.statement?.currency)}</td>
                  <td class="num"><b class:owed={(L?.balance ?? 0) > 0.5}>{money(L?.balance, p.statement?.currency)}</b></td>
                  <td><span class="pill pill--{STATUS_TONE[p.status] ?? 'muted'}">{p.status}</span>{#if !p.bankDetails?.updatedAt && p.status !== 'archived'}<span class="pill pill--warn" title="No bank details yet">no bank</span>{/if}</td>
                  <td><button class="btn btn--small btn--ghost" on:click|stopPropagation={() => copyMain(p)}>Copy link</button></td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </section>
  {/if}
</div>

{#if openPartner && report}
  <PartnerDetail partner={openPartner} {report} on:close={() => (openId = null)} on:changed={() => load()} />
{/if}

{#if showNew}
  <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
  <div class="overlay" on:click|self={() => (showNew = false)}>
    <form class="modal" on:submit|preventDefault={submitNew}>
      <h3>New partner</h3>
      <div class="grid2">
        <label>Name<input class="input" bind:value={form.name} required placeholder="Sara Lena" /></label>
        <label>Email<input class="input" type="email" bind:value={form.email} placeholder="For their link and monthly statement" /></label>
        <label>Type
          <select class="input" bind:value={form.type}>
            {#each Object.entries(TYPE_LABELS) as [k, v]}<option value={k}>{v}</option>{/each}
          </select>
        </label>
        <label>Code <span class="muted small">(optional — becomes ?refer=)</span><input class="input" bind:value={form.code} placeholder="auto from name" /></label>
        <label>Commission
          <select class="input" bind:value={form.model}>
            {#each Object.entries(MODEL_LABELS) as [k, v]}<option value={k}>{v}</option>{/each}
          </select>
        </label>
        {#if form.model.startsWith('percent')}
          <label>Rate %<input class="input" type="number" min="0" max="100" step="0.5" bind:value={form.rate} /></label>
        {:else}
          <label>Amount (USD)<input class="input" type="number" min="0" step="1" bind:value={form.flat} /></label>
          {#if form.model === 'monthly_recurring'}
            <label>For how many months<input class="input" type="number" min="1" max="120" bind:value={form.months} /></label>
          {/if}
        {/if}
        <label>First link goes to
          <select class="input" bind:value={form.product}>
            {#each Object.entries(report?.products ?? {}) as [k, v]}<option value={k}>{v.label}</option>{/each}
          </select>
        </label>
        <label>Landing page <span class="muted small">(optional)</span><input class="input" bind:value={form.destination} placeholder={report?.products?.[form.product]?.baseUrl || 'https://…'} /></label>
        <label>Relationship since <span class="muted small">(back-date for old partners)</span><input class="input" type="date" bind:value={form.since} /></label>
      </div>
      <label>Notes<textarea class="input" rows="2" bind:value={form.notes} placeholder="How we met, what we agreed…"></textarea></label>
      <div class="modal__foot">
        <button type="button" class="btn btn--ghost" on:click={() => (showNew = false)}>Cancel</button>
        <button type="submit" class="btn btn--primary" disabled={saving || !form.name.trim()}>{saving ? 'Creating…' : 'Create partner'}</button>
      </div>
    </form>
  </div>
{/if}

<style>
  .pv { font-family: var(--font-paragraph, 'Jost'), system-ui, sans-serif; color: var(--irp-text, #181818); padding: 1.25rem 1.5rem 3rem; max-width: 1400px; margin: 0 auto; }
  .pv__head { display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; margin-bottom: 1.1rem; flex-wrap: wrap; }
  .pv__head h2 { margin: 0; font-size: 1.35rem; }
  .pv__sub { margin: 0.25rem 0 0; color: #64748b; font-size: 0.9rem; max-width: 640px; }
  .pv__actions { display: flex; gap: 0.5rem; }
  .pv__error { background: #fef2f2; border: 1px solid #fecaca; color: #b91c1c; padding: 0.6rem 0.9rem; border-radius: 8px; margin-bottom: 1rem; }
  .pv__empty { padding: 2rem 1rem; text-align: center; color: #64748b; }

  .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 0.75rem; margin-bottom: 1rem; }
  .kpi { background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 0.8rem 0.95rem; display: flex; flex-direction: column; gap: 2px; box-shadow: 0 1px 3px rgba(0,0,0,.04); }
  .kpi span { font-size: 0.75rem; color: #64748b; font-weight: 600; }
  .kpi b { font-size: 1.35rem; font-variant-numeric: tabular-nums; }
  .kpi small { font-size: 0.75rem; color: #94a3b8; }
  .kpi--accent { border-color: rgba(2,181,187,.45); background: linear-gradient(135deg, rgba(2,181,187,.07), #fff); }

  .card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 1rem; margin-bottom: 1rem; box-shadow: 0 1px 3px rgba(0,0,0,.04); }
  .card__title { font-weight: 700; margin-bottom: 0.2rem; }
  .sugg { border-color: #fde68a; background: #fffbeb; }
  .sugg__row { display: flex; justify-content: space-between; align-items: center; gap: 0.75rem; padding: 0.45rem 0; border-top: 1px solid #fef3c7; flex-wrap: wrap; }
  .sugg__btns { display: flex; gap: 0.4rem; }

  .toolbar { display: flex; gap: 0.75rem; align-items: center; margin-bottom: 0.75rem; }
  .toolbar .input { max-width: 280px; }
  .table-wrap { overflow-x: auto; }
  .tbl { width: 100%; border-collapse: collapse; font-size: 0.88rem; }
  .tbl th { text-align: left; font-size: 0.72rem; text-transform: uppercase; letter-spacing: .04em; color: #64748b; padding: 0.5rem 0.6rem; border-bottom: 1px solid #e2e8f0; white-space: nowrap; }
  .tbl td { padding: 0.6rem; border-bottom: 1px solid #f1f5f9; vertical-align: middle; }
  .tbl .num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .row { cursor: pointer; transition: background .12s; }
  .row:hover { background: #f8fafc; }
  .who { display: flex; flex-direction: column; }
  .owed { color: #0e7490; }
  code { font-size: 0.8em; background: #f1f5f9; padding: 0 4px; border-radius: 4px; }

  .pill { display: inline-block; font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: .03em; padding: 2px 8px; border-radius: 999px; margin-right: 4px; }
  .pill--ok { background: #dcfce7; color: #166534; }
  .pill--warn { background: #fef3c7; color: #92400e; }
  .pill--muted { background: #f1f5f9; color: #64748b; }

  .muted { color: #64748b; }
  .small { font-size: 0.8rem; }
  .input { width: 100%; box-sizing: border-box; border: 1px solid #cbd5e1; border-radius: 8px; padding: 0.5rem 0.65rem; font: inherit; font-size: 0.9rem; background: #fff; }
  .input:focus { outline: none; border-color: #02b5bb; box-shadow: 0 0 0 3px rgba(2,181,187,.15); }
  .btn { border: 1px solid transparent; border-radius: 8px; padding: 0.5rem 1rem; font: inherit; font-weight: 600; font-size: 0.86rem; cursor: pointer; }
  .btn:disabled { opacity: .55; cursor: default; }
  .btn--primary { background: #02b5bb; color: #fff; }
  .btn--primary:hover:not(:disabled) { background: #029aa0; }
  .btn--ghost { background: #fff; border-color: #e2e8f0; color: #334155; }
  .btn--ghost:hover:not(:disabled) { background: #f8fafc; }
  .btn--small { padding: 0.3rem 0.65rem; font-size: 0.78rem; }
  .link { background: none; border: none; color: inherit; text-decoration: underline; cursor: pointer; font: inherit; }

  .overlay { position: fixed; inset: 0; background: rgba(15,23,42,.45); display: flex; align-items: flex-start; justify-content: center; z-index: 1000; padding: 5vh 1rem; overflow-y: auto; }
  .modal { background: #fff; border-radius: 14px; padding: 1.25rem 1.4rem; width: 100%; max-width: 640px; display: flex; flex-direction: column; gap: 0.8rem; box-shadow: 0 20px 50px rgba(0,0,0,.2); }
  .modal h3 { margin: 0; }
  .modal label { display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.8rem; font-weight: 600; color: #334155; }
  .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 0.7rem; }
  .modal__foot { display: flex; justify-content: flex-end; gap: 0.5rem; }
  @media (max-width: 640px) { .grid2 { grid-template-columns: 1fr; } .pv { padding: 1rem; } }
</style>
