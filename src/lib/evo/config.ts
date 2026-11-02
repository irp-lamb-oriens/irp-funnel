/**
 * Evo — non-agnostic component registry.
 *
 * Every component that participates in evolutionary UI experimentation
 * declares its `variants` here. Variants are an arbitrary-length array; add
 * or retire them without changing the Evo runtime itself.
 *
 * SOURCE OF TRUTH: `irp-funnel-server/API/evo/registry.ts` (control,
 * primary metric, guardrails, start date live there). This file mirrors only
 * what the browser needs to assign: component keys, variant keys/labels,
 * `retiredIn` and the fixed `allocation`. Keys, active variants and
 * allocations must match the server — `deno run scripts/test-evo-registry-parity.ts`
 * in irp-funnel-server fails when they drift.
 *
 * Evo Lab restart (Phase 0): every experiment restarted with two arms.
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
  /** Fixed traffic split over ACTIVE variants. Omitted = equal split. */
  allocation?: Record<string, number>;
}

const RESTART = 'evo-lab-restart';

/**
 * Registered components. Edit this file to add/retire variants.
 * Keep variant order stable — old assignments keyed by `key` stay valid.
 */
export const EVO_COMPONENTS: Record<string, EvoComponentConfig> = {
  Collaborations: {
    key: 'Collaborations',
    variants: [
      {
        key: 'v1-collaborations',
        label: 'Rotating carousel',
        hypothesis: 'Rotating carousel of partner logos may capture more attention and build more trust.',
      },
      {
        key: 'v2-collaborations',
        label: 'Static logos',
        hypothesis: 'Static logos of partner companies to build trust.',
      }
    ]
  },
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
        retiredIn: RESTART,
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
        retiredIn: RESTART,
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

/** Active (non-retired) variants, in registry order. */
export function activeVariantsOf(cfg: EvoComponentConfig): EvoVariant[] {
  return cfg.variants.filter((v) => !v.retiredIn);
}

/**
 * Fixed allocation over active variants, normalised to sum to 1; invalid or
 * missing entries fall back to an equal split. Mirrors `allocationOf` in the
 * server registry exactly (the parity test compares the outputs).
 */
export function allocationOf(cfg: EvoComponentConfig): Record<string, number> {
  const act = activeVariantsOf(cfg);
  const out: Record<string, number> = {};
  if (!act.length) return out;
  let total = 0;
  for (const v of act) {
    const w = cfg.allocation?.[v.key];
    const ok = typeof w === 'number' && isFinite(w) && w > 0;
    out[v.key] = ok ? (w as number) : 0;
    total += out[v.key];
  }
  if (total <= 0 || act.some((v) => out[v.key] <= 0)) {
    for (const v of act) out[v.key] = 1 / act.length;
    return out;
  }
  for (const v of act) out[v.key] = out[v.key] / total;
  return out;
}
