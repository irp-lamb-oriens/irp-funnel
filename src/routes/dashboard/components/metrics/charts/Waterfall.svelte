<script lang="ts">
  /**
   * Waterfall — a running total as horizontal floating bars (the money
   * bridge, sales-book-v3 §6.3). It is a real <table>: every step prints its
   * signed value, so the bar is never the only carrier. Totals are drawn in
   * the accent, additions in teal, subtractions in neutral; a step can be
   * clicked to open its deals.
   */
  import { createEventDispatcher } from 'svelte';

  export let steps: Array<{ key: string; label: string; value: number; kind: 'total' | 'add' | 'sub'; status?: string }> = [];
  export let format: (n: number) => string = (n) => n.toLocaleString('en-US');
  export let caption = '';
  /** Step keys that can be clicked. */
  export let selectable: string[] = [];

  const dispatch = createEventDispatcher<{ select: { key: string } }>();

  $: spans = (() => {
    let run = 0;
    return steps.map((s) => {
      let a: number, b: number;
      if (s.kind === 'total') { a = 0; b = s.value; run = s.value; }
      else if (s.kind === 'add') { a = run; b = run + s.value; run = b; }
      else { a = run - s.value; b = run; run = a; }
      return { ...s, lo: Math.min(a, b), hi: Math.max(a, b) };
    });
  })();
  $: max = Math.max(1, ...spans.map((s) => s.hi));
  $: min = Math.min(0, ...spans.map((s) => s.lo));
  const pctOf = (v: number) => ((v - min) / (max - min || 1)) * 100;
</script>

<div class="wf-wrap">
  <table class="wf">
    {#if caption}<caption class="sr-only">{caption}</caption>{/if}
    <thead><tr><th scope="col">Step</th><th scope="col" class="wf-barcol"><span class="sr-only">Bar</span></th><th scope="col" class="num">Amount</th></tr></thead>
    <tbody>
      {#each spans as s (s.key)}
        <tr class="wf-row wf-row--{s.kind}" class:wf-row--risk={s.status === 'dropped'}>
          <th scope="row">
            {#if selectable.includes(s.key)}
              <button class="wf-pick" on:click={() => dispatch('select', { key: s.key })}>{s.label}</button>
            {:else}{s.label}{/if}
          </th>
          <td class="wf-barcol" aria-hidden="true">
            <span class="wf-track"><span class="wf-bar" style="left:{pctOf(s.lo)}%;width:{Math.max(0.6, pctOf(s.hi) - pctOf(s.lo))}%"></span></span>
          </td>
          <td class="num">{s.kind === 'sub' ? '−' : s.kind === 'add' ? '+' : ''}{format(s.value)}</td>
        </tr>
      {/each}
    </tbody>
  </table>
</div>

<style>
  .wf-wrap { overflow-x: auto; }
  .wf { width: 100%; border-collapse: collapse; font-size: 0.8rem; font-variant-numeric: tabular-nums; }
  .wf thead { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
  .wf th[scope='row'] { text-align: left; font-weight: 600; color: #334155; padding: 0.38rem 0.8rem 0.38rem 0; white-space: nowrap; width: 1%; }
  .wf td { padding: 0.38rem 0; }
  .wf .num { text-align: right; font-weight: 700; color: #0f172a; padding-left: 0.8rem; white-space: nowrap; width: 1%; }
  .wf-barcol { width: auto; min-width: 140px; }
  @media (max-width: 640px) {
    .wf th[scope='row'] { white-space: normal; width: 42%; }
    .wf-barcol { min-width: 48px; }
  }
  .wf-track { position: relative; display: block; height: 14px; background: #f8fafc; border-radius: 4px; }
  .wf-bar { position: absolute; top: 0; bottom: 0; border-radius: 4px; background: #94a3b8; }
  .wf-row--total .wf-bar { background: #0b878c; }
  .wf-row--total th[scope='row'], .wf-row--total .num { font-weight: 800; color: #0f172a; }
  .wf-row--add .wf-bar { background: #52c6c9; }
  .wf-row--sub .wf-bar { background: #cbd5e1; }
  .wf-row--risk .wf-bar { background: repeating-linear-gradient(45deg, #fca5a5 0 4px, #fee2e2 4px 8px); }
  .wf-pick { all: unset; cursor: pointer; text-decoration: underline; text-decoration-color: rgba(2, 181, 187, 0.45); text-underline-offset: 3px; }
  .wf-pick:focus-visible { outline: 2px solid #02b5bb; outline-offset: 2px; border-radius: 3px; }
  .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
</style>
