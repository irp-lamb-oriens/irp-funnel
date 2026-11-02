<script lang="ts">
  /**
   * TrendChart — columns and/or lines over an ordered x axis (months).
   *
   * One y axis only (dataviz rule): every series shares the same unit. Pass a
   * second measure of a different unit as its own chart.
   *   - `kind: 'bar'` series are grouped side by side (or stacked with `stacked`)
   *   - `kind: 'line'` series draw over the bars
   * Hover / focus a column band for a tooltip with every series. Enter or click
   * dispatches `select` with the x index (the Hub turns it into a filter).
   * `showTable` swaps the chart for an accessible table of the same numbers.
   */
  import { createEventDispatcher } from 'svelte';
  import type { TrendSeries } from './types.ts';
  import { niceTicks, compact, seriesColor } from './palette.ts';


  export let labels: string[] = [];
  export let series: TrendSeries[] = [];
  export let format: (n: number) => string = (n) => compact(n);
  export let height = 220;
  export let stacked = false;
  export let showTable = false;
  export let caption = '';
  export let selectable = false;
  /** Index to emphasise (e.g. the current month). */
  export let highlight: number | null = null;

  const dispatch = createEventDispatcher<{ select: { index: number; label: string } }>();

  let width = 600;
  const M = { top: 12, right: 12, bottom: 26, left: 48 };

  $: bars = series.filter((s) => (s.kind ?? 'bar') === 'bar');
  $: lines = series.filter((s) => s.kind === 'line');
  $: n = labels.length;
  $: innerW = Math.max(40, width - M.left - M.right);
  $: innerH = Math.max(40, height - M.top - M.bottom);
  $: band = n ? innerW / n : innerW;

  $: maxVal = (() => {
    let m = 0;
    for (let i = 0; i < n; i++) {
      if (stacked) {
        let s = 0;
        for (const b of bars) s += Math.max(0, b.values[i] ?? 0);
        m = Math.max(m, s);
      } else for (const b of bars) m = Math.max(m, b.values[i] ?? 0);
      for (const l of lines) m = Math.max(m, l.values[i] ?? 0);
    }
    return m;
  })();
  $: ticks = niceTicks(maxVal);
  $: top = ticks[ticks.length - 1] || 1;
  const y = (v: number, t: number, h: number) => M.top + h - (Math.max(0, v) / t) * h;

  $: groupW = Math.min(band * 0.72, stacked ? 28 : bars.length * 22 + (bars.length - 1) * 2);
  $: barW = stacked ? groupW : Math.max(2, Math.min(24, (groupW - (bars.length - 1) * 2) / Math.max(1, bars.length)));

  function colTop(x: number, yy: number, w: number, h: number, r = 4): string {
    if (h <= 0) return '';
    const rr = Math.min(r, w / 2, h);
    return `M${x},${yy + h} L${x},${yy + rr} Q${x},${yy} ${x + rr},${yy} L${x + w - rr},${yy} Q${x + w},${yy} ${x + w},${yy + rr} L${x + w},${yy + h} Z`;
  }

  // Label thinning: show at most ~1 label per 56px.
  $: every = Math.max(1, Math.ceil((56 * n) / innerW));

  let hi: number | null = null;
  $: tip = hi === null ? null : {
    x: M.left + band * hi + band / 2,
    rows: series.map((s, si) => ({ label: s.label, color: s.color ?? seriesColor(si), v: s.values[hi as number] })),
  };

  function pick(i: number) {
    if (selectable) dispatch('select', { index: i, label: labels[i] });
  }
  function key(e: KeyboardEvent, i: number) {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(i); }
  }
</script>

