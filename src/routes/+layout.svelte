<script>
    import { onMount } from "svelte";
    import { afterNavigate } from "$app/navigation";
    const MEASUREMENT_ID = "G-3X226YFLE6";

    onMount(() => {
        window.dataLayer = window.dataLayer || [];
        function gtag() {
            dataLayer.push(arguments);
        }
        gtag("js", new Date());
        gtag("config", MEASUREMENT_ID, {
            anonymize_ip: true,
        });
        afterNavigate(({ to }) => {
            gtag("config", MEASUREMENT_ID, { page_path: to.url.pathname });
        });
    });
</script>

<slot />
