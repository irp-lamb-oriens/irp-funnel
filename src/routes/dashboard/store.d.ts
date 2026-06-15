/**
 * AI-extracted shipping mode + packing tier classification + freeform
 * extracted facts. Mirrors `irp-funnel-server/helper/transcriptInsights.types.ts`.
 */
export type ShippingMode = 'car_only_in_container' | 'car_roro_only' | 'car_via_rail' | '20ft_container' | '40ft_container' | '20ft_household' | '20ft_household_plus_car' | '40ft_household' | '40ft_household_plus_car' | 'lcl';
export type PackingTier = 'self_pack_self_load' | 'self_pack_assisted_load' | 'full_pack_full_load' | 'lcl_full_service';
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
    vehicles: Array<{
        year: string;
        make: string;
        model: string;
    }>;
    scheduling: string[];
    stage: string;
    callOutcome: string | null;
    transcript: string;
    agentNotes: Note[];
    chatbotNotes: string[];
    chatHistory: Array<{
        role: string;
        content: string;
    }>;
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
export declare const STAGE_LABELS: Record<string, string>;
export declare const STAGE_ICONS: Record<string, string>;
export declare const STAGE_COLORS: Record<string, string>;
/**
 * CRM "stuck client" SLA thresholds — days a client may sit in a column before
 * the team is alerted. MIRRORS the backend source of truth
 * `irp-funnel-server/jobs/stageSla.ts → STAGE_SLA` (thresholdDays only).
 * KEEP THE TWO IN SYNC. Stages omitted here have NO SLA and are never flagged
 * overdue (e.g. sales_opt_in_email, sales_preconsultation, sale_dropped,
 * completed).
 */
export declare const STAGE_SLA_DAYS: Record<string, number>;
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
export declare function getStageSlaStatus(client: Client | null | undefined, now?: number): StageSlaStatus;
export interface EmailTypeDescriptor {
    value: string;
    label: string;
    subject?: string;
    category?: 'sales' | 'ops' | 'followup';
}
export declare const EMAIL_TYPES: {
    value: string;
    label: string;
}[];
/**
 * Pretty labels + emojis for AI-extracted shipping modes. Mirrors the server
 * `SHIPPING_MODE_LABEL` in helper/transcriptInsights.types.ts.
 */
export declare const SHIPPING_MODE_LABEL: Record<ShippingMode, {
    icon: string;
    label: string;
}>;
export declare const PACKING_TIER_LABEL: Record<PackingTier, {
    icon: string;
    label: string;
}>;
/** Human-friendly labels for canonical Firestore field paths. */
export declare const FIELD_LABEL: Record<string, string>;
/** Best-effort humanizer for any field path the dashboard renders. */
export declare function humanizeFieldLabel(path: string): string;
export declare const authToken: import("svelte/store").Writable<string | null>;
export declare const authEmail: import("svelte/store").Writable<string | null>;
export declare const isAuthenticated: import("svelte/store").Writable<boolean>;
export declare const isCheckingAuth: import("svelte/store").Writable<boolean>;
export declare const clients: import("svelte/store").Writable<Client[]>;
export declare const selectedClient: import("svelte/store").Writable<Client | null>;
export declare const metrics: import("svelte/store").Writable<Metrics | null>;
export declare const loading: import("svelte/store").Writable<boolean>;
export declare const error: import("svelte/store").Writable<string | null>;
export declare const searchQuery: import("svelte/store").Writable<string>;
export interface Filters {
    stage: string;
    originCountry: string;
    destinationCountry: string;
    budget: string;
    size: string;
    callOutcome: string;
}
export declare const filters: import("svelte/store").Writable<Filters>;
export declare const activeView: import("svelte/store").Writable<"board" | "list" | "metrics" | "evo" | "providers" | "posts" | "admin" | "templates">;
export declare const detailPanelOpen: import("svelte/store").Writable<boolean>;
/**
 * Incrementing this store signals `DetailPanel.svelte` to re-fetch
 * the live chat history if the Conversations tab is currently open.
 */
