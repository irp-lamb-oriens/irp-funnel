<script lang="ts">
    import Header from '../../components/Header/Header.svelte';
    import Footer from '../../components/Footer/Footer.svelte';
    import HeroBanner from '../../components/HeroBanner.svelte';
    import SpecializationSection from '../../components/SpecializationSection.svelte';
    import RelocationPhilosophySection from '../../components/RelocationPhilosophySection.svelte';
    import ContactCTASection from '../../components/ContactCTASection.svelte';
    import TestimonialsSection from '../../components/TestimonialsSection.svelte';
    import MovingProcessSection from '../../components/MovingProcessSection.svelte';
    import LatestNewsSection from '../../components/LatestNewsSection.svelte';
    import FAQSection from '../../components/FAQSection.svelte';
    import ContactSection from '../../components/ContactSection.svelte';
    import './+page.scss';
  
    // FAQ data
    const moreFaqs = [
      {
        question: "Does my shipment include insurance? Or Am I protected against loss or damage while my goods are in transit?",
        answer: "Providing insurance to your shipment is an additional service we offer, please contact one of Relocation Specialists for information about the different policies available for your shipment."
      },
      {
        question: "When do I have to confirm the service with IRP?",
        answer: "We recommend confirming with 30 days in advance to ensure availability."
      },
      {
        question: "How can I track my shipment?",
        answer: "Absolutely, when your service is booked, we will create Timeline Relocation Systems for your project. This application will allow us to show you step by step all the process you relocation move will pass through, you will view dates, descriptions, comments, documents and tasks. We will send the instructions through email. <strong>(Available only for door to door relocation service)</strong>"
      },
      {
        question: "How can I confirm my Relocating and relocation service with International Relocation Partner?",
        answer: "You can sing and confirm your move in our online Relocation Planner.<br>We create a custom tailor Relocation Planner for each of our customers with a comprehensive estimate of the international shipping cost, rules and regulations. This online document has the option to confirm and accept"
      },
      {
        question: "Does IRP require a deposit payment? What type of payment method do you accept?",
        answer: "Yes, we do require an initial payment, we take wire transfer payments only, for which you will be receiving an invoice with our bank information, for additional assistance about payment method please contact our Relocation Specialist."
      },
      {
        question: "How long does it take for my shipment to be delivered or to arrive at my destination?",
        answer: "The total time it takes for goods to get from point A to point B, transit time may vary depending on different factors such as the specific route and how many stops the shipping company will make, it can take anywhere from 15 up to 45 days.<br>We can provide you with an estimated transit time and customs clearance for your shipment,<strong> please contact our Relocation Specialist.</strong>"
      },
      {
        question: "How long does it take for customs to clear my shipment?",
        answer: "It takes approximately from 1 to 10 weeks depending on the destination country rules and requirements. <strong>Please contact our Relocation Specialist for more information.</strong>"
      },
      {
        question: "What happens if on the day of the services my shipment weight or volume is different from the one estimated on the proposal?",
        answer: "We instruct our packing team to let you know if you have less than expected weight or have exceeded the estimated cubic meter reflected on the proposal, for you to decide whether or not you will be packing all, we will know the exact total of cubic meters after loading the container. The final bill will be adjusted to the real volume and weight shipped."
      },
      {
        question: "Do you include packing materials in your international Relocating proposal?",
        answer: "We offer a variety of services that may include full packing and packing materials. This is an option and we ask our customers to confirm if this service is available in your local area and for your specific shipment."
      }
    ];
    const faqs = [
      {
        question: "How can I confirm my Relocating and relocation service with International Relocation Partner?",
        answer: "You can sing and confirm your move in our online Relocation Planner.<br>We create a custom tailor Relocation Planner for each of our customers with a comprehensive estimate of the international shipping cost, rules and regulations. This online document has the option to confirm and accept"
      },
      {
        question: "Does IRP require a deposit payment? What type of payment method do you accept?",
        answer: "Yes, we do require an initial payment, we take wire transfer payments only, for which you will be receiving an invoice with our bank information, for additional assistance about payment method please contact our Relocation Specialist."
      },
      {
        question: "How long does it take for my shipment to be delivered or to arrive at my destination?",
        answer: "The total time it takes for goods to get from point A to point B, transit time may vary depending on different factors such as the specific route and how many stops the shipping company will make, it can take anywhere from 15 up to 45 days.<br>We can provide you with an estimated transit time and customs clearance for your shipment,<strong> please contact our Relocation Specialist.</strong>"
      }
    ];
  </script>
  
  <Header />
  
  <main id="main-content">
    <HeroBanner />
  
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
  