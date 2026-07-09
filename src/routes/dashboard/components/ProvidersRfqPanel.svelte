<script lang="ts">
  /**
   * ProvidersRfqPanel.svelte
   * ────────────────────────────────────────────────────────────────────────────
   * Per-client "Providers" tab (RFQ / "Sondeo").
   *
   * Lets an operator, from inside a client card:
   *   1. See the providers already on this client's quote (auto-selected) and
   *      SEARCH/ADD any registry provider to email for THIS client's project.
   *   2. Compose a pre-translated RFQ ("request your best rates") email from the
   *      project data (Dinorah's template), with a MISSING-FIELD detector that
   *      disables Send until every required field is filled.
   *   3. Pick a LANGUAGE (11 pre-translated templates); the panel recommends one
   *      from the DESTINATION country via a bidirectional country↔language map.
   *   4. EDIT the email in a WYSIWYG preview reusing the SAME centralized email
   *      editor engine (emailEditorEngine.ts) used by the pre-send drawer.
   *   5. CC support2@ + pricing2@ and SEND to the selected providers.
   *
   * The edited body keeps {{providerName}} / {{submitUrl}} placeholders intact —
   * the backend personalizes them per recipient (blastQuoteRequests.ts).
   *
   * Fully additive: uses the existing `sendProviderRfq` store fn + the existing
   * quoteRequests pipeline. Nothing here mutates other flows.
   */

  import { onMount, onDestroy, tick } from 'svelte';
  import { authToken, fetchQuotes, sendProviderRfq, translateRfqEdit } from '../store.ts';
  import type { SendRfqResult } from '../store.ts';

  import { toasts } from '../toastStore.ts';
  import StarRating from './StarRating.svelte';

  import {
    buildIframeSrcDoc,
    attachContentEditable,
    execFormatCommand,
    readIframeHtml,
    type FormatCommand,
  } from '../emailEditorEngine.ts';

  import {
    RFQ_LANG_OPTIONS,
    emptyRfqFields,
    detectMissingRfqFields,
    renderRfqEmail,
    fillPlaceholders,
    defaultServiceOptions,
    mscNote,
    type RfqFields,
    type RfqLang,
  } from '$lib/rfq/sondeoTemplates.ts';
  import {
    recommendedLanguageForCountry,
    normalizeCountryCode,
  } from '$lib/i18n/countryLanguage.ts';

  // ── Props ───────────────────────────────────────────────────────────────────
  /** The selected client (consultation) doc. */
  export let client: any = null;

  // ── Default CC recipients (always CC'd on the RFQ) ───────────────────────────
  const DEFAULT_CC = [
    'support2@internationalrelocationpartner.com',
    'pricing2@internationalrelocationpartner.com',
  ];

  // ── Provider registry ────────────────────────────────────────────────────────
  type Provider = {
    id: string;
    name: string;
    email?: string;
    serviceCategories?: string[];
    shippingModalities?: string[];
    originRegions?: string[];
    destinationRegions?: string[];
    score?: number | null;
    active?: boolean;
  };

  let allProviders: Provider[] = [];
  let providersLoading = false;
  let loadError = '';

  /** Selected provider ids (a Set-like array preserving insertion order). */
  let selectedIds: string[] = [];
  let providerSearch = '';

  // ── Language ─────────────────────────────────────────────────────────────────
  let lang: RfqLang = 'en';
  let recommendedLang: RfqLang = 'en';
  let langMenuOpen = false;
  let langSearch = '';

  // ── RFQ fields (the template variables) ──────────────────────────────────────
  let fields: RfqFields = emptyRfqFields('en');
  /** Newline-joined mirror of fields.serviceOptions for the textarea. */
  let serviceOptionsText = '';

  // ── CC ───────────────────────────────────────────────────────────────────────
  let cc: string[] = [...DEFAULT_CC];
  let ccInput = '';

  // ── Editable email body (raw — placeholders intact) ──────────────────────────
  let editMode: 'preview' | 'visual' | 'html' = 'preview';
  /** Auto-rendered template (placeholders intact), recomputed from lang+fields. */
  let templateHtml = '';
  let templateSubject = '';
  /** Operator-edited body; only used once `bodyEdited`. */
  let editedHtml = '';
  let editedSubject = '';
  let bodyEdited = false;
  let subjectEdited = false;

  // ── Language-switch-after-edit ────────────────────────────────────────────
  // Switching language once the body/subject were hand-edited can't be served
  // by the pre-translated template set (the edit is a flat HTML blob). Rather
  // than silently strand the edits in the old language, we stash the requested
  // language here and let the operator choose: translate the edits, keep them
  // as-is, or discard them for the new language's template.
  let pendingLang: RfqLang | null = null;
  let translating = false;

  let sending = false;
  let lastResult: SendRfqResult | null = null;

  /** Origin/destination postal codes surfaced for the RFQ (origin is required). */
  $: originPostal = String(client?.originZip ?? '').trim();
  $: destinationPostal = String(client?.destinationZip ?? '').trim();


  // ── API helper (mirrors ProvidersView.svelte) ────────────────────────────────
  function getApiUrl(): string {
    if (typeof window !== 'undefined' && window.location.origin.startsWith('http://localhost')) {
      return 'http://localhost:8000';
    }
    return 'https://irp-funnel-server.onrender.com';
  }
  async function apiFetch(path: string, options: RequestInit = {}) {
    const token = $authToken;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    };
    if (token) headers['x-dashboard-token'] = token;
    const res = await fetch(`${getApiUrl()}${path}`, { ...options, headers });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
    return data;
  }

  // ── Derived ──────────────────────────────────────────────────────────────────
  $: providerById = Object.fromEntries(allProviders.map((p) => [p.id, p])) as Record<string, Provider>;
  $: selectedProviders = selectedIds.map((id) => providerById[id]).filter(Boolean) as Provider[];
  $: emailableSelected = selectedProviders.filter((p) => p.email && p.email.includes('@'));

  $: searchResults = (() => {
    const q = providerSearch.trim().toLowerCase();
    return allProviders
      .filter((p) => !selectedIds.includes(p.id))
      .filter((p) => p.active !== false)
      .filter((p) => {
        if (!q) return true;
        return (
          p.name?.toLowerCase().includes(q) ||
          (p.email ?? '').toLowerCase().includes(q)
        );
      })
      .slice(0, 8);
  })();

  $: missing = detectMissingRfqFields(fields);
  $: canSend =
    emailableSelected.length > 0 && missing.length === 0 && !sending;

  $: langMenuOptions = (() => {
    const q = langSearch.trim().toLowerCase();
    if (!q) return RFQ_LANG_OPTIONS;
    return RFQ_LANG_OPTIONS.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        o.englishName.toLowerCase().includes(q) ||
        o.code.includes(q),
    );
  })();
  $: currentLangLabel =
    RFQ_LANG_OPTIONS.find((o) => o.code === lang)?.label ?? 'English';

  // ── Field labels (for the missing-field detector chips) ──────────────────────
  const FIELD_LABEL: Record<keyof RfqFields, string> = {
    origin: 'Origin',
    destination: 'Destination',
    serviceType: 'Type of Service',
    commodity: 'Commodity / Cargo',
    volume: 'Estimated Volume / Weight',
    serviceOptions: 'Service Options',
    notes: 'Notes',
  };

  // ── Build initial RfqFields from the client's project data ────────────────────
  function humanize(v: string): string {
    return String(v ?? '')
      .replace(/[_-]+/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase())
      .trim();
  }
  function joinLoc(city?: string, country?: string): string {
    return [city, country].map((x) => String(x ?? '').trim()).filter(Boolean).join(', ');
  }
  function destinationCountry(): string {
    return String(client?.destinationCountry ?? '').trim();
  }

  function buildFieldsFromClient(forLang: RfqLang): RfqFields {
    const f = emptyRfqFields(forLang);
    if (!client) return f;
    const insights = client.transcriptInsights ?? {};
    f.origin = joinLoc(client.originCity, client.originCountry);
    f.destination = joinLoc(client.destinationCity, client.destinationCountry);
    const svc = insights.packingTier || insights.shippingMode || '';
    f.serviceType = svc ? humanize(svc) : '';
    f.commodity = String(client.itemsSummary ?? client.specialItems ?? '').trim();
    f.volume = String(client.containerSize ?? client.size ?? '').trim();
    f.serviceOptions = defaultServiceOptions(forLang);
    // Destination-conditional note: don't quote MSC to Costa Rica.
    const destCode = normalizeCountryCode(destinationCountry());
    f.notes = destCode === 'CR' ? mscNote(forLang) : '';
    return f;
  }

  // Reactively keep templateHtml/Subject in sync with the fields form + language.
  $: {
    // Depend on these so the block re-runs.
    void lang; void fields.origin; void fields.destination; void fields.serviceType;
    void fields.commodity; void fields.volume; void fields.notes; void serviceOptionsText;
    const merged: RfqFields = {
      ...fields,
      serviceOptions: serviceOptionsText.split('\n').map((s) => s.trim()).filter(Boolean),
    };
    const rendered = renderRfqEmail(lang, merged);
    templateHtml = rendered.bodyHtml;
    templateSubject = rendered.subject;
  }

  // The body/subject actually used: edited version wins once touched.
  $: effectiveHtml = bodyEdited ? editedHtml : templateHtml;
  $: effectiveSubject = subjectEdited ? editedSubject : templateSubject;

  // Sample provider name for the read-only preview only.
  $: sampleName = emailableSelected[0]?.name ?? 'Partner';
  $: previewHtml = fillPlaceholders(effectiveHtml, { providerName: sampleName, submitUrl: '#' });

  // ── Language switch ───────────────────────────────────────────────────────────
  /** English name of a language code — used for the translate prompt + labels. */
  function langName(code: RfqLang): string {
    return RFQ_LANG_OPTIONS.find((o) => o.code === code)?.englishName ?? 'English';
  }

  /**
   * Adopt a language and re-seed the default service options + MSC note for it.
   * Field text (origin, destination, etc.) is preserved across languages.
   */
  function applyLanguageSeed(code: RfqLang) {
    lang = code;
    const dc = normalizeCountryCode(destinationCountry());
    const opts = defaultServiceOptions(code);
    serviceOptionsText = opts.join('\n');
    // Only overwrite notes if it still equals a prior MSC note or is empty.
    const isBlank = !fields.notes.trim();
    fields = { ...fields, serviceOptions: opts, notes: dc === 'CR' && (isBlank || fields.notes === mscNote(lang)) ? mscNote(code) : fields.notes };
  }

  function chooseLanguage(code: RfqLang) {
    langMenuOpen = false;
    langSearch = '';
    if (code === lang) return;
    // With hand-edits present, switching language can't be re-derived from the
    // pre-translated templates — ask instead of silently stranding the edits.
    if (bodyEdited || subjectEdited) {
      pendingLang = code;
      return;
    }
    applyLanguageSeed(code);
  }

  /** Flush the visual editor's latest HTML into `editedHtml` before we act on it. */
  function flushVisualEdits() {
    if (editMode === 'visual' && iframeEl) {
      const latest = readIframeHtml(iframeEl);
      if (latest) { editedHtml = latest; bodyEdited = true; }
    }
  }

  /** Translate the operator's edits into the pending language, then adopt it. */
  async function applyPendingWithTranslation() {
    const code = pendingLang;
    if (!code || translating) return;
    flushVisualEdits();
    translating = true;
    try {
      // Only translate the parts the operator actually edited; untouched parts
      // follow the new language's pre-translated template automatically.
      const srcSubject = subjectEdited ? editedSubject : '';
      const srcBody = bodyEdited ? editedHtml : '';
      const res = await translateRfqEdit(srcSubject, srcBody, langName(code));
      lang = code;
      if (subjectEdited) editedSubject = res.subject;
      if (bodyEdited) editedHtml = res.bodyHtml;
      if (res.translated) {
        toasts.success(`Translated your edits to ${langName(code)}.`);
      } else {
        toasts.error(`Couldn't auto-translate — kept your ${langName(lang)} text as-is.`);
      }
      if (editMode === 'visual') mountVisualEditor();
    } catch (err: any) {
      toasts.error(`Translation failed: ${err?.message ?? err}`);
    } finally {
      translating = false;
      pendingLang = null;
    }
  }

  /** Switch language but keep the operator's edited text verbatim (no translation). */
  function applyPendingKeepEdits() {
    const code = pendingLang;
    if (!code) return;
    flushVisualEdits();
    lang = code;
    pendingLang = null;
    if (editMode === 'visual') mountVisualEditor();
  }

  /** Discard the edits and adopt the new language's fresh pre-translated template. */
  function applyPendingResetTemplate() {
    const code = pendingLang;
    if (!code) return;
    bodyEdited = false;
    subjectEdited = false;
    editedHtml = '';
    editedSubject = '';
    applyLanguageSeed(code);
    pendingLang = null;
    if (editMode === 'visual') mountVisualEditor();
  }

  function cancelPendingLanguage() {
    pendingLang = null;
  }


  // ── Provider selection ────────────────────────────────────────────────────────
  function addProvider(id: string) {
    if (!selectedIds.includes(id)) selectedIds = [...selectedIds, id];
    providerSearch = '';
  }
  function removeProvider(id: string) {
    selectedIds = selectedIds.filter((x) => x !== id);
  }

  // ── CC editing ────────────────────────────────────────────────────────────────
  function addCc() {
    const e = ccInput.trim().toLowerCase();
    if (e && e.includes('@') && !cc.includes(e)) cc = [...cc, e];
    ccInput = '';
  }
  function removeCc(e: string) {
    cc = cc.filter((x) => x !== e);
  }

  // ── WYSIWYG editor lifecycle (reuses emailEditorEngine) ───────────────────────
  let iframeEl: HTMLIFrameElement | null = null;
  let detachEditor: (() => void) | null = null;

  function teardownEditor() {
    if (detachEditor) {
      try { detachEditor(); } catch { /* ignore */ }
      detachEditor = null;
    }
  }

  async function mountVisualEditor() {
    teardownEditor();
    await tick();
    if (!iframeEl) return;
    // Seed edited body from the current effective body the first time.
    if (!bodyEdited) editedHtml = templateHtml;
    iframeEl.srcdoc = buildIframeSrcDoc(bodyEdited ? editedHtml : templateHtml, { editHint: true });
    // Wait for the iframe document to be ready, then attach contentEditable.
    const onLoad = () => {
      if (!iframeEl) return;
      detachEditor = attachContentEditable(iframeEl, (html) => {
        editedHtml = html;
        bodyEdited = true;
      });
    };
    iframeEl.addEventListener('load', onLoad, { once: true });
  }

  // Drive the editor lifecycle from editMode.
  let mounted = false;
  $: if (mounted) {
    if (editMode === 'visual') {
      mountVisualEditor();
    } else {
      teardownEditor();
    }
  }

  function fmt(cmd: FormatCommand) {
    if (iframeEl) execFormatCommand(iframeEl, cmd);
  }

  function resetToTemplate() {
    bodyEdited = false;
    subjectEdited = false;
    editedHtml = '';
    editedSubject = '';
    if (editMode === 'visual') mountVisualEditor();
  }

  // ── Send ──────────────────────────────────────────────────────────────────────
  async function handleSend() {
    if (!client?.id) return;
    // If we're in visual mode, flush the latest iframe HTML first.
    if (editMode === 'visual' && iframeEl) {
      const latest = readIframeHtml(iframeEl);
      if (latest) { editedHtml = latest; bodyEdited = true; }
    }
    if (!canSend) return;
    sending = true;
    lastResult = null;
    try {
      const result = await sendProviderRfq(client.id, emailableSelected.map((p) => p.id), {
        cc,
        subject: effectiveSubject,
        bodyHtml: effectiveHtml,
      });
      lastResult = result;
      const c = result.counts;
      toasts.success(
        `RFQ sent — ${c.created} sent, ${c.skipped} skipped${c.failed ? `, ${c.failed} failed` : ''}.`,
      );
    } catch (err: any) {
      toasts.error(`Send failed: ${err?.message ?? err}`);
    } finally {
      sending = false;
    }
  }

  // ── Load ──────────────────────────────────────────────────────────────────────
  async function loadDefaults() {
    providersLoading = true;
    loadError = '';
    try {
      const [provData, quotes] = await Promise.all([
        apiFetch('/api/dashboard/providers'),
        fetchQuotes(client.id).catch(() => []),
      ]);
      allProviders = (provData.providers ?? []) as Provider[];

      // Default selection = providers already on this client's quotes.
      const quoteProviderIds = new Set<string>();
      for (const q of quotes as any[]) {
        for (const id of q.providerIds ?? []) quoteProviderIds.add(id);
        for (const s of q.providerSnapshots ?? []) if (s?.id) quoteProviderIds.add(s.id);
      }
      selectedIds = allProviders
        .filter((p) => quoteProviderIds.has(p.id) && p.email && p.email.includes('@'))
        .map((p) => p.id);
    } catch (err: any) {
      loadError = err?.message ?? String(err);
    } finally {
      providersLoading = false;
    }
  }

  onMount(async () => {
    // Seed recommended language + fields from the destination country.
    recommendedLang = recommendedLanguageForCountry(destinationCountry());
    lang = recommendedLang;
    fields = buildFieldsFromClient(lang);
    serviceOptionsText = (fields.serviceOptions ?? []).join('\n');
    if (client?.id) await loadDefaults();
    mounted = true;
  });

  onDestroy(() => teardownEditor());
