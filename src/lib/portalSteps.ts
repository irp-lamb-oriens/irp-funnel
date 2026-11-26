/**
 * portalSteps.ts — the client actions on the status page (/status/:id) that
 * Evo counts as outcomes. The server accepts exactly this list
 * (irp-funnel-server/API/evo/portalSteps.ts); its test fails when they drift.
 */

export const PORTAL_STEPS = [
  "portal_open",
  "quote_view",
  "option_select",
  "lily_message",
  "comment",
  "payment_start",
  "offer_click",
] as const;

export type PortalStep = (typeof PORTAL_STEPS)[number];

/** [short label, what the person did] — for Evo Lab tables and sentences. */
export const PORTAL_STEP_LABELS: Record<PortalStep, [string, string]> = {
  portal_open: ['Opened portal', 'opened their status page'],
  quote_view: ['Viewed quote', 'looked at their quote'],
  option_select: ['Picked option', 'picked a quote option'],
  lily_message: ['Wrote to Lily', 'wrote to Lily on their status page'],
  comment: ['Left comment', 'left a comment on their status page'],
  payment_start: ['Started payment', 'started a payment'],
  offer_click: ['Clicked offer', 'clicked the status page offer'],
};

export function isPortalStep(value: unknown): value is PortalStep {
  return typeof value === 'string' && (PORTAL_STEPS as readonly string[]).includes(value);
}
