/**
 * Copy for the IRP home landing. Every fact here comes from the existing site
 * (HeroBanner, SpecializationSection, ServicesSection, MovingProcessSection,
 * RelocationPhilosophySection, the home FAQ, lib/reviews.ts). Section plan:
 * docs/landing-redesign.md. Narration script: docs/narration/SCRIPTS.md.
 */

export const IMG = {
  principle:
    'https://images.pexels.com/photos/14510492/pexels-photo-14510492.jpeg?auto=compress&cs=tinysrgb&w=2000', // placeholder until the scroll story replaces this band
  moving:
    'https://images.pexels.com/photos/1117210/pexels-photo-1117210.jpeg?auto=compress&cs=tinysrgb&w=1200',
  tours:
    'https://images.pexels.com/photos/14510492/pexels-photo-14510492.jpeg?auto=compress&cs=tinysrgb&w=1200',
  signature: '/landing/signature.png' // Pablo's handwritten signature; no face on the landing (voice only)
};

export const LILI_WHATSAPP =
  'https://wa.me/15186227134?text=' +
  encodeURIComponent("Hi Lily! I'm interested in international relocation.");

export const HERO = {
  founder: 'Pablo Arias, founder',
  founderLine: 'My team and I have planned moves abroad for more than fourteen years.',
  facts: [
    { value: '14+ years', label: 'planning international moves' },
    { value: 'Six countries', label: 'in Latin America and Europe' },
    { value: '60-minute call', label: 'about the rules for your case' }
  ]
};

export const PROBLEM = {
  eyebrow: 'Before you move',
  title: 'The rules for your move depend on your case.',
  lead:
    'What you can bring, what you pay and which papers you need change with your immigration status and your destination. A surprise at the port is expensive to fix.',
  beats: [
    {
      tag: 'Status',
      title: 'Rules that change with who you are',
      body: 'A retiree, a digital nomad and a returning citizen can face different rules for the same shipment.'
    },
    {
      tag: 'Costs',
      title: 'Duties nobody put in the quote',
      body: 'Duties and paperwork for your route are easy to miss until someone maps them for you.'
    },
    {
      tag: 'Customs',
      title: 'Up to ten weeks at customs',
      body: "Clearing customs takes from one to ten weeks, depending on the destination country's rules."
    },
    {
      tag: 'Documents',
      title: 'Papers that take weeks to arrive',
      body: 'Documents can take fifteen to forty-five days to get from your home country to your destination.'
    }
  ]
};

export const STEPS = {
  eyebrow: 'How it works',
  title: 'From your first call to every stage of your move.',
  items: [
    {
      title: 'A consulting call',
      body: 'Sixty minutes about your case. We go through the rules and regulations that apply to your immigration status and your destination, and answer your questions.'
    },
    {
      title: 'Your plan, in writing',
      body: 'After the call you get a written plan: the rules that apply to you, the steps of your move and what it costs. You review it and accept it online.'
    },
    {
      title: 'Your status page',
      body: 'Once you confirm, your status page shows each stage of your move with its date, and our team keeps you updated on WhatsApp.'
    }
  ]
};

export const SERVICES = {
  eyebrow: 'What we do',
  title: 'Four ways we help you move.',
  items: [
    {
      tag: 'End to end',
      title: 'International moving',
      body: 'Your household, a car or a full container. We map the rules, duties and paperwork for your route.',
      href: '/consultation',
      cta: 'Plan your move',
      image: IMG.moving
    },
    {
      tag: 'On the ground',
      title: 'Relocation tours',
      body: 'A private visit to Costa Rica or Panama before you commit, to see the region, the schools and the healthcare with someone who knows them.',
      href: '/relocation-tours',
      cta: 'See the tours',
      image: IMG.tours
    },
    {
      tag: 'Paperwork',
      title: 'Documentation assistance',
      body: 'Help preparing and sending the documents your destination asks for, with an estimate of how long each one takes.',
      href: '/consultation',
      cta: 'Ask about documents'
    },
    {
      tag: 'Advice',
      title: 'International advisory',
      body: 'Advice on the rules and costs that apply to your specific move, before you sign anything expensive.',
      href: '/consultation',
      cta: 'Book advice'
    }
  ]
};

export const LILI = {
  eyebrow: 'Chat with Lily',
  title: 'Ask first, then book.',
  body: 'Lily, our assistant, answers your questions in the chat, checks the team calendar and books your call. She is on WhatsApp too.',
  primary: 'Chat with Lily',
  secondary: 'Message on WhatsApp',
  chat: [
    { from: 'you', text: "We're moving from Texas to Costa Rica next spring. Can we ship our car?" },
    { from: 'lili', text: 'Yes. The rules depend on your residency status, so the team reviews that on your consultation call.' },
    { from: 'lili', text: 'I have Tuesday at 10:00 or Thursday at 15:00. Which works for you?' },
    { from: 'you', text: 'Thursday works.' }
  ]
};

export const PRINCIPLE = {
  title: 'Every successful project is a well-planned project.',
  body: 'We built a system so you can follow your whole project, from the first consultation to the delivery of every document.',
  mark: 'follow your whole project'
};

