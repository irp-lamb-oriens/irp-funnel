<script lang="ts">
  /**
   * MetricsHub — the Metrics tab (spec: irp-funnel-server/docs/designs/metrics-hub.md).
   *
   * Loads the lead fact cube once, applies the period / currency / filters
   * here, and hands every section the SAME filtered rows and period context.
   * Money and counts match the Sales Report by construction (the cube is
   * built from the Sales Report v2 ledger on the server).
   *
   *   Pulse → What's working / isn't → Growth → Segments → Funnel by segment
   *   → Marketing → Velocity → Explorer (+ combination finder)
   *
   * Operational modules (calls, email queue, AI spend, raw data) render below
   * in MetricsView, collapsed.
   */
  import { onDestroy, onMount, tick } from 'svelte';
  import { metrics, activeView, salesReportPrefill, fetchClientDetail, fetchMetricsCube } from '../../../store.ts';
  import { METRICS_CUBE_SCHEMA_VERSION, type Ctx, type LeadFact, type MetricsCube } from '../engine/types.ts';
  import { PRESETS, VALID_MONTH, compareMonths, firstMonthOf, monthLabel, monthRange, rangeFor, rangeLabel, shiftMonth, type Compare, type Preset } from '../engine/period.ts';
  import { filterRows } from '../engine/cube.ts';
  import { DIM, dimLabel } from '../engine/registry.ts';
  import { canUndo, clearFilters, decodeFilters, encodeFilters, hubCube, hubFilters, removeFilter, setFiltersSilently, undoFilters } from './hubState.ts';
  import FilterPicker from './FilterPicker.svelte';
  import PulseTiles from './PulseTiles.svelte';
  import InsightsPanel from './InsightsPanel.svelte';
  import GrowthSection from './GrowthSection.svelte';
  import SegmentsSection from './SegmentsSection.svelte';
  import FunnelSection from './FunnelSection.svelte';
  import MarketingSection from './MarketingSection.svelte';
  import VelocitySection from './VelocitySection.svelte';
  import ExplorerSection from './ExplorerSection.svelte';
  import AttributionMetricsModule from '../AttributionMetricsModule.svelte';

  // ── State ────────────────────────────────────────────────────────────────
  type PulseView = 'leadership' | 'sales' | 'finance' | 'marketing';
  const PULSE: Record<PulseView, { label: string; tiles: string[] }> = {
    leadership: { label: 'Leadership', tiles: ['leads', 'won', 'booked', 'cash', 'winRate', 'bookedPerLead'] },
    sales: { label: 'Sales', tiles: ['leads', 'quotedLeads', 'won', 'quoteToWin', 'daysToClose', 'openQuotes'] },
    finance: { label: 'Finance', tiles: ['booked', 'cash', 'marginPct', 'cashCollection', 'receivable', 'forecast'] },
    marketing: { label: 'Marketing', tiles: ['leads', 'showRate', 'winRate', 'bookedPerLead', 'marginPerLead', 'unknownChannel'] },
  };

  const PULSE_KEYS = Object.keys(PULSE) as PulseView[];

  let preset: Preset = 'last_12';
  let custom = { from: '', to: '' };
  let compare: Compare = 'prev';
  let currency = 'USD';
  let excludeTest = false;
  let pulseView: PulseView = 'leadership';
  let explorer = { m: ['leads', 'winRate', 'bookedPerLead'], r: 'destination', c: '', n: 12, v: 'chart' as 'chart' | 'table' };
  let segDim = 'channel';

  let loading = false;
  let error = '';
  let schemaError = false;
  let ready = false;

  // ── URL (mh_*) ───────────────────────────────────────────────────────────
  function readUrl() {
    try {
      const q = new URLSearchParams(window.location.search);
      const p = q.get('mh_p') as Preset | null;
      if (p && PRESETS.some((x) => x.value === p)) preset = p;
      const f = q.get('mh_from'), t = q.get('mh_to');
      if (f && VALID_MONTH.test(f)) custom.from = f;
      if (t && VALID_MONTH.test(t)) custom.to = t;
      const c = q.get('mh_cmp') as Compare | null;
      if (c === 'prev' || c === 'yoy' || c === 'none') compare = c;
      const cur = q.get('mh_cur');
      if (cur && /^[A-Z]{3}$/.test(cur)) currency = cur;
      if (q.get('mh_test') === '0') excludeTest = true;
      setFiltersSilently(decodeFilters(q.get('mh_f')).filter((x) => DIM[x.dim]));
      const x = q.get('mh_x');
      if (x) { const [m, r, cc, n, v] = x.split('~'); explorer = { m: m ? m.split('.') : explorer.m, r: DIM[r] ? r : explorer.r, c: DIM[cc] ? cc : '', n: Number(n) || 12, v: v === 'table' ? 'table' : 'chart' }; }
    } catch { /* no URL access */ }
    try { const v = localStorage.getItem('irp.metricsHub.pulse') as PulseView | null; if (v && PULSE[v]) pulseView = v; } catch { /* storage blocked */ }
  }
  function writeUrl() {
    if (!ready) return;
    try {
      const url = new URL(window.location.href);
      const set = (k: string, v: string | null) => (v ? url.searchParams.set(k, v) : url.searchParams.delete(k));
      set('view', 'metrics');
      set('mh_p', preset);
      set('mh_from', preset === 'custom' ? custom.from : null);
      set('mh_to', preset === 'custom' ? custom.to : null);
      set('mh_cmp', compare === 'prev' ? null : compare);
      set('mh_cur', currency === 'USD' ? null : currency);
      set('mh_test', excludeTest ? '0' : null);
      set('mh_f', $hubFilters.length ? encodeFilters($hubFilters) : null);
      set('mh_x', `${explorer.m.join('.')}~${explorer.r}~${explorer.c}~${explorer.n}~${explorer.v}`);
      window.history.replaceState(window.history.state, '', url);
    } catch { /* ignore */ }
  }
  $: preset, custom, compare, currency, excludeTest, $hubFilters, explorer, writeUrl();
  function savePulse(v: PulseView) { if (!ready) return; try { localStorage.setItem('irp.metricsHub.pulse', v); } catch { /* ignore */ } }
  $: savePulse(pulseView);

  // ── Load ─────────────────────────────────────────────────────────────────
  let ticket = 0;
  async function load(fresh = false) {
    const t = ++ticket;
    loading = true;
    error = '';
    try {
      const data = (await fetchMetricsCube({ fresh })) as MetricsCube;
      if (t !== ticket) return;
      if (!data || !Array.isArray(data.rows) || (data.schemaVersion ?? 0) !== METRICS_CUBE_SCHEMA_VERSION) { schemaError = true; return; }
      hubCube.set(data);
      if (!data.currencies.includes(currency) && data.currencies.length) currency = data.currencies[0];
    } catch (err: any) {
      if (t === ticket) error = err?.message ?? 'Could not load metrics.';
    } finally {
      if (t === ticket) loading = false;
    }
  }

  // ── Derived ──────────────────────────────────────────────────────────────
  $: cube = $hubCube;
  $: allRows = cube?.rows ?? [];
  $: nowMonth = cube?.nowMonth ?? new Date().toISOString().slice(0, 7);
  $: firstMonth = firstMonthOf(allRows, nowMonth);
  $: range = rangeFor(preset, nowMonth, custom, firstMonth);
  $: months = monthRange(range.from, range.to);
  $: ctx = { months, allTime: range.allTime, currency, nowMonth } as Ctx;
  $: cmpMonths = compareMonths(months, compare, range.allTime);
  $: cmpCtx = cmpMonths ? ({ months: cmpMonths, allTime: false, currency, nowMonth } as Ctx) : null;
  $: cmpLabel = compare === 'yoy' ? 'same months last year' : months.length === 1 ? monthLabel(cmpMonths?.[0] ?? '', true) : 'previous period';
  $: rows = filterRows(allRows, $hubFilters, { excludeTest }) as LeadFact[];
  $: filterKey = `${encodeFilters($hubFilters)}|${excludeTest}`;
  $: chartMonths = months.length >= 6 ? months.slice(-24) : monthRange(shiftMonth(range.to, -11), range.to);
  $: sparkMonths = monthRange(shiftMonth(range.to, -11), range.to);
  $: testCount = allRows.filter((r) => r.likelyTest).length;
  $: cohortLeads = rows.filter((r) => r.isLead && (range.allTime || (r.leadMonth && months.includes(r.leadMonth)))).length;
  $: liveText = `${cohortLeads.toLocaleString('en-US')} leads in ${rangeLabel(months, range.allTime)}${$hubFilters.length ? ` · ${$hubFilters.length} filter${$hubFilters.length === 1 ? '' : 's'}` : ''}`;
  $: updated = (() => { const at = cube?.sourcesLoadedAt ?? cube?.generatedAt; if (!at) return ''; const mins = Math.round((Date.now() - new Date(at).getTime()) / 60000); return mins < 1 ? 'just now' : `${mins}m ago`; })();

  // ── Actions ──────────────────────────────────────────────────────────────
  function openSales() {
    if (!range.allTime) salesReportPrefill.set({ from: range.from, to: range.to });
    activeView.set('salesReport');
  }
  async function openClient(id: string) {
    try { await fetchClientDetail(id); } catch (err: any) { error = err?.message ?? 'Could not open the client.'; }
  }
  function setMonth(m: string) {
    preset = 'custom';
    custom = { from: m, to: m };
  }
  async function copyLink() {
    try { await navigator.clipboard.writeText(window.location.href); copied = true; setTimeout(() => (copied = false), 1600); } catch { /* ignore */ }
  }
  let copied = false;

  // ── Section nav + sticky offset ──────────────────────────────────────────
  const SECTIONS = [
    { id: 'mh-pulse', label: 'Pulse' },
    { id: 'mh-insights', label: "What's working" },
    { id: 'mh-growth', label: 'Growth' },
    { id: 'mh-segments', label: 'Segments' },
    { id: 'mh-funnel', label: 'Funnel' },
    { id: 'mh-marketing', label: 'Marketing' },
    { id: 'mh-velocity', label: 'Velocity' },
    { id: 'mh-explorer', label: 'Explorer' },
    { id: 'mh-ops', label: 'Operations' },
  ];
  let current = 'mh-pulse';
  let barH = 0;
  let observer: IntersectionObserver | null = null;
  async function observe() {
    await tick();
    observer?.disconnect();
    if (typeof IntersectionObserver === 'undefined') return;
    observer = new IntersectionObserver((entries) => {
      const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      if (vis[0]) current = vis[0].target.id;
    }, { rootMargin: '-20% 0px -70% 0px' });
    for (const s of SECTIONS) { const el = document.getElementById(s.id); if (el) observer.observe(el); }
  }
  $: if (cube) observe();

  onMount(() => {
    readUrl();
    ready = true;
    if (!$hubCube) load();
    writeUrl();
  });
  onDestroy(() => observer?.disconnect());
