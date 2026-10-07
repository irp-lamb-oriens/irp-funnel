/**
 * AI-extracted shipping mode + packing tier classification + freeform
 * extracted facts. Mirrors `irp-funnel-server/helper/transcriptInsights.types.ts`.
 */
export type ShippingMode = 'car_only_in_container' | 'car_roro_only' | 'car_via_rail' | '20ft_container' | '40ft_container' | '20ft_household' | '20ft_household_plus_car' | '40ft_household' | '40ft_household_plus_car' | 'lcl';
export type PackingTier = 'self_pack_self_load' | 'self_pack_assisted_load' | 'full_pack_full_load' | 'lcl_full_service' | 'vehicle_only';
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
    originZip: string;
    destinationCountry: string;
    destinationCity: string;
    destinationZip: string;
    budget: string;
    size: string;
    immigrationStatus: string;
    /** Service category pre-filled by a service landing (e.g. relocation_tour, real_estate). Optional for backward compatibility. */
    serviceCategory?: string;
    propertyTypeFrom: string;
    propertyTypeTo: string;
    /** Approximate move date/timeline (AI-extracted by Lily, or set manually). */
    moveTimeline: string;
    /** Estimated insurance/declared value for the shipment. */
    insuranceValue: string;
    /** High-value items (>$1,000) — art, piano, etc. Empty array when none. */
    highValueItems: Array<{
        description?: string;
        estimatedValue?: string;
    }>;
    /** How the client heard about IRP + the specific YouTube video, if any. */
    referredBy: string;
    youtubeVideo: string;
    vehicles: Array<{
        year: string;
        make: string;
        model: string;
    }>;
    scheduling: string[];
    stage: string;
    /**
     * Operator-set ordering weight. Higher floats the card to the top of its
     * Kanban column and to the top of the list view. `null` (the default) means
     * no manual rank — the card keeps its natural recency order.
     */
    rankIndex?: number | null;
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
    /** Set when the note text was edited. ISO timestamp + editor email. */
    editedAt?: string;
    editedBy?: string;
    /**
     * Soft-deletion markers. Only ADMIN users ever receive notes carrying these
     * fields — the server strips deleted notes for everyone else. Admins render
     * them as a greyed-out "ghost". Absent on live notes.
     */
    deletedAt?: string;
    deletedBy?: string;
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
    /** Quote approval decisions per month (YYYY-MM), keyed by `decidedAt`. */
    monthlyApprovals: Record<string, number>;
    /** Quotes that reached an "approved" decision per month (YYYY-MM). */
    monthlyApprovedQuotes: Record<string, number>;
    sourceBreakdown: Record<string, number>;
    countryBreakdown: Record<string, number>;
    channelBreakdown: Record<string, number>;
    stageRatings?: StageRatingsMetric;
    activity?: ActivityMetric;
}
/** One client's completed calls, as aggregated by the Metrics backend. */
export interface CallMetricPerClient {
    clientId: string;
    clientName: string;
    total: number;
    /** ISO timestamps of this client's completed calls. */
    dates: string[];
}
/** One client's quote counts, as aggregated by the Metrics backend. */
export interface QuoteMetricPerClient {
    clientId: string;
    clientName: string;
    total: number;
    accepted: number;
}
/** Per-client call + quote activity, returned under `metrics.activity`. */
export interface ActivityMetric {
    calls: {
        total: number;
        weekly: Record<string, number>;
        monthly: Record<string, number>;
        annually: Record<string, number>;
        perClient: CallMetricPerClient[];
    };
    quotes: {
        total: number;
        accepted: number;
        perClient: QuoteMetricPerClient[];
    };
}
/** One journey stage's running satisfaction score. */
export interface StageRatingBucket {
    stage: string;
    label: string;
    average: number;
    count: number;
    sum: number;
}
/** Aggregate stage-satisfaction block returned by /api/dashboard/metrics. */
export interface StageRatingsMetric {
    perStage: StageRatingBucket[];
    overall: {
        average: number;
        count: number;
    };
    globalAverage: number;
    totalRatings: number;
    updatedAt: string | null;
}
export declare const STAGE_LABELS: Record<string, string>;
export declare const STAGE_ICONS: Record<string, string>;
export declare const STAGE_COLORS: Record<string, string>;
/**
 * STAGE_DESCRIPTIONS — one short sentence per column, so the team always knows
 * what each column is for. Surfaced in the Kanban column header (info tooltip)
 * and inside the client-card stage selector.
 * MIRRORS the backend source of truth `pipeline.ts → STAGE_DESCRIPTIONS`.
 * KEEP THE TWO IN SYNC.
 */
export declare const STAGE_DESCRIPTIONS: Record<string, string>;
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
export declare function getStageJourney(client: Client | null | undefined, now?: number): StageJourneySegment[];
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
export declare const clientsLoading: import("svelte/store").Writable<boolean>;
export declare const clientsLoadedOnce: import("svelte/store").Writable<boolean>;
export declare const searchQuery: import("svelte/store").Writable<string>;
export interface Filters {
    stage: string;
    originCountry: string;
    destinationCountry: string;
    budget: string;
    size: string;
    callOutcome: string;
    serviceCategory?: string;
}
export declare const filters: import("svelte/store").Writable<Filters>;
export declare const activeView: import("svelte/store").Writable<"board" | "list" | "metrics" | "evo" | "providers" | "posts" | "admin" | "templates" | "automations" | "finance" | "salesReport">;
/**
 * Stages hidden from the board/list UI. The three "private feedback" columns
 * were retired: their emails are now sent automatically by the Stage Email
 * Automation engine (Automations tab), attached to the preceding real stage.
 * Legacy docs are moved off these stages by scripts/migrate-off-feedback-stages.ts.
 */
export declare const HIDDEN_STAGES: Set<string>;
export interface StageConfigRow {
    id: string;
    label: string;
    order: number;
    description: string;
    icon: string;
    color: string;
    slaDays: number | null;
    phase: string;
    notifyGroup: 'sales' | 'pricing' | 'ops';
    /** When true the client status page hides this stage (team board unaffected). */
    hiddenFromClient: boolean;
    clientLabel?: string;
    /** Inactive stages are kept for history but not shown on the team board. */
    active: boolean;
    isSeed?: boolean;
    updatedBy?: string;
    updatedAt?: string;
    createdAt?: string;
}
/** The full ordered stage config as last loaded from the server. */
export declare const stageConfig: import("svelte/store").Writable<StageConfigRow[]>;
/**
 * Ordered ids of the ACTIVE stages that make up the Kanban columns. Seeded from
 * the hardcoded maps for first paint, then replaced by the DB config. Kept as a
 * store so `clientsByStage` re-derives (and the board re-renders) the instant
 * the config loads or is edited.
 */
export declare const stageOrderStore: import("svelte/store").Writable<string[]>;
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
    type: 'email_suggestion' | 'action_suggestion' | 'follow_up' | 'client_comment' | 'note_mention' | 'manual';
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
/**
 * Ordering comparator: higher `rankIndex` floats to the top; ranked cards
 * always sit above un-ranked ones; ties (incl. two un-ranked cards) keep their
 * incoming natural order because `Array.prototype.sort` is stable in every
 * engine we target. Used by both the list view (via `filteredClients`) and each
 * Kanban column (via `clientsByStage`).
 */
