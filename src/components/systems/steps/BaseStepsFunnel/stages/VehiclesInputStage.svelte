<script lang="ts">
    import { get } from 'svelte/store';
    import store, { saveToStore, incrementStepsIndex } from '../../../../store.ts';
    import Page from '../../../wrappers/Page/Page.svelte';
    import Vehicles from '../../../inputs/Vehicles/Vehicles.svelte';
    import SubmitButton from '../../../buttons/SubmitButton/SubmitButton.svelte';
    import MarkdownText from '../../../texts/MarkdownText/MarkdownText.svelte';

    let vehicles = get(store).vehicles || [];
    
    // Validate: At least one vehicle should have year, make, model if the list is not empty?
    // Or at least one vehicle present?
    // User requirement: "all three inputs are required".
    // I'll assume if they add a vehicle row, it must be complete.
    // And maybe at least one vehicle is required?
    // The Vehicles component initializes with one empty vehicle.
    // If it's empty/incomplete, we disable next.
    
    $: isValid = vehicles.length > 0 && vehicles.every((v: any) => v.year && v.make && v.model);

    export let canReveal = false;

    function handleUpdate(updatedVehicles: any[]) {
        vehicles = updatedVehicles;
        isValid = vehicles.length > 0 && vehicles.every((v: any) => v.year && v.make && v.model);
        saveToStore({ vehicles });
    }

    function handleNext() {
        if (isValid) {
            incrementStepsIndex();
        }
    }

    function handleSkip() {
        vehicles = [];
        saveToStore({ vehicles });
        incrementStepsIndex();
    }
</script>

<Page>
    <div class="stage-content">
        <MarkdownText {canReveal}>
            ## **Vehicles** to **Ship**
        </MarkdownText>
        
        <p class="sub-text">Tell us about the vehicles you are shipping (Year, Make, Model)</p>

        <Vehicles 
            bind:vehicles={vehicles} 
            onUpdate={handleUpdate}
        />

        <div class="buttons-row">
            <SubmitButton
                label="Next"
                callback={handleNext}
                disabled={!isValid}
            />
            
            <button class="skip-btn" on:click={handleSkip}>
                I don't have vehicles to ship
            </button>
        </div>
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
    
    .sub-text {
        color: #f0f0f0;
        font-size: 1rem;
        margin-bottom: 1rem;
    }

    .buttons-row {
        display: flex;
        align-items: center;
        gap: 20px;
    }

    .skip-btn {
        background: none;
        border: none;
        color: #6b7280;
        text-decoration: underline;
        cursor: pointer;
        font-size: 0.9rem;
        padding: 0;
    }

    .skip-btn:hover {
        color: #374151;
    }
</style>
