<script lang="ts">
  import { onMount } from 'svelte';
  import Header from '../components/Header/Header.svelte';
  import Footer from '../components/Footer/Footer.svelte';
  import HeroBanner from '../components/HeroBanner.svelte';
  import SpecializationSection from '../components/SpecializationSection.svelte';
  import ServicesSection from '../components/ServicesSection.svelte';
  import RelocationPhilosophySection from '../components/RelocationPhilosophySection.svelte';
  import ContactCTASection from '../components/ContactCTASection.svelte';
  import TestimonialsSection from '../components/TestimonialsSection.svelte';
  import VerticalReviewMarquee from '../components/VerticalReviewMarquee.svelte';
  import MovingProcessSection from '../components/MovingProcessSection.svelte';
  import LatestNewsSection from '../components/LatestNewsSection.svelte';
  import FAQSection from '../components/FAQSection.svelte';
  import ContactSection from '../components/ContactSection.svelte';
  import './+page.scss';
    import SoftTitle from '../components/SoftTitle/SoftTitle.svelte';
    import HeroForm from '../components/HeroForm.svelte';
    import PersonalityShowcase from '../components/PersonalityShowcase/PersonalityShowcase.svelte';

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

  // Gentle, interruptible auto-scroll to the Hero Form.
  // Native smooth scroll (scrollIntoView) finishes too fast for users to see
  // the intermediate sections and, in many browsers, can't be interrupted by
  // user gestures. Instead we animate with requestAnimationFrame using a soft
  // ease-in-out curve over ~10s, and cancel immediately on any user input
  // (wheel, touch, keyboard or mouse).

  onMount(() => {
    if (window.location.hash === '#hero-form') return;
    const el = document.getElementById('hero-form-container');
    if (!el) return;

    const startY = window.scrollY;
    const targetY = el.getBoundingClientRect().top + startY;
    const distance = targetY - startY;
    if (Math.abs(distance) < 1) return;

    // The site sets `scroll-behavior: smooth` globally (global.scss). That makes
    // the browser re-smooth every programmatic scrollTo, which fights our
    // per-frame updates — the page looks frozen and then "jumps" at native
    // speed at the end. Force instant scrolling on <html> while we animate,
    // then restore the original value on cleanup.
    const rootStyle = document.documentElement.style;
    const prevScrollBehavior = rootStyle.scrollBehavior;
    rootStyle.scrollBehavior = 'auto';

    // Slow, deliberate ~1s scroll so the user clearly sees each section pass by.
    const duration = 5000; // ms

    let startTime: number | null = null;
    let rafId = 0;

    const easeInOutCubic = (t: number) =>
      t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

    const cleanup = () => {
      rootStyle.scrollBehavior = prevScrollBehavior;
      window.removeEventListener('wheel', cancel, { capture: true } as any);
      window.removeEventListener('touchstart', cancel, { capture: true } as any);
      window.removeEventListener('keydown', cancel, { capture: true } as any);
      window.removeEventListener('mousedown', cancel, { capture: true } as any);
    };


    const cancel = () => {
      cancelAnimationFrame(rafId);
      cleanup();
    };

    // Register interruptors before the animation begins.
    window.addEventListener('wheel', cancel, { capture: true, passive: true });
    window.addEventListener('touchstart', cancel, { capture: true, passive: true });
    window.addEventListener('keydown', cancel, { capture: true });
    window.addEventListener('mousedown', cancel, { capture: true });

    const step = (timestamp: number) => {
      if (startTime === null) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      window.scrollTo(0, startY + distance * easeInOutCubic(progress));
      if (progress < 1) {
        rafId = requestAnimationFrame(step);
      } else {
        cleanup();
      }
    };

    rafId = requestAnimationFrame(step);

    return cancel;
  });

</script>

<svelte:head>
  <title>International Relocation Partner | Moving Abroad Made Simple</title>
  <meta name="description" content="Relocation services for expats, retirees and digital nomads. International moving, relocation tours, courier assistance, customs rules, cost of living guides and automobile shipping." />
  <meta property="og:type" content="website" />
  <meta property="og:title" content="International Relocation Partner | Relocating Abroad Made Simple" />
  <meta property="og:description" content="Trusted relocation partner for expats, retirees and digital nomads. International moving, relocation tours, courier help, customs regulations and auto shipping." />
  <meta property="og:url" content="https://yourwebsite.com/" />
  <meta name="twitter:card" content="summary_large_image" />
</svelte:head>


<main id="main-content">
  <Header />

  <PersonalityShowcase />

  <HeroForm />

  <!-- <SoftTitle pushToRead={false} text="IRP" /> -->

  <ServicesSection />

  <SpecializationSection />

  <RelocationPhilosophySection />

  <ContactCTASection />

  <TestimonialsSection />

  <VerticalReviewMarquee
    title="What Our Customers Say"
    subtitle="Real reviews from clients who moved their lives with us."
    background="#ffffff"
  />

  <MovingProcessSection />

  <LatestNewsSection />

  <FAQSection {faqs} {moreFaqs} />

  <ContactSection />
</main>

<Footer />
