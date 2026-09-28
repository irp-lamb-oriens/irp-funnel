<script lang="ts">
  /**
   * ServiceFunnelPanel.svelte — the single centralized shell every destination-
   * service tab (Relocation tours, Immigration advice, Intercultural coaching,
   * Legal advice, Real estate assessment) renders inside.
   *
   * It resolves its funnel copy from lib/serviceFunnelRegistry by `serviceId`,
   * renders the shared modern header chrome (ServiceFunnel), keeps the
   * service-specific value-offer content in the default slot, and exposes a
   * configurable "Book a discovery call" CTA that opens the centralized
   * ServiceIntakeForm for that exact service type. That form uploads through
   * the same formStore + submitScheduling path as HeroForm, so the lead lands
   * in the same consultation pipeline.
   *
   * The form panel is intentionally a dark glass surface (matching the public
   * relocation-tours `.tour__book-form` and HeroForm) so the ServiceIntakeForm's
   * white-on-dark inputs read correctly against the light status-page shell.
   */
  import ServiceFunnel from '../../../components/serviceFunnel/ServiceFunnel.svelte';
  import ServiceIntakeForm from '../../../components/ServiceIntakeForm.svelte';
  import { getServiceFunnel } from '../../../lib/serviceFunnelRegistry.ts';
  import type { ServiceType } from '../../../lib/serviceConfig.ts';

  export let serviceId: string = '';
  export let destinationCountry: string = '';

  // Default CTA label per funnel; can be overridden by the funnel config.
  export let ctaLabel: string = '';

  $: funnel = getServiceFunnel(serviceId);
  $: activeCtaLabel = ctaLabel || funnel?.ctaLabel || 'Book a discovery call';
  // The single service type this funnel collects. ServiceIntakeForm posts the
  // whole formState (including scheduling) to /api/send-hero-consultation, the
  // same endpoint HeroForm uses — so the data lands identically.
  let serviceTypes: ServiceType[] = [];
  $: serviceTypes = funnel ? [funnel.serviceType] : [];

  let formOpen = false;
  function openForm() {
    formOpen = true;
  }
</script>

{#if funnel}
  <ServiceFunnel
    eyebrow={funnel.eyebrow}
    title={funnel.title}
    lead={funnel.lead}
    icon={funnel.icon}
  >
    <slot />
  </ServiceFunnel>

  <div class="sfp__cta">
    {#if !formOpen}
      <button class="sfp__cta-btn" type="button" on:click={openForm}>
        {activeCtaLabel}
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.2"
          aria-hidden="true"
        >
          <path d="M5 12h14M13 6l6 6-6 6" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </button>
      <p class="sfp__cta-note">
        A short form helps us match you to the right {funnel.brand.toLowerCase()} for {destinationCountry || 'your destination'}.
      </p>
    {:else}
      <div class="sfp__form">
        <ServiceIntakeForm serviceTypes={serviceTypes} onBack={() => (formOpen = false)} />
      </div>
    {/if}
  </div>
{/if}

<style lang="scss">
  .sfp__cta {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.9rem;
    margin-top: 2rem;
    text-align: center;
  }

  .sfp__cta-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.85rem 1.7rem;
    border: none;
    border-radius: 12px;
    font-family: var(--font-title, 'Kiona Regular', serif);
    font-size: 0.95rem;
    font-weight: 700;
    color: #fff;
    cursor: pointer;
    background: linear-gradient(135deg, var(--color-highlight-2, #02b5bb) 0%, #02999e 100%);
    box-shadow: 0 14px 34px -14px rgba(var(--color-highlight-2-rgb, 2, 181, 187), 0.7);
    transition: transform 0.18s ease, box-shadow 0.18s ease, filter 0.18s ease;

    &:hover {
      transform: translateY(-2px);
      filter: brightness(1.06);
      box-shadow: 0 18px 42px -16px rgba(var(--color-highlight-2-rgb, 2, 181, 187), 0.8);
    }

    svg {
      width: 17px;
      height: 17px;
    }
  }

  .sfp__cta-note {
    margin: 0;
    max-width: 52ch;
    color: #475569;
    font-size: 0.9rem;
    line-height: 1.5;
  }

  /* Dark glass panel so the ServiceIntakeForm's white-on-dark inputs carry. */
  .sfp__form {
    width: 100%;
    max-width: 640px;
    padding: 2rem 1.75rem;
    border-radius: 1.5rem;
    background:
      radial-gradient(900px 500px at 20% 0%, rgba(var(--color-highlight-2-rgb, 2, 181, 187), 0.14), transparent 60%),
      #0f172a;
    border: 1px solid rgba(255, 255, 255, 0.08);
    box-shadow: 0 24px 60px -28px rgba(15, 23, 42, 0.6);
  }

  @media (prefers-reduced-motion: reduce) {
    .sfp__cta-btn { transition: none; }
  }
</style>