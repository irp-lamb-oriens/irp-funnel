<script>
  import GlobalData from "../components/GlobalData/GlobalData.svelte";
  import Header from "../components/Header/Header.svelte";
  import ChosenShader from "../components/ShaderToy/ChosenShader/ChosenShader.svelte";
  import SocketClient from "../components/SocketClient.svelte";
  import { onMount, onDestroy } from "svelte";
  import { browser } from "$app/environment";
  import { isScrollingDown } from "../components/store.ts"; // Import the store variable

  let lastScrollY = 0;

  function handleScroll() {
    const currentScrollY = window.scrollY;
    let scrollingDownValue = false;
    // Add a threshold to prevent hiding on small scrolls or bounces
    if (Math.abs(currentScrollY - lastScrollY) > 10) {
      // Only set scrollingDown to true after scrolling down a bit
      scrollingDownValue = currentScrollY > lastScrollY && currentScrollY > 50;
    }
    // Always reset scrollingDown if scrolling up or near the top
    if (currentScrollY < lastScrollY || currentScrollY <= 50) {
       scrollingDownValue = false;
    }
    isScrollingDown.set(scrollingDownValue); // Update the store
    lastScrollY = currentScrollY;
  }

  onMount(() => {
    if (browser) { // Only run in browser
      lastScrollY = window.scrollY; // Initialize lastScrollY
      window.addEventListener("scroll", handleScroll, { passive: true });
    }
  });

  onDestroy(() => {
    if (browser) { // Only run in browser
      window.removeEventListener("scroll", handleScroll);
    }
  });
</script>

<ChosenShader />

<style lang="scss">
  @use "./styles/everything.scss";
</style>
