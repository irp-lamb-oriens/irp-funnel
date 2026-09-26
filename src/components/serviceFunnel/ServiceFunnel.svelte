<script lang="ts">
  /**
   * ServiceFunnel.svelte — the centralized, slot-based shell every service
   * funnel renders inside.
   *
   * One wrapper owns the modern header chrome (eyebrow pill, gradient title,
   * lead paragraph) and a padded content slot, so every sub-brand funnel
   * (Legal, Immigration, Realty, Moving) shares one visual language instead of
   * each hand-rolling its own card. The inner content is injected via the
   * default <slot/>; an optional CTA row is injected via the named "cta" slot.
   *
   * Styling is SCSS-module only, consuming the global tokens from
   * styles/everything.scss (--color-highlight-2, $radius-*, $shadow-*,
   * color-mix halos) so it stays cohesive with the portal's existing
   * .cp-destination-service / cover-letter / video-testimonials surfaces.
   * Respects prefers-reduced-motion.
   */
  export let eyebrow: string = '';
  export let title: string = '';
  export let lead: string = '';
  /** Optional emoji/icon rendered beside the eyebrow. */
  export let icon: string = '';
  /** Optional accent override (hex). Defaults to the brand teal. */
  export let accent: string = '';
</script>

<section class="sf" style={accent ? `--sf-accent: ${accent};` : ''}>
  <header class="sf__head">
    {#if eyebrow}
      <p class="sf__eyebrow">
        {#if icon}<span class="sf__eyebrow-icon" aria-hidden="true">{icon}</span>{/if}
        {eyebrow}
      </p>
    {/if}
    {#if title}
      <h2 class="sf__title">{title}</h2>
    {/if}
    {#if lead}
      <p class="sf__lead">{lead}</p>
    {/if}
  </header>

  <div class="sf__body">
    <slot />
  </div>

  <div class="sf__cta">
    <slot name="cta" />
  </div>
</section>

<style lang="scss">
  .sf {
    --sf-accent: var(--color-highlight-2, #02b5bb);
    --sf-accent-rgb: 2, 181, 187;
    font-family: var(--font-paragraph, 'Jost'), system-ui, sans-serif;
    color: #1a1a2e;
    width: 100%;
  }

  .sf__head {
    margin-bottom: 1.75rem;
  }

  .sf__eyebrow {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    margin: 0 0 0.7rem;
    font-size: 0.7rem;
    font-weight: 700;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: var(--sf-accent);
  }

  .sf__eyebrow-icon {
    font-size: 1rem;
    line-height: 1;
  }

  .sf__title {
    margin: 0 0 0.6rem;
    font-family: var(--font-title, 'Kiona Regular', serif);
    font-size: clamp(1.6rem, 2.6vw, 2.1rem);
    font-weight: 700;
    letter-spacing: -0.02em;
    color: var(--color-foreground, #181818);
  }

  .sf__lead {
    margin: 0;
    color: #475569;
    line-height: 1.6;
    max-width: 62ch;
  }

  .sf__body {
    // Inner content owns its own rhythm; the shell only guarantees a clean
    // padded canvas with a subtle top hairline separating it from the header.
    padding-top: 1.5rem;
    border-top: 1px solid rgba(var(--sf-accent-rgb), 0.14);
  }

  .sf__cta {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    text-align: center;
    padding-top: 1.5rem;
    margin-top: 1.5rem;
    border-top: 1px solid rgba(var(--sf-accent-rgb), 0.14);

    &:empty {
      display: none;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .sf__eyebrow-icon {
      animation: none;
    }
  }
</style>