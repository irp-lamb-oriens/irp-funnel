<script lang="ts">
    import { onMount } from "svelte";
    import { afterNavigate } from "$app/navigation";
    import ThemeChanger from "../components/ThemeChanger/ThemeChanger.svelte";
    import store from "../components/store.ts";
    import EvoDevSwitcher from "../components/EvoDevSwitcher.svelte";
    import { page } from "$app/stores";
    import ImageGrid from "../components/systems/wrappers/ImageGrid/ImageGrid.svelte";

    // Partner logo strip shown on every public page, right below the header.
    // Ordered by priority: the five most important partner / media brands.
    const partnerImages = [
        "/icons/partners/AAE.webp",


        "/icons/partners/AAE2.svg", // International Living
        "/icons/partners/AAC.svg",  // Expatsi
        "/icons/partners/AAJ.png",  // Tico Times
        "/icons/partners/AAE4.webp", // Live and Invest Overseas
        "/icons/partners/AAE3.png", // CRCIPI


        "/icons/partners/AAK.svg",
        "/icons/partners/AAB.svg",
        "/icons/partners/AAA.png",
        "/icons/partners/AAD.svg",
        "/icons/partners/AAF.svg",
        "/icons/partners/AAG.svg",
        "/icons/partners/AAI.svg",

    ];

    // Routes that render their own full-screen surface (app/dashboard tooling)
    // skip the strip. Dashboard is the explicit exclusion; the others are
    // internal tools where the marketing strip would collide with layout.
    const STRIP_HIDDEN_PREFIXES = [
        "/dashboard",
        "/funnel",
        "/main-funnel",
        "/agent",
        "/metrics",
    ];
    $: showPartnerStrip = !STRIP_HIDDEN_PREFIXES.some((p) =>
        $page.url.pathname.startsWith(p),
    );
    // check if need later
    // import SmoothScrollWrapper from "../components/SmoothScrollWrapper/SmoothScrollWrapper.svelte";
    const MEASUREMENT_ID = "G-3X226YFLE6";

    onMount(() => {
        (window as any).dataLayer = (window as any).dataLayer || [];
        function gtag(...args: any[]) { // Accept rest parameters
            (window as any).dataLayer.push(...args); // Push to window.dataLayer and spread arguments
        }
        gtag("js", new Date());
        gtag("config", MEASUREMENT_ID, {
            anonymize_ip: true,
        });
        afterNavigate(({ to }) => {
            if (to && to.url) { // Add null check for 'to' and 'to.url'
                gtag("config", MEASUREMENT_ID, { page_path: to.url.pathname });
            }
        });

        const urlParams = new URLSearchParams(window.location.search);
        const referer = urlParams.get("refer");

        if (referer) {
            const trafficSource = document.referrer;
            const geographicData = navigator.language;
            const deviceType = navigator.userAgent;
            const completeUrl = window.location.href;

            const referralData = {
                text: referer,
                trafficSource,
                geographicData,
                deviceType,
                completeUrl,
            };
            
            console.log(`Referer found: ${referer}. Sending to server.`);
            fetch($store.apiURL() + "/api/referrals", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(referralData),
            })
            .then(response => response.json())
            .then(data => console.log("Referral API response:", data))
            .catch(error => console.error("Error sending referral:", error));
        } else {
            console.log("No referer found in URL.");
        }
    });
</script>

<ThemeChanger visible={false} />

<!-- <SmoothScrollWrapper> -->
    {#if showPartnerStrip}
        <ImageGrid images={partnerImages} />
    {/if}
    <slot />
<!-- </SmoothScrollWrapper> -->

{#if import.meta.env.DEV}
  <EvoDevSwitcher />
{/if}

<style lang="scss">
    @use "./styles/everything.scss";
</style>
