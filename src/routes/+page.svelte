<script lang="ts">
  import { onMount } from 'svelte';
  import Header from '../components/Header/Header.svelte';
  import Footer from '../components/Footer/Footer.svelte';
  import HeroBanner from '../components/HeroBanner.svelte';
  import SpecializationSection from '../components/SpecializationSection.svelte';
  import RelocationPhilosophySection from '../components/RelocationPhilosophySection.svelte';
  import ContactCTASection from '../components/ContactCTASection.svelte';
  import TestimonialsSection from '../components/TestimonialsSection.svelte';
  import MovingProcessSection from '../components/MovingProcessSection.svelte';
  import LatestNewsSection from '../components/LatestNewsSection.svelte';
  import FAQSection from '../components/FAQSection.svelte';
  import ContactSection from '../components/ContactSection.svelte';
  import './+page.scss';
    import ImageGrid from '../components/systems/wrappers/ImageGrid/ImageGrid.svelte';
    import SoftTitle from '../components/SoftTitle/SoftTitle.svelte';
    import HeroForm from '../components/HeroForm.svelte';

  // FAQ data
  const moreFaqs = [
    // {
    //   question: "Does my project include insurance? Or am I protected against loss or damage during the project?",
    //   answer: "Providing insurance for your project is an additional service we offer. Please contact one of our Consulting Specialists for information about the different policies available."
    // },
    {
      question: "When do I have to confirm the service with IRP?",
      answer: "We recommend confirming with 6 months in advance to ensure availability."
    },
    {
      question: "How can I track my project?",
      answer: "Absolutely. When your service is booked, we will create a Timeline System for your project. This application will allow us to show you the entire process step by step, including dates, descriptions, comments, documents, and tasks. We will send the instructions through email. <strong>(Available only for our comprehensive consulting services)</strong>"
    },
    {
      question: "How can I confirm my consulting service with International Relocation Partner?",
      answer: "You can sign and confirm your project in our online Project Planner.<br>We create a custom-tailored Project Planner for each of our customers with a comprehensive estimate of the costs, rules, and regulations. This online document has the option to confirm and accept."
    },
    {
      question: "Does IRP require a deposit payment? What type of payment method do you accept?",
      answer: "Yes, we do require an initial payment. We take wire transfer payments only, for which you will receive an invoice with our bank information. For additional assistance with payment methods, please contact our Consulting Specialist."
    },
    {
      question: "How long does it take for my project documentation to be delivered or to arrive at my destination?",
      answer: "The total time it takes for documents to get from point A to point B can vary depending on different factors, such as the specific route and processing times. It can take anywhere from 15 up to 45 days.<br>We can provide you with an estimated time of project completion for your documentation,<strong> please contact our Consulting Specialist.</strong>"
    },
    {
      question: "How long does it take for customs to clear my documentation?",
      answer: "It takes approximately 1 to 10 weeks, depending on the destination country's rules and requirements. <strong>Please contact our Consulting Specialist for more information.</strong>"
    },
    {
      question: "What happens if the scope of my project changes from what was estimated in the proposal?",
      answer: "We will notify you if the scope of your project is smaller or larger than expected. You can then decide how to proceed. The final bill will be adjusted to the actual scope of the project."
    },
    // {
    //   question: "Do you include materials in your international consulting proposal?",
    //   answer: "We offer a variety of services that may include all necessary materials. This is an option, and we ask our customers to confirm if this service is available in your local area and for your specific project."
    // }
  ];
  const faqs = [
    {
      question: "How can I confirm my consulting service with International Relocation Partner?",
      answer: "You can sign and confirm your project in our online Project Planner.<br>We create a custom-tailored Project Planner for each of our customers with a comprehensive estimate of the international project costs, rules, and regulations. This online document has the option to confirm and accept."
    },
    {
      question: "Does IRP require a deposit payment? What type of payment method do you accept?",
      answer: "Yes, we do require an initial payment. We take wire transfer payments only, for which you will receive an invoice with our bank information. For additional assistance with payment methods, please contact our Consulting Specialist."
    },
    {
      question: "How long does it take for my project documentation to be delivered or to arrive at my destination?",
      answer: "The total time it takes for documents to get from point A to point B can vary depending on different factors, such as the specific route and processing times. It can take anywhere from 15 up to 45 days.<br>We can provide you with an estimated time of project completion for your documentation,<strong> please contact our Consulting Specialist.</strong>"
    }
  ];

  // Custom scroll — easeOutExpo: fast start, then a long exponential
  // deceleration that asymptotically arrives at the target for a
  // cinematic, butter-soft landing. Duration is longer so the tail-off
  // is clearly visible rather than compressed.
  //
  // targetY is measured ONCE after the layout is stable (post window.onload)
  // so images/sections above the form are fully rendered before we sample
  // the offset. Per-frame re-evaluation is intentionally avoided because a
  // mid-animation layout shift would cause a jump discontinuity in the
  // eased curve (startY is fixed; recomputing distance mid-flight = glitch).
  function smoothScrollTo(targetY: number, duration = 2800) {
    const startY = window.scrollY;
    const distance = targetY - startY;
    let startTime: number | null = null;
    let cancelled = false;

    // Any deliberate user gesture cancels the programmatic scroll immediately.
    // NOTE: 'wheel' is intentionally excluded — it fires from our own
    // window.scrollTo() calls on desktop (macOS inertia), which would
    // cancel the animation before it finishes. pointerdown / touchstart /
    // keydown only fire from real human input.
    const cancel = () => { cancelled = true; cleanup(); };
    const cleanup = () => {
      window.removeEventListener('pointerdown', cancel, { capture: true } as any);
      window.removeEventListener('touchstart',  cancel, { capture: true } as any);
      window.removeEventListener('keydown',     cancel, { capture: true } as any);
    };
    window.addEventListener('pointerdown', cancel, { capture: true });
    window.addEventListener('touchstart',  cancel, { passive: true, capture: true });
    window.addEventListener('keydown',     cancel, { capture: true });

    // Starts at full speed, decelerates exponentially — very soft finish.
    function easeOutExpo(t: number): number {
      return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t);
    }

    function step(timestamp: number) {
      if (cancelled) return;
      if (startTime === null) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const progress = Math.min(elapsed / duration, 1);
      window.scrollTo(0, startY + distance * easeOutExpo(progress));
      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        cleanup(); // animation finished naturally — remove listeners
      }
    }

    requestAnimationFrame(step);
  }

  // Measure the hero-form's position and trigger the scroll.
  // Called only after the layout is guaranteed stable (window.onload or
  // equivalent — all images above the form are fully loaded and rendered).
  function triggerHeroScroll() {
    const el = document.getElementById('hero-form-container');
    if (!el) return;
    // One extra rAF after load to let the browser finish its final layout pass
    // before we sample getBoundingClientRect — this is what causes the last
    // few pixels of jitter when relying purely on the load event timestamp.
    requestAnimationFrame(() => {
      const targetY = el.getBoundingClientRect().top + window.scrollY;
      // Already within 120 px — user scrolled or anchor handled it; skip.
      if (Math.abs(window.scrollY - targetY) < 120) return;
      smoothScrollTo(targetY);
    });
  }

  // Auto-scroll to the hero form once the page is fully loaded so the CTA
  // is always front-and-center regardless of where the visitor lands.
  //
  // Race-condition guards:
  //  1. Hash guard — if the URL already targets #hero-form (e.g. from the
  //     /consultation redirect), the browser handles the anchor scroll
  //     natively; skip entirely so they don't race.
  //  2. Wait for window.onload (not a fixed timeout) — guarantees ALL images
  //     and resources above the form are loaded and the layout is stable
  //     before we measure targetY. A fixed 1-second timeout was unreliable
  //     on slow connections (layout still shifting) and over-eager on fast
  //     ones (fired before above-fold images pushed the form to its real Y).
  //  3. 120 px proximity guard kept as a final safety net.
  onMount(() => {
    // Guard 1: native anchor scroll already in progress — bail out.
    if (window.location.hash === '#hero-form') return;

    // Guard 2: wait for full page load (all resources) for a stable layout.
    if (document.readyState === 'complete') {
      // Already fully loaded (e.g. SvelteKit client-side navigation).
      // Small delay so any post-load JS (font swaps, lazy images) can settle.
      setTimeout(triggerHeroScroll, 300);
    } else {
      window.addEventListener('load', () => setTimeout(triggerHeroScroll, 300), { once: true });
    }
  });
</script>

<Header />

<main id="main-content">
  <ImageGrid images={[
		"icons/partners/AAH.svg",
		"icons/partners/AAE.webp",
		"icons/partners/AAK.svg",
		"icons/partners/AAB.svg",
		"icons/partners/AAC.svg",
		"icons/partners/AAA.png",
		"icons/partners/AAD.svg",
		"icons/partners/AAF.svg",
		"icons/partners/AAG.svg",
		"icons/partners/AAI.svg",
		"icons/partners/AAJ.png",
	]}/>

  <HeroForm />

  <!-- <SoftTitle pushToRead={false} text="IRP" /> -->

  <SpecializationSection />

  <RelocationPhilosophySection />

  <ContactCTASection />

  <TestimonialsSection />

  <MovingProcessSection />

  <LatestNewsSection />

  <FAQSection {faqs} {moreFaqs} />

  <ContactSection />
</main>

<Footer />
