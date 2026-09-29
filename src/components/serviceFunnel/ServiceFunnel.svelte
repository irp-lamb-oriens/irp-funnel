<script lang="ts">
  /**
   * ServiceFunnel.svelte — the centralized, slot-based shell every service
   * funnel renders inside.
   *
   * One wrapper owns the editorial header chrome (index chip, eyebrow pill,
   * oversized display title, lead paragraph with a left hairline rule) and a
   * padded content slot, so every sub-brand funnel (Legal, Immigration, Realty,
   * Moving) shares one visual language instead of each hand-rolling its own
   * card. The inner content is injected via the default <slot/>; an optional
   * CTA row is injected via the named "cta" slot.
   *
   * Design leans editorial / Gutenberg / awwwards: an overscale condensed
   * display title, a hairline kicker row, a full-bleed top rule, and a
   * ghost index numeral rendered behind the content. All styling is SCSS-only,
   * consumed from the global tokens (--color-highlight-2, --color-highlight-1,
   * --font-title/--font-subtitle/--font-paragraph). Respects
   * prefers-reduced-motion.
   */
  export let eyebrow: string = '';
  export let title: string = '';
  export let lead: string = '';
  /** Optional emoji/icon rendered beside the eyebrow. */
  export let icon: string = '';
  /** Optional accent override (hex). Defaults to the brand teal. */
  export let accent: string = '';
  /** Editorial index, e.g. "01". Rendered as a ghost numeral + chip. */
  export let index: string = '';
  /** Short metadata line, e.g. the mother brand. Rendered in the kicker row. */
  export let brand: string = '';
</script>

<section class="sf" style={accent ? `--sf-accent: ${accent};` : ''}>
  {#if index}
    <span class="sf__ghost" aria-hidden="true">{index}</span>
  {/if}

  <header class="sf__head">
    <div class="sf__kicker">
      {#if icon}<span class="sf__icon" aria-hidden="true">{icon}</span>{/if}
      {#if index}<span class="sf__chip">№ {index}</span>{/if}
      {#if eyebrow}<span class="sf__eyebrow">{eyebrow}</span>{/if}
      <span class="sf__kicker-rule" aria-hidden="true"></span>
      {#if brand}<span class="sf__brand">{brand}</span>{/if}
    </div>

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
    --sf-crimson: var(--color-highlight-1, #c62426);
    font-family: var(--font-paragraph, 'Jost'), system-ui, sans-serif;
    color: #1a1a2e;
    width: 100%;
    position: relative;
    isolation: isolate;
  }

  /* Ghost editorial numeral — a massive, hairline-outlined figure sitting
     behind the composition. Pure decoration; never intercepts pointer. */
  .sf__ghost {
    position: absolute;
    top: -0.06em;
    right: -0.02em;
    z-index: -1;
    font-family: var(--font-subtitle, 'Spartan Black', serif);
    font-size: clamp(7rem, 18vw, 15rem);
    line-height: 0.8;
    font-weight: 900;
    letter-spacing: -0.04em;
    color: transparent;
    -webkit-text-stroke: 1px rgba(var(--sf-accent-rgb), 0.14);
    pointer-events: none;
    user-select: none;
  }

  .sf__head {
    padding-bottom: 2.25rem;
    border-bottom: 1px solid rgba(15, 23, 42, 0.08);
  }

  .sf__kicker {
    display: flex;
    align-items: center;
    gap: 0.7rem;
    margin-bottom: 1.6rem;
    flex-wrap: wrap;
  }

  .sf__icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 42px;
    height: 42px;
    border-radius: 13px;
    font-size: 1.2rem;
    background: rgba(var(--sf-accent-rgb), 0.1);
    border: 1px solid rgba(var(--sf-accent-rgb), 0.18);
  }

  .sf__chip {
    font-family: var(--font-subtitle, 'Spartan Black', serif);
    font-size: 0.66rem;
    font-weight: 700;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    padding: 0.3rem 0.65rem;
    border-radius: 999px;
    color: var(--sf-accent);
    border: 1px solid rgba(var(--sf-accent-rgb), 0.32);
    background: rgba(var(--sf-accent-rgb), 0.06);
  }

  .sf__eyebrow {
    margin: 0;
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: var(--color-foreground, #181818);
  }

  .sf__kicker-rule {
    flex: 1;
    min-width: 24px;
    height: 1px;
    background: linear-gradient(
      90deg,
      rgba(var(--sf-accent-rgb), 0.35),
      rgba(var(--sf-accent-rgb), 0)
    );
  }

  .sf__brand {
    font-size: 0.7rem;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: #94a3b8;
  }

  .sf__title {
    margin: 0 0 1.1rem;
    font-family: var(--font-title, 'Kiona Regular', serif);
    font-size: clamp(2.1rem, 5.2vw, 4rem);
    line-height: 0.98;
    font-weight: 700;
    letter-spacing: -0.03em;
    color: var(--color-foreground, #181818);
    max-width: 18ch;
    text-wrap: balance;
  }

  .sf__lead {
    margin: 0;
    padding-left: 1.25rem;
    border-left: 3px solid var(--sf-accent);
    color: #475569;
    line-height: 1.65;
    font-size: 1.02rem;
    max-width: 62ch;
    text-wrap: pretty;
  }

  .sf__body {
    padding-top: 2.25rem;
  }

  .sf__cta {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    text-align: center;
    padding-top: 2rem;
    margin-top: 2.25rem;
    border-top: 1px solid rgba(15, 23, 42, 0.08);

    &:empty {
      display: none;
    }
  }

  @media (max-width: 640px) {
    .sf__ghost {
      font-size: 6rem;
    }
    .sf__title {
      max-width: 100%;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .sf__icon {
      transition: none;
    }
  }
</style>