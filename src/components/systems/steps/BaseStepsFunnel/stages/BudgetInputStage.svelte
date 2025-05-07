<script lang="ts">
    import { get } from 'svelte/store';
    import store, { saveToStore, incrementStepsIndex } from '../../../../store.ts';
    import Page from '../../../wrappers/Page/Page.svelte';
    import SubmitButton from '../../../buttons/SubmitButton/SubmitButton.svelte';
    import MarkdownText from '../../../texts/MarkdownText/MarkdownText.svelte';

    export let canReveal = false;

let hasBudget = get(store).hasBudget || '';
$: isValid = hasBudget === 'Yes' || hasBudget === 'No';

// Update store and budget value whenever hasBudget changes
$: {
    saveToStore({ hasBudget, budget: 10000 - +(hasBudget === 'No') });
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
            ## Shipment costs per international move an average of $10,000 (USD), or more.

            ### Do you have the budget to afford this?
        </MarkdownText>

        <div class="radio-options">
            <label class="radio-label">
                <input
                    type="radio"
                    name="budget-selection"
                    value="Yes"
                    bind:group={hasBudget}
                />
                Yes
            </label>
            <label class="radio-label">
                <input
                    type="radio"
                    name="budget-selection"
                    value="No"
                    bind:group={hasBudget}
                />
                No
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
        accent-color: #0077b5;
        width: 18px;
        height: 18px;
    }
</style>
