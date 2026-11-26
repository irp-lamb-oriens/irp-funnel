<!--
  EvoView.svelte — Evo Lab (spec: irp-funnel-server/docs/designs/evo-lab.md §7).

  Loads the Evo cube and the Metrics Hub lead cube, builds the lab ONCE on all
  data (decision states always come from here) and, when a period or audience
  filter is active, once more on the subset for the numbers shown. Sections:

    Health strip → Pulse → Decisions waiting → Experiments (portfolio +
    detail) → Combinations → Audiences → Ask Evo → Decisions log →
    Operations (collapsed)
-->
<script lang="ts">
  import { tabs } from '../../utils/a11yTabs.ts';
  import { onDestroy, onMount, tick } from 'svelte';
  import { activeView, authEmail, evoRefresh, fetchClientDetail, fetchEvoDecisions, fetchMetricsCube, streamEvoCube, type EvoBuildProgress } from '../../store.ts';
  import StreamAssembly, { type AssemblyStep } from '../ui/StreamAssembly.svelte';
  import { ADMIN_EMAILS } from '../../access.ts';
  import { onViewShown, REVALIDATE_AFTER_MS } from '../../utils/viewLifecycle.ts';
  import { requestAge } from '../../utils/requestCache.ts';
  import { hubCube } from '../metrics/hub/hubState.ts';
  import { METRICS_CUBE_SCHEMA_VERSION, type LeadFact, type MetricsCube } from '../metrics/engine/types.ts';
  import { EVO_CUBE_SCHEMA_VERSION, type EvoCube, type Exclusion } from './engine/types.ts';
  import { buildLab, type Lab } from './engine/lab.ts';
  import { ALL_EXCLUSIONS, crDayStart } from './engine/join.ts';
  import { PRE_DIMS } from './engine/audiences.ts';
  import { addFilter, canUndo, clearFilters, decodeFilters, encodeFilters, labFilters, removeFilter, undo, type DetailTab, type LabView } from './lab/labState.ts';
  import HealthStrip from './lab/HealthStrip.svelte';
  import LabPulse from './lab/LabPulse.svelte';
  import DecisionsWaiting from './lab/DecisionsWaiting.svelte';
  import Portfolio from './lab/Portfolio.svelte';
  import ExperimentDetail from './lab/ExperimentDetail.svelte';
  import Combinations from './lab/Combinations.svelte';
  import Audiences from './lab/Audiences.svelte';
  import AskEvo from './lab/AskEvo.svelte';
  import DecisionsLog from './lab/DecisionsLog.svelte';
  import RecordDecision from './lab/RecordDecision.svelte';
  import Operations from './lab/Operations.svelte';
  import type { ExperimentAnalysis } from './engine/experiment.ts';

  /** Dev-only fixture data (`?fixture=evo`), used by Playwright and design review. */
  export let fixture: { cube: EvoCube; leads: LeadFact[] } | null = null;

  const VIEWS: Array<{ key: LabView; label: string }> = [
    { key: 'leadership', label: 'Leadership' },
    { key: 'sales', label: 'Sales' },
    { key: 'finance', label: 'Finance' },
    { key: 'marketing', label: 'Marketing' },
  ];
  const PERIODS = [
    { key: 'all', label: 'Since each test started' },
    { key: '7', label: 'Assigned in the last 7 days' },
    { key: '30', label: 'Assigned in the last 30 days' },
    { key: '90', label: 'Assigned in the last 90 days' },
  ];
  const WINDOWS = [7, 14, 30, 60];
  const SURFACES: Array<{ k: 'all' | 'web' | 'chat' | 'email'; l: string }> = [
    { k: 'all', l: 'All' }, { k: 'web', l: 'Web' }, { k: 'chat', l: 'Chat' }, { k: 'email', l: 'Email' },
  ];
  const EXCL_LABEL: Record<Exclusion, string> = { forced: 'Dev overrides', legacy: 'Pre-restart visitors', dev: 'Dev / localhost', bot: 'Bots', test: 'Test leads' };
  const SECTIONS = [
    { id: 'evo-decisions', label: 'Decisions' },
    { id: 'evo-experiments', label: 'Experiments' },
    { id: 'evo-combos', label: 'Combinations' },
    { id: 'evo-audiences', label: 'Audiences' },
    { id: 'evo-ask', label: 'Ask Evo' },
    { id: 'evo-log', label: 'Decisions log' },
    { id: 'evo-ops', label: 'Operations' },
  ];

  let view: LabView = 'leadership';
  let period = 'all';
  let windowDays = 30;
  let surface: 'all' | 'web' | 'chat' | 'email' = 'all';
  let status: 'running' | 'ended' | 'all' = 'running';
  let included: Exclusion[] = [];
  let selected = '';
  let tab: DetailTab = 'scorecard';
  let currency = 'USD';

  let evo: EvoCube | null = null;
  let leadRows: LeadFact[] = [];

  // ── First-load assembly screen (server build steps + the lead data) ───────
  const BUILD_STEPS: AssemblyStep[] = [
    { key: 'events', label: 'Reading visitor activity', unit: 'events', state: 'waiting' },
    { key: 'identities', label: 'Linking visitors to people', unit: 'visitors', state: 'waiting' },
    { key: 'leads', label: 'Joining leads and deals', unit: 'clients', state: 'waiting' },
    { key: 'drip', label: 'Reading email experiments', unit: 'emails', state: 'waiting' },
    { key: 'money', label: 'Loading money from the Sales Report', unit: 'leads', state: 'waiting' },
    { key: 'build', label: 'Putting the experiments together', unit: 'visitors', state: 'waiting' },
  ];
  let buildSteps: AssemblyStep[] = BUILD_STEPS;
  function markStep(p: { step: string; state: AssemblyStep['state']; count?: number }) {
    buildSteps = buildSteps.map((s) => (s.key === p.step ? { ...s, state: p.state, count: p.count ?? s.count } : s));
  }
  /** True for a moment after the data lands, so the sections cascade in once. */
  let assembling = false;
  function playAssembly() {
    assembling = true;
    setTimeout(() => (assembling = false), 1600);
  }
  let metricsError = '';
  let loading = false;
  let error = '';
  let ready = false;
  let decisions: any[] = [];
  let recordFor: ExperimentAnalysis | null = null;
  let opsOpen = false;
  let barH = 0;
  let copied = false;

  $: isAdmin = ADMIN_EMAILS.includes(($authEmail ?? '').toLowerCase());

  // ── URL (ev_*) ────────────────────────────────────────────────────────────
  function readUrl() {
    try {
      const q = new URLSearchParams(window.location.search);
      const p = q.get('ev_p'); if (p && PERIODS.some((x) => x.key === p)) period = p;
      const w = Number(q.get('ev_w')); if (WINDOWS.includes(w)) windowDays = w;
      const s = q.get('ev_s'); if (s === 'web' || s === 'chat' || s === 'email' || s === 'all') surface = s;
      const st = q.get('ev_st'); if (st === 'running' || st === 'ended' || st === 'all') status = st;
      const x = q.get('ev_x'); if (x) selected = x;
      const t = q.get('ev_t') as DetailTab | null; if (t) tab = t;
      const ex = q.get('ev_ex'); if (ex) included = ex.split(',').filter((r): r is Exclusion => (ALL_EXCLUSIONS as string[]).includes(r));
      labFilters.set(decodeFilters(q.get('ev_f')).filter((f) => PRE_DIMS.some((d) => d.key === f.dim)));
    } catch { /* no URL access */ }
    try { const v = localStorage.getItem('irp.evoLab.view') as LabView | null; if (v && VIEWS.some((x) => x.key === v)) view = v; } catch { /* storage blocked */ }
  }
  function writeUrl() {
    if (!ready) return;
    try {
      const q = new URLSearchParams(window.location.search);
      const set = (k: string, v: string, dflt: string) => (v && v !== dflt ? q.set(k, v) : q.delete(k));
      q.set('view', 'evo');
      set('ev_p', period, 'all');
      set('ev_w', String(windowDays), '30');
      set('ev_s', surface, 'all');
      set('ev_st', status, 'running');
      set('ev_x', selected, '');
      set('ev_t', tab, 'scorecard');
      set('ev_ex', included.join(','), '');
      set('ev_f', encodeFilters($labFilters), '');
      history.replaceState(history.state, '', `${window.location.pathname}?${q.toString()}${window.location.hash}`);
    } catch { /* ignore */ }
  }
  $: (period, windowDays, surface, status, selected, tab, included, $labFilters), writeUrl();
  function saveView(v: LabView) { if (!ready) return; try { localStorage.setItem('irp.evoLab.view', v); } catch { /* ignore */ } }
  $: saveView(view);

  // ── Load ─────────────────────────────────────────────────────────────────
  let ticket = 0;
  async function load(fresh = false) {
    if (fixture) { evo = fixture.cube; leadRows = fixture.leads; decisions = []; return; }
    const t = ++ticket;
    loading = true;
    error = '';
    metricsError = '';
    try {
      const firstLoad = !evo;
      if (firstLoad) buildSteps = BUILD_STEPS;
      const onProgress = (p: EvoBuildProgress) => { if (t === ticket) markStep(p); };
      const leadsWork = $hubCube && !fresh ? Promise.resolve($hubCube) : (markStep({ step: 'money', state: 'active' }), fetchMetricsCube({ fresh }) as Promise<MetricsCube>);
      const [e, m] = await Promise.all([
        streamEvoCube({ fresh, onProgress }) as Promise<EvoCube>,
        leadsWork.then(
          (cube) => { markStep({ step: 'money', state: 'done', count: (cube as MetricsCube)?.rows?.length }); return cube; },
          (err) => { markStep({ step: 'money', state: 'failed' }); metricsError = err?.message ?? 'unavailable'; return null; },
        ),
      ]);
      if (t !== ticket) return;
      if (!e || e.schemaVersion !== EVO_CUBE_SCHEMA_VERSION || !Array.isArray(e.visitors)) { error = 'The Evo data format changed. Reload the page.'; return; }
      evo = e;
      if (firstLoad) playAssembly();
      if (m && (m as MetricsCube).schemaVersion === METRICS_CUBE_SCHEMA_VERSION) {
        leadRows = (m as MetricsCube).rows;
        if (!$hubCube) hubCube.set(m as MetricsCube);
      } else if (m) metricsError = 'Lead data format changed.';
      loadDecisions();
    } catch (err: any) {
      if (t === ticket) error = plainLoadError(err?.message);
    } finally {
      if (t === ticket) loading = false;
    }
  }
  /** The browser's own wording for a request that got no answer is "Failed to fetch" (Chrome), "Load failed" (Safari) or "NetworkError…" (Firefox). */
  function plainLoadError(msg: string | undefined): string {
    if (!msg) return 'Could not load Evo data.';
    if (/failed to fetch|load failed|networkerror/i.test(msg)) return "The server didn't answer (it may have timed out or been restarting).";
    return msg;
  }
  async function loadDecisions() {
    if (fixture) return;
    try { const d = (await fetchEvoDecisions()) as { decisions?: any[] }; decisions = d?.decisions ?? []; } catch { decisions = []; }
  }
  // Live updates: reload now if Evo is on screen, otherwise when it is shown.
  let staleWhileHidden = false;
  const unsub = evoRefresh.subscribe((n) => {
    if (!n || !ready) return;
    if ($activeView === 'evo') load(); else staleWhileHidden = true;
  });
  onViewShown('evo', () => {
    writeUrl();
    if (staleWhileHidden || requestAge('evo:cube') > REVALIDATE_AFTER_MS) { staleWhileHidden = false; if (!loading) load(); }
  });
  onDestroy(unsub);

  $: if (fixture && ready) load();

  // ── Derived ──────────────────────────────────────────────────────────────
  $: exclude = ALL_EXCLUSIONS.filter((r) => !included.includes(r));
  $: now = evo ? (fixture ? Date.parse(evo.generatedAt) : Date.now()) : Date.now();
  $: full = evo ? buildLab(evo, leadRows, { now, windowDays, currency, exclude, surface, status }) : null;
  $: subsetActive = period !== 'all' || $labFilters.length > 0;
  $: subCube = evo && subsetActive ? subsetCube(evo, period, $labFilters, now) : null;
  $: shown = subCube ? buildLab(subCube, leadRows, { now, windowDays, currency, exclude, surface, status, forecast: false }) : full;
  $: decisionOf = new Map((full?.analyses ?? []).map((a) => [a.def.componentKey, a]));
  $: if (full && (!selected || !full.analyses.some((a) => a.def.componentKey === selected))) selected = full.analyses[0]?.def.componentKey ?? '';
  $: selectedShown = shown?.analyses.find((a) => a.def.componentKey === selected) ?? null;
  $: selectedFull = decisionOf.get(selected) ?? null;
  $: excludedCounts = countExclusions(evo);
  $: liveText = evo ? `${new Set((shown?.joined ?? []).flatMap((j) => j.units.map((u) => (u.vid >= 0 ? `v${u.vid}` : `d${u.leadId}`)))).size.toLocaleString('en-US')} people · ${shown?.analyses.length ?? 0} experiments${$labFilters.length ? ` · ${$labFilters.length} filter${$labFilters.length === 1 ? '' : 's'}` : ''}` : '';
  $: updated = (() => { if (!evo) return ''; const mins = Math.round((Date.now() - Date.parse(evo.generatedAt)) / 60000); return mins < 1 ? 'just now' : `${mins}m ago`; })();
  $: decidedLabel = full?.analyses[0] ? new Date(full.analyses[0].decidedAt).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'America/Costa_Rica' }) : '';

  function subsetCube(c: EvoCube, p: string, fs: Array<{ dim: string; values: string[] }>, nowMs: number): EvoCube {
    const from = p === 'all' ? -Infinity : crDayStart(new Date(nowMs - Number(p) * 86400_000 - 6 * 3600_000).toISOString().slice(0, 10));
    const okCtx = (ctx: any) => fs.every((f) => f.values.includes(String(ctx?.[f.dim] ?? 'unknown')));
    const visitors = c.visitors
      .filter((v) => okCtx(v.ctx))
      .map((v) => ({ ...v, assign: Object.fromEntries(Object.entries(v.assign).filter(([, a]) => a.t >= from)) }))
      .filter((v) => Object.keys(v.assign).length);
    const drip = fs.length ? [] : c.drip.filter((d) => d.assignedAt >= from);
    return { ...c, visitors, drip };
  }
  function countExclusions(c: EvoCube | null): Record<Exclusion, number> {
    const out = { forced: 0, legacy: 0, dev: 0, bot: 0, test: 0 } as Record<Exclusion, number>;
    if (!c) return out;
    for (const v of c.visitors) {
      const rs = new Set(Object.values(v.assign).flatMap((a) => a.x));
      for (const r of rs) out[r]++;
    }
    for (const d of c.drip) if (d.test) out.test++;
    return out;
  }

  // ── Actions ──────────────────────────────────────────────────────────────
  async function selectExperiment(key: string, t: DetailTab = 'scorecard') {
    selected = key;
    tab = t;
    await tick();
    document.getElementById('evo-detail')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  async function openClient(id: string) {
    try { await fetchClientDetail(id); } catch (err: any) { error = err?.message ?? 'Could not open the client.'; }
  }
  async function openOps() {
    opsOpen = true;
    await tick();
    document.getElementById('evo-ops')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  async function copyLink() {
    try { await navigator.clipboard.writeText(window.location.href); copied = true; setTimeout(() => (copied = false), 1600); } catch { /* ignore */ }
  }
  function toggleExclusion(r: Exclusion) {
    included = included.includes(r) ? included.filter((x) => x !== r) : [...included, r];
  }
  function onRecorded() { recordFor = null; loadDecisions(); }

  onMount(() => {
    readUrl();
    ready = true;
    load();
    writeUrl();
  });
</script>

<div class="mh evo-lab" style="--mh-sticky:{barH}px">
  <header class="mh-head">
    <div>
      <h2>Evo Lab</h2>
      <p>What we're testing, what's winning and what to do next · Costa Rica time{updated ? ` · updated ${updated}` : ''}{decidedLabel ? ` · decisions as of ${decidedLabel}` : ''}</p>
    </div>
    <div class="mh-head__actions">
      <div class="mh-seg" use:tabs={{ mode: 'toggle' }} role="group" aria-label="Headline numbers for">
        {#each VIEWS as v}<button aria-pressed={view === v.key} on:click={() => (view = v.key)}>{v.label}</button>{/each}
      </div>
      <button class="mh-btn" on:click={copyLink}>{copied ? 'Link copied' : 'Copy link'}</button>
      <button class="mh-btn mh-btn--primary" on:click={() => load(true)} disabled={loading}>{loading ? 'Refreshing…' : 'Refresh'}</button>
    </div>
  </header>

  <div class="mh-bar evo-bar" bind:offsetHeight={barH} role="group" aria-label="Evo Lab filters">
    <label class="mh-control"><span class="mh-label">People</span>
      <select class="mh-input" bind:value={period}>{#each PERIODS as p}<option value={p.key}>{p.label}</option>{/each}</select>
    </label>
    <label class="mh-control"><span class="mh-label">Lead window</span>
      <select class="mh-input" bind:value={windowDays} title="A lead counts for a visitor's variant if it arrives within this many days of their first visit">{#each WINDOWS as w}<option value={w}>{w} days</option>{/each}</select>
    </label>
    <div class="mh-control"><span class="mh-label">Surface</span>
      <div class="mh-seg" use:tabs={{ mode: 'toggle' }} role="group" aria-label="Surface">
        {#each SURFACES as s}<button aria-pressed={surface === s.k} on:click={() => (surface = s.k)}>{s.l}</button>{/each}
      </div>
    </div>
    <label class="mh-control"><span class="mh-label">Status</span>
      <select class="mh-input" bind:value={status}><option value="running">Running</option><option value="ended">Ended</option><option value="all">All</option></select>
    </label>
    <div class="mh-control evo-bar__filters"><span class="mh-label">Audience</span>
      <div class="mh-filters">
        {#each $labFilters as f (f.dim)}
          <span class="mh-chip">{PRE_DIMS.find((d) => d.key === f.dim)?.label}: {f.values.join(', ')}<button aria-label="Remove {f.dim} filter" on:click={() => removeFilter(f.dim)}>×</button></span>
        {:else}
          <span class="mh-muted">Click an audience row to filter</span>
        {/each}
        {#if $canUndo}<button class="mh-btn mh-btn--ghost mh-btn--sm" on:click={undo}>Undo</button>{/if}
        {#if $labFilters.length}<button class="mh-btn mh-btn--ghost mh-btn--sm" on:click={clearFilters}>Clear</button>{/if}
      </div>
    </div>
    <details class="evo-excl">
      <summary class="mh-btn mh-btn--sm">Exclusions</summary>
      <div class="evo-excl__pop" role="group" aria-label="Excluded traffic">
        <p class="mh-hint">Excluded from every result. Untick to include.</p>
        {#each ALL_EXCLUSIONS as r}
          <label class="mh-toggle"><input type="checkbox" checked={!included.includes(r)} on:change={() => toggleExclusion(r)} /> {EXCL_LABEL[r]} ({excludedCounts[r]})</label>
        {/each}
      </div>
    </details>
    <span class="mh-live" aria-live="polite">{liveText}</span>
  </div>

  {#if subsetActive}
    <div class="mh-alert mh-alert--info" role="status">
      <span><b>Subset view.</b> Numbers below use only the selected people. Decisions and recommendations always use all data since each test started.</span>
      <button class="mh-link" on:click={() => { period = 'all'; clearFilters(); }}>Show all</button>
    </div>
  {/if}
  {#if error}<div class="mh-alert mh-alert--error" role="alert"><span>{#if evo}The last refresh failed: {error} Showing the data from {new Date(evo.generatedAt).toLocaleTimeString('en-US', { timeZone: 'America/Costa_Rica', hour: 'numeric', minute: '2-digit' })}.{:else}{error}{/if}</span><button class="mh-btn mh-btn--sm" on:click={() => load(true)}>Retry</button></div>{/if}
  {#if metricsError}<div class="mh-alert mh-alert--warn"><span>Lead and money data is unavailable ({metricsError}). Only on-page steps (clicks, messages) can be shown.</span></div>{/if}

  <nav class="mh-nav" aria-label="Evo Lab sections">
    {#each SECTIONS as s}<a href="#{s.id}" on:click={() => { if (s.id === 'evo-ops') opsOpen = true; }}>{s.label}</a>{/each}
  </nav>

  {#if !evo && loading}
    <StreamAssembly title="Assembling Evo Lab" steps={buildSteps} />
  {:else if evo && full && shown}
    <div class="evo-assemble" class:is-assembling={assembling}>
    <HealthStrip line={full.health} onOpen={openOps} />
    <LabPulse {view} lab={shown} fullLab={full} cube={evo} {currency} {decisions} onOpen={selectExperiment} />
    <DecisionsWaiting waiting={full.waiting} {isAdmin} onOpen={selectExperiment} onRecord={(a) => (recordFor = a)} />
    <section class="mh-section" id="evo-experiments" aria-labelledby="evo-experiments-h">
      <div class="mh-section__head">
        <div class="mh-section__title">
          <h3 class="mh-h" id="evo-experiments-h">Experiments</h3>
          <p class="mh-sub">Every test, its current verdict and when it will be decided.</p>
        </div>
      </div>
      <Portfolio analyses={shown.analyses} {decisionOf} {selected} onSelect={(k) => selectExperiment(k)} />
    </section>
    {#if selectedShown && selectedFull}
      <ExperimentDetail a={selectedShown} decision={selectedFull} cube={evo} lab={shown} {currency} bind:tab {decisions} {isAdmin} subset={subsetActive} onOpenClient={openClient} onRecord={(a) => (recordFor = a)} />
    {/if}
    <Combinations lab={full} cube={evo} {windowDays} {currency} />
    <Audiences lab={full} {selected} onFilter={(dim, value) => addFilter(dim, value)} {windowDays} {currency} />
    <AskEvo cube={evo} onOpen={selectExperiment} onFilter={(dim, value) => addFilter(dim, value)} onPeriod={(p) => (period = p)} onWindow={(w) => (windowDays = w)} onOps={openOps} />
    <DecisionsLog {decisions} cube={evo} onOpen={selectExperiment} />
    <Operations cube={evo} lab={full} bind:open={opsOpen} />
    </div>
  {:else if !error}
    <p class="mh-empty" role="status">Loading Evo…</p>
  {/if}

  {#if recordFor}
    <RecordDecision a={recordFor} on:close={() => (recordFor = null)} on:recorded={onRecorded} />
  {/if}
</div>

<style>
  .evo-bar__filters { flex: 1 1 260px; }
  .evo-excl { position: relative; align-self: flex-end; }
  .evo-excl > summary { list-style: none; }
  .evo-excl > summary::-webkit-details-marker { display: none; }
  .evo-excl__pop { position: absolute; right: 0; top: calc(100% + 6px); z-index: 8; background: var(--irp-surface); border: 1px solid var(--irp-line); border-radius: var(--irp-r-md); padding: 0.7rem 0.8rem; display: grid; gap: 0.4rem; min-width: 240px; box-shadow: 0 8px 28px rgba(15, 23, 42, 0.12); }
  /* The sections cascade in once, when the data first lands. */
  .evo-assemble.is-assembling > :global(*) {
    animation: evo-assemble-in 620ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
    animation-delay: 800ms;
  }
  .evo-assemble.is-assembling > :global(:nth-child(1)) { animation-delay: 0ms; }
  .evo-assemble.is-assembling > :global(:nth-child(2)) { animation-delay: 80ms; }
  .evo-assemble.is-assembling > :global(:nth-child(3)) { animation-delay: 160ms; }
  .evo-assemble.is-assembling > :global(:nth-child(4)) { animation-delay: 240ms; }
  .evo-assemble.is-assembling > :global(:nth-child(5)) { animation-delay: 320ms; }
  .evo-assemble.is-assembling > :global(:nth-child(6)) { animation-delay: 400ms; }
  .evo-assemble.is-assembling > :global(:nth-child(7)) { animation-delay: 480ms; }
  .evo-assemble.is-assembling > :global(:nth-child(8)) { animation-delay: 560ms; }
  .evo-assemble.is-assembling > :global(:nth-child(9)) { animation-delay: 640ms; }
  .evo-assemble.is-assembling > :global(:nth-child(10)) { animation-delay: 720ms; }
  @keyframes evo-assemble-in {
    from { opacity: 0; transform: translateY(14px) scale(0.985); filter: blur(4px); }
    to { opacity: 1; transform: none; filter: none; }
  }
  @media (prefers-reduced-motion: reduce) {
    .evo-assemble.is-assembling > :global(*) { animation: none; }
  }

  @media (max-width: 640px) {
    .evo-bar { gap: 0.5rem; }
    .evo-bar__filters { flex-basis: 100%; }
  }
</style>
