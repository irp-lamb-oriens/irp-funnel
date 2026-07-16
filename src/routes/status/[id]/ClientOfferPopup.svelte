<script lang="ts">
  /**
   * ClientOfferPopup.svelte
   * ────────────────────────────────────────────────────────────────────────
   * The one-time offer/announcement pop-up shown to a client the moment they
   * gain access to their /status page. Content is 100% dashboard-configured
   * (Automations → Client offer) — this component only renders + dismisses it.
   *
   * Hyper-modern light card: layered ambient aura, glass surface, animated
   * gradient ring, floating gift emblem, sparkle accents, spring entrance, and
   * a shimmer-sweep CTA. Cohesive with the portal's teal accent + Jost type.
   * Dismissal memory (once-per-browser) lives in the parent (+page.svelte) via
   * localStorage — this component just emits `close`.
   */
  import { createEventDispatcher } from 'svelte';
  import { fade, scale } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';

  export let title = '';
  export let bodyHtml = '';
  export let ctaLabel = '';
  export let ctaUrl = '';

  const dispatch = createEventDispatcher<{ close: void }>();

  function close() {
    dispatch('close');
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') close();
  }

  // A CTA renders only when BOTH a label and a valid http(s) link are set.
  $: hasCta = !!ctaLabel.trim() && /^https?:\/\//i.test(ctaUrl.trim());
</script>

<svelte:window on:keydown={onKeydown} />

