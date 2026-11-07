<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import { get } from 'svelte/store';
  import {
    fetchQuote,
    createQuote,
    updateQuote,
    getApiUrl,
    authToken,
    authEmail,
    submitQuoteForApproval,
    approveQuote,
    requestQuoteChanges,
    addQuoteComment,
    resolveQuoteComment,
    sendQuoteToClient,
    // Dynamic permission store — falls back to static QUOTE_APPROVERS list
    // when Firestore hasn't been loaded yet (zero regression).
    canApproveQuotes,
    liveActionPermissions,
    fetchLiveActionPermissions,
    QUOTE_STATUS_LABEL,
    // ── Signed service agreement (generated when the client accepts) ──
    downloadContractPdf,
    // ── Margin & insights ──
    extractInsights,
    selectedClient,
    PACKING_TIER_LABEL,
    // ── Line-item templates (pricing presets) ──
    fetchQuoteLineTemplates,
    parseQuoteLineTemplateLine,
    createQuoteLineTemplate,
    updateQuoteLineTemplate,
    deleteQuoteLineTemplate,
    // ── Custom service types (merged on top of built-in packing tiers) ──
    fetchServiceTypes,
    createServiceType,
    updateServiceType,
    deleteServiceType,
    // ── Phase B — agnostic quote-line group labels ──
    fetchQuoteLabels,
    createQuoteLabel,
    updateQuoteLabel,
    deleteQuoteLabel,
    // ── Phase D — AI-generated client description ──
    generateQuoteClientDescription,
  } from '../store.ts';
  import type { Quote, QuoteLineItem, QuoteLineTemplate, ServiceType, QuoteLabel } from '../store.ts';

  import StarRating from './StarRating.svelte';

  import { aggregateByCurrency } from '$lib/money.ts';
  import { optionCount, optionsLabel } from '$lib/quoteValue.ts';
  import { browser } from '$app/environment';

  export let clientId: string;
  export let quoteId: string | null = null;

  const dispatch = createEventDispatcher<{ saved: void; cancelled: void }>();

  // ── Form state ─────────────────────────────────────────────────────────────
  let title = '';
  let notes = '';
  // ── Line-item GROUPS (Phase 5) — the editable source of truth ──────────────
  // Each group bundles line items under a title + a selection `role`. Staff add
  // one group per applied template and flip each between Required (one is chosen
  // on the status page) and Optional (an add-on the client can tick). The flat
  // `lineItems` array below is DERIVED from the groups and feeds every existing
  // finance reactive + the save payload unchanged.
  type EditGroup = {
    groupId: string;
    title: string;
    /** Phase B — optional reference to a reusable QuoteLabel (title mirrors it). */
    labelId?: string | null;
    /**
     *   'required' → a package the client picks between (radio on status page)
     *   'optional' → an add-on the client can tick/untick (checkbox)
     *   'fixed'    → always billed, never shown as a choice (a base price the
     *                client always pays regardless of what they select)
     */
    role: 'required' | 'optional' | 'fixed';
    /** Client-visible description for this group (shown under its title on the
     *  status page). Prefilled from the applied template's `description`. */
    description: string;
    lineItems: QuoteLineItem[];
  };


  let lineGroups: EditGroup[] = [];
  let lineItems: QuoteLineItem[] = [];
  $: lineItems = lineGroups.flatMap(g => g.lineItems);

  let providerIds: string[] = [];
  let providerSnapshots: Quote['providerSnapshots'] = [];

  // ── Per-line provider attach (backward compatible) ──────────────────────────
  // Providers are attached to INDIVIDUAL quote lines via `li.providerId`. We keep
  // a shared typeahead (one popover open at a time, tracked by activeProviderLineId)
  // and derive the quote-level providerIds/providerSnapshots union from the lines
  // on save. Legacy quotes with quote-level providers but no per-line ids keep them.
  let providerSearchQuery = '';
  let providerSearchResults: Array<{ id: string; name: string; country: string; modality: string; serviceCategory: string; score: number | null }> = [];
  let providerSearchLoading = false;
  let providerDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  // Which line's provider search popover is currently open (null = none).
  let activeProviderLineId: string | null = null;
  // id → snapshot, derived from providerSnapshots so each row can render its provider.
  $: providerById = Object.fromEntries((providerSnapshots ?? []).map((s) => [s.id, s])) as Record<string, { id: string; name: string; country: string; modality: string; serviceCategory: string }>;
  // Union of providers actually referenced by lines — used to keep the quote-level
  // providerIds/providerSnapshots consistent on save (legacy fallback below).
  $: usedProviderIds = Array.from(new Set(lineItems.map((li) => li.providerId).filter(Boolean))) as string[];
  $: usedProviderSnapshots = (providerSnapshots ?? []).filter((s) => usedProviderIds.includes(s.id));


  // ── UI state ───────────────────────────────────────────────────────────────
  let saving = false;
  let loadingQuote = false;
  let errorMsg = '';

  // ── Margin & project config ────────────────────────────────────────────────
  let serviceType = '';
  let serviceTypeError = false;
  let serviceTypeEl: HTMLSelectElement | null = null;
  let refreshingInsights = false;
  let insightsHint = '';
  let defaultMarginPct = 20;
  let clientDescription = '';
  // ── Payment schedule (ordered percent segments, e.g. [35, 65]) ────────────
  // The FIRST segment is the reservation / initial payment. Add/remove segments
  // inline; the running sum is capped at 100% (over-100 is blocked on save AND
  // server-side). Snapshotted into the signed contract + client email.
  let paymentSchedule: number[] = [35, 65];
  $: scheduleSum = paymentSchedule.reduce((s, p) => s + (Number(p) || 0), 0);
  $: scheduleOver = scheduleSum > 100.001;

  function addScheduleSegment() {
    paymentSchedule = [...paymentSchedule, 0];
  }
  function removeScheduleSegment(i: number) {
    if (paymentSchedule.length <= 1) return;
    paymentSchedule = paymentSchedule.filter((_, idx) => idx !== i);
  }

  // ── Custom service types (dashboard-managed extras) ─────────────────────────
  // Merged ON TOP of the built-in PACKING_TIER_LABEL entries so operators can
  // add bespoke service types (e.g. "Storage only") without a code change. A
  // quote persists `serviceType` as an opaque key — a built-in PackingTier key
  // OR a custom serviceTypeId — so existing quotes are unaffected.
  let customServiceTypes: ServiceType[] = [];
  let serviceTypesLoading = false;


  // ── Smart default title (NEW quotes only) ──────────────────────────────────
  // Compose a human-readable default title from what the CRM/AI already knows
  // about the move: "{Client} · {Service}". Only the pieces that are actually
  // known are included — nothing is invented, so if a piece can't be inferred
  // it's simply omitted (an empty suggestion falls back to the "Initial Quote"
  // placeholder). The service type is the AI-detected packingTier, so the
  // suggestion sharpens once insights resolve.

  let titleTouched = false; // flips true the moment the agent edits the field

  function buildSuggestedTitle(
    client: any,
    svcKey: string,
    labelMap: Record<string, { icon: string; label: string }>,
  ): string {
    if (!client) return '';
    const clean = (v: unknown) => String(v ?? '').trim();
    const name = [client.name, client.surname].map(clean).filter(Boolean).join(' ');
    const service = svcKey ? clean(labelMap[svcKey]?.label) : '';

    return [name, service].map(clean).filter(Boolean).join(' · ');
  }


  // ── Merged service-type option list ────────────────────────────────────────
  // Built-in packing tiers (always available) + dashboard-managed custom types.
  // Both the <select> and the smart-title builder read from the SAME derived
  // list + lookup map, so a custom type shows everywhere the moment it's added.
  $: builtinServiceOptions = Object.entries(PACKING_TIER_LABEL).map(
    ([key, meta]) => ({ key, icon: meta.icon, label: meta.label, builtin: true }),
  );
  $: customServiceOptions = customServiceTypes.map((s) => ({
    key: s.serviceTypeId,
    icon: s.icon || '🧩',
    label: s.label,
    builtin: false,
  }));
  $: serviceTypeOptions = [...builtinServiceOptions, ...customServiceOptions];
  $: serviceLabelMap = Object.fromEntries(
    serviceTypeOptions.map((o) => [o.key, { icon: o.icon, label: o.label }]),
  ) as Record<string, { icon: string; label: string }>;

  // Reactive suggestion — recomputes as the selected client or detected service
  // type changes. Drives both the prefilled value (new quotes) and the placeholder.
  $: suggestedTitle = buildSuggestedTitle($selectedClient, serviceType, serviceLabelMap);


  // Keep a NEW quote's title synced to the smart suggestion until the agent
  // types their own. Never clobbers an existing quote (quoteId set) or a title
  // the agent has already edited (titleTouched). Does not read `title`, so this
  // assignment can never loop.
  $: if (!quoteId && !titleTouched) {
    title = suggestedTitle;
  }


  // ── Approval workflow state ────────────────────────────────────────────────
  let quote: Quote | null = null;
  let noteToApprovers = '';
  let sentLink = '';
  let newCommentText = '';
  let showChangesRequest = false;
  let changesComment = '';
  // Alias error to errorMsg for approval handlers
  $: error = errorMsg;

  // ── Approve-with-edits guard ────────────────────────────────────────────────
  // True when the in-editor form differs from the clean server `baseline` (the
  // last-fetched/saved quote). Drives the "Approve without your edits?" modal so
  // an approver never silently loses edits by clicking the plain Approve button.
  // IMPORTANT: inline the field references here (rather than calling draftCore())
  // so Svelte's reactivity actually tracks title/lineGroups/notes/etc. A `$:` that
  // only *calls* a function never re-runs when the values inside that function
  // change — which previously left `hasUnsavedEdits` stuck at false, so editing
  // the line-item table never surfaced the "Approve with edits" button/modal.
  $: draftSnapshot = JSON.stringify({ title, notes, serviceType, defaultMarginPct, clientDescription, lineGroups, providerSnapshots });
  $: hasUnsavedEdits = !hydrating && draftSnapshot !== baseline;
  let showApproveEditsModal = false; // confirm dialog for approving with pending edits
  // Transient hint shown when an approver clicks "Approve with edits" but hasn't
  // actually changed anything. Cleared automatically the moment a real edit lands.
  let editNotice = '';
  $: if (hasUnsavedEdits) editNotice = '';



  // ── Margin math ────────────────────────────────────────────────────────────
  function lineClientPrice(li: QuoteLineItem): number {
    const cost = Number(li.amount) || 0;
    // Flat mode: clientPrice = cost + marginFlat
    if (li.marginMode === 'flat') {
      return Math.round((cost + (Number(li.marginFlat) || 0)) * 100) / 100;
    }
    // Percentage mode (default): clientPrice = cost × (1 + marginPct/100)
    const m = typeof li.marginPct === 'number' ? li.marginPct : 20;
    return Math.round(cost * (1 + m / 100) * 100) / 100;
  }
  $: costSubtotal = lineItems.reduce((s, li) => s + (Number(li.amount) || 0), 0);
  $: clientTotal  = lineItems.reduce((s, li) => s + lineClientPrice(li), 0);
  $: earnings     = Math.round((clientTotal - costSubtotal) * 100) / 100;
  $: total        = clientTotal; // total = client-facing number (used in payload)
  // A quote offering choices (several packages and/or add-ons) has no single
  // total: the sum above is every option added together. The footer then shows
  // each option's own figures instead.
  $: choices = optionCount({ lineGroups });
  $: fixedCost  = lineGroups.filter((g) => g.role === 'fixed').reduce((s, g) => s + groupCost(g), 0);
  $: fixedPrice = lineGroups.filter((g) => g.role === 'fixed').reduce((s, g) => s + groupClientTotal(g), 0);
  // Per-currency buckets kept for the currency selector in handleSave
  $: totalBuckets = aggregateByCurrency(lineItems, null);

  // ── Group + line helpers ────────────────────────────────────────────────────
  function makeLineId(): string {
    return 'li_' + Math.random().toString(36).slice(2, 10);
  }
  function makeGroupId(): string {
    return 'grp_' + Math.random().toString(36).slice(2, 10);
  }
  function makeBlankLine(currency = 'USD'): QuoteLineItem {
    return { lineId: makeLineId(), label: '', amount: 0, marginPct: defaultMarginPct, marginMode: 'pct' as const, marginFlat: null, currency, providerId: null, notes: null };
  }
  function makeBlankGroup(role: 'required' | 'optional' = 'optional', title = ''): EditGroup {
    return { groupId: makeGroupId(), title, labelId: null, role, description: '', lineItems: [makeBlankLine()] };
  }

  function updateGroupDescription(groupId: string, value: string) {
    lineGroups = lineGroups.map(g => g.groupId === groupId ? { ...g, description: value } : g);
  }

  /** Guarantee at least one group (with one line) always exists. */
  function ensureGroups() {
    if (lineGroups.length === 0) lineGroups = [makeBlankGroup('optional')];
  }

  function addGroup(role: 'required' | 'optional' = 'optional') {
    lineGroups = [...lineGroups, makeBlankGroup(role)];
  }
  function removeGroup(groupId: string) {
    lineGroups = lineGroups.filter(g => g.groupId !== groupId);
    ensureGroups();
  }
  function setGroupRole(groupId: string, role: 'required' | 'optional' | 'fixed') {
    lineGroups = lineGroups.map(g => g.groupId === groupId ? { ...g, role } : g);
  }

  function updateGroupTitle(groupId: string, value: string) {
    lineGroups = lineGroups.map(g => g.groupId === groupId ? { ...g, title: value } : g);
  }

  function addLine(groupId: string) {
    lineGroups = lineGroups.map(g => g.groupId === groupId
      ? { ...g, lineItems: [...g.lineItems, makeBlankLine(g.lineItems[0]?.currency || 'USD')] }
      : g);
  }
  function removeLine(groupId: string, lineId: string) {
    lineGroups = lineGroups.map(g => g.groupId === groupId
      ? { ...g, lineItems: g.lineItems.filter(li => li.lineId !== lineId) }
      : g);
  }
  function updateLine(groupId: string, lineId: string, field: keyof QuoteLineItem, value: any) {
    lineGroups = lineGroups.map(g => g.groupId === groupId
      ? { ...g, lineItems: g.lineItems.map(li => li.lineId === lineId ? { ...li, [field]: value } : li) }
      : g);
  }
  /** Per-group internal cost (what IRP pays) — sum of line amounts. */
  function groupCost(g: EditGroup): number {
    return Math.round(g.lineItems.reduce((s, li) => s + (Number(li.amount) || 0), 0) * 100) / 100;
  }
  /** Per-group client price (cost + margin) shown in the group header. */
  function groupClientTotal(g: EditGroup): number {
    return Math.round(g.lineItems.reduce((s, li) => s + lineClientPrice(li), 0) * 100) / 100;
  }
  /** Per-group margin only (client price − cost). */
  function groupMargin(g: EditGroup): number {
    return Math.round((groupClientTotal(g) - groupCost(g)) * 100) / 100;
  }

  // ── Phase B — agnostic quote-line group LABELS ──────────────────────────────
  // Reusable, fully generic labels (e.g. "Origin services", "Insurance") that an
  // operator attaches to a group. Choosing one mirrors the label's name into the
  // group `title` so the client-facing status page keeps working unchanged.
  let customLabels: QuoteLabel[] = [];
  let labelsLoading = false;
  $: labelById = Object.fromEntries((customLabels ?? []).map((l) => [l.labelId, l])) as Record<string, QuoteLabel>;

  async function loadQuoteLabels() {
    labelsLoading = true;
    try {
      customLabels = await fetchQuoteLabels();
    } catch {
      customLabels = []; // non-fatal — the group label chooser simply shows none
    } finally {
      labelsLoading = false;
      syncLabelEdits();
    }
  }

  /** Choose a label for a group. Mirrors the label's name into `title` (fallback). */
  function setGroupLabel(groupId: string, labelId: string) {
    const lbl = labelById[labelId];
    lineGroups = lineGroups.map(g => g.groupId === groupId
      ? { ...g, labelId: labelId || null, title: lbl ? lbl.label : g.title }
      : g);
  }

  // ── Label manager (modal) — mirrors the service-type manager ────────────────
  let labelManageOpen = false;
  let labelSaving = false;
  let labelError = '';
  let newLabelName = '';
  let newLabelIcon = '';
  let labelEdits: Array<{ labelId: string; label: string; icon: string }> = [];

  function syncLabelEdits() {
    labelEdits = customLabels.map((l) => ({ labelId: l.labelId, label: l.label, icon: l.icon || '' }));
  }
  function openLabelManager() {
    labelError = '';
    newLabelName = '';
    newLabelIcon = '';
    syncLabelEdits();
    labelManageOpen = true;
  }
  async function addLabel() {
    const label = newLabelName.trim();
    if (!label) { labelError = 'Enter a name for the new label.'; return; }
    labelSaving = true; labelError = '';
    try {
      await createQuoteLabel({ label, icon: newLabelIcon.trim() || undefined });
      newLabelName = ''; newLabelIcon = '';
      await loadQuoteLabels();
    } catch (err: any) {
      labelError = 'Error adding label: ' + (err?.message ?? err);
    } finally { labelSaving = false; }
  }
  async function saveLabel(row: { labelId: string; label: string; icon: string }) {
    const label = row.label.trim();
    if (!label) { labelError = 'Name cannot be empty.'; return; }
    labelSaving = true; labelError = '';
    try {
      await updateQuoteLabel(row.labelId, { label, icon: row.icon.trim() });
      // Keep any groups already using this label in sync with the renamed value.
      lineGroups = lineGroups.map(g => g.labelId === row.labelId ? { ...g, title: label } : g);
      await loadQuoteLabels();
    } catch (err: any) {
      labelError = 'Error saving label: ' + (err?.message ?? err);
    } finally { labelSaving = false; }
  }
  async function removeLabel(row: { labelId: string; label: string }) {
    if (!confirm(`Delete the "${row.label}" label? Groups already using it keep their title.`)) return;
    labelSaving = true; labelError = '';
    try {
      await deleteQuoteLabel(row.labelId);
      // Detach from any groups (their free-text title remains as the fallback).
      lineGroups = lineGroups.map(g => g.labelId === row.labelId ? { ...g, labelId: null } : g);
      await loadQuoteLabels();
    } catch (err: any) {
      labelError = 'Error deleting label: ' + (err?.message ?? err);
    } finally { labelSaving = false; }
  }

  // ── Phase B — drag & drop line rows between groups ──────────────────────────
  let dragLine: { groupId: string; lineId: string } | null = null;
  let dragOverGroupId: string | null = null;

  function onLineDragStart(groupId: string, lineId: string, e: DragEvent) {
    dragLine = { groupId, lineId };
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      try { e.dataTransfer.setData('text/plain', lineId); } catch { /* some browsers restrict */ }
    }
  }
  function onLineDragEnd() {
    dragLine = null;
    dragOverGroupId = null;
  }
  function onGroupDragOver(groupId: string, e: DragEvent) {
    if (!dragLine) return;
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
    dragOverGroupId = groupId;
  }
  function onGroupDragLeave(groupId: string) {
    if (dragOverGroupId === groupId) dragOverGroupId = null;
  }
  function onGroupDrop(targetGroupId: string, e: DragEvent) {
    e.preventDefault();
    const src = dragLine;
    dragOverGroupId = null;
    dragLine = null;
    if (!src || src.groupId === targetGroupId) return;
    const srcGroup = lineGroups.find(g => g.groupId === src.groupId);
    const moved = srcGroup?.lineItems.find(li => li.lineId === src.lineId);
    if (!moved) return;
    lineGroups = lineGroups.map(g => {
      if (g.groupId === src.groupId) return { ...g, lineItems: g.lineItems.filter(li => li.lineId !== src.lineId) };
      if (g.groupId === targetGroupId) return { ...g, lineItems: [...g.lineItems, moved] };
      return g;
    });
  }

  // ── Phase D — AI-generated client description ───────────────────────────────
  let descGenerating = false;
  let descError = '';
  async function generateClientDescriptionAI() {
    if (!quoteId) { descError = 'Save the quote once before generating a description.'; return; }
    descGenerating = true; descError = '';
    try {
      const { clientDescription: text } = await generateQuoteClientDescription(clientId, quoteId);
      if (text) clientDescription = text;
    } catch (err: any) {
      descError = 'Could not generate a description: ' + (err?.message ?? err);
    } finally {
      descGenerating = false;
    }
  }

  // ── Draft persistence (localStorage) — survives tab switches / reloads ───────
  // Keyed per client + quote so drafts never cross-contaminate. We only persist
  // once the editor state DIFFERS from the freshly-loaded baseline (so an
  // untouched quote never leaves a stray draft), and clear it on save / cancel.
  $: draftKey = `irp:quote-draft:${clientId}:${quoteId ?? 'new'}`;
  let hydrating = true;        // suppresses autosave while we load + restore
  let draftRestored = false;   // drives the "Unsaved draft restored" banner
  let baseline = '';           // serialized clean state (post-load, pre-draft)
  let draftSaveTimer: ReturnType<typeof setTimeout> | null = null;

  function draftCore(): string {
    return JSON.stringify({ title, notes, serviceType, defaultMarginPct, clientDescription, lineGroups, providerSnapshots, paymentSchedule });
  }
  function draftPayload() {
    return { v: 1, savedAt: new Date().toISOString(), title, notes, serviceType, defaultMarginPct, clientDescription, lineGroups, providerSnapshots, paymentSchedule, titleTouched };
  }
  function saveDraftNow() {
    if (!browser || hydrating) return;
    try {
      // Untouched (matches the clean baseline) → never leave a stray draft.
      if (draftCore() === baseline) { localStorage.removeItem(draftKey); return; }
      localStorage.setItem(draftKey, JSON.stringify(draftPayload()));
    } catch { /* storage full / unavailable — non-fatal */ }
  }
  function scheduleDraftSave() {
    if (draftSaveTimer) clearTimeout(draftSaveTimer);
    draftSaveTimer = setTimeout(saveDraftNow, 400);
  }
  function clearDraft() {
    try { if (browser) localStorage.removeItem(draftKey); } catch { /* ignore */ }
    draftRestored = false;
  }
  function hydrateFromDraft() {
    if (!browser) return;
    let d: any = null;
    try { const raw = localStorage.getItem(draftKey); d = raw ? JSON.parse(raw) : null; } catch { d = null; }
    if (!d || d.v !== 1) return;
    // For an existing quote, only restore a draft NEWER than the server copy —
    // never clobber a quote another session already saved.
    if (quoteId) {
      const serverUpdated = quote?.updatedAt ? new Date(quote.updatedAt).getTime() : 0;
      const draftSaved = d.savedAt ? new Date(d.savedAt).getTime() : 0;
      if (draftSaved <= serverUpdated) { clearDraft(); return; }
    }
    if (typeof d.title === 'string') title = d.title;
    if (typeof d.notes === 'string') notes = d.notes;
    if (typeof d.serviceType === 'string') serviceType = d.serviceType;
    if (typeof d.defaultMarginPct === 'number') defaultMarginPct = d.defaultMarginPct;
    if (typeof d.clientDescription === 'string') clientDescription = d.clientDescription;
    if (Array.isArray(d.paymentSchedule)) {
      paymentSchedule = d.paymentSchedule.map((p: any) => Number(p) || 0);
    }
    if (Array.isArray(d.lineGroups) && d.lineGroups.length > 0) {
      lineGroups = d.lineGroups.map((g: any) => ({
        groupId: g.groupId || makeGroupId(),
        title: g.title ?? '',
        labelId: typeof g.labelId === 'string' ? g.labelId : null,
        role: g.role === 'optional' ? 'optional' as const : g.role === 'fixed' ? 'fixed' as const : 'required' as const,
        description: typeof g.description === 'string' ? g.description : '',
        lineItems: (Array.isArray(g.lineItems) ? g.lineItems : []).map(normalizeLine),
      }));
      ensureGroups();

    }

    if (Array.isArray(d.providerSnapshots)) providerSnapshots = d.providerSnapshots;
    if (d.titleTouched) titleTouched = true;
    draftRestored = true;
  }
  /** Throw away the restored draft and reload the clean server/new baseline. */
  function discardDraft() {
    clearDraft();
    hydrating = true;
    loadQuote().then(() => { baseline = draftCore(); hydrating = false; });
  }

  // Debounced autosave — fires on any edit once hydration is complete.
  $: draftDeps = [title, notes, serviceType, defaultMarginPct, clientDescription, lineGroups, providerSnapshots, paymentSchedule];
  $: if (browser && !hydrating && draftDeps) scheduleDraftSave();

  onDestroy(() => {
    if (draftSaveTimer) clearTimeout(draftSaveTimer);
    saveDraftNow(); // flush the latest state before unmount (e.g. tab switch)
  });



  // ── Line-item templates (pricing presets) ───────────────────────────────────
  let lineTemplates: QuoteLineTemplate[] = [];
  let lineTemplatesLoading = false;
  let selectedLineTemplateId = '';

  // Manage / edit panel state
  let manageOpen = false;
  let tmplEditingId: string | null = null; // null → creating a new template
  let tmplName = '';
  let tmplCurrency = 'USD';
  let tmplLinesText = '';
  // Client-visible service description saved with the template; prefills a
  // group's description when the template is applied as a group.
  let tmplDescription = '';
  let tmplSaving = false;
  let tmplError = '';


  // ── Service-type manager state (custom extras) ──────────────────────────────
  let svcManageOpen = false;
  let svcSaving = false;
  let svcError = '';
  let newSvcLabel = '';
  let newSvcIcon = '';
  // Editable working copies (label + icon) of each custom type, keyed by id.
  let svcEdits: Array<{ serviceTypeId: string; label: string; icon: string }> = [];

  async function loadLineTemplates() {

    lineTemplatesLoading = true;
    try {
      lineTemplates = await fetchQuoteLineTemplates();
    } catch {
      lineTemplates = []; // non-fatal — the selector simply shows no presets
    } finally {
      lineTemplatesLoading = false;
    }
  }

  /**
   * Add a saved line-item template as a NEW group. Every template added defaults
   * to an 'optional' add-on (a checkbox on the status page). Staff can flip any
   * group's role to 'required' or 'fixed' afterwards.
   */
  function addTemplateAsGroup(templateId: string) {
    const tmpl = lineTemplates.find(t => t.templateId === templateId);
    if (!tmpl) { selectedLineTemplateId = ''; return; }
    const cur = tmpl.currency || 'USD';
    // Treat a single still-blank starter group as "empty" so the first applied
    // template replaces it rather than leaving a stray empty group behind.
    const onlyBlankStarter =
      lineGroups.length === 1 &&
      lineGroups[0].lineItems.every(li => !String(li.label ?? '').trim() && !(Number(li.amount) > 0));
    const newGroup: EditGroup = {
      groupId: makeGroupId(),
      title: tmpl.name || 'Services',
      labelId: null,
      role: 'optional',
      // Prefill the client-visible description from the template so staff can
      // apply a group with its scope blurb already filled in (editable after).
      description: tmpl.description ?? '',
      lineItems: (tmpl.lines.length ? tmpl.lines : ['']).map(raw => {

        // A template line MAY carry an optional default price after the last
        // colon (e.g. "Origin Services:324234"). Parse it so seeded lines
        // pre-fill their amount; plain labels still come in at 0.
        const { label, amount } = parseQuoteLineTemplateLine(raw);
        return {
        lineId: makeLineId(),
        label,
        amount: amount ?? 0,
        marginPct: defaultMarginPct,
        marginMode: 'pct' as const,
        marginFlat: null,
        currency: cur,
        providerId: null,
        notes: null,
        };
      }),
    };
    lineGroups = onlyBlankStarter ? [newGroup] : [...lineGroups, newGroup];
    selectedLineTemplateId = ''; // reset so the same template can be re-applied
  }


  // ── Manage panel actions ─────────────────────────────────────────────────────
  function openCreateTemplate() {
    tmplEditingId = null;
    tmplName = '';
    tmplCurrency = 'USD';
    tmplLinesText = '';
    tmplDescription = '';
    tmplError = '';
    manageOpen = true;
  }

  function openEditTemplate(t: QuoteLineTemplate) {
    tmplEditingId = t.templateId;
    tmplName = t.name;
    tmplCurrency = t.currency || 'USD';
    tmplLinesText = (t.lines ?? []).join('\n');
    tmplDescription = t.description ?? '';
    tmplError = '';
    manageOpen = true;
  }

  /** Quick "save the lines I just built as a reusable template". */
  function seedTemplateFromCurrentLines() {
    tmplEditingId = null;
    tmplName = '';
    tmplCurrency = lineItems[0]?.currency || 'USD';
    tmplDescription = '';

    // Snapshot the current quote's lines. When a line already has a non-zero
    // amount, emit "Label:amount" so the template captures its default price;
    // otherwise just the label (kept backward-compatible with plain templates).
    tmplLinesText = lineItems
      .filter(li => String(li.label ?? '').trim())
      .map(li => {
        const label = String(li.label).trim();
        const amount = Number(li.amount);
        return Number.isFinite(amount) && amount > 0 ? `${label}:${amount}` : label;
      })
      .join('\n');
    tmplError = '';
    manageOpen = true;
  }

  async function saveTemplate() {
    const name = tmplName.trim();
    const lines = tmplLinesText.split('\n').map(l => l.trim()).filter(Boolean);
    if (!name) { tmplError = 'Template name is required.'; return; }
    if (lines.length === 0) { tmplError = 'Add at least one line.'; return; }
    tmplSaving = true;
    tmplError = '';
    try {
      const description = tmplDescription.trim() || null;
      if (tmplEditingId) {
        await updateQuoteLineTemplate(tmplEditingId, { name, currency: tmplCurrency, lines, description });
      } else {
        await createQuoteLineTemplate({ name, currency: tmplCurrency, lines, description });
      }

      await loadLineTemplates();
      manageOpen = false;
    } catch (err: any) {
      tmplError = 'Error saving template: ' + (err?.message ?? err);
    } finally {
      tmplSaving = false;
    }
  }

  async function removeTemplate(t: QuoteLineTemplate) {
    if (!confirm(`Delete the "${t.name}" template? This cannot be undone.`)) return;
    try {
      await deleteQuoteLineTemplate(t.templateId);
      if (tmplEditingId === t.templateId) openCreateTemplate();
      await loadLineTemplates();
    } catch (err: any) {
      tmplError = 'Error deleting template: ' + (err?.message ?? err);
    }
  }

  // ── Service-type manager actions ────────────────────────────────────────────
  async function loadServiceTypes() {
    serviceTypesLoading = true;
    try {
      customServiceTypes = await fetchServiceTypes();
    } catch {
      customServiceTypes = []; // non-fatal — only the built-in tiers show
    } finally {
      serviceTypesLoading = false;
      syncSvcEdits();
    }
  }

  /** Refresh the editable row copies from the loaded custom types. */
  function syncSvcEdits() {
    svcEdits = customServiceTypes.map((s) => ({
      serviceTypeId: s.serviceTypeId,
      label: s.label,
      icon: s.icon || '',
    }));
  }

  function openServiceTypeManager() {
    svcError = '';
    newSvcLabel = '';
    newSvcIcon = '';
    syncSvcEdits();
    svcManageOpen = true;
  }

  async function addServiceType() {
    const label = newSvcLabel.trim();
    if (!label) { svcError = 'Enter a name for the new service type.'; return; }
    svcSaving = true;
    svcError = '';
    try {
      await createServiceType({ label, icon: newSvcIcon.trim() || undefined });
      newSvcLabel = '';
      newSvcIcon = '';
      await loadServiceTypes();
    } catch (err: any) {
      svcError = 'Error adding service type: ' + (err?.message ?? err);
    } finally {
      svcSaving = false;
    }
  }

  async function saveServiceType(row: { serviceTypeId: string; label: string; icon: string }) {
    const label = row.label.trim();
    if (!label) { svcError = 'Name cannot be empty.'; return; }
    svcSaving = true;
    svcError = '';
    try {
      await updateServiceType(row.serviceTypeId, { label, icon: row.icon.trim() });
      await loadServiceTypes();
    } catch (err: any) {
      svcError = 'Error saving service type: ' + (err?.message ?? err);
    } finally {
      svcSaving = false;
    }
  }

  async function removeServiceType(row: { serviceTypeId: string; label: string }) {
    if (!confirm(`Delete the "${row.label}" service type? Quotes already using it keep their value.`)) return;
    svcSaving = true;
    svcError = '';
    try {
      await deleteServiceType(row.serviceTypeId);
      // If the currently-selected type was the one deleted, clear the field.
      if (serviceType === row.serviceTypeId) serviceType = '';
      await loadServiceTypes();
    } catch (err: any) {
      svcError = 'Error deleting service type: ' + (err?.message ?? err);
    } finally {
      svcSaving = false;
    }
  }



  // ── Load existing quote ────────────────────────────────────────────────────
  function normalizeLine(li: any): QuoteLineItem {
    return {
      lineId: li.lineId || makeLineId(),
      label: li.label ?? '',
      amount: typeof li.amount === 'number' ? li.amount : (parseFloat(li.amount) || 0),
      marginPct: typeof li.marginPct === 'number' ? li.marginPct : 20,
      marginMode: li.marginMode === 'flat' ? 'flat' as const : 'pct' as const,
      marginFlat: typeof li.marginFlat === 'number' ? li.marginFlat : null,
      currency: li.currency || 'USD',
      providerId: li.providerId ?? null,
      notes: li.notes ?? null,
    };
  }

  /**
   * Populate every editable field from a server quote object. Extracted from
   * loadQuote() so it can be reused to DISCARD an approver's in-memory edits
   * (Approve without edits) by re-hydrating from the freshly-fetched quote.
   */
  function hydrateEditableFromQuote(q: Quote) {
    title = q.title ?? '';
    notes = q.notes ?? '';
    serviceType = q.serviceType ?? '';
    defaultMarginPct = typeof q.defaultMarginPct === 'number' ? q.defaultMarginPct : 20;
    clientDescription = q.clientDescription ?? '';
    const savedSchedule = Array.isArray((q as any).paymentSchedule) ? (q as any).paymentSchedule : null;
    if (savedSchedule && savedSchedule.length > 0) {
      paymentSchedule = savedSchedule.map((p: any) => Number(p) || 0);
    } else {
      paymentSchedule = [35, 65];
    }
    const savedGroups = Array.isArray((q as any).lineGroups) ? (q as any).lineGroups : null;
    if (savedGroups && savedGroups.length > 0) {
      // Grouped quote — hydrate the groups directly.
      lineGroups = savedGroups.map((g: any) => ({
        groupId: g.groupId || makeGroupId(),
        title: g.title ?? '',
        labelId: typeof g.labelId === 'string' ? g.labelId : null,
        role: g.role === 'optional' ? 'optional' as const : g.role === 'fixed' ? 'fixed' as const : 'required' as const,
        description: typeof g.description === 'string' ? g.description : '',
        lineItems: (Array.isArray(g.lineItems) ? g.lineItems : []).map(normalizeLine),
      }));
    } else {

      // Legacy flat quote — wrap its line items in a single required group.
      const flat = (q.lineItems ?? []).map(normalizeLine);
      lineGroups = [{ groupId: makeGroupId(), title: '', labelId: null, role: 'required', description: '', lineItems: flat.length ? flat : [makeBlankLine()] }];
    }

    providerIds = [...(q.providerIds ?? [])];
    providerSnapshots = [...(q.providerSnapshots ?? [])];
    ensureGroups();
  }

  async function loadQuote() {
    if (!quoteId) {
      // New quote — start with one empty optional group (a checkbox on the
      // status page). Staff can flip it to Required or Fixed afterwards.
      quote = null;
      lineGroups = [makeBlankGroup('optional')];
      return;
    }
    loadingQuote = true;
    errorMsg = '';
    try {
      const q = await fetchQuote(clientId, quoteId);
      quote = q;
      hydrateEditableFromQuote(q);
    } catch (err: any) {

      errorMsg = 'Error loading quote: ' + (err?.message ?? err);
    } finally {
      loadingQuote = false;
    }
  }

  /**
   * Re-fetch the quote from the server AND resync the clean `baseline` snapshot
   * so `hasUnsavedEdits` reflects "changed since this server state". Used after
   * every approval-workflow action that mutates the quote server-side.
   */
  async function refreshQuoteFromServer() {
    if (!quoteId) return;
    quote = await fetchQuote(clientId, quoteId);
    hydrateEditableFromQuote(quote);
    baseline = draftCore();
  }


  // ── Service-type: auto-populate from transcriptInsights ─────────────────
  async function resolveServiceType() {
    if (serviceType) return; // already set from existing quote or explicit selection
    const insights = get(selectedClient)?.transcriptInsights;
    if (insights?.packingTier) {
      serviceType = insights.packingTier;
      return;
    }
    if (!insights) {
      // No insights yet — try on-demand extraction
      refreshingInsights = true;
      insightsHint = 'Detecting service type from call notes…';
      try {
        const result = await extractInsights(clientId);
        if (result?.packingTier) {
          serviceType = result.packingTier;
          insightsHint = '';
        } else {
          insightsHint = 'Could not auto-detect. Please select a service type manually.';
        }
      } catch {
        insightsHint = 'Detection unavailable. Please select a service type manually.';
      } finally {
        refreshingInsights = false;
      }
    } else {
      // Has insights but packingTier is null
      insightsHint = 'Service type not detected in notes. Please select manually.';
    }
  }

  onMount(async () => {
    await loadQuote();
    baseline = draftCore();   // capture the clean server/new state…
    hydrateFromDraft();       // …then restore any newer unsaved draft on top
    hydrating = false;        // enable autosave from here on
    resolveServiceType();
    loadLineTemplates(); // non-fatal; populates the template selector
    loadQuoteLabels();   // non-fatal; populates the group label chooser (Phase B)

    // Eagerly hydrate the live action-permissions store so canApproveQuotes
    // switches from the static fallback to the live Firestore map on first render.
    // Non-fatal: if the fetch fails, the static QUOTE_APPROVERS list is used.
    if ($liveActionPermissions === null) {
      try {
        const permissions = await fetchLiveActionPermissions();
        if (permissions !== null) liveActionPermissions.set(permissions);
      } catch { /* non-fatal — static fallback remains */ }
    }
  });

  // ── Provider search ────────────────────────────────────────────────────────
  function onProviderSearchInput() {
    if (providerDebounceTimer) clearTimeout(providerDebounceTimer);
    const q = providerSearchQuery.trim();
    if (!q) { providerSearchResults = []; return; }
    providerDebounceTimer = setTimeout(() => searchProviders(q), 300);
  }

  async function searchProviders(q: string) {
    providerSearchLoading = true;
    try {
      const token = get(authToken);
      // Fetch all providers; filter client-side so a missing ?search= param
      // doesn't silently return 0 results on the server.
      const url = `${getApiUrl()}/api/dashboard/providers`;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['x-dashboard-token'] = token;
      const res = await fetch(url, { headers });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const qLower = q.toLowerCase();
      providerSearchResults = (data.providers ?? data ?? [])
        .filter((p: any) => p.name?.toLowerCase().includes(qLower))
        .slice(0, 10)
        .map((p: any) => ({
          id: p.id,
          name: p.name ?? '',
          // Normalize to the flat fields QuoteEditor template expects
          country:         (p.originRegions?.[0] ?? p.destinationRegions?.[0] ?? ''),
          modality:        (p.shippingModalities?.[0] ?? ''),
          serviceCategory: (p.serviceCategories?.[0] ?? ''),
          score:           (typeof p.score === 'number' ? p.score : null),
        }));

    } catch (err: any) {
      providerSearchResults = [];
    } finally {
      providerSearchLoading = false;
    }
  }

  function openLineProviderSearch(lineId: string) {
    activeProviderLineId = activeProviderLineId === lineId ? null : lineId;
    providerSearchQuery = '';
    providerSearchResults = [];
  }

  function selectLineProvider(
    groupId: string,
    lineId: string,
    provider: { id: string; name: string; country: string; modality: string; serviceCategory: string },
  ) {
    updateLine(groupId, lineId, 'providerId', provider.id);
    if (!(providerSnapshots ?? []).some((s) => s.id === provider.id)) {
      providerSnapshots = [
        ...(providerSnapshots ?? []),
        {
          id: provider.id,
          name: provider.name,
          country: provider.country,
          modality: provider.modality,
          serviceCategory: provider.serviceCategory,
        },
      ];
    }
    activeProviderLineId = null;
    providerSearchQuery = '';
    providerSearchResults = [];
  }

  function clearLineProvider(groupId: string, lineId: string) {
    updateLine(groupId, lineId, 'providerId', null);
  }


  // ── Save ───────────────────────────────────────────────────────────────────
  /** Validate title + service type; sets errorMsg/serviceTypeError on failure. */
  function validateForSave(): boolean {
    if (!title.trim()) { errorMsg = 'Title is required.'; return false; }
    if (!serviceType) {
      serviceTypeError = true;
      errorMsg = 'Service type is required before saving this quote.';
      serviceTypeEl?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return false;
    }
    return true;
  }

  /**
   * Build the shared field payload from the current editor state. `status` is
   * intentionally OMITTED so callers control it: handleSave adds status:'draft',
   * while the approve-with-edits flow saves fields WITHOUT touching status.
   */
  function buildFieldsPayload(): Partial<Quote> {
    return {
      title: title.trim(),
      notes: notes.trim() || null,
      lineItems,
      // Phase 5 — grouped line items. The server derives the flat lineItems +
      // totals from these when present, so the two stay consistent.
      lineGroups: lineGroups.map(g => ({
        groupId: g.groupId,
        title: (g.title ?? '').trim(),
        labelId: g.labelId ?? null,
        role: g.role,
        description: (g.description ?? '').trim() || null,
        lineItems: g.lineItems,
      })) as any,

      // Provider union derived from per-line providerIds; legacy fallback keeps
      // any quote-level providers when no line has one attached (zero regression).
      providerIds: usedProviderIds.length ? usedProviderIds : providerIds,
      providerSnapshots: usedProviderIds.length ? usedProviderSnapshots : providerSnapshots,

      total: clientTotal,
      costSubtotal,
      earnings,
      serviceType,
      defaultMarginPct,
      clientDescription: clientDescription.trim() || null,
      paymentSchedule: paymentSchedule.map((p) => Number(p) || 0),
      currency: totalBuckets.length === 1 ? totalBuckets[0].currency : (totalBuckets[0]?.currency ?? 'USD'),
    };
  }

  async function handleSave() {
    if (!validateForSave()) return;
    saving = true;
    errorMsg = '';
    try {
      const payload: Partial<Quote> = { ...buildFieldsPayload(), status: 'draft' };
      if (quoteId) {
        await updateQuote(clientId, quoteId, payload);
      } else {
        await createQuote(clientId, payload);
      }
      clearDraft(); // persisted draft is now saved server-side
      dispatch('saved');
    } catch (err: any) {
      errorMsg = 'Error saving: ' + (err?.message ?? err);
    } finally {
      saving = false;
    }
  }

  /**
   * "Save & submit for approval" — one click from a fresh/draft quote straight
   * to pending_approval. Creates or updates the draft, then submits it, then
   * refreshes local state so the panel shows the pending-approval workflow
   * (instead of closing + forcing a reopen). Available for new/draft/
   * changes_requested quotes.
   */
  async function handleSaveAndSubmit() {
    if (!validateForSave()) return;
    saving = true;
    errorMsg = '';
    try {
      const payload: Partial<Quote> = { ...buildFieldsPayload(), status: 'draft' };
      let targetId = quoteId;
      if (targetId) {
        await updateQuote(clientId, targetId, payload);
      } else {
        const created = await createQuote(clientId, payload);
        targetId = created.quoteId;
        quoteId = created.quoteId; // reactive → editor now behaves as "existing"
      }
      await submitQuoteForApproval(clientId, targetId!, noteToApprovers);
      noteToApprovers = '';
      clearDraft();
      await refreshQuoteFromServer(); // reflect pending_approval + resync baseline
    } catch (err: any) {
      errorMsg = 'Error submitting for approval: ' + (err?.message ?? err);
    } finally {
      saving = false;
    }
  }


  async function handleSubmitForApproval() {
    if (!quote) return;
    saving = true;
    errorMsg = '';
    try {
      await submitQuoteForApproval(clientId, quote.quoteId, noteToApprovers);
      noteToApprovers = '';
      // Reload quote to reflect new status
      if (quoteId) quote = await fetchQuote(clientId, quoteId);
    } catch (e: any) {
      errorMsg = e.message ?? 'Error submitting for approval';
    } finally {
      saving = false;
    }
  }

  /**
   * Plain "Approve quote". If the approver has typed unsaved edits into the
   * form, DON'T silently discard them — open the confirm modal instead. With no
   * pending edits, approve immediately (unchanged legacy behaviour).
   */
  async function handleApprove() {
    if (!quote) return;
    if (hasUnsavedEdits) { showApproveEditsModal = true; return; }
    await doApprove(false);
  }

  /**
   * Approve as-submitted, DISCARDING the approver's in-memory edits. Re-hydrates
   * the form from the freshly-approved server quote so the UI reflects what was
   * actually approved (not the abandoned edits).
   */
  async function approveWithoutEdits() {
    showApproveEditsModal = false;
    await doApprove(false);
  }

  /**
   * Save the approver's edits FIRST (fields only — status untouched), then
   * approve with `withEdits: true` so the audit reads "Approved with edits".
   */
  async function handleApproveWithEdits() {
    if (!quote) return;
    // No changes yet → don't record a misleading "approved with edits" audit
    // entry. Tell the approver what to do instead of silently no-op'ing.
    if (!hasUnsavedEdits) {
      showApproveEditsModal = false;
      editNotice = 'No edits have been made yet — change a field first, or use “Approve quote” to approve it exactly as submitted.';
      return;
    }
    if (!validateForSave()) { showApproveEditsModal = false; return; }
    showApproveEditsModal = false;

    saving = true;
    errorMsg = '';
    try {
      // Persist the edited fields WITHOUT touching status (still pending_approval).
      await updateQuote(clientId, quote.quoteId, buildFieldsPayload());
      await approveQuote(clientId, quote.quoteId, { withEdits: true });
      clearDraft();
      await refreshQuoteFromServer();
    } catch (e: any) {
      errorMsg = e?.message ?? 'Error approving quote with edits';
    } finally {
      saving = false;
    }
  }

  /** Shared approve call. `withEdits` records "Approved with edits" server-side. */
  async function doApprove(withEdits: boolean) {
    if (!quote) return;
    saving = true;
    errorMsg = '';
    try {
      await approveQuote(clientId, quote.quoteId, { withEdits });
      // Re-hydrate from server (resets baseline → drops any discarded edits).
      await refreshQuoteFromServer();
    } catch (e: any) {
      errorMsg = e.message ?? 'Error approving quote';
    } finally {
      saving = false;
    }
  }


  async function handleRequestChanges() {
    if (!quote || !changesComment.trim()) return;
    saving = true;
    errorMsg = '';
    try {
      await requestQuoteChanges(clientId, quote.quoteId, changesComment);
      changesComment = '';
      showChangesRequest = false;
      if (quoteId) quote = await fetchQuote(clientId, quoteId);
    } catch (e: any) {
      errorMsg = e.message ?? 'Error requesting changes';
    } finally {
      saving = false;
    }
  }

  async function handleAddComment() {
    if (!quote || !newCommentText.trim()) return;
    saving = true;
    errorMsg = '';
    try {
      await addQuoteComment(clientId, quote.quoteId, newCommentText);
      newCommentText = '';
      if (quoteId) quote = await fetchQuote(clientId, quoteId);
    } catch (e: any) {
      errorMsg = e.message ?? 'Error adding comment';
    } finally {
      saving = false;
    }
  }

  async function handleResolveComment(commentId: string) {
    if (!quote) return;
    saving = true;
    errorMsg = '';
    try {
      await resolveQuoteComment(clientId, quote.quoteId, commentId);
      if (quoteId) quote = await fetchQuote(clientId, quoteId);
    } catch (e: any) {
      errorMsg = e.message ?? 'Error resolving comment';
    } finally {
      saving = false;
    }
  }

  // ── Signed service agreement ───────────────────────────────────────────────
  // Available once the client accepts. The server rebuilds the PDF from the
  // contract snapshot stored at acceptance, so this file is the same one the
  // client and the team were emailed.
  let downloadingContract = false;

  async function handleDownloadContract() {
    if (!quote) return;
    downloadingContract = true;
    errorMsg = '';
    try {
      await downloadContractPdf(clientId, quote.quoteId);
    } catch (err: any) {
      errorMsg = err?.message ?? 'Could not download the contract PDF.';
    } finally {
      downloadingContract = false;
    }
  }

  async function handleSendToClient() {
    if (!quote) return;
    saving = true;
    error = '';
    try {
      const result = await sendQuoteToClient(clientId, quote.quoteId);
      sentLink = result.statusPageUrl;
      if (quoteId) quote = await fetchQuote(clientId, quoteId);
    } catch (e: any) {
      error = e.message ?? 'Error sending to client';
    } finally {
      saving = false;
    }
  }

  function handleCancel() {
    clearDraft();
    dispatch('cancelled');
  }

  function formatTotal(n: number): string {
    return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' USD';
  }
