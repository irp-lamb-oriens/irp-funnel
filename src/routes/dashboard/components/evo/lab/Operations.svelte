<script lang="ts">
  /**
   * Operations (collapsed) — for developers and anyone checking the data:
   * data health, allocation, the drip's raw counts and the pre-restart data.
   */
  import type { EvoCube } from '../engine/types.ts';
  import type { Lab } from '../engine/lab.ts';
  import { armLabel } from '../engine/join.ts';
  import Sparkline from '../../metrics/charts/Sparkline.svelte';
  import SplitBar from '../../metrics/charts/SplitBar.svelte';
  import { int, pct } from './words.ts';

  export let cube: EvoCube;
  export let lab: Lab;
  export let open = false;

  $: h = cube.health;
  $: days = (() => { const out: string[] = []; const now = Date.parse(cube.generatedAt); for (let i = 59; i >= 0; i--) out.push(new Date(now - i * 86400_000 - 6 * 3600_000).toISOString().slice(0, 10)); return out; })();
  $: drift = [...Object.entries(h.drift.unregisteredComponents).map(([k, n]) => `${k} (unregistered, ${n} events)`), ...Object.entries(h.drift.unknownVariants).map(([k, n]) => `${k} (unknown variant, ${n} events)`)];
  $: ago = (iso: string | null) => { if (!iso) return 'never'; const d = (Date.parse(cube.generatedAt) - Date.parse(iso)) / 3600_000; return d < 1 ? 'within the hour' : d < 48 ? `${Math.round(d)} h ago` : `${Math.round(d / 24)} days ago`; };
</script>

<details class="mh-ops" id="evo-ops" bind:open>
  <summary>Operations <span>data health, allocation, drip raw counts, pre-restart data</span></summary>
  <div class="mh-ops__body">
    <h4 class="mh-card__h">Data health</h4>
    <div class="mh-table-wrap">
      <table class="mh-table mh-table--compact">
        <thead><tr><th scope="col">Experiment</th><th scope="col">Events, last 60 days</th><th scope="col">Last event</th><th scope="col" class="num">Assigned (before exclusions)</th><th scope="col" class="num">Split check</th><th scope="col" class="num">Saw both</th><th scope="col" class="num">Excluded</th></tr></thead>
        <tbody>
          {#each cube.experiments as d}
            {@const e = h.experiments[d.componentKey]}
            {@const a = lab.analyses.find((x) => x.def.componentKey === d.componentKey)}
            {@const arms = Object.values(e?.arms ?? {})}
            <tr>
              <th scope="row">{d.title}</th>
              <td><Sparkline values={days.map((x) => e?.eventsByDay[x] ?? 0)} width={150} height={24} label="{d.title} events per day" /></td>
              <td>{ago(e?.lastEventAt ?? null)}</td>
              <td class="num">{Object.entries(e?.arms ?? {}).map(([k, v]) => `${armLabel(d, k)} ${int(v.assigned)}`).join(' · ') || '0'}</td>
              <td class="num" class:mh-bad={a?.srm && a.srm.p < 0.001}>{a?.srm ? (a.srm.p < 0.001 ? 'Imbalanced' : 'OK') : '—'}</td>
              <td class="num">{int(arms.reduce((s, x) => s + x.crossover, 0))}</td>
              <td class="num">{int(arms.reduce((s, x) => s + Object.values(x.excluded).reduce((p, q) => p + q, 0), 0))}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
    <ul class="evo-list">
      <li>Events: {int(h.totals.events)} total · {int(h.totals.postStartEvents)} since the restart · {int(h.totals.legacyEvents)} before it.</li>
      <li>Identity: {int(h.identity.visitors)} tested visitors, {pct(h.identity.visitors ? h.identity.visitorsWithPerson / h.identity.visitors : null)} linked to a person, {int(h.identity.visitorsWithLead)} with a lead. {int(h.identity.leadsWithVisitor)} of {int(h.identity.leadsSinceStart)} new leads since the restart came through a test ({pct(h.identity.leadsSinceStart ? h.identity.leadsWithVisitor / h.identity.leadsSinceStart : null)}).</li>
      <li>Allocation mode: <b>{h.mode === 'fixed' ? 'fixed 50/50' : 'adaptive bandit'}</b>.</li>
      {#if drift.length}<li class="mh-bad">Registry drift: {drift.join('; ')}.</li>{/if}
      {#each cube.warnings as w}<li class="mh-bad">{w}</li>{/each}
    </ul>
    <p class="mh-hint">To diagnose missing data, run <code>deno run -A scripts/evo-data-probe.ts</code> in irp-funnel-server (read-only).</p>

    <h4 class="mh-card__h" style="margin-top: 1rem">Allocation · intended vs actual</h4>
    <div class="evo-alloc">
      {#each lab.analyses as a}
        <div><p class="mh-strong">{a.def.title}</p><SplitBar arms={a.arms.map((k) => ({ key: k, label: armLabel(a.def, k), intended: a.srm?.expected[k] ?? 1 / a.arms.length, actual: a.assigned[k] ?? 0 }))} /></div>
      {/each}
    </div>

    <h4 class="mh-card__h" style="margin-top: 1rem">Drip emails · raw counts</h4>
    {#if cube.drip.length}
      <div class="mh-table-wrap"><table class="mh-table mh-table--compact">
        <thead><tr><th scope="col">Subject × body</th><th scope="col" class="num">Assignees</th><th scope="col" class="num">Email scheduled</th><th scope="col" class="num">Opened*</th><th scope="col" class="num">Clicked</th></tr></thead>
        <tbody>
          {#each [...new Set(cube.drip.map((d) => `${d.subject}|${d.body}`))] as key}
            {@const rs = cube.drip.filter((d) => `${d.subject}|${d.body}` === key)}
            <tr><th scope="row">{key.replace('|', ' × ')}</th><td class="num">{rs.length}</td><td class="num">{rs.filter((r) => r.reachedType).length}</td><td class="num">{rs.filter((r) => r.opened).length}</td><td class="num">{rs.filter((r) => r.clicked).length}</td></tr>
          {/each}
        </tbody>
      </table></div>
      <p class="mh-hint">*Apple Mail pre-loads images, so opens are overstated.</p>
    {:else}
      <p class="mh-empty">No drip assignments since the restart.</p>
    {/if}

    <h4 class="mh-card__h" style="margin-top: 1rem">Before Evo Lab (descriptive)</h4>
    {#if cube.legacy.rows.length}
      <div class="mh-table-wrap"><table class="mh-table mh-table--compact">
        <thead><tr><th scope="col">Component · variant</th><th scope="col" class="num">Visitors</th><th scope="col" class="num">Exposures</th><th scope="col" class="num">Interactions</th><th scope="col">Period</th></tr></thead>
        <tbody>{#each cube.legacy.rows as r}<tr><th scope="row">{r.componentKey} · {r.versionKey}</th><td class="num">{int(r.visitors)}</td><td class="num">{int(r.exposures)}</td><td class="num">{int(r.interactions)}</td><td>{r.firstAt?.slice(0, 10) ?? '—'} → {r.lastAt?.slice(0, 10) ?? '—'}</td></tr>{/each}</tbody>
      </table></div>
      <p class="mh-hint">Old events had unknown assignment odds and counted email opens as exposures, so they never reach verdicts.</p>
    {:else}
      <p class="mh-empty">No events from before the restart.</p>
    {/if}
  </div>
</details>
