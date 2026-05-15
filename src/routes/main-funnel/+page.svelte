<script lang="ts">
    import { onDestroy, onMount } from "svelte";
    import GlobalData from "../../components/GlobalData/GlobalData.svelte";
    import SocketClient from "../../components/SocketClient.svelte";
    import ThemeChanger from "../../components/ThemeChanger/ThemeChanger.svelte";
import { isScrollingDown, saveToStore } from "../../components/store.ts";
import MainFunnel from "../../components/systems/steps/NewFunnel/MainFunnel.svelte";
import { browser } from "$app/environment";
import BgWrapper from "../../components/BgWrapper.svelte";
import type { PageData } from './$types.js';

export let data: PageData; // Receive data from load function

let email: string | null = null;
let name: string | null = null;
let countryFrom: string | null = null;
let countryTo: string | null = null;
let submit: Record<string, string> = {};

let lastScrollY = 0;

function handleScroll() {
    const currentScrollY = window.scrollY;
    let scrollingDownValue = false;
    // Add a threshold to prevent hiding on small scrolls or bounces
    if (Math.abs(currentScrollY - lastScrollY) > 10) {
        // Only set scrollingDown to true after scrolling down a bit
        scrollingDownValue =
            currentScrollY > lastScrollY && currentScrollY > 50;
    }
    // Always reset scrollingDown if scrolling up or near the top
    if (currentScrollY < lastScrollY || currentScrollY <= 50) {
        scrollingDownValue = false;
    }
    isScrollingDown.set(scrollingDownValue); // Update the store
    lastScrollY = currentScrollY;
}

onMount(() => {
    // Handle missing params if necessary, maybe redirect or show error
    console.warn("Subscribe page loaded without required URL parameters (newsSourceId, configuratorId, lead).");
    saveToStore({ stepsIndex: 0 }); // Still reset steps index
    // localStorage saving is handled by the store subscription if keysToSave includes these items

    if (browser) {
        lastScrollY = window.scrollY; // Initialize lastScrollY
        window.addEventListener("scroll", handleScroll, { passive: true });
    }
});

onDestroy(() => {
    if (browser) {
        // Only run in browser
        window.removeEventListener("scroll", handleScroll);
    }
});
</script>

<BgWrapper>
  <ThemeChanger visible={false} />
  <GlobalData />
  <SocketClient />
  <MainFunnel />
</BgWrapper>

<style lang="scss">
    @use "../styles/everything.scss";
</style>
