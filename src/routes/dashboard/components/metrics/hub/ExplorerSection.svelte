<script lang="ts">
  /**
   * ExplorerSection — ask any question of the cube.
   *   Pivot: up to three measures × a Rows dimension (× an optional Columns
   *          dimension, which turns it into a heatmap of the first measure).
   *   Combination finder: every single segment and every pair of segments
   *          tested against the rest, false-discovery controlled.
   * The parent keeps the settings in its URL (Hub: mh_x, Sales Book: sr_x).
   *
   * Reusable (sales-book-v3 §5.6): `measures` limits the measure list, `finder`
   * hides the combination finder, and clicks are reported as a `filter` event
   * (Filter[]) so each tab applies them to its own filter state.
   */
  import { createEventDispatcher, onDestroy } from 'svelte';
  import BarList from '../charts/BarList.svelte';
  import Heatmap from '../charts/Heatmap.svelte';
  import type { BarRow, HeatCell } from '../charts/types.ts';
  import { BINOMIAL_MEASURES, DIMENSIONS, DIM, MEASURE, MEASURES, basisLabel } from '../engine/registry.ts';
  import { crossTab, csvEscape, groupBy } from '../engine/cube.ts';
  import { fmtMeasure, pct } from '../engine/format.ts';
  import { findCombosAsync, type ComboResult } from '../engine/combos.ts';
  import type { Ctx, Filter, LeadFact } from '../engine/types.ts';

  export let rows: LeadFact[] = [];
  export let ctx: Ctx;
  export let filterKey = '';
  export let state = { m: ['leads', 'winRate', 'bookedPerLead'], r: 'destination', c: '', n: 12, v: 'chart' as 'chart' | 'table' };
  /** Measure keys offered in the pickers (default: every measure). */
  export let measures: string[] | null = null;
  /** Show the combination finder (binomial rates only). */
  export let finder = true;
  /** File-name prefix for the CSV export. */
  export let exportName = 'metrics';

  const dispatch = createEventDispatcher<{ state: typeof state; filter: Filter[] }>();
  $: dispatch('state', state);
  const addFilter = (f: Filter) => dispatch('filter', [f]);
  const addFilters = (fs: Filter[]) => dispatch('filter', fs);

  const groups = ['Marketing', 'Move', 'Lead', 'Time', 'Sales'] as const;
  $: offered = measures ? MEASURES.filter((m) => measures!.includes(m.key)) : MEASURES;
  $: measureGroups = [
    { label: 'In the period', items: offered.filter((m) => m.basis === 'period') },
    { label: 'Leads of the period, to today', items: offered.filter((m) => m.basis === 'cohort') },
    { label: 'As of today', items: offered.filter((m) => m.basis === 'asOf') },
  ].filter((g) => g.items.length);

  $: ms = state.m.filter((k) => MEASURE[k]);
  $: grouped = state.r ? groupBy(rows, state.r, ms, ctx, { top: state.n }) : [];
  $: first = MEASURE[ms[0]];
  $: bars = grouped.map((g): BarRow => ({
    key: g.key, label: g.label, value: Math.max(0, g.values[ms[0]]?.value ?? 0),
    display: first ? fmtMeasure(first, g.values[ms[0]]?.value ?? null, ctx.currency, true) : '',
    cells: ms.slice(1).map((k) => fmtMeasure(MEASURE[k], g.values[k]?.value ?? null, ctx.currency, true)),
    muted: g.key === '__rest__',
  }));
  $: xt = state.c && state.r && state.c !== state.r && first ? crossTab(rows, state.r, state.c, ms[0], ctx, Math.min(state.n, 10)) : null;
  $: heat = xt ? xt.cells.map((row) => row.map((v): HeatCell => ({ value: v.value, n: v.n, display: v.value === null ? '—' : fmtMeasure(first, v.value, ctx.currency, true) }))) : [];

  function exportCsv() {
    const head = [DIM[state.r]?.label ?? 'Segment', ...ms.flatMap((k) => [MEASURE[k].label, `${MEASURE[k].label} (n)`])];
    const lines = [head.map(csvEscape).join(',')];
    for (const g of grouped) lines.push([g.label, ...ms.flatMap((k) => [g.values[k]?.value ?? '', g.values[k]?.n ?? ''])].map(csvEscape).join(','));
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${exportName}-${state.r}-${ctx.months[0] ?? 'all'}-${ctx.months[ctx.months.length - 1] ?? ''}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  function setMeasure(i: number, k: string) {
    const m = [...state.m];
    if (k) m[i] = k; else m.splice(i, 1);
    state = { ...state, m: m.filter(Boolean) };
  }

  // ── Combination finder ──
  let comboMeasure = 'matureWinRate';
  let pairs = true;
  let combo: ComboResult | null = null;
  let running = false;
  const cache = new Map<string, ComboResult>();
  let token = { cancelled: false };
  async function run(key: string, rs: LeadFact[], mk: string, pr: boolean) {
    token.cancelled = true;
    const hit = cache.get(key);
    if (hit) { combo = hit; running = false; return; }
    const t = (token = { cancelled: false });
    running = true;
    const res = await findCombosAsync(rs, mk, { pairs: pr }, t);
    if (t.cancelled || !res) return;
    cache.set(key, res);
    combo = res;
    running = false;
  }
  $: if (finder) run(`${filterKey}|${rows.length}|${comboMeasure}|${pairs}`, rows, comboMeasure, pairs);
  onDestroy(() => (token.cancelled = true));
</script>

<div class="ex-controls">
  {#each [0, 1, 2] as i}
    <label class="mh-control">
      <span class="mh-label">{i === 0 ? 'Measure' : `Then`}</span>
      <select class="mh-input" value={state.m[i] ?? ''} on:change={(e) => setMeasure(i, e.currentTarget.value)}>
        {#if i > 0}<option value="">—</option>{/if}
        {#each measureGroups as g}<optgroup label={g.label}>{#each g.items as m}<option value={m.key}>{m.label}</option>{/each}</optgroup>{/each}
      </select>
    </label>
  {/each}
  <label class="mh-control">
    <span class="mh-label">Rows</span>
    <select class="mh-input" bind:value={state.r}>
      {#each groups as g}<optgroup label={g}>{#each DIMENSIONS.filter((d) => d.group === g) as d}<option value={d.key}>{d.label}</option>{/each}</optgroup>{/each}
    </select>
  </label>
  <label class="mh-control">
    <span class="mh-label">Columns</span>
    <select class="mh-input" bind:value={state.c}>
      <option value="">—</option>
      {#each groups as g}<optgroup label={g}>{#each DIMENSIONS.filter((d) => d.group === g && d.key !== state.r) as d}<option value={d.key}>{d.label}</option>{/each}</optgroup>{/each}
    </select>
  </label>
  <label class="mh-control">
    <span class="mh-label">Top</span>
    <select class="mh-input" bind:value={state.n}>{#each [5, 8, 12, 20, 50] as n}<option value={n}>{n}</option>{/each}</select>
  </label>
  <div class="ex-right">
    {#if !xt}
      <div class="mh-seg" role="group" aria-label="Show as">
        <button aria-pressed={state.v === 'chart'} on:click={() => (state = { ...state, v: 'chart' })}>Bars</button>
        <button aria-pressed={state.v === 'table'} on:click={() => (state = { ...state, v: 'table' })}>Table</button>
      </div>
    {/if}
    <button class="mh-btn mh-btn--sm" on:click={exportCsv} disabled={!grouped.length}>Export CSV</button>
  </div>
</div>
{#if first}<p class="mh-hint ex-basis">{first.label}: {basisLabel(first)} — {first.def}</p>{/if}

{#if xt && first}
  <Heatmap rowLabels={xt.rows} colLabels={xt.cols} cells={heat} rowHeader={DIM[state.r]?.label} selectable
    domain={first.kind === 'rate' ? [0, Math.max(0.01, ...heat.flat().map((c) => c.value ?? 0))] : null}
    caption="{first.label} by {DIM[state.r]?.label} and {DIM[state.c]?.label}"
    on:select={(e) => addFilters([{ dim: state.r, values: [e.detail.row] }, { dim: state.c, values: [e.detail.col] }])} />
  <p class="mh-hint">Darker = higher. Top {Math.min(state.n, 10)} values on each side. Click a cell to filter the page to it.</p>
{:else if state.v === 'chart'}
  <BarList rows={bars} labelHeader={DIM[state.r]?.label} valueLabel={first?.label} columns={ms.slice(1).map((k) => MEASURE[k].label)} selectable
    on:select={(e) => addFilter({ dim: state.r, values: [e.detail.key] })} />
{:else}
  <div class="mh-table-wrap">
    <table class="mh-table">
      <thead><tr><th scope="col">{DIM[state.r]?.label}</th>{#each ms as k}<th scope="col" class="num">{MEASURE[k].label}</th><th scope="col" class="num">n</th>{/each}</tr></thead>
      <tbody>
        {#each grouped as g (g.key)}
          <tr><th scope="row">{g.label}</th>{#each ms as k}<td class="num">{fmtMeasure(MEASURE[k], g.values[k]?.value ?? null, ctx.currency)}</td><td class="num mh-muted">{g.values[k]?.n || ''}</td>{/each}</tr>
        {/each}
      </tbody>
    </table>
  </div>
{/if}

{#if finder}
<div class="ex-combo">
  <div class="ex-combo__head">
    <div>
      <h4 class="mh-sub">Combination finder</h4>
      <p class="mh-hint">Every segment and every pair of segments, tested against everyone else. Only results that survive a false-discovery check are shown.</p>
    </div>
    <div class="mh-tools">
      <label class="mh-control">
        <span class="mh-label">Rate</span>
        <select class="mh-input" bind:value={comboMeasure}>{#each BINOMIAL_MEASURES as m}<option value={m.key}>{m.label}</option>{/each}</select>
      </label>
      <label class="mh-toggle"><input type="checkbox" bind:checked={pairs} /> Include pairs</label>
    </div>
  </div>
  {#if running && !combo}
    <div class="mh-sk" style="height:120px"></div>
  {:else if combo}
    <p class="mh-hint" aria-live="polite">
      Baseline {pct(combo.baseline)} across {combo.pool.toLocaleString('en-US')} leads 2–18 months old · {combo.tested} segments tested · {combo.passed} passed · {combo.ms} ms{running ? ' · updating…' : ''}
    </p>
    {#if combo.caveat}<p class="mh-alert mh-alert--info">{combo.caveat}</p>{/if}
    <div class="mh-grid-2">
      {#each [{ t: 'Above baseline', list: combo.working, good: true }, { t: 'Below baseline', list: combo.notWorking, good: false }] as col}
        <div>
          <h5 class="ex-col-h"><span class={col.good ? 'mh-good' : 'mh-bad'} aria-hidden="true">{col.good ? '▲' : '▼'}</span> {col.t}</h5>
          {#if col.list.length}
            <table class="mh-table mh-table--compact">
              <thead><tr><th scope="col">Segment</th><th scope="col" class="num">Rate</th><th scope="col" class="num">n</th><th scope="col" class="num">Lift</th><th scope="col"><span class="sr-only">Apply</span></th></tr></thead>
              <tbody>
                {#each col.list as s (s.label)}
                  <tr>
                    <th scope="row" class="ex-seg">{s.label}</th>
                    <td class="num" title="Likely range {pct(s.ci.lo)}–{pct(s.ci.hi)}">{pct(s.rate)}</td>
                    <td class="num">{s.x}/{s.n}</td>
                    <td class="num">{s.lift.toFixed(2)}×</td>
                    <td><button class="mh-btn mh-btn--sm" on:click={() => addFilters(s.filters)} aria-label="Filter the page to {s.label}">Apply</button></td>
                  </tr>
                {/each}
              </tbody>
            </table>
          {:else}
            <p class="mh-empty">None.</p>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</div>
{/if}

<style>
  .ex-controls { display: flex; flex-wrap: wrap; gap: 0.7rem; align-items: flex-end; margin-bottom: 0.4rem; }
  .ex-controls .mh-control { min-width: 140px; }
  .ex-right { margin-left: auto; display: flex; gap: 0.5rem; align-items: center; }
  .ex-basis { margin: 0.2rem 0 0.8rem; }
  .ex-combo { margin-top: 1.4rem; padding-top: 1.1rem; border-top: 1px solid #e2e8f0; }
  .ex-combo__head { display: flex; justify-content: space-between; align-items: flex-end; gap: 1rem; flex-wrap: wrap; margin-bottom: 0.6rem; }
  .ex-col-h { margin: 0.4rem 0 0.4rem; font-size: 0.78rem; font-weight: 800; color: #0f172a; }
  .ex-seg { font-weight: 600 !important; white-space: normal; }
  .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
</style>
