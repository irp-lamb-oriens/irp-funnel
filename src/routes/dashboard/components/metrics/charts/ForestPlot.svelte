<script lang="ts">
  /**
   * ForestPlot — one row per arm: the point estimate and its interval as a
   * bar on a shared axis, with a reference line (the control). Labels sit on
   * the rows (never colour alone) and a real table is always rendered under
   * it for screen readers and exact numbers. Scrolls inside its container on
   * narrow screens.
   */
  import { seriesColor } from './palette.ts';

  export let rows: Array<{ key: string; label: string; value: number | null; lo: number | null; hi: number | null; display: string; range: string; control?: boolean }> = [];
  export let reference: number | null = null;
  export let referenceLabel = 'Control';
  export let format: (v: number) => string = (v) => `${Math.round(v * 1000) / 10}%`;
  export let caption = '';

  const W = 520, ROW = 30, LEFT = 150, RIGHT = 70, TOP = 18;
  $: vals = rows.flatMap((r) => [r.value, r.lo, r.hi]).filter((v): v is number => v !== null && Number.isFinite(v));
  $: lo0 = Math.min(...vals, reference ?? Infinity);
  $: hi0 = Math.max(...vals, reference ?? -Infinity);
  $: pad = (hi0 - lo0) * 0.08 || Math.abs(hi0) * 0.1 || 0.01;
  $: dLo = Number.isFinite(lo0) ? lo0 - pad : 0;
  $: dHi = Number.isFinite(hi0) ? hi0 + pad : 1;
  $: x = (v: number) => LEFT + ((v - dLo) / (dHi - dLo || 1)) * (W - LEFT - RIGHT);
  $: H = TOP + rows.length * ROW + 18;
</script>

<figure class="fp">
  <div class="fp-scroll">
    <svg viewBox="0 0 {W} {H}" width="100%" style="min-width: 320px" role="img" aria-label={caption || 'Estimates with intervals'}>
      {#if reference !== null && Number.isFinite(reference)}
        <line x1={x(reference)} x2={x(reference)} y1={TOP - 8} y2={H - 14} stroke="#94a3b8" stroke-dasharray="3 3" />
        <text x={x(reference)} y={TOP - 10} text-anchor="middle" class="fp-ref">{referenceLabel}</text>
      {/if}
      {#each rows as r, i}
        {@const y = TOP + i * ROW + ROW / 2}
        <text x={LEFT - 8} y={y + 4} text-anchor="end" class="fp-label">{r.label}</text>
        {#if r.lo !== null && r.hi !== null}
          <line x1={x(r.lo)} x2={x(r.hi)} y1={y} y2={y} stroke={seriesColor(i)} stroke-width="6" stroke-linecap="round" opacity="0.35" />
        {/if}
        {#if r.value !== null}
          <circle cx={x(r.value)} cy={y} r={r.control ? 5 : 6} fill={r.control ? '#fff' : seriesColor(i)} stroke={seriesColor(i)} stroke-width="2.5" />
        {/if}
        <text x={W - RIGHT + 8} y={y + 4} class="fp-val">{r.display}</text>
      {/each}
      <text x={LEFT} y={H - 2} class="fp-axis">{format(dLo)}</text>
      <text x={W - RIGHT} y={H - 2} text-anchor="end" class="fp-axis">{format(dHi)}</text>
    </svg>
  </div>
  <table class="mh-table mh-table--compact fp-table">
    {#if caption}<caption class="sr-only">{caption}</caption>{/if}
    <thead><tr><th scope="col">Arm</th><th scope="col" class="num">Estimate</th><th scope="col" class="num">Likely range</th></tr></thead>
    <tbody>
      {#each rows as r}
        <tr><th scope="row">{r.label}{r.control ? ' (control)' : ''}</th><td class="num">{r.display}</td><td class="num">{r.range}</td></tr>
      {/each}
    </tbody>
  </table>
</figure>

<style>
  .fp { margin: 0; min-width: 0; max-width: 100%; }
  .fp-scroll { overflow-x: auto; }
  .fp-label { font-size: 12px; font-weight: 700; fill: #0f172a; }
  .fp-val { font-size: 12px; font-weight: 700; fill: #334155; font-variant-numeric: tabular-nums; }
  .fp-ref, .fp-axis { font-size: 10px; fill: #94a3b8; font-weight: 600; }
  .fp-table { margin-top: 0.4rem; }
  .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
</style>
