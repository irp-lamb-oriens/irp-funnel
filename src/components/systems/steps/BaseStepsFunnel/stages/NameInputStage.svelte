<script lang="ts">
    import { get } from 'svelte/store';
    import store, { saveToStore, incrementStepsIndex } from '../../../../store.ts';
    import Page from '../../../wrappers/Page/Page.svelte';
    import PlainText from '../../../inputs/PlainText/PlainText.svelte';
    import SubmitButton from '../../../buttons/SubmitButton/SubmitButton.svelte';
    import MarkdownText from '../../../texts/MarkdownText/MarkdownText.svelte';

    let currentName = get(store).name || '';
    let isValid = currentName.trim().length > 0;

    export let canReveal = false;

    function handleChange(newValue: string) {
        currentName = newValue;
        isValid = currentName.trim().length > 0;
        saveToStore({ name: currentName });
    }

    function handleNext() {
        if (isValid) {
            incrementStepsIndex();
        }
    }
</script>

<Page>
    <div class="stage-content">
        <MarkdownText {canReveal}>
            ## What's your name?
        </MarkdownText>

        <PlainText
            label="Full Name"
            placeholder="Enter your full name"
            value={currentName}
            onChange={handleChange}
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
