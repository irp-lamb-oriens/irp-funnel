<script lang="ts">
  import { reveal } from './reveal.ts';
  import { PROBLEM } from './content.ts';
</script>

<section class="section" id="problem" aria-labelledby="problem-title">
  <div class="wrap grid">
    <div class="head" use:reveal>
      <p class="eyebrow"><span class="dot" aria-hidden="true"></span>{PROBLEM.eyebrow}</p>
      <h2 class="title" id="problem-title">{PROBLEM.title}</h2>
      <p class="lead">{PROBLEM.lead}</p>
    </div>
    <ol class="beats">
      {#each PROBLEM.beats as b, i}
        <li class="beat" use:reveal style="--d:{i * 70}ms">
          <span class="tag">{String(i + 1).padStart(2, '0')} · {b.tag}</span>
          <h3>{b.title}</h3>
          <p>{b.body}</p>
        </li>
      {/each}
    </ol>
  </div>
</section>

<style lang="scss">
  @use './tokens' as *;

  .section { @include section; background: $color-canvas; }
  .wrap { @include container; }
  .grid {
    display: grid; gap: $space-12;
    @include lg { grid-template-columns: 5fr 7fr; gap: $space-24; align-items: start; }
  }
  .head {
    display: flex; flex-direction: column; gap: $space-6;
    @include reveal;
    @include lg { position: sticky; top: 120px; }
  }
  .eyebrow { @include eyebrow; display: inline-flex; align-items: center; gap: $space-2; }
  .dot { width: 6px; height: 6px; border-radius: 50%; background: $color-red; }
  .title { @include heading-xl; }
  .lead { @include body; font-size: 1.125rem; max-width: 46ch; }

  .beats { list-style: none; margin: 0; padding: 0; display: grid; gap: $space-4; @include md { grid-template-columns: 1fr 1fr; } }
  .beat {
    @include card;
    padding: clamp(1.5rem, 3vw, 2.25rem);
    display: flex; flex-direction: column; gap: $space-3;
    @include reveal(20px, var(--d));
    &:nth-child(even) { @include md { transform-origin: top; margin-top: $space-12; } }
    h3 { @include heading-md; }
    p { @include body; font-size: 1rem; }
  }
  .tag { font-family: $font-mono; font-size: 0.75rem; letter-spacing: 0.1em; text-transform: uppercase; color: $color-muted; }
</style>
