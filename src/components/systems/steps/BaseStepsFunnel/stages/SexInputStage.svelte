<script lang="ts">
    import { get } from 'svelte/store';
    import store, { saveToStore, incrementStepsIndex } from '../../../../store.ts';
    import Page from '../../../wrappers/Page/Page.svelte';
    import SubmitButton from '../../../buttons/SubmitButton/SubmitButton.svelte';
    import MarkdownText from '../../../texts/MarkdownText/MarkdownText.svelte';

    let currentSex = get(store).sex || '';
    $: isValid = currentSex === 'Male' || currentSex === 'Female';

    // Update store whenever currentSex changes due to binding
    $: saveToStore({ sex: currentSex });

    function handleNext() {
        if (isValid) {
            incrementStepsIndex();
        }
    }
</script>

<Page>
    <div class="stage-content">
        <MarkdownText>
            ## What is your sex?
        </MarkdownText>

        <div class="radio-options">
            <label class="radio-label">
                <input
                    type="radio"
                    name="sex-selection"
                    value="Male"
                    bind:group={currentSex}
                />
                Male
            </label>
            <label class="radio-label">
                <input
                    type="radio"
                    name="sex-selection"
                    value="Female"
                    bind:group={currentSex}
                />
                Female
            </label>
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
        gap: 20px;
        padding: 40px 20px;
        max-width: 600px;
        margin: auto;
    }
    /* Styling for the container holding the radio options */
    .radio-options {
        display: flex;
        gap: 25px;
        justify-content: center;
        width: 100%;
    }
    .radio-label {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 1.1em;
        cursor: pointer;
    }
    .radio-label input[type="radio"] {
        accent-color: #0077b5; /* Example: match your theme */
        width: 18px;
        height: 18px;
    }
</style>
