<script lang="ts">
  import { onMount } from 'svelte';
  import {
    authEmail,
    fetchLiveAccessConfig,
    saveAccessConfig,
    fetchAdminSessions,
    fetchUserActivity,
    fetchLiveActionPermissions,
    saveActionPermissions,
    liveActionPermissions,
    type AdminSession,
    type UserActivityEntry,
  } from '../store.ts';
  import {
    ALL_VIEWS,
    STATIC_SECTION_ACCESS,
    DEFAULT_ACCESS,
    type DashView,
  } from '../access.ts';

  // ─── Tabs ─────────────────────────────────────────────────────────────────
  let activeTab: 'access' | 'sessions' | 'activity' | 'permissions' = 'access';

  // ─── Displayable view names (no 'admin' shown in the grid) ───────────────
  const GRID_VIEWS: DashView[] = ['board', 'list', 'metrics', 'evo', 'providers', 'posts', 'templates'];
  const VIEW_LABELS: Record<DashView, string> = {
    board: 'Board', list: 'List', metrics: 'Metrics',
    evo: 'Evo', providers: 'Providers', posts: 'Posts', admin: 'Admin', templates: 'Templates',
  };

  // ─── Access Config State ──────────────────────────────────────────────────
  /**
   * Working copy of the access map. Shape: email → Set<DashView>.
   * We use Sets internally for easy toggle; serialised to arrays for the API.
   */
  let accessMap: Map<string, Set<DashView>> = new Map();
  let configSource: 'live' | 'static' | 'loading' = 'loading';
  let configSaving = false;
  let configSaveMsg = '';
  let configError = '';

  /** New staff email input (username part only). */
  let newStaffUsername = '';
  const DOMAIN = '@internationalrelocationpartner.com';

  function initAccessMap(raw: Record<string, string[]> | null) {
    const source = raw ?? STATIC_SECTION_ACCESS;
    const map = new Map<string, Set<DashView>>();
    for (const [email, views] of Object.entries(source)) {
      // Always ensure admins keep 'admin' view
      const set = new Set<DashView>(views as DashView[]);
      map.set(email, set);
    }
    // Make sure the two super-admins are always present
    for (const adminEmail of [
      'luisarmando@internationalrelocationpartner.com',
      'pablo@internationalrelocationpartner.com',
    ]) {
      if (!map.has(adminEmail)) {
        map.set(adminEmail, new Set(ALL_VIEWS));
      } else {
        // Ensure admins always have 'admin' view
        map.get(adminEmail)!.add('admin');
      }
    }
    return map;
  }

  async function loadConfig() {
    configSource = 'loading';
    try {
      const live = await fetchLiveAccessConfig();
      if (live) {
        accessMap = initAccessMap(live);
        configSource = 'live';
      } else {
        accessMap = initAccessMap(null);
        configSource = 'static';
      }
    } catch {
      accessMap = initAccessMap(null);
      configSource = 'static';
    }
  }

  function toggleView(email: string, view: DashView) {
    // A user cannot edit their own access row
    if (email === $authEmail) return;
    // Super-admins always keep 'admin' view
    const superAdmins = [
      'luisarmando@internationalrelocationpartner.com',
      'pablo@internationalrelocationpartner.com',
    ];
    if (view === 'admin' && superAdmins.includes(email)) return;
    const set = accessMap.get(email);
    if (!set) return;
    if (set.has(view)) set.delete(view);
    else set.add(view);
    accessMap = new Map(accessMap); // trigger reactivity
  }

  function addStaffMember() {
    const username = newStaffUsername.trim().toLowerCase();
    if (!username) return;
    const email = username + DOMAIN;
    if (accessMap.has(email)) {
      configError = `${email} is already in the list.`;
      return;
    }
    const defaultSet = new Set<DashView>(DEFAULT_ACCESS);
    accessMap.set(email, defaultSet);
    accessMap = new Map(accessMap);
    newStaffUsername = '';
    configError = '';
  }

  function removeStaffMember(email: string) {
    const superAdmins = [
      'luisarmando@internationalrelocationpartner.com',
      'pablo@internationalrelocationpartner.com',
    ];
    if (superAdmins.includes(email)) {
      configError = 'Cannot remove the super-admin accounts.';
      return;
    }
    accessMap.delete(email);
    accessMap = new Map(accessMap);
  }

  async function handleSaveConfig() {
    configSaving = true;
    configSaveMsg = '';
    configError = '';
    try {
      // Serialise Map → plain object (Set → sorted array)
      const serialised: Record<string, string[]> = {};
      for (const [email, viewSet] of accessMap.entries()) {
        serialised[email] = Array.from(viewSet).sort();
      }
      await saveAccessConfig(serialised);
      configSource = 'live';
      configSaveMsg = '✓ Access config saved to Firestore — changes are live immediately.';
    } catch (err: any) {
      configError = '✗ Save failed: ' + (err?.message ?? 'unknown error');
    } finally {
      configSaving = false;
    }
  }

  // ─── Sessions State ────────────────────────────────────────────────────────
  let sessions: AdminSession[] = [];
  let sessionsLoading = false;
  let sessionsError = '';

  async function loadSessions() {
    sessionsLoading = true;
    sessionsError = '';
    try {
      sessions = await fetchAdminSessions();
    } catch (err: any) {
      sessionsError = 'Failed to load sessions: ' + (err?.message ?? 'unknown error');
    } finally {
      sessionsLoading = false;
    }
  }

  function timeAgo(iso: string): string {
    if (!iso) return '—';
    const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  }

  function timeUntil(iso: string): string {
    if (!iso) return '—';
    const ms = new Date(iso).getTime() - Date.now();
    if (ms <= 0) return 'expired';
    const h = Math.floor(ms / 3_600_000);
    const m = Math.floor((ms % 3_600_000) / 60_000);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  }

  // ─── Action Permissions State ─────────────────────────────────────────────
  //
  // Live action-permission grid: email → { can_approve_quotes: boolean, ... }
  // Mirrors liveActionPermissions in store.ts. Admin edits here write through
  // to Firestore via saveActionPermissions and update the shared reactive store.
  //
  // ACTION_KEYS enumerates every toggleable permission gate; add new entries
  // here (and to canApproveQuotes etc. in store.ts) as new gates are created.
  const ACTION_KEYS: Record<string, string> = {
    can_approve_quotes: '✅ Approve Quotes',
  };

  let permMap: Map<string, Record<string, boolean>> = new Map();
  let permSource: 'live' | 'empty' | 'loading' = 'loading';
  let permSaving = false;
  let permSaveMsg = '';
  let permError = '';

  async function loadPermissions() {
    permSource = 'loading';
    try {
      const live = await fetchLiveActionPermissions();
      const raw = live ?? {};
      const map = new Map<string, Record<string, boolean>>();
      // Seed from access map so every known staff member appears in the grid
      for (const email of accessMap.keys()) {
        map.set(email, { ...(raw[email] ?? {}) });
      }
      // Also include anyone who already has explicit permissions
      for (const [email, perms] of Object.entries(raw)) {
        if (!map.has(email)) map.set(email, { ...perms });
      }
      permMap = map;
      permSource = live ? 'live' : 'empty';
    } catch {
      permSource = 'empty';
    }
  }

  function togglePermission(email: string, key: string) {
    const current = permMap.get(email) ?? {};
    permMap.set(email, { ...current, [key]: !current[key] });
    permMap = new Map(permMap);
  }

  async function handleSavePermissions() {
    permSaving = true;
    permSaveMsg = '';
    permError = '';
    try {
      const serialised: Record<string, Record<string, boolean>> = {};
      for (const [email, perms] of permMap.entries()) {
        // Only persist rows that have at least one true permission
        const hasAny = Object.values(perms).some(Boolean);
        if (hasAny) serialised[email] = { ...perms };
      }
      await saveActionPermissions(serialised);
      // Sync the shared reactive store immediately
      liveActionPermissions.set(serialised);
      permSource = 'live';
      permSaveMsg = '✓ Action permissions saved — canApproveQuotes is now live for all users.';
    } catch (err: any) {
      permError = '✗ Save failed: ' + (err?.message ?? 'unknown error');
    } finally {
      permSaving = false;
    }
  }

  // ─── Init ──────────────────────────────────────────────────────────────────
  onMount(async () => {
    await Promise.all([loadConfig(), loadSessions()]);
    // Permissions tab loads lazily when first opened — pre-warm here so
    // the grid is ready before the user clicks the tab.
    await loadPermissions();
  });

  $: tabSessions = sessions.filter(s => activeTab === 'sessions' || true);
  $: activeSessions = sessions.filter(s => s.isActive);
  $: expiredSessions = sessions.filter(s => !s.isActive);

  // ─── Staff Activity State ─────────────────────────────────────────────────
  let activityUser = '';
  let activityEntries: UserActivityEntry[] = [];
  let activityLoading = false;
  let activityError = '';

  /** Known staff list derived from the access map for the user picker. */
  $: staffList = [...accessMap.keys()].sort();

  async function loadActivity(email: string) {
    if (!email) return;
    activityUser = email;
    activityLoading = true;
    activityError = '';
    activityEntries = [];
    try {
      activityEntries = await fetchUserActivity(email);
    } catch (err: any) {
      activityError = 'Failed to load activity: ' + (err?.message ?? 'unknown error');
    } finally {
      activityLoading = false;
    }
  }

  const ACTION_ICONS: Record<string, string> = {
    stage_change:          '→',
    note_added:            '📝',
    email_triggered:       '📧',
    email_sent:            '✉️',
    email_cancelled:       '🚫',
    email_suggestion_dismissed: '🙈',
    field_edit:            '✏️',
    field_revert:          '↩️',
    action_executed:       '⚡',
    manual_intake:         '🆕',
    call_rescheduled:      '📅',
    client_created_by_staff: '👤',
    gemini_notes_received: '🤖',
    pending_action_resolved: '✅',
    email_suggested:       '💡',
  };

  function activityIcon(type: string): string {
    return ACTION_ICONS[type] ?? '•';
  }

  /** Maps entry.type → a CSS category key for accent-colour theming */
  function activityTypeCategory(type: string): string {
    if (type === 'field_edit' || type === 'field_revert')     return 'edit';
    if (type === 'stage_change')                               return 'stage';
    if (type === 'email_triggered' || type === 'email_sent')  return 'email';
    if (type === 'note_added')                                 return 'note';
    if (type.startsWith('gemini') || type.startsWith('ai'))   return 'ai';
    if (type === 'action_executed' || type === 'call_rescheduled' || type === 'pending_action_resolved') return 'action';
    return 'default';
  }

  function activityLabel(entry: UserActivityEntry): string {
    switch (entry.type) {
      case 'stage_change':
        return `Moved stage: ${entry.from ?? '?'} → ${entry.to ?? '?'}`;
      case 'note_added':
        return 'Added a note';
      case 'email_triggered':
      case 'email_sent':
        return `Sent email: ${entry.emailType ?? entry.type}`;
      case 'email_cancelled':
        return `Cancelled email: ${entry.emailType ?? '?'}`;
      case 'email_suggestion_dismissed':
        return `Dismissed suggestion: ${entry.emailType ?? '?'}`;
      case 'field_edit':
        return `Edited field: ${entry.fieldPath ?? '?'}`;
      case 'field_revert':
        return `Reverted field: ${entry.fieldPath ?? '?'}`;
      case 'action_executed':
        return `Ran action: ${entry.actionKey ?? '?'}`;
      case 'manual_intake':
        return 'Added client manually';
      case 'call_rescheduled':
        return `Rescheduled call → ${entry.newSlot ? new Date(entry.newSlot as string).toLocaleDateString('en-US',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}) : '?'}`;
      case 'client_created_by_staff':
        return 'Created client record';
      case 'gemini_notes_received':
        return 'Synced Gemini meeting notes';
      case 'pending_action_resolved':
        return `Resolved pending action (${entry.resolution ?? 'done'})`;
      default:
        return entry.type.replace(/_/g, ' ');
    }
  }

  function formatActivityTs(iso: string): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }
