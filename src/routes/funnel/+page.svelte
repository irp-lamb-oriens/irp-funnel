<script lang="ts">
    import ChosenShader from "../../components/ShaderToy/ChosenShader/ChosenShader.svelte";
    import SocketClient from "../../components/SocketClient.svelte";
    import { onMount, onDestroy } from "svelte";
    import { get } from "svelte/store"; // Import get
    import { browser } from "$app/environment";
    import store, { isScrollingDown, saveToStore, currentFunnelId, currentFunnelVersion, funnels, funnelsLoaded } from "../../components/store.ts"; // Import the store variable
    import ThemeChanger from "../../components/ThemeChanger/ThemeChanger.svelte";
    // import MainSteps from "../../components/systems/steps/StepsTowardsSubscribe/MainSteps.svelte";
    import GlobalData from "../../components/GlobalData/GlobalData.svelte";
    import type { PageData } from './$types.ts'; // Import PageData type
    import MainSteps from "../../components/systems/steps/BaseStepsFunnel/Funnel.svelte";
    import BgWrapper from "../../components/BgWrapper.svelte";

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
            // Set funnel id and version from query params
            const params = new URLSearchParams(window.location.search);
            const funnelIdFromParams = params.get("id");
            const funnelVersionFromParams = params.get("version");

            if (funnelIdFromParams) {
                currentFunnelId.set(funnelIdFromParams);
                if (funnelIdFromParams !== null) {
                    localStorage.setItem('currentFunnelId', funnelIdFromParams);
                } else {
                    localStorage.removeItem('currentFunnelId');
                }
                if (funnelVersionFromParams) {
                    currentFunnelVersion.set(funnelVersionFromParams);
                    if (funnelVersionFromParams !== null) {
                        localStorage.setItem('currentFunnelVersion', funnelVersionFromParams);
                    } else {
                        localStorage.removeItem('currentFunnelVersion');
                    }
                    saveToStore({ currentFunnelId: funnelIdFromParams, currentFunnelVersion: funnelVersionFromParams });
                } else {
                    // Wait for funnels to be loaded before picking a random version
                    const unsubscribeFunnelsLoaded = funnelsLoaded.subscribe(($loaded) => {
                        if ($loaded) {
                            console.log("funnels", $funnels, funnelIdFromParams)
                            const versions = $funnels[funnelIdFromParams] ? Object.keys($funnels[funnelIdFromParams]) : [];
                            let determinedVersion: string | null = null;

                            if (versions.length > 0) {
                                determinedVersion = versions[Math.floor(Math.random() * versions.length)];
                            } else {
                                determinedVersion = null;
                                console.warn(`No versions found for funnelId: ${funnelIdFromParams} after funnels loaded.`);
                            }
                            currentFunnelVersion.set(determinedVersion);
                            if (determinedVersion !== null) {
                                localStorage.setItem('currentFunnelVersion', determinedVersion);
                            } else {
                                localStorage.removeItem('currentFunnelVersion');
                            }
                            
                            const currentFunnelObject = JSON.stringify($funnels[funnelIdFromParams][determinedVersion as string]);

                            localStorage.setItem('currentFunnelObject', currentFunnelObject);
                            
                            saveToStore({ currentFunnelId: funnelIdFromParams, currentFunnelVersion: determinedVersion, currentFunnelObject });
                            
                            // Unsubscribe from funnelsLoaded as it has served its purpose
                            if (typeof unsubscribeFunnelsLoaded === 'function') {
                                unsubscribeFunnelsLoaded();
                            }
                        }
                    });
                }
            }

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
  <MainSteps />
</BgWrapper>

<style lang="scss">
    @use "../styles/everything.scss";
</style>
