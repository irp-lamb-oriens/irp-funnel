<script lang="ts">
  import { onMount } from 'svelte';
  import Header from '../../components/Header/Header.svelte';
  import Footer from '../../components/Footer/Footer.svelte';
  import {
    isAuthenticated, authEmail, authToken,
    clients, selectedClient, metrics, loading, error,
    searchQuery, filters, filteredClients, activeView, detailPanelOpen, clientsByStage,
    STAGE_LABELS, STAGE_ICONS, STAGE_COLORS, EMAIL_TYPES,
    requestOTP, verifyOTP, checkAuth, logout,
    fetchClients, fetchClientDetail, updateClientStage,
    updateClientFields, addNote, triggerEmail, fetchMetrics,
    initDashboardSocket, disconnectDashboardSocket,
    pendingCountByClient,
    type Client
  } from './store.ts';
  import DetailPanel from './components/DetailPanel.svelte';
  import PendingBadge from './components/PendingBadge.svelte';
  import EmailPreviewDrawer from './components/EmailPreviewDrawer.svelte';
  import MetricsView from './components/MetricsView.svelte';
  import BugReportModal from './components/BugReportModal.svelte';
  import EvoView from './components/evo/EvoView.svelte';
  import ProvidersView from './components/ProvidersView.svelte';
  import ToastContainer from './components/ToastContainer.svelte';
  import './dashboard.scss';

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

  async function loadData() {
    initDashboardSocket();
    await Promise.all([fetchClients(), fetchMetrics()]);
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

  async function handleStageChange(clientId: string, newStage: string) {
    stageChanging = true;
    try {
      await updateClientStage(clientId, newStage);
    } catch (err: any) {
      alert('Failed to update stage: ' + err.message);
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

  async function switchView(view: 'board' | 'list' | 'metrics' | 'evo' | 'providers') {
    activeView.set(view);
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

  $: stageEntries = Object.entries(STAGE_LABELS);

  const stageKeys = Object.keys(STAGE_LABELS);
  const postTranscriptIdx = stageKeys.indexOf('sales_post_transcript');

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
        <span class="login-logo__icon">🌍</span>
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
        <span class="topbar__logo">🌍</span>
        <h1 class="topbar__title">IRP CRM</h1>
        <nav class="topbar__nav">
          <button class:active={$activeView === 'board'} on:click={() => switchView('board')}>Board</button>
          <button class:active={$activeView === 'list'} on:click={() => switchView('list')}>List</button>
          <button class:active={$activeView === 'metrics'} on:click={() => switchView('metrics')}>Metrics</button>
          <button class:active={$activeView === 'evo'} on:click={() => switchView('evo')} title="Evolutionary UI sales attribution">Evo</button>
          <button class:active={$activeView === 'providers'} on:click={() => switchView('providers')} title="Shipping & relocation provider registry">Providers</button>
        </nav>
      </div>
      <div class="topbar__right">
        {#if $metrics}
          <span class="topbar__spend" title="Week / Month / All-Time AI spend">
            🤖 W:${$metrics.llmCosts.periodSpend?.thisWeek?.toFixed(2) || '0'} · M:${$metrics.llmCosts.periodSpend?.thisMonth?.toFixed(2) || '0'} · ∑${$metrics.llmCosts.totalCost.toFixed(2)}
          </span>
        {/if}
        <div class="topbar__search">
          <input type="text" placeholder="Search clients…" bind:value={$searchQuery} />
        </div>
        <span class="topbar__user">{$authEmail?.split('@')[0]}</span>
        <button class="topbar__logout" on:click={handleLogout}>Logout</button>
      </div>
    </header>

    <!-- ── Filters ───────────────────────────────────────────── -->
    {#if $activeView === 'board' || $activeView === 'list'}
      <div class="filters-bar">
        <select bind:value={$filters.stage} class="filter-select">
          <option value="">All Stages</option>
          {#each Object.entries(STAGE_LABELS) as [key, label]}
            <option value={key}>{label}</option>
          {/each}
        </select>
        <select bind:value={$filters.callOutcome} class="filter-select">
          <option value="">All Outcomes</option>
          <option value="none">No Outcome Yet</option>
          <option value="qualified">Qualified</option>
          <option value="nurture">Nurture</option>
          <option value="no_show">No Show</option>
        </select>
        <select bind:value={$filters.originCountry} class="filter-select">
          <option value="">Any Origin</option>
          {#each [...new Set($clients.map(c => c.originCountry).filter(Boolean))].sort() as country}
            <option value={country}>{country}</option>
          {/each}
        </select>
        <select bind:value={$filters.destinationCountry} class="filter-select">
          <option value="">Any Destination</option>
          {#each [...new Set($clients.map(c => c.destinationCountry).filter(Boolean))].sort() as country}
            <option value={country}>{country}</option>
          {/each}
        </select>
        <select bind:value={$filters.budget} class="filter-select">
          <option value="">Any Budget</option>
          {#each [...new Set($clients.map(c => c.budget).filter(Boolean))].sort() as budget}
            <option value={budget}>{budget}</option>
          {/each}
        </select>
        <select bind:value={$filters.size} class="filter-select">
          <option value="">Any Move Size</option>
          {#each [...new Set($clients.map(c => c.size).filter(Boolean))].sort() as size}
            <option value={size}>{size}</option>
          {/each}
        </select>
        <button class="filter-clear" on:click={() => $filters = {stage: '', originCountry: '', destinationCountry: '', budget: '', size: '', callOutcome: ''}}>Clear</button>
      </div>
    {/if}

    <!-- ── Loading / Error ───────────────────────────────────── -->
    {#if $loading && $clients.length === 0}
      <div class="dashboard__loading">
        <div class="spinner"></div>
        <p>Loading clients…</p>
      </div>
    {/if}

    {#if $error}
      <div class="dashboard__error">{$error}</div>
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
          <div
            class="board__column"
            on:dragover={handleDragOver}
            on:drop={(e) => handleDrop(e, stageKey)}
          >
            <div class="board__column-header" style="border-color: {STAGE_COLORS[stageKey]}">
              <span class="board__column-icon">{STAGE_ICONS[stageKey]}</span>
              <span class="board__column-title">{stageLabel}</span>
              <span class="board__column-count">{colQuery ? `${filteredCards.length}/${allCards.length}` : allCards.length}</span>
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
              {#each visibleCards as client (client.id)}
                <div
                  class="card"
                  class:card--missing-name={!client.nameKnown}
                  class:card--no-show={isNoShow(client)}
                  draggable="true"
                  on:dragstart={(e) => handleDragStart(e, client)}
                  on:click={() => openClientDetail(client)}
                  role="button"
                  tabindex="0"
                  on:keydown={(e) => e.key === 'Enter' && openClientDetail(client)}
                >
                  <!-- Pending-actions badge — top-right corner, auto-hides when count=0 -->
                  <PendingBadge count={$pendingCountByClient.get(client.id) ?? 0} variant="card" />
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
                    {#if client.budget}<span class="card__tag">{client.budget}</span>{/if}
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
              {#if filteredCards.length === 0}
                <div class="board__empty">{colQuery ? 'No matches' : 'No clients'}</div>
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
                  {#if !client.nameKnown}<span class="list-row__name-badge" aria-label="First name unknown">?</span>{/if}{client.displayName}
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

    <!-- ══════════════ METRICS VIEW ══════════════ -->
    {:else if $activeView === 'metrics'}
      <MetricsView />

    <!-- ══════════════ EVO VIEW (UI evolution × sales attribution) ══════ -->
    {:else if $activeView === 'evo'}
      <EvoView />

    <!-- ══════════════ PROVIDERS VIEW ══════════════ -->
    {:else if $activeView === 'providers'}
      <ProvidersView />
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

<EmailPreviewDrawer />

<ToastContainer />
<Footer />

<style>
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
    background: linear-gradient(135deg, rgba(99,102,241,0.9) 0%, rgba(79,70,229,0.95) 100%);
    border-color: rgba(99, 102, 241, 0.8);
    color: #fff;
    transform: scale(1.1) translateY(-2px);
    box-shadow:
      0 8px 32px rgba(99, 102, 241, 0.45),
      0 0 0 1px rgba(99,102,241,0.25),
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
