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
      <!-- Mini brand mark on the left — links to homepage, same as the website-mode logo -->
      <a href="/" class="pt-brand" aria-label="International Relocation Partners — Home">
        <img
          src="https://internationalrelocationpartner.com/IRP-LOGO.jpg"
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
    /* NOTE: `transform` is intentionally omitted from will-change.
       `will-change: transform` turns this element into the containing block
       for fixed-positioned descendants, which made the mobile fullscreen menu
       (rendered inside the header) inherit the pill's top/centered offset.
       Keeping it out lets the menu's `position: fixed` resolve to the viewport. */
    will-change: top, height, background, box-shadow;
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

  /* ────────────────────────────────────────────────────────────────────────
     Portal-tabs mode
     Same floating-pill geometry as the website header:
       position: fixed; top: 24px; border-radius: 24px; max-width: 1200px
     Dark glassmorphism — complements the client portal's dark-navy (#1a1a2e)
     background while staying visually cohesive with the brand.
     Font: 'Montserrat', 'Arial', sans-serif (site brand font).
  ──────────────────────────────────────────────────────────────────────── */

  /* Spacer — same visual area as the floating pill + breathing room */
  .pt-space { height: 104px; }

  .pt-header {
    position: fixed;
    top: 24px; left: 0; right: 0;
    width: calc(100% - 48px);
    max-width: 1200px;
    margin: 0 auto;
    z-index: 10010;
    height: 64px;
    /* Dark glassmorphism — same pill geometry as the website nav pill */
    background: rgba(10, 16, 30, 0.86);
    backdrop-filter: blur(24px) saturate(160%);
    -webkit-backdrop-filter: blur(24px) saturate(160%);
    border: 1px solid rgba(2, 182, 188, 0.16);
    border-radius: 24px;
    box-shadow:
      0 4px 32px -4px rgba(0, 0, 0, 0.55),
      0 1px 0 rgba(255, 255, 255, 0.04) inset;
    transition: box-shadow 0.3s ease;
  }

  .pt-inner {
    display: flex;
    align-items: center;
    height: 100%;
    padding: 0 16px 0 20px;
  }

  /* Mini brand — separated from tabs by a teal rule */
  .pt-brand {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    text-decoration: none;
    padding-right: 16px;
    margin-right: 4px;
    border-right: 1px solid rgba(2, 182, 188, 0.18);
    transition: opacity 0.15s;
  }
  .pt-brand:hover { opacity: 0.85; }
  .pt-brand__logo {
    height: 26px;
    width: auto;
    object-fit: contain;
    filter: brightness(1.08);
  }

  /* Tab strip */
  .pt-tabs {
    display: flex;
    align-items: stretch;
    overflow-x: auto;
    scrollbar-width: none;
    flex: 1;
    height: 100%;
    padding: 0 4px;
  }
  .pt-tabs::-webkit-scrollbar { display: none; }

  .pt-tab {
    display: inline-flex;
    align-items: center;
    padding: 0 15px;
    height: 100%;
    font-family: var(--font-paragraph);
    font-size: 0.72rem;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.48);
    background: transparent;
    border: none;
    cursor: pointer;
    white-space: nowrap;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    position: relative;
    transition: color 0.18s, background 0.15s;
  }
  /* Active indicator — bottom bar inside the pill */
  .pt-tab::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 12px;
    right: 12px;
    height: 2.5px;
    border-radius: 2px 2px 0 0;
    background: transparent;
    transition: background 0.2s, box-shadow 0.2s;
  }
  .pt-tab:hover {
    color: rgba(255, 255, 255, 0.82);
    background: rgba(255, 255, 255, 0.04);
    border-radius: 14px;
  }
  .pt-tab--active {
    color: var(--color-highlight-2, #02b5bb);
    font-weight: 700;
  }
  .pt-tab--active::after {
    background: var(--color-highlight-2, #02b5bb);
    box-shadow: 0 0 10px rgba(2, 181, 187, 0.45);
  }

  @media (max-width: 1024px) {
    .pt-header {
      width: calc(100% - 24px);
      top: 14px;
      border-radius: 20px;
      height: 58px;
    }
    .pt-space { height: 88px; }
  }
  @media (max-width: 640px) {
    .pt-inner { padding: 0 10px 0 14px; }
    .pt-tab { padding: 0 10px; font-size: 0.67rem; letter-spacing: 0.04em; }
    .pt-brand { padding-right: 10px; }
    .pt-brand__logo { height: 21px; }
    .pt-header { height: 52px; border-radius: 16px; }
    .pt-space { height: 76px; }
  }
</style>
