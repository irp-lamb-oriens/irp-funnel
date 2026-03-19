<script lang="ts">
  import Country from './Country/Country.svelte';
  import NumberInput from './Number/Number.svelte';
  import { AsYouType, parsePhoneNumberFromString } from 'libphonenumber-js';

  export let value = '';
  export let onEnter: () => void = () => {};
  export let onFocus: () => void = () => {};
  export let onBlur: () => void = () => {};
  export let onCountryChange: (code: string | null) => void = () => {};
  export let inputElement: HTMLButtonElement;
  export let isValid = true;
  export let onUpdate: (val: string) => void = () => {};

  let countryCode: string | null = 'US';
  let phoneNumber = '';
  let asYouType = new AsYouType(countryCode as any);
  let errorMessage = '';

  function handleCountrySelect(code: string | null) {
    countryCode = code;
    asYouType = new AsYouType(countryCode as any);
    updateValue();
    onCountryChange(code);
  }

  function updateValue() {
    asYouType.reset();
    const formattedNumber = asYouType.input(phoneNumber);
    
    if (phoneNumber) {
      const parsedNumber = parsePhoneNumberFromString(formattedNumber, countryCode as any);
      if (parsedNumber && parsedNumber.isValid()) {
        isValid = true;
        errorMessage = '';
        value = parsedNumber.format('NATIONAL');
        onUpdate(value);
      } else {
        isValid = false;
        errorMessage = 'Invalid phone number';
        value = formattedNumber;
        onUpdate(value);
      }
    } else {
      isValid = true;
      errorMessage = '';
      value = '';
      onUpdate(value);
    }
  }
</script>

<div class="phone-input-container" role="group" aria-labelledby="phone-input-label">
  <span id="phone-input-label" class="sr-only">Phone number</span>
  <div class="phone-inputs">
    <div class="country-selector">
      <Country onSelect={handleCountrySelect} bind:inputElement={inputElement} />
    </div>
    <div class="number-input">
      <NumberInput
        bind:value={phoneNumber}
        onChange={updateValue}
        onEnter={onEnter}
        onFocus={onFocus}
        onBlur={onBlur}
        ariaDescribedby="phone-error-message"
      />
    </div>
  </div>
  {#if !isValid}
    <span id="phone-error-message" class="error-message" aria-live="assertive">{errorMessage}</span>
  {/if}
</div>

<style lang="scss">
  .phone-input-container {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    width: 100%;
  }
  .phone-inputs {
    display: flex;
    gap: 0.75rem;
    align-items: flex-end;
  }
  .country-selector {
    flex: 0 0 120px;
  }
  .number-input {
    flex: 1;
  }
  .error-message {
    color: #ef4444;
    font-size: 0.85rem;
    font-weight: 500;
  }
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border-width: 0;
  }
</style>
