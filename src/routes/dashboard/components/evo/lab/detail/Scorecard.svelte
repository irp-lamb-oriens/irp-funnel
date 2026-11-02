<script lang="ts">
  /**
   * Scorecard — metrics × arms. Primary first, then guardrails, then
   * secondary metrics (marked "not corrected for multiple metrics"). Each
   * cell: rate, mature n, maturing count; each non-control arm also shows
   * the change vs control in words, the likely range and the chance it's
   * better. Below the floor, probabilities are hidden.
   */
  import type { ExperimentAnalysis } from '../../engine/experiment.ts';
  import type { MetricResult } from '../../engine/types.ts';
  import { armLabel } from '../../engine/join.ts';
  import { metricDef } from '../../engine/metrics.ts';
  import { RULES } from '../../engine/rules.ts';
  import { chance, fmtMetricValue, int, money, pct, signedPct } from '../words.ts';

  export let a: ExperimentAnalysis;
  export let decision: ExperimentAnalysis;
  export let currency = 'USD';
  export let onPeople: (arm: string, metric: string) => void;

  let showInfo = false;
  $: hideProbs = ['too_early', 'data_problem'].includes(decision.decision.state);
  $: groups = [
    { title: 'Decides the test', rows: [a.primary] },
    { title: 'Guardrails (must not get worse)', rows: a.guardrails },
    { title: 'Other results · not corrected for multiple metrics', rows: a.secondary.filter((r) => r.arms.some((x) => x.n)) },
  ].filter((g) => g.rows.length);
  /** Secondary metrics nobody is old enough for yet: one line instead of a wall of dashes. */
  $: immature = a.secondary.filter((r) => r.arms.every((x) => !x.n) && r.arms.some((x) => x.maturing));

  function cmp(r: MetricResult, arm: string) { return r.comparisons.find((c) => c.arm === arm) ?? null; }
  function change(r: MetricResult, arm: string): string {
    const c = cmp(r, arm);
    if (!c || c.diff === null) return '';
    if (r.kind === 'mean') return `${c.diff >= 0 ? '+' : ''}${money(c.diff, currency)} vs control`;
    const up = c.diff > 0;
    return `${up ? '▲' : c.diff < 0 ? '▼' : '■'} ${signedPct(c.rel)} vs control`;
  }
</script>

<div class="mh-table-wrap">
  <table class="mh-table evo-score">
    <caption class="sr-only">Scorecard for {a.def.title}</caption>
    <thead>
      <tr>
        <th scope="col">Metric</th>
        {#each a.arms as k}<th scope="col" class="num">{armLabel(a.def, k)}{k === a.def.control ? ' (control)' : ''}</th>{/each}
      </tr>
    </thead>
    {#each groups as g}
      <tbody>
        <tr class="evo-score__group"><th scope="rowgroup" colspan={a.arms.length + 1}>{g.title}</th></tr>
        {#each g.rows as r (r.key)}
          <tr>
            <th scope="row">
              {r.label}
              <span class="evo-score__verb">{metricDef(r.key).verb}</span>
              {#if r.note}<span class="evo-score__note">{r.note}</span>{/if}
            </th>
            {#each a.arms as k}
              {@const cell = r.arms.find((x) => x.arm === k)}
              {@const c = cmp(r, k)}
              <td class="num evo-score__cell">
                <button class="evo-score__val" on:click={() => onPeople(k, r.key)} title="Show the people behind this number">{cell?.n ? fmtMetricValue(r, cell.rate, currency) : '—'}</button>
                <span class="evo-score__n">{cell ? `${int(cell.x)} of ${int(cell.n)}` : ''}{r.kind === 'mean' && cell ? ` · ${int(cell.nonZero ?? 0)} deals` : ''}</span>
                {#if cell?.maturing}<span class="evo-score__mat">+{int(cell.maturing)} maturing</span>{/if}
                {#if k !== a.def.control && c && c.diff !== null && !(c.diff === 0 && (cell?.x ?? 0) === 0)}
                  <span class="evo-score__chg" class:mh-good={(c.diff ?? 0) > 0 && r.key !== 'dropped'} class:mh-bad={(c.diff ?? 0) < 0 && r.key !== 'dropped'}>{change(r, k)}</span>
                  {#if !hideProbs && c.relCi}<span class="evo-score__ci">likely {signedPct(c.relCi.lo)} to {signedPct(c.relCi.hi)}</span>{/if}
                  {#if !hideProbs && c.pBeats !== null}<span class="evo-score__p">{chance(c.pBeats)} chance better</span>{/if}
                {/if}
              </td>
            {/each}
          </tr>
        {/each}
      </tbody>
    {/each}
  </table>
</div>

{#if immature.length}
  <p class="mh-hint">Not mature yet: {immature.map((r) => r.label).join(', ')}. These appear once visitors are old enough for the outcome to have happened.</p>
{/if}
{#if a.crossover}
  <p class="mh-hint">Sensitivity: {pct(a.crossover.share)} of visitors also saw the other version (a second device or cleared storage). Without them the primary change is {signedPct(a.crossover.primaryDiffWithout)}.</p>
{/if}
<button class="mh-link" aria-expanded={showInfo} on:click={() => (showInfo = !showInfo)}>{showInfo ? 'Hide' : 'How'} these numbers are made</button>
{#if showInfo}
  <div class="evo-howto">
    <p><b>Mature only.</b> A visitor counts for a metric only once enough time has passed for it to happen (7 days for clicks, the lead window for leads, plus 30–60 days for calls and deals). Younger visitors show as "maturing", never as failures.</p>
    <p><b>Chance better.</b> The probability, given the data so far, that this version's true rate is higher than the control's (a Bayesian posterior with a flat prior).</p>
    <p><b>Likely range.</b> A 95 % interval for the change vs control (Newcombe's method).</p>
    <p><b>Expected loss of shipping the leader:</b> {decision.primary.expectedLoss && decision.decision.leader ? `${pct(decision.primary.expectedLoss[decision.decision.leader] ?? null, 2)} of visitors on ${a.primary.label.toLowerCase()}` : '—'} — how much we'd likely give up if the leader is not actually the best.</p>
    <p><b>Decision rule</b> (weekly, all data): at least {RULES.minDays} days and {RULES.minConversions} conversions in the control and the leader; ship when the chance of being best and of beating control are both ≥ {Math.round(RULES.T_ship * 100)} % and the expected loss is below {Math.round(RULES.E_ship * 100)} % of the control rate. These thresholds were tuned by simulation so that two identical versions are declared different at most 5 % of the time, even with weekly looks.</p>
    <p class="mh-muted">Fixed-horizon p-values (Holm-adjusted, display only): {a.primary.comparisons.map((c) => `${armLabel(a.def, c.arm)} ${c.pHolm === null ? '—' : c.pHolm < 0.001 ? '< 0.001' : c.pHolm.toFixed(3)}`).join(' · ')}</p>
  </div>
{/if}
