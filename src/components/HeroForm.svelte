<script lang="ts">
  import { onMount, onDestroy, tick } from 'svelte';
  import LetterByLetter from './LetterByLetter.svelte';
  import PlainText from './systems/inputs/PlainText/PlainText.svelte';
  import Email from './systems/inputs/Email/Email.svelte';
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
  import store from './store.js';
  import VideoBanner from './VideoBanner.svelte';
  import Loader from './Loader/Loader.svelte';
  import Chatbot from './Chatbot.svelte';
  import countries from './systems/inputs/Country/countries.js';

  // ─── Views ────────────────────────────────────────────────────────────────
  // 'cta'     = initial CTA button
  // 'email'   = email capture
  // 'choice'  = channel picker (Lili / WhatsApp / Form)
  // 'chatbot' = inline chatbot
  // 'form'    = multi-step consultation form
  type ViewState = 'cta' | 'email' | 'choice' | 'chatbot' | 'form';
  let view: ViewState = 'cta';
  let formStep = 0; // which step within the multi-step form (0-12)

  let isLoading = false;
  let emailError = '';
  let isEmailValid = false;
  let isPhoneValid = false;
  let emailInput: HTMLInputElement;
  let showReferrerStep = false;
  let showYoutubeVideoStep = false;
  let calendarLink = '';
  let hangoutLink = '';

  let errors: Record<string, string> = {};

  // ─── Props ────────────────────────────────────────────────────────────────
  export let videoUrl: string = "https://storage.googleapis.com/videos-irp-funnels/The-Truth-About-Moving-Abroad_-What-You-Need-to-Know-Before-Taking-the-Leap.mp4";
  export let imageUrl: string = "/video-lightbox1b-480x590.jpg";
  export let imageAlt: string = "video-lightbox1b";

  // ─── Derived ──────────────────────────────────────────────────────────────
  $: originCountryName = countries.find(c => c.code === $formState.originCountry)?.name || $formState.originCountry;
  $: destinationCountryName = countries.find(c => c.code === $formState.destinationCountry)?.name || $formState.destinationCountry;

  // ─── Store subscriptions ──────────────────────────────────────────────────
  const unsubImmigration = immigrationStatusStore.subscribe(v => updateField(v || '', 'immigrationStatus'));
  const unsubBudget = budgetStore.subscribe(v => updateField(v || '', 'budget'));
  const unsubMoveSize = moveSizeStore.subscribe(v => updateField(v || '', 'size'));
  onDestroy(() => { unsubImmigration(); unsubBudget(); unsubMoveSize(); });

  // ─── WhatsApp ─────────────────────────────────────────────────────────────
  const WHATSAPP_PHONE = "50689662552";
  function getWhatsAppUrl(): string {
    const email = $formState.email || '';
    const text = encodeURIComponent(`Hi Lili! I'm interested in international relocation. My email is ${email}.`);
    return `https://wa.me/${WHATSAPP_PHONE}?text=${text}`;
  }

  // ─── Input refs ───────────────────────────────────────────────────────────
  let nameInput: HTMLInputElement, surnameInput: HTMLInputElement;
  let destinationCountryInput: HTMLButtonElement, destinationCityInput: HTMLInputElement, destinationZipInput: HTMLInputElement;
  let originCountryInput: HTMLButtonElement, originCityInput: HTMLInputElement, originZipInput: HTMLInputElement;
  let phoneInput: HTMLButtonElement, budgetInput: HTMLButtonElement;
  let sizeInput: HTMLButtonElement, immigrationStatusInput: HTMLButtonElement;
  let referrerInput: HTMLInputElement;
  let youtubeVideoInput: HTMLInputElement;

  // ─── YouTube referral detection ─────────────────────────────────────────
  function isYouTubeReferral(val: string): boolean {
    const normalized = val.toLowerCase().trim().replace(/\s+/g, '');
    return normalized === 'youtube' || normalized === 'yt' || normalized.includes('youtube');
  }

  // ─── OnMount ──────────────────────────────────────────────────────────────
  onMount(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const referrer = urlParams.get('refer');
    if (!referrer || referrer.trim() === '') {
      showReferrerStep = true;
    } else {
      updateField(referrer.trim(), 'referredBy');
    }
  });

  // ─── Navigation ───────────────────────────────────────────────────────────
  async function handleStart() {
    view = 'email';
    await tick();
    emailInput?.focus();
  }

  async function handleEmailSubmit() {
    if (!$formState.email.trim() || !isEmailValid) {
      emailError = 'Please enter a valid email';
      return;
    }
    emailError = '';
    isLoading = true;
    try {
      const apiURL = $store.apiURL();
      await fetch(`${apiURL}/api/capture-data`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: $formState.email.trim(),
          name: '', surname: '',
          source: 'hero-form-email-capture',
          timestamp: new Date().toISOString(),
        }),
      });
    } catch (err) { console.error('Email capture failed:', err); }
    finally { isLoading = false; view = 'choice'; }
  }

  function openChatbot() { view = 'chatbot'; }

  function openForm() {
    view = 'form';
    // Auto-skip to first unfilled step
    if (showYoutubeVideoStep) formStep = 12;
    else if (!$formState.name || !$formState.surname) formStep = 0;
    else if (!$formState.destinationCountry || !$formState.destinationCity) formStep = 1;
    else if (!$formState.originCountry || !$formState.originCity) formStep = 2;
    else if (!$formState.phone) formStep = 3;
    else if (!$formState.budget) formStep = 4;
    else if (!$formState.propertyTypeFrom) formStep = 5;
    else if (!$formState.propertyTypeTo) formStep = 6;
    else if (!$formState.size) formStep = 7;
    else if ($formState.vehicles.length === 0 || !$formState.vehicles[0]?.year) formStep = 8;
    else if (!$formState.immigrationStatus) formStep = 9;
    else formStep = 10;
  }

  function backToChoice() { view = 'choice'; }

  // ─── Chatbot callbacks ────────────────────────────────────────────────────
  const FORM_KEYS = new Set([
    'name', 'surname', 'email', 'destinationCountry', 'destinationCity',
    'originCountry', 'originCity', 'phone', 'referredBy', 'youtubeVideo',
    'budget', 'propertyTypeFrom', 'propertyTypeTo', 'size', 'immigrationStatus',
    'scheduling', 'originZip', 'destinationZip', 'vehicles'
  ]);

  function handleExtractedFields(fields: any) {
    if (!fields) return;
    for (const [key, value] of Object.entries(fields)) {
      if (!FORM_KEYS.has(key)) continue; // Skip fields not in formStore
      if (value === null || value === undefined) continue;
      
      // Handle strings
      if (typeof value === 'string' && value.trim() !== '') {
        updateField(value, key as any);
      }
      // Handle arrays (vehicles, scheduling, etc.)
      else if (Array.isArray(value) && value.length > 0) {
        updateField(value as any, key as any);
      }
    }
  }
  function handleChannelSelect(channel: string) {
    if (channel === 'whatsapp') window.open(getWhatsAppUrl(), '_blank');
  }

  // ─── Form navigation ─────────────────────────────────────────────────────
  function formNext() {
    if (validateFormStep(formStep)) {
      formStep++;
      if (formStep === 11 && !showReferrerStep) {
        // No referrer step needed — check if URL param referral is YouTube
        if (isYouTubeReferral($formState.referredBy)) {
          showYoutubeVideoStep = true;
          formStep = 12; // go to YouTube video step
        } else {
          submitForm();
        }
      }
      focusFormInput(formStep);
    }
  }

  function handleSkipVehicles() { updateField([], 'vehicles'); formStep++; }

  function validateFormStep(step: number): boolean {
    let valid = true;
    const zipRegex = /^[a-zA-Z0-9\s-]{3,10}$/;
    errors = {};

    switch (step) {
      case 0:
        if (!$formState.name.trim()) { errors.name = 'Required'; valid = false; }
        if (!$formState.surname.trim()) { errors.surname = 'Required'; valid = false; }
        break;
      case 1:
        if (!$formState.destinationCountry.trim()) { errors.destinationCountry = 'Required'; valid = false; }
        if (!$formState.destinationCity.trim()) { errors.destinationCity = 'Required'; valid = false; }
        if ($formState.destinationZip && !zipRegex.test($formState.destinationZip.trim())) { errors.destinationZip = 'Invalid zip'; valid = false; }
        break;
      case 2:
        if (!$formState.originCountry.trim()) { errors.originCountry = 'Required'; valid = false; }
        if (!$formState.originZip || !zipRegex.test($formState.originZip.trim())) { errors.originZip = 'Invalid zip'; valid = false; }
        break;
      case 3:
        if (!$formState.phone.trim() || !isPhoneValid) { errors.phone = 'Valid phone required'; valid = false; }
        break;
      case 4:
        if (!$formState.budget.trim()) { errors.budget = 'Required'; valid = false; }
        break;
      case 5: if (!$formState.propertyTypeFrom) { errors.propertyTypeFrom = 'Required'; valid = false; } break;
      case 6: if (!$formState.propertyTypeTo) { errors.propertyTypeTo = 'Required'; valid = false; } break;
      case 7: if (!$formState.size.trim()) { errors.size = 'Required'; valid = false; } break;
      case 8:
        if ($formState.vehicles.some(v => !v.year || !v.make || !v.model)) valid = false;
        break;
      case 9:
        if (!$formState.immigrationStatus.trim()) { errors.immigrationStatus = 'Required'; valid = false; }
        break;
      case 10:
        if ($formState.scheduling.length === 0) { errors.movingDate = 'Select a date'; valid = false; }
        break;
    }
    return valid;
  }

  async function submitForm() {
    isLoading = true;
    try {
      const response = await submitScheduling();
      if (response?.calendarLink) {
        calendarLink = response.calendarLink;
        hangoutLink = response.hangoutLink;
        window.open(calendarLink, '_blank');
      }
      formStep = showYoutubeVideoStep ? 13 : 12; // thank you
    } catch (error) { console.error('Form submission error:', error); }
    finally { isLoading = false; }
  }

  async function focusFormInput(step: number) {
    await tick();
    const map: Record<number, any> = {
      0: nameInput, 1: destinationCountryInput, 2: originCountryInput,
      3: phoneInput, 4: budgetInput, 7: sizeInput, 9: immigrationStatusInput, 11: referrerInput, 12: youtubeVideoInput,
    };
    map[step]?.focus?.();
  }

  // ─── Pre-fill indicator ───────────────────────────────────────────────────
  function isPreFilled(field: string): boolean {
    const val = ($formState as any)[field];
    return val !== undefined && val !== '' && val !== null;
  }
