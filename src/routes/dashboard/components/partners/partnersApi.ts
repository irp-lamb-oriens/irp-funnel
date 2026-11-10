/**
 * partnersApi.ts — dashboard client for /api/dashboard/partners
 * (irp-funnel-server/API/partners/partnersRouter.ts). Types mirror
 * partnersEngine.ts; the server does all money math.
 */
import { writable } from 'svelte/store';
import { apiFetch } from '../../store.ts';

export type PartnerType = 'influencer' | 'media' | 'expert' | 'teacher' | 'agent' | 'client' | 'other';
export type PartnerStatus = 'invited' | 'active' | 'paused' | 'archived';
export type CommissionModel = 'percent_cash' | 'percent_margin' | 'flat_per_sale' | 'monthly_recurring';

export interface CommissionPlan {
  model: CommissionModel;
  rate?: number | null;
  flat?: number | null;
  months?: number | null;
}

export interface PartnerLink {
  id: string;
  product: string;
  label: string;
  medium: string;
  campaign: string;
  destination: string;
  createdAt: string;
  archived?: boolean;
  url: string;
}

export interface DealOverride { mode: 'void' | 'fixed'; amount?: number | null; note?: string | null; at?: string | null; by?: string | null }

export interface ReferralLine {
  dealKey: string;
  product: string;
  clientLabel: string;
  clientName: string;
  via: 'manual' | 'first_touch' | 'touch' | 'referred_by' | 'external';
  attributedAt: string | null;
  leadAt: string | null;
  paidAt: string | null;
  stage: 'lead' | 'quoted' | 'accepted' | 'paid' | 'dropped';
  currency: string;
  booked: number;
  cash: number;
  earned: number;
  projected: number;
  override: DealOverride | null;
  campaign: string;
}

export interface PeriodTotals { key: string; leads: number; closed: number; earned: number; paid: number; cancelled: number }

export interface Payout {
  id: string;
  partnerId: string;
  amount: number;
  currency?: string | null;
  date: string;
  method?: string | null;
  reference?: string | null;
  note?: string | null;
  status?: 'paid' | 'cancelled' | null;
  createdBy?: string | null;
}

export interface PartnerStatement {
  partnerId: string;
  currency: string;
  since: string | null;
  lifetime: { clicks: number; leads: number; closed: number; earned: number; paid: number; balance: number; pipeline: number; cancelled: number; revenue: number; payouts: number };
  years: PeriodTotals[];
  months: PeriodTotals[];
  referrals: ReferralLine[];
  payouts: Payout[];
  otherCurrencies: Record<string, number>;
  firstLeadAt: string | null;
  lastLeadAt: string | null;
}

export interface BankDetails {
  holderName?: string; bankName?: string; country?: string; accountNumber?: string; iban?: string;
  swift?: string; routingNumber?: string; paypalEmail?: string; preferredMethod?: string; notes?: string; updatedAt?: string;
}

export interface Partner {
  id: string;
  code: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  type: PartnerType;
  status: PartnerStatus;
  currency?: string | null;
  commission: CommissionPlan;
  productCommissions?: Record<string, CommissionPlan> | null;
  links: PartnerLink[];
  dealOverrides?: Record<string, DealOverride> | null;
  portalToken?: string | null;
  portalUrl: string;
  bankDetails?: BankDetails | null;
  monthlyReport?: boolean | null;
  since?: string | null;
  notes?: string | null;
  createdAt?: string | null;
  termsAcceptedAt?: string | null;
  portalSeenAt?: string | null;
  invitedAt?: string | null;
  statement: PartnerStatement;
}

export interface PartnersReport {
  generatedAt: string;
  partners: Partner[];
  suggestions: Array<{ consultationId: string; partnerId: string; referredBy: string; clientName: string }>;
  attribution: Record<string, { partnerId: string; via: string }>;
  totals: {
    partners: number; leads: number; closed: number; earned: number; paid: number; balance: number; pipeline: number;
    yearLeads: number; yearClosed: number; yearEarned: number; yearPaid: number; monthLeads: number;
  };
  products: Record<string, { label: string; baseUrl: string }>;
  types: PartnerType[];
  statuses: PartnerStatus[];
  models: CommissionModel[];
}

export const partnersReport = writable<PartnersReport | null>(null);

let seq = 0;
export async function fetchPartners(fresh = false): Promise<PartnersReport> {
  const ticket = ++seq;
  const data = (await apiFetch(`/api/dashboard/partners${fresh ? '?fresh=1' : ''}`)) as PartnersReport;
  if (ticket === seq) partnersReport.set(data);
  return data;
}

