<script lang="ts">
  import { authToken, authEmail } from '../store.ts';
  import { get } from 'svelte/store';
  import { toasts } from '../toastStore.ts';

  export let open = false;

  const AREAS = [
    { value: 'Lili chatbot',               icon: '🤖' },
    { value: 'Dashboard — client cards',   icon: '🃏' },
    { value: 'Dashboard — detail panel',   icon: '🗂️' },
    { value: 'Emails',                     icon: '📧' },
    { value: 'Scheduling / calendar',      icon: '📅' },
    { value: 'Client data / fields',       icon: '🗄️' },
    { value: 'Vendors',                    icon: '🏭' },
    { value: 'Login / auth',              icon: '🔐' },
    { value: 'Other',                      icon: '✨' },
  ];

  const SEVERITIES = [
    { value: 'critical', label: 'Critical', emoji: '🔴', hint: 'Blocks work entirely',  color: '#ef4444', glow: 'rgba(239,68,68,0.35)' },
    { value: 'high',     label: 'High',     emoji: '🟠', hint: 'Major issue',            color: '#f97316', glow: 'rgba(249,115,22,0.35)' },
    { value: 'medium',   label: 'Medium',   emoji: '🟡', hint: 'Notable but workable',   color: '#eab308', glow: 'rgba(234,179,8,0.35)'  },
    { value: 'low',      label: 'Low',      emoji: '🟢', hint: 'Cosmetic / minor',       color: '#22c55e', glow: 'rgba(34,197,94,0.35)'  },
  ];

  let area = '';
  let severity = '';
  let pageUrl = typeof window !== 'undefined' ? window.location.href : '';
  let description = '';
  let steps = '';
  let submitting = false;
  let submitted = false;

  function close() {
    if (submitting) return;
    open = false;
    setTimeout(reset, 300);
  }

  function reset() {
    area = '';
    severity = '';
    description = '';
    steps = '';
    submitted = false;
    pageUrl = typeof window !== 'undefined' ? window.location.href : '';
  }

  function getApiUrl() {
    if (typeof window !== 'undefined' && window.location.origin.startsWith('http://localhost'))
      return 'http://localhost:8000';
    return 'https://irp-funnel-server.onrender.com';
  }

  async function submit() {
    if (!area || !severity || !description.trim()) return;
    submitting = true;
    try {
      const token = get(authToken);
      const reporter = get(authEmail);
      const res = await fetch(`${getApiUrl()}/api/dashboard/bug-report`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'x-dashboard-token': token } : {}),
        },
        body: JSON.stringify({
          area,
          severity,
          pageUrl,
          description: description.trim(),
          steps: steps.trim(),
          reporterEmail: reporter ?? 'unknown',
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `Server error ${res.status}`);
      }
      submitted = true;
      setTimeout(() => {
        toasts.success('Bug report sent — the dev team is on it! 🐛');
        close();
      }, 1600);
    } catch (err: any) {
      toasts.error(`Failed to submit: ${err.message}`);
    } finally {
      submitting = false;
    }
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') close();
  }

  $: canSubmit = !!(area && severity && description.trim()) && !submitting && !submitted;
  $: activeSev = SEVERITIES.find(s => s.value === severity);
</script>

<svelte:window on:keydown={onKeydown} />

