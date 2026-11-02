<script lang="ts">
  /** Decisions log — what we decided, when, by whom, with the evidence at the time. */
  import type { EvoCube } from '../engine/types.ts';
  import { armLabel } from '../engine/join.ts';

  export let decisions: any[] = [];
  export let cube: EvoCube;
  export let onOpen: (key: string) => void;

  const WORD: Record<string, string> = { ship: 'Ship', keep_control: 'Keep control', stop: 'Stop', extend: 'Extend', investigate: 'Investigate', revert: 'Revert' };
  $: defOf = (k: string) => cube.experiments.find((d) => d.componentKey === k);
  $: rows = decisions.slice().sort((a, b) => String(b.at).localeCompare(String(a.at)));
  /** "Decided but still live in code": shipped / kept / stopped but both arms still active in the registry. */
  $: drift = rows.filter((d) => !d.revertedBy && ['ship', 'keep_control', 'stop'].includes(d.decision)).filter((d) => {
    const def = defOf(d.componentKey);
    return def && def.status === 'running' && def.variants.filter((v) => !v.retiredIn).length > 1;
  });
</script>

<section class="mh-section" id="evo-log" aria-labelledby="evo-log-h">
  <div class="mh-section__head">
    <div class="mh-section__title">
      <h3 class="mh-h" id="evo-log-h">Decisions log</h3>
      <p class="mh-sub">What we learned. A decision is a record; shipping is a code change (retire the losing version in the registry).</p>
    </div>
  </div>
  {#if drift.length}
    <div class="mh-alert mh-alert--warn"><span>Decided but still live in code: {drift.map((d) => defOf(d.componentKey)?.title).join(', ')}. Retire the other version in <code>API/evo/registry.ts</code> and <code>lib/evo/config.ts</code>.</span></div>
  {/if}
  {#if rows.length}
    <div class="mh-table-wrap">
      <table class="mh-table mh-table--compact">
        <thead><tr><th scope="col">When</th><th scope="col">Experiment</th><th scope="col">Decision</th><th scope="col">Evidence at the time</th><th scope="col">By</th><th scope="col">Note</th></tr></thead>
        <tbody>
          {#each rows as d}
            {@const def = defOf(d.componentKey)}
            <tr class:evo-reverted={d.revertedBy}>
              <th scope="row">{String(d.at).slice(0, 10)}</th>
              <td><button class="mh-link" on:click={() => onOpen(d.componentKey)}>{def?.title ?? d.componentKey}</button></td>
              <td>{WORD[d.decision] ?? d.decision}{d.variant && def ? ` · ${armLabel(def, d.variant)}` : ''}{d.revertedBy ? ' (reverted)' : ''}</td>
              <td>{d.snapshot?.evidence ?? '—'}</td>
              <td>{d.by}</td>
              <td>{d.note}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {:else}
    <p class="mh-empty">No decisions recorded yet. They appear here with the evidence as it stood.</p>
  {/if}
</section>
