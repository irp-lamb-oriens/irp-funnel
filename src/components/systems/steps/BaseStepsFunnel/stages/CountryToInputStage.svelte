<script lang="ts">
    import { get } from 'svelte/store';
    import store, { saveToStore, incrementStepsIndex } from '../../../../store.ts';
    import Page from '../../../wrappers/Page/Page.svelte';
    import CountryInput from '../../../inputs/Country/Country.svelte'; // Use Country input
    import SubmitButton from '../../../buttons/SubmitButton/SubmitButton.svelte';
    import MarkdownText from '../../../texts/MarkdownText/MarkdownText.svelte';

    let currentCountryTo = get(store).countryTo || null; // Can be null initially
    let isValid = currentCountryTo !== null && currentCountryTo.length === 2; // Valid if a 2-letter code is selected

    export let canReveal = false;

    function handleSelect(selectedCode: string | null) {
        currentCountryTo = selectedCode;
        isValid = currentCountryTo !== null && currentCountryTo.length === 2;
        saveToStore({ countryTo: currentCountryTo });
    }

    function handleNext() {
        if (isValid) {
            incrementStepsIndex(); // This will move to the final submit stage
        }
    }

    // Note: The Country input doesn't seem to have an 'onEnter' prop based on the provided snippet.
    // Progression relies on selecting a country and clicking the button.
</script>

<Page>
    <div class="stage-content">
        <MarkdownText {canReveal}>
            ## Where in Costa Rica did you decide to move? 
        </MarkdownText>

        <CountryInput
            label="Destination Country"
            defaultCountryCode={currentCountryTo}
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
