<script lang="ts">
    import { get } from 'svelte/store';
    import store, { saveToStore, incrementStepsIndex } from '../../../../store.ts';
    import Page from '../../../wrappers/Page/Page.svelte';
    import PlainText from '../../../inputs/PlainText/PlainText.svelte';
    import SubmitButton from '../../../buttons/SubmitButton/SubmitButton.svelte';
    import IconButton from '../../../buttons/IconButton/IconButton.svelte'; // Assuming an IconButton exists for '+'
    import MarkdownText from '../../../texts/MarkdownText/MarkdownText.svelte';

    let reasons = [...get(store).reasonsForMoving, '']; // Start with one empty reason input
    // Validate if at least one non-empty reason exists
    $: isValid = reasons.some((reason: string) => reason.trim() !== ''); // Added type string

    function updateReason(index: number, value: string) {
        reasons[index] = value;
        reasons = [...reasons]; // Trigger reactivity
        saveToStore({ reasonsForMoving: reasons.filter((r: string) => r.trim() !== '') }); // Added type string, Save only non-empty reasons
    }

    function addReason() {
        reasons = [...reasons, '']; // Add a new empty input field
    }

    function removeReason(index: number) {
        if (reasons.length > 1) { // Prevent removing the last input
            reasons.splice(index, 1);
            reasons = [...reasons]; // Trigger reactivity
            saveToStore({ reasonsForMoving: reasons.filter((r: string) => r.trim() !== '') }); // Added type string
        } else if (reasons.length === 1) {
             // Clear the last input instead of removing it
             reasons[0] = '';
             reasons = [...reasons];
             saveToStore({ reasonsForMoving: [] }); // Save empty array
        }
    }

    function handleNext() {
        if (isValid) {
            // Filter out empty reasons before final save and moving next
            const finalReasons = reasons.filter((r: string) => r.trim() !== ''); // Added type string
            saveToStore({ reasonsForMoving: finalReasons });
            if (finalReasons.length > 0) { // Ensure at least one reason remains
                 incrementStepsIndex();
            } else {
                 // Maybe show a message that at least one reason is required?
                 // For now, just prevents moving next if all are empty after filtering.
                 console.warn("At least one reason is required.");
            }
        }
    }
</script>

<Page>
    <div class="stage-content">
        <MarkdownText>
            ## Why did you decide to move to Costa Rica?
            (Please list at least one reason)
        </MarkdownText>

        <div class="reasons-list">
            {#each reasons as reason, index (index)}
                <div class="reason-item">
                    <PlainText
                        placeholder={`Reason ${index + 1}`}
                        value={reason}
                        onChange={(newValue) => updateReason(index, newValue)}
                    />
                    {#if reasons.length > 1}
                         <!-- Use src and callback for IconButton -->
                         <IconButton src="/icons/trash.svg" callback={() => removeReason(index)} />
                    {/if}
                </div>
            {/each}
        </div>

         <!-- Use src and callback for IconButton -->
        <IconButton src="/icons/plus.svg" callback={addReason} label="Add Another Reason" />

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
    .reasons-list {
        width: 100%;
        display: flex;
        flex-direction: column;
        gap: 15px;
    }
    .reason-item {
        display: flex;
        gap: 10px;
        width: 100%;
        place-items: center;
    }
    .reason-item > :global(div) { /* Target PlainText wrapper */
        flex-grow: 1;
    }
     /* Add styling for IconButton if needed */
</style>
