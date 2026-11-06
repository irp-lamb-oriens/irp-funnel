<script lang="ts">
  export let heroTitle: string;
  export let heroUrl: string | undefined = undefined;
  export let heroSubTitle: string | undefined = undefined;
  /** Optional small label above the hero title (new; omitted by default). */
  export let heroEyebrow: string | undefined = undefined;
  export let ctaTitle: string = "Contact us & Get a free Relocating consultation";
  export let ctaSubtitle: string = "Choose the best consultation company for your relocation";
  export let ctaPrimary: { label: string; href: string } = { label: "Book a consultation", href: "/consultation" };
  export let ctaSecondary: { label: string; href: string } = { label: "Contact Us", href: "/contact-us" };

  import CTAButton from "../Header/CTAButton.svelte";
  import HeroSection from "../HeroSection.svelte";
  import "./country-layout.scss";
</script>

<HeroSection text={heroTitle} url={heroUrl} subtitle={heroSubTitle} eyebrow={heroEyebrow} />
<section class="country-content">
  <slot />
</section>
<section class="country-cta" aria-labelledby="country-cta-title">
  <div class="cta-content">
    <div class="cta-copy">
      <p class="cta-eyebrow">Free consultation</p>
      <h2 id="country-cta-title">{ctaTitle}</h2>
      <p class="cta-sub">{ctaSubtitle}</p>
    </div>
    <div class="button-row">
      <CTAButton trigger={true} label={ctaPrimary.label} href={ctaPrimary.href} variant="primary" />
      <CTAButton label={ctaSecondary.label} href={ctaSecondary.href} variant="secondary-inverted" />
    </div>
  </div>
</section>
