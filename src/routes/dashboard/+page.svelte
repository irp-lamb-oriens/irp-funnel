<script lang="ts">
  import { onMount } from 'svelte';
  import Header from '../../components/Header/Header.svelte';
  import Footer from '../../components/Footer/Footer.svelte';
  import {
    isAuthenticated, authEmail, authToken,
    clients, selectedClient, metrics, loading, error,
    searchQuery, activeView, detailPanelOpen, clientsByStage,
    STAGE_LABELS, STAGE_ICONS, STAGE_COLORS, EMAIL_TYPES,
    requestOTP, verifyOTP, checkAuth, logout,
    fetchClients, fetchClientDetail, updateClientStage,
    updateClientFields, addNote, triggerEmail, fetchMetrics,
    type Client
  } from './store.ts';
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
  onMount(async () => {
    const token = $authToken;
    if (token) {
      const valid = await checkAuth();
      if (valid) {
        await loadData();
      }
    }
  });

  async function loadData() {
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

  async function switchView(view: 'board' | 'list' | 'metrics') {
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
</script>

<svelte:head>
  <title>IRP Dashboard — CRM</title>
  <meta name="robots" content="noindex, nofollow" />
</svelte:head>

{#if !$isAuthenticated}
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
        </nav>
      </div>
      <div class="topbar__right">
        {#if $metrics}
          <span class="topbar__spend" title="Total AI token spend">
            🤖 ${$metrics.llmCosts.totalCost.toFixed(2)}
          </span>
        {/if}
        <div class="topbar__search">
          <input type="text" placeholder="Search clients…" bind:value={$searchQuery} />
        </div>
        <span class="topbar__user">{$authEmail?.split('@')[0]}</span>
        <button class="topbar__logout" on:click={handleLogout}>Logout</button>
      </div>
    </header>

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
          <div
            class="board__column"
            on:dragover={handleDragOver}
            on:drop={(e) => handleDrop(e, stageKey)}
          >
            <div class="board__column-header" style="border-color: {STAGE_COLORS[stageKey]}">
              <span class="board__column-icon">{STAGE_ICONS[stageKey]}</span>
              <span class="board__column-title">{stageLabel}</span>
              <span class="board__column-count">{($clientsByStage[stageKey] || []).length}</span>
            </div>
            <div class="board__column-cards">
              {#each ($clientsByStage[stageKey] || []) as client (client.id)}
                <div
                  class="card"
                  draggable="true"
                  on:dragstart={(e) => handleDragStart(e, client)}
                  on:click={() => openClientDetail(client)}
                  role="button"
                  tabindex="0"
                  on:keydown={(e) => e.key === 'Enter' && openClientDetail(client)}
                >
                  <div class="card__name">{client.name} {client.surname}</div>
                  <div class="card__route">
                    {client.originCity || client.originCountry}
                    <span class="card__arrow">→</span>
                    {client.destinationCity || client.destinationCountry}
                  </div>
                  <div class="card__meta">
                    {#if client.budget}<span class="card__tag">{client.budget}</span>{/if}
                    {#if client.scheduling?.length}
                      <span class="card__date">{formatDate(client.scheduling[0])}</span>
                    {/if}
                  </div>
                  {#if client.notes?.length}
                    <span class="card__notes-badge">{client.notes.length} note{client.notes.length > 1 ? 's' : ''}</span>
                  {/if}
                </div>
              {/each}
              {#if ($clientsByStage[stageKey] || []).length === 0}
                <div class="board__empty">No clients</div>
              {/if}
            </div>
          </div>
        {/each}
      </div>

    <!-- ══════════════ LIST VIEW ══════════════ -->
    {:else if $activeView === 'list'}
      <div class="list-view">
        <table class="list-table">
          <thead>
            <tr>
              <th>Client</th>
              <th>Route</th>
              <th>Stage</th>
              <th>Budget</th>
              <th>Consultation</th>
              <th>Last Updated</th>
            </tr>
          </thead>
          <tbody>
            {#each $clients as client (client.id)}
              <tr on:click={() => openClientDetail(client)} class="list-row">
                <td>
                  <div class="list-row__name">{client.name} {client.surname}</div>
                  <div class="list-row__email">{client.email}</div>
                </td>
                <td>
                  {client.originCity || client.originCountry} → {client.destinationCity || client.destinationCountry}
                </td>
                <td>
                  <span class="stage-badge" style="background: {STAGE_COLORS[client.stage]}">
                    {STAGE_ICONS[client.stage]} {STAGE_LABELS[client.stage]}
                  </span>
                </td>
                <td>{client.budget || '—'}</td>
                <td>{client.scheduling?.length ? formatDate(client.scheduling[0]) : '—'}</td>
                <td>{timeAgo(client.lastUpdated)}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>

    <!-- ══════════════ METRICS VIEW ══════════════ -->
    {:else if $activeView === 'metrics'}
      <div class="metrics-view">
        {#if $metrics}
          <!-- Pipeline Overview -->
          <div class="metrics-section">
            <h2>Pipeline Overview</h2>
            <div class="metrics-grid">
              {#each Object.entries($metrics.pipeline.stageCounts) as [stage, count]}
                <div class="metric-card" style="border-left: 4px solid {STAGE_COLORS[stage]}">
                  <div class="metric-card__icon">{STAGE_ICONS[stage]}</div>
                  <div class="metric-card__value">{count}</div>
                  <div class="metric-card__label">{STAGE_LABELS[stage]}</div>
                </div>
              {/each}
            </div>
            <div class="metric-total">Total Clients: <strong>{$metrics.pipeline.total}</strong></div>
          </div>

          <!-- Outcomes -->
          <div class="metrics-section">
            <h2>Call Outcomes</h2>
            <div class="metrics-grid metrics-grid--small">
              <div class="metric-card metric-card--outcome">
                <div class="metric-card__value">{$metrics.outcomes.qualified || 0}</div>
                <div class="metric-card__label">Qualified</div>
              </div>
              <div class="metric-card metric-card--outcome">
                <div class="metric-card__value">{$metrics.outcomes.nurture || 0}</div>
                <div class="metric-card__label">Nurture</div>
              </div>
              <div class="metric-card metric-card--outcome">
                <div class="metric-card__value">{$metrics.outcomes.no_show || 0}</div>
                <div class="metric-card__label">No Show</div>
              </div>
            </div>
          </div>

          <!-- Email Queue -->
          <div class="metrics-section">
            <h2>Email Queue</h2>
            <div class="metrics-grid metrics-grid--small">
              <div class="metric-card">
                <div class="metric-card__value" style="color: #f59e0b">{$metrics.emailQueue.pending}</div>
                <div class="metric-card__label">Pending</div>
              </div>
              <div class="metric-card">
                <div class="metric-card__value" style="color: #10b981">{$metrics.emailQueue.sent}</div>
                <div class="metric-card__label">Sent</div>
              </div>
              <div class="metric-card">
                <div class="metric-card__value" style="color: #ef4444">{$metrics.emailQueue.failed}</div>
                <div class="metric-card__label">Failed</div>
              </div>
            </div>
          </div>

          <!-- LLM Costs — Global -->
          <div class="metrics-section">
            <h2>🤖 AI / LLM Token Spend</h2>
            <div class="metrics-grid metrics-grid--small">
              <div class="metric-card" style="border-left: 4px solid #6366f1">
                <div class="metric-card__value">${$metrics.llmCosts.totalCost.toFixed(4)}</div>
                <div class="metric-card__label">Total Cost (USD)</div>
              </div>
              <div class="metric-card">
                <div class="metric-card__value">{$metrics.llmCosts.callCount}</div>
                <div class="metric-card__label">Total API Calls</div>
              </div>
              <div class="metric-card">
                <div class="metric-card__value">{(($metrics.llmCosts.totalInputTokens + $metrics.llmCosts.totalOutputTokens) / 1000).toFixed(1)}K</div>
                <div class="metric-card__label">Total Tokens</div>
              </div>
              <div class="metric-card">
                <div class="metric-card__value">{$metrics.llmCosts.uniqueSessions || 0}</div>
                <div class="metric-card__label">Chat Sessions</div>
              </div>
            </div>
          </div>

          <!-- LLM Costs — By Provider -->
          {#if $metrics.llmCosts.byProvider && Object.keys($metrics.llmCosts.byProvider).length > 0}
            <div class="metrics-section">
              <h2>Cost by Provider</h2>
              <div class="metrics-grid metrics-grid--small">
                {#each Object.entries($metrics.llmCosts.byProvider) as [provider, data]}
                  <div class="metric-card" style="border-left: 4px solid {provider === 'openrouter' ? '#f97316' : provider === 'google' ? '#3b82f6' : '#8b5cf6'}">
                    <div class="metric-card__value">${data.cost.toFixed(4)}</div>
                    <div class="metric-card__label">{provider}</div>
                    <div class="metric-card__sub">{data.calls} calls · {((data.inputTokens + data.outputTokens) / 1000).toFixed(1)}K tok</div>
                  </div>
                {/each}
              </div>
            </div>
          {/if}

          <!-- LLM Costs — By Model -->
          {#if $metrics.llmCosts.byModel && Object.keys($metrics.llmCosts.byModel).length > 0}
            <div class="metrics-section">
              <h2>Cost by Model</h2>
              <div class="breakdown-table">
                <div class="breakdown-header">
                  <span>Model</span><span>Calls</span><span>Input</span><span>Output</span><span>Cost</span>
                </div>
                {#each Object.entries($metrics.llmCosts.byModel).sort((a, b) => b[1].cost - a[1].cost) as [model, data]}
                  <div class="breakdown-row">
                    <span class="breakdown-row__model">{model.split('/').pop()}</span>
                    <span>{data.calls}</span>
                    <span>{(data.inputTokens / 1000).toFixed(1)}K</span>
                    <span>{(data.outputTokens / 1000).toFixed(1)}K</span>
                    <span class="breakdown-row__cost">${data.cost.toFixed(4)}</span>
                  </div>
                {/each}
              </div>
            </div>
          {/if}

          <!-- Channel Breakdown -->
          {#if $metrics.channelBreakdown}
            <div class="metrics-section">
              <h2>📊 Lead Channels</h2>
              <div class="metrics-grid metrics-grid--small">
                <div class="metric-card" style="border-left: 4px solid #6366f1">
                  <div class="metric-card__icon">💬</div>
                  <div class="metric-card__value">{$metrics.channelBreakdown.chatbot || 0}</div>
                  <div class="metric-card__label">AI Chatbot</div>
                </div>
                <div class="metric-card" style="border-left: 4px solid #fbbf24">
                  <div class="metric-card__icon">📋</div>
                  <div class="metric-card__value">{$metrics.channelBreakdown.form || 0}</div>
                  <div class="metric-card__label">Form</div>
                </div>
                <div class="metric-card" style="border-left: 4px solid #25d366">
                  <div class="metric-card__icon">📱</div>
                  <div class="metric-card__value">{$metrics.channelBreakdown.whatsapp || 0}</div>
                  <div class="metric-card__label">WhatsApp</div>
                </div>
                <div class="metric-card">
                  <div class="metric-card__value">{$metrics.channelBreakdown.unknown || 0}</div>
                  <div class="metric-card__label">Other</div>
                </div>
              </div>
            </div>
          {/if}

          <!-- Country Breakdown -->
          {#if $metrics.countryBreakdown && Object.keys($metrics.countryBreakdown).length > 0}
            <div class="metrics-section">
              <h2>🌍 Top Destination Countries</h2>
              <div class="breakdown-table">
                <div class="breakdown-header">
                  <span>Country</span><span>Leads</span><span>Share</span>
                </div>
                {#each Object.entries($metrics.countryBreakdown).sort((a, b) => b[1] - a[1]).slice(0, 15) as [country, count]}
                  <div class="breakdown-row">
                    <span class="breakdown-row__model">{country}</span>
                    <span>{count}</span>
                    <span class="breakdown-row__cost">{(count / $metrics.pipeline.total * 100).toFixed(1)}%</span>
                  </div>
                {/each}
              </div>
            </div>
          {/if}

          <!-- Monthly Leads -->
          {#if Object.keys($metrics.monthlyLeads).length > 0}
            <div class="metrics-section">
              <h2>Monthly Leads</h2>
              <div class="monthly-chart">
                {#each Object.entries($metrics.monthlyLeads).sort() as [month, count]}
                  <div class="monthly-bar">
                    <div class="monthly-bar__fill" style="height: {Math.min(100, (count / Math.max(...Object.values($metrics.monthlyLeads))) * 100)}%"></div>
                    <span class="monthly-bar__count">{count}</span>
                    <span class="monthly-bar__label">{month}</span>
                  </div>
                {/each}
              </div>
            </div>
          {/if}
        {:else}
          <div class="dashboard__loading">
            <div class="spinner"></div>
            <p>Loading metrics…</p>
          </div>
        {/if}
      </div>
    {/if}

    <!-- ══════════════ DETAIL PANEL ══════════════ -->
    {#if $detailPanelOpen && $selectedClient}
      <div class="detail-overlay" on:click={closeDetail} role="presentation"></div>
      <aside class="detail-panel">
        <div class="detail-panel__header">
          <button class="detail-panel__close" on:click={closeDetail}>✕</button>
          <h2>{$selectedClient.name} {$selectedClient.surname}</h2>
          <span class="detail-panel__email">{$selectedClient.email}</span>
          {#if $selectedClient.phone}
            <span class="detail-panel__phone">{$selectedClient.phone}</span>
          {/if}
        </div>

        <!-- Stage Selector -->
        <div class="detail-stage">
          <label>Pipeline Stage</label>
          <div class="detail-stage__pipeline">
            {#each stageEntries as [stageKey, stageLabel]}
              <button
                class="detail-stage__dot"
                class:active={$selectedClient.stage === stageKey}
                style="background: {$selectedClient.stage === stageKey ? STAGE_COLORS[stageKey] : 'transparent'}; border-color: {STAGE_COLORS[stageKey]}"
                title={stageLabel}
                disabled={stageChanging}
                on:click={() => handleStageChange($selectedClient?.id || '', stageKey)}
              >
                <span class="detail-stage__dot-icon">{STAGE_ICONS[stageKey]}</span>
              </button>
            {/each}
          </div>
          <span class="detail-stage__current" style="color: {STAGE_COLORS[$selectedClient.stage]}">
            {STAGE_LABELS[$selectedClient.stage]}
          </span>
        </div>

        <!-- Tabs -->
        <nav class="detail-tabs">
          <button class:active={detailTab === 'overview'} on:click={() => detailTab = 'overview'}>Overview</button>
          <button class:active={detailTab === 'notes'} on:click={() => detailTab = 'notes'}>Notes ({$selectedClient.notes?.length || 0})</button>
          <button class:active={detailTab === 'activity'} on:click={() => detailTab = 'activity'}>Activity</button>
          <button class:active={detailTab === 'emails'} on:click={() => detailTab = 'emails'}>Emails</button>
          <button class:active={detailTab === 'fields'} on:click={() => detailTab = 'fields'}>Fields</button>
        </nav>

        <div class="detail-content">
          <!-- ── Overview Tab ─────────────────────────── -->
          {#if detailTab === 'overview'}
            <div class="detail-fields">
              <div class="detail-field">
                <span class="detail-field__label">Route</span>
                <span class="detail-field__value">
                  {$selectedClient.originCity}, {$selectedClient.originCountry} → {$selectedClient.destinationCity}, {$selectedClient.destinationCountry}
                </span>
              </div>
              <div class="detail-field">
                <span class="detail-field__label">Budget</span>
                <span class="detail-field__value">{$selectedClient.budget || '—'}</span>
              </div>
              <div class="detail-field">
                <span class="detail-field__label">Move Size</span>
                <span class="detail-field__value">{$selectedClient.size || '—'}</span>
              </div>
              <div class="detail-field">
                <span class="detail-field__label">Immigration Status</span>
                <span class="detail-field__value">{$selectedClient.immigrationStatus || '—'}</span>
              </div>
              <div class="detail-field">
                <span class="detail-field__label">Property</span>
                <span class="detail-field__value">{$selectedClient.propertyTypeFrom || '—'} → {$selectedClient.propertyTypeTo || '—'}</span>
              </div>
              {#if $selectedClient.vehicles?.length}
                <div class="detail-field">
                  <span class="detail-field__label">Vehicles</span>
                  <div class="detail-field__value">
                    {#each $selectedClient.vehicles as v}
                      <span class="detail-field__tag">{v.year} {v.make} {v.model}</span>
                    {/each}
                  </div>
                </div>
              {/if}
              {#if $selectedClient.scheduling?.length}
                <div class="detail-field">
                  <span class="detail-field__label">Scheduled Call</span>
                  <span class="detail-field__value">{formatDateTime($selectedClient.scheduling[0])}</span>
                </div>
              {/if}
              {#if $selectedClient.callOutcome}
                <div class="detail-field">
                  <span class="detail-field__label">Call Outcome</span>
                  <span class="detail-field__value">{$selectedClient.callOutcome}</span>
                </div>
              {/if}
              {#if $selectedClient.transcript}
                <div class="detail-field detail-field--full">
                  <span class="detail-field__label">Transcript</span>
                  <div class="detail-field__transcript">{$selectedClient.transcript}</div>
                </div>
              {/if}
              <div class="detail-field">
                <span class="detail-field__label">Consultations</span>
                <span class="detail-field__value">{$selectedClient.consultationCount}</span>
              </div>
              <div class="detail-field">
                <span class="detail-field__label">Created</span>
                <span class="detail-field__value">{formatDate($selectedClient.createdAt)}</span>
              </div>
              <div class="detail-field">
                <span class="detail-field__label">Drip Active</span>
                <span class="detail-field__value">{$selectedClient.dripEnabled ? '✅ Yes' : '❌ No'}</span>
              </div>
            </div>

          <!-- ── Notes Tab ────────────────────────────── -->
          {:else if detailTab === 'notes'}
            <div class="detail-notes">
              <form class="detail-notes__form" on:submit|preventDefault={handleAddNote}>
                <textarea
                  bind:value={newNote}
                  placeholder="Add a note…"
                  class="detail-notes__input"
                  rows="3"
                ></textarea>
                <button type="submit" class="detail-notes__btn" disabled={noteLoading || !newNote.trim()}>
                  {noteLoading ? 'Adding…' : 'Add Note'}
                </button>
              </form>
              <div class="detail-notes__list">
                {#each ($selectedClient.notes || []).slice().reverse() as note}
                  <div class="detail-note">
                    <div class="detail-note__meta">
                      <span class="detail-note__author">{note.author?.split('@')[0]}</span>
                      <span class="detail-note__time">{timeAgo(note.createdAt)}</span>
                    </div>
                    <div class="detail-note__text">{note.text}</div>
                  </div>
                {/each}
                {#if !$selectedClient.notes?.length}
                  <p class="detail-empty">No notes yet.</p>
                {/if}
              </div>
            </div>

          <!-- ── Activity Tab ─────────────────────────── -->
          {:else if detailTab === 'activity'}
            <div class="detail-activity">
              {#each ($selectedClient.activityLog || []).slice().reverse() as entry}
                <div class="activity-entry">
                  <span class="activity-entry__icon">{getActivityIcon(entry.type)}</span>
                  <div class="activity-entry__content">
                    <span class="activity-entry__text">{getActivityText(entry)}</span>
                    <span class="activity-entry__meta">{entry.actor?.split('@')[0]} · {timeAgo(entry.timestamp)}</span>
                  </div>
                </div>
              {/each}
              {#if !$selectedClient.activityLog?.length}
                <p class="detail-empty">No activity recorded yet.</p>
              {/if}
            </div>

          <!-- ── Emails Tab ───────────────────────────── -->
          {:else if detailTab === 'emails'}
            <div class="detail-emails">
              <p class="detail-emails__desc">Send an email to this client from a template:</p>
              <div class="detail-emails__form">
                <select bind:value={selectedEmailType} class="detail-emails__select">
                  <option value="">Choose email type…</option>
                  {#each EMAIL_TYPES as et}
                    <option value={et.value}>{et.label}</option>
                  {/each}
                </select>
                <button
                  class="detail-emails__btn"
                  disabled={emailSending || !selectedEmailType}
                  on:click={handleTriggerEmail}
                >
                  {emailSending ? 'Sending…' : 'Send Email'}
                </button>
              </div>
              {#if emailSentMessage}
                <div class="detail-emails__message" class:success={emailSentMessage.startsWith('✓')} class:fail={emailSentMessage.startsWith('✗')}>
                  {emailSentMessage}
                </div>
              {/if}
            </div>

          <!-- ── Custom Fields Tab ────────────────────── -->
          {:else if detailTab === 'fields'}
            <div class="detail-custom-fields">
              <div class="detail-custom-fields__list">
                {#each Object.entries($selectedClient.customFields || {}) as [key, value]}
                  <div class="detail-custom-field">
                    <span class="detail-custom-field__key">{key}</span>
                    <span class="detail-custom-field__value">{value}</span>
                  </div>
                {/each}
                {#if !Object.keys($selectedClient.customFields || {}).length}
                  <p class="detail-empty">No custom fields yet.</p>
                {/if}
              </div>
              <form class="detail-custom-fields__form" on:submit|preventDefault={handleAddCustomField}>
                <input type="text" bind:value={newFieldKey} placeholder="Field name" class="detail-cf-input" />
                <input type="text" bind:value={newFieldValue} placeholder="Value" class="detail-cf-input" />
                <button type="submit" disabled={!newFieldKey.trim() || !newFieldValue.trim()}>Add</button>
              </form>
            </div>
          {/if}
        </div>
      </aside>
    {/if}
  </div>
{/if}

<Footer />