export declare const triggerConversationRefetch: import("svelte/store").Writable<number>;
/**
 * The id of the `sentEmails/{autoId}` snapshot currently shown in the
 * <EmailPreviewDrawer>. Setting it to a non-empty string opens the drawer
 * and triggers a fetch; setting it to `null` closes the drawer. Driven by
 * clicks on the Emails-tab "Sent emails (N)" rows in <DetailPanel>.
 */
export declare const selectedSentEmailId: import("svelte/store").Writable<string | null>;
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
    type: 'email_suggestion' | 'action_suggestion' | 'follow_up' | 'manual';
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
export declare const presendEmail: import("svelte/store").Writable<PresendEmailData | null>;
export declare const filteredClients: import("svelte/store").Readable<Client[]>;
export declare const clientsByStage: import("svelte/store").Readable<Record<string, Client[]>>;
/**
 * Total pending-action count per client id.
 * Unified over both `pendingEmailSuggestions` and `pendingActions`.
 * Used by <PendingBadge variant="card"> on every Kanban card.
 *
 * Map is empty for a client with no pending items.
 */
export declare const pendingCountByClient: import("svelte/store").Readable<Map<string, number>>;
/**
 * Per-tab pending count per client id.
 * Key: clientId → inner Map<tabKey, count>.
 * `pendingEmailSuggestions` always maps to the `'emails'` tab.
 * `pendingActions` route to whatever `action.tab` specifies.
 *
 * Used by <PendingBadge variant="tab"> inside the Detail Panel tab nav.
 */
export declare const pendingTabsByClient: import("svelte/store").Readable<Map<string, Map<string, number>>>;
/**
 * Create a new field-agnostic pending action on a client.
 * The system does not inspect or validate `action.meta`.
 */
export declare function addPendingAction(clientId: string, action: Omit<PendingAction, 'actionId' | 'clientId'>): Promise<PendingAction>;
/**
 * Resolve (mark done or dismissed) a pending action and trigger org
 * notifications to all `assignedTo` actors.
 */
export declare function resolvePendingAction(clientId: string, actionId: string, resolution: 'done' | 'dismissed'): Promise<void>;
export declare function getApiUrl(): string;
export declare function requestOTP(email: string): Promise<string>;
export declare function verifyOTP(email: string, code: string): Promise<void>;
export declare function checkAuth(): Promise<boolean>;
export declare function logout(): void;
export declare function initDashboardSocket(): Promise<void>;
export declare function disconnectDashboardSocket(): void;
export declare function fetchClients(): Promise<void>;
export declare function fetchClientDetail(id: string): Promise<Client>;
export declare function updateClientStage(id: string, stage: string): Promise<void>;
export declare function updateClientFields(id: string, customFields: Record<string, string>): Promise<void>;
export declare function addNote(id: string, text: string): Promise<Note>;
export declare function fetchConversations(id: string, email?: string): Promise<{
    conversations: any[];
    statusChatThread: any[];
}>;
export declare function fetchCollectionData(collection: string): Promise<any[]>;
/**
 * Thin wrapper kept for backward-compatibility.
 * Internally delegates to `triggerEmailWithEdit` which is the canonical
 * implementation supporting optional edit attribution + suggestion resolution.
 */
export declare function triggerEmail(id: string, emailType: string): Promise<void>;
export declare function fetchMetrics(): Promise<void>;
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
export declare function fetchClientActions(id: string, stage?: string): Promise<{
    stage: string;
    clientStage: string;
    actions: ClientActionsPayload;
}>;
/**
 * @deprecated Use `fetchClientActions(id, stage)` instead.
 * Kept as a thin alias so any call sites that haven't been migrated yet
 * continue to work without any changes.
 */
