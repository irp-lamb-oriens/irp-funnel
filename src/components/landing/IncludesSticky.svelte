<script lang="ts">
  import { reveal } from './reveal.ts';
  import SectionHead from './SectionHead.svelte';
  import { INCLUDES } from './content.ts';
</script>

<section class="section" id="includes" aria-labelledby="includes-title">
  <div class="wrap sticky">
    <div class="head">
      <SectionHead id="includes-title" eyebrow={INCLUDES.eyebrow} title={INCLUDES.title} lead={INCLUDES.lead} />
    </div>
    <ul class="list">
      {#each INCLUDES.items as f, i}
        <li class="item" use:reveal>
          <span class="index">{String(i + 1).padStart(2, '0')}</span>
          <h3>{f.title}</h3>
          <p>{f.body}</p>
        </li>
      {/each}
    </ul>
  </div>
</section>

<style lang="scss">
  @use './tokens' as *;

  .section { @include section; background: $color-mist; }
  .wrap { @include container; }
  .sticky {
    display: grid; gap: $space-8;
    @include lg { grid-template-columns: 0.9fr 1.1fr; gap: $space-24; align-items: start; }
  }
  .head { @include lg { position: sticky; top: 120px; } }
  .list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: $space-6; }
  .item {
    @include card;
    padding: clamp(1.75rem, 3vw, 2.5rem); display: flex; flex-direction: column; gap: $space-3;
    @include reveal(24px);
    &:nth-child(even) { @include lg { margin-inline-start: 12%; } }
    h3 { @include heading-md; font-size: clamp(1.375rem, 2vw, 1.75rem); }
    p { @include body; max-width: 56ch; }
  }
  .index { font-family: $font-mono; font-size: 0.75rem; color: $color-accent-hover; letter-spacing: 0.1em; }
</style>
