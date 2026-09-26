<script lang="ts">
  /**
   * FunnelField.svelte — the agnostic field renderer for service funnels.
   *
   * Maps a declarative ServiceFieldDef (from lib/serviceConfig.ts) to the
   * existing input primitives, extracted from the inline mapping that used to
   * live inside ServiceIntakeForm.svelte. One component renders any field type
   * so a funnel is pure data, never bespoke markup.
   *
   * Props:
   *   field  — the ServiceFieldDef describing this input
   *   value  — the current value (string | string[] | object[] | undefined)
   *   onChange — called with the new value whenever the field changes
   */
  import PlainText from '../systems/inputs/PlainText/PlainText.svelte';
  import Email from '../systems/inputs/Email/Email.svelte';
  import Phone from '../systems/inputs/Phone/Phone.svelte';
  import Country from '../systems/inputs/Country/Country.svelte';
  import Budget from '../systems/inputs/Budget/Budget.svelte';
  import MoveSize from '../systems/inputs/MoveSize/MoveSize.svelte';
  import ImmigrationStatus from '../systems/inputs/ImmigrationStatus/ImmigrationStatus.svelte';
  import IconGridSelector from '../systems/selectors/IconGridSelector/IconGridSelector.svelte';
  import Vehicles from '../systems/inputs/Vehicles/Vehicles.svelte';
  import type { ServiceFieldDef } from '../../lib/serviceConfig.ts';

  export let field: ServiceFieldDef;
  export let value: any = undefined;
  export let onChange: (value: any) => void = () => {};

  // ── Refs for the primitives that expose a bindable button/input element ──
  let nameInput: HTMLInputElement;
  let surnameInput: HTMLInputElement;
  let emailInput: HTMLInputElement;
  let phoneInput: HTMLButtonElement;
  let countryInput: HTMLButtonElement;
  let budgetInput: HTMLButtonElement;
  let sizeInput: HTMLButtonElement;
  let immigrationInput: HTMLButtonElement;

  const str = (v: any): string => (v == null ? '' : String(v));

  function onEnter() {
    // No-op by default; the parent form owns step advancement. Kept as a
    // stable callback so the primitives' onEnter prop is always satisfied.
  }
</script>

