<script lang="ts">
  import { onMount, tick } from 'svelte';
  import Header from '../../components/Header/Header.svelte';
  import Footer from '../../components/Footer/Footer.svelte';
  import {
    isAuthenticated, authEmail, authToken,
    clients, selectedClient, metrics, loading, error,
    clientsLoading, clientsLoadedOnce,
    searchQuery, filters, filteredClients, activeView, detailPanelOpen, clientsByStage, pendingRequests,
    stageOrderStore, stageConfig,


    STAGE_LABELS, STAGE_ICONS, STAGE_COLORS, STAGE_DESCRIPTIONS, EMAIL_TYPES, HIDDEN_STAGES,
    requestOTP, verifyOTP, checkAuth, logout,
    fetchClients, fetchClientDetail, updateClientStage, setClientRank, loadStageConfig,

    updateClientFields, addNote, triggerEmail, fetchMetrics,

    initDashboardSocket, disconnectDashboardSocket,
    pendingCountByClient, fetchLiveAccessConfig,
    getStageSlaStatus, STAGE_SLA_DAYS,
    stageBlockNotice,
    type Client,
    type StageGateBlock

  } from './store.ts';
  import { toasts } from './toastStore.ts';


  import {
    STATIC_SECTION_ACCESS, DEFAULT_ACCESS, ALL_VIEWS, ADMIN_EMAILS,
    type DashView,
  } from './access.ts';
  import DetailPanel from './components/DetailPanel.svelte';
  import PendingBadge from './components/PendingBadge.svelte';
  import EmailPreviewDrawer from './components/EmailPreviewDrawer.svelte';
  import MetricsView from './components/MetricsView.svelte';
  import BugReportModal from './components/BugReportModal.svelte';
  import EvoView from './components/evo/EvoView.svelte';
  import ProvidersView from './components/ProvidersView.svelte';
  import PostsView from './components/PostsView.svelte';
  import AdminView from './components/AdminView.svelte';
  import TemplatesView from './components/TemplatesView.svelte';
  import AutomationView from './components/AutomationView.svelte';
  import FinanceView from './components/FinanceView.svelte';
  import SalesReportView from './components/SalesReportView.svelte';

  import ToastContainer from './components/ToastContainer.svelte';
  import AddClientModal from './components/AddClientModal.svelte';
  import ClientImportExportModal from './components/ClientImportExportModal.svelte';
  import Select, { type SelectOption } from './components/ui/Select.svelte';
  import './dashboard.scss';

  // ─── Filter <Select> option builders ─────────────────────────────────────
  // Native <select> boxes size their CLOSED state to their WIDEST <option>
  // text in most browsers — the "stretched by content" bug. The shared
  // <Select> component (components/ui/Select.svelte) avoids this entirely:
  // its trigger only ever renders the *selected* label (ellipsis-truncated),
  // and its options menu is portaled to <body> + position:fixed, sized off
  // the trigger's own rect — so neither the trigger nor the menu can ever
  // stretch the filters-bar or overflow the viewport.
  const OUTCOME_OPTIONS: SelectOption[] = [
    { value: '', label: 'All Outcomes' },
    { value: 'none', label: 'No Outcome Yet' },
    { value: 'qualified', label: 'Qualified' },
    { value: 'nurture', label: 'Nurture' },
    { value: 'no_show', label: 'No Show' },
  ];
  // Service category is free-form (pre-filled by service landings), so the
  // picker offers the DISTINCT values present in the loaded client list, just
  // like origin/destination/budget/size filters below.
  const SERVICE_CATEGORY_LABELS: Record<string, string> = {
    relocation: 'International Shipping',
    relocation_tour: 'Relocation tour',
    immigration: 'Immigration consultancy',
    real_estate: 'Real estate due diligence',
    international_moving: 'International moving',
    immigration_advice: 'Immigration advice',
    settling_in: 'Settling in',
  };
  function serviceCategoryOptions(): SelectOption[] {
    const present = $clients
      .map((c) => c.serviceCategory)
      .filter((v): v is string => typeof v === 'string' && v.length > 0);
    return toFilterOptions(
      [...new Set(present)].sort(),
      'Any Service',
    ).map((o) => ({
      value: o.value,
      label: o.value ? (SERVICE_CATEGORY_LABELS[o.value] ?? o.value) : o.label,
    }));
  }
  /** Build a SelectOption[] from a flat list of distinct values + an "any" label. */
  function toFilterOptions(values: string[], anyLabel: string): SelectOption[] {
    return [{ value: '', label: anyLabel }, ...values.map((v) => ({ value: v, label: v }))];
  }
  /** Stage options are computed inline (not memoized) so operator edits to
   *  STAGE_LABELS via Automations → Stage Configuration show up immediately,
   *  mirroring the original inline `Object.entries(STAGE_LABELS)` template loop. */
  function stageFilterOptions(): SelectOption[] {
    return [
      { value: '', label: 'All Stages' },
      ...Object.entries(STAGE_LABELS).map(([key, label]) => ({ value: key, label })),
    ];
  }

  // ─── Login State ────────────────────────────────────────────────────────
  const DOMAIN = '@internationalrelocationpartner.com';
  let loginUsername = '';
  let loginCode = '';
  let loginStep: 'email' | 'code' = 'email';
  let loginMessage = '';
  let loginError = '';
  let loginLoading = false;
  $: loginEmail = loginUsername.trim().toLowerCase() + DOMAIN;

  // ─── Bug report modal ────────────────────────────────────────────────────
  let bugReportOpen = false;

  // ─── Add Client modal ────────────────────────────────────────────────────
  let addClientOpen = false;

  // ─── Import / Export modal (List section) ────────────────────────────────
  let importExportOpen = false;
  let importExportMode: 'import' | 'export' = 'export';
  function openImportExport(m: 'import' | 'export') {
    importExportMode = m;
    importExportOpen = true;
  }
  async function handleImported() {
    // Refresh the board/list so newly-created / updated clients appear at once.
    await fetchClients();
  }

  // Pre-flight the microphone permission BEFORE opening the modal. Browsers
  // only prompt once per origin, so granting here means the modal's
  // auto-record starts the stream instantly (no jarring in-modal prompt).
  // If the user denies (or there's no mic) we still open the modal — it
  // gracefully falls back to manual typing.
  async function openAddClient() {
    if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
      try {
        const probe = await navigator.mediaDevices.getUserMedia({ audio: true });
        probe.getTracks().forEach((t) => t.stop()); // release; modal re-acquires
      } catch (err) {
        console.warn('[dashboard] mic permission not granted — opening in manual mode:', err);
      }
    }
    addClientOpen = true;
  }

  async function handleClientCreated(event: CustomEvent<{ docId: string }>) {

    addClientOpen = false;
    await fetchClients();
    // Open the newly-created client detail
    const newClient = $clients.find(c => c.id === event.detail.docId);
    if (newClient) openClientDetail(newClient);
  }

  // ─── Detail Panel State ─────────────────────────────────────────────────
  let newNote = '';
  let noteLoading = false;
  let selectedEmailType = '';
  let emailSending = false;
  let emailSentMessage = '';
  let newFieldKey = '';
  let newFieldValue = '';
  let detailTab: 'overview' | 'notes' | 'activity' | 'emails' | 'fields' = 'overview';
  let stageChanging = false;

  // ─── Init ───────────────────────────────────────────────────────────────
  import { isCheckingAuth } from './store.ts';

  onMount(async () => {
    const token = $authToken;
    if (token) {
      const valid = await checkAuth();
      if (valid) {
        await loadData();
      }
    } else {
      isCheckingAuth.set(false);
    }
  });

  // ─── SLA "stuck client" pulse clock ──────────────────────────────────────
  // Ticks once a minute so the overdue gradient on Kanban cards/columns stays
  // current as time passes (even without new data arriving over the socket).
  let nowMs = Date.now();
  onMount(() => {
    const t = setInterval(() => { nowMs = Date.now(); }, 60_000);
    return () => clearInterval(t);
  });

  // ─── Live access config (Firestore override) ─────────────────────────────

  // Set on every login. Overrides STATIC_SECTION_ACCESS when non-null.
  let liveAccessConfig: Record<string, string[]> | null = null;

  async function loadData() {
    initDashboardSocket();
    // Fetch live config in parallel — non-blocking, falls back to static if it fails.
    // `loadStageConfig()` is (re)loaded HERE, with a valid auth token, so the
    // centralized DB stage config (Automations → Stage Configuration) always
    // hydrates the board columns + every stage selector. It self-warms once at
    // module import too, but that can run before login (no token) or fail on a
    // cold server — so we always refresh it right after auth. Non-fatal.
    const [, liveConfig] = await Promise.all([
      Promise.all([fetchClients(), fetchMetrics(), loadStageConfig()]),
      fetchLiveAccessConfig(),
    ]);
    liveAccessConfig = liveConfig;
  }


  // ─── Login Handlers ─────────────────────────────────────────────────────
  async function handleRequestOTP() {
    loginLoading = true;
    loginError = '';
    try {
      loginMessage = await requestOTP(loginEmail);
      loginStep = 'code';
    } catch (err: any) {
      loginError = err.message;
    } finally {
      loginLoading = false;
    }
  }

  async function handleVerifyOTP() {
    loginLoading = true;
    loginError = '';
    try {
      await verifyOTP(loginEmail, loginCode);
      await loadData();
    } catch (err: any) {
      loginError = err.message;
    } finally {
      loginLoading = false;
    }
  }

  function handleLogout() {
    disconnectDashboardSocket();
    logout();
    loginStep = 'email';
    loginCode = '';
    loginMessage = '';
  }

  // ─── Board Handlers ─────────────────────────────────────────────────────
  async function openClientDetail(client: Client) {
    selectedClient.set(client);
    detailPanelOpen.set(true);
    detailTab = 'overview';
    // Fetch fresh detail
    try {
      await fetchClientDetail(client.id);
    } catch {}
  }

  function closeDetail() {
    detailPanelOpen.set(false);
    selectedClient.set(null);
    emailSentMessage = '';
  }

  // ─── Stage-gate block state ──────────────────────────────────────────────
  // When a Kanban move is refused by a stage gate (HTTP 409), the card stays
  // put and we surface a dismissible NOTIFICATION pill; clicking it opens a
  // MODAL detailing the unmet requirements (then the pill disappears). The same
  // payload is mirrored into `stageBlockNotice` so the client's Quotes tab shows
  // an inline error banner too.
  let blockNotifOpen = false;   // the small pill is visible
  let blockModalOpen = false;   // the details modal is open
  let blockClientName = '';
  let blockStageLabel = '';
  let blockList: StageGateBlock[] = [];

  function openBlockModal() {
    blockModalOpen = true;
    blockNotifOpen = false; // notification goes away once read
  }
  function closeBlockModal() {
    blockModalOpen = false;
    blockList = [];
  }

  async function handleStageChange(clientId: string, newStage: string) {
    stageChanging = true;
    try {
      await updateClientStage(clientId, newStage);
    } catch (err: any) {
      // A stage GATE refused the move (409). The card stays where it is; we show
      // a readable notification + modal instead of a blunt alert.
      const data = err?.data;
      if (err?.status === 409 && data?.blocked) {
        const client = $clients.find((c) => c.id === clientId);
        const clientName = client?.displayName || client?.email || clientId;
        const stageLabel = STAGE_LABELS[newStage] || newStage;
        const blockedBy: StageGateBlock[] = Array.isArray(data.blockedBy) ? data.blockedBy : [];
        blockClientName = clientName;
        blockStageLabel = stageLabel;
        blockList = blockedBy;
        blockNotifOpen = true;
        blockModalOpen = false;
        // Mirror to the shared store so the Quotes tab shows its inline banner.
        stageBlockNotice.set({
          clientId,
          clientName,
          targetStage: newStage,
          targetStageLabel: stageLabel,
          blockedBy,
          at: Date.now(),
        });
        toasts.error(`Move blocked — “${stageLabel}” has unmet requirements. Click the alert to see why.`);
      } else {
        alert('Failed to update stage: ' + (err?.message ?? err));
      }
    } finally {
      stageChanging = false;
    }
  }


  async function handleAddNote() {
    if (!newNote.trim() || !$selectedClient) return;
    noteLoading = true;
    try {
      await addNote($selectedClient.id, newNote.trim());
      newNote = '';
    } catch (err: any) {
      alert('Failed to add note: ' + err.message);
    } finally {
      noteLoading = false;
    }
  }

  async function handleTriggerEmail() {
    if (!selectedEmailType || !$selectedClient) return;
    emailSending = true;
    emailSentMessage = '';
    try {
      await triggerEmail($selectedClient.id, selectedEmailType);
      emailSentMessage = `✓ ${EMAIL_TYPES.find(e => e.value === selectedEmailType)?.label} sent!`;
      selectedEmailType = '';
    } catch (err: any) {
      emailSentMessage = `✗ Failed: ${err.message}`;
    } finally {
      emailSending = false;
    }
  }

  async function handleAddCustomField() {
    if (!newFieldKey.trim() || !newFieldValue.trim() || !$selectedClient) return;
    try {
      await updateClientFields($selectedClient.id, { [newFieldKey.trim()]: newFieldValue.trim() });
      newFieldKey = '';
      newFieldValue = '';
    } catch (err: any) {
      alert('Failed: ' + err.message);
    }
  }

  // ─── Section Access Control ─────────────────────────────────────────────
  // Source of truth is access.ts (STATIC_SECTION_ACCESS + DEFAULT_ACCESS).
  // On every login, loadData() fetches the live Firestore override and stores
  // it in `liveAccessConfig`. Live config takes precedence over the static map.

  /**
   * Reactive: which views the currently-authenticated user may see.
   * Priority: live Firestore config → static fallback in access.ts → DEFAULT_ACCESS.
   */
  $: allowedViews = (() => {
    const email = $authEmail ?? '';
    const map = liveAccessConfig ?? STATIC_SECTION_ACCESS;
    return ((map[email] ?? DEFAULT_ACCESS) as DashView[]);
  })();

  /** If the active view is not allowed, silently redirect to the first allowed view. */
  $: if ($isAuthenticated && allowedViews.length && !allowedViews.includes($activeView as DashView)) {
    activeView.set(allowedViews[0]);
  }

  // Deep links: `?view=metrics` (written by the Metrics Hub's "Copy link")
  // opens that tab once, if this user may see it.
  let urlViewApplied = false;
  $: if (!urlViewApplied && $isAuthenticated && allowedViews.length && typeof window !== 'undefined') {
    urlViewApplied = true;
    try {
      const v = new URLSearchParams(window.location.search).get('view') as DashView | null;
      if (v && allowedViews.includes(v) && v !== $activeView) switchView(v);
    } catch { /* no URL access */ }
  }

  // ─── Keep-alive tabs ───────────────────────────────────────────────────
  // A tab mounts on first visit and stays mounted (hidden) afterwards, so
  // switching back never re-fetches or loses state. Scroll is remembered per
  // tab because every tab shares the window's scroll.
  let visited: Partial<Record<DashView, true>> = {};
  const scrollByView: Partial<Record<string, number>> = {};
  let shownView: string = $activeView;
  function markVisited(v: string) {
    if (!visited[v as DashView]) visited = { ...visited, [v]: true };
  }
  $: markVisited($activeView);
  $: rememberScroll($activeView);
  async function rememberScroll(v: string) {
    if (typeof window === 'undefined' || v === shownView) return;
    scrollByView[shownView] = window.scrollY;
    shownView = v;
    await tick();
    window.scrollTo({ top: scrollByView[v] ?? 0, behavior: 'instant' as ScrollBehavior });
  }

  // ─── Top-bar nav: sliding active pill ──────────────────────────────────
  let navEl: HTMLElement | null = null;
  let navPill = { x: 0, w: 0 };
  async function placeNavPill(..._deps: unknown[]) {
    await tick();
    const btn = navEl?.querySelector<HTMLElement>('button.active');
    if (!btn) { navPill = { x: 0, w: 0 }; return; }
    // Subpixel-accurate: offsetLeft/offsetWidth round to whole pixels.
    const nav = navEl!.getBoundingClientRect();
    const b = btn.getBoundingClientRect();
    navPill = { x: b.left - nav.left - navEl!.clientLeft + navEl!.scrollLeft, w: b.width };
    btn.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  }
  $: placeNavPill($activeView, allowedViews, navEl);
  // Web fonts change button widths once they load.
  onMount(() => { document.fonts?.ready.then(() => placeNavPill()).catch(() => {}); });

  // ─── Activity rail: any API request in flight, after a short grace ─────
  // period so instant cache hits never flash it.
  let showActivity = false;
  let activityTimer: ReturnType<typeof setTimeout> | undefined;
  $: syncActivity($pendingRequests > 0);
  function syncActivity(busy: boolean) {
    clearTimeout(activityTimer);
    if (busy) activityTimer = setTimeout(() => (showActivity = true), 180);
    else showActivity = false;
  }

  async function switchView(view: DashView) {
    if (!allowedViews.includes(view)) return; // guard
    activeView.set(view as any);
    if (view === 'metrics' && !$metrics) {
      await fetchMetrics();
    }
  }

  // ─── Helpers ────────────────────────────────────────────────────────────
  function formatDate(iso: string): string {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function formatDateTime(iso: string): string {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  function timeAgo(iso: string): string {
    if (!iso) return '';
    const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  }

  function getActivityIcon(type: string): string {
    switch (type) {
      case 'stage_change': return '→';
      case 'note_added': return '📝';
      case 'email_triggered': return '📧';
      case 'field_update': return '✏️';
      case 'attendees_added': return '👥';
      default: return '•';
    }
  }

  function getActivityText(entry: any): string {
    switch (entry.type) {
      case 'stage_change':
        return `Moved from ${STAGE_LABELS[entry.from] || entry.from} → ${STAGE_LABELS[entry.to] || entry.to}`;
      case 'note_added':
        return 'Added a note';
      case 'email_triggered':
        return `Triggered email: ${entry.emailType}`;
      case 'field_update':
        return `Updated: ${(entry.fields || []).join(', ')}`;
      case 'attendees_added': {
        const list = Array.isArray(entry.addedAttendees) ? entry.addedAttendees : [];
        return `Added attendee${list.length === 1 ? '' : 's'} to call${list.length ? `: ${list.join(', ')}` : ''}`;
      }
      default:
        return entry.type;
    }
  }

  // ─── Column Search + Pagination ─────────────────────────────────────────
  let columnSearches: Record<string, string> = {};
  let columnPages: Record<string, number> = {};

  // Drag and drop
  let draggedClient: Client | null = null;

  function handleDragStart(e: DragEvent, client: Client) {
    draggedClient = client;
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', client.id);
    }
  }

  function handleDragOver(e: DragEvent) {
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
  }

  async function handleDrop(e: DragEvent, targetStage: string) {
    e.preventDefault();
    if (draggedClient && draggedClient.stage !== targetStage) {
      await handleStageChange(draggedClient.id, targetStage);
    }
    draggedClient = null;
  }

  // ─── Card rank control (float-to-top ordering) ───────────────────────────
  // `rankMenuFor` holds the id of the client whose rank popover is open (null =
  // none). `rankDraft` is the number typed into the "set exact" field. A window
  // click closes the popover — the badge/popover stop propagation so their own
  // clicks never trigger that close (nor open the detail panel).
  let rankMenuFor: string | null = null;
  let rankDraft: number | null = null;
  let rankSaving = false;

  function toggleRankMenu(client: Client, e: MouseEvent) {
    e.stopPropagation();
    if (rankMenuFor === client.id) { rankMenuFor = null; return; }
    rankMenuFor = client.id;
    rankDraft = typeof client.rankIndex === 'number' ? client.rankIndex : null;
  }

  function closeRankMenu() { rankMenuFor = null; rankDraft = null; }

  /** Highest current rank among a column's cards (0 when none are ranked). */
  function topRankOf(cards: Client[]): number {
    return cards.reduce(
      (m, c) => (typeof c.rankIndex === 'number' && c.rankIndex > m ? c.rankIndex : m),
      0,
    );
  }

  async function applyRank(client: Client, value: number | null) {
    rankSaving = true;
    try {
      await setClientRank(client.id, value);
      closeRankMenu();
    } catch (err: any) {
      alert('Failed to set rank: ' + err.message);
    } finally {
      rankSaving = false;
    }
  }

  /** Float a card above every other in its column (top rank + 1). */
  function sendToTop(client: Client, cards: Client[]) {
    applyRank(client, topRankOf(cards) + 1);
  }

  /** Apply the exact number typed in the popover (blank/invalid → clear rank). */
  function setExactRank(client: Client) {
    const v = rankDraft;
    applyRank(client, typeof v === 'number' && Number.isFinite(v) ? v : null);
  }


  // ─── Board columns ────────────────────────────────────────────────────────
  // Columns are driven by the CENTRALIZED, DB-backed stage config
  // (`$stageOrderStore`, published by applyStageConfig from
  // GET /api/dashboard/stage-config), so stages created / renamed / reordered in
  // Automations → Stage Configuration appear on the board automatically.
  //
  // CRITICAL SAFETY NET (fixes "moved a client to a new stage → it vanished"):
  // after the ordered active columns, we ALSO append a column for ANY stage that
  // currently holds clients but isn't in the active order — a brand-new, hidden,
  // inactive, or legacy stage id. This GUARANTEES that a client can never
  // disappear from the board: every stage that has at least one client always
  // gets a rendered column (labelled via STAGE_LABELS, falling back to the id).
  $: stageEntries = (() => {
    const base = ($stageOrderStore && $stageOrderStore.length)
      ? [...$stageOrderStore]
      : Object.keys(STAGE_LABELS).filter((s) => !HIDDEN_STAGES.has(s));
    const seen = new Set(base);
    for (const key of Object.keys($clientsByStage)) {
      if (!seen.has(key) && (($clientsByStage[key]?.length ?? 0) > 0)) {
        seen.add(key);
        base.push(key);
      }
    }
    return base.map((key) => [key, STAGE_LABELS[key] || key] as [string, string]);
  })();


  // ─── Board skeleton state ────────────────────────────────────────────────
  // Drives the Trello/Jira-style shimmering placeholder cards in every Kanban
  // column. Tied to the CLIENTS fetch specifically (clientsLoading) — NOT the
  // shared `loading` flag that fetchMetrics() also toggles — so the animation
  // ends exactly when the cards are ready, never prematurely. We also keep the
  // skeleton up until the first SUCCESSFUL load (clientsLoadedOnce) so a failed
  // first fetch never collapses into a misleading empty "No clients" board.
  $: boardLoading = $clientsLoading || (!$clientsLoadedOnce && !$error);
  // Board failed to load (after retries) and has no data yet → offer a retry
  // instead of leaving the operator staring at empty columns.
  $: boardLoadError = !!$error && !$clientsLoadedOnce && !$clientsLoading;
  const SKELETON_CARDS = [0, 1, 2, 3, 4]; // five identical placeholders per column



  // Stage ORDER for the "missing transcript" heuristic — driven by the
  // centralized, DB-backed stage config ($stageConfig, full ordered list incl.
  // inactive) so it tracks operator edits instead of a stale one-time snapshot
  // of the hardcoded STAGE_LABELS. Falls back to the hardcoded keys only for
  // first paint before the config resolves.
  $: stageKeys = ($stageConfig && $stageConfig.length)
    ? $stageConfig.map((s) => s.id)
    : Object.keys(STAGE_LABELS);

  /**
   * Whole days a client has been sitting in its current column — independent
   * of whether the column has an SLA. Drives the always-visible ⏰ day counter
   * on every Kanban card. Mirrors getStageSlaStatus's time source so the two
   * never disagree.
   */
  function daysInColumn(client: any, now: number = nowMs): number {
    const raw = client?.rawDoc?.stageEnteredAt || client?.lastUpdated || client?.createdAt || '';
    const ms = raw ? new Date(raw).getTime() : NaN;
    if (Number.isNaN(ms)) return 0;
    return Math.floor(Math.max(0, now - ms) / 86_400_000);
  }
  $: postTranscriptIdx = stageKeys.indexOf('sales_post_transcript');


  function isMissingTranscript(client: Client): boolean {
    const idx = stageKeys.indexOf(client.stage);
    if (idx < postTranscriptIdx) return false;
    return !client.transcript && !client.meetingNotes?.text;
  }

  function isNoShow(client: Client): boolean {
    if (client.callOutcome === 'no_show') return true;
    if (client.stage === 'sales_preconsultation' && client.scheduling?.length > 0) {
      // If call date is past by more than 1 hour and they are still in preconsultation
      const callTime = new Date(client.scheduling[0]).getTime();
      return Date.now() > (callTime + 60 * 60 * 1000);
    }
    return false;
  }
</script>

<svelte:head>
  <title>IRP Dashboard — CRM</title>
  <meta name="robots" content="noindex, nofollow" />
</svelte:head>

<!-- Any click outside an open rank popover (badge + popover stop propagation)
     closes it. Harmless no-op when nothing is open. -->
<svelte:window on:click={() => { if (rankMenuFor) closeRankMenu(); }} on:resize={() => placeNavPill()} />


{#if $isCheckingAuth}
  <!-- ═══════════════════════ INITIAL LOADING STATE ═══════════════════════ -->
  <div class="dashboard__loading" style="min-height: 100dvh;">
    <div class="spinner"></div>
    <p>Authenticating session...</p>
  </div>

{:else if !$isAuthenticated}
  <!-- ═══════════════════════ LOGIN GATE ═══════════════════════ -->
  <div class="login-gate">
    <div class="login-card">
      <div class="login-logo">
        <div class="login-logo__container">
          <img src="/IRP-LOGO.jpg" alt="logo" height="60">
        </div>
        <h1>IRP Dashboard</h1>
        <p>Client Relationship Management</p>
      </div>

      {#if loginStep === 'email'}
        <form on:submit|preventDefault={handleRequestOTP}>
          <label class="login-label">
            <span>Username</span>
            <div class="login-email-combo">
              <input
                type="text"
                bind:value={loginUsername}
                placeholder="yourname"
                required
                class="login-input login-input--username"
                autocomplete="username"
                autocapitalize="none"
              />
              <span class="login-email-combo__domain">{DOMAIN}</span>
            </div>
          </label>
          <button type="submit" class="login-btn" disabled={loginLoading || !loginUsername.trim()}>
            {loginLoading ? 'Sending…' : 'Get Login Code'}
          </button>
        </form>
      {:else}
        <form on:submit|preventDefault={handleVerifyOTP}>
          <p class="login-sent-message">Code sent to <strong>{loginEmail}</strong></p>
          <label class="login-label">
            <span>6-Digit Code</span>
            <input
              type="text"
              bind:value={loginCode}
              placeholder="000000"
              maxlength="6"
              required
              class="login-input login-input--code"
              autocomplete="one-time-code"
              inputmode="numeric"
            />
          </label>
          <button type="submit" class="login-btn" disabled={loginLoading}>
            {loginLoading ? 'Verifying…' : 'Log In'}
          </button>
          <button type="button" class="login-back" on:click={() => { loginStep = 'email'; loginError = ''; }}>
            ← Use different email
          </button>
        </form>
      {/if}

      {#if loginError}
        <div class="login-error">{loginError}</div>
      {/if}
      {#if loginMessage && loginStep === 'code'}
        <div class="login-success">{loginMessage}</div>
      {/if}
    </div>
  </div>

{:else}
  <!-- ═══════════════════════ DASHBOARD ═══════════════════════ -->
  <div class="dashboard" class:panel-open={$detailPanelOpen}>

    <!-- ── Top Bar ───────────────────────────────────────────── -->
    <header class="topbar">
      <div class="topbar__left">
        <img src="/IRP-LOGO.jpg" alt="logo" height="40">
        <nav class="topbar__nav" class:has-pill={navPill.w > 0} bind:this={navEl}>
          <span class="topbar__nav-pill" aria-hidden="true" style="transform:translateX({navPill.x}px);width:{navPill.w}px"></span>
          {#if allowedViews.includes('board')}
            <button class:active={$activeView === 'board'} on:click={() => switchView('board')}>Board</button>
          {/if}
          {#if allowedViews.includes('list')}
            <button class:active={$activeView === 'list'} on:click={() => switchView('list')}>List</button>
          {/if}
          {#if allowedViews.includes('metrics')}
            <button class:active={$activeView === 'metrics'} on:click={() => switchView('metrics')}>Metrics</button>
          {/if}
          {#if allowedViews.includes('finance')}
            <button class:active={$activeView === 'finance'} on:click={() => switchView('finance')} title="Revenue, provider cost and margin across every quote">Finance</button>
          {/if}
          {#if allowedViews.includes('salesReport')}
            <button class:active={$activeView === 'salesReport'} on:click={() => switchView('salesReport')} title="Monthly sales and payment funnel">Sales Report</button>
          {/if}
          {#if allowedViews.includes('evo')}
            <button class:active={$activeView === 'evo'} on:click={() => switchView('evo')} title="Experiments: what's winning and what to do next">Evo Lab</button>
          {/if}
          {#if allowedViews.includes('providers')}
            <button class:active={$activeView === 'providers'} on:click={() => switchView('providers')} title="Shipping & relocation provider registry">Providers</button>
          {/if}
          {#if allowedViews.includes('posts')}
            <button class:active={$activeView === 'posts'} on:click={() => switchView('posts')} title="Write and schedule broadcast posts to clients">Posts</button>
          {/if}
          {#if allowedViews.includes('admin')}
            <button class:active={$activeView === 'admin'} on:click={() => switchView('admin')} title="Admin: manage staff access and view sessions" class="topbar__admin-btn">Admin</button>
          {/if}
          {#if allowedViews.includes('templates')}
            <button class:active={$activeView === 'templates'} on:click={() => switchView('templates')} title="Quote document templates builder">Templates</button>
          {/if}
          {#if allowedViews.includes('automations')}
            <button class:active={$activeView === 'automations'} on:click={() => switchView('automations')} title="Stage email automation rules & templates">Automations</button>
          {/if}
        </nav>
      </div>
      <div class="topbar__right">
        <div class="topbar__search">
          <input type="text" placeholder="Search clients…" bind:value={$searchQuery} />
        </div>
        <button class="topbar__add-client" on:click={openAddClient} title="Add client manually">

          <!-- group_add: 2 heads + 2 bodies + strokes-based plus — no extra circles -->
          <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M8 10H5V7H3v3H0v2h3v3h2v-3h3zm10 1c1.66 0 2.99-1.34 2.99-3S19.66 5 18 5c-.32 0-.63.05-.91.14.57.81.9 1.79.9 2.86s-.34 2.05-.9 2.86c.28.09.59.14.91.14zm-5 0c1.66 0 2.99-1.34 2.99-3S14.66 5 13 5s-3 1.34-3 3 1.34 3 3 3zm6.62 2.16c.83.73 1.38 1.66 1.38 2.84V18h3v-2c0-1.54-2.37-2.49-4.38-2.84zM13 13c-2 0-6 1-6 3v2h12v-2c0-2-4-3-6-3z"/>
          </svg>
          New Client
        </button>
        <span class="topbar__user">{$authEmail?.split('@')[0]}</span>
        <button class="topbar__logout" on:click={handleLogout}>Logout</button>
      </div>
      <div class="topbar__activity" class:is-on={showActivity} aria-hidden="true"></div>
    </header>

    <!-- ── Filters ───────────────────────────────────────────── -->
    {#if $activeView === 'board' || $activeView === 'list'}
      <div class="filters-bar">
        <!-- List-section Import/Export of clients as JSON. Kept to the List
              view per the CRM workflow; validated against the Overview fields
              registry and non-destructive on the server. -->
        <div class="ie-actions">
          <button class="ie-btn" on:click={() => openImportExport('export')} title="Export clients to JSON">
            ⬇ Export
          </button>
          <button class="ie-btn ie-btn--primary" on:click={() => openImportExport('import')} title="Import clients from JSON">
            ⬆ Import
          </button>
        </div>
        <div class="filter-select-wrap">
          <Select
            options={stageFilterOptions()}
            bind:value={$filters.stage}
            size="sm"
            ariaLabel="Filter by stage"
          />
        </div>
        <div class="filter-select-wrap">
          <Select
            options={OUTCOME_OPTIONS}
            bind:value={$filters.callOutcome}
            size="sm"
            ariaLabel="Filter by call outcome"
          />
        </div>
        <div class="filter-select-wrap">
          <Select
            options={serviceCategoryOptions()}
            bind:value={$filters.serviceCategory}
            size="sm"
            ariaLabel="Filter by service"
          />
        </div>
        <div class="filter-select-wrap">
          <Select
            options={toFilterOptions([...new Set($clients.map(c => c.originCountry).filter(Boolean))].sort(), 'Any Origin')}
            bind:value={$filters.originCountry}
            size="sm"
            ariaLabel="Filter by origin country"
          />
        </div>
        <div class="filter-select-wrap">
          <Select
            options={toFilterOptions([...new Set($clients.map(c => c.destinationCountry).filter(Boolean))].sort(), 'Any Destination')}
            bind:value={$filters.destinationCountry}
            size="sm"
            ariaLabel="Filter by destination country"
          />
        </div>
        <div class="filter-select-wrap">
          <Select
            options={toFilterOptions([...new Set($clients.map(c => c.budget).filter(Boolean))].sort(), 'Any Budget')}
            bind:value={$filters.budget}
            size="sm"
            ariaLabel="Filter by budget"
          />
        </div>
        <div class="filter-select-wrap">
          <Select
            options={toFilterOptions([...new Set($clients.map(c => c.size).filter(Boolean))].sort(), 'Any Move Size')}
            bind:value={$filters.size}
            size="sm"
            ariaLabel="Filter by move size"
          />
        </div>
        <button class="filter-clear" on:click={() => $filters = {stage: '', originCountry: '', destinationCountry: '', budget: '', size: '', callOutcome: '', serviceCategory: ''}}>Clear</button>
      </div>
    {/if}

    <!-- ── Loading / Error ───────────────────────────────────── -->
    <!-- On the board, the Kanban column skeletons are the loading signal, so the
         standalone spinner is only shown for the other (non-board) views. -->
    {#if $loading && $clients.length === 0 && $activeView !== 'board'}
      <div class="dashboard__loading">
        <div class="spinner"></div>
        <p>Loading clients…</p>
      </div>
    {/if}


    {#if $error}
      <div class="dashboard__error">
        <span>{$error}</span>
        {#if boardLoadError}
          <button class="dashboard__retry" on:click={() => fetchClients()}>Retry</button>
        {/if}
      </div>
    {/if}


    <!-- ══════════════ BOARD VIEW ══════════════ -->
    {#if $activeView === 'board'}
      <div class="board">
        {#each stageEntries as [stageKey, stageLabel]}
          {@const allCards = $clientsByStage[stageKey] || []}
          {@const colQuery = (columnSearches[stageKey] || '').toLowerCase().trim()}
          {@const filteredCards = colQuery ? allCards.filter(c => `${c.name} ${c.surname} ${c.email} ${c.originCity} ${c.destinationCity}`.toLowerCase().includes(colQuery)) : allCards}
          {@const pageSize = columnPages[stageKey] || 10}
          {@const visibleCards = filteredCards.slice(0, pageSize)}
          {@const hasMore = filteredCards.length > pageSize}
          {@const overdueCount = allCards.filter((c) => getStageSlaStatus(c, nowMs).overdue).length}
          <div
            class="board__column"
            class:board__column--overdue={overdueCount > 0}
            on:dragover={handleDragOver}
            on:drop={(e) => handleDrop(e, stageKey)}
          >
            <div class="board__column-header" style="border-color: {STAGE_COLORS[stageKey]}">
              <span class="board__column-icon">{STAGE_ICONS[stageKey]}</span>
              <span class="board__column-title" title={STAGE_DESCRIPTIONS[stageKey] || stageLabel}>{stageLabel}</span>
              {#if STAGE_DESCRIPTIONS[stageKey]}
                <span
                  class="board__column-info"
                  title={STAGE_DESCRIPTIONS[stageKey]}
                  aria-label={STAGE_DESCRIPTIONS[stageKey]}
                >ⓘ</span>
              {/if}
              <span class="board__column-count">{colQuery ? `${filteredCards.length}/${allCards.length}` : allCards.length}</span>
              {#if overdueCount > 0}
                <span
                  class="board__column-overdue"
                  title="{overdueCount} client{overdueCount === 1 ? '' : 's'} past the {STAGE_SLA_DAYS[stageKey]}-day SLA for this column"
                >⚠ {overdueCount}</span>
              {/if}
            </div>

            <div class="board__column-search">
              <input
                type="text"
                placeholder="Search column…"
                value={columnSearches[stageKey] || ''}
                on:input={(e) => { columnSearches[stageKey] = e.currentTarget.value; columnSearches = columnSearches; }}
              />
            </div>
            <div class="board__column-cards">
              {#if boardLoading}
                <!-- Trello/Jira-style shimmering placeholders while the first
                     fetch is in flight. Identical set per column so the whole
                     board animates in sync. aria-hidden — purely decorative. -->
                {#each SKELETON_CARDS as i (i)}
                  <div class="card card--skeleton" style="--sk-delay: {i * 0.09}s" aria-hidden="true">
                    <div class="sk-line sk-line--title"></div>
                    <div class="sk-line sk-line--route"></div>
                    <div class="sk-meta">
                      <span class="sk-pill"></span>
                      <span class="sk-pill sk-pill--sm"></span>
                    </div>
                  </div>
                {/each}
              {:else}
              {#each visibleCards as client (client.id)}
                {@const sla = getStageSlaStatus(client, nowMs)}

                <div
                  class="card"
                  class:card--missing-name={!client.nameKnown}
                  class:card--no-show={isNoShow(client)}
                  class:card--overdue={sla.overdue}
                  draggable="true"

                  on:dragstart={(e) => handleDragStart(e, client)}
                  on:click={() => openClientDetail(client)}
                  role="button"
                  tabindex="0"
                  on:keydown={(e) => e.key === 'Enter' && openClientDetail(client)}
                >
                  <!-- Pending-actions badge — top-right corner, auto-hides when count=0 -->
                  <PendingBadge count={$pendingCountByClient.get(client.id) ?? 0} variant="card" />

                  <!-- Operator rank control (float-to-top). Stops propagation so
                       it never opens the detail panel; opens a small popover to
                       send-to-top / set an exact rank / clear. -->
                  <button
                    class="card__rank"
                    class:card__rank--set={typeof client.rankIndex === 'number'}
                    title={typeof client.rankIndex === 'number'
                      ? `Ranked #${client.rankIndex} — click to change`
                      : 'Rank card (float to top)'}
                    on:click={(e) => toggleRankMenu(client, e)}
                  >{#if typeof client.rankIndex === 'number'}{"🔥".repeat(+client.rankIndex)}{/if}</button>
                  {#if rankMenuFor === client.id}
                    <!-- svelte-ignore a11y-click-events-have-key-events -->
                    <!-- svelte-ignore a11y-no-static-element-interactions -->
                    <div class="card__rank-menu" role="menu" tabindex="-1" on:click|stopPropagation>
                      <button class="card__rank-act" disabled={rankSaving} on:click={() => sendToTop(client, allCards)}>⤒ Send to top</button>
                      <div class="card__rank-setrow">
                        <input class="card__rank-input" type="number" placeholder="#" bind:value={rankDraft} />
                        <button class="card__rank-act" disabled={rankSaving} on:click={() => setExactRank(client)}>Set</button>
                      </div>
                      {#if typeof client.rankIndex === 'number'}
                        <button class="card__rank-act card__rank-act--clear" disabled={rankSaving} on:click={() => applyRank(client, null)}>✕ Clear rank</button>
                      {/if}
                    </div>
                  {/if}
                  <div
                    class="card__name"

                    title={!client.nameKnown ? 'First name not provided — only surname/email known' : `${client.name} ${client.surname}`.trim()}
                  >
                    {#if !client.nameKnown}<span class="card__name-badge" aria-label="First name unknown">?</span>{/if}{client.displayName}
                  </div>

                  <div class="card__route">
                    {client.originCity || client.originCountry}
                    <span class="card__arrow">→</span>
                    {client.destinationCity || client.destinationCountry}
                  </div>

                  <div class="card__meta">
                    {#if client.rawDoc?.source === 'country-guide-gate'}
                      <span class="card__source-badge" title="Lead from country guide gate — not a consultation submission">
                        🌍 Guide Lead
                      </span>
                    {/if}
                    {#if client.rawDoc?.source === 'users-migration'}
                      <span class="card__source-badge" title="Legacy lead migrated from the users collection — booked via the old Zoho flow but was never recorded in the CRM">
                        📥 Migrated Lead
                      </span>
                    {/if}

                    {#if client.budget}<span class="card__tag">{client.budget}</span>{/if}
                    <span
                      class="card__sla"
                      class:card__sla--overdue={sla.overdue}
                      title={sla.hasSla
                        ? `In this column ${daysInColumn(client, nowMs)}d — SLA is ${sla.thresholdDays}d`
                        : `In this column ${daysInColumn(client, nowMs)}d`}
                    >
                      ⏰ {daysInColumn(client, nowMs)}d
                    </span>
                    {#if client.scheduling?.length}

                      <span class="card__date">{formatDate(client.scheduling[0])}</span>
                    {/if}
                    {#if (client.agentNotes?.length || 0) + (client.chatbotNotes?.length || 0) > 0}
                      <span class="card__notes-badge" title="Notes available">
                        📝 {(client.agentNotes?.length || 0) + (client.chatbotNotes?.length || 0)}
                      </span>
                    {/if}
                    {#if isMissingTranscript(client)}
                      <span class="card__notes-badge card__notes-badge--missing" title="Missing call transcript">
                        ❌ Transcript
                      </span>
                    {/if}
                  </div>
                </div>
              {/each}
              {#if hasMore}
                <button class="board__show-more" on:click={() => { columnPages[stageKey] = pageSize + 10; columnPages = columnPages; }}>
                  Show more ({filteredCards.length - pageSize} remaining)
                </button>
              {/if}
              {#if filteredCards.length === 0 && $clientsLoadedOnce}
                <div class="board__empty">{colQuery ? 'No matches' : 'No clients'}</div>
              {/if}
              {/if}

            </div>
          </div>
        {/each}
      </div>


    <!-- ══════════════ LIST VIEW ══════════════ -->
    {:else if $activeView === 'list'}
      <div class="list-view">
        <!-- Sticky External Header (Decoupled from native table) -->
        <div class="list-header-sticky">
          <div class="list-grid-layout">
            <div class="list-col-header">Client</div>
            <div class="list-col-header">Route</div>
            <div class="list-col-header">Stage</div>
            <div class="list-col-header">Budget</div>
            <div class="list-col-header">Consultation</div>
            <div class="list-col-header">Last Updated</div>
          </div>
        </div>

        <div class="list-body">
          {#each $filteredClients as client (client.id)}
            <!-- svelte-ignore a11y-click-events-have-key-events -->
            <!-- svelte-ignore a11y-no-static-element-interactions -->
            <div
              on:click={() => openClientDetail(client)}
              class="list-row list-grid-layout"
              class:list-row--missing-name={!client.nameKnown}
              class:list-row--no-show={isNoShow(client)}
            >
              <div class="list-cell">
                <div
                  class="list-row__name"
                  title={!client.nameKnown ? 'First name not provided — only surname/email known' : `${client.name} ${client.surname}`.trim()}
                >
                  {#if typeof client.rankIndex === 'number'}<span class="list-row__rank" title="Ranked #{"🔥".repeat(+client.rankIndex)} — floats to the top">{"🔥".repeat(+client.rankIndex)}</span>{/if}{#if !client.nameKnown}<span class="list-row__name-badge" aria-label="First name unknown">?</span>{/if}{client.displayName}
                </div>

                <div class="list-row__email" title={client.email}>{client.email}</div>
              </div>

              <div class="list-cell" title="{client.originCity || client.originCountry} → {client.destinationCity || client.destinationCountry}">
                <div>{client.originCity || client.originCountry} → {client.destinationCity || client.destinationCountry}</div>
              </div>
              <div class="list-cell" title="{STAGE_LABELS[client.stage]}">
                <span class="stage-badge" style="background: {STAGE_COLORS[client.stage]}">
                  {STAGE_ICONS[client.stage]} {STAGE_LABELS[client.stage]}
                </span>
                {#if isMissingTranscript(client)}
                  <span class="stage-badge stage-badge--missing" title="Missing call transcript" style="background: #fee2e2; color: #ef4444; border: 1px solid #fca5a5; margin-left: 6px;">
                    ❌
                  </span>
                {/if}
              </div>
              <div class="list-cell" title={client.budget || '—'}>{client.budget || '—'}</div>
              <div class="list-cell" title={client.scheduling?.length ? formatDate(client.scheduling[0]) : '—'}>
                {client.scheduling?.length ? formatDate(client.scheduling[0]) : '—'}
              </div>
              <div class="list-cell" title={timeAgo(client.lastUpdated)}>{timeAgo(client.lastUpdated)}</div>
            </div>
          {/each}
          {#if $filteredClients.length === 0}
            <div class="list-empty">No clients found matching filters.</div>
          {/if}
        </div>
      </div>

    {/if}

    <!-- ══════════════ KEEP-ALIVE VIEWS ══════════════
         Each tab mounts on its first visit and then stays mounted, hidden,
         while you are elsewhere. Coming back is instant: data, filters,
         scroll position and any in-flight load are exactly as you left them.
         Views refresh stale data in the background (utils/viewLifecycle.ts). -->
    {#if visited.metrics && allowedViews.includes('metrics')}
      <section class="dash-view" data-view="metrics" hidden={$activeView !== 'metrics'}><MetricsView /></section>
    {/if}
    {#if visited.evo && allowedViews.includes('evo')}
      <section class="dash-view" data-view="evo" hidden={$activeView !== 'evo'}><EvoView /></section>
    {/if}
    {#if visited.providers && allowedViews.includes('providers')}
      <section class="dash-view" data-view="providers" hidden={$activeView !== 'providers'}><ProvidersView /></section>
    {/if}
    {#if visited.posts && allowedViews.includes('posts')}
      <section class="dash-view" data-view="posts" hidden={$activeView !== 'posts'}><PostsView /></section>
    {/if}
    {#if visited.admin && allowedViews.includes('admin')}
      <section class="dash-view" data-view="admin" hidden={$activeView !== 'admin'}><AdminView /></section>
    {/if}
    {#if visited.templates && allowedViews.includes('templates')}
      <section class="dash-view" data-view="templates" hidden={$activeView !== 'templates'}><TemplatesView /></section>
    {/if}
    {#if visited.automations && allowedViews.includes('automations')}
      <section class="dash-view" data-view="automations" hidden={$activeView !== 'automations'}><AutomationView /></section>
    {/if}
    {#if visited.finance && allowedViews.includes('finance')}
      <section class="dash-view" data-view="finance" hidden={$activeView !== 'finance'}><FinanceView /></section>
    {/if}
    {#if visited.salesReport && allowedViews.includes('salesReport')}
      <section class="dash-view" data-view="salesReport" hidden={$activeView !== 'salesReport'}><SalesReportView /></section>
    {/if}

    <!-- ══════════════ DETAIL PANEL ══════════════ -->
    <DetailPanel 
      {stageChanging} 
      {handleStageChange} 
      {closeDetail}
      {timeAgo}
      {formatDateTime}
      {formatDate}
      {getActivityIcon}
      {getActivityText}
    />
  </div>
{/if}

<!-- ── Floating bug-report FAB (visible only when authenticated) ─────────── -->
{#if $isAuthenticated}
  <button
    class="bug-fab"
    on:click={() => (bugReportOpen = true)}
    title="Report a bug"
    aria-label="Report a bug"
  >
    <span class="bug-fab__ring" aria-hidden="true"></span>
    <span class="bug-fab__inner" aria-hidden="true">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <!-- bug icon: body + legs -->
        <path d="M12 12c-2.5 0-4 1.5-4 4s1.5 4 4 4 4-1.5 4-4-1.5-4-4-4z"/>
        <path d="M12 12V8"/>
        <path d="M8 16H4M16 16h4"/>
        <path d="M7 13L4 10M17 13l3-3"/>
        <path d="M7 19l-3 2M17 19l3 2"/>
        <path d="M10 8c0-1.1.9-2 2-2s2 .9 2 2"/>
      </svg>
    </span>
  </button>
  <BugReportModal bind:open={bugReportOpen} />
{/if}

{#if addClientOpen}
  <AddClientModal
    on:created={handleClientCreated}
    on:close={() => (addClientOpen = false)}
  />
{/if}

{#if importExportOpen}
  <ClientImportExportModal
    mode={importExportMode}
    on:imported={handleImported}
    on:close={() => (importExportOpen = false)}
  />
{/if}

<EmailPreviewDrawer />

<!-- ── Stage-gate BLOCK notification pill (click → modal) ─────────────────── -->
{#if blockNotifOpen}
  <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
  <div class="sgblock-pill" role="alert" on:click={openBlockModal} title="Click to see why the move was blocked">
    <span class="sgblock-pill__icon">🚫</span>
    <span class="sgblock-pill__text">Move to “{blockStageLabel}” blocked — click to see why</span>
    <button class="sgblock-pill__close" title="Dismiss" on:click|stopPropagation={() => (blockNotifOpen = false)}>✕</button>
  </div>
{/if}

<!-- ── Stage-gate BLOCK modal ─────────────────────────────────────────────── -->
{#if blockModalOpen}
  <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
  <div class="sgblock-backdrop" on:click={closeBlockModal} role="presentation">
    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <div class="sgblock-modal" on:click|stopPropagation role="dialog" aria-modal="true" tabindex="-1">
      <header class="sgblock-modal__head">
        <span class="sgblock-modal__icon">🚫</span>
        <h3 class="sgblock-modal__title">Can't move {blockClientName} to “{blockStageLabel}” yet</h3>
        <button class="sgblock-modal__close" on:click={closeBlockModal} aria-label="Close">✕</button>
      </header>
      <div class="sgblock-modal__body">
        <p class="sgblock-modal__lead">The following requirements must be met before this move is allowed:</p>
        {#each blockList as b (b.ruleId)}
          <div class="sgblock-rule">
            <p class="sgblock-rule__msg">{b.message}</p>
            {#if b.unmet?.length}
              <ul class="sgblock-rule__unmet">
                {#each b.unmet as u}<li>{u}</li>{/each}
              </ul>
            {/if}
          </div>
        {/each}
      </div>
      <footer class="sgblock-modal__foot">
        <button class="sgblock-modal__ok" on:click={closeBlockModal}>Got it</button>
      </footer>
    </div>
  </div>
{/if}

<ToastContainer />
<Footer />


<style>
  /* ══ Stage-gate BLOCK notification pill + modal ════════════════════════ */
  .sgblock-pill {
    position: fixed;
    bottom: 24px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: 0.6rem;
    max-width: 560px;
    padding: 0.7rem 1rem;
    background: linear-gradient(135deg, #b91c1c, #dc2626);
    color: #fff;
    border-radius: 14px;
    box-shadow: 0 8px 30px rgba(185, 28, 28, 0.4);
    font-family: var(--font-paragraph, 'Jost'), system-ui, sans-serif;
    font-size: 0.85rem;
    font-weight: 700;
    cursor: pointer;
    z-index: 9500;
    animation: sgblock-in 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
  }
  @keyframes sgblock-in {
    from { opacity: 0; transform: translateX(-50%) translateY(12px); }
    to   { opacity: 1; transform: translateX(-50%) translateY(0); }
  }
  .sgblock-pill__icon { font-size: 1rem; }
  .sgblock-pill__text { flex: 1; }
  .sgblock-pill__close {
    background: rgba(255, 255, 255, 0.18); border: none; color: #fff; cursor: pointer;
    width: 22px; height: 22px; border-radius: 50%; font-size: 0.8rem; flex-shrink: 0;
  }
  .sgblock-pill__close:hover { background: rgba(255, 255, 255, 0.3); }

  .sgblock-backdrop {
    position: fixed; inset: 0; background: rgba(15, 23, 42, 0.55);
    backdrop-filter: blur(3px); display: flex; align-items: center; justify-content: center;
    z-index: 9600; padding: 1rem;
  }
  .sgblock-modal {
    background: #fff; border-radius: 18px; max-width: 480px; width: 100%;
    box-shadow: 0 24px 60px rgba(0, 0, 0, 0.35);
    font-family: var(--font-paragraph, 'Jost'), system-ui, sans-serif;
    overflow: hidden;
    animation: sgblock-pop 0.22s cubic-bezier(0.34, 1.56, 0.64, 1);
  }
  @keyframes sgblock-pop {
    from { opacity: 0; transform: scale(0.94); }
    to   { opacity: 1; transform: scale(1); }
  }
  .sgblock-modal__head {
    display: flex; align-items: center; gap: 0.6rem;
    padding: 1.1rem 1.25rem; border-bottom: 1px solid #f1f5f9;
  }
  .sgblock-modal__icon { font-size: 1.15rem; }
  .sgblock-modal__title { margin: 0; flex: 1; font-size: 1.02rem; font-weight: 800; color: #0f172a; }
  .sgblock-modal__close {
    background: none; border: none; color: #94a3b8; cursor: pointer; font-size: 1rem;
    padding: 4px 8px; border-radius: 8px;
  }
  .sgblock-modal__close:hover { background: #f1f5f9; color: #475569; }
  .sgblock-modal__body { padding: 1.1rem 1.25rem; max-height: 60vh; overflow-y: auto; }
  .sgblock-modal__lead { margin: 0 0 0.85rem; color: #475569; font-size: 0.88rem; line-height: 1.5; }
  .sgblock-rule {
    background: #fef2f2; border: 1px solid #fecaca; border-radius: 12px;
    padding: 0.75rem 0.9rem; margin-bottom: 0.7rem;
  }
  .sgblock-rule__msg { margin: 0; color: #7f1d1d; font-size: 0.88rem; font-weight: 600; line-height: 1.45; }
  .sgblock-rule__unmet { margin: 0.4rem 0 0; padding-left: 1.15rem; color: #b91c1c; font-size: 0.82rem; }
  .sgblock-rule__unmet li { margin: 0.12rem 0; }
  .sgblock-modal__foot { padding: 0.9rem 1.25rem 1.15rem; display: flex; justify-content: flex-end; }
  .sgblock-modal__ok {
    background: linear-gradient(135deg, #02b5bb, #0d9488); color: #fff; border: none;
    border-radius: 10px; padding: 0.55rem 1.4rem; font-weight: 800; font-size: 0.88rem;
    cursor: pointer; font-family: inherit;
  }
  .sgblock-modal__ok:hover { filter: brightness(1.07); }

  /* ══ Board load-error retry button ═════════════════════════════════════ */
  .dashboard__retry {

    margin-left: 0.75rem;
    padding: 0.3rem 0.9rem;
    background: #ef4444;
    color: #fff;
    border: none;
    border-radius: 8px;
    font-size: 0.8rem;
    font-weight: 700;
    cursor: pointer;
    transition: filter 0.15s, transform 0.12s;
  }
  .dashboard__retry:hover {
    filter: brightness(1.1);
    transform: translateY(-1px);
  }
  .dashboard__retry:active {
    transform: translateY(0);
  }

  /* ══ Filters-bar <Select> wrappers ══════════════════════════════════════
     Constrains the custom <Select> trigger to a fixed width so it can never
     be stretched by the width of its option content (the native <select>
     bug this replaces). The component's own trigger/menu labels already
     ellipsis-truncate long text; the menu itself is portaled + position:fixed
     so it can never collide with the viewport edge either. */
  .filter-select-wrap {
    width: 168px;
    flex: 0 0 auto;
  }

  /* ══ List-section Import/Export buttons ════════════════════════════════ */
  .ie-actions {
    display: inline-flex;
    gap: 0.4rem;
    margin-left: auto; /* push to the right edge of the filters bar */
  }
  .ie-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.32rem 0.8rem;
    background: #fff;
    color: #334155;
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    font-size: 0.78rem;
    font-weight: 700;
    cursor: pointer;
    white-space: nowrap;
    transition: background 0.15s, border-color 0.15s, transform 0.12s, box-shadow 0.15s;
  }
  .ie-btn:hover {
    background: #f1f5f9;
    border-color: #94a3b8;
    transform: translateY(-1px);
  }
  .ie-btn--primary {
    background: linear-gradient(135deg, #02b5bb 0%, #0a8a8e 100%);
    color: #fff;
    border-color: transparent;
    box-shadow: 0 2px 10px rgba(2, 181, 187, 0.3);
  }
  .ie-btn--primary:hover {
    filter: brightness(1.08);
    color: #000;
    box-shadow: 0 5px 16px rgba(2, 181, 187, 0.42);
  }

  /* ══ Add Client button — ultra-modern ══════════════════════════════════ */
  .topbar__add-client {

    svg, path {
      fill: var(--color-background);
    }

    display: inline-flex;
    align-items: center;
    gap: 0.42rem;
    padding: 0.38rem 1rem;
    background: linear-gradient(135deg, #02b5bb 0%, #0a8a8e 60%, #076f72 100%);
    color: #fff;
    border: 1px solid rgba(2,181,187,.3);
    border-radius: 10px;
    font-size: 0.8rem;
    font-weight: 800;
    letter-spacing: 0.03em;
    cursor: pointer;
    white-space: nowrap;
    box-shadow: 0 3px 14px rgba(2,181,187,.35), inset 0 1px 0 rgba(255,255,255,.15);
    transition: box-shadow .2s, transform .12s, filter .15s;
  }
  .topbar__add-client:hover {
    box-shadow: 0 6px 22px rgba(2,181,187,.52);
    filter: brightness(1.1);
    transform: translateY(-1px);
  }
  .topbar__add-client:active {
    transform: translateY(0);
    filter: brightness(.96);
  }

  /* ══ Bug FAB ══════════════════════════════════════════════════════════════ */
  .bug-fab {
    position: fixed;
    bottom: 28px;
    left: 28px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 0;
    background: none;
    border: none;
    cursor: pointer;
    z-index: 8000;
    outline: none;
  }

  /* pulsing outer ring */
  .bug-fab__ring {
    position: absolute;
    inset: -6px;
    border-radius: 50%;
    border: 1.5px solid rgba(99, 102, 241, 0.45);
    pointer-events: none;
    animation: fab-pulse 2.8s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  }

  @keyframes fab-pulse {
    0%, 100% { opacity: 0.5; transform: scale(1);    }
    50%       { opacity: 0;   transform: scale(1.35); }
  }

  /* main circle */
  .bug-fab__inner {
    width: 50px;
    height: 50px;
    border-radius: 50%;
    background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
    border: 1px solid rgba(99, 102, 241, 0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    color: rgba(148, 163, 184, 0.85);
    box-shadow:
      0 4px 24px rgba(0, 0, 0, 0.5),
      0 0 0 1px rgba(255,255,255,0.04),
      inset 0 1px 0 rgba(255,255,255,0.06);
    transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
    position: relative;
  }
  .bug-fab__inner::after {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: 50%;
    background: radial-gradient(circle at 35% 35%, rgba(255,255,255,0.12), transparent 60%);
    pointer-events: none;
  }

  /* label below the circle */
  .bug-fab__label {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: rgba(100, 116, 139, 0.55);
    transition: color 0.2s;
    line-height: 1;
    pointer-events: none;
  }

  /* hover state */
  .bug-fab:hover .bug-fab__inner {
    background: linear-gradient(135deg, rgba(2,181,187,0.9) 0%, rgba(10,138,142,0.95) 100%);
    border-color: rgba(99, 102, 241, 0.8);
    color: #fff;
    transform: scale(1.1) translateY(-2px);
    box-shadow:
      0 8px 32px rgba(99, 102, 241, 0.45),
      0 0 0 1px rgba(2,181,187,0.25),
      inset 0 1px 0 rgba(255,255,255,0.15);
  }
  .bug-fab:hover .bug-fab__ring {
    animation: none;
    border-color: rgba(99, 102, 241, 0.7);
    opacity: 1;
    transform: scale(1.15);
  }
  .bug-fab:hover .bug-fab__label {
    color: rgba(165, 180, 252, 0.9);
  }

  /* active / press */
  .bug-fab:active .bug-fab__inner {
    transform: scale(0.96) translateY(0);
    box-shadow: 0 2px 12px rgba(99, 102, 241, 0.3);
  }
</style>
