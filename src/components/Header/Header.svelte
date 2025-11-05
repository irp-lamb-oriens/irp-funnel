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
    { label: "Careers", href: "/careers" },
    { label: "Free Resources", href: "/free-resources" },
    { label: "News", href: "/news-updates" },
    { label: "Contact Us", href: "/contact-us" },
    { label: "", href: "#", icon: "/icons/phone.svg" }
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
  let doHide = writable(!!lastScrollY);

  onMount(() => {
    window.addEventListener("scroll", event => {
      doHide.set(lastScrollY < window.scrollY);
      lastScrollY = window.scrollY;
    });
  });
</script>

<style lang="scss" src="./Header.scss"></style>

<div class="header-space"></div>
<header class="header-section" class:turnNeomorphicPlasticGlass={$doHide}>
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
