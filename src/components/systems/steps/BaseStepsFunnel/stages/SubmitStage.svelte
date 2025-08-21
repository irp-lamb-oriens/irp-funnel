<script lang="ts">
    import { get } from 'svelte/store';
    import store from '../../../../store.ts'; // currentFunnelId and currentFunnelVersion will be read from localStorage directly
    import Page from '../../../wrappers/Page/Page.svelte';
    import SubmitButton from '../../../buttons/SubmitButton/SubmitButton.svelte';
    import MarkdownText from '../../../texts/MarkdownText/MarkdownText.svelte';
    import { browser } from '$app/environment';
    import { AGE_RANGES_BIDI } from '../../../helpers/constants.ts';

    let isLoading = false;
    let submitError: string | null = null;
    let submitSuccess = false;
    let submittedDataForDisplay: Record<string, any> = {}; // To display data on success
    // let userData: any; // No longer needed
    // let stepsIndex: number = 0; // No longer needed for this logic

    export let canReveal = false;

    // $: stepsIndex = get(store).stepsIndex ?? 0; // Not directly used for display logic here

    let getDisplayData: () => Record<string, any>;
    let funnelCopyForDisplay: string | null = null;

    $: {
        getDisplayData = () => ({
            Name: $store.name,
            Email: $store.email,
            'Age Range': $store.age?.toString() ? AGE_RANGES_BIDI[$store.age?.toString()] || $store.age?.toString() : $store.age,
            // Sex: $store.sex, // Sex step is deactivated
            Budget: $store.budget >= 10000 ? "over 10000" : "under 10000",
            'Square Feet': $store.squareFeet === -1 ? "I don't know" : $store.squareFeet,
            'Moving From Property Type': $store.propertyTypeFrom,
            'Moving To Property Type': $store.propertyTypeTo,
            'Reasons for Moving': $store.reasonsForMoving?.join(', '),
            'Country From': $store.countryFrom, // Assuming these are in store
            'Country To': $store.countryTo,     // Assuming these are in store
        });
        if (browser) {
            funnelCopyForDisplay = localStorage.getItem('funnelCopyText');
        }
    }
    // Removed the old error checking block based on stepsIndex and userData

    async function handleSubmit() {
        isLoading = true;
        submitError = null;
        submitSuccess = false;

        const storeData = $store;
        const funnelId = localStorage.getItem('currentFunnelId');
        const funnelVersion = localStorage.getItem('currentFunnelVersion');
        const funnelObjectString = localStorage.getItem('currentFunnelObject');
        const funnelCopyText = localStorage.getItem('funnelCopyText');

        let funnelObjectParsed = null;
        if (funnelObjectString) {
            try {
                funnelObjectParsed = JSON.parse(funnelObjectString);
            } catch (e) {
                console.error("Error parsing funnelObject from localStorage:", e);
            }
        }

        const payload = {
            ...storeData,
            // Ensure funnelCopy is undefined if funnelCopyText is null, otherwise use funnelCopyText
            funnelCopy: funnelCopyText === null ? undefined : funnelCopyText, 
            submit: {
                ...(storeData.submit || {}), // Ensure storeData.submit exists
                funnelId,
                funnelVersion,
                funnelObject: funnelObjectParsed
            }
        };

        console.log("SubmitStage: full payload before fetch (funnelId/Version from localStorage):", JSON.stringify(payload, null, 2));

        const apiUrl = storeData.apiURL ? storeData.apiURL() : window.location.origin;

        try {
            const response = await fetch(`${apiUrl}/api/create-user`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });

            // Normalize function to handle accents and special characters
            function normalize(str: string) {
                return str.toLowerCase().replace(/-/g, ' ').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            }

            // Determine the newsSourceId based on the funnelId
            let newsSourceId;
            const normalizedFunnelId = normalize(funnelId as string);
            if (normalizedFunnelId.includes('costa rica')) {
                newsSourceId = 'b545170e1296ecbdc6f25f676114b279db7660cdd4d3025cc75f90e81007e460';
            } else if (normalizedFunnelId.includes('panama')) {
                newsSourceId = '9c67a6a84c4c05fb02ffd0ec620d7fa30804c3d84e2605046306a7a7f1bfded7';
            } else if (normalizedFunnelId.includes('mexico')) {
                newsSourceId = '460b3b4148238d1ffa62fd36a3427aac493befb047d23ee24f7a215b5274c3c4';
            }

            // Additional fetch to the public subscribe endpoint
            await fetch('https://irp-funnel-server.onrender.com/public-subscribe', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    configuratorId: 'consultation@internationalrelocationpartner.com',
                    newsSourceId,
                    email: $store.email,
                    name: $store.name,
                    language: 'en',
                    bio: "",
                }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'Failed to parse error response' }));
                throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            console.log('Submission successful:', result);

            submitSuccess = true; // Set this after preparing 

            setTimeout(() => {
                window.location.href = "https://www.internationalrelocationpartner.com?from=thankyou"
            }, 3000);
            // Optionally clear store or redirect user here
            // saveToStore({ name: '', email: '', budget: null, countryFrom: null, countryTo: null, stepsIndex: 0 }); // Example reset
        } catch (error) {
            console.error('Submission failed:', error);
            submitError = error instanceof Error ? error.message : 'An unknown error occurred during submission.';
            // submitSuccess = true; // Set this after preparing 

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
            <!-- Optionally add next steps or links here -->
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

            Press this button so we taylor a call for you with this information

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
    .anchor {
        color: var(--color-background);

        &:hover {
            text-decoration: underline;
        }
    }

    .stage-content {
        display: flex;
        flex-direction: column;
        gap: 20px;
        padding: 0px 20px;
        max-width: 600px;
        margin: auto;
        text-align: center; /* Center text */
    }
    ul {
        list-style: none;
        padding: 0;
        text-align: left;
        border-radius: 8px; /* Consistent border-radius */
        /* display: inline-block; /* Fit content width */
        /* width: 100%; /* Make it full width of its container */
        max-width: 500px; /* Limit width */
        margin-left: auto;
        margin-right: auto;
    }
    li {
        margin-bottom: 8px; /* Slightly more spacing */
        word-break: break-word; /* Prevent long strings from breaking layout */
    }
    li strong {
        color: var(--color-background);
    }
    .review-data {
        width: 100%;
    }
    .vsl-copy-display {
        display: block;
        margin-top: 4px;
        font-style: italic;
        font-size: 0.9em;
        max-height: 100px; /* Limit height for long copy */
        overflow-y: auto; /* Allow scrolling for long copy */
        padding: 5px;
        background-color: rgba(0,0,0,0.03);
        border-radius: 4px;
    }
</style>
