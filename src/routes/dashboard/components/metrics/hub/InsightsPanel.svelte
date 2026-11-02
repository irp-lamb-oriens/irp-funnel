<script lang="ts">
  /**
   * InsightsPanel — "What's working / What isn't" plus a strip of momentum
   * and risk cards. Working/not-working come from the combination finder
   * (mature 60-day win rate, Fisher + Benjamini–Hochberg), revenue cards from
   * the booked-per-lead decomposition. The scan runs off the main thread's
   * critical path (chunked) and is cached per filter set.
   */
  import { createEventDispatcher, onDestroy } from 'svelte';
  import type { Ctx, LeadFact, MetricsCube } from '../engine/types.ts';
  import { findCombosAsync, type ComboResult } from '../engine/combos.ts';
  import {
    comboInsights, concentrationInsight, driverInsights, forecastInsight, gapInsights, leakageInsight,
    momentumInsights, mtdInsight, receivableInsight, revenueDrivers, stalledInsight, type Insight,
  } from '../engine/insights.ts';
  import { money } from '../engine/format.ts';
  import { addFilters, scrollToSection } from './hubState.ts';

  export let rows: LeadFact[] = [];
  export let ctx: Ctx;
  export let cube: MetricsCube;
  export let filterKey = '';

  const dispatch = createEventDispatcher<{ openClient: { id: string } }>();
  const fmt = (n: number) => money(n, ctx.currency, true);

  let combo: ComboResult | null = null;
  let scanning = false;
  const cache = new Map<string, ComboResult>();
  let token = { cancelled: false };

  async function scan(key: string, rs: LeadFact[]) {
    token.cancelled = true;
    const hit = cache.get(key);
    if (hit) { combo = hit; scanning = false; return; }
    const t = (token = { cancelled: false });
    scanning = true;
    const res = await findCombosAsync(rs, 'matureWinRate', {}, t);
    if (t.cancelled || !res) return;
    cache.set(key, res);
    combo = res;
    scanning = false;
  }
  $: scan(`${filterKey}|${rows.length}`, rows);
  onDestroy(() => (token.cancelled = true));

  $: ci = comboInsights(combo);
  $: drivers = driverInsights(revenueDrivers(rows, ctx.currency), fmt);
  $: working = [...ci.working, ...drivers.filter((d) => d.tone === 'good')].slice(0, 4);
  $: notWorking = [...ci.notWorking, ...drivers.filter((d) => d.tone !== 'good')].slice(0, 4);
  $: risks = [
    mtdInsight(rows, cube.nowMonth),
    ...momentumInsights(rows, cube.nowMonth, ctx.currency),
    stalledInsight(rows, ctx.currency, fmt),
    receivableInsight(rows, ctx.currency, fmt),
    forecastInsight(rows, ctx.currency, fmt),
    concentrationInsight(rows, ctx, fmt),
    leakageInsight(rows, cube.funnelStages),
    ...gapInsights(rows, ctx),
  ].filter((x): x is Insight => !!x);

  function explore(i: Insight) {
    if (!i.filters?.length) return;
    addFilters(i.filters);
    scrollToSection('mh-segments');
  }
</script>

