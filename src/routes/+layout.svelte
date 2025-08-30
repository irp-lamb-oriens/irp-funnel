<script lang="ts">
    import { onMount } from "svelte";
    import { afterNavigate } from "$app/navigation";
    import ThemeChanger from "../components/ThemeChanger/ThemeChanger.svelte";
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
    });
</script>

<ThemeChanger visible={false} />

<slot />

<style lang="scss">
    @use "./styles/everything.scss";
</style>