<script lang="ts">
  /**
   * Header.svelte — Centralized, modular site header.
   *
   * Modes
   * ─────
   *   mode='website'      (default) — the floating pill marketing nav used on
   *                        all public pages: logo + MainMenu + destinations.
   *   mode='portal-tabs'  — transforms the header into a sticky section-tab
   *                        navigation bar for the client status portal.
   *                        Each `tab` corresponds to a section in the proposal
   *                        document (e.g. Introduction, Project Description,
   *                        Project Investment, Testimonials, Book Your Move).
   *
   * Props (portal-tabs mode only)
   * ──────────────────────────────
   *   tabs       — array of { id: string; label: string } section descriptors
   *   activeTab  — id of the currently visible section
   *
   * Events (portal-tabs mode only)
   * ──────────────────────────────
   *   on:tabchange  — { detail: string }  the id of the new active section
   *
   * Backward compatibility
   * ──────────────────────
   *   All existing pages that import <Header /> with no props continue to
   *   receive the website nav, unmodified. The portal-tabs code path is
   *   completely inert unless `mode='portal-tabs'` is passed.
   */

  import Logo from "./Logo.svelte";
  import MainMenu from "./MainMenu.svelte";
  import type { MenuItem } from "./MainMenu.svelte";
  import DestinationsMenu from "./DestinationsMenu.svelte";
  import type { Destination } from "./DestinationsMenu.svelte";
  import { createEventDispatcher, onMount } from "svelte";

  // ── Mode prop ──────────────────────────────────────────────────────────────
  /** 'website' (default) or 'portal-tabs' for the client status page. */
  export let mode: 'website' | 'portal-tabs' = 'website';
  /** Section tabs for portal-tabs mode. */
  export let tabs: { id: string; label: string }[] = [];
  /** Currently active tab id (portal-tabs mode). */
  export let activeTab: string = '';

  const dispatch = createEventDispatcher<{ tabchange: string }>();

  function selectTab(id: string) {
    activeTab = id;
    dispatch('tabchange', id);
  }

  // ── Website mode ───────────────────────────────────────────────────────────
  const menuItems: MenuItem[] = [
    { label: "Home", href: "/" },
    { label: "Free Resources", href: "/free-resources" },
    { label: "Guides", href: "/guides" },
    { label: "News", href: "/news-updates" },
    { label: "Contact", href: "/contact-us" },
  ];
  const cta = { label: "Schedule Consultation", href: "/consultation" };
  const destinations: Destination[] = [
    { label: "Costa Rica", href: "/costa-rica", icon: "https://img.icons8.com/color/48/null/costa-rica.png" },
    { label: "Panama",     href: "/panama",     icon: "https://img.icons8.com/color/48/null/panama.png" },
    { label: "Mexico",     href: "/mexico",     icon: "https://img.icons8.com/color/48/null/mexico.png" },
    { label: "Portugal",   href: "/portugal",   icon: "https://img.icons8.com/color/48/null/portugal.png" },
    { label: "Spain",      href: "/spain",      icon: "https://img.icons8.com/color/48/null/spain.png" },
    { label: "Colombia",   href: "/colombia",   icon: "https://img.icons8.com/color/48/colombia.png" },
  ];

  let lastScrollY = 0;
  let scrolled = false;
  let hidden = false;

  onMount(() => {
    if (mode !== 'website') return; // scroll hide only for website nav

    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      scrolled = currentScrollY > 20;
      hidden = currentScrollY > lastScrollY && currentScrollY > 100;
      lastScrollY = currentScrollY;
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  });
</script>

