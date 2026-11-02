<script lang="ts">
  /**
   * Over time — how the estimate developed: the cumulative difference vs
   * control by week of assignment (with its likely range), visitors assigned
   * per day per arm, and the commits that shipped during the test.
   */
  import type { ExperimentAnalysis } from '../../engine/experiment.ts';
  import { countMetric } from '../../engine/experiment.ts';
  import type { JoinedExperiment } from '../../engine/join.ts';
  import { armLabel, crDay, DAY_MS } from '../../engine/join.ts';
  import { metricDef } from '../../engine/metrics.ts';
  import { newcombeDiff } from '../../engine/stats.ts';
  import type { EvoCube } from '../../engine/types.ts';
  import TrendChart from '../../../metrics/charts/TrendChart.svelte';
  import { per100 } from '../words.ts';

  export let a: ExperimentAnalysis;
  export let joined: JoinedExperiment;
  export let cube: EvoCube;
  export let leads: Map<string, import('../../../metrics/engine/types.ts').LeadFact> = new Map();
  export let windowDays = 30;
  export let now = Date.parse(cube.generatedAt);
  export let currency = 'USD';

  let table = false;
  $: start = Date.parse(a.def.startedAt);
  $: m = metricDef(a.def.primaryMetric);
  $: weeksN = Math.max(1, Math.ceil((now - start) / (7 * DAY_MS)));
  $: weekly = Array.from({ length: Math.min(weeksN, 52) }, (_, i) => {
    const end = start + (i + 1) * 7 * DAY_MS;
    const arms = countMetric(joined.units.filter((u) => u.t <= end), a.arms, m, now, windowDays, currency, leads);
    const c = arms.find((x) => x.arm === a.def.control)!, t = arms.find((x) => x.arm === a.arms[1]);
    const ci = t && c.n && t.n ? newcombeDiff(t.x, t.n, c.x, c.n) : null;
    const d = t && c.n && t.n ? t.x / t.n - c.x / c.n : null;
    return { label: `W${i + 1}`, d, lo: ci?.lo ?? null, hi: ci?.hi ?? null };
  });
  $: days = (() => {
    const out: string[] = [];
    const from = Math.max(start, now - 59 * DAY_MS);
    for (let t = from; t <= now; t += DAY_MS) out.push(crDay(t));
    return out;
  })();
  $: perDay = a.arms.map((k) => {
    const counts = new Map<string, number>();
    for (const u of joined.all) if (u.arm === k) counts.set(u.day, (counts.get(u.day) ?? 0) + 1);
    return { key: k, label: armLabel(a.def, k), values: days.map((d) => counts.get(d) ?? 0) };
  });
  $: commits = (() => {
    const c = new Map<string, number>();
    for (const v of cube.visitors) { const as = v.assign[a.def.componentKey]; if (as) c.set(as.commit, (c.get(as.commit) ?? 0) + 1); }
    return [...c.entries()].map(([hash, n]) => ({ hash, n, msg: cube.commits.find((x) => x.hash === hash)?.message ?? '', at: cube.commits.find((x) => x.hash === hash)?.firstSeenAt ?? '' })).sort((x, y) => x.at.localeCompare(y.at));
  })();
</script>

<div class="evo-ot">
  <div class="mh-section__head">
    <p class="mh-sub">Change in {m.label.toLowerCase()} ({armLabel(a.def, a.arms[1])} − {armLabel(a.def, a.def.control)}, per 100 visitors), everyone assigned up to each week</p>
    <button class="mh-btn mh-btn--sm" aria-pressed={table} on:click={() => (table = !table)}>{table ? 'Chart' : 'Table'}</button>
  </div>
  {#if weekly.every((w) => w.d === null)}
    <p class="mh-empty">No mature results yet. The first point appears once visitors are {m.lag(windowDays)} days old.</p>
  {:else}
    <TrendChart labels={weekly.map((w) => w.label)} showTable={table} format={(v) => per100(v)} caption="Cumulative difference by week"
      series={[
        { key: 'd', label: 'Change', values: weekly.map((w) => w.d), kind: 'line' },
        { key: 'lo', label: 'Low end of range', values: weekly.map((w) => w.lo), kind: 'line', color: '#cbd5e1' },
        { key: 'hi', label: 'High end of range', values: weekly.map((w) => w.hi), kind: 'line', color: '#cbd5e1' },
      ]} />
    <p class="mh-hint">Early weeks swing a lot; that is normal. Verdicts wait for the floors in the decision rule.</p>
  {/if}

  <h4 class="mh-card__h" style="margin-top: 1rem">Visitors assigned per day (last 60 days)</h4>
  <TrendChart labels={days.map((d) => d.slice(5))} showTable={table} series={perDay.map((p) => ({ ...p, kind: 'bar' }))} stacked height={160} caption="Assignments per day by arm" />

  {#if commits.length}
    <h4 class="mh-card__h" style="margin-top: 1rem">Site versions during the test</h4>
    <table class="mh-table mh-table--compact">
      <thead><tr><th scope="col">Commit</th><th scope="col">Message</th><th scope="col">First seen</th><th scope="col" class="num">Visitors</th></tr></thead>
      <tbody>{#each commits as c}<tr><th scope="row"><code>{c.hash.slice(0, 8)}</code></th><td>{c.msg}</td><td>{c.at ? c.at.slice(0, 10) : '—'}</td><td class="num">{c.n}</td></tr>{/each}</tbody>
    </table>
  {/if}
</div>
