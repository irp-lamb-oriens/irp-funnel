<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { writable } from 'svelte/store';
  import LetterByLetter from './LetterByLetter.svelte';
  import PlainText from './systems/inputs/PlainText/PlainText.svelte';
  import Email from './systems/inputs/Email/Email.svelte';
  import Number from './systems/inputs/Number/Number.svelte';
  import Country from './systems/inputs/Country/Country.svelte';
  import Phone from './systems/inputs/Phone/Phone.svelte';
  import IconButton from './systems/buttons/IconButton/IconButton.svelte';
  import IconGridSelector from './systems/selectors/IconGridSelector/IconGridSelector.svelte';
  import Calendar from './systems/inputs/Calendar/Calendar.svelte';
  import ImmigrationStatus from './systems/inputs/ImmigrationStatus/ImmigrationStatus.svelte';
  import { immigrationStatusStore } from './systems/inputs/ImmigrationStatus/store.js';
  import Budget from './systems/inputs/Budget/Budget.svelte';
  import { budgetStore } from './systems/inputs/Budget/store.js';
  import MoveSize from './systems/inputs/MoveSize/MoveSize.svelte';
  import { moveSizeStore } from './systems/inputs/MoveSize/store.js';
  import Vehicles from './systems/inputs/Vehicles/Vehicles.svelte';
  import { formState, updateField } from './systems/inputs/Calendar/formStore.js';
  import { submitScheduling } from './systems/inputs/Calendar/submitSchedule.js';
  import CTAButton from "./Header/CTAButton.svelte";
  import store from './store.js';
  import VideoBanner from './VideoBanner.svelte';
  import Loader from './Loader/Loader.svelte';
  import countries from './systems/inputs/Country/countries.js';

  let currentStep = 0;
  let errors = {
    name: '',
    email: '',
    destinationCountry: '',
    originCountry: '',
    phone: '',
    budget: '',
    propertyTypeFrom: '',
    propertyTypeTo: '',
    size: '',
    vehicles: '',
    immigrationStatus: '',
    movingDate: '',
    originZip: '',
    destinationZip: ''
  };

  let isEmailValid = false;
  let isPhoneValid = false;

  $: originCountryName = countries.find(c => c.code === $formState.originCountry)?.name || $formState.originCountry;
  $: destinationCountryName = countries.find(c => c.code === $formState.destinationCountry)?.name || $formState.destinationCountry;

  immigrationStatusStore.subscribe(value => {
    updateField(value || '', 'immigrationStatus');
  });

  budgetStore.subscribe(value => {
    updateField(value || '', 'budget');
  });

  moveSizeStore.subscribe(value => {
    updateField(value || '', 'size');
  });

  let showReferrerStep = false;
  let isLoading = false;
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  let calendarLink = '';
  let hangoutLink = '';
  let nameInput: HTMLInputElement,
    emailInput: HTMLInputElement,
    destinationCountryInput: HTMLButtonElement,
    originCountryInput: HTMLButtonElement,
    phoneInput: HTMLButtonElement,
    referrerInput: HTMLInputElement,
    sizeInput: HTMLButtonElement,
    budgetInput: HTMLButtonElement,
    immigrationStatusInput: HTMLButtonElement,
    originZipInput: HTMLInputElement,
    destinationZipInput: HTMLInputElement;

  onMount(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const referrer = urlParams.get('refer');
    if (!referrer || referrer.trim() === '') {
      showReferrerStep = true;
    } else {
      updateField(referrer.trim(), 'referredBy');
    }
  });

  function handleNextStep() {
    if (validateStep(currentStep)) {
      nextStep();
    }
  }

  function handleSkipVehicles() {
    updateField([], 'vehicles');
    nextStep();
  }

  function nextStep() {
    if (timeoutId) clearTimeout(timeoutId);
    currentStep++;
    if (currentStep === 12 && !showReferrerStep) {
      submitForm();
    }
    focusInput(currentStep);
  }

  function validateStep(step: number) {
    let isValid = true;
    const zipRegex = /^[a-zA-Z0-9\s-]{3,10}$/;

    switch (step) {
      case 0:
        if (!$formState.email.trim() || !isEmailValid) {
          errors.email = 'Please enter a valid email';
          isValid = false;
        } else {
          errors.email = '';
        }
        break;
      case 1:
        if (!$formState.name.trim()) {
          errors.name = 'Fill this field before proceeding';
          isValid = false;
        } else {
          errors.name = '';
        }
        break;
      case 2:
        if (!$formState.destinationCountry.trim()) {
          errors.destinationCountry = 'Fill this field before proceeding';
          isValid = false;
        } else {
          errors.destinationCountry = '';
        }
        // Destination zip is optional
        if ($formState.destinationZip && !zipRegex.test($formState.destinationZip.trim())) {
          errors.destinationZip = 'Please enter a valid zip code';
          isValid = false;
        } else {
          errors.destinationZip = '';
        }
        break;
      case 3:
        if (!$formState.originCountry.trim()) {
          errors.originCountry = 'Fill this field before proceeding';
          isValid = false;
        } else {
          errors.originCountry = '';
        }
        if (!$formState.originZip || !zipRegex.test($formState.originZip.trim())) {
          errors.originZip = 'Please enter a valid zip code';
          isValid = false;
        } else {
          errors.originZip = '';
        }
        break;
      case 4:
        if (!$formState.phone.trim() || !isPhoneValid) {
          errors.phone = 'Please enter a valid phone number';
          isValid = false;
        } else {
          errors.phone = '';
        }
        break;
      case 5:
        if (!$formState.budget.trim()) {
          errors.budget = 'Please enter your budget';
          isValid = false;
        } else {
          errors.budget = '';
        }
        break;
      case 10:
        if (!$formState.immigrationStatus.trim()) {
          errors.immigrationStatus = 'Please enter your immigration status';
          isValid = false;
        } else {
          errors.immigrationStatus = '';
        }
        break;
      case 11:
        if ($formState.scheduling.length === 0) {
          errors.movingDate = 'Please select a moving date';
          isValid = false;
        } else {
          errors.movingDate = '';
        }
        break;
      case 6:
        if (!$formState.propertyTypeFrom) {
          errors.propertyTypeFrom = 'Please select a property type';
          isValid = false;
        } else {
          errors.propertyTypeFrom = '';
        }
        break;
      case 7:
        if (!$formState.propertyTypeTo) {
          errors.propertyTypeTo = 'Please select a property type';
          isValid = false;
        } else {
          errors.propertyTypeTo = '';
        }
        break;
      case 8:
        if (!$formState.size.trim()) {
          errors.size = 'Please enter the size';
          isValid = false;
        } else {
          errors.size = '';
        }
        break;
      case 9:
        // Vehicles validation - check if at least one vehicle has year, make, model if required?
        // Or strictly if array is not empty and full.
        // User requirement: "all three inputs are required" for the vehicle being added.
        // We will assume at least one complete vehicle is required if they have vehicles.
        // But wait, is vehicle mandatory? The task says "+ 1 vehicle...".
        // I'll enforce at least one vehicle must be fully filled if there are any, or just proceed.
        // Given "all three inputs are required", I'll check the last one or all.
        // Actually, let's just check if any vehicle is incomplete.
        const incompleteVehicle = $formState.vehicles.some(v => !v.year || !v.make || !v.model);
        if (incompleteVehicle || $formState.vehicles.length === 0) {
             // If they have 0 vehicles, maybe they don't have one? 
             // But the component initializes with 1 empty one.
             // So if they haven't filled it, it's incomplete.
             // Unless they remove it? The component allows removing if > 1.
             // If the list is empty (impossible via UI currently), pass.
             // If the list has 1 empty vehicle, fail?
             // I'll fail if there is an incomplete vehicle.
             const hasEmpty = $formState.vehicles.some(v => !v.year || !v.make || !v.model);
             if (hasEmpty) {
                 // We can't easily set a specific error message on the component from here without a store,
                 // but we can prevent next step.
                 // The component handles its own internal validation display somewhat.
                 // I'll prevent next step if any field is missing.
                 isValid = false;
             }
        }
        break;
    }
    errors = { ...errors };
    return isValid;
  }

  async function submitForm() {
    console.log("submitForm called");
    if (currentStep === 12 && !validateStep(currentStep)) {
      return;
    }

    isLoading = true;

    try {
      const response = await submitScheduling();
      if (response && response.calendarLink) {
        calendarLink = response.calendarLink;
        hangoutLink = response.hangoutLink;
        window.open(calendarLink, '_blank');
      }
      currentStep = 13; // Go to "Thank You"
    } catch (error) {
      console.error('An error occurred during form submission:', error);
    } finally {
      isLoading = false;
    }
  }

  async function focusInput(step: number) {
    await tick();
    switch (step) {
      case 0:
        emailInput?.focus();
        break;
      case 1:
        nameInput?.focus();
        break;
      case 2:
        destinationCountryInput?.focus();
        break;
      case 3:
        originCountryInput?.focus();
        break;
      case 4:
        phoneInput?.focus();
        break;
      case 5:
        // No specific input to focus for budget radio buttons
        break;
      case 6:
        // No specific input to focus for IconGridSelector
        break;
      case 7:
        // No specific input to focus for IconGridSelector
        break;
      case 8:
        sizeInput?.focus();
        break;
      case 9:
        // Vehicles
        break;
      case 10:
        immigrationStatusInput?.focus();
        break;
      case 11:
        // Calendar
        break;
      case 12:
        referrerInput?.focus();
        break;
    }
  }

  export let videoUrl: string = "https://storage.googleapis.com/videos-irp-funnels/The-Truth-About-Moving-Abroad_-What-You-Need-to-Know-Before-Taking-the-Leap.mp4";
  export let imageUrl: string = "/video-lightbox1b-480x590.jpg";
  export let imageAlt: string = "video-lightbox1b";