export const INCLUDES = {
  eyebrow: 'After you confirm',
  title: 'What you get with your project.',
  lead: 'We handle the move for you. You always know the rules that apply, where your move stands and what comes next.',
  items: [
    {
      title: 'The rules for your case, in writing',
      body: 'Your plan lists the rules and regulations that apply to your status, your route and your destination, with the estimated costs. You accept it online.'
    },
    {
      title: 'Your status page',
      body: 'Your Relocation Portal shows each stage of your move with its date, your documents and your next consultation.'
    },
    {
      title: 'Follow-up on WhatsApp',
      body: 'Our team keeps you updated on WhatsApp at each stage, so you know what comes next and what we need from you.'
    },
    {
      title: 'Notice before the bill changes',
      body: 'If the scope turns out smaller or larger than estimated, we tell you first and you decide how to proceed.'
    }
  ]
};

export const TIMELINE = {
  eyebrow: 'Your status page',
  title: 'Every stage of your move, with its date.',
  body: 'Once you confirm, your Relocation Portal follows your move stage by stage, with an activity log. You can rate each stage when it is done. This is an example.',
  /** Client-visible stages of the IRP pipeline, in order (server API/dashboard/pipeline.ts and the stage restructure). */
  stages: [
    'Consultation',
    'Post-call review',
    'Pricing quote',
    'Quoted',
    'Quote acceptance',
    'Initial payment',
    'Packing',
    'Origin service',
    'Shipping details',
    'Arrival at destination',
    'Bonded warehouse entry',
    'Import and customs clearance',
    'Customs inspection',
    'Delivery service',
    'Delivery documents',
    'Completed'
  ]
};

export const WHO = {
  eyebrow: 'Who we serve',
  title: 'People moving their lives abroad.',
  rows: [
    {
      who: 'Expats and retirees',
      body: 'Moving a household to start somewhere new, with the paperwork your residency asks for.'
    },
    {
      who: 'Digital nomads',
      body: 'Working from abroad and wanting to know which rules apply before you settle.'
    },
    {
      who: 'Private individuals',
      body: 'Looking at opportunities in another country and wanting to see it first.'
    },
    {
      who: 'Returning citizens',
      body: 'Going back to your origin country with what you collected over years abroad.'
    }
  ],
  cta: 'Book your 60-minute call'
};

export const COUNTRIES = {
  eyebrow: 'Where we work',
  title: 'Six countries, open now.',
  lead: 'Pick your destination to read our guide. Relocation tours run in Costa Rica and Panama.',
  list: [
    { name: 'Costa Rica', href: '/costa-rica/', tours: true },
    { name: 'Panama', href: '/panama/', tours: true },
    { name: 'Mexico', href: '/mexico/' },
    { name: 'Portugal', href: '/portugal/' },
    { name: 'Spain', href: '/spain/' },
    { name: 'Colombia', href: '/colombia/' }
  ]
};

export const PROOF = {
  eyebrow: 'Clients',
  title: 'What our clients say.',
  videoTitle: 'Jill Reed on moving abroad with IRP',
  videoSrc:
    'https://storage.googleapis.com/videos-irp-funnels/Copia-de-Jill-Reed-International-Relocation-Partner%20(1).mp4#t=0.1',
  reviewsLead: 'Google reviews from clients who moved with us.'
};

export const FAQ = {
  eyebrow: 'Questions',
  title: 'What people ask before booking.',
  checklist: { label: 'Download the free relocation checklist', href: '/free-resources/' },
  /** Questions and answers exactly as on the previous home (FAQSection); answers hold trusted HTML. */
  items: [
    {
      q: "How can I confirm my consulting service with International Relocation Partner?",
      a: "You can sign and confirm your project in our online Project Planner.<br>We create a custom-tailored Project Planner for each of our customers with a comprehensive estimate of the international project costs, rules, and regulations. This online document has the option to confirm and accept."
    },
    {
      q: "Does IRP require a deposit payment? What type of payment method do you accept?",
      a: "Yes, we do require an initial payment. We take wire transfer payments only, for which you will receive an invoice with our bank information. For additional assistance with payment methods, please contact our Consulting Specialist."
    },
    {
      q: "How long does it take for my project documentation to be delivered or to arrive at my destination?",
      a: "The total time it takes for documents to get from point A to point B can vary depending on different factors, such as the specific route and processing times. It can take anywhere from 15 up to 45 days.<br>We can provide you with an estimated time of project completion for your documentation,<strong> please contact our Consulting Specialist.</strong>"
    },
    {
      q: "When do I have to confirm the service with IRP?",
      a: "We recommend confirming with 6 months in advance to ensure availability."
    },
    {
      q: "How can I track my project?",
      a: "Absolutely. When your service is booked, we will create a Timeline System for your project. This application will allow us to show you the entire process step by step, including dates, descriptions, comments, documents, and tasks. We will send the instructions through email. <strong>(Available only for our comprehensive consulting services)</strong>"
    },
    {
      q: "How long does it take for customs to clear my documentation?",
      a: "It takes approximately 1 to 10 weeks, depending on the destination country's rules and requirements. <strong>Please contact our Consulting Specialist for more information.</strong>"
    },
    {
      q: "What happens if the scope of my project changes from what was estimated in the proposal?",
      a: "We will notify you if the scope of your project is smaller or larger than expected. You can then decide how to proceed. The final bill will be adjusted to the actual scope of the project."
    }
  ]
};

export const FINAL = {
  eyebrow: 'Book your call',
  title: "When you're ready, book your consultation.",
  body: 'I will be waiting for you. My team and I are waiting for you.',
  signoff: 'Sincerely,',
  name: 'Pablo Arias',
  role: 'Founder, International Relocation Partner',
  primary: 'Book your call',
  secondary: 'Message Lily on WhatsApp'
};
