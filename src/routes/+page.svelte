<script lang="ts">
  /**
   * IRP home. Section plan: docs/landing-redesign.md (ported from the ILP
   * landing). Booking logic lives in HeroForm (inside HeroBooking) and is
   * mounted once; every "book" button on the page scrolls back to it.
   * Narration script and cue anchors: docs/narration/SCRIPTS.md.
   */
  import Header from '../components/Header/Header.svelte';
  import Footer from '../components/Footer/Footer.svelte';
  import HeroBooking from '../components/landing/HeroBooking.svelte';
  import ProblemSection from '../components/landing/ProblemSection.svelte';
  import StepsSection from '../components/landing/StepsSection.svelte';
  import ServicesGrid from '../components/landing/ServicesGrid.svelte';
  import LiliBand from '../components/landing/LiliBand.svelte';
  import ParallaxBand from '../components/landing/ParallaxBand.svelte';
  import IncludesSticky from '../components/landing/IncludesSticky.svelte';
  import TimelineBand from '../components/landing/TimelineBand.svelte';
  import WhoWeServe from '../components/landing/WhoWeServe.svelte';
  import CountriesSection from '../components/landing/CountriesSection.svelte';
  import ProofSection from '../components/landing/ProofSection.svelte';
  import FaqSplit from '../components/landing/FaqSplit.svelte';
  import FinalBooking from '../components/landing/FinalBooking.svelte';
  import Narrator from '../components/narration/Narrator.svelte';
  import { IMG, PRINCIPLE } from '../components/landing/content.ts';
</script>

<svelte:head>
  <title>International Relocation Partner | Moving Abroad Made Simple</title>
  <meta name="description" content="Relocation consulting for expats, retirees, digital nomads and returning citizens. International moving, relocation tours, documentation assistance and advice in Costa Rica, Panama, Mexico, Portugal, Spain and Colombia." />
  <meta property="og:type" content="website" />
  <meta property="og:title" content="International Relocation Partner | Relocating Abroad Made Simple" />
  <meta property="og:description" content="Book a 60-minute consultation about the rules for your move. International moving, relocation tours and documentation assistance in six countries." />
  <meta name="twitter:card" content="summary_large_image" />
</svelte:head>

<main id="main-content" class="landing">
  <Header />
  <HeroBooking />
  <ProblemSection />
  <StepsSection />
  <ServicesGrid />
  <LiliBand />
  <ParallaxBand split id="principle" image={IMG.principle} title={PRINCIPLE.title} body={PRINCIPLE.body} mark={PRINCIPLE.mark} />
  <IncludesSticky />
  <TimelineBand />
  <WhoWeServe />
  <CountriesSection />
  <ProofSection />
  <FaqSplit />
  <FinalBooking />
</main>

<Footer />

<Narrator />

<style lang="scss">
  .landing :global(section[id]) { scroll-margin-top: 96px; }
</style>
