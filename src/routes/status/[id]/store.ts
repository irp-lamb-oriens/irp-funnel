import { writable, get } from 'svelte/store';
import { irpStaffToken } from '../../../lib/auth/irpStaff.ts';

function getApiUrl(): string {
  if (typeof window !== 'undefined') {
    if (window.location.origin.startsWith('http://localhost')) {
      return 'http://localhost:8000';
    }
  }
  return 'https://irp-funnel-server.onrender.com';
}

const API_BASE = getApiUrl();

export const isAuthenticated = writable(false);
export const isCheckingAuth = writable(true);
export const authEmail = writable('');
export const authToken = writable<string | null>(null);

// We store the token in localStorage with a key specific to client portal
if (typeof window !== 'undefined') {
  const token = localStorage.getItem('client_token');
  if (token) authToken.set(token);
}

export const project = writable<any>(null);
export const loading = writable(false);
export const error = writable('');
export const stages = writable<string[]>([]);
export const stageLabels = writable<Record<string, string>>({});

/**
 * Operator-configured client-visible Overview fields ("Your details" card).
 * Each entry: { id, label, valueType, options?, placeholder?, editable, value }.
 * Populated by fetchProject from the project payload's `clientFields`.
 */
export const clientFields = writable<any[]>([]);

/**
 * Per-field client visibility/editability for the built-in "Project Details"
 * card (route/budget/size/immigrationStatus/property/vehicles). Resolved from
 * the centralized Overview Field Registry and populated by fetchProject from the
 * project payload's `projectFieldFlags`. Shape: { [id]: { visible, editable } }.
 * Empty `{}` when the server hasn't sent it (older server / cold start) — the
 * status page then falls back to its legacy always-on defaults, so this is fully
 * backward compatible.
 */
export const projectFieldFlags = writable<Record<string, { visible: boolean; editable: boolean }>>({});

/**
 * Dashboard-configured client offer popup (Automations → Client offer). Shown
 * once (per browser) when the client gains access to their status page. `null`
 * when disabled/absent so nothing renders — fully backward compatible.
 */
export interface ClientOffer {
  enabled: boolean;
  title: string;
  bodyHtml: string;
  ctaLabel: string;
  ctaUrl: string;
}
export const clientOffer = writable<ClientOffer | null>(null);




// ─── Lily Chat stores (declared early so fetchProject can reference them) ───
export const lilyMessages = writable<any[]>([]);
export const lilyLoading = writable(false);
/** Cached HeroForm prefix. Set by loadLilyHistory; used by sendLilyMessage to
 *  re-apply the prefix after the server returns an updated rawTail. */
let _heroPrefix: any[] = [];

// Generic fetch wrapper. Injects two tokens when available:
//   - `x-client-token`     — the end-customer's client-portal session
//   - `x-dashboard-token`  — the IRP staff dashboard session (for staff bypass)
// The server's `requireClientAuth` middleware accepts either, preferring the
// dashboard token so an organization agent already signed into /dashboard
// transparently authorizes every /api/client-status call without seeing the
// OTP wall.
async function apiFetch(endpoint: string, options: RequestInit = {}) {
  const clientToken = get(authToken);
  const staffToken = get(irpStaffToken);

  const headers = new Headers(options.headers);
  if (clientToken) headers.set('x-client-token', clientToken);
  if (staffToken) headers.set('x-dashboard-token', staffToken);
  headers.set('Content-Type', 'application/json');

  const res = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });

  if (res.status === 401) {
    // Don't auto-logout staff just because a stale per-page client_token
    // happened to fail — only clear the client-portal session.
    if (clientToken) logout();
    throw new Error('Session expired');
  }

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'API Error');
  return data;
}

export async function requestClientOTP(email: string, projectId: string): Promise<string> {
  const data = await apiFetch('/api/client-status/auth/request-otp', {
    method: 'POST',
    body: JSON.stringify({ email, projectId })
  });
  return data.message;
}

export async function verifyClientOTP(email: string, projectId: string, code: string): Promise<void> {
  const data = await apiFetch('/api/client-status/auth/verify-otp', {
    method: 'POST',
    body: JSON.stringify({ email, projectId, code })
  });
  
  if (data.token) {
    authToken.set(data.token);
    authEmail.set(data.email);
    isAuthenticated.set(true);
    if (typeof window !== 'undefined') {
      localStorage.setItem('client_token', data.token);
    }
  }
}