</script>

<div class="rfq">
  {#if !client}
    <p class="rfq-empty">Select a client to compose a provider RFQ.</p>
  {:else}
    <!-- ── Header ─────────────────────────────────────────────────────────── -->
    <header class="rfq-head">
      <div>
        <h3 class="rfq-title">📨 Request rates from providers</h3>
        <p class="rfq-sub">
          Compose a pre-translated RFQ from this project's data, edit it, and send
          to the selected providers. <strong>support2@</strong> and
          <strong>pricing2@</strong> are CC'd automatically.
        </p>
      </div>
      <!-- Origin postal is required for accurate provider rates; destination is
           nice-to-have. Warn loudly only when the origin postal code is absent. -->
      <div class="rfq-postal" aria-label="Route postal codes">
        {#if originPostal}
          <span class="rfq-postal__chip" title="Origin postal / zip code">
            📍 Origin&nbsp;<strong>{originPostal}</strong>
          </span>
        {:else}
          <span class="rfq-postal__chip rfq-postal__chip--warn" title="No origin postal code on file — providers may quote inaccurately">
            ⚠ Origin postal code missing
          </span>
        {/if}
        {#if destinationPostal}
          <span class="rfq-postal__chip" title="Destination postal / zip code">
            🎯 Destination&nbsp;<strong>{destinationPostal}</strong>
          </span>
        {/if}
      </div>
    </header>

    <div class="rfq-grid">

      <!-- ── LEFT: recipients + fields ─────────────────────────────────────── -->
      <section class="rfq-col rfq-col--form">
        <!-- Providers -->
        <div class="rfq-block">
          <div class="rfq-block__label">Providers to email</div>

          {#if selectedProviders.length}
            <div class="rfq-chips">
              {#each selectedProviders as p (p.id)}
                <span class="rfq-chip" class:rfq-chip--noemail={!p.email}>
                  <span class="rfq-chip__name">{p.name}</span>
                  {#if !p.email}
                    <span class="rfq-chip__warn" title="No email on file — cannot be sent to">no email</span>
                  {/if}
                  <button type="button" class="rfq-chip__x" on:click={() => removeProvider(p.id)} aria-label="Remove">✕</button>
                </span>
              {/each}
            </div>
          {:else}
            <p class="rfq-hint">No providers selected yet — search below to add some.</p>
          {/if}

          <div class="rfq-search">
            <input
              class="rfq-input"
              type="text"
              placeholder="Search providers by name or email…"
              bind:value={providerSearch}
            />
            {#if providerSearch.trim() && searchResults.length}
              <div class="rfq-results">
                {#each searchResults as p (p.id)}
                  <button type="button" class="rfq-result" on:click={() => addProvider(p.id)} disabled={!p.email}>
                    <span class="rfq-result__main">
                      <span class="rfq-result__name">{p.name}</span>
                      <span class="rfq-result__email">{p.email ?? 'no email on file'}</span>
                    </span>
                    <span class="rfq-result__meta">
                      <StarRating value={p.score} readonly size={13} />
                    </span>
                  </button>
                {/each}
              </div>
            {/if}
          </div>
          {#if providersLoading}<p class="rfq-hint">Loading providers…</p>{/if}
          {#if loadError}<p class="rfq-err">⚠ {loadError}</p>{/if}
        </div>

        <!-- Language -->
        <div class="rfq-block">
          <div class="rfq-block__label">Language</div>
          <div class="rfq-lang">
            <button type="button" class="rfq-lang__btn" on:click={() => (langMenuOpen = !langMenuOpen)}>
              🌐 {currentLangLabel}
              {#if lang === recommendedLang}<span class="rfq-lang__rec">recommended</span>{/if}
              <span class="rfq-lang__chev" class:open={langMenuOpen}>▾</span>
            </button>
            {#if langMenuOpen}
              <div class="rfq-lang__menu">
                <!-- svelte-ignore a11y-autofocus -->
                <input
                  class="rfq-input rfq-input--sm"
                  type="text"
                  placeholder="Search language…"
                  bind:value={langSearch}
                  autofocus
                />
                <div class="rfq-lang__list">
                  {#each langMenuOptions as o (o.code)}
                    <button type="button" class="rfq-lang__opt" class:sel={o.code === lang} on:click={() => chooseLanguage(o.code)}>
                      <span>{o.label}</span>
                      <span class="rfq-lang__en">{o.englishName}</span>
                      {#if o.code === recommendedLang}<span class="rfq-lang__recdot" title="Recommended for destination">★</span>{/if}
                    </button>
                  {/each}
                  {#if langMenuOptions.length === 0}
                    <div class="rfq-hint" style="padding:8px 10px;">No match.</div>
                  {/if}
                </div>
              </div>
            {/if}
          </div>

          {#if pendingLang}
            <div class="rfq-langswitch" role="group" aria-label="Language switch with edits">
              <p class="rfq-langswitch__msg">
                You've edited this email. Switching to <strong>{langName(pendingLang)}</strong> —
                what should happen to your edits?
              </p>
              <div class="rfq-langswitch__actions">
                <button
                  type="button"
                  class="rfq-btn rfq-btn--primary rfq-btn--xs"
                  disabled={translating}
                  on:click={applyPendingWithTranslation}
                >
                  {translating ? 'Translating…' : `🌐 Translate my edits`}
                </button>
                <button type="button" class="rfq-btn rfq-btn--ghost rfq-btn--xs" disabled={translating} on:click={applyPendingKeepEdits}>
                  Keep text as-is
                </button>
                <button type="button" class="rfq-btn rfq-btn--ghost rfq-btn--xs" disabled={translating} on:click={applyPendingResetTemplate}>
                  Reset to template
                </button>
                <button type="button" class="rfq-langswitch__cancel" disabled={translating} on:click={cancelPendingLanguage}>
                  Cancel
                </button>
              </div>
            </div>
          {/if}
        </div>

        <!-- Fields -->

        <div class="rfq-block">
          <div class="rfq-block__label">
            Template fields
            {#if missing.length}
              <span class="rfq-missing-badge">{missing.length} missing</span>
            {:else}
              <span class="rfq-ok-badge">complete ✓</span>
            {/if}
          </div>

          <label class="rfq-field" class:rfq-field--missing={missing.includes('origin')}>
            <span>Origin</span>
            <input class="rfq-input" type="text" bind:value={fields.origin} placeholder="City, Country" />
          </label>
          <label class="rfq-field" class:rfq-field--missing={missing.includes('destination')}>
            <span>Destination</span>
            <input class="rfq-input" type="text" bind:value={fields.destination} placeholder="City, Country" />
          </label>
          <label class="rfq-field" class:rfq-field--missing={missing.includes('serviceType')}>
            <span>Type of Service</span>
            <input class="rfq-input" type="text" bind:value={fields.serviceType} placeholder="e.g. Full pack & load — maritime" />
          </label>
          <label class="rfq-field" class:rfq-field--missing={missing.includes('commodity')}>
            <span>Commodity / Cargo</span>
            <input class="rfq-input" type="text" bind:value={fields.commodity} placeholder="e.g. Household goods & personal effects" />
          </label>
          <label class="rfq-field" class:rfq-field--missing={missing.includes('volume')}>
            <span>Estimated Volume / Weight</span>
            <input class="rfq-input" type="text" bind:value={fields.volume} placeholder="e.g. 20ft container / ~5,000 kg" />
          </label>

          <label class="rfq-field">
            <span>Service options (one per line)</span>
            <textarea class="rfq-textarea" rows="3" bind:value={serviceOptionsText}></textarea>
          </label>
          <label class="rfq-field">
            <span>Important notes</span>
            <textarea class="rfq-textarea" rows="2" bind:value={fields.notes} placeholder="Destination-specific notes…"></textarea>
          </label>

          {#if missing.length}
            <p class="rfq-missing-list">
              Fill these before sending:
              {#each missing as m}<span class="rfq-missing-chip">{FIELD_LABEL[m]}</span>{/each}
            </p>
          {/if}
        </div>

        <!-- CC -->
        <div class="rfq-block">
          <div class="rfq-block__label">CC</div>
          <div class="rfq-chips">
            {#each cc as e (e)}
              <span class="rfq-chip rfq-chip--cc">
                <span class="rfq-chip__name">{e}</span>
                <button type="button" class="rfq-chip__x" on:click={() => removeCc(e)} aria-label="Remove">✕</button>
              </span>
            {/each}
          </div>
          <div class="rfq-cc-add">
            <input
              class="rfq-input rfq-input--sm"
              type="email"
              placeholder="Add CC email…"
              bind:value={ccInput}
              on:keydown={(e) => e.key === 'Enter' && (e.preventDefault(), addCc())}
            />
            <button type="button" class="rfq-btn rfq-btn--ghost" on:click={addCc}>+ Add</button>
          </div>
        </div>
      </section>

      <!-- ── RIGHT: preview / editor ───────────────────────────────────────── -->
      <section class="rfq-col rfq-col--preview">
        <div class="rfq-preview-head">
          <div class="rfq-modes">
            <button type="button" class:active={editMode === 'preview'} on:click={() => (editMode = 'preview')}>Preview</button>
            <button type="button" class:active={editMode === 'visual'} on:click={() => (editMode = 'visual')}>✏️ Edit</button>
            <button type="button" class:active={editMode === 'html'} on:click={() => (editMode = 'html')}>HTML</button>
          </div>
          {#if bodyEdited || subjectEdited}
            <button type="button" class="rfq-reset" on:click={resetToTemplate}>↺ Reset to template</button>
          {/if}
        </div>

        <!-- Subject -->
        <label class="rfq-subject">
          <span>Subject</span>
          <input
            class="rfq-input"
            type="text"
            value={effectiveSubject}
            on:input={(e) => { editedSubject = (e.target as HTMLInputElement).value; subjectEdited = true; }}
          />
        </label>

        {#if editMode === 'visual'}
          <div class="rfq-toolbar">
            <button type="button" on:click={() => fmt('bold')} title="Bold"><b>B</b></button>
            <button type="button" on:click={() => fmt('italic')} title="Italic"><i>I</i></button>
            <button type="button" on:click={() => fmt('underline')} title="Underline"><u>U</u></button>
            <span class="rfq-toolbar__sep"></span>
            <button type="button" on:click={() => fmt('insertUnorderedList')} title="Bulleted list">• List</button>
            <button type="button" on:click={() => fmt('insertOrderedList')} title="Numbered list">1. List</button>
            <span class="rfq-toolbar__sep"></span>
            <button type="button" on:click={() => fmt('undo')} title="Undo">↶</button>
            <button type="button" on:click={() => fmt('redo')} title="Redo">↷</button>
            <span class="rfq-toolbar__hint">Placeholders <code>{'{{providerName}}'}</code> stay intact per recipient.</span>
          </div>
          <iframe bind:this={iframeEl} class="rfq-iframe" title="RFQ editor"></iframe>
        {:else if editMode === 'html'}
          <textarea
            class="rfq-html"
            value={bodyEdited ? editedHtml : templateHtml}
            on:input={(e) => { editedHtml = (e.target as HTMLTextAreaElement).value; bodyEdited = true; }}
          ></textarea>
        {:else}
          <iframe class="rfq-iframe" title="RFQ preview" srcdoc={buildIframeSrcDoc(previewHtml)}></iframe>
        {/if}

        <!-- Send -->
        <div class="rfq-send">
          <div class="rfq-send__info">
            {#if emailableSelected.length === 0}
              <span class="rfq-send__warn">Select at least one provider with an email.</span>
            {:else if missing.length}
              <span class="rfq-send__warn">{missing.length} template field(s) missing.</span>
            {:else}
              <span class="rfq-send__ok">Ready to send to {emailableSelected.length} provider(s).</span>
            {/if}
          </div>
          <button type="button" class="rfq-btn rfq-btn--primary" disabled={!canSend} on:click={handleSend}>
            {sending ? 'Sending…' : `Send RFQ${emailableSelected.length ? ` (${emailableSelected.length})` : ''}`}
          </button>
        </div>

        {#if lastResult}
          <div class="rfq-result-box">
            <strong>Sent.</strong> {lastResult.counts.created} created ·
            {lastResult.counts.skipped} skipped · {lastResult.counts.failed} failed.
            {#if lastResult.skipped.length}
              <div class="rfq-result-note">Skipped (already have a live request): {lastResult.skipped.map((s) => s.providerName).join(', ')}</div>
            {/if}
          </div>
        {/if}
      </section>
    </div>
  {/if}
</div>

<style>
  /* ──────────────────────────────────────────────────────────────────────────
     Token-driven, per the dashboard style bible: a scoped var layer maps the
     global --irp-* design tokens (with safe fallbacks) so this panel stays
     ultra-cohesive with the rest of the CRM and re-themeable from :root.
     ────────────────────────────────────────────────────────────────────────── */
  .rfq {
    /* Bound to the global style-bible tokens (teal --color-highlight-2, Jost),
       with the slate neutral scale the rest of the CRM dashboard uses. */
    --rfq-accent:        var(--color-highlight-2, #02b5bb);
    --rfq-accent-hover:  #02999e;
    --rfq-accent-glow:   rgba(2, 181, 187, 0.22);
    --rfq-accent-subtle: rgba(2, 181, 187, 0.10);
    --rfq-surface:       #ffffff;
    --rfq-surface-2:     #f8fafc;
    --rfq-surface-3:     #f1f5f9;
    --rfq-border:        #e2e8f0;
    --rfq-border-focus:  rgba(2, 181, 187, 0.5);
    --rfq-text:          #0f172a;
    --rfq-text-2:        #334155;
    --rfq-text-muted:    #64748b;
    --rfq-text-dim:      #94a3b8;
    --rfq-danger:        var(--color-highlight-1, #c62426);
    --rfq-success:       #16a34a;
    --rfq-warning:       #d97706;
    --rfq-warn-bg:       #fffbeb;
    --rfq-warn-border:   #fde68a;
    --rfq-warn-text:     #b45309;
    --rfq-ok-bg:         #f0fdf4;
    --rfq-ok-border:     #bbf7d0;
    --rfq-ok-text:       #16a34a;
    --rfq-t:             150ms cubic-bezier(0.16, 1, 0.3, 1);
    --rfq-shadow-md:     0 1px 3px rgba(0,0,0,0.06), 0 8px 24px rgba(0,0,0,0.05);
    --rfq-shadow-lg:     0 12px 40px rgba(15,23,42,0.16), 0 4px 12px rgba(15,23,42,0.08);
    padding: 2px 2px 24px;
    font-family: var(--font-paragraph, 'Jost'), system-ui, sans-serif;
    color: var(--rfq-text);
  }

  .rfq-empty { color: var(--rfq-text-dim); font-size: 14px; padding: var(--irp-sp-5, 20px); }

  .rfq-head { margin-bottom: var(--irp-sp-4, 16px); display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
  .rfq-title { margin: 0 0 var(--irp-sp-1, 4px); font-size: 16px; font-weight: 800; color: var(--rfq-text); }
  .rfq-sub { margin: 0; font-size: 12.5px; color: var(--rfq-text-muted); line-height: 1.5; max-width: 640px; }
  .rfq-sub strong { color: var(--rfq-accent-hover); }

  /* Route postal codes (origin required, destination optional) */
  .rfq-postal { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
  .rfq-postal__chip {
    display: inline-flex; align-items: center; gap: 2px; padding: 4px 10px;
    background: var(--rfq-surface-2); border: 1px solid var(--rfq-border); border-radius: var(--irp-r-full, 9999px);
    font-size: 11.5px; font-weight: 600; color: var(--rfq-text-2); white-space: nowrap;
  }
  .rfq-postal__chip strong { color: var(--rfq-text); font-weight: 800; }
  .rfq-postal__chip--warn { background: var(--rfq-warn-bg); border-color: var(--rfq-warn-border); color: var(--rfq-warn-text); font-weight: 700; }


  .rfq-grid { display: grid; grid-template-columns: minmax(320px, 1fr) minmax(340px, 1.15fr); gap: 18px; align-items: start; }
  @media (max-width: 900px) { .rfq-grid { grid-template-columns: 1fr; } }

  .rfq-block { margin-bottom: var(--irp-sp-4, 16px); }
  .rfq-block__label { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: var(--rfq-text-muted); margin-bottom: var(--irp-sp-2, 8px); display: flex; align-items: center; gap: var(--irp-sp-2, 8px); }

  .rfq-input, .rfq-textarea {
    width: 100%; padding: var(--irp-sp-2, 8px) 10px; border: 1px solid var(--rfq-border); border-radius: var(--irp-r-sm, 8px);
    font-size: 13px; font-family: inherit; color: var(--rfq-text); outline: none; background: var(--rfq-surface);
    transition: border-color var(--rfq-t), box-shadow var(--rfq-t); box-sizing: border-box;
  }
  .rfq-input:focus, .rfq-textarea:focus { border-color: var(--rfq-accent); box-shadow: 0 0 0 3px var(--rfq-accent-subtle); }
  .rfq-input--sm { padding: 6px 10px; font-size: 12px; }
  .rfq-textarea { resize: vertical; line-height: 1.5; }

  .rfq-field { display: block; margin-bottom: 10px; }
  .rfq-field > span { display: block; font-size: 11.5px; font-weight: 600; color: var(--rfq-text-muted); margin-bottom: 3px; }
  .rfq-field--missing .rfq-input { border-color: var(--rfq-warning); background: #fffbeb; }

  .rfq-hint { font-size: 12px; color: var(--rfq-text-dim); margin: var(--irp-sp-1, 4px) 0; }
  .rfq-err { font-size: 12px; color: var(--rfq-danger); margin: var(--irp-sp-1, 4px) 0; }

  .rfq-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: var(--irp-sp-2, 8px); }
  .rfq-chip {
    display: inline-flex; align-items: center; gap: 6px; padding: 4px 6px 4px 10px;
    background: var(--rfq-accent-subtle); border: 1px solid var(--rfq-accent-glow); border-radius: var(--irp-r-full, 9999px);
    font-size: 12px; font-weight: 600; color: var(--rfq-accent-hover);
  }
  .rfq-chip--cc { background: var(--rfq-surface-3); border-color: var(--rfq-border); color: var(--rfq-text-muted); }
  .rfq-chip--noemail { background: var(--rfq-warn-bg); border-color: var(--rfq-warn-border); color: var(--rfq-warn-text); }
  .rfq-chip__warn { font-size: 10px; font-weight: 700; text-transform: uppercase; }
  .rfq-chip__x {
    display: inline-flex; align-items: center; justify-content: center; width: 16px; height: 16px;
    border-radius: 50%; border: none; background: rgba(0,0,0,.06); color: inherit; cursor: pointer; font-size: 10px;
    transition: background var(--rfq-t);
  }
  .rfq-chip__x:hover { background: rgba(0,0,0,.14); }

  .rfq-search { position: relative; }
  .rfq-results {
    position: absolute; top: calc(100% + 4px); left: 0; right: 0; z-index: 20;
    background: var(--rfq-surface); border: 1px solid var(--rfq-border); border-radius: var(--irp-r-md, 12px); box-shadow: var(--rfq-shadow-lg);
    overflow: hidden;
  }
  .rfq-result {
    display: flex; align-items: center; justify-content: space-between; gap: 10px; width: 100%;
    padding: var(--irp-sp-2, 8px) 11px; background: none; border: none; border-bottom: 1px solid var(--rfq-border); cursor: pointer; text-align: left;
    transition: background var(--rfq-t);
  }
  .rfq-result:hover:not(:disabled) { background: var(--rfq-accent-subtle); }
  .rfq-result:disabled { opacity: .5; cursor: not-allowed; }
  .rfq-result__main { display: flex; flex-direction: column; min-width: 0; }
  .rfq-result__name { font-size: 13px; font-weight: 700; color: var(--rfq-text); }
  .rfq-result__email { font-size: 11px; color: var(--rfq-text-dim); }

  .rfq-lang { position: relative; }
  .rfq-lang__btn {
    display: inline-flex; align-items: center; gap: var(--irp-sp-2, 8px); padding: var(--irp-sp-2, 8px) 12px; border: 1px solid var(--rfq-border);
    background: var(--rfq-surface); border-radius: var(--irp-r-sm, 8px); font-size: 13px; font-weight: 600; color: var(--rfq-text); cursor: pointer;
    transition: border-color var(--rfq-t);
  }
  .rfq-lang__btn:hover { border-color: var(--rfq-border-focus); }
  .rfq-lang__rec { font-size: 10px; font-weight: 700; color: var(--rfq-accent-hover); background: var(--rfq-accent-subtle); padding: 2px 6px; border-radius: var(--irp-r-full, 9999px); }
  .rfq-lang__chev { transition: transform var(--rfq-t); font-size: 10px; }
  .rfq-lang__chev.open { transform: rotate(180deg); }
  .rfq-lang__menu {
    position: absolute; top: calc(100% + 4px); left: 0; z-index: 30; width: 260px;
    background: var(--rfq-surface); border: 1px solid var(--rfq-border); border-radius: var(--irp-r-md, 12px); box-shadow: var(--rfq-shadow-lg); padding: var(--irp-sp-2, 8px);
  }
  .rfq-lang__list { max-height: 240px; overflow-y: auto; margin-top: 6px; }
  .rfq-lang__opt {
    display: flex; align-items: center; gap: var(--irp-sp-2, 8px); width: 100%; padding: 7px 10px; border: 1px solid transparent;
    background: none; border-radius: var(--irp-r-xs, 6px); cursor: pointer; text-align: left; font-size: 13px; color: var(--rfq-text);
    transition: background var(--rfq-t);
  }
  .rfq-lang__opt:hover { background: var(--rfq-surface-2); }
  .rfq-lang__opt.sel { background: var(--rfq-accent-subtle); border-color: var(--rfq-accent-glow); }
  .rfq-lang__en { color: var(--rfq-text-dim); font-size: 11px; margin-left: auto; }
  .rfq-lang__recdot { color: var(--rfq-warning); font-size: 12px; }

  /* Language-switch-after-edit prompt */
  .rfq-langswitch { margin-top: var(--irp-sp-2, 8px); padding: 10px 12px; background: var(--rfq-warn-bg); border: 1px solid var(--rfq-warn-border); border-radius: var(--irp-r-md, 12px); }
  .rfq-langswitch__msg { margin: 0 0 8px; font-size: 12px; line-height: 1.45; color: var(--rfq-warn-text); }
  .rfq-langswitch__msg strong { color: var(--rfq-warn-text); }
  .rfq-langswitch__actions { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
  .rfq-langswitch__cancel { border: none; background: none; color: var(--rfq-text-muted); font-size: 11.5px; font-weight: 700; cursor: pointer; padding: 4px 6px; }
  .rfq-langswitch__cancel:hover:not(:disabled) { color: var(--rfq-text-2); text-decoration: underline; }
  .rfq-langswitch__cancel:disabled { opacity: .5; cursor: not-allowed; }
  .rfq-btn--xs { padding: 5px 12px; font-size: 11.5px; }


  .rfq-missing-badge { font-size: 10px; font-weight: 800; color: var(--rfq-warn-text); background: var(--rfq-warn-bg); border: 1px solid var(--rfq-warn-border); padding: 2px 7px; border-radius: var(--irp-r-full, 9999px); text-transform: none; letter-spacing: 0; }
  .rfq-ok-badge { font-size: 10px; font-weight: 800; color: var(--rfq-ok-text); background: var(--rfq-ok-bg); border: 1px solid var(--rfq-ok-border); padding: 2px 7px; border-radius: var(--irp-r-full, 9999px); text-transform: none; letter-spacing: 0; }
  .rfq-missing-list { font-size: 11.5px; color: var(--rfq-warn-text); margin: var(--irp-sp-2, 8px) 0 0; display: flex; flex-wrap: wrap; gap: 5px; align-items: center; }
  .rfq-missing-chip { background: var(--rfq-warn-bg); border: 1px solid var(--rfq-warn-border); color: var(--rfq-warn-text); padding: 1px 8px; border-radius: var(--irp-r-full, 9999px); font-weight: 700; }

  .rfq-cc-add { display: flex; gap: 6px; }

  /* Section cards — cohesive with the AdminView / AutomationView surfaces */
  .rfq-col { background: var(--rfq-surface); border: 1px solid var(--rfq-border); border-radius: 16px; padding: 16px; box-shadow: var(--rfq-shadow-md); }
  .rfq-col .rfq-block:last-child { margin-bottom: 0; }
  /* Preview column */
  .rfq-col--preview { position: sticky; top: var(--irp-sp-2, 8px); }

  .rfq-preview-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--irp-sp-2, 8px); }
  .rfq-modes { display: inline-flex; gap: 2px; background: var(--rfq-surface-3); padding: 3px; border-radius: var(--irp-r-sm, 8px); }
  .rfq-modes button { border: none; background: none; padding: 5px 12px; border-radius: var(--irp-r-xs, 6px); font-size: 12px; font-weight: 700; color: var(--rfq-text-muted); cursor: pointer; transition: background var(--rfq-t), color var(--rfq-t); }
  .rfq-modes button.active { background: var(--rfq-surface); color: var(--rfq-accent-hover); box-shadow: var(--irp-shadow-sm, 0 1px 3px rgba(15,23,42,.1)); }
  .rfq-reset { border: 1px solid var(--rfq-border); background: var(--rfq-surface); border-radius: var(--irp-r-full, 9999px); padding: 4px 11px; font-size: 11.5px; font-weight: 700; color: var(--rfq-text-muted); cursor: pointer; transition: border-color var(--rfq-t), color var(--rfq-t); }
  .rfq-reset:hover { border-color: var(--rfq-border-focus); color: var(--rfq-accent-hover); }

  .rfq-subject { display: block; margin-bottom: var(--irp-sp-2, 8px); }
  .rfq-subject > span { display: block; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: var(--rfq-text-muted); margin-bottom: 3px; }

  .rfq-toolbar { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; padding: 6px 8px; background: var(--rfq-surface-2); border: 1px solid var(--rfq-border); border-bottom: none; border-radius: var(--irp-r-sm, 8px) var(--irp-r-sm, 8px) 0 0; }
  .rfq-toolbar button { border: 1px solid var(--rfq-border); background: var(--rfq-surface); border-radius: var(--irp-r-xs, 6px); padding: 3px 10px; font-size: 12px; cursor: pointer; color: var(--rfq-text-2); transition: background var(--rfq-t), border-color var(--rfq-t); }
  .rfq-toolbar button:hover { background: var(--rfq-accent-subtle); border-color: var(--rfq-border-focus); }
  .rfq-toolbar__sep { width: 1px; height: 18px; background: var(--rfq-border); margin: 0 4px; }
  .rfq-toolbar__hint { font-size: 10.5px; color: var(--rfq-text-dim); margin-left: auto; }
  .rfq-toolbar__hint code { background: var(--rfq-surface-3); padding: 1px 4px; border-radius: 4px; font-size: 10px; }

  .rfq-iframe { width: 100%; height: 460px; border: 1px solid var(--rfq-border); border-radius: var(--irp-r-md, 12px); background: #f5f6f7; }
  .rfq-toolbar + .rfq-iframe { border-radius: 0 0 var(--irp-r-md, 12px) var(--irp-r-md, 12px); }
  .rfq-html { width: 100%; height: 460px; border: 1px solid var(--rfq-border); border-radius: var(--irp-r-md, 12px); padding: 10px 12px; font-family: var(--irp-mono, ui-monospace, SFMono-Regular, Menlo, monospace); font-size: 12px; line-height: 1.5; color: var(--rfq-text); box-sizing: border-box; resize: vertical; }

  .rfq-send { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 12px; }
  .rfq-send__warn { font-size: 12px; color: var(--rfq-warn-text); font-weight: 600; }
  .rfq-send__ok { font-size: 12px; color: var(--rfq-ok-text); font-weight: 600; }

  .rfq-btn { border: none; border-radius: var(--irp-r-full, 9999px); font-size: 13px; font-weight: 700; cursor: pointer; padding: var(--irp-sp-2, 8px) 18px; transition: box-shadow var(--rfq-t), transform var(--rfq-t), filter var(--rfq-t); }
  .rfq-btn--primary { background: linear-gradient(135deg, #02b5bb 0%, #02999e 100%); color: #fff; box-shadow: 0 2px 10px var(--rfq-accent-glow); }
  .rfq-btn--primary:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 4px 16px var(--rfq-accent-glow); }
  .rfq-btn--primary:disabled { opacity: .45; cursor: not-allowed; box-shadow: none; }
  .rfq-btn--ghost { background: var(--rfq-surface); border: 1px solid var(--rfq-border); color: var(--rfq-text-muted); padding: 6px 12px; font-size: 12px; }
  .rfq-btn--ghost:hover { border-color: var(--rfq-border-focus); color: var(--rfq-accent-hover); }

  .rfq-result-box { margin-top: 12px; padding: 10px 12px; background: var(--rfq-ok-bg); border: 1px solid var(--rfq-ok-border); border-radius: var(--irp-r-md, 12px); font-size: 12.5px; color: var(--rfq-ok-text); }
  .rfq-result-note { margin-top: 4px; font-size: 11.5px; color: #3f6212; }
</style>
