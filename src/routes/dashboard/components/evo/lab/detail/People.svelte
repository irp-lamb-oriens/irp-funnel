<script lang="ts">
  /**
   * People — who is behind a number. Leads are listed by name (opens the
   * client); anonymous visitors are counted by context, never listed.
   */
  import type { LeadFact } from '../../../metrics/engine/types.ts';
  import type { ExperimentAnalysis } from '../../engine/experiment.ts';
  import { armLabel, DAY_MS, type JoinedExperiment } from '../../engine/join.ts';
  import { metricDef } from '../../engine/metrics.ts';
  import { int } from '../words.ts';

  export let a: ExperimentAnalysis;
  export let joined: JoinedExperiment;
  export let leads: Map<string, LeadFact>;
  export let filter: { arm: string; metric: string } | null = null;
  export let onOpenClient: (id: string) => void;
  export let onClear: () => void;
  export let windowDays = 30;
  export let currency = 'USD';
  export let now = Date.now();

  let limit = 50;
  $: m = filter ? metricDef(filter.metric) : null;
  $: units = joined.units.filter((u) => {
    if (filter && u.arm !== filter.arm) return false;
    if (!m) return true;
    const lead = u.leadId ? leads.get(u.leadId) ?? null : null;
    const v = m.value(u, lead, { W: windowDays, currency });
    return v !== null && v > 0 && u.t + m.lag(windowDays) * DAY_MS <= now;
  });
  $: named = units.filter((u) => u.leadId && leads.get(u.leadId)).map((u) => ({ u, l: leads.get(u.leadId!)! }));
  $: anon = units.length - named.length;
  $: byDevice = (() => { const c = new Map<string, number>(); for (const u of units) if (!u.leadId) c.set(u.ctx?.device ?? 'unknown', (c.get(u.ctx?.device ?? 'unknown') ?? 0) + 1); return [...c.entries()].sort((x, y) => y[1] - x[1]); })();
</script>

<div class="mh-section__head">
  <p class="mh-sub">{filter ? `${armLabel(a.def, filter.arm)} · ${m?.verb}` : 'Everyone in this experiment'}: {int(units.length)} people</p>
  {#if filter}<button class="mh-btn mh-btn--sm" on:click={onClear}>Show everyone</button>{/if}
</div>
{#if named.length}
  <div class="mh-table-wrap">
    <table class="mh-table mh-table--compact">
      <thead><tr><th scope="col">Lead</th><th scope="col">Arm</th><th scope="col">First visit</th><th scope="col">Stage</th><th scope="col">Route</th><th scope="col"></th></tr></thead>
      <tbody>
        {#each named.slice(0, limit) as r}
          <tr>
            <th scope="row">{r.l.name}</th>
            <td>{armLabel(a.def, r.u.arm)}</td>
            <td>{r.u.day}</td>
            <td>{r.l.stageLabel ?? r.l.status}</td>
            <td>{r.l.route}</td>
            <td><button class="mh-link" on:click={() => onOpenClient(r.l.id)}>Open</button></td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
  {#if named.length > limit}<button class="mh-btn mh-btn--sm" on:click={() => (limit += 50)}>Show 50 more ({named.length - limit} left)</button>{/if}
{/if}
{#if anon}
  <p class="mh-hint">Plus {int(anon)} anonymous visitor{anon === 1 ? '' : 's'} (never listed): {byDevice.map(([d, n]) => `${d} ${n}`).join(' · ')}.</p>
{/if}
{#if !units.length}<p class="mh-empty">Nobody yet.</p>{/if}
