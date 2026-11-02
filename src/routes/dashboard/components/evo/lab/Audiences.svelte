<script lang="ts">
  /**
   * Audiences (spec §6.8) — who a version works for. Decision-grade effects
   * use only what we knew before the visitor saw the version (device,
   * language, landing source …). Lead fields (origin, budget …) are shown
   * separately, as description only.
   */
  import type { Lab } from '../engine/lab.ts';
  import { AUDIENCE_RULES, LEAD_DIMS, leadSplits } from '../engine/audiences.ts';
  import { armLabel } from '../engine/join.ts';
  import LockedPanel from './LockedPanel.svelte';
  import { int, pct, per100 } from './words.ts';

  export let lab: Lab;
  export let selected = '';
  export let onFilter: (dim: string, value: string) => void;
  export let windowDays = 30;
  export let currency = 'USD';

  let leadDim: (typeof LEAD_DIMS)[number]['key'] = 'origin';
  $: scan = lab.audiences;
  $: shown = scan.effects.filter((e) => e.significant);
  $: j = lab.joinedAll.find((x) => x.def.componentKey === selected && x.def.surface !== 'email');
  $: splits = j ? leadSplits(j, leadDim, { now: lab.options.now, windowDays, currency, leads: lab.leads }) : [];
  $: defOf = (k: string) => lab.joinedAll.find((x) => x.def.componentKey === k)!.def;
</script>

<section class="mh-section" id="evo-audiences" aria-labelledby="evo-audiences-h">
  <div class="mh-section__head">
    <div class="mh-section__title">
      <h3 class="mh-h" id="evo-audiences-h">Audiences</h3>
      <p class="mh-sub">Does a version work better for some visitors than others?</p>
    </div>
  </div>
  <div class="mh-grid-2">
    <div>
      <h4 class="mh-card__h">Decision-grade (known before the visit)</h4>
      {#if shown.length}
        <div class="mh-table-wrap"><table class="mh-table mh-table--compact">
          <thead><tr><th scope="col">Test · version</th><th scope="col">Audience</th><th scope="col" class="num">Effect inside</th><th scope="col" class="num">Elsewhere</th><th scope="col"></th></tr></thead>
          <tbody>
            {#each shown as e}
              <tr>
                <th scope="row">{defOf(e.componentKey).title} · {armLabel(defOf(e.componentKey), e.arm)}</th>
                <td>{e.dimLabel}: {e.value}</td>
                <td class="num">{per100(e.shrunkDiff)} per 100</td>
                <td class="num">{per100(e.outside.diff)} per 100</td>
                <td><button class="mh-link" on:click={() => onFilter(e.dim, e.value)}>Filter</button></td>
              </tr>
            {/each}
          </tbody>
        </table></div>
        <p class="mh-hint">{scan.tested} audience tests run; {shown.length} survive false-discovery control. Effects are shrunk toward the overall effect.</p>
      {:else if scan.tested}
        <p class="mh-empty">No audience-specific effect ({scan.tested} tests run). The versions work the same for everyone, as far as we can tell.</p>
      {/if}
      {#each scan.locked as l}
        <LockedPanel title="{defOf(l.componentKey).title}: audience check" need="Unlocks at {AUDIENCE_RULES.unlockConversions} conversions on the deciding metric, with {AUDIENCE_RULES.minPerArm}+ visitors per version in an audience." have={l.have} target={l.need} />
      {/each}
    </div>
    <div>
      <h4 class="mh-card__h">Among leads (description only)</h4>
      {#if j}
        <label class="mh-control"><span class="mh-label">Split {j.def.title} leads by</span>
          <select class="mh-input" bind:value={leadDim}>{#each LEAD_DIMS as d}<option value={d.key}>{d.label}</option>{/each}</select>
        </label>
        {#if splits.length}
          <div class="mh-table-wrap"><table class="mh-table mh-table--compact">
            <thead><tr><th scope="col">{LEAD_DIMS.find((d) => d.key === leadDim)?.label}</th>{#each Object.keys(splits[0].arms) as k}<th scope="col" class="num">{armLabel(j.def, k)} leads · won</th>{/each}</tr></thead>
            <tbody>{#each splits.slice(0, 10) as r}<tr><th scope="row">{r.value}</th>{#each Object.values(r.arms) as c}<td class="num">{int(c.leads)} · {c.leads ? pct(c.won / c.leads, 0) : '—'}</td>{/each}</tr>{/each}</tbody>
          </table></div>
        {:else}
          <p class="mh-empty">No leads credited to this test yet.</p>
        {/if}
        <p class="mh-hint">The version can change who becomes a lead, so these splits describe the leads; they don't prove a version works better for an origin or budget.</p>
      {:else}
        <p class="mh-empty">Select a web or chat experiment above.</p>
      {/if}
    </div>
  </div>
</section>
