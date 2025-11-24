<script lang="ts">
  import { get } from 'svelte/store';
  import store, { saveToStore, incrementStepsIndex } from '../../../../store.ts';
  import Page from '../../../wrappers/Page/Page.svelte';
  import SubmitButton from '../../../buttons/SubmitButton/SubmitButton.svelte';
  import MarkdownText from '../../../texts/MarkdownText/MarkdownText.svelte';
  import IconGridSelector from '../../../selectors/IconGridSelector/IconGridSelector.svelte';
  import { isPropertyTypeFromValid } from '../../../helpers/validationRules.ts';
  import countries from '../../../inputs/Country/countries.ts';

  export let canReveal: boolean;

  const propertyTypes = [
    { value: 'apartment', label: 'Apartment', iconSrc: '/icons/apartment.svg' },
    { value: 'condo', label: 'Condo', iconSrc: '/icons/condo.svg' },
    { value: 'house', label: 'House', iconSrc: '/icons/house.svg' },
    { value: 'storage', label: 'Storage', iconSrc: '/icons/storage.svg' }
  ];

  let selectedPropertyTypeFrom: string | undefined = get(store).propertyTypeFrom;

  $: countryFromCode = $store.countryFrom;
  $: countryFromName = countries.find(c => c.code === countryFromCode)?.name || countryFromCode;

  $: isValid = ($store.propertyTypeFrom, isPropertyTypeFromValid());

  function handleSelectionUpdate(event: CustomEvent<string>) {
    selectedPropertyTypeFrom = event.detail;
    saveToStore({ propertyTypeFrom: selectedPropertyTypeFrom });
  }

  function handleNext() {
    if (isValid) {
      incrementStepsIndex();
    }
  }

  // Ensure initial value from store is reflected if component re-initializes
  // (though selectedValue prop in IconGridSelector should handle this)
  // $: selectedPropertyTypeFrom = get(store).propertyTypeFrom || undefined;
</script>

<Page>
  <div class="stage-content">
    <MarkdownText {canReveal}>
      ## What type of place are you Relocating from in **{countryFromName}**?
    </MarkdownText>

    <IconGridSelector
      options={propertyTypes}
      bind:selectedValue={selectedPropertyTypeFrom}
      on:update={handleSelectionUpdate}
    />

    You have to choose one these four options

    <SubmitButton
      label="Next"
      callback={handleNext}
      active={isValid}
      disabled={!isValid}
    />
  </div>
</Page>

<style>
  .stage-content {
    display: flex;
    flex-direction: column;
    gap: 24px;
    padding: 0px 20px;
    max-width: 600px;
    margin: auto;
    align-items: center;
  }
</style>
