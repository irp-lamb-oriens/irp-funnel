<script lang="ts">
  import { onMount } from 'svelte';
  import { authToken, authEmail, STAGE_LABELS } from '../store.ts';

  // ── Types ────────────────────────────────────────────────────────────────
  interface Post {
    id: string;
    title: string;
    bodyHtml: string;
    author: string;
    status: 'draft' | 'scheduled' | 'dispatched';
    createdAt: string;
    updatedAt: string;
    sendAt: string;
    targeting: Targeting;
    sentCount?: number;
    failedCount?: number;
    dispatchedAt?: string;
  }

  interface Targeting {
    destinationCountries?: string[];
    originCountries?: string[];
    pipelineStages?: string[];
  }

  // ── API utils ─────────────────────────────────────────────────────────────
  function getApiUrl(): string {
    if (typeof window !== 'undefined' && window.location.origin.startsWith('http://localhost')) {
      return 'http://localhost:8000';
    }
    return 'https://irp-funnel-server.onrender.com';
  }

  async function apiFetch(path: string, options: RequestInit = {}) {
    const token = $authToken;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['x-dashboard-token'] = token;
    const res = await fetch(`${getApiUrl()}${path}`, { ...options, headers });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error ?? `HTTP ${res.status}`);
    }
    return res.json();
  }

  // ── State ─────────────────────────────────────────────────────────────────
  let posts: Post[] = [];
  let loading = false;
  let saving = false;
  let error = '';
  let toast = '';

  // Which post card is selected (edit mode)
  let selectedPost: Post | null = null;

  // Compose form
  let title = '';
  let bodyHtml = '';
  let sendAt = '';
  let targetDestinations: string[] = [];
  let targetOrigins:       string[] = [];
  let targetStages:        string[] = [];
  let destInput  = '';
  let originInput = '';

  // Audience count
  let audienceTotal   = 0;
  let audienceMatched = 0;
  let audienceLoading = false;
  let audienceDebounce: ReturnType<typeof setTimeout> | null = null;

  // Preview URL (iframe)
  let previewUrl = '';
  let showPreview = false;

  // ── Init ──────────────────────────────────────────────────────────────────
  onMount(async () => {
    await fetchPosts();
    newPost();
  });

  async function fetchPosts() {
    loading = true;
    error = '';
    try {
      const data = await apiFetch('/api/posts');
      posts = data.posts ?? [];
    } catch (e: any) {
      error = e.message;
    } finally {
      loading = false;
    }
  }

  // ── Composer helpers ──────────────────────────────────────────────────────
  function newPost() {
    selectedPost = null;
    title = '';
    bodyHtml = '';
    const now = new Date();
    // Default to next full hour
    now.setMinutes(0, 0, 0);
    now.setHours(now.getHours() + 1);
    sendAt = now.toISOString().slice(0, 16); // local datetime-local
    targetDestinations = [];
    targetOrigins = [];
    targetStages = [];
    destInput = '';
    originInput = '';
    showPreview = false;
    previewUrl = '';
    refreshAudience();
  }

  function selectPost(p: Post) {
    selectedPost = p;
    title = p.title ?? '';
    bodyHtml = p.bodyHtml ?? '';
    sendAt = p.sendAt ? p.sendAt.slice(0, 16) : '';
    targetDestinations = p.targeting?.destinationCountries ?? [];
    targetOrigins      = p.targeting?.originCountries ?? [];
    targetStages       = p.targeting?.pipelineStages ?? [];
    destInput = '';
    originInput = '';
    showPreview = false;
    previewUrl = '';
    refreshAudience();
  }

  // ── Targeting chips ───────────────────────────────────────────────────────
  function addDest() {
    const v = destInput.trim();
    if (v && !targetDestinations.includes(v)) {
      targetDestinations = [...targetDestinations, v];
    }
    destInput = '';
    refreshAudience();
  }

  function removeDest(v: string) {
    targetDestinations = targetDestinations.filter(x => x !== v);
    refreshAudience();
  }

  function addOrigin() {
    const v = originInput.trim();
    if (v && !targetOrigins.includes(v)) {
      targetOrigins = [...targetOrigins, v];
    }
    originInput = '';
    refreshAudience();
  }

  function removeOrigin(v: string) {
    targetOrigins = targetOrigins.filter(x => x !== v);
    refreshAudience();
  }

  function toggleStage(key: string) {
    if (targetStages.includes(key)) {
      targetStages = targetStages.filter(s => s !== key);
    } else {
      targetStages = [...targetStages, key];
    }
    refreshAudience();
  }

  // ── Audience preview ──────────────────────────────────────────────────────
  function refreshAudience() {
    if (audienceDebounce) clearTimeout(audienceDebounce);
    audienceDebounce = setTimeout(fetchAudience, 500);
  }

  async function fetchAudience() {
    audienceLoading = true;
    try {
      const targeting = buildTargeting();
      const data = await apiFetch('/api/posts/audience-preview', {
        method: 'POST',
        body: JSON.stringify({ targeting }),
      });
      audienceTotal   = data.total ?? 0;
      audienceMatched = data.matched ?? 0;
    } catch { /* silent */ }
    finally { audienceLoading = false; }
  }

  function buildTargeting(): Targeting {
    const t: Targeting = {};
    if (targetDestinations.length) t.destinationCountries = targetDestinations;
    if (targetOrigins.length)      t.originCountries = targetOrigins;
    if (targetStages.length)       t.pipelineStages = targetStages;
    return t;
  }

  // ── Save / Schedule ───────────────────────────────────────────────────────
  async function saveDraft() {
    if (!title.trim() || !bodyHtml.trim()) {
      error = 'Title and body are required.';
      return;
    }
    saving = true;
    error = '';
    try {
      const payload = {
        title: title.trim(),
        bodyHtml: bodyHtml.trim(),
        sendAt: sendAt ? new Date(sendAt).toISOString() : new Date().toISOString(),
        targeting: buildTargeting(),
        author: $authEmail ?? 'pablo@internationalrelocationpartner.com',
        status: 'draft',
      };
      if (selectedPost) {
        await apiFetch(`/api/posts/${selectedPost.id}`, { method: 'PATCH', body: JSON.stringify(payload) });
        showToast('Draft saved');
      } else {
        const data = await apiFetch('/api/posts', { method: 'POST', body: JSON.stringify(payload) });
        selectedPost = data.post;
        showToast('Draft created');
      }
      await fetchPosts();
      if (selectedPost) {
        const refreshed = posts.find(p => p.id === selectedPost?.id);
        if (refreshed) selectedPost = refreshed;
      }
    } catch (e: any) {
      error = e.message;
    } finally {
      saving = false;
    }
  }

  async function schedulePost() {
    if (!title.trim() || !bodyHtml.trim()) {
      error = 'Title and body are required before scheduling.';
      return;
    }
    if (!sendAt) {
      error = 'Please set a send date before scheduling.';
      return;
    }
    saving = true;
    error = '';
    try {
      const payload = {
        title: title.trim(),
        bodyHtml: bodyHtml.trim(),
        sendAt: new Date(sendAt).toISOString(),
        targeting: buildTargeting(),
        author: $authEmail ?? 'pablo@internationalrelocationpartner.com',
        status: 'scheduled',
      };
      if (selectedPost) {
        await apiFetch(`/api/posts/${selectedPost.id}`, { method: 'PATCH', body: JSON.stringify(payload) });
        showToast('✓ Post scheduled');
      } else {
        await apiFetch('/api/posts', { method: 'POST', body: JSON.stringify({ ...payload }) });
        showToast('✓ Post created and scheduled');
      }
      await fetchPosts();
      newPost();
    } catch (e: any) {
      error = e.message;
    } finally {
      saving = false;
    }
  }

  async function deletePost() {
    if (!selectedPost || selectedPost.status !== 'draft') return;
    if (!confirm(`Delete draft "${selectedPost.title}"? This cannot be undone.`)) return;
    try {
      await apiFetch(`/api/posts/${selectedPost.id}`, { method: 'DELETE' });
      posts = posts.filter(p => p.id !== selectedPost?.id);
      newPost();
      showToast('Draft deleted');
    } catch (e: any) {
      error = e.message;
    }
  }

  async function openPreview() {
    if (!selectedPost) {
      // Save first so preview has a real ID
      await saveDraft();
    }
    if (!selectedPost) return;
    previewUrl = `${getApiUrl()}/api/posts/${selectedPost.id}/preview?token=${encodeURIComponent($authToken ?? '')}`;
    showPreview = true;
  }

  // ── Toast ─────────────────────────────────────────────────────────────────
  function showToast(msg: string) {
    toast = msg;
    setTimeout(() => { if (toast === msg) toast = ''; }, 3000);
  }

  // ── Formatting ────────────────────────────────────────────────────────────
  function formatDate(iso: string): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  function statusLabel(s: string): string {
    return { draft: 'Draft', scheduled: 'Scheduled', dispatched: 'Sent' }[s] ?? s;
  }
