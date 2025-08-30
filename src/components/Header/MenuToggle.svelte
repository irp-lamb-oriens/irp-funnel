<!-- irp-funnel/src/components/Header/MenuToggle.svelte -->
<script lang="ts">
    // Controlled by parent (no dispatchers, no stores here).
    import CTAButton from "./CTAButton.svelte";
    export let open: boolean = false;
    export let onToggle: () => void = () => {};

    // Menu data comes from parent (no hard-coded routes).
    type MenuItem = {
        href: string;
        label: string;
        icon?: string;
        isCTA?: boolean;
        target?: string;
        rel?: string;
    };
    export let cta: { label: string; href: string };
    export let menuItems: MenuItem[] = [];
    export let menuId: string = "primary-navigation";
    export let labelOpen: string = "Open main menu";
    export let labelClose: string = "Close main menu";

    $: ariaLabel = open ? labelClose : labelOpen;

    function toggle() {
        onToggle();
    }

    function closeIfOpen() {
        if (open) onToggle();
    }

    // Close when pressing Escape anywhere
    function onKeydown(e: KeyboardEvent) {
        if (e.key === "Escape" && open) onToggle();
    }

    // Close when clicking the scrim (but not the panel)
    function onOverlayClick(e: MouseEvent) {
        if ((e.target as HTMLElement).classList.contains("scrim"))
            closeIfOpen();
    }

    // Close when clicking any link—even if it's the current page
    function onItemClick() {
        closeIfOpen();
    }
</script>

<svelte:window on:keydown={onKeydown} />

