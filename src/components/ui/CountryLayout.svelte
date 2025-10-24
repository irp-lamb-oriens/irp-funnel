<script lang="ts">
  export let heroTitle: string;
  export let heroUrl: string | undefined = undefined;
  export let heroSubTitle: string | undefined = undefined;
  export let ctaTitle: string = "Contact us & Get a free Relocating consultation";
  export let ctaSubtitle: string = "Choose the best consultation company for your relocation";
  export let ctaPrimary: { label: string; href: string } = { label: "Schedule Consultation", href: "/consultation" };
  export let ctaSecondary: { label: string; href: string } = { label: "Contact Us", href: "/contact-us" };

  import CTAButton from "../Header/CTAButton.svelte";
  import HeroSection from "../HeroSection.svelte";
  import "./country-layout.scss";
</script>

<HeroSection text={heroTitle} url={heroUrl} subtitle={heroSubTitle} />
<section class="country-content">
  <slot />
</section>
<section class="country-cta">
  <div class="cta-content">
    <h2>{ctaTitle}</h2>
    <div class="button-row">
      <CTAButton label={ctaPrimary.label} href={ctaPrimary.href} variant="primary" />
      <CTAButton label={ctaSecondary.label} href={ctaSecondary.href} variant="secondary-inverted" />
    </div>
    <h6>{ctaSubtitle}</h6>
  </div>
</section>
