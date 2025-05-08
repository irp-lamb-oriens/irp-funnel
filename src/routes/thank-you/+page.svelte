<script lang="ts">
    import ChosenShader from "../../components/ShaderToy/ChosenShader/ChosenShader.svelte";
    import SocketClient from "../../components/SocketClient.svelte";
    import { onMount, onDestroy } from "svelte";
    import { browser } from "$app/environment";
    import store, { isScrollingDown, saveToStore, currentFunnelId, currentFunnelVersion, funnels } from "../../components/store.ts"; // Import the store variable
    import ThemeChanger from "../../components/ThemeChanger/ThemeChanger.svelte";
    // import MainSteps from "../../components/systems/steps/StepsTowardsSubscribe/MainSteps.svelte";
    import GlobalData from "../../components/GlobalData/GlobalData.svelte";
    import type { PageData } from './$types.ts'; // Import PageData type
    import ThankYou from "../../components/systems/steps/BaseStepsFunnel/ThankYou.svelte";

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
            // Only run in browser
            // Set funnel id and version from query params
            const params = new URLSearchParams(window.location.search);
            const funnelId = params.get("id");
            const funnelVersion = params.get("version");
            if (funnelId) {
                currentFunnelId.set(funnelId);
                if (funnelVersion) {
                    currentFunnelVersion.set(funnelVersion);
                } else {
                    // Pick a random version from the available keys in funnels[funnelId]
                    const unsubscribe = funnels.subscribe(($funnels) => {
                        const versions = $funnels[funnelId] ? Object.keys($funnels[funnelId]) : [];
                        if (versions.length > 0) {
                            const randomVersion = versions[Math.floor(Math.random() * versions.length)];
                            currentFunnelVersion.set(randomVersion);
                        } else {
                            currentFunnelVersion.set(null);
                        }
                        unsubscribe();
                    });
                }
            } else {
                currentFunnelId.set(null);
                currentFunnelVersion.set(null);
            }

            // Extract additional query params
            email = params.get("email");
            name = params.get("name");
            countryFrom = params.get("countryFrom");
            countryTo = params.get("countryTo");

            // Collect all other params into submit object
            submit = {};
            params.forEach((value, key) => {
                if (
                    key !== "email" &&
                    key !== "name" &&
                    key !== "countryFrom" &&
                    key !== "countryTo" &&
                    key !== "id"
                ) {
                    submit[key] = value;
                }
            });

            // Only patch non-funnel fields from query params
            const storePatch: Record<string, any> = { submit, hasInteracted: true };
            if (email) storePatch.email = email;
            if (name) storePatch.name = name;
            if (countryFrom) storePatch.countryFrom = countryFrom;
            if (countryTo) storePatch.countryTo = countryTo;
            // Save to store
            store.update(s => {
                const patched = { ...s, ...storePatch };
                console.log("ThankYou page: patched store after query params", patched);
                return patched;
            });

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
<ThankYou />

<style lang="scss">
    @use "../styles/everything.scss";
</style>
