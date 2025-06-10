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

    let displayData: Record<string, any> = {};
    let funnelCopyForDisplay: string | null = null;

    $: {
        const currentStoreData = get(store);
        const ageValue = currentStoreData.age?.toString();
        // Use bidirectional map for direct lookup
        const ageRangeDisplay = ageValue ? AGE_RANGES_BIDI[ageValue] || ageValue : currentStoreData.age;


        displayData = {
            Name: currentStoreData.name,
            Email: currentStoreData.email,
            'Age Range': ageRangeDisplay,
            // Sex: currentStoreData.sex, // Sex step is deactivated
            Budget: currentStoreData.budget >= 10000 ? "over 10000" : "under 10000",
            'Square Feet': currentStoreData.squareFeet === -1 ? "I don't know" : currentStoreData.squareFeet,
            'Moving From Property Type': currentStoreData.propertyTypeFrom,
            'Moving To Property Type': currentStoreData.propertyTypeTo,
            'Reasons for Moving': currentStoreData.reasonsForMoving?.join(', '),
            'Country From': currentStoreData.countryFrom, // Assuming these are in store
            'Country To': currentStoreData.countryTo,     // Assuming these are in store
        };
        if (browser) {
            funnelCopyForDisplay = localStorage.getItem('funnelCopyText');
        }
    }
    // Removed the old error checking block based on stepsIndex and userData

    async function handleSubmit() {
        isLoading = true;
        submitError = null;
        submitSuccess = false;

        const storeData = get(store);
        const funnelId = browser ? localStorage.getItem('currentFunnelId') : null;
        const funnelVersion = browser ? localStorage.getItem('currentFunnelVersion') : null;
        const funnelObjectString = browser ? localStorage.getItem('currentFunnelObject') : null;
        const funnelCopyText = browser ? localStorage.getItem('funnelCopyText') : null;

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

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'Failed to parse error response' }));
                throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            console.log('Submission successful:', result);
            
            // Prepare data for display on success screen, similar to review screen
            // Use storeData for most fields, and payload.funnelCopy for the VSL copy
            const dataSnapshot = get(store); // Get a fresh snapshot of the store at time of successful submission
            const submittedAgeValue = dataSnapshot.age?.toString();
            // Use bidirectional map for direct lookup
            const submittedAgeRangeDisplay = submittedAgeValue ? AGE_RANGES_BIDI[submittedAgeValue] || submittedAgeValue : dataSnapshot.age;

            submittedDataForDisplay = {
                Name: dataSnapshot.name,
                Email: dataSnapshot.email,
                'Age Range': submittedAgeRangeDisplay,
                Budget: dataSnapshot.budget >= 10000 ? "over 10000" : "under 10000",
                'Square Feet': dataSnapshot.squareFeet === -1 ? "I don't know" : dataSnapshot.squareFeet,
                'Moving From Property Type': dataSnapshot.propertyTypeFrom,
                'Moving To Property Type': dataSnapshot.propertyTypeTo,
                'Reasons for Moving': dataSnapshot.reasonsForMoving?.join(', '),
                'Country From': dataSnapshot.countryFrom,
                'Country To': dataSnapshot.countryTo,
                'VSL Copy': payload.funnelCopy, // This comes directly from the payload
            };
            submitSuccess = true; // Set this after preparing submittedDataForDisplay

            setTimeout(() => {
                window.location.href = "https://www.internationalrelocationpartner.com?from=thankyou"
            }, 3000);
            // Optionally clear store or redirect user here
            // saveToStore({ name: '', email: '', budget: null, countryFrom: null, countryTo: null, stepsIndex: 0 }); // Example reset
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
                Here's a summary of what was sent:
            </MarkdownText>
            <div class="review-data">
                 <ul>
                    {#each Object.entries(submittedDataForDisplay) as [key, value]}
                        {#if value !== undefined && value !== null && value !== ''}
                            <li><strong>{key}:</strong> {String(value)}</li>
                        {/if}
                    {/each}
                </ul>
            </div>
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
                    {#each Object.entries(displayData) as [key, value]}
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
        padding: 40px 20px;
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
