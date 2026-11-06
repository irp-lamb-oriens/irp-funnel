<script lang="ts">
  import { reveal } from './reveal.ts';
  import SectionHead from './SectionHead.svelte';
  import { SERVICES } from './content.ts';
</script>

<section class="section" id="services" aria-labelledby="services-title">
  <div class="wrap">
    <SectionHead id="services-title" eyebrow={SERVICES.eyebrow} title={SERVICES.title} />
    <ul class="grid">
      {#each SERVICES.items as s, i}
        <li class="card" class:feature={!!s.image} use:reveal style="--d:{i * 70}ms">
          {#if s.image}
            <div class="media"><img src={s.image} alt="" loading="lazy" decoding="async" /></div>
          {/if}
          <div class="body">
            <span class="tag">{s.tag}</span>
            <h3>{s.title}</h3>
            <p>{s.body}</p>
            <a class="link" href={s.href}>{s.cta} <span aria-hidden="true">→</span></a>
          </div>
        </li>
      {/each}
    </ul>
  </div>
</section>

<style lang="scss">
  @use './tokens' as *;

  .section { @include section; background: $color-canvas; }
  .wrap { @include container; }
  .grid {
    list-style: none; margin: 0; padding: 0;
    display: grid; gap: $space-6;
    @include md { grid-template-columns: repeat(2, 1fr); }
  }
  .card {
    @include card;
    overflow: hidden; display: flex; flex-direction: column;
    @include reveal(20px, var(--d));
    @include hover-only { &:global(.is-in):hover { transform: translateY(-4px); } }
  }
  .media {
    aspect-ratio: 16 / 9; overflow: hidden; background: $color-mist;
    img { width: 100%; height: 100%; object-fit: cover; display: block; transition: transform 900ms $ease; }
  }
  @include hover-only { .card:hover .media img { transform: scale(1.04); } }
  .body { padding: clamp(1.5rem, 3vw, 2.25rem); display: flex; flex-direction: column; gap: $space-3; flex: 1; }
  .tag { font-family: $font-mono; font-size: 0.72rem; letter-spacing: 0.12em; text-transform: uppercase; color: $color-accent-hover; }
  h3 { @include heading-md; }
  p { @include body; font-size: 1rem; flex: 1; }
  .link {
    margin-top: $space-2; align-self: flex-start;
    font-family: $font-sans; font-weight: 700; color: $color-ink-strong; text-decoration: none;
    border-bottom: 2px solid $color-accent; padding-bottom: 2px;
    @include focus-ring;
  }
</style>
