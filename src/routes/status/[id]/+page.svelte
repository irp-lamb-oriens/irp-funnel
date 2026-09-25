<script lang="ts">
  import { onMount, onDestroy, tick } from "svelte";
  import { page } from "$app/stores";
  import Header from "../../../components/Header/Header.svelte";
  import Footer from "../../../components/Footer/Footer.svelte";
  import {
    isAuthenticated,
    isCheckingAuth,
    authEmail,
    reconstructEmailFromProjectId,
    project,
    loading,
    error,
    stages,
    stageLabels,
    requestClientOTP,
    verifyClientOTP,
    checkClientAuth,
    logout,
    fetchProject,
    loadLilyHistory,
    // ── Template proposal system ──────────────────────────────────────────
    templateBlocks,
    templateSections,
    activeSection,
    inferTemplate,
    loadTemplate,
    loadAllTemplates,
    allTemplates,
    allTemplatesLoading,
    setSelectedTemplate,
    selectedTemplateId,
    // ── Per-client proposal override (staff WYSIWYG edit on /status) ──────
    effectiveTemplateBlocks,
    hasProposalOverride,
    proposalOverrides,
    saveProposalOverride,
    resetProposalOverride,
    // ── Quotes (loaded early so hasQuotes drives tab/section visibility) ──
    quotes,

    quotesLoading,
    loadQuotes,
    // ── Client offer popup (dashboard-configured, shown once on access) ──
    clientOffer,

    // ── Destination services gate (country-gated extra tabs) ─────────────
    destinationServices,

    // ── Stage ratings (reused for the overall "move complete" review) ──────
    submitStageRating,
  } from "./store.ts";

  import LilyChat from "./LilyChat.svelte";
  import CommentsThread from "./CommentsThread.svelte";
  import StageRating from "./StageRating.svelte";
  import QuotePanel from "./QuotePanel.svelte";
  import QuoteAcceptance from "./QuoteAcceptance.svelte";
  import QuoteView from "./QuoteView.svelte";
  import BlockRenderer from "./BlockRenderer.svelte";
  import WysiwygEditor from "../../../lib/WysiwygEditor.svelte";
  import type { QuoteBlock } from "../../dashboard/store.ts";
  import EmailPreviewDrawer from "../../dashboard/components/EmailPreviewDrawer.svelte";

  import { presendEmail, fetchEmailPreview } from "../../dashboard/store.ts";
  import RegulationsLanding from "./RegulationsLanding.svelte";
  import ClientFieldsCard from "./ClientFieldsCard.svelte";
  import ChargesCard from "./ChargesCard.svelte";
  import ClientOfferPopup from "./ClientOfferPopup.svelte";
  import FullRelocationSupport from "./FullRelocationSupport.svelte";
  import RelocationTours from "./RelocationTours.svelte";
  import ImmigrationAdvice from "./ImmigrationAdvice.svelte";
  import InterculturalCoaching from "./InterculturalCoaching.svelte";
  import VerticalReviewMarquee from "../../../components/VerticalReviewMarquee.svelte";


  import {
    irpStaffIsAuthenticated,
    irpStaffEmail,
    checkIrpStaff,
    clearIrpStaff,
  } from "../../../lib/auth/irpStaff.ts";
  import { sendLilyMessage, updateProjectDetails, projectFieldFlags } from "./store.ts";

  import "./status.scss";

  $: projectId = $page.params.id;

  // Prefill the login email from the document id the moment the gate renders.
  // The doc id IS the client email with `@`/`.` → `_`, so anyone who already
  // holds this /status/:id URL can recover the same address. We only prefill
  // when there is nothing typed yet and no staff bypass happened, so the
  // client's registered address is waiting for them without an extra request.
  let loginEmailPrefilled = false;
  $: if (projectId && !loginEmailPrefilled && !loginEmailInput) {
    const recovered = reconstructEmailFromProjectId(projectId);
    if (recovered) {
      loginEmailPrefilled = true;
      loginEmailInput = recovered;
    }
  }

  // ─── Login State ────────────────────────────────────────────────────────
  let loginEmailInput = "";
  let loginCode = "";
  let loginStep: "email" | "code" = "email";
  let loginMessage = "";
  let loginError = "";
  let loginLoading = false;

  onMount(async () => {
    // ─── 0. Match portal background on the body so the pt-space gap above
    //        .client-portal doesn't expose the body background colour.
    document.body.style.setProperty("background-color", "#fbfcfc");

    // ─── 1. IRP organization-agent bypass ────────────────────────────────
    // If a /dashboard session is present, every /api/client-status request
    // is authorized via the `x-dashboard-token` header. Skip the OTP wall
    // entirely and load the project as if we were already signed in.
    const isStaff = await checkIrpStaff();
    if (isStaff) {
      isAuthenticated.set(true);
      isCheckingAuth.set(false);
      await fetchProject(projectId);
      await loadLilyHistory(projectId);
      // Load quotes early so hasQuotes is known before the first render tick.
      // This drives the tab-bar and section visibility (quote-gated sections).
      loadQuotes(projectId);
      scrollStepperToActive();
      return;
    }

    // ─── 2. Existing end-customer flow ───────────────────────────
    const valid = await checkClientAuth();
    if (valid) {
      await fetchProject(projectId);
      await loadLilyHistory(projectId);
      // Same quote pre-load for end-customers.
      loadQuotes(projectId);
      scrollStepperToActive();
    }
  });

  // ─── Login Handlers ─────────────────────────────────────────────────────────
  async function handleRequestOTP() {
    loginLoading = true;
    loginError = "";
    try {
      loginMessage = await requestClientOTP(loginEmailInput, projectId);
      loginStep = "code";
    } catch (err: any) {
      loginError = err.message;
    } finally {
      loginLoading = false;
    }
  }

  async function handleVerifyOTP() {
    loginLoading = true;
    loginError = "";
    try {
      await verifyClientOTP(loginEmailInput, projectId, loginCode);
      await fetchProject(projectId);
      await loadLilyHistory(projectId);
      loadQuotes(projectId);
      scrollStepperToActive();
    } catch (err: any) {
      loginError = err.message;
    } finally {
      loginLoading = false;
    }
  }

  onDestroy(() => {
    if (typeof document !== "undefined") {
      document.body.style.removeProperty("background-color");
    }
  });

  function handleLogout() {
    // Also clear the IRP-staff session so a logged-in agent is signed out
    // from /dashboard, /guides, and every other gated page in one click.
    // No-op for non-staff visitors.
    if ($irpStaffIsAuthenticated) clearIrpStaff();
    logout();
    loginStep = "email";
    loginCode = "";
    loginMessage = "";
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────
  function formatDate(iso: string): string {
    if (!iso) return "—";
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  function formatDateTime(iso: string): string {
    if (!iso) return "—";
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  // ─── Activity visual identity ─────────────────────────────────────────────
  // Each activity type gets a distinct icon + accent colour so the journey
  // timeline reads as a richly colour-coded story rather than a monotone list.
  // Keyword matching keeps it robust against the many concrete event names
  // (email_sent, email_suggested, quote_accepted, field_edit, …).
  function getActivityIcon(type: string): string {
    const t = (type || "").toLowerCase();
    if (t.includes("quote")) return "📋";
    if (t.includes("email")) return "📧";
    if (t === "stage_change" || t.includes("stage") || t.includes("moved")) return "→";
    if (t.includes("field")) return "✏️";
    if (t.includes("action")) return "⚡";
    if (t.includes("call") || t.includes("consult") || t.includes("resched")) return "📞";
    if (t.includes("payment") || t.includes("pay") || t.includes("refund")) return "💳";
    if (t.includes("note") || t.includes("comment")) return "📝";
    return "•";
  }

  /** Accent colour (hex) for an activity type — drives the node + card --k var. */
  function getActivityColor(type: string): string {
    const t = (type || "").toLowerCase();
    if (t.includes("quote")) return "#f5b50a";   // gold
    if (t.includes("email")) return "#0ea5e9";   // sky
    if (t === "stage_change" || t.includes("stage") || t.includes("moved")) return "#02b5bb"; // teal
    if (t.includes("field")) return "#f97316";   // orange
    if (t.includes("action")) return "#8b5cf6";  // violet
    if (t.includes("call") || t.includes("consult") || t.includes("resched")) return "#10b981"; // emerald
    if (t.includes("payment") || t.includes("pay") || t.includes("refund")) return "#16a34a"; // green
    if (t.includes("note") || t.includes("comment")) return "#64748b"; // slate
    return "#02b5bb";
  }


  function getActivityText(entry: any): string {
    switch (entry.type) {
      case "stage_change":
        return `Moved from <strong>${$stageLabels[entry.from] || entry.from}</strong> to <strong>${$stageLabels[entry.to] || entry.to}</strong>`;
      case "note_added":
        return "Note added to file";
      case "email_triggered":
        return `Sent communication: <strong>${entry.emailType}</strong>`;
      case "field_update":
        return `Updated information: <strong>${(entry.fields || []).join(", ")}</strong>`;
      case "action_executed":
        return `System action completed: <strong>${entry.actionKey}</strong>`;
      default:
        return entry.type;
    }
  }

  function formatKeyLabel(key: string): string {
    const result = key.replace(/([A-Z])/g, " $1").trim();
    return result.charAt(0).toUpperCase() + result.slice(1);
  }

  function isLongText(val: any): boolean {
    return typeof val === "string" && val.length > 60;
  }

  function isUrl(val: unknown): val is string {
    if (typeof val !== "string") return false;
    return val.startsWith("http://") || val.startsWith("https://");
  }

  function getStageTime(stageKey: string): string {
    if (!$project || !$project.activityLog) return "";
    const entry = $project.activityLog.find(
      (log: any) => log.type === "stage_change" && log.to === stageKey,
    );
    if (entry && entry.timestamp) {
      return formatDate(entry.timestamp);
    }
    if (stageKey === $stages[0] && $project.createdAt) {
      return formatDate($project.createdAt);
    }
    return "";
  }

  $: currentStageIndex = $project ? $stages.indexOf($project.stage) : -1;

  // Public Google review deep-link (mirrors server helper/reviewConfig.ts).
  // Shown to delighted clients once their move reaches the "completed" stage.
  const GOOGLE_REVIEW_URL =
    "https://www.google.com/search?q=international+relocation+partner&sca_esv=30fefba32417d577#lrd=0x8fa0fac744d6f277:0xb21f26ac180d3732,3,,,,";

  // ─── Overall "move complete" review ───────────────────────────────────────
  // When the project reaches the "completed" stage we ask the client for a
  // final overall rating + comment BEFORE inviting a public Google review.
  // This mirrors the standalone /review email flow: only delighted clients
  // (4–5★) are routed to Google; anyone who rates 3★ or below gets a heartfelt
  // "we'll make it right" message and the concern is surfaced to the team.
  // Persisted via the existing stage-rating mechanism under the synthetic
  // 'overall' key — it never collides with a real pipeline stage because stage
  // keys come from the $stages array, which has no 'overall' entry.
  const OVERALL_REVIEW_KEY = "overall";
  const OVERALL_STAR_LABELS = [
    "",
    "Poor",
    "Fair",
    "Good",
    "Great",
    "Excellent",
  ];
  // Ratings at or above this threshold are routed to the public Google review.
  const GOOGLE_REVIEW_THRESHOLD = 4;

  let overallStars = 0;
  let overallHover = 0;

  // ── Section collapsibles ──────────────────────────────────────────────────
  let detailsOpen = false;
  let activityOpen = false;
  let regulationsOpen = false;

  // ── Client project details editing ───────────────────────────────────────
  let editingDetails = false;
  let detailsSaving = false;
  let detailsEditError = '';
  let detailsEditForm = {
    originCity: '', originCountry: '',
    destinationCity: '', destinationCountry: '',
    size: '', immigrationStatus: '',
    propertyTypeFrom: '', propertyTypeTo: '',
  };

  function startEditDetails() {
    detailsEditForm = {
      originCity: $project?.originCity ?? '',
      originCountry: $project?.originCountry ?? '',
      destinationCity: $project?.destinationCity ?? '',
      destinationCountry: $project?.destinationCountry ?? '',
      size: $project?.size ?? '',
      immigrationStatus: $project?.immigrationStatus ?? '',
      propertyTypeFrom: $project?.propertyTypeFrom ?? '',
      propertyTypeTo: $project?.propertyTypeTo ?? '',
    };
    editingDetails = true;
    detailsOpen = true;
  }
  function cancelEditDetails() { editingDetails = false; detailsEditError = ''; }
  async function saveDetails() {
    detailsSaving = true; detailsEditError = '';
    try {
      await updateProjectDetails(projectId, detailsEditForm);
      editingDetails = false;
    } catch (err: any) {
      detailsEditError = err?.message ?? 'Failed to save changes.';
    } finally { detailsSaving = false; }
  }

  // ── Project Details field flags (from the centralized Overview Field Registry)
  // Each built-in tile's visibility + editability is now operator-configurable
  // via Automations → Overview fields. `$projectFieldFlags` is `{}` on older
  // servers / cold start, so every flag falls back to its LEGACY default
  // (visible: true; route/size/immigration/property editable, budget/vehicles
  // read-only) — the exact pre-registry behavior. Fully backward compatible.
  $: pff = $projectFieldFlags || {};
  $: routeVisible        = pff.route?.visible ?? true;
  $: routeEditable       = pff.route?.editable ?? true;
  $: budgetVisible       = pff.budget?.visible ?? true;
  $: sizeVisible         = pff.size?.visible ?? true;
  $: sizeEditable        = pff.size?.editable ?? true;
  $: immigrationVisible  = pff.immigrationStatus?.visible ?? true;
  $: immigrationEditable = pff.immigrationStatus?.editable ?? true;
  $: propertyVisible     = pff.property?.visible ?? true;
  $: propertyEditable    = pff.property?.editable ?? true;
  $: vehiclesVisible     = pff.vehicles?.visible ?? true;
  // The "Edit" affordance only appears when at least one tile is client-editable.
  $: anyDetailEditable   = routeEditable || sizeEditable || immigrationEditable || propertyEditable;


  let overallComment = "";
  let overallSubmitting = false;
  let overallError = "";

  // The persisted overall review (undefined until the client submits one).
  $: overallReview = ($project?.stageRatings ?? {})[OVERALL_REVIEW_KEY] as
    | { rating: number; note?: string }
    | undefined;
  // Only the principal end-customer can submit. Staff / non-principal viewers
  // see the read-only result (or the legacy thank-you banner if none yet).
  $: canSubmitOverallReview =
    !!$project?.viewerIsPrincipal && !$irpStaffIsAuthenticated;

  async function submitOverallReview() {
    if (overallStars < 1 || overallSubmitting) return;
    overallSubmitting = true;
    overallError = "";
    try {
      await submitStageRating(
        projectId,
        OVERALL_REVIEW_KEY,
        overallStars,
        overallComment.trim() || undefined,
      );
    } catch (err: any) {
      overallError =
        err?.message || "We could not save your review. Please try again.";
    } finally {
      overallSubmitting = false;
    }
  }

  // ─── Upcoming consultation (future only) ─────────────────────────────────

  // We only show the call banner if there is at least one scheduling date that
  // has NOT yet passed. Past dates are silently ignored.
  $: upcomingConsultation = (() => {
    const now = Date.now();
    return (
      ($project?.scheduling ?? []).find(
        (d: string) => new Date(d).getTime() > now,
      ) ?? null
    );
  })();

  // ─── Section scroll ─────────────────────────────────────────────────────────
  /**
   * Smooth-scrolls the horizontal stepper to the active step so clients
   * immediately see their current stage without manually scrolling.
   */
  async function scrollStepperToActive() {
    await tick();
    if (typeof document === "undefined") return;
    const activeStep = document.querySelector(
      ".stepper .step.active",
    ) as HTMLElement | null;
    if (activeStep) {
      activeStep.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "center",
      });
    }
  }

  /**
   * Smooth-scrolls to a section anchor by id.
   * CSS `scroll-margin-top` on the target element compensates for the fixed header.
   */
  function scrollToSection(id: string) {
    if (typeof window === "undefined") return;
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // ─── Lily FAB state ─────────────────────────────────────────────────────────
  let lilyOpen = false;

  // ─── Client offer popup (shown once per browser after access) ─────────────
  // The server only sends `$clientOffer` (non-null) to END-CUSTOMERS when an
  // operator has enabled it — staff viewers always get null. We additionally
  // gate on `!$irpStaffIsAuthenticated` for defense-in-depth, and remember the
  // dismissal per project id in localStorage so it appears once per browser.
  let offerChecked = false;
  let showOffer = false;
  const offerStorageKey = (id: string) => `irp_offer_dismissed_${id}`;

  $: if (
    !offerChecked &&
    $clientOffer &&
    $project &&
    $isAuthenticated &&
    !$irpStaffIsAuthenticated
  ) {
    offerChecked = true;
    let dismissed = false;
    try {
      dismissed =
        typeof localStorage !== "undefined" &&
        localStorage.getItem(offerStorageKey(projectId)) === "1";
    } catch { /* private-mode / storage disabled — treat as not dismissed */ }
    if (!dismissed) showOffer = true;
  }

  function dismissOffer() {
    showOffer = false;
    try {
      localStorage.setItem(offerStorageKey(projectId), "1");
    } catch { /* non-fatal */ }
  }


  // ─── Staff email preview (Quotes tab) ────────────────────────────────────────
  // Allows IRP staff to preview and send the pricing_summary email directly
  // from the client portal. Uses the same EmailPreviewDrawer as the dashboard —
  // it reacts to the presendEmail global store being set.
  let emailPreviewing = false;
  async function previewQuoteEmail() {
    if (!projectId) return;
    emailPreviewing = true;
    try {
      const preview = await fetchEmailPreview(projectId, "pricing_summary");
      presendEmail.set({
        clientId: projectId,
        emailType: "pricing_summary",
        clientEmail: (preview as any).clientEmail,
        subject: (preview as any).subject,
        bodyHtml: (preview as any).bodyHtml,
        context: (preview as any).context,
      });
    } catch (err: any) {
      console.error("[status] previewQuoteEmail error:", err);
    } finally {
      emailPreviewing = false;
    }
  }

  // ─── Active portal tab ───────────────────────────────────────────────────────
  // Tracks which tab the header highlights. Starts on 'Your Move' overview.
  // handleTabChange is the single entry-point for both user clicks and auto-nav.
  let activePortalTab = "__overview";

  function handleTabChange(id: string) {
    activePortalTab = id;
    if (id === "__overview") {
      scrollToSection("cp-overview");
    } else if (id === "__comments") {
      scrollToSection("cp-comments");
    } else if (id === "__support") {
      scrollToSection("cp-support");
    } else if (id === "__quotes") {
      scrollToSection("cp-quotes");
    } else if (id === "__accept") {
      scrollToSection("cp-accept");
    } else if (id === "__tours") {
      scrollToSection("cp-tours");
    } else if (id === "__immigration") {
      scrollToSection("cp-immigration");
    } else if (id === "__coaching") {
      scrollToSection("cp-coaching");
    } else {
      // Template document section — filter BlockRenderer + scroll to container
      activeSection.set(id);
      scrollToSection("cp-proposal");
    }
  }

  // ─── hasQuotes ───────────────────────────────────────────────────────────────
  // Gates the template proposal section, quotes section, and the related tabs.
  // Quotes are loaded early in onMount so this is resolved quickly.
  $: hasQuotes = $quotes.length > 0;
  $: hasQuoteToken = !!$page.url.searchParams.get("quoteToken");
  // hasAssignedProposal — true when a proposal template has been assigned to
  // this client (mapped from the destination, or a staff override) AND its
  // blocks have loaded. This lets the proposal document render right after the
  // overview/activity section even BEFORE any quote exists. Staff always see it
  // (preview), since their session auto-infers a template when none is mapped.
  $: hasAssignedProposal =
    $effectiveTemplateBlocks.length > 0 &&
    (!!($project as any)?.selectedQuoteTemplateId || $irpStaffIsAuthenticated);


  // showQuoteSection — gates the Quote tab and all quote-related sections.
  // True when either the subcollection has displayable quotes OR a quoteToken
  // (pre-generated, sent-to-client quote) is present in the URL.
  $: showQuoteSection = hasQuotes || hasQuoteToken;

  // showAcceptSection — gates the dedicated "Accept" tab/section (QuoteAcceptance,
  // the subcollection acceptance flow). It is DISTINCT from the token flow: a
  // ?quoteToken link renders QuoteView, which already contains its own inline
  // accept form. Mounting QuoteAcceptance alongside it produced a duplicate
  // "Quote not ready yet" card, so the token flow owns acceptance exclusively.
  $: showAcceptSection = hasQuotes && !hasQuoteToken;


  // ─── Template Proposal — auto-load after data is ready ───────────────────────
  $: if (
    $project &&
    !$templateBlocks.length &&
    !$allTemplatesLoading &&
    !$selectedTemplateId
  ) {
    const tid: string | null =
      ($project as any).selectedQuoteTemplateId ?? null;
    if (tid) {
      loadTemplate(tid);
    } else if ($irpStaffIsAuthenticated) {
      inferTemplate(projectId);
    } else {
      loadTemplate("irp-standard-proposal");
    }
  }
  $: if (
    $irpStaffIsAuthenticated &&
    $project &&
    !$allTemplates.length &&
    !$allTemplatesLoading
  ) {
    loadAllTemplates();
  }

  // ─── Auto-select Quotes tab when quotes become available ──────────────────
  // Once the quotes array loads (hasQuotes transitions false → true), we auto-
  // select the Quotes tab and scroll the client there so the quote is the first
  // thing they see.  The guard ensures this fires only once per page load.
  let _quotesAutoSelected = false;
  $: if (showQuoteSection && !_quotesAutoSelected) {
    _quotesAutoSelected = true;
    activePortalTab = "__quotes";
    setTimeout(() => scrollToSection("cp-quotes"), 400);
  }

  // ─── Portal tab bar ──────────────────────────────────────────────────────────
  // With quotes:    [ Your Move ] [ ...template sections ] [ Quote ]
  // Without quotes: [ Your Move ] only
  // ─── Portal tab bar ─────────────────────────────────────────────────────────
  // Rules (backward-compatible):
  //  • Template-section tabs and Accept tab are gated on `hasQuotes` (unchanged).
  //  • The Quote tab is additionally gated on `showQuoteSection` so clients who
  //    arrive via a ?quoteToken email link see the Quote tab immediately — even
  //    before the subcollection quotes appear as 'received'.
  $: proposalTabs = [
    { id: "__overview", label: "Your Move" },
    // Comments is always available — clients (and staff) can leave a note at
    // any stage; it lives in its own tab so the overview stays focused.
    { id: "__comments", label: "Comments" },
    // Full relocation support — the deep service catalogue (immigration,
    // settling in, vehicle/pet/business) kept inside the portal, never public.
    // Also never shown to staff viewing the portal (internal info).
    ...(!$irpStaffIsAuthenticated
      ? [{ id: "__support", label: "Full support" }]
      : []),
    // Destination services — extra page-level tabs surfaced only when the
    // client's destination country is in the operator-configured list
    // (e.g. Costa Rica). Shown to both clients and staff (staff preview).
    ...($destinationServices
      ? [
          { id: "__tours", label: "Relocation tours" },
          { id: "__immigration", label: "Immigration advice" },
          { id: "__coaching", label: "Intercultural coaching" },
        ]
      : []),
    ...(showQuoteSection
      ? [
          // Template-section tabs only when subcollection quotes exist (unchanged).
          ...(hasQuotes
            ? ($templateSections as string[]).map((s: string) => ({
                id: s,
                label: s,
              }))
            : []),
          { id: "__quotes", label: "Quote" },
          // Accept tab — only the subcollection acceptance flow (showAcceptSection).
          // The token flow (?quoteToken) renders QuoteView with its own inline
          // accept form under the Quote tab, so a separate Accept tab there would
          // point at a non-rendered #cp-accept and duplicate the acceptance UI.
          ...(showAcceptSection ? [{ id: "__accept", label: "Accept" }] : []),


        ]
      : []),
  ];

  // ─── Tab visibility helpers ───────────────────────────────────────────────────
  // isOverviewTab / isQuoteTab / isAcceptTab — use showQuoteSection (token-based
  //   quote link also activates the Quote + Accept tabs immediately, resilient to
  //   a slow/failed subcollection quotes fetch).
  // isProposalTab — uses hasQuotes (unchanged: template-section tabs only appear
  //   when subcollection quotes exist, preserving the existing proposal flow).
  $: isCommentsTab = activePortalTab === "__comments";
  $: isOverviewTab =
    !isCommentsTab && (activePortalTab === "__overview" || !showQuoteSection);
  $: isQuoteTab = showQuoteSection && activePortalTab === "__quotes";
  $: isAcceptTab = showAcceptSection && activePortalTab === "__accept";
  $: isToursTab = !!$destinationServices && activePortalTab === "__tours";
  $: isImmigrationTab = !!$destinationServices && activePortalTab === "__immigration";
  $: isCoachingTab = !!$destinationServices && activePortalTab === "__coaching";


  $: isProposalTab =
    hasQuotes &&
    !isOverviewTab &&
    !isQuoteTab &&
    !isAcceptTab &&
    !isCommentsTab &&
    !isToursTab &&
    !isImmigrationTab &&
    !isCoachingTab;

  // Always use portal-tabs when the project is loaded so the "Your Move" tab
  // is available even before quotes arrive.
  $: headerMode = $project ? ("portal-tabs" as const) : ("website" as const);

  // Minimal quote stub for BlockRenderer when rendering a template preview
  const templateStubQuote: any = {
    quoteId: "template-preview",
    consultationId: projectId,
    title: "Proposal Preview",
    lineItems: [],
    currency: "USD",
    total: 0,
    providerIds: [],
    providerSnapshots: [],
    notes: null,
    status: "draft",
    approvers: [],
    approvals: [],
    // comments: [],
    changeLog: [],
    clientVisible: false,
    sentToClientAt: null,
    clientToken: null,
    clientAcceptedAt: null,
    clientAcceptedBy: null,
    createdAt: new Date().toISOString(),
    createdBy: "system",
    updatedAt: null,
  };

  /**
   * Opens the Lily drawer and auto-sends a deep-link prompt.
   * Called by RegulationsLanding "Ask Lily →" buttons.
   */
  function handleLilyDeepLink(prompt: string) {
    lilyOpen = true;
    setTimeout(() => {
      sendLilyMessage(projectId, prompt);
    }, 400);
  }

  // ─── Staff proposal WYSIWYG edit (per-client override) ───────────────────────
  // Staff can rewrite the proposal document for THIS client only, right here on
  // the status page, using the SAME WysiwygEditor as the dashboard Templates tab.
  // Saving stores the edited blocks under the client's consultation doc (keyed by
  // the currently-selected templateId) — the shared quote_templates document is
  // never touched. Clients then see the personalized `effectiveTemplateBlocks`.
  let editingProposal = false;
  let editableProposalBlocks: QuoteBlock[] = [];
  let proposalSaving = false;
  let proposalSaveMsg = "";
  let proposalSaveError = "";

  function startEditProposal() {
    // Deep-copy the current EFFECTIVE blocks so Cancel can discard cleanly.
    editableProposalBlocks = ($effectiveTemplateBlocks ?? []).map((b) => ({ ...b }));
    editingProposal = true;
    proposalSaveMsg = "";
    proposalSaveError = "";
  }

  function cancelEditProposal() {
    editingProposal = false;
    editableProposalBlocks = [];
    proposalSaveMsg = "";
    proposalSaveError = "";
  }

  async function handleSaveProposal() {
    const tid = $selectedTemplateId;
    if (!tid || !projectId) return;
    proposalSaving = true;
    proposalSaveMsg = "";
    proposalSaveError = "";
    try {
      await saveProposalOverride(projectId, tid, editableProposalBlocks);
      editingProposal = false;
      proposalSaveMsg = "✓ Saved — this client now sees your customized proposal.";
    } catch (err: any) {
      proposalSaveError = "✗ " + (err?.message ?? "Save failed");
    } finally {
      proposalSaving = false;
    }
  }

  async function handleResetProposal() {
    const tid = $selectedTemplateId;
    if (!tid || !projectId) return;
    if (!confirm("Reset this client's proposal back to the shared template? Your custom edits for this template will be lost.")) return;
    proposalSaving = true;
    proposalSaveError = "";
    try {
      await resetProposalOverride(projectId, tid);
      proposalSaveMsg = "✓ Reset to the shared template.";
      if (editingProposal) {
        // Re-seed the editor from the freshly-reverted (shared) blocks.
        editableProposalBlocks = ($templateBlocks ?? []).map((b) => ({ ...b }));
      }
    } catch (err: any) {
      proposalSaveError = "✗ " + (err?.message ?? "Reset failed");
    } finally {
      proposalSaving = false;
    }
  }
</script>


<svelte:head>
  <title>Client Portal | IRP</title>
  <meta name="robots" content="noindex, nofollow" />
</svelte:head>

<!--
  Portal-tabs: always shown when a project is loaded, even without proposals.
  The tab list is conditional:
    • No quotes  → [ Your Move ] only
    • Has quotes → [ Your Move ] [ template sections… ] [ Quotes ]
-->
<Header
  mode={headerMode}
  tabs={proposalTabs}
  activeTab={activePortalTab}
  on:tabchange={(e) => handleTabChange(e.detail)}
/>

<div class="client-portal">
  {#if $isCheckingAuth || ($isAuthenticated && $loading && !$project)}
    <div class="cp-auth-wall" style="background: transparent;">
      <div style="text-align: center;">
        <div
          class="spinner"
          style="border: 3px solid rgba(0,0,0,0.1); border-left-color: var(--color-highlight-2); width: 40px; height: 40px; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 1rem;"
        ></div>
        <p>Loading your project...</p>
      </div>
    </div>
  {:else if !$isAuthenticated}
    <!-- ═══════════════════════ LOGIN GATE ═══════════════════════ -->
    <div class="cp-auth-wall">
      <div class="cp-auth-wall__card">
        <span class="cp-auth-wall__icon">🌍</span>
        <h1 class="cp-auth-wall__title">Your Relocation Portal</h1>
        <p class="cp-auth-wall__subtitle">
          Track your move, view your quote, and chat with our team — all in one
          place
        </p>

        {#if loginStep === "email"}
          <form
            on:submit|preventDefault={handleRequestOTP}
            class="cp-auth-wall__form"
          >
            <div class="cp-auth-wall__input-group">
              <label for="email">Email Address</label>
              <input
                id="email"
                type="email"
                bind:value={loginEmailInput}
                placeholder="your.email@example.com"
                required
                class="cp-auth-wall__input"
                autocomplete="email"
                autocapitalize="none"
              />
            </div>
            <button
              type="submit"
              class="cp-auth-wall__btn"
              disabled={loginLoading || !loginEmailInput.trim()}
            >
              {loginLoading ? "Verifying…" : "Continue"}
            </button>
          </form>
        {:else}
          <form
            on:submit|preventDefault={handleVerifyOTP}
            class="cp-auth-wall__form"
          >
            <p style="margin-bottom: 0.5rem; color: #475569;">
              Code sent to <strong>{loginEmailInput}</strong>
            </p>
            <div class="cp-auth-wall__input-group">
              <label for="code">6-Digit Code</label>
              <input
                id="code"
                type="text"
                bind:value={loginCode}
                placeholder="000000"
                maxlength="6"
                required
                class="cp-auth-wall__input cp-auth-wall__input--code"
                autocomplete="one-time-code"
                inputmode="numeric"
              />
            </div>
            <button
              type="submit"
              class="cp-auth-wall__btn"
              disabled={loginLoading || loginCode.length !== 6}
            >
              {loginLoading ? "Verifying…" : "Access Portal"}
            </button>
            <button
              type="button"
              class="cp-auth-wall__back"
              on:click={() => {
                loginStep = "email";
                loginError = "";
              }}
            >
              ← Use a different email
            </button>
          </form>
        {/if}

        {#if loginError}
          <div class="cp-auth-wall__error">{loginError}</div>
        {/if}
        {#if loginMessage && loginStep === "code"}
          <div class="cp-auth-wall__success">{loginMessage}</div>
        {/if}

        <div class="cp-auth-wall__security-note">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            ><rect x="3" y="11" width="18" height="11" rx="2" ry="2"
            ></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg
          >
          <span style="text-align: left;"
            >Only IRP staff and the email registered to this project can access
            this page. The login code can only be sent to the email saved on
            your relocation file.</span
          >
        </div>
      </div>
    </div>
  {:else if $error && !$project}
    <div class="cp-dashboard">
      <div
        style="background: #fef2f2; color: #dc2626; padding: 2rem; border-radius: 12px; text-align: center; border: 1px solid #fca5a5;"
      >
        <h2>Access Denied</h2>
        <p style="margin-top: 1rem;">{$error}</p>
        <button
          class="cp-auth-wall__btn"
          style="max-width: 200px; margin-top: 1.5rem;"
          on:click={handleLogout}>Back to Login</button
        >
      </div>
    </div>
  {:else if $project}
    <!-- ═══════════════════════ DASHBOARD PORTAL ═══════════════════════ -->
    <div class="cp-dashboard">
      <!-- ══ HERO HEADER ═══════════════════════════════════════════════════ -->
      <header class="cp-dashboard__header">
        <div class="cp-dashboard__header-overlay"></div>
        <div class="cp-dashboard__header-content">
          <div class="cp-dashboard__header-main">
            <h1 class="cp-dashboard__header-title">Hello, {$project.name}</h1>
            <div class="cp-dashboard__header-route">
              <span class="route-point"
                >{$project.originCountry || "Origin"}</span
              >
              <svg
                class="route-arrow"
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                ><path d="M5 12h14"></path><path d="m12 5 7 7-7 7"></path></svg
              >
              <span class="route-point"
                >{$project.destinationCountry || "Destination"}</span
              >
            </div>
          </div>
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            {#if $irpStaffIsAuthenticated}
              <span
                class="cp-dashboard__header-staff-pill"
                title="You are viewing this client portal as an IRP organization agent (signed in via /dashboard)."
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  ><path
                    d="M12 15c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4z"
                  ></path><path
                    d="M20.188 10.934c.388.756.612 1.612.612 2.566 0 4.418-3.582 8-8 8a7.962 7.962 0 0 1-5.5-2.187"
                  ></path></svg
                >
                Staff bypass{#if $irpStaffEmail}
                  · {$irpStaffEmail}{/if}
              </span>
            {/if}
            <button class="cp-dashboard__header-logout" on:click={handleLogout}>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                ><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"
                ></path><polyline points="16 17 21 12 16 7"></polyline><line
                  x1="21"
                  y1="12"
                  x2="9"
                  y2="12"
                ></line></svg
              >
              Log Out
            </button>
          </div>
        </div>
      </header>

      <!-- ══ YOUR MOVE — always rendered (single-landing). Tabs scroll here. -->
      {#if $project}
        <div id="cp-overview" class="cp-section-anchor">
          <!-- Consultation call banner — only shown for FUTURE dates ──────── -->
          {#if upcomingConsultation}
            <section class="cp-call-banner">
              <div class="cp-call-banner__inner">
                <div class="cp-call-banner__info">
                  <span class="cp-call-banner__eyebrow"
                    >📅 Upcoming Consultation</span
                  >
                  <h2 class="cp-call-banner__title">
                    Your consultation call is scheduled
                  </h2>
                  <p class="cp-call-banner__time">
                    {formatDateTime(upcomingConsultation)}
                  </p>
                  <p class="cp-call-banner__subtitle">
                    This is your <strong>Relocation Portal</strong> — your central
                    hub throughout your entire international move.
                  </p>
                </div>
                {#if $project.hangoutLink || $project.meetCode}
                  <a
                    href={$project.hangoutLink ||
                      `https://meet.google.com/${String($project.meetCode)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    class="cp-call-banner__join-btn"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2.5"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      aria-hidden="true"
                      ><polygon points="23 7 16 12 23 17 23 7"></polygon><rect
                        x="1"
                        y="5"
                        width="15"
                        height="14"
                        rx="2"
                        ry="2"
                      ></rect></svg
                    >
                    Join Consultation Call
                  </a>
                {/if}
              </div>
            </section>
          {/if}

          <!-- Status pipeline + inline comments ───────────────────────────── -->
          <section class="cp-dashboard__pipeline">
            <h3>Current Status</h3>
            <div style="overflow-x: auto; padding-bottom: 1rem;">
              <div class="stepper">
                {#each $stages as stageKey, idx}
                  <div
                    class="step"
                    class:completed={idx < currentStageIndex}
                    class:active={idx === currentStageIndex}
                    class:rate-prompt={idx === currentStageIndex - 1 &&
                      !($project?.stageRatings ?? {})[stageKey] &&
                      $project?.viewerIsPrincipal}
                  >
                    <div class="step__circle"></div>
                    <div class="step__label">
                      {$stageLabels[stageKey] || stageKey}
                    </div>
                    {#if getStageTime(stageKey)}
                      <div class="step__date">{getStageTime(stageKey)}</div>
                    {/if}
                    {#if idx < currentStageIndex}
                      <div class="step__rating">
                        <StageRating
                          {projectId}
                          {stageKey}
                          readonly={$irpStaffIsAuthenticated ||
                            !$project?.viewerIsPrincipal}
                        />
                      </div>
                    {/if}
                  </div>
                {/each}
              </div>
            </div>
          </section>

          <!-- Move complete → rate first, then (if delighted) invite a Google review -->
          {#if $project.stage === "completed"}
            {@const reviewed = overallReview}
            {@const goodReview =
              !!reviewed && reviewed.rating >= GOOGLE_REVIEW_THRESHOLD}
            <section id="cp-review" class="cp-section-anchor cp-review-banner">
              {#if !reviewed && canSubmitOverallReview}
                <!-- ── Step 1: rate dual-input form (stars + comment) ────────── -->
                <div class="cp-review-banner__stars" aria-hidden="true">
                  ⭐️⭐️⭐️⭐️⭐️
                </div>
                <h3 class="cp-review-banner__title">
                  Your move is complete — how did we do?
                </h3>
                <p class="cp-review-banner__text">
                  Your relocation is finished. Before anything else, we'd love
                  to hear how the journey felt — your honest rating helps us,
                  and the next family making the same leap.
                </p>

                <div class="cp-review-form">
                  <div
                    class="cp-review-form__stars"
                    role="radiogroup"
                    aria-label="Rate your overall experience from 1 to 5 stars"
                  >
                    {#each [1, 2, 3, 4, 5] as n}
                      <button
                        type="button"
                        class="cp-review-form__star"
                        class:cp-review-form__star--on={(overallHover ||
                          overallStars) >= n}
                        role="radio"
                        aria-checked={overallStars === n}
                        aria-label={`${n} star${n > 1 ? "s" : ""}`}
                        disabled={overallSubmitting}
                        on:mouseenter={() => (overallHover = n)}
                        on:mouseleave={() => (overallHover = 0)}
                        on:focus={() => (overallHover = n)}
                        on:blur={() => (overallHover = 0)}
                        on:click={() => (overallStars = n)}>★</button
                      >
                    {/each}
                  </div>
                  <p class="cp-review-form__star-label">
                    {OVERALL_STAR_LABELS[overallHover || overallStars] ||
                      "Tap a star"}
                  </p>

                  <textarea
                    class="cp-review-form__textarea"
                    rows="4"
                    placeholder="Tell us about your experience (optional)"
                    bind:value={overallComment}
                    disabled={overallSubmitting}
                  ></textarea>

                  {#if overallError}
                    <p class="cp-review-form__error">{overallError}</p>
                  {/if}

                  <button
                    class="cp-review-banner__btn cp-review-form__submit"
                    type="button"
                    disabled={overallSubmitting || overallStars < 1}
                    on:click={submitOverallReview}
                  >
                    {overallSubmitting ? "Sending…" : "Submit my review"}
                  </button>
                </div>
              {:else if reviewed}
                <!-- ── Step 2: their review + thank-you / next-step, side by side ─ -->
                <div class="cp-review-result">
                  <!-- The review they left -->
                  <div class="cp-review-result__feedback">
                    <span class="cp-review-result__eyebrow">Your review</span>
                    <span
                      class="cp-review-result__stars"
                      aria-label={`${reviewed.rating} out of 5 stars`}
                    >
                      {#each [1, 2, 3, 4, 5] as n}
                        <span
                          class="cp-review-result__star cp-review-result__star--{n <=
                          reviewed.rating
                            ? 'on'
                            : 'off'}">★</span
                        >
                      {/each}
                    </span>
                    {#if reviewed.note}
                      <p class="cp-review-result__note">“{reviewed.note}”</p>
                    {/if}
                  </div>

                  <!-- Thank-you + next step -->
                  <div class="cp-review-result__cta">
                    {#if goodReview}
                      <div class="cp-review-banner__stars" aria-hidden="true">
                        ⭐️⭐️⭐️⭐️⭐️
                      </div>
                      <h3 class="cp-review-banner__title">
                        Your move is complete — thank you!
                      </h3>
                      <p class="cp-review-banner__text">
                        So glad we got it right. If we made your relocation
                        smoother, the kindest thing you can do is share it on
                        Google — it takes less than a minute and helps the next
                        family taking the same leap.
                      </p>
                      <a
                        class="cp-review-banner__btn"
                        href={GOOGLE_REVIEW_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Leave a Google review →
                      </a>
                    {:else}
                      <div class="cp-review-banner__stars" aria-hidden="true">
                        🤝
                      </div>
                      <h3 class="cp-review-banner__title">
                        Thank you for your honesty
                      </h3>
                      <p class="cp-review-banner__text">
                        We've shared your feedback directly with your relocation
                        team, and someone will reach out personally to make
                        things right. We genuinely appreciate the chance to do
                        better.
                      </p>
                    {/if}
                  </div>
                </div>
              {:else}
                <!-- ── Staff / non-principal viewer, no review yet ─────────────
                   The public Google-review CTA is intentionally withheld until
                   the client has actually submitted their overall review (and
                   only when it's a good one). Here we just acknowledge the
                   completed move and note we're awaiting their feedback. -->
                {#if $irpStaffIsAuthenticated}
                  <!-- ── Staff insight card — ultra-modern "awaiting review" state ── -->
                  <div class="cp-review-staff">
                    <span class="cp-review-staff__eyebrow">
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>
                      Staff view · Awaiting review
                    </span>
                    <div class="cp-review-staff__icon" aria-hidden="true">⏳</div>
                    <h3 class="cp-review-staff__title">Awaiting the client's overall review</h3>
                    <p class="cp-review-staff__text">
                      The client hasn't rated their relocation yet. The moment they do, the
                      outcome routes automatically — no manual step on your end.
                    </p>
                    <div class="cp-review-staff__flow">
                      <div class="cp-review-staff__step cp-review-staff__step--good">
                        <span class="cp-review-staff__step-badge">4–5★</span>
                        <span class="cp-review-staff__step-label">Public Google review is unlocked for the client</span>
                      </div>
                      <div class="cp-review-staff__step cp-review-staff__step--low">
                        <span class="cp-review-staff__step-badge">1–3★</span>
                        <span class="cp-review-staff__step-label">Routed to private recovery — the concern is flagged to the team</span>
                      </div>
                    </div>
                  </div>
                {:else}
                  <div class="cp-review-banner__stars" aria-hidden="true">
                    ⭐️⭐️⭐️⭐️⭐️
                  </div>
                  <h3 class="cp-review-banner__title">
                    Your move is complete — thank you!
                  </h3>
                  <p class="cp-review-banner__text">
                    Thank you for trusting us with your relocation. We'd love to
                    hear how it went — your relocation lead will make sure your
                    feedback reaches the right people.
                  </p>
                {/if}
              {/if}
            </section>
          {/if}

          <!-- Regulations, Exports & Services collapsible ─────────────────── -->
          <div class="cp-collapsible">
            <button class="cp-collapsible__trigger" type="button" on:click={() => (regulationsOpen = !regulationsOpen)} aria-expanded={regulationsOpen}>
              <span class="cp-collapsible__trigger-left">
                <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--color-highlight-2,#02b5bb)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
                Regulations, Exports &amp; Services
              </span>
              <span class="cp-collapsible__trigger-right">
                <svg class="cp-collapsible__trigger-chevron" class:cp-collapsible__trigger-chevron--open={regulationsOpen} xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>
              </span>
            </button>
            <div class="cp-collapsible__body" class:cp-collapsible__body--open={regulationsOpen}>
              <div class="cp-collapsible__inner">
                <div class="cp-collapsible__scroll">
                  <RegulationsLanding
                    destinationCountry={$project.destinationCountry ?? ""}
                    originCountry={$project.originCountry ?? ""}
                    onOpenLily={handleLilyDeepLink}
                  />
                </div><!-- /__scroll -->
              </div>
            </div>
          </div>

          <!-- Project Details collapsible ───────────────────────────────── -->
          <div class="cp-collapsible">
            <!-- Trigger is a <div role="button"> (NOT a <button>) because it nests
                 the "Edit" <button> below. A <button> may not contain another
                 button: under SSR the HTML parser auto-closes the outer button, the
                 hydrated DOM no longer matches Svelte's template, and the toggle
                 handler binds to the wrong node — so the dropdown only "flashes".
                 A div with role="button" + Enter/Space keydown keeps full keyboard
                 a11y while making the nested Edit button valid. -->
            <div
              class="cp-collapsible__trigger"
              role="button"
              tabindex="0"
              aria-expanded={detailsOpen}
              on:click={() => (detailsOpen = !detailsOpen)}
              on:keydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); detailsOpen = !detailsOpen; } }}
            >
              <span class="cp-collapsible__trigger-left">
                <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--color-highlight-2,#02b5bb)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                Project Details
              </span>
              <span class="cp-collapsible__trigger-right">
                {#if $project?.viewerIsPrincipal && !editingDetails && anyDetailEditable}
                  <button class="cp-collapsible__trigger-edit" type="button" on:click|stopPropagation={startEditDetails}>

                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    Edit
                  </button>
                {/if}
                <svg class="cp-collapsible__trigger-chevron" class:cp-collapsible__trigger-chevron--open={detailsOpen} xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>
              </span>
            </div>
            <div class="cp-collapsible__body" class:cp-collapsible__body--open={detailsOpen}>
              <div class="cp-collapsible__inner">
                <div class="cp-collapsible__scroll">
                  <!-- DETAILS BOX — WYSIWYG inline edit: each editable field
                       shows a frameless input in edit mode instead of a
                       separate form above. Non-editable fields stay as text. -->
                  <section class="cp-dashboard__details">
                    <h3>
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-highlight-2)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                      Project Details
                    </h3>
                    <div class="field-grid">

                      <!-- ── Origin ── (registry: route) -->
                      {#if routeVisible}
                      <div class="field field--card" class:field--editable={editingDetails && routeEditable}>
                        <span class="field__icon">🌍</span>
                        <div class="field__content">
                          <span class="field__label">Origin</span>
                          {#if editingDetails && routeEditable}
                            <div class="field__inline-row">
                              <input class="field__inline-input" type="text" placeholder="City, State/Province" bind:value={detailsEditForm.originCity} />
                              <input class="field__inline-input" type="text" placeholder="Country" bind:value={detailsEditForm.originCountry} />
                            </div>
                          {:else}
                            <span class="field__value">
                              {[$project.originCity, $project.originCountry].filter(Boolean).join(', ') || '—'}
                            </span>
                          {/if}
                        </div>
                      </div>
                      {/if}

                      <!-- ── Destination ── (registry: route) -->
                      {#if routeVisible}
                      <div class="field field--card" class:field--editable={editingDetails && routeEditable}>
                        <span class="field__icon">📍</span>
                        <div class="field__content">
                          <span class="field__label">Destination</span>
                          {#if editingDetails && routeEditable}
                            <div class="field__inline-row">
                              <input class="field__inline-input" type="text" placeholder="City, State/Province" bind:value={detailsEditForm.destinationCity} />
                              <input class="field__inline-input" type="text" placeholder="Country" bind:value={detailsEditForm.destinationCountry} />
                            </div>
                          {:else}
                            <span class="field__value">
                              {[$project.destinationCity, $project.destinationCountry].filter(Boolean).join(', ') || '—'}
                            </span>
                          {/if}
                        </div>
                      </div>
                      {/if}

                      <!-- ── Budget ── (registry: budget, read-only display) -->
                      {#if budgetVisible && $project.budget}
                        <div class="field field--card">
                          <span class="field__icon">💰</span>
                          <div class="field__content">
                            <span class="field__label">Estimated Budget</span>
                            <span class="field__value field__value--highlight">{$project.budget}</span>
                          </div>
                        </div>
                      {/if}

                      <!-- ── Move Size ── (registry: size) -->
                      {#if sizeVisible && ($project.size || (editingDetails && sizeEditable))}
                        <div class="field field--card" class:field--editable={editingDetails && sizeEditable}>
                          <span class="field__icon">📦</span>
                          <div class="field__content">
                            <span class="field__label">Move Size</span>
                            {#if editingDetails && sizeEditable}
                              <input class="field__inline-input" type="text" placeholder="e.g. 40ft container" bind:value={detailsEditForm.size} />
                            {:else}
                              <span class="field__value">{$project.size}</span>
                            {/if}
                          </div>
                        </div>
                      {/if}

                      <!-- ── Immigration Status ── (registry: immigrationStatus) -->
                      {#if immigrationVisible && ($project.immigrationStatus || (editingDetails && immigrationEditable))}
                        <div class="field field--card" class:field--editable={editingDetails && immigrationEditable}>
                          <span class="field__icon">🛂</span>
                          <div class="field__content">
                            <span class="field__label">Immigration Status</span>
                            {#if editingDetails && immigrationEditable}
                              <input class="field__inline-input" type="text" placeholder="e.g. Residency, Visa, Citizen" bind:value={detailsEditForm.immigrationStatus} />
                            {:else}
                              <span class="field__value field__value--badge">{$project.immigrationStatus}</span>
                            {/if}
                          </div>
                        </div>
                      {/if}

                      <!-- ── Property Requirements ── (registry: property) -->
                      {#if propertyVisible && ($project.propertyTypeFrom || $project.propertyTypeTo || (editingDetails && propertyEditable))}
                        <div class="field field--card field--full" class:field--editable={editingDetails && propertyEditable}>
                          <span class="field__icon">🏠</span>
                          <div class="field__content">
                            <span class="field__label">Property Requirements</span>
                            {#if editingDetails && propertyEditable}
                              <div class="field__inline-row">
                                <span class="field__inline-sub">Moving from</span>
                                <input class="field__inline-input" type="text" placeholder="house / apartment…" bind:value={detailsEditForm.propertyTypeFrom} />
                                <span class="field__inline-sub">Looking for</span>
                                <input class="field__inline-input" type="text" placeholder="house / apartment…" bind:value={detailsEditForm.propertyTypeTo} />
                              </div>
                            {:else}
                              <div class="field__row">
                                {#if $project.propertyTypeFrom}<span class="field__tag">Moving from: <strong>{$project.propertyTypeFrom}</strong></span>{/if}
                                {#if $project.propertyTypeTo}<span class="field__tag">Looking for: <strong>{$project.propertyTypeTo}</strong></span>{/if}
                              </div>
                            {/if}
                          </div>
                        </div>
                      {/if}

                      <!-- ── Vehicles ── (registry: vehicles, read-only display) -->
                      {#if vehiclesVisible && $project.vehicles && $project.vehicles.length > 0}
                        <div class="field field--card field--full">
                          <span class="field__icon">🚗</span>
                          <div class="field__content">
                            <span class="field__label">Vehicles to Ship</span>
                            <div class="field__tags">
                              {#each $project.vehicles as vehicle}
                                <span class="tag-pill">{typeof vehicle === "object" && vehicle !== null ? [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" ") : vehicle}</span>
                              {/each}
                            </div>
                          </div>
                        </div>
                      {/if}


                      <!-- ── Next Consultation ── (read-only) -->
                      {#if upcomingConsultation}
                        <div class="field field--card">
                          <span class="field__icon">📅</span>
                          <div class="field__content">
                            <span class="field__label">Next Consultation</span>
                            <span class="field__value">{formatDate(upcomingConsultation)}</span>
                          </div>
                        </div>
                      {/if}

                      <!-- ── Save / Cancel row (only in edit mode) ── -->
                      {#if editingDetails}
                        <div class="cp-details-edit-actions">
                          {#if detailsEditError}<span style="color:#dc2626;font-size:0.82rem;margin-right:auto;">{detailsEditError}</span>{/if}
                          <button class="cp-edit-form__cancel" type="button" on:click={cancelEditDetails}>Cancel</button>
                          <button class="cp-edit-form__save" type="button" on:click={saveDetails} disabled={detailsSaving}>{detailsSaving ? "Saving…" : "Save changes"}</button>
                        </div>
                      {/if}

                    </div><!-- /field-grid -->

                    {#if Object.keys($project.customFields || {}).length > 0}
                      <h4 class="cp-dashboard__subheading">Additional Information</h4>
                      <div class="field-grid">
                        {#each Object.entries($project.customFields || {}) as [key, val]}
                          <div class="field field--card" class:field--full={isLongText(val) || Array.isArray(val)}>
                            <div class="field__content">
                              <span class="field__label">{formatKeyLabel(key)}</span>
                              {#if Array.isArray(val)}
                                <div class="field__tags" style="margin-top: 0.5rem;">
                                  {#each val as item}<span class="tag-pill">{item}</span>{/each}
                                </div>
                              {:else if typeof val === "boolean"}
                                <div class="field__value" style="margin-top: 0.25rem;">
                                  {#if val}<span class="badge badge--success">✓ Yes</span>{:else}<span class="badge badge--danger">✗ No</span>{/if}
                                </div>
                              {:else if isUrl(val)}
                                <a href={val} target="_blank" rel="noopener noreferrer" class="field__value field__value--link">View Document ↗</a>
                              {:else}
                                <span class="field__value">{val}</span>
                              {/if}
                            </div>
                          </div>
                        {/each}
                      </div>
                    {/if}
                  </section>

                </div><!-- /__scroll -->
              </div><!-- /details inner -->
            </div><!-- /details body -->
          </div><!-- /details collapsible -->

          <!-- Activity Log collapsible ──────────────────────────────────── -->
          <div class="cp-collapsible">
            <button class="cp-collapsible__trigger" type="button" on:click={() => (activityOpen = !activityOpen)} aria-expanded={activityOpen}>
              <span class="cp-collapsible__trigger-left">
                <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--color-highlight-2,#02b5bb)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                Activity Log
              </span>
              <span class="cp-collapsible__trigger-right">
                {#if ($project?.activityLog?.length ?? 0) > 0}
                  <span class="cp-collapsible__trigger-count">{$project.activityLog.length}</span>
                {/if}
                <svg class="cp-collapsible__trigger-chevron" class:cp-collapsible__trigger-chevron--open={activityOpen} xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>
              </span>
            </button>
            <div class="cp-collapsible__body" class:cp-collapsible__body--open={activityOpen}>
              <div class="cp-collapsible__inner">
                <div class="cp-collapsible__scroll">
                <section class="cp-dashboard__activity">
                  <h3>Activity Log</h3>
              {#if $project.activityLog && $project.activityLog.length > 0}
                <div class="timeline" class:timeline--play={activityOpen}>
                  <div class="timeline__spine" aria-hidden="true">
                    <span class="timeline__spine-flow"></span>
                    <span class="timeline__spine-flow timeline__spine-flow--2"></span>
                  </div>
                  <!-- "Now" beacon — the live pulsing head of the journey -->
                  <div class="timeline__beacon timeline__beacon--now" aria-hidden="true">
                    <span class="timeline__beacon-pulse"></span>
                    <span class="timeline__beacon-label">Now</span>
                  </div>
                  {#each [...$project.activityLog].reverse() as entry, idx}
                    <div
                      class="timeline__item"
                      class:timeline__item--right={idx % 2 === 1}
                      class:timeline__item--latest={idx === 0}
                      style="--i:{idx}; --k:{getActivityColor(entry.type)}"
                    >
                      <div class="timeline__node">
                        <span class="timeline__node-ring" aria-hidden="true"></span>
                        <span class="timeline__node-icon">{getActivityIcon(entry.type)}</span>
                      </div>
                      <div class="timeline__card">
                        <div class="timeline__card-text">
                          {@html getActivityText(entry)}
                        </div>
                        <div class="timeline__card-time">
                          {formatDateTime(entry.timestamp)}
                        </div>
                      </div>
                    </div>
                  {/each}
                  <!-- Origin marker — where the journey began -->
                  <div class="timeline__beacon timeline__beacon--origin" aria-hidden="true">
                    <span class="timeline__beacon-diamond"></span>
                    <span class="timeline__beacon-label">Journey start</span>
                  </div>
                </div>
              {:else}
                <p style="color: #64748b; font-size: 0.95rem;">
                  No activity recorded yet.
                </p>
              {/if}
                </section>
                </div><!-- /__scroll -->
              </div><!-- /activity inner -->
            </div><!-- /activity body -->
          </div><!-- /activity collapsible -->
        </div>
        <!-- /#cp-overview -->

      {/if}

      <!-- ══ YOUR DETAILS — operator-configured, client-visible Overview fields.
           Driven by the centralized Overview Field Registry (Automations →
           Overview fields, "Client" switch). Renders nothing until an operator
           opts a field in, and only lets the client edit fields flagged
           "Editable". Fully backward compatible. -->
      {#if $project}
        <div id="cp-your-details" class="cp-section-anchor">
          <div class="cp-dashboard__full-width-section">
            <ClientFieldsCard />
          </div>
          <div class="cp-dashboard__full-width-section">
            <ChargesCard />
          </div>
        </div>
      {/if}

      <!-- ══ FULL RELOCATION SUPPORT — the deep service catalogue, gated inside
           the authenticated portal. This is where immigration, settling in,
           vehicle/pet/business support live — deliberately NOT on the public
           site, so IRP does not read as competing with its own partners. -->
      {#if $project && !$irpStaffIsAuthenticated}
        <div id="cp-support" class="cp-section-anchor">
          <div class="cp-dashboard__full-width-section cp-support-section">
            <FullRelocationSupport />
          </div>
        </div>
      {/if}

      <!-- ══ DESTINATION SERVICES — country-gated extra page-level tabs.
           Surfaced only when the client's destination country is in the
           operator-configured list (e.g. Costa Rica). Shown to both clients
           and staff (staff preview the same tabs the client sees). -->
      {#if $project && $destinationServices}
        <div id="cp-tours" class="cp-section-anchor">
          <div class="cp-dashboard__full-width-section">
            <RelocationTours destinationCountry={$project.destinationCountry ?? ""} />
          </div>
        </div>

        <div id="cp-immigration" class="cp-section-anchor">
          <div class="cp-dashboard__full-width-section">
            <ImmigrationAdvice destinationCountry={$project.destinationCountry ?? ""} />
          </div>
        </div>

        <div id="cp-coaching" class="cp-section-anchor">
          <div class="cp-dashboard__full-width-section">
            <InterculturalCoaching destinationCountry={$project.destinationCountry ?? ""} />
          </div>
        </div>
      {/if}

      <!-- ══ COMMENTS — always rendered (single-landing). Visible to both
           clients and signed-in staff so either can leave notes on the move. -->
      <!-- {#if $project}
        <div id="cp-comments" class="cp-section-anchor">
          <div class="cp-dashboard__full-width-section">
            <CommentsThread {projectId} />
          </div>
        </div>
      {/if} --> 
      <!-- We will comment it for now unless the business wants to resucitate it -->


      <!-- ══ PROPOSAL — template document. Rendered right after the overview/
           activity section and before the quote. Shows whenever the client has
           an assigned proposal template (mapped from their destination, or a
           staff override) — even before any quote exists — OR once quotes
           arrive. When there are quotes, the per-section tabs scroll here and
           filter the visible section; pre-quote we show the WHOLE document. -->
      {#if hasQuotes || hasAssignedProposal}
        <div id="cp-proposal" class="cp-section-anchor">

          <!-- Staff-only template selector -->
          {#if $irpStaffIsAuthenticated && $allTemplates.length > 0}
            <div class="cp-dashboard__full-width-section">
              <div class="cp-template-selector">
                <div class="cp-template-selector__inner">
                  <span class="cp-template-selector__eyebrow"
                    >🤖 AI-selected proposal template</span
                  >
                  <div class="cp-template-selector__row">
                    <label class="cp-template-selector__label" for="tpl-select"
                      >Showing:</label
                    >
                    <select
                      id="tpl-select"
                      class="cp-template-selector__select"
                      value={$selectedTemplateId ?? ""}
                      on:change={(e) =>
                        setSelectedTemplate(projectId, e.currentTarget.value)}
                    >
                      <option value="" disabled>Select a template…</option>
                      {#each $allTemplates as tpl (tpl.templateId)}
                        <option value={tpl.templateId}>
                          {tpl.name}{tpl.isDefault ? " ★ Default" : ""}
                        </option>
                      {/each}
                    </select>
                    <span class="cp-template-selector__hint"
                      >Only you see this — clients see the rendered proposal
                      below</span
                    >
                  </div>

                  <!-- Staff edit / reset bar (per-client WYSIWYG override) -->
                  <div class="cp-proposal-editbar">
                    {#if $hasProposalOverride}
                      <span class="cp-proposal-editbar__badge">✦ Customized for this client</span>
                    {/if}
                    {#if editingProposal}
                      <button
                        type="button"
                        class="cp-proposal-editbar__btn cp-proposal-editbar__btn--ghost"
                        on:click={cancelEditProposal}
                        disabled={proposalSaving}
                      >Cancel</button>
                      <button
                        type="button"
                        class="cp-proposal-editbar__btn cp-proposal-editbar__btn--primary"
                        on:click={handleSaveProposal}
                        disabled={proposalSaving}
                      >{proposalSaving ? "Saving…" : "💾 Save for this client"}</button>
                    {:else}
                      <button
                        type="button"
                        class="cp-proposal-editbar__btn cp-proposal-editbar__btn--primary"
                        on:click={startEditProposal}
                        disabled={!$selectedTemplateId || $effectiveTemplateBlocks.length === 0}
                      >✏️ Edit this proposal</button>
                      {#if $hasProposalOverride}
                        <button
                          type="button"
                          class="cp-proposal-editbar__btn cp-proposal-editbar__btn--ghost"
                          on:click={handleResetProposal}
                          disabled={proposalSaving}
                        >↺ Reset to shared template</button>
                      {/if}
                    {/if}
                  </div>
                  {#if proposalSaveMsg}<div class="cp-proposal-editbar__msg cp-proposal-editbar__msg--ok">{proposalSaveMsg}</div>{/if}
                  {#if proposalSaveError}<div class="cp-proposal-editbar__msg cp-proposal-editbar__msg--err">{proposalSaveError}</div>{/if}
                </div>
              </div>
            </div>
          {/if}

          <!-- Proposal document: WYSIWYG (staff editing) or BlockRenderer (read) -->
          {#if editingProposal && $irpStaffIsAuthenticated}
            <div class="cp-dashboard__full-width-section cp-proposal-section cp-proposal-section--editing">
              <WysiwygEditor bind:blocks={editableProposalBlocks} clientSummary={$project ?? {}} />
            </div>
          {:else if $effectiveTemplateBlocks.length > 0}
            <div class="cp-dashboard__full-width-section cp-proposal-section">
              <BlockRenderer
                blocks={$effectiveTemplateBlocks}
                quote={templateStubQuote}
                accepted={false}
                accepting={false}
                acceptError=""
                activeSection={hasQuotes ? $activeSection : null}
                showAllSections={!hasQuotes}
                clientSummary={$project ?? {}}
              />

            </div>
          {/if}
        </div>
        <!-- /#cp-proposal -->
      {/if}

      <!-- ══ GOOGLE REVIEWS — vertical alternating-column marquee (desktop) that
           collapses to a single horizontal marquee on mobile. Placed after the
           proposal/template section and before the quotes section. -->
      {#if $project}
        <div id="cp-reviews" class="cp-section-anchor">
          <div class="cp-dashboard__full-width-section">
            <VerticalReviewMarquee />
          </div>
        </div>
      {/if}


      <!-- ══ QUOTES — shown whenever showQuoteSection is true and Quote tab is active.
           Renders QuotePanel for subcollection quotes (old flow, hasQuotes) and/or
           QuoteView for token-based pre-generated quotes (hasQuoteToken / new flow). -->
      {#if showQuoteSection}
        <div id="cp-quotes" class="cp-section-anchor">
          <!-- ── Staff-only: preview / send the pricing summary email ──────── -->
          {#if $irpStaffIsAuthenticated}
            <div class="cp-dashboard__full-width-section">
              <div class="cp-quote-email-trigger">
                <div class="cp-quote-email-trigger__inner">
                  <div class="cp-quote-email-trigger__info">
                    <span class="cp-quote-email-trigger__eyebrow">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="11"
                        height="11"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2.5"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        aria-hidden="true"
                        ><rect x="2" y="4" width="20" height="16" rx="2"
                        ></rect><path
                          d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"
                        ></path></svg
                      >
                      Staff action
                    </span>
                    <h3 class="cp-quote-email-trigger__title">
                      Send pricing summary to client
                    </h3>
                    <p class="cp-quote-email-trigger__desc">
                      Preview the email before sending. The client will receive
                      a direct link to this Quote tab.
                    </p>
                  </div>
                  <button
                    class="cp-quote-email-trigger__btn"
                    disabled={emailPreviewing}
                    on:click={previewQuoteEmail}
                    type="button"
                  >
                    {#if emailPreviewing}
                      <span class="cp-quote-email-trigger__spinner"></span>
                      Preparing…
                    {:else}
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="15"
                        height="15"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2.5"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        aria-hidden="true"
                        ><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"
                        ></path><circle cx="12" cy="12" r="3"></circle></svg
                      >
                      Preview & Send
                    {/if}
                  </button>
                </div>
              </div>
            </div>
          {/if}

          {#if hasQuotes}
            <div class="cp-dashboard__full-width-section">
              <QuotePanel
                {projectId}
                isStaff={$irpStaffIsAuthenticated}
                on:goToAccept={() => {
                  activePortalTab = "__accept";
                  setTimeout(() => scrollToSection("cp-accept"), 200);
                }}
              />
            </div>
          {/if}
          {#if hasQuoteToken}
            <div
              class="cp-dashboard__full-width-section"
              style={hasQuotes ? "margin-top: 1.5rem;" : ""}
            >
              <QuoteView consultationId={projectId} />
            </div>
          {/if}
        </div>
        <!-- /#cp-quotes -->
      {/if}

      <!-- ══ ACCEPT — dedicated consent / attestation form (single-landing).
           Gated on showAcceptSection (subcollection quotes AND no ?quoteToken):
           the token flow's QuoteView already renders its own inline accept form,
           so mounting QuoteAcceptance here too would double up (and show a stray
           "Quote not ready yet" card). QuoteAcceptance loads its own quotes on
           mount and renders its spinner / empty / receipt / form states. -->
      {#if showAcceptSection}
        <div id="cp-accept" class="cp-section-anchor">


          <div class="cp-dashboard__full-width-section">
            <QuoteAcceptance
              {projectId}
              isStaff={$irpStaffIsAuthenticated}
              onViewQuote={() => {
                activePortalTab = "__quotes";
                setTimeout(() => scrollToSection("cp-quotes"), 200);
              }}
            />
          </div>
        </div>
        <!-- /#cp-accept -->
      {/if}

      <!--
        QuoteView is now rendered inside the dedicated Quote tab section above.
        When ?quoteToken is present, showQuoteSection becomes true, the Quote tab
        is activated automatically, and QuoteView is mounted inside that section.
      -->
    </div>
    <!-- /.cp-dashboard -->

    <!-- ── LILY FAB — floating bottom-left ───────────────────────────────── -->
    {#if !lilyOpen}
      <button
        class="lily-fab"
        on:click={() => (lilyOpen = true)}
        aria-label="Chat with Lily"
        aria-expanded={lilyOpen}
      >
        <div class="lily-fab__avatar-wrap">
          <img src="/lili.png" alt="Lily" class="lily-fab__avatar" />
          <span class="lily-fab__online-dot"></span>
        </div>
        <span class="lily-fab__label">Chat with Lily</span>
      </button>
    {/if}

    <div
      class="lily-drawer"
      class:lily-drawer--open={lilyOpen}
      aria-hidden={!lilyOpen}
    >
      <div class="lily-drawer__body">
        <LilyChat
          {projectId}
          groupChat={true}
          fillContainer={true}
          onClose={() => (lilyOpen = false)}
        />
      </div>
    </div>

    {#if lilyOpen}
      <div
        class="lily-drawer-backdrop"
        on:click={() => (lilyOpen = false)}
        aria-hidden="true"
      ></div>
    {/if}

    <!-- EmailPreviewDrawer: staff-only slide-over for previewing / sending emails.
         Reacts to the global presendEmail store being set via previewQuoteEmail(). -->
    <EmailPreviewDrawer />
  {/if}
</div>

<!-- ══ CLIENT OFFER POPUP — dashboard-configured, shown once per browser once
     the client has access to their status page. Never shown to staff. -->
{#if showOffer && $clientOffer}
  <ClientOfferPopup
    title={$clientOffer.title}
    bodyHtml={$clientOffer.bodyHtml}
    ctaLabel={$clientOffer.ctaLabel}
    ctaUrl={$clientOffer.ctaUrl}
    on:close={dismissOffer}
  />
{/if}

<Footer />


<style>
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  /* ── Staff quote-email trigger card ────────────────────────────────────── */
  :global(.cp-quote-email-trigger) {
    background: linear-gradient(135deg, #020d10 0%, #051920 60%, #03141a 100%);
    border: 1px solid rgba(2, 181, 187, 0.22);
    border-radius: 16px;
    padding: 1.25rem 1.5rem;
    box-shadow:
      0 4px 24px rgba(0, 0, 0, 0.3),
      inset 0 1px 0 rgba(255, 255, 255, 0.04);
  }
  :global(.cp-quote-email-trigger__inner) {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1.25rem;
    flex-wrap: wrap;
  }
  :global(.cp-quote-email-trigger__info) {
    flex: 1;
    min-width: 0;
  }
  :global(.cp-quote-email-trigger__eyebrow) {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.67rem;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--color-highlight-2, #02b5bb);
    margin-bottom: 0.4rem;
  }
  :global(.cp-quote-email-trigger__title) {
    font-size: 0.95rem;
    font-weight: 700;
    color: #f1f5f9;
    margin: 0 0 0.3rem;
    line-height: 1.3;
  }
  :global(.cp-quote-email-trigger__desc) {
    font-size: 0.78rem;
    color: rgba(248, 250, 252, 0.45);
    margin: 0;
    line-height: 1.5;
  }
  :global(.cp-quote-email-trigger__btn) {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    padding: 0.6rem 1.25rem;
    background: var(--color-highlight-2, #02b5bb);
    color: #020d10;
    border: none;
    border-radius: 10px;
    font-weight: 800;
    font-size: 0.82rem;
    font-family: var(--font-paragraph, sans-serif);
    cursor: pointer;
    white-space: nowrap;
    flex-shrink: 0;
    box-shadow: 0 2px 14px rgba(2, 181, 187, 0.28);
    transition:
      background 0.18s ease,
      transform 0.14s ease,
      box-shadow 0.18s ease,
      opacity 0.15s ease;
  }
  :global(.cp-quote-email-trigger__btn:hover:not(:disabled)) {
    background: #03cdd4;
    transform: translateY(-1px);
    box-shadow: 0 4px 20px rgba(2, 181, 187, 0.42);
  }
  :global(.cp-quote-email-trigger__btn:active:not(:disabled)) {
    transform: translateY(0);
  }
  :global(.cp-quote-email-trigger__btn:disabled) {
    opacity: 0.55;
    cursor: not-allowed;
    box-shadow: none;
  }
  @keyframes qet-spin {
    to {
      transform: rotate(360deg);
    }
  }
  :global(.cp-quote-email-trigger__spinner) {
    display: inline-block;
    width: 13px;
    height: 13px;
    border: 2px solid rgba(2, 13, 16, 0.25);
    border-left-color: #020d10;
    border-radius: 50%;
    animation: qet-spin 0.75s linear infinite;
    flex-shrink: 0;
  }

  /* ── Inline comments (below pipeline stepper) ─────────────────────────── */
  :global(.cp-dashboard__inline-comments) {
    margin-top: 2rem;
    padding-top: 1.5rem;
    border-top: 1px solid rgba(148, 163, 184, 0.2);
  }

  :global(.step) {
    position: relative;
    cursor: default;
    flex-direction: column;
    align-items: center;
  }
  :global(.step.completed) {
    cursor: pointer;
  }
  /* Ratings are ALWAYS visible (no hover required) so every completed stage
     shows its stars immediately. The current-stage "rate-prompt" still adds a
     glow to draw the eye, but visibility no longer depends on :hover. */
  :global(.step__rating) {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    max-height: 80px;
    overflow: visible;
    opacity: 1;
    pointer-events: auto;
    transition:
      max-height 0.25s ease,
      opacity 0.2s ease,
      margin-top 0.2s ease;
    margin-top: 5px;
  }
  :global(.step.completed:hover .step__rating) {
    max-height: 80px;
    opacity: 1;
    pointer-events: auto;
    margin-top: 5px;
  }
  /* ── Rate-prompt: same always-visible rating + glow on the most-recently-completed step ── */
  :global(.step.rate-prompt .step__rating) {
    max-height: 80px;
    opacity: 1;
    pointer-events: auto;
    margin-top: 6px;
  }

  @keyframes rateGlow {
    0%,
    100% {
      box-shadow: 0 0 4px 2px rgba(2, 181, 187, 0.22);
    }
    50% {
      box-shadow: 0 0 14px 7px rgba(2, 181, 187, 0.52);
    }
  }
  :global(.step.rate-prompt .step__circle) {
    animation: rateGlow 2.2s ease-in-out infinite;
    border-color: var(--color-highlight-2, #02b5bb) !important;
  }
  :global(.step__rating-label) {
    font-size: 0.62rem;
    color: rgba(255, 255, 255, 0.45);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    font-weight: 700;
  }
  :global(.stepper) {
    padding-bottom: 0.5rem;
    overflow: visible;
  }

  /* ── Consultation Call Banner ────────────────────────────────────────── */
  :global(.cp-call-banner) {
    margin: 0 var(--cp-h-pad, 1.5rem) 2.5rem;
    background: linear-gradient(135deg, #020d10 0%, #062028 60%, #04181f 100%);
    border: 1px solid rgba(var(--color-highlight-2-rgb, 2, 182, 188), 0.28);
    border-radius: 16px;
    padding: 1.5rem 1.75rem;
    box-shadow:
      0 4px 32px rgba(0, 0, 0, 0.35),
      0 0 0 1px rgba(var(--color-highlight-2-rgb, 2, 182, 188), 0.08),
      inset 0 1px 0 rgba(255, 255, 255, 0.04);
  }
  :global(.cp-call-banner__inner) {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1.5rem;
    flex-wrap: wrap;
  }
  :global(.cp-call-banner__info) {
    flex: 1;
    min-width: 0;
  }
  :global(.cp-call-banner__eyebrow) {
    display: inline-block;
    font-size: 0.7rem;
    font-weight: 700;
    letter-spacing: 0.09em;
    text-transform: uppercase;
    color: var(--color-highlight-2);
    margin-bottom: 0.45rem;
  }
  :global(.cp-call-banner__title) {
    font-size: 1.15rem;
    font-weight: 800;
    color: #f8fafc;
    margin: 0 0 0.25rem;
    line-height: 1.3;
  }
  :global(.cp-call-banner__time) {
    font-size: 0.95rem;
    font-weight: 600;
    color: rgba(var(--color-highlight-2-rgb, 2, 182, 188), 0.9);
    margin: 0 0 0.5rem;
  }
  :global(.cp-call-banner__subtitle) {
    font-size: 0.82rem;
    color: rgba(248, 250, 252, 0.55);
    margin: 0;
    line-height: 1.5;
  }
  :global(.cp-call-banner__subtitle strong) {
    color: rgba(248, 250, 252, 0.85);
    font-weight: 700;
  }
  :global(.cp-call-banner__join-btn) {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.7rem 1.4rem;
    background: var(--color-highlight-2);
    color: #020d10;
    border-radius: 10px;
    font-weight: 800;
    font-size: 0.875rem;
    font-family: var(--font-paragraph);
    text-decoration: none;
    white-space: nowrap;
    flex-shrink: 0;
    box-shadow: 0 2px 16px rgba(var(--color-highlight-2-rgb, 2, 182, 188), 0.35);
    transition:
      background 0.18s ease,
      transform 0.16s ease,
      box-shadow 0.18s ease;
  }
  :global(.cp-call-banner__join-btn:hover) {
    filter: brightness(1.1);
        box-shadow: 0 4px 24px rgba(var(--color-highlight-2-rgb, 2, 182, 188), 0.5);
  }
  @media (max-width: 520px) {
    :global(.cp-call-banner__inner) {
      flex-direction: column;
      align-items: flex-start;
    }
    :global(.cp-call-banner__join-btn) {
      width: 100%;
      justify-content: center;
    }
  }

  /* ── Move-complete review banner: see .cp-review-banner in status.scss ── */

  /* ── Staff Template Selector ────────────────────────────────────────── */

  :global(.cp-template-selector) {
    background: linear-gradient(
      135deg,
      rgba(2, 181, 187, 0.09) 0%,
      rgba(2, 181, 187, 0.02) 100%
    );
    border: 1px solid rgba(2, 181, 187, 0.22);
    border-radius: 14px;
    padding: 1rem 1.25rem;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  }
  :global(.cp-template-selector__inner) {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  :global(.cp-template-selector__eyebrow) {
    font-size: 0.68rem;
    font-weight: 800;
    letter-spacing: 0.09em;
    text-transform: uppercase;
    color: #0a7e82;
  }
  :global(.cp-template-selector__row) {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
  }
  :global(.cp-template-selector__label) {
    font-size: 0.82rem;
    font-weight: 700;
    color: var(--cp-text-primary, #0f172a);
    white-space: nowrap;
  }
  :global(.cp-template-selector__select) {
    flex: 1;
    min-width: 180px;
    max-width: 360px;
    padding: 0.5rem 0.8rem;
    background: #ffffff;
    border: 1.5px solid rgba(2, 181, 187, 0.28);
    border-radius: 10px;
    color: var(--cp-text-primary, #0f172a);
    font-size: 0.84rem;
    font-weight: 600;
    font-family: var(--font-paragraph);
    outline: none;
    cursor: pointer;
    transition: border-color 0.15s, box-shadow 0.15s;
  }
  :global(.cp-template-selector__select:focus) {
    border-color: var(--color-highlight-2);
    box-shadow: 0 0 0 3px rgba(var(--color-highlight-2-rgb, 2, 181, 187), 0.15);
  }
  :global(.cp-template-selector__hint) {
    font-size: 0.72rem;
    color: var(--cp-text-subtle, #64748b);
    font-style: italic;
  }

  /* ── Staff proposal edit bar (per-client WYSIWYG override) ───────────── */
  :global(.cp-proposal-editbar) {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
    margin-top: 0.85rem;
    padding-top: 0.85rem;
    border-top: 1px solid rgba(2, 181, 187, 0.15);
  }
  :global(.cp-proposal-editbar__badge) {
    font-size: 0.66rem;
    font-weight: 800;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: #0a7e82;
    background: rgba(2, 181, 187, 0.1);
    border: 1px solid rgba(2, 181, 187, 0.28);
    border-radius: 999px;
    padding: 0.22rem 0.65rem;
    margin-right: auto;
  }
  :global(.cp-proposal-editbar__btn) {
    font-family: var(--font-paragraph, sans-serif);
    font-size: 0.78rem;
    font-weight: 700;
    border-radius: 9px;
    padding: 0.45rem 0.95rem;
    cursor: pointer;
    border: 1px solid transparent;
    transition: filter 0.14s ease, transform 0.12s ease, background 0.14s ease, box-shadow 0.14s ease;
  }
  :global(.cp-proposal-editbar__btn:disabled) {
    opacity: 0.55;
    cursor: not-allowed;
  }
  :global(.cp-proposal-editbar__btn--primary) {
    background: linear-gradient(135deg, #02b5bb 0%, #0284c7 100%);
    color: #fff;
    box-shadow: 0 2px 12px rgba(2, 181, 187, 0.28);
  }
  :global(.cp-proposal-editbar__btn--primary:hover:not(:disabled)) {
    filter: brightness(1.08);
    transform: translateY(-1px);
    box-shadow: 0 4px 18px rgba(2, 181, 187, 0.4);
  }
  :global(.cp-proposal-editbar__btn--ghost) {
    background: #f8fafc;
    color: #475569;
    border-color: #e2e8f0;
  }
  :global(.cp-proposal-editbar__btn--ghost:hover:not(:disabled)) {
    background: #f1f5f9;
    color: #0f172a;
  }
  :global(.cp-proposal-editbar__msg) {
    width: 100%;
    font-size: 0.78rem;
    font-weight: 600;
    margin-top: 0.35rem;
  }
  :global(.cp-proposal-editbar__msg--ok) { color: #0a7e82; }
  :global(.cp-proposal-editbar__msg--err) { color: #dc2626; }


  /* ── Proposal document section ───────────────────────────────────────── */
  :global(.cp-proposal-section) {
    background: #ffffff;
    border-radius: 16px;
    overflow: hidden;
    box-shadow:
      0 2px 16px rgba(0, 0, 0, 0.08),
      0 1px 0 rgba(0, 0, 0, 0.04);
  }
  /* Editing mode: teal-ringed canvas so staff clearly see they're in edit mode. */
  :global(.cp-proposal-section--editing) {
    border: 1.5px solid rgba(2, 181, 187, 0.35);
    box-shadow:
      0 0 0 3px rgba(2, 181, 187, 0.08),
      0 2px 16px rgba(0, 0, 0, 0.08);
  }


  /* ── Lily FAB — hyper-modern floating action button ───────────────────── */
  .lily-fab {
    position: fixed;
    bottom: 1.75rem;
    left: 1.75rem;
    z-index: 1200;
    display: flex;
    align-items: center;
    gap: 0.65rem;
    padding: 0.5rem 1.2rem 0.5rem 0.5rem;
    /* ↓ EXPLICIT white text — never inherits portal's dark --cp-text-primary */
    color: #f1f5f9;
    background: linear-gradient(135deg, #0a0e17 0%, #0f1a24 100%);
    border: 1px solid rgba(2, 181, 187, 0.32);
    border-radius: 9999px;
    font-size: 0.875rem;
    font-weight: 600;
    font-family: var(--font-paragraph);
    cursor: pointer;
    box-shadow:
      0 4px 28px rgba(0, 0, 0, 0.5),
      0 0 0 1px rgba(2, 181, 187, 0.12),
      0 0 24px rgba(2, 181, 187, 0.1);
    transition:
      transform 0.18s ease,
      box-shadow 0.18s ease,
      border-color 0.18s ease;
  }
  .lily-fab:hover {
    transform: translateY(-3px);
    border-color: rgba(2, 181, 187, 0.55);
    box-shadow:
      0 8px 40px rgba(0, 0, 0, 0.55),
      0 0 0 1px rgba(2, 181, 187, 0.25),
      0 0 40px rgba(2, 181, 187, 0.18);
  }
  .lily-fab__label {
    white-space: nowrap;
    font-size: 0.82rem;
    font-weight: 700;
    letter-spacing: 0.02em;
    color: #e2e8f0; /* explicit light — never inherit portal dark text */
  }

  .lily-fab__avatar-wrap {
    position: relative;
    width: 36px;
    height: 36px;
    flex-shrink: 0;
  }
  .lily-fab__avatar {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    object-fit: cover;
    border: 2px solid rgba(2, 181, 187, 0.45);
    display: block;
    box-shadow: 0 0 12px rgba(2, 181, 187, 0.2);
  }
  .lily-fab__online-dot {
    position: absolute;
    bottom: 0;
    right: 0;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: #4ade80;
    border: 2px solid #0a0e17;
    box-shadow: 0 0 8px rgba(74, 222, 128, 0.8);
    animation: lily-online-pulse 2.5s ease-in-out infinite;
  }
  @keyframes lily-online-pulse {
    0%, 100% { box-shadow: 0 0 8px rgba(74, 222, 128, 0.8); }
    50% { box-shadow: 0 0 16px rgba(74, 222, 128, 1), 0 0 4px rgba(74, 222, 128, 0.6); }
  }

  /* ── Lily Drawer ──────────────────────────────────────────────────────── */
  .lily-drawer {
    position: fixed;
    bottom: 0;
    left: 0;
    z-index: 1100;
    width: min(460px, 100vw);
    height: min(76vh, 660px);
    background: transparent;
    border-radius: 16px 16px 0 0;
    box-shadow:
      0 -8px 48px rgba(0, 0, 0, 0.6),
      0 0 0 1px rgba(2, 181, 187, 0.12);
    display: flex;
    flex-direction: column;
    transform: translateY(100%);
    transition: transform 0.3s cubic-bezier(0.22, 1, 0.36, 1);
    overflow: hidden;
    pointer-events: none;
  }
  .lily-drawer--open {
    transform: translateY(0);
    pointer-events: auto;
  }
  .lily-drawer__body {
    flex: 1;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    min-height: 0;
  }

  /* ── Backdrop (mobile / narrow screens) ──────────────────────────────── */
  .lily-drawer-backdrop {
    position: fixed;
    inset: 0;
    z-index: 1050;
    background: rgba(0, 0, 0, 0.45);
    backdrop-filter: blur(2px);
  }
  @media (min-width: 480px) {
    .lily-drawer-backdrop {
      display: none;
    }
  }
</style>
