<script lang="ts">
    import { onMount } from "svelte";
    import QRCode from "qrcode";

    export let configuratorEmail: string;
    export let newsSourceId: string;
    export let lead: string | undefined | null = ""; // Handle potential undefined/null

    let fullUrl = "";
    let qrCodeDataUrl = "";
    let copyButtonText = "Copy URL";
    let downloadButtonText = "Download QR";

    // Reactive statement to update URL and QR code when props change
    $: {
        const leadParam = lead ? `&lead=${encodeURIComponent(lead)}` : "";
        fullUrl = `https://aibanewsletter.club/subscribe?configuratorId=${encodeURIComponent(configuratorEmail)}&newsSourceId=${encodeURIComponent(newsSourceId)}${leadParam}`;
        generateQrCode(fullUrl);
    }

    async function generateQrCode(url: string) {
        if (!url) return;
        try {
            qrCodeDataUrl = await QRCode.toDataURL(url, {
                errorCorrectionLevel: "H", // High error correction
                type: "image/png",
                margin: 2, // Smaller margin
                scale: 4, // Adjust scale for size if needed
            });
        } catch (err) {
            console.error("Failed to generate QR code:", err);
            qrCodeDataUrl = ""; // Reset on error
        }
    }

    async function copyUrl() {
        if (!navigator.clipboard) {
            alert("Clipboard API not available."); // Basic fallback
            return;
        }
        try {
            await navigator.clipboard.writeText(fullUrl);
            copyButtonText = "Copied!";
            setTimeout(() => {
                copyButtonText = "Copy URL";
            }, 1500); // Reset text after 1.5 seconds
        } catch (err) {
            console.error("Failed to copy URL:", err);
            copyButtonText = "Failed";
            setTimeout(() => {
                copyButtonText = "Copy URL";
            }, 1500);
        }
    }

    function downloadQr() {
        if (!qrCodeDataUrl) return;
        try {
            const link = document.createElement("a");
            link.href = qrCodeDataUrl;
            link.download = `qrcode-${newsSourceId || "subscription"}.png`; // Filename
            document.body.appendChild(link); // Required for Firefox
            link.click();
            document.body.removeChild(link);
            downloadButtonText = "Downloaded!";
            setTimeout(() => {
                downloadButtonText = "Download QR";
            }, 1500);
        } catch (err) {
            console.error("Failed to download QR code:", err);
            downloadButtonText = "Failed";
            setTimeout(() => {
                downloadButtonText = "Download QR";
            }, 1500);
        }
    }

    // Generate QR on mount in case props are immediately available
    onMount(() => {
        if (fullUrl) {
            generateQrCode(fullUrl);
        }
    });
</script>

<div class="copy-url-container">
    <div class="controls">
        {#if qrCodeDataUrl}
            <div class="qr-section">
                <img
                    src={qrCodeDataUrl}
                    alt="Subscription QR Code"
                    class="qr-image"
                />
                <div>
                    <button on:click={copyUrl} class="copy-button"
                        >{copyButtonText}</button
                    >
                    <button on:click={downloadQr} class="download-button"
                        >{downloadButtonText}</button
                    >
                </div>
            </div>
        {:else}
            <p>Generating QR code...</p>
        {/if}
    </div>
</div>

<style>
    .copy-url-container {
        font-family: sans-serif;
        border-radius: 8px;
        padding: 15px;
        background-color: var(--color-background-inversion-opaque);
        backdrop-filter: blur(6px);
        max-width: 100%;
        box-sizing: border-box;
        box-shadow: 0 0 10px -8.5px var(--color-background);
    }

    .url-text {
        word-wrap: break-word; /* Wrap long URLs */
        font-size: 0.9em;
        color: #333;
        background-color: #eee;
        padding: 8px;
        border-radius: 4px;
    }

    .controls {
        display: flex;
        flex-direction: column; /* Stack controls vertically */
        gap: 15px; /* Space between URL copy and QR section */
        align-items: flex-start; /* Align items to the start */
    }

    .qr-section {
        display: flex;
         /* Vertically align QR and download button */
        gap: 10px; /* Space between QR image and download button */
    }

    .qr-image {
        display: block;
        max-width: 32.55px; /* Adjust size as needed */
        height: auto;
        border: 1px solid #eee;
    }

    button {
        padding: 8px 12px;
        border: 0;
        border-radius: 4px;
        cursor: pointer;
        font-size: 0.9em;
        transition: .35s;
    }

    button:hover {
        padding: 8px 20px;
        background-color: var(--color-foreground);
        color: var(--color-background);        
    }

    button:active {
        background-color: #e0e0e0;
    }

    .copy-button {
        /* Specific styles if needed */
    }

    .download-button {
        /* Specific styles if needed */
    }
</style>
