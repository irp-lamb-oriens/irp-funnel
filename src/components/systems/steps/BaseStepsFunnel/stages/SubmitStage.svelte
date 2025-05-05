<script lang="ts">
    import { get } from 'svelte/store';
    import store from '../../../../store.ts';
    import Page from '../../../wrappers/Page/Page.svelte';
    import SubmitButton from '../../../buttons/SubmitButton/SubmitButton.svelte';
    import MarkdownText from '../../../texts/MarkdownText/MarkdownText.svelte';
    import { onMount } from 'svelte';

    let isLoading = false;
    let submitError: string | null = null;
    let submitSuccess = false;
    let userData: any = {}; // To hold data for display/submission

    export let canReveal = false;

    onMount(() => {
        // Load data from store when component mounts
        const currentStore = get(store);
        userData = {
            name: currentStore.name,
            email: currentStore.email,
            age: currentStore.age,
            sex: currentStore.sex,
            budget: currentStore.budget,
            countryFrom: currentStore.countryFrom,
            countryTo: currentStore.countryTo,
            reasonsForMoving: currentStore.reasonsForMoving,
        };
        // Basic check if essential data is present
        if (
            !userData.email ||
            !userData.name ||
            !userData.age ||
            !userData.sex ||
            !userData.budget ||
            !userData.countryFrom ||
            !userData.countryTo ||
            !userData.reasonsForMoving ||
            !Array.isArray(userData.reasonsForMoving) ||
            userData.reasonsForMoving.length === 0
        ) {
            submitError = "Some information is missing. Please go back and complete all steps.";
            // Optionally, could force step back here
        }
    });

    async function handleSubmit() {
        isLoading = true;
        submitError = null;
        submitSuccess = false;

        const apiUrl = get(store).apiURL(); // Get dynamic API URL

        try {
            const response = await fetch(`${apiUrl}/api/create-user`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(userData),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'Failed to parse error response' }));
                throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            console.log('Submission successful:', result);
            submitSuccess = true;
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

<style>
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