export async function checkClientAuth(): Promise<boolean> {
  isCheckingAuth.set(true);
  try {
    const data = await apiFetch('/api/client-status/auth/check');
    if (data.authenticated) {
      isAuthenticated.set(true);
      authEmail.set(data.email);
      isCheckingAuth.set(false);
      return true;
    }
  } catch (err) {
    // silently fail and prompt login
  }
  logout();
  isCheckingAuth.set(false);
  return false;
}

export function logout() {
  isAuthenticated.set(false);
  authEmail.set('');
  authToken.set(null);
  project.set(null);
  if (typeof window !== 'undefined') {
    localStorage.removeItem('client_token');
  }
}

export async function fetchProject(projectId: string) {
  loading.set(true);
  error.set('');
  try {
    const data = await apiFetch(`/api/client-status/project/${projectId}`);
    project.set(data.project);
    stages.set(data.stages || []);
    stageLabels.set(data.stageLabels || {});
    // Operator-configured "Your details" fields + per-field Project Details flags.
    // Both default to empty when absent (older server), so the status page keeps
    // its legacy always-on rendering — fully backward compatible.
    clientFields.set(Array.isArray(data.clientFields) ? data.clientFields : []);
    projectFieldFlags.set(data.projectFieldFlags && typeof data.projectFieldFlags === 'object' ? data.projectFieldFlags : {});
    // Dashboard-configured offer popup. Server sends `null` when disabled or for
    // staff viewers, so nothing renders — fully backward compatible.
    clientOffer.set(
      data.clientOffer && typeof data.clientOffer === 'object' && data.clientOffer.enabled
        ? data.clientOffer
        : null,
    );


    // Per-client, per-template proposal overrides (staff-edited WYSIWYG). Keyed
    // by templateId. Absent → {} so the status page shows the shared template.
    const overrides = data.project?.proposalOverrides;
    proposalOverrides.set(
      overrides && typeof overrides === 'object' && !Array.isArray(overrides) ? overrides : {},
    );



    // Pre-seed Lily chat from the HeroForm conversation so the client sees
    // their initial consultation immediately when they open the drawer —
    // no second API call required, no async timing gap.
    // `loadLilyHistory` will later overwrite with the real statusChatThread
    // if one already exists (i.e. the client has chatted before).
    const heroHistory: Array<{ role: string; content: string }> =
      data.project?.heroFormChatHistory ?? [];
    if (heroHistory.length > 0 && get(lilyMessages).length === 0) {
      const now = Date.now();
      lilyMessages.set(
        heroHistory.map((m, i, arr) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
          author: m.role === 'assistant' ? 'Lily' : undefined,
          authorType: (m.role === 'assistant' ? 'lily' : 'client') as any,
          timestamp: new Date(now - (arr.length - i) * 3_000).toISOString(),
        })),
      );
    }
  } catch (err: any) {
    error.set(err.message);
  } finally {
    loading.set(false);
  }
}

// ─── Lily Chat ─────────────────────────────────────────────────────────────

/** Load the existing Lily chat thread for this project (status scope).
 *
 *  Always merges heroFormChatHistory as a read-only prefix so the client
 *  sees their initial consultation conversation at the top, followed by any
 *  messages they've sent via the status-page chat.
 *
 *  Deduplication: if rawTail already starts with the HeroForm content (thread
 *  was seeded on server before first user message), we use rawTail as-is.
 */
