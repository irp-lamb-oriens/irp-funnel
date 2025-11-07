<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { writable } from 'svelte/store';
  import LetterByLetter from './LetterByLetter.svelte';
  import PlainText from './systems/inputs/PlainText/PlainText.svelte';
  import Email from './systems/inputs/Email/Email.svelte';
  import Country from './systems/inputs/Country/Country.svelte';
  import Phone from './systems/inputs/Phone/Phone.svelte';
  import IconButton from './systems/buttons/IconButton/IconButton.svelte';
  import CTAButton from "./Header/CTAButton.svelte";
  import store from './store.ts';
    import VideoBanner from './VideoBanner.svelte';

  let currentStep = 0;
  let formData = {
    name: '',
    email: '',
    destinationCountry: '',
    originCountry: '',
    phone: '',
    referrer: ''
  };
  let errors = {
    name: '',
    email: '',
    destinationCountry: '',
    originCountry: '',
    phone: ''
  };

  let isEmailValid = false;
  let isPhoneValid = false;
  let showReferrerStep = false;
  let timeoutId: ReturnType<typeof setTimeout>;
  let nameInput: HTMLInputElement,
    emailInput: HTMLInputElement,
    destinationCountryInput: HTMLButtonElement,
    originCountryInput: HTMLButtonElement,
    phoneInput: HTMLButtonElement,
    referrerInput: HTMLInputElement;

  onMount(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const referrer = urlParams.get('refer');
    if (!referrer || referrer.trim() === '') {
      showReferrerStep = true;
    } else {
      formData.referrer = referrer.trim();
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
    if (currentStep === 5 && !showReferrerStep) {
      submitForm();
    }
    focusInput(currentStep);
  }

  function validateStep(step: number) {
    let isValid = true;
    switch (step) {
      case 0:
        if (!formData.name.trim()) {
          errors.name = 'Fill this field before proceeding';
          isValid = false;
        } else {
          errors.name = '';
        }
        break;
      case 1:
        if (!formData.email.trim() || !isEmailValid) {
          errors.email = 'Please enter a valid email';
          isValid = false;
        } else {
          errors.email = '';
        }
        break;
      case 2:
        if (!formData.destinationCountry.trim()) {
          errors.destinationCountry = 'Fill this field before proceeding';
          isValid = false;
        } else {
          errors.destinationCountry = '';
        }
        break;
      case 3:
        if (!formData.originCountry.trim()) {
          errors.originCountry = 'Fill this field before proceeding';
          isValid = false;
        } else {
          errors.originCountry = '';
        }
        break;
      case 4:
        if (!formData.phone.trim() || !isPhoneValid) {
          errors.phone = 'Please enter a valid phone number';
          isValid = false;
        } else {
          errors.phone = '';
        }
        break;
    }
    errors = { ...errors };
    return isValid;
  }

  async function submitForm() {
    if (currentStep === 5 && !validateStep(currentStep)) {
      return;
    }

    try {
      const response = await fetch(`${$store.apiURL()}/api/send-hero-consultation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        currentStep = 6; // Go to "Thank You"
        timeoutId = setTimeout(() => {
          currentStep = 7; // Go to final banner
        }, 3000);
      } else {
        console.error('Form submission failed', await response.text());
      }
    } catch (error) {
      console.error('An error occurred during form submission:', error);
    }
  }

  async function focusInput(step: number) {
    await tick();
    switch (step) {
      case 0:
        nameInput?.focus();
        break;
      case 1:
        emailInput?.focus();
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
        referrerInput?.focus();
        break;
    }
  }

  export let videoUrl: string = "https://storage.googleapis.com/videos-irp-funnels/The-Truth-About-Moving-Abroad_-What-You-Need-to-Know-Before-Taking-the-Leap.mp4";
  export let imageUrl: string = "/video-lightbox1b-480x590.jpg";
  export let imageAlt: string = "video-lightbox1b";
</script>

<div class="hero-banner">
  <VideoBanner
  videoUrl={videoUrl}
  videoPoster={imageUrl}
  videoAlt={imageAlt}>
    <div class="form-container">
      <div class="form-steps">
        {#if currentStep === 0}
          <div class="form-frame active">
            <h6><LetterByLetter text="Every project is led by professionals with more than 14 years of experience" /></h6>
            <p class="sub-heading"><LetterByLetter text="Schedule a call with us on" /></p>
            <h2>Want a consultation call?</h2>
            <PlainText label="Tell us your name so we can address you" placeholder="John Doe" bind:value={formData.name} onEnter={handleNextStep} bind:inputElement={nameInput} />
            {#if errors.name}<span class="error">{errors.name}</span>{/if}
            <div class="button-wrapper">
              <IconButton src="./icons/right-arrow.svg" callback={handleNextStep} />
            </div>
          </div>
        {/if}

        {#if currentStep === 1}
          <div class="form-frame active">
            <h6><LetterByLetter text="International consulting services for expats, newcomers, and retirees:" /></h6>
            <Email label="Place your email so we can contact you" placeholder="john.doe@email.com" bind:value={formData.email} onEnter={handleNextStep} bind:inputElement={emailInput} bind:valid={isEmailValid} />
            {#if errors.email}<span class="error">{errors.email}</span>{/if}
            <div class="button-wrapper">
              <IconButton src="./icons/right-arrow.svg" callback={handleNextStep} />
            </div>
          </div>
        {/if}

        {#if currentStep === 2}
          <div class="form-frame active">
            <p class="sub-heading"><LetterByLetter text="Schedule a call with us on" /></p>
            <h2>Destination country: Where do you wanna move</h2>
            <Country onSelect={(code) => {
              formData.destinationCountry = code || '';
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
              formData.originCountry = code || '';
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
            <Phone bind:value={formData.phone} onEnter={handleNextStep} bind:inputElement={phoneInput} bind:isValid={isPhoneValid} />
            {#if errors.phone}<span class="error">{errors.phone}</span>{/if}
            <div class="button-wrapper">
              <IconButton src="./icons/right-arrow.svg" callback={handleNextStep} />
            </div>
          </div>
        {/if}

        {#if currentStep === 5 && showReferrerStep}
          <div class="form-frame active">
            <h2>Who referred you to us?</h2>
            <PlainText placeholder="Jane Smith" bind:value={formData.referrer} onEnter={submitForm} bind:inputElement={referrerInput} />
            <div class="button-wrapper">
              <IconButton src="./icons/right-arrow.svg" callback={submitForm} />
            </div>
          </div>
        {/if}

        {#if currentStep === 6}
          <div class="form-frame active">
            <p>Thank you for contacting us</p>
            <p>We will get in touch with you soon</p>
            <IconButton src="./icons/right-arrow.svg" callback={nextStep} />
          </div>
        {/if}

        {#if currentStep === 7}
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
    background: white;
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
    font-size: 0.9rem;
    font-weight: 400;
    color: #666;
  }

  .sub-heading {
    font-size: 1rem;
    color: #333;
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