export declare function compareByRank(a: Client, b: Client): number;
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
/**
 * Fetch the centralized stage config and hydrate the in-memory maps + stores.
 * Non-blocking + non-fatal: on any error the hardcoded defaults stay in place
 * so the board never blocks on first paint.
 */
export declare function loadStageConfig(): Promise<StageConfigRow[]>;
/** Raw fetch of the stage config (no side effects) — for the config editor UI. */
export declare function fetchStages(): Promise<StageConfigRow[]>;
/** Create a new stage. Optionally position it right after `insertAfterId`. */
export declare function createStage(payload: Partial<StageConfigRow> & {
    label: string;
    insertAfterId?: string;
}): Promise<{
    stage: StageConfigRow | null;
    stages: StageConfigRow[];
}>;
/** Edit / rename a stage (any subset of fields). */
export declare function updateStage(id: string, updates: Partial<StageConfigRow>): Promise<StageConfigRow>;
/** Persist a new column order (full ordered list of stage ids). */
export declare function reorderStages(orderedIds: string[]): Promise<StageConfigRow[]>;
/** Count clients currently in a stage + its previous/next neighbours. */
export declare function countStageClients(id: string): Promise<{
    count: number;
    previousStageId: string | null;
    nextStageId: string | null;
}>;
/** Migrate ALL clients in a column to another column (`toStage` may be an id). */
export declare function migrateStageClients(id: string, toStage: string): Promise<{
    migrated: number;
    failed: number;
    total: number;
}>;
/**
 * Delete a stage. When it still has clients, `migrateTo` MUST be supplied
 * (a stage id, or the tokens "__previous__" / "__next__"); the server migrates
 * every client first, then deletes. The caller should have already resolved the
 * count via `countStageClients` and chosen a destination.
 */
export declare function deleteStage(id: string, migrateTo?: string): Promise<any>;
export declare function requestOTP(email: string): Promise<string>;
export declare function verifyOTP(email: string, code: string): Promise<void>;
export declare function checkAuth(): Promise<boolean>;
export declare function logout(): void;
export declare function initDashboardSocket(): Promise<void>;
export declare function disconnectDashboardSocket(): void;
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
export declare function fetchClients(): Promise<void>;
export declare function fetchClientDetail(id: string): Promise<Client>;
export declare function updateClientStage(id: string, stage: string): Promise<void>;
/**
 * Set (or clear) a client's manual ordering rank. A higher `rankIndex` floats
 * the card to the top of its Kanban column and the list view; pass `null` to
 * clear it back to natural recency order. Persists via the generic client PATCH
 * endpoint (which whitelists `rankIndex`) and optimistically updates local state
 * so the card re-sorts immediately (both `filteredClients` and `clientsByStage`
 * re-derive off `compareByRank`).
 */
export declare function setClientRank(id: string, rankIndex: number | null): Promise<void>;
export declare function updateClientFields(id: string, customFields: Record<string, string>): Promise<void>;
export declare function addNote(id: string, text: string, recipients?: string[]): Promise<Note>;
/**
 * Edit an existing note's text. Notes are addressed by their `createdAt` ISO
 * timestamp (they carry no explicit id). The server stamps `editedAt`/`editedBy`
 * and records a `note_edited` entry in the activity log (surfaced in Journey).
 */
export declare function editNote(id: string, noteCreatedAt: string, text: string): Promise<Note>;
/**
 * Soft-delete a note. The server never removes it from Firestore — it stamps
 * `deletedAt`/`deletedBy` and logs a `note_deleted` entry (surfaced in Journey).
 * ADMINS keep the greyed-out "ghost" in place locally; everyone else has it
 * removed from view entirely (matching what the server sends on the next fetch).
 */
export declare function deleteNote(id: string, noteCreatedAt: string): Promise<Note>;
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
/**
 * Add attendee(s) to a client's EXISTING consultation call WITHOUT changing
 * its time. The server PATCHes the live Google Calendar event so each new
 * attendee receives an invite email, and records an `attendees_added`
 * activityLog entry (actor/source/timestamp) that surfaces in the Journey,
 * Activity and Admin feeds. Calls POST /api/dashboard/clients/:id/attendees.
 *
 * Returns the server response including which emails were genuinely added
 * (`addedAttendees`) and `alreadyPresent` when everyone was already invited.
 */
