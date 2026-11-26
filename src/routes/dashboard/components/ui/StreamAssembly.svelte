<!--
  StreamAssembly — the loading screen for data that is built in steps on the
  server (the Evo cube). Each step lights up as the server reports it: a
  pulsing node while it runs, a check drawn in when it is done, its count
  rolling up. A mosaic above fills with overall progress.

  Steps: { key, label, unit?, state: 'waiting' | 'active' | 'done' | 'failed', count? }
-->
<script lang="ts" context="module">
  export interface AssemblyStep {
    key: string;
    label: string;
    unit?: string;
    state: 'waiting' | 'active' | 'done' | 'failed';
    count?: number;
  }
</script>

<script lang="ts">
  import AnimatedNumber from './AnimatedNumber.svelte';

  export let title: string;
  export let steps: AssemblyStep[];

  const TILES = 28;
  const weight = { waiting: 0, active: 0.45, done: 1, failed: 1 } as const;

  $: progress = steps.length ? steps.reduce((n, s) => n + weight[s.state], 0) / steps.length : 0;
  $: lit = Math.round(progress * TILES);
  $: current = steps.find((s) => s.state === 'active');
  $: finished = steps.filter((s) => s.state === 'done').length;
  $: summary = current ? `${current.label}. ${finished} of ${steps.length} steps done.` : `${finished} of ${steps.length} steps done.`;
</script>

