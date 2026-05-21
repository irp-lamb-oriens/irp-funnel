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

  // Custom eased scroll — deliberately slower than the browser's native
  // smooth-scroll so the visitor can clearly see the page gliding to the CTA.
  // Uses an easeInOutCubic curve over `duration` ms driven by rAF.
  function smoothScrollTo(targetY: number, duration = 2400) {
    const startY = window.scrollY;
    const distance = targetY - startY;
    let startTime: number | null = null;

    function easeInOutCubic(t: number): number {
      return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }

    function step(timestamp: number) {
      if (startTime === null) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const progress = Math.min(elapsed / duration, 1);
      window.scrollTo(0, startY + distance * easeInOutCubic(progress));
      if (progress < 1) requestAnimationFrame(step);
    }

    requestAnimationFrame(step);
  }

  // Auto-scroll to the hero form 1 second after the page loads so the CTA
  // is always front-and-center regardless of where the visitor lands on the
  // page (social proof gallery, video, etc. scroll past first).
  onMount(() => {
    setTimeout(() => {
      const el = document.getElementById('hero-form-container');
      if (el) {
        const targetY = el.getBoundingClientRect().top + window.scrollY;
        smoothScrollTo(targetY);
      }
    }, 1000);
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