<!-- ════════════════════════════════════════════════════════════════════ -->
<!-- WEBSITE MODE — original floating pill nav (all public pages)        -->
<!-- ════════════════════════════════════════════════════════════════════ -->
{#if mode === 'website'}
  <div class="header-space"></div>
  <header
    class="header-section"
    class:is-scrolled={scrolled}
    class:is-hidden={hidden}
  >
    <div class="header-row main-row">
      <div class="logo-col">
        <Logo />
      </div>
      <MainMenu {menuItems} {cta} />
    </div>
  </header>

<!-- ════════════════════════════════════════════════════════════════════ -->
<!-- PORTAL-TABS MODE — sticky section nav for the client status portal  -->
<!-- ════════════════════════════════════════════════════════════════════ -->
{:else if mode === 'portal-tabs'}
  <div class="pt-space"></div>
  <header class="pt-header" role="navigation" aria-label="Proposal sections">
    <div class="pt-inner">
      <!-- Mini brand mark on the left -->
      <a href="/consultation" class="pt-brand" aria-label="International Relocation Partners">
        <img
          src="https://internationalrelocationpartner.com/wp-content/uploads/2023/01/IRP-Logo-White.png"
          alt="IRP"
          class="pt-brand__logo"
        />
      </a>

      <!-- Section tab strip -->
      <nav class="pt-tabs" role="tablist">
        {#each tabs as tab (tab.id)}
          <button
            class="pt-tab"
            class:pt-tab--active={activeTab === tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            on:click={() => selectTab(tab.id)}
          >
            {tab.label}
          </button>
        {/each}
      </nav>
    </div>
  </header>
{/if}

<style>
  /* ── Website mode (original SCSS content inlined) ───────────────────── */
  .header-space {
    height: 0;
  }

  .header-section {
    position: fixed;
    top: 24px;
    left: 0;
    right: 0;
    width: calc(100% - 48px);
    max-width: 1200px;
    height: 72px;
    z-index: 10010;
    margin: 0 auto;
    background: #f7f7f7;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 24px;
    box-shadow:
      0 4px 24px -1px rgba(0, 0, 0, 0.1),
      0 0 1px 0 rgba(255, 255, 255, 0.1) inset;
    padding: 0 24px;
    font-family: inherit;
    transition: all 0.6s cubic-bezier(0.16, 1, 0.3, 1);
    will-change: transform, top, height, background, box-shadow;
    color: #fff;
  }
  .header-section.is-scrolled {
    top: 12px;
    height: 64px;
    border-color: rgba(255, 255, 255, 0.2);
    box-shadow:
      0 12px 40px -12px rgba(0, 0, 0, 0.25),
      0 0 1px 0 rgba(255, 255, 255, 0.2) inset;
    border-radius: 20px;
  }
  .header-section.is-hidden {
    transform: translateY(-120%);
  }

  .header-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    height: 100%;
    margin: 0 auto;
  }

  .logo-col {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
  }
  .logo-col:hover { transform: scale(1.08); }

  @media (max-width: 1024px) {
    .header-section {
      width: calc(100% - 24px);
      top: 12px;
      padding: 0 16px;
      height: 64px;
      border-radius: 18px;
    }
  }

  /* ── Portal-tabs mode ──────────────────────────────────────────────── */

  /** Spacer that reserves exactly the height of the sticky header */
  .pt-space { height: 56px; }

  .pt-header {
    position: fixed;
    top: 0; left: 0; right: 0;
    z-index: 10010;
    height: 56px;
    background: linear-gradient(135deg, #0a1628 0%, #0b2035 60%, #052a30 100%);
    border-bottom: 1px solid rgba(2, 182, 188, 0.25);
    box-shadow:
      0 2px 24px rgba(0, 0, 0, 0.35),
      0 0 0 1px rgba(2, 182, 188, 0.08);
  }

  .pt-inner {
    display: flex;
    align-items: center;
    height: 100%;
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 20px;
    gap: 1.5rem;
  }

  /* Mini brand logo */
  .pt-brand {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    text-decoration: none;
  }
  .pt-brand__logo {
    height: 28px;
    width: auto;
    object-fit: contain;
    opacity: 0.9;
    transition: opacity 0.15s;
  }
  .pt-brand:hover .pt-brand__logo { opacity: 1; }

  /* Tab strip */
  .pt-tabs {
    display: flex;
    align-items: stretch;
    gap: 0;
    overflow-x: auto;
    scrollbar-width: none;
    flex: 1;
    height: 100%;
  }
  .pt-tabs::-webkit-scrollbar { display: none; }

  .pt-tab {
    display: inline-flex;
    align-items: center;
    padding: 0 18px;
    height: 100%;
    font-family: 'Jost', system-ui, sans-serif;
    font-size: 0.82rem;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.62);
    background: transparent;
    border: none;
    border-bottom: 2.5px solid transparent;
    cursor: pointer;
    white-space: nowrap;
    transition: color 0.18s, border-color 0.18s, background 0.15s;
    letter-spacing: 0.01em;
  }
  .pt-tab:hover {
    color: rgba(255, 255, 255, 0.9);
    background: rgba(2, 182, 188, 0.06);
  }
  .pt-tab--active {
    color: #fff;
    border-bottom-color: #02b6bc;
    font-weight: 700;
  }
  .pt-tab--active:hover { background: transparent; }

  @media (max-width: 640px) {
    .pt-inner { padding: 0 12px; gap: 0.75rem; }
    .pt-tab { padding: 0 12px; font-size: 0.78rem; }
    .pt-brand__logo { height: 22px; }
  }
</style>
