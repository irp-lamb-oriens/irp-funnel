<script lang="ts">
    import { get } from 'svelte/store';
    import store, { saveToStore, incrementStepsIndex } from '../../../../store.ts';
    import Page from '../../../wrappers/Page/Page.svelte';
    import PlainText from '../../../inputs/PlainText/PlainText.svelte';
    import SubmitButton from '../../../buttons/SubmitButton/SubmitButton.svelte';
    import IconButton from '../../../buttons/IconButton/IconButton.svelte';
    import MarkdownText from '../../../texts/MarkdownText/MarkdownText.svelte';
    import { isReasonsValid } from '../../../helpers/validationRules.ts';
    import { browser } from '$app/environment';
    import { onMount } from 'svelte';

    export let canReveal = false;

    let reasons = [...get(store).reasonsForMoving, ''];
    $: isValid = ($store.reasonsForMoving, isReasonsValid());

    let isLoading = false;
    let submitError: string | null = null;
    let submitSuccess = false;
    let inputElement: HTMLInputElement;

    function updateReason(index: number, value: string) {
        reasons[index] = value;
        reasons = [...reasons];
        saveToStore({ reasonsForMoving: reasons.filter((r: string) => r.trim() !== '') });
    }

    function addReason() {
        reasons = [...reasons, ''];
    }

    function removeReason(index: number) {
        if (reasons.length > 1) {
            reasons.splice(index, 1);
            reasons = [...reasons];
            saveToStore({ reasonsForMoving: reasons.filter((r: string) => r.trim() !== '') });
        } else if (reasons.length === 1) {
             reasons[0] = '';
             reasons = [...reasons];
             saveToStore({ reasonsForMoving: [] });
        }
    }

    async function handleSubmit() {
        isLoading = true;
        submitError = null;
        submitSuccess = false;

        const finalReasons = reasons.filter((r: string) => r.trim() !== '');
        saveToStore({ reasonsForMoving: finalReasons });

        if (finalReasons.length === 0) {
            console.warn("At least one reason is required.");
            isLoading = false;
            return;
        }

        const storeData = $store;
        const funnelId = localStorage.getItem('currentFunnelId');
        const funnelVersion = localStorage.getItem('currentFunnelVersion');
        const funnelObjectString = localStorage.getItem('currentFunnelObject');
        const funnelCopyText = localStorage.getItem('funnelCopyText');
        const locallyStored = Object.fromEntries(storeData.keysToSave.map((key: string) => {
            return [key, localStorage.getItem(key)]
        }));

        let funnelObjectParsed = null;
        if (funnelObjectString) {
            try {
                funnelObjectParsed = JSON.parse(funnelObjectString);
            } catch (e) {
                console.error("Error parsing funnelObject from localStorage:", e);
            }
        }

        const payload: any = {
            ...storeData,
            funnelCopy: funnelCopyText === null ? undefined : funnelCopyText, 
            ...locallyStored,
            reasonsForMoving: finalReasons,
            isUpdate: true,
            submit: {
                ...(storeData.submit || {}),
                funnelId,
                funnelVersion,
                funnelObject: funnelObjectParsed
            }
        };

        if (payload.squareFeet) {
            const parsedSquareFeet = parseInt(payload.squareFeet, 10);
            payload.squareFeet = isNaN(parsedSquareFeet) ? undefined : parsedSquareFeet;
        }

        const apiUrl = storeData.apiURL ? storeData.apiURL() : window.location.origin;

        try {
            const response = await fetch(`${apiUrl}/api/create-user`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'Failed to parse error response' }));
                throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            console.log('Submission successful:', result);

            submitSuccess = true;

            setTimeout(() => {
                window.location.href = "https://www.internationalrelocationpartner.com?refer=thankyou"
            }, 3000);
        } catch (error) {
            console.error('Submission failed:', error);
            submitError = error instanceof Error ? error.message : 'An unknown error occurred during submission.';
        } finally {
            isLoading = false;
        }
    }
</script>

<Page>
    <div class="stage-content">
        {#if submitSuccess}
            <MarkdownText {canReveal}>
                ## Thank You!

                **Your information** has been **submitted successfully.**
            </MarkdownText>
        {:else if submitError}
            <MarkdownText {canReveal}>
                ## Submission Error
                <span style="color: red;">{submitError}</span>
                Please try again or contact support.
            </MarkdownText>
            <SubmitButton
                label="Retry Submission"
                callback={handleSubmit}
                loading={isLoading}
                disabled={isLoading}
            />
        {:else}
            <MarkdownText {canReveal}>
                ### **Why** did you decide** to move?**
            </MarkdownText>

            <div class="reasons-list">
                {#each reasons as reason, index (index)}
                    <div class="reason-item">
                        <PlainText
                            placeholder={`Reason ${index + 1}`}
                            value={reason}
                            onChange={(newValue) => updateReason(index, newValue)}
                            bind:inputElement
                        />
                        {#if reasons.length > 1}
                             <IconButton src="/icons/trash.svg" callback={() => removeReason(index)} />
                        {/if}
                    </div>
                {/each}
            </div>

            <IconButton src="/icons/plus.svg" callback={addReason} label="Add Another Reason" />

            Type at least one reason

            <SubmitButton
                label="Submit Information"
                callback={handleSubmit}
                active={isValid}
                disabled={!isValid}
            />
        {/if}
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
    .reason-item > :global(div) {
        flex-grow: 1;
    }
</style>
