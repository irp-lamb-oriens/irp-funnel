<script context="module" lang="ts">
  export interface MenuItem {
    label: string;
    href: string;
    icon?: string;
    isCTA?: boolean;
  }
</script>
<script lang="ts">
  import CTAButton from "./CTAButton.svelte";
  import MenuToggle from "./MenuToggle.svelte";
  export let menuItems: MenuItem[] = [];
  export let cta: { label: string; href: string } | null = null;

  let mobileMenuOpen = false;

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === "Escape") {
      mobileMenuOpen = false;
    }
  }
</script>

<nav class="main-menu-col" aria-label="Main navigation">
  <ul class="main-menu" role="menubar">
    {#each menuItems as item (item.href)}
      <li role="none">
        <a
          href={item.href}
          class:item-cta={item.isCTA}
          role="menuitem"
          tabindex="0"
        >
          {#if item.icon}
            <img src={item.icon} alt={item.label + ' icon'} width="30" height="30" />
          {/if}
          {item.label}
        </a>
      </li>
    {/each}
    {#if cta}
      <li role="none">
        <CTAButton label={cta.label} href={cta.href} variant="primary" />
      </li>
    {/if}
  </ul>
  <MenuToggle
    open={mobileMenuOpen}
    onToggle={() => (mobileMenuOpen = !mobileMenuOpen)}
    {menuItems}
    cta={cta as { label: string; href: string }}
  />
</nav>

<style lang="scss">
.main-menu-col {
  flex: 1 1 auto;
  display: flex;
  align-items: center;
  position: relative;
  justify-content: flex-end;
  padding-right: 5rem;

  @media (max-width: 1024px) {
    padding-right: 2.5rem;
  }
}
.main-menu {
  display: flex;
  gap: 1.5rem;
  list-style: none;
  margin: 0;
  padding: 0;
  align-items: center;

  @media (max-width: 1140px) {
    gap: .5rem;
  }

  @media (max-width: 1050px) {
    gap: .25rem;
  }
}
.main-menu li {
  display: flex;
  align-items: center;
}
.main-menu a {
  color: #222;
  text-decoration: none;
  font-weight: 500;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  transition: background 0.15s;
}
.main-menu a:hover,
.cta-btn:hover {
  background: #f2f2f2;
}
.item-cta {
  background: var(--color-highlight-1);
  color: #fff !important;
  padding: 0.5rem 1.2rem;
  border-radius: 4px;
  font-weight: 600;
  text-decoration: none;
  transition: background 0.15s;
  margin-left: 0.5rem;
}
@media (max-width: 1024px) {
  .main-menu {
    display: none;
  }
  .mobile-menu {
    display: block;
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    background: #fff;
    box-shadow: 0 2px 8px rgba(0,0,0,0.08);
    z-index: 10011;
    list-style: none;
    margin: 0;
    padding: 1rem 0;
  }
  .mobile-menu li {
    padding: 0.5rem 1.5rem;
  }
}
</style>
