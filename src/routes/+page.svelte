<script lang="ts">
  /**
   * IRP home. Scene plan: docs/landing-redesign.md. The hero (HeroForm
   * inside HeroBooking) keeps all booking logic and is mounted once; every
   * section after it is a full-screen scroll scene (components/landing/
   * scene.ts). Pablo's narration (components/narration) moves through the
   * scenes in step with his voice. Every "book" action returns to the hero.
   */
  import Header from '../components/Header/Header.svelte';
  import Footer from '../components/Footer/Footer.svelte';
  import HeroBooking from '../components/landing/HeroBooking.svelte';
  import ProblemScene from '../components/landing/ProblemScene.svelte';
  import HowScene from '../components/landing/HowScene.svelte';
  import ServicesScene from '../components/landing/ServicesScene.svelte';
  import LiliScene from '../components/landing/LiliScene.svelte';
  import PrincipleScene from '../components/landing/PrincipleScene.svelte';
  import IncludesScene from '../components/landing/IncludesScene.svelte';
  import TimelineScene from '../components/landing/TimelineScene.svelte';
  import WhoScene from '../components/landing/WhoScene.svelte';
  import CountriesScene from '../components/landing/CountriesScene.svelte';
  import ReviewsScene from '../components/landing/ReviewsScene.svelte';
  import FaqSplit from '../components/landing/FaqSplit.svelte';
  import FinalScene from '../components/landing/FinalScene.svelte';
  import SceneRail from '../components/landing/SceneRail.svelte';
  import Narrator from '../components/narration/Narrator.svelte';
  import { HOME_CUES } from '../components/narration/narration.ts';

  const stops = HOME_CUES.filter((c) => c.anchor !== 'hero-form').map((c) => ({ id: c.anchor, label: c.label }));
</script>

<svelte:head>
  <title>International Relocation Partner | Moving Abroad Made Simple</title>
  <meta name="description" content="Relocation consulting for expats, retirees, digital nomads and returning citizens. International moving, relocation tours, documentation assistance and advice in Costa Rica, Panama, Mexico, Portugal, Spain and Colombia." />
  <meta property="og:type" content="website" />
  <meta property="og:title" content="International Relocation Partner | Relocating Abroad Made Simple" />
  <meta property="og:description" content="Book a 60-minute consultation about the rules for your move. International moving, relocation tours and documentation assistance in six countries." />
  <meta name="twitter:card" content="summary_large_image" />
  <link rel="preload" href="/landing/land-dots.json" as="fetch" crossorigin="anonymous" />
</svelte:head>

<main id="main-content" class="landing">
  <Header />
  <HeroBooking />
  <ProblemScene />
  <HowScene />
  <ServicesScene />
  <LiliScene />
  <PrincipleScene />
  <IncludesScene />
  <TimelineScene />
  <WhoScene />
  <CountriesScene />
  <ReviewsScene />
  <FaqSplit />
  <FinalScene />
</main>

<Footer />

<SceneRail {stops} />
<Narrator />

<style lang="scss">
  .landing { overflow-x: clip; }
</style>
