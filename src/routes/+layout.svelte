<script lang="ts">
    import { onMount } from "svelte";
    import { afterNavigate } from "$app/navigation";
    import ThemeChanger from "../components/ThemeChanger/ThemeChanger.svelte";
    import store from "../components/store.ts";
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

<slot />

<style lang="scss">
    @use "./styles/everything.scss";
</style>
