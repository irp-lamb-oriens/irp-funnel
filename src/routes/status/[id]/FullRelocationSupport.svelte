<script lang="ts">
  // Gated "full relocation support" panel shown to authenticated CLIENTS only
  // (never on the public site). This is where the deeper service catalogue
  // lives: the things we deliberately keep out of the public funnel so IRP does
  // not read as competing with its own real-estate / immigration / moving
  // partners. Surfaced once the client is logged into their portal.
  //
  // Award-winning modern treatment reuses the shared GSAP landing engine
  // (scroll reveals + tilt/spotlight cards + magnetic CTA), consistent with the
  // public landings but toned down for an in-portal panel.
  import { onMount, onDestroy } from 'svelte';
  import { initLanding, type LandingCleanup } from '$lib/animations/landing';

  type SupportItem = {
    title: string;
    body: string;
    icon: string;
  };

  const items: SupportItem[] = [
    {
      title: 'Immigration advice',
      body: 'The legal pathways for your situation, the categories that actually apply, and the documentation that must be right before you commit.',
      icon: 'shield'
    },
    {
      title: 'Settling in',
      body: 'Bank accounts, utilities, a driver\u2019s license, and the everyday administration that follows the move.',
      icon: 'home'
    },
    {
      title: 'Vehicle import',
      body: 'Whether your car makes sense to ship, and the real taxes, parts, and registration costs if it does.',
      icon: 'car'
    },
    {
      title: 'Pet relocation',
      body: 'Veterinary documentation, vaccinations, airline and breed restrictions, and ground transport.',
      icon: 'paw'
    },
    {
      title: 'Business & investment',
      body: 'Residency, tax, corporate structure, and banking when your move has to work financially.',
      icon: 'chart'
    },
    {
      title: 'International moving',
      body: 'Shipping your household goods, a car, or a container with the duties and paperwork mapped up front.',
      icon: 'ship'
    }
  ];

  let root: HTMLElement;
  let cleanup: LandingCleanup | null = null;

  onMount(async () => {
    cleanup = await initLanding(root);
  });
  onDestroy(() => cleanup?.());
</script>

