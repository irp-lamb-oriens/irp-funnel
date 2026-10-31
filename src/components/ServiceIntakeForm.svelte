<script lang="ts">
  import { onMount, onDestroy, tick } from 'svelte';
  import PlainText from './systems/inputs/PlainText/PlainText.svelte';
  import Email from './systems/inputs/Email/Email.svelte';
  import Phone from './systems/inputs/Phone/Phone.svelte';
  import Country from './systems/inputs/Country/Country.svelte';
  import Calendar from './systems/inputs/Calendar/Calendar.svelte';
  import IconButton from './systems/buttons/IconButton/IconButton.svelte';
  import Budget from './systems/inputs/Budget/Budget.svelte';
  import MoveSize from './systems/inputs/MoveSize/MoveSize.svelte';
  import ImmigrationStatus from './systems/inputs/ImmigrationStatus/ImmigrationStatus.svelte';
  import IconGridSelector from './systems/selectors/IconGridSelector/IconGridSelector.svelte';
  import Vehicles from './systems/inputs/Vehicles/Vehicles.svelte';
  import StepperIndicator from './StepperIndicator.svelte';
  import store from './store.js';
  import { formState, updateField } from './systems/inputs/Calendar/formStore.js';
  import { submitScheduling } from './systems/inputs/Calendar/submitSchedule.js';
  import { getAttribution } from '../lib/attribution.ts';
  import { budgetStore } from './systems/inputs/Budget/store.js';
  import { moveSizeStore } from './systems/inputs/MoveSize/store.js';
  import { immigrationStatusStore } from './systems/inputs/ImmigrationStatus/store.js';
  import {
    fetchServiceConfig,
    deriveServiceCategory,
    evaluateCondition,
    FIELD_EQUIVALENCE_GROUPS,
    equivalentFieldIds,
    type ServiceConfig,
    type ServiceFieldDef,
    type ServiceType,
  } from '../lib/serviceConfig.js';

  export let serviceTypes: ServiceType[] = ['relocation_tour'];
  /** When embedded (e.g. inside HeroForm), called to leave the form entirely. */
  export let onBack: (() => void) | undefined = undefined;

  type Step =
    | { kind: 'field'; field: ServiceFieldDef }
    | { kind: 'person'; idx: number }
    | { kind: 'calendar' }
    | { kind: 'done' };

  let config: ServiceConfig | null = null;
  let steps: Step[] = [];
  let stepIndex = 0;
  let isLoading = true;
  let loadError = '';
  let submitting = false;
  let submitError = '';
  let calendarLink = '';
  let hangoutLink = '';

  let emailValid = false;
  let phoneValid = false;
  let nameInput: HTMLInputElement;
  let surnameInput: HTMLInputElement;
  let emailInput: HTMLInputElement;
  let phoneInput: HTMLButtonElement;
  let destinationCountryInput: HTMLButtonElement;
  let originCountryInput: HTMLButtonElement;
  let budgetInput: HTMLButtonElement;
  let sizeInput: HTMLButtonElement;
  let immigrationInput: HTMLButtonElement;

  $: current = steps[stepIndex];

  // ─── Two-level stepper derivation ────────────────────────────────────────
  // Level 1: the ordered, unique service labels present in the live config
  // (e.g. ["International Shipping", "Legal advice"]) so multi-service leads
  // can tell which questionnaire is on screen.
  // Level 2: the step counter is section-scoped. "Step X of Y" counts only the
  // steps inside the current service's questionnaire, not across every chosen
  // service. Y is inferred by grouping the flat step list by serviceLabel, so
  // the user sees a small, honest number instead of "3 of 46".
  $: serviceLabels = deriveServiceLabels();
  $: activeServiceIndex = deriveActiveServiceIndex();

  // Indices of `steps` that belong to the current step's service section.
  $: sectionStepIndices = steps
    .map((s, i) => (stepLabel(s) === stepLabel(current) ? i : -1))
    .filter((i) => i >= 0);
  // 1-based position within the current section, plus the section's size.
  $: sectionPosition = sectionStepIndices.indexOf(stepIndex) + 1;
  $: sectionSize = sectionStepIndices.length;

  // Shared identity and scheduling fields carry no serviceLabel (the backend
  // marks them as cross-service), so give them a stable section name of their
  // own. This keeps the level-1 stepper coherent instead of silently grouping
  // every shared field into an empty phantom section.
  const IDENTITY_IDS = new Set(['name', 'surname', 'email', 'phone']);
  const IDENTITY_SECTION = 'Your details';
  const SCHEDULE_SECTION = 'Schedule call';

  function sectionLabelForField(f: ServiceFieldDef): string {
    if (f.serviceLabel) return f.serviceLabel;
    if (IDENTITY_IDS.has(f.id)) return IDENTITY_SECTION;
    if (f.type === 'calendar') return SCHEDULE_SECTION;
    return '';
  }

  function stepLabel(step: Step | undefined): string {
    if (!step) return '';
    if (step.kind === 'field' && step.field) return sectionLabelForField(step.field);
    if (step.kind === 'person') {
      const pf = visibleFields().find((f) => f.type === 'people');
      return pf ? sectionLabelForField(pf) : '';
    }
    if (step.kind === 'calendar') {
      const cf = visibleFields().find((f) => f.type === 'calendar');
      return cf ? sectionLabelForField(cf) : SCHEDULE_SECTION;
    }
    return '';
  }

  function deriveServiceLabels(): string[] {
    const labels: string[] = [];
    for (const f of visibleFields()) {
      const l = sectionLabelForField(f);
      if (l && !labels.includes(l)) labels.push(l);
    }
    return labels;
  }

  function deriveActiveServiceIndex(): number {
    const label = stepLabel(current);
    if (!label) return 0;
    const idx = serviceLabels.indexOf(label);
    return idx >= 0 ? idx : 0;
  }

  // ─── Early opt-in lead capture ──────────────────────────────────────────
  // Mirrors HeroForm: as soon as identity (name + surname + email) is complete,
  // save the prospect to the `captures` collection so the dashboard sees the
  // lead even if they abandon before scheduling a call. Fire-and-forget; a
  // failure never blocks the questionnaire.
  let leadCaptured = false;

  async function captureLead() {
    if (leadCaptured) return;
    const email = ($formState.email || '').trim();
    if (!email) return;
    leadCaptured = true;
    try {
      await fetch(`${$store.apiURL()}/api/capture-data`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          name: ($formState.name || '').trim(),
          surname: ($formState.surname || '').trim(),
          serviceCategory: deriveServiceCategory(serviceTypes),
          source: 'relocation-tours-email-capture',
          timestamp: new Date().toISOString(),
          attribution: getAttribution(),
        }),
      });
    } catch (err) {
      console.error('Lead capture failed:', err);
      // Allow a retry on the next advance so a transient network error does not
      // permanently lose the lead.
      leadCaptured = false;
    }
  }

  // Mirror the original dropdown stores into formState so submitScheduling()
  // (which serializes formState) picks them up.
  const unsubBudget = budgetStore.subscribe((v) => updateField(v || '', 'budget'));
  const unsubSize = moveSizeStore.subscribe((v) => updateField(v || '', 'size'));
  const unsubImmigration = immigrationStatusStore.subscribe((v) =>
    updateField(v || '', 'immigrationStatus'),
  );
  onDestroy(() => {
    unsubBudget();
    unsubSize();
    unsubImmigration();
  });

  function hasValue(v: unknown): boolean {
    if (v === null || v === undefined) return false;
    if (typeof v === 'string') return v.trim() !== '';
    if (Array.isArray(v)) return v.length > 0;
    return true;
  }

  /**
   * A field is skipped when a *sibling* in its equivalence group already holds
   * a value (e.g. destinationCountry filled ⇒ coachingDestination not asked).
   * The field itself is never dropped by this check.
   */
  function isEquivalentFilled(id: string): boolean {
    const group = equivalentFieldIds(id);
    if (group.length <= 1) return false;
    return group.some((gid) => gid !== id && hasValue(($formState as any)[gid]));
  }

  /** Mirror a filled equivalence-group member into its still-empty siblings. */
  function mirrorEquivalentFields() {
    for (const group of FIELD_EQUIVALENCE_GROUPS) {
      const filledId = group.find((gid) => hasValue(($formState as any)[gid]));
      if (!filledId) continue;
      const filledValue = ($formState as any)[filledId];
      for (const gid of group) {
        if (!hasValue(($formState as any)[gid])) {
          updateField(filledValue, gid as any);
        }
      }
    }
  }

  function visibleFields(): ServiceFieldDef[] {
    if (!config) return [];
    return config.fields.filter(
      (f) =>
        evaluateCondition(f.showWhen, $formState as unknown as Record<string, any>) &&
        !isEquivalentFilled(f.id),
    );
  }

  function buildSteps(): Step[] {
    const out: Step[] = [];
    for (const f of visibleFields()) {
      if (f.type === 'people') {
        const count = Math.max(1, Math.min(3, Number($formState.partySize) || 1));
        for (let i = 0; i < count; i++) out.push({ kind: 'person', idx: i });
      } else if (f.type === 'calendar') {
        out.push({ kind: 'calendar' });
      } else {
        out.push({ kind: 'field', field: f });
      }
    }
    return out;
  }

  function rebuildSteps() {
    steps = buildSteps();
    if (stepIndex >= steps.length) stepIndex = Math.max(0, steps.length - 1);
  }

  function ensureTravelers(count: number) {
    const cur = $formState.travelers || [];
    const next = Array.from({ length: count }, (_, i) => ({
      name: cur[i]?.name || '',
      surname: cur[i]?.surname || '',
    }));
    updateField(next, 'travelers');
  }

  function setTraveler(idx: number, key: 'name' | 'surname', value: string) {
    const next = ($formState.travelers || []).map((t, i) =>
      i === idx ? { ...t, [key]: value } : t,
    );
    updateField(next, 'travelers');
  }

  function onPartySize(value: string) {
    updateField(value, 'partySize');
    const count = Math.max(1, Math.min(3, Number(value) || 1));
    ensureTravelers(count);
    if (count !== 3) updateField('', 'roomPreference');
    rebuildSteps();
  }

  async function next() {
    const step = current;
    if (step?.kind === 'field') {
      const v = ($formState as any)[step.field.id];
      if (step.field.required && !String(v || '').trim()) return;
      // The field is committed: propagate it to its equivalence siblings so a
      // later question in the same group (e.g. coachingDestination) gets the
      // value without being re-asked.
      mirrorEquivalentFields();
    }
    if (step?.kind === 'person') {
      const t = $formState.travelers?.[step.idx];
      if (!t?.name?.trim() || !t?.surname?.trim()) return;
    }
    // Identity is now first in every service config, so the email step is
    // guaranteed to have a valid address by the time it advances. Capture the
    // opt-in lead here so it reaches the dashboard before the tour details.
    if (step?.kind === 'field' && step.field.id === 'email' && emailValid) {
      void captureLead();
    }
    if (stepIndex >= steps.length - 1) {
      await submitForm();
      return;
    }
    stepIndex++;
    await tick();
  }

  function back() {
    if (stepIndex > 0) {
      stepIndex--;
      return;
    }
    onBack?.();
  }

  async function submitForm() {
    submitting = true;
    submitError = '';
    try {
      const response = await submitScheduling();
      if (response?.calendarLink) {
        calendarLink = response.calendarLink;
        hangoutLink = response.hangoutLink;
      }
      steps = [...steps, { kind: 'done' }];
      stepIndex = steps.length - 1;
    } catch (e: any) {
      submitError = e?.message || 'Unable to submit.';
    } finally {
      submitting = false;
    }
  }

  onMount(async () => {
    try {
      config = await fetchServiceConfig($store.apiURL(), serviceTypes);
      updateField([...serviceTypes], 'serviceCategories');
      updateField(deriveServiceCategory(serviceTypes), 'serviceCategory');
      ensureTravelers(Math.max(1, Math.min(3, Number($formState.partySize) || 1)));
      // Pre-filled values (e.g. destinationCountry set by HeroForm before this
      // component mounts) must propagate to equivalence siblings so those
      // questions are dropped from the step list on the first build.
      mirrorEquivalentFields();
      rebuildSteps();
    } catch (e: any) {
      loadError = e?.message || 'Unable to load the form.';
    } finally {
      isLoading = false;
    }
  });