</script>

<!-- ── Preview iframe modal ─────────────────────────────────────────────── -->
{#if showPreview}
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div
    class="posts-preview-overlay"
    on:click={() => (showPreview = false)}
    style="position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;"
  >
    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <!-- svelte-ignore a11y-no-static-element-interactions -->
    <div
      style="width:640px;max-width:95vw;height:85vh;background:#fff;border-radius:12px;overflow:hidden;display:flex;flex-direction:column;"
      on:click|stopPropagation
    >
      <div style="padding:12px 16px;background:#0f172a;color:#e2e8f0;font-size:13px;font-weight:600;display:flex;align-items:center;justify-content:space-between;">
        <span>📧 Email Preview — {title || 'Untitled'}</span>
        <button on:click={() => (showPreview = false)} style="background:none;border:none;color:#94a3b8;font-size:18px;cursor:pointer;line-height:1;">×</button>
      </div>
      <iframe
        src={previewUrl}
        title="Email preview"
        style="flex:1;border:none;width:100%;"
        sandbox="allow-same-origin"
      ></iframe>
    </div>
  </div>
{/if}

<!-- ── Main layout ────────────────────────────────────────────────────────── -->
<div class="posts-view">

  <!-- ── Left: post list ─────────────────────────────────────────────────── -->
  <div class="posts-view__list-pane">
    <div class="posts-view__list-header">
      <span class="posts-view__list-title">📢 Broadcasts</span>
      <button class="posts-view__new-btn" on:click={newPost}>+ New Post</button>
    </div>

    {#if loading}
      <div class="posts-view__empty">Loading…</div>
    {:else if posts.length === 0}
      <div class="posts-view__empty">No posts yet. Create your first broadcast.</div>
    {:else}
      {#each posts as p (p.id)}
        <!-- svelte-ignore a11y-click-events-have-key-events -->
        <!-- svelte-ignore a11y-no-static-element-interactions -->
        <div
          class="posts-view__card"
          class:posts-view__card--active={selectedPost?.id === p.id}
          class:posts-view__card--dispatched={p.status === 'dispatched'}
          on:click={() => selectPost(p)}
        >
          <div class="posts-view__card-header">
            <span class="posts-view__card-title">{p.title || 'Untitled'}</span>
            <span class="posts-view__status posts-view__status--{p.status}">
              {statusLabel(p.status)}
            </span>
          </div>
          <div class="posts-view__card-meta">
            <span class="posts-view__card-stat">🗓 {p.status === 'dispatched' ? formatDate(p.dispatchedAt ?? p.sendAt) : formatDate(p.sendAt)}</span>
            {#if p.status === 'dispatched'}
              <span class="posts-view__card-stat posts-view__card-stat--success">✓ {p.sentCount ?? 0} sent</span>
              {#if (p.failedCount ?? 0) > 0}
                <span class="posts-view__card-stat posts-view__card-stat--warn">⚠ {p.failedCount} failed</span>
              {/if}
            {/if}
            <span class="posts-view__card-stat">by {(p.author ?? '').split('@')[0]}</span>
          </div>
        </div>
      {/each}
    {/if}
  </div>

  <!-- ── Right: compose / detail ─────────────────────────────────────────── -->
  <div class="posts-view__compose-pane">

    <div class="posts-view__compose-title">
      {#if selectedPost?.status === 'dispatched'}
        📊 Post Stats
      {:else if selectedPost}
        ✏️ Edit Post
      {:else}
        ✍️ New Post
      {/if}
    </div>

    {#if error}
      <div style="background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);border-radius:6px;padding:8px 12px;font-size:12px;color:#ef4444;margin-bottom:16px;">
        {error}
      </div>
    {/if}

    <!-- Dispatched post — read-only stats ───────────────────────────────── -->
    {#if selectedPost?.status === 'dispatched'}
      <div class="posts-view__dispatch-info">
        <strong>✓ Dispatched on {formatDate(selectedPost.dispatchedAt ?? '')}</strong><br>
        Sent to <strong>{selectedPost.sentCount ?? 0}</strong> clients
        {#if (selectedPost.failedCount ?? 0) > 0}
          · <span style="color:var(--warning);">{selectedPost.failedCount} failed</span>
        {/if}<br><br>
        <strong>Subject / Title:</strong> {selectedPost.title}<br>
        <strong>Author:</strong> {selectedPost.author}
      </div>

    <!-- Active compose form ─────────────────────────────────────────────── -->
    {:else}
      <!-- Title -->
      <div class="posts-view__field">
        <div class="posts-view__section-label">📌 Subject / Title</div>
        <input
          class="posts-view__input"
          type="text"
          placeholder="e.g. Big news about importing cars to Costa Rica"
          bind:value={title}
        />
      </div>

      <!-- Body HTML -->
      <div class="posts-view__field">
        <div class="posts-view__section-label">📝 Body HTML</div>
        <textarea
          class="posts-view__textarea"
          placeholder="Write your email body here. Full HTML is accepted — paragraphs, headers, lists, links. The IRP branded wrapper (logo, signature) is added automatically."
          bind:value={bodyHtml}
          rows="10"
        ></textarea>
        <div style="font-size:10px;color:var(--text-dim);margin-top:4px;">
          Tip: Use &lt;p&gt; tags for paragraphs, &lt;strong&gt; for bold, &lt;ul&gt;/&lt;li&gt; for lists. The logo, header, and signature wrap your content automatically.
        </div>
      </div>

      <!-- Send date -->
      <div class="posts-view__field">
        <div class="posts-view__section-label">📅 Schedule Send</div>
        <input
          class="posts-view__input"
          type="datetime-local"
          bind:value={sendAt}
        />
        <div style="font-size:10px;color:var(--text-dim);margin-top:4px;">
          The dispatch job runs every 15 minutes. Posts with <em>sendAt ≤ now</em> and <em>status = scheduled</em> are picked up automatically.
        </div>
      </div>

      <!-- Targeting -->
      <div class="posts-view__field">
        <div class="posts-view__section-label">🎯 Audience Targeting <span style="font-weight:400;font-size:10px;">(leave empty to broadcast to all drip-enabled clients)</span></div>

        <!-- Destination countries -->
        <div style="margin-bottom:8px;">
          <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px;">Destination country (substring match)</div>
          <div style="display:flex;gap:6px;">
            <input
              class="posts-view__input"
              style="flex:1;height:32px;padding:4px 10px;"
              type="text"
              placeholder="e.g. Costa Rica, Panama…"
              bind:value={destInput}
              on:keydown={(e) => e.key === 'Enter' && (e.preventDefault(), addDest())}
            />
            <button
              class="posts-view__btn posts-view__btn--save"
              style="flex:0;height:32px;padding:0 12px;white-space:nowrap;"
              on:click={addDest}
            >Add</button>
          </div>
          {#if targetDestinations.length}
            <div class="posts-view__tag-row">
              {#each targetDestinations as c}
                <span class="posts-view__tag">{c}<button on:click={() => removeDest(c)}>×</button></span>
              {/each}
            </div>
          {/if}
        </div>

        <!-- Origin countries -->
        <div style="margin-bottom:8px;">
          <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px;">Origin country (substring match)</div>
          <div style="display:flex;gap:6px;">
            <input
              class="posts-view__input"
              style="flex:1;height:32px;padding:4px 10px;"
              type="text"
              placeholder="e.g. United States…"
              bind:value={originInput}
              on:keydown={(e) => e.key === 'Enter' && (e.preventDefault(), addOrigin())}
            />
            <button
              class="posts-view__btn posts-view__btn--save"
              style="flex:0;height:32px;padding:0 12px;white-space:nowrap;"
              on:click={addOrigin}
            >Add</button>
          </div>
          {#if targetOrigins.length}
            <div class="posts-view__tag-row">
              {#each targetOrigins as o}
                <span class="posts-view__tag">{o}<button on:click={() => removeOrigin(o)}>×</button></span>
              {/each}
            </div>
          {/if}
        </div>

        <!-- Pipeline stages -->
        <div>
          <div style="font-size:11px;color:var(--text-muted);margin-bottom:6px;">Pipeline stage filter</div>
          <div style="display:flex;flex-wrap:wrap;gap:4px;">
            {#each Object.entries(STAGE_LABELS) as [key, label]}
              <button
                class="posts-view__tag"
                style={targetStages.includes(key) ? 'background:rgba(99,102,241,0.18);border-color:rgba(99,102,241,0.5);' : 'background:transparent;color:var(--text-muted);border-color:var(--border);'}
                on:click={() => toggleStage(key)}
              >{label}</button>
            {/each}
          </div>
        </div>
      </div>

      <!-- Audience count ──────────────────────────────────────────────────── -->
      <div class="posts-view__audience">
        <span>👥 Audience</span>
        {#if audienceLoading}
          <span style="font-size:11px;color:var(--text-dim);margin-left:4px;">calculating…</span>
        {/if}
        <span class="posts-view__audience-count">
          {audienceMatched} / {audienceTotal}
        </span>
      </div>
      {#if audienceMatched === 0 && audienceTotal > 0}
        <div class="posts-view__audience-warn">⚠ No clients match the current filters — this post would not reach anyone.</div>
      {/if}

      <!-- Actions ─────────────────────────────────────────────────────────── -->
      <div class="posts-view__actions">
        <button
          class="posts-view__btn posts-view__btn--preview"
          on:click={openPreview}
          disabled={saving || !bodyHtml.trim()}
        >👁 Preview</button>

        <button
          class="posts-view__btn posts-view__btn--save"
          on:click={saveDraft}
          disabled={saving}
        >{saving ? 'Saving…' : '💾 Save Draft'}</button>

        <button
          class="posts-view__btn posts-view__btn--schedule"
          on:click={schedulePost}
          disabled={saving || !title.trim() || !bodyHtml.trim()}
        >{saving ? 'Scheduling…' : '📅 Schedule'}</button>

        {#if selectedPost?.status === 'draft'}
          <button
            class="posts-view__btn posts-view__btn--delete"
            on:click={deletePost}
            title="Delete this draft"
          >🗑</button>
        {/if}
      </div>
    {/if}
  </div>
</div>

<!-- ── Toast ────────────────────────────────────────────────────────────── -->
{#if toast}
  <div style="position:fixed;bottom:32px;right:32px;background:#0f172a;color:#e2e8f0;padding:10px 20px;border-radius:8px;font-size:13px;font-weight:600;z-index:10000;box-shadow:0 4px 24px rgba(0,0,0,0.4);">
    {toast}
  </div>
{/if}
