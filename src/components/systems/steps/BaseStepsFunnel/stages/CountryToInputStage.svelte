<script lang="ts">
    import { get } from 'svelte/store';
    import store, { saveToStore, incrementStepsIndex } from '../../../../store.ts';
    import Page from '../../../wrappers/Page/Page.svelte';
    import CountryInput from '../../../inputs/Country/Country.svelte'; // Use Country input
    import PlainText from '../../../inputs/PlainText/PlainText.svelte';
    import SubmitButton from '../../../buttons/SubmitButton/SubmitButton.svelte';
    import MarkdownText from '../../../texts/MarkdownText/MarkdownText.svelte';

    let currentCountryTo = get(store).countryTo || null; // Can be null initially
    let currentDestinationZip = get(store).destinationZip || '';
    
    let countryButtonRef: HTMLButtonElement;
    let zipInputRef: HTMLInputElement;

    $: isValid = currentCountryTo !== null && currentCountryTo.length === 2;

    export let canReveal = false;

    function handleSelect(selectedCode: string | null) {
        currentCountryTo = selectedCode;
        saveToStore({ countryTo: currentCountryTo });
    }

    function handleZipChange(val: string) {
        currentDestinationZip = val;
        saveToStore({ destinationZip: currentDestinationZip });
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
            ## **Where** in **{$store.countryTo}** did you decide **to move**? 
        </MarkdownText>

        <CountryInput
            label="Destination Country"
            defaultCountryCode={currentCountryTo}
            onSelect={handleSelect}
            bind:buttonRef={countryButtonRef}
        />

        <PlainText 
            placeholder="Destination Zip Code" 
            value={currentDestinationZip} 
            onChange={handleZipChange} 
            bind:inputElement={zipInputRef}
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
        padding: 0px 20px;
        max-width: 600px; /* Limit width for better readability */
        margin: auto;
    }
    /* Add any additional styling needed */
</style>
