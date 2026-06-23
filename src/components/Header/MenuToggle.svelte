<!-- irp-funnel/src/components/Header/MenuToggle.svelte -->
<script lang="ts">
    import './MenuToggle.scss';
    // Controlled by parent (no dispatchers, no stores here).
    import CTAButton from "./CTAButton.svelte";
    import AnimatedUnderline from "./AnimatedUnderline.svelte";
    import { page } from "$app/stores";
    import { onDestroy } from "svelte";
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

    let hoveredHref: string | null = null;

    $: ariaLabel = open ? labelClose : labelOpen;

    // Lock the background scroll while the fullscreen menu is open.
    // This also guarantees the floating header can't fire its scroll-hide
    // transform mid-open (which would otherwise turn it into a containing
    // block again and shift this fixed panel).
    $: if (typeof document !== "undefined") {
        document.body.style.overflow = open ? "hidden" : "";
    }
    onDestroy(() => {
        if (typeof document !== "undefined") document.body.style.overflow = "";
    });

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
    <div class="menu-panel">
            <div class="menu-glow menu-glow--a" aria-hidden="true"></div>
            <div class="menu-glow menu-glow--b" aria-hidden="true"></div>
            <ul
                class="menu-list"
                style={`--count: ${(menuItems.length || 0) + (cta ? 1 : 0)}`}
            >

                {#each menuItems as item (item.href)}
                    <li class="menu-list-item" role="none">
                        <a
                            href={item.href}
                            class="menu-link"
                            class:menu-link-cta={item.isCTA}
                            role="menuitem"
                            tabindex="0"
                            on:click={onItemClick}
                            on:auxclick={onItemClick}
                            target={item.target}
                            rel={item.rel}
                            on:mouseenter={() => hoveredHref = item.href}
                            on:mouseleave={() => hoveredHref = null}
                        >
                            <AnimatedUnderline
                                selected={$page.url.pathname === item.href}
                                hovered={hoveredHref === item.href}
                            >
                                {#if item.icon}
                                    <img
                                        src={item.icon}
                                        alt={`${item.label} icon`}
                                        width="30"
                                        height="30"
                                        class="menu-link-icon"
                                    />
                                {/if}
                                {item.label}
                            </AnimatedUnderline>
                        </a>
                    </li>
                {/each}

                {#if cta}
                    <li class="menu-list-item" role="none">
                        <CTAButton label={cta.label} href={cta.href} />
                    </li>
                {/if}
            </ul>
            <div class="menu-extra">
                <div class="menu-socials">
                    <a class="menu-social-link" href="https://www.facebook.com/IntRelocationPartner/" target="_blank" rel="noopener">
                        <img class="menu-social-img" src="/icons/facebook.png" alt="Facebook" width="32" height="32" />
                    </a>
                    <a class="menu-social-link" href="https://www.instagram.com/int.relocation.partner" target="_blank" rel="noopener">
                        <img class="menu-social-img" src="/icons/instagram.png" alt="Instagram" width="32" height="32" />
                    </a>
                    <a class="menu-social-link" href="https://www.linkedin.com/company/internationalrelocationpartner" target="_blank" rel="noopener">
                        <img class="menu-social-img" src="/icons/linkedin.png" alt="Linkedin" width="32" height="32" />
                    </a>
                    <a class="menu-social-link" href="https://g.page/internationalrelocationpartner?we" target="_blank" rel="noopener">
                        <img class="menu-social-img" src="/icons/google.png" alt="Google" width="32" height="32" />
                    </a>
                    <a class="menu-social-link" href="https://www.youtube.com/channel/UCDXEdyNL5XnFg72n9XjOPvw" target="_blank" rel="noopener">
                        <img class="menu-social-img" src="/icons/youtube.png" alt="Youtube" width="32" height="32" />
                    </a>
                </div>
                <div class="menu-credits">
                    <div class="menu-title">International Relocation Partner</div>
                    <p class="menu-copyright">
                        Copyright © 2025 Heredia, Costa Rica | Built by
                        <a class="menu-copyright-link" href="https://aiexecutions.com/" target="_blank" rel="noopener">AI Executions</a> at
                        <a class="menu-copyright-link" href="https://testcoder.netlify.app/" target="_blank" rel="noopener">Oriens Studios</a>
                    </p>
                </div>
            </div>
        </div>
    </nav>
</div>
