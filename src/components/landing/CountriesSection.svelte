<script lang="ts">
  import { reveal } from './reveal.ts';
  import SectionHead from './SectionHead.svelte';
  import { COUNTRIES } from './content.ts';
</script>

<section class="section" id="countries" aria-labelledby="countries-title">
  <div class="wrap">
    <SectionHead id="countries-title" eyebrow={COUNTRIES.eyebrow} title={COUNTRIES.title} lead={COUNTRIES.lead} dark />
    <ul class="list">
      {#each COUNTRIES.list as c, i}
        <li use:reveal style="--d:{i * 60}ms">
          <a href={c.href}>
            <span class="name">{c.name}</span>
            {#if c.tours}<span class="pill">Tours</span>{/if}
            <span class="arrow" aria-hidden="true">→</span>
          </a>
        </li>
      {/each}
    </ul>
  </div>
</section>

<style lang="scss">
  @use './tokens' as *;

  .section { @include section; background: $color-ink-strong; }
  .wrap { @include container; }
  .list {
    list-style: none; margin: 0; padding: 0;
    border-top: 1px solid $color-on-dark-hairline;
    display: grid; @include md { grid-template-columns: 1fr 1fr; column-gap: $space-12; }
    li { border-bottom: 1px solid $color-on-dark-hairline; @include reveal(14px, var(--d)); }
  }
  a {
    display: flex; align-items: center; gap: $space-4;
    padding-block: $space-6; text-decoration: none; color: $color-on-dark;
    @include focus-ring;
    &:hover .arrow { transform: translateX(6px); color: $color-accent; }
    &:hover .name { color: $color-accent; }
  }
  .name {
    font-family: $font-sans; font-weight: 700; letter-spacing: -0.03em;
    font-size: clamp(1.9rem, 4.4vw, 3.4rem); line-height: 1; transition: color 200ms;
  }
  .pill {
    font-family: $font-mono; font-size: 0.68rem; letter-spacing: 0.12em; text-transform: uppercase;
    border: 1px solid $color-accent; color: $color-accent; border-radius: $radius-pill; padding: 4px 10px;
  }
  .arrow { margin-left: auto; font-size: 1.5rem; transition: transform 300ms $ease, color 200ms; }
</style>
