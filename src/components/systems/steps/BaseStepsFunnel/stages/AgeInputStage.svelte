<script lang="ts">
    import { get } from 'svelte/store';
    import store, { saveToStore, incrementStepsIndex } from '../../../../store.ts';
    import Page from '../../../wrappers/Page/Page.svelte';
    import SubmitButton from '../../../buttons/SubmitButton/SubmitButton.svelte';
    import MarkdownText from '../../../texts/MarkdownText/MarkdownText.svelte';
    import Options from '../../../selectors/Options/Options.svelte'; // Import the new component
    import { isBirthdayValid } from '../../../helpers/validationRules.ts';
    import { AGE_RANGES_OPTIONS } from '../../../helpers/constants.ts';

    export let canReveal: boolean;

    // Always default to "56-65" range on component load.
    // The value for this option is "56".
    let currentAgeRange = '56'; 
    saveToStore({ age: Number(currentAgeRange) }); // Save this default to the store immediately.

    // Make isValid reactive to changes in the store's age property
    $: isValid = ($store.age, isBirthdayValid());

    // Update store whenever currentAgeRange changes
    function handleAgeUpdate(event: CustomEvent<string>) {
        currentAgeRange = event.detail;
        saveToStore({ age: Number(currentAgeRange) }); // Save as number
    }
    
    function handleNext() {
        if (isValid) {
            incrementStepsIndex();
        }
    }

    // Optional: handleEnter for accessibility, though SubmitButton might handle it
    function handleEnter(event: KeyboardEvent) {
        if (event.key === 'Enter' && isValid) {
            handleNext();
        }
    }
</script>

<Page>
    <div class="stage-content" on:keydown={handleEnter}>
        <MarkdownText {canReveal}>
            ## **What is your age range?**
        </MarkdownText>

        <div class="options-wrapper">
            <Options
                options={AGE_RANGES_OPTIONS}
                selectedValue={currentAgeRange}
                on:update={handleAgeUpdate}
                groupName="age-range-selection"
            />
        </div>

        <SubmitButton
            label="Next"
            callback={handleNext}
            active={isValid}
            disabled={!isValid}
        />
    </div>
</Page>

<style>
    .stage-content {
        display: flex;
        flex-direction: column;
        gap: 32px; /* Consistent gap */
        padding: 40px 20px;
        max-width: 600px;
        margin: auto;
        align-items: center; /* Center content */
    }

    .options-wrapper {
        display: flex; /* Enables centering of the Options component if it's narrower */
        justify-content: center; /* Centers the Options component */
        width: 100%; /* Ensures the wrapper takes available width for centering */
        max-width: 400px; /* Max width for the options container itself */
    }

    /* If Options.svelte's .options-container needs to be horizontal: */
    /* You can add a class to .options-wrapper and target it with :global if needed,
       or add a layout prop to Options.svelte itself.
       For now, we assume the default column layout of Options.svelte is desired,
       or it can be styled to be more compact if many options.
    */

    /* Styling for the container holding the radio options from SexInputStage for reference */
    /* This is now handled by Options.svelte, but we ensure .stage-content provides context */
    /*
    .radio-options { // This class was in SexInputStage, now it's .options-container in Options.svelte
        display: flex;
        gap: 25px;
        justify-content: center;
        width: 100%;
    }
    .radio-label { // This class was in SexInputStage, now it's .option-label in Options.svelte
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 1.1em;
        cursor: pointer;
    }
    .radio-label input[type="radio"] { // This is now .option-label input[type="radio"] in Options.svelte
        accent-color: #0077b5;
        width: 18px;
        height: 18px;
    }
    */
</style>
