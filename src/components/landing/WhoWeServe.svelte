<script lang="ts">
  import { reveal, goToBooking } from './reveal.ts';
  import SectionHead from './SectionHead.svelte';
  import { WHO } from './content.ts';
</script>

<section class="section" id="who" aria-labelledby="who-title">
  <div class="wrap">
    <SectionHead id="who-title" eyebrow={WHO.eyebrow} title={WHO.title} />
    <ol class="rows">
      {#each WHO.rows as r, i}
        <li class="row" use:reveal>
          <span class="index">{String(i + 1).padStart(2, '0')}</span>
          <h3>{r.who}</h3>
          <p>{r.body}</p>
        </li>
      {/each}
    </ol>
    <a class="primary" href="#hero-form" on:click={goToBooking}>{WHO.cta}</a>
  </div>
</section>

<style lang="scss">
  @use './tokens' as *;

  .section { @include section; background: $color-canvas; }
  .wrap { @include container; }
  .rows { list-style: none; margin: 0 0 $space-12; padding: 0; border-top: 1px solid $color-hairline; }
  .row {
    display: grid; gap: $space-3; padding-block: $space-8; border-bottom: 1px solid $color-hairline;
    @include reveal(18px);
    @include md { grid-template-columns: 80px minmax(0, 4fr) minmax(0, 6fr); gap: $space-8; align-items: baseline; padding-block: $space-12; }
    h3 { @include heading-md; font-size: clamp(1.5rem, 2.6vw, 2.1rem); }
    p { @include body; font-size: 1.0625rem; max-width: 52ch; }
  }
  .index { font-family: $font-mono; font-size: 0.8rem; color: $color-muted; }
  .primary { @include button-primary; }
</style>
