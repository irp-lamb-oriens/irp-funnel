<script lang="ts">
  import { get } from 'svelte/store';
  import store, { saveToStore, incrementStepsIndex } from '../../../../store.ts';
  import Page from '../../../wrappers/Page/Page.svelte';
  import MainSubmitButton from '../../../buttons/SubmitButton/SubmitButton.svelte'; // Renamed for clarity
  import MarkdownText from '../../../texts/MarkdownText/MarkdownText.svelte';
  import NumberInput from '../../../inputs/Number/Number.svelte';
  import SecondaryButton from '../../../buttons/SubmitButton/SubmitButton.svelte'; // Used for "I don't know"
  import { isSquareFeetValid } from '../../../helpers/validationRules.ts';

  export let canReveal: boolean;

  let currentSquareFeet: number | undefined = get(store).squareFeet;
  // If -1 was stored, treat it as a valid "don't know" state for display, but allow user to clear it
  // NumberInput expects a string value for its prop
  let inputValue: string = currentSquareFeet === -1 ? '' : (currentSquareFeet?.toString() ?? '');


  // Validation: any number (including -1 for "don't know") is considered valid once set.
  // Or simply that it's not undefined if we want to ensure an explicit choice.
  // For now, let's say any interaction that sets it to a number is valid.
  $: isValid = ($store.squareFeet, isSquareFeetValid());

  // onChange for NumberInput
  function handleNumberInputChange(newValue: string) {
    inputValue = newValue; // Keep inputValue as string for NumberInput's direct binding
    if (newValue.trim() === '') {
      currentSquareFeet = undefined;
      saveToStore({ squareFeet: undefined });
    } else {
      const num = parseFloat(newValue);
      if (!isNaN(num)) {
        currentSquareFeet = num;
        saveToStore({ squareFeet: currentSquareFeet });
      } else {
        // NumberInput might handle its own visual invalid state
        currentSquareFeet = undefined; 
        saveToStore({ squareFeet: undefined });
      }
    }
  }

  function handleDontKnow() {
    inputValue = ''; // Clear the NumberInput field visually
    currentSquareFeet = -1;
    saveToStore({ squareFeet: currentSquareFeet });
    incrementStepsIndex();
  }

  function handleNext() {
    if (isValid) {
      incrementStepsIndex();
    }
  }

  // Initialize store if value is not present
  if (currentSquareFeet === undefined) {
    // Let's not set a default here, user must interact or it remains undefined until they do.
    // Or, if a default is desired:
    // currentSquareFeet = -1; // Default to "don't know"
    // saveToStore({ squareFeet: currentSquareFeet });
  }
</script>

<Page>
  <div class="stage-content">
    <MarkdownText {canReveal}>
      ## **How big is your space **(in square feet)?
    </MarkdownText>
    <MarkdownText {canReveal}>
      You may not know the **exact measure** off the top of your head, and **that’s ok**.
    </MarkdownText>

    <div class="input-container">
      <NumberInput
        label="" 
        bind:value={inputValue}
        onChange={handleNumberInputChange}
        placeholder="E.g., 1500"
        onEnter={() => isValid && handleNext()}
      />
      <SecondaryButton
        label="Don't_know"
        callback={handleDontKnow}
        color="info" 
      />
    </div>

    If you don't know, press the button that says "Don't know"

    <MainSubmitButton
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

  .sublabel {
    font-size: 0.9rem;
    color: var(--text-color-secondary, #666);
    margin-top: -10px;
    margin-bottom: 10px;
    text-align: center;
  }

  .input-container {
    display: grid;
    place-items: center;
    justify-content: center;
    grid-gap: 16px;
    grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
    width: 100%;
  }

  /* .square-feet-input styling is now handled by NumberInput.svelte */
  /* .dont-know-button styling is now handled by SubmitButton.svelte (used as SecondaryButton) */
  /* We might need to adjust SubmitButton's styles or add a variant if 'info' color isn't distinct enough */
</style>
