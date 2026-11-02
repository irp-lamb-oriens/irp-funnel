<script lang="ts">
  /**
   * Decisions waiting — experiments whose Monday verdict needs a person:
   * Ready to ship, Keep control, No meaningful difference, Guardrail hold,
   * Data problem. One sentence, one evidence line, two buttons.
   */
  import type { ExperimentAnalysis } from '../engine/experiment.ts';
  import { STATE_LABEL } from '../engine/rules.ts';
  import { evidence, STATE_ACTION, STATE_TONE } from './words.ts';

  export let waiting: ExperimentAnalysis[] = [];
  export let isAdmin = false;
  export let onOpen: (key: string) => void;
  export let onRecord: (a: ExperimentAnalysis) => void;
</script>

<section class="mh-section" id="evo-decisions" aria-labelledby="evo-decisions-h">
  <div class="mh-section__head">
    <div class="mh-section__title">
      <h3 class="mh-h" id="evo-decisions-h">Decisions waiting</h3>
      <p class="mh-sub">{waiting.length ? `${waiting.length} experiment${waiting.length === 1 ? '' : 's'} need${waiting.length === 1 ? 's' : ''} a decision.` : 'Nothing to decide yet.'}</p>
    </div>
    <p class="mh-hint">Verdicts are fixed each Monday 06:00 Costa Rica on all data, so they can't be fished out of a filter or a lucky day.</p>
  </div>
  {#if !waiting.length}
    <p class="mh-empty">When an experiment reaches a verdict it appears here with what to do.</p>
  {:else}
    <div class="evo-cards">
      {#each waiting as a (a.def.componentKey)}
        <article class="evo-decision evo-decision--{STATE_TONE[a.decision.state]}">
          <div class="evo-decision__top">
            <span class="evo-state evo-state--{STATE_TONE[a.decision.state]}">{STATE_LABEL[a.decision.state]}</span>
            <span class="mh-muted">{a.def.title}</span>
          </div>
          <p class="evo-decision__reason">{a.decision.reason}</p>
          <p class="evo-decision__ev">{evidence(a)}</p>
          {#if a.decision.unevaluable.length && a.decision.state === 'ready'}
            <p class="evo-decision__warn">Shipping without a check on {a.decision.unevaluable.join(', ').toLowerCase()} (not enough data yet).</p>
          {/if}
          {#if a.novelty?.fading}<p class="evo-decision__warn">The effect was larger in the first week than since. It may be fading.</p>{/if}
          <p class="evo-decision__do"><b>What to do:</b> {STATE_ACTION[a.decision.state]}</p>
          <div class="evo-decision__btns">
            <button class="mh-btn mh-btn--sm" on:click={() => onOpen(a.def.componentKey)}>Open</button>
            {#if isAdmin}<button class="mh-btn mh-btn--sm mh-btn--primary" on:click={() => onRecord(a)}>Record decision</button>{/if}
          </div>
        </article>
      {/each}
    </div>
  {/if}
</section>