export async function loadLilyHistory(projectId: string): Promise<void> {
  try {
    const data = await apiFetch(`/api/client-status/project/${projectId}/lily/history`);
    const rawTail: any[] = data.thread?.rawTail ?? [];
    const heroHistory: Array<{ role: string; content: string }> =
      data.heroFormChatHistory ?? [];
    const now = Date.now();

    if (rawTail.length === 0 && heroHistory.length === 0) {
      lilyMessages.set([]);
      return;
    }

    // Build evenly-spaced HeroForm messages as a static prefix
    const makeHeroMessages = (offset: number) =>
      heroHistory.map((m, i, arr) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
        author: m.role === 'assistant' ? 'Lily' : undefined,
        authorType: (m.role === 'assistant' ? 'lily' : 'client') as any,
        timestamp: new Date(now - (arr.length + offset - i) * 3_000).toISOString(),
      }));

    if (rawTail.length === 0) {
      // First-time visitor — show only HeroForm; cache for sendLilyMessage
      const msgs = makeHeroMessages(0);
      _heroPrefix = msgs;
      lilyMessages.set(msgs);
      return;
    }

    if (heroHistory.length === 0) {
      // No HeroForm conversation — show status thread as-is
      _heroPrefix = [];
      lilyMessages.set(rawTail);
      return;
    }

    // Both exist. Check if rawTail was already seeded with HeroForm content
    // (i.e. the thread was built by chatWithLily after seeding). If rawTail[0]
    // content matches heroHistory[0] content the seeding is already there.
    const alreadySeeded = rawTail[0]?.content?.trim() === heroHistory[0]?.content?.trim();
    if (alreadySeeded) {
      // rawTail already includes the HeroForm prefix — no separate prefix needed
      _heroPrefix = [];
      lilyMessages.set(rawTail);
    } else {
      // Returning user whose thread existed before the seeding feature —
      // prepend HeroForm prefix to the existing status messages.
      const prefix = makeHeroMessages(rawTail.length);
      _heroPrefix = prefix;
      lilyMessages.set([...prefix, ...rawTail]);
    }
  } catch { /* silent — empty thread is fine */ }
}

/** Send a message to Lily. Optimistically pushes the user bubble,
 *  then replaces with the authoritative rawTail from the server.
 *  Re-applies _heroPrefix so the HeroForm context stays visible. */
export async function sendLilyMessage(projectId: string, message: string): Promise<void> {
  const now = new Date().toISOString();
  lilyMessages.update((msgs) => [
    ...msgs,
    { role: 'user', content: message, timestamp: now },
  ]);
  lilyLoading.set(true);
  try {
    const data = await apiFetch(`/api/client-status/project/${projectId}/lily`, {
      method: 'POST',
      body: JSON.stringify({ message }),
    });
    const rawTail: any[] = data.rawTail ?? [];
    // Re-apply the HeroForm prefix if it exists and isn't already seeded in rawTail
    if (_heroPrefix.length > 0) {
      const alreadySeeded = rawTail[0]?.content?.trim() === _heroPrefix[0]?.content?.trim();
      lilyMessages.set(alreadySeeded ? rawTail : [..._heroPrefix, ...rawTail]);
    } else {
      lilyMessages.set(rawTail);
    }
  } catch {
    lilyMessages.update((msgs) => [
      ...msgs,
      {
        role: 'assistant',
        content: "Sorry, I had trouble responding. Please try again.",
        timestamp: new Date().toISOString(),
      },
    ]);
  } finally {
    lilyLoading.set(false);
  }
}

// ─── Comments ────────────────────────────────────────────────────────────────

export async function addComment(projectId: string, body: string): Promise<void> {
  const data = await apiFetch(`/api/client-status/project/${projectId}/comment`, {
    method: 'POST',
    body: JSON.stringify({ body }),
  });
  if (data.comment) {
    project.update((p) =>
      p ? { ...p, statusComments: [...(p.statusComments ?? []), data.comment] } : p,
    );
  }
}

export async function editComment(
  projectId: string,
  commentId: string,
  body: string,
): Promise<void> {
  const data = await apiFetch(
    `/api/client-status/project/${projectId}/comment/${commentId}`,
    { method: 'PATCH', body: JSON.stringify({ body }) },
  );
  if (data.comment) {
    project.update((p) =>
      p
        ? {
            ...p,
            statusComments: (p.statusComments ?? []).map((c: any) =>
              c.id === commentId ? data.comment : c,
            ),
          }
        : p,
    );
  }
}

export async function updateProjectDetails(
  projectId: string,
  fields: Record<string, string>,
): Promise<void> {
  const data = await apiFetch(`/api/client-status/project/${projectId}/details`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(fields),
  });
  // Optimistic local update so the UI reflects changes without re-fetching
  project.update((p) => (p ? { ...p, ...fields } : p));
}

/**
 * Save operator-configured client-editable Overview fields ("Your details").
 * PATCHes the same /details endpoint (server validates each key against the
 * centralized registry: clientVisible + clientEditable + active + not read-only)
 * and optimistically mirrors the new values into the `clientFields` store.
 */
