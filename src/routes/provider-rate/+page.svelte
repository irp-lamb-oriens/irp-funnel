<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';

  $: ratingId = $page.url.searchParams.get('ratingId') ?? '';
  $: token    = $page.url.searchParams.get('token')    ?? '';

  type State = 'loading' | 'invalid' | 'not_found' | 'error' | 'ready' | 'submitting' | 'success' | 'already_rated';
  let state: State = 'loading';
  let errorMessage = '';

  interface RatingData {
    ratingId: string;
    status: string;
    providerName: string;
    moveDetails: { originCountry?: string; destinationCountry?: string; containerSize?: string; moveDate?: string; };
    quotedPrice: number | null;
    quotedCurrency: string | null;
    rating: number | null;
    ratingNotes: string;
    ratedAt: string | null;
  }

  let ratingData: RatingData | null = null;

  // Form
  let selectedRating = 0;
  let hoveredRating  = 0;
  let notes = '';
  let formError = '';

  onMount(async () => {
    if (!ratingId || !token) { state = 'invalid'; return; }
    await loadData();
  });

  async function loadData() {
    state = 'loading';
    try {
      const res = await fetch(`/api/provider/rating-request?ratingId=${ratingId}&token=${token}`);
      const data = await res.json();
      if (res.status === 404 || res.status === 403) { state = 'not_found'; return; }
      if (!res.ok) { errorMessage = data.error ?? 'Unknown error'; state = 'error'; return; }
      ratingData = data as RatingData;
      state = data.status === 'completed' ? 'already_rated' : 'ready';
    } catch {
      errorMessage = 'Could not connect. Please try again.';
      state = 'error';
    }
  }

  async function handleSubmit() {
    formError = '';
    if (!selectedRating) { formError = 'Please select a star rating.'; return; }
    state = 'submitting';
    try {
      const res = await fetch('/api/provider/rating-request/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ratingId, token, rating: selectedRating, notes }),
      });
      const data = await res.json();
      if (res.status === 409 && data.alreadyRated) { await loadData(); return; }
      if (!res.ok) { formError = data.error ?? 'Submission failed.'; state = 'ready'; return; }
      state = 'success';
    } catch {
      formError = 'Could not connect. Please try again.';
      state = 'ready';
    }
  }

  function formatDate(iso: string | undefined | null): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  }
  function formatCurrency(amount: number | null, cur: string | null): string {
    if (!amount) return '—';
    try { return new Intl.NumberFormat('en-US', { style: 'currency', currency: cur ?? 'USD' }).format(amount); }
    catch { return `${cur} ${amount}`; }
  }

  const STAR_LABELS = ['', 'Poor', 'Below average', 'Average', 'Good', 'Excellent'];
</script>

<svelte:head>
  <title>IRP — Rate Provider</title>
  <meta name="robots" content="noindex, nofollow" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
</svelte:head>