{#if showTable}
  <div class="tc-table-wrap">
    <table class="mh-table mh-table--compact">
      {#if caption}<caption class="sr-only">{caption}</caption>{/if}
      <thead><tr><th scope="col">Period</th>{#each series as s}<th scope="col" class="num">{s.label}</th>{/each}</tr></thead>
      <tbody>
        {#each labels as l, i}
          <tr><th scope="row">{l}</th>{#each series as s}<td class="num">{s.values[i] === null || s.values[i] === undefined ? '—' : format(s.values[i] ?? 0)}</td>{/each}</tr>
        {/each}
      </tbody>
    </table>
  </div>
{:else}
  <div class="tc" bind:clientWidth={width} style="height:{height}px">
    {#if series.length > 1}
      <ul class="tc-legend" aria-hidden="true">
        {#each series as s, si}
          <li><span class="tc-key" class:tc-key--line={s.kind === 'line'} style="background:{s.color ?? seriesColor(si)}"></span>{s.label}</li>
        {/each}
      </ul>
    {/if}
    <svg width={width} height={height} role="img" aria-label={caption}>
      {#each ticks as t}
        <line x1={M.left} x2={M.left + innerW} y1={y(t, top, innerH)} y2={y(t, top, innerH)} class="tc-grid" />
        <text x={M.left - 8} y={y(t, top, innerH)} class="tc-tick" text-anchor="end" dominant-baseline="middle">{format(t)}</text>
      {/each}

      {#each labels as l, i}
        {@const cx = M.left + band * i + band / 2}
        {#if highlight === i}
          <rect x={M.left + band * i} y={M.top} width={band} height={innerH} class="tc-now" />
        {/if}
        {#if stacked}
          {@const segs = (() => { let acc = 0; return bars.map((b, bi) => { const v = Math.max(0, b.values[i] ?? 0); const s = { bi, v, from: acc }; acc += v; return s; }); })()}
          {#each segs as s}
            {#if s.v > 0}
              {@const y1 = y(s.from + s.v, top, innerH)}
              {@const y0 = y(s.from, top, innerH)}
              {@const isTop = segs.slice(s.bi + 1).every((z) => z.v <= 0)}
              <path
                d={isTop ? colTop(cx - barW / 2, y1, barW, Math.max(0, y0 - y1 - (s.from > 0 ? 2 : 0))) : `M${cx - barW / 2},${y1} h${barW} v${Math.max(0, y0 - y1 - (s.from > 0 ? 2 : 0))} h${-barW} Z`}
                fill={bars[s.bi].color ?? seriesColor(series.indexOf(bars[s.bi]))}
                opacity={hi === null || hi === i ? 1 : 0.55}
              />
            {/if}
          {/each}
        {:else}
          {#each bars as b, bi}
            {@const v = b.values[i] ?? 0}
            {@const x0 = cx - groupW / 2 + bi * (barW + 2)}
            {@const y1 = y(v, top, innerH)}
            <path d={colTop(x0, y1, barW, M.top + innerH - y1)} fill={b.color ?? seriesColor(series.indexOf(b))} opacity={hi === null || hi === i ? 1 : 0.55} />
          {/each}
        {/if}
        {#if i % every === 0 || i === n - 1}
          <text x={cx} y={height - 8} class="tc-label" text-anchor="middle">{l}</text>
        {/if}
      {/each}

      {#each lines as s}
        {@const si = series.indexOf(s)}
        {@const pts = s.values.map((v, i) => (v === null || v === undefined ? null : [M.left + band * i + band / 2, y(v, top, innerH)]))}
        <path
          d={pts.map((p, i) => (p ? `${i && pts[i - 1] ? 'L' : 'M'}${p[0]},${p[1]}` : '')).join(' ')}
          fill="none" stroke={s.color ?? seriesColor(si)} stroke-width="2" stroke-linejoin="round" stroke-linecap="round"
        />
        {#each pts as p, i}
          {#if p && (i === hi || i === pts.length - 1)}
            <circle cx={p[0]} cy={p[1]} r="4" fill={s.color ?? seriesColor(si)} stroke="#fff" stroke-width="2" />
          {/if}
        {/each}
      {/each}

      <line x1={M.left} x2={M.left + innerW} y1={M.top + innerH} y2={M.top + innerH} class="tc-axis" />

      {#each labels as l, i}
        <rect
          x={M.left + band * i} y={M.top} width={band} height={innerH} class="tc-hit" class:tc-hit--click={selectable}
          role={selectable ? 'button' : 'img'}
          tabindex={selectable ? 0 : undefined}
          aria-label="{l}: {series.map((s) => `${s.label} ${s.values[i] === null || s.values[i] === undefined ? 'none' : format(s.values[i] ?? 0)}`).join(', ')}"
          on:mouseenter={() => (hi = i)} on:mouseleave={() => (hi = null)}
          on:focus={() => (hi = i)} on:blur={() => (hi = null)}
          on:click={() => pick(i)} on:keydown={(e) => key(e, i)}
        />
      {/each}
    </svg>
    {#if tip && hi !== null}
      <div class="tc-tip" style="left:{Math.min(Math.max(tip.x, 90), width - 90)}px" aria-hidden="true">
        <div class="tc-tip__title">{labels[hi]}</div>
        {#each tip.rows as r}
          <div class="tc-tip__row"><span class="tc-key" style="background:{r.color}"></span><span>{r.label}</span><strong>{r.v === null || r.v === undefined ? '—' : format(r.v)}</strong></div>
        {/each}
        {#if selectable}<div class="tc-tip__hint">Click to filter to this period</div>{/if}
      </div>
    {/if}
  </div>
{/if}

<style>
  .tc { position: relative; width: 100%; min-width: 0; }
  .tc svg { display: block; overflow: visible; }
  .tc-grid { stroke: #eef2f6; stroke-width: 1; }
  .tc-axis { stroke: #cbd5e1; stroke-width: 1; }
  .tc-tick, .tc-label { font-size: 10.5px; fill: #64748b; font-variant-numeric: tabular-nums; }
  .tc-now { fill: rgba(2, 181, 187, 0.06); }
  .tc-hit { fill: transparent; outline: none; }
  .tc-hit--click { cursor: pointer; }
  .tc-hit:focus-visible { stroke: #02b5bb; stroke-width: 2; }
  .tc-legend { position: absolute; top: -22px; right: 0; display: flex; gap: 0.8rem; list-style: none; margin: 0; padding: 0; font-size: 0.72rem; color: #475569; flex-wrap: wrap; justify-content: flex-end; }
  .tc-legend li { display: inline-flex; align-items: center; gap: 0.35rem; }
  .tc-key { display: inline-block; width: 10px; height: 10px; border-radius: 3px; flex: none; }
  .tc-key--line { height: 3px; border-radius: 2px; }
  .tc-tip {
    position: absolute; top: 4px; transform: translateX(-50%); pointer-events: none; z-index: 3;
    min-width: 150px; padding: 0.5rem 0.65rem; background: #0f172a; color: #f8fafc; border-radius: 10px;
    font-size: 0.74rem; box-shadow: 0 8px 24px rgba(15, 23, 42, 0.25);
  }
  .tc-tip__title { font-weight: 800; margin-bottom: 0.3rem; }
  .tc-tip__row { display: grid; grid-template-columns: 10px 1fr auto; gap: 0.45rem; align-items: center; line-height: 1.5; }
  .tc-tip__row strong { font-variant-numeric: tabular-nums; }
  .tc-tip__hint { margin-top: 0.3rem; color: #94a3b8; font-size: 0.68rem; }
  .tc-table-wrap { overflow-x: auto; max-height: 360px; }
  .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
</style>
