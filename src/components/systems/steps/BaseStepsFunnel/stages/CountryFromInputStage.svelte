<script lang="ts">
    import { get } from 'svelte/store';
    import store, { saveToStore, incrementStepsIndex } from '../../../../store.ts';
    import Page from '../../../wrappers/Page/Page.svelte';
    import CountryInput from '../../../inputs/Country/Country.svelte'; // Use Country input
    import SubmitButton from '../../../buttons/SubmitButton/SubmitButton.svelte';
    import MarkdownText from '../../../texts/MarkdownText/MarkdownText.svelte';

    let currentCountryFrom = get(store).countryFrom || null; // Can be null initially
    let isValid = currentCountryFrom !== null && currentCountryFrom.length === 2; // Valid if a 2-letter code is selected

    export let canReveal = false;

    function handleSelect(selectedCode: string | null) {
        currentCountryFrom = selectedCode;
        isValid = currentCountryFrom !== null && currentCountryFrom.length === 2;
        saveToStore({ countryFrom: currentCountryFrom });
    }

    function handleNext() {
        if (isValid) {
            incrementStepsIndex();
        }
    }

    // Note: The Country input doesn't seem to have an 'onEnter' prop based on the provided snippet.
    // Progression relies on selecting a country and clicking the button.
</script>

<Page>
    <div class="stage-content">
        <MarkdownText {canReveal}>
            ## Where are you from?
        </MarkdownText>

        <CountryInput
            label="Country of Origin"
            defaultCountryCode={currentCountryFrom}
            onSelect={handleSelect}
        />

        <SubmitButton
            label="Next"
            callback={handleNext}
            disabled={!isValid}
        />
    </div>
</Page>

<style>
    .stage-content {
        display: flex;
        flex-direction: column;
        
        gap: 20px; /* Adjust spacing as needed */
        padding: 40px 20px;
        max-width: 600px; /* Limit width for better readability */
        margin: auto;
    }
    /* Add any additional styling needed */
</style>
