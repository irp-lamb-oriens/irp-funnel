<script lang="ts">
    import { onMount } from "svelte";
    import { afterNavigate } from "$app/navigation";
    import ThemeChanger from "../components/ThemeChanger/ThemeChanger.svelte";
    import store from "../components/store.ts";
    import EvoDevSwitcher from "../components/EvoDevSwitcher.svelte";
    import { page } from "$app/stores";
    import ImageGrid from "../components/systems/wrappers/ImageGrid/ImageGrid.svelte";
    import { captureAttribution, getAttribution } from "$lib/attribution.ts";

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
        // ── Attribution (UTM / refer / click ids) ─────────────────────────
        // Records the touch in localStorage so every later lead submission
        // (capture, booking, Lily) carries it — see $lib/attribution.ts.
        const touch = captureAttribution();

        // Legacy click counter (`referrals` collection) — now also fires for
        // UTM-tagged links so the dashboard can show visits per campaign.
        if (touch && !touch.inferred) {
            const referralData = {
                // Stable key per tagged link: the refer tag, or the UTM tuple.
                text: touch.refer || ["utm", touch.source, touch.medium, touch.campaign, touch.content, touch.term].join("|"),
                trafficSource: document.referrer,
                geographicData: navigator.language,
                deviceType: navigator.userAgent,
                completeUrl: window.location.href,
                utm: {
                    source: touch.source,
                    medium: touch.medium,
                    campaign: touch.campaign,
                    term: touch.term,
                    content: touch.content,
                    refer: touch.refer,
                },
                visitorId: getAttribution().visitorId,
            };
            fetch($store.apiURL() + "/api/referrals", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(referralData),
            }).catch(error => console.error("Error sending referral:", error));
        }

        afterNavigate(({ to }) => {
            if (to && to.url) { // Add null check for 'to' and 'to.url'
                gtag("config", MEASUREMENT_ID, { page_path: to.url.pathname });
                // Client-side navigations can carry tags too (e.g. an internal
                // link with ?utm_…). Idempotent — re-landing is de-duplicated.
                captureAttribution(to.url.href);
            }
        });
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
