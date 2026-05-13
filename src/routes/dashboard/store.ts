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
  | 'lcl_full_service';

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
  sales_post_transcript: 'Post Transcript',
  private_feedback_a: 'Feedback A',
  sales_pricing_quote: 'Pricing Quote',
  sales_quote_acceptance: 'Quote Acceptance',
  sales_initial_payment: 'Initial Payment',
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
  sales_post_transcript: '📝',
  private_feedback_a: '💬',
  sales_pricing_quote: '💰',
  sales_quote_acceptance: '✅',
  sales_initial_payment: '💳',
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
  sales_post_transcript: '#a78bfa',
  private_feedback_a: '#c084fc',
  sales_pricing_quote: '#8b5cf6',
  sales_quote_acceptance: '#7c3aed',
  sales_initial_payment: '#6d28d9',
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

export const EMAIL_TYPES = [
  { value: 'pre_call_confirmation', label: 'Pre-Call Confirmation' },
  { value: 'pre_call_guide', label: 'Pre-Call Guide' },
  { value: 'no_show_1', label: 'No Show Follow-up' },
  { value: 'nurture_feedback', label: 'Nurture: Feedback' },
  { value: 'nurture_newsletter', label: 'Nurture: Newsletter' },
  { value: 'nurture_youtube', label: 'Nurture: YouTube' },
  { value: 'quote_recap', label: 'Quote Recap' },
  { value: 'quote_checkin', label: 'Quote Check-in' },
  { value: 'quote_proposal_feedback', label: 'Quote Proposal Feedback' },
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

export const activeView = writable<'board' | 'list' | 'metrics' | 'evo'>('board');
export const detailPanelOpen = writable<boolean>(false);

/**
 * The id of the `sentEmails/{autoId}` snapshot currently shown in the
 * <EmailPreviewDrawer>. Setting it to a non-empty string opens the drawer
 * and triggers a fetch; setting it to `null` closes the drawer. Driven by
 * clicks on the Emails-tab "Sent emails (N)" rows in <DetailPanel>.
 */
export const selectedSentEmailId = writable<string | null>(null);

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
    if (grouped[stage]) grouped[stage].push(c);
    else grouped['sales_opt_in_email'].push(c);
  }
  return grouped;
});

// ─── API helper ─────────────────────────────────────────────────────────────
function getApiUrl(): string {
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
  const data = await res.json();

  if (!res.ok) {
    if (res.status === 401) {
      // Session expired
      authToken.set(null);
      authEmail.set(null);
      isAuthenticated.set(false);
    }
    throw new Error(data.error || `Request failed: ${res.status}`);
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

// ─── Data actions ───────────────────────────────────────────────────────────
export async function fetchClients(): Promise<void> {
  loading.set(true);
  error.set(null);
  try {
    const data = await apiFetch('/api/dashboard/clients');
    clients.set(data.clients);
  } catch (err: any) {
    error.set(err.message);
  } finally {
    loading.set(false);
  }
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

export async function addNote(id: string, text: string): Promise<Note> {
  const data = await apiFetch(`/api/dashboard/clients/${id}/notes`, {
    method: 'POST',
    body: JSON.stringify({ text }),
  });
  const note = data.note;
  clients.update(list =>
    list.map(c => c.id === id ? { ...c, agentNotes: [...(c.agentNotes || []), note] } : c)
  );
  selectedClient.update(c => c && c.id === id ? { ...c, agentNotes: [...(c.agentNotes || []), note] } : c);
  return note;
}

export async function fetchConversations(id: string, email?: string): Promise<any[]> {
  console.log(`[CLIENT FETCH] Starting fetchConversations for client ID: ${id}`);
  console.log(`[CLIENT FETCH] Provided email param: ${email}`);
  const params = email ? `?email=${encodeURIComponent(email)}` : '';
  const endpoint = `/api/dashboard/clients/${id}/conversations${params}`;
  console.log(`[CLIENT FETCH] Full relative endpoint: ${endpoint}`);
  
  try {
    const data = await apiFetch(endpoint);
    console.log(`[CLIENT FETCH] Response SUCCESS from server!`);
    console.log(`[CLIENT FETCH] Raw data parsed from JSON:`, data);
    
    if (data && data.conversations) {
      console.log(`[CLIENT FETCH] Returning array of length ${data.conversations.length}`);
      return data.conversations;
    } else {
      console.warn(`[CLIENT FETCH] data.conversations is missing or undefined! Returned data:`, data);
      return [];
    }
  } catch (error) {
    console.error(`[CLIENT FETCH] ERROR fetching conversations for ${id}:`, error);
    throw error;
  }
}

export async function fetchCollectionData(collection: string): Promise<any[]> {
  const data = await apiFetch(`/api/dashboard/bi/${collection}`);
  return data.documents || [];
}

export async function triggerEmail(id: string, emailType: string): Promise<void> {
  await apiFetch(`/api/dashboard/clients/${id}/trigger-email`, {
    method: 'POST',
    body: JSON.stringify({ emailType }),
  });
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

export async function fetchClientActions(id: string): Promise<{ stage: string; actions: ClientActionsPayload }> {
  const data = await apiFetch(`/api/dashboard/clients/${id}/actions`);
  return { stage: data.stage || '', actions: data.actions || {} };
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
  const data = await apiFetch(`/api/dashboard/clients/${id}/field`, {
    method: 'PATCH',
    body: JSON.stringify({ path, value, expectedOldValue }),
  });

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
