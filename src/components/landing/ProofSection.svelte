<script lang="ts">
  import { reveal } from './reveal.ts';
  import SectionHead from './SectionHead.svelte';
  import { googleReviews } from '../../lib/reviews.ts';
  import { PROOF } from './content.ts';
</script>

<section class="section" id="reviews" aria-labelledby="reviews-title">
  <div class="wrap">
    <SectionHead id="reviews-title" eyebrow={PROOF.eyebrow} title={PROOF.title} />

    <figure class="video" use:reveal>
      <!-- preload="metadata": only the first frame until the visitor presses play. -->
      <video controls playsinline preload="metadata" src={PROOF.videoSrc} aria-label={PROOF.videoTitle}></video>
      <figcaption>{PROOF.videoTitle}</figcaption>
    </figure>

    <p class="reviews-lead"><span class="stars" aria-hidden="true">★★★★★</span>{PROOF.reviewsLead}</p>
    <ul class="wall">
      {#each googleReviews as r, i}
        <li class="quote" use:reveal style="--d:{(i % 3) * 80}ms">
          <blockquote>{r.quote}</blockquote>
          <div class="who">
            <span class="name">{r.name}</span>
            <span class="route">{r.route}</span>
          </div>
          <a class="source" href={r.link} target="_blank" rel="noopener">Read on Google <span aria-hidden="true">↗</span></a>
        </li>
      {/each}
    </ul>
  </div>
</section>

<style lang="scss">
  @use './tokens' as *;

  .section { @include section; background: $color-canvas; }
  .wrap { @include container; }
  .video {
    margin: 0 0 $space-16; @include reveal(24px);
    video { width: 100%; max-height: 72vh; border-radius: $radius-lg; background: $color-ink-strong; display: block; object-fit: cover; }
    figcaption { margin-top: $space-3; font-family: $font-mono; font-size: 0.75rem; letter-spacing: 0.1em; text-transform: uppercase; color: $color-muted; }
  }
  .reviews-lead { @include body; display: flex; align-items: center; gap: $space-3; margin-bottom: $space-6; color: $color-ink-strong; font-weight: 600; }
  .stars { color: #f5a623; letter-spacing: 2px; }
  .wall {
    list-style: none; margin: 0; padding: 0;
    columns: 1; column-gap: $space-6;
    @include md { columns: 2; }
    @include lg { columns: 3; }
  }
  .quote {
    @include card; break-inside: avoid; margin-bottom: $space-6;
    padding: $space-8; display: flex; flex-direction: column; gap: $space-4;
    @include reveal(18px, var(--d));
  }
  blockquote { margin: 0; font-family: $font-sans; font-size: 1.0625rem; line-height: 1.6; color: $color-ink; }
  .who { display: flex; flex-direction: column; gap: 2px; }
  .name { font-family: $font-sans; font-weight: 700; color: $color-ink-strong; }
  .route { font-family: $font-sans; font-size: 0.875rem; color: $color-muted; }
  .source { font-family: $font-sans; font-size: 0.85rem; color: $color-accent-hover; text-decoration: none; font-weight: 600; @include focus-ring; }
</style>
