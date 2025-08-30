<script lang="ts">
  export let heroTitle: string;
  export let ctaTitle: string = "Contact us & Get a free moving consultation";
  export let ctaSubtitle: string = "Choose the best moving company for your relocation";
  export let ctaPrimary: { label: string; href: string } = { label: "Schedule Consultation", href: "/consultation" };
  export let ctaSecondary: { label: string; href: string } = { label: "Contact Us", href: "/contact-us" };

  import CTAButton from "../Header/CTAButton.svelte";
  import "./country-layout.scss";
</script>

<section class="country-hero">
  <h1>{heroTitle}</h1>
</section>
<section class="country-content">
  <slot />
</section>
<section class="country-cta">
  <div class="cta-content">
    <h6>{ctaSubtitle}</h6>
    <h2>{ctaTitle}</h2>
    <div class="button-row">
      <CTAButton label={ctaPrimary.label} href={ctaPrimary.href} variant="primary" />
      <CTAButton label={ctaSecondary.label} href={ctaSecondary.href} variant="secondary" />
    </div>
  </div>
</section>
