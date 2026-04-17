<script lang="ts">
  import Logo from "./Logo.svelte";
  import MainMenu from "./MainMenu.svelte";
  import type { MenuItem } from "./MainMenu.svelte";
  import DestinationsMenu from "./DestinationsMenu.svelte";
  import type { Destination } from "./DestinationsMenu.svelte";
    import { writable } from "svelte/store";
    import { onMount } from "svelte";
  // Main menu items
  const menuItems: MenuItem[] = [
    { label: "Home", href: "/" },
    { label: "Free Resources", href: "/free-resources" },
    { label: "Guides", href: "/guides" },
    { label: "News", href: "/news-updates" },
    { label: "Contact", href: "/contact-us" },
  ];
  const cta = { label: "Schedule Consultation", href: "/consultation" };
  // Destinations
  const destinations: Destination[] = [
    {
      label: "Costa Rica",
      href: "/costa-rica",
      icon: "https://img.icons8.com/color/48/null/costa-rica.png"
    },
    {
      label: "Panama",
      href: "/panama",
      icon: "https://img.icons8.com/color/48/null/panama.png"
    },
    {
      label: "Mexico",
      href: "/mexico",
      icon: "https://img.icons8.com/color/48/null/mexico.png"
    },
    {
      label: "Portugal",
      href: "/portugal",
      icon: "https://img.icons8.com/color/48/null/portugal.png"
    },
    {
      label: "Spain",
      href: "/spain",
      icon: "https://img.icons8.com/color/48/null/spain.png"
    },
    {
      label: "Colombia",
      href: "/colombia",
      icon: "https://img.icons8.com/color/48/colombia.png"
    }
  ];
  
  let lastScrollY = 0;
  let scrolled = false;
  let hidden = false;

  onMount(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      scrolled = currentScrollY > 20;
      
      // Hide header when scrolling down, show when scrolling up
      if (currentScrollY > lastScrollY && currentScrollY > 100) {
        hidden = true;
      } else {
        hidden = false;
      }
      
      lastScrollY = currentScrollY;
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  });
</script>

<style lang="scss" src="./Header.scss"></style>

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
  <!-- <div class="header-row destinations-row" class:hide={$doHide}>
    <div class="destinations-label">
      <p><strong>Destinations:&nbsp;</strong></p>
    </div>
    <DestinationsMenu {destinations} />
  </div> -->
</header>
