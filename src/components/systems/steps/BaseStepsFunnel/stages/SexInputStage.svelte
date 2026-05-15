<script lang="ts">
    import { get } from 'svelte/store';
    import store, { saveToStore, incrementStepsIndex } from '../../../../store.ts';
    import Page from '../../../wrappers/Page/Page.svelte';
    import SubmitButton from '../../../buttons/SubmitButton/SubmitButton.svelte';
    import MarkdownText from '../../../texts/MarkdownText/MarkdownText.svelte';
    import Options from '../../../selectors/Options/Options.svelte'; // Import the new component

    export let canReveal: boolean;

    const sexOptions = {
        'Male': 'Male',
        'Female': 'Female'
    };

    import { writable } from 'svelte/store';
    let currentSexStore = writable(get(store).sex || '');
    $: currentSex = $currentSexStore;
    $: isValid = !!currentSex; // Simpler check: any selection is valid

    // Update store whenever currentSex changes
    currentSexStore.subscribe(val => {
        if (val) saveToStore({ sex: val });
    });

    function handleNext() {
        if (isValid) {
            incrementStepsIndex();
        }
    }
    
    // Optional: handleEnter for accessibility
    function handleEnter(event: KeyboardEvent) {
        if (event.key === 'Enter' && isValid) {
            handleNext();
        }
    }
</script>

<Page>
    <div class="stage-content" on:keydown={handleEnter}>
        <MarkdownText {canReveal}>
            ## **What is your **sex?
        </MarkdownText>

        <div class="options-wrapper horizontal-options">
            <Options
                options={sexOptions}
                selected={currentSexStore}
                groupName="sex-selection"
            />
        </div>

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
        gap: 32px; /* Consistent gap */
        padding: 0px 20px;
        max-width: 600px;
        margin: auto;
        align-items: center; /* Center content */
    }

    .options-wrapper {
        display: flex;
        justify-content: center;
        width: 100%;
    }
    
    /* Apply horizontal layout to the Options component when .horizontal-options is present */
    .options-wrapper.horizontal-options :global(.options-container) {
        flex-direction: row;
        gap: 25px; /* Gap from original SexInputStage */
        justify-content: center;
        width: auto; /* Let the content define the width */
    }
    
    /*
       The individual .option-label and input styles are now within Options.svelte.
       The :global selector above targets the .options-container class *inside*
       the Options.svelte component when its parent .options-wrapper has the
       .horizontal-options class. This allows for layout overrides.
    */
</style>