</script>

<div class="hero-banner" id="hero-form">
  <Loader visible={isLoading} />
  <VideoBanner
  videoUrl={videoUrl}
  videoPoster={imageUrl}
  videoAlt={imageAlt}>
    <div class="form-container">
      <div class="form-steps">
        {#if currentStep === 0}
          <div class="form-frame active">
            <h6><LetterByLetter text="Every project is led by professionals with more than 14 years of experience" /></h6>
            <h2>Book a consultation call</h2>
            <Email label="Place your email so we can contact you" placeholder="john.doe@email.com" bind:value={$formState.email} onEnter={handleNextStep} bind:inputElement={emailInput} bind:valid={isEmailValid} />
            {#if errors.email}<span class="error">{errors.email}</span>{/if}
            <div class="button-wrapper">
              <IconButton src="./icons/right-arrow.svg" callback={handleNextStep} />
            </div>
          </div>
        {/if}

        {#if currentStep === 1}
          <div class="form-frame active">
            <h6><LetterByLetter text="International consulting services for expats, newcomers, and retirees:" /></h6>
            <PlainText label="Tell us your name" placeholder="John Doe" bind:value={$formState.name} onEnter={handleNextStep} bind:inputElement={nameInput} />
            {#if errors.name}<span class="error">{errors.name}</span>{/if}
            <div class="button-wrapper">
              <IconButton src="./icons/right-arrow.svg" callback={handleNextStep} />
            </div>
          </div>
        {/if}

        {#if currentStep === 2}
          <div class="form-frame active">
            <h2>Destination country: Where do you wanna move</h2>
            <Country onSelect={(code) => {
              updateField(code || '', 'destinationCountry');
            }} bind:buttonRef={destinationCountryInput} on:enter={() => {}} />
            {#if errors.destinationCountry}<span class="error">{errors.destinationCountry}</span>{/if}
            
            <h2>Destination Zip Code</h2>
            <PlainText placeholder="Zip Code" bind:value={$formState.destinationZip} onEnter={handleNextStep} bind:inputElement={destinationZipInput} />
            {#if errors.destinationZip}<span class="error">{errors.destinationZip}</span>{/if}

            <div class="button-wrapper">
              <IconButton src="./icons/right-arrow.svg" callback={handleNextStep} />
            </div>
          </div>
        {/if}

        {#if currentStep === 3}
          <div class="form-frame active">
            <h2>Where are you from?</h2>
            <Country onSelect={(code) => {
              updateField(code || '', 'originCountry');
            }} bind:buttonRef={originCountryInput} on:enter={() => {}} />
            {#if errors.originCountry}<span class="error">{errors.originCountry}</span>{/if}

            <h2>Origin Zip Code</h2>
            <PlainText placeholder="Zip Code" bind:value={$formState.originZip} onEnter={handleNextStep} bind:inputElement={originZipInput} />
            {#if errors.originZip}<span class="error">{errors.originZip}</span>{/if}

            <div class="button-wrapper">
              <IconButton src="./icons/right-arrow.svg" callback={handleNextStep} />
            </div>
          </div>
        {/if}

        {#if currentStep === 4}
          <div class="form-frame active">
            <h2>Your phone number</h2>
            <p class="sub-heading">(so we can contact you directly, in case you need it)</p>
            <Phone bind:value={$formState.phone} onEnter={handleNextStep} bind:inputElement={phoneInput} bind:isValid={isPhoneValid} />
            {#if errors.phone}<span class="error">{errors.phone}</span>{/if}
            <div class="button-wrapper">
              <IconButton src="./icons/right-arrow.svg" callback={handleNextStep} />
            </div>
          </div>
        {/if}

        {#if currentStep === 5}
          <div class="form-frame active">
            <h2>What is your budget?</h2>
            <Budget bind:buttonRef={budgetInput} />
            {#if errors.budget}<span class="error">{errors.budget}</span>{/if}
            <div class="button-wrapper">
              <IconButton src="./icons/right-arrow.svg" callback={handleNextStep} />
            </div>
          </div>
        {/if}

        {#if currentStep === 6}
          <div class="form-frame active">
            <h2>What type of place are you relocating from in {originCountryName}?</h2>
            <IconGridSelector
              options={[
                { value: 'apartment', label: 'Apartment', iconSrc: '/icons/apartment.svg' },
                { value: 'condo', label: 'Condo', iconSrc: '/icons/condo.svg' },
                { value: 'house', label: 'House', iconSrc: '/icons/house.svg' },
                { value: 'storage', label: 'Storage', iconSrc: '/icons/storage.svg' }
              ]}
              bind:selectedValue={$formState.propertyTypeFrom}
            />
            {#if errors.propertyTypeFrom}<span class="error">{errors.propertyTypeFrom}</span>{/if}
            <div class="button-wrapper">
              <IconButton src="./icons/right-arrow.svg" callback={handleNextStep} />
            </div>
          </div>
        {/if}

        {#if currentStep === 7}
          <div class="form-frame active">
            <h2>What type of place are you relocating to in {destinationCountryName}?</h2>
            <IconGridSelector
              options={[
                { value: 'apartment', label: 'Apartment', iconSrc: '/icons/apartment.svg' },
                { value: 'condo', label: 'Condo', iconSrc: '/icons/condo.svg' },
                { value: 'house', label: 'House', iconSrc: '/icons/house.svg' },
                { value: 'storage', label: 'Storage', iconSrc: '/icons/storage.svg' }
              ]}
              bind:selectedValue={$formState.propertyTypeTo}
            />
            {#if errors.propertyTypeTo}<span class="error">{errors.propertyTypeTo}</span>{/if}
            <div class="button-wrapper">
              <IconButton src="./icons/right-arrow.svg" callback={handleNextStep} />
            </div>
          </div>
        {/if}

        {#if currentStep === 8}
          <div class="form-frame active">
            <h2>Move size</h2>
            <MoveSize bind:buttonRef={sizeInput} />
            {#if errors.size}<span class="error">{errors.size}</span>{/if}
            <div class="button-wrapper">
              <IconButton src="./icons/right-arrow.svg" callback={handleNextStep} />
            </div>
          </div>
        {/if}

        {#if currentStep === 9}
          <div class="form-frame active">
            <h2>Vehicles</h2>
            <p class="sub-heading">Tell us about the vehicles you are shipping (Year, Make, Model)</p>
            <Vehicles 
                bind:vehicles={$formState.vehicles} 
                onUpdate={(v) => updateField(v, 'vehicles')}
            />
            <div class="button-wrapper buttons-row">
              <IconButton src="./icons/right-arrow.svg" callback={handleNextStep} />
              <button class="skip-btn" on:click={handleSkipVehicles}>
                  I don't have vehicles to ship
              </button>
            </div>
          </div>
        {/if}

        {#if currentStep === 10}
          <div class="form-frame active">
            <h2>Immigration Status</h2>
            <ImmigrationStatus bind:buttonRef={immigrationStatusInput} />
            {#if errors.immigrationStatus}<span class="error">{errors.immigrationStatus}</span>{/if}
            <div class="button-wrapper">
              <IconButton src="./icons/right-arrow.svg" callback={handleNextStep} />
            </div>
          </div>
        {/if}

        {#if currentStep === 11}
          <div class="form-frame active">
            <h2>Desired moving date</h2>
            <Calendar />
            {#if errors.movingDate}<span class="error">{errors.movingDate}</span>{/if}
            <div class="button-wrapper">
              <IconButton src="./icons/right-arrow.svg" callback={handleNextStep} />
            </div>
          </div>
        {/if}

        {#if currentStep === 12 && showReferrerStep}
          <div class="form-frame active">
            <h2>Who referred you to us?</h2>
            <PlainText placeholder="The name here" bind:value={$formState.referredBy} onEnter={submitForm} bind:inputElement={referrerInput} />
            <div class="button-wrapper">
              <IconButton src="./icons/right-arrow.svg" callback={submitForm} />
            </div>
          </div>
        {/if}

        {#if currentStep === 13}
          <div class="form-frame active">
            <h2>Thank You!</h2>
            <h4>An email has been sent to your inbox.</h4>
            <p>You can view your scheduled consultation here:</p>
            <a href={calendarLink} target="_blank" rel="noopener noreferrer" style="cursor: pointer; text-decoration: underline;">View Your Consultation on Google Calendar</a>
            <p>Join the meeting here:</p>
            <a href={hangoutLink} target="_blank" rel="noopener noreferrer" style="cursor: pointer; text-decoration: underline;">Join Hangouts Meeting</a>
            <IconButton src="./icons/right-arrow.svg" callback={nextStep} />
          </div>
        {/if}

        {#if currentStep === 14}
          <div class="form-frame active">
            <div class="banner-content">
              <h6 class="banner-subtitle">
                <LetterByLetter text="Every project is led by professionals with more than 14 years of experience" initialOffset={0} />
              </h6>
              <h1 class="banner-title">
                <LetterByLetter text="Personalized international consultations delivered through well-planned, tracked, and executed projects!" initialOffset={47.9 / 100} />
              </h1>
              <h4 class="banner-services-title">
                <LetterByLetter text="International consulting services for expats, newcomers, and retirees:" initialOffset={115.92 / 100} />
              </h4>
              <ul class="banner-services-list">
                <li class="banner-service">
                  <LetterByLetter text="Project Management" initialOffset={152.95 / 100} />
                </li>
                <li class="banner-service">
                  <LetterByLetter text="Documentation Assistance" initialOffset={167.89 / 90} />
                </li>
                <li class="banner-service">
                  <LetterByLetter text="International Advisory" initialOffset={175.90 / 80} />
                </li>
              </ul>
              <div class="button-row">
                <CTAButton trigger={true} label="Schedule Consultation" href="/consultation/" variant="primary" />
                <CTAButton label="Download Relocation Checklist" href="/free-resources/" variant="secondary" target="_blank" />
              </div>
            </div>
          </div>
        {/if}
      </div>
    </div>
  </VideoBanner>
</div>

<style lang="scss">
  .hero-banner {
    background: var(--color-background);
    padding: 3rem 0;
  }

  .form-container {
    position: relative;
    width: 100%;
    max-width: 600px;
    margin: 2rem auto;
    padding: 2rem;
    background: #161616;
    border-radius: 1rem;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  }

  .form-frame {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  h2 {
    font-size: 1.5rem;
    font-family: var(--font-title);
    font-weight: 700;
    color: var(--color-highlight-2);
  }

  h6 {
    font-size: 1.2rem;
    font-weight: 400;
    color: #f0f0f0;
  }

  .sub-heading {
    font-size: 1rem;
    color: #f0f0f0;
  }

  .button-wrapper {
    display: flex;
    justify-content: flex-end;
    margin-top: 1rem;
  }

  .buttons-row {
      display: flex;
      align-items: center;
      gap: 20px;
      flex-direction: row-reverse;
      justify-content: space-between !important;
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
      color: #f0f0f0;
  }

  .form-steps {
    position: relative;
  }

  .form-frame {
    opacity: 0;
    pointer-events: none;
    transform: translate(50px, 0);
    transition: opacity 0.5s cubic-bezier(0.4, 0, 0.2, 1), transform 0.7s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .form-frame.active {
    opacity: 1;
    pointer-events: all;
    transform: translate(0, 0);
  }

  .error {
    color: red;
    font-size: 0.9rem;
    margin-top: -0.5rem;
    margin-bottom: 1rem;
  }

  .banner-content {
  max-width: 700px;
  margin: 0 auto;
  padding: 2rem 1.5rem;
  background: rgba(255,255,255,0.92);
  border-radius: 1.5rem;
  box-shadow: 0 6px 32px 0 rgba(60, 80, 120, 0.10);
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  text-align: left;
}

.banner-subtitle,
.banner-title,
.banner-services-title {
  text-align: inherit;
}

.banner-subtitle {
  font-size: 1.1rem;
  font-weight: 500;
  color: #2a4d7a;
  margin-bottom: 1.2rem;
  letter-spacing: 0.03em;
}

.banner-title {
  font-size: 2.4rem;
  font-weight: 800;
  color: #1a2a3a;
  margin-bottom: 1.5rem;
  line-height: 1.2;
  letter-spacing: -0.01em;
}

.banner-services-title {
  font-size: 1.2rem;
  font-weight: 600;
  color: #3a5a8a;
  margin-bottom: 1rem;
}

.banner-services-list {
  list-style: none;
  padding: 0;
  margin: 0 0 2rem 0;
  display: flex;
  flex-wrap: wrap;
  gap: 1.2rem;
  justify-content: flex-start;
}

.banner-service {
  background: #e6f0fa;
  color: #1a2a3a;
  font-size: 1rem;
  font-weight: 500;
  padding: 0.7rem 1.4rem;
  border-radius: 2rem;
  box-shadow: 0 2px 8px 0 rgba(60, 80, 120, 0.07);
  transition: background 0.2s, color 0.2s;
  white-space: nowrap;
  text-align: center;
}

.banner-service:hover,
.banner-service:focus-visible {
  background: #d0e4fa;
  color: #17406a;
}

.button-row {
  display: flex;
  gap: 1.2rem;
  margin-top: 1.2rem;
  justify-content: flex-start;
  width: 100%;
}

@media (max-width: 1024px) {
  .banner-content {
    align-items: center;
    text-align: center;
    padding: 1.5rem 0.5rem;
  }
  .banner-title {
    font-size: 2rem;
  }
  .banner-services-list {
    justify-content: center;
  }
  .button-row {
    justify-content: center;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
  }
}

@media (max-width: 600px) {
  .banner-content {
    padding: 1rem 0.2rem;
    border-radius: 1rem;
  }
  .banner-title {
    font-size: 1.3rem;
  }
  .banner-services-list {
    gap: 0.5rem;
  }
  .banner-service {
    font-size: 0.95rem;
    padding: 0.5rem 1rem;
  }
}
</style>
