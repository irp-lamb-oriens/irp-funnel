<script lang="ts">
    import { get } from 'svelte/store';
    import store, { saveToStore, incrementStepsIndex } from '../../../../store.ts';
    import Page from '../../../wrappers/Page/Page.svelte';
    import EmailInput from '../../../inputs/Email/Email.svelte'; // Renamed import to avoid conflict
    import SubmitButton from '../../../buttons/SubmitButton/SubmitButton.svelte';
    import MarkdownText from '../../../texts/MarkdownText/MarkdownText.svelte';
    import { isValidEmail } from '../../../helpers/validation.ts';

    let currentEmail = get(store).email || '';
    let isValid = isValidEmail(currentEmail);

    export let canReveal = false;

    // The EmailInput component internally handles validation and updates the 'valid' variable
    // We just need to react to it
    function handleChange(newValue: string) {
        currentEmail = newValue;
        isValid = isValidEmail(currentEmail);
        saveToStore({ email: currentEmail });
    }

    function handleNext() {
        if (isValid) {
            incrementStepsIndex();
        }
    }

    // This function will be passed to the onEnter prop of EmailInput
    function handleEnter() {
        isValid = isValidEmail(currentEmail);
        if (isValid) {
            handleNext();
        }
    }
</script>

<Page>
    <div class="stage-content">
        <MarkdownText {canReveal}>
            ## What's your email address?
        </MarkdownText>

        <EmailInput
            label="Email Address"
            placeholder="Enter your email"
            value={currentEmail}
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