</script>

<div class="intake">
  {#if isLoading}
    <p class="intake__note">Loading…</p>
  {:else if loadError}
    <p class="intake__note intake__note--error">{loadError}</p>
  {:else if current?.kind === 'done'}
    <div class="intake__done">
      <div class="intake__done-icon">✓</div>
      <h2>Thank You!</h2>
      <p>An email has been sent to your inbox.</p>
      {#if calendarLink}
        <a class="intake__link" href={calendarLink} target="_blank" rel="noopener noreferrer">View on Google Calendar</a>
      {/if}
      {#if hangoutLink}
        <a class="intake__link" href={hangoutLink} target="_blank" rel="noopener noreferrer">Join Meeting</a>
      {/if}
    </div>
  {:else}
    <div class="intake__step">
      <StepperIndicator
        {serviceLabels}
        {activeServiceIndex}
        stepIndex={Math.max(sectionPosition - 1, 0)}
        stepCount={sectionSize}
      />

      {#if stepIndex > 0 || onBack}
        <div class="intake__back-bar">
          <button class="intake__back" on:click={back}>← Back</button>
        </div>
      {/if}

      {#if current?.kind === 'field'}
        {@const f = current.field}

        {#if f.id === 'originCountry'}
          <h2>{f.label}</h2>
          <Country onSelect={(code) => updateField(code || '', 'originCountry')} bind:buttonRef={originCountryInput} />

        {:else if f.id === 'destinationCountry'}
          <h2>{f.label}</h2>
          <Country onSelect={(code) => updateField(code || '', 'destinationCountry')} bind:buttonRef={destinationCountryInput} />

        {:else if f.type === 'country'}
          <h2>{f.label}</h2>
          <Country onSelect={(code) => updateField(code || '', f.id as any)} defaultCountryCode={String(($formState as any)[f.id] ?? '')} />

        {:else if f.type === 'budget'}
          <h2>{f.label}</h2>
          <Budget bind:buttonRef={budgetInput} />

        {:else if f.type === 'move-size'}
          <h2>{f.label}</h2>
          <MoveSize bind:buttonRef={sizeInput} />

        {:else if f.type === 'immigration'}
          <h2>{f.label}</h2>
          <ImmigrationStatus bind:buttonRef={immigrationInput} />

        {:else if f.type === 'property-from'}
          <h2>{f.label}</h2>
          <IconGridSelector
            options={[
              { value: 'apartment', label: 'Apartment', iconSrc: '/icons/apartment.svg' },
              { value: 'condo', label: 'Condo', iconSrc: '/icons/condo.svg' },
              { value: 'house', label: 'House', iconSrc: '/icons/house.svg' },
              { value: 'storage', label: 'Storage', iconSrc: '/icons/storage.svg' },
            ]}
            bind:selectedValue={$formState.propertyTypeFrom}
            on:update={(e) => updateField(e.detail, 'propertyTypeFrom')}
          />

        {:else if f.type === 'property-to'}
          <h2>{f.label}</h2>
          <IconGridSelector
            options={[
              { value: 'apartment', label: 'Apartment', iconSrc: '/icons/apartment.svg' },
              { value: 'condo', label: 'Condo', iconSrc: '/icons/condo.svg' },
              { value: 'house', label: 'House', iconSrc: '/icons/house.svg' },
              { value: 'storage', label: 'Storage', iconSrc: '/icons/storage.svg' },
            ]}
            bind:selectedValue={$formState.propertyTypeTo}
            on:update={(e) => updateField(e.detail, 'propertyTypeTo')}
          />

        {:else if f.type === 'vehicles'}
          <h2>{f.label}</h2>
          <p class="intake__sub">Tell us about the vehicles you are shipping.</p>
          <Vehicles bind:vehicles={$formState.vehicles} onUpdate={(v) => updateField(v, 'vehicles')} />

        {:else if f.id === 'name'}
          <h2>{f.label}</h2>
          <PlainText label={f.label} placeholder={f.placeholder || 'First name'} bind:value={$formState.name} onChange={(v) => updateField(v, 'name')} onEnter={() => surnameInput?.focus()} bind:inputElement={nameInput} />

        {:else if f.id === 'surname'}
          <h2>{f.label}</h2>
          <PlainText label={f.label} placeholder={f.placeholder || 'Last name'} bind:value={$formState.surname} onChange={(v) => updateField(v, 'surname')} onEnter={next} bind:inputElement={surnameInput} />

        {:else if f.type === 'email'}
          <h2>{f.label}</h2>
          <Email label={f.label} placeholder={f.placeholder || 'you@email.com'} bind:value={$formState.email} onChange={(v) => updateField(v, 'email')} onEnter={next} bind:inputElement={emailInput} bind:valid={emailValid} />

        {:else if f.type === 'phone'}
          <h2>{f.label}</h2>
          <p class="intake__sub">(optional)</p>
          <Phone bind:value={$formState.phone} onUpdate={(v) => updateField(v, 'phone')} onEnter={next} bind:inputElement={phoneInput} bind:isValid={phoneValid} />

        {:else if f.type === 'options'}
          <h2>{f.label}</h2>
          <div class="intake__options">
            {#each f.options || [] as opt (opt.value)}
              <button
                class="intake__opt"
                class:intake__opt--selected={String(($formState as any)[f.id]) === opt.value}
                on:click={() => (f.id === 'partySize' ? onPartySize(opt.value) : updateField(opt.value, f.id as any))}
              >
                {opt.label}
              </button>
            {/each}
          </div>

        {:else if f.type === 'notes'}
          <h2>{f.label}</h2>
          <textarea class="intake__notes" placeholder="Add any details…" value={String(($formState as any)[f.id] ?? '')} on:input={(e) => updateField((e.target as HTMLTextAreaElement).value, f.id as any)}></textarea>

        {:else}
          <h2>{f.label}</h2>
          <PlainText label={f.label} placeholder={f.placeholder || ''} value={String(($formState as any)[f.id] ?? '')} onChange={(v) => updateField(v, f.id as any)} onEnter={next} />
        {/if}

        <div class="intake__actions">
          <IconButton src="./icons/right-arrow.svg" callback={next} loading={submitting} />
        </div>

      {:else if current?.kind === 'person'}
        {@const p = current}
        {@const t = $formState.travelers?.[p.idx] || { name: '', surname: '' }}
        <h2>Traveler {p.idx + 1}</h2>
        <PlainText label="First name" placeholder="First name" value={t.name} onChange={(v) => setTraveler(p.idx, 'name', v)} onEnter={() => surnameInput?.focus()} />
        <PlainText label="Last name" placeholder="Last name" value={t.surname} bind:inputElement={surnameInput} onChange={(v) => setTraveler(p.idx, 'surname', v)} onEnter={next} />
        <div class="intake__actions">
          <IconButton src="./icons/right-arrow.svg" callback={next} loading={submitting} />
        </div>

      {:else if current?.kind === 'calendar'}
        <h2>Choose your call time</h2>
        <Calendar />
        <div class="intake__actions">
          <IconButton src="./icons/right-arrow.svg" callback={submitForm} loading={submitting} />
        </div>
      {/if}

      {#if submitError}
        <p class="intake__note intake__note--error">{submitError}</p>
      {/if}
    </div>
  {/if}
</div>

<style lang="scss">
  .intake {
    width: 100%;
    max-width: 560px;
    margin: 0 auto;
    color: #fff;
  }
  .intake__step { display: flex; flex-direction: column; gap: 1.25rem; }
  .intake__back-bar { display: flex; justify-content: flex-start; margin-bottom: 0.25rem; }
  .intake__back {
    background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
    color: rgba(255,255,255,0.7); padding: 0.4rem 0.9rem; border-radius: 0.75rem;
    cursor: pointer; font-size: 0.8rem; font-weight: 600;
    &:hover { background: rgba(255,255,255,0.1); color: #fff; }
  }
  h2 { font-size: 1.6rem; line-height: 1.2; margin: 0; }
  .intake__sub { color: rgba(255,255,255,0.6); margin: -0.5rem 0 0; }
  .intake__options { display: grid; grid-template-columns: 1fr; gap: 0.75rem; }
  .intake__opt {
    padding: 1rem 1.25rem; border-radius: 1rem; cursor: pointer; text-align: left;
    background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.12);
    color: #fff; font-size: 1rem; transition: all 0.2s ease;
    &:hover { background: rgba(255,255,255,0.1); }
    &--selected {
      border-color: var(--color-highlight-2, #02b5bb);
      background: rgba(var(--color-highlight-2-rgb, 2,181,187), 0.15);
    }
  }
  .intake__notes {
    width: 100%; min-height: 110px; resize: vertical; border-radius: 1rem; padding: 1rem;
    background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: #fff;
    &:focus { outline: none; border-color: rgba(255,255,255,0.3); }
  }
  .intake__actions { display: flex; justify-content: flex-end; margin-top: 0.5rem; }
  .intake__note { color: #cbd5e1; }
  .intake__note--error { color: #fda4a4; }
  .intake__done { text-align: center; display: flex; flex-direction: column; align-items: center; gap: 0.75rem; }
  .intake__done-icon {
    width: 56px; height: 56px; border-radius: 50%; display: flex; align-items: center; justify-content: center;
    background: rgba(16,185,129,0.15); border: 2px solid rgba(16,185,129,0.4); color: #10b981; font-size: 1.6rem;
  }
  .intake__link { color: var(--color-highlight-2, #1ccfc9); text-decoration: underline; }
</style>