<div class="menu-root" aria-expanded={open}>
    <button
        class="menu-toggle"
        type="button"
        aria-label={ariaLabel}
        aria-controls={menuId}
        aria-expanded={open}
        on:click={toggle}
    >
        <span class="sr-only">{ariaLabel}</span>
        <span class="icon" aria-hidden="true">
            <span class="bar"></span>
            <span class="bar"></span>
            <span class="bar"></span>
        </span>
    </button>

    <!-- Fullscreen menu rendered from menuItems; no hard-coded routes -->
    <nav
        id={menuId}
        class="menu-overlay"
        aria-hidden={!open}
        on:click={onOverlayClick}
        role="menu"
    >
        <div class="scrim" aria-hidden="true"></div>
        <div class="panel">
            <ul class="menu" style={`--count: ${menuItems.length || 0}`}>
                {#each menuItems as item (item.href)}
                    <li role="none">
                        <a
                            href={item.href}
                            class="item"
                            class:item-cta={item.isCTA}
                            role="menuitem"
                            tabindex="0"
                            on:click|preventDefault={onItemClick}
                            on:auxclick|preventDefault={onItemClick}
                            target={item.target}
                            rel={item.rel}
                        >
                            {#if item.icon}
                                <img
                                    src={item.icon}
                                    alt={`${item.label} icon`}
                                    width="30"
                                    height="30"
                                />
                            {/if}
                            {item.label}
                        </a>
                    </li>
                {/each}
                {#if cta}
                    <li role="none">
                        <CTAButton label={cta.label} href={cta.href} />
                    </li>
                {/if}
            </ul>
        </div>
    </nav>
</div>

<style lang="scss">
// Config
$max-items: 12; // max items to support with stagger
$open-base-delay: 140ms;
$break-md: 1024px;

// Utilities
%sr-only {
  position: absolute !important;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
.sr-only { @extend %sr-only; }

// -------------------- Toggle button --------------------
.menu-toggle {
  // Visual/theming hooks
  --size: clamp(24px, 4.5vw, 34px);
  --stroke: max(2px, calc(var(--size) / 14));
  --gap: calc(var(--stroke) * 2.2);
  --pad: 10px;
  --hit: 44px;
  --toggle-color: currentColor; /* closed color (inherits text color) */
  --toggle-color-open: #fff; /* open color (invert vs dark panel) */

  position: relative;
  z-index: 110; /* X index superior to overlay/panel */
  display: none;
  inline-size: max(var(--hit), calc(var(--size) + var(--pad) * 2));
  block-size: max(
    var(--hit),
    calc((var(--stroke) * 3 + var(--gap) * 2) + var(--pad) * 2)
  );
  padding: var(--pad);
  margin-left: 1rem;

  background: none;
  border: none;
  color: var(--toggle-color);
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;

  &:focus-visible {
    outline: 2px solid currentColor;
    outline-offset: 3px;
    border-radius: 12px;
  }

  @media (hover: hover) and (pointer: fine) {
    &:hover .icon { transform: translateY(-0.25px); }
    &:active .icon { transform: translateY(0.25px) scale(0.985); }
  }
}

/* Invert the icon color when open */
.menu-root[aria-expanded="true"] .menu-toggle { color: var(--toggle-color-open); }

.icon {
  inline-size: var(--size);
  block-size: calc(var(--stroke) * 3 + var(--gap) * 2);
  display: inline-grid;
  grid-template-rows: repeat(3, var(--stroke));
  align-content: center;
  gap: var(--gap);
  transform: translateZ(0);
  transition: transform 200ms cubic-bezier(0.2, 0.7, 0.2, 1);
}
.bar {
  inline-size: 100%;
  block-size: var(--stroke);
  background: currentColor;
  border-radius: var(--stroke);
  transform-origin: 50% 50%;
  transition:
    transform 260ms cubic-bezier(0.2, 0.7, 0.2, 1),
    opacity 160ms linear,
    translate 260ms cubic-bezier(0.2, 0.7, 0.2, 1),
    background-color 160ms linear;
  will-change: transform, opacity, translate;
}

/* Morph controlled by aria-expanded (no JS classes) */
.menu-root[aria-expanded="true"] {
  .bar:nth-child(1) { translate: 0 calc(var(--gap) + var(--stroke)); transform: rotate(45deg); }
  .bar:nth-child(2) { opacity: 0; }
  .bar:nth-child(3) { translate: 0 calc(-1 * (var(--gap) + var(--stroke))); transform: rotate(-45deg); }
}

/* Show toggle on small/medium screens */
@media (max-width: $break-md) {
  .menu-toggle { display: inline-grid; place-items: center; }
}

// -------------------- Fullscreen overlay with staggered animations --------------------
.menu-overlay {
  position: fixed;
  inset: 0;
  z-index: 100; /* below the button so X stays on top */
  pointer-events: none;
}
.scrim {
  position: absolute;
  inset: 0;
  background: hsl(0 0% 0% / 0.5);
  opacity: 0;
  transition: opacity 320ms ease;
}
.panel {
  position: absolute;
  inset: 0;
  background: var(--menu-bg, #0b0b0c);
  color: var(--menu-fg, #f7f7f8);
  transform: translateY(-100%);
  transition: transform 400ms cubic-bezier(0.22, 0.75, 0.2, 1);
  will-change: transform;
  display: grid;
  place-items: center;
  overflow: hidden;
}

/* Menu grid */
.menu {
  --stagger: 70ms;
  --count: 0;
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  gap: clamp(10px, 2.8vh, 18px);
  text-align: center;
}
.item {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.6rem;

  font-size: clamp(1.25rem, 2.6vw, 2.5rem);
  font-weight: 600;
  letter-spacing: 0.01em;
  text-decoration: none;
  color: inherit;

  opacity: 0;
  transform: translateY(18px);

  &.item-cta {
    font-weight: 700;
    text-decoration: underline;
    text-underline-offset: 4px;
  }
  img { display: inline-block; }
}

/* Open state */
.menu-root[aria-expanded="true"] {
  .menu-overlay { pointer-events: auto; }
  .scrim { opacity: 1; }
  .panel { transform: translateY(0); }
}

@keyframes item-in {
  from { opacity: 0; transform: translateY(18px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes item-out {
  from { opacity: 1; transform: translateY(0); }
  to   { opacity: 0; transform: translateY(-12px); }
}

/* Stagger: OPEN (loop) */
.menu-root[aria-expanded="true"] {
  .item { animation: item-in 360ms cubic-bezier(0.22, 0.75, 0.2, 1) both; }

  @for $i from 1 through $max-items {
    .menu > *:nth-child(#{$i}) .item {
      animation-delay: calc(#{($i - 1)} * var(--stagger) + #{$open-base-delay});
    }
  }
}

/* Stagger: CLOSE (loop, reverse using var(--count)) */
.menu-root[aria-expanded="false"] {
  .item { animation: item-out 260ms cubic-bezier(0.4, 0, 0.2, 1) both; }

  @for $i from 1 through $max-items {
    .menu > *:nth-child(#{$i}) .item {
      animation-delay: calc((var(--count) - 1 - #{($i - 1)}) * var(--stagger));
    }
  }

  /* Close transitions */
  .panel { transform: translateY(-100%); transition-duration: 360ms; }
  .scrim { opacity: 0; transition-duration: 260ms; }
}

/* Respect reduced motion */
@media (prefers-reduced-motion: reduce) {
  .panel,
  .scrim,
  .item {
    transition: none !important;
    animation: none !important;
  }
}
</style>