</script>

<div class="admin-view">
  <div class="admin-view__header">
    <h2 class="admin-view__title">Admin Panel</h2>
    <p class="admin-view__subtitle">Manage CRM access and monitor staff sessions · Only visible to admins</p>
  </div>

  <!-- Tabs -->
  <div class="admin-tabs">
    <button
      class="admin-tab"
      class:admin-tab--active={activeTab === 'access'}
      on:click={() => activeTab = 'access'}
    >
      🔑 Access Config
    </button>
    <button
      class="admin-tab"
      class:admin-tab--active={activeTab === 'sessions'}
      on:click={() => { activeTab = 'sessions'; loadSessions(); }}
    >
      👥 Session Log
      {#if activeSessions.length > 0}
        <span class="admin-tab__badge">{activeSessions.length}</span>
      {/if}
    </button>
    <button
      class="admin-tab"
      class:admin-tab--active={activeTab === 'activity'}
      on:click={() => (activeTab = 'activity')}
    >
      👣 Staff Activity
    </button>
    <button
      class="admin-tab"
      class:admin-tab--active={activeTab === 'permissions'}
      on:click={() => { activeTab = 'permissions'; if (permSource === 'loading') loadPermissions(); }}
    >
      🛡️ Action Permissions
    </button>
  </div>

  <!-- ════════ ACCESS CONFIG TAB ════════ -->
  {#if activeTab === 'access'}
    <div class="admin-section">

      {#if configSource === 'loading'}
        <div class="admin-loading">Loading config…</div>
      {:else}
        <!-- Config source indicator -->
        <div class="config-source">
          {#if configSource === 'live'}
            <span class="badge badge--live">🟢 Live · Stored in Firestore</span>
          {:else}
            <span class="badge badge--static">🟡 Static fallback · Edit below and save to go live</span>
          {/if}
          <span class="config-source__note">Changes take effect immediately for all staff — no deploy needed.</span>
        </div>

        <!-- Access grid -->
        <div class="access-grid-wrapper">
          <table class="access-grid">
            <thead>
              <tr>
                <th class="access-grid__email-col">Staff Email</th>
                {#each GRID_VIEWS as view}
                  <th class="access-grid__view-col">{VIEW_LABELS[view]}</th>
                {/each}
                <th class="access-grid__action-col"></th>
              </tr>
            </thead>
            <tbody>
              {#each [...accessMap.entries()] as [email, viewSet] (email)}
                {@const isSuperAdmin = email === 'luisarmando@internationalrelocationpartner.com' || email === 'pablo@internationalrelocationpartner.com'}
                {@const isSelf = email === $authEmail}
                <tr
                  class="access-row"
                  class:access-row--admin={isSuperAdmin}
                  class:access-row--self={isSelf}
                  title={isSelf ? 'You cannot change your own access' : undefined}
                >
                  <td class="access-grid__email-cell">
                    <span class="email-tag" title={email}>
                      {email.split('@')[0]}
                      <span class="email-tag__domain">@irp</span>
                    </span>
                    {#if isSuperAdmin}<span class="admin-badge">admin</span>{/if}
                    {#if isSelf}<span class="self-badge" title="This is you — your own access cannot be modified">🔒 you</span>{/if}
                  </td>
                  {#each GRID_VIEWS as view}
                    <td class="access-grid__check-cell">
                      <button
                        class="view-toggle"
                        class:view-toggle--on={viewSet.has(view)}
                        class:view-toggle--locked={isSelf}
                        on:click={() => toggleView(email, view)}
                        disabled={isSelf}
                        title={isSelf ? 'Cannot change your own access' : `${viewSet.has(view) ? 'Revoke' : 'Grant'} ${VIEW_LABELS[view]} access for ${email}`}
                        aria-label="{VIEW_LABELS[view]}: {viewSet.has(view) ? 'granted' : 'revoked'}{isSelf ? ' (locked)' : ''}"
                      >
                        {#if isSelf}
                          {viewSet.has(view) ? '✓' : '—'}
                        {:else}
                          {viewSet.has(view) ? '✓' : '—'}
                        {/if}
                      </button>
                    </td>
                  {/each}
                  <td class="access-grid__action-cell">
                    {#if !isSuperAdmin && !isSelf}
                      <button class="remove-btn" on:click={() => removeStaffMember(email)} title="Remove {email}">✕</button>
                    {/if}
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>

        <!-- Add staff member -->
        <div class="add-staff">
          <label class="add-staff__label">Add Staff Member</label>
          <div class="add-staff__row">
            <div class="add-staff__input-group">
              <input
                type="text"
                class="add-staff__input"
                placeholder="firstname"
                bind:value={newStaffUsername}
                on:keydown={(e) => e.key === 'Enter' && addStaffMember()}
              />
              <span class="add-staff__domain">{DOMAIN}</span>
            </div>
            <button class="add-staff__btn" on:click={addStaffMember} disabled={!newStaffUsername.trim()}>
              + Add
            </button>
          </div>
          <p class="add-staff__hint">New staff members start with Board + List access. Adjust above then save.</p>
        </div>

        <!-- Save bar -->
        {#if configSaveMsg}
          <div class="save-msg save-msg--success">{configSaveMsg}</div>
        {/if}
        {#if configError}
          <div class="save-msg save-msg--error">{configError}</div>
        {/if}

        <div class="save-bar">
          <button class="save-btn" on:click={handleSaveConfig} disabled={configSaving}>
            {configSaving ? '⏳ Saving…' : '💾 Save to Firestore'}
          </button>
          <button class="reload-btn" on:click={loadConfig} disabled={configSource === 'loading'}>
            ↺ Reload
          </button>
        </div>
      {/if}
    </div>
  {/if}

  <!-- ════════ SESSION LOG TAB ════════ -->
  {#if activeTab === 'sessions'}
    <div class="admin-section">
      <div class="sessions-header">
        <div class="sessions-stats">
          <span class="sessions-stat sessions-stat--active">
            🟢 {activeSessions.length} active session{activeSessions.length !== 1 ? 's' : ''}
          </span>
          <span class="sessions-stat sessions-stat--expired">
            ⚪ {expiredSessions.length} expired
          </span>
        </div>
        <button class="reload-btn" on:click={loadSessions} disabled={sessionsLoading}>
          {sessionsLoading ? '⏳ Loading…' : '↺ Refresh'}
        </button>
      </div>

      {#if sessionsError}
        <div class="save-msg save-msg--error">{sessionsError}</div>
      {/if}

      {#if sessionsLoading && sessions.length === 0}
        <div class="admin-loading">Loading sessions…</div>
      {:else if sessions.length === 0}
        <div class="admin-empty">No sessions found.</div>
      {:else}
        <div class="sessions-table-wrapper">
          <table class="sessions-table">
            <thead>
              <tr>
                <th>Staff Email</th>
                <th>Logged In</th>
                <th>Expires In</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {#each sessions as session (session.email + session.createdAt)}
                <tr class="session-row" class:session-row--active={session.isActive} class:session-row--expired={!session.isActive}>
                  <td class="session-cell session-cell--email">
                    <span class="email-tag">
                      {session.email.split('@')[0]}
                      <span class="email-tag__domain">@irp</span>
                    </span>
                  </td>
                  <td class="session-cell">{timeAgo(session.createdAt)}</td>
                  <td class="session-cell">{timeUntil(session.expiresAt)}</td>
                  <td class="session-cell">
                    {#if session.isActive}
                      <span class="status-badge status-badge--active">Active</span>
                    {:else}
                      <span class="status-badge status-badge--expired">Expired</span>
                    {/if}
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
        <p class="sessions-note">Sessions expire after 24 hours. Users must re-authenticate after expiry.</p>
      {/if}
    </div>
  {/if}

  <!-- ════════ ACTION PERMISSIONS TAB ════════ -->
  <!--
    Renders a checkbox grid:  email × ActionKey → boolean
    Reads from the shared liveActionPermissions store (set in store.ts).
    On save → PUT /api/dashboard/action-permissions (dashboardRouter.ts)
               + liveActionPermissions.set(serialised)   ← reactive instantly
    canApproveQuotes in store.ts re-evaluates automatically → QuoteEditor
    shows/hides the Approve button without any page reload.
  -->
  {#if activeTab === 'permissions'}
    <div class="admin-section">

      {#if permSource === 'loading'}
        <div class="admin-loading">Loading permissions…</div>
      {:else}
        <!-- Source indicator -->
        <div class="config-source">
          {#if permSource === 'live'}
            <span class="badge badge--live">🟢 Live · Stored in Firestore</span>
          {:else}
            <span class="badge badge--static">🟡 No overrides saved — only static QUOTE_APPROVERS active</span>
          {/if}
          <span class="config-source__note">
            Toggling a permission here updates the live store immediately for all open tabs after save.
          </span>
        </div>

        <!-- Permissions grid: one row per staff member, one column per ActionKey -->
        <div class="access-grid-wrapper">
          <table class="access-grid perm-grid">
            <thead>
              <tr>
                <th class="access-grid__email-col">Staff Email</th>
                {#each Object.entries(ACTION_KEYS) as [key, label] (key)}
                  <th class="access-grid__view-col perm-col-header" title={key}>{label}</th>
                {/each}
              </tr>
            </thead>
            <tbody>
              {#each [...permMap.entries()] as [email, perms] (email)}
                <tr class="access-row">
                  <td class="access-grid__email-cell">
                    <span class="email-tag">
                      {email.split('@')[0]}
                      <span class="email-tag__domain">@irp</span>
                    </span>
                  </td>
                  {#each Object.keys(ACTION_KEYS) as key (key)}
                    <td class="access-grid__check-cell">
                      <button
                        class="view-toggle"
                        class:view-toggle--on={!!perms[key]}
                        on:click={() => togglePermission(email, key)}
                        title="{!!perms[key] ? 'Revoke' : 'Grant'} {ACTION_KEYS[key]} for {email}"
                        aria-label="{ACTION_KEYS[key]}: {!!perms[key] ? 'granted' : 'revoked'}"
                      >
                        {!!perms[key] ? '✓' : '—'}
                      </button>
                    </td>
                  {/each}
                </tr>
              {/each}
            </tbody>
          </table>
        </div>

        <!-- Save bar -->
        {#if permSaveMsg}
          <div class="save-msg save-msg--success">{permSaveMsg}</div>
        {/if}
        {#if permError}
          <div class="save-msg save-msg--error">{permError}</div>
        {/if}

        <div class="save-bar">
          <button class="save-btn" on:click={handleSavePermissions} disabled={permSaving}>
            {permSaving ? '⏳ Saving…' : '💾 Save to Firestore'}
          </button>
          <button class="reload-btn" on:click={loadPermissions} disabled={permSource === 'loading'}>
            ↺ Reload
          </button>
        </div>

        <p class="add-staff__hint" style="margin-top:0.6rem">
          New permission gates (e.g. <code>can_send_quotes</code>) are added to
          <code>ACTION_KEYS</code> in this file and to the corresponding <code>can*</code>
          derived store in <code>store.ts</code> — zero Firestore schema migration needed.
        </p>
      {/if}
    </div>
  {/if}

  <!-- ════════ STAFF ACTIVITY TAB ════════ -->
  {#if activeTab === 'activity'}
    <div class="admin-section">

      <!-- User picker -->
      <div class="activity-header">
        <div class="activity-picker">
          <label class="add-staff__label" for="activity-email-select">View activity for</label>
          <div class="activity-picker__row">
            <select
              id="activity-email-select"
              class="activity-select"
              bind:value={activityUser}
              on:change={() => loadActivity(activityUser)}
            >
              <option value="">— pick a staff member —</option>
              {#each staffList as email (email)}
                <option value={email}>{email.split('@')[0]} @irp</option>
              {/each}
            </select>
            {#if activityUser}
              <button class="reload-btn" on:click={() => loadActivity(activityUser)} disabled={activityLoading}>
                {activityLoading ? '⏳' : '↺'}
              </button>
            {/if}
          </div>
        </div>

        {#if activityEntries.length > 0}
          <span class="activity-count-badge">
            {activityEntries.length} action{activityEntries.length !== 1 ? 's' : ''}
          </span>
        {/if}
      </div>

      <!-- Error -->
      {#if activityError}
        <div class="save-msg save-msg--error">{activityError}</div>
      {/if}

      <!-- Loading -->
      {#if activityLoading}
        <div class="admin-loading">Scanning all client records…</div>

      <!-- No user selected -->
      {:else if !activityUser}
        <div class="admin-empty">Select a staff member above to see their complete action history across all clients.</div>

      <!-- Empty -->
      {:else if activityEntries.length === 0}
        <div class="admin-empty">No recorded actions found for {activityUser.split('@')[0]}.</div>

      <!-- Timeline feed -->
      {:else}
        <div class="activity-feed">
          {#each activityEntries as entry (entry._clientDocId + (entry.timestamp ?? Math.random()))}
            <div class="activity-entry">
              <!-- LEFT: timeline node + connector line -->
              <div class="activity-entry__connector">
                <div class="activity-entry__icon-node">{activityIcon(entry.type)}</div>
                <span class="activity-entry__line"></span>
              </div>

              <!-- RIGHT: premium card with type-specific accent border -->
              <div class="activity-entry__card" data-atype={activityTypeCategory(entry.type)}>
                <div class="activity-entry__top">
                  <span class="activity-entry__action">{activityLabel(entry)}</span>
                  <span class="activity-entry__ts">{formatActivityTs(entry.timestamp)}</span>
                </div>
                <div class="activity-entry__bottom">
                  <span class="activity-entry__client">
                    <span class="activity-entry__client-avatar">
                      {entry._clientDisplayName?.slice(0,1)?.toUpperCase() ?? '?'}
                    </span>
                    <span class="activity-entry__client-name">{entry._clientDisplayName}</span>
                    <span class="activity-entry__client-email">{entry._clientEmail}</span>
                  </span>
                  <span class="activity-entry__type-chip" data-atype={activityTypeCategory(entry.type)}>
                    {entry.type.replace(/_/g,' ')}
                  </span>
                </div>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  /* ─── Design tokens ──────────────────────────────────────────────────────── */
  /* Root bg: #f8fafc | Card: #ffffff | Border: #e2e8f0 | Accent: #02b5bb */

  /* ─── Root wrapper ───────────────────────────────────────────────────────── */
  .admin-view {
    padding: 2.5rem 2rem;
    max-width: 1140px;
    margin: 0 auto;
    background: var(--irp-bg, #fafbfc);
    color: var(--irp-text, #181818);
    font-family: var(--font-paragraph, 'Jost'), system-ui, sans-serif;
    font-feature-settings: 'cv02','cv03','cv04','cv11';
  }

  /* ─── Header ─────────────────────────────────────────────────────────────── */
  .admin-view__header {
    margin-bottom: 2rem;
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
  }

  .admin-view__title {
    font-size: 1.55rem;
    font-weight: 800;
    color: #0f172a;
    margin: 0;
    letter-spacing: -0.025em;
  }

  .admin-view__subtitle {
    font-size: 0.8rem;
    color: #64748b;
    margin: 0;
    letter-spacing: 0.01em;
  }

  /* ─── Tabs ───────────────────────────────────────────────────────────────── */
  .admin-tabs {
    display: flex;
    flex-direction: row;
    gap: 0;
    margin-bottom: 1.5rem;
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    padding: 4px;
    width: fit-content;
    box-shadow: 0 1px 3px rgba(0,0,0,0.06);
  }

  .admin-tab {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.46rem 1.1rem;
    background: none;
    border: none;
    border-radius: 7px;
    color: #64748b;
    font-size: 0.84rem;
    font-weight: 600;
    letter-spacing: 0.01em;
    cursor: pointer;
    transition: color 0.14s cubic-bezier(0.4,0,0.2,1), background 0.14s cubic-bezier(0.4,0,0.2,1);
  }

  .admin-tab:hover {
    background: #f1f5f9;
    color: #475569;
  }

  .admin-tab--active {
    background: linear-gradient(135deg, rgba(2,181,187,0.12) 0%, rgba(139,92,246,0.08) 100%);
    color: #02999e;
    border: 1px solid rgba(2,181,187,0.20);
    box-shadow: 0 1px 3px rgba(2,181,187,0.12);
  }

  .admin-tab__badge {
    background: linear-gradient(135deg, #02b5bb, #02999e);
    color: #fff;
    border-radius: 999px;
    font-size: 0.68rem;
    font-weight: 800;
    padding: 0.1em 0.55em;
    line-height: 1.6;
  }

  /* ─── Section card ───────────────────────────────────────────────────────── */
  .admin-section {
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 16px;
    padding: 1.75rem;
    box-shadow: 0 1px 3px rgba(0,0,0,0.06), 0 8px 32px rgba(0,0,0,0.04);
    position: relative;
    overflow: hidden;
  }

  .admin-loading,
  .admin-empty {
    text-align: center;
    color: #94a3b8;
    padding: 3rem;
    font-size: 0.88rem;
    letter-spacing: 0.02em;
  }

  /* ─── Config source indicator ────────────────────────────────────────────── */
  .config-source {
    display: flex;
    align-items: center;
    gap: 0.9rem;
    margin-bottom: 1.4rem;
    flex-wrap: wrap;
    padding: 0.7rem 1rem;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 10px;
  }

  .badge {
    display: inline-flex;
    align-items: center;
    gap: 0.3em;
    padding: 0.28em 0.85em;
    border-radius: 999px;
    font-size: 0.74rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    white-space: nowrap;
  }

  .badge--live {
    background: #f0fdf4;
    color: #16a34a;
    border: 1px solid #bbf7d0;
  }

  .badge--static {
    background: #fffbeb;
    color: #d97706;
    border: 1px solid #fde68a;
  }

  .config-source__note {
    font-size: 0.76rem;
    color: #64748b;
    font-style: italic;
  }

  /* ─── Access Grid ────────────────────────────────────────────────────────── */
  .access-grid-wrapper {
    overflow-x: auto;
    margin-bottom: 1.6rem;
    border-radius: 10px;
    border: 1px solid #e2e8f0;
    box-shadow: 0 2px 8px rgba(0,0,0,0.04);
  }

  .access-grid {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.83rem;
  }

  .access-grid thead tr {
    background: #f8fafc;
  }

  .access-grid thead th {
    padding: 0.7rem 0.85rem;
    text-align: center;
    font-weight: 700;
    color: #94a3b8;
    font-size: 0.69rem;
    text-transform: uppercase;
    letter-spacing: 0.09em;
    white-space: nowrap;
    border-bottom: 1px solid #e2e8f0;
  }

  .access-grid__email-col { text-align: left !important; min-width: 230px; }
  .access-grid__view-col  { width: 74px; }
  .access-grid__action-col { width: 40px; }

  .access-row {
    border-bottom: 1px solid #f1f5f9;
    transition: background 0.14s cubic-bezier(0.4,0,0.2,1);
  }

  .access-row:hover { background: #fafbff; }

  .access-row--admin {
    background: linear-gradient(90deg, rgba(2,181,187,0.06) 0%, transparent 100%);
  }
  .access-row--admin:hover {
    background: linear-gradient(90deg, rgba(2,181,187,0.09) 0%, transparent 100%);
  }

  .access-row--self {
    background: linear-gradient(90deg, rgba(245,158,11,0.05) 0%, transparent 100%);
    border-left: 2px solid rgba(245,158,11,0.4);
  }
  .access-row--self:hover {
    background: linear-gradient(90deg, rgba(245,158,11,0.09) 0%, rgba(245,158,11,0.02) 100%);
  }

  /* ─── Cell layouts ───────────────────────────────────────────────────────── */
  .access-grid__email-cell {
    padding: 0.75rem 0.85rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .access-grid__check-cell {
    text-align: center;
    padding: 0.55rem 0.4rem;
  }

  .access-grid__action-cell {
    text-align: center;
    padding: 0.4rem 0.5rem;
  }

  /* ─── Email tag ──────────────────────────────────────────────────────────── */
  .email-tag {
    font-family: 'SF Mono','Fira Code','JetBrains Mono',monospace;
    font-size: 0.8rem;
    color: #1e293b;
    white-space: nowrap;
    letter-spacing: -0.01em;
  }

  .email-tag__domain {
    color: #94a3b8;
    font-size: 0.72rem;
  }

  /* ─── Admin badge ────────────────────────────────────────────────────────── */
  .admin-badge {
    font-size: 0.64rem;
    font-weight: 800;
    background: linear-gradient(135deg, rgba(2,181,187,0.12), rgba(139,92,246,0.08));
    color: #02999e;
    border: 1px solid rgba(2,181,187,0.25);
    border-radius: 5px;
    padding: 0.18em 0.55em;
    text-transform: uppercase;
    letter-spacing: 0.07em;
  }

  /* ─── Self badge ─────────────────────────────────────────────────────────── */
  .self-badge {
    font-size: 0.64rem;
    font-weight: 800;
    background: rgba(245,158,11,0.08);
    color: #d97706;
    border: 1px solid rgba(245,158,11,0.3);
    border-radius: 5px;
    padding: 0.18em 0.55em;
    letter-spacing: 0.06em;
    white-space: nowrap;
  }

  /* ─── View toggle buttons ────────────────────────────────────────────────── */
  .view-toggle {
    width: 34px;
    height: 26px;
    border-radius: 6px;
    border: 1px solid #e2e8f0;
    background: #f8fafc;
    color: #94a3b8;
    font-size: 0.78rem;
    font-weight: 800;
    cursor: pointer;
    transition:
      background 0.14s cubic-bezier(0.4,0,0.2,1),
      color 0.14s cubic-bezier(0.4,0,0.2,1),
      border-color 0.14s cubic-bezier(0.4,0,0.2,1),
      box-shadow 0.14s cubic-bezier(0.4,0,0.2,1),
      transform 0.14s cubic-bezier(0.4,0,0.2,1);
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto;
  }

  .view-toggle:hover:not(:disabled):not(.view-toggle--locked) {
    background: #f1f5f9;
    color: #475569;
    border-color: #cbd5e1;
    transform: scale(1.08);
  }

  .view-toggle--on {
    background: linear-gradient(135deg, rgba(16,185,129,0.15), rgba(16,185,129,0.08));
    color: #059669;
    border-color: rgba(16,185,129,0.4);
    box-shadow: 0 0 0 1px rgba(16,185,129,0.2);
  }

  .view-toggle--on:hover:not(:disabled) {
    background: linear-gradient(135deg, rgba(16,185,129,0.22), rgba(16,185,129,0.14));
    transform: scale(1.1);
  }

  .view-toggle--locked {
    cursor: not-allowed;
    opacity: 0.4;
    border-style: dashed;
  }
  .view-toggle--locked:hover {
    transform: none !important;
    box-shadow: none !important;
  }

  /* ─── Remove button ──────────────────────────────────────────────────────── */
  .remove-btn {
    width: 27px;
    height: 27px;
    border-radius: 6px;
    border: 1px solid rgba(239,68,68,0.2);
    background: rgba(239,68,68,0.05);
    color: #ef4444;
    font-size: 0.72rem;
    font-weight: 800;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition:
      background 0.14s cubic-bezier(0.4,0,0.2,1),
      border-color 0.14s cubic-bezier(0.4,0,0.2,1),
      transform 0.14s cubic-bezier(0.4,0,0.2,1);
  }
  .remove-btn:hover {
    background: rgba(239,68,68,0.12);
    border-color: rgba(239,68,68,0.35);
    transform: scale(1.1);
  }

  /* ─── Add Staff ──────────────────────────────────────────────────────────── */
  .add-staff {
    margin-bottom: 1.4rem;
  }

  .add-staff__label {
    display: block;
    font-size: 0.7rem;
    font-weight: 800;
    color: #94a3b8;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    margin-bottom: 0.55rem;
  }

  .add-staff__row {
    display: flex;
    gap: 0.55rem;
    align-items: center;
  }

  .add-staff__input-group {
    display: flex;
    align-items: center;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    overflow: hidden;
    flex: 1;
    transition: border-color 0.14s cubic-bezier(0.4,0,0.2,1), box-shadow 0.14s cubic-bezier(0.4,0,0.2,1);
  }

  .add-staff__input-group:focus-within {
    border-color: rgba(2,181,187,0.48);
    box-shadow: 0 0 0 3px rgba(2,181,187,0.10);
  }

  .add-staff__input {
    flex: 1;
    background: transparent;
    border: none;
    outline: none;
    padding: 0.55rem 0.9rem;
    color: #0f172a;
    font-size: 0.88rem;
    font-family: 'SF Mono','Fira Code',monospace;
    letter-spacing: -0.01em;
  }

  .add-staff__input::placeholder { color: #94a3b8; }

  .add-staff__domain {
    padding-right: 0.9rem;
    color: #94a3b8;
    font-size: 0.8rem;
    font-family: 'SF Mono','Fira Code',monospace;
    white-space: nowrap;
  }

  .add-staff__btn {
    background: linear-gradient(135deg, #02b5bb, #02999e);
    color: #fff;
    border: none;
    padding: 0.52rem 1.1rem;
    border-radius: 8px;
    font-size: 0.84rem;
    font-weight: 700;
    cursor: pointer;
    transition:
      filter 0.14s cubic-bezier(0.4,0,0.2,1),
      transform 0.14s cubic-bezier(0.4,0,0.2,1);
  }
  .add-staff__btn:hover:not(:disabled) {
    filter: brightness(1.08);
    transform: scale(1.02);
  }
  .add-staff__btn:disabled { opacity: 0.45; cursor: default; }

  .add-staff__hint {
    font-size: 0.72rem;
    color: #94a3b8;
    margin: 0.45rem 0 0;
    font-style: italic;
  }

  /* ─── Save bar ───────────────────────────────────────────────────────────── */
  .save-bar {
    display: flex;
    gap: 0.6rem;
    margin-top: 1.2rem;
    align-items: center;
  }

  .save-btn {
    padding: 0.6rem 1.5rem;
    background: linear-gradient(135deg, #02b5bb 0%, #02999e 100%);
    border: none;
    border-radius: 10px;
    color: #fff;
    font-size: 0.88rem;
    font-weight: 700;
    letter-spacing: 0.02em;
    cursor: pointer;
    box-shadow: 0 2px 8px rgba(2,181,187,0.30);
    transition:
      filter 0.14s cubic-bezier(0.4,0,0.2,1),
      transform 0.14s cubic-bezier(0.4,0,0.2,1),
      box-shadow 0.14s cubic-bezier(0.4,0,0.2,1);
  }
  .save-btn:hover:not(:disabled) {
    filter: brightness(1.06);
    transform: translateY(-1px);
    box-shadow: 0 4px 16px rgba(2,181,187,0.40);
  }
  .save-btn:active:not(:disabled) { transform: translateY(0); }
  .save-btn:disabled { opacity: 0.55; cursor: wait; }

  .reload-btn {
    padding: 0.52rem 1rem;
    background: #f1f5f9;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    color: #475569;
    font-size: 0.82rem;
    font-weight: 600;
    cursor: pointer;
    transition:
      background 0.14s cubic-bezier(0.4,0,0.2,1),
      color 0.14s cubic-bezier(0.4,0,0.2,1),
      border-color 0.14s cubic-bezier(0.4,0,0.2,1);
  }
  .reload-btn:hover:not(:disabled) {
    background: #e2e8f0;
    color: #1e293b;
  }
  .reload-btn:disabled { opacity: 0.4; cursor: default; }

  /* ─── Status messages ────────────────────────────────────────────────────── */
  .save-msg {
    padding: 0.6rem 1rem;
    border-radius: 8px;
    font-size: 0.82rem;
    font-weight: 600;
    margin-bottom: 0.8rem;
    animation: msg-slide-in 0.2s cubic-bezier(0.34,1.56,0.64,1);
  }

  @keyframes msg-slide-in {
    from { opacity: 0; transform: translateY(-6px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  .save-msg--success {
    background: #f0fdf4;
    color: #16a34a;
    border: 1px solid #bbf7d0;
  }
  .save-msg--error {
    background: #fef2f2;
    color: #dc2626;
    border: 1px solid #fecaca;
  }

  /* ─── Sessions ───────────────────────────────────────────────────────────── */
  .sessions-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 1.2rem;
    flex-wrap: wrap;
    gap: 0.6rem;
  }

  .sessions-stats {
    display: flex;
    gap: 1rem;
    align-items: center;
  }

  .sessions-stat {
    font-size: 0.82rem;
    font-weight: 700;
    letter-spacing: 0.02em;
  }
  .sessions-stat--active  { color: #059669; }
  .sessions-stat--expired { color: #94a3b8; }

  .sessions-table-wrapper {
    overflow-x: auto;
    border-radius: 10px;
    border: 1px solid #e2e8f0;
    box-shadow: 0 2px 8px rgba(0,0,0,0.04);
    margin-bottom: 1rem;
  }

  .sessions-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.83rem;
  }

  .sessions-table thead tr {
    background: #f8fafc;
  }

  .sessions-table thead th {
    padding: 0.65rem 1rem;
    text-align: left;
    font-weight: 700;
    color: #94a3b8;
    font-size: 0.69rem;
    text-transform: uppercase;
    letter-spacing: 0.09em;
    border-bottom: 1px solid #e2e8f0;
  }

  .session-row {
    border-bottom: 1px solid #f1f5f9;
    transition: background 0.14s cubic-bezier(0.4,0,0.2,1);
  }
  .session-row:hover { background: #fafbff; }

  .session-row--active {
    border-left: 3px solid #10b981;
  }

  .session-row--expired { opacity: 0.55; }

  .session-cell {
    padding: 0.65rem 1rem;
    font-size: 0.83rem;
    color: #334155;
  }

  .session-cell--email { font-weight: 600; }

  /* ─── Status badges ──────────────────────────────────────────────────────── */
  .status-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.3em;
    padding: 0.22em 0.75em;
    border-radius: 999px;
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.04em;
  }

  .status-badge--active {
    background: #f0fdf4;
    color: #16a34a;
    border: 1px solid #bbf7d0;
  }

  .status-badge--expired {
    background: #f8fafc;
    color: #94a3b8;
    border: 1px solid #e2e8f0;
  }

  .sessions-note {
    font-size: 0.72rem;
    color: #94a3b8;
    margin-top: 0.8rem;
    font-style: italic;
  }

  /* ─── Staff Activity ──────────────────────────────────────────────────────── */
  .activity-header {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 1.4rem;
    flex-wrap: wrap;
  }

  .activity-picker {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    flex: 1;
    max-width: 420px;
  }

  .activity-picker__row {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }

  .activity-select {
    flex: 1;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    color: #0f172a;
    font-size: 0.84rem;
    padding: 0.52rem 0.9rem;
    outline: none;
    cursor: pointer;
    min-width: 240px;
    transition: border-color 0.14s cubic-bezier(0.4,0,0.2,1), box-shadow 0.14s cubic-bezier(0.4,0,0.2,1);
    appearance: none;
    -webkit-appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 0.75rem center;
    padding-right: 2.2rem;
  }
  .activity-select:focus {
    border-color: rgba(2,181,187,0.48);
    box-shadow: 0 0 0 3px rgba(2,181,187,0.10);
  }
  .activity-select option { background: #ffffff; color: #0f172a; }

  .activity-count-badge {
    padding: 0.3em 0.9em;
    background: linear-gradient(135deg, rgba(2,181,187,0.10), rgba(139,92,246,0.07));
    border: 1px solid rgba(2,181,187,0.20);
    border-radius: 999px;
    font-size: 0.75rem;
    font-weight: 700;
    color: #02999e;
    letter-spacing: 0.03em;
    white-space: nowrap;
  }

  /* ─── Activity timeline — ultra-premium ────────────────────────────────── */
  .activity-feed {
    display: flex;
    flex-direction: column;
    max-height: 62vh;
    overflow-y: auto;
    padding: 0.125rem 0.5rem 0.25rem 0;
    scrollbar-width: thin;
    scrollbar-color: rgba(2,181,187,0.18) transparent;
  }
  .activity-feed::-webkit-scrollbar { width: 4px; }
  .activity-feed::-webkit-scrollbar-track { background: transparent; }
  .activity-feed::-webkit-scrollbar-thumb {
    background: rgba(2,181,187,0.18);
    border-radius: 999px;
  }
  .activity-feed:hover::-webkit-scrollbar-thumb { background: rgba(2,181,187,0.32); }

  /* ── Each row ──────────────────────────────────────────────────────────── */
  .activity-entry {
    display: flex;
    gap: 0.7rem;
    position: relative;
    animation: entry-in 0.18s cubic-bezier(0.4,0,0.2,1) both;
  }

  @keyframes entry-in {
    from { opacity: 0; transform: translateX(-8px); }
    to   { opacity: 1; transform: translateX(0); }
  }

  /* ── Timeline connector column ─────────────────────────────────────────── */
  .activity-entry__connector {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 34px;
    flex-shrink: 0;
    padding-top: 0.15rem;
  }

  /* Premium icon node — circle with emoji inside */
  .activity-entry__icon-node {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: #f8fafc;
    border: 1.5px solid #e2e8f0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.88rem;
    line-height: 1;
    flex-shrink: 0;
    box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    transition: border-color 0.14s, box-shadow 0.14s;
    position: relative;
    z-index: 1;
  }
  .activity-entry:hover .activity-entry__icon-node {
    border-color: rgba(2,181,187,0.22);
    box-shadow: 0 2px 8px rgba(2,181,187,0.12);
  }

  .activity-entry__line {
    flex: 1;
    width: 1.5px;
    background: linear-gradient(to bottom, #e2e8f0 0%, rgba(226,232,240,0) 100%);
    margin-top: 0.2rem;
    min-height: 12px;
  }
  .activity-entry:last-child .activity-entry__line { display: none; }

  /* ── Card ────────────────────────────────────────────────────────────────── */
  .activity-entry__card {
    flex: 1;
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-left: 3px solid #e2e8f0;  /* overridden per [data-atype] */
    border-radius: 10px;
    padding: 0.8rem 1rem;
    margin-bottom: 0.55rem;
    box-shadow: 0 1px 4px rgba(0,0,0,0.04), 0 4px 14px rgba(0,0,0,0.03);
    transition:
      box-shadow    0.14s cubic-bezier(0.4,0,0.2,1),
      transform     0.14s cubic-bezier(0.4,0,0.2,1),
      border-color  0.14s cubic-bezier(0.4,0,0.2,1);
    cursor: default;
  }
  .activity-entry__card:hover {
    box-shadow: 0 4px 16px rgba(0,0,0,0.08), 0 10px 28px rgba(0,0,0,0.04);
    transform: translateX(2px);
  }

  /* Type-specific left-border accents */
  .activity-entry__card[data-atype="edit"]    { border-left-color: #8b5cf6; }
  .activity-entry__card[data-atype="stage"]   { border-left-color: #f59e0b; }
  .activity-entry__card[data-atype="email"]   { border-left-color: #0d9488; }
  .activity-entry__card[data-atype="note"]    { border-left-color: #3b82f6; }
  .activity-entry__card[data-atype="ai"]      { border-left-color: #02b5bb; }
  .activity-entry__card[data-atype="action"]  { border-left-color: #10b981; }

  /* ── Top row ─────────────────────────────────────────────────────────────── */
  .activity-entry__top {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 0.75rem;
    margin-bottom: 0.5rem;
  }

  .activity-entry__action {
    font-size: 0.857rem;
    font-weight: 700;
    color: #0f172a;
    line-height: 1.35;
    letter-spacing: -0.01em;
  }

  .activity-entry__ts {
    font-size: 0.69rem;
    color: #94a3b8;
    white-space: nowrap;
    flex-shrink: 0;
    font-variant-numeric: tabular-nums;
    font-family: 'SF Mono', 'Fira Code', ui-monospace, monospace;
    background: #f8fafc;
    border: 1px solid #f1f5f9;
    border-radius: 5px;
    padding: 0.18em 0.52em;
    line-height: 1.55;
    margin-top: 0.06rem;
  }

  /* ── Bottom row ──────────────────────────────────────────────────────────── */
  .activity-entry__bottom {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    flex-wrap: wrap;
  }

  /* Client pill: avatar + name + email */
  .activity-entry__client {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    font-size: 0.74rem;
    color: #475569;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 999px;
    padding: 0.18em 0.65em 0.18em 0.28em;
    transition: background 0.12s, border-color 0.12s;
  }
  .activity-entry__client:hover { background: #f1f5f9; border-color: rgba(2,181,187,0.22); }

  /* Mini gradient avatar */
  .activity-entry__client-avatar {
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: linear-gradient(135deg, #02b5bb 0%, #0a8a8e 100%);
    color: #fff;
    font-size: 0.58rem;
    font-weight: 800;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    line-height: 1;
  }

  .activity-entry__client-name {
    font-weight: 600;
    color: #334155;
  }

  .activity-entry__client-email {
    color: #94a3b8;
    font-family: 'SF Mono', 'Fira Code', ui-monospace, monospace;
    font-size: 0.65rem;
    opacity: 0.85;
  }

  /* ── Type chip — colour-coded per category ───────────────────────────────── */
  .activity-entry__type-chip {
    margin-left: auto;
    border-radius: 999px;
    padding: 0.18em 0.65em;
    font-size: 0.67rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    white-space: nowrap;
    border: 1px solid transparent;
    /* default */
    background: #f1f5f9;
    color: #64748b;
    border-color: #e2e8f0;
  }
  .activity-entry__type-chip[data-atype="edit"]   { background: #ede9fe; color: #7c3aed; border-color: #c4b5fd; }
  .activity-entry__type-chip[data-atype="stage"]  { background: #fffbeb; color: #d97706; border-color: #fde68a; }
  .activity-entry__type-chip[data-atype="email"]  { background: #f0fdfa; color: #0d9488; border-color: #99f6e4; }
  .activity-entry__type-chip[data-atype="note"]   { background: #eff6ff; color: #2563eb; border-color: #bfdbfe; }
  .activity-entry__type-chip[data-atype="ai"]     { background: rgba(2,181,187,0.08); color: #02999e; border-color: rgba(2,181,187,0.22); }
  .activity-entry__type-chip[data-atype="action"] { background: #f0fdf4; color: #16a34a; border-color: #bbf7d0; }

  /* ─── Scrollbar styling ──────────────────────────────────────────────────── */
  .access-grid-wrapper::-webkit-scrollbar,
  .sessions-table-wrapper::-webkit-scrollbar { height: 5px; width: 5px; }
  .access-grid-wrapper::-webkit-scrollbar-track,
  .sessions-table-wrapper::-webkit-scrollbar-track { background: transparent; }
  .access-grid-wrapper::-webkit-scrollbar-thumb,
  .sessions-table-wrapper::-webkit-scrollbar-thumb {
    background: rgba(2,181,187,0.20);
    border-radius: 999px;
  }
</style>
