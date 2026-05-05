<script lang="ts">
  /**
   * CardInsights.svelte
   *
   * Ultra-modern AI-insights mini-section for kanban cards. Renders the
   * shipping-mode + packing-tier chips + a slim confidence meter.
   *
   * Empty-state placeholder is rendered when `transcriptInsights == null`,
   * preserving consistent card height across the kanban.
   */

  import {
    SHIPPING_MODE_LABEL,
    PACKING_TIER_LABEL,
    type TranscriptInsights,
  } from '../store.ts';

  export let insights: TranscriptInsights | null | undefined;
  /** When true (compact list-row variant), hides the confidence meter. */
  export let compact: boolean = false;

  $: hasInsights = !!insights && (insights.shippingMode || insights.packingTier);
  $: confidencePct = insights ? Math.round((insights.confidence || 0) * 100) : 0;
</script>

<div class="card__insights" class:card__insights--empty={!hasInsights} class:card__insights--compact={compact}>
  {#if hasInsights && insights}
    <span class="card__insights-ai-label" title="AI-extracted from consultation transcript">AI</span>

    {#if insights.shippingMode && SHIPPING_MODE_LABEL[insights.shippingMode]}
      <span
        class="card__insights-mode"
        title={insights.reasoning || 'AI-classified shipping mode'}
      >
        <span class="card__insights-mode-icon">{SHIPPING_MODE_LABEL[insights.shippingMode].icon}</span>
        <span class="card__insights-mode-label">{SHIPPING_MODE_LABEL[insights.shippingMode].label}</span>
      </span>
    {/if}

    {#if insights.packingTier && PACKING_TIER_LABEL[insights.packingTier]}
      <span
        class="card__insights-tier"
        title="Anticipated packing service tier"
      >
        <span class="card__insights-tier-icon">{PACKING_TIER_LABEL[insights.packingTier].icon}</span>
        <span class="card__insights-tier-label">{PACKING_TIER_LABEL[insights.packingTier].label}</span>
      </span>
    {/if}

    {#if !compact && confidencePct > 0}
      <span
        class="card__insights-confidence"
        style="--conf:{confidencePct}%"
        title={`AI confidence: ${confidencePct}%`}
        aria-label={`AI confidence: ${confidencePct}%`}
      >
        <span class="card__insights-confidence-bar"></span>
      </span>
    {/if}
  {:else}
    <span class="card__insights-empty-label">📝 No transcript yet</span>
  {/if}
</div>
