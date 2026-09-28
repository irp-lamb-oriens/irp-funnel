/**
 * lib/serviceFunnelRegistry.ts
 * ──────────────────────────────────────────────────────────────────────────
 * The declarative source of truth for the status-page service funnels.
 *
 * Each entry maps a stable service id to the copy + field config a funnel
 * renders. The status page's destination-services container-switch iterates
 * this registry, so adding a new sub-brand is a data change, not a new
 * component. Field definitions are ServiceFieldDef shapes (the same schema
 * ServiceIntakeForm consumes), so the agnostic FunnelField renderer can draw
 * them without bespoke markup.
 *
 * The mother-brand / sub-brand relationship is encoded once here so the
 * eyebrow/brand labels stay consistent across every surface.
 */

import type { ServiceFieldDef, ServiceType } from './serviceConfig.ts';

export interface ServiceFunnelConfig {
  /** Stable id — matches the server `destinationServices.services[].id`. */
  id: string;
  /** The ServiceType this funnel maps to (drives field semantics). */
  serviceType: ServiceType;
  /** Sub-brand label, e.g. "Immigration Partner". */
  brand: string;
  /** Eyebrow pill text. */
  eyebrow: string;
  /** Funnel title. */
  title: string;
  /** Lead paragraph. */
  lead: string;
  /** Emoji/icon shown beside the eyebrow. */
  icon: string;
  /** CTA button label. */
  ctaLabel: string;
  /** Ordered field definitions for the funnel form. */
  fields: ServiceFieldDef[];
}

/** The mother brand every sub-brand funnels under. */
export const MOTHER_BRAND = 'International Relocation Partner';

/**
 * The sub-brand map: service type → sub-brand name. Encoded once so the
 * eyebrow/brand labels never drift between the registry and any other surface.
 */
export const SUB_BRAND_LABELS: Record<ServiceType, string> = {
  relocation: 'Moving Partner',
  relocation_tour: 'Moving Partner',
  immigration: 'Immigration Partner',
  legal: 'Legal Partner',
  realty: 'Realty Partner',
  coaching: 'Moving Partner',
  moving: 'Moving Partner',
};

/**
 * The ordered funnel registry. The three existing destination-service tabs
 * (tours / immigration / coaching) are represented here; the sub-brand funnels
 * (legal / realty / moving) are additive stubs ready to be wired in.
 */
export const SERVICE_FUNNELS: ServiceFunnelConfig[] = [
  {
    id: 'tours',
    serviceType: 'relocation_tour',
    brand: 'Moving Partner',
    eyebrow: 'Relocation Tours',
    icon: '📍',
    title: 'See your destination before you commit',
    lead:
      'A private, guided tour of the areas you are considering. We walk the neighbourhoods, meet the local contacts, and map the practical details so your move is grounded in what the place is actually like.',
    ctaLabel: 'Book a discovery call',
    fields: [],
  },
  {
    id: 'immigration',
    serviceType: 'immigration',
    brand: 'Immigration Partner',
    eyebrow: 'Immigration Advice',
    icon: '🛂',
    title: 'Your path to residency',
    lead:
      'The right category depends on your income, your savings, and what you plan to do once you arrive. Tell us the details that are still missing and we will match you to the correct route.',
    ctaLabel: 'Save my details',
    fields: [
      {
        id: 'nationality',
        type: 'country',
        label: 'What is your nationality?',
        required: true,
        chatbotQuestion: 'What is your nationality?',
        priority: 1,
      },
      {
        id: 'residencyPathway',
        type: 'options',
        label: 'Which residency route are you considering?',
        required: true,
        options: [
          { value: 'rentista', label: 'Rentista' },
          { value: 'pensionado', label: 'Pensionado' },
          { value: 'inversionista', label: 'Inversionista' },
        ],
        chatbotQuestion: 'Which residency route are you considering?',
        priority: 2,
      },
      {
        id: 'applicantCount',
        type: 'options',
        label: 'How many people are applying?',
        required: true,
        options: [
          { value: '1', label: 'Just me' },
          { value: '2', label: 'Two' },
          { value: '3', label: 'Three or more' },
        ],
        chatbotQuestion: 'How many people are applying?',
        priority: 3,
      },
      {
        id: 'residencyTimeline',
        type: 'options',
        label: 'When do you want to start?',
        required: false,
        options: [
          { value: 'asap', label: 'As soon as possible' },
          { value: '3m', label: 'Within 3 months' },
          { value: '6m', label: 'Within 6 months' },
          { value: 'exploring', label: 'Just exploring' },
        ],
        chatbotQuestion: 'When do you want to start?',
        priority: 4,
      },
    ],
  },
  {
    id: 'coaching',
    serviceType: 'coaching',
    brand: 'Moving Partner',
    eyebrow: 'Intercultural Coaching',
    icon: '🗣️',
    title: 'Settle in, not just move in',
    lead:
      'The paperwork is only half of a move. How people communicate, do business, and build trust can be very different from what you are used to. Coaching closes that gap before it costs you time or goodwill.',
    ctaLabel: 'Book a discovery call',
    fields: [],
  },
  {
    id: 'legal',
    serviceType: 'legal',
    brand: 'Legal Partner',
    eyebrow: 'Legal Advice',
    icon: '⚖️',
    title: 'Legal support for your move',
    lead:
      'Contracts, visas, and local compliance handled by a partner who knows the destination. Tell us what you need and we will route you to the right specialist.',
    ctaLabel: 'Book a discovery call',
    fields: [],
  },
  {
    id: 'realty',
    serviceType: 'realty',
    brand: 'Realty Partner',
    eyebrow: 'Real Estate Assessment',
    icon: '🏠',
    title: 'Find the right home',
    lead:
      'From short-term rentals to buying, our realty partner helps you land somewhere that fits your budget and lifestyle.',
    ctaLabel: 'Book a discovery call',
    fields: [],
  },
  {
    id: 'moving',
    serviceType: 'moving',
    brand: 'Moving Partner',
    eyebrow: 'International moving',
    icon: '📦',
    title: 'Your move, handled end to end',
    lead:
      'Shipping, packing, and logistics coordinated by the moving partner so your belongings arrive on time and intact.',
    ctaLabel: 'Book a discovery call',
    fields: [],
  },
];

/** Look up a funnel config by id (undefined when unknown). */
export function getServiceFunnel(id: string): ServiceFunnelConfig | undefined {
  return SERVICE_FUNNELS.find((f) => f.id === id);
}