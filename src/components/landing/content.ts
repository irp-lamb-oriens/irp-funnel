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
  ],
  /**
   * Three things people tend to learn too late, per country, shown while the
   * globe holds on the country. Checked November 2026; re-check every
   * January, when most thresholds move. Sources:
   * - Costa Rica: car import tax by age (~52% new to ~79% at 6+ years), costaricalaw.com/?p=2264;
   *   pensionado $1,000 / rentista $2,500 or $60,000 deposit and mandatory CCSS, costaricalaw.com/?p=2285, goldenharbors.com
   * - Spain: NLV 400% IPREM = €28,800 + €7,200 per family member, no remote work (RD 1155/2024);
   *   golden visa closed April 3, 2025 (Ley Orgánica 1/2025); tax residence after 183 days (Ley 35/2006, art. 9)
   * - Panama: Pensionado $1,000 ($750 with $100,000 property, +$250 per dependent), permanent on approval
   *   (Decreto Ley 3 de 2008); one-time household goods exemption up to $10,000, relofirm.com
   * - Portugal: Lei Orgânica 1/2026 (in force May 19, 2026): 10 years for citizenship; D7 = minimum wage
   *   €920 (Decreto-Lei 139/2025), +50% spouse, +30% child; NHR closed to new residents from 2024 (OE 2024, replaced by IFICI)
   * - Mexico: residency card fees doubled January 1, 2026; temporary residency income ~US$4,400/month (UMA-based);
   *   permanent residents can't get a vehicle TIP (Ley de Migración 2012), mexperience.com
   * - Colombia: M-Pensionado = 3 SMMLV, SMMLV 2026 COP 1,750,905 (Decreto 0159 de 2026) → COP 5,252,715;
   *   register the visa / cédula within 15 calendar days, fines up to 7 SMMLV; cédula fee COP 294,000 (Res. 0599 de 2026)
   */
  catchHeading: 'What catches people out',
  catchYear: '2026',
  catches: {
    'Costa Rica': [
      { stat: '79%', label: 'Import tax on a car six years or older', text: 'About 52% when it is new. The rate rises with the car’s age.' },
      { stat: '$1,000', label: 'A month, for life, for pensionado residency', text: 'Rentista asks $2,500 a month for two years, or a $60,000 deposit.' },
      { stat: 'Caja', label: 'Public health enrollment is mandatory', text: 'Residents pay a monthly share of their declared income, even with private insurance.' }
    ],
    Spain: [
      { stat: '€28,800', label: 'A year in passive income, non-lucrative visa', text: 'Plus €7,200 per family member. No work allowed, remote work included.' },
      { stat: 'Closed', label: 'Golden visa, since April 3, 2025', text: 'Buying property no longer gives you residency.' },
      { stat: '183 days', label: 'In Spain make you a tax resident', text: 'From then on, Spain taxes your worldwide income.' }
    ],
    Panama: [
      { stat: '$1,000', label: 'A month, for life, for the Pensionado visa', text: '$750 with Panamanian property worth $100,000 or more. Add $250 per dependent.' },
      { stat: '$10,000', label: 'Of household goods duty-free, once', text: 'It is a one-time exemption. Plan the whole shipment before you use it.' },
      { stat: 'Day one', label: 'Pensionado residency is permanent on approval', text: 'No temporary stage, and no income check at renewal.' }
    ],
    Portugal: [
      { stat: '10 years', label: 'Before citizenship, since May 19, 2026', text: 'It used to be 5. Permanent residence still comes at year 5.' },
      { stat: '€920', label: 'A month in passive income for the D7', text: 'It follows the minimum wage, which rises every January. Add 50% for a spouse, 30% per child.' },
      { stat: 'NHR', label: 'The old tax regime closed to newcomers in 2024', text: 'Its replacement only covers certain professions.' }
    ],
    Mexico: [
      { stat: '2×', label: 'Residency card fees since January 2026', text: 'Government fees doubled for new and renewing residents.' },
      { stat: 'US$4,400', label: 'A month in income for temporary residency', text: 'Recalculated every January, and consulates apply it differently.' },
      { stat: 'No permit', label: 'For a foreign-plated car once you are permanent', text: 'Only visitors and temporary residents can get one outside the free zones.' }
    ],
    Colombia: [
      { stat: 'COP 5.25M', label: 'A month for the pensioner visa', text: 'Three minimum wages. The minimum wage rose about 23% for 2026.' },
      { stat: '15 days', label: 'To register your visa and get your cédula', text: 'Calendar days from arrival. Missing them can cost up to seven minimum wages in fines.' },
      { stat: 'COP 294,000', label: 'For the cédula de extranjería', text: 'The 2026 fee. The card arrives about 10 business days after payment.' }
    ]
  } as Record<string, { stat: string; label: string; text: string }[]>
};

export const PROOF = {
  eyebrow: 'Clients',
  title: 'What our clients say.',
  videoTitle: 'Jill Reed on moving abroad with IRP',
  videoSrc:
    'https://storage.googleapis.com/videos-irp-funnels/Copia-de-Jill-Reed-International-Relocation-Partner%20(1).mp4#t=0.1',
  reviewsLead: 'Google reviews from clients who moved with us.',
  wall: {
    eyebrow: 'Google reviews',
    /** Words of the heading; the last one is set in the accent colour. */
    title: ['What', 'our', 'customers', 'say'],
    sub: 'Real reviews from clients who moved their lives with us.',
    hint: 'Press a column to stop it. Select a review to read it on Google.'
  }
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
