<script lang="ts">
    import { get } from 'svelte/store';
    import { email, name, topCountries, funnelType } from './store.ts';
    import Page from '../../wrappers/Page/Page.svelte';
    import SubmitButton from '../../buttons/SubmitButton/SubmitButton.svelte';
    import MarkdownText from '../../texts/MarkdownText/MarkdownText.svelte';
    import { browser } from '$app/environment';
    import countries from '../../inputs/Country/countries.ts';

    let isLoading = false;
    let submitError: string | null = null;
    let submitSuccess = false;
    let submittedDataForDisplay: Record<string, any> = {};

    export let canReveal = false;

    let getDisplayData: () => Record<string, any>;

    $: if ($topCountries) {
        getDisplayData = () => ({
            Name: get(name),
            Email: get(email),
            "I'm interested in": countries.find(({ code }) => code === get(topCountries)[0])?.name + " news",
        });
    }

    async function handleSubmit() {
        isLoading = true;
        submitError = null;
        submitSuccess = false;

        const storeData = {
            name: get(name),
            email: get(email),
            topCountries: get(topCountries),
            funnelType: get(funnelType),
        };

        const payload = {
            ...storeData,
            // Add any additional properties needed for submission
            // For example, if there's a specific API endpoint or additional data
            // submit: {
            //     ...(storeData.submit || {}),
            // }
        };

        console.log("SubmitStage: full payload before fetch:", JSON.stringify(payload, null, 2));

        const apiUrl = window.location.origin.includes("localhost") ? "http://localhost:8000" : "https://irp-funnel-server.onrender.com"; // Use a default API URL or define a specific one

        try {
            const response = await fetch(`${apiUrl}/api/capture-data`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });

            console.log("response", response)

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'Failed to parse error response' }));
                throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            console.log('Submission successful:', result);

            submitSuccess = true;

            setTimeout(() => {
                window.location.href = "https://www.internationalrelocationpartner.com?refer=thankyou"
            }, 3000);
        } catch (error) {
            console.error('Submission failed:', error);
            submitError = error instanceof Error ? error.message : 'An unknown error occurred during submission.';
        } finally {
            isLoading = false;
        }
    }
</script>

<Page>
    <div class="stage-content">
        {#if submitSuccess}
            <MarkdownText {canReveal}>
                ## Thank You!

                **Your information** has been **submitted successfully.**
            </MarkdownText>
        {:else if submitError}
            <MarkdownText {canReveal}>
                ## Submission Error
                <span style="color: red;">{submitError}</span>
                Please try again or contact support.
            </MarkdownText>
            <SubmitButton
                label="Retry Submission"
                callback={handleSubmit}
                loading={isLoading}
                disabled={isLoading}
            />
        {:else}
            <MarkdownText {canReveal}>
                ## Ready to Submit?

                **Please review** your information below.
            </MarkdownText>
            <div class="review-data">
                <ul>
                    {#each Object.entries(getDisplayData()) as [key, value]}
                        {#if value !== undefined && value !== null && value !== ''}
                            <li><strong>{key}:</strong> {value}</li>
                        {/if}
                    {/each}
                </ul>
            </div>

            <SubmitButton
                label="Submit Information"
                callback={handleSubmit}
                loading={isLoading}
                disabled={isLoading || !!submitError} 
            />
        {/if}
    </div>
</Page>

<style lang="scss">
    .stage-content {
        display: flex;
        flex-direction: column;
        gap: 20px;
        padding: 0px 20px;
        max-width: 600px;
        margin: auto;
        text-align: center;
    }
    ul {
        list-style: none;
        padding: 0;
        text-align: left;
        max-width: 500px;
        margin-left: auto;
        margin-right: auto;
    }
    li {
        margin-bottom: 8px;
        word-break: break-word;
    }
    li strong {
        color: var(--color-background);
    }
    .review-data {
        width: 100%;
    }
</style>
