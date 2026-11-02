<script lang="ts">
  /**
   * Clients — the actual won and paid deals per arm. At IRP's volume money
   * per arm is read deal by deal, not as a statistic (spec §6.5.3).
   */
  import type { LeadFact } from '../../../metrics/engine/types.ts';
  import type { ExperimentAnalysis } from '../../engine/experiment.ts';
  import { armLabel, type JoinedExperiment } from '../../engine/join.ts';
  import { int, money } from '../words.ts';

  export let a: ExperimentAnalysis;
  export let joined: JoinedExperiment;
  export let leads: Map<string, LeadFact>;
  export let currency = 'USD';
  export let onOpenClient: (id: string) => void;

  $: rows = joined.units
    .filter((u) => u.leadId)
    .map((u) => ({ u, l: leads.get(u.leadId!) }))
    .filter((x): x is { u: (typeof x)['u']; l: LeadFact } => !!x.l && (x.l.won || x.l.paid))
    .sort((x, y) => (y.l.money?.[currency]?.booked ?? 0) - (x.l.money?.[currency]?.booked ?? 0));
  $: perArm = a.arms.map((k) => {
    const rs = rows.filter((r) => r.u.arm === k);
    return { k, deals: rs.length, booked: rs.reduce((s, r) => s + (r.l.money?.[currency]?.booked ?? 0), 0), other: rs.filter((r) => !r.l.money?.[currency]).length };
  });
  $: moneyMetric = [...a.guardrails, ...a.secondary].find((m) => m.key === 'bookedPerVisitor');
  $: enough = perArm.every((p) => p.deals >= 10);
</script>

<div class="evo-clients">
  <div class="mh-grid-2">
    {#each perArm as p}
      <div class="mh-card">
        <h4 class="mh-card__h">{armLabel(a.def, p.k)}{p.k === a.def.control ? ' (control)' : ''}</h4>
        <p class="evo-big">{int(p.deals)} <span>won deals</span></p>
        <p class="mh-muted">{money(p.booked, currency)} booked{p.other ? ` · ${p.other} in another currency` : ''}</p>
      </div>
    {/each}
  </div>
  {#if !enough}
    <p class="mh-hint">Fewer than 10 deals per arm, so no money statistics are shown — read the deals below instead. {moneyMetric ? '' : ''}</p>
  {/if}
  {#if rows.length}
    <div class="mh-table-wrap">
      <table class="mh-table mh-table--compact">
        <thead><tr><th scope="col">Client</th><th scope="col">Arm</th><th scope="col">Status</th><th scope="col" class="num">Booked</th><th scope="col" class="num">Days to close</th><th scope="col"></th></tr></thead>
        <tbody>
          {#each rows as r}
            <tr>
              <th scope="row">{r.l.name}</th>
              <td>{armLabel(a.def, r.u.arm)}</td>
              <td>{r.l.paid ? 'Paid' : 'Won'}{r.l.stageLabel ? ` · ${r.l.stageLabel}` : ''}</td>
              <td class="num">{r.l.money?.[currency] ? money(r.l.money[currency].booked, currency) : r.l.dealCurrency ?? '—'}</td>
              <td class="num">{r.l.daysToClose ?? '—'}</td>
              <td><button class="mh-link" on:click={() => onOpenClient(r.l.id)}>Open</button></td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {:else}
    <p class="mh-empty">No tested visitor has become a client yet.</p>
  {/if}
</div>
