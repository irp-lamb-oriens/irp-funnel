<script lang="ts">
  /**
   * "Inside every guide": the six chapters each country guide follows, as a
   * numbered spec sheet. A calm beat between the hero and the index. Rows
   * rise in one after another; on hover a teal rule draws across the top of
   * the chapter and its number turns teal.
   */
  import { reveal } from '../landing/reveal.ts';
  import { CHAPTERS } from '../../lib/data/guide-atlas.ts';
</script>

<section class="section" aria-labelledby="chapters-title">
  <div class="wrap split">
    <header class="head" use:reveal>
      <p class="eyebrow"><span class="dot" aria-hidden="true"></span>Inside every guide</p>
      <h2 class="title" id="chapters-title">Six chapters, in the same order for every country.</h2>
      <p class="body">Read one guide and you can read them all. Each one comes from the official customs requirements, condensed to what a family moving house needs.</p>
    </header>
    <ol class="list">
      {#each CHAPTERS as c, i}
        <li use:reveal style="--d:{i * 70}ms">
          <span class="n">0{i + 1}</span>
          <h3>{c.title}</h3>
          <p>{c.body}</p>
        </li>
      {/each}
    </ol>
  </div>
</section>

<style lang="scss">
  @use '../landing/tokens' as *;

  .section { @include section; & { background: $color-mist; } }
  .wrap { @include container; }
  .split { display: grid; gap: $space-12;
    @include lg { grid-template-columns: minmax(0, 0.8fr) minmax(0, 1.2fr); gap: $space-24; align-items: start; } }
  .head { display: flex; flex-direction: column; gap: $space-4; @include reveal(18px);
    @include lg { position: sticky; top: 140px; } }
  .eyebrow { @include eyebrow; display: inline-flex; align-items: center; gap: $space-2; }
  .dot { width: 6px; height: 6px; border-radius: 50%; background: $color-accent; }
  .title { @include heading-xl; max-width: 14ch; }
  .body { @include body; max-width: 42ch; }

  .list {
    list-style: none; margin: 0; padding: 0; display: grid; gap: 0 $space-8;
    @include md { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  }
  li {
    position: relative; display: grid; grid-template-columns: 44px 1fr; gap: 6px $space-3; padding: $space-6 0 $space-8;
    border-top: 1px solid $color-hairline-strong;
    @include reveal(22px, var(--d));
    &::before { content: ''; position: absolute; left: 0; right: 0; top: -1px; height: 2px; background: $color-accent; transform: scaleX(0); transform-origin: left; transition: transform 700ms $ease; }
    @include hover-only {
      &:hover::before { transform: scaleX(1); }
      &:hover .n { color: $color-accent-hover; transform: translateY(-2px); }
      &:hover h3 { transform: translateX(4px); }
    }
  }
  .n { grid-row: span 2; font: 0.78rem $font-mono; letter-spacing: 0.06em; color: $color-muted; padding-top: 6px; transition: color 300ms, transform 500ms $ease; }
  h3 { @include heading-md; transition: transform 500ms $ease; }
  p { @include body; font-size: 0.98rem; max-width: 36ch; }
</style>
