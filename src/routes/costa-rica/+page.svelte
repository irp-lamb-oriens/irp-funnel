<script lang="ts">
    import ChosenShader from "../../components/ShaderToy/ChosenShader/ChosenShader.svelte";
    import SocketClient from "../../components/SocketClient.svelte";
    import { onMount, onDestroy } from "svelte";
    import { browser } from "$app/environment";
    import store, { isScrollingDown, saveToStore } from "../../components/store.ts"; // Import the store variable
    import ThemeChanger from "../../components/ThemeChanger/ThemeChanger.svelte";
    // import MainSteps from "../../components/systems/steps/StepsTowardsSubscribe/MainSteps.svelte";
    import GlobalData from "../../components/GlobalData/GlobalData.svelte";
    import type { PageData } from './$types.js'; // Import PageData type
    import MainSteps from "../../components/systems/steps/BaseStepsFunnel/MainSteps.svelte";

    export let data: PageData; // Receive data from load function

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
            // Only run in browser
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

<ThemeChanger visible={false} />
<GlobalData />
<SocketClient />
<MainSteps />

<style lang="scss">
    @use "../styles/everything.scss";
</style>
