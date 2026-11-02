<script lang="ts">
  /**
   * SplitBar — intended vs actual traffic split, two stacked 100 % bars with
   * the share printed inside each segment (labels on the marks).
   */
  import { seriesColor } from './palette.ts';

  /** Dark ink on light fills, white on dark (WCAG relative luminance). */
  function inkOn(hex: string): string {
    const c = hex.replace('#', '');
    const ch = [0, 2, 4].map((i) => parseInt(c.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    const L = 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
    return L > 0.25 ? '#0f172a' : '#ffffff';
  }

  export let arms: Array<{ key: string; label: string; intended: number; actual: number }> = [];
  export let compact = false;
  $: total = arms.reduce((s, a) => s + a.actual, 0);
  const pctTxt = (v: number) => `${Math.round(v * 100)}%`;
  type Arm = (typeof arms)[number];
  function rowsOf(t: number): Array<{ k: 'Intended' | 'Actual'; f: (a: Arm) => number }> {
    return [
      { k: 'Intended', f: (a) => a.intended },
      { k: 'Actual', f: (a) => (t ? a.actual / t : 0) },
    ];
  }
</script>

<div class="sb" class:sb--compact={compact} role="img" aria-label="Traffic split: {arms.map((a) => `${a.label} intended ${pctTxt(a.intended)}, actual ${total ? pctTxt(a.actual / total) : '—'}`).join('; ')}">
  {#each rowsOf(total) as row}
    <div class="sb-row">
      <span class="sb-k">{row.k}</span>
      <div class="sb-bar">
        {#if row.k === 'Actual' && !total}
          <span class="sb-none">no visitors yet</span>
        {:else}
          {#each arms as a, i}
            {@const share = row.f(a)}
            {#if share > 0}
              <span class="sb-seg" style="width: {share * 100}%; background: {seriesColor(i)}; color: {inkOn(seriesColor(i))}" title="{a.label}: {pctTxt(share)}">
                {#if share >= 0.12}{compact ? pctTxt(share) : `${a.label} ${pctTxt(share)}`}{/if}
              </span>
            {/if}
          {/each}
        {/if}
      </div>
    </div>
  {/each}
</div>

<style>
  .sb { display: grid; gap: 4px; }
  .sb-row { display: grid; grid-template-columns: 58px 1fr; align-items: center; gap: 6px; }
  .sb-k { font-size: 0.64rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.06em; color: #94a3b8; }
  .sb-bar { display: flex; height: 18px; border-radius: 6px; overflow: hidden; background: #f1f5f9; }
  .sb--compact .sb-bar { height: 14px; }
  .sb-seg { display: inline-flex; align-items: center; justify-content: center; font-size: 0.66rem; font-weight: 700; white-space: nowrap; overflow: hidden; }
  .sb-none { font-size: 0.68rem; color: #94a3b8; padding: 0 0.4rem; line-height: 18px; }
</style>