export declare function fetchClientActionsForStage(id: string, stage: string): Promise<{
    stage: string;
    clientStage: string;
    actions: ClientActionsPayload;
}>;
export declare function executeClientAction(id: string, actionKey: string, args: Record<string, any>): Promise<{
    success: boolean;
    result: any;
}>;
/** Result returned by `editField()`. */
export interface EditFieldResult {
    success: boolean;
    path: string;
    oldValue: unknown;
    newValue: unknown;
    entry: ActivityEntry & {
        fieldPath: string;
        oldValue: unknown;
        newValue: unknown;
    };
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
export declare function editField(id: string, path: string, value: unknown, expectedOldValue?: unknown): Promise<EditFieldResult>;
/**
 * Undo the most recent undoable change for this client. The server walks
 * the activityLog backwards and reverts the first `field_edit` /
 * `field_revert` / `stage_change` it finds. Notes / emails / AI
 * extractions are NOT undoable.
 */
export declare function undoLast(id: string): Promise<{
    success: boolean;
    undoType: 'field' | 'stage_change';
    path?: string;
    revertedTo?: unknown;
    entry?: ActivityEntry;
}>;
/**
 * On-demand AI transcript-insights extraction. Hits the LLM and persists
 * `transcriptInsights` on the consultation doc.
 *
 *   await extractInsights('b1e537da');                    // re-extract if stale
 *   await extractInsights('b1e537da', { force: true });   // force fresh extraction
 *   await extractInsights('b1e537da', { manualText: '...' }); // paste-to-extract
 */
export declare function extractInsights(id: string, opts?: {
    force?: boolean;
    manualText?: string;
}): Promise<TranscriptInsights | null>;
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
export declare function fetchSentEmail(id: string): Promise<SentEmailSnapshot>;
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
export declare function fetchEmailPreview(id: string, emailType: string): Promise<EmailPreviewResult>;
/**
 * Send an email with optional edit attribution metadata.
 * Backward-compatible: calling without editMeta behaves exactly like
 * the original `triggerEmail()`.
 *
 * @param editMeta  - `{ editedBy, editedAt }` when the operator modified the
 *                    body in the pre-send preview before confirming.
 */
export declare function triggerEmailWithEdit(id: string, emailType: string, editMeta?: {
    editedBy: string;
    editedAt: string;
}, suggestionId?: string): Promise<void>;
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
export declare const pendingEmailsForClient: import("svelte/store").Writable<Record<string, PendingQueueItem[]>>;
/** Fetch pending queue items for a specific client and store them. */
export declare function fetchPendingEmails(clientId: string): Promise<PendingQueueItem[]>;
/** Cancel a scheduled drip email (operator clicks "Don't send"). */
export declare function cancelPendingEmail(queueId: string, clientId: string, reason?: string): Promise<void>;
/** Force-send a scheduled drip email immediately (operator clicks "Send now"). */
export declare function sendPendingEmailNow(queueId: string, clientId: string): Promise<void>;
/**
 * Dismiss a pending email suggestion without sending the email.
 * The server removes the suggestion from `pendingEmailSuggestions` and
 * appends an `email_suggestion_dismissed` entry to `activityLog` with the
 * operator's email + timestamp for full audit trail.
 */
export declare function dismissEmailSuggestion(id: string, suggestionId: string): Promise<void>;
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
export declare function rescheduleCall(clientId: string, startISO: string, additionalAttendees?: string[]): Promise<{
    success: boolean;
    hangoutLink?: string;
    htmlLink?: string;
    eventId?: string;
    meetCode?: string;
    newSlot: string;
    oldSlot: string | null;
    alreadyExisted?: boolean;
}>;
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
export declare function createClientFromCrm(payload: CreateClientPayload): Promise<{
    success: boolean;
    docId: string;
    wasNew: boolean;
    hangoutLink?: string;
    htmlLink?: string;
    eventId?: string;
    meetCode?: string;
}>;
/**
 * Reactive email type list. Pre-seeded with the static `EMAIL_TYPES` fallback
 * so the dropdown is immediately usable before the server fetch completes.
 *
 * Use `$emailTypes` in Svelte templates instead of `EMAIL_TYPES` so the list
 * stays in sync with the server automatically.
 */
export declare const emailTypes: import("svelte/store").Writable<EmailTypeDescriptor[]>;
/**
 * Fetch the authoritative email type list from GET /api/dashboard/email-types
 * and refresh the `emailTypes` store. Should be called once on dashboard init
 * (e.g. in the `onMount` of the dashboard root layout).
 *
 * Non-fatal on error — the store keeps its static fallback so the UI remains
 * functional even if the fetch fails.
 */
export declare function fetchEmailTypes(): Promise<void>;
/**
 * Fetch the Firestore-persisted access config.
 * Returns `null` if no live config has been saved yet (static fallback applies).
 * Readable by ALL authenticated staff.
 */
export declare function fetchLiveAccessConfig(): Promise<Record<string, string[]> | null>;
/**
 * Persist the access config to Firestore. Admin-only — the server will 403
 * if the calling session is not luisarmando or pablo.
 */
export declare function saveAccessConfig(config: Record<string, string[]>): Promise<void>;
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
export declare function fetchCollaborators(): Promise<{
    collaborators: Collaborator[];
    isDefault: boolean;
} | null>;
/**
 * Persist the full collaborators map to Firestore. Admin-only (server 403s
 * for non-admins). The map is read by the server-side AI router on every reply.
 */
export declare function saveCollaborators(collaborators: Collaborator[]): Promise<void>;
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
export declare function fetchAdminSessions(): Promise<AdminSession[]>;
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
export declare function fetchUserActivity(email: string): Promise<UserActivityEntry[]>;
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
export type QuoteBlockType = 'html' | 'heading' | 'image' | 'banner' | 'quoteTable' | 'accept' | 'accordion' | 'testimonials' | 'reviews' | 'partners';
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
export interface Quote {
    quoteId: string;
    consultationId: string;
    title: string;
    lineItems: QuoteLineItem[];
    currency: string;
    total: number;
    providerIds: string[];
    providerSnapshots: Array<{
        id: string;
        name: string;
        country: string;
        modality: string;
        serviceCategory: string;
    }>;
    notes: string | null;
    /** Phase 1 statuses; Phase 2+ adds pending_approval, changes_requested, approved, sent_to_client, client_accepted */
    status: 'draft' | 'pending_approval' | 'changes_requested' | 'approved' | 'sent_to_client' | 'client_accepted';
    approvers: string[];
    approvals: Array<{
        approverEmail: string;
        decision: string;
        decidedAt: string;
    }>;
    comments: Array<{
        commentId: string;
        authorEmail: string;
        text: string;
        createdAt: string;
        resolved: boolean;
        resolvedBy: string | null;
        resolvedAt: string | null;
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
    providerId?: string | null;
    providerName?: string | null;
    providerEmail?: string | null;
    amount?: number | null;
    /** Default margin % applied to new lines (20 = 20%). Each line's marginPct overrides this. */
    defaultMarginPct?: number;
    /** Σ lineItem.amount — total provider cost (what IRP pays). */
    costSubtotal?: number;
    /** Σ clientPrice per line — what the client is charged. Stored in `total`. */
    earnings?: number;
    /** AI-extracted (transcriptInsights.packingTier) or set manually. Required for submission. */
    serviceType?: string | null;
    /** Broad project description shown to the client (no cost/margin/provider detail). */
    clientDescription?: string | null;
    optionGroupId?: string | null;
    optionLabel?: string | null;
    /** References a quote_templates/{id} document. Absent on quotes created before Phase 2. */
    templateId?: string | null;
    /** Ordered array of content blocks for Qwilr-style proposal rendering on the status page.
     *  When absent/empty, QuoteView falls back to the legacy line-items table. */
    blocks?: QuoteBlock[] | null;
}
export declare const QUOTE_STATUS_LABEL: Record<Quote['status'], {
    label: string;
    color: string;
}>;
/** Fetch all quotes for a client (newest first). */
export declare function fetchQuotes(clientId: string): Promise<Quote[]>;
/** Fetch a single quote by ID. */
export declare function fetchQuote(clientId: string, quoteId: string): Promise<Quote>;
/** Create a new quote (defaults to status=draft). */
export declare function createQuote(clientId: string, payload: Partial<Quote>): Promise<Quote>;
/** Partially update a quote. Only supplied fields are changed. */
export declare function updateQuote(clientId: string, quoteId: string, updates: Partial<Quote>): Promise<{
    success: boolean;
    updatedFields: string[];
}>;
/** Delete a quote permanently. */
export declare function deleteQuote(clientId: string, quoteId: string): Promise<void>;
/** Submit a quote for approval. Sends email to approvers and creates PendingAction badge. */
export declare function submitQuoteForApproval(clientId: string, quoteId: string, noteToApprovers?: string): Promise<void>;
/** Approve a quote. Caller must be a QUOTE_APPROVER (enforced server-side). */
export declare function approveQuote(clientId: string, quoteId: string): Promise<void>;
/** Request changes on a pending-approval quote. Caller must be a QUOTE_APPROVER. */
export declare function requestQuoteChanges(clientId: string, quoteId: string, comment: string): Promise<void>;
/** Add a comment to a quote's comment thread. */
export declare function addQuoteComment(clientId: string, quoteId: string, text: string): Promise<void>;
/** Resolve (close) a comment in a quote's thread. */
export declare function resolveQuoteComment(clientId: string, quoteId: string, commentId: string): Promise<void>;
export declare const QUOTE_APPROVERS_EMAILS: ReadonlySet<string>;
/**
 * Writable store holding the live action-permissions map from Firestore.
 * null  = not yet fetched (components should call fetchLiveActionPermissions()).
 * {}    = fetched but empty (nobody has any special permissions configured yet).
 */
export declare const liveActionPermissions: import("svelte/store").Writable<Record<string, Record<string, boolean>> | null>;
/**
 * Derived boolean: can the currently logged-in staff member approve quotes?
 *
 * Priority:
 *   1. Super-admins (luisarmando, pablo) → always true
 *   2. Live Firestore map loaded → use  permissions[email].can_approve_quotes
 *   3. Firestore not loaded yet          → fall back to static QUOTE_APPROVERS list
 */
export declare const canApproveQuotes: import("svelte/store").Readable<boolean>;
/**
 * Fetch the action-permissions config from the server.
 * Readable by all authenticated staff (same policy as access-config).
 * Returns null when the Firestore doc has never been saved (first run).
 */
export declare function fetchLiveActionPermissions(): Promise<Record<string, Record<string, boolean>> | null>;
/**
 * Persist the full action-permissions map to Firestore.
 * Admin-only (enforced server-side).
 * Shape: Record<email, Record<ActionKey, boolean>>
 */
export declare function saveActionPermissions(permissions: Record<string, Record<string, boolean>>): Promise<void>;
/** Send an approved quote to the client via email. Returns the client-visible link. */
export declare function sendQuoteToClient(clientId: string, quoteId: string): Promise<{
    success: boolean;
    clientToken: string;
    statusPageUrl: string;
}>;
/**
 * Fetch a quote using only the client-visible token (public — no auth).
 * Used by the status page when a quoteToken param is present in the URL.
 */
export declare function fetchQuoteByToken(consultationId: string, token: string): Promise<Quote | null>;
/**
 * Accept a quote as the client (called from the public status page).
 * No auth required — validated by clientToken on the server.
 *
 * Phase 3: pass `selectedLineItemIds` so the server records which optional
 * services the client specifically agreed to and calculates `finalBilledTotal`.
 */
export declare function acceptQuoteAsClient(consultationId: string, token: string, acceptedBy?: string, selectedLineItemIds?: string[]): Promise<{
    success: boolean;
    status: string;
}>;
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
export declare function fetchQuoteTemplates(): Promise<QuoteTemplate[]>;
/** Fetch a single quote template by ID. */
export declare function fetchQuoteTemplate(templateId: string): Promise<QuoteTemplate>;
/** Create a new quote template. Returns the created doc. */
export declare function createQuoteTemplate(payload: Pick<QuoteTemplate, 'name'> & Partial<Omit<QuoteTemplate, 'templateId' | 'createdBy' | 'createdAt' | 'updatedAt'>>): Promise<QuoteTemplate>;
/** Partially update a quote template. */
export declare function updateQuoteTemplate(templateId: string, updates: Partial<Pick<QuoteTemplate, 'name' | 'description' | 'category' | 'blocks' | 'destinationCountries'>>): Promise<{
    success: boolean;
    updatedFields: string[];
}>;
/** Delete a quote template permanently. */
export declare function deleteQuoteTemplate(templateId: string): Promise<void>;
/**
 * Apply a template to a quote: seeds the quote's blocks + templateId.
 * The quote's lineItems and all other existing fields are preserved.
 */
export declare function applyTemplateToQuote(clientId: string, quoteId: string, template: QuoteTemplate): Promise<{
    success: boolean;
    updatedFields: string[];
}>;
