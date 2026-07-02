import { writable, derived, get } from 'svelte/store';
import { browser } from '$app/environment';
import store from '../../components/store.ts';
import {
  irpStaffToken,
  irpStaffEmail,
  irpStaffIsAuthenticated,
  isCheckingIrpStaff,
  checkIrpStaff,
  clearIrpStaff,
  setIrpStaffSession,
} from '../../lib/auth/irpStaff.ts';

// ─── Types ──────────────────────────────────────────────────────────────────

/**
 * AI-extracted shipping mode + packing tier classification + freeform
 * extracted facts. Mirrors `irp-funnel-server/helper/transcriptInsights.types.ts`.
 */
export type ShippingMode =
  | 'car_only_in_container'
  | 'car_roro_only'
  | 'car_via_rail'
  | '20ft_container'
  | '40ft_container'
  | '20ft_household'
  | '20ft_household_plus_car'
  | '40ft_household'
  | '40ft_household_plus_car'
  | 'lcl';

export type PackingTier =
  | 'self_pack_self_load'
  | 'self_pack_assisted_load'
  | 'full_pack_full_load'
  | 'lcl_full_service'
  | 'vehicle_only';


export interface TranscriptInsights {
  shippingMode: ShippingMode | null;
  packingTier: PackingTier | null;
  confidence: number;
  reasoning: string;
  extractedFields: Record<string, string | number | boolean | string[] | null>;
  generatedAt: string;
  source: 'gemini_notes' | 'transcript' | 'manual_paste' | 'chatbot_notes';
  model: string;
}

/** Calendar / Gemini-meeting-notes payload surfaced by `buildClientSummary`. */
export interface MeetingNotes {
  eventId: string | null;
  meetCode: string | null;
  hangoutLink: string;
  htmlLink: string;
  startTime: string | null;
  endTime: string | null;
  fetched: boolean;
  attempts: number;
  fetchedAt: string | null;
  docId: string | null;
  docTitle: string | null;
  text: string;
}

export interface Client {
  id: string;
  sessionId: string;
  name: string;
  surname: string;
  /**
   * Pre-computed display name for titles/cards. Falls back through the
   * chain: "Name Surname" → "Surname" → "Name" → email-prefix → docId.
   * NEVER contains the literal "Unknown" — the dashboard uses `nameKnown`
   * to apply special italic+"?" styling when the first name was never asked.
   */
  displayName: string;
  /** True iff the client's FIRST name was actually collected (not blank, not "Unknown"). */
  nameKnown: boolean;
  email: string;

  phone: string;
  originCountry: string;
  originCity: string;
  destinationCountry: string;
  destinationCity: string;
  budget: string;
  size: string;
  immigrationStatus: string;
  propertyTypeFrom: string;
  propertyTypeTo: string;
  vehicles: Array<{ year: string; make: string; model: string }>;
  scheduling: string[];
  stage: string;
  callOutcome: string | null;
  transcript: string;
  agentNotes: Note[];
  chatbotNotes: string[];
  chatHistory: Array<{ role: string; content: string }>;
  customFields: Record<string, string>;
  activityLog: ActivityEntry[];
  dripEnabled: boolean;
  consultationCount: number;
  lastUpdated: string;
  createdAt: string;
  /** Gemini meeting-notes payload + calendar metadata. */
  meetingNotes?: MeetingNotes;
  /** AI-extracted shipping/packing classification. `null` until extracted. */
  transcriptInsights?: TranscriptInsights | null;
  /**
   * Pending email suggestions from stage-change triggers. Populated by the
   * server whenever an operator moves the client into a stage with a
   * configured `STAGE_EMAIL_TRIGGERS` entry. Empty array for clients
   * without any pending suggestions (backward-compatible default).
   */
  pendingEmailSuggestions?: PendingEmailSuggestion[];
  /**
   * Field-agnostic pending actions. Each entry is self-describing via
   * `type` + `tab` + `meta`; the system never inspects `meta` directly.
   * Coexists with `pendingEmailSuggestions` for backward compatibility.
   * Unified with `pendingEmailSuggestions` by the `pendingCountByClient`
   * and `pendingTabsByClient` derived stores below.
   */
  pendingActions?: PendingAction[];
  /**
   * ISO timestamp of when the Pricing Summary email was last dispatched
   * to pricing@internationalrelocationpartner.com for this client.
   * `null` or `undefined` means it has never been sent.
   * Used to hide/show the "Send to Pricing" banner in the Overview tab.
   */
  pricingSentAt?: string | null;
  /**
   * The quote proposal template currently selected for THIS client (persisted
   * on the consultation doc by the AI auto-selector or a manual staff pick in
   * the quoting step). Drives the proposal rendered on the status page and the
   * default shown in the per-client template selector. `null`/absent → not yet
   * resolved (the quoting step will auto-resolve it on open). Backward-compatible.
   */
  selectedQuoteTemplateId?: string | null;
  /**
   * How `selectedQuoteTemplateId` was set: 'manual' (a deliberate staff
   * override, respected on reload) or 'auto' (resolved from the destination
   * mapping/AI — re-resolved when the panel re-opens so it tracks the live
   * mapping + destination). `null`/absent → treated as auto. Backward-compatible.
   */
  selectedQuoteTemplateSource?: 'manual' | 'auto' | null;
  /**
   * Full Firestore document (server strips a few large branches before
   * sending). Front-end uses this to show every key on the card and let
   * operators edit any field via the schema-agnostic PATCH endpoint.
   */
  rawDoc?: Record<string, any>;
}



export interface Note {
  text: string;
  author: string;
  createdAt: string;
  /**
   * Optional staff emails this note is addressed to. Each recipient is emailed
   * a notification when the note is created. Absent on legacy notes (backward
   * compatible — an un-targeted note behaves exactly as before).
   */
  recipients?: string[];
}

export interface ActivityEntry {
  type: string;
  actor: string;
  timestamp: string;
  from?: string;
  to?: string;
  fields?: string[];
  emailType?: string;
}

export interface LLMServiceBreakdown {
  cost: number;
  calls: number;
  inputTokens: number;
  outputTokens: number;
}

export interface WeeklySnapshot {
  weekKey: string;
  weekStart: string;
  weekEnd: string;
  totalCost: number;
  callCount: number;
  inputTokens: number;
  outputTokens: number;
  snapshotAt: string;
}

export interface Metrics {
  pipeline: {
    stageCounts: Record<string, number>;
    stageLabels: Record<string, string>;
    total: number;
  };
  outcomes: Record<string, number>;
  emailQueue: Record<string, number>;
  llmCosts: {
    totalCost: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    callCount: number;
    uniqueSessions: number;
    byProvider: Record<string, LLMServiceBreakdown>;
    byModel: Record<string, LLMServiceBreakdown>;
    dailyCosts: Record<string, number>;
    periodSpend: {
      thisWeek: number;
      thisMonth: number;
      thisYear: number;
    };
    weeklySnapshots: WeeklySnapshot[];
  };
  monthlyLeads: Record<string, number>;
  monthlyPaidUsers: Record<string, number>;
  sourceBreakdown: Record<string, number>;
  countryBreakdown: Record<string, number>;
  channelBreakdown: Record<string, number>;
}

export const STAGE_LABELS: Record<string, string> = {
  // Sales
  sales_opt_in_email: 'Opt-In Email',
  sales_preconsultation: 'Pre-Consultation',
  sales_no_show: 'No Show',
  sales_non_qualified: 'Non Qualified',
  sales_post_transcript: 'Post Transcript',
  private_feedback_a: 'Feedback A',
  sales_pricing_quote: 'Pricing Quote',
  sales_quoted: 'Quoted',
  sales_quote_acceptance: 'Quote Acceptance',
  sales_initial_payment: 'Initial Payment',
  sale_dropped: 'Sale Dropped',
  // Ops — Origin
  ops_self_packing: 'Self Packing',
  ops_full_packing: 'Full Packing',
  ops_loading: 'Loading',
  ops_container: 'Container',
  ops_exporting: 'Exporting',
  private_feedback_b: 'Feedback B',
  // Ops — Destination (Redestination)
  ops_destination_arrival: 'Destination Arrival',
  ops_redestination: 'Redestination',
  ops_container_mobilization: 'Container → Fiscal Warehouse',
  ops_container_unload: 'Container Unloading',
  ops_tax_calculation: 'Tax Calculation',
  ops_destination_invoice: 'Destination Costs Invoice',
  // Ops — Destination (Import & Delivery)
  ops_import: 'Import',
  ops_dua_customs: 'DUA Customs',
  ops_import_procedure: 'Import Procedure',
  ops_customs_inspection: 'Customs Inspection',
  ops_delivery_coordination: 'Delivery Coordination',
  ops_delivery: 'Delivery',
  ops_pod: 'Proof of Delivery (POD)',
  ops_insurance_claim: 'Insurance Claim',
  // Completion
  operations_done: 'Operations Done',
  refunds: 'Refunds',
  private_feedback_c: 'Feedback C',
  completed: 'Completed',
};

export const STAGE_ICONS: Record<string, string> = {
  // Sales
  sales_opt_in_email: '📧',
  sales_preconsultation: '📅',
  sales_no_show: '👻',
  sales_non_qualified: '🚷',
  sales_post_transcript: '📝',
  private_feedback_a: '💬',
  sales_pricing_quote: '💰',
  sales_quoted: '📋',
  sales_quote_acceptance: '✅',
  sales_initial_payment: '💳',
  sale_dropped: '💔',
  // Ops — Origin
  ops_self_packing: '📦',
  ops_full_packing: '📋',
  ops_loading: '🏗️',
  ops_container: '🚛',
  ops_exporting: '🚢',
  private_feedback_b: '💬',
  // Ops — Destination (Redestination)
  ops_destination_arrival: '🛬',
  ops_redestination: '🏭',
  ops_container_mobilization: '🚚',
  ops_container_unload: '📤',
  ops_tax_calculation: '🧮',
  ops_destination_invoice: '🧾',
  // Ops — Destination (Import & Delivery)
  ops_import: '🛃',
  ops_dua_customs: '📑',
  ops_import_procedure: '🔖',
  ops_customs_inspection: '🔍',
  ops_delivery_coordination: '📞',
  ops_delivery: '🚛',
  ops_pod: '📋',
  ops_insurance_claim: '🛡️',
  // Completion
  operations_done: '🎉',
  refunds: '💸',
  private_feedback_c: '💬',
  completed: '🏁',
};

export const STAGE_COLORS: Record<string, string> = {
  // Sales — warm purples/blues
  sales_opt_in_email: '#6366f1',
  sales_preconsultation: '#818cf8',
  sales_no_show: '#f87171',
  sales_non_qualified: '#94a3b8',
  sales_post_transcript: '#a78bfa',
  private_feedback_a: '#c084fc',
  sales_pricing_quote: '#8b5cf6',
  sales_quoted: '#9333ea',
  sales_quote_acceptance: '#7c3aed',
  sales_initial_payment: '#6d28d9',
  sale_dropped: '#dc2626',
  // Ops Origin — blues/cyans
  ops_self_packing: '#3b82f6',
  ops_full_packing: '#2563eb',
  ops_loading: '#1d4ed8',
  ops_container: '#0ea5e9',
  ops_exporting: '#0284c7',
  private_feedback_b: '#06b6d4',
  // Ops Destination Redestination — oranges/ambers
  ops_destination_arrival: '#f97316',
  ops_redestination: '#ea580c',
  ops_container_mobilization: '#d97706',
  ops_container_unload: '#b45309',
  ops_tax_calculation: '#f59e0b',
  ops_destination_invoice: '#eab308',
  // Ops Destination Import — teals/greens
  ops_import: '#14b8a6',
  ops_dua_customs: '#0d9488',
  ops_import_procedure: '#059669',
  ops_customs_inspection: '#047857',
  ops_delivery_coordination: '#10b981',
  ops_delivery: '#22c55e',
  ops_pod: '#16a34a',
  ops_insurance_claim: '#15803d',
  // Completion — greens/reds
  operations_done: '#166534',
  refunds: '#ef4444',
  private_feedback_c: '#64748b',
  completed: '#059669',
};

/**
 * STAGE_DESCRIPTIONS — one short sentence per column, so the team always knows
 * what each column is for. Surfaced in the Kanban column header (info tooltip)
 * and inside the client-card stage selector.
 * MIRRORS the backend source of truth `pipeline.ts → STAGE_DESCRIPTIONS`.
 * KEEP THE TWO IN SYNC.
 */
