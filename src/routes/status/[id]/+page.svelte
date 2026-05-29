<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import Header from '../../../components/Header/Header.svelte';
  import Footer from '../../../components/Footer/Footer.svelte';
  import {
    isAuthenticated, isCheckingAuth, authEmail,
    project, loading, error, stages, stageLabels,
    requestClientOTP, verifyClientOTP, checkClientAuth, logout, fetchProject,
    loadLilyHistory,
  } from './store.ts';
  import LilyChat from './LilyChat.svelte';
  import CommentsThread from './CommentsThread.svelte';
  import StageRating from './StageRating.svelte';
  import QuotePanel from './QuotePanel.svelte';
  import RegulationsLanding from './RegulationsLanding.svelte';
  import {
    irpStaffIsAuthenticated, irpStaffEmail,
    checkIrpStaff, clearIrpStaff,
  } from '../../../lib/auth/irpStaff.ts';
  import { sendLilyMessage } from './store.ts';
  import './status.scss';

  $: projectId = $page.params.id;

  // ─── Login State ────────────────────────────────────────────────────────
  let loginEmailInput = '';
  let loginCode = '';
  let loginStep: 'email' | 'code' = 'email';
  let loginMessage = '';
  let loginError = '';
  let loginLoading = false;

  onMount(async () => {
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
      return;
    }

    // ─── 2. Existing end-customer flow ───────────────────────────────
    const valid = await checkClientAuth();
    if (valid) {
      await fetchProject(projectId);
      await loadLilyHistory(projectId);
    }
  });

  // ─── Login Handlers ─────────────────────────────────────────────────────
  async function handleRequestOTP() {
    loginLoading = true;
    loginError = '';
    try {
      loginMessage = await requestClientOTP(loginEmailInput, projectId);
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
      await verifyClientOTP(loginEmailInput, projectId, loginCode);
      await fetchProject(projectId);
      await loadLilyHistory(projectId);
    } catch (err: any) {
      loginError = err.message;
    } finally {
      loginLoading = false;
    }
  }

  function handleLogout() {
    // Also clear the IRP-staff session so a logged-in agent is signed out
    // from /dashboard, /guides, and every other gated page in one click.
    // No-op for non-staff visitors.
    if ($irpStaffIsAuthenticated) clearIrpStaff();
    logout();
    loginStep = 'email';
    loginCode = '';
    loginMessage = '';
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

  function getActivityIcon(type: string): string {
    switch (type) {
      case 'stage_change': return '→';
      case 'note_added': return '📝';
      case 'email_triggered': return '📧';
      case 'field_update': return '✏️';
      case 'action_executed': return '⚡';
      default: return '•';
    }
  }

  function getActivityText(entry: any): string {
    switch (entry.type) {
      case 'stage_change':
        return `Moved from <strong>${$stageLabels[entry.from] || entry.from}</strong> to <strong>${$stageLabels[entry.to] || entry.to}</strong>`;
      case 'note_added':
        return 'Note added to file';
      case 'email_triggered':
        return `Sent communication: <strong>${entry.emailType}</strong>`;
      case 'field_update':
        return `Updated information: <strong>${(entry.fields || []).join(', ')}</strong>`;
      case 'action_executed':
        return `System action completed: <strong>${entry.actionKey}</strong>`;
      default:
        return entry.type;
    }
  }

  function formatKeyLabel(key: string): string {
    // Convert camelCase to Title Case
    const result = key.replace(/([A-Z])/g, ' $1').trim();
    return result.charAt(0).toUpperCase() + result.slice(1);
  }

  function isLongText(val: any): boolean {
    return typeof val === 'string' && val.length > 60;
  }

  // Type predicate so the {:else if isUrl(val)} branch narrows `val` to
  // string for the <a href={val}> binding (Svelte 4+ requires a string|null
  // there, not the inferred `unknown` from Object.entries).
  function isUrl(val: unknown): val is string {
    if (typeof val !== 'string') return false;
    return val.startsWith('http://') || val.startsWith('https://');
  }

  function getStageTime(stageKey: string): string {
    if (!$project || !$project.activityLog) return '';
    // Find the earliest time this stage was reached in the activity log
    const entry = $project.activityLog.find((log: any) => log.type === 'stage_change' && log.to === stageKey);
    if (entry && entry.timestamp) {
      return formatDate(entry.timestamp);
    }
    // Fallback: if it's the very first stage, use createdAt
    if (stageKey === $stages[0] && $project.createdAt) {
      return formatDate($project.createdAt);
    }
    return '';
  }

  $: currentStageIndex = $project ? $stages.indexOf($project.stage) : -1;

  // ─── Lily FAB state ─────────────────────────────────────────────────────
  let lilyOpen = false;

  /**
   * Opens the Lily drawer and auto-sends a deep-link prompt.
   * Called by RegulationsLanding "Ask Lily →" buttons.
   */
  function handleLilyDeepLink(prompt: string) {
    lilyOpen = true;
    // Give the drawer 400 ms to animate in before sending the message
    setTimeout(() => {
      sendLilyMessage(projectId, prompt);
    }, 400);
  }
</script>

<svelte:head>
  <title>Client Portal | IRP</title>
  <meta name="robots" content="noindex, nofollow" />
</svelte:head>

<Header />

<div class="client-portal">
  {#if $isCheckingAuth || ($isAuthenticated && $loading && !$project)}
    <div class="cp-auth-wall" style="background: transparent;">
      <div style="text-align: center;">
        <div class="spinner" style="border: 3px solid rgba(0,0,0,0.1); border-left-color: var(--color-highlight-2); width: 40px; height: 40px; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 1rem;"></div>
        <p>Loading your project...</p>
      </div>
    </div>
  {:else if !$isAuthenticated}
    <!-- ═══════════════════════ LOGIN GATE ═══════════════════════ -->
    <div class="cp-auth-wall">
      <div class="cp-auth-wall__card">
        <span class="cp-auth-wall__icon">🌍</span>
        <h1 class="cp-auth-wall__title">Client Portal</h1>
        <p class="cp-auth-wall__subtitle">Track your relocation progress</p>

        {#if loginStep === 'email'}
          <form on:submit|preventDefault={handleRequestOTP} class="cp-auth-wall__form">
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
            <button type="submit" class="cp-auth-wall__btn" disabled={loginLoading || !loginEmailInput.trim()}>
              {loginLoading ? 'Verifying…' : 'Continue'}
            </button>
          </form>
        {:else}
          <form on:submit|preventDefault={handleVerifyOTP} class="cp-auth-wall__form">
            <p style="margin-bottom: 0.5rem; color: #475569;">Code sent to <strong>{loginEmailInput}</strong></p>
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
            <button type="submit" class="cp-auth-wall__btn" disabled={loginLoading || loginCode.length !== 6}>
              {loginLoading ? 'Verifying…' : 'Access Portal'}
            </button>
            <button type="button" class="cp-auth-wall__back" on:click={() => { loginStep = 'email'; loginError = ''; }}>
              ← Use a different email
            </button>
          </form>
        {/if}

        {#if loginError}
          <div class="cp-auth-wall__error">{loginError}</div>
        {/if}
        {#if loginMessage && loginStep === 'code'}
          <div class="cp-auth-wall__success">{loginMessage}</div>
        {/if}

        <!-- Transparent Security Explanation Micro-copy -->
        <div class="cp-auth-wall__security-note">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
          <span style="text-align: left;">This project is securely linked to your registered email. Only you can receive the authorization code to access this portal.</span>
        </div>
      </div>
    </div>
  {:else if $error && !$project}
    <div class="cp-dashboard">
      <div style="background: #fef2f2; color: #dc2626; padding: 2rem; border-radius: 12px; text-align: center; border: 1px solid #fca5a5;">
        <h2>Access Denied</h2>
        <p style="margin-top: 1rem;">{$error}</p>
        <button class="cp-auth-wall__btn" style="max-width: 200px; margin-top: 1.5rem;" on:click={handleLogout}>Back to Login</button>
      </div>
    </div>
  {:else if $project}
    <!-- ═══════════════════════ DASHBOARD PORTAL ═══════════════════════ -->
    <div class="cp-dashboard">
      
      <!-- HEADER -->
      <header class="cp-dashboard__header">
        <div class="cp-dashboard__header-overlay"></div>
        <div class="cp-dashboard__header-content">
          <div class="cp-dashboard__header-main">
            <h1 class="cp-dashboard__header-title">Hello, {$project.name}</h1>
            <div class="cp-dashboard__header-route">
              <span class="route-point">{$project.originCountry || 'Origin'}</span>
              <svg class="route-arrow" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"></path><path d="m12 5 7 7-7 7"></path></svg>
              <span class="route-point">{$project.destinationCountry || 'Destination'}</span>
            </div>
          </div>
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            {#if $irpStaffIsAuthenticated}
              <!--
                Staff-bypass indicator. Visible only when an IRP organization
                agent is viewing this client portal via their /dashboard
                session (the OTP wall was skipped). Hidden for end-customers.
              -->
              <span class="cp-dashboard__header-staff-pill" title="You are viewing this client portal as an IRP organization agent (signed in via /dashboard).">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4z"></path><path d="M20.188 10.934c.388.756.612 1.612.612 2.566 0 4.418-3.582 8-8 8a7.962 7.962 0 0 1-5.5-2.187"></path></svg>
                Staff bypass{#if $irpStaffEmail} · {$irpStaffEmail}{/if}
              </span>
            {/if}
            <button class="cp-dashboard__header-logout" on:click={handleLogout}>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
              Log Out
            </button>
          </div>
        </div>
      </header>

          <!-- PIPELINE STAGE + INLINE COMMENTS ────────────────────────────── -->
          <section class="cp-dashboard__pipeline">
            <h3>Current Status</h3>
            <div style="overflow-x: auto; padding-bottom: 1rem;">
              <div class="stepper">
                {#each $stages as stageKey, idx}
                  <div class="step" class:completed={idx < currentStageIndex} class:active={idx === currentStageIndex}>
                    <div class="step__circle"></div>
                    <div class="step__label">{$stageLabels[stageKey] || stageKey}</div>
                    {#if getStageTime(stageKey)}
                      <div class="step__date">{getStageTime(stageKey)}</div>
                    {/if}
                    {#if idx < currentStageIndex}
                      <div class="step__rating">
                        <StageRating {projectId} {stageKey} readonly={$irpStaffIsAuthenticated} />
                      </div>
                    {/if}
                  </div>
                {/each}
              </div>
            </div>

            <!-- Comments sit right below the stage timeline so feedback lives
                 in the same spatial context as the progress indicator. -->
            {#if !$irpStaffIsAuthenticated}
              <div class="cp-dashboard__inline-comments">
                <CommentsThread {projectId} />
              </div>
            {/if}
          </section>

      <!-- ── QUOTE PANEL ─────────────────────────────────────────────────── -->
      <!-- Shows received/accepted quotes + Accept CTA. Self-hides when empty -->
      <div class="cp-dashboard__full-width-section">
        <QuotePanel {projectId} isStaff={$irpStaffIsAuthenticated} />
      </div>

      <!-- ── REGULATIONS & COMPLIANCE LANDING ──────────────────────────── -->
      <div class="cp-dashboard__full-width-section">
        <RegulationsLanding
          destinationCountry={$project.destinationCountry ?? ''}
          onOpenLily={handleLilyDeepLink}
        />
      </div>

      <div class="cp-dashboard__grid">
        <!-- DETAILS BOX -->
        <section class="cp-dashboard__details">
          <h3>
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-highlight-2)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
            Project Details
          </h3>
          <div class="field-grid">
            {#if $project.budget}
              <div class="field field--card">
                <span class="field__icon">💰</span>
                <div class="field__content">
                  <span class="field__label">Estimated Budget</span>
                  <span class="field__value field__value--highlight">{$project.budget}</span>
                </div>
              </div>
            {/if}
            {#if $project.size}
              <div class="field field--card">
                <span class="field__icon">📦</span>
                <div class="field__content">
                  <span class="field__label">Move Size</span>
                  <span class="field__value">{$project.size}</span>
                </div>
              </div>
            {/if}
            {#if $project.immigrationStatus}
              <div class="field field--card">
                <span class="field__icon">🛂</span>
                <div class="field__content">
                  <span class="field__label">Immigration Status</span>
                  <span class="field__value field__value--badge">{$project.immigrationStatus}</span>
                </div>
              </div>
            {/if}
            {#if $project.propertyTypeFrom || $project.propertyTypeTo}
              <div class="field field--card field--full">
                <span class="field__icon">🏠</span>
                <div class="field__content">
                  <span class="field__label">Property Requirements</span>
                  <div class="field__row">
                    {#if $project.propertyTypeFrom}
                      <span class="field__tag">Moving from: <strong>{$project.propertyTypeFrom}</strong></span>
                    {/if}
                    {#if $project.propertyTypeTo}
                      <span class="field__tag">Looking for: <strong>{$project.propertyTypeTo}</strong></span>
                    {/if}
                  </div>
                </div>
              </div>
            {/if}
            {#if $project.vehicles && $project.vehicles.length > 0}
              <div class="field field--card field--full">
                <span class="field__icon">🚗</span>
                <div class="field__content">
                  <span class="field__label">Vehicles to Ship</span>
                  <div class="field__tags">
                    {#each $project.vehicles as vehicle}
                      <span class="tag-pill">{typeof vehicle === 'object' && vehicle !== null ? [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(' ') : vehicle}</span>
                    {/each}
                  </div>
                </div>
              </div>
            {/if}
            {#if $project.scheduling && $project.scheduling.length > 0}
              <div class="field field--card">
                <span class="field__icon">📅</span>
                <div class="field__content">
                  <span class="field__label">Next Consultation</span>
                  <span class="field__value">{formatDate($project.scheduling[0])}</span>
                </div>
              </div>
            {/if}
          </div>

          {#if Object.keys($project.customFields || {}).length > 0}
            <h4 class="cp-dashboard__subheading">Additional Information</h4>
            <div class="field-grid">
              {#each Object.entries($project.customFields || {}) as [key, val]}
                <div class="field field--card" class:field--full={isLongText(val) || Array.isArray(val)}>
                  <div class="field__content">
                    <span class="field__label">{formatKeyLabel(key)}</span>
                    
                    {#if Array.isArray(val)}
                      <div class="field__tags" style="margin-top: 0.5rem;">
                        {#each val as item}
                          <span class="tag-pill">{item}</span>
                        {/each}
                      </div>
                    {:else if typeof val === 'boolean'}
                      <div class="field__value" style="margin-top: 0.25rem;">
                        {#if val}
                          <span class="badge badge--success">✓ Yes</span>
                        {:else}
                          <span class="badge badge--danger">✗ No</span>
                        {/if}
                      </div>
                    {:else if isUrl(val)}
                      <a href={val} target="_blank" rel="noopener noreferrer" class="field__value field__value--link">
                        View Document ↗
                      </a>
                    {:else}
                      <span class="field__value">{val}</span>
                    {/if}
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </section>

        <!-- ACTIVITY TIMELINE -->
        <section class="cp-dashboard__activity">
          <h3>Activity Log</h3>
          {#if $project.activityLog && $project.activityLog.length > 0}
            <div class="timeline">
              {#each [...$project.activityLog].reverse() as entry}
                <div class="timeline__item">
                  <div class="timeline__item-icon">{getActivityIcon(entry.type)}</div>
                  <div class="timeline__item-content">
                    <div class="timeline__item-text">
                      {@html getActivityText(entry)}
                    </div>
                    <div class="timeline__item-time">
                      {formatDateTime(entry.timestamp)}
                    </div>
                  </div>
                </div>
              {/each}
            </div>
          {:else}
            <p style="color: #64748b; font-size: 0.95rem;">No activity recorded yet.</p>
          {/if}
        </section>
      </div>

    </div>

    <!-- ── LILY FAB — floating bottom-left ───────────────────────────────── -->
    <!-- Only rendered when the user is authenticated and a project is loaded. -->
    {#if !lilyOpen}
        <button
          class="lily-fab"
          on:click={() => lilyOpen = true}
          aria-label="Chat with Lily"
          aria-expanded={lilyOpen}
        >
          <!-- Lili avatar in FAB — × in chat header handles closing -->
          <div class="lily-fab__avatar-wrap">
            <img src="/lili.png" alt="Lily" class="lily-fab__avatar" />
            <span class="lily-fab__online-dot"></span>
          </div>
          <span class="lily-fab__label">Chat with Lily</span>
        </button>
      {/if}

      <!-- Drawer panel — slides up from the bottom-left, no separate header
           since LilyChat itself now has a beautiful dark-glass header. -->
      <div class="lily-drawer" class:lily-drawer--open={lilyOpen} aria-hidden={!lilyOpen}>
        <div class="lily-drawer__body">
          <!-- groupChat shows participants bar; fillContainer fills the drawer height -->
          <LilyChat {projectId} groupChat={true} fillContainer={true} onClose={() => lilyOpen = false} />
        </div>
      </div>

      {#if lilyOpen}
        <!-- Backdrop: click outside to close on mobile -->
        <div class="lily-drawer-backdrop" on:click={() => lilyOpen = false} aria-hidden="true"></div>
      {/if}
  {/if}
</div>

<Footer />

<style>
  @keyframes spin {
    to { transform: rotate(360deg); }
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
  :global(.step__rating) {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    max-height: 0;
    overflow: hidden;
    opacity: 0;
    pointer-events: none;
    transition: max-height 0.25s ease, opacity 0.2s ease, margin-top 0.2s ease;
    margin-top: 0;
  }
  :global(.step.completed:hover .step__rating) {
    max-height: 56px;
    opacity: 1;
    pointer-events: auto;
    margin-top: 5px;
  }
  :global(.step__rating-label) {
    font-size: 0.62rem;
    color: rgba(255,255,255,0.45);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    font-weight: 700;
  }
  :global(.stepper) {
    padding-bottom: 0.5rem;
    overflow: visible;
  }

  /* ── Lily FAB ─────────────────────────────────────────────────────────── */
  .lily-fab {
    position: fixed;
    bottom: 1.75rem;
    left: 1.75rem;
    z-index: 1200;
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.5rem 1.1rem 0.5rem 0.5rem;
    background: var(--chat-glass-header, #08080f);
    color: #f8fafc;
    border: 1px solid var(--chat-glass-border-glow, rgba(2,181,187,0.3));
    border-radius: 9999px;
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    box-shadow:
      0 4px 24px rgba(0,0,0,0.4),
      0 0 0 1px rgba(2,181,187,0.15),
      0 0 20px rgba(2,181,187,0.08);
    transition: transform 0.18s ease, box-shadow 0.18s ease, background 0.18s ease;
  }
  .lily-fab:hover {
    transform: translateY(-2px);
    box-shadow:
      0 6px 32px rgba(0,0,0,0.5),
      0 0 0 1px rgba(2,181,187,0.3),
      0 0 30px rgba(2,181,187,0.14);
  }
  .lily-fab__label {
    white-space: nowrap;
    font-size: 0.82rem;
    font-weight: 700;
    letter-spacing: 0.01em;
  }

  /* FAB avatar (shown when closed) */
  .lily-fab__avatar-wrap {
    position: relative;
    width: 34px;
    height: 34px;
    flex-shrink: 0;
  }
  .lily-fab__avatar {
    width: 34px;
    height: 34px;
    border-radius: 50%;
    object-fit: cover;
    border: 1.5px solid rgba(2,181,187,0.4);
    display: block;
  }
  .lily-fab__online-dot {
    position: absolute;
    bottom: 0;
    right: 0;
    width: 9px;
    height: 9px;
    border-radius: 50%;
    background: #4ade80;
    border: 2px solid var(--chat-glass-header, #08080f);
    box-shadow: 0 0 6px rgba(74,222,128,0.7);
  }

  /* ── Lily Drawer ──────────────────────────────────────────────────────── */
  .lily-drawer {
    position: fixed;
    bottom: 0;
    left: 0;
    z-index: 1100;
    width: min(460px, 100vw);
    height: min(76vh, 660px);
    /* LilyChat renders its own dark glass — drawer is just the shell */
    background: transparent;
    border-radius: 16px 16px 0 0;
    box-shadow:
      0 -8px 48px rgba(0,0,0,0.6),
      0 0 0 1px rgba(2,181,187,0.12);
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
    /* LilyChat in fillContainer mode stretches to fill this */
    min-height: 0;
  }

  /* ── Backdrop (mobile / narrow screens) ──────────────────────────────── */
  .lily-drawer-backdrop {
    position: fixed;
    inset: 0;
    z-index: 1050;
    background: rgba(0,0,0,0.45);
    backdrop-filter: blur(2px);
  }
  @media (min-width: 480px) {
    .lily-drawer-backdrop {
      display: none;
    }
  }
</style>
