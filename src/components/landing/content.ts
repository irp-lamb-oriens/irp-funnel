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
  signature: '/sign-itp.jpg' // Pablo's handwritten signature; no face on the landing (voice only)
};

export const LILI_WHATSAPP =
  'https://wa.me/15186227134?text=' +
  encodeURIComponent("Hi Lili! I'm interested in international relocation.");

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
  title: 'From the first call to your first week there.',
  items: [
    {
      title: 'A consulting call',
      body: 'Sixty minutes about your case. We review the rules that apply to your status and your destination and answer your first questions.'
    },
    {
      title: 'Your project plan',
      body: 'We write the costs, rules and steps into an online Project Planner. You review it and accept it there.'
    },
    {
      title: 'Timeline and follow-up',
      body: 'Every milestone goes on a timeline. We keep you updated so you know what comes next and what we need from you.'
    },
    {
      title: 'Support after you arrive',
      body: 'Once you land we keep answering questions and solving issues while you settle in.'
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
  eyebrow: 'Chat with Lili',
  title: 'Ask first, then book.',
  body: 'Lili, our assistant, answers your questions in the chat, checks the team calendar and books your call. She is on WhatsApp too.',
  primary: 'Chat with Lili',
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
  eyebrow: 'Your project',
  title: 'What your project includes.',
  lead: 'Each client gets a plan written for their move and a way to follow it.',
  items: [
    {
      title: 'A Project Planner made for you',
      body: 'An online document with the estimated costs, rules and regulations for your move. You confirm and accept it there.'
    },
    {
      title: 'A timeline you can open anytime',
      body: 'Each step with its dates, descriptions, comments, documents and tasks. Included with our comprehensive consulting services.'
    },
    {
      title: 'A consulting specialist',
      body: 'One person who knows your project and answers your questions, including payments and timing.'
    },
    {
      title: 'Notice before the bill changes',
      body: 'If the scope turns out smaller or larger than estimated, we tell you first and you decide how to proceed.'
    }
  ]
};

export const TIMELINE = {
  eyebrow: 'Example',
  title: 'What your project timeline looks like.',
  body: 'Once you confirm, we open a timeline for your project and send the instructions by email. This is an example.',
  steps: [
    { title: 'Consulting call', meta: 'Done', state: 'done' },
    { title: 'Project Planner accepted', meta: 'Done', state: 'done' },
    { title: 'Documents prepared and sent', meta: 'In progress', state: 'now' },
    { title: 'Customs clearance', meta: 'Next', state: 'next' },
    { title: 'Delivery at your new home', meta: 'Next', state: 'next' }
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
  items: [
    {
      q: 'When do I have to confirm the service with IRP?',
      a: 'We recommend confirming six months in advance to ensure availability.'
    },
    {
      q: 'How can I confirm my consulting service?',
      a: 'You sign and confirm your project in our online Project Planner. We create one for each client with an estimate of the costs, rules and regulations, and you can accept it from there.'
    },
    {
      q: 'Does IRP require a deposit? Which payment methods do you accept?',
      a: 'Yes, we require an initial payment. We take wire transfers, and you receive an invoice with our bank information. Your consulting specialist can help with other payment questions.'
    },
    {
      q: 'How can I track my project?',
      a: 'When your service is booked we create a timeline for your project with dates, descriptions, comments, documents and tasks, and send the instructions by email. Available with our comprehensive consulting services.'
    },
    {
      q: 'How long do my documents take to arrive at my destination?',
      a: 'Between 15 and 45 days, depending on the route and processing times. Your consulting specialist can give you an estimate for your project.'
    },
    {
      q: 'How long does customs take to clear my documentation?',
      a: "About 1 to 10 weeks, depending on the destination country's rules and requirements."
    },
    {
      q: 'What if the scope of my project changes from the proposal?',
      a: 'We tell you if the scope is smaller or larger than expected, and you decide how to proceed. The final bill is adjusted to the actual scope.'
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
  secondary: 'Message Lili on WhatsApp'
};
