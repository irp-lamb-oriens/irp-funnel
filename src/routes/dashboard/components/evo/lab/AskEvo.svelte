<script lang="ts">
  /**
   * Ask Evo (spec §6.11) — a question becomes a validated query spec on the
   * server (LLM, with a rules fallback). The answer is the same view the page
   * already has, opened for you, plus "What I computed" in plain words. The
   * model never produces numbers.
   */
  import { askEvo } from '../../../store.ts';
  import { describeSpec, normalizeSpec, type AskSpec } from '../engine/ask.ts';
  import type { EvoCube } from '../engine/types.ts';
  import type { DetailTab } from './labState.ts';

  export let cube: EvoCube;
  export let onOpen: (key: string, tab?: DetailTab) => void;
  export let onFilter: (dim: string, value: string) => void;
  export let onPeriod: (p: string) => void;
  export let onWindow: (w: number) => void;
  export let onOps: () => void;

  const EXAMPLES = [
    'Which hero version gets more clicks?',
    'Is the closer persona hurting call bookings?',
    'Does the chatbot greeting work better on mobile?',
    'Do the hero copy and colour tests affect each other?',
    'When will the next test be decided?',
    'Is tracking working?',
  ];

  let q = '';
  let busy = false;
  let error = '';
  let answers: Array<{ q: string; spec: AskSpec; text: string }> = [];

  async function ask(question = q) {
    const text = question.trim();
    if (!text || busy) return;
    busy = true;
    error = '';
    try {
      const res = (await askEvo(text)) as { spec?: Partial<AskSpec>; source?: string };
      const spec = normalizeSpec(res?.spec, cube);
      answers = [{ q: text, spec, text: describeSpec(spec, cube) }, ...answers].slice(0, 5);
      q = '';
      go(spec);
    } catch (err: any) {
      error = err?.message ?? 'Ask Evo is unavailable right now.';
    } finally {
      busy = false;
    }
  }

  function go(s: AskSpec) {
    if (s.window) onWindow(s.window);
    for (const f of s.filters ?? []) for (const v of f.values) onFilter(f.dim, v);
    switch (s.view) {
      case 'health': return onOps();
      case 'interaction':
      case 'configs': return document.getElementById('evo-combos')?.scrollIntoView({ behavior: 'smooth' });
      case 'audience':
        if (s.experiment) onOpen(s.experiment, 'scorecard');
        return document.getElementById('evo-audiences')?.scrollIntoView({ behavior: 'smooth' });
      case 'drip': return onOpen(cube.experiments.find((d) => d.surface === 'email')?.componentKey ?? '', 'scorecard');
      case 'trend': return s.experiment && onOpen(s.experiment, 'time');
      case 'funnel': return s.experiment && onOpen(s.experiment, 'funnel');
      case 'people': return s.experiment && onOpen(s.experiment, 'people');
      default: return s.experiment && onOpen(s.experiment, 'scorecard');
    }
  }
  void onPeriod;
</script>

<section class="mh-section" id="evo-ask" aria-labelledby="evo-ask-h">
  <div class="mh-section__head">
    <div class="mh-section__title">
      <h3 class="mh-h" id="evo-ask-h">Ask Evo</h3>
      <p class="mh-sub">Ask in plain words; Evo opens the right view with the numbers already computed above.</p>
    </div>
  </div>
  <form class="evo-ask" on:submit|preventDefault={() => ask()}>
    <label class="sr-only" for="evo-ask-q">Question</label>
    <input id="evo-ask-q" class="mh-input" placeholder="e.g. Which hero version gets more leads on mobile?" bind:value={q} disabled={busy} maxlength="300" />
    <button class="mh-btn mh-btn--primary" type="submit" disabled={busy || !q.trim()}>{busy ? 'Thinking…' : 'Ask'}</button>
  </form>
  <div class="mh-filters evo-ask__examples">
    {#each EXAMPLES as e}<button class="mh-btn mh-btn--sm" on:click={() => ask(e)} disabled={busy}>{e}</button>{/each}
  </div>
  {#if error}<p class="mh-bad">{error}</p>{/if}
  {#each answers as a}
    <div class="mh-card evo-answer">
      <p class="mh-muted">“{a.q}”</p>
      <p><b>What I computed:</b> {a.text}</p>
      {#if a.spec.explanation.length}<p class="mh-hint">{a.spec.explanation.join(' · ')}</p>{/if}
      {#if a.spec.unresolved.length}<p class="mh-hint">Couldn't use: {a.spec.unresolved.join('; ')}</p>{/if}
      <button class="mh-link" on:click={() => go(a.spec)}>Open again</button>
    </div>
  {/each}
</section>
