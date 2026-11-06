<script lang="ts">
  import { reveal } from './reveal.ts';
  import SectionHead from './SectionHead.svelte';
  import { TIMELINE } from './content.ts';
</script>

<section class="band" id="timeline" aria-labelledby="timeline-title">
  <div class="wrap grid">
    <div class="head">
      <SectionHead id="timeline-title" eyebrow={TIMELINE.eyebrow} title={TIMELINE.title} lead={TIMELINE.body} />
    </div>
    <figure class="panel" use:reveal aria-label="Example project timeline">
      <div class="panel-head">
        <p class="project">Project timeline</p>
        <span class="progress" aria-hidden="true"><span style="width: 50%"></span></span>
      </div>
      <ol class="steps">
        {#each TIMELINE.steps as s, i}
          <li class="step {s.state}" style="--d:{200 + i * 140}ms">
            <span class="marker" aria-hidden="true">{s.state === 'done' ? '✓' : ''}</span>
            <span class="title">{s.title}</span>
            <span class="meta">{s.meta}</span>
          </li>
        {/each}
      </ol>
    </figure>
  </div>
</section>

<style lang="scss">
  @use './tokens' as *;

  .band { @include section; background: $color-canvas; }
  .wrap { @include container; }
  .grid {
    display: grid; gap: $space-8; align-items: start;
    @include lg { grid-template-columns: minmax(0, 5fr) minmax(0, 7fr); gap: $space-16; }
  }
  .head { @include lg { position: sticky; top: 120px; } }
  .panel {
    @include card; margin: 0; padding: clamp(1.5rem, 3vw, 2.5rem);
    opacity: 0; transform: translateY(16px);
    transition: opacity 700ms $ease, transform 900ms $ease;
    &:global(.is-in) { opacity: 1; transform: none; }
  }
  .panel-head { display: flex; align-items: center; gap: $space-4; margin-bottom: $space-6; }
  .project { font-family: $font-mono; font-size: 0.75rem; letter-spacing: 0.12em; text-transform: uppercase; color: $color-ink-strong; margin: 0; }
  .progress {
    flex: 1; height: 6px; border-radius: 99px; background: $color-mist; overflow: hidden;
    span { display: block; height: 100%; background: $color-accent; border-radius: inherit; }
  }
  .steps { list-style: none; margin: 0; padding: 0; position: relative; }
  .step {
    position: relative; display: grid; grid-template-columns: 32px 1fr auto; align-items: center; gap: $space-4;
    padding-block: $space-4; border-bottom: 1px solid $color-hairline;
    opacity: 0; transform: translateX(-8px);
    transition: opacity 400ms $ease var(--d), transform 500ms $ease var(--d);
    &:last-child { border-bottom: none; }
  }
  .panel:global(.is-in) .step { opacity: 1; transform: none; }
  .marker {
    width: 28px; height: 28px; border-radius: 50%; display: grid; place-items: center;
    border: 1px solid $color-hairline-strong; font-size: 0.8rem; color: $color-ink-strong;
  }
  .done .marker { background: $color-accent; border-color: $color-accent; }
  .now .marker { border: 2px solid $color-accent; box-shadow: 0 0 0 5px rgba(2, 181, 187, 0.18); }
  .title { font-family: $font-sans; font-weight: 600; color: $color-ink-strong; }
  .next .title { color: $color-muted; font-weight: 500; }
  .meta { font-family: $font-mono; font-size: 0.72rem; letter-spacing: 0.08em; text-transform: uppercase; color: $color-muted; }
  .now .meta { color: $color-accent-hover; }
  @include reduced-motion { .panel, .step { opacity: 1; transform: none; transition: none; } }
</style>