<div class="ip">
  <div class="ip-cols">
    {#each [{ title: "What's working", items: working, tone: 'good', empty: 'Nothing stands out above the baseline yet.' }, { title: "What isn't", items: notWorking, tone: 'bad', empty: 'Nothing stands out below the baseline yet.' }] as col}
      <section class="ip-col ip-col--{col.tone}" aria-label={col.title}>
        <h4 class="ip-col__h"><span aria-hidden="true">{col.tone === 'good' ? '▲' : '▼'}</span> {col.title}</h4>
        {#if scanning && !combo}
          <div class="mh-sk" style="height:84px"></div><div class="mh-sk" style="height:84px;margin-top:8px"></div>
        {:else if col.items.length}
          <ul class="ip-list">
            {#each col.items as i (i.id)}
              <li class="ip-card ip-card--{i.tone}">
                <div class="ip-card__h">{i.headline}</div>
                <div class="ip-card__d">{i.detail}</div>
                {#if i.filters?.length}<button class="mh-link ip-card__a" on:click={() => explore(i)}>Explore this segment →</button>{/if}
              </li>
            {/each}
          </ul>
        {:else}
          <p class="mh-empty">{combo?.caveat ?? col.empty}</p>
        {/if}
      </section>
    {/each}
  </div>
  {#if combo}
    <p class="mh-hint ip-meta">
      Based on {combo.pool.toLocaleString('en-US')} leads 2–18 months old (60-day win rate, baseline {Math.round(combo.baseline * 1000) / 10}%) ·
      {combo.tested} segments tested, {combo.passed} passed a false-discovery check · test leads excluded.
      {#if combo.caveat && (working.length || notWorking.length)} {combo.caveat}{/if}
    </p>
  {/if}

  {#if risks.length}
    <ul class="ip-strip" aria-label="Changes and risks">
      {#each risks as r (r.id)}
        <li class="ip-risk ip-risk--{r.tone}">
          <div class="ip-risk__h"><span class="ip-dot" aria-hidden="true"></span>{r.headline}</div>
          <div class="ip-risk__d">{r.detail}</div>
          {#if r.deals?.length}
            <ul class="ip-deals">
              {#each r.deals as d}
                <li><button class="mh-link" on:click={() => dispatch('openClient', { id: d.id })} disabled={d.id.includes(':')}>{d.name}</button><span>{d.value}</span></li>
              {/each}
            </ul>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .ip-cols { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 1rem; }
  .ip-col { min-width: 0; }
  .ip-col__h { margin: 0 0 0.55rem; font-size: 0.86rem; font-weight: 800; color: #0f172a; }
  .ip-col--good .ip-col__h span { color: #047857; }
  .ip-col--bad .ip-col__h span { color: #b91c1c; }
  .ip-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.55rem; }
  .ip-card { padding: 0.7rem 0.85rem; border-radius: 12px; border: 1px solid #e2e8f0; background: #fff; border-left-width: 4px; }
  .ip-card--good { border-left-color: #10b981; background: linear-gradient(90deg, #f0fdf8, #fff 40%); }
  .ip-card--bad { border-left-color: #ef4444; background: linear-gradient(90deg, #fff5f5, #fff 40%); }
  .ip-card--watch { border-left-color: #f59e0b; background: linear-gradient(90deg, #fffbeb, #fff 40%); }
  .ip-card__h { font-weight: 700; font-size: 0.86rem; color: #0f172a; }
  .ip-card__d { margin-top: 0.2rem; font-size: 0.76rem; color: #475569; line-height: 1.4; font-variant-numeric: tabular-nums; }
  .ip-card__a { margin-top: 0.35rem; font-size: 0.74rem; }
  .ip-meta { margin-top: 0.7rem; }
  .ip-strip { list-style: none; margin: 1rem 0 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 0.6rem; }
  .ip-risk { padding: 0.65rem 0.8rem; border: 1px solid #e2e8f0; border-radius: 12px; background: #f8fafc; }
  .ip-risk__h { display: flex; gap: 0.45rem; align-items: baseline; font-weight: 700; font-size: 0.8rem; color: #0f172a; }
  .ip-dot { flex: none; width: 8px; height: 8px; border-radius: 50%; background: #94a3b8; transform: translateY(-1px); }
  .ip-risk--good .ip-dot { background: #10b981; }
  .ip-risk--bad .ip-dot { background: #ef4444; }
  .ip-risk--watch .ip-dot { background: #f59e0b; }
  .ip-risk--info .ip-dot { background: #38bdf8; }
  .ip-risk__d { margin-top: 0.2rem; font-size: 0.74rem; color: #475569; line-height: 1.4; }
  .ip-deals { list-style: none; margin: 0.45rem 0 0; padding: 0; display: grid; gap: 0.2rem; font-size: 0.74rem; }
  .ip-deals li { display: flex; justify-content: space-between; gap: 0.5rem; }
  .ip-deals span { color: #64748b; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .ip-deals .mh-link { font-size: 0.74rem; text-align: left; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  @media (max-width: 860px) { .ip-cols { grid-template-columns: minmax(0, 1fr); } }
</style>