const json = (method: string, body?: unknown): RequestInit => ({ method, body: body === undefined ? undefined : JSON.stringify(body) });
const enc = encodeURIComponent;

export const createPartner = (b: Record<string, unknown>) => apiFetch('/api/dashboard/partners', json('POST', b));
export const updatePartner = (id: string, b: Record<string, unknown>) => apiFetch(`/api/dashboard/partners/${enc(id)}`, json('PUT', b));
export const createLink = (id: string, b: Record<string, unknown>) => apiFetch(`/api/dashboard/partners/${enc(id)}/links`, json('POST', b));
export const updateLink = (id: string, linkId: string, b: Record<string, unknown>) => apiFetch(`/api/dashboard/partners/${enc(id)}/links/${enc(linkId)}`, json('PUT', b));
export const recordPayout = (id: string, b: Record<string, unknown>) => apiFetch(`/api/dashboard/partners/${enc(id)}/payouts`, json('POST', b));
export const updatePayout = (payoutId: string, b: Record<string, unknown>) => apiFetch(`/api/dashboard/partners/payouts/${enc(payoutId)}`, json('PUT', b));
export const setOverride = (id: string, dealKey: string, b: Record<string, unknown>) => apiFetch(`/api/dashboard/partners/${enc(id)}/overrides/${enc(dealKey)}`, json('PUT', b));
export const clearOverride = (id: string, dealKey: string) => apiFetch(`/api/dashboard/partners/${enc(id)}/overrides/${enc(dealKey)}`, json('DELETE'));
export const attributeClient = (b: { consultationId: string; partnerId: string; note?: string }) => apiFetch('/api/dashboard/partners/attributions', json('POST', b));
export const removeAttribution = (cid: string) => apiFetch(`/api/dashboard/partners/attributions/${enc(cid)}`, json('DELETE'));
export const sendInvite = (id: string) => apiFetch(`/api/dashboard/partners/${enc(id)}/invite`, json('POST', {}));
export const sendStatement = (id: string, month?: string) => apiFetch(`/api/dashboard/partners/${enc(id)}/statement-email`, json('POST', { month }));
export const rotateToken = (id: string) => apiFetch(`/api/dashboard/partners/${enc(id)}/rotate-token`, json('POST', {}));

// ── Formatting ──

export function money(n: number | null | undefined, cur = 'USD'): string {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: cur || 'USD', maximumFractionDigits: 0 }).format(n ?? 0);
  } catch {
    return `${cur} ${Math.round(n ?? 0)}`;
  }
}

export function money2(n: number | null | undefined, cur = 'USD'): string {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: cur || 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n ?? 0);
  } catch {
    return `${cur} ${(n ?? 0).toFixed(2)}`;
  }
}

export function shortDate(iso: string | null | undefined): string {
  if (!iso || iso === 'undated') return '—';
  const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso}T12:00:00Z` : iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function monthName(key: string): string {
  if (!/^\d{4}-\d{2}$/.test(key)) return key === 'undated' ? 'Undated' : key;
  const [y, m] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 15)).toLocaleString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
}

export function planLabel(p: CommissionPlan | null | undefined, cur = 'USD'): string {
  if (!p) return '—';
  switch (p.model) {
    case 'percent_cash': return `${p.rate ?? 0}% of what the client pays`;
    case 'percent_margin': return `${p.rate ?? 0}% of margin`;
    case 'flat_per_sale': return `${money(p.flat ?? 0, cur)} per sale`;
    case 'monthly_recurring': return `${money(p.flat ?? 0, cur)}/month for ${p.months || 12} months`;
  }
  return '—';
}

export const TYPE_LABELS: Record<PartnerType, string> = {
  influencer: 'Influencer', media: 'Media', expert: 'Expert', teacher: 'Teacher', agent: 'Agent / broker', client: 'Past client', other: 'Other',
};

export const MODEL_LABELS: Record<CommissionModel, string> = {
  percent_cash: '% of what the client pays',
  percent_margin: '% of margin',
  flat_per_sale: 'Fixed amount per sale',
  monthly_recurring: 'Fixed amount per month',
};

export const STAGE_LABELS: Record<ReferralLine['stage'], string> = {
  lead: 'Lead', quoted: 'Quoted', accepted: 'Accepted', paid: 'Bought', dropped: 'Dropped',
};

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
