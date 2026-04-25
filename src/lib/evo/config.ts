/**
 * Evo — non-agnostic component registry.
 *
 * Every component that participates in evolutionary UI experimentation
 * declares its `variants` here. Variants are an arbitrary-length array; add
 * or retire them without changing the Evo runtime itself.
 *
 * The same registry is mirrored on the server (see
 * `irp-funnel-server/API/evo/registry.ts`) — keep them in sync when shipping
 * new variants. The server doc is the source of truth consumed by the
 * dashboard; this file is what the funnel uses at runtime.
 */

export interface EvoVariant {
  /** Stable key used for assignment + analytics. Never rename — retire + add. */
  key: string;
  /** Human-friendly label shown in the dashboard. */
  label?: string;
  /** Short commit hash this variant was introduced in (for the timeline graph). */
  introducedIn?: string;
  /** Short commit hash this variant was retired in (null if still live). */
  retiredIn?: string | null;
  /** Optional description — why this variant exists, what hypothesis it tests. */
  hypothesis?: string;
}

export interface EvoComponentConfig {
  /** Stable component key — matches a user-visible UI unit. */
  key: string;
  /** Non-agnostic, arbitrary-length list of variants. */
  variants: EvoVariant[];
}

/**
 * Registered components. Edit this file to add/retire variants.
 * Keep variant order stable — old assignments keyed by `key` stay valid.
 */
export const EVO_COMPONENTS: Record<string, EvoComponentConfig> = {
  HeroForm: {
    key: 'HeroForm',
    variants: [
      {
        key: 'v1-baseline',
        label: 'Baseline CTA',
        hypothesis: 'Current production copy — control variant.',
      },
      {
        key: 'v2-warm-copy',
        label: 'Warm copy CTA',
        hypothesis: 'Warmer, less transactional copy may improve first-click rate.',
      },
      {
        key: 'v3-urgent-copy',
        label: 'Urgent CTA',
        hypothesis: 'Urgency-driven copy may lift conversion among ready-to-act visitors.',
      },
    ],
  },
  HeroFormColor: {
    key: 'HeroFormColor',
    variants: [
      {
        key: 'v1-baseline',
        label: 'Purple Gradient',
        hypothesis: 'Current production purple/indigo gradient.',
      },
      {
        key: 'v2-red',
        label: 'Red Gradient',
        hypothesis: 'Red implies urgency and stands out more, hoping for higher CTR.',
      },
    ],
  },
  Chatbot: {
    key: 'Chatbot',
    variants: [
      {
        key: 'v1-baseline',
        label: 'Baseline greeting',
        hypothesis: 'Current production greeting — control variant.',
      },
      {
        key: 'v2-concierge',
        label: 'Concierge greeting',
        hypothesis: "Concierge-style first message ('Hi, I'm Lili — I'll guide you') may reduce drop-off.",
      },
    ],
  },
  ChatbotPersona: {
    key: 'ChatbotPersona',
    variants: [
      {
        key: 'v1-advisor',
        label: 'Passive Advisor',
        hypothesis: 'Baseline: Friendly, passive advisor tone that waits for the user to lead.',
      },
      {
        key: 'v2-closer',
        label: 'Aggressive Closer',
        hypothesis: 'Push hard for the calendar booking instead of passive Q&A.',
      },
    ],
  },
  EmailDripSubject: {
    key: 'EmailDripSubject',
    variants: [
      {
        key: 'v1-baseline',
        label: 'Baseline Subject',
        hypothesis: 'Your relocation plan inside',
      },
      {
        key: 'v2-urgent',
        label: 'Urgent Subject',
        hypothesis: 'Action required: Finalize your move',
      },
      {
        key: 'v3-friendly',
        label: 'Friendly Subject',
        hypothesis: 'Lili from IRP — checking in on your move',
      }
    ]
  },
  EmailDripBody: {
    key: 'EmailDripBody',
    variants: [
      {
        key: 'v1-baseline',
        label: 'Baseline Body',
        hypothesis: 'Standard checklist and links.',
      },
      {
        key: 'v2-story',
        label: 'Storytelling Body',
        hypothesis: 'Opens with a success story about another expat to build trust.',
      }
    ]
  }
};

export function getComponentConfig(key: string): EvoComponentConfig | null {
  return EVO_COMPONENTS[key] ?? null;
}

/** 
 * Type for weights fetched from server via MAB endpoint.
 * E.g., { "HeroForm": { "v1-baseline": 0.9, "v2-warm-copy": 0.1 } }
 */
export type EvoWeightsMap = Record<string, Record<string, number>>;