<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
<div class="cop-backdrop" transition:fade={{ duration: 220 }} on:click|self={close} role="presentation">
  <div
    class="cop-card"
    transition:scale={{ duration: 420, start: 0.9, easing: cubicOut }}
    role="dialog"
    aria-modal="true"
    aria-labelledby="cop-title"
  >
    <!-- Ambient animated aura -->
    <span class="cop-aura" aria-hidden="true"></span>
    <span class="cop-aura cop-aura--2" aria-hidden="true"></span>

    <!-- Floating sparkles -->
    <span class="cop-spark cop-spark--1" aria-hidden="true"></span>
    <span class="cop-spark cop-spark--2" aria-hidden="true"></span>
    <span class="cop-spark cop-spark--3" aria-hidden="true"></span>

    <button class="cop-close" on:click={close} aria-label="Close">
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
        <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
      </svg>
    </button>

    <div class="cop-content">
      <div class="cop-emblem" aria-hidden="true">
        <span class="cop-emblem__ring"></span>
        <span class="cop-emblem__glyph">🎁</span>
      </div>

      <span class="cop-eyebrow">A little something for you</span>

      {#if title.trim()}
        <h2 id="cop-title" class="cop-title">{title}</h2>
      {/if}

      {#if bodyHtml.trim()}
        <div class="cop-body">{@html bodyHtml}</div>
      {/if}

      <div class="cop-actions">
        {#if hasCta}
          <a
            class="cop-cta"
            href={ctaUrl.trim()}
            target="_blank"
            rel="noopener noreferrer"
            on:click={close}
          >
            <span class="cop-cta__label">{ctaLabel}</span>
            <svg class="cop-cta__arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
          </a>
        {/if}
        <button class="cop-dismiss" on:click={close}>
          {hasCta ? 'Maybe later' : 'Got it, thanks'}
        </button>
      </div>
    </div>
  </div>
</div>

<style lang="scss">
  .cop-backdrop {
    position: fixed;
    inset: 0;
    background:
      radial-gradient(120% 120% at 50% 0%, rgba(2, 181, 187, 0.18) 0%, transparent 55%),
      rgba(6, 18, 26, 0.62);
    backdrop-filter: blur(8px) saturate(1.1);
    -webkit-backdrop-filter: blur(8px) saturate(1.1);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9000;
    padding: 1.25rem;
  }

  .cop-card {
    position: relative;
    width: 100%;
    max-width: 452px;
    border-radius: 28px;
    padding: 2.75rem 2.25rem 2rem;
    text-align: center;
    overflow: hidden;
    isolation: isolate;
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.96) 0%, rgba(248, 253, 253, 0.98) 100%);
    border: 1px solid rgba(255, 255, 255, 0.9);
    box-shadow:
      0 2px 0 rgba(255, 255, 255, 0.9) inset,
      0 30px 70px -20px rgba(2, 132, 137, 0.35),
      0 18px 44px rgba(15, 23, 42, 0.22);
    font-family: var(--font-paragraph, 'Jost'), system-ui, sans-serif;

    /* Gradient border-ring that slowly rotates */
    &::before {
      content: '';
      position: absolute;
      inset: 0;
      border-radius: 28px;
      padding: 1.5px;
      background: conic-gradient(
        from var(--cop-angle, 0deg),
        rgba(2, 181, 187, 0),
        rgba(2, 181, 187, 0.7),
        rgba(56, 189, 248, 0.55),
        rgba(2, 181, 187, 0),
        rgba(2, 181, 187, 0)
      );
      -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
      -webkit-mask-composite: xor;
      mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
      mask-composite: exclude;
      animation: cop-spin 6s linear infinite;
      pointer-events: none;
      z-index: 2;
    }

    /* Top accent shimmer bar */
    &::after {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 5px;
      background: linear-gradient(90deg, var(--color-highlight-2, #02b5bb), var(--color-highlight-1, #38bdf8), var(--color-highlight-2, #02b5bb));
      background-size: 200% 100%;
      animation: cop-sweep 3.5s ease-in-out infinite;
      z-index: 3;
    }
  }

  @property --cop-angle {
    syntax: '<angle>';
    initial-value: 0deg;
    inherits: false;
  }
  @keyframes cop-spin { to { --cop-angle: 360deg; } }
  @keyframes cop-sweep {
    0%, 100% { background-position: 0% 0; }
    50% { background-position: 100% 0; }
  }

  /* ── Ambient aura blobs ─────────────────────────────────────────────── */
  .cop-aura {
    position: absolute;
    width: 260px;
    height: 260px;
    top: -120px;
    left: -80px;
    background: radial-gradient(circle, rgba(2, 181, 187, 0.28) 0%, transparent 70%);
    filter: blur(12px);
    pointer-events: none;
    z-index: 0;
    animation: cop-float 7s ease-in-out infinite;
  }
  .cop-aura--2 {
    top: auto;
    bottom: -140px;
    left: auto;
    right: -90px;
    width: 300px;
    height: 300px;
    background: radial-gradient(circle, rgba(56, 189, 248, 0.24) 0%, transparent 70%);
    animation-delay: -3.5s;
  }
  @keyframes cop-float {
    0%, 100% { transform: translate(0, 0) scale(1); }
    50% { transform: translate(14px, 18px) scale(1.08); }
  }

  /* ── Sparkles ───────────────────────────────────────────────────────── */
  .cop-spark {
    position: absolute;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--color-highlight-2, #02b5bb);
    box-shadow: 0 0 8px 2px rgba(2, 181, 187, 0.5);
    z-index: 1;
    pointer-events: none;
    opacity: 0;
    animation: cop-twinkle 3s ease-in-out infinite;
  }
  .cop-spark--1 { top: 20%; left: 14%; animation-delay: 0.3s; }
  .cop-spark--2 { top: 30%; right: 16%; width: 4px; height: 4px; animation-delay: 1.1s; }
  .cop-spark--3 { bottom: 32%; left: 20%; width: 5px; height: 5px; animation-delay: 1.9s; }
  @keyframes cop-twinkle {
    0%, 100% { opacity: 0; transform: scale(0.4); }
    50% { opacity: 1; transform: scale(1); }
  }

  .cop-close {
    position: absolute;
    top: 1rem;
    right: 1rem;
    z-index: 4;
    width: 32px;
    height: 32px;
    border-radius: 10px;
    border: 1px solid rgba(15, 23, 42, 0.08);
    background: rgba(255, 255, 255, 0.7);
    color: #64748b;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    backdrop-filter: blur(4px);
    transition: background 0.18s, color 0.18s, border-color 0.18s, transform 0.18s;

    &:hover {
      background: #ffffff;
      color: #0f172a;
      border-color: rgba(15, 23, 42, 0.16);
      transform: rotate(90deg);
    }
  }

  .cop-content {
    position: relative;
    z-index: 3;
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  /* ── Emblem ─────────────────────────────────────────────────────────── */
  .cop-emblem {
    position: relative;
    width: 78px;
    height: 78px;
    margin-bottom: 1.1rem;
    display: grid;
    place-items: center;
  }
  .cop-emblem__ring {
    position: absolute;
    inset: 0;
    border-radius: 50%;
    background: linear-gradient(135deg, rgba(2, 181, 187, 0.16), rgba(56, 189, 248, 0.1));
    border: 1px solid rgba(2, 181, 187, 0.28);
    box-shadow:
      0 8px 22px rgba(2, 181, 187, 0.28),
      0 0 0 6px rgba(2, 181, 187, 0.06);
    animation: cop-bob 4s ease-in-out infinite;
  }
  .cop-emblem__glyph {
    position: relative;
    font-size: 36px;
    line-height: 1;
    filter: drop-shadow(0 4px 8px rgba(2, 132, 137, 0.3));
    animation: cop-bob 4s ease-in-out infinite;
  }
  @keyframes cop-bob {
    0%, 100% { transform: translateY(0) rotate(-3deg); }
    50% { transform: translateY(-5px) rotate(3deg); }
  }

  .cop-eyebrow {
    font-size: 0.68rem;
    font-weight: 800;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: #0a9aa0;
    margin-bottom: 0.6rem;
  }

  .cop-title {
    margin: 0 0 0.85rem;
    font-size: 1.65rem;
    font-weight: 800;
    letter-spacing: -0.025em;
    line-height: 1.18;
    color: #0b1f24;
    font-family: var(--font-title, 'Jost'), system-ui, sans-serif;
    background: linear-gradient(180deg, #0b1f24 0%, #123c41 100%);
    -webkit-background-clip: text;
    background-clip: text;
  }

  .cop-body {
    color: #47606a;
    font-size: 1.02rem;
    line-height: 1.62;
    margin-bottom: 1.9rem;

    :global(a) { color: var(--color-highlight-2, #02b5bb); font-weight: 600; }
    :global(img) { max-width: 100%; height: auto; border-radius: 12px; margin: 0.5rem 0; box-shadow: 0 8px 24px rgba(15, 23, 42, 0.12); }
    :global(p) { margin: 0 0 0.75rem; }
    :global(p:last-child) { margin-bottom: 0; }
    :global(ul), :global(ol) { text-align: left; padding-left: 1.25rem; margin: 0 0 0.75rem; }
    :global(li) { margin-bottom: 0.3rem; }
    :global(strong) { color: #0b1f24; font-weight: 700; }
    :global(h1), :global(h2), :global(h3) { color: #0b1f24; letter-spacing: -0.01em; }
  }

  .cop-actions {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    align-items: stretch;
    width: 100%;
  }

  .cop-cta {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.9rem 1.5rem;
    border-radius: 14px;
    background: linear-gradient(135deg, #02b5bb 0%, #0aa0c4 50%, #0284c7 100%);
    color: #fff;
    text-decoration: none;
    font-weight: 800;
    font-size: 1.02rem;
    letter-spacing: 0.01em;
    overflow: hidden;
    box-shadow:
      0 10px 24px -6px rgba(2, 181, 187, 0.55),
      0 2px 0 rgba(255, 255, 255, 0.25) inset;
    transition: transform 0.18s ease, box-shadow 0.18s ease, filter 0.18s ease;

    /* Shimmer sweep */
    &::before {
      content: '';
      position: absolute;
      top: 0;
      left: -60%;
      width: 40%;
      height: 100%;
      background: linear-gradient(100deg, transparent, rgba(255, 255, 255, 0.45), transparent);
      transform: skewX(-18deg);
      animation: cop-shimmer 3.2s ease-in-out infinite;
    }

    &:hover {
      transform: translateY(-2px);
      filter: brightness(1.05);
      box-shadow:
        0 14px 30px -6px rgba(2, 181, 187, 0.65),
        0 2px 0 rgba(255, 255, 255, 0.25) inset;
    }
    &:active { transform: translateY(0); }
  }
  .cop-cta__label { position: relative; z-index: 1; }
  .cop-cta__arrow {
    position: relative;
    z-index: 1;
    transition: transform 0.18s ease;
  }
  .cop-cta:hover .cop-cta__arrow { transform: translateX(3px); }
  @keyframes cop-shimmer {
    0% { left: -60%; }
    60%, 100% { left: 130%; }
  }

  .cop-dismiss {
    background: none;
    border: none;
    color: #94a3b8;
    font-size: 0.9rem;
    font-weight: 600;
    font-family: inherit;
    cursor: pointer;
    padding: 0.45rem;
    border-radius: 8px;
    transition: color 0.16s, background 0.16s;

    &:hover { color: #475569; background: rgba(15, 23, 42, 0.03); }
  }

  @media (max-width: 480px) {
    .cop-card { padding: 2.25rem 1.5rem 1.75rem; border-radius: 24px; }
    .cop-title { font-size: 1.45rem; }
  }

  /* Respect reduced-motion preferences. */
  @media (prefers-reduced-motion: reduce) {
    .cop-card::before,
    .cop-card::after,
    .cop-aura,
    .cop-spark,
    .cop-emblem__ring,
    .cop-emblem__glyph,
    .cop-cta::before { animation: none; }
  }
</style>