export const STAGE_DESCRIPTIONS: Record<string, string> = {
  // Sales
  sales_opt_in_email: 'Lead captured — opt-in email sent, awaiting engagement before a consultation is booked.',
  sales_preconsultation: 'Consultation booked — waiting for the scheduled discovery call to take place.',
  sales_no_show: 'Client did not attend their scheduled consultation call (auto-flagged once the call time passed).',
  sales_non_qualified: 'Client is not a fit for our service (out of scope / unrelated). Parked — no further sales actions.',
  sales_post_transcript: 'Call completed — reviewing the consultation transcript before pricing.',
  private_feedback_a: 'Internal feedback checkpoint after the consultation, before pricing.',
  sales_pricing_quote: "Building the pricing quote from the client's requirements.",
  sales_quoted: 'Quote sent to the client — awaiting their review.',
  sales_quote_acceptance: 'Client accepted the quote — preparing for the initial payment.',
  sales_initial_payment: 'Initial payment received — deal is won and moves into operations.',
  sale_dropped: 'Deal did not close after the payment stage. Internal terminal state.',
  // Ops — Origin
  ops_self_packing: 'Origin: client is self-packing their belongings.',
  ops_full_packing: 'Origin: our team is performing the full packing service.',
  ops_loading: 'Origin: loading the packed goods for transport.',
  ops_container: 'Origin: goods consolidated into the shipping container.',
  ops_exporting: 'Origin: export / customs clearance at the origin country.',
  private_feedback_b: 'Internal feedback checkpoint after origin operations.',
  // Ops — Destination (Redestination)
  ops_destination_arrival: 'Destination: shipment has arrived at the destination port / country.',
  ops_redestination: 'Destination: coordinating onward routing to the final destination.',
  ops_container_mobilization: 'Destination: moving the container to the fiscal / bonded warehouse.',
  ops_container_unload: 'Destination: unloading the container at the warehouse.',
  ops_tax_calculation: 'Destination: calculating import taxes and duties.',
  ops_destination_invoice: 'Destination: issuing the destination-costs invoice to the client.',
  // Ops — Destination (Import & Delivery)
  ops_import: 'Destination: import process underway.',
  ops_dua_customs: 'Destination: DUA customs declaration in progress.',
  ops_import_procedure: 'Destination: completing the formal import procedure.',
  ops_customs_inspection: 'Destination: goods undergoing customs inspection.',
  ops_delivery_coordination: 'Destination: coordinating the final delivery with the client.',
  ops_delivery: "Destination: delivering the goods to the client's address.",
  ops_pod: 'Destination: collecting proof of delivery (POD).',
  ops_insurance_claim: 'Handling an insurance claim for damaged / lost items.',
  // Completion
  operations_done: 'All operations complete — wrapping up the move.',
  refunds: 'Processing a refund for the client.',
  private_feedback_c: 'Final internal feedback checkpoint after the move.',
  completed: 'Move fully completed and closed.',
};

/**
 * CRM "stuck client" SLA thresholds — days a client may sit in a column before
 * the team is alerted. MIRRORS the backend source of truth
 * `irp-funnel-server/jobs/stageSla.ts → STAGE_SLA` (thresholdDays only).
 * KEEP THE TWO IN SYNC. Stages omitted here have NO SLA and are never flagged
 * overdue (e.g. sales_opt_in_email, sales_preconsultation, sale_dropped,
 * completed).
 */
export const STAGE_SLA_DAYS: Record<string, number> = {
  // Sales (alerts start at the post-transcript column)
  sales_post_transcript: 2,
  private_feedback_a: 2,
  sales_pricing_quote: 2,
  sales_quoted: 3,
  sales_quote_acceptance: 2,
  sales_initial_payment: 3,
  // Ops · Origin
  ops_self_packing: 7,
  ops_full_packing: 5,
  ops_loading: 3,
  ops_container: 4,
  ops_exporting: 7,
  private_feedback_b: 3,
  // Ops · Destination
  ops_destination_arrival: 14,
  ops_redestination: 7,
  ops_container_mobilization: 5,
  ops_container_unload: 4,
  ops_tax_calculation: 5,
  ops_destination_invoice: 4,
  // Ops · Import & Delivery
  ops_import: 7,
  ops_dua_customs: 7,
  ops_import_procedure: 7,
  ops_customs_inspection: 5,
  ops_delivery_coordination: 4,
  ops_delivery: 3,
  ops_pod: 3,
  ops_insurance_claim: 14,
  // Completion
  operations_done: 5,
  refunds: 7,
  private_feedback_c: 3,
};

export interface StageSlaStatus {
  /** True when the client's current stage has a configured SLA threshold. */
  hasSla: boolean;
  /** True when time-in-column has met or exceeded the threshold. */
  overdue: boolean;
  /** Whole days the client has spent in the current column. */
  daysInStage: number;
  /** The SLA threshold (days) for the current column, or null when no SLA. */
  thresholdDays: number | null;
  /** elapsed / threshold ratio (>= 1 ⇒ overdue); null when no SLA. */
  ratio: number | null;
}

/**
 * "Is this client stuck in its column?" — drives the pulsing warning gradient on
 * overdue Kanban cards/columns. Measures time since `rawDoc.stageEnteredAt`
 * (falling back to `lastUpdated` / `createdAt`) against the column's SLA
 * threshold. Stages without an SLA never report overdue, so terminal/early
 * columns stay calm.
 */
export function getStageSlaStatus(client: Client | null | undefined, now: number = Date.now()): StageSlaStatus {
  const stage = client?.stage ?? '';
  const thresholdDays = STAGE_SLA_DAYS[stage] ?? null;
  if (thresholdDays == null) {
    return { hasSla: false, overdue: false, daysInStage: 0, thresholdDays: null, ratio: null };
  }
  const enteredRaw =
    (client?.rawDoc?.stageEnteredAt as string) || client?.lastUpdated || client?.createdAt || '';
  const enteredMs = enteredRaw ? new Date(enteredRaw).getTime() : NaN;
  if (Number.isNaN(enteredMs)) {
    return { hasSla: true, overdue: false, daysInStage: 0, thresholdDays, ratio: 0 };
  }
  const MS_PER_DAY = 86_400_000;
  const elapsedMs = Math.max(0, now - enteredMs);
  const daysInStage = Math.floor(elapsedMs / MS_PER_DAY);
  const ratio = elapsedMs / (thresholdDays * MS_PER_DAY);
  return { hasSla: true, overdue: ratio >= 1, daysInStage, thresholdDays, ratio };
}

export interface StageJourneySegment {
  /** Pipeline stage key for this leg of the journey. */
  stage: string;
  /** Human label for the stage. */
  label: string;
  /** ISO timestamp the client entered this stage. */
  enteredAt: string;
  /** ISO timestamp the client left this stage, or null if still here. */
  leftAt: string | null;
  /** Milliseconds spent in this stage (live for the current stage). */
  durationMs: number;
  /** Whole days spent in this stage. */
  days: number;
  /** True for the stage the client is currently in. */
  current: boolean;
}

const MS_PER_DAY_J = 86_400_000;

/**
 * Reconstruct the chronological time-per-column journey for a client purely
 * from its `activityLog` stage_change entries + `createdAt` + the live
 * `stageEnteredAt`. No extra Firestore field is needed — every move already
 * records a timestamped `stage_change`, so the full history (and how long the
 * client spent in each column, in order) is derivable here.
 *
 * The last segment is always the client's CURRENT column with `leftAt: null`
 * and a live `durationMs` — which is exactly why the counter "resets" visually
 * when a card moves: the previous column's segment is closed and a fresh one
 * starts at 0.
 */
export function getStageJourney(
  client: Client | null | undefined,
  now: number = Date.now(),
): StageJourneySegment[] {
  if (!client) return [];

  const log = Array.isArray(client.activityLog) ? client.activityLog : [];
  const changes = log
    .filter((e) => e && e.type === 'stage_change' && e.timestamp)
    .map((e) => ({ from: e.from ?? null, to: e.to ?? null, timestamp: e.timestamp }))
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  const createdAt =
    client.createdAt ||
    (client.rawDoc?.createdAt as string) ||
    changes[0]?.timestamp ||
    new Date(now).toISOString();

  const segments: StageJourneySegment[] = [];

  // The first leg's stage is the `from` of the first change, else the client's
  // current stage (when there were never any logged moves).
  let currentStage =
    changes.length > 0 && changes[0].from ? (changes[0].from as string) : client.stage;
  let enteredAt = createdAt;

  for (const ch of changes) {
    const startMs = new Date(enteredAt).getTime();
    const endMs = new Date(ch.timestamp).getTime();
    const durationMs = Math.max(
      0,
      (Number.isNaN(endMs) ? now : endMs) - (Number.isNaN(startMs) ? now : startMs),
    );
    segments.push({
      stage: currentStage,
      label: STAGE_LABELS[currentStage] || currentStage,
      enteredAt,
      leftAt: ch.timestamp,
      durationMs,
      days: Math.floor(durationMs / MS_PER_DAY_J),
      current: false,
    });
    currentStage = (ch.to as string) || currentStage;
    enteredAt = ch.timestamp;
  }

  // Open (current) segment — authoritative stage from the client record, and
  // the live clock anchored on stageEnteredAt when available.
  const finalStage = client.stage || currentStage;
  const liveEnteredAt = (client.rawDoc?.stageEnteredAt as string) || enteredAt;
  const liveStartMs = new Date(liveEnteredAt).getTime();
  const liveDurationMs = Math.max(0, now - (Number.isNaN(liveStartMs) ? now : liveStartMs));
  segments.push({
    stage: finalStage,
    label: STAGE_LABELS[finalStage] || finalStage,
    enteredAt: liveEnteredAt,
    leftAt: null,
    durationMs: liveDurationMs,
    days: Math.floor(liveDurationMs / MS_PER_DAY_J),
    current: true,
  });

  return segments;
}


// ─── Server-driven email type registry ──────────────────────────────────────
//
// EmailTypeDescriptor mirrors the shape returned by GET /api/dashboard/email-types.
// The frontend no longer maintains an authoritative list of email types.
// Instead:
//   1. emailTypes is pre-seeded with the existing EMAIL_TYPES constant so the
//      UI renders immediately on first load (no flicker, no empty dropdown).
//   2. fetchEmailTypes() refreshes it from the server; called once on dashboard init.
//   3. All components that previously iterated EMAIL_TYPES can switch to
//      `$emailTypes` with no other logic changes — the data shape is identical.
//
export interface EmailTypeDescriptor {
  value: string;
  label: string;
  subject?: string;
  category?: 'sales' | 'ops' | 'followup';
}

// Static fallback — kept for backward compat (existing imports keep working).
// Do NOT add new email types here; add them to renderEmail.ts EMAIL_LABELS instead.
export const EMAIL_TYPES = [
  { value: 'pre_call_confirmation', label: 'Pre-Call Confirmation' },
  { value: 'pre_call_guide', label: 'Pre-Call Guide' },
  { value: 'no_show_1', label: 'No Show Follow-up' },
  { value: 'nurture_feedback', label: 'Nurture: Feedback' },
  { value: 'nurture_newsletter', label: 'Nurture: Newsletter' },
  { value: 'nurture_youtube', label: 'Nurture: YouTube' },
  { value: 'quote_recap', label: 'Quote Recap' },
  { value: 'quote_checkin', label: 'Quote Check-in' },
  { value: 'quote_proposal_feedback',   label: 'Quote Proposal Feedback' },
  // Ops stage emails (additive — match renderEmail.ts EMAIL_SUBJECTS)
  { value: 'ops_provider_date_request', label: '📦 Provider Date Request (Ops)' },
  { value: 'ops_arrival_confirmation',  label: '🚢 Arrival Confirmation (Ops)' },
  // ETA confirmation loop
  { value: 'ops_etd_provider_request',  label: '📧 ETD/ETA Request → Provider' },
  { value: 'ops_etd_ops_escalation',    label: '⚠️ ETA Escalation → Ops' },
  { value: 'ops_etd_sales_escalation',  label: '🚨 ETA Escalation → Sales' },
  { value: 'ops_eta_client_update',     label: '✅ ETA Confirmed → Client' },
  // Follow-up
  { value: 'followup_no_reply',         label: '👋 Follow-up — No Reply' },
];

/**
 * Pretty labels + emojis for AI-extracted shipping modes. Mirrors the server
 * `SHIPPING_MODE_LABEL` in helper/transcriptInsights.types.ts.
 */
export const SHIPPING_MODE_LABEL: Record<ShippingMode, { icon: string; label: string }> = {
  car_only_in_container:    { icon: '🚗',   label: 'Car only — container'    },
  car_roro_only:            { icon: '🚙',   label: 'Car only — RoRo'         },
  car_via_rail:             { icon: '🚆',   label: 'Car — rail'              },
  '20ft_container':         { icon: '📦',   label: '20 ft FCL'               },
  '40ft_container':         { icon: '📦',   label: '40 ft FCL'               },
  '20ft_household':         { icon: '🏠',   label: '20 ft — household'       },
  '20ft_household_plus_car':{ icon: '🏠🚗', label: '20 ft — household + car' },
  '40ft_household':         { icon: '🏠',   label: '40 ft — household'       },
  '40ft_household_plus_car':{ icon: '🏠🚗', label: '40 ft — household + car' },
  lcl:                      { icon: '🧊',   label: 'LCL (2–7 m³)'            },
};

export const PACKING_TIER_LABEL: Record<PackingTier, { icon: string; label: string }> = {
  self_pack_self_load:     { icon: '👤',  label: 'Self pack & load'      },
  self_pack_assisted_load: { icon: '👥',  label: 'Self pack, crew loads' },
  full_pack_full_load:     { icon: '🛡️',  label: 'Full pack & load'      },
  lcl_full_service:        { icon: '🚚',  label: 'LCL — full service'    },
  vehicle_only:            { icon: '🚗',  label: 'Vehicle only'          },
};


