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
  import { formState, updateField } from './systems/inputs/Calendar/formStore.js';
  import { submitScheduling } from './systems/inputs/Calendar/submitSchedule.js';
  import CTAButton from "./Header/CTAButton.svelte";
  import store from './store.js';
  import VideoBanner from './VideoBanner.svelte';
  import Loader from './Loader/Loader.svelte';

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
    immigrationStatus: '',
    movingDate: ''
  };

  let isEmailValid = false;
  let isPhoneValid = false;

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
  let nameInput: HTMLInputElement,
    emailInput: HTMLInputElement,
    destinationCountryInput: HTMLButtonElement,
    originCountryInput: HTMLButtonElement,
    phoneInput: HTMLButtonElement,
    referrerInput: HTMLInputElement,
    sizeInput: HTMLButtonElement,
    budgetInput: HTMLButtonElement,
    immigrationStatusInput: HTMLButtonElement;

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

  function nextStep() {
    if (timeoutId) clearTimeout(timeoutId);
    currentStep++;
    if (currentStep === 11 && !showReferrerStep) {
      submitForm();
    }
    focusInput(currentStep);
  }

  function validateStep(step: number) {
    let isValid = true;
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
        break;
      case 3:
        if (!$formState.originCountry.trim()) {
          errors.originCountry = 'Fill this field before proceeding';
          isValid = false;
        } else {
          errors.originCountry = '';
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
      case 9:
        if (!$formState.immigrationStatus.trim()) {
          errors.immigrationStatus = 'Please enter your immigration status';
          isValid = false;
        } else {
          errors.immigrationStatus = '';
        }
        break;
      case 10:
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
    }
    errors = { ...errors };
    return isValid;
  }

  async function submitForm() {
    console.log("submitForm called");
    if (currentStep === 11 && !validateStep(currentStep)) {
      return;
    }

    isLoading = true;

    try {
      const response = await submitScheduling();
      if (response && response.calendarLink) {
        calendarLink = response.calendarLink;
        window.open(calendarLink, '_blank');
      }
      currentStep = 12; // Go to "Thank You"
      timeoutId = setTimeout(() => {
        currentStep = 13; // Go to final banner
      }, 3000);
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
        immigrationStatusInput?.focus();
        break;
      case 10:
        // No specific input to focus for Calendar
        break;
      case 11:
        referrerInput?.focus();
        break;
    }
  }

  export let videoUrl: string = "https://storage.googleapis.com/videos-irp-funnels/The-Truth-About-Moving-Abroad_-What-You-Need-to-Know-Before-Taking-the-Leap.mp4";
  export let imageUrl: string = "/video-lightbox1b-480x590.jpg";
  export let imageAlt: string = "video-lightbox1b";
</script>

<div class="hero-banner">
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
            }} bind:buttonRef={destinationCountryInput} on:enter={handleNextStep} />
            {#if errors.destinationCountry}<span class="error">{errors.destinationCountry}</span>{/if}
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
            }} bind:buttonRef={originCountryInput} on:enter={handleNextStep} />
            {#if errors.originCountry}<span class="error">{errors.originCountry}</span>{/if}
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
            <h2>What type of place are you relocating from?</h2>
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
            <h2>What type of place are you relocating to?</h2>
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
            <h2>Immigration Status</h2>
            <ImmigrationStatus bind:buttonRef={immigrationStatusInput} />
            {#if errors.immigrationStatus}<span class="error">{errors.immigrationStatus}</span>{/if}
            <div class="button-wrapper">
              <IconButton src="./icons/right-arrow.svg" callback={handleNextStep} />
            </div>
          </div>
        {/if}

        {#if currentStep === 10}
          <div class="form-frame active">
            <h2>Desired moving date</h2>
            <Calendar />
            {#if errors.movingDate}<span class="error">{errors.movingDate}</span>{/if}
            <div class="button-wrapper">
              <IconButton src="./icons/right-arrow.svg" callback={handleNextStep} />
            </div>
          </div>
        {/if}

        {#if currentStep === 11 && showReferrerStep}
          <div class="form-frame active">
            <h2>Who referred you to us?</h2>
            <PlainText placeholder="The name here" bind:value={$formState.referredBy} onEnter={submitForm} bind:inputElement={referrerInput} />
            <div class="button-wrapper">
              <IconButton src="./icons/right-arrow.svg" callback={submitForm} />
            </div>
          </div>
        {/if}

        {#if currentStep === 12}
          <div class="form-frame active">
            <h2>Thank You!</h2>
            <h4>An email has been sent to your inbox.</h4>
            <p>You can view your scheduled consultation here:</p>
            <a href={calendarLink} target="_blank" rel="noopener noreferrer" style="cursor: pointer; text-decoration: underline;">View Your Consultation on Google Calendar</a>
            <IconButton src="./icons/right-arrow.svg" callback={nextStep} />
          </div>
        {/if}

        {#if currentStep === 13}
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
                <CTAButton label="Schedule Consultation" href="/consultation/" variant="primary" />
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
    font-weight: 600;
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
