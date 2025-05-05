<script lang="ts">
    import { get } from 'svelte/store';
    import store, { saveToStore, incrementStepsIndex } from '../../../../store.ts';
    import Page from '../../../wrappers/Page/Page.svelte';
    import NumberInput from '../../../inputs/Number/Number.svelte';
    import SubmitButton from '../../../buttons/SubmitButton/SubmitButton.svelte';
    import MarkdownText from '../../../texts/MarkdownText/MarkdownText.svelte';
    import { isValidNaturalNumber } from '../../../helpers/validation.ts';

    let currentAgeStr = get(store).age !== null ? String(get(store).age) : '';
    // Validate age: non-empty, is a number, and positive (assuming age > 0)
    let isValid = currentAgeStr !== '' && !isNaN(Number(currentAgeStr)) && Number(currentAgeStr) > 0;

    function handleChange(newValue: string) {
        currentAgeStr = newValue;
        const ageNumber = Number(currentAgeStr);
        isValid = currentAgeStr !== '' && !isNaN(ageNumber) && ageNumber > 0;
        saveToStore({ age: isValid ? ageNumber : null });
    }

    function handleNext() {
        console.log("here 1 ")
        if (isValid) {
            console.log("here 2 ")
            incrementStepsIndex();
        }
    }

    function handleEnter(inputIsValid: boolean) {
        // Rely on local validation updated in handleChange
        if (isValid) {
            handleNext();
        }
    }
</script>

<Page>
    <div class="stage-content">
        <MarkdownText>
            ## How old are you?
        </MarkdownText>

        <NumberInput
            label="Age"
            placeholder="Enter your age"
            value={currentAgeStr}
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
        gap: 20px;
        padding: 40px 20px;
        max-width: 600px;
        margin: auto;
    }
</style>