{#if open}
  <div class="brm-backdrop" role="presentation" on:click|self={close}>
    <div
      class="brm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="brm-title"
    >
      <!-- ── Glow ring behind modal ── -->
      <div class="brm__glow" aria-hidden="true"></div>

      <!-- ── Header ── -->
      <header class="brm__header">
        <div class="brm__header-left">
          <span class="brm__header-icon">🐛</span>
          <div>
            <h2 id="brm-title" class="brm__title">Report a Bug</h2>
            <p class="brm__subtitle">Help us fix it fast — every detail counts.</p>
          </div>
        </div>
        <button class="brm__close" on:click={close} aria-label="Close">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </button>
      </header>

      <!-- ── Body ── -->
      <div class="brm__body">

        <!-- Area grid -->
        <div class="brm__section">
          <label class="brm__section-label">
            Area affected <span class="brm__req">*</span>
          </label>
          <div class="brm__area-grid">
            {#each AREAS as a}
              <button
                type="button"
                class="brm__area-chip"
                class:brm__area-chip--active={area === a.value}
                on:click={() => (area = a.value)}
                title={a.value}
              >
                <span class="brm__area-chip-icon">{a.icon}</span>
                <span class="brm__area-chip-label">{a.value}</span>
              </button>
            {/each}
          </div>
        </div>

        <!-- Severity -->
        <div class="brm__section">
          <label class="brm__section-label">
            Severity <span class="brm__req">*</span>
          </label>
          <div class="brm__sev-row">
            {#each SEVERITIES as s}
              <button
                type="button"
                class="brm__sev-pill"
                class:brm__sev-pill--active={severity === s.value}
                style="
                  --sev-color: {s.color};
                  --sev-glow: {s.glow};
                "
                on:click={() => (severity = s.value)}
                title={s.hint}
              >
                <span class="brm__sev-dot" style="background:{s.color}"></span>
                {s.label}
              </button>
            {/each}
          </div>
          {#if activeSev}
            <p class="brm__sev-hint">{activeSev.hint}</p>
          {/if}
        </div>

        <!-- Page URL -->
        <div class="brm__section brm__section--row">
          <label class="brm__section-label" for="brm-url">
            <span>Page URL</span>
            <span class="brm__optional">auto-detected</span>
          </label>
          <div class="brm__input-wrapper">
            <span class="brm__input-prefix">link</span>
            <input
              id="brm-url"
              type="text"
              class="brm__input brm__input--url"
              bind:value={pageUrl}
              placeholder="https://…"
            />
          </div>
        </div>

        <!-- Description -->
        <div class="brm__section">
          <label class="brm__section-label" for="brm-desc">
            What happened? <span class="brm__req">*</span>
          </label>
          <textarea
            id="brm-desc"
            class="brm__textarea"
            bind:value={description}
            placeholder="Describe what went wrong and what you expected to happen…"
            rows="4"
          ></textarea>
          <div class="brm__char-hint">{description.length} chars</div>
        </div>

        <!-- Steps -->
        <div class="brm__section">
          <label class="brm__section-label" for="brm-steps">
            Steps to reproduce
            <span class="brm__optional">optional</span>
          </label>
          <textarea
            id="brm-steps"
            class="brm__textarea brm__textarea--sm"
            bind:value={steps}
            placeholder={"1. Go to…\n2. Click…\n3. See error"}
            rows="3"
          ></textarea>
        </div>

      </div>

      <!-- ── Footer ── -->
      <footer class="brm__footer">
        <button
          class="brm__btn-cancel"
          on:click={close}
          disabled={submitting}
        >Cancel</button>

        <button
          class="brm__btn-submit"
          on:click={submit}
          disabled={!canSubmit}
          class:brm__btn-submit--success={submitted}
        >
          {#if submitted}
            <span class="brm__submit-check">✓ Sent!</span>
          {:else if submitting}
            <span class="brm__submit-spinner"></span>
            Sending…
          {:else}
            <svg class="brm__submit-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <path d="M22 2L11 13" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M22 2L15 22 11 13 2 9l20-7z" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            Submit report
          {/if}
        </button>
      </footer>
    </div>
  </div>
{/if}

<style>
  /* ── Backdrop ─────────────────────────────────────────────────────────── */
  .brm-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(6px);
    -webkit-backdrop-filter: blur(6px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9000;
    padding: 20px;
    animation: brm-fade-in 0.2s ease;
  }

  @keyframes brm-fade-in {
    from { opacity: 0 }
    to   { opacity: 1 }
  }

  /* ── Modal shell ──────────────────────────────────────────────────────── */
  .brm {
    position: relative;
    width: 100%;
    max-width: 540px;
    max-height: 92vh;
    display: flex;
    flex-direction: column;
    background: linear-gradient(
      145deg,
      rgba(15, 23, 42, 0.98) 0%,
      rgba(15, 20, 40, 0.98) 100%
    );
    border: 1px solid rgba(255, 255, 255, 0.09);
    border-radius: 20px;
    box-shadow:
      0 0 0 1px rgba(255,255,255,0.04),
      0 32px 80px rgba(0, 0, 0, 0.7),
      0 8px 24px rgba(0, 0, 0, 0.5);
    overflow: hidden;
    animation: brm-slide-up 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  @keyframes brm-slide-up {
    from { opacity: 0; transform: translateY(24px) scale(0.96) }
    to   { opacity: 1; transform: translateY(0)    scale(1)    }
  }

  /* ambient glow */
  .brm__glow {
    position: absolute;
    top: -80px;
    left: 50%;
    transform: translateX(-50%);
    width: 400px;
    height: 200px;
    background: radial-gradient(ellipse, rgba(99,102,241,0.18) 0%, transparent 70%);
    pointer-events: none;
    z-index: 0;
  }

  /* ── Header ───────────────────────────────────────────────────────────── */
  .brm__header {
    position: relative;
    z-index: 1;
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    padding: 22px 24px 18px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    background: linear-gradient(
      to bottom,
      rgba(99, 102, 241, 0.06) 0%,
      transparent 100%
    );
  }
  .brm__header-left {
    display: flex;
    align-items: flex-start;
    gap: 14px;
  }
  .brm__header-icon {
    font-size: 28px;
    line-height: 1;
    margin-top: 2px;
    filter: drop-shadow(0 0 12px rgba(99,102,241,0.6));
  }
  .brm__title {
    margin: 0 0 2px;
    font-size: 17px;
    font-weight: 700;
    color: #f1f5f9;
    letter-spacing: -0.01em;
  }
  .brm__subtitle {
    margin: 0;
    font-size: 12px;
    color: rgba(148,163,184,0.8);
    font-weight: 400;
  }
  .brm__close {
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 8px;
    width: 30px;
    height: 30px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    color: rgba(148,163,184,0.7);
    transition: all 0.15s;
    flex-shrink: 0;
  }
  .brm__close:hover {
    background: rgba(255,255,255,0.09);
    color: #f1f5f9;
    border-color: rgba(255,255,255,0.15);
  }

  /* ── Body ─────────────────────────────────────────────────────────────── */
  .brm__body {
    position: relative;
    z-index: 1;
    padding: 20px 24px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 20px;
    flex: 1;
    scrollbar-width: thin;
    scrollbar-color: rgba(99,102,241,0.3) transparent;
  }

  /* ── Section ──────────────────────────────────────────────────────────── */
  .brm__section {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .brm__section--row { gap: 6px; }

  .brm__section-label {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    font-weight: 700;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }
  .brm__req { color: #6366f1; }
  .brm__optional {
    font-size: 10px;
    font-weight: 500;
    color: rgba(100,116,139,0.6);
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.07);
    border-radius: 4px;
    padding: 1px 6px;
    text-transform: none;
    letter-spacing: 0;
  }

  /* ── Area chips grid ──────────────────────────────────────────────────── */
  .brm__area-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 7px;
  }
  .brm__area-chip {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 5px;
    padding: 10px 6px;
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.07);
    border-radius: 11px;
    cursor: pointer;
    transition: all 0.15s;
    color: rgba(148,163,184,0.75);
  }
  .brm__area-chip:hover {
    background: rgba(99,102,241,0.1);
    border-color: rgba(99,102,241,0.35);
    color: #c7d2fe;
    transform: translateY(-1px);
  }
  .brm__area-chip--active {
    background: rgba(99,102,241,0.18);
    border-color: rgba(99,102,241,0.7);
    color: #a5b4fc;
    box-shadow: 0 0 0 1px rgba(99,102,241,0.3), 0 4px 12px rgba(99,102,241,0.15);
  }
  .brm__area-chip-icon {
    font-size: 18px;
    line-height: 1;
  }
  .brm__area-chip-label {
    font-size: 10px;
    font-weight: 600;
    text-align: center;
    line-height: 1.3;
    word-break: break-word;
  }

  /* ── Severity pills ───────────────────────────────────────────────────── */
  .brm__sev-row {
    display: flex;
    gap: 8px;
  }
  .brm__sev-pill {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    padding: 9px 0;
    font-size: 12px;
    font-weight: 700;
    background: rgba(255,255,255,0.035);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 10px;
    cursor: pointer;
    color: rgba(148,163,184,0.7);
    transition: all 0.15s;
  }
  .brm__sev-pill:hover {
    background: rgba(255,255,255,0.07);
    border-color: var(--sev-color, #6366f1);
    color: #fff;
    box-shadow: 0 0 0 1px var(--sev-glow, transparent),
                inset 0 1px 0 rgba(255,255,255,0.05);
  }
  .brm__sev-pill--active {
    background: rgba(255,255,255,0.06);
    border-color: var(--sev-color, #6366f1);
    color: #fff;
    box-shadow:
      0 0 0 1px var(--sev-glow),
      0 0 12px var(--sev-glow),
      inset 0 1px 0 rgba(255,255,255,0.08);
  }
  .brm__sev-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .brm__sev-hint {
    margin: 0;
    font-size: 11px;
    color: rgba(148,163,184,0.55);
    font-style: italic;
    padding-left: 2px;
  }

  /* ── Input + Textarea ─────────────────────────────────────────────────── */
  .brm__input-wrapper {
    position: relative;
    display: flex;
    align-items: center;
  }
  .brm__input-prefix {
    position: absolute;
    left: 12px;
    font-size: 11px;
    font-weight: 600;
    color: rgba(99,102,241,0.7);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    pointer-events: none;
    user-select: none;
  }

  .brm__input,
  .brm__textarea {
    width: 100%;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.09);
    border-radius: 10px;
    color: #e2e8f0;
    font-size: 13px;
    padding: 10px 14px;
    box-sizing: border-box;
    font-family: inherit;
    transition: border-color 0.15s, box-shadow 0.15s, background 0.15s;
    resize: none;
    line-height: 1.6;
  }
  .brm__input--url {
    padding-left: 44px;
    font-size: 12px;
    color: rgba(148,163,184,0.8);
  }
  .brm__input:focus,
  .brm__textarea:focus {
    outline: none;
    border-color: rgba(99,102,241,0.6);
    box-shadow: 0 0 0 3px rgba(99,102,241,0.12);
    background: rgba(99,102,241,0.04);
  }
  .brm__textarea::placeholder,
  .brm__input::placeholder { color: rgba(100,116,139,0.5); }

  .brm__textarea--sm { font-size: 12px; }

  .brm__char-hint {
    font-size: 10px;
    color: rgba(100,116,139,0.4);
    text-align: right;
    margin-top: -4px;
  }

  /* ── Footer ───────────────────────────────────────────────────────────── */
  .brm__footer {
    position: relative;
    z-index: 1;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 10px;
    padding: 16px 24px;
    border-top: 1px solid rgba(255,255,255,0.06);
    background: rgba(0,0,0,0.15);
  }

  .brm__btn-cancel {
    font-size: 13px;
    font-weight: 600;
    padding: 9px 18px;
    border-radius: 10px;
    cursor: pointer;
    border: 1px solid rgba(255,255,255,0.08);
    background: rgba(255,255,255,0.04);
    color: rgba(148,163,184,0.8);
    transition: all 0.15s;
  }
  .brm__btn-cancel:hover:not(:disabled) {
    background: rgba(255,255,255,0.08);
    color: #f1f5f9;
    border-color: rgba(255,255,255,0.14);
  }
  .brm__btn-cancel:disabled { opacity: 0.4; cursor: not-allowed; }

  .brm__btn-submit {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    font-weight: 700;
    padding: 9px 22px;
    border-radius: 10px;
    cursor: pointer;
    border: none;
    background: linear-gradient(135deg, #6366f1 0%, #818cf8 50%, #6366f1 100%);
    background-size: 200% 200%;
    background-position: 0% 0%;
    color: #fff;
    transition: all 0.2s;
    box-shadow: 0 4px 15px rgba(99,102,241,0.35);
    letter-spacing: 0.01em;
    position: relative;
    overflow: hidden;
  }
  .brm__btn-submit::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(135deg, rgba(255,255,255,0.15) 0%, transparent 60%);
    pointer-events: none;
  }
  .brm__btn-submit:not(:disabled):hover {
    background-position: 100% 100%;
    box-shadow: 0 6px 22px rgba(99,102,241,0.5);
    transform: translateY(-1px);
  }
  .brm__btn-submit:disabled { opacity: 0.4; cursor: not-allowed; transform: none; box-shadow: none; }

  .brm__btn-submit--success {
    background: linear-gradient(135deg, #22c55e, #16a34a) !important;
    box-shadow: 0 4px 15px rgba(34,197,94,0.35) !important;
  }

  .brm__submit-icon { opacity: 0.9; }

  .brm__submit-spinner {
    width: 13px;
    height: 13px;
    border: 2px solid rgba(255,255,255,0.3);
    border-top-color: #fff;
    border-radius: 50%;
    animation: brm-spin 0.7s linear infinite;
    flex-shrink: 0;
  }
  @keyframes brm-spin {
    to { transform: rotate(360deg); }
  }

  .brm__submit-check {
    font-size: 14px;
    font-weight: 800;
  }
</style>