export async function saveClientFields(
  projectId: string,
  values: Record<string, unknown>,
): Promise<void> {
  await apiFetch(`/api/client-status/project/${projectId}/details`, {
    method: 'PATCH',
    body: JSON.stringify(values),
  });
  clientFields.update((rows) =>
    rows.map((f) => (f && f.id in values ? { ...f, value: values[f.id] } : f)),
  );
}


export async function deleteComment(projectId: string, commentId: string): Promise<void> {
  // Server-side this is a SOFT delete (the row is retained, flagged `deleted`,

  // for the CRM audit trail). We mirror that locally by marking the comment
  // deleted — the thread component filters out `deleted` entries from view.
  const data = await apiFetch(`/api/client-status/project/${projectId}/comment/${commentId}`, {
    method: 'DELETE',
  });
  project.update((p) =>
    p
      ? {
          ...p,
          statusComments: (p.statusComments ?? []).map((c: any) =>
            c.id === commentId ? (data?.comment ?? { ...c, deleted: true }) : c,
          ),
        }
      : p,
  );
}


// ─── Stage Ratings ────────────────────────────────────────────────────────────

export async function submitStageRating(
  projectId: string,
  stageKey: string,
  rating: number,
  note?: string,
): Promise<void> {
  const data = await apiFetch(`/api/client-status/project/${projectId}/stage-rating`, {
    method: 'POST',
    body: JSON.stringify({ stageKey, rating, ...(note ? { note } : {}) }),
  });
  if (data.stageRating) {
    project.update((p) =>
      p
        ? {
            ...p,
            stageRatings: { ...(p.stageRatings ?? {}), [stageKey]: data.stageRating },
          }
        : p,
    );
  }
}

// ─── Quotes ───────────────────────────────────────────────────────────────────

/** Shape of a quote as returned by GET /api/client-status/project/:id/quotes */
export interface ClientQuote {
  quoteId:          string;
  id?:              string;
  consultationId:   string;
  providerId:       string | null;
  providerName:     string;
  providerEmail:    string;
  amount:           number | null;
  currency:         string;
  validUntil:       string | null;
  serviceCategory:  string | null;
  shippingModality: string | null;
  notes:            string | null;
  /** 'received' | 'accepted' | 'rejected' — pending not shown to client */
  status:           'received' | 'accepted' | 'rejected';
  requestedAt:      string;
  receivedAt:       string | null;
}

export const quotes         = writable<ClientQuote[]>([]);
export const quotesLoading  = writable(false);
export const quotesError    = writable('');
export const acceptingQuote = writable(false);
export const acceptError    = writable('');

/** Load received/accepted quotes for the status page quote panel. */
export async function loadQuotes(projectId: string): Promise<void> {
  quotesLoading.set(true);
  quotesError.set('');
  try {
    const data = await apiFetch(`/api/client-status/project/${projectId}/quotes`);
    quotes.set(data.quotes ?? []);
  } catch (err: any) {
    quotesError.set(err.message ?? 'Failed to load quotes.');
  } finally {
    quotesLoading.set(false);
  }
}

/**
 * Accept a quote with a full-name attestation and explicit consent.
 * The server requires { fullName, consent: true } in addition to the optional
 * quoteId; both are enforced server-side (400 if missing/false).
 *
 * On success:
 *  • Updates the local `project` store stage to 'sales_quote_acceptance'.
 *  • Updates the accepted quote's status in the local `quotes` store.
 */
export async function acceptQuote(
  projectId: string,
  opts: { quoteId?: string; fullName: string; consent: true },
): Promise<{ success: boolean; error?: string }> {
  acceptingQuote.set(true);
  acceptError.set('');
  try {
    const { quoteId, fullName, consent } = opts;
    const data = await apiFetch(`/api/client-status/project/${projectId}/accept-quote`, {
      method: 'POST',
      body: JSON.stringify({ ...(quoteId ? { quoteId } : {}), fullName, consent }),
    });

    // Mirror the stage update locally so the UI reacts instantly
    project.update((p) =>
      p ? { ...p, stage: data.newStage ?? 'sales_quote_acceptance' } : p,
    );

    // Mark the accepted quote in the local list
    if (data.quoteId) {
      quotes.update((qs) =>
        qs.map((q) =>
          (q.quoteId ?? q.id) === data.quoteId
            ? { ...q, status: 'accepted' as const }
            : q,
        ),
      );
    }

    return { success: true };
  } catch (err: any) {
    const msg = err.message ?? 'Quote acceptance failed.';
    acceptError.set(msg);
    return { success: false, error: msg };
  } finally {
    acceptingQuote.set(false);
  }
}