<div class="sa" role="status" aria-live="polite">
  <div class="sa__head">
    <p class="sa__title">{title}</p>
    {#key current?.key}
      <p class="sa__now">{current ? current.label : 'Almost there'}</p>
    {/key}
  </div>

  <div class="sa__mosaic" aria-hidden="true">
    {#each Array(TILES) as _, i}
      <span class="sa__tile" class:is-on={i < lit} style="--i: {i}"></span>
    {/each}
  </div>

  <ol class="sa__steps">
    {#each steps as s, i (s.key)}
      <li class="sa__step sa__step--{s.state}" style="--i: {i}">
        <span class="sa__node" aria-hidden="true">
          <svg viewBox="0 0 16 16" class="sa__mark">
            {#if s.state === 'failed'}
              <path d="M5 5l6 6M11 5l-6 6" />
            {:else}
              <path d="M4 8.5l2.6 2.5L12 5.5" />
            {/if}
          </svg>
        </span>
        <span class="sa__label">{s.label}</span>
        <span class="sa__count">
          {#if s.count !== undefined}<AnimatedNumber value={s.count} />{#if s.unit}&nbsp;{s.unit}{/if}{/if}
        </span>
      </li>
    {/each}
  </ol>
  <p class="sa__sr">{summary}</p>
</div>

<style>
  .sa {
    position: relative;
    max-width: 560px;
    margin: var(--irp-sp-6) auto;
    padding: var(--irp-sp-6);
    background: var(--irp-surface);
    border: 1px solid var(--irp-border);
    border-radius: var(--irp-r-xl);
    overflow: hidden;
    animation: sa-rise 520ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
  }
  /* A slow light sweep across the card while it works. */
  .sa::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(105deg, transparent 35%, var(--irp-accent-subtle) 50%, transparent 65%);
    transform: translateX(-100%);
    animation: sa-sweep 2.8s ease-in-out infinite;
    pointer-events: none;
  }
  .sa__head { display: flex; align-items: baseline; justify-content: space-between; gap: var(--irp-sp-3); margin-bottom: var(--irp-sp-4); }
  .sa__title { margin: 0; font-size: var(--irp-fs-lg); font-weight: 700; color: var(--irp-text); }
  .sa__now { margin: 0; font-size: var(--irp-fs-sm); color: var(--irp-accent-ink); animation: sa-fade 360ms ease both; }

  .sa__mosaic { display: grid; grid-template-columns: repeat(14, 1fr); gap: 4px; margin-bottom: var(--irp-sp-5); }
  .sa__tile {
    height: 8px;
    border-radius: var(--irp-r-2xs);
    background: var(--irp-surface-3);
    transform: scaleY(0.5);
    transition: background 420ms ease, transform 420ms cubic-bezier(0.34, 1.56, 0.64, 1);
    transition-delay: calc(var(--i) * 18ms);
  }
  .sa__tile.is-on { background: var(--irp-accent); transform: scaleY(1); }

  .sa__steps { list-style: none; margin: 0; padding: 0; position: relative; }
  .sa__step {
    position: relative;
    display: grid;
    grid-template-columns: 22px 1fr auto;
    align-items: center;
    gap: var(--irp-sp-3);
    padding: var(--irp-sp-2) 0;
    color: var(--irp-text-dim);
    animation: sa-rise 440ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
    animation-delay: calc(120ms + var(--i) * 70ms);
    transition: color 300ms ease;
  }
  /* The rail between nodes fills as each step finishes. */
  .sa__step:not(:last-child)::before {
    content: '';
    position: absolute;
    left: 10px;
    top: calc(50% + 11px);
    width: 2px;
    height: calc(100% - 22px);
    background: var(--irp-line);
  }
  .sa__step:not(:last-child)::after {
    content: '';
    position: absolute;
    left: 10px;
    top: calc(50% + 11px);
    width: 2px;
    height: calc(100% - 22px);
    background: var(--irp-accent);
    transform-origin: top;
    transform: scaleY(0);
    transition: transform 520ms cubic-bezier(0.2, 0.8, 0.2, 1);
  }
  .sa__step--done:not(:last-child)::after { transform: scaleY(1); }

  .sa__node {
    position: relative;
    width: 22px;
    height: 22px;
    border-radius: var(--irp-r-full);
    border: 2px solid var(--irp-line-strong);
    background: var(--irp-surface);
    display: grid;
    place-items: center;
    transition: border-color 300ms ease, background 300ms ease;
  }
  .sa__mark { width: 14px; height: 14px; fill: none; stroke: var(--irp-text-inverse); stroke-width: 2.2; stroke-linecap: round; stroke-linejoin: round; stroke-dasharray: 16; stroke-dashoffset: 16; }

  .sa__step--active { color: var(--irp-text); }
  .sa__step--active .sa__node { border-color: var(--irp-accent); }
  .sa__step--active .sa__node::after {
    content: '';
    position: absolute;
    inset: -2px;
    border-radius: var(--irp-r-full);
    border: 2px solid var(--irp-accent);
    animation: sa-ripple 1.4s ease-out infinite;
  }
  .sa__step--done { color: var(--irp-text-2); }
  .sa__step--done .sa__node { border-color: var(--irp-accent); background: var(--irp-accent); animation: sa-pop 380ms cubic-bezier(0.34, 1.56, 0.64, 1); }
  .sa__step--done .sa__mark { animation: sa-draw 420ms 120ms ease forwards; }
  .sa__step--failed { color: var(--irp-danger-ink); }
  .sa__step--failed .sa__node { border-color: var(--irp-danger); background: var(--irp-danger); }
  .sa__step--failed .sa__mark { stroke-dashoffset: 0; }

  .sa__label { font-size: var(--irp-fs-md); }
  .sa__count { font-size: var(--irp-fs-sm); color: var(--irp-text-muted); white-space: nowrap; }
  .sa__sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; margin: 0; }

  @keyframes sa-rise { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
  @keyframes sa-fade { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
  @keyframes sa-sweep { to { transform: translateX(100%); } }
  @keyframes sa-ripple { from { opacity: 0.7; transform: scale(1); } to { opacity: 0; transform: scale(1.9); } }
  @keyframes sa-pop { 0% { transform: scale(0.7); } 100% { transform: scale(1); } }
  @keyframes sa-draw { to { stroke-dashoffset: 0; } }

  @media (prefers-reduced-motion: reduce) {
    .sa, .sa__step, .sa__now, .sa__step--done .sa__node { animation: none; }
    .sa::after, .sa__step--active .sa__node::after { display: none; }
    .sa__step--done .sa__mark { animation: none; stroke-dashoffset: 0; }
    .sa__tile, .sa__step::after, .sa__step:not(:last-child)::after { transition: none; }
  }
</style>
