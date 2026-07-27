<script lang="ts">
  import { onMount } from 'svelte';
  import { get } from 'svelte/store';
  import {
    authToken, authEmail, STAGE_LABELS,
    mergeFieldOptions, fieldConfig, loadOverviewFields,
  } from '../store.ts';
  import LiveHtmlEditor from '$lib/LiveHtmlEditor.svelte';


  // ── Types ────────────────────────────────────────────────────────────────
  interface Post {
    id: string;
    title: string;
    bodyHtml: string;
    author: string;
    status: 'draft' | 'scheduled' | 'dispatched' | 'published';
    kind?: 'broadcast' | 'article' | 'country-guide';

    slug?: string;
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

  // Per-recipient send audit (dispatched posts).
  interface Recipient { clientId: string; email: string; name: string; }
  interface Failure extends Recipient { reason: string; }

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

  // List filter — segment the post list by kind. Seeded country guides can
  // number in the hundreds, so tabs keep the list usable.
  type ListFilter = 'all' | 'broadcast' | 'article' | 'country-guide';
  let listFilter: ListFilter = 'all';
  const FILTER_TABS: Array<{ key: ListFilter; label: string }> = [
    { key: 'all', label: 'All' },
    { key: 'broadcast', label: '📢 Broadcasts' },
    { key: 'article', label: '📄 Articles' },
    { key: 'country-guide', label: '🌍 Guides' },
  ];

  // Search + pagination for the list pane. Country guides alone number in the
  // hundreds, so the active tab is filtered by a free-text query and sliced
  // into pages (reusing the same helpers as the recipient audit below).
  let listSearch = '';
  let listPage = 1;
  const LIST_PAGE_SIZE = 12;

  $: kindCounts = {
    all: posts.length,
    broadcast: posts.filter((p) => (p.kind ?? 'broadcast') === 'broadcast').length,
    article: posts.filter((p) => p.kind === 'article').length,
    'country-guide': posts.filter((p) => p.kind === 'country-guide').length,
  } as Record<ListFilter, number>;

  // Kind tab → free-text search → page slice. Tab counts stay on the full set
  // (kindCounts above) so the badges show totals, not the filtered subset.
  $: kindFiltered = listFilter === 'all'
    ? posts
    : posts.filter((p) => (p.kind ?? 'broadcast') === listFilter);
  $: visiblePosts = matchPosts(kindFiltered, listSearch);
  $: listPages = pageCount(visiblePosts.length, LIST_PAGE_SIZE);
  // Reset to the first page whenever the tab or query changes…
  $: listFilter, listSearch, (listPage = 1);
  // …then clamp so a shrinking result set never strands us past the last page.
  $: if (listPage > listPages) listPage = listPages;
  $: pagedPosts = pageSlice(visiblePosts, listPage, LIST_PAGE_SIZE);


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

  // Web post (blog article + country guide) fields
  let kind: 'broadcast' | 'article' | 'country-guide' = 'broadcast';
  let slug = '';
  let slugTouched = false;
  // Web posts (articles + country guides) publish to a public page instead of
  // emailing an audience; grouping them keeps the compose-form logic in one flag.
  $: isWebPost = kind === 'article' || kind === 'country-guide';
  $: publicPathBase = kind === 'country-guide' ? '/guides' : '/blog';
  // Auto-derive slug from title until the operator edits it manually.
  $: if (isWebPost && !slugTouched) slug = slugify(title);


  // Audience count
  let audienceTotal   = 0;
  let audienceMatched = 0;
  let audienceLoading = false;
  let audienceDebounce: ReturnType<typeof setTimeout> | null = null;

  // Preview (iframe). previewSrcdoc is used for the article web preview.
  let previewUrl = '';
  let previewSrcdoc = '';
  let showPreview = false;

  // ── Recipient audit (who a dispatched post reached / failed) ──────────────
  // The per-recipient arrays load from a SEPARATE async endpoint than the post
  // doc (which carries sentCount/failedCount). `auditState` tracks that fetch
  // so the UI never shows a stale "0" while the real numbers are still loading,
  // and reconciles against the post-doc counts once it resolves.
  let recipients: Recipient[] = [];
  let failures: Failure[] = [];
  let auditState: 'idle' | 'loading' | 'ready' | 'error' = 'idle';
  let recipientSearch = '';
  let failureSearch = '';
  let recipientPage = 1;
  let failurePage = 1;
  const PAGE_SIZE = 8;

  // Collapsible panels — Delivered open by default, Failed is a dropdown.
  let deliveredOpen = true;
  let failedOpen = false;

  // ── Init ──────────────────────────────────────────────────────────────────
  onMount(async () => {
    await fetchPosts();
    newPost();
    // Hydrate the Overview Field Registry so the WYSIWYG merge-field picker
    // ($mergeFieldOptions) is populated. Idempotent + non-blocking — skipped
    // when the dashboard boot already loaded it.
    if (get(fieldConfig).length === 0) loadOverviewFields().catch(() => {});
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

  // Load the per-recipient audit for a dispatched post. Guards against a stale
  // response when the operator switches posts mid-flight (only the fetch that
  // still matches the selected post is allowed to commit its result).
  async function fetchRecipients(postId: string) {
    auditState = 'loading';
    recipients = [];
    failures = [];
    recipientSearch = '';
    failureSearch = '';
    recipientPage = 1;
    failurePage = 1;
    try {
      const data = await apiFetch(`/api/posts/${postId}/recipients`);
      if (selectedPost?.id !== postId) return; // superseded — ignore
      recipients = data.recipients ?? [];
      failures = data.failures ?? [];
      auditState = 'ready';
    } catch {
      if (selectedPost?.id === postId) auditState = 'error';
    }
  }

  function retryAudit() {
    if (selectedPost) fetchRecipients(selectedPost.id);
  }

  function clearAudit() {
    recipients = [];
    failures = [];
    auditState = 'idle';
    recipientSearch = '';
    failureSearch = '';
    recipientPage = 1;
    failurePage = 1;
    deliveredOpen = true;
    failedOpen = false;
  }

  // Case-insensitive match across name + email (+ reason, for failures).
  function filterRows<T extends Recipient>(rows: T[], q: string): T[] {
    const t = q.trim().toLowerCase();
    if (!t) return rows;
    return rows.filter((r) =>
      (r.name ?? '').toLowerCase().includes(t) ||
      (r.email ?? '').toLowerCase().includes(t) ||
      ((r as any).reason ?? '').toLowerCase().includes(t)
    );
  }

  function pageSlice<T>(rows: T[], page: number, size = PAGE_SIZE): T[] {
    const start = (page - 1) * size;
    return rows.slice(start, start + size);
  }

  const pageCount = (total: number, size = PAGE_SIZE): number => Math.max(1, Math.ceil(total / size));

  // Case-insensitive match across title, slug, and author for the list search.
  function matchPosts(rows: Post[], q: string): Post[] {
    const t = q.trim().toLowerCase();
    if (!t) return rows;
    return rows.filter((p) =>
      (p.title ?? '').toLowerCase().includes(t) ||
      (p.slug ?? '').toLowerCase().includes(t) ||
      (p.author ?? '').toLowerCase().includes(t)
    );
  }


  // Reactive filtered + paginated views. Page clamps down when a filter shrinks
  // the result set so we never strand the user on an empty page.
  $: filteredRecipients = filterRows(recipients, recipientSearch);
  $: filteredFailures   = filterRows(failures, failureSearch);
  $: recipientPages     = pageCount(filteredRecipients.length);
  $: failurePages       = pageCount(filteredFailures.length);
  $: if (recipientPage > recipientPages) recipientPage = recipientPages;
  $: if (failurePage > failurePages) failurePage = failurePages;
  $: pagedRecipients = pageSlice(filteredRecipients, recipientPage);
  $: pagedFailures   = pageSlice(filteredFailures, failurePage);

  // Reconciled counts — prefer the itemized array length, else fall back to the
  // authoritative post-doc counters so the badge always agrees with the banner.
  $: deliveredCount = recipients.length > 0 ? recipients.length : (selectedPost?.sentCount ?? 0);
  $: failedCount    = failures.length   > 0 ? failures.length   : (selectedPost?.failedCount ?? 0);
  // Count-only = the fetch is done, the itemized list is empty, but the post-doc
  // says people were reached/failed (a send that predates per-recipient tracking).
  $: deliveredCountOnly = auditState === 'ready' && recipients.length === 0 && (selectedPost?.sentCount ?? 0) > 0;
  $: failedCountOnly    = auditState === 'ready' && failures.length   === 0 && (selectedPost?.failedCount ?? 0) > 0;

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
    kind = 'broadcast';
    slug = '';
    slugTouched = false;
    showPreview = false;
    previewUrl = '';
    previewSrcdoc = '';
    clearAudit();
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
    kind = p.kind === 'article' ? 'article' : p.kind === 'country-guide' ? 'country-guide' : 'broadcast';

    slug = p.slug ?? '';
    slugTouched = true;
    showPreview = false;
    previewUrl = '';
    previewSrcdoc = '';
    // Load the send breakdown for dispatched posts; otherwise clear it.
    clearAudit();
    if (p.status === 'dispatched') fetchRecipients(p.id);
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
    // Web posts have no audience — they publish to a public web page.
    if (isWebPost) return;

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

  // ── Web article helpers ─────────────────────────────────────────────────
  function slugify(s: string): string {
    return (s || '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  function switchKind(k: 'broadcast' | 'article' | 'country-guide') {
    kind = k;
    if (k !== 'broadcast' && !slugTouched && title.trim()) {
      slug = slugify(title);
    }
    refreshAudience();
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
      const payload: Record<string, any> = {
        title: title.trim(),
        bodyHtml: bodyHtml.trim(),
        author: $authEmail ?? 'pablo@internationalrelocationpartner.com',
        kind,
      };
      // Preserve status when editing an already-scheduled/dispatched post — a
      // plain "Save" must never silently downgrade a live post back to draft.
      // Brand-new posts (and existing drafts) are saved as "draft".
      if (!selectedPost || selectedPost.status === 'draft') payload.status = 'draft';

      if (isWebPost) {
        payload.slug = slug.trim();
      } else {

        payload.sendAt = sendAt ? new Date(sendAt).toISOString() : new Date().toISOString();
        payload.targeting = buildTargeting();
      }
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

  // ── Send Now (immediate dispatch + resend) ────────────────────────────────
  // Persists the latest edits, then hits /send-now which enqueues to every
  // matching client and kicks the queue flush server-side. Doubles as "resend"
  // for an already-dispatched post.
  async function sendNow() {
    if (!title.trim() || !bodyHtml.trim()) {
      error = 'Title and body are required before sending.';
      return;
    }
    const n = audienceMatched;
    const verb = selectedPost?.status === 'dispatched' ? 'Resend' : 'Send';
    if (!confirm(`${verb} "${title.trim()}" to ${n} client${n === 1 ? '' : 's'} right now? This cannot be undone.`)) return;
    saving = true;
    error = '';
    try {
      // Persist current content first so the send uses exactly what's on screen.
      await saveDraft();
      if (!selectedPost) return;
      const data = await apiFetch(`/api/posts/${selectedPost.id}/send-now`, { method: 'POST' });
      showToast(`🚀 Queued ${data.sentCount ?? 0} email${(data.sentCount ?? 0) === 1 ? '' : 's'} — delivering now`);
      await fetchPosts();
      const refreshed = posts.find(p => p.id === selectedPost?.id);
      if (refreshed) selectPost(refreshed);
    } catch (e: any) {
      error = e.message;
    } finally {
      saving = false;
    }
  }

  // ── Publish web article ─────────────────────────────────────────────────
  async function publishArticle() {

    if (!title.trim() || !bodyHtml.trim()) {
      error = 'Title and body are required before publishing.';
      return;
    }
    if (!slug.trim()) {
      error = 'A URL slug is required before publishing.';
      return;
    }
    saving = true;
    error = '';
    try {
      const payload = {
        title: title.trim(),
        bodyHtml: bodyHtml.trim(),
        kind,
        slug: slug.trim(),
        author: $authEmail ?? 'pablo@internationalrelocationpartner.com',
        status: 'published',

      };
      if (selectedPost) {
        await apiFetch(`/api/posts/${selectedPost.id}`, { method: 'PATCH', body: JSON.stringify(payload) });
        showToast('✓ Article published');
      } else {
        await apiFetch('/api/posts', { method: 'POST', body: JSON.stringify(payload) });
        showToast('✓ Article published');
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
    previewSrcdoc = '';
    previewUrl = `${getApiUrl()}/api/posts/${selectedPost.id}/preview?token=${encodeURIComponent($authToken ?? '')}`;
    showPreview = true;
  }

  // Web article preview — renders the body in a styled iframe (no server round-trip).
  // NOTE: the <style> tags are concatenated from fragments so the literal tag
  // strings never appear in source — otherwise svelte-preprocess mistakes them
  // for a real component <style> block and tries to parse the CSS at build time.
  function openArticlePreview() {
    const safeTitle = title.trim() || 'Untitled article';
    const css =
      "body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;line-height:1.7;color:#1f2937;max-width:760px;margin:0 auto;padding:32px 20px;}"
      + 'h1{font-size:30px;line-height:1.2;margin:0 0 24px;}h2{font-size:22px;margin:32px 0 12px;}h3{font-size:18px;margin:24px 0 8px;}'
      + 'p{margin:0 0 16px;}ul,ol{margin:0 0 16px 22px;}li{margin:4px 0;}a{color:#02b5bb;}img{max-width:100%;height:auto;border-radius:8px;}'
      + 'blockquote{border-left:4px solid #02b5bb;margin:16px 0;padding:8px 16px;background:#f0fdfd;color:#334155;}';
    const styleOpen = '<' + 'style>';
    const styleClose = '</' + 'style>';
    previewUrl = '';
    previewSrcdoc =
      '<!doctype html><html><head><meta charset="utf-8">'
      + '<meta name="viewport" content="width=device-width, initial-scale=1">'
      + styleOpen + css + styleClose
      + '</head><body><h1>' + safeTitle + '</h1>' + bodyHtml + '</body></html>';
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
    return { draft: 'Draft', scheduled: 'Scheduled', dispatched: 'Sent', published: 'Published' }[s] ?? s;
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
        <span>{previewSrcdoc ? '📄 Article Preview' : '📧 Email Preview'} — {title || 'Untitled'}</span>
        <button on:click={() => (showPreview = false)} style="background:none;border:none;color:#94a3b8;font-size:18px;cursor:pointer;line-height:1;">×</button>
      </div>
      {#if previewSrcdoc}
        <iframe
          srcdoc={previewSrcdoc}
          title="Article preview"
          style="flex:1;border:none;width:100%;"
          sandbox=""
        ></iframe>
      {:else}
        <iframe
          src={previewUrl}
          title="Email preview"
          style="flex:1;border:none;width:100%;"
          sandbox="allow-same-origin"
        ></iframe>
      {/if}
    </div>
  </div>
{/if}

<!-- ── Main layout ────────────────────────────────────────────────────────── -->
<div class="posts-view">

  <!-- ── Left: post list ─────────────────────────────────────────────────── -->
  <div class="posts-view__list-pane">
    <div class="posts-view__list-header">
      <span class="posts-view__list-title">📢 Posts &amp; Blog</span>
      <button class="posts-view__new-btn" on:click={newPost}>+ New</button>
    </div>

    <!-- Kind filter tabs — segment broadcasts, blog articles, and country guides. -->
    <div style="display:flex;gap:4px;padding:8px 12px 4px;flex-wrap:wrap;">
      {#each FILTER_TABS as tab}
        <button
          type="button"
          style={listFilter === tab.key
            ? 'padding:4px 10px;border-radius:999px;border:1px solid rgba(2,181,187,0.55);background:rgba(2,181,187,0.12);color:#026a6e;font-size:11px;font-weight:700;cursor:pointer;'
            : 'padding:4px 10px;border-radius:999px;border:1px solid var(--irp-border);background:transparent;color:var(--irp-text-muted);font-size:11px;font-weight:600;cursor:pointer;'}
          on:click={() => (listFilter = tab.key)}
        >{tab.label} ({kindCounts[tab.key]})</button>
      {/each}
    </div>

    <!-- List search — filter the active tab by title, slug, or author. -->
    <div class="posts-view__list-search">
      <svg class="posts-view__list-search-icon" xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
      </svg>
      <input
        class="posts-view__list-search-input"
        type="search"
        placeholder="Search title, slug, or author…"
        bind:value={listSearch}
        aria-label="Search posts"
      />
      {#if listSearch}
        <button class="posts-view__list-search-clear" type="button" on:click={() => (listSearch = '')} aria-label="Clear search">×</button>
      {/if}
    </div>
    {#if listSearch.trim()}
      <div class="posts-view__list-count">{visiblePosts.length} result{visiblePosts.length === 1 ? '' : 's'} in {FILTER_TABS.find((t) => t.key === listFilter)?.label}</div>
    {/if}

    {#if loading}
      <div class="posts-view__empty">Loading…</div>

    {:else if visiblePosts.length === 0}
      <div class="posts-view__empty">
        {listSearch.trim() ? 'No posts match your search.' : 'No posts in this view.'}
      </div>
    {:else}
      {#each pagedPosts as p (p.id)}


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
            {#if p.kind === 'article'}
              <span class="posts-view__card-stat">📄 /blog/{p.slug}</span>
            {:else if p.kind === 'country-guide'}
              <span class="posts-view__card-stat">🌍 /guides/{p.slug}</span>
            {:else}

              <span class="posts-view__card-stat">🗓 {p.status === 'dispatched' ? formatDate(p.dispatchedAt ?? p.sendAt) : formatDate(p.sendAt)}</span>
              {#if p.status === 'dispatched'}
                <span class="posts-view__card-stat posts-view__card-stat--success">✓ {p.sentCount ?? 0} sent</span>
                {#if (p.failedCount ?? 0) > 0}
                  <span class="posts-view__card-stat posts-view__card-stat--warn">⚠ {p.failedCount} failed</span>
                {/if}
              {/if}
            {/if}
            <span class="posts-view__card-stat">by {(p.author ?? '').split('@')[0]}</span>
          </div>
        </div>
      {/each}
      {#if listPages > 1}
        <footer class="posts-audit__pager posts-view__list-pager">
          <button on:click={() => (listPage = Math.max(1, listPage - 1))} disabled={listPage <= 1} aria-label="Previous page">‹</button>
          <span>{listPage} / {listPages}</span>
          <button on:click={() => (listPage = Math.min(listPages, listPage + 1))} disabled={listPage >= listPages} aria-label="Next page">›</button>
        </footer>
      {/if}
    {/if}
  </div>

  <!-- ── Right: compose / detail ─────────────────────────────────────────── -->

  <div class="posts-view__compose-pane">

    <div class="posts-view__compose-title">
      {#if selectedPost?.status === 'dispatched'}
        ✏️ Edit Sent Post
      {:else if kind === 'country-guide'}
        {selectedPost ? '✏️ Edit Country Guide' : '🌍 New Country Guide'}
      {:else if kind === 'article'}
        {selectedPost ? '✏️ Edit Article' : '📄 New Article'}
      {:else if selectedPost}

        ✏️ Edit Post
      {:else}
        ✍️ New Post
      {/if}
    </div>

    {#if error}
      <div style="background:rgba(198,36,38,0.08);border:1px solid rgba(198,36,38,0.3);border-radius:6px;padding:8px 12px;font-size:12px;color:#c62426;margin-bottom:16px;">
        {error}
      </div>
    {/if}

    <!-- Dispatched post — compact "already sent" banner. The full form below
         stays editable so operators can revise + reschedule + resend. -->
    {#if selectedPost?.status === 'dispatched'}
      <div class="posts-view__dispatch-info">
        <strong>✓ Sent on {formatDate(selectedPost.dispatchedAt ?? '')}</strong> —
        delivered to <strong>{selectedPost.sentCount ?? 0}</strong> client{(selectedPost.sentCount ?? 0) === 1 ? '' : 's'}
        {#if (selectedPost.failedCount ?? 0) > 0}
          · <span style="color:var(--irp-warning);font-weight:600;">{selectedPost.failedCount} failed</span>
        {/if}
        <br><span style="font-size:11px;color:var(--irp-text-dim);">Edit the content below, then <strong>Reschedule</strong> or <strong>Resend Now</strong>.</span>
      </div>

      <!-- Per-recipient audit — who was reached and who failed (+ why). Two
           collapsible, searchable, paginated panels. Counts reconcile against
           the post-doc totals so the badges always match the banner above. -->
      <div class="posts-audit">
        <!-- Delivered -->
        <section class="posts-audit__panel" class:is-open={deliveredOpen}>
          <button class="posts-audit__head" on:click={() => (deliveredOpen = !deliveredOpen)} aria-expanded={deliveredOpen}>
            <span class="posts-audit__title">
              ✅ Delivered
              <span class="posts-audit__badge posts-audit__badge--ok">{deliveredCount}</span>
            </span>
            <span class="posts-audit__chevron" aria-hidden="true">▾</span>
          </button>
          {#if deliveredOpen}
            <div class="posts-audit__body">
              {#if auditState === 'loading'}
                <div class="posts-audit__empty">Loading recipients…</div>
              {:else if auditState === 'error'}
                <div class="posts-audit__error">
                  <span>Couldn’t load the recipient list.</span>
                  <button class="posts-audit__retry" on:click={retryAudit}>Retry</button>
                </div>
              {:else if recipients.length > 0}
                <input
                  class="posts-audit__search"
                  type="search"
                  placeholder="Search name or email…"
                  bind:value={recipientSearch}
                />
                {#if filteredRecipients.length === 0}
                  <div class="posts-audit__empty">No matches.</div>
                {:else}
                  <ul class="posts-audit__list">
                    {#each pagedRecipients as r (r.clientId + r.email)}
                      <li class="posts-audit__row">
                        <span class="posts-audit__name">{r.name || '—'}</span>
                        <span class="posts-audit__email">{r.email}</span>
                      </li>
                    {/each}
                  </ul>
                  {#if recipientPages > 1}
                    <footer class="posts-audit__pager">
                      <button on:click={() => (recipientPage = Math.max(1, recipientPage - 1))} disabled={recipientPage <= 1} aria-label="Previous page">‹</button>
                      <span>{recipientPage} / {recipientPages}</span>
                      <button on:click={() => (recipientPage = Math.min(recipientPages, recipientPage + 1))} disabled={recipientPage >= recipientPages} aria-label="Next page">›</button>
                    </footer>
                  {/if}
                {/if}
              {:else if deliveredCountOnly}
                <div class="posts-audit__summary">
                  <strong>{selectedPost.sentCount}</strong>
                  <span>delivered · itemized list not recorded for this send</span>
                </div>
              {:else}
                <div class="posts-audit__empty">No delivery records for this send.</div>
              {/if}
            </div>
          {/if}
        </section>

        <!-- Failed (dropdown) -->
        <section class="posts-audit__panel posts-audit__panel--fail" class:is-open={failedOpen}>
          <button class="posts-audit__head" on:click={() => (failedOpen = !failedOpen)} aria-expanded={failedOpen}>
            <span class="posts-audit__title">
              ⚠️ Failed
              <span class="posts-audit__badge posts-audit__badge--fail">{failedCount}</span>
            </span>
            <span class="posts-audit__chevron" aria-hidden="true">▾</span>
          </button>
          {#if failedOpen}
            <div class="posts-audit__body">
              {#if auditState === 'loading'}
                <div class="posts-audit__empty">Loading failures…</div>
              {:else if auditState === 'error'}
                <div class="posts-audit__error">
                  <span>Couldn’t load the failure list.</span>
                  <button class="posts-audit__retry" on:click={retryAudit}>Retry</button>
                </div>
              {:else if failures.length > 0}
                <input
                  class="posts-audit__search"
                  type="search"
                  placeholder="Search name, email or reason…"
                  bind:value={failureSearch}
                />
                {#if filteredFailures.length === 0}
                  <div class="posts-audit__empty">No matches.</div>
                {:else}
                  <ul class="posts-audit__list">
                    {#each pagedFailures as f (f.clientId + f.email)}
                      <li class="posts-audit__row posts-audit__row--fail">
                        <div class="posts-audit__row-main">
                          <span class="posts-audit__name">{f.name || '—'}</span>
                          <span class="posts-audit__email">{f.email || 'no email on file'}</span>
                        </div>
                        <span class="posts-audit__reason" title={f.reason}>{f.reason}</span>
                      </li>
                    {/each}
                  </ul>
                  {#if failurePages > 1}
                    <footer class="posts-audit__pager">
                      <button on:click={() => (failurePage = Math.max(1, failurePage - 1))} disabled={failurePage <= 1} aria-label="Previous page">‹</button>
                      <span>{failurePage} / {failurePages}</span>
                      <button on:click={() => (failurePage = Math.min(failurePages, failurePage + 1))} disabled={failurePage >= failurePages} aria-label="Next page">›</button>
                    </footer>
                  {/if}
                {/if}
              {:else if failedCountOnly}
                <div class="posts-audit__summary">
                  <strong>{selectedPost.failedCount}</strong>
                  <span>failed · itemized list not recorded for this send</span>
                </div>
              {:else}
                <div class="posts-audit__empty">No failures — everyone was reached 🎉</div>
              {/if}
            </div>
          {/if}
        </section>
      </div>
    {/if}

    <!-- Compose / edit form — drafts, scheduled AND dispatched posts are all
         fully editable (operators can revise + reschedule + resend). -->
      <!-- Kind toggle (broadcast vs web article) -->

      <div class="posts-view__field">
        <div style="display:flex;gap:6px;">
          <button
            type="button"
            style={kind === 'broadcast'
              ? 'flex:1;padding:8px;border-radius:6px;border:1px solid rgba(2,181,187,0.55);background:rgba(2,181,187,0.12);color:#026a6e;font-size:12px;font-weight:700;cursor:pointer;'
              : 'flex:1;padding:8px;border-radius:6px;border:1px solid var(--irp-border);background:transparent;color:var(--irp-text-muted);font-size:12px;font-weight:600;cursor:pointer;'}
            on:click={() => switchKind('broadcast')}
          >📢 Email Broadcast</button>
          <button
            type="button"
            style={kind === 'article'
              ? 'flex:1;padding:8px;border-radius:6px;border:1px solid rgba(2,181,187,0.55);background:rgba(2,181,187,0.12);color:#026a6e;font-size:12px;font-weight:700;cursor:pointer;'
              : 'flex:1;padding:8px;border-radius:6px;border:1px solid var(--irp-border);background:transparent;color:var(--irp-text-muted);font-size:12px;font-weight:600;cursor:pointer;'}
            on:click={() => switchKind('article')}
          >📄 Web Article (Blog)</button>
          <button
            type="button"
            style={kind === 'country-guide'
              ? 'flex:1;padding:8px;border-radius:6px;border:1px solid rgba(2,181,187,0.55);background:rgba(2,181,187,0.12);color:#026a6e;font-size:12px;font-weight:700;cursor:pointer;'
              : 'flex:1;padding:8px;border-radius:6px;border:1px solid var(--irp-border);background:transparent;color:var(--irp-text-muted);font-size:12px;font-weight:600;cursor:pointer;'}
            on:click={() => switchKind('country-guide')}
          >🌍 Country Guide</button>
        </div>
        <div style="font-size:10px;color:var(--irp-text-dim);margin-top:4px;">
          {#if kind === 'country-guide'}
            Publishes to a public page at <strong>/guides/&lt;slug&gt;</strong>. Not emailed to anyone.
          {:else if kind === 'article'}
            Publishes to a public page at <strong>/blog/&lt;slug&gt;</strong>. Not emailed to anyone.
          {:else}
            Emailed to all matching drip-enabled clients at the scheduled time.
          {/if}
        </div>

      </div>

      <!-- Title -->
      <div class="posts-view__field">
        <div class="posts-view__section-label">📌 {kind === 'broadcast' ? 'Subject / Title' : kind === 'country-guide' ? 'Guide Title' : 'Article Title'}</div>

        <input
          class="posts-view__input"
          type="text"
          placeholder="e.g. Big news about importing cars to Costa Rica"
          bind:value={title}
        />
      </div>

      {#if isWebPost}
        <!-- Slug -->

        <div class="posts-view__field">
          <div class="posts-view__section-label">🔗 URL Slug</div>
          <input
            class="posts-view__input"
            type="text"
            placeholder="e.g. customs-import-duties"
            bind:value={slug}
            on:input={() => (slugTouched = true)}
          />
          <div style="font-size:10px;color:var(--irp-text-dim);margin-top:4px;">
            Public URL: <strong>{publicPathBase}/{slug || 'your-slug'}</strong>

          </div>
        </div>
      {/if}

      <!-- Body — centralized WYSIWYG editor (same engine as email templates &
           the client-offer editor). Formatting toolbar + merge-field picker +
           HTML-source toggle. Merge fields are offered for broadcasts only —
           web articles are public pages with no client context. -->
      <div class="posts-view__field">
        <div class="posts-view__section-label">📝 {isWebPost ? 'Body' : 'Email Body'}</div>
        <LiveHtmlEditor
          bind:value={bodyHtml}
          fields={kind === 'broadcast' ? $mergeFieldOptions : []}
          minHeight="280px"
          placeholder={isWebPost
            ? 'Write your content — format visually, or switch to HTML…'
            : 'Write your email — format visually, insert client fields, or switch to HTML…'}
        />
        <div style="font-size:10px;color:var(--irp-text-dim);margin-top:4px;">
          {#if isWebPost}
            Format visually with the toolbar, or click <strong>&lt;/&gt; HTML</strong> to edit raw HTML. The page header and styling are added automatically.
          {:else}

            Format visually, insert client fields with <strong>{'{{ }}'} Field</strong>, or click <strong>&lt;/&gt; HTML</strong> for raw HTML. The logo, header, and signature wrap your content automatically.
          {/if}
        </div>
      </div>


      {#if kind === 'broadcast'}
      <!-- Send date -->
      <div class="posts-view__field">
        <div class="posts-view__section-label">📅 Schedule Send</div>
        <input
          class="posts-view__input"
          type="datetime-local"
          bind:value={sendAt}
        />
        <div style="font-size:10px;color:var(--irp-text-dim);margin-top:4px;">
          The dispatch job runs every 15 minutes. Posts with <em>sendAt ≤ now</em> and <em>status = scheduled</em> are picked up automatically.
        </div>
      </div>

      <!-- Targeting -->
      <div class="posts-view__field">
        <div class="posts-view__section-label">🎯 Audience Targeting <span style="font-weight:400;font-size:10px;">(leave empty to broadcast to all drip-enabled clients)</span></div>

        <!-- Destination countries -->
        <div style="margin-bottom:8px;">
          <div style="font-size:11px;color:var(--irp-text-muted);margin-bottom:4px;">Destination country (substring match)</div>
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
          <div style="font-size:11px;color:var(--irp-text-muted);margin-bottom:4px;">Origin country (substring match)</div>
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
          <div style="font-size:11px;color:var(--irp-text-muted);margin-bottom:6px;">Pipeline stage filter</div>
          <div style="display:flex;flex-wrap:wrap;gap:4px;">
            {#each Object.entries(STAGE_LABELS) as [key, label]}
              <button
                class="posts-view__tag"
                style={targetStages.includes(key) ? 'background:rgba(2,181,187,0.12);border-color:rgba(2,181,187,0.55);color:#026a6e;' : 'background:transparent;color:var(--irp-text-muted);border-color:var(--irp-border);'}
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
          <span style="font-size:11px;color:var(--irp-text-dim);margin-left:4px;">calculating…</span>
        {/if}
        <span class="posts-view__audience-count">
          {audienceMatched} / {audienceTotal}
        </span>
      </div>
      {#if audienceMatched === 0 && audienceTotal > 0}
        <div class="posts-view__audience-warn">⚠ No clients match the current filters — this post would not reach anyone.</div>
      {/if}
      {/if}

      <!-- Actions ─────────────────────────────────────────────────────────── -->
      <div class="posts-view__actions">
        <button
          class="posts-view__btn posts-view__btn--preview"
          on:click={isWebPost ? openArticlePreview : openPreview}

          disabled={saving || !bodyHtml.trim()}
        >👁 Preview</button>

        <button
          class="posts-view__btn posts-view__btn--save"
          on:click={saveDraft}
          disabled={saving}
        >{saving ? 'Saving…' : (selectedPost && selectedPost.status !== 'draft' ? '💾 Save' : '💾 Save Draft')}</button>

        {#if isWebPost}
          <button
            class="posts-view__btn posts-view__btn--schedule"
            on:click={publishArticle}

            disabled={saving || !title.trim() || !bodyHtml.trim() || !slug.trim()}
          >{saving ? 'Publishing…' : '🌐 Publish'}</button>
        {:else}
          <button
            class="posts-view__btn posts-view__btn--schedule"
            on:click={schedulePost}
            disabled={saving || !title.trim() || !bodyHtml.trim()}
          >{saving ? 'Scheduling…' : (selectedPost?.status === 'dispatched' ? '📅 Reschedule' : '📅 Schedule')}</button>
          <button
            class="posts-view__btn posts-view__btn--sendnow"
            on:click={sendNow}
            disabled={saving || !title.trim() || !bodyHtml.trim() || audienceMatched === 0}
            title="Dispatch immediately to all matching drip-enabled clients"
          >{saving ? 'Sending…' : (selectedPost?.status === 'dispatched' ? '🚀 Resend Now' : '🚀 Send Now')}</button>
        {/if}

        {#if selectedPost?.status === 'draft'}
          <button
            class="posts-view__btn posts-view__btn--delete"
            on:click={deletePost}
            title="Delete this draft"
          >🗑</button>
        {/if}
      </div>
  </div>
</div>


<!-- ── Toast ────────────────────────────────────────────────────────────── -->
{#if toast}
  <div style="position:fixed;bottom:32px;right:32px;background:#0f172a;color:#e2e8f0;padding:10px 20px;border-radius:8px;font-size:13px;font-weight:600;z-index:10000;box-shadow:0 4px 24px rgba(0,0,0,0.4);">
    {toast}
  </div>
{/if}
