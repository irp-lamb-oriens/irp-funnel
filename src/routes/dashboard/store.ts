import { writable, derived, get } from 'svelte/store';
import { browser } from '$app/environment';
import store from '../../components/store.ts';

// ─── Types ──────────────────────────────────────────────────────────────────
export interface Client {
  id: string;
  name: string;
  surname: string;
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
  notes: Note[];
  customFields: Record<string, string>;
  activityLog: ActivityEntry[];
  dripEnabled: boolean;
  consultationCount: number;
  lastUpdated: string;
  createdAt: string;
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
  };
  monthlyLeads: Record<string, number>;
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
  ops_gathering: 'Gathering',
  ops_loading: 'Loading',
  ops_packing: 'Packing',
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
  ops_gathering: '📦',
  ops_loading: '🏗️',
  ops_packing: '📋',
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
  ops_gathering: '#3b82f6',
  ops_loading: '#2563eb',
  ops_packing: '#1d4ed8',
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

// ─── Stores ─────────────────────────────────────────────────────────────────
export const authToken = writable<string | null>(
  browser ? localStorage.getItem('dashboard_token') : null
);
export const authEmail = writable<string | null>(
  browser ? localStorage.getItem('dashboard_email') : null
);
export const isAuthenticated = writable<boolean>(false);
export const clients = writable<Client[]>([]);
export const selectedClient = writable<Client | null>(null);
export const metrics = writable<Metrics | null>(null);
export const loading = writable<boolean>(false);
export const error = writable<string | null>(null);
export const searchQuery = writable<string>('');
export const activeView = writable<'board' | 'list' | 'metrics'>('board');
export const detailPanelOpen = writable<boolean>(false);

// Persist auth token
if (browser) {
  authToken.subscribe(val => {
    if (val) localStorage.setItem('dashboard_token', val);
    else localStorage.removeItem('dashboard_token');
  });
  authEmail.subscribe(val => {
    if (val) localStorage.setItem('dashboard_email', val);
    else localStorage.removeItem('dashboard_email');
  });
}

// ─── Derived: clients grouped by stage ──────────────────────────────────────
export const clientsByStage = derived([clients, searchQuery], ([$clients, $search]) => {
  const stages = Object.keys(STAGE_LABELS);
  const grouped: Record<string, Client[]> = {};
  for (const s of stages) grouped[s] = [];

  const q = $search.toLowerCase().trim();

  for (const c of $clients) {
    if (q) {
      const haystack = `${c.name} ${c.surname} ${c.email} ${c.phone} ${c.originCountry} ${c.destinationCountry} ${c.originCity} ${c.destinationCity}`.toLowerCase();
      if (!haystack.includes(q)) continue;
    }
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
  authToken.set(data.token);
  authEmail.set(data.email);
  isAuthenticated.set(true);
}

export async function checkAuth(): Promise<boolean> {
  try {
    await apiFetch('/api/dashboard/auth/check');
    isAuthenticated.set(true);
    return true;
  } catch {
    isAuthenticated.set(false);
    return false;
  }
}

export function logout() {
  authToken.set(null);
  authEmail.set(null);
  isAuthenticated.set(false);
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
    list.map(c => c.id === id ? { ...c, notes: [...c.notes, note] } : c)
  );
  selectedClient.update(c => c && c.id === id ? { ...c, notes: [...c.notes, note] } : c);
  return note;
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