// ─── Template Proposal System ──────────────────────────────────────────────────
//
// The status page can render a Qwilr-style proposal document from a
// QuoteTemplate (independent of a specific quote token). Staff select the
// template; AI auto-selects a default after locked-loading. Clients see
// whatever template is selected.
//
// Stores:
//   selectedTemplateId  — templateId persisted on the consultation doc
//   templateBlocks      — blocks[] from the selected template (fetched on demand)
//   templateSections    — unique section labels from templateBlocks (for Header tabs)
//   activeSection       — which section tab is currently shown in BlockRenderer
//   templateInferred    — true once AI inference has run for this session
//   allTemplates        — list of all templates for the staff selector dropdown

import { derived } from 'svelte/store';
import type { QuoteBlock } from '../../dashboard/store.ts';

export const selectedTemplateId  = writable<string | null>(null);
export const templateBlocks      = writable<QuoteBlock[]>([]);
export const activeSection       = writable<string | null>(null);
export const templateInferred    = writable<boolean>(false);
export const allTemplatesLoading = writable<boolean>(false);

export interface TemplateSummary {
  templateId: string;
  name: string;
  category?: string | null;
  destinationCountries?: string[];
  isDefault?: boolean;
  order?: number;
}
export const allTemplates = writable<TemplateSummary[]>([]);

// ─── Per-client proposal overrides (staff-edited WYSIWYG) ──────────────────────
//
// A staff member can rewrite the proposal document for THIS client only, right
// on the /status page. The edited blocks are stored per-templateId on the
// consultation doc (never on the shared quote_templates document). So:
//   • edit template A → override saved under proposalOverrides["A"]
//   • switch to template B → shows B raw (no override yet)
//   • edit B → override saved under proposalOverrides["B"], A untouched
//   • switch back to A → A's override reappears
//
// Shape: { [templateId]: { blocks: QuoteBlock[], updatedAt?, updatedBy? } }
export const proposalOverrides = writable<
  Record<string, { blocks: QuoteBlock[]; updatedAt?: string; updatedBy?: string }>
>({});

/** Unique ordered section labels extracted from the current template blocks. */
const rawTemplateSections = derived(templateBlocks, ($blocks): string[] => {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const b of $blocks) {
    if (b.section && !seen.has(b.section)) {
      seen.add(b.section);
      result.push(b.section);
    }
  }
  return result;
});

/**
 * The blocks the status page should actually render for this client: the
 * per-client override for the currently-selected template if one exists,
 * otherwise the shared template's blocks. Single source of truth consumed by
 * both the BlockRenderer and the section-tab derivation.
 */
export const effectiveTemplateBlocks = derived(
  [templateBlocks, proposalOverrides, selectedTemplateId],
  ([$blocks, $overrides, $tid]): QuoteBlock[] => {
    const ov = $tid ? $overrides[$tid] : undefined;
    if (ov && Array.isArray(ov.blocks) && ov.blocks.length > 0) return ov.blocks;
    return $blocks;
  },
);

/** True when the currently-selected template has a client-specific override. */
export const hasProposalOverride = derived(
  [proposalOverrides, selectedTemplateId],
  ([$overrides, $tid]): boolean =>
    !!($tid && $overrides[$tid] && Array.isArray($overrides[$tid].blocks)),
);

/**
 * Unique ordered section labels — derived from the EFFECTIVE blocks so that a
 * staff override's sections drive the Header tabs too (not just the base
 * template's). Unused import `rawTemplateSections` kept null-effect below.
 */
export const templateSections = derived(effectiveTemplateBlocks, ($blocks): string[] => {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const b of $blocks) {
    if (b.section && !seen.has(b.section)) {
      seen.add(b.section);
      result.push(b.section);
    }
  }
  return result;
});
// rawTemplateSections is retained for backward compatibility but not exported.
void rawTemplateSections;

/**
 * Staff-only: save the per-client proposal override for a specific template.
 * Writes consultations/{id}.proposalOverrides[templateId] via the dashboard
 * endpoint; NEVER mutates the shared quote_templates document.
 */
