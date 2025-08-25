<script lang="ts">
    import { get } from 'svelte/store';
    import { name } from './store.ts';
    import Page from '../../wrappers/Page/Page.svelte';
    import TextInput from '../../inputs/PlainText/PlainText.svelte';
    import SubmitButton from '../../buttons/SubmitButton/SubmitButton.svelte';
    import MarkdownText from '../../texts/MarkdownText/MarkdownText.svelte';
    import { incrementStepsIndex } from '../../../store.ts';

    let currentName = get(name) || '';
    let isValid = currentName.trim().length > 0;

    export let canReveal = false;

    function handleChange(newValue: string) {
        currentName = newValue;
        isValid = currentName.trim().length > 0;
        name.set(currentName);
    }

    function handleNext() {
        if (isValid) {
            incrementStepsIndex();
        }
    }

    function handleEnter() {
        if (isValid) {
            handleNext();
        }
    }
</script>

<Page>
    <div class="stage-content">
        <MarkdownText {canReveal}>
            ## What's your name?
        </MarkdownText>

        <TextInput
            label="Name"
            placeholder="Enter your name"
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
        gap: 20px;
        padding: 0px 20px;
        max-width: 600px;
        margin: auto;
    }
</style>