<section class="support" bind:this={root}>
  <div class="support__head">
    <p class="support__eyebrow" data-animate="up">Members only</p>
    <h2 class="support__title" data-animate="up" data-animate-delay="0.05">Full relocation support</h2>
    <p class="support__lead" data-animate="up" data-animate-delay="0.1">
      Everything beyond the move itself, available to you as a client. We keep
      this list inside your portal so it stays between us.
    </p>
  </div>

  <div class="support__grid">
    {#each items as it (it.title)}
      <div class="sitem" data-animate="scale" data-tilt>
        <span class="sitem__icon" aria-hidden="true">
          {#if it.icon === 'shield'}
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z" stroke-linecap="round" stroke-linejoin="round"/></svg>
          {:else if it.icon === 'home'}
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M3 11l9-7 9 7M5 10v10h14V10" stroke-linecap="round" stroke-linejoin="round"/></svg>
          {:else if it.icon === 'car'}
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M5 13l1.5-4.5A2 2 0 018.4 7h7.2a2 2 0 011.9 1.5L19 13m-14 0h14v4H5v-4zm2 4v2m10-2v2" stroke-linecap="round" stroke-linejoin="round"/></svg>
          {:else if it.icon === 'paw'}
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="7" cy="9" r="1.6"/><circle cx="12" cy="7" r="1.6"/><circle cx="17" cy="9" r="1.6"/><path d="M12 12c-2.5 0-4.5 2-4.5 4S9 20 12 20s4.5-2 4.5-4-2-4-4.5-4z" stroke-linecap="round" stroke-linejoin="round"/></svg>
          {:else if it.icon === 'chart'}
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 20V6m5 14V10m5 10V4m5 16v-7" stroke-linecap="round" stroke-linejoin="round"/></svg>
          {:else}
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 16l4-6 4 3 4-8 4 11H4z" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 20h16" stroke-linecap="round"/></svg>
          {/if}
        </span>
        <h3 class="sitem__title">{it.title}</h3>
        <p class="sitem__body">{it.body}</p>
      </div>
    {/each}
  </div>

  <div class="support__foot" data-animate="up">
    <p class="support__foot-note">
      Book a call and we'll map which of these your move actually needs.
    </p>
    <a class="support__cta" href="/consultation" data-magnetic data-magnetic-strength="0.25">Book a call</a>
  </div>
</section>

<style lang="scss">
  .support {
    font-family: var(--font-paragraph, 'Jost'), system-ui, sans-serif;
    color: #1a1a2e;
  }

  .support__head {
    margin-bottom: 1.75rem;
  }
  .support__eyebrow {
    margin: 0 0 0.7rem;
    font-size: 0.7rem;
    font-weight: 700;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: var(--color-highlight-2, #02b5bb);
  }
  .support__title {
    margin: 0 0 0.6rem;
    font-family: var(--font-title, 'Kiona Regular', serif);
    font-size: clamp(1.6rem, 2.6vw, 2.1rem);
    font-weight: 700;
    letter-spacing: -0.02em;
    color: var(--color-foreground, #181818);
  }
  .support__lead {
    margin: 0;
    color: #475569;
    line-height: 1.6;
    max-width: 62ch;
  }

  .support__grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1rem;
    margin-bottom: 1.75rem;
  }

  .sitem {
    position: relative;
    padding: 1.4rem 1.5rem;
    background: #fff;
    border: 1px solid rgba(var(--color-highlight-2-rgb), 0.16);
    border-radius: 16px;
    box-shadow: 0 16px 36px -26px rgba(15, 23, 42, 0.2);
    isolation: isolate;
    transform-style: preserve-3d;
    will-change: transform;
    overflow: hidden;

    // cursor spotlight (fed by --mx/--my/--spot from the shared engine)
    &::after {
      content: '';
      position: absolute;
      inset: 0;
      z-index: 0;
      pointer-events: none;
      opacity: calc(var(--spot, 0) * 1);
      background: radial-gradient(
        220px circle at var(--mx, 50%) var(--my, 50%),
        rgba(var(--color-highlight-2-rgb), 0.12),
        transparent 60%
      );
      transition: opacity 0.3s ease;
    }
  }
  .sitem > * { position: relative; z-index: 1; }

  .sitem__icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    margin-bottom: 0.7rem;
    border-radius: 11px;
    color: var(--color-highlight-2, #02b5bb);
    background: rgba(var(--color-highlight-2-rgb), 0.1);
    transform: translateZ(24px);
    svg { width: 21px; height: 21px; }
  }
  .sitem__title {
    margin: 0 0 0.45rem;
    font-family: var(--font-subtitle, 'Spartan Black', sans-serif);
    font-size: 1rem;
    font-weight: 700;
    color: var(--color-foreground, #181818);
    transform: translateZ(18px);
  }
  .sitem__body {
    margin: 0;
    color: #64748b;
    font-size: 0.92rem;
    line-height: 1.6;
  }

  .support__foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
    padding-top: 1.5rem;
    border-top: 1px solid rgba(var(--color-highlight-2-rgb), 0.14);
  }
  .support__foot-note {
    margin: 0;
    color: #475569;
    font-size: 0.95rem;
  }
  .support__cta {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0.75rem 1.5rem;
    border-radius: 12px;
    font-weight: 700;
    font-size: 0.92rem;
    text-decoration: none;
    color: #fff;
    background: linear-gradient(135deg, var(--color-highlight-2, #02b5bb) 0%, #02999e 100%);
    box-shadow: 0 14px 30px -12px rgba(var(--color-highlight-2-rgb), 0.55);
    will-change: transform;
  }
  .support__cta:hover { filter: brightness(1.06); }

  @media (max-width: 900px) {
    .support__grid { grid-template-columns: repeat(2, 1fr); }
  }
  @media (max-width: 620px) {
    .support__grid { grid-template-columns: 1fr; }
  }

  @media (prefers-reduced-motion: reduce) {
    .sitem::after { transition: none; }
  }
</style>