<div class="pr-root">
  <header class="pr-header">
    <img src="/IRP-LOGO.jpg" alt="IRP" class="pr-logo" on:error={(e) => ((e.currentTarget as HTMLImageElement).style.display = 'none')} />

    <span class="pr-brand">International Relocation Partner</span>
  </header>

  <main class="pr-main">

    {#if state === 'loading' || state === 'submitting'}
      <div class="pr-card pr-card--center">
        <div class="pr-spinner"></div>
        <p class="pr-muted">{state === 'submitting' ? 'Submitting your rating…' : 'Loading…'}</p>
      </div>

    {:else if state === 'invalid'}
      <div class="pr-card pr-card--center">
        <div class="pr-icon pr-icon--warn">⚠</div>
        <h2 class="pr-title">Invalid link</h2>
        <p class="pr-muted">This link is missing required parameters. Use the original link from your email.</p>
      </div>

    {:else if state === 'not_found' || state === 'error'}
      <div class="pr-card pr-card--center">
        <div class="pr-icon pr-icon--warn">{state === 'not_found' ? '🔍' : '✕'}</div>
        <h2 class="pr-title">{state === 'not_found' ? 'Not found' : 'Something went wrong'}</h2>
        <p class="pr-muted">{state === 'not_found' ? 'This rating request could not be found.' : errorMessage}</p>
        {#if state === 'error'}
          <button class="pr-btn pr-btn--ghost" style="margin-top:1rem;" on:click={loadData}>Try again</button>
        {/if}
      </div>

    {:else if state === 'already_rated' && ratingData}
      <div class="pr-card pr-card--center">
        <div class="pr-icon pr-icon--success" style="font-size:1.5rem;">★</div>
        <h2 class="pr-title">Already rated</h2>
        <p class="pr-muted">You've already submitted a rating for <strong>{ratingData.providerName}</strong>.</p>
        <div class="pr-stars-display">
          {#each [1,2,3,4,5] as s}
            <span class="pr-star-display" class:pr-star-display--lit={s <= (ratingData.rating ?? 0)}>★</span>
          {/each}
        </div>
        {#if ratingData.ratingNotes}
          <p class="pr-muted" style="margin-top:0.75rem; font-style:italic;">"{ratingData.ratingNotes}"</p>
        {/if}
        <p class="pr-muted" style="font-size:0.75rem; margin-top:0.5rem;">Submitted {formatDate(ratingData.ratedAt)}</p>
      </div>

    {:else if state === 'success'}
      <div class="pr-card pr-card--center">
        <div class="pr-confetti-ring">
          <div class="pr-icon pr-icon--success" style="font-size:1.5rem; margin-bottom:0;">★</div>
        </div>
        <h2 class="pr-title">Rating submitted!</h2>
        <p class="pr-muted">
          You rated <strong>{ratingData?.providerName}</strong>
          <strong class="pr-highlight"> {selectedRating} / 5 stars</strong>.
          This score has been recorded and will influence future selections.
        </p>
        <div class="pr-stars-display" style="margin-top:0.75rem;">
          {#each [1,2,3,4,5] as s}
            <span class="pr-star-display" class:pr-star-display--lit={s <= selectedRating}>★</span>
          {/each}
        </div>
      </div>

    {:else if state === 'ready' && ratingData}
      {@const md = ratingData.moveDetails}
      <!-- Route banner -->
      <div class="pr-route-banner">
        <span>{md.originCountry || 'Origin'}</span>
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="pr-arrow" aria-hidden="true"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
        <span>{md.destinationCountry || 'Destination'}</span>
      </div>

      <div class="pr-card">
        <span class="pr-eyebrow">
          <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
          Provider Rating · IRP Internal
        </span>

        <h1 class="pr-title">How did <span class="pr-highlight">{ratingData.providerName}</span> perform?</h1>
        <p class="pr-subtitle">Rate the quality of service for this completed relocation. Your score directly influences future provider selection rankings.</p>

        <!-- Move summary -->
        <div class="pr-summary">
          {#if md.containerSize}
            <div class="pr-summary__item">
              <span class="pr-summary__label">Container</span>
              <span class="pr-summary__value">{md.containerSize}</span>
            </div>
          {/if}
          {#if md.moveDate}
            <div class="pr-summary__item">
              <span class="pr-summary__label">Move date</span>
              <span class="pr-summary__value">{formatDate(md.moveDate)}</span>
            </div>
          {/if}
          {#if ratingData.quotedPrice}
            <div class="pr-summary__item">
              <span class="pr-summary__label">Quoted price</span>
              <span class="pr-summary__value" style="color:#02b5bb;">{formatCurrency(ratingData.quotedPrice, ratingData.quotedCurrency)}</span>
            </div>
          {/if}
        </div>

        <hr class="pr-divider" />

        <!-- Star selector -->
        <div class="pr-stars-section">
          <div class="pr-stars"
            role="group"
            aria-label="Star rating"
            on:mouseleave={() => hoveredRating = 0}
          >
            {#each [1,2,3,4,5] as s}
              <button
                type="button"
                class="pr-star"
                class:pr-star--active={s <= (hoveredRating || selectedRating)}
                on:mouseenter={() => hoveredRating = s}
                on:click={() => { selectedRating = s; formError = ''; }}
                aria-label="{s} star{s > 1 ? 's' : ''}"
              >★</button>
            {/each}
          </div>
          {#if hoveredRating || selectedRating}
            <p class="pr-star-label">{STAR_LABELS[hoveredRating || selectedRating]}</p>
          {:else}
            <p class="pr-star-label pr-star-label--placeholder">Tap a star to rate</p>
          {/if}
        </div>

        <!-- Notes -->
        <div class="pr-field">
          <label class="pr-label" for="pr-notes">
            Notes <span class="pr-optional">(optional)</span>
          </label>
          <textarea
            id="pr-notes"
            bind:value={notes}
            rows="3"
            placeholder="Communication, timeliness, handling quality, professionalism…"
            class="pr-textarea"
          ></textarea>
        </div>

        {#if formError}
          <div class="pr-form-error">{formError}</div>
        {/if}

        <button
          class="pr-btn pr-btn--primary"
          on:click={handleSubmit}
          type="button"
          disabled={!selectedRating}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
          Submit Rating
        </button>

        <p class="pr-privacy-note">This rating is internal to IRP and is not shared with the client or provider.</p>
      </div>
    {/if}

  </main>

  <footer class="pr-footer">
    <span>Powered by</span><strong>International Relocation Partner</strong>
  </footer>
</div>

<style>
  :global(body) {
    margin: 0; padding: 0;
    background: #020d10;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    -webkit-font-smoothing: antialiased;
    color: #f1f5f9;
    min-height: 100vh;
  }
  .pr-root {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    background:
      radial-gradient(ellipse 80% 60% at 50% -10%, rgba(2,181,187,0.09) 0%, transparent 60%),
      linear-gradient(180deg, #020d10 0%, #031319 100%);
    padding: 0 1rem 3rem;
  }
  .pr-header {
    width: 100%; max-width: 520px;
    display: flex; align-items: center; gap: 0.65rem;
    padding: 1.5rem 0 0; margin-bottom: 2rem;
  }
  .pr-logo { height: 30px; width: auto; border-radius: 6px; opacity: 0.95; }

  .pr-brand { font-size: 0.75rem; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: rgba(241,245,249,0.45); }
  .pr-main { width: 100%; max-width: 520px; display: flex; flex-direction: column; gap: 0.85rem; }
  .pr-route-banner {
    display: flex; align-items: center; justify-content: center; gap: 0.75rem;
    padding: 0.65rem 1.25rem;
    background: rgba(2,181,187,0.07); border: 1px solid rgba(2,181,187,0.18); border-radius: 12px;
    font-size: 0.95rem; font-weight: 700; color: #e2f8f9;
  }
  .pr-arrow { color: #02b5bb; flex-shrink: 0; }
  .pr-card {
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(2,181,187,0.15);
    border-radius: 20px; padding: 2rem 1.75rem;
    box-shadow: 0 8px 48px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05);
    backdrop-filter: blur(24px);
  }
  .pr-card--center { display: flex; flex-direction: column; align-items: center; text-align: center; padding: 3rem 1.75rem; }
  .pr-eyebrow {
    display: inline-flex; align-items: center; gap: 0.35rem;
    font-size: 0.67rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase;
    color: #02b5bb; margin-bottom: 0.75rem;
  }
  .pr-title { font-size: 1.3rem; font-weight: 800; color: #f8fafc; margin: 0 0 0.5rem; line-height: 1.25; }
  .pr-subtitle { font-size: 0.85rem; color: rgba(241,245,249,0.5); line-height: 1.6; margin: 0 0 1.25rem; }
  .pr-muted { font-size: 0.875rem; color: rgba(241,245,249,0.5); line-height: 1.6; margin: 0.2rem 0; }
  .pr-highlight { color: #02b5bb; font-weight: 700; }
  .pr-summary {
    display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 0.25rem;
  }
  .pr-summary__item {
    display: flex; flex-direction: column; gap: 2px;
    background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06);
    border-radius: 9px; padding: 0.55rem 0.85rem; flex: 1; min-width: 100px;
  }
  .pr-summary__label { font-size: 0.63rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: rgba(241,245,249,0.38); }
  .pr-summary__value { font-size: 0.85rem; font-weight: 600; color: #f1f5f9; }
  .pr-divider { border: none; border-top: 1px solid rgba(255,255,255,0.07); margin: 1.35rem 0 1.25rem; }
  /* ── Stars ── */
  .pr-stars-section { display: flex; flex-direction: column; align-items: center; gap: 0.4rem; margin-bottom: 1.25rem; }
  .pr-stars { display: flex; gap: 0.25rem; }
  .pr-star {
    font-size: 2.4rem; line-height: 1;
    background: none; border: none; padding: 0.1rem;
    color: rgba(241,245,249,0.15); cursor: pointer;
    transition: color 0.12s ease, transform 0.1s ease;
  }
  .pr-star:hover { transform: scale(1.1); }
  .pr-star--active { color: #f59e0b; }
  .pr-star-label { font-size: 0.8rem; font-weight: 700; color: #f59e0b; margin: 0; min-height: 1.1em; }
  .pr-star-label--placeholder { color: rgba(241,245,249,0.3); font-weight: 400; }
  /* Stars display (read-only) */
  .pr-stars-display { display: flex; gap: 0.15rem; margin-top: 0.5rem; }
  .pr-star-display { font-size: 1.75rem; color: rgba(241,245,249,0.15); }
  .pr-star-display--lit { color: #f59e0b; }
  /* ── Form ── */
  .pr-field { display: flex; flex-direction: column; gap: 0.35rem; margin-bottom: 1.1rem; }
  .pr-label { font-size: 0.78rem; font-weight: 700; color: rgba(241,245,249,0.65); }
  .pr-optional { font-weight: 400; color: rgba(241,245,249,0.32); }
  .pr-textarea {
    padding: 0.65rem 0.9rem; background: rgba(15,23,42,0.7);
    border: 1.5px solid rgba(2,181,187,0.2); border-radius: 9px;
    color: #f1f5f9; font-size: 0.875rem; font-family: inherit; line-height: 1.55;
    outline: none; resize: vertical; min-height: 72px;
    transition: border-color 0.15s;
  }
  .pr-textarea:focus { border-color: #02b5bb; box-shadow: 0 0 0 3px rgba(2,181,187,0.12); }
  .pr-textarea::placeholder { color: rgba(241,245,249,0.2); }
  .pr-form-error {
    padding: 0.6rem 0.85rem;
    background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.3);
    border-radius: 9px; color: #fca5a5; font-size: 0.8rem; font-weight: 600;
    margin-bottom: 0.5rem;
  }
  /* ── Buttons ── */
  .pr-btn {
    display: inline-flex; align-items: center; justify-content: center; gap: 0.45rem;
    width: 100%; padding: 0.85rem 1.5rem; border: none; border-radius: 11px;
    font-size: 0.88rem; font-weight: 800; font-family: inherit; cursor: pointer;
    transition: background 0.17s, transform 0.13s, box-shadow 0.17s, opacity 0.14s;
  }
  .pr-btn:disabled { opacity: 0.4; cursor: not-allowed; }
  .pr-btn--primary {
    background: linear-gradient(135deg, #02b5bb 0%, #03cdd4 100%);
    color: #020d10; box-shadow: 0 3px 18px rgba(2,181,187,0.3);
  }
  .pr-btn--primary:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 5px 26px rgba(2,181,187,0.46); }
  .pr-btn--ghost {
    background: rgba(255,255,255,0.06); border: 1.5px solid rgba(255,255,255,0.12);
    color: rgba(241,245,249,0.7); width: auto; padding: 0.6rem 1.25rem;
  }
  .pr-btn--ghost:hover { background: rgba(255,255,255,0.09); color: #f1f5f9; }
  /* ── Privacy note ── */
  .pr-privacy-note {
    text-align: center; font-size: 0.7rem; color: rgba(241,245,249,0.28);
    margin: 0.85rem 0 0; font-style: italic;
  }
  /* ── State icons ── */
  .pr-icon {
    width: 54px; height: 54px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: 1.4rem; font-weight: 700; margin-bottom: 1.1rem;
  }
  .pr-icon--success { background: rgba(2,181,187,0.12); border: 2px solid rgba(2,181,187,0.4); color: #02b5bb; }
  .pr-icon--warn { background: rgba(251,191,36,0.1); border: 2px solid rgba(251,191,36,0.3); color: #fbbf24; }
  /* ── Confetti ring ── */
  .pr-confetti-ring {
    position: relative; width: 76px; height: 76px;
    display: flex; align-items: center; justify-content: center;
    margin: 0 auto 1.25rem;
  }
  .pr-confetti-ring::before {
    content: ''; position: absolute; inset: -5px; border-radius: 50%;
    border: 2px solid transparent;
    background: linear-gradient(#020d10,#020d10) padding-box,
      conic-gradient(#f59e0b,#fcd34d,#fef08a,#f59e0b) border-box;
    animation: spin 3s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
  .pr-spinner {
    width: 34px; height: 34px; border: 3px solid rgba(2,181,187,0.15);
    border-left-color: #02b5bb; border-radius: 50%;
    animation: spin 0.85s linear infinite; margin-bottom: 1rem;
  }
  .pr-footer {
    margin-top: auto; padding-top: 2.5rem;
    font-size: 0.7rem; color: rgba(241,245,249,0.2);
    display: flex; align-items: center; gap: 0.3rem;
  }
  .pr-footer strong { color: rgba(241,245,249,0.32); }
  @media (max-width: 480px) {
    .pr-card { padding: 1.5rem 1.15rem; }
    .pr-star { font-size: 2rem; }
    .pr-title { font-size: 1.1rem; }
  }
</style>