export declare function addAttendeesToCall(clientId: string, attendees: string[]): Promise<{
    success: boolean;
    addedAttendees: string[];
    allAttendees?: string[];
    alreadyPresent?: boolean;
    hangoutLink?: string;
    htmlLink?: string;
    slot?: string | null;
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
    /** When true, this teammate is CC'd on Posts email broadcasts. */
    notifyOnBroadcast?: boolean;
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
/**
 * A bundle of line items the client chooses between / adds on the status page
 * (Phase 5 — line-item template groups). When a quote has `lineGroups`, the flat
 * `lineItems` array is the server-derived concatenation of every group's items.
 *
 *   role: 'required'  → mutually-exclusive choice rendered as a radio. A single
 *                       required group is auto-included (no radio shown).
 *   role: 'optional'  → an add-on rendered as a checkbox (unchecked by default).
 *   role: 'fixed'     → always billed, NEVER shown as a choice. Rendered on the
 *                       status page as a plain, non-interactive "always included"
 *                       line. Its price is part of every quote regardless of what
 *                       the client selects.
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
    role: 'required' | 'optional' | 'fixed';
    /**
     * Optional client-visible description for this group (shown under the group's
     * title on the status page). May be prefilled from the applied line-template's
     * `description` and freely edited per-quote. Absent/null ⇒ no description.
     */
    description?: string | null;
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
    /** Which line-item groups (packages/add-ons/fixed) the client agreed to. */
    selectedGroupIds?: string[] | null;
    /** Which flat line items the client agreed to (legacy flat quotes). */
    selectedLineItemIds?: string[] | null;
    /** Actual amount the client agreed to (the accepted option's billed total). */
    finalBilledTotal?: number | null;
    /** Ordered installment schedule in percent (e.g. [35, 65]). Defaults to 35/65. */
    paymentSchedule?: number[] | null;
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
/**
 * Duplicate an existing quote's editable configuration into a brand-new draft
 * quote. Copies every field the editor manages so re-quoting a client never
 * means re-keying line items, groups, providers, margins, or the service scope.
 * The result is always a fresh `draft`: workflow metadata (status, approvals,
 * comments, changeLog, client tokens) is intentionally NOT carried over.
 */
export declare function duplicateQuote(clientId: string, sourceQuoteId: string): Promise<Quote>;
/** Partially update a quote. Only supplied fields are changed. */
export declare function updateQuote(clientId: string, quoteId: string, updates: Partial<Quote>): Promise<{
    success: boolean;
    updatedFields: string[];
}>;
/** Delete a quote permanently. */
export declare function deleteQuote(clientId: string, quoteId: string): Promise<void>;
/** Submit a quote for approval. Sends email to approvers and creates PendingAction badge. */
export declare function submitQuoteForApproval(clientId: string, quoteId: string, noteToApprovers?: string): Promise<void>;
/**
 * Approve a quote. Caller must be a QUOTE_APPROVER (enforced server-side).
 * Pass `withEdits: true` when the approver saved their own edits to the quote
 * immediately before approving — it records "Approved with edits" in the audit.
 */
export declare function approveQuote(clientId: string, quoteId: string, opts?: {
    withEdits?: boolean;
}): Promise<void>;
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
 * Phase D — public, token-gated fetch of the client-facing AI description.
 * Lazily generates + caches the description server-side on first view when the
 * quote doesn't have one yet, and respects any staff-authored description.
 * Non-fatal: returns '' on any error so the status page just omits the card.
 */
export declare function fetchClientQuoteDescription(consultationId: string, token: string): Promise<string>;
/**
 * Accept a quote as the client (called from the public status page).
 * No auth required — validated by clientToken on the server.
 *
 * Phase 3: pass `selectedLineItemIds` so the server records which optional
 * services the client specifically agreed to and calculates `finalBilledTotal`.
 */
export declare function acceptQuoteAsClient(consultationId: string, token: string, acceptedBy?: string, selectedLineItemIds?: string[], 
/** Phase 5 — which line-item groups (packages/add-ons) the client chose. */
selectedGroupIds?: string[]): Promise<{
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
export declare function fetchQuoteTemplateMap(): Promise<QuoteTemplateMap>;
/** Persist the full destination → template mapping config. */
export declare function saveQuoteTemplateMap(map: Pick<QuoteTemplateMap, 'defaultTemplateId' | 'rules'>): Promise<QuoteTemplateMap>;
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
export declare function inferClientTemplate(clientId: string, overrideTemplateId?: string): Promise<InferTemplateResult>;
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
/**
 * Parse a single raw template line into a `{ label, amount }` pair.
 *
 * Templates store each line as verbatim text (e.g. `"Origin Services:324234"`),
 * so a line MAY carry an optional default price after the LAST colon:
 *
 *   "Origin Services:324234"  → { label: "Origin Services", amount: 324234 }
 *   "Flete Internacional"     → { label: "Flete Internacional", amount: null }
 *   "Note: ship before June"  → { label: "Note: ship before June", amount: null }
 *
 * Rules (intentionally forgiving + backward compatible):
 *   • We split on the LAST ":" so labels can freely contain colons.
 *   • The suffix only counts as a price when it parses as a number — we tolerate
 *     a leading "$", thousands commas and surrounding spaces (e.g. "$1,250.50").
 *   • If there's no colon, or the suffix isn't numeric, the WHOLE line is the
 *     label and `amount` is null (no default price). Existing plain-label
 *     templates therefore behave exactly as before.
 */
export declare function parseQuoteLineTemplateLine(raw: string): {
    label: string;
    amount: number | null;
};
/** Fetch all quote line-item templates (defaults first, then newest). */
export declare function fetchQuoteLineTemplates(): Promise<QuoteLineTemplate[]>;
/** Create a new quote line-item template. Returns the created doc. */
export declare function createQuoteLineTemplate(payload: Pick<QuoteLineTemplate, 'name'> & Partial<Pick<QuoteLineTemplate, 'description' | 'currency' | 'lines'>>): Promise<QuoteLineTemplate>;
/** Partially update a quote line-item template. */
export declare function updateQuoteLineTemplate(templateId: string, updates: Partial<Pick<QuoteLineTemplate, 'name' | 'description' | 'currency' | 'lines'>>): Promise<{
    success: boolean;
    updatedFields: string[];
}>;
/** Delete a quote line-item template permanently. */
export declare function deleteQuoteLineTemplate(templateId: string): Promise<void>;
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
export declare function fetchServiceTypes(): Promise<ServiceType[]>;
/** Create a new custom service type. Returns the created doc. */
export declare function createServiceType(payload: Pick<ServiceType, 'label'> & Partial<Pick<ServiceType, 'icon'>>): Promise<ServiceType>;
/** Partially update a custom service type. */
export declare function updateServiceType(serviceTypeId: string, updates: Partial<Pick<ServiceType, 'label' | 'icon'>>): Promise<{
    success: boolean;
    updatedFields: string[];
}>;
/** Delete a custom service type permanently. */
export declare function deleteServiceType(serviceTypeId: string): Promise<void>;
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
export declare function fetchQuoteLabels(): Promise<QuoteLabel[]>;
/** Create a new custom quote label. Returns the created doc. */
export declare function createQuoteLabel(payload: Pick<QuoteLabel, 'label'> & Partial<Pick<QuoteLabel, 'icon'>>): Promise<QuoteLabel>;
/** Partially update a custom quote label. */
export declare function updateQuoteLabel(labelId: string, updates: Partial<Pick<QuoteLabel, 'label' | 'icon'>>): Promise<{
    success: boolean;
    updatedFields: string[];
}>;
/** Delete a custom quote label permanently. */
export declare function deleteQuoteLabel(labelId: string): Promise<void>;
/**
 * Trigger server-side AI (re)generation of a quote's client-facing description.
 * The server composes a short, client-safe paragraph from the quote's line
 * labels + group titles (never cost/margin/provider detail), caches it on the
 * quote (`clientDescription` + a content hash), and returns the text. Only
 * regenerates when the quote content changed since the last generation.
 */
export declare function generateQuoteClientDescription(clientId: string, quoteId: string): Promise<{
    clientDescription: string;
    cached: boolean;
}>;
/**
 * Apply a template to a quote: seeds the quote's blocks + templateId.
 * The quote's lineItems and all other existing fields are preserved.
 */
export declare function applyTemplateToQuote(clientId: string, quoteId: string, template: QuoteTemplate): Promise<{
    success: boolean;
    updatedFields: string[];
}>;
export interface SendRfqResult {
    success: boolean;
    consultationId: string;
    counts: {
        created: number;
        skipped: number;
        failed: number;
    };
    created: Array<{
        providerId: string;
        providerName: string;
    }>;
    skipped: Array<{
        providerId: string;
        providerName: string;
    }>;
    failed: Array<{
        providerId: string;
        providerName: string;
    }>;
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
export declare function sendProviderRfq(clientId: string, providerIds?: string[], options?: SendRfqOptions): Promise<SendRfqResult>;
export interface TranslateRfqEditResult {
    /** False when the LLM failed or dropped a placeholder — text is unchanged. */
    translated: boolean;
    subject: string;
    bodyHtml: string;
}
/**
 * Translate an OPERATOR-EDITED RFQ (subject + HTML body) into another language.
 *
 * Used when the language is switched AFTER the body was hand-edited: the edited
 * blob can't be re-derived from the pre-translated template set, so the backend
 * LLM-translates it while preserving the HTML and the {{providerName}} /
 * {{submitUrl}} placeholders. Fails safe — on any error/guardrail miss the
 * server returns the original text with `translated: false`.
 */
export declare function translateRfqEdit(subject: string, bodyHtml: string, targetLangName: string): Promise<TranslateRfqEditResult>;
/** The operator-facing RFQ template fields translated per selected language. */
export interface RfqTranslatableFields {
    serviceType: string;
    commodity: string;
    volume: string;
    serviceOptions: string[];
    notes: string;
}
export interface TranslateRfqFieldsResult {
    /** False when the LLM failed/guardrail-missed — fields are returned unchanged. */
    translated: boolean;
    fields: RfqTranslatableFields;
}
/**
 * Translate the RFQ template FIELDS (type of service, commodity, volume, service
 * options, notes) into another language before they're injected into the
 * pre-translated Sondeo template — so the whole email reads in one language.
 * Technical codes (e.g. "40ft-container-hc", "HHG") are preserved. Fails safe:
 * on any error the server returns the original fields with `translated: false`.
 */
export declare function translateRfqFields(fields: RfqTranslatableFields, targetLangName: string): Promise<TranslateRfqFieldsResult>;
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
export declare function fetchQuoteRequests(clientId: string): Promise<QuoteRequestsResult>;
/**
 * Set (or clear) the operator's rate override on one response, and/or mark it
 * reviewed. The vendor-submitted value is preserved separately server-side.
 */
export declare function updateQuoteRequestOverride(clientId: string, requestId: string, payload: {
    price?: number | null;
    currency?: string | null;
    notes?: string;
    clearOverride?: boolean;
    markReviewed?: boolean;
}): Promise<void>;
/** Set the per-client expected margin (%) used by the best-option calc. */
export declare function setRfqExpectedMargin(clientId: string, expectedMarginPct: number): Promise<number>;
export type RuleCondition = 'always' | 'has_transcript_insights' | 'ai_client_present';
export type RuleMode = 'auto' | 'suggest';
export interface StageEmailRule {
    id: string;
    triggerStage: string;
    emailType: string;
    condition: RuleCondition;
    mode: RuleMode;
    enabled: boolean;
    delayHours: number;
    label: string;
    isSeed?: boolean;
    updatedBy?: string;
    updatedAt?: string;
    createdAt?: string;
}
export interface EmailTemplateRow {
    emailType: string;
    label: string;
    subject: string;
    category: 'sales' | 'ops' | 'followup';
    enabled: boolean;
    hasOverride: boolean;
    isCustom: boolean;
    bodyHtml: string;
    /** True when `bodyHtml` was seeded from the hardcoded template (no saved override yet). */
    bodyDefaulted?: boolean;
}
export interface AutomationMeta {
    stages: string[];
    emailTypes: EmailTypeDescriptor[];
    conditions: RuleCondition[];
    modes: RuleMode[];
    feedbackMigration: Record<string, string>;
    /** Internal team addresses that CAN be excluded per email type (CC/BCC pool). */
    teamRecipients: TeamRecipient[];
}
/** One selectable internal recipient (label for the UI, email as the value). */
export interface TeamRecipient {
    email: string;
    label: string;
}
/** Per-email-type team CC/BCC exclusion rule (Automations → Recipients). */
export interface EmailRecipientRule {
    emailType: string;
    /** Team addresses removed from the default CC/BCC for this email type. */
    excludedRecipients: string[];
    isSeed?: boolean;
    updatedBy?: string;
    updatedAt?: string;
    createdAt?: string;
}
/** Human labels for rule conditions (UI only). */
export declare const RULE_CONDITION_LABELS: Record<RuleCondition, string>;
export declare function fetchAutomationMeta(): Promise<AutomationMeta>;
/**
 * Fetch the per-email-type CC/BCC exclusion rules + the selectable team pool.
 * The pool is the SAME single source of truth (`helper/team.ts`) the server
 * uses for the default CC/BCC, so the editor can never drift from what sends.
 */
export declare function fetchRecipientRules(): Promise<{
    rules: EmailRecipientRule[];
    teamRecipients: TeamRecipient[];
}>;
/**
 * The default provider-RFQ CC pool: support2@ + pricing2@ + Erika's irp@.
 * Mirrors `resolveRfqCc()` in the server's `recipientRules.ts`. The dashboard
 * Recipients tab can exclude any of these from the `provider_rfq` email type,
 * and the inverse (non-excluded) set is what the Providers RFQ panel CCs.
 */
export declare const RFQ_CC_POOL: string[];
/**
 * Resolve the provider-RFQ CC list from the dashboard recipient rules
 * (inverse exclusion). Returns `RFQ_CC_POOL` minus whatever the operator
 * excluded from the `provider_rfq` email type. Falls back to the full pool
 * when the fetch fails or no rule exists yet.
 */
export declare function fetchRfqCc(): Promise<string[]>;
/**
 * Upsert the exclusion set for one email type. Passing an empty array clears
 * every exclusion (⇒ that email type resumes the full default team CC/BCC).
 */
export declare function saveRecipientRule(emailType: string, excludedRecipients: string[]): Promise<EmailRecipientRule>;
/** Delete a recipient rule entirely (⇒ full default team copy resumes). */
export declare function deleteRecipientRule(emailType: string): Promise<void>;
export declare function fetchAutomationRules(): Promise<StageEmailRule[]>;
/** Create or replace a rule (server keys it by triggerStage__emailType). */
export declare function saveAutomationRule(rule: Partial<StageEmailRule>): Promise<StageEmailRule>;
/** Partially update an existing rule by id. */
export declare function patchAutomationRule(id: string, updates: Partial<StageEmailRule>): Promise<StageEmailRule>;
export declare function deleteAutomationRule(id: string): Promise<void>;
export declare function fetchAutomationTemplates(): Promise<EmailTemplateRow[]>;
/** Upsert a template override (subject / body / enabled) for one email type. */
export declare function saveAutomationTemplate(emailType: string, payload: Partial<Pick<EmailTemplateRow, 'subject' | 'bodyHtml' | 'label' | 'category' | 'enabled'>>): Promise<EmailTemplateRow>;
/** Revert a template back to the hardcoded default (deletes the override). */
export declare function deleteAutomationTemplate(emailType: string): Promise<void>;
/** Render a live preview of a template (optionally a draft body being edited). */
export declare function previewAutomationTemplate(emailType: string, opts?: {
    bodyHtml?: string;
    data?: Record<string, unknown>;
}): Promise<string>;
/** The single global offer-popup configuration. */
export interface ClientOfferConfig {
    enabled: boolean;
    title: string;
    bodyHtml: string;
    ctaLabel: string;
    ctaUrl: string;
    updatedAt?: string | null;
    updatedBy?: string | null;
}
/** Fetch the current client-offer config. */
export declare function fetchClientOffer(): Promise<ClientOfferConfig>;
/** Save (upsert) the client-offer config. */
export declare function saveClientOffer(payload: Pick<ClientOfferConfig, 'enabled' | 'title' | 'bodyHtml' | 'ctaLabel' | 'ctaUrl'>): Promise<ClientOfferConfig>;
export interface QuoteApproversConfig {
    approvers: string[];
    updatedAt?: string | null;
    updatedBy?: string | null;
}
/** Fetch the current quote-approvers list. */
export declare function fetchQuoteApprovers(): Promise<QuoteApproversConfig>;
/** Save (upsert) the quote-approvers list. */
export declare function saveQuoteApprovers(approvers: string[]): Promise<QuoteApproversConfig>;
export interface TourScheduleConfig {
    enabled: boolean;
    cadenceWeeks: number;
    anchorMonday: string;
    bookableMonths: number;
    weekStartDay: number;
    label: string;
    priceNote: string;
    updatedAt?: string | null;
    updatedBy?: string | null;
    auditLog?: Array<{
        at: string;
        by: string;
        before: unknown;
        after: unknown;
    }>;
}
/** A single upcoming active tour-week block (Monday → Sunday). */
export interface TourWeekBlock {
    start: string;
    end: string;
}
export interface TourScheduleSaveResult extends TourScheduleConfig {
    weeks: TourWeekBlock[];
}
/**
 * The single global destination-services gate. When enabled, clients whose
 * destination country is in `countries` see extra page-level tabs on their
 * /status page (Relocation tours, Immigration advice, Intercultural coaching).
 */
export interface DestinationServicesConfig {
    enabled: boolean;
    countries: string[];
    /** Ordered service ids surfaced as page-level tabs on the /status page. */
    services: string[];
    updatedAt?: string | null;
    updatedBy?: string | null;
}
/** Fetch the current tour-schedule config. */
export declare function fetchTourSchedule(): Promise<TourScheduleConfig>;
/** Save (upsert) the tour-schedule config; returns config + derived weeks. */
export declare function saveTourSchedule(payload: Partial<TourScheduleConfig>): Promise<TourScheduleSaveResult>;
/** Fetch the current destination-services config. */
export declare function fetchDestinationServices(): Promise<DestinationServicesConfig>;
/** Save (upsert) the destination-services config. */
export declare function saveDestinationServices(payload: Pick<DestinationServicesConfig, 'enabled' | 'countries' | 'services'>): Promise<DestinationServicesConfig>;
export type FieldValueType = 'string' | 'text' | 'number' | 'boolean' | 'date' | 'datetime' | 'enum' | 'email' | 'route' | 'property' | 'vehicles' | 'datetime-list';
export type FieldScope = 'consultation' | 'root';
export type FieldSection = 'identity' | 'route' | 'move' | 'logistics' | 'meta' | 'custom';
/**
 * Which service a field belongs to, for segmenting the client card's Overview
 * into collapsible per-service groups. Mirrors the server's `FieldService`.
 * Unset / "general" = the shared relocation intake.
 */
export type FieldService = 'general' | 'relocation_tour' | 'immigration' | 'legal' | 'realty' | 'coaching';
export interface FieldConfigRow {
    id: string;
    label: string;
    order: number;
    section: FieldSection;
    valueType: FieldValueType;
    scope: FieldScope;
    options?: string[];
    placeholder?: string;
    required: boolean;
    showWhenEmpty: boolean;
    readOnly?: boolean;
    /** Client-portal visibility (surfaced on /status "Your details"). Default false. */
    clientVisible?: boolean;
    /** Client-portal editability (client may edit on /status). Default false. */
    clientEditable?: boolean;
    /**
     * Per-sub-input labels for composite fields (route/property), keyed by the
     * sub-input's consultation-doc key (e.g. `originCity`, `propertyTypeFrom`).
     * Drives the visible caption above each otherwise-nameless box. Optional —
     * absent falls back to the renderer's built-in caption (see COMPOSITE_SUBFIELDS).
     */
    subLabels?: Record<string, string>;
    /** Service segment for the Overview per-service grouping (mirrors server). */
    serviceGroup?: FieldService;
    active: boolean;
    isSeed?: boolean;
    updatedBy?: string;
    updatedAt?: string;
    createdAt?: string;
}
/**
 * The sub-inputs each COMPOSITE field type renders, in visual order, with the
 * consultation-doc key they bind to and a built-in fallback caption. This is the
 * single source of truth shared by the Overview renderer (DetailPanel) and the
 * sub-label editor (OverviewFieldsEditor): a field's `subLabels[key]` overrides
 * the fallback, so operators can rename each otherwise-nameless box from
 * Automations → Overview fields. Types absent here have no editable sub-labels.
 */
export declare const COMPOSITE_SUBFIELDS: Partial<Record<FieldValueType, {
    key: string;
    fallback: string;
}[]>>;
/** The full ordered Overview-field registry as last loaded from the server. */
export declare const fieldConfig: import("svelte/store").Writable<FieldConfigRow[]>;
/** Active fields (what the Overview tab surfaces), in order. */
export declare const activeFields: import("svelte/store").Readable<FieldConfigRow[]>;
/** A merge-field option surfaced by the email-template editor's field picker. */
export interface MergeFieldOption {
    /** The token inserted into the body, e.g. "{{originCountry}}". */
    token: string;
    /** Human-readable field label shown in the picker. */
    label: string;
    /** Section label used to group options in the picker. */
    group: string;
}
/**
 * Map the Overview Field Registry → merge-field options for the email template
 * editor. The registry is the SINGLE SOURCE OF TRUTH for which fields exist, so
 * the editor never hardcodes a token list — it offers exactly the active fields
 * operators configured in Automations → Overview fields. Each field's `id` is
 * the consultation-doc key the send-time interpolator resolves `{{id}}` against.
 */
export declare function mergeFieldsFromRegistry(fields: FieldConfigRow[]): MergeFieldOption[];
/** Reactive merge-field options derived from the live Overview field registry. */
export declare const mergeFieldOptions: import("svelte/store").Readable<MergeFieldOption[]>;
/** Raw fetch of the field registry (no side effects) — for the config editor UI. */
export declare function fetchOverviewFields(): Promise<FieldConfigRow[]>;
/** Load the field registry into the `fieldConfig` store (used on dashboard boot). */
export declare function loadOverviewFields(): Promise<FieldConfigRow[]>;
/** Create a new Overview field (optionally positioned right after `insertAfterId`). */
export declare function createOverviewField(payload: Partial<FieldConfigRow> & {
    label: string;
    insertAfterId?: string;
}): Promise<{
    field: FieldConfigRow | null;
    fields: FieldConfigRow[];
}>;
/** Partially update (rename / retype / toggle) an Overview field by id. */
export declare function updateOverviewField(id: string, updates: Partial<FieldConfigRow>): Promise<FieldConfigRow>;
/** Persist a new field order (full ordered id list). */
export declare function reorderOverviewFields(orderedIds: string[]): Promise<FieldConfigRow[]>;
/**
 * Delete an Overview field. NON-DESTRUCTIVE: client documents keep their data
 * and keep rendering it — this only removes the suggested empty slot going
 * forward. No migration guard needed (unlike stage deletion).
 */
export declare function deleteOverviewField(id: string): Promise<void>;
/** A single exported client record — the round-trippable Firestore doc shape. */
export type ClientExportRecord = Record<string, any> & {
    docId: string;
};
/** The JSON envelope produced by `serializeClientExport`. */
export interface ClientExportEnvelope {
    exportedAt: string;
    version: number;
    count: number;
    clients: ClientExportRecord[];
}
export type ImportStrategy = 'skip' | 'merge' | 'overwrite';
/** One annotated record returned by the import dry-run. */
export interface ImportDryRunRecord {
    index: number;
    docId: string | null;
    email: string;
    valid: boolean;
    exists: boolean;
    missingRequired: string[];
    warnings: string[];
}
export interface ImportExpectedField {
    id: string;
    label: string;
    valueType: string;
    required: boolean;
    scope: string;
}
export interface ImportDryRunResult {
    total: number;
    valid: number;
    invalid: number;
    newCount: number;
    duplicateCount: number;
    records: ImportDryRunRecord[];
    expectedFields: ImportExpectedField[];
}
export interface ImportCommitResult {
    success: boolean;
    created: number;
    updated: number;
    skipped: number;
    errors: Array<{
        index: number;
        docId?: string;
        error: string;
    }>;
}
/** Build the raw export records (round-trippable Firestore docs) from clients. */
export declare function buildClientExportRecords(list: Client[]): ClientExportRecord[];
/** Serialize clients to a pretty JSON string wrapped in a versioned envelope. */
export declare function serializeClientExport(list: Client[]): string;
/**
 * Normalize parsed JSON into a flat records array. Accepts either a bare array
 * of records or the `{ clients: [...] }` export envelope — so an exported file
 * re-imports without any hand-editing.
 */
export declare function normalizeImportRecords(parsed: unknown): any[];
/** Validate + annotate an import without writing anything. */
export declare function importClientsDryRun(records: any[]): Promise<ImportDryRunResult>;
/** Commit an import. `strategies` maps docId → per-record strategy override. */
export declare function importClientsCommit(records: any[], defaultStrategy?: ImportStrategy, strategies?: Record<string, ImportStrategy>): Promise<ImportCommitResult>;
export interface PricingRequestOption {
    optionId: string;
    index: number;
    /** Opaque service-type key (built-in PackingTier OR custom serviceTypeId). */
    serviceType: string | null;
    /** AI-drafted placeholder header line; fully operator-editable. */
    serviceLine: string;
    /** Freeform, agnostic bullet list of line items after "including:". */
    items: string[];
}
export interface PricingRequest {
    requestId: string;
    consultationId: string;
    index: number;
    originLabel: string;
    destinationLabel: string;
    originNotes: string;
    destinationNotes: string;
    options: PricingRequestOption[];
    status: 'draft' | 'sent';
    createdAt: string;
    createdBy: string;
    sentAt: string | null;
    sentBy: string | null;
    updatedAt: string | null;
}
/** Fetch all pricing requests for a client (ascending by index). */
export declare function fetchPricingRequests(clientId: string): Promise<PricingRequest[]>;
/** Create a new draft pricing request (auto-numbered, header auto-filled). */
export declare function createPricingRequest(clientId: string, payload?: Partial<Pick<PricingRequest, 'originNotes' | 'destinationNotes' | 'options'>>): Promise<PricingRequest>;
/** Patch a draft pricing request's header and/or options. */
export declare function updatePricingRequest(clientId: string, requestId: string, updates: Partial<Pick<PricingRequest, 'originNotes' | 'destinationNotes' | 'originLabel' | 'destinationLabel' | 'options'>>): Promise<PricingRequest>;
/** Add an option (server AI-drafts its placeholder service line). */
export declare function addPricingRequestOption(clientId: string, requestId: string): Promise<{
    options: PricingRequestOption[];
    newOption: PricingRequestOption;
}>;
/** Ask the AI to (re)draft a single placeholder service line (not persisted). */
export declare function suggestPricingRequestLine(clientId: string, requestId: string, serviceType?: string): Promise<string>;
/** Finalize + send the pricing request to the pricing desk. */
export declare function sendPricingRequest(clientId: string, requestId: string, finalEdits?: Partial<Pick<PricingRequest, 'originNotes' | 'destinationNotes' | 'options'>>): Promise<PricingRequest>;
/** Delete a draft pricing request. */
export declare function deletePricingRequest(clientId: string, requestId: string): Promise<void>;
export type GateOperator = 'exists' | 'not_exists' | 'is_empty' | 'is_not_empty' | 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'not_contains';
export type GateLogic = 'all' | 'any';
export interface GateCondition {
    fact: string;
    operator: GateOperator;
    value?: string | number | null;
}
export interface StageGateRule {
    id: string;
    targetStage: string;
    logic: GateLogic;
    conditions: GateCondition[];
    message: string;
    enabled: boolean;
    label: string;
    updatedBy?: string;
    updatedAt?: string;
    createdAt?: string;
}
export interface GateFact {
    key: string;
    label: string;
    numeric: boolean;
    hint?: string;
}
export interface StageGateMeta {
    facts: GateFact[];
    operators: GateOperator[];
    valuelessOperators: GateOperator[];
    logics: GateLogic[];
}
/** One blocking gate returned in a 409 stage-move response. */
export interface StageGateBlock {
    ruleId: string;
    label: string;
    message: string;
    unmet: string[];
}
/** Human labels for gate operators (editor UI). */
export declare const GATE_OPERATOR_LABELS: Record<GateOperator, string>;
export declare function fetchStageGateMeta(): Promise<StageGateMeta>;
export declare function fetchStageGates(): Promise<StageGateRule[]>;
/** Create (or replace) a stage-gate rule. */
export declare function saveStageGate(rule: Partial<StageGateRule>): Promise<StageGateRule>;
/** Partially update a stage-gate rule by id. */
export declare function patchStageGate(id: string, updates: Partial<StageGateRule>): Promise<StageGateRule>;
/** Delete a stage-gate rule. */
export declare function deleteStageGate(id: string): Promise<void>;
/**
 * The most-recent BLOCKED stage move, surfaced two ways per the product spec:
 *   • the Kanban page shows a dismissible notification → click opens a modal
 *     detailing the unmet requirements, then the notification goes away;
 *   • the client's Quotes tab shows an inline error banner (same payload).
 * `null` when there is no active block. Set by the Kanban drop handler when the
 * stage-move endpoint returns 409; cleared when the operator dismisses it.
 */
export interface StageBlockNotice {
    clientId: string;
    clientName: string;
    targetStage: string;
    targetStageLabel: string;
    blockedBy: StageGateBlock[];
    at: number;
}
export declare const stageBlockNotice: import("svelte/store").Writable<StageBlockNotice | null>;
export interface FinanceMoneyStats {
    /** Number of quotes behind these figures. */
    n: number;
    revenue: number;
    cost: number;
    margin: number;
    /** Margin as a percentage of revenue. Null when revenue is 0. */
    marginPct: number | null;
    avgDealSize: number | null;
}
export interface FinanceBucket extends FinanceMoneyStats {
    key: string;
    label: string;
}
export interface FinancePeriod extends FinanceMoneyStats {
    /** `YYYY-MM`. */
    month: string;
}
export interface FinanceMetrics {
    baseCurrency: string;
    generatedAt: string;
    totals: {
        won: FinanceMoneyStats;
        openPipeline: FinanceMoneyStats;
        draft: FinanceMoneyStats;
        all: FinanceMoneyStats;
    };
    winRate: {
        sentOrBeyond: number;
        won: number;
        pct: number | null;
    };
    cycleDays: {
        n: number;
        median: number | null;
    };
    byMonth: FinancePeriod[];
    byRoute: FinanceBucket[];
    byService: FinanceBucket[];
    byProvider: FinanceBucket[];
    byStage: FinanceBucket[];
    skipped: {
        currency: number;
        zeroTotal: number;
        exclusiveAlternates: number;
        currencies: Record<string, number>;
    };
    marginUnknown: number;
    quotesRead: number;
    clientsRead: number;
}
export declare const financeMetrics: import("svelte/store").Writable<FinanceMetrics | null>;
export declare function fetchFinanceMetrics(currency?: string): Promise<FinanceMetrics>;
export interface ClientPayment {
    id: string;
    date?: string | null;
    /** Either an absolute figure or a share of the contract value. */
    amount?: number | null;
    percent?: number | null;
    method?: string | null;
    note?: string | null;
    /** False for an instalment that is scheduled but has not arrived. */
    received?: boolean;
}
/**
 * A client payment with `percent` already resolved to a concrete `amount`
 * against the contract value. The server is the only place money arithmetic
 * happens, so this mirror just carries the resolved figure the report returns.
 */
export interface SettledClientPayment {
    id: string;
    date?: string | null;
    amount: number;
    method?: string | null;
    note?: string | null;
    received: boolean;
}
export interface ProviderPayment {
    id: string;
    providerId?: string | null;
    providerName?: string | null;
    date?: string | null;
    amount?: number | null;
    /** False for a bill that is expected but not yet settled. */
    paid?: boolean;
    note?: string | null;
}
export interface ExtraCharge {
    id: string;
    date?: string | null;
    amount?: number | null;
    /** What this charge costs IRP. 0 by default, making the charge pure margin. */
    cost?: number | null;
    description?: string | null;
    collected?: boolean;
}
export interface QuoteSettlement {
    quoteId: string;
    consultationId: string | null;
    clientName: string | null;
    currency: string;
    acceptedAt: string | null;
    contractValue: number;
    billedTotal: number;
    collected: number;
    collectedPct: number | null;
    clientOutstanding: number;
    /** Every client payment, `percent` resolved to its dollar amount. */
    clientPayments: SettledClientPayment[];
    providerCost: number;
    providerPaid: number;
    providerOutstanding: number;
    expectedMargin: number;
    expectedMarginPct: number | null;
    /** collected − providerPaid: what this quote has actually banked. */
    netCash: number;
    fullySettled: boolean;
}
export type LedgerKind = 'expense' | 'income' | 'investment';
export type Recurrence = 'none' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
export interface LedgerEntry {
    id: string;
    kind: LedgerKind;
    category?: string | null;
    label?: string | null;
    amount?: number | null;
    currency?: string | null;
    date?: string | null;
    recurrence?: Recurrence | null;
    endDate?: string | null;
    /** Money an investment has earned back. Drives its ROI. */
    returnAmount?: number | null;
    quoteId?: string | null;
    note?: string | null;
}
export interface LedgerCategoryRollup {
    kind: LedgerKind;
    category: string;
    n: number;
    amount: number;
    returned: number;
    netReturn: number | null;
    roiPct: number | null;
}
export interface LedgerPeriod {
    month: string;
    expense: number;
    income: number;
    investment: number;
    investmentReturn: number;
    net: number;
}
export interface FinanceLedgerReport {
    baseCurrency: string;
    generatedAt: string;
    settlements: QuoteSettlement[];
    settlementTotals: {
        n: number;
        contractValue: number;
        billedTotal: number;
        collected: number;
        clientOutstanding: number;
        providerCost: number;
        providerPaid: number;
        providerOutstanding: number;
        expectedMargin: number;
        netCash: number;
        fullySettled: number;
    };
    totals: {
        expense: number;
        income: number;
        investment: number;
        investmentReturn: number;
        recurringMonthly: number;
    };
    reinvestable: {
        realisedMargin: number;
        spent: number;
        remaining: number;
    };
    byCategory: LedgerCategoryRollup[];
    byMonth: LedgerPeriod[];
    skippedCurrency: number;
    entries: LedgerEntry[];
    /** Seed category names per kind. The API accepts any string beyond these. */
    categories: Record<LedgerKind, string[]>;
    acceptedQuotesRead: number;
}
export declare const financeLedger: import("svelte/store").Writable<FinanceLedgerReport | null>;
/**
 * The move taxonomy: the vocabulary every price report groups by, plus the
 * floor that decides which quotes count as whole moves. One document, edited in
 * Finance, read by the analysis pipeline. Editing it here is the only way to
 * change the categories.
 */
export interface MoveTaxonomy {
    modalities: string[];
    packingTiers: string[];
    cargoTypes: string[];
    minMovePrice: number;
    updatedAt?: string;
    updatedBy?: string;
}
export declare const moveTaxonomy: import("svelte/store").Writable<MoveTaxonomy | null>;
/** What the code ships with, so the editor can offer a reset. */
export declare const moveTaxonomySeed: import("svelte/store").Writable<MoveTaxonomy | null>;
export declare function fetchMoveTaxonomy(): Promise<MoveTaxonomy>;
/** Raised for a 409, carrying the document that won so the UI can show it. */
export declare class TaxonomyConflict extends Error {
    current: MoveTaxonomy | null;
    constructor(message: string, current: MoveTaxonomy | null);
}
/**
 * Save the taxonomy.
 *
 * `expectedUpdatedAt` travels with the write so the server can refuse a save
 * built on a document someone else has since changed. A save always wins the
 * ticket race against reads in flight, because it is the newest known truth.
 */
export declare function saveMoveTaxonomy(taxonomy: MoveTaxonomy): Promise<MoveTaxonomy>;
export declare function fetchFinanceLedger(currency?: string): Promise<FinanceLedgerReport>;
export interface SalesMonth {
    month: string;
    leadsEntered: number;
    invoicesEntered: number;
    quotesEntered: number;
    invoicesStarted: number;
    invoicesSent: number;
    clientsStartedPayment: number;
    invoicePaymentsRecorded: number;
    clientsPaymentConfirmed: number;
    counterBumps: number;
    invoiced: number;
    collected: number;
    outstanding: number;
    margin: number;
    cost: number;
}
export interface SalesYear {
    year: string;
    months: SalesMonth[];
    totals: SalesMonth;
}
export interface SalesBucket {
    key: string;
    label: string;
    n: number;
    invoiced: number;
    collected: number;
    outstanding: number;
    margin: number;
}
export interface ProjectCompletion {
    kind: 'quote' | 'consultation' | 'invoice';
    id: string;
    label: string;
    completedAt: string | null;
    source: string;
    contractValue: number;
    collected: number;
    outstanding: number;
    margin: number;
}
export interface FunnelPct {
    numerator: number;
    denominator: number;
    pct: number | null;
}
export interface SalesReport {
    generatedAt: string;
    years: string[];
    byYear: SalesYear[];
    totals: SalesMonth;
    funnel: {
        startedOfEntered: {
            invoice: FunnelPct;
            client: FunnelPct;
            quote: FunnelPct;
        };
        recordedOfEntered: {
            invoice: FunnelPct;
            client: FunnelPct;
        };
        recordedOfStarted: {
            invoice: FunnelPct;
            client: FunnelPct;
        };
    };
    collectionRate: FunnelPct;
    byRoute: SalesBucket[];
    byService: SalesBucket[];
    byProvider: SalesBucket[];
    byCurrency: SalesBucket[];
    byPaymentMethod: SalesBucket[];
    projects: ProjectCompletion[];
}
export declare const salesReport: import("svelte/store").Writable<SalesReport | null>;
export declare function fetchSalesReport(): Promise<SalesReport>;
/**
 * Replace the payment rows of one accepted quote. The server recomputes every
 * derived figure, so the caller reloads the report rather than patching totals
 * locally, which is how two views end up disagreeing.
 */
export declare function saveQuoteSettlement(quoteId: string, payload: {
    consultationId?: string | null;
    clientPayments: ClientPayment[];
    providerPayments: ProviderPayment[];
    extraCharges: ExtraCharge[];
}): Promise<void>;
export declare function createLedgerEntry(entry: Partial<LedgerEntry>): Promise<void>;
export declare function updateLedgerEntry(id: string, entry: Partial<LedgerEntry>): Promise<void>;
export declare function deleteLedgerEntry(id: string): Promise<void>;
export interface InvoiceLineItem {
    id: string;
    description: string;
    qty: number;
    rate: number;
    discount: number;
    amount: number;
    /**
     * The quote line this was billed from, when the invoice came off a quote.
     * Lets the dashboard show which quoted lines are still uninvoiced.
     */
    quoteLineItemId?: string | null;
    /** Client-visible group description captured from the accepted quote group.
     *  Shown under the item description on the PDF/preview. Editable. */
    groupDescription?: string | null;
    /** Internal — provider cost for this line. Never shown to the client. */
    costTotal?: number | null;
    /** Internal — our margin on this line (amount − costTotal). Never shown. */
    marginTotal?: number | null;
}
export interface InvoicePayment {
    id: string;
    date: string | null;
    amount: number;
    method: string | null;
    note: string | null;
    received: boolean;
}
export type InvoiceStatus = 'draft' | 'sent' | 'partially_paid' | 'paid';
export interface Invoice {
    id: string;
    invoiceId: string;
    invoiceNumber: string;
    /** Null on custom invoices raised against a client with no quote behind them. */
    quoteId: string | null;
    /** Which installment of that quote this is (1, 2, 3...). Null without a quote. */
    quoteInvoiceIndex?: number | null;
    /** The quote's full client-facing total, snapshotted at creation. */
    quoteTotal?: number | null;
    /** The share of the quote this invoice bills, when billed by percentage. */
    quotePercentage?: number | null;
    /** The overall service description from the accepted quote
     *  (clientDescription). Rendered above the line-items table
     *  on the PDF/preview. */
    overallDescription?: string | null;
    quoteTitle?: string | null;
    quoteDate?: string | null;
    consultationId: string | null;
    clientId: string | null;
    clientName: string;
    clientEmail: string;
    date: string;
    dueDate: string | null;
    terms: string;
    poNumber: string | null;
    lineItems: InvoiceLineItem[];
    discount: number;
    subtotal: number;
    total: number;
    /** Internal — provider cost across all lines. Never shown to the client. */
    costTotal?: number | null;
    /** Internal — our margin (total − costTotal). Never shown to the client. */
    marginTotal?: number | null;
    /** True when this invoice came off an accepted quote (amounts are locked). */
    locked?: boolean;
    payments: InvoicePayment[];
    notes: string | null;
    termsAndConditions: string[];
    status: InvoiceStatus;
    sentAt: string | null;
    sentToEmail: string | null;
    createdBy: string;
    createdAt: string;
    updatedAt: string | null;
    received: number;
    balanceDue: number;
}
/** What the client pays for one quote line. */
export declare function quoteLineClientPrice(li: QuoteLineItem, defaultMarginPct?: number): number;
/** One billable unit on a quote, priced for the client, with internal cost/margin. */
export interface QuoteBillableLine {
    lineId: string;
    label: string;
    /** What the client pays (cost + margin). */
    price: number;
    /** Internal — provider cost. Never shown to the client. */
    cost: number;
    /** Internal — our margin (price − cost). Never shown to the client. */
    margin: number;
    /** Client-visible group description from the accepted quote group.
     *  Rendered under the item description on the PDF/preview. */
    groupDescription: string | null;
    /** The individual quote lines inside this accepted group — shown to staff
     *  in the editor's line-items breakdown, never on the client-facing doc. */
    lines: Array<{
        lineId: string;
        label: string;
        price: number;
        cost: number;
        margin: number;
    }>;
}
/**
 * Every billable unit on a quote, priced for the client, with the internal
 * cost and margin alongside.
 *
 * Grouped quotes bill the ACCEPTED groups — the packages / add-ons / fixed
 * services the client agreed to on the status page (`selectedGroupIds`, plus
 * every `role: 'fixed'` group which is always billed). Each accepted group
 * becomes ONE invoice line at its group total, so an invoice never dumps every
 * individual quote line onto the client. When nothing has been selected yet (a
 * sent quote awaiting acceptance), every group is offered so the operator can
 * pick. Legacy flat quotes (no `lineGroups`) keep the line-level behaviour.
 */
export declare function quoteBillableLines(quote: Quote | null | undefined): QuoteBillableLine[];
/** How much of a quote has already been invoiced, and what is left. */
export interface QuoteBillingSummary {
    /** The quote's full client-facing total. */
    quoteTotal: number;
    /** Sum of every invoice raised against this quote. */
    invoicedTotal: number;
    invoicedPct: number;
    /** quoteTotal − invoicedTotal, floored at 0. */
    remainingTotal: number;
    remainingPct: number;
    /** Quote lines that appear on at least one invoice. */
    invoicedLineIds: Set<string>;
    /** Quote lines that have never been invoiced. */
    uninvoicedLines: QuoteBillableLine[];
    invoiceCount: number;
}
/**
 * Reconcile a quote against the invoices raised from it, so an operator can see
 * what is left to bill and which quoted lines were never invoiced at all.
 */
export declare function summarizeQuoteBilling(quote: Quote | null | undefined, allInvoices: Invoice[] | null | undefined): QuoteBillingSummary;
export declare const invoices: import("svelte/store").Writable<Invoice[] | null>;
/** Every invoice raised against one client, newest first. */
export declare function invoicesForClient(allInvoices: Invoice[] | null | undefined, clientId: string): Invoice[];
export declare function fetchInvoices(): Promise<Invoice[]>;
export declare function fetchInvoice(id: string): Promise<Invoice>;
/**
 * Create an invoice, with or without a quote behind it.
 *
 * With `quoteId` the server snapshots the quote's priced lines, notes and
 * terms. `percentage` bills a share of the quote and `quoteLineItemIds` bills
 * only the picked lines. Without a quote, pass `clientId` and explicit
 * `lineItems` — that is a custom charge for work that was never quoted.
 */
export declare function createInvoice(payload: {
    quoteId?: string | null;
    consultationId?: string | null;
    clientId?: string | null;
    clientName?: string;
    clientEmail?: string;
    /** Flat total override. Skips the line-derived total. */
    amount?: number;
    /** 1-100. Scales every quote line so subtotal still equals total. */
    percentage?: number | null;
    lineItems?: Array<Partial<InvoiceLineItem>>;
    quoteLineItemIds?: string[];
    discount?: number;
    notes?: string | null;
    date?: string | null;
    dueDate?: string | null;
    terms?: string;
    poNumber?: string | null;
}): Promise<Invoice>;
/** @deprecated Use {@link createInvoice}, which does not require a quote. */
export declare const createInvoiceFromQuote: typeof createInvoice;
export declare function updateInvoice(id: string, payload: Partial<Invoice>): Promise<Invoice>;
export declare function deleteInvoice(id: string): Promise<void>;
export declare function sendInvoice(id: string, email?: string): Promise<Invoice>;
export declare function recordInvoicePayment(id: string, payments: InvoicePayment[]): Promise<Invoice>;
/**
 * Mark an invoice paid in full, or reopen it.
 *
 * Ticking settles the outstanding balance in one entry; unticking removes only
 * that dashboard-generated entry, so a hand-recorded wire payment survives.
 * Logged separately from {@link recordInvoicePayment} so the activity trail
 * reads "marked invoice X paid" rather than "recorded 1 payment(s)".
 */
export declare function setInvoicePaid(id: string, paid: boolean): Promise<Invoice>;
/**
 * Download the signed service-agreement PDF for an accepted quote.
 *
 * Mirrors downloadInvoicePdf: the server streams the file, the browser saves it.
 * The endpoint returns 400 until the client has accepted, so the button that
 * calls this is only shown on an accepted quote.
 */
export declare function downloadContractPdf(clientId: string, quoteId: string): Promise<void>;
export declare function downloadInvoicePdf(id: string): Promise<void>;