export async function saveProposalOverride(
  projectId: string,
  templateId: string,
  blocks: QuoteBlock[],
): Promise<void> {
  const data = await apiFetch(
    `/api/dashboard/clients/${projectId}/proposal-blocks-override`,
    { method: 'PATCH', body: JSON.stringify({ templateId, blocks }) },
  );
  if (data.proposalOverrides && typeof data.proposalOverrides === 'object') {
    proposalOverrides.set(data.proposalOverrides);
  } else {
    proposalOverrides.update((m) => ({
      ...m,
      [templateId]: { blocks, updatedAt: new Date().toISOString() },
    }));
  }
}

/**
 * Staff-only: clear the per-client override for a specific template, reverting
 * the client's proposal back to the shared template content.
 */
export async function resetProposalOverride(
  projectId: string,
  templateId: string,
): Promise<void> {
  const data = await apiFetch(
    `/api/dashboard/clients/${projectId}/proposal-blocks-override`,
    { method: 'PATCH', body: JSON.stringify({ templateId, blocks: null }) },
  );
  if (data.proposalOverrides && typeof data.proposalOverrides === 'object') {
    proposalOverrides.set(data.proposalOverrides);
  } else {
    proposalOverrides.update((m) => {
      const next = { ...m };
      delete next[templateId];
      return next;
    });
  }
}


/**
 * Fetch a template's blocks via the PUBLIC endpoint (no auth required).
 * Falls back to the default template on 404.
 */
export async function loadTemplate(templateId: string): Promise<void> {
  // Set selectedTemplateId FIRST — acts as an idempotent guard so the reactive
  // block in +page.svelte (keyed on `!$selectedTemplateId`) doesn't re-fire on
  // fetch failure (empty blocks + null id → infinite retry loop).
  selectedTemplateId.set(templateId);
  try {
    const data = await apiFetch(`/api/template/${templateId}`);
    templateBlocks.set(data.blocks ?? []);
    // Auto-select first section tab
    const sections = (data.blocks ?? [])
      .map((b: any) => b.section)
      .filter(Boolean)
      .filter((s: string, i: number, arr: string[]) => arr.indexOf(s) === i);
    if (sections.length > 0) activeSection.set(sections[0]);
  } catch {
    templateBlocks.set([]);
    activeSection.set(null);
    // selectedTemplateId is intentionally NOT reset here — keeps the guard intact
    // so +page.svelte's reactive block won't re-trigger after a failed fetch.
  }
}

/**
 * Call the AI infer-template endpoint (dashboard-auth required — staff only).
 * Persists `selectedQuoteTemplateId` on the consultation, then loads the blocks.
 */
export async function inferTemplate(projectId: string): Promise<void> {
  if (get(templateInferred)) return; // run once per session
  templateInferred.set(true);
  try {
    const data = await apiFetch(`/api/dashboard/clients/${projectId}/infer-template`, {
      method: 'POST',
    });
    const tid: string = data.templateId ?? 'irp-standard-proposal';
    await loadTemplate(tid);
  } catch {
    // Inference failed → load the default template
    await loadTemplate('irp-standard-proposal');
  }
}

/**
 * Staff explicitly selects a different template — persists it on the consultation
 * and in the local store.
 */
export async function setSelectedTemplate(projectId: string, templateId: string): Promise<void> {
  selectedTemplateId.set(templateId);
  await loadTemplate(templateId);
  // Persist to consultation (best-effort; non-fatal if it fails)
  try {
    await apiFetch(`/api/dashboard/clients/${projectId}/infer-template`, {
      method: 'POST',
      body: JSON.stringify({ overrideTemplateId: templateId }),
    });
  } catch { /* non-fatal */ }
}

/**
 * Load the full list of templates for the staff selector dropdown.
 * Requires dashboard-auth (x-dashboard-token). No-op for end-customers.
 */
export async function loadAllTemplates(): Promise<void> {
  allTemplatesLoading.set(true);
  try {
    const data = await apiFetch('/api/dashboard/quote-templates');
    allTemplates.set(
      (data.templates ?? []).map((t: any) => ({
        templateId: t.templateId,
        name: t.name,
        category: t.category ?? null,
        destinationCountries: t.destinationCountries ?? [],
        isDefault: t.isDefault ?? false,
        order: t.order ?? 9999,
      })),
    );
  } catch {
    // Non-fatal — staff won't see the dropdown, client is unaffected
  } finally {
    allTemplatesLoading.set(false);
  }
}
