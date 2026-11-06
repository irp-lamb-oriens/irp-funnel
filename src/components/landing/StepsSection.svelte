<script lang="ts">
  import { reveal } from './reveal.ts';
  import SectionHead from './SectionHead.svelte';
  import { STEPS } from './content.ts';
</script>

<section class="section" id="how" aria-labelledby="how-title">
  <div class="wrap">
    <SectionHead id="how-title" eyebrow={STEPS.eyebrow} title={STEPS.title} />
    <ol class="steps">
      {#each STEPS.items as s, i}
        <li class="step" use:reveal style="--d:{i * 90}ms">
          <span class="num" aria-hidden="true">{i + 1}</span>
          <h3>{s.title}</h3>
          <p>{s.body}</p>
        </li>
      {/each}
    </ol>
  </div>
</section>

<style lang="scss">
  @use './tokens' as *;

  .section { @include section; background: $color-accent-soft; }
  .wrap { @include container; }
  .steps {
    list-style: none; margin: 0; padding: 0;
    display: grid; gap: $space-8; position: relative;
    @include md { grid-template-columns: repeat(2, 1fr); }
    @include lg {
      grid-template-columns: repeat(4, 1fr); gap: $space-6;
      &::before {
        content: ''; position: absolute; top: 22px; left: 22px; right: 22px; height: 1px;
        background: $color-hairline-strong;
      }
    }
  }
  .step {
    position: relative; display: flex; flex-direction: column; gap: $space-3;
    @include reveal(18px, var(--d));
    h3 { @include heading-md; margin-top: $space-4; }
    p { @include body; font-size: 1rem; max-width: 34ch; }
  }
  .num {
    width: 44px; height: 44px; border-radius: 50%;
    display: grid; place-items: center;
    background: $color-canvas; border: 1px solid $color-hairline-strong;
    font-family: $font-mono; font-weight: 700; color: $color-ink-strong;
    position: relative; z-index: 1;
  }
  .step:first-child .num { background: $color-accent; border-color: $color-accent; }
</style>
