<script lang="ts">
  import { get } from 'svelte/store';
  import store, { saveToStore, incrementStepsIndex } from '../../../../store.ts';
  import Page from '../../../wrappers/Page/Page.svelte';
  import SubmitButton from '../../../buttons/SubmitButton/SubmitButton.svelte';
  import MarkdownText from '../../../texts/MarkdownText/MarkdownText.svelte';
  import IconGridSelector from '../../../selectors/IconGridSelector/IconGridSelector.svelte';
  import { isPropertyTypeToValid } from '../../../helpers/validationRules.ts';

  export let canReveal: boolean;

  const propertyTypes = [
    { value: 'apartment', label: 'Apartment', iconSrc: '/icons/apartment.svg' },
    { value: 'condo', label: 'Condo', iconSrc: '/icons/condo.svg' },
    { value: 'house', label: 'House', iconSrc: '/icons/house.svg' },
    { value: 'storage', label: 'Storage', iconSrc: '/icons/storage.svg' }
  ];

  let selectedPropertyTypeTo: string | undefined = get(store).propertyTypeTo;

  $: isValid = ($store.propertyTypeTo, isPropertyTypeToValid());

  function handleSelectionUpdate(event: CustomEvent<string>) {
    selectedPropertyTypeTo = event.detail;
    saveToStore({ propertyTypeTo: selectedPropertyTypeTo });
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
      ## What type of place are you moving to?
    </MarkdownText>

    <IconGridSelector
      options={propertyTypes}
      bind:selectedValue={selectedPropertyTypeTo}
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