</script>

<div class="quote-editor">
  <div class="quote-editor__header">
    <h3 class="quote-editor__title">{quoteId ? 'Edit Quote' : 'New Quote'}</h3>
  </div>

  {#if loadingQuote}
    <div class="quote-editor__loading">
      <div class="qe-spinner"></div>
      <span>Loading…</span>
    </div>
  {:else}
    <div class="quote-editor__body">

      {#if draftRestored}
        <div class="qe-draft-banner">
          <span class="qe-draft-banner__txt">✎ Unsaved draft restored</span>
          <button type="button" class="qe-draft-banner__discard" on:click={discardDraft}>Discard draft</button>
        </div>
      {/if}

      <!-- Title -->
      <!-- Smart default (new quotes): auto-composed from the client's move —
           "{Client} · {Service}" — using only the pieces we actually know.
           Shown as the prefilled value AND mirrored in the placeholder;
           freezes the instant the agent edits it. -->

      <div class="qe-field">
        <label class="qe-label" for="qe-title">Title <span class="qe-required">*</span></label>
        <input
          id="qe-title"
          class="qe-input"
          type="text"
          placeholder={suggestedTitle || 'Initial Quote'}
          bind:value={title}
          on:input={() => (titleTouched = true)}
        />
        {#if !quoteId && suggestedTitle}
          <p class="qe-field-hint">✦ Auto-composed from the client's move details — edit freely.</p>
        {/if}
      </div>


      <!-- Service type (required) — auto-populated from AI transcript insights -->
      <div class="qe-field" class:qe-field--error={serviceTypeError}>
        <div class="qe-label-row">
          <label class="qe-label qe-label--required" for="qe-service-type">
            Service type
            {#if refreshingInsights}<span class="qe-insights-spinner" title="Detecting from call notes…"></span>{/if}
          </label>
          <button
            type="button"
            class="qe-tmpl-manage-btn qe-svc-manage-btn"
            on:click={openServiceTypeManager}
            title="Add, rename or remove custom service types"
          >
            <span class="qe-tmpl-manage-gear" aria-hidden="true">⚙</span> Manage
          </button>
        </div>
        <select
          id="qe-service-type"
          class="qe-select"
          class:qe-select--error={serviceTypeError}
          bind:this={serviceTypeEl}
          bind:value={serviceType}
          on:change={() => { serviceTypeError = false; insightsHint = ''; }}
        >
          <option value="">— Select service type —</option>
          {#each serviceTypeOptions as opt (opt.key)}
            <option value={opt.key}>{opt.icon} {opt.label}</option>
          {/each}
        </select>

        {#if serviceTypeError}
          <p class="qe-field-error">⚠ Service type is required before saving this quote.</p>
        {:else if insightsHint}
          <p class="qe-field-hint">{refreshingInsights ? '⏳' : 'ℹ️'} {insightsHint}</p>
        {/if}
      </div>

      <!-- Default margin (applies to new lines; per-line override available in table) -->
      <div class="qe-field qe-field--inline">
        <label class="qe-label" for="qe-default-margin">Default margin %</label>
        <div class="qe-pct-wrap qe-pct-wrap--field">
          <input
            id="qe-default-margin"
            class="qe-input qe-input--num qe-input--pct"
            type="number"
            min="0"
            max="500"
            step="1"
            bind:value={defaultMarginPct}
          />
          <span class="qe-pct-sym">%</span>
        </div>
        <p class="qe-field-hint">Applied to all new lines. Each line can be adjusted individually in the table.</p>
      </div>

      <!-- Line items -->
      <div class="qe-field">
        <div class="qe-lines-head">
          <label class="qe-label">Quote line items</label>
          <div class="qe-tmpl-bar">
            <div class="qe-tmpl-select-wrap">
              <span class="qe-tmpl-spark" aria-hidden="true">✦</span>
              <select
                class="qe-tmpl-select"
                bind:value={selectedLineTemplateId}
                on:change={() => selectedLineTemplateId && addTemplateAsGroup(selectedLineTemplateId)}
                disabled={lineTemplatesLoading}
                title="Add a saved line-item template as a group"
              >
                <option value="">{lineTemplatesLoading ? 'Loading templates…' : '+ Add template as group…'}</option>

                {#each lineTemplates as t (t.templateId)}
                  <option value={t.templateId}>{t.name} · {t.lines.length} lines</option>
                {/each}
              </select>
            </div>
            <button
              type="button"
              class="qe-tmpl-manage-btn"
              on:click={openCreateTemplate}
              title="Create, edit or delete line-item templates"
            >
              <span class="qe-tmpl-manage-gear" aria-hidden="true">⚙</span> Manage
            </button>
          </div>
        </div>

        <p class="qe-groups-hint">
          Add one or more templates as groups, then mark each
          <strong>Required</strong> (the client picks one option) or
          <strong>Optional</strong> (an add-on the client can tick). A single
          Required group is auto-selected for the client.
        </p>

        {#each lineGroups as g, gi (g.groupId)}
          <div
            class="qe-group"
            class:qe-group--optional={g.role === 'optional'}
            class:qe-group--dropactive={dragOverGroupId === g.groupId}
            role="group"
            on:dragover={(e) => onGroupDragOver(g.groupId, e)}
            on:dragleave={() => onGroupDragLeave(g.groupId)}
            on:drop={(e) => onGroupDrop(g.groupId, e)}
          >
            <div class="qe-group__head">
              <div class="qe-group__labelwrap">
                <select
                  class="qe-select qe-select--sm qe-group__labelsel"
                  value={g.labelId ?? ''}
                  on:change={(e) => setGroupLabel(g.groupId, (e.target as HTMLSelectElement).value)}
                  title="Attach a reusable label to this group"
                >
                  <option value="">— No label —</option>
                  {#each customLabels as lbl (lbl.labelId)}
                    <option value={lbl.labelId}>{lbl.icon} {lbl.label}</option>
                  {/each}
                </select>
                <button type="button" class="qe-label-manage-btn" on:click={openLabelManager} title="Create, rename or delete labels" aria-label="Manage labels">⚙</button>
              </div>
              <input
                class="qe-input qe-input--sm qe-group__title"
                type="text"
                placeholder={`Group ${gi + 1} name (e.g. Standard package)`}
                value={g.title}
                on:input={(e) => updateGroupTitle(g.groupId, (e.target as HTMLInputElement).value)}
              />
              <div class="qe-role-toggle" role="group" aria-label="Group role">
                <button type="button" class="qe-role-btn" class:is-active={g.role === 'required'} on:click={() => setGroupRole(g.groupId, 'required')} title="Client picks one of these packages (radio)">Required</button>
                <button type="button" class="qe-role-btn qe-role-btn--opt" class:is-active={g.role === 'optional'} on:click={() => setGroupRole(g.groupId, 'optional')} title="An add-on the client can tick/untick (checkbox)">Optional</button>
                <button type="button" class="qe-role-btn qe-role-btn--fixed" class:is-active={g.role === 'fixed'} on:click={() => setGroupRole(g.groupId, 'fixed')} title="Always billed — never shown as a choice. Included in every quote regardless of what the client selects.">🔒 Fixed</button>
              </div>

              <div class="qe-group__nums" title="Cost · Client · Margin for this group">
                <span class="qe-gnum">
                  <span class="qe-gnum__lbl">Cost</span>
                  <span class="qe-gnum__val">{formatTotal(groupCost(g))}</span>
                </span>
                <span class="qe-gnum">
                  <span class="qe-gnum__lbl">Client</span>
                  <span class="qe-gnum__val qe-gnum__val--accent">{formatTotal(groupClientTotal(g))}</span>
                </span>
                <span class="qe-gnum">
                  <span class="qe-gnum__lbl">Margin</span>
                  <span class="qe-gnum__val qe-gnum__val--earn">{formatTotal(groupMargin(g))}</span>
                </span>
              </div>

              {#if lineGroups.length > 1}
                <button type="button" class="qe-group__del" title="Remove group" on:click={() => removeGroup(g.groupId)}>✕</button>
              {/if}
            </div>

            <!-- Client-visible service description for this group. Prefilled from
                 the applied template's description; shown under the option on the
                 status page. -->
            <div class="qe-group__desc">
              <label class="qe-group__desc-label" for={`qe-gdesc-${g.groupId}`}>
                Service description
                <span class="qe-label-badge">client-visible</span>
              </label>
              <textarea
                id={`qe-gdesc-${g.groupId}`}
                class="qe-textarea qe-group__desc-input"
                rows="2"
                placeholder="What this option includes — shown to the client under this option on the status page."
                value={g.description}
                on:input={(e) => updateGroupDescription(g.groupId, (e.target as HTMLTextAreaElement).value)}
              ></textarea>
            </div>

            {#if g.lineItems.length > 0}

              <div class="qe-lines-wrap">
                <table class="qe-lines-table">
                  <thead>
                    <tr>
                      <th class="qe-th-desc">Description</th>
                      <th class="qe-th-num">Cost</th>
                      <th class="qe-th-pct">Margin %</th>
                      <th class="qe-th-num qe-th-price">Client price</th>
                      <th class="qe-th-cur">Currency</th>
                      <th class="qe-th-prov">Provider</th>
                      <th class="qe-th-notes">Notes</th>

                      <th class="qe-th-del"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {#each g.lineItems as li (li.lineId)}
                      <tr>
                        <td>
                          <div class="qe-desc-cell">
                            <span
                              class="qe-drag-handle"
                              draggable="true"
                              role="button"
                              tabindex="-1"
                              title="Drag to move this line to another group"
                              aria-label="Drag line to another group"
                              on:dragstart={(e) => onLineDragStart(g.groupId, li.lineId, e)}
                              on:dragend={onLineDragEnd}
                            >⋮⋮</span>
                            <input
                              class="qe-input qe-input--sm"
                              type="text"
                              placeholder="Description"
                              value={li.label}
                              on:input={(e) => updateLine(g.groupId, li.lineId, 'label', (e.target as HTMLInputElement).value)}
                            />
                          </div>
                        </td>
                        <td>
                          <input
                            class="qe-input qe-input--sm qe-input--num"
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="0.00"
                            value={li.amount}
                            on:input={(e) => updateLine(g.groupId, li.lineId, 'amount', parseFloat((e.target as HTMLInputElement).value) || 0)}
                          />
                        </td>
                        <td class="qe-td-pct">
                          <div class="qe-margin-cell">
                            <!-- Mode toggle: % or flat currency -->
                            <button
                              type="button"
                              class="qe-margin-mode-btn"
                              class:qe-margin-mode-btn--pct={li.marginMode !== 'flat'}
                              title="{li.marginMode === 'flat' ? 'Flat amount — click to switch to %' : 'Percentage — click to switch to flat amount'}"
                              on:click={() => updateLine(g.groupId, li.lineId, 'marginMode', li.marginMode === 'flat' ? 'pct' : 'flat')}
                            >{li.marginMode === 'flat' ? (li.currency || '$') : '%'}</button>
                            {#if li.marginMode === 'flat'}
                              <input
                                class="qe-input qe-input--sm qe-input--num qe-input--margin"
                                type="number"
                                min="0"
                                step="0.01"
                                placeholder="0.00"
                                value={typeof li.marginFlat === 'number' ? li.marginFlat : 0}
                                on:input={(e) => updateLine(g.groupId, li.lineId, 'marginFlat', parseFloat((e.target as HTMLInputElement).value) || 0)}
                              />
                            {:else}
                              <input
                                class="qe-input qe-input--sm qe-input--num qe-input--margin"
                                type="number"
                                min="0"
                                max="500"
                                step="1"
                                placeholder="20"
                                value={typeof li.marginPct === 'number' ? li.marginPct : 20}
                                on:input={(e) => updateLine(g.groupId, li.lineId, 'marginPct', parseFloat((e.target as HTMLInputElement).value) || 0)}
                              />
                            {/if}
                          </div>
                        </td>
                        <td class="qe-td-price">
                          <span class="qe-computed-price">{lineClientPrice(li).toFixed(2)}</span>
                        </td>
                        <td>
                          <select
                            class="qe-select qe-select--sm"
                            value={li.currency}
                            on:change={(e) => updateLine(g.groupId, li.lineId, 'currency', (e.target as HTMLSelectElement).value)}
                          >
                            <option value="USD">USD</option>
                            <option value="EUR">EUR</option>
                            <option value="MXN">MXN</option>
                            <option value="CRC">CRC</option>
                          </select>
                        </td>
                        <td class="qe-td-prov">
                          {#if li.providerId && providerById[li.providerId]}
                            <span class="qe-prov-chip" title={providerById[li.providerId].name}>
                              <span class="qe-prov-chip__name">{providerById[li.providerId].name}</span>
                              <button type="button" class="qe-prov-chip__x" title="Detach provider" aria-label="Detach provider" on:click={() => clearLineProvider(g.groupId, li.lineId)}>✕</button>
                            </span>
                          {:else}
                            <button type="button" class="qe-prov-add" on:click={() => openLineProviderSearch(li.lineId)}>＋ Provider</button>
                          {/if}
                          {#if activeProviderLineId === li.lineId}
                            <div class="qe-prov-pop">
                              <input
                                class="qe-input qe-input--sm"
                                type="text"
                                placeholder="Search provider…"
                                bind:value={providerSearchQuery}
                                on:input={onProviderSearchInput}
                              />
                              {#if providerSearchLoading}<div class="qe-prov-pop__loading">Searching…</div>{/if}
                              {#if providerSearchResults.length > 0}
                                <div class="qe-prov-pop__results">
                                  {#each providerSearchResults as provider (provider.id)}
                                    <button type="button" class="qe-prov-opt" on:click={() => selectLineProvider(g.groupId, li.lineId, provider)}>
                                      <span class="qe-prov-opt__name">{provider.name}</span>
                                      <span class="qe-prov-opt__meta">
                                        {#if provider.serviceCategory}<span class="qe-provider-chip">{provider.serviceCategory}</span>{/if}
                                        {#if provider.modality}<span class="qe-provider-chip qe-provider-chip--muted">{provider.modality}</span>{/if}
                                        {#if provider.country}<span class="qe-provider-chip qe-provider-chip--muted">{provider.country}</span>{/if}
                                        <span class="qe-prov-opt__score"><StarRating value={provider.score} readonly size={12} /></span>
                                      </span>
                                    </button>
                                  {/each}
                                </div>
                              {/if}
                            </div>
                          {/if}
                        </td>
                        <td>
                          <input
                            class="qe-input qe-input--sm"
                            type="text"
                            placeholder="Optional note"

                            value={li.notes ?? ''}
                            on:input={(e) => updateLine(g.groupId, li.lineId, 'notes', (e.target as HTMLInputElement).value || null)}
                          />
                        </td>
                        <td>
                          <button
                            type="button"
                            class="qe-del-btn"
                            title="Remove line"
                            on:click={() => removeLine(g.groupId, li.lineId)}
                          >✕</button>
                        </td>
                      </tr>
                    {/each}
                  </tbody>
                </table>
              </div>
            {:else}
              <div class="qe-group__empty">
                <span class="qe-group__empty-icon" aria-hidden="true">⤵</span>
                <span class="qe-group__empty-text">Drag a line here, or add a new one</span>
              </div>
            {/if}
            <button type="button" class="qe-add-line-btn" on:click={() => addLine(g.groupId)}>
              + Add line
            </button>
          </div>
        {/each}

        <button type="button" class="qe-add-group-btn" on:click={() => addGroup('optional')}>
          ✚ Add optional add-on group
        </button>
      </div>

      <!-- Finance footer: internal Cost subtotal · Client total · Earnings.
           A quote offering options shows each option instead of their sum. -->
      {#if choices > 0}
        <div class="qe-options-footer">
          <p class="qe-options-footer__head">
            <strong>{optionsLabel(choices)}</strong>
            <span>The client picks; the total is set when they accept.</span>
          </p>
          <table class="qe-options-table">
            <thead>
              <tr><th scope="col">Option</th><th scope="col">Cost</th><th scope="col">Client price</th><th scope="col">Earnings</th></tr>
            </thead>
            <tbody>
              {#each lineGroups.filter((g) => g.role !== 'fixed') as g (g.groupId)}
                <tr>
                  <th scope="row">{g.title || 'Untitled option'} <span class="qe-options-table__kind">{g.role === 'optional' ? 'add-on' : 'package'}</span></th>
                  <td>{groupCost(g).toFixed(2)}</td>
                  <td class="qe-options-table__price">{g.role === 'optional' ? '+' : ''}{groupClientTotal(g).toFixed(2)}</td>
                  <td class="qe-options-table__earn">{groupMargin(g).toFixed(2)}</td>
                </tr>
              {/each}
              {#if fixedPrice > 0 || fixedCost > 0}
                <tr class="qe-options-table__fixed">
                  <th scope="row">Always included <span class="qe-options-table__kind">every option</span></th>
                  <td>{fixedCost.toFixed(2)}</td>
                  <td class="qe-options-table__price">+{fixedPrice.toFixed(2)}</td>
                  <td class="qe-options-table__earn">{(fixedPrice - fixedCost).toFixed(2)}</td>
                </tr>
              {/if}
            </tbody>
          </table>
        </div>
      {:else}
      <div class="qe-finance-footer">
        <div class="qe-finance-cell qe-finance-cell--cost">
          <span class="qe-finance-label">Cost subtotal</span>
          <span class="qe-finance-value">{costSubtotal.toFixed(2)}</span>
          <span class="qe-finance-hint">IRP pays</span>
        </div>
        <div class="qe-finance-sep"></div>
        <div class="qe-finance-cell qe-finance-cell--total">
          <span class="qe-finance-label">Client total</span>
          <span class="qe-finance-value qe-finance-value--accent">{clientTotal.toFixed(2)}</span>
          <span class="qe-finance-hint">Client pays</span>
        </div>
        <div class="qe-finance-sep"></div>
        <div class="qe-finance-cell qe-finance-cell--earn">
          <span class="qe-finance-label">Earnings</span>
          <span class="qe-finance-value qe-finance-value--earn">{earnings.toFixed(2)}</span>
          <span class="qe-finance-hint">IRP margin</span>
        </div>
      </div>
      {/if}

      <!-- Payment schedule — installment segments in percent of the agreed total.
           Defaults to 35/65; the first segment is the reservation payment. Add or
           remove segments inline. The sum is capped at 100%. Snapshotted into the
           signed contract PDF (the page finance reconciles against) and the client
           email. -->
      <div class="qe-field">
        <div class="qe-lines-head">
          <label class="qe-label" for="qe-schedule">Payment schedule</label>
          <span class="qe-label-badge">contract · finance</span>
        </div>

        <div class="qe-schedule">
          <div class="qe-schedule__rows">
            {#each paymentSchedule as pct, i (i)}
              <div class="qe-schedule__row">
                <span class="qe-schedule__idx">{i + 1}</span>
                <span class="qe-schedule__role">{i === 0 ? 'Reservation' : 'Installment'}</span>
                <div class="qe-pct-wrap">
                  <input
                    class="qe-input qe-input--sm qe-input--num qe-schedule__input"
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    value={pct}
                    on:input={(e) => {
                      paymentSchedule[i] = parseFloat((e.target as HTMLInputElement).value) || 0;
                      paymentSchedule = paymentSchedule;
                    }}
                  />
                  <span class="qe-pct-sym">%</span>
                </div>
                <span class="qe-schedule__amt">
                  {choices > 0 ? 'of the chosen option' : formatTotal((clientTotal * (Number(pct) || 0)) / 100)}
                </span>
                <button
                  type="button"
                  class="qe-schedule__del"
                  title="Remove segment"
                  aria-label="Remove segment"
                  disabled={paymentSchedule.length <= 1}
                  on:click={() => removeScheduleSegment(i)}
                >✕</button>
              </div>
            {/each}
          </div>

          <div class="qe-schedule__foot">
            <button type="button" class="qe-schedule__add" on:click={addScheduleSegment}>
              + Add segment
            </button>
            <span class="qe-schedule__sum" class:qe-schedule__sum--over={scheduleOver}>
              Total: {scheduleSum.toFixed(0)}%
            </span>
          </div>

          {#if scheduleOver}
            <p class="qe-field-error">⚠ Segments must total no more than 100%.</p>
          {:else}
            <p class="qe-field-hint">
              The first segment is the reservation. The split above is recorded in the signed
              contract and used by finance to reconcile payments.
            </p>
          {/if}
        </div>
      </div>

      <!-- Client description (broad summary shown to client; no cost/margin detail) -->

      <div class="qe-field">
        <label class="qe-label" for="qe-client-desc">
          Client description
          <span class="qe-label-badge">client-visible</span>
          <button
            type="button"
            class="qe-ai-desc-btn"
            on:click={generateClientDescriptionAI}
            disabled={descGenerating || !quoteId}
            title={quoteId ? 'Generate a client-facing description with AI from the quote scope' : 'Save the quote once to enable AI generation'}
          >
            {#if descGenerating}<span class="qe-ai-spin" aria-hidden="true"></span> Generating…{:else}✨ Generate with AI{/if}
          </button>
        </label>
        <textarea
          id="qe-client-desc"
          class="qe-textarea"
          placeholder="E.g. Full-service international relocation from Texas to Costa Rica — origin packing, ocean freight, customs clearance, and door-to-door delivery."
          rows="4"
          bind:value={clientDescription}
        ></textarea>
        {#if descError}<p class="qe-field-hint qe-field-hint--err">{descError}</p>{/if}
        <p class="qe-field-hint">Describe the scope shown to the client — or generate it with AI. Providers, costs, and margins are never shown.</p>
      </div>

      <!-- Notes -->
      <div class="qe-field">
        <label class="qe-label" for="qe-notes">Internal note</label>
        <textarea
          id="qe-notes"
          class="qe-textarea"
          placeholder="Internal note…"
          rows="3"
          bind:value={notes}
        ></textarea>
      </div>

      <!-- Error message -->
      {#if errorMsg}
        <div class="qe-error">{errorMsg}</div>
      {/if}

      <!-- Approval workflow section -->
      {#if quote}
        <div class="approval-section">
          <!-- Status banner -->
          <div class="status-banner status-{quote.status}">
            <strong>Status:</strong>
            {QUOTE_STATUS_LABEL[quote.status]?.label ?? quote.status}
            {#if quote.status === 'approved'}<span class="check">✓</span>{/if}
          </div>

          <!-- Signed service agreement — the proof-of-contract document a bank
               asks for. Generated and emailed at acceptance; downloadable here
               for any accepted quote, including ones accepted before this
               existed (the server rebuilds those from the quote). -->
          {#if quote.status === 'client_accepted' || quote.clientAcceptedAt}
            <div class="contract-section">
              <div class="contract-section__text">
                <strong>Service agreement</strong>
                <span class="contract-section__hint">
                  Signed by {quote.clientAcceptedBy || 'the client'}{quote.clientAcceptedAt
                    ? ` on ${new Date(quote.clientAcceptedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`
                    : ''}.
                </span>
              </div>
              <button
                class="btn-download-contract"
                on:click={handleDownloadContract}
                disabled={downloadingContract}
              >
                {downloadingContract ? 'Preparing…' : '📄 Download contract PDF'}
              </button>
            </div>
          {/if}

          <!-- Approver actions (only visible to approvers when pending_approval) -->
          <!-- canApproveQuotes: uses live Firestore data when loaded, falls back to static QUOTE_APPROVERS list -->
          {#if quote.status === 'pending_approval' && $authEmail && $canApproveQuotes}
            <div class="approver-actions">
              <p class="approver-hint">You're an approver — you can approve or request changes:</p>
              <div class="btn-row">
                <button class="btn-approve" on:click={handleApprove} disabled={saving}>
                  ✅ Approve quote
                </button>
                <!-- Always visible so approvers can find it. When there are no
                     edits yet, clicking it surfaces a friendly notice instead of
                     silently doing nothing (see handleApproveWithEdits). -->
                <button
                  class="btn-approve-edits"
                  class:is-dim={!hasUnsavedEdits}
                  on:click={handleApproveWithEdits}
                  disabled={saving}
                  title={hasUnsavedEdits ? 'Save your edits, then approve — recorded as “Approved with edits”' : 'Edit a field first — then this saves your edits and approves in one step'}
                >
                  ✍️ Approve with edits
                </button>
                <button class="btn-changes" on:click={() => showChangesRequest = true} disabled={saving}>
                  ✏️ Request changes
                </button>
              </div>
              {#if hasUnsavedEdits}
                <p class="approver-editnote">
                  ✎ You have unsaved edits. Use <strong>Approve with edits</strong> to save + approve them, or
                  <strong>Approve quote</strong> to approve the version as submitted (your edits will be dropped).
                </p>
              {:else if editNotice}
                <p class="approver-editnote approver-editnote--info">
                  ℹ️ {editNotice}
                </p>
              {/if}


              {#if showChangesRequest}
                <div class="changes-request-box">
                  <textarea bind:value={changesComment} placeholder="Describe what changes are needed..." rows="3"></textarea>
                  <div class="btn-row">
                    <button class="btn-changes" on:click={handleRequestChanges} disabled={!changesComment.trim() || saving}>
                      Submit change request
                    </button>
                    <button class="btn-cancel-small" on:click={() => { showChangesRequest = false; changesComment = ''; }}>
                      Cancel
                    </button>
                  </div>
                </div>
              {/if}
            </div>
          {/if}

          <!-- Submit for approval button (visible to all when draft or changes_requested) -->
          {#if quote.status === 'draft' || quote.status === 'changes_requested'}
            <div class="submit-approval-section">
              <label class="field-label">Note for approvers (optional)</label>
              <input type="text" bind:value={noteToApprovers} placeholder="E.g. Prices verified, ready for approval" />
              <button class="btn-submit-approval" on:click={handleSubmitForApproval} disabled={saving}>
                📨 Submit for approval
              </button>
            </div>
          {/if}

          <!-- Send to client (only when approved) -->
          {#if quote.status === 'approved' || quote.status === 'sent_to_client'}
            <div class="send-to-client-section">
              {#if quote.status === 'approved'}
                <button class="btn-send-client" on:click={handleSendToClient} disabled={saving}>
                  📤 Send quote to client
                </button>
              {:else if quote.status === 'sent_to_client'}
                <div class="sent-confirmation">
                  <span class="sent-badge">📨 Sent to client</span>
                  {#if quote.sentToClientAt}
                    <span class="sent-date">{new Date(quote.sentToClientAt).toLocaleString('es')}</span>
                  {/if}
                </div>
              {/if}
              {#if sentLink}
                <p class="sent-link-label">Client link:</p>
                <a href={sentLink} target="_blank" class="sent-link">{sentLink}</a>
              {/if}
            </div>
          {/if}

          <!-- Comments thread -->
          {#if Array.isArray(quote.comments) && quote.comments.length > 0}
            <div class="comments-section">
              <h4 class="section-title">Comments</h4>
              {#each quote.comments as comment (comment.commentId)}
                <div class="comment-item" class:resolved={comment.resolved}>
                  <div class="comment-header">
                    <strong>{comment.authorEmail}</strong>
                    <span class="comment-date">{new Date(comment.createdAt).toLocaleString('es')}</span>
                    {#if comment.resolved}
                      <span class="resolved-badge">Resolved ✓</span>
                    {:else}
                      <button class="resolve-btn" on:click={() => handleResolveComment(comment.commentId)}>
                        Mark as resolved
                      </button>
                    {/if}
                  </div>
                  <p class="comment-text">{comment.text}</p>
                </div>
              {/each}
            </div>
          {/if}

          <!-- Add comment -->
          <div class="add-comment-section">
            <input type="text" bind:value={newCommentText} placeholder="Add a comment..." on:keydown={e => e.key === 'Enter' && handleAddComment()} />
            <button class="btn-comment" on:click={handleAddComment} disabled={!newCommentText.trim() || saving}>
              💬
            </button>
          </div>

          <!-- Change log (collapsible) -->
          {#if Array.isArray(quote.changeLog) && quote.changeLog.length > 0}
            <details class="changelog-section">
              <summary>Change history ({quote.changeLog.length})</summary>
              {#each [...quote.changeLog].reverse() as entry (entry.changeId)}
                <div class="log-entry">
                  <span class="log-actor">{entry.actor}</span>
                  <span class="log-summary">{entry.summary}</span>
                  <span class="log-date">{new Date(entry.timestamp).toLocaleString('es')}</span>
                </div>
              {/each}
            </details>
          {/if}
        </div>
      {/if}

      <!-- ── Service-type manager (modal) ────────────────────────────────────── -->
      {#if svcManageOpen}
        <div class="qe-tmpl-backdrop" on:click|self={() => (svcManageOpen = false)} role="presentation">
          <div class="qe-tmpl-modal qe-svc-modal" role="dialog" aria-modal="true" aria-label="Service types">
            <div class="qe-tmpl-modal__head">
              <div class="qe-tmpl-modal__titlewrap">
                <span class="qe-tmpl-modal__spark" aria-hidden="true">✦</span>
                <h4 class="qe-tmpl-modal__title">Service types</h4>
              </div>
              <button type="button" class="qe-tmpl-modal__close" on:click={() => (svcManageOpen = false)} aria-label="Close">✕</button>
            </div>

            <div class="qe-svc-body">
              <p class="qe-svc-intro">
                The built-in service types are always available. Add your own custom
                types below — they appear in the selector for every quote.
              </p>

              {#if svcError}<p class="qe-svc-error">⚠ {svcError}</p>{/if}

              <!-- Built-in (locked) -->
              <div class="qe-svc-section-label">Built-in</div>
              <div class="qe-svc-list">
                {#each builtinServiceOptions as b (b.key)}
                  <div class="qe-svc-row qe-svc-row--locked">
                    <span class="qe-svc-emoji" aria-hidden="true">{b.icon}</span>
                    <span class="qe-svc-name">{b.label}</span>
                    <span class="qe-svc-lock" title="Built-in — always available">🔒 built-in</span>
                  </div>
                {/each}
              </div>

              <!-- Custom (editable) -->
              <div class="qe-svc-section-label">
                Custom
                {#if serviceTypesLoading}<span class="qe-svc-loading">· loading…</span>{/if}
              </div>
              <div class="qe-svc-list">
                {#if svcEdits.length === 0}
                  <div class="qe-svc-empty">No custom service types yet. Add one below ↓</div>
                {:else}
                  {#each svcEdits as row (row.serviceTypeId)}
                    <div class="qe-svc-row">
                      <input class="qe-svc-emoji-input" maxlength="4" bind:value={row.icon} placeholder="🧩" aria-label="Icon" />
                      <input class="qe-svc-name-input" bind:value={row.label} placeholder="Service type name" aria-label="Name" />
                      <button type="button" class="qe-svc-save" on:click={() => saveServiceType(row)} disabled={svcSaving} title="Save changes">Save</button>
                      <button type="button" class="qe-svc-del" on:click={() => removeServiceType(row)} disabled={svcSaving} title="Delete" aria-label="Delete">🗑</button>
                    </div>
                  {/each}
                {/if}
              </div>

              <!-- Add new -->
              <div class="qe-svc-add">
                <input class="qe-svc-emoji-input" maxlength="4" bind:value={newSvcIcon} placeholder="🚗" aria-label="New icon" />
                <input
                  class="qe-svc-name-input"
                  bind:value={newSvcLabel}
                  placeholder="New service type name"
                  aria-label="New name"
                  on:keydown={(e) => e.key === 'Enter' && addServiceType()}
                />
                <button type="button" class="qe-svc-add-btn" on:click={addServiceType} disabled={svcSaving}>+ Add</button>
              </div>
            </div>
          </div>
        </div>
      {/if}

      <!-- ── Group-label manager (modal) — Phase B ───────────────────────────── -->
      {#if labelManageOpen}
        <div class="qe-tmpl-backdrop" on:click|self={() => (labelManageOpen = false)} role="presentation">
          <div class="qe-tmpl-modal qe-svc-modal" role="dialog" aria-modal="true" aria-label="Group labels">
            <div class="qe-tmpl-modal__head">
              <div class="qe-tmpl-modal__titlewrap">
                <span class="qe-tmpl-modal__spark" aria-hidden="true">🏷️</span>
                <h4 class="qe-tmpl-modal__title">Group labels</h4>
              </div>
              <button type="button" class="qe-tmpl-modal__close" on:click={() => (labelManageOpen = false)} aria-label="Close">✕</button>
            </div>

            <div class="qe-svc-body">
              <p class="qe-svc-intro">
                Labels are reusable, fully agnostic tags you attach to a quote's line
                groups (e.g. “Origin services”, “Insurance”). Create your own — they
                appear in every quote's group label chooser.
              </p>

              {#if labelError}<p class="qe-svc-error">⚠ {labelError}</p>{/if}

              <div class="qe-svc-section-label">
                Your labels
                {#if labelsLoading}<span class="qe-svc-loading">· loading…</span>{/if}
              </div>
              <div class="qe-svc-list">
                {#if labelEdits.length === 0}
                  <div class="qe-svc-empty">No labels yet. Add one below ↓</div>
                {:else}
                  {#each labelEdits as row (row.labelId)}
                    <div class="qe-svc-row">
                      <input class="qe-svc-emoji-input" maxlength="4" bind:value={row.icon} placeholder="🏷️" aria-label="Icon" />
                      <input class="qe-svc-name-input" bind:value={row.label} placeholder="Label name" aria-label="Name" />
                      <button type="button" class="qe-svc-save" on:click={() => saveLabel(row)} disabled={labelSaving} title="Save changes">Save</button>
                      <button type="button" class="qe-svc-del" on:click={() => removeLabel(row)} disabled={labelSaving} title="Delete" aria-label="Delete">🗑</button>
                    </div>
                  {/each}
                {/if}
              </div>

              <div class="qe-svc-add">
                <input class="qe-svc-emoji-input" maxlength="4" bind:value={newLabelIcon} placeholder="📦" aria-label="New icon" />
                <input
                  class="qe-svc-name-input"
                  bind:value={newLabelName}
                  placeholder="New label name"
                  aria-label="New name"
                  on:keydown={(e) => e.key === 'Enter' && addLabel()}
                />
                <button type="button" class="qe-svc-add-btn" on:click={addLabel} disabled={labelSaving}>+ Add</button>
              </div>
            </div>
          </div>
        </div>
      {/if}

      <!-- ── Line-item template manager (modal) ─────────────────────────────── -->
      {#if manageOpen}

        <div class="qe-tmpl-backdrop" on:click|self={() => (manageOpen = false)} role="presentation">
          <div class="qe-tmpl-modal" role="dialog" aria-modal="true" aria-label="Line-item templates">
            <div class="qe-tmpl-modal__head">
              <div class="qe-tmpl-modal__titlewrap">
                <span class="qe-tmpl-modal__spark" aria-hidden="true">✦</span>
                <h4 class="qe-tmpl-modal__title">Line-item templates</h4>
              </div>
              <button type="button" class="qe-tmpl-modal__close" on:click={() => (manageOpen = false)} aria-label="Close">✕</button>
            </div>

            <div class="qe-tmpl-modal__body">
              <!-- Saved templates list -->
              <div class="qe-tmpl-listcol">
                <div class="qe-tmpl-listcol__head">
                  <span class="qe-tmpl-listcol__label">Saved templates</span>
                  <button type="button" class="qe-tmpl-newbtn" class:is-active={tmplEditingId === null} on:click={openCreateTemplate}>+ New</button>
                </div>
                {#if lineTemplatesLoading}
                  <div class="qe-tmpl-empty">Loading…</div>
                {:else if lineTemplates.length === 0}
                  <div class="qe-tmpl-empty">No templates yet. Create your first one →</div>
                {:else}
                  <div class="qe-tmpl-list">
                    {#each lineTemplates as t (t.templateId)}
                      <div class="qe-tmpl-row" class:is-editing={tmplEditingId === t.templateId}>
                        <button type="button" class="qe-tmpl-row__main" on:click={() => openEditTemplate(t)} title="Edit this template">
                          <span class="qe-tmpl-row__name">
                            {t.name}
                            {#if t.isDefault}<span class="qe-tmpl-badge">default</span>{/if}
                          </span>
                          <span class="qe-tmpl-row__meta">{t.lines.length} lines · {t.currency}</span>
                        </button>
                        <button type="button" class="qe-tmpl-row__del" on:click={() => removeTemplate(t)} title="Delete template" aria-label="Delete template">🗑</button>
                      </div>
                    {/each}
                  </div>
                {/if}
              </div>

              <!-- Editor form -->
              <div class="qe-tmpl-formcol">
                <div class="qe-tmpl-formcol__head">
                  <span class="qe-tmpl-formcol__label">{tmplEditingId ? 'Edit template' : 'New template'}</span>
                  <button type="button" class="qe-tmpl-fromlines" on:click={seedTemplateFromCurrentLines} title="Pre-fill the lines below from the current quote">
                    ⤵ Use current lines
                  </button>
                </div>
                <div class="qe-tmpl-form__row">
                  <div class="qe-tmpl-form__field qe-tmpl-form__field--grow">
                    <label class="qe-label" for="qe-tmpl-name">Name</label>
                    <input id="qe-tmpl-name" class="qe-input qe-input--sm" type="text" placeholder="e.g. Costa Rica — Standard" bind:value={tmplName} />
                  </div>
                  <div class="qe-tmpl-form__field">
                    <label class="qe-label" for="qe-tmpl-cur">Currency</label>
                    <select id="qe-tmpl-cur" class="qe-select qe-select--sm" bind:value={tmplCurrency}>
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                      <option value="MXN">MXN</option>
                      <option value="CRC">CRC</option>
                    </select>
                  </div>
                </div>
                <div class="qe-tmpl-form__field">
                  <label class="qe-label" for="qe-tmpl-lines">Lines <span class="qe-tmpl-form__hint">one per line — add <code>:price</code> for a default cost</span></label>
                  <textarea
                    id="qe-tmpl-lines"
                    class="qe-textarea qe-tmpl-textarea"
                    rows="12"
                    placeholder={"Fondo Compensacion:250\nOrigin Services:1200\nFlete Internacional\n…"}
                    bind:value={tmplLinesText}
                  ></textarea>
                </div>
                <div class="qe-tmpl-form__field">
                  <label class="qe-label" for="qe-tmpl-desc">
                    Service description
                    <span class="qe-tmpl-form__hint">client-visible — prefills each group applied from this template</span>
                  </label>
                  <textarea
                    id="qe-tmpl-desc"
                    class="qe-textarea"
                    rows="3"
                    placeholder="E.g. Full origin packing with export-grade materials, loading, and inventory."
                    bind:value={tmplDescription}
                  ></textarea>
                </div>
                {#if tmplError}<p class="qe-field-error">⚠ {tmplError}</p>{/if}

              </div>
            </div>

            <div class="qe-tmpl-modal__foot">
              <button type="button" class="qe-btn qe-btn--cancel" on:click={() => (manageOpen = false)} disabled={tmplSaving}>Close</button>
              <button type="button" class="qe-btn qe-btn--save" on:click={saveTemplate} disabled={tmplSaving}>
                {#if tmplSaving}<span class="qe-btn-spinner"></span> Saving…{:else}{tmplEditingId ? 'Save changes' : 'Create template'}{/if}
              </button>
            </div>
          </div>
        </div>
      {/if}

      <!-- Action buttons -->
      <div class="qe-actions">
        <button
          type="button"
          class="qe-btn qe-btn--save"
          disabled={saving}
          on:click={handleSave}
        >

          {#if saving}
            <span class="qe-btn-spinner"></span> Saving…
          {:else}
            💾 Save draft
          {/if}
        </button>

        <!-- One-click Save + Submit for approval. Shown for new quotes and for
             quotes still in draft / changes_requested (nothing to submit once
             already pending/approved). -->
        {#if !quote || quote.status === 'draft' || quote.status === 'changes_requested'}
          <button
            type="button"
            class="qe-btn qe-btn--submit"
            disabled={saving}
            on:click={handleSaveAndSubmit}
            title="Save this quote and immediately send it for approval"
          >
            {#if saving}
              <span class="qe-btn-spinner"></span> Working…
            {:else}
              💾📨 Save &amp; submit for approval
            {/if}
          </button>
        {/if}

        <button
          type="button"
          class="qe-btn qe-btn--cancel"
          disabled={saving}
          on:click={handleCancel}
        >
          Cancel
        </button>
      </div>
    </div>
  {/if}

  <!-- ── Approve-with-edits confirm modal ─────────────────────────────────────
       Shown when an approver clicks the plain "Approve quote" while they have
       unsaved edits in the form. Mirrors the codebase's backdrop+card pattern. -->
  {#if showApproveEditsModal}
    <div class="qe-tmpl-backdrop" on:click|self={() => (showApproveEditsModal = false)} role="presentation">
      <div class="qe-confirm-card" role="alertdialog" aria-modal="true" aria-label="Approve with unsaved edits">
        <div class="qe-confirm-icon">✍️</div>
        <h4 class="qe-confirm-title">This quote has unsaved edits</h4>
        <p class="qe-confirm-body">
          You've edited this quote but haven't saved those changes. Approving now will
          approve it <strong>as it was submitted</strong> — your edits will <strong>not</strong> be
          included. Choose how you'd like to proceed:
        </p>
        <div class="qe-confirm-actions">
          <button class="btn-approve-edits" on:click={handleApproveWithEdits} disabled={saving}>
            ✍️ Approve with edits
          </button>
          <button class="btn-approve" on:click={approveWithoutEdits} disabled={saving}>
            ✅ Approve without edits
          </button>
          <button class="btn-cancel-small" on:click={() => (showApproveEditsModal = false)} disabled={saving}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  /* ══════════════════════════════════════════════════════════════════════════
     QuoteEditor — IRP Design System
     Tokens: --irp-accent (#02b5bb), --font-paragraph (Jost), --irp-surface/border/text
     ══════════════════════════════════════════════════════════════════════════ */
  .quote-editor {
    background: var(--irp-surface, #ffffff);
    border: 1px solid var(--irp-border, rgba(0,0,0,0.08));
    border-radius: 16px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    box-shadow: 0 1px 3px rgba(0,0,0,0.06), 0 4px 20px rgba(0,0,0,0.05);
    font-family: var(--font-paragraph, 'Jost'), system-ui, sans-serif;
    color: var(--irp-text, #181818);
  }

  /* ── Header ───────────────────────────────────────────────────────────── */
  .quote-editor__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 24px;
    border-bottom: 1px solid #e2e8f0;
    background: #ffffff;
    position: sticky;
    top: 0;
    z-index: 10;
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
  }

  .quote-editor__title {
    margin: 0;
    font-size: 17px;
    font-weight: 800;
    letter-spacing: -0.03em;
    background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  /* ── Loading ──────────────────────────────────────────────────────────── */
  .quote-editor__loading {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 32px;
    color: #94a3b8;
    font-size: 13.5px;
    justify-content: center;
  }

  .qe-spinner {
    width: 18px;
    height: 18px;
    border: 2px solid #e2e8f0;
    border-top-color: #02b5bb;
    border-radius: 50%;
    animation: qe-spin 0.7s linear infinite;
    flex-shrink: 0;
  }
  @keyframes qe-spin { to { transform: rotate(360deg); } }

  /* ── Body ─────────────────────────────────────────────────────────────── */
  .quote-editor__body {
    padding: 24px;
    display: flex;
    flex-direction: column;
    gap: 20px;
    overflow-y: auto;
  }

  /* ── Field ────────────────────────────────────────────────────────────── */
  .qe-field {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .qe-field--total {
    flex-direction: row;
    align-items: center;
    gap: 12px;
    padding: 14px 18px;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 10px;
  }

  .qe-label {
    font-size: 11px;
    font-weight: 700;
    color: #94a3b8;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  .qe-required { color: #ef4444; }

  /* ── Inputs ───────────────────────────────────────────────────────────── */
  .qe-input {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    color: #0f172a;
    font-size: 14px;
    padding: 10px 14px;
    outline: none;
    transition: border-color 0.15s, box-shadow 0.15s;
    width: 100%;
    box-sizing: border-box;
    font-family: inherit;
  }
  .qe-input::placeholder { color: #94a3b8; }
  .qe-input:focus {
    border-color: rgba(2,181,187,0.48);
    box-shadow: 0 0 0 3px rgba(2,181,187,0.12);
    background: #ffffff;
  }
  .qe-input--sm { padding: 7px 10px; font-size: 13px; }
  .qe-input--num { text-align: right; max-width: 100px; font-variant-numeric: tabular-nums; }

  /* ── Select ───────────────────────────────────────────────────────────── */
  .qe-select {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    color: #0f172a;
    font-size: 14px;
    padding: 10px 10px;
    outline: none;
    cursor: pointer;
    width: 100%;
    font-family: inherit;
    transition: border-color 0.15s, box-shadow 0.15s;
  }
  .qe-select:focus {
    border-color: rgba(2,181,187,0.48);
    box-shadow: 0 0 0 3px rgba(2,181,187,0.12);
  }
  .qe-select--sm { padding: 7px 8px; font-size: 13px; }

  /* ── Textarea ─────────────────────────────────────────────────────────── */
  .qe-textarea {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    color: #0f172a;
    font-size: 14px;
    padding: 10px 14px;
    outline: none;
    resize: vertical;
    transition: border-color 0.15s, box-shadow 0.15s;
    width: 100%;
    box-sizing: border-box;
    font-family: inherit;
    line-height: 1.6;
  }
  .qe-textarea::placeholder { color: #94a3b8; }
  .qe-textarea:focus {
    border-color: rgba(2,181,187,0.48);
    box-shadow: 0 0 0 3px rgba(2,181,187,0.12);
    background: #ffffff;
  }

  /* ── Line items table ─────────────────────────────────────────────────── */
  .qe-lines-wrap {
    border-radius: 10px;
    border: 1px solid #e2e8f0;
    background: #ffffff;
  }

  .qe-lines-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
    color: #0f172a;
  }

  .qe-lines-table th {
    background: #f8fafc;
    color: #94a3b8;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    padding: 10px 12px;
    text-align: left;
    border-bottom: 2px solid #f1f5f9;
  }
  .qe-th-num { text-align: right; }

  .qe-lines-table td {
    padding: 7px 8px;
    border-bottom: 1px solid #f8fafc;
    vertical-align: middle;
  }

  .qe-lines-table tbody tr:hover td { background: #fafbff; }
  .qe-lines-table tr:last-child td { border-bottom: none; }

  /* ── Delete line button ───────────────────────────────────────────────── */
  .qe-del-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    color: #94a3b8;
    cursor: pointer;
    font-size: 11px;
    padding: 0;
    border-radius: 6px;
    line-height: 1;
    transition: background 0.12s, color 0.12s, border-color 0.12s;
  }
  .qe-del-btn:hover {
    background: #fef2f2;
    border-color: #fecaca;
    color: #dc2626;
  }

  /* ── Add line button ──────────────────────────────────────────────────── */
  .qe-add-line-btn {
    background: none;
    border: 1.5px dashed rgba(2,181,187,0.22);
    color: #02b5bb;
    font-size: 12.5px;
    font-weight: 700;
    padding: 7px 14px;
    border-radius: 8px;
    cursor: pointer;
    transition: border-color 0.15s, color 0.15s, background 0.15s;
    align-self: flex-start;
    margin-top: 4px;
    letter-spacing: 0.01em;
  }
  .qe-add-line-btn:hover {
    border-color: #02b5bb;
    background: rgba(2,181,187,0.08);
    color: #02999e;
  }

  /* ── Line-item GROUPS (Phase 5) ───────────────────────────────────────────── */
  .qe-groups-hint {
    margin: 0 0 2px;
    font-size: 11.5px;
    color: #64748b;
    line-height: 1.5;
  }
  .qe-groups-hint strong { color: #0f172a; font-weight: 700; }

  .qe-group {
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    background: #ffffff;
    box-shadow: 0 1px 3px rgba(0,0,0,0.03);
  }
  .qe-group--optional {
    background: #fbfdff;
    border-style: dashed;
  }
  .qe-group__head {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }
  .qe-group__title { flex: 1 1 200px; font-weight: 700; }
  .qe-group__subtotal {
    font-size: 13px;
    font-weight: 800;
    color: #02b5bb;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
  .qe-group__del {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    color: #94a3b8;
    cursor: pointer;
    font-size: 12px;
    border-radius: 7px;
    transition: background 0.12s, color 0.12s, border-color 0.12s;
  }
  .qe-group__del:hover { background: #fef2f2; border-color: #fecaca; color: #dc2626; }

  /* Required / Optional segmented toggle */
  .qe-role-toggle {
    display: inline-flex;
    background: #f1f5f9;
    border: 1px solid #e2e8f0;
    border-radius: 999px;
    padding: 2px;
    flex-shrink: 0;
  }
  .qe-role-btn {
    border: none;
    background: none;
    color: #64748b;
    font-size: 11.5px;
    font-weight: 700;
    padding: 4px 12px;
    border-radius: 999px;
    cursor: pointer;
    transition: background 0.14s, color 0.14s, box-shadow 0.14s;
  }
  .qe-role-btn.is-active {
    background: #ffffff;
    color: #02999e;
    box-shadow: 0 1px 3px rgba(0,0,0,0.10);
  }
  .qe-role-btn--opt.is-active { color: #b45309; }
  .qe-role-btn--fixed.is-active { color: #475569; }


  .qe-add-group-btn {
    background: none;
    border: 1.5px dashed rgba(2,181,187,0.30);
    color: #02b5bb;
    font-size: 13px;
    font-weight: 700;
    padding: 10px 16px;
    border-radius: 10px;
    cursor: pointer;
    transition: border-color 0.15s, color 0.15s, background 0.15s;
    align-self: flex-start;
    letter-spacing: 0.01em;
  }
  .qe-add-group-btn:hover {
    border-color: #02b5bb;
    background: rgba(2,181,187,0.08);
    color: #02999e;
  }

  /* ── Total display ────────────────────────────────────────────────────── */
  .qe-total {
    font-size: 22px;
    font-weight: 800;
    color: #0f172a;
    font-variant-numeric: tabular-nums;
    letter-spacing: -0.03em;
    margin-left: auto;
  }

  /* ── Provider tags ────────────────────────────────────────────────────── */
  .qe-provider-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 6px;
  }

  .qe-provider-tag {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    background: rgba(2,181,187,0.08);
    border: 1px solid rgba(2,181,187,0.22);
    color: #02999e;
    font-size: 12px;
    font-weight: 600;
    padding: 3px 10px;
    border-radius: 999px;
    transition: background 0.14s;
  }
  .qe-provider-tag:hover { background: rgba(2,181,187,0.14); }

  .qe-provider-tag__remove {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: none;
    border: none;
    color: rgba(2,181,187,0.48);
    cursor: pointer;
    font-size: 11px;
    padding: 0;
    line-height: 1;
    opacity: 0.8;
    border-radius: 50%;
    transition: opacity 0.12s, color 0.12s;
  }
  .qe-provider-tag__remove:hover { opacity: 1; color: #02999e; }

  /* ── Provider search box ──────────────────────────────────────────────── */
  .qe-provider-search {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 0;
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    overflow: hidden;
  }
  .qe-provider-search .qe-input {
    border: none;
    border-radius: 0;
    background: #ffffff;
  }
  .qe-provider-search .qe-input:focus {
    box-shadow: none;
    border-bottom: 1px solid rgba(2,181,187,0.22);
  }

  .qe-provider-searching {
    font-size: 11.5px;
    color: #94a3b8;
    padding: 6px 14px;
    background: #f8fafc;
  }

  .qe-provider-results {
    background: #ffffff;
    border-top: 1px solid #e2e8f0;
    max-height: 180px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
  }

  .qe-provider-result {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    padding: 10px 14px;
    cursor: pointer;
    font-size: 13px;
    color: #0f172a;
    transition: background 0.12s;
    border-bottom: 1px solid #f1f5f9;
  }
  .qe-provider-result:last-child { border-bottom: none; }
  .qe-provider-result:hover { background: #f8fafc; }
  .qe-provider-result input[type="checkbox"] { accent-color: #02b5bb; flex-shrink: 0; margin-top: 2px; }
  .qe-provider-result__body { display: flex; flex-direction: column; gap: 4px; flex: 1; min-width: 0; }
  .qe-provider-result__name { font-weight: 700; color: #0f172a; }
  .qe-provider-result__details { display: flex; flex-wrap: wrap; gap: 5px; align-items: center; }
  .qe-provider-chip {
    display: inline-block;
    font-size: 10.5px;
    font-weight: 600;
    padding: 2px 8px;
    border-radius: 999px;
    background: rgba(2,181,187,0.08);
    color: #02999e;
    border: 1px solid rgba(2,181,187,0.18);
    white-space: nowrap;
  }
  .qe-provider-chip--muted {
    background: #f1f5f9;
    color: #64748b;
    border-color: #e2e8f0;
  }
  .qe-provider-result__meta { color: #94a3b8; font-size: 11.5px; white-space: nowrap; }
  .qe-provider-result__score { flex-shrink: 0; padding-top: 1px; }

  /* ── Per-block finance numbers (Cost · Client · Margin) ─────────────────── */
  .qe-group__nums { display: flex; align-items: stretch; gap: 6px; margin-left: auto; flex-wrap: wrap; }
  .qe-gnum {
    display: flex; flex-direction: column; align-items: flex-end; gap: 1px;
    padding: 3px 10px; border-radius: 8px; line-height: 1.1;
    background: #f8fafc; border: 1px solid #eef2f7;
  }
  .qe-gnum__lbl { font-size: 8px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; color: #94a3b8; }
  .qe-gnum__val { font-size: 12px; font-weight: 800; color: #0f172a; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .qe-gnum__val--accent { color: #02b5bb; }
  .qe-gnum__val--earn { color: #22c55e; }

  /* ── Per-line provider cell + search popover ────────────────────────────── */
  .qe-th-prov { width: 160px; }
  .qe-td-prov { position: relative; }
  .qe-prov-add {
    background: rgba(2,181,187,0.06);
    border: 1px dashed rgba(2,181,187,0.28);
    color: #02999e; font-size: 11.5px; font-weight: 700;
    padding: 5px 10px; border-radius: 7px; cursor: pointer; white-space: nowrap;
    transition: background 0.14s, border-color 0.14s;
  }
  .qe-prov-add:hover { background: rgba(2,181,187,0.12); border-color: rgba(2,181,187,0.45); }
  .qe-prov-chip {
    display: inline-flex; align-items: center; gap: 4px;
    background: rgba(2,181,187,0.08); border: 1px solid rgba(2,181,187,0.22);
    color: #02999e; font-size: 12px; font-weight: 600;
    padding: 3px 4px 3px 10px; border-radius: 999px; max-width: 100%;
  }
  .qe-prov-chip__name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 108px; }
  .qe-prov-chip__x {
    display: inline-flex; align-items: center; justify-content: center;
    width: 18px; height: 18px; border-radius: 50%;
    background: none; border: none; color: rgba(2,153,158,0.65); cursor: pointer; font-size: 10px; flex-shrink: 0;
  }
  .qe-prov-chip__x:hover { color: #02999e; background: rgba(2,181,187,0.16); }
  .qe-prov-pop {
    position: absolute; z-index: 40; top: calc(100% + 4px); left: 0;
    width: 300px; max-width: 80vw;
    background: #fff; border: 1px solid #e2e8f0; border-radius: 10px;
    box-shadow: 0 8px 28px rgba(0,0,0,0.12); overflow: hidden;
  }
  .qe-prov-pop .qe-input { border: none; border-bottom: 1px solid #eef2f7; border-radius: 0; background: #fff; }
  .qe-prov-pop__loading { padding: 8px 12px; font-size: 11.5px; color: #94a3b8; background: #f8fafc; }
  .qe-prov-pop__results { max-height: 220px; overflow-y: auto; display: flex; flex-direction: column; }
  .qe-prov-opt {
    display: flex; flex-direction: column; gap: 4px; align-items: flex-start;
    padding: 8px 12px; background: none; border: none; border-bottom: 1px solid #f1f5f9;
    cursor: pointer; text-align: left; width: 100%;
  }
  .qe-prov-opt:last-child { border-bottom: none; }
  .qe-prov-opt:hover { background: #f8fafc; }
  .qe-prov-opt__name { font-size: 13px; font-weight: 700; color: #0f172a; }
  .qe-prov-opt__meta { display: flex; flex-wrap: wrap; gap: 4px; align-items: center; }
  .qe-prov-opt__score { display: inline-flex; align-items: center; }



  /* ── Error message ────────────────────────────────────────────────────── */
  .qe-error {
    background: #fef2f2;
    border: 1px solid #fecaca;
    border-radius: 8px;
    color: #dc2626;
    font-size: 13px;
    font-weight: 600;
    padding: 10px 14px;
  }

  /* ── Actions row ──────────────────────────────────────────────────────── */
  .qe-actions {
    display: flex;
    gap: 10px;
    padding: 16px 24px;
    border-top: 1px solid #e2e8f0;
    background: #ffffff;
    margin: 0 -24px -20px;
  }

  .qe-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    border: none;
    border-radius: 999px;
    font-size: 14px;
    font-weight: 700;
    padding: 10px 22px;
    cursor: pointer;
    transition: box-shadow 0.18s, transform 0.18s, filter 0.18s, background 0.15s;
    letter-spacing: -0.01em;
  }
  .qe-btn:disabled { opacity: 0.55; cursor: not-allowed; transform: none !important; }

  .qe-btn--save {
    background: linear-gradient(135deg, #02b5bb 0%, #02999e 100%);
    color: #fff;
    box-shadow: 0 2px 8px rgba(2,181,187,0.28);
  }
  .qe-btn--save:not(:disabled):hover {
    filter: brightness(1.07);
    box-shadow: 0 4px 16px rgba(2,181,187,0.38);
    transform: translateY(-1px);
  }

  .qe-btn--cancel {
    background: #f1f5f9;
    color: #475569;
    border: 1px solid #e2e8f0;
  }
  .qe-btn--cancel:not(:disabled):hover {
    background: #e2e8f0;
    color: #0f172a;
    transform: translateY(-1px);
  }

  .qe-btn-spinner {
    display: inline-block;
    width: 13px;
    height: 13px;
    border: 2px solid rgba(255,255,255,0.35);
    border-top-color: #fff;
    border-radius: 50%;
    animation: qe-spin 0.6s linear infinite;
  }

  /* ── Approval workflow ────────────────────────────────────────────────── */
  .approval-section {
    margin-top: 4px;
    border-top: 2px solid #f1f5f9;
    padding-top: 20px;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  /* Status banner */
  .status-banner {
    padding: 10px 16px;
    border-radius: 10px;
    font-size: 13.5px;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 8px;
    border: 1px solid transparent;
  }
  .status-banner.status-draft {
    background: #f1f5f9;
    color: #64748b;
    border-color: #e2e8f0;
  }
  .status-banner.status-pending_approval {
    background: #fffbeb;
    color: #d97706;
    border-color: #fde68a;
  }
  .status-banner.status-changes_requested {
    background: #fef2f2;
    color: #dc2626;
    border-color: #fecaca;
  }
  .status-banner.status-approved {
    background: #f0fdf4;
    color: #16a34a;
    border-color: #bbf7d0;
  }
  .status-banner.status-sent_to_client {
    background: rgba(2,181,187,0.07);
    color: #02999e;
    border-color: rgba(2,181,187,0.22);
  }
  .status-banner.status-client_accepted {
    background: #f0fdf4;
    color: #059669;
    border-color: #6ee7b7;
  }
  .check { color: #16a34a; }

  /* ── Signed service agreement (accepted quotes) ──────────────────────────── */
  .contract-section {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
    flex-wrap: wrap;
    padding: 14px 16px;
    border-radius: 12px;
    background: #f0fdf4;
    border: 1px solid #bbf7d0;
  }
  .contract-section__text {
    display: flex;
    flex-direction: column;
    gap: 3px;
    min-width: 0;
  }
  .contract-section__text strong {
    font-size: 13.5px;
    color: #065f46;
    font-weight: 800;
  }
  .contract-section__hint {
    font-size: 12px;
    color: #047857;
    line-height: 1.45;
  }
  .btn-download-contract {
    background: linear-gradient(135deg, #059669 0%, #047857 100%);
    color: #fff;
    border: none;
    padding: 10px 18px;
    border-radius: 8px;
    cursor: pointer;
    font-weight: 700;
    font-size: 13px;
    white-space: nowrap;
    box-shadow: 0 2px 8px rgba(5,150,105,0.22);
    transition: filter 0.15s, box-shadow 0.15s, transform 0.15s;
  }
  .btn-download-contract:hover:not(:disabled) {
    filter: brightness(1.08);
    box-shadow: 0 4px 14px rgba(5,150,105,0.32);
    transform: translateY(-1px);
  }
  .btn-download-contract:disabled { opacity: 0.6; cursor: progress; }

  /* Approver actions box */
  .approver-actions {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .approver-hint {
    font-size: 12.5px;
    color: #64748b;
    margin: 0;
    font-weight: 500;
  }
  .btn-row { display: flex; gap: 8px; flex-wrap: wrap; }

  .btn-approve {
    background: linear-gradient(135deg, #16a34a 0%, #059669 100%);
    color: #fff;
    border: none;
    padding: 10px 18px;
    border-radius: 8px;
    cursor: pointer;
    font-weight: 700;
    font-size: 13px;
    transition: filter 0.15s, box-shadow 0.15s;
    box-shadow: 0 2px 8px rgba(22,163,74,0.22);
  }
  .btn-approve:hover:not(:disabled) {
    filter: brightness(1.08);
    box-shadow: 0 4px 14px rgba(22,163,74,0.30);
  }

  .btn-changes {
    background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
    color: #fff;
    border: none;
    padding: 10px 18px;
    border-radius: 8px;
    cursor: pointer;
    font-weight: 700;
    font-size: 13px;
    transition: filter 0.15s, box-shadow 0.15s;
    box-shadow: 0 2px 8px rgba(245,158,11,0.22);
  }
  .btn-changes:hover:not(:disabled) {
    filter: brightness(1.08);
    box-shadow: 0 4px 14px rgba(245,158,11,0.30);
  }

  .btn-cancel-small {
    background: #f1f5f9;
    color: #475569;
    border: 1px solid #e2e8f0;
    padding: 10px 18px;
    border-radius: 8px;
    cursor: pointer;
    font-size: 13px;
    font-weight: 600;
    transition: background 0.14s;
  }
  .btn-cancel-small:hover { background: #e2e8f0; color: #0f172a; }

  .changes-request-box {
    margin-top: 4px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .changes-request-box textarea {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    color: #0f172a;
    font-size: 13.5px;
    padding: 10px 14px;
    outline: none;
    resize: vertical;
    width: 100%;
    box-sizing: border-box;
    font-family: inherit;
    line-height: 1.6;
    transition: border-color 0.15s, box-shadow 0.15s;
  }
  .changes-request-box textarea:focus {
    border-color: rgba(2,181,187,0.48);
    box-shadow: 0 0 0 3px rgba(2,181,187,0.12);
    background: #fff;
  }

  /* Submit for approval */
  .submit-approval-section {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 16px;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
  }
  .submit-approval-section input[type="text"] {
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    color: #0f172a;
    font-size: 13.5px;
    padding: 10px 14px;
    outline: none;
    width: 100%;
    box-sizing: border-box;
    font-family: inherit;
    transition: border-color 0.15s, box-shadow 0.15s;
  }
  .submit-approval-section input[type="text"]:focus {
    border-color: rgba(2,181,187,0.48);
    box-shadow: 0 0 0 3px rgba(2,181,187,0.12);
  }

  .field-label {
    font-size: 11px;
    font-weight: 700;
    color: #94a3b8;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  .btn-submit-approval {
    background: linear-gradient(135deg, #02b5bb 0%, #02999e 100%);
    color: #fff;
    border: none;
    padding: 10px 18px;
    border-radius: 8px;
    cursor: pointer;
    font-weight: 700;
    font-size: 13px;
    width: fit-content;
    box-shadow: 0 2px 8px rgba(2,181,187,0.25);
    transition: filter 0.15s, box-shadow 0.15s;
  }
  .btn-submit-approval:hover:not(:disabled) {
    filter: brightness(1.07);
    box-shadow: 0 4px 14px rgba(2,181,187,0.35);
  }

  /* Send to client section */
  .send-to-client-section {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 16px;
    background: #f0fdf4;
    border: 1px solid #bbf7d0;
    border-radius: 12px;
  }

  .btn-send-client {
    background: linear-gradient(135deg, #0d9488 0%, #059669 100%);
    color: #fff;
    border: none;
    padding: 10px 20px;
    border-radius: 8px;
    cursor: pointer;
    font-weight: 700;
    font-size: 13.5px;
    width: fit-content;
    box-shadow: 0 2px 8px rgba(13,148,136,0.25);
    transition: filter 0.15s, box-shadow 0.15s;
  }
  .btn-send-client:hover:not(:disabled) {
    filter: brightness(1.08);
    box-shadow: 0 4px 14px rgba(13,148,136,0.32);
  }

  .sent-confirmation { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  .sent-badge {
    color: #059669;
    font-weight: 700;
    font-size: 13.5px;
    background: #d1fae5;
    padding: 4px 12px;
    border-radius: 999px;
    border: 1px solid #6ee7b7;
  }
  .sent-date { color: #64748b; font-size: 12px; }
  .sent-link-label { font-size: 11.5px; color: #94a3b8; margin: 0; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; }
  .sent-link { font-size: 12px; color: #02b5bb; word-break: break-all; text-decoration: underline; }

  /* Comments section */
  .comments-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .section-title {
    font-size: 11px;
    font-weight: 700;
    color: #94a3b8;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin: 0 0 4px;
  }

  .comment-item {
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-left: 3px solid #02b5bb;
    padding: 12px 14px;
    border-radius: 8px;
    transition: opacity 0.15s;
  }
  .comment-item.resolved {
    opacity: 0.5;
    border-left-color: #94a3b8;
  }
  .comment-header {
    display: flex;
    gap: 8px;
    align-items: center;
    flex-wrap: wrap;
    margin-bottom: 5px;
    font-size: 12px;
    color: #64748b;
  }
  .comment-header strong { color: #0f172a; }
  .comment-text { margin: 0; font-size: 13px; color: #334155; line-height: 1.55; }
  .comment-date { font-size: 11px; color: #94a3b8; }
  .resolved-badge {
    color: #059669;
    font-size: 11px;
    font-weight: 700;
    background: #d1fae5;
    padding: 1px 7px;
    border-radius: 999px;
    border: 1px solid #6ee7b7;
  }
  .resolve-btn {
    background: #f1f5f9;
    border: 1px solid #e2e8f0;
    color: #64748b;
    padding: 2px 10px;
    border-radius: 5px;
    cursor: pointer;
    font-size: 11px;
    font-weight: 600;
    transition: background 0.12s, color 0.12s;
  }
  .resolve-btn:hover { background: #e2e8f0; color: #0f172a; }

  /* Add comment row */
  .add-comment-section {
    display: flex;
    gap: 8px;
    align-items: stretch;
  }
  .add-comment-section input {
    flex: 1;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    color: #0f172a;
    font-size: 13.5px;
    padding: 10px 14px;
    outline: none;
    font-family: inherit;
    transition: border-color 0.15s, box-shadow 0.15s;
  }
  .add-comment-section input:focus {
    border-color: rgba(2,181,187,0.48);
    box-shadow: 0 0 0 3px rgba(2,181,187,0.12);
    background: #fff;
  }
  .add-comment-section input::placeholder { color: #94a3b8; }
  .btn-comment {
    background: rgba(2,181,187,0.08);
    border: 1px solid rgba(2,181,187,0.22);
    color: #02b5bb;
    padding: 10px 14px;
    border-radius: 8px;
    cursor: pointer;
    font-size: 16px;
    font-weight: 700;
    line-height: 1;
    transition: background 0.14s, border-color 0.14s;
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  .btn-comment:hover:not(:disabled) { background: rgba(2,181,187,0.14); border-color: rgba(2,181,187,0.35); }
  .btn-comment:disabled { opacity: 0.5; cursor: not-allowed; }

  /* Changelog */
  .changelog-section { margin-top: 4px; }
  .changelog-section summary {
    cursor: pointer;
    font-size: 11.5px;
    color: #94a3b8;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    padding: 4px 0;
    user-select: none;
    list-style: none;
  }
  .changelog-section summary::-webkit-details-marker { display: none; }
  .changelog-section summary::before {
    content: '▸ ';
    font-size: 10px;
    display: inline-block;
    transition: transform 0.15s;
  }
  .changelog-section[open] summary::before { transform: rotate(90deg); }

  .log-entry {
    display: flex;
    gap: 8px;
    padding: 5px 0;
    font-size: 11.5px;
    color: #64748b;
    border-bottom: 1px solid #f1f5f9;
    flex-wrap: wrap;
    align-items: baseline;
  }
  .log-actor {
    color: #02b5bb;
    font-weight: 700;
    font-family: 'SF Mono', 'JetBrains Mono', 'Fira Code', monospace;
    font-size: 11px;
  }
  .log-summary { flex: 1; color: #334155; }
  .log-date { color: #94a3b8; font-size: 10.5px; white-space: nowrap; }

  /* ── Service-type field ─────────────────────────────────────────────────── */
  .qe-label--required::after { content: ' *'; color: #ef4444; font-size: 11px; }
  .qe-field--error .qe-label,
  .qe-field--error .qe-label--required { color: #dc2626; }
  .qe-select--error {
    border-color: #ef4444 !important;
    box-shadow: 0 0 0 3px rgba(239,68,68,0.15) !important;
  }
  .qe-field-error {
    margin: 5px 0 0;
    font-size: 12px;
    color: #dc2626;
    font-weight: 600;
    animation: qe-shake 0.3s ease;
  }
  @keyframes qe-shake {
    0%,100% { transform: translateX(0); }
    25%      { transform: translateX(-4px); }
    75%      { transform: translateX(4px); }
  }
  .qe-field-hint { margin: 5px 0 0; font-size: 11.5px; color: #64748b; line-height: 1.4; }
  .qe-insights-spinner {
    display: inline-block;
    width: 12px; height: 12px;
    border: 2px solid rgba(2,181,187,0.2);
    border-top-color: #02b5bb;
    border-radius: 50%;
    animation: qe-spin 0.7s linear infinite;
    vertical-align: middle;
    margin-left: 4px;
  }

  /* ── Margin % column / field ────────────────────────────────────────────── */
  .qe-pct-wrap { display: flex; align-items: center; gap: 3px; }
  .qe-pct-wrap--field { gap: 6px; }
  .qe-pct-sym { font-size: 12px; color: #64748b; font-weight: 600; flex-shrink: 0; }
  .qe-input--pct { width: 68px !important; max-width: 68px; }
  /* ── Margin mode cell (per-line toggle % ↔ flat $) ── */
  .qe-margin-cell { display: flex; align-items: center; gap: 3px; }
  .qe-input--margin { width: 68px !important; max-width: 68px; }
  .qe-margin-mode-btn {
    display: inline-flex; align-items: center; justify-content: center;
    min-width: 28px; height: 28px; padding: 0 5px;
    border-radius: 6px;
    border: 1.5px solid #e2e8f0;
    background: #f8fafc;
    color: #64748b;
    font-size: 11px; font-weight: 700;
    cursor: pointer;
    transition: background 0.12s, border-color 0.12s, color 0.12s;
    flex-shrink: 0; white-space: nowrap;
  }
  .qe-margin-mode-btn--pct {
    background: rgba(2,181,187,0.08);
    border-color: rgba(2,181,187,0.25);
    color: #02b5bb;
  }
  .qe-margin-mode-btn:hover {
    background: rgba(2,181,187,0.12);
    border-color: rgba(2,181,187,0.38);
    color: #02999e;
  }
  .qe-th-pct  { width: 110px; }
  .qe-th-price { width: 108px; color: #02b5bb !important; }
  .qe-th-cur  { width: 82px; }
  .qe-th-notes { min-width: 130px; }
  .qe-th-del  { width: 36px; }
  .qe-td-pct  { white-space: nowrap; }
  .qe-td-price { text-align: right; }
  .qe-computed-price {
    display: inline-block;
    min-width: 72px;
    padding: 4px 8px;
    background: rgba(2,181,187,0.07);
    border: 1px solid rgba(2,181,187,0.18);
    border-radius: 6px;
    font-size: 13px;
    font-weight: 700;
    color: #02b5bb;
    text-align: right;
    font-variant-numeric: tabular-nums;
  }

  /* ── Finance footer ─────────────────────────────────────────────────────── */
  .qe-finance-footer {
    display: flex;
    align-items: stretch;
    border-radius: 14px;
    overflow: hidden;
    border: 1px solid var(--irp-border, rgba(0,0,0,0.08));
    background: var(--irp-surface, #fff);
    box-shadow: 0 2px 12px rgba(0,0,0,0.04);
    margin-top: 4px;
  }
  .qe-finance-cell {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 14px 20px 12px;
    gap: 3px;
  }
  .qe-finance-cell--total { background: rgba(2,181,187,0.04); }
  .qe-finance-cell--earn  { background: rgba(34,197,94,0.04); }
  .qe-finance-sep { width: 1px; background: var(--irp-border, rgba(0,0,0,0.08)); flex-shrink: 0; }
  .qe-finance-label {
    font-size: 9.5px;
    font-weight: 700;
    letter-spacing: 0.07em;
    text-transform: uppercase;
    color: #94a3b8;
  }
  .qe-finance-value {
    font-size: 20px;
    font-weight: 800;
    color: var(--irp-text, #181818);
    font-variant-numeric: tabular-nums;
    line-height: 1;
  }
  .qe-finance-value--accent { color: #02b5bb; }
  .qe-finance-value--earn   { color: #22c55e; }
  .qe-finance-hint { font-size: 10px; color: #94a3b8; font-weight: 500; }

  /* ── Options footer: one row per option instead of a summed total ───── */
  .qe-options-footer {
    border-radius: 14px;
    border: 1px solid var(--irp-border, rgba(0,0,0,0.08));
    background: var(--irp-surface, #fff);
    box-shadow: 0 2px 12px rgba(0,0,0,0.04);
    margin-top: 4px;
    overflow: hidden;
  }
  .qe-options-footer__head {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 4px 10px;
    margin: 0;
    padding: 12px 16px;
    border-bottom: 1px solid var(--irp-border, rgba(0,0,0,0.08));
    font-size: 12px;
    color: #64748b;
  }
  .qe-options-footer__head strong { font-size: 15px; color: var(--irp-text, #181818); }
  .qe-options-table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
  .qe-options-table th,
  .qe-options-table td { padding: 8px 16px; text-align: right; font-variant-numeric: tabular-nums; }
  .qe-options-table thead th {
    font-size: 9.5px;
    font-weight: 700;
    letter-spacing: 0.07em;
    text-transform: uppercase;
    color: #64748b;
    background: rgba(0,0,0,0.02);
  }
  .qe-options-table th[scope='row'],
  .qe-options-table thead th:first-child { text-align: left; font-weight: 600; color: var(--irp-text, #181818); }
  .qe-options-table tbody tr + tr { border-top: 1px solid var(--irp-border, rgba(0,0,0,0.06)); }
  .qe-options-table__kind { margin-left: 6px; font-size: 10px; font-weight: 600; color: #64748b; }
  .qe-options-table__price { color: #027a7e; font-weight: 700; }
  .qe-options-table__earn { color: #15803d; }
  .qe-options-table__fixed th,
  .qe-options-table__fixed td { background: rgba(0,0,0,0.015); }

  /* ── Payment schedule editor (installment segments, ≤100%) ───────────── */
  .qe-schedule {
    display: flex;
    flex-direction: column;
    gap: 10px;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    background: #fbfdff;
    padding: 12px;
  }
  .qe-schedule__rows {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .qe-schedule__row {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }
  .qe-schedule__idx {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: rgba(2,181,187,0.12);
    color: #02999e;
    font-size: 11px;
    font-weight: 800;
    flex-shrink: 0;
  }
  .qe-schedule__role {
    font-size: 12px;
    font-weight: 600;
    color: #64748b;
    min-width: 92px;
  }
  .qe-schedule__input { width: 64px !important; max-width: 64px; }
  .qe-schedule__amt {
    font-size: 13px;
    font-weight: 700;
    color: #0f172a;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
    margin-left: auto;
  }
  .qe-schedule__del {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    color: #94a3b8;
    cursor: pointer;
    font-size: 11px;
    padding: 0;
    border-radius: 6px;
    line-height: 1;
    flex-shrink: 0;
    transition: background 0.12s, color 0.12s, border-color 0.12s;
  }
  .qe-schedule__del:hover:not(:disabled) {
    background: #fef2f2;
    border-color: #fecaca;
    color: #dc2626;
  }
  .qe-schedule__del:disabled { opacity: 0.4; cursor: not-allowed; }
  .qe-schedule__foot {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
    border-top: 1px solid #eef2f7;
    padding-top: 10px;
  }
  .qe-schedule__add {
    background: rgba(2,181,187,0.08);
    border: 1px dashed rgba(2,181,187,0.3);
    color: #02999e;
    font-size: 12px;
    font-weight: 700;
    padding: 6px 12px;
    border-radius: 8px;
    cursor: pointer;
    transition: background 0.14s, border-color 0.14s;
  }
  .qe-schedule__add:hover {
    background: rgba(2,181,187,0.14);
    border-color: rgba(2,181,187,0.5);
  }
  .qe-schedule__sum {
    margin-left: auto;
    font-size: 13px;
    font-weight: 800;
    color: #02b5bb;
    font-variant-numeric: tabular-nums;
  }
  .qe-schedule__sum--over { color: #dc2626; }

  /* ── Client description badge ───────────────────────────────────────────── */
  .qe-label-badge {
    display: inline-block;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    padding: 2px 6px;
    border-radius: 20px;
    background: rgba(2,181,187,0.10);
    color: #02b5bb;
    border: 1px solid rgba(2,181,187,0.22);
    vertical-align: middle;
    margin-left: 6px;
  }

  /* ── Default margin inline row ──────────────────────────────────────────── */
  .qe-field--inline {
    flex-direction: row;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }
  .qe-field--inline .qe-label { margin: 0; white-space: nowrap; }
  .qe-field--inline .qe-field-hint { flex: 1 0 100%; }

  /* ══════════════════════════════════════════════════════════════════════════
     Line-item templates — selector bar + manager modal (ultra-modern, on-brand)
     ══════════════════════════════════════════════════════════════════════════ */
  .qe-lines-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
  }

  /* ── Scoped token layer (Level-3) ─────────────────────────────────────────────
     Inherits the dashboard's global --irp-* brand tree (see styles/_tokens.scss)
     so the entire line-template UI is driven by ONE accent + the shared
     surfaces / borders / radii / shadows. Every alpha tint is derived from the
     accent with color-mix(), and fallbacks preserve the look if a global token
     is ever missing. Defined on both UI roots (bar + modal backdrop) so all
     descendants inherit. */
  .qe-tmpl-bar,
  .qe-tmpl-backdrop {
    --qe-accent:       var(--irp-accent, #02b5bb);
    --qe-accent-hover: var(--irp-accent-hover, #02999e);
    --qe-accent-ink:   #0b3b3d; /* deep brand teal for high-contrast text */
    --qe-surface:      var(--irp-surface, #ffffff);
    --qe-surface-2:    var(--irp-surface-2, #f8f9fa);
    --qe-border:       var(--irp-border, rgba(0, 0, 0, 0.08));
    --qe-text:         var(--irp-text, #181818);
    --qe-text-muted:   var(--irp-text-muted, #495057);
    --qe-text-dim:     var(--irp-text-dim, #868e96);
    --qe-text-faint:   color-mix(in srgb, var(--qe-text-dim) 55%, transparent);
    --qe-danger:       var(--irp-danger, #c62426);
    --qe-mono:         var(--irp-mono, 'SF Mono', 'JetBrains Mono', 'Fira Code', ui-monospace, monospace);
    --qe-r-pill:       var(--irp-r-full, 9999px);
    --qe-r-lg:         var(--irp-r-lg, 16px);
    --qe-r-md:         var(--irp-r-md, 12px);
    --qe-r-sm:         var(--irp-r-sm, 8px);
    --qe-r-xs:         var(--irp-r-xs, 6px);
    --qe-shadow-lg:    var(--irp-shadow-lg, 0 8px 32px rgba(0, 0, 0, 0.12), 0 4px 12px rgba(0, 0, 0, 0.06));
    --qe-ease:         cubic-bezier(0.16, 1, 0.3, 1);
  }

  .qe-tmpl-bar {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  /* Template apply dropdown — pill with a leading spark glyph */
  .qe-tmpl-select-wrap {
    position: relative;
    display: inline-flex;
    align-items: center;
  }
  .qe-tmpl-spark {
    position: absolute;
    left: 11px;
    font-size: 11px;
    color: var(--qe-accent);
    pointer-events: none;
    filter: drop-shadow(0 0 4px color-mix(in srgb, var(--qe-accent) 35%, transparent));
  }
  .qe-tmpl-select {
    appearance: none;
    -webkit-appearance: none;
    background:
      linear-gradient(135deg,
        color-mix(in srgb, var(--qe-accent) 6%, transparent),
        color-mix(in srgb, var(--qe-accent) 2%, transparent)),
      var(--qe-surface);
    border: 1px solid color-mix(in srgb, var(--qe-accent) 28%, transparent);
    border-radius: var(--qe-r-pill);
    color: var(--qe-accent-ink);
    font-family: inherit;
    font-size: 12.5px;
    font-weight: 600;
    padding: 7px 30px 7px 28px;
    cursor: pointer;
    outline: none;
    transition: border-color var(--qe-ease) 0.15s, box-shadow var(--qe-ease) 0.15s, background var(--qe-ease) 0.15s;
    background-repeat: no-repeat;
  }
  .qe-tmpl-select:hover:not(:disabled) {
    border-color: color-mix(in srgb, var(--qe-accent) 50%, transparent);
    box-shadow: 0 2px 10px color-mix(in srgb, var(--qe-accent) 16%, transparent);
  }
  .qe-tmpl-select:focus {
    border-color: color-mix(in srgb, var(--qe-accent) 60%, transparent);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--qe-accent) 14%, transparent);
  }
  .qe-tmpl-select:disabled { opacity: 0.6; cursor: progress; }

  /* Manage button — subtle ghost that lifts on hover */
  .qe-tmpl-manage-btn {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    background: var(--qe-surface-2);
    border: 1px solid var(--qe-border);
    border-radius: var(--qe-r-pill);
    color: var(--qe-text-muted);
    font-family: inherit;
    font-size: 12.5px;
    font-weight: 700;
    padding: 7px 14px;
    cursor: pointer;
    transition: background var(--qe-ease) 0.15s, border-color var(--qe-ease) 0.15s, color var(--qe-ease) 0.15s, transform var(--qe-ease) 0.15s;
  }
  .qe-tmpl-manage-btn:hover {
    background: color-mix(in srgb, var(--qe-accent) 8%, transparent);
    border-color: color-mix(in srgb, var(--qe-accent) 30%, transparent);
    color: var(--qe-accent-hover);
    transform: translateY(-1px);
  }
  .qe-tmpl-manage-gear { font-size: 12px; line-height: 1; }

  /* ── Service-type field header row + manager modal ──────────────────────── */
  .qe-label-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    margin-bottom: 6px;
  }
  .qe-svc-manage-btn { padding: 5px 12px; font-size: 12px; }

  .qe-svc-modal { width: min(520px, 100%); }
  .qe-svc-body {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 18px 20px 20px;
    overflow-y: auto;
  }
  .qe-svc-intro { margin: 0; font-size: 12.5px; line-height: 1.5; color: var(--qe-text-muted); }
  .qe-svc-error { margin: 0; font-size: 12.5px; font-weight: 600; color: var(--qe-danger); }
  .qe-svc-section-label {
    margin-top: 4px;
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--qe-text-dim);
  }
  .qe-svc-loading { font-weight: 600; text-transform: none; letter-spacing: 0; color: var(--qe-text-muted); }
  .qe-svc-list { display: flex; flex-direction: column; gap: 6px; }
  .qe-svc-empty {
    font-size: 12.5px;
    color: var(--qe-text-muted);
    padding: 8px 10px;
    border: 1px dashed var(--qe-border);
    border-radius: var(--qe-r-sm);
  }
  .qe-svc-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 8px;
    border: 1px solid var(--qe-border);
    border-radius: var(--qe-r-sm);
    background: var(--qe-surface-2);
  }
  .qe-svc-row--locked { opacity: 0.85; }
  .qe-svc-emoji { font-size: 16px; width: 22px; text-align: center; }
  .qe-svc-name { flex: 1; font-size: 13px; font-weight: 600; color: var(--qe-text); }
  .qe-svc-lock {
    font-size: 10.5px;
    font-weight: 700;
    color: var(--qe-text-dim);
    background: var(--qe-surface);
    border: 1px solid var(--qe-border);
    border-radius: var(--qe-r-pill);
    padding: 2px 8px;
  }
  .qe-svc-emoji-input {
    width: 42px;
    text-align: center;
    font-size: 15px;
    padding: 6px 4px;
    border: 1px solid var(--qe-border);
    border-radius: var(--qe-r-sm);
    background: var(--qe-surface);
    color: var(--qe-text);
    font-family: inherit;
    outline: none;
  }
  .qe-svc-name-input {
    flex: 1;
    min-width: 0;
    font-size: 13px;
    padding: 6px 10px;
    border: 1px solid var(--qe-border);
    border-radius: var(--qe-r-sm);
    background: var(--qe-surface);
    color: var(--qe-text);
    font-family: inherit;
    outline: none;
  }
  .qe-svc-emoji-input:focus,
  .qe-svc-name-input:focus {
    border-color: color-mix(in srgb, var(--qe-accent) 60%, transparent);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--qe-accent) 14%, transparent);
  }
  .qe-svc-save,
  .qe-svc-add-btn {
    background: var(--qe-accent);
    color: #fff;
    border: none;
    border-radius: var(--qe-r-sm);
    font-family: inherit;
    font-size: 12px;
    font-weight: 700;
    padding: 7px 12px;
    cursor: pointer;
    transition: filter var(--qe-ease) 0.15s, transform var(--qe-ease) 0.15s;
  }
  .qe-svc-save:hover:not(:disabled),
  .qe-svc-add-btn:hover:not(:disabled) { filter: brightness(1.06); transform: translateY(-1px); }
  .qe-svc-save:disabled,
  .qe-svc-add-btn:disabled { opacity: 0.55; cursor: progress; }

  /* ── Phase B — group label chooser + drag & drop · Phase D AI button ─────── */
  .qe-group__labelwrap { display: inline-flex; align-items: center; gap: 4px; }
  .qe-group__labelsel { max-width: 190px; }
  .qe-label-manage-btn {
    border: 1px solid #e2e8f0; background: #fff; border-radius: 8px;
    width: 28px; height: 28px; cursor: pointer; font-size: 13px; line-height: 1;
    display: inline-flex; align-items: center; justify-content: center;
    color: #475569; transition: background .15s, border-color .15s, color .15s;
  }
  .qe-label-manage-btn:hover { background: #f0fdfe; border-color: rgba(2,181,187,.5); color: #0a7e82; }

  .qe-group { transition: box-shadow .16s ease, background .16s ease, border-color .16s ease; }
  .qe-group--dropactive {
    border-color: rgba(2,181,187,.65) !important;
    background: linear-gradient(135deg, rgba(2,181,187,.06) 0%, #f0fdfe 100%);
    box-shadow: 0 0 0 3px rgba(2,181,187,.14);
  }

  .qe-desc-cell { display: flex; align-items: center; gap: 6px; }
  .qe-drag-handle {
    cursor: grab; user-select: none; color: #94a3b8; font-size: 13px; line-height: 1;
    letter-spacing: -2px; padding: 2px 3px; border-radius: 5px; flex-shrink: 0;
    transition: color .15s, background .15s;
  }
  .qe-drag-handle:hover { color: #02b5bb; background: #f0fdfe; }
  .qe-drag-handle:active { cursor: grabbing; }

  .qe-group__empty {
    display: flex; align-items: center; justify-content: center; gap: 8px;
    padding: 18px 14px; margin: 4px 0 2px;
    border: 1.5px dashed #cbd5e1; border-radius: 12px;
    color: #64748b; font-size: 13px; font-weight: 600;
    background: repeating-linear-gradient(45deg, #f8fafc, #f8fafc 10px, #f1f5f9 10px, #f1f5f9 20px);
    transition: border-color .16s ease, color .16s ease, background .16s ease;
  }
  .qe-group--dropactive .qe-group__empty {
    border-color: rgba(2,181,187,.7); color: #0a7e82;
    background: linear-gradient(135deg, rgba(2,181,187,.08) 0%, #ecfeff 100%);
  }
  .qe-group__empty-icon { font-size: 15px; }

  /* ── Per-group client-visible service description ────────────────────────── */
  .qe-group__desc { display: flex; flex-direction: column; gap: 5px; }
  .qe-group__desc-label {
    display: inline-flex; align-items: center; gap: 4px;
    font-size: 11px; font-weight: 700; color: #94a3b8;
    text-transform: uppercase; letter-spacing: 0.08em;
  }
  .qe-group__desc-input { min-height: 46px; }


  .qe-ai-desc-btn {
    margin-left: auto; display: inline-flex; align-items: center; gap: 6px;
    border: 1px solid rgba(2,181,187,.35); background: linear-gradient(135deg,#f0fdfe,#ffffff);
    color: #0a7e82; font-size: 12px; font-weight: 700; padding: 4px 11px;
    border-radius: 999px; cursor: pointer; transition: box-shadow .16s, transform .16s, filter .16s;
  }
  .qe-ai-desc-btn:hover:not(:disabled) { box-shadow: 0 4px 14px -6px rgba(2,181,187,.6); transform: translateY(-1px); }
  .qe-ai-desc-btn:disabled { opacity: .55; cursor: not-allowed; }
  .qe-ai-spin {
    width: 11px; height: 11px; border-radius: 50%;
    border: 2px solid rgba(2,181,187,.3); border-top-color: #02b5bb;
    display: inline-block; animation: qeAiSpin .7s linear infinite;
  }
  @keyframes qeAiSpin { to { transform: rotate(360deg); } }
  .qe-field-hint--err { color: #dc2626; font-weight: 600; }

  /* ── Unsaved-draft restored banner ──────────────────────────────────────── */
  .qe-draft-banner {
    display: flex; align-items: center; justify-content: space-between; gap: 10px;
    padding: 8px 14px; border-radius: 10px;
    background: linear-gradient(135deg, #fffbeb 0%, #fefce8 100%);
    border: 1px solid #fde68a; color: #92400e;
    font-size: 12.5px; font-weight: 600;
  }
  .qe-draft-banner__discard {
    background: #fff; border: 1px solid #fcd34d; color: #92400e;
    border-radius: 999px; font-size: 11.5px; font-weight: 700;
    padding: 4px 12px; cursor: pointer; white-space: nowrap;
    transition: background .14s, border-color .14s;
  }
  .qe-draft-banner__discard:hover { background: #fef3c7; border-color: #f59e0b; }
  .qe-svc-del {
    background: var(--qe-surface);
    border: 1px solid var(--qe-border);
    border-radius: var(--qe-r-sm);
    color: var(--qe-text-dim);
    font-size: 13px;
    padding: 6px 8px;
    cursor: pointer;
    transition: background var(--qe-ease) 0.12s, border-color var(--qe-ease) 0.12s, color var(--qe-ease) 0.12s;
  }
  .qe-svc-del:hover:not(:disabled) {
    background: color-mix(in srgb, var(--qe-danger) 8%, transparent);
    border-color: color-mix(in srgb, var(--qe-danger) 30%, transparent);
    color: var(--qe-danger);
  }
  .qe-svc-add {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 4px;
    padding-top: 12px;
    border-top: 1px solid var(--qe-border);
  }


  /* ── Modal ───────────────────────────────────────────────────────────────── */
  .qe-tmpl-backdrop {
    position: fixed;
    inset: 0;
    z-index: 1000;
    background: color-mix(in srgb, var(--qe-accent-ink) 34%, transparent);
    backdrop-filter: blur(5px);
    -webkit-backdrop-filter: blur(5px);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    animation: qe-tmpl-fade 0.18s ease;
  }
  @keyframes qe-tmpl-fade { from { opacity: 0; } to { opacity: 1; } }

  .qe-tmpl-modal {
    width: min(760px, 100%);
    max-height: min(86vh, 720px);
    display: flex;
    flex-direction: column;
    background: var(--qe-surface);
    border: 1px solid color-mix(in srgb, var(--qe-accent) 16%, transparent);
    border-radius: var(--qe-r-lg);
    overflow: hidden;
    box-shadow: var(--qe-shadow-lg);
    animation: qe-tmpl-pop 0.2s var(--qe-ease);
  }
  @keyframes qe-tmpl-pop {
    from { opacity: 0; transform: translateY(10px) scale(0.985); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
  }

  .qe-tmpl-modal__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid var(--qe-border);
    background: linear-gradient(135deg, color-mix(in srgb, var(--qe-accent) 7%, transparent), transparent);
  }
  .qe-tmpl-modal__titlewrap { display: flex; align-items: center; gap: 10px; }
  .qe-tmpl-modal__spark {
    font-size: 14px;
    color: var(--qe-accent);
    filter: drop-shadow(0 0 6px color-mix(in srgb, var(--qe-accent) 40%, transparent));
  }
  .qe-tmpl-modal__title {
    margin: 0;
    font-size: 15px;
    font-weight: 800;
    letter-spacing: -0.02em;
    color: var(--qe-accent-ink);
  }
  .qe-tmpl-modal__close {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    border-radius: var(--qe-r-sm);
    border: 1px solid var(--qe-border);
    background: var(--qe-surface);
    color: var(--qe-text-dim);
    cursor: pointer;
    font-size: 13px;
    transition: background var(--qe-ease) 0.12s, color var(--qe-ease) 0.12s, border-color var(--qe-ease) 0.12s;
  }
  .qe-tmpl-modal__close:hover {
    background: color-mix(in srgb, var(--qe-danger) 8%, transparent);
    border-color: color-mix(in srgb, var(--qe-danger) 30%, transparent);
    color: var(--qe-danger);
  }

  .qe-tmpl-modal__body {
    display: grid;
    grid-template-columns: 248px 1fr;
    gap: 0;
    min-height: 0;
    flex: 1;
    overflow: hidden;
  }

  /* Saved templates column */
  .qe-tmpl-listcol {
    display: flex;
    flex-direction: column;
    border-right: 1px solid var(--qe-border);
    background: var(--qe-surface-2);
    min-height: 0;
  }
  .qe-tmpl-listcol__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 14px 8px;
  }
  .qe-tmpl-listcol__label,
  .qe-tmpl-formcol__label {
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.09em;
    text-transform: uppercase;
    color: var(--qe-text-dim);
  }
  .qe-tmpl-newbtn {
    background: color-mix(in srgb, var(--qe-accent) 8%, transparent);
    border: 1px solid color-mix(in srgb, var(--qe-accent) 22%, transparent);
    color: var(--qe-accent-hover);
    border-radius: var(--qe-r-xs);
    font-size: 11.5px;
    font-weight: 700;
    padding: 4px 10px;
    cursor: pointer;
    transition: background var(--qe-ease) 0.13s, border-color var(--qe-ease) 0.13s;
  }
  .qe-tmpl-newbtn:hover, .qe-tmpl-newbtn.is-active {
    background: color-mix(in srgb, var(--qe-accent) 16%, transparent);
    border-color: color-mix(in srgb, var(--qe-accent) 40%, transparent);
  }

  .qe-tmpl-empty {
    padding: 18px 14px;
    color: var(--qe-text-dim);
    font-size: 12px;
    line-height: 1.5;
  }

  .qe-tmpl-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 0 8px 12px;
    overflow-y: auto;
  }
  .qe-tmpl-row {
    display: flex;
    align-items: stretch;
    gap: 2px;
    border-radius: var(--qe-r-sm);
    border: 1px solid transparent;
    transition: background var(--qe-ease) 0.12s, border-color var(--qe-ease) 0.12s;
  }
  .qe-tmpl-row:hover { background: var(--qe-surface); border-color: var(--qe-border); }
  .qe-tmpl-row.is-editing {
    background: var(--qe-surface);
    border-color: color-mix(in srgb, var(--qe-accent) 40%, transparent);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--qe-accent) 10%, transparent);
  }
  .qe-tmpl-row__main {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
    align-items: flex-start;
    background: none;
    border: none;
    cursor: pointer;
    padding: 10px 10px;
    text-align: left;
    min-width: 0;
  }
  .qe-tmpl-row__name {
    font-size: 13px;
    font-weight: 700;
    color: var(--qe-text);
    display: flex;
    align-items: center;
    gap: 6px;
    max-width: 100%;
  }
  .qe-tmpl-badge {
    font-size: 8.5px;
    font-weight: 800;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: var(--qe-accent-hover);
    background: color-mix(in srgb, var(--qe-accent) 12%, transparent);
    border: 1px solid color-mix(in srgb, var(--qe-accent) 25%, transparent);
    border-radius: var(--qe-r-pill);
    padding: 1px 6px;
  }
  .qe-tmpl-row__meta { font-size: 11px; color: var(--qe-text-dim); }
  .qe-tmpl-row__del {
    align-self: center;
    background: none;
    border: none;
    color: var(--qe-text-faint);
    cursor: pointer;
    font-size: 13px;
    padding: 6px 10px;
    border-radius: var(--qe-r-sm);
    transition: background var(--qe-ease) 0.12s, color var(--qe-ease) 0.12s;
  }
  .qe-tmpl-row__del:hover {
    background: color-mix(in srgb, var(--qe-danger) 8%, transparent);
    color: var(--qe-danger);
  }

  /* Editor form column */
  .qe-tmpl-formcol {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 14px 16px 16px;
    overflow-y: auto;
    min-height: 0;
  }
  .qe-tmpl-formcol__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  }
  .qe-tmpl-fromlines {
    background: none;
    border: 1px dashed color-mix(in srgb, var(--qe-accent) 30%, transparent);
    color: var(--qe-accent-hover);
    border-radius: var(--qe-r-xs);
    font-size: 11px;
    font-weight: 700;
    padding: 4px 10px;
    cursor: pointer;
    transition: background var(--qe-ease) 0.13s, border-color var(--qe-ease) 0.13s;
  }
  .qe-tmpl-fromlines:hover {
    background: color-mix(in srgb, var(--qe-accent) 8%, transparent);
    border-color: color-mix(in srgb, var(--qe-accent) 50%, transparent);
  }

  .qe-tmpl-form__row { display: flex; gap: 10px; align-items: flex-end; }
  .qe-tmpl-form__field { display: flex; flex-direction: column; gap: 5px; }
  .qe-tmpl-form__field--grow { flex: 1; }
  .qe-tmpl-form__hint { text-transform: none; letter-spacing: 0; color: var(--qe-text-faint); font-weight: 600; margin-left: 4px; }
  .qe-tmpl-textarea {
    font-family: var(--qe-mono);
    font-size: 12.5px;
    line-height: 1.7;
    min-height: 180px;
  }

  .qe-tmpl-modal__foot {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 10px;
    padding: 14px 20px;
    border-top: 1px solid var(--qe-border);
    background: var(--qe-surface-2);
  }

  @media (max-width: 560px) {
    .qe-tmpl-modal__body { grid-template-columns: 1fr; }
    .qe-tmpl-listcol { border-right: none; border-bottom: 1px solid var(--qe-border); max-height: 180px; }
  }

  /* ── Save & submit for approval (combined action button) ─────────────────── */
  .qe-btn--submit {
    background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%);
    color: #fff;
    box-shadow: 0 2px 8px rgba(124,58,237,0.28);
  }
  .qe-btn--submit:not(:disabled):hover {
    filter: brightness(1.07);
    box-shadow: 0 4px 16px rgba(124,58,237,0.38);
    transform: translateY(-1px);
  }

  /* ── Approve with edits (approver action + confirm modal) ────────────────── */
  .btn-approve-edits {
    background: linear-gradient(135deg, #0d9488 0%, #0f766e 100%);
    color: #fff;
    border: none;
    padding: 10px 18px;
    border-radius: 8px;
    cursor: pointer;
    font-weight: 700;
    font-size: 13px;
    transition: filter 0.15s, box-shadow 0.15s;
    box-shadow: 0 2px 8px rgba(13,148,136,0.22);
  }
  .btn-approve-edits:hover:not(:disabled) {
    filter: brightness(1.08);
    box-shadow: 0 4px 14px rgba(13,148,136,0.30);
  }
  /* Dimmed (but still clickable) when there are no edits yet — clicking it
     surfaces the "no edits" notice rather than silently doing nothing. */
  .btn-approve-edits.is-dim {
    background: #f1f5f9;
    color: #94a3b8;
    box-shadow: none;
    border: 1px solid #e2e8f0;
  }
  .btn-approve-edits.is-dim:hover:not(:disabled) {
    filter: none;
    background: #e9eef4;
    color: #64748b;
    box-shadow: none;
  }

  /* Inline warning when an approver has unsaved edits. */

  .approver-editnote {
    margin: 0;
    font-size: 12px;
    line-height: 1.5;
    color: #92400e;
    background: linear-gradient(135deg, #fffbeb 0%, #fefce8 100%);
    border: 1px solid #fde68a;
    border-radius: 8px;
    padding: 8px 12px;
  }
  .approver-editnote strong { color: #78350f; font-weight: 800; }
  /* Neutral/info variant — shown when the approver clicks "Approve with edits"
     but hasn't actually changed anything yet. */
  .approver-editnote--info {
    color: #475569;
    background: #f8fafc;
    border-color: #e2e8f0;
  }


  /* ── Approve-with-edits confirm modal card ───────────────────────────────── */
  .qe-confirm-card {
    width: min(440px, 100%);
    background: var(--irp-surface, #fff);
    border: 1px solid rgba(0,0,0,0.08);
    border-radius: 16px;
    padding: 24px 24px 20px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.18), 0 4px 12px rgba(0,0,0,0.08);
    text-align: center;
    animation: qe-tmpl-pop 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  }
  .qe-confirm-icon {
    font-size: 30px;
    line-height: 1;
    margin-bottom: 10px;
  }
  .qe-confirm-title {
    margin: 0 0 8px;
    font-size: 16px;
    font-weight: 800;
    color: #0f172a;
    letter-spacing: -0.01em;
  }
  .qe-confirm-body {
    margin: 0 0 18px;
    font-size: 13px;
    line-height: 1.6;
    color: #475569;
  }
  .qe-confirm-body strong { color: #0f172a; font-weight: 700; }
  .qe-confirm-actions {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .qe-confirm-actions > button { width: 100%; justify-content: center; }
</style>

