<script lang="ts">
    import { get } from 'svelte/store';
    import store, { saveToStore, incrementStepsIndex } from '../../../../store.ts';
    import Page from '../../../wrappers/Page/Page.svelte';
    import NumberInput from '../../../inputs/Number/Number.svelte'; // Use Number input
    import SubmitButton from '../../../buttons/SubmitButton/SubmitButton.svelte';
    import MarkdownText from '../../../texts/MarkdownText/MarkdownText.svelte';

    // Budget might be null initially, handle conversion to string for input
    let currentBudgetStr = get(store).budget !== null ? String(get(store).budget) : '';
    let isValid = currentBudgetStr !== '' && !isNaN(Number(currentBudgetStr)) && Number(currentBudgetStr) >= 0; // Basic validation: non-empty, is a number, non-negative

    export let canReveal = false;

    function handleChange(newValue: string) {
        currentBudgetStr = newValue;
        const budgetNumber = Number(currentBudgetStr);
        isValid = currentBudgetStr !== '' && !isNaN(budgetNumber) && budgetNumber >= 0;
        // Save the number or null if invalid/empty
        saveToStore({ budget: isValid ? budgetNumber : null });
    }

    function handleNext() {
        if (isValid) {
            incrementStepsIndex();
        }
    }

    // This function will be passed to the onEnter prop of NumberInput
    function handleEnter(inputIsValid: boolean) {
        // The Number input component might have its own validation logic passed via onEnter
        // For now, we rely on our local `isValid` check which is updated in handleChange
        if (isValid) {
            handleNext();
        }
    }
</script>

<Page>
    <div class="stage-content">
        <MarkdownText {canReveal}>
            ## What's your approximate budget for the move (in USD)?
        </MarkdownText>

        <NumberInput
            label="Budget (USD)"
            placeholder="e.g., 5000"
            value={currentBudgetStr}
            onChange={handleChange}
            onEnter={handleEnter}
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
