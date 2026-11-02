<script lang="ts">
  /**
   * Sparkline — tiny trend for KPI tiles. Decorative next to a printed value,
   * so it carries an aria-label summary instead of focusable points.
   * The last point (current period) is drawn in the accent, the rest muted.
   */
  export let values: number[] = [];
  export let width = 120;
  export let height = 32;
  export let label = '';
  export let color = '#00a3aa';

  $: max = Math.max(...values, 0);
  $: min = Math.min(...values, 0);
  $: span = max - min || 1;
  $: step = values.length > 1 ? (width - 6) / (values.length - 1) : 0;
  $: pts = values.map((v, i) => [3 + i * step, height - 3 - ((v - min) / span) * (height - 6)] as [number, number]);
  $: path = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  $: area = pts.length ? `${path} L${pts[pts.length - 1][0].toFixed(1)},${height - 3} L${pts[0][0].toFixed(1)},${height - 3} Z` : '';
  $: last = pts[pts.length - 1];
</script>

{#if values.length > 1}
  <svg class="spark" viewBox="0 0 {width} {height}" width={width} height={height} role="img" aria-label={label}>
    <path d={area} fill={color} opacity="0.1" />
    <path d={path} fill="none" stroke="#94a3b8" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round" />
    {#if last}
      <circle cx={last[0]} cy={last[1]} r="3.5" fill={color} stroke="#fff" stroke-width="2" />
    {/if}
  </svg>
{/if}

<style>
  .spark { display: block; overflow: visible; }
</style>