</script>

<div class="hero-banner" id="hero-form">
  <video autoplay muted loop playsinline class="bg-video" src="https://www.pexels.com/download/video/7855756/"></video>
  <Loader visible={isLoading} />
  <VideoBanner videoUrl={videoUrl} videoPoster={imageUrl} videoAlt={imageAlt}>
    <div class="form-container">
      <div class="form-steps">

        <!-- ═══════════ CTA ═══════════ -->
        {#if view === 'cta'}
          <div class="form-frame active">
            <div class="cta-hero">
              <h6 class="cta-hero__eyebrow"><LetterByLetter text="Every project is led by professionals with more than 14 years of experience" /></h6>
              <h1 class="cta-hero__title">Ready to start your<br/>international journey?</h1>
              <p class="cta-hero__sub">Get personalized relocation guidance — speak with our virtual assistant, fill out a quick form, or connect with us on WhatsApp.</p>
              <button class="cta-hero__btn" on:click={handleStart}>
                <span class="cta-hero__btn-icon">🌍</span>
                <span class="cta-hero__btn-text">Get Started</span>
                <span class="cta-hero__btn-arrow">→</span>
              </button>
            </div>
          </div>
        {/if}

        <!-- ═══════════ EMAIL ═══════════ -->
        {#if view === 'email'}
          <div class="form-frame active">
            <h6><LetterByLetter text="International consulting for expats, newcomers, and retirees" /></h6>
            <h2>Enter your email to get started</h2>
            <p class="sub-heading">We'll use this to send you personalized relocation insights.</p>
            <Email label="Your email address" placeholder="john.doe@email.com" bind:value={$formState.email} onEnter={handleEmailSubmit} bind:inputElement={emailInput} bind:valid={isEmailValid} />
            {#if emailError}<span class="error">{emailError}</span>{/if}
            <div class="button-wrapper"><IconButton src="./icons/right-arrow.svg" callback={handleEmailSubmit} loading={isLoading} /></div>
          </div>
        {/if}

        <!-- ═══════════ CHOICE ═══════════ -->
        {#if view === 'choice'}
          <div class="form-frame active">
            <div class="choice-screen">
              <div class="choice-screen__check">✓</div>
              <h2 class="choice-screen__title">You're all set!</h2>
              <p class="choice-screen__desc">Choose how you'd like to continue:</p>
              <div class="choice-buttons">
                <button class="choice-btn choice-btn--primary" on:click={openChatbot}>
                  <span class="choice-btn__icon choice-btn__icon--avatar">
                    <img src="/lili.png" alt="Relocation team" class="lili-avatar" />
                    <span class="online-pulse"></span>
                  </span>
                  <div class="choice-btn__content">
                    <span class="choice-btn__label">Chat with our relocation team</span>
                    <span class="choice-btn__hint"><span class="online-indicator"></span>Someone's online</span>
                  </div>
                  <span class="choice-btn__arrow">→</span>
                </button>
                <button class="choice-btn choice-btn--form" on:click={openForm}>
                  <span class="choice-btn__icon">📅</span>
                  <div class="choice-btn__content">
                    <span class="choice-btn__label">Book a call</span>
                    <span class="choice-btn__hint">Schedule a consultation with the team</span>
                  </div>
                  <span class="choice-btn__arrow">→</span>
                </button>
              </div>
            </div>
          </div>
        {/if}

        <!-- ═══════════ CHATBOT ═══════════ -->
        {#if view === 'chatbot'}
          <div class="form-frame active">
            <div class="back-bar">
              <button class="back-btn" on:click={backToChoice}>← Back</button>
              <button class="switch-btn" on:click={openForm}>Switch to Form →</button>
            </div>
            <Chatbot initialContext={$formState} onBackToForm={openForm} onExtractedFields={handleExtractedFields} onErrorFallback={backToChoice} onChannelSelect={handleChannelSelect} />
          </div>
        {/if}

        <!-- ═══════════ MULTI-STEP FORM ═══════════ -->
        {#if view === 'form'}
          <div class="form-frame active">
            <div class="back-bar">
              <button class="back-btn" on:click={backToChoice}>← Back</button>
              {#if formStep < 12}
                <button class="switch-btn" on:click={openChatbot}>Chat with the team →</button>
              {/if}
            </div>

            {#if formStep === 0}
              <h2>What's your name?</h2>
              <PlainText label="First name" placeholder="John" bind:value={$formState.name} onChange={(val) => updateField(val, 'name')} onEnter={() => surnameInput?.focus()} bind:inputElement={nameInput} />
              {#if isPreFilled('name')}<span class="prefilled-tag">✨ Pre-filled from team chat</span>{/if}
              {#if errors.name}<span class="error">{errors.name}</span>{/if}
              <PlainText label="Last name" placeholder="Doe" bind:value={$formState.surname} onChange={(val) => updateField(val, 'surname')} onEnter={formNext} bind:inputElement={surnameInput} />
              {#if isPreFilled('surname')}<span class="prefilled-tag">✨ Pre-filled from team chat</span>{/if}
              {#if errors.surname}<span class="error">{errors.surname}</span>{/if}
              <div class="button-wrapper"><IconButton src="./icons/right-arrow.svg" callback={formNext} loading={isLoading} /></div>

            {:else if formStep === 1}
              <h2>Where are you moving to?</h2>
              <Country onSelect={(code) => updateField(code || '', 'destinationCountry')} bind:buttonRef={destinationCountryInput} on:enter={() => {}} />
              {#if errors.destinationCountry}<span class="error">{errors.destinationCountry}</span>{/if}
              <PlainText label="Destination City" placeholder="City" bind:value={$formState.destinationCity} onChange={(val) => updateField(val, 'destinationCity')} onEnter={() => destinationZipInput?.focus()} bind:inputElement={destinationCityInput} />
              {#if errors.destinationCity}<span class="error">{errors.destinationCity}</span>{/if}
              <PlainText label="Zip Code (optional)" placeholder="Zip Code" bind:value={$formState.destinationZip} onChange={(val) => updateField(val, 'destinationZip')} onEnter={formNext} bind:inputElement={destinationZipInput} />
              {#if errors.destinationZip}<span class="error">{errors.destinationZip}</span>{/if}
              <div class="button-wrapper"><IconButton src="./icons/right-arrow.svg" callback={formNext} loading={isLoading} /></div>

            {:else if formStep === 2}
              <h2>Where are you moving from?</h2>
              <Country onSelect={(code) => updateField(code || '', 'originCountry')} bind:buttonRef={originCountryInput} on:enter={() => {}} />
              {#if errors.originCountry}<span class="error">{errors.originCountry}</span>{/if}
              <PlainText label="Origin City" placeholder="City" bind:value={$formState.originCity} onChange={(val) => updateField(val, 'originCity')} onEnter={() => originZipInput?.focus()} bind:inputElement={originCityInput} />
              <PlainText label="Origin Zip Code" placeholder="Zip Code" bind:value={$formState.originZip} onChange={(val) => updateField(val, 'originZip')} onEnter={formNext} bind:inputElement={originZipInput} />
              {#if errors.originZip}<span class="error">{errors.originZip}</span>{/if}
              <div class="button-wrapper"><IconButton src="./icons/right-arrow.svg" callback={formNext} loading={isLoading} /></div>

            {:else if formStep === 3}
              <h2>Your phone number</h2>
              <p class="sub-heading">So we can contact you directly</p>
              <Phone bind:value={$formState.phone} onUpdate={(val) => updateField(val, 'phone')} onEnter={formNext} bind:inputElement={phoneInput} bind:isValid={isPhoneValid} />
              {#if errors.phone}<span class="error">{errors.phone}</span>{/if}
              <div class="button-wrapper"><IconButton src="./icons/right-arrow.svg" callback={formNext} loading={isLoading} /></div>

            {:else if formStep === 4}
              <h2>What is your budget?</h2>
              <Budget bind:buttonRef={budgetInput} />
              {#if errors.budget}<span class="error">{errors.budget}</span>{/if}
              <div class="button-wrapper"><IconButton src="./icons/right-arrow.svg" callback={formNext} loading={isLoading} /></div>

            {:else if formStep === 5}
              <h2>Relocating from what type of place in {originCountryName}?</h2>
              <IconGridSelector options={[
                { value: 'apartment', label: 'Apartment', iconSrc: '/icons/apartment.svg' },
                { value: 'condo', label: 'Condo', iconSrc: '/icons/condo.svg' },
                { value: 'house', label: 'House', iconSrc: '/icons/house.svg' },
                { value: 'storage', label: 'Storage', iconSrc: '/icons/storage.svg' }
              ]} bind:selectedValue={$formState.propertyTypeFrom} on:update={(e) => updateField(e.detail, 'propertyTypeFrom')} />
              {#if errors.propertyTypeFrom}<span class="error">{errors.propertyTypeFrom}</span>{/if}
              <div class="button-wrapper"><IconButton src="./icons/right-arrow.svg" callback={formNext} loading={isLoading} /></div>

            {:else if formStep === 6}
              <h2>Relocating to what type of place in {destinationCountryName}?</h2>
              <IconGridSelector options={[
                { value: 'apartment', label: 'Apartment', iconSrc: '/icons/apartment.svg' },
                { value: 'condo', label: 'Condo', iconSrc: '/icons/condo.svg' },
                { value: 'house', label: 'House', iconSrc: '/icons/house.svg' },
                { value: 'storage', label: 'Storage', iconSrc: '/icons/storage.svg' }
              ]} bind:selectedValue={$formState.propertyTypeTo} on:update={(e) => updateField(e.detail, 'propertyTypeTo')} />
              {#if errors.propertyTypeTo}<span class="error">{errors.propertyTypeTo}</span>{/if}
              <div class="button-wrapper"><IconButton src="./icons/right-arrow.svg" callback={formNext} loading={isLoading} /></div>

            {:else if formStep === 7}
              <h2>Move size</h2>
              <MoveSize bind:buttonRef={sizeInput} />
              {#if errors.size}<span class="error">{errors.size}</span>{/if}
              <div class="button-wrapper"><IconButton src="./icons/right-arrow.svg" callback={formNext} loading={isLoading} /></div>

            {:else if formStep === 8}
              <h2>Vehicles</h2>
              <p class="sub-heading">Tell us about the vehicles you are shipping</p>
              <Vehicles bind:vehicles={$formState.vehicles} onUpdate={(v) => updateField(v, 'vehicles')} />
              <div class="button-wrapper buttons-row">
                <IconButton src="./icons/right-arrow.svg" callback={formNext} loading={isLoading} />
                <button class="skip-btn" on:click={handleSkipVehicles}>I don't have vehicles to ship</button>
              </div>

            {:else if formStep === 9}
              <h2>Immigration Status</h2>
              <ImmigrationStatus bind:buttonRef={immigrationStatusInput} />
              {#if errors.immigrationStatus}<span class="error">{errors.immigrationStatus}</span>{/if}
              <div class="button-wrapper"><IconButton src="./icons/right-arrow.svg" callback={formNext} loading={isLoading} /></div>

            {:else if formStep === 10}
              <h2>Desired call date</h2>
              <Calendar />
              {#if errors.movingDate}<span class="error">{errors.movingDate}</span>{/if}
              <div class="button-wrapper"><IconButton src="./icons/right-arrow.svg" callback={formNext} loading={isLoading} /></div>

            {:else if formStep === 11 && showReferrerStep}
              <h2>Who referred you to us?</h2>
              <PlainText placeholder="The name here" bind:value={$formState.referredBy} onChange={(val) => updateField(val, 'referredBy')} onEnter={() => {
                if (isYouTubeReferral($formState.referredBy)) {
                  showYoutubeVideoStep = true;
                  formStep = 12;
                  focusFormInput(12);
                } else {
                  submitForm();
                }
              }} bind:inputElement={referrerInput} />
              <div class="button-wrapper"><IconButton src="./icons/right-arrow.svg" callback={() => {
                if (isYouTubeReferral($formState.referredBy)) {
                  showYoutubeVideoStep = true;
                  formStep = 12;
                  focusFormInput(12);
                } else {
                  submitForm();
                }
              }} loading={isLoading} /></div>

            {:else if formStep === 12 && showYoutubeVideoStep}
              <h2>Which YouTube video did you find us from?</h2>
              <p class="sub-heading">We'd love to know — it helps us understand what resonates!</p>
              <PlainText placeholder="e.g. Moving to Costa Rica tips" bind:value={$formState.youtubeVideo} onChange={(val) => updateField(val, 'youtubeVideo')} onEnter={submitForm} bind:inputElement={youtubeVideoInput} />
              <div class="button-wrapper"><IconButton src="./icons/right-arrow.svg" callback={submitForm} loading={isLoading} /></div>

            {:else if formStep === 12 || formStep === 13}
              <div class="thank-you">
                <div class="thank-you__icon">🎉</div>
                <h2>Thank You!</h2>
                <p>An email has been sent to your inbox.</p>
                {#if calendarLink}<a href={calendarLink} target="_blank" rel="noopener noreferrer" class="thank-you__link">📅 View on Google Calendar</a>{/if}
                {#if hangoutLink}<a href={hangoutLink} target="_blank" rel="noopener noreferrer" class="thank-you__link">🎥 Join Meeting</a>{/if}
              </div>
            {/if}
          </div>
        {/if}

      </div>
    </div>
  </VideoBanner>
</div>

<style lang="scss">
  .hero-banner {
    position: relative;
    padding: 3rem 0;
    overflow: hidden;
    &::before { content: ""; position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: radial-gradient(circle, rgba(0,0,0,0) 0%, rgba(0,0,0,0.4) 100%); z-index: 1; pointer-events: none; }
    .bg-video { position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 0; object-fit: cover; filter: brightness(0.9); }
    & > :global(*) { position: relative; z-index: 2; }
  }

  .form-container {
    position: relative; width: 100%; max-width: 680px; margin: 2rem auto; padding: 3.5rem;
    background: rgba(15, 15, 15, 0.35); backdrop-filter: blur(30px) saturate(150%); -webkit-backdrop-filter: blur(30px) saturate(150%);
    border-radius: 2.5rem; border: 1px solid rgba(255, 255, 255, 0.15);
    box-shadow: 0 40px 100px -20px rgba(0,0,0,0.7), inset 0 0 0 1px rgba(255,255,255,0.05);
    overflow: auto; scrollbar-width: none; -ms-overflow-style: none;
    transition: all 0.5s cubic-bezier(0.23, 1, 0.32, 1);
    &::-webkit-scrollbar { width: 0; height: 0; }
    &::before { content: ''; position: absolute; top: -20%; right: -20%; width: 60%; height: 60%; background: radial-gradient(circle, rgba(var(--color-highlight-2-rgb), 0.15) 0%, transparent 70%); pointer-events: none; z-index: 0; filter: blur(40px); }
    &::after { content: ''; position: absolute; bottom: -20%; left: -20%; width: 60%; height: 60%; background: radial-gradient(circle, rgba(var(--color-highlight-1-rgb), 0.1) 0%, transparent 70%); pointer-events: none; z-index: 0; filter: blur(40px); }
  }

  .form-steps { position: relative; z-index: 1; }
  .form-frame { display: flex; flex-direction: column; gap: 1.5rem; opacity: 0; pointer-events: none; transform: translateY(16px); transition: opacity 0.5s cubic-bezier(0.23,1,0.32,1), transform 0.5s cubic-bezier(0.23,1,0.32,1); }
  .form-frame.active { opacity: 1; pointer-events: all; transform: translate(0,0); }

  h2 { font-size: 1.75rem; font-family: var(--font-title); font-weight: 800; color: #fff; line-height: 1.2; letter-spacing: -0.02em; background: linear-gradient(to right, #fff, rgba(255,255,255,0.7)); -webkit-background-clip: text; }
  h6 { font-size: 0.9rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em; color: var(--color-highlight-2); margin-bottom: -0.5rem; }
  .sub-heading { font-size: 1rem; color: rgba(255,255,255,0.6); line-height: 1.5; margin-top: -0.5rem; }

  .button-wrapper { display: flex; justify-content: flex-end; margin-top: 1.5rem; position: relative; z-index: 10; }
  .buttons-row { display: flex; align-items: center; gap: 20px; flex-direction: row-reverse; justify-content: space-between !important; }

  .error { color: #ef4444; font-size: 0.85rem; font-weight: 500; margin-top: -0.75rem; padding-left: 0.5rem; border-left: 2px solid #ef4444; }

  .prefilled-tag { font-size: 0.75rem; color: var(--color-highlight-2, #1ccfc9); font-weight: 600; margin-top: -1rem; display: flex; align-items: center; gap: 4px; opacity: 0.8; }

  .skip-btn {
    background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: #9ca3af;
    padding: 0.5rem 1rem; border-radius: 1rem; cursor: pointer; font-size: 0.85rem; transition: all 0.3s ease; text-decoration: none;
    &:hover { background: rgba(255,255,255,0.1); color: #fff; transform: translateY(-1px); }
  }

  .back-bar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; }
  .back-btn, .switch-btn {
    background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: rgba(255,255,255,0.6);
    padding: 0.4rem 0.9rem; border-radius: 0.75rem; cursor: pointer; font-size: 0.8rem; font-weight: 600; transition: all 0.25s ease;
    &:hover { background: rgba(255,255,255,0.1); color: #fff; }
  }
  .switch-btn { color: var(--color-highlight-2, #1ccfc9); border-color: rgba(28,207,201,0.2); &:hover { border-color: rgba(28,207,201,0.5); } }

  /* ═══ CTA Hero ═══ */
  .cta-hero { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 1.25rem;
    &__eyebrow { font-size: 0.85rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.12em; color: var(--color-highlight-2); }
    &__title { font-size: 2.4rem; font-weight: 900; color: #fff; line-height: 1.1; letter-spacing: -0.03em; background: linear-gradient(to right, #fff, rgba(255,255,255,0.8)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; max-width: 520px; }
    &__sub { font-size: 1.05rem; color: rgba(255,255,255,0.6); line-height: 1.6; max-width: 440px; }
    &__btn {
      display: flex; align-items: center; gap: 1rem; padding: 1.1rem 2.2rem; margin-top: 0.75rem;
      background: transparent; color: #fff; border: 3px solid #fff; border-radius: 100px;
      font-size: 1.15rem; font-weight: 800; font-family: var(--font-title, inherit); cursor: pointer;
      position: relative; overflow: hidden;
      transition: all 0.45s cubic-bezier(0.25, 0.46, 0.45, 0.94);
      box-shadow:
        0 4px 16px rgba(255, 255, 255, 0.1),
        0 8px 32px rgba(255, 255, 255, 0.06),
        0 12px 48px rgba(255, 255, 255, 0.03);
      animation: btnPulse 2.8s cubic-bezier(0.4, 0, 0.6, 1) infinite;

      &::before { content: ''; position: absolute; inset: 0; background: linear-gradient(135deg, rgba(255,255,255,0.08), transparent 60%); border-radius: inherit; }
      &:hover {
        transform: translateY(-3px) scale(1.02);
        border-color: #fff;
        box-shadow:
          0 6px 20px rgba(255, 255, 255, 0.2),
          0 12px 40px rgba(255, 255, 255, 0.12),
          0 20px 60px rgba(255, 255, 255, 0.06);
        animation: none;
      }
      &:active { transform: translateY(-1px); }
    }
    &__btn-icon { font-size: 1.4rem; color: #fff; }
    &__btn-text { position: relative; z-index: 1; color: #fff; }
    &__btn-arrow { font-size: 1.3rem; font-weight: 700; color: #fff; transition: transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94); }
    &__btn:hover &__btn-arrow { transform: translateX(4px); }
  }

  /* ═══ Choice Screen ═══ */
  .choice-screen { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 1rem;
    &__check { width: 56px; height: 56px; display: flex; align-items: center; justify-content: center; border-radius: 50%; background: linear-gradient(135deg, rgba(16,185,129,0.2), rgba(16,185,129,0.08)); border: 2px solid rgba(16,185,129,0.4); color: #10b981; font-size: 1.6rem; font-weight: 700; animation: popIn 0.5s cubic-bezier(0.34,1.56,0.64,1); }
    &__title { font-size: 1.8rem; font-weight: 800; background: linear-gradient(to right, #fff, rgba(255,255,255,0.75)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    &__desc { font-size: 1rem; color: rgba(255,255,255,0.6); line-height: 1.6; max-width: 460px; }
  }
  @keyframes popIn { 0% { transform: scale(0); opacity: 0; } 50% { transform: scale(1.15); } 100% { transform: scale(1); opacity: 1; } }

  @keyframes btnPulse {
    0%, 100% {
      box-shadow:
        0 4px 16px rgba(255, 255, 255, 0.1),
        0 8px 32px rgba(255, 255, 255, 0.06),
        0 12px 48px rgba(255, 255, 255, 0.03);
    }
    50% {
      box-shadow:
        0 6px 24px rgba(255, 255, 255, 0.22),
        0 12px 44px rgba(255, 255, 255, 0.14),
        0 20px 64px rgba(255, 255, 255, 0.08);
    }
  }

  .choice-buttons { display: flex; flex-direction: column; gap: 0.75rem; width: 100%; max-width: 420px; margin-top: 0.5rem; }
  .choice-btn {
    display: flex; align-items: center; gap: 1rem; padding: 1.1rem 1.5rem; border-radius: 1.25rem; cursor: pointer;
    transition: all 0.3s cubic-bezier(0.23,1,0.32,1); text-decoration: none; border: 1px solid rgba(255,255,255,0.1); position: relative; overflow: hidden;
    &:hover { transform: translateY(-2px); border-color: rgba(255,255,255,0.2); }
    &:active { transform: translateY(0); }
    &__icon { font-size: 1.5rem; flex-shrink: 0; display: flex; align-items: center; justify-content: center; width: 44px; height: 44px; border-radius: 12px; position: relative; }
    &__icon--avatar { border-radius: 50%; overflow: hidden; padding: 0; }
    &__icon--wa { border-radius: 50%; overflow: visible; padding: 0; }
    &__content { flex: 1; text-align: left; }
    &__label { display: block; font-size: 1.05rem; font-weight: 700; color: #fff; }
    &__hint { display: block; font-size: 0.8rem; color: rgba(255,255,255,0.5); margin-top: 2px; }
    &__arrow { font-size: 1.3rem; font-weight: 700; color: rgba(255,255,255,0.4); transition: all 0.3s ease; flex-shrink: 0; }
    &:hover &__arrow { color: #fff; transform: translateX(3px); }

    &--primary { background: linear-gradient(135deg, rgba(99,102,241,0.15), rgba(99,102,241,0.05));
      .choice-btn__icon { background: rgba(99,102,241,0.2); color: #818cf8; }
      &:hover { background: linear-gradient(135deg, rgba(99,102,241,0.25), rgba(99,102,241,0.1)); border-color: rgba(99,102,241,0.4); box-shadow: 0 8px 32px rgba(99,102,241,0.15); }
    }
    &--form { background: linear-gradient(135deg, rgba(251,191,36,0.12), rgba(251,191,36,0.04));
      .choice-btn__icon { background: rgba(251,191,36,0.2); color: #fbbf24; }
      &:hover { background: linear-gradient(135deg, rgba(251,191,36,0.22), rgba(251,191,36,0.08)); border-color: rgba(251,191,36,0.4); box-shadow: 0 8px 32px rgba(251,191,36,0.12); }
    }
    &--whatsapp { background: linear-gradient(135deg, rgba(37,211,102,0.12), rgba(37,211,102,0.04));
      .choice-btn__icon {
        background: transparent; color: #fff;
        svg { width: 22px; height: 22px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
      }
      &:hover { background: linear-gradient(135deg, rgba(37,211,102,0.22), rgba(37,211,102,0.08)); border-color: rgba(37,211,102,0.4); box-shadow: 0 8px 32px rgba(37,211,102,0.12); }
    }
  }

  /* ═══ Lili Avatar & Online Indicators ═══ */
  .lili-avatar {
    width: 44px; height: 44px; object-fit: cover; border-radius: 50%; display: block;
    filter: drop-shadow(0 2px 4px rgba(0,0,0,0.2));
  }

  .online-pulse {
    position: absolute; bottom: 0; right: 0; width: 12px; height: 12px;
    background: #25d366; border-radius: 50%; border: 2px solid rgba(0,0,0,0.4);
    animation: greenPulse 2s ease-in-out infinite;
  }

  .online-indicator {
    display: inline-block; width: 7px; height: 7px; border-radius: 50%;
    background: #25d366; margin-right: 8px;
    animation: greenPulse 2s ease-in-out infinite;
  }

  @keyframes greenPulse {
    0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(37, 211, 102, 0.4); }
    50% { opacity: 0.7; box-shadow: 0 0 0 4px rgba(37, 211, 102, 0); }
  }

  /* ═══ Thank You ═══ */
  .thank-you { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 1rem;
    &__icon { font-size: 3rem; animation: popIn 0.5s cubic-bezier(0.34,1.56,0.64,1); }
    &__link { color: var(--color-highlight-2, #1ccfc9); text-decoration: underline; font-weight: 600; font-size: 0.95rem; transition: opacity 0.2s; &:hover { opacity: 0.8; } }
  }

  /* ═══ Responsive ═══ */
  @media (max-width: 768px) {
    .form-container { padding: 2rem 1.5rem; margin: 1rem; border-radius: 1.5rem; }
    .cta-hero__title { font-size: 1.7rem; }
    .cta-hero__btn { padding: 1rem 1.8rem; font-size: 1.05rem; }
    .choice-screen__title { font-size: 1.5rem; }
    h2 { font-size: 1.4rem; }
  }
  @media (max-width: 480px) {
    .form-container { padding: 1.5rem 1rem; margin: 0.5rem; border-radius: 1.25rem; }
    .cta-hero__title { font-size: 1.4rem; }
    .cta-hero__btn { width: 100%; justify-content: center; padding: 1rem 1.5rem; }
    .choice-btn { padding: 1rem 1.1rem; }
  }
</style>
