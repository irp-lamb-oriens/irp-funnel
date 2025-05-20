<script lang="ts">
    import { get } from 'svelte/store';
    import store from '../../../../store.ts'; // currentFunnelId and currentFunnelVersion will be read from localStorage directly
    import Page from '../../../wrappers/Page/Page.svelte';
    import SubmitButton from '../../../buttons/SubmitButton/SubmitButton.svelte';
    import MarkdownText from '../../../texts/MarkdownText/MarkdownText.svelte';
    import { onMount } from 'svelte';

    let isLoading = false;
    let submitError: string | null = null;
    let submitSuccess = false;
    import { derived } from 'svelte/store';
    let userData: any;
    let stepsIndex: number = 0;

    export let canReveal = false;

    $: stepsIndex = get(store).stepsIndex ?? 0;

    // userData is no longer needed; submission will use the full store state

    $: if (stepsIndex === 5) {
        // Debug log for error check
        console.log("SubmitStage (stepsIndex 5): userData =", userData, "age:", userData.age, "sex:", userData.sex, "budget:", userData.budget, "reasonsForMoving:", userData.reasonsForMoving);
        // Basic check if essential data is present
        if (
            userData.age == null ||
            !userData.sex ||
            userData.budget == null ||
            !userData.reasonsForMoving ||
            !Array.isArray(userData.reasonsForMoving) ||
            userData.reasonsForMoving.length === 0
        ) {
            submitError = "Some information is missing. Please go back and complete all steps.";
        } else {
            submitError = null;
        }
    }

    async function handleSubmit() {
        isLoading = true;
        submitError = null;
        submitSuccess = false;

        const storeData = get(store);
        const funnelId = localStorage.getItem('currentFunnelId');
        const funnelVersion = localStorage.getItem('currentFunnelVersion');
        const funnelObject = localStorage.getItem('currentFunnelObject');

        const payload = {
            ...storeData,
            funnelId,
            funnelVersion,
            funnelObject 
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
            submitSuccess = true;

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
            </MarkdownText>
            <a class="anchor" href="https://www.internationalrelocationpartner.com?from=thankyou">internationalrelocationpartner.com</a>
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
            <!-- Optional: Display collected data for review -->
            <!-- <ul>
                <li>Name: {userData.name}</li>
                <li>Email: {userData.email}</li>
                <li>Budget: ${userData.budget}</li>
                <li>Moving From: {userData.countryFrom}</li>
                <li>Moving To: {userData.countryTo}</li>
            </ul> -->
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
        background: #f9f9f9;
        padding: 15px;
        border-radius: 5px;
        margin-top: 10px;
        display: inline-block; /* Fit content width */
    }
    li {
        margin-bottom: 5px;
    }
</style>
