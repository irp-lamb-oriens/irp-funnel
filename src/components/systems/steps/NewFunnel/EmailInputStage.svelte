<script lang="ts">
    import { get } from 'svelte/store';
    import { email } from './store.ts';
    import Page from '../../wrappers/Page/Page.svelte';
    import EmailInput from '../../inputs/Email/Email.svelte';
    import SubmitButton from '../../buttons/SubmitButton/SubmitButton.svelte';
    import MarkdownText from '../../texts/MarkdownText/MarkdownText.svelte';
    import { isValidEmail } from '../../helpers/validation.ts';
    import store, { incrementStepsIndex } from '../../../store.ts';

    let currentEmail = get(email) || '';
    let isValid = isValidEmail(currentEmail);

    export let canReveal = false;

    function handleChange(newValue: string) {
        currentEmail = newValue;
        isValid = isValidEmail(currentEmail);
        email.set(currentEmail);
    }

    function handleNext() {
        if (isValid) {
            incrementStepsIndex();
        }
    }

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
            Subscribe to our local news translated to English

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
        gap: 20px;
        padding: 0px 20px;
        max-width: 600px;
        margin: auto;
    }
</style>
