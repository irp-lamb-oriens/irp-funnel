<script lang="ts">
  /**
   * StarRating.svelte — hyper-modern draggable 0–5 star rating (half-star steps).
   *
   * - Drag left/right across the stars (pointer) to set the value fluidly.
   * - Click on the left/right half of a star for half / full steps.
   * - Keyboard: ← / → adjust by 0.5, Home = 0, End = 5.
   * - `readonly` renders a static display (used in search dropdowns).
   * - Emits `change` with the new numeric value (0–5) whenever it settles.
   *
   * Backward-compatible: `value = null | undefined` renders as "unrated"
   * (all empty stars) and never forces a score onto legacy records.
   */
  import { createEventDispatcher } from 'svelte';

  export let value: number | null | undefined = null;
  export let readonly = false;
  /** Star glyph size in px. */
  export let size = 20;
  /** Optional aria label prefix. */
  export let label = 'Rating';

  const dispatch = createEventDispatcher<{ change: number }>();

  let trackEl: HTMLDivElement | null = null;
  let dragging = false;
  // Live preview value while hovering/dragging; falls back to committed value.
  let preview: number | null = null;

  $: committed = typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.min(5, value))
    : null;
  $: shown = preview !== null ? preview : (committed ?? 0);
  $: isUnrated = committed === null && preview === null;

  function valueFromClientX(clientX: number): number {
    if (!trackEl) return 0;
    const rect = trackEl.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    // 5 stars → 10 half-steps
    return Math.round(ratio * 10) / 2;
  }

  function commit(v: number) {
    const clamped = Math.max(0, Math.min(5, v));
    value = clamped;
    dispatch('change', clamped);
  }

  function onPointerDown(e: PointerEvent) {
    if (readonly) return;
    e.preventDefault();
    dragging = true;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    preview = valueFromClientX(e.clientX);
  }

  function onPointerMove(e: PointerEvent) {
    if (readonly || !dragging) return;
    preview = valueFromClientX(e.clientX);
  }

  function onPointerUp(e: PointerEvent) {
    if (readonly || !dragging) return;
    dragging = false;
    const v = valueFromClientX(e.clientX);
    preview = null;
    commit(v);
  }

  function onHoverMove(e: PointerEvent) {
    if (readonly || dragging) return;
    preview = valueFromClientX(e.clientX);
  }

  function onLeave() {
    if (dragging) return;
    preview = null;
  }

  function onKeydown(e: KeyboardEvent) {
    if (readonly) return;
    const base = committed ?? 0;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault();
      commit(base + 0.5);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault();
      commit(base - 0.5);
    } else if (e.key === 'Home') {
      e.preventDefault();
      commit(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      commit(5);
    }
  }

  /** Fill fraction (0–1) for the star at 1-based index. */
  function fillFor(index: number, v: number): number {
    const diff = v - (index - 1);
    return Math.max(0, Math.min(1, diff));
  }
</script>

<div
  class="star-rating"
  class:readonly
  class:unrated={isUnrated}
  style={`--sr-size:${size}px`}
  role={readonly ? 'img' : 'slider'}
  aria-label={`${label}: ${committed === null ? 'unrated' : committed + ' of 5'}`}
  aria-valuemin={readonly ? undefined : 0}
  aria-valuemax={readonly ? undefined : 5}
  aria-valuenow={readonly ? undefined : (committed ?? 0)}
  tabindex={readonly ? -1 : 0}
  on:keydown={onKeydown}
>
  <div
    class="sr-track"
    bind:this={trackEl}
    on:pointerdown={onPointerDown}
    on:pointermove={(e) => { onPointerMove(e); onHoverMove(e); }}
    on:pointerup={onPointerUp}
    on:pointerleave={onLeave}
  >
    {#each [1, 2, 3, 4, 5] as i}
      {@const f = fillFor(i, shown)}
      <span class="sr-star">
        <svg viewBox="0 0 24 24" class="sr-star-base" aria-hidden="true">
          <path d="M12 2.5l2.9 5.88 6.49.94-4.7 4.58 1.11 6.46L12 17.3l-5.8 3.05 1.11-6.46-4.7-4.58 6.49-.94L12 2.5z"/>
        </svg>
        <span class="sr-star-fill" style={`width:${f * 100}%`}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 2.5l2.9 5.88 6.49.94-4.7 4.58 1.11 6.46L12 17.3l-5.8 3.05 1.11-6.46-4.7-4.58 6.49-.94L12 2.5z"/>
          </svg>
        </span>
      </span>
    {/each}
  </div>

  {#if !readonly}
    <span class="sr-value">{committed === null ? '—' : committed.toFixed(1)}</span>
    {#if committed !== null}
      <button
        type="button"
        class="sr-clear"
        title="Clear rating"
        aria-label="Clear rating"
        on:click|stopPropagation={() => commit(0) }
      >×</button>
    {/if}
  {:else if committed !== null}
    <span class="sr-value sr-value--ro">{committed.toFixed(1)}</span>
  {/if}
</div>

<style>
  .star-rating {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    user-select: none;
    -webkit-user-select: none;
    touch-action: none;
  }
  .star-rating:focus-visible {
    outline: 2px solid rgba(245, 166, 35, 0.55);
    outline-offset: 3px;
    border-radius: 8px;
  }

  .sr-track {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    cursor: pointer;
    padding: 2px 0;
  }
  .readonly .sr-track { cursor: default; }

  .sr-star {
    position: relative;
    display: inline-block;
    width: var(--sr-size);
    height: var(--sr-size);
    line-height: 0;
  }

  .sr-star svg {
    width: var(--sr-size);
    height: var(--sr-size);
    display: block;
  }

  .sr-star-base path {
    fill: #e2e8f0;
    stroke: #cbd5e1;
    stroke-width: 0.6;
    transition: fill 0.15s ease;
  }

  .sr-star-fill {
    position: absolute;
    inset: 0;
    overflow: hidden;
    width: 0;
    line-height: 0;
    pointer-events: none;
  }
  .sr-star-fill path {
    fill: url(#sr-grad);
    /* gradient fallback via drop-shadow glow */
    fill: #f5a623;
    filter: drop-shadow(0 1px 2px rgba(245, 166, 35, 0.45));
  }

  /* Golden gradient via layered background trick on the fill svg */
  .sr-star-fill svg path {
    fill: #f6b73c;
  }
  .star-rating:not(.readonly) .sr-track:hover .sr-star-fill path {
    fill: #f59e0b;
  }

  .sr-value {
    font-size: 12px;
    font-weight: 700;
    color: #b45309;
    min-width: 26px;
    font-variant-numeric: tabular-nums;
  }
  .sr-value--ro { color: #92400e; }
  .unrated .sr-value { color: #9ca3af; }

  .sr-clear {
    border: none;
    background: #f1f5f9;
    color: #64748b;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    font-size: 13px;
    line-height: 1;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition: background 0.15s ease, color 0.15s ease;
  }
  .sr-clear:hover { background: #fee2e2; color: #dc2626; }
</style>