/** Human-friendly labels for canonical Firestore field paths. */
export const FIELD_LABEL: Record<string, string> = {
  name: 'First Name',
  surname: 'Surname',
  email: 'Email',
  phone: 'Phone',
  originCountry: 'Origin Country',
  originCity: 'Origin City',
  destinationCountry: 'Destination Country',
  destinationCity: 'Destination City',
  budget: 'Budget',
  size: 'Move Size',
  immigrationStatus: 'Immigration Status',
  propertyTypeFrom: 'Property Type (Origin)',
  propertyTypeTo: 'Property Type (Destination)',
  vehicles: 'Vehicles',
  scheduling: 'Scheduling',
  pipelineStage: 'Pipeline Stage',
  callOutcome: 'Call Outcome',
  transcript: 'Transcript',
  notes: 'Notes',
  customFields: 'Custom Fields',
  dripEnabled: 'Drip Email Active',
  dripEmail: 'Drip Email Address',
  consultations: 'Consultations',
  // ── Shipment & Logistics (ops)
  shippingMethod: 'Shipping Method',
  serviceScope: 'Service Scope',
  estimatedVolumeCBM: 'Est. Volume (m³)',
  confirmedVolumeCBM: 'Confirmed Volume (m³)',
  confirmedShippingMethod: 'Confirmed Shipping Method',
  packingDate: 'Packing Start Date',
  loadingDate: 'Loading / Pickup Date',
  moveDate: 'Move Date',
  etd: 'ETD — Est. Departure Date',
  transitTimeDays: 'Transit Time (days)',
  eta: 'ETA — Est. Arrival Date',
  etdConfirmedAt: 'ETD Confirmed At',
  etaConfirmedAt: 'ETA Confirmed At',
  originAgentEmail: 'Origin Agent Email',
  destinationAgentEmail: 'Destination Agent Email',
};

/** Best-effort humanizer for any field path the dashboard renders. */
export function humanizeFieldLabel(path: string): string {
  if (!path) return '';
  // Use the explicit map first
  if (FIELD_LABEL[path]) return FIELD_LABEL[path];
  // For nested paths like "consultations.0.budget" → take the last segment
  const lastSeg = path.split(/[.[]/).pop()?.replace(/\]/g, '') || path;
  if (FIELD_LABEL[lastSeg]) return FIELD_LABEL[lastSeg];
  // camelCase → "Camel Case"
  return lastSeg
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
}


// ─── Stores ─────────────────────────────────────────────────────────────────
//
// Auth stores are sourced from the centralized `$lib/auth/irpStaff` module so
// that signing in here is immediately observable by every other page that
// gates IRP-staff access (e.g. /status/[id], /guides). The legacy export
// names (`authToken`, `authEmail`, `isAuthenticated`, `isCheckingAuth`) are
// preserved as aliases so the existing dashboard UI keeps working unchanged.
export const authToken = irpStaffToken;
export const authEmail = irpStaffEmail;
export const isAuthenticated = irpStaffIsAuthenticated;
export const isCheckingAuth = isCheckingIrpStaff;
export const clients = writable<Client[]>([]);
export const selectedClient = writable<Client | null>(null);
export const metrics = writable<Metrics | null>(null);
export const loading = writable<boolean>(false);
export const error = writable<string | null>(null);
// Board-specific loading state. The Kanban skeleton must track the CLIENTS
// fetch specifically — NOT the shared `loading` flag, which fetchMetrics()
// (running in parallel) also toggles and would otherwise end the skeleton
// animation before the cards are actually ready.
export const clientsLoading = writable<boolean>(false);
// Flips true only after the FIRST successful clients fetch, so the board keeps
// showing skeletons (never a premature empty "No clients" state) until real
// data has arrived at least once.
export const clientsLoadedOnce = writable<boolean>(false);
export const searchQuery = writable<string>('');


export interface Filters {
  stage: string;
  originCountry: string;
  destinationCountry: string;
  budget: string;
  size: string;
  callOutcome: string;
}

export const filters = writable<Filters>({
  stage: '',
  originCountry: '',
  destinationCountry: '',
  budget: '',
  size: '',
  callOutcome: ''
});

export const activeView = writable<'board' | 'list' | 'metrics' | 'evo' | 'providers' | 'posts' | 'admin' | 'templates'>('board');
export const detailPanelOpen = writable<boolean>(false);

/**
 * Incrementing this store signals `DetailPanel.svelte` to re-fetch
 * the live chat history if the Conversations tab is currently open.
 */
export const triggerConversationRefetch = writable<number>(0);

/**
 * The id of the `sentEmails/{autoId}` snapshot currently shown in the
 * <EmailPreviewDrawer>. Setting it to a non-empty string opens the drawer
 * and triggers a fetch; setting it to `null` closes the drawer. Driven by
 * clicks on the Emails-tab "Sent emails (N)" rows in <DetailPanel>.
 */
export const selectedSentEmailId = writable<string | null>(null);

/**
 * A pending email suggestion — created by the server when an operator moves
 * a client into a stage that has an email trigger configured. The suggestion
 * sits in the client's `pendingEmailSuggestions` array until the operator
 * either confirms (sends) or dismisses it. Only "pending" entries are
 * surfaced; everything else has already been resolved.
 */
export interface PendingEmailSuggestion {
  suggestionId: string;
  emailType: string;
  triggeredByStage: string;
  suggestedAt: string;
  movedByActor: string;
  status: 'pending';
}

/**
 * Field-agnostic pending action.
 *
 * The system treats every kind of outstanding operator task identically —
 * it does NOT inspect `meta` or hardcode knowledge of Firestore fields.
 * Callers describe what they need via `type` + `tab`; the rest lives in
 * `meta` and is only read by the component that renders that specific type.
 *
 * This mirrors `irp-funnel-server/API/dashboard/pendingActions.ts`.
 */
export interface PendingAction {
  /** Unique id (server assigns a nanoid/ulid). */
  actionId: string;
  /**
   * Category — controls how the action is presented and which notification
   * template is used when routing to `assignedTo` actors.
   * Extensible: add new literals here as new workflows emerge.
   */
  type:
    | 'email_suggestion'   // stage-change triggered email to preview + send
    | 'action_suggestion'  // recommended pipeline action to execute
    | 'follow_up'          // scheduled / overdue manual follow-up
    | 'manual';            // ad-hoc task created by an operator
  /**
   * Detail Panel tab that "owns" this action.
   * Drives which tab receives a badge count and which section is highlighted
   * when the Panel opens. Also used by `pendingTabsByClient`.
   */
  tab: 'emails' | 'actions' | 'notes' | 'overview' | 'activity' | 'quotes';
  /** Short human-readable label shown in the badge tooltip + notification. */
  title: string;
  priority: 'high' | 'normal' | 'low';
  /**
   * Org-actor emails that receive a notification when this action is
   * resolved (sent, executed, dismissed). Empty → no notification.
   */
  assignedTo: string[];
  /** Actor (email or 'system') that created this pending action. */
  triggeredBy: string;
  /** ISO 8601 creation timestamp. */
  triggeredAt: string;
  status: 'pending' | 'done' | 'dismissed';
  /**
   * All type-specific payload. The core system never reads this map.
   * Only the component responsible for rendering that `type` interprets it.
   */
  meta: Record<string, unknown>;
  /** Denormalized client id — used by aggregate queries on the backend. */
  clientId: string;
}

/**
 * Pre-send preview state — populated by the Emails tab when the operator
 * clicks "Preview & Send". When non-null, EmailPreviewDrawer enters
 * "pre-send mode": shows the rendered email with an editable body and a
 * Send/Cancel footer instead of the historical engagement view.
 * Setting back to `null` closes the pre-send drawer.
 */
export interface PresendEmailData {
  /** The client doc-id (used for the trigger-email call on confirm). */
  clientId: string;
  /** The email type key, e.g. "pre_call_confirmation". */
  emailType: string;
  /** Email address the message will go to. */
  clientEmail: string;
  /** Rendered subject line from the preview endpoint. */
  subject: string;
  /** Fully-rendered HTML body from the preview endpoint. */
  bodyHtml: string;
  /** Template context dict — shown in the collapsible context panel. */
  context: Record<string, unknown>;
  /**
   * Set when the drawer was opened from a pending suggestion so the
   * backend can clear it atomically on send.
   */
  suggestionId?: string;
}
export const presendEmail = writable<PresendEmailData | null>(null);

// Note: localStorage persistence for `authToken` / `authEmail` is owned by
// `$lib/auth/irpStaff` (the underlying source of truth). No duplicate
// subscriptions needed here.