</script>

<div class="mh" style="--mh-sticky:{barH}px">
  <header class="mh-head">
    <div>
      <h2>Metrics</h2>
      <p>What works, what doesn't, and why · Costa Rica time{updated ? ` · updated ${updated}` : ''}</p>
    </div>
    <div class="mh-head__actions">
      <div class="mh-seg" role="group" aria-label="Headline numbers for">
        {#each PULSE_KEYS as k}
          <button aria-pressed={pulseView === k} on:click={() => (pulseView = k)}>{PULSE[k].label}</button>
        {/each}
      </div>
      <button class="mh-btn" on:click={copyLink}>{copied ? 'Link copied' : 'Copy link'}</button>
      <button class="mh-btn mh-btn--primary" on:click={() => load(true)} disabled={loading}>{loading ? 'Refreshing…' : 'Refresh'}</button>
    </div>
  </header>

  <div class="mh-bar" bind:offsetHeight={barH} role="group" aria-label="Metrics filters">
    <label class="mh-control">
      <span class="mh-label">Period</span>
      <select class="mh-input" bind:value={preset}>{#each PRESETS as p}<option value={p.value}>{p.label}</option>{/each}</select>
    </label>
    {#if preset === 'custom'}
      <label class="mh-control"><span class="mh-label">From</span><input class="mh-input" type="month" bind:value={custom.from} max={nowMonth} /></label>
      <label class="mh-control"><span class="mh-label">To</span><input class="mh-input" type="month" bind:value={custom.to} max={nowMonth} /></label>
    {/if}
    <label class="mh-control">
      <span class="mh-label">Compare to</span>
      <select class="mh-input" bind:value={compare} disabled={range.allTime}>
        <option value="prev">Previous period</option>
        <option value="yoy">Same months last year</option>
        <option value="none">No comparison</option>
      </select>
    </label>
    {#if (cube?.currencies.length ?? 0) > 1}
      <label class="mh-control">
        <span class="mh-label">Currency</span>
        <select class="mh-input" bind:value={currency}>{#each cube?.currencies ?? [] as c}<option value={c}>{c}</option>{/each}</select>
      </label>
    {/if}
    <div class="mh-control mh-filters-wrap">
      <span class="mh-label">Filters</span>
      <div class="mh-filters">
        {#each $hubFilters as f, i (f.dim + i)}
          <span class="mh-chip" class:mh-chip--exclude={f.exclude}>
            {f.exclude ? 'Not ' : ''}{DIM[f.dim]?.label}: {f.values.map((v) => dimLabel(f.dim, v)).join(', ')}
            <button aria-label="Remove filter {DIM[f.dim]?.label}" on:click={() => removeFilter(i)}>×</button>
          </span>
        {/each}
        <FilterPicker rows={allRows} />
        {#if $canUndo}<button class="mh-btn mh-btn--sm mh-btn--ghost" on:click={undoFilters}>↶ Undo</button>{/if}
        {#if $hubFilters.length}<button class="mh-btn mh-btn--sm mh-btn--ghost" on:click={clearFilters}>Clear all</button>{/if}
      </div>
    </div>
    {#if testCount}
      <label class="mh-toggle" title="Leads with test emails or names (heuristic). Counted by default so totals match the Sales Report.">
        <input type="checkbox" bind:checked={excludeTest} /> Hide test leads ({testCount})
      </label>
    {/if}
    <span class="mh-live" aria-live="polite">{liveText}</span>
  </div>

  <nav class="mh-nav" aria-label="Metrics sections">
    {#each SECTIONS as s}<a href="#{s.id}" aria-current={current === s.id ? 'true' : undefined} on:click={() => (current = s.id)}>{s.label}</a>{/each}
  </nav>

  {#if schemaError}
    <div class="mh-alert mh-alert--warn" role="alert">The server is running an older metrics version. <button class="mh-btn mh-btn--sm" on:click={() => window.location.reload()}>Reload dashboard</button></div>
  {/if}
  {#if error}
    <div class="mh-alert mh-alert--error" role="alert"><span>{error}</span><button class="mh-btn mh-btn--sm" on:click={() => load(true)}>Retry</button></div>
  {/if}

  {#if !cube && !schemaError}
    <div aria-hidden="true" class="mh-skel">
      <div class="mh-sk" style="height:118px"></div>
      <div class="mh-sk" style="height:220px;margin-top:1rem"></div>
      <div class="mh-sk" style="height:300px;margin-top:1rem"></div>
    </div>
    {#if !error}<p class="sr-only" aria-live="polite">Loading metrics…</p>{/if}
  {:else if cube}
    {#if !cohortLeads && !range.allTime}
      <div class="mh-alert mh-alert--info">
        <span>No leads in {rangeLabel(months, false)}{$hubFilters.length ? ' with these filters' : ''}.</span>
        <span>
          <button class="mh-btn mh-btn--sm" on:click={() => (preset = 'last_12')}>Last 12 months</button>
          {#if $hubFilters.length}<button class="mh-btn mh-btn--sm" on:click={clearFilters}>Clear filters</button>{/if}
        </span>
      </div>
    {/if}

    <section id="mh-pulse" class="mh-pulse" aria-labelledby="mh-pulse-h">
      <h3 id="mh-pulse-h" class="sr-only" tabindex="-1">Pulse</h3>
      <PulseTiles {rows} {ctx} {cmpCtx} {cmpLabel} tiles={PULSE[pulseView].tiles} {sparkMonths} onOpenSales={openSales} />
    </section>

    <section id="mh-insights" class="mh-section" aria-labelledby="mh-ins-h">
      <div class="mh-section__head">
        <div class="mh-section__title"><h3 id="mh-ins-h" class="mh-h" tabindex="-1">What's working · what isn't</h3><p class="mh-hint">Segments that convert or earn clearly differently from everyone else, and what changed recently</p></div>
      </div>
      <InsightsPanel {rows} {ctx} {cube} {filterKey} on:openClient={(e) => openClient(e.detail.id)} />
    </section>

    <section id="mh-growth" class="mh-section" aria-labelledby="mh-gr-h">
      <div class="mh-section__head"><div class="mh-section__title"><h3 id="mh-gr-h" class="mh-h" tabindex="-1">Growth</h3><p class="mh-hint">Volume and lead value over time</p></div></div>
      <GrowthSection {rows} {ctx} {chartMonths} on:month={(e) => setMonth(e.detail.month)} />
    </section>

    <section id="mh-segments" class="mh-section" aria-labelledby="mh-sg-h">
      <div class="mh-section__head"><div class="mh-section__title"><h3 id="mh-sg-h" class="mh-h" tabindex="-1">Segments</h3><p class="mh-hint">How every kind of lead converts and what it's worth</p></div></div>
      <SegmentsSection {rows} {ctx} bind:dim={segDim} />
    </section>

    <section id="mh-funnel" class="mh-section" aria-labelledby="mh-fn-h">
      <div class="mh-section__head"><div class="mh-section__title"><h3 id="mh-fn-h" class="mh-h" tabindex="-1">Funnel by segment</h3><p class="mh-hint">Where each kind of lead drops off</p></div></div>
      <FunnelSection {rows} {ctx} {cube} onOpenSales={openSales} />
    </section>

    <section id="mh-marketing" class="mh-section" aria-labelledby="mh-mk-h">
      <div class="mh-section__head"><div class="mh-section__title"><h3 id="mh-mk-h" class="mh-h" tabindex="-1">Marketing</h3><p class="mh-hint">What each source brings in, and what it's worth</p></div></div>
      <MarketingSection {rows} {ctx}>
        {#if $metrics?.attribution}<AttributionMetricsModule attribution={$metrics.attribution} />{/if}
      </MarketingSection>
    </section>

    <section id="mh-velocity" class="mh-section" aria-labelledby="mh-vl-h">
      <div class="mh-section__head"><div class="mh-section__title"><h3 id="mh-vl-h" class="mh-h" tabindex="-1">Sales velocity</h3><p class="mh-hint">How long each step takes, for leads of the period</p></div></div>
      <VelocitySection {rows} {ctx} on:openClient={(e) => openClient(e.detail.id)} />
    </section>

    <section id="mh-explorer" class="mh-section" aria-labelledby="mh-ex-h">
      <div class="mh-section__head"><div class="mh-section__title"><h3 id="mh-ex-h" class="mh-h" tabindex="-1">Explorer</h3><p class="mh-hint">Any measure, by any one or two dimensions</p></div></div>
      <ExplorerSection {rows} {ctx} {filterKey} state={explorer} on:state={(e) => (explorer = e.detail)} />
    </section>

    {#if cube.warnings.length}
      <p class="mh-health"><strong>Data notes:</strong> {cube.warnings.join(' · ')} <button class="mh-link" on:click={openSales}>Sales Report data health →</button></p>
    {/if}
  {/if}

  <div id="mh-ops"><slot /></div>
</div>

<style>
  .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
  .mh-filters-wrap { flex: 1 1 320px; }
  .mh-pulse { scroll-margin-top: calc(var(--mh-sticky) + 12px); }
  .mh-health { font-size: 0.76rem; color: #64748b; margin: 0.2rem 0 0; line-height: 1.5; }
  #mh-ops { scroll-margin-top: calc(var(--mh-sticky) + 12px); }
  h3[tabindex='-1']:focus { outline: none; }
</style>