<div class="ff">
  {#if field.id === 'originCountry' || field.id === 'destinationCountry'}
    <h2 class="ff__label">{field.label}</h2>
    <Country
      onSelect={(code) => onChange(code || '')}
      defaultCountryCode={str(value)}
      bind:buttonRef={countryInput}
    />

  {:else if field.type === 'country' && field.id === 'nationality'}
    <h2 class="ff__label">{field.label}</h2>
    <Country
      onSelect={(code) => onChange(code || '')}
      defaultCountryCode={str(value)}
    />

  {:else if field.type === 'budget'}
    <h2 class="ff__label">{field.label}</h2>
    <Budget bind:buttonRef={budgetInput} />

  {:else if field.type === 'move-size'}
    <h2 class="ff__label">{field.label}</h2>
    <MoveSize bind:buttonRef={sizeInput} />

  {:else if field.type === 'immigration'}
    <h2 class="ff__label">{field.label}</h2>
    <ImmigrationStatus bind:buttonRef={immigrationInput} />

  {:else if field.type === 'property-from'}
    <h2 class="ff__label">{field.label}</h2>
    <IconGridSelector
      options={[
        { value: 'apartment', label: 'Apartment', iconSrc: '/icons/apartment.svg' },
        { value: 'condo', label: 'Condo', iconSrc: '/icons/condo.svg' },
        { value: 'house', label: 'House', iconSrc: '/icons/house.svg' },
        { value: 'storage', label: 'Storage', iconSrc: '/icons/storage.svg' },
      ]}
      bind:selectedValue={value}
      on:update={(e) => onChange(e.detail)}
    />

  {:else if field.type === 'property-to'}
    <h2 class="ff__label">{field.label}</h2>
    <IconGridSelector
      options={[
        { value: 'apartment', label: 'Apartment', iconSrc: '/icons/apartment.svg' },
        { value: 'condo', label: 'Condo', iconSrc: '/icons/condo.svg' },
        { value: 'house', label: 'House', iconSrc: '/icons/house.svg' },
        { value: 'storage', label: 'Storage', iconSrc: '/icons/storage.svg' },
      ]}
      bind:selectedValue={value}
      on:update={(e) => onChange(e.detail)}
    />

  {:else if field.type === 'vehicles'}
    <h2 class="ff__label">{field.label}</h2>
    <Vehicles bind:vehicles={value} onUpdate={(v) => onChange(v)} />

  {:else if field.id === 'name'}
    <h2 class="ff__label">{field.label}</h2>
    <PlainText
      label={field.label}
      placeholder={field.placeholder || 'First name'}
      bind:value={value}
      onChange={(v) => onChange(v)}
      onEnter={() => surnameInput?.focus()}
      bind:inputElement={nameInput}
    />

  {:else if field.id === 'surname'}
    <h2 class="ff__label">{field.label}</h2>
    <PlainText
      label={field.label}
      placeholder={field.placeholder || 'Last name'}
      bind:value={value}
      onChange={(v) => onChange(v)}
      onEnter={onEnter}
      bind:inputElement={surnameInput}
    />

  {:else if field.type === 'email'}
    <h2 class="ff__label">{field.label}</h2>
    <Email
      label={field.label}
      placeholder={field.placeholder || 'you@email.com'}
      bind:value={value}
      onChange={(v) => onChange(v)}
      onEnter={onEnter}
      bind:inputElement={emailInput}
    />

  {:else if field.type === 'phone'}
    <h2 class="ff__label">{field.label}</h2>
    <Phone
      bind:value={value}
      onUpdate={(v) => onChange(v)}
      onEnter={onEnter}
      bind:inputElement={phoneInput}
    />

  {:else if field.type === 'options'}
    <h2 class="ff__label">{field.label}</h2>
    <div class="ff__options">
      {#each field.options || [] as opt (opt.value)}
        <button
          type="button"
          class="ff__opt"
          class:ff__opt--selected={str(value) === opt.value}
          on:click={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      {/each}
    </div>

  {:else if field.type === 'notes'}
    <h2 class="ff__label">{field.label}</h2>
    <textarea
      class="ff__notes"
      placeholder="Add any details…"
      value={str(value)}
      on:input={(e) => onChange((e.target as HTMLTextAreaElement).value)}
    ></textarea>

  {:else}
    <h2 class="ff__label">{field.label}</h2>
    <PlainText
      label={field.label}
      placeholder={field.placeholder || ''}
      value={str(value)}
      onChange={(v) => onChange(v)}
      onEnter={onEnter}
    />
  {/if}
</div>

<style lang="scss">
  .ff {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    width: 100%;
  }

  .ff__label {
    font-size: 1.15rem;
    font-weight: 700;
    color: #0f172a;
    margin: 0;
    line-height: 1.3;
  }

  .ff__options {
    display: grid;
    grid-template-columns: 1fr;
    gap: 0.6rem;
  }

  .ff__opt {
    padding: 0.85rem 1rem;
    border-radius: 12px;
    cursor: pointer;
    text-align: left;
    background: #f8fafc;
    border: 1px solid rgba(0, 0, 0, 0.1);
    color: #0f172a;
    font-size: 0.95rem;
    font-weight: 600;
    transition: border-color 0.15s, background 0.15s;

    &:hover {
      background: #f1f5f9;
    }

    &--selected {
      border-color: var(--color-highlight-2, #02b5bb);
      background: rgba(2, 181, 187, 0.08);
      color: #0a7e82;
    }
  }

  .ff__notes {
    width: 100%;
    min-height: 100px;
    resize: vertical;
    border-radius: 12px;
    padding: 0.85rem 1rem;
    background: #f8fafc;
    border: 1px solid rgba(0, 0, 0, 0.1);
    color: #0f172a;
    font-family: inherit;
    font-size: 0.95rem;

    &:focus {
      outline: none;
      border-color: var(--color-highlight-2, #02b5bb);
      box-shadow: 0 0 0 3px rgba(2, 181, 187, 0.12);
    }
  }
</style>