// ─── Derived: filtered clients ──────────────────────────────────────────────
export const filteredClients = derived([clients, searchQuery, filters], ([$clients, $search, $filters]) => {
  const q = $search.toLowerCase().trim();

  return $clients.filter(c => {
    // 1. Text search
    if (q) {
      const haystack = `${c.name} ${c.surname} ${c.email} ${c.phone} ${c.originCountry} ${c.destinationCountry} ${c.originCity} ${c.destinationCity}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }

    // 2. Field filters
    if ($filters.stage && c.stage !== $filters.stage) return false;
    if ($filters.originCountry && c.originCountry !== $filters.originCountry) return false;
    if ($filters.destinationCountry && c.destinationCountry !== $filters.destinationCountry) return false;
    if ($filters.budget && c.budget !== $filters.budget) return false;
    if ($filters.size && c.size !== $filters.size) return false;
    
    if ($filters.callOutcome) {
      if ($filters.callOutcome === 'none') {
        if (c.callOutcome) return false;
      } else {
        if (c.callOutcome !== $filters.callOutcome) return false;
      }
    }

    return true;
  });
});

// ─── Derived: clients grouped by stage ──────────────────────────────────────
export const clientsByStage = derived(filteredClients, ($filtered) => {
  const stages = Object.keys(STAGE_LABELS);
  const grouped: Record<string, Client[]> = {};
  for (const s of stages) grouped[s] = [];

  for (const c of $filtered) {
    const stage = c.stage || 'sales_opt_in_email';
    // Create the bucket on demand if the stage isn't in STAGE_LABELS yet
    // (prevents unknown-stage clients silently falling into sales_opt_in_email).
    if (!grouped[stage]) grouped[stage] = [];
    grouped[stage].push(c);
  }
  return grouped;
});

// ─── Derived: pending-action aggregate maps ──────────────────────────────────
//
// Both stores derive from `clients` (already kept live by the Socket.IO
// db_update listener) so they update in real-time with zero extra wiring.
//
// These are the ONLY places in the codebase that understand how to count
// pending items from both `pendingEmailSuggestions` (legacy) and the new
// `pendingActions` array. Everything else — card badges, tab badges,
// in-tab highlights — reads from these two aggregates.

/**
 * Total pending-action count per client id.
 * Unified over both `pendingEmailSuggestions` and `pendingActions`.
 * Used by <PendingBadge variant="card"> on every Kanban card.
 *
 * Map is empty for a client with no pending items.
 */
export const pendingCountByClient = derived(clients, ($clients): Map<string, number> => {
  const map = new Map<string, number>();
  for (const c of $clients) {
    const emailCount  = (c.pendingEmailSuggestions || []).filter(s => s.status === 'pending').length;
    const actionCount = (c.pendingActions         || []).filter(a => a.status === 'pending').length;
    const total = emailCount + actionCount;
    if (total > 0) map.set(c.id, total);
  }
  return map;
});

/**
 * Per-tab pending count per client id.
 * Key: clientId → inner Map<tabKey, count>.
 * `pendingEmailSuggestions` always maps to the `'emails'` tab.
 * `pendingActions` route to whatever `action.tab` specifies.
 *
 * Used by <PendingBadge variant="tab"> inside the Detail Panel tab nav.
 */
export const pendingTabsByClient = derived(clients, ($clients): Map<string, Map<string, number>> => {
  const outer = new Map<string, Map<string, number>>();
  for (const c of $clients) {
    const tabCounts = new Map<string, number>();
    for (const s of (c.pendingEmailSuggestions || [])) {
      if (s.status === 'pending') tabCounts.set('emails', (tabCounts.get('emails') ?? 0) + 1);
    }
    for (const a of (c.pendingActions || [])) {
      if (a.status === 'pending') tabCounts.set(a.tab, (tabCounts.get(a.tab) ?? 0) + 1);
    }
    if (tabCounts.size > 0) outer.set(c.id, tabCounts);
  }
  return outer;
});

// ─── Pending-action store functions ──────────────────────────────────────────

/**
 * Create a new field-agnostic pending action on a client.
 * The system does not inspect or validate `action.meta`.
 */
export async function addPendingAction(
  clientId: string,
  action: Omit<PendingAction, 'actionId' | 'clientId'>,
): Promise<PendingAction> {
  const data = await apiFetch(`/api/dashboard/clients/${clientId}/pending-action`, {
    method: 'POST',
    body: JSON.stringify(action),
  });
  return data.pendingAction as PendingAction;
}

/**
 * Resolve (mark done or dismissed) a pending action and trigger org
 * notifications to all `assignedTo` actors.
 */
export async function resolvePendingAction(
  clientId: string,
  actionId: string,
  resolution: 'done' | 'dismissed',
): Promise<void> {
  await apiFetch(
    `/api/dashboard/clients/${clientId}/pending-action/${actionId}/resolve`,
    {
      method: 'PATCH',
      body: JSON.stringify({ resolution }),
    },
  );
  // Optimistically update local state so badges disappear immediately
  const patch = (c: Client | null): Client | null => {
    if (!c || c.id !== clientId) return c;
    return {
      ...c,
      pendingActions: (c.pendingActions || []).map(a =>
        a.actionId === actionId ? { ...a, status: resolution } : a,
      ),
    };
  };
  clients.update(list => list.map(c => patch(c) ?? c));
  selectedClient.update(c => patch(c));
}

// ─── API helper ─────────────────────────────────────────────────────────────
export function getApiUrl(): string {
  if (browser && window.location.origin.startsWith('http://localhost')) {
    return 'http://localhost:8000';
  }
  return 'https://irp-funnel-server.onrender.com';
}


async function apiFetch(path: string, options: RequestInit = {}): Promise<any> {
  const token = get(authToken);
  const url = `${getApiUrl()}${path}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };
  if (token) headers['x-dashboard-token'] = token;

  const res = await fetch(url, { ...options, headers });

  // Parse the body defensively. A cold/slow server — or a proxy/gateway in
  // front of it (e.g. Render waking up) — can return a NON-JSON payload such
  // as a 502 HTML page or an empty body. Calling res.json() directly would
  // then throw an opaque SyntaxError. We read the text first and JSON.parse
  // inside a try so callers get a clean, retryable Error that carries the
  // HTTP status instead.
  const raw = await res.text();
  let data: any = null;
  // `parsedOk` distinguishes "body parsed fine" (incl. an empty body or a
  // legitimate JSON `null`) from "body was non-JSON garbage". This keeps the
  // wrapper 100% backward compatible: valid responses behave exactly as before
  // (res.json()), and only a genuinely malformed body becomes a retryable error.
  let parsedOk = true;
  if (raw) {
    try { data = JSON.parse(raw); } catch { parsedOk = false; }
  }

  if (!res.ok) {
    if (res.status === 401) {
      // Session expired
      authToken.set(null);
      authEmail.set(null);
      isAuthenticated.set(false);
    }
    throw new Error((data && data.error) || `Request failed: ${res.status}`);
  }

  // 2xx but the body wasn't valid JSON (e.g. a cold-start gateway HTML page) →
  // surface a clean, retryable error rather than handing back garbage.
  if (!parsedOk) {
    throw new Error('Malformed response from server.');
  }
  return data;
}



// ─── Auth actions ───────────────────────────────────────────────────────────
export async function requestOTP(email: string): Promise<string> {
  const data = await apiFetch('/api/dashboard/auth/request-otp', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
  return data.message;
}

export async function verifyOTP(email: string, code: string): Promise<void> {
  const data = await apiFetch('/api/dashboard/auth/verify-otp', {
    method: 'POST',
    body: JSON.stringify({ email: email.trim(), code: code.trim() }),
  });
  // Persist via the centralized helper so every other page that gates on
  // IRP staff (e.g. /status/[id], /guides) sees the new session immediately.
  setIrpStaffSession(data.token, data.email);
}

export async function checkAuth(): Promise<boolean> {
  // Delegate to the centralized check so every page shares one source of
  // truth (and one network round-trip on initial load).
  return checkIrpStaff();
}

export function logout() {
  // Clearing the staff stores propagates to /dashboard, /status/[id], and
  // /guides simultaneously — staff are signed out everywhere at once.
  clearIrpStaff();
}

// ─── Socket ─────────────────────────────────────────────────────────────────
let dashboardSocket: any = null;
let reconnectInterval: any;
let fetchTimeouts: Record<string, NodeJS.Timeout> = {};

export async function initDashboardSocket() {
  if (!browser || dashboardSocket) return;
  const token = get(authToken);
  const email = get(authEmail);
  if (!token || !email) return;

  try {
    const { io } = await import('socket.io-client');
    dashboardSocket = io(getApiUrl(), { path: '/socket-io' });

    dashboardSocket.on('connect', () => {
      console.log('[DASHBOARD SOCKET] Connected');
      dashboardSocket.emit('dashboard_register', { email, token });
    });

    dashboardSocket.on('pending_emails_updated', (data: any) => {
      const { consultationDocId } = data || {};
      if (!consultationDocId) return;
      // Refresh pending emails for this client if they're currently open
      const current = get(selectedClient);
      if (current && current.id === consultationDocId) {
        fetchPendingEmails(consultationDocId);
      }
    });

    dashboardSocket.on('db_update', (data: any) => {
      // Debounce logic
      const { collection, document: docId, action, actorEmail } = data;
      
      if (collection === 'consultations') {
        if (fetchTimeouts[docId]) clearTimeout(fetchTimeouts[docId]);
        
        fetchTimeouts[docId] = setTimeout(async () => {
          // KEY-AWARE REFETCH: Avoid fetching the entire collection to prevent mass read spikes.
          if (action === 'delete') {
            clients.update(list => list.filter(c => c.id !== docId));
            const selected = get(selectedClient);
            if (selected && selected.id === docId) selectedClient.set(null);
          } else {
            // For 'post', 'put', 'patch', we fetch ONLY the single mutated document
            try {
              const freshClient = await apiFetch(`/api/dashboard/clients/${docId}`);
              
              clients.update(list => {
                const exists = list.some(c => c.id === docId);
                if (exists) {
                  return list.map(c => c.id === docId ? { ...c, ...freshClient } : c);
                } else {
                  return [freshClient, ...list];
                }
              });

              // Update the Detail Panel if it's currently showing this client
              const selected = get(selectedClient);
              if (selected && selected.id === docId) {
                selectedClient.set(freshClient);
              }
            } catch (err) {
              console.error(`Failed to selectively refetch client ${docId}`, err);
            }
          }

          // Only fetch expensive collection-scanning metrics if the user is actively staring at the Metrics tab.
          if (get(activeView) === 'metrics') {
            await fetchMetrics();
          }

          delete fetchTimeouts[docId];
        }, 500);
      } 
      else if (collection === 'irp_chatbot_threads') {
        // 4. Live Chat History Update
        if (fetchTimeouts['chatbot_threads']) clearTimeout(fetchTimeouts['chatbot_threads']);
        fetchTimeouts['chatbot_threads'] = setTimeout(() => {
          triggerConversationRefetch.update(n => n + 1);
          delete fetchTimeouts['chatbot_threads'];
        }, 300);
      }
      else if (collection.startsWith('evo_')) {
        // 5. Live Evolutionary UI Update
        if (fetchTimeouts['evo']) clearTimeout(fetchTimeouts['evo']);
        fetchTimeouts['evo'] = setTimeout(async () => {
          if (get(activeView) === 'evo') {
            const evoStore = await import('./components/evo/evoStore.ts');
            await Promise.all([evoStore.fetchTimeline(), evoStore.fetchLeaderboard()]);
          }
          delete fetchTimeouts['evo'];
        }, 500);
      }
    });

    dashboardSocket.on('disconnect', () => {
      console.log('[DASHBOARD SOCKET] Disconnected');
    });

  } catch (err) {
    console.error('Failed to init dashboard socket', err);
  }
}

export function disconnectDashboardSocket() {
  if (dashboardSocket) {
    dashboardSocket.disconnect();
    dashboardSocket = null;
  }
}

// ─── Data actions ───────────────────────────────────────────────────────────
/**
 * Load all clients for the Kanban/list views.
 *
 * Robustness contract (fixes the "skeleton ends → empty board, stuck" bug):
 *  • Drives the dedicated `clientsLoading` flag (NOT the shared `loading`,
 *    which fetchMetrics() also toggles) so the board skeleton ends exactly
 *    when the cards are ready — never when a parallel fetch happens to finish.
 *  • Retries transient failures (cold-start 502s, dropped sockets, malformed
 *    gateway bodies) with backoff, keeping the skeleton up across attempts so
 *    a first-load hiccup self-heals instead of landing in a dead empty state.
 *  • `clientsLoadedOnce` flips true only after a SUCCESSFUL load, letting the
 *    UI distinguish "genuinely zero clients" from "failed to load".
 */
export async function fetchClients(): Promise<void> {
  loading.set(true);
  clientsLoading.set(true);
  error.set(null);

  // attempt 0 is immediate; subsequent attempts wait these many ms.
  const RETRY_DELAYS = [600, 1200, 2400];
  let lastErr: any = null;

  for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
    try {
      const data = await apiFetch('/api/dashboard/clients');
      clients.set(Array.isArray(data?.clients) ? data.clients : []);
      clientsLoadedOnce.set(true);
      error.set(null);
      lastErr = null;
      break;
    } catch (err: any) {
      lastErr = err;
      // A cleared auth token means the failure was a 401 (session expired) —
      // not transient. Stop retrying and let the auth gate take over.
      if (!get(authToken)) break;
      if (attempt < RETRY_DELAYS.length) {
        await new Promise((r) => setTimeout(r, RETRY_DELAYS[attempt]));
      }
    }
  }

  if (lastErr) error.set(lastErr.message ?? 'Failed to load clients.');

  clientsLoading.set(false);
  loading.set(false);
}


export async function fetchClientDetail(id: string): Promise<Client> {
  const data = await apiFetch(`/api/dashboard/clients/${id}`);
  selectedClient.set(data);
  return data;
}

export async function updateClientStage(id: string, stage: string): Promise<void> {
  await apiFetch(`/api/dashboard/clients/${id}/stage`, {
    method: 'PATCH',
    body: JSON.stringify({ stage }),
  });
  // Update local state
  clients.update(list =>
    list.map(c => c.id === id ? { ...c, stage } : c)
  );
  selectedClient.update(c => c && c.id === id ? { ...c, stage } : c);
}

export async function updateClientFields(id: string, customFields: Record<string, string>): Promise<void> {
  await apiFetch(`/api/dashboard/clients/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ customFields }),
  });
  clients.update(list =>
    list.map(c => c.id === id ? { ...c, customFields: { ...c.customFields, ...customFields } } : c)
  );
  selectedClient.update(c => c && c.id === id ? { ...c, customFields: { ...c.customFields, ...customFields } } : c);
}

export async function addNote(id: string, text: string, recipients?: string[]): Promise<Note> {
  const clean = Array.isArray(recipients)
    ? [...new Set(recipients.filter((e) => typeof e === 'string' && e.includes('@')).map((e) => e.trim().toLowerCase()))]
    : [];
  const data = await apiFetch(`/api/dashboard/clients/${id}/notes`, {
    method: 'POST',
    body: JSON.stringify(clean.length > 0 ? { text, recipients: clean } : { text }),
  });
  const note = data.note;
  clients.update(list =>
    list.map(c => c.id === id ? { ...c, agentNotes: [...(c.agentNotes || []), note] } : c)
  );
  selectedClient.update(c => c && c.id === id ? { ...c, agentNotes: [...(c.agentNotes || []), note] } : c);
  return note;
}

export async function fetchConversations(
  id: string,
  email?: string,
): Promise<{ conversations: any[]; statusChatThread: any[] }> {
  console.log(`[CLIENT FETCH] Starting fetchConversations for client ID: ${id}`);
  console.log(`[CLIENT FETCH] Provided email param: ${email}`);
  const params = email ? `?email=${encodeURIComponent(email)}` : '';
  const endpoint = `/api/dashboard/clients/${id}/conversations${params}`;
  console.log(`[CLIENT FETCH] Full relative endpoint: ${endpoint}`);

  try {
    const data = await apiFetch(endpoint);
    console.log(`[CLIENT FETCH] Response SUCCESS from server!`);
    console.log(`[CLIENT FETCH] Raw data parsed from JSON:`, data);

    return {
      conversations: Array.isArray(data?.conversations) ? data.conversations : [],
      // statusChatThread is the status-page Lily thread — new optional field,
      // falls back to [] for older server versions (backward compatible).
      statusChatThread: Array.isArray(data?.statusChatThread) ? data.statusChatThread : [],
    };
  } catch (error) {
    console.error(`[CLIENT FETCH] ERROR fetching conversations for ${id}:`, error);
    throw error;
  }
}

export async function fetchCollectionData(collection: string): Promise<any[]> {
  const data = await apiFetch(`/api/dashboard/bi/${collection}`);
  return data.documents || [];
}

/**
 * Thin wrapper kept for backward-compatibility.
 * Internally delegates to `triggerEmailWithEdit` which is the canonical
 * implementation supporting optional edit attribution + suggestion resolution.
 */
export async function triggerEmail(id: string, emailType: string): Promise<void> {
  return triggerEmailWithEdit(id, emailType);
}

export async function fetchMetrics(): Promise<void> {
  loading.set(true);
  try {
    const data = await apiFetch('/api/dashboard/metrics');
    metrics.set(data);
  } catch (err: any) {
    error.set(err.message);
  } finally {
    loading.set(false);
  }
}

// ─── Kanban Actions ─────────────────────────────────────────────────────────

export interface ActionArgSchema {
  label: string;
  type: 'string' | 'number' | 'date' | 'boolean' | 'enum';
  required?: boolean;
  defaultValue?: string | number | boolean;
  options?: string[];
  placeholder?: string;
}

export interface ActionSchemaForClient {
  description: string;
  args: Record<string, ActionArgSchema>;
}

export type ClientActionsPayload = Record<string, ActionSchemaForClient>;

/**
 * Fetch actions for a client.
 * Pass an optional `stage` to retrieve actions for a different pipeline stage
 * than the client's current one (cross-stage selector in the Actions tab).
 * When omitted the server returns the client's own stage actions.
 */
export async function fetchClientActions(
  id: string,
  stage?: string,
): Promise<{ stage: string; clientStage: string; actions: ClientActionsPayload }> {
  const url = stage
    ? `/api/dashboard/clients/${id}/actions?stage=${encodeURIComponent(stage)}`
    : `/api/dashboard/clients/${id}/actions`;
  const data = await apiFetch(url);
  return { stage: data.stage || stage || '', clientStage: data.clientStage || data.stage || '', actions: data.actions || {} };
}

/**
 * @deprecated Use `fetchClientActions(id, stage)` instead.
 * Kept as a thin alias so any call sites that haven't been migrated yet
 * continue to work without any changes.
 */
export async function fetchClientActionsForStage(
  id: string,
  stage: string,
): Promise<{ stage: string; clientStage: string; actions: ClientActionsPayload }> {
  return fetchClientActions(id, stage);
}

export async function executeClientAction(
  id: string,
  actionKey: string,
  args: Record<string, any>
): Promise<{ success: boolean; result: any }> {
  const data = await apiFetch(`/api/dashboard/clients/${id}/actions/${actionKey}`, {
    method: 'POST',
    body: JSON.stringify({ args }),
  });
  return data;
}

// ─── Schema-agnostic field editor + Undo + AI insights ─────────────────────

/** Result returned by `editField()`. */
export interface EditFieldResult {
  success: boolean;
  path: string;
  oldValue: unknown;
  newValue: unknown;
  entry: ActivityEntry & { fieldPath: string; oldValue: unknown; newValue: unknown };
}

/**
 * Edit ANY field on the consultation document via the schema-agnostic
 * server endpoint. The server appends a `field_edit` entry to the
 * activityLog, including the actor's email + timestamp.
 *
 *   await editField('b1e537da', 'originCity', 'Orlando');
 *   await editField('b1e537da', 'consultations.0.budget', '5000-10000');
 *   await editField('b1e537da', 'customFields.driverPref', 'manual');
 *
 * Pass `expectedOldValue` for optimistic concurrency. The server returns
 * 409 if the value was changed by another user since you read it.
 */
export async function editField(
  id: string,
  path: string,
  value: unknown,
  expectedOldValue?: unknown,
): Promise<EditFieldResult> {
  console.log('[store.ts] editField called', { id, path, value, expectedOldValue });
  const data = await apiFetch(`/api/dashboard/clients/${id}/field`, {
    method: 'PATCH',
    body: JSON.stringify({ path, value, expectedOldValue }),
  });
  console.log('[store.ts] apiFetch returned', data);

  // Optimistically reflect the change in the local store. The server is
  // the source of truth, but doing this here avoids a full re-fetch round-
  // trip on every edit.
  const patchClient = (c: Client | null): Client | null => {
    if (!c || c.id !== id) return c;
    const next: any = { ...c };
    // Keep the curated top-level summary fields in sync if they were edited
    if (typeof path === 'string' && !path.includes('.') && path in next) {
      next[path] = data.newValue;
    }
    if (next.rawDoc) {
      next.rawDoc = applyPatch(next.rawDoc, path, data.newValue);
    }
    next.activityLog = [...(c.activityLog || []), data.entry];
    return next as Client;
  };
  clients.update((list) => list.map((c) => patchClient(c) ?? c));
  selectedClient.update((c) => patchClient(c));

  return data;
}

/**
 * Undo the most recent undoable change for this client. The server walks
 * the activityLog backwards and reverts the first `field_edit` /
 * `field_revert` / `stage_change` it finds. Notes / emails / AI
 * extractions are NOT undoable.
 */
export async function undoLast(id: string): Promise<{
  success: boolean;
  undoType: 'field' | 'stage_change';
  path?: string;
  revertedTo?: unknown;
  entry?: ActivityEntry;
}> {
  const data = await apiFetch(`/api/dashboard/clients/${id}/undo-last`, {
    method: 'POST',
  });

  // Refresh the doc; cheaper than rebuilding the patch locally because undo
  // can affect any field path.
  try {
    await fetchClientDetail(id);
  } catch {
    // ignore — the activityLog will resync next time the dashboard reloads
  }
  return data;
}

/**
 * On-demand AI transcript-insights extraction. Hits the LLM and persists
 * `transcriptInsights` on the consultation doc.
 *
 *   await extractInsights('b1e537da');                    // re-extract if stale
 *   await extractInsights('b1e537da', { force: true });   // force fresh extraction
 *   await extractInsights('b1e537da', { manualText: '...' }); // paste-to-extract
 */
export async function extractInsights(
  id: string,
  opts: { force?: boolean; manualText?: string } = {},
): Promise<TranscriptInsights | null> {
  const data = await apiFetch(`/api/dashboard/clients/${id}/extract-insights`, {
    method: 'POST',
    body: JSON.stringify(opts),
  });
  const insights: TranscriptInsights | null = data.insights ?? null;
  // Mirror into local stores for instant UI feedback
  clients.update((list) =>
    list.map((c) => (c.id === id ? { ...c, transcriptInsights: insights } : c)),
  );
  selectedClient.update((c) =>
    c && c.id === id ? { ...c, transcriptInsights: insights } : c,
  );
  return insights;
}

/**
 * Apply a deep value via the same dotted/bracket path syntax as the server.
 * Used internally to keep `client.rawDoc` consistent after `editField()`.
 */
function applyPatch(
  obj: Record<string, any>,
  path: string,
  value: unknown,
): Record<string, any> {
  const segments = path.replace(/\[(\d+)\]/g, '.$1').split('.').filter(Boolean);
  if (segments.length === 0) return obj;
  const out: any = Array.isArray(obj) ? obj.slice() : { ...obj };
  let cursor: any = out;
  for (let i = 0; i < segments.length - 1; i++) {
    const seg = segments[i];
    const nextIsNum = /^\d+$/.test(segments[i + 1]);
    if (/^\d+$/.test(seg)) {
      const idx = Number(seg);
      cursor[idx] =
        cursor[idx] !== undefined && cursor[idx] !== null
          ? Array.isArray(cursor[idx]) ? cursor[idx].slice() : { ...cursor[idx] }
          : nextIsNum ? [] : {};
      cursor = cursor[idx];
    } else {
      cursor[seg] =
        cursor[seg] !== undefined && cursor[seg] !== null
          ? Array.isArray(cursor[seg]) ? cursor[seg].slice() : { ...cursor[seg] }
          : nextIsNum ? [] : {};
      cursor = cursor[seg];
    }
  }
  const last = segments[segments.length - 1];
  if (/^\d+$/.test(last)) cursor[Number(last)] = value;
  else cursor[last] = value;
  return out;
}

// ─── Sent-email snapshots ─────────────────────────────────────────────────
//
// Fetches one verbatim email render (subject + bodyHtml + context + Evo
// variant labels + templateVersion) from the top-level `sentEmails`
// collection. The `<EmailPreviewDrawer>` calls this when an operator clicks
// any row in the Emails-tab "Sent emails" list.
export interface SentEmailSnapshot {
  id: string;
  consultationDocId: string;
  clientEmail: string;
  emailType: string;
  templateKey: string;
  templateVersion: string;
  subject: string;
  bodyHtml: string;
  context: Record<string, unknown>;
  evoSubjectVariant: string | null;
  evoBodyVariant: string | null;
  inferred: boolean;
  templateBackfilled: boolean;
  sentAt: string;
  engagement?: {
    opened?: boolean;
    openedAt?: string | null;
    clicked?: boolean;
    clickedAt?: string | null;
    replied?: boolean;
    repliedAt?: string | null;
    converted?: boolean;
  };
}

export async function fetchSentEmail(id: string): Promise<SentEmailSnapshot> {
  const data = await apiFetch(`/api/dashboard/sent-emails/${id}`);
  return data as SentEmailSnapshot;
}

// ─── Email pre-send preview ───────────────────────────────────────────────

export interface EmailPreviewResult {
  emailType: string;
  subject: string;
  bodyHtml: string;
  context: Record<string, unknown>;
  clientEmail: string;
}

/**
 * Fetch a rendered email preview WITHOUT sending it.
 * Calls GET /api/dashboard/clients/:id/email-preview?type=<emailType>.
 * Used by the Emails tab "Preview & Send" two-step flow.
 */
export async function fetchEmailPreview(
  id: string,
  emailType: string,
): Promise<EmailPreviewResult> {
  const data = await apiFetch(
    `/api/dashboard/clients/${id}/email-preview?type=${encodeURIComponent(emailType)}`,
  );
  return data as EmailPreviewResult;
}

/**
 * Send an email with optional edit attribution metadata.
 * Backward-compatible: calling without editMeta behaves exactly like
 * the original `triggerEmail()`.
 *
 * @param editMeta  - `{ editedBy, editedAt }` when the operator modified the
 *                    body in the pre-send preview before confirming.
 */
export async function triggerEmailWithEdit(
  id: string,
  emailType: string,
  editMeta?: { editedBy: string; editedAt: string },
  suggestionId?: string,
): Promise<void> {
  await apiFetch(`/api/dashboard/clients/${id}/trigger-email`, {
    method: 'POST',
    body: JSON.stringify({
      emailType,
      ...(editMeta ? { editMeta } : {}),
      ...(suggestionId ? { suggestionId } : {}),
    }),
  });
}

// ─── Pending drip-email queue (operator control) ─────────────────────────────

/**
 * A single item from the `emailQueue` Firestore collection that is still
 * pending (not yet sent, cancelled, or failed).
 */
export interface PendingQueueItem {
  /** Firestore document id of the emailQueue doc */
  id: string;
  type: string;
  status: 'pending' | 'sent' | 'failed' | 'cancelled';
  scheduledAt: string;
  clientEmail: string;
  consultationDocId: string;
  evoSubjectVariant?: string;
  evoBodyVariant?: string;
  retryCount?: number;
}

/**
 * Map of clientId → pending emailQueue items.
 * Populated on-demand when the Detail Panel's Emails tab loads or when the
 * socket emits `pending_emails_updated` for the currently-open client.
 */
export const pendingEmailsForClient = writable<Record<string, PendingQueueItem[]>>({});

/** Fetch pending queue items for a specific client and store them. */
export async function fetchPendingEmails(clientId: string): Promise<PendingQueueItem[]> {
  try {
    const data = await apiFetch(`/api/dashboard/clients/${clientId}/pending-emails`);
    const items: PendingQueueItem[] = data.items ?? [];
    pendingEmailsForClient.update(m => ({ ...m, [clientId]: items }));
    return items;
  } catch {
    return [];
  }
}

/** Cancel a scheduled drip email (operator clicks "Don't send"). */
export async function cancelPendingEmail(queueId: string, clientId: string, reason?: string): Promise<void> {
  await apiFetch(`/api/dashboard/email-queue/${queueId}/cancel`, {
    method: 'POST',
    body: JSON.stringify({ consultationDocId: clientId, reason: reason ?? '' }),
  });
  // Optimistically remove from local store
  pendingEmailsForClient.update(m => ({
    ...m,
    [clientId]: (m[clientId] ?? []).filter(i => i.id !== queueId),
  }));
}

/** Force-send a scheduled drip email immediately (operator clicks "Send now"). */
export async function sendPendingEmailNow(queueId: string, clientId: string): Promise<void> {
  await apiFetch(`/api/dashboard/email-queue/${queueId}/send-now`, {
    method: 'POST',
    body: JSON.stringify({ consultationDocId: clientId }),
  });
  // Mark as sent in local store
  pendingEmailsForClient.update(m => ({
    ...m,
    [clientId]: (m[clientId] ?? []).filter(i => i.id !== queueId),
  }));
}

// ─── Email suggestion dismissal ───────────────────────────────────────────

/**
 * Dismiss a pending email suggestion without sending the email.
 * The server removes the suggestion from `pendingEmailSuggestions` and
 * appends an `email_suggestion_dismissed` entry to `activityLog` with the
 * operator's email + timestamp for full audit trail.
 */
export async function dismissEmailSuggestion(
  id: string,
  suggestionId: string,
): Promise<void> {
  await apiFetch(`/api/dashboard/clients/${id}/dismiss-email-suggestion`, {
    method: 'POST',
    body: JSON.stringify({ suggestionId }),
  });
  // Optimistically remove the suggestion from local state
  const patchSuggestions = (c: Client | null): Client | null => {
    if (!c || c.id !== id) return c;
    return {
      ...c,
      pendingEmailSuggestions: (c.pendingEmailSuggestions || []).filter(
        (s) => s.suggestionId !== suggestionId,
      ),
    };
  };
  clients.update((list) => list.map((c) => patchSuggestions(c) ?? c));
  selectedClient.update((c) => patchSuggestions(c));
}

// ─── Scheduling (CRM-initiated) ──────────────────────────────────────────────

/**
 * Reschedule (or first-time schedule) a consultation call for an existing
 * client from the CRM dashboard.  Calls POST /api/dashboard/clients/:id/reschedule.
 *
 * On success the backend:
 *   • Books / moves the Google Calendar event via bookConsultation
 *   • Appends a `call_rescheduled` activityLog entry with actor/source/oldSlot/newSlot/timestamp
 *   • Broadcasts db_update over Socket.IO so all open tabs refresh
 *
 * Returns the server response which includes hangoutLink, htmlLink, oldSlot,
 * newSlot, alreadyExisted, meetCode, etc.
 */
export async function rescheduleCall(
  clientId: string,
  startISO: string,
  additionalAttendees?: string[],
): Promise<{
  success: boolean;
  hangoutLink?: string;
  htmlLink?: string;
  eventId?: string;
  meetCode?: string;
  newSlot: string;
  oldSlot: string | null;
  alreadyExisted?: boolean;
}> {
  return apiFetch(`/api/dashboard/clients/${clientId}/reschedule`, {
    method: 'POST',
    body: JSON.stringify({
      startISO,
      ...(additionalAttendees?.length ? { additionalAttendees } : {}),
    }),
  });
}

export interface CreateClientPayload {
  /** Required. */
  email: string;
  name?: string;
  surname?: string;
  phone?: string;
  /** ISO string of the call slot. When present a Calendar event is also booked. */
  startISO?: string;
  destinationCountry?: string;
  destinationCity?: string;
  originCountry?: string;
  originCity?: string;
  budget?: string;
  notes?: string[];
  /** Extra attendees to add to the Google Calendar event beyond the primary client and team. */
  additionalAttendees?: string[];
}

/**
 * Create a brand-new client record from the CRM dashboard.
 * Calls POST /api/dashboard/clients.
 *
 * If payload.startISO is present the server also books a consultation call via
 * bookConsultation and returns hangoutLink / htmlLink / meetCode.
 *
 * On success the backend appends a `client_created_by_staff` activityLog entry
 * with actor, channel:"crm_dashboard", and timestamp.
 *
 * Returns { success, docId, wasNew, hangoutLink?, htmlLink?, eventId?, meetCode? }
 */
export async function createClientFromCrm(payload: CreateClientPayload): Promise<{
  success: boolean;
  docId: string;
  wasNew: boolean;
  hangoutLink?: string;
  htmlLink?: string;
  eventId?: string;
  meetCode?: string;
}> {
  const result = await apiFetch('/api/dashboard/clients', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  // Optimistically refresh the client list so the new card appears immediately
  fetchClients().catch(() => {/* non-fatal */});
  return result;
}

// ─── Server-driven email type store ──────────────────────────────────────────
//
// Reactive writable pre-seeded with the static EMAIL_TYPES fallback so the
// dashboard renders immediately. `fetchEmailTypes()` is called once on init
// and replaces the store contents with the live list from the server.
// From that point on every component that reads `$emailTypes` gets the
// authoritative server view — no rebuild, no deploy needed when types change.

/**
 * Reactive email type list. Pre-seeded with the static `EMAIL_TYPES` fallback
 * so the dropdown is immediately usable before the server fetch completes.
 *
 * Use `$emailTypes` in Svelte templates instead of `EMAIL_TYPES` so the list
 * stays in sync with the server automatically.
 */
export const emailTypes = writable<EmailTypeDescriptor[]>(EMAIL_TYPES);

/**
 * Fetch the authoritative email type list from GET /api/dashboard/email-types
 * and refresh the `emailTypes` store. Should be called once on dashboard init
 * (e.g. in the `onMount` of the dashboard root layout).
 *
 * Non-fatal on error — the store keeps its static fallback so the UI remains
 * functional even if the fetch fails.
 */
export async function fetchEmailTypes(): Promise<void> {
  try {
    const data = await apiFetch('/api/dashboard/email-types');
    const types: EmailTypeDescriptor[] = Array.isArray(data?.types) ? data.types : [];
    if (types.length > 0) {
      emailTypes.set(types);
    }
  } catch {
    // Non-fatal: the static EMAIL_TYPES fallback stays in place.
  }
}

// ─── Admin: Live Access Config ─────────────────────────────────────────────

/**
 * Fetch the Firestore-persisted access config.
 * Returns `null` if no live config has been saved yet (static fallback applies).
 * Readable by ALL authenticated staff.
 */
export async function fetchLiveAccessConfig(): Promise<Record<string, string[]> | null> {
  try {
    const data = await apiFetch('/api/dashboard/admin/access-config');
    return data?.config ?? null;
  } catch {
    // Non-fatal: caller falls back to the static map in access.ts.
    return null;
  }
}

/**
 * Persist the access config to Firestore. Admin-only — the server will 403
 * if the calling session is not luisarmando or pablo.
 */
export async function saveAccessConfig(config: Record<string, string[]>): Promise<void> {
  await apiFetch('/api/dashboard/admin/access-config', {
    method: 'PUT',
    body: JSON.stringify({ config }),
  });
}

// ─── Admin: Collaborators map (drives the AI router) ───────────────────────

/** One internal teammate the AI router can notify. */
export interface Collaborator {
  email: string;
  name: string;
  function: string;
}

/**
 * Fetch the editable collaborators map (email · name · function).
 * The server falls back to seed defaults when nothing has been saved yet, so
 * `collaborators` is always populated. `isDefault` is true while showing seeds.
 * Readable by ALL authenticated staff.
 */
export async function fetchCollaborators(): Promise<{ collaborators: Collaborator[]; isDefault: boolean } | null> {
  try {
    const data = await apiFetch('/api/dashboard/admin/collaborators');
    return {
      collaborators: Array.isArray(data?.collaborators) ? data.collaborators : [],
      isDefault: !!data?.isDefault,
    };
  } catch {
    return null;
  }
}

/**
 * Persist the full collaborators map to Firestore. Admin-only (server 403s
 * for non-admins). The map is read by the server-side AI router on every reply.
 */
export async function saveCollaborators(collaborators: Collaborator[]): Promise<void> {
  await apiFetch('/api/dashboard/admin/collaborators', {
    method: 'PUT',
    body: JSON.stringify({ collaborators }),
  });
}

// ─── Admin: Session Log ────────────────────────────────────────────────────

export interface AdminSession {
  email: string;
  createdAt: string;
  expiresAt: string;
  isActive: boolean;
}

/**
 * Fetch all dashboard sessions. Admin-only — the server will 403 for
 * non-admin callers.
 */
export async function fetchAdminSessions(): Promise<AdminSession[]> {
  const data = await apiFetch('/api/dashboard/admin/sessions');
  return (data?.sessions ?? []) as AdminSession[];
}

// ─── Admin: Per-User Activity Audit ───────────────────────────────────────

/**
 * A single activityLog entry enriched with the source client's identity.
 * Returned by GET /api/dashboard/admin/user-activity?email=...
 */
export interface UserActivityEntry {
  /** The action type (stage_change, note_added, email_triggered, field_edit, …) */
  type: string;
  /** ISO timestamp of the action */
  timestamp: string;
  /** The staff email that performed the action (always === the email queried) */
  actor: string;
  /** Firestore docId of the client this action was performed on */
  _clientDocId: string;
  /** Human-readable name for the client */
  _clientDisplayName: string;
  /** Email address of the client */
  _clientEmail: string;
  /** All other fields from the original activityLog entry */
  [key: string]: unknown;
}

/**
 * Fetch all activityLog entries across ALL consultations where `actor === email`.
 * Admin-only — the server will 403 for non-admin callers.
 * Returns a chronological (newest-first) list of UserActivityEntry.
 */
export async function fetchUserActivity(email: string): Promise<UserActivityEntry[]> {
  const data = await apiFetch(
    `/api/dashboard/admin/user-activity?email=${encodeURIComponent(email)}`
  );
  return (data?.entries ?? []) as UserActivityEntry[];
}

// ─── Quotes (Cotizaciones) ───────────────────────────────────────────────────
//
// Rich Quote model: title + line items + multi-provider + notes + changeLog.
// Phase 2 adds: approval workflow, comments, send-to-client.
// Phase 3 adds: client-portal visibility, acceptance → auto stage move.

export interface QuoteLineItem {
  lineId: string;
  label: string;
  /** Provider cost — what IRP pays the provider for this service line. */
  amount: number;
  /**
   * IRP margin percentage (default 20).  Used when marginMode === 'pct' (the default).
   * clientPrice = amount × (1 + marginPct / 100)
   * e.g. amount = $100, marginPct = 20  →  clientPrice = $120
   */
  marginPct: number;
  /**
   * Margin mode:
   *   'pct'  (default) — percentage-based:  clientPrice = amount × (1 + marginPct / 100)
   *   'flat'           — flat currency add:  clientPrice = amount + marginFlat
   */
  marginMode?: 'pct' | 'flat';
  /** Flat currency margin; only used when marginMode === 'flat'. Matches the line's currency. */
  marginFlat?: number | null;
  currency: string;
  providerId: string | null;
  notes: string | null;
  /** Phase 3 — when true, client can check/uncheck this item on the status page. */
  isOptional?: boolean;
}

export interface QuoteChangeLogEntry {
  changeId: string;
  actor: string;
  type: string;
  summary: string;
  timestamp: string;
  addressesCommentId?: string | null;
}

// ─── QuoteBlock — block-based proposal document (Phase 1 read path) ─────────
// Adding new block types here is forward-compatible:
// BlockRenderer silently skips unknown types, so old deploys keep working.

export type QuoteBlockType =
  | 'html'
  | 'heading'
  | 'image'
  | 'banner'
  | 'quoteTable'
  | 'accept'
  | 'accordion'
  | 'testimonials'
  | 'reviews'
  | 'partners';

/**
 * A single content block in a Qwilr-style quote proposal document.
 * Stored as an array in Quote.blocks (optional field — absent on existing quotes).
 */
export interface QuoteBlock {
  id: string;
  type: QuoteBlockType;
  /** Sanitized HTML — used by html, heading, banner, accordion types. */
  html?: string | null;
  /** Structured data for component-based blocks (quoteTable, accept, etc.). */
  data?: Record<string, any> | null;
  /**
   * Optional named section this block belongs to.
   * When blocks share a section label, BlockRenderer groups them into a
   * navigable tab. Blocks without a section fall through to the legacy
   * single-flow document mode (backward compatible).
   */
  section?: string | null;
}

/**
 * A bundle of line items the client chooses between / adds on the status page
 * (Phase 5 — line-item template groups). When a quote has `lineGroups`, the flat
 * `lineItems` array is the server-derived concatenation of every group's items.
 *
 *   role: 'required'  → mutually-exclusive choice rendered as a radio. A single
 *                       required group is auto-included (no radio shown).
 *   role: 'optional'  → an add-on rendered as a checkbox (unchecked by default).
 */
export interface QuoteLineGroup {
  groupId: string;
  title: string;
  /**
   * Optional reference to a reusable, agnostic {@link QuoteLabel}. When set, the
   * group's `title` mirrors the label's name so the client-facing status page
   * (which reads `title`) keeps working unchanged. Absent/null ⇒ legacy free-text.
   */
  labelId?: string | null;
  role: 'required' | 'optional';
  lineItems: QuoteLineItem[];
}


export interface Quote {
  quoteId: string;
  consultationId: string;
  title: string;
  lineItems: QuoteLineItem[];
  /** Optional grouped line items (Phase 5). Null/absent ⇒ legacy flat quote. */
  lineGroups?: QuoteLineGroup[] | null;
  currency: string;
  total: number;

  providerIds: string[];
  providerSnapshots: Array<{
    id: string; name: string; country: string;
    modality: string; serviceCategory: string;
  }>;
  notes: string | null;
  /** Phase 1 statuses; Phase 2+ adds pending_approval, changes_requested, approved, sent_to_client, client_accepted */
  status: 'draft' | 'pending_approval' | 'changes_requested' | 'approved' | 'sent_to_client' | 'client_accepted';
  approvers: string[];
  approvals: Array<{ approverEmail: string; decision: string; decidedAt: string }>;
  comments: Array<{
    commentId: string; authorEmail: string; text: string; createdAt: string;
    resolved: boolean; resolvedBy: string | null; resolvedAt: string | null;
  }>;
  changeLog: QuoteChangeLogEntry[];
  clientVisible: boolean;
  sentToClientAt: string | null;
  clientToken: string | null;
  clientAcceptedAt: string | null;
  clientAcceptedBy: string | null;
  createdAt: string;
  createdBy: string;
  updatedAt: string | null;
  // Legacy backward-compat
  providerId?: string | null;
  providerName?: string | null;
  providerEmail?: string | null;
  amount?: number | null;
  // ── Margin / pricing breakdown ──
  /** Default margin % applied to new lines (20 = 20%). Each line's marginPct overrides this. */
  defaultMarginPct?: number;
  /** Σ lineItem.amount — total provider cost (what IRP pays). */
  costSubtotal?: number;
  /** Σ clientPrice per line — what the client is charged. Stored in `total`. */
  earnings?: number;
  // ── Service configuration ──
  /** AI-extracted (transcriptInsights.packingTier) or set manually. Required for submission. */
  serviceType?: string | null;
  /** Broad project description shown to the client (no cost/margin/provider detail). */
  clientDescription?: string | null;
  // ── Exclusionary option groups (Phase 4) ──
  optionGroupId?: string | null;
  optionLabel?: string | null;
  // ── Block-based proposal document (Phase 1 — additive, existing quotes unaffected) ──
  /** References a quote_templates/{id} document. Absent on quotes created before Phase 2. */
  templateId?: string | null;
  /** Ordered array of content blocks for Qwilr-style proposal rendering on the status page.
   *  When absent/empty, QuoteView falls back to the legacy line-items table. */
  blocks?: QuoteBlock[] | null;
}

export const QUOTE_STATUS_LABEL: Record<Quote['status'], { label: string; color: string }> = {
  draft:            { label: 'Borrador',       color: '#94a3b8' },
  pending_approval: { label: 'En revisión',    color: '#f59e0b' },
  changes_requested:{ label: 'Cambios pedidos',color: '#ef4444' },
  approved:         { label: 'Aprobada',       color: '#22c55e' },
  sent_to_client:   { label: 'Enviada al cliente', color: '#3b82f6' },
  client_accepted:  { label: 'Aceptada ✓',    color: '#16a34a' },
};

/** Fetch all quotes for a client (newest first). */
export async function fetchQuotes(clientId: string): Promise<Quote[]> {
  const data = await apiFetch(`/api/dashboard/clients/${clientId}/quotes`);
  return (data.quotes ?? []) as Quote[];
}

/** Fetch a single quote by ID. */
export async function fetchQuote(clientId: string, quoteId: string): Promise<Quote> {
  return apiFetch(`/api/dashboard/clients/${clientId}/quotes/${quoteId}`) as Promise<Quote>;
}

/** Create a new quote (defaults to status=draft). */
export async function createQuote(clientId: string, payload: Partial<Quote>): Promise<Quote> {
  const data = await apiFetch(`/api/dashboard/clients/${clientId}/quotes`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return data.quote as Quote;
}

/** Partially update a quote. Only supplied fields are changed. */
export async function updateQuote(
  clientId: string,
  quoteId: string,
  updates: Partial<Quote>,
): Promise<{ success: boolean; updatedFields: string[] }> {
  return apiFetch(`/api/dashboard/clients/${clientId}/quotes/${quoteId}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
}

/** Delete a quote permanently. */
export async function deleteQuote(clientId: string, quoteId: string): Promise<void> {
  await apiFetch(`/api/dashboard/clients/${clientId}/quotes/${quoteId}`, {
    method: 'DELETE',
  });
}

// ─── Phase 2: Quote approval workflow store functions ────────────────────────

/** Submit a quote for approval. Sends email to approvers and creates PendingAction badge. */
export async function submitQuoteForApproval(
  clientId: string,
  quoteId: string,
  noteToApprovers?: string,
): Promise<void> {
  await apiFetch(`/api/dashboard/clients/${clientId}/quotes/${quoteId}/submit-for-approval`, {
    method: 'POST',
    body: JSON.stringify({ noteToApprovers: noteToApprovers?.trim() || null }),
  });
}

/** Approve a quote. Caller must be a QUOTE_APPROVER (enforced server-side). */
export async function approveQuote(clientId: string, quoteId: string): Promise<void> {
  await apiFetch(`/api/dashboard/clients/${clientId}/quotes/${quoteId}/approve`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

/** Request changes on a pending-approval quote. Caller must be a QUOTE_APPROVER. */
export async function requestQuoteChanges(
  clientId: string,
  quoteId: string,
  comment: string,
): Promise<void> {
  await apiFetch(`/api/dashboard/clients/${clientId}/quotes/${quoteId}/request-changes`, {
    method: 'POST',
    body: JSON.stringify({ comment }),
  });
}

/** Add a comment to a quote's comment thread. */
export async function addQuoteComment(
  clientId: string,
  quoteId: string,
  text: string,
): Promise<void> {
  await apiFetch(`/api/dashboard/clients/${clientId}/quotes/${quoteId}/comments`, {
    method: 'POST',
    body: JSON.stringify({ text }),
  });
}

/** Resolve (close) a comment in a quote's thread. */
export async function resolveQuoteComment(
  clientId: string,
  quoteId: string,
  commentId: string,
): Promise<void> {
  await apiFetch(
    `/api/dashboard/clients/${clientId}/quotes/${quoteId}/comments/${commentId}/resolve`,
    { method: 'PATCH', body: JSON.stringify({}) },
  );
}

/**
 * Quote approvers as a Set — sourced from the canonical `access.ts` list.
 * Using a Set preserves the `.has()` interface used by QuoteEditor.svelte.
 * Edit the list in `access.ts`; this export stays in sync automatically.
 *
 * NOTE: QUOTE_APPROVERS_EMAILS is kept as a STATIC FALLBACK.
 * At runtime, canApproveQuotes (below) checks live Firestore data first.
 */
import { QUOTE_APPROVERS as _QUOTE_APPROVERS, ADMIN_EMAILS as _ADMIN_EMAILS } from './access.ts';
export const QUOTE_APPROVERS_EMAILS: ReadonlySet<string> = new Set(_QUOTE_APPROVERS);
const _ADMIN_SET: ReadonlySet<string> = new Set(_ADMIN_EMAILS);

// ─── Action-Level Permission System ──────────────────────────────────────────
//
// Stored in Firestore at  dashboard_config / action_permissions
// Shape: { permissions: Record<email, Record<ActionKey, boolean>> }
//
// Backward compatibility:
//   • liveActionPermissions starts as null (not yet fetched).
//   • canApproveQuotes falls back to the static QUOTE_APPROVERS_EMAILS
//     until Firestore data is loaded by any component calling
//     fetchLiveActionPermissions().
//   • Super-admins always get all permissions regardless of Firestore state.

/**
 * Writable store holding the live action-permissions map from Firestore.
 * null  = not yet fetched (components should call fetchLiveActionPermissions()).
 * {}    = fetched but empty (nobody has any special permissions configured yet).
 */
export const liveActionPermissions = writable<Record<string, Record<string, boolean>> | null>(null);

/**
 * Derived boolean: can the currently logged-in staff member approve quotes?
 *
 * Priority:
 *   1. Super-admins (luisarmando, pablo) → always true
 *   2. Live Firestore map loaded → use  permissions[email].can_approve_quotes
 *   3. Firestore not loaded yet          → fall back to static QUOTE_APPROVERS list
 */
export const canApproveQuotes = derived(
  [liveActionPermissions, authEmail],
  ([$lap, $email]) => {
    if (!$email) return false;
    if (_ADMIN_SET.has($email)) return true;          // super-admins always can
    if ($lap !== null) {
      // Firestore data is loaded — use it as the single source of truth
      return $lap[$email]?.can_approve_quotes === true;
    }
    // Firestore not fetched yet — fall back to static list (zero regression)
    return QUOTE_APPROVERS_EMAILS.has($email);
  },
);

/**
 * Fetch the action-permissions config from the server.
 * Readable by all authenticated staff (same policy as access-config).
 * Returns null when the Firestore doc has never been saved (first run).
 */
export async function fetchLiveActionPermissions(): Promise<Record<string, Record<string, boolean>> | null> {
  try {
    const data = await apiFetch('/api/dashboard/admin/action-permissions');
    return data?.permissions ?? null;
  } catch {
    return null;
  }
}

/**
 * Persist the full action-permissions map to Firestore.
 * Admin-only (enforced server-side).
 * Shape: Record<email, Record<ActionKey, boolean>>
 */
export async function saveActionPermissions(
  permissions: Record<string, Record<string, boolean>>,
): Promise<void> {
  await apiFetch('/api/dashboard/admin/action-permissions', {
    method: 'PUT',
    body: JSON.stringify({ permissions }),
  });
}


/** Send an approved quote to the client via email. Returns the client-visible link. */
export async function sendQuoteToClient(
  clientId: string,
  quoteId: string,
): Promise<{ success: boolean; clientToken: string; statusPageUrl: string }> {
  return apiFetch(`/api/dashboard/clients/${clientId}/quotes/${quoteId}/send-to-client`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

/**
 * Fetch a quote using only the client-visible token (public — no auth).
 * Used by the status page when a quoteToken param is present in the URL.
 */
export async function fetchQuoteByToken(
  consultationId: string,
  token: string,
): Promise<Quote | null> {
  try {
    const data = await apiFetch(
      `/api/status/${consultationId}/quote?token=${encodeURIComponent(token)}`,
    );
    return (data.quote ?? null) as Quote | null;
  } catch {
    return null;
  }
}

/**
 * Phase D — public, token-gated fetch of the client-facing AI description.
 * Lazily generates + caches the description server-side on first view when the
 * quote doesn't have one yet, and respects any staff-authored description.
 * Non-fatal: returns '' on any error so the status page just omits the card.
 */
export async function fetchClientQuoteDescription(
  consultationId: string,
  token: string,
): Promise<string> {
  try {
    const data = await apiFetch(
      `/api/status/${consultationId}/quote/generate-description?token=${encodeURIComponent(token)}`,
      { method: 'POST', body: JSON.stringify({ token }) },
    );
    return (data.clientDescription ?? '') as string;
  } catch {
    return '';
  }
}


/**
 * Accept a quote as the client (called from the public status page).
 * No auth required — validated by clientToken on the server.
 *
 * Phase 3: pass `selectedLineItemIds` so the server records which optional
 * services the client specifically agreed to and calculates `finalBilledTotal`.
 */
export async function acceptQuoteAsClient(
  consultationId: string,
  token: string,
  acceptedBy?: string,
  selectedLineItemIds?: string[],
  /** Phase 5 — which line-item groups (packages/add-ons) the client chose. */
  selectedGroupIds?: string[],
): Promise<{ success: boolean; status: string }> {
  return apiFetch(`/api/status/${consultationId}/quote/accept`, {
    method: 'POST',
    body: JSON.stringify({
      token,
      acceptedBy: acceptedBy?.trim() || '',
      ...(selectedLineItemIds ? { selectedLineItemIds } : {}),
      ...(selectedGroupIds && selectedGroupIds.length > 0 ? { selectedGroupIds } : {}),
    }),
  });
}


// ─── Quote Templates ──────────────────────────────────────────────────────────
//
// Top-level Firestore collection: quote_templates/{templateId}
// A QuoteTemplate is an ordered array of QuoteBlocks reusable across many quotes.
// Applying a template to a quote seeds quote.blocks + quote.templateId.

export interface QuoteTemplate {
  templateId: string;
  name: string;
  description?: string | null;
  category?: string | null;
  blocks: QuoteBlock[];
  destinationCountries?: string[];
  createdBy: string;
  createdAt: string;
  updatedAt: string | null;
  /** When true, this template is pinned first in all template selectors. */
  isDefault?: boolean;
  /** Explicit sort order — lower numbers appear first. Default templates use order 0. */
  order?: number;
}

/** Fetch all quote templates (newest first). */
export async function fetchQuoteTemplates(): Promise<QuoteTemplate[]> {
  const data = await apiFetch('/api/dashboard/quote-templates');
  return (data.templates ?? []) as QuoteTemplate[];
}

/** Fetch a single quote template by ID. */
export async function fetchQuoteTemplate(templateId: string): Promise<QuoteTemplate> {
  return apiFetch(`/api/dashboard/quote-templates/${templateId}`) as Promise<QuoteTemplate>;
}

/** Create a new quote template. Returns the created doc. */
export async function createQuoteTemplate(
  payload: Pick<QuoteTemplate, 'name'> & Partial<Omit<QuoteTemplate, 'templateId' | 'createdBy' | 'createdAt' | 'updatedAt'>>,
): Promise<QuoteTemplate> {
  const data = await apiFetch('/api/dashboard/quote-templates', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return data.template as QuoteTemplate;
}

/** Partially update a quote template. */
export async function updateQuoteTemplate(
  templateId: string,
  updates: Partial<Pick<QuoteTemplate, 'name' | 'description' | 'category' | 'blocks' | 'destinationCountries'>>,
): Promise<{ success: boolean; updatedFields: string[] }> {
  return apiFetch(`/api/dashboard/quote-templates/${templateId}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
}

/** Delete a quote template permanently. */
export async function deleteQuoteTemplate(templateId: string): Promise<void> {
  await apiFetch(`/api/dashboard/quote-templates/${templateId}`, {
    method: 'DELETE',
  });
}

// ─── Quote Template Map (destination → template "main configuration") ─────────
//
// Firestore: dashboard_config/quoteTemplateMap (single editable config doc).
// Decides WHICH quote_templates/{id} document is shown by DEFAULT for a given
// destination configuration. Consulted by the AI auto-selector before the
// legacy hardcoded rules, and surfaced in the Templates section's ⚙️ Config
// panel + the per-client selector in the quoting step. Mirrors the server
// types in `quoteTemplateMapRouter.ts`.

export interface TemplateMapRule {
  /** Stable id (server assigns a nanoid when absent). */
  id: string;
  /** Optional human-readable label, e.g. "Costa Rica — RoRo". */
  label?: string | null;
  /** Required destination country match key (fuzzy, case-insensitive). */
  destinationCountry: string;
  /** Optional destination city narrowing. */
  destinationCity?: string | null;
  /** Optional shipping-mode narrowing (from transcriptInsights). */
  shippingMode?: string | null;
  /** Which template to show when this rule matches. */
  templateId: string;
  /** Tie-break among equally-specific rules (lower number wins). */
  priority: number;
}

export interface QuoteTemplateMap {
  /** Global fallback template used when no rule matches. */
  defaultTemplateId: string;
  rules: TemplateMapRule[];
  updatedAt: string | null;
  updatedBy: string | null;
}

/** Fetch the editable destination → template mapping config. */
export async function fetchQuoteTemplateMap(): Promise<QuoteTemplateMap> {
  const data = await apiFetch('/api/dashboard/quote-template-map');
  return data.map as QuoteTemplateMap;
}

/** Persist the full destination → template mapping config. */
export async function saveQuoteTemplateMap(
  map: Pick<QuoteTemplateMap, 'defaultTemplateId' | 'rules'>,
): Promise<QuoteTemplateMap> {
  const data = await apiFetch('/api/dashboard/quote-template-map', {
    method: 'PUT',
    body: JSON.stringify(map),
  });
  return data.map as QuoteTemplateMap;
}

/** Result returned by the per-client template resolver / selector. */
export interface InferTemplateResult {
  templateId: string;
  name: string;
  source: 'manual' | 'map' | 'rules' | 'llm' | 'default';
  reasoning: string;
}

/**
 * Resolve & persist the template a specific client should see, using the AI
 * auto-selector (manual override → editable map → legacy rules → LLM →
 * default). Pass `overrideTemplateId` for an explicit manual staff pick.
 * Persists `selectedQuoteTemplateId` on the consultation doc server-side and
 * mirrors it into the local client stores for instant UI feedback.
 */
export async function inferClientTemplate(
  clientId: string,
  overrideTemplateId?: string,
): Promise<InferTemplateResult> {
  const data = await apiFetch(`/api/dashboard/clients/${clientId}/infer-template`, {
    method: 'POST',
    body: JSON.stringify(overrideTemplateId ? { overrideTemplateId } : {}),
  });
  const result = data as InferTemplateResult;
  const newSource: 'manual' | 'auto' = result.source === 'manual' ? 'manual' : 'auto';
  // Mirror the resolved template + source into local stores so any open card reflects it.
  const patchSel = (c: Client | null): Client | null => {
    if (!c || c.id !== clientId) return c;
    const next: any = {
      ...c,
      selectedQuoteTemplateId: result.templateId,
      selectedQuoteTemplateSource: newSource,
    };
    if (next.rawDoc) {
      next.rawDoc = {
        ...next.rawDoc,
        selectedQuoteTemplateId: result.templateId,
        selectedQuoteTemplateSource: newSource,
      };
    }
    return next as Client;
  };

  clients.update((list) => list.map((c) => patchSel(c) ?? c));
  selectedClient.update((c) => patchSel(c));
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Quote LINE-ITEM templates (pricing presets)
//
// Top-level Firestore collection: quote_line_templates/{templateId}
// A QuoteLineTemplate is a named, ordered list of line-item LABELS (e.g. the
// Costa Rica cost breakdown). Applying one in the Quote Editor seeds the
// quote's line items with those labels (amount 0, default margin, the
// template's default currency). Distinct from QuoteTemplate (content blocks).
// ─────────────────────────────────────────────────────────────────────────────

export interface QuoteLineTemplate {
  templateId: string;
  name: string;
  description?: string | null;
  /** Default currency applied to each seeded line (e.g. 'USD'). */
  currency: string;
  /** Ordered list of line-item labels. */
  lines: string[];
  /** When true, this template is pinned first in selectors (e.g. the seeded Costa Rica preset). */
  isDefault?: boolean;
  order?: number;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string | null;
}

/** Fetch all quote line-item templates (defaults first, then newest). */
export async function fetchQuoteLineTemplates(): Promise<QuoteLineTemplate[]> {
  const data = await apiFetch('/api/dashboard/quote-line-templates');
  return (data.templates ?? []) as QuoteLineTemplate[];
}

/** Create a new quote line-item template. Returns the created doc. */
export async function createQuoteLineTemplate(
  payload: Pick<QuoteLineTemplate, 'name'> & Partial<Pick<QuoteLineTemplate, 'description' | 'currency' | 'lines'>>,
): Promise<QuoteLineTemplate> {
  const data = await apiFetch('/api/dashboard/quote-line-templates', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return data.template as QuoteLineTemplate;
}

/** Partially update a quote line-item template. */
export async function updateQuoteLineTemplate(
  templateId: string,
  updates: Partial<Pick<QuoteLineTemplate, 'name' | 'description' | 'currency' | 'lines'>>,
): Promise<{ success: boolean; updatedFields: string[] }> {
  return apiFetch(`/api/dashboard/quote-line-templates/${templateId}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
}

/** Delete a quote line-item template permanently. */
export async function deleteQuoteLineTemplate(templateId: string): Promise<void> {
  await apiFetch(`/api/dashboard/quote-line-templates/${templateId}`, {
    method: 'DELETE',
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Custom SERVICE TYPES (dashboard-managed extras)
//
// Top-level Firestore collection: quote_service_types/{serviceTypeId}
// The built-in service types live in code (PACKING_TIER_LABEL) and are ALWAYS
// available. Custom service types are additive, editable documents the Quote
// Editor merges on TOP of the built-ins — so operators can add e.g. a bespoke
// "Storage only" service without a code change. A quote persists `serviceType`
// as an opaque string key (a built-in PackingTier key OR a custom
// serviceTypeId), so nothing about existing quotes changes.
// ─────────────────────────────────────────────────────────────────────────────

export interface ServiceType {
  serviceTypeId: string;
  /** Human-readable label shown in the service-type selector. */
  label: string;
  /** Short emoji/icon shown beside the label. */
  icon: string;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string | null;
}

/** Fetch all custom (dashboard-managed) service types, newest first. */
export async function fetchServiceTypes(): Promise<ServiceType[]> {
  const data = await apiFetch('/api/dashboard/service-types');
  return (data.serviceTypes ?? []) as ServiceType[];
}

/** Create a new custom service type. Returns the created doc. */
export async function createServiceType(
  payload: Pick<ServiceType, 'label'> & Partial<Pick<ServiceType, 'icon'>>,
): Promise<ServiceType> {
  const data = await apiFetch('/api/dashboard/service-types', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return data.serviceType as ServiceType;
}

/** Partially update a custom service type. */
export async function updateServiceType(
  serviceTypeId: string,
  updates: Partial<Pick<ServiceType, 'label' | 'icon'>>,
): Promise<{ success: boolean; updatedFields: string[] }> {
  return apiFetch(`/api/dashboard/service-types/${serviceTypeId}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
}

/** Delete a custom service type permanently. */
export async function deleteServiceType(serviceTypeId: string): Promise<void> {
  await apiFetch(`/api/dashboard/service-types/${serviceTypeId}`, {
    method: 'DELETE',
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Custom QUOTE LABELS (agnostic line-group labels)
//
// Top-level Firestore collection: quote_labels/{labelId}
// A QuoteLabel is a small, editable, fully-agnostic label (e.g. "Origin
// services", "Destination services", "Insurance") operators attach to a
// quote's line-item GROUPS via `group.labelId`. Labels are NOT hard-coded to
// origin/destination — operators create whatever taxonomy suits them. A group
// keeps its free-text `title` (mirrored from the chosen label) so the
// client-facing status page and legacy quotes are completely unaffected.
// ─────────────────────────────────────────────────────────────────────────────

export interface QuoteLabel {
  labelId: string;
  /** Human-readable label shown in the group label chooser. */
  label: string;
  /** Short emoji/icon shown beside the label. */
  icon: string;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string | null;
}

/** Fetch all custom quote-line group labels, newest first. */
export async function fetchQuoteLabels(): Promise<QuoteLabel[]> {
  const data = await apiFetch('/api/dashboard/quote-labels');
  return (data.quoteLabels ?? []) as QuoteLabel[];
}

/** Create a new custom quote label. Returns the created doc. */
export async function createQuoteLabel(
  payload: Pick<QuoteLabel, 'label'> & Partial<Pick<QuoteLabel, 'icon'>>,
): Promise<QuoteLabel> {
  const data = await apiFetch('/api/dashboard/quote-labels', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return data.quoteLabel as QuoteLabel;
}

/** Partially update a custom quote label. */
export async function updateQuoteLabel(
  labelId: string,
  updates: Partial<Pick<QuoteLabel, 'label' | 'icon'>>,
): Promise<{ success: boolean; updatedFields: string[] }> {
  return apiFetch(`/api/dashboard/quote-labels/${labelId}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
}

/** Delete a custom quote label permanently. */
export async function deleteQuoteLabel(labelId: string): Promise<void> {
  await apiFetch(`/api/dashboard/quote-labels/${labelId}`, {
    method: 'DELETE',
  });
}

/**
 * Trigger server-side AI (re)generation of a quote's client-facing description.
 * The server composes a short, client-safe paragraph from the quote's line
 * labels + group titles (never cost/margin/provider detail), caches it on the
 * quote (`clientDescription` + a content hash), and returns the text. Only
 * regenerates when the quote content changed since the last generation.
 */
export async function generateQuoteClientDescription(
  clientId: string,
  quoteId: string,
): Promise<{ clientDescription: string; cached: boolean }> {
  const data = await apiFetch(
    `/api/dashboard/clients/${clientId}/quotes/${quoteId}/generate-description`,
    { method: 'POST', body: JSON.stringify({}) },
  );
  return {
    clientDescription: data.clientDescription ?? '',
    cached: !!data.cached,
  };
}



/**
 * Apply a template to a quote: seeds the quote's blocks + templateId.
 * The quote's lineItems and all other existing fields are preserved.
 */
export async function applyTemplateToQuote(
  clientId: string,
  quoteId: string,
  template: QuoteTemplate,
): Promise<{ success: boolean; updatedFields: string[] }> {
  return updateQuote(clientId, quoteId, {
    templateId: template.templateId,
    blocks: template.blocks,
  } as Partial<Quote>);
}


// ─── Provider RFQ (request for quote) ─────────────────────────────────────────
// Manual, human-triggered ONLY. Contacting providers is never automatic: an
// operator reviews the matched providers and clicks "Send RFQ". This calls the
// shared blast service which creates quoteRequest docs and emails each provider.

export interface SendRfqResult {
  success: boolean;
  consultationId: string;
  counts: { created: number; skipped: number; failed: number };
  created: Array<{ providerId: string; providerName: string }>;
  skipped: Array<{ providerId: string; providerName: string }>;
  failed: Array<{ providerId: string; providerName: string }>;
  expiresAt: string | null;
}

/**
 * Send the RFQ (request for quote) to providers for a consultation.
 *
 * @param clientId    the consultation/client id
 * @param providerIds optional explicit provider targets (e.g. the matched ones
 *                    the operator reviewed). When omitted, the server matches
 *                    providers by the consultation's modality/category/route.
 *
 * Idempotent on the server: a provider with a live (pending/accepted/selected)
 * request is skipped, so re-sending never double-contacts anyone.
 */
export interface SendRfqOptions {
  /** Explicit CC recipients (e.g. the RFQ pricing inbox). */
  cc?: string[];
  /** Operator-edited subject (supports {{providerName}} personalization). */
  subject?: string;
  /**
   * Operator-edited RFQ HTML body (an edited, pre-translated Sondeo preview).
   * {{providerName}} / {{submitUrl}} are personalized per provider server-side.
   */
  bodyHtml?: string;
}

export async function sendProviderRfq(
  clientId: string,
  providerIds?: string[],
  options: SendRfqOptions = {},
): Promise<SendRfqResult> {
  return apiFetch('/api/provider/quote-request/blast', {
    method: 'POST',
    body: JSON.stringify({
      consultationId: clientId,
      ...(providerIds && providerIds.length > 0 ? { providerIds } : {}),
      ...(options.cc && options.cc.length > 0 ? { cc: options.cc } : {}),
      ...(options.subject ? { subject: options.subject } : {}),
      ...(options.bodyHtml ? { bodyHtml: options.bodyHtml } : {}),
    }),
  }) as Promise<SendRfqResult>;
}

// ─────────────────────────────────────────────────────────────────────────────
// RFQ provider RESPONSES (dashboard side — Providers tab: P2 field-map + P3 calc)
// Backed by providerRfqDashboardRouter.ts.
// ─────────────────────────────────────────────────────────────────────────────

/** A vendor's submitted rate for a quote request. */
export interface QuoteRequestProviderResponse {
  price: number | null;
  currency: string | null;
  notes: string;
  respondedAt: string;
}

/** The operator's edited value (kept separate from the vendor-submitted one). */
export interface QuoteRequestOperatorOverride {
  price: number | null;
  currency: string | null;
  notes: string;
  overriddenBy?: string;
  overriddenAt?: string;
}

export interface QuoteRequestRow {
  requestId: string;
  providerId: string;
  providerName: string;
  providerEmail: string;
  status: 'pending' | 'accepted' | 'declined' | 'expired' | 'selected' | 'confirmed';
  sentAt: string | null;
  expiresAt: string | null;
  providerResponse: QuoteRequestProviderResponse | null;
  operatorOverride: QuoteRequestOperatorOverride | null;
  reviewedAt: string | null;
  reviewedBy: string | null;
  /** Provider quality score 0–5 (half-steps); null = unrated. */
  providerScore: number | null;
}

export interface QuoteRequestsResult {
  quoteRequests: QuoteRequestRow[];
  expectedMarginPct: number;
  pendingReviewCount: number;
}

/** Fetch all RFQ provider responses for a client (dashboard view). */
export async function fetchQuoteRequests(clientId: string): Promise<QuoteRequestsResult> {
  const data = await apiFetch(`/api/dashboard/clients/${clientId}/quote-requests`);
  return {
    quoteRequests: (data.quoteRequests ?? []) as QuoteRequestRow[],
    expectedMarginPct: typeof data.expectedMarginPct === 'number' ? data.expectedMarginPct : 20,
    pendingReviewCount: data.pendingReviewCount ?? 0,
  };
}

/**
 * Set (or clear) the operator's rate override on one response, and/or mark it
 * reviewed. The vendor-submitted value is preserved separately server-side.
 */
export async function updateQuoteRequestOverride(
  clientId: string,
  requestId: string,
  payload: {
    price?: number | null;
    currency?: string | null;
    notes?: string;
    clearOverride?: boolean;
    markReviewed?: boolean;
  },
): Promise<void> {
  await apiFetch(`/api/dashboard/clients/${clientId}/quote-requests/${requestId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

/** Set the per-client expected margin (%) used by the best-option calc. */
export async function setRfqExpectedMargin(
  clientId: string,
  expectedMarginPct: number,
): Promise<number> {
  const data = await apiFetch(`/api/dashboard/clients/${clientId}/rfq-expected-margin`, {
    method: 'PATCH',
    body: JSON.stringify({ expectedMarginPct }),
  });
  return typeof data.expectedMarginPct === 'number' ? data.expectedMarginPct : expectedMarginPct;
}


