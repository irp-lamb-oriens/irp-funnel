<script lang="ts">
  import { createEventDispatcher, onDestroy, onMount } from 'svelte';
  import { authToken } from '../store.ts';
  import {
    createDictation,
    type DictationHandle,
    type DictationState,
  } from '../../../lib/voice/liveDictation.js';
  import { extractClientFields, type ClientFieldExtraction } from '../../../lib/voice/extractClientFields.js';

  const dispatch = createEventDispatcher<{
    created: { docId: string };
    close: void;
  }>();

  const API_URL  = import.meta.env.VITE_API_URL || 'http://localhost:8000';
  const GEM_KEY  = import.meta.env.VITE_GEMINI_API_KEY as string;
  const GEM_URL  = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${GEM_KEY}`;

  // ─── Step machine ──────────────────────────────────────────────────────────
  type Step = 'capture' | 'structuring' | 'review';
  let step: Step = 'capture';

  // ─── Dictation ─────────────────────────────────────────────────────────────
  let dictation: DictationHandle | null = null;
  let dictState: DictationState = 'idle';
  let committedText = '';   // final words from STT
  let interimText   = '';   // live partial words
  let rawTranscript = '';   // full raw for voiceTranscript field

  $: displayTranscript = committedText + (interimText ? ` ${interimText}` : '');

  // ─── Extraction results ────────────────────────────────────────────────────
  let extracted: ClientFieldExtraction | null = null;
  let extractError = '';
  // Which standard fields were set by AI (for highlight animation)
  let aiFilledFields: Set<string> = new Set();

  // ─── Form fields ───────────────────────────────────────────────────────────
  let name          = '';
  let surname       = '';
  let email         = '';
  let phone         = '';
  let originCountry = '';
  let originCity    = '';
  let destinationCountry = '';
  let destinationCity    = '';
  let budget        = '';
  let size          = '';
  let immigrationStatus = '';
  let notes         = '';
  let customFieldRows: { key: string; value: string }[] = [];

  // ─── Submission ────────────────────────────────────────────────────────────
  let submitting  = false;
  let submitError = '';

  // ─── Waveform bars ─────────────────────────────────────────────────────────
  const BARS = 18;
  let waveHeights: number[] = Array.from({ length: BARS }, () => 20);
  let waveTimer: ReturnType<typeof setInterval> | null = null;

  function startWave() {
    waveTimer = setInterval(() => {
      waveHeights = Array.from({ length: BARS }, () =>
        dictState === 'listening' ? 20 + Math.random() * 60 : 20
      );
    }, 80);
  }

  function stopWave() {
    if (waveTimer) { clearInterval(waveTimer); waveTimer = null; }
    waveHeights = Array.from({ length: BARS }, () => 20);
  }

  // ─── Dictation helpers ─────────────────────────────────────────────────────
  async function startRecording() {
    dictation = createDictation({
      geminiUrl: GEM_URL,
      onState:  (s: DictationState) => {
        dictState = s;
        if (s === 'listening')    startWave();
        else if (s === 'idle')    stopWave();
      },
      onInterim:           (t: string) => { interimText = t; },
      onFinal:             (s: string) => { committedText += s; interimText = ''; },
      onTranscriptReplace: (t: string) => { committedText = t; interimText = ''; },
      onError:             (m: string) => console.warn('[dictation]', m),
    });
    await dictation.start();
  }

  async function stopAndStructure() {
    if (!dictation) return;
    rawTranscript = await dictation.stop();
    dictation    = null;
    interimText  = '';
    if (!rawTranscript.trim()) return; // nothing spoken
    step = 'structuring';
    await runExtraction(rawTranscript || committedText);
  }

  async function runExtraction(transcript: string) {
    extractError = '';
    try {
      extracted = await extractClientFields(transcript, GEM_URL);
      fillFormFromExtraction(extracted);
      step = 'review';
    } catch (e: any) {
      extractError = e.message;
      // Still show the review form — user can fill manually
      step = 'review';
    }
  }

  function fillFormFromExtraction(f: ClientFieldExtraction) {
    aiFilledFields = new Set();
    const fill = (field: string, val: string | undefined) => {
      if (val && val.trim()) {
        aiFilledFields = new Set([...aiFilledFields, field]);
        return val.trim();
      }
      return '';
    };
    name               = fill('name',               f.name);
    surname            = fill('surname',             f.surname);
    email              = fill('email',               f.email);
    phone              = fill('phone',               f.phone);
    originCountry      = fill('originCountry',       f.originCountry);
    originCity         = fill('originCity',          f.originCity);
    destinationCountry = fill('destinationCountry',  f.destinationCountry);
    destinationCity    = fill('destinationCity',     f.destinationCity);
    budget             = fill('budget',              f.budget);
    size               = fill('size',                f.size);
    immigrationStatus  = fill('immigrationStatus',   f.immigrationStatus);
    notes              = fill('notes',               f.notes);
    customFieldRows    = (Object.entries(f.customFields || {}) as [string, string][]).map(([key, value]) => ({ key, value }));
  }

  // ─── Custom field rows ─────────────────────────────────────────────────────
  function addCustomField() {
    customFieldRows = [...customFieldRows, { key: '', value: '' }];
  }
  function removeCustomField(i: number) {
    customFieldRows = customFieldRows.filter((_, idx) => idx !== i);
  }

  // ─── Submit ────────────────────────────────────────────────────────────────
  function getHeaders() {
    return { 'Content-Type': 'application/json', 'x-dashboard-token': $authToken || '' };
  }

  async function handleSubmit() {
    if (!email.trim()) { submitError = 'Email is required.'; return; }
    submitting  = true;
    submitError = '';
    const builtCustomFields: Record<string, string> = {};
    for (const row of customFieldRows) {
      const k = row.key.trim();
      const v = row.value.trim();
      if (k && v) builtCustomFields[k] = v;
    }
    try {
      const res = await fetch(`${API_URL}/api/dashboard/clients/manual`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          name:               name.trim(),
          surname:            surname.trim(),
          email:              email.trim().toLowerCase(),
          phone:              phone.trim(),
          originCountry:      originCountry.trim(),
          originCity:         originCity.trim(),
          destinationCountry: destinationCountry.trim(),
          destinationCity:    destinationCity.trim(),
          budget:             budget.trim(),
          size:               size.trim(),
          immigrationStatus:  immigrationStatus.trim(),
          notes:              notes.trim(),
          voiceTranscript:    rawTranscript || undefined,
          customFields:       Object.keys(builtCustomFields).length
                                ? builtCustomFields : undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || 'Failed to create client.');
      }
      const data = await res.json();
      dispatch('created', { docId: data.docId });
    } catch (err: any) {
      submitError = err.message;
    } finally {
      submitting = false;
    }
  }

  // ─── Skip to manual form ───────────────────────────────────────────────────
  function skipToManual() {
    if (dictation) { dictation.stop().catch(() => {}); dictation = null; }
    stopWave();
    step = 'review';
  }

  // ─── Close ─────────────────────────────────────────────────────────────────
  function closeModal() {
    if (dictation) { dictation.stop().catch(() => {}); dictation = null; }
    stopWave();
    dispatch('close');
  }

  onDestroy(() => {
    if (dictation) { try { dictation.stop(); } catch {} dictation = null; }
    stopWave();
  });
</script>

<!-- ─────────────────────────────── OVERLAY ─────────────────────────────────── -->
<div class="acm-overlay" on:click|self={closeModal} role="dialog" aria-modal="true">
  <div class="acm-shell" class:capture-mode={step === 'capture'}>

    <!-- ╔═══ CLOSE button always visible ═══╗ -->
    <button class="acm-x" on:click={closeModal} aria-label="Close">✕</button>

    <!-- ══════════════════════════════════════════════════════ -->
    <!--  STEP 1 — CAPTURE                                     -->
    <!-- ══════════════════════════════════════════════════════ -->
    {#if step === 'capture'}
      <div class="capture-wrap">

        <!-- Title -->
        <div class="capture-title">
          <h2>New Client</h2>
          <p class="capture-sub">Speak naturally — we'll structure it for you</p>
        </div>

        <!-- Record orb -->
        <div class="orb-wrap"
          class:orb-idle={dictState === 'idle' || dictState === 'starting'}
          class:orb-listening={dictState === 'listening'}
        >
          {#if dictState === 'listening'}
            <div class="orb-ring ring-1"></div>
            <div class="orb-ring ring-2"></div>
          {/if}
          <button
            class="orb-btn"
            class:orb-btn-recording={dictState === 'listening'}
            on:click={dictState === 'idle' || dictState === 'starting' ? startRecording : stopAndStructure}
            aria-label={dictState === 'listening' ? 'Stop recording' : 'Start recording'}
          >
            {#if dictState === 'idle' || dictState === 'starting'}
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M12 1a4 4 0 0 1 4 4v6a4 4 0 0 1-8 0V5a4 4 0 0 1 4-4z" fill="currentColor"/>
                <path d="M19 10a7 7 0 0 1-14 0" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/>
                <line x1="12" y1="17" x2="12" y2="23" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                <line x1="8" y1="23" x2="16" y2="23" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              </svg>
              <span class="orb-label">Record</span>
            {:else}
              <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <rect x="4" y="4" width="16" height="16" rx="2"/>
              </svg>
              <span class="orb-label">Stop</span>
            {/if}
          </button>
        </div>

        <!-- Waveform -->
        {#if dictState === 'listening'}
          <div class="waveform" aria-hidden="true">
            {#each waveHeights as h}
              <div class="wave-bar" style="height:{h}%"></div>
            {/each}
          </div>
        {:else}
          <div class="waveform waveform-idle" aria-hidden="true">
            {#each waveHeights as _}
              <div class="wave-bar"></div>
            {/each}
          </div>
        {/if}

        <!-- Live transcript -->
        <div class="capture-transcript" class:has-text={displayTranscript.length > 0}>
          {#if displayTranscript}
            <span class="transcript-committed">{committedText}</span><!--
            -->{#if interimText}<span class="transcript-interim"> {interimText}</span>{/if}
          {:else if dictState === 'idle'}
            <span class="transcript-placeholder">
              Say something like: "New client, John Smith, moving from Texas to Costa Rica in October,
              budget around fifteen thousand, looking at residency…"
            </span>
          {:else}
            <span class="transcript-placeholder">Listening…</span>
          {/if}
        </div>

        <!-- Actions -->
        <div class="capture-actions">
          {#if dictState === 'listening' && committedText.trim()}
            <button class="btn-structure" on:click={stopAndStructure}>
              Stop &amp; Structure →
            </button>
          {/if}
          <button class="btn-skip" on:click={skipToManual}>
            ✏️ Skip — I'll type it
          </button>
        </div>

      </div>
    {/if}

    <!-- ══════════════════════════════════════════════════════ -->
    <!--  STEP 2a — STRUCTURING                                -->
    <!-- ══════════════════════════════════════════════════════ -->
    {#if step === 'structuring'}
      <div class="structuring-wrap">
        <div class="structuring-orb">
          <div class="s-ring s-ring-1"></div>
          <div class="s-ring s-ring-2"></div>
          <div class="s-ring s-ring-3"></div>
          <span class="s-icon">✨</span>
        </div>
        <h2 class="structuring-title">Structuring your client…</h2>
        <p class="structuring-sub">Reading between the lines</p>

        {#if committedText}
          <div class="structuring-transcript">{committedText.slice(0, 160)}{committedText.length > 160 ? '…' : ''}</div>
        {/if}
      </div>
    {/if}

    <!-- ══════════════════════════════════════════════════════ -->
    <!--  STEP 2b — REVIEW FORM                               -->
    <!-- ══════════════════════════════════════════════════════ -->
    {#if step === 'review'}
      <div class="review-wrap">

        <!-- Header -->
        <div class="review-header">
          <div>
            <h2>Review & Create</h2>
            {#if extracted && !extractError}
              <p class="review-sub">✨ AI filled <strong>{aiFilledFields.size}</strong> field{aiFilledFields.size !== 1 ? 's' : ''} — edit anything you like</p>
            {:else if extractError}
              <p class="review-sub review-sub-err">Extraction had an issue — fill manually</p>
            {:else}
              <p class="review-sub">Fill in the client details</p>
            {/if}
          </div>
          {#if rawTranscript}
            <details class="transcript-details">
              <summary>📝 Transcript</summary>
              <div class="transcript-detail-body">{rawTranscript}</div>
            </details>
          {/if}
        </div>

        <!-- Form -->
        <div class="review-body">

          <div class="acm-row" style="--i:0">
            <label class:ai-filled={aiFilledFields.has('name')}>
              First Name
              <input bind:value={name} placeholder="John" />
            </label>
            <label class:ai-filled={aiFilledFields.has('surname')}>
              Surname
              <input bind:value={surname} placeholder="Smith" />
            </label>
          </div>

          <div class="acm-row" style="--i:1">
            <label class="acm-required" class:ai-filled={aiFilledFields.has('email')}>
              Email *
              <input type="email" bind:value={email} placeholder="john@example.com" />
            </label>
            <label class:ai-filled={aiFilledFields.has('phone')}>
              Phone
              <input bind:value={phone} placeholder="+1 555 123 4567" />
            </label>
          </div>

          <div class="acm-row" style="--i:2">
            <label class:ai-filled={aiFilledFields.has('originCountry')}>
              Origin Country
              <input bind:value={originCountry} placeholder="United States" />
            </label>
            <label class:ai-filled={aiFilledFields.has('originCity')}>
              Origin City
              <input bind:value={originCity} placeholder="Austin, TX" />
            </label>
          </div>

          <div class="acm-row" style="--i:3">
            <label class:ai-filled={aiFilledFields.has('destinationCountry')}>
              Destination Country
              <input bind:value={destinationCountry} placeholder="Costa Rica" />
            </label>
            <label class:ai-filled={aiFilledFields.has('destinationCity')}>
              Destination City
              <input bind:value={destinationCity} placeholder="San José" />
            </label>
          </div>

          <div class="acm-row" style="--i:4">
            <label class:ai-filled={aiFilledFields.has('budget')}>
              Budget
              <select bind:value={budget}>
                <option value="">Unknown</option>
                <option>Under $5k</option>
                <option>$5-10k</option>
                <option>$10-15k</option>
                <option>$15-20k</option>
                <option>$20-30k</option>
                <option>Over $30k</option>
              </select>
            </label>
            <label class:ai-filled={aiFilledFields.has('size')}>
              Move Size
              <select bind:value={size}>
                <option value="">Unknown</option>
                <option>LCL / Partial</option>
                <option>20ft container</option>
                <option>40ft container</option>
              </select>
            </label>
          </div>

          <div class="acm-row" style="--i:5">
            <label class:ai-filled={aiFilledFields.has('immigrationStatus')}>
              Immigration Status
              <input bind:value={immigrationStatus} placeholder="Pensionado visa, none…" />
            </label>
          </div>

          <div class="acm-row acm-row-full" style="--i:6">
            <label class:ai-filled={aiFilledFields.has('notes')}>
              Notes
              <textarea bind:value={notes} rows="3" placeholder="Any additional context…"></textarea>
            </label>
          </div>

          <!-- Custom fields -->
          {#if customFieldRows.length > 0 || true}
            <div class="custom-fields-section" style="--i:7">
              <div class="custom-fields-header">
                <span class="custom-fields-label">Custom Fields</span>
                <button class="btn-add-cf" on:click={addCustomField}>+ Add field</button>
              </div>
              {#each customFieldRows as row, i}
                <div class="cf-row">
                  <input class="cf-key" bind:value={row.key} placeholder="Field name" />
                  <input class="cf-val" bind:value={row.value} placeholder="Value" />
                  <button class="cf-del" on:click={() => removeCustomField(i)} aria-label="Remove">×</button>
                </div>
              {/each}
              {#if customFieldRows.length === 0}
                <button class="btn-add-cf btn-add-cf-empty" on:click={addCustomField}>
                  + Add a custom field
                </button>
              {/if}
            </div>
          {/if}

        </div><!-- .review-body -->

        <!-- Footer -->
        <div class="review-footer">
          {#if submitError}
            <div class="rfoot-error">{submitError}</div>
          {/if}
          <button class="btn-back" on:click={() => { step = 'capture'; committedText = ''; interimText = ''; rawTranscript = ''; }}>
            ← Re-record
          </button>
          <button class="btn-create" on:click={handleSubmit} disabled={submitting || !email.trim()}>
            {submitting ? '⏳ Creating…' : '✅ Create Client'}
          </button>
        </div>

      </div>
    {/if}

  </div>
</div>

<!-- ─────────────────────────────── STYLES ──────────────────────────────────── -->
<style>
  /* ── Overlay ── */
  .acm-overlay {
    position: fixed; inset: 0;
    background: rgba(0,0,0,.65);
    z-index: 1000;
    display: flex; align-items: center; justify-content: center;
    padding: 1rem;
    backdrop-filter: blur(4px);
  }

  .acm-shell {
    background: #131320;
    border: 1px solid #3a3a5c;
    border-radius: 20px;
    width: 100%; max-width: 680px;
    max-height: 92vh;
    display: flex; flex-direction: column;
    overflow: hidden;
    box-shadow: 0 24px 80px rgba(0,0,0,.7);
    position: relative;
    transition: max-width .3s;
  }
  .capture-mode { max-width: 460px; }

  /* ── Close ── */
  .acm-x {
    position: absolute; top: .9rem; right: .9rem; z-index: 10;
    background: rgba(255,255,255,.07); border: 1px solid #3a3a5c;
    color: #777; width: 30px; height: 30px; border-radius: 50%;
    font-size: .8rem; cursor: pointer; display: flex;
    align-items: center; justify-content: center; line-height: 1;
  }
  .acm-x:hover { background: rgba(255,255,255,.12); color: #fff; }

  /* ══════════ CAPTURE STEP ══════════ */
  .capture-wrap {
    display: flex; flex-direction: column; align-items: center;
    padding: 2.5rem 2rem 2rem;
    gap: 1.25rem;
    min-height: 480px;
  }

  .capture-title { text-align: center; }
  .capture-title h2 { margin: 0; font-size: 1.5rem; font-weight: 700; color: #e2e2f0; }
  .capture-sub { margin: .3rem 0 0; font-size: .87rem; color: #666; }

  /* Orb */
  .orb-wrap { position: relative; display: flex; align-items: center; justify-content: center; }

  .orb-ring {
    position: absolute; border-radius: 50%;
    border: 1.5px solid rgba(168,85,247,.4);
    animation: orb-ring-pulse 2s ease-out infinite;
    pointer-events: none;
  }
  .ring-1 { width: 130px; height: 130px; animation-delay: 0s; }
  .ring-2 { width: 170px; height: 170px; animation-delay: .7s; }
  @keyframes orb-ring-pulse {
    0%   { transform: scale(.85); opacity: .7; }
    100% { transform: scale(1.15); opacity: 0; }
  }

  .orb-btn {
    position: relative; z-index: 1;
    width: 100px; height: 100px;
    border-radius: 50%;
    border: 2px solid #4a4a6e;
    background: #1e1e2e;
    color: #c4b5fd;
    cursor: pointer;
    display: flex; flex-direction: column; align-items: center;
    justify-content: center; gap: .25rem;
    transition: background .2s, border-color .2s, transform .15s, box-shadow .2s;
  }
  .orb-btn:hover { background: #252538; border-color: #7c3aed; transform: scale(1.04); }
  .orb-btn:active { transform: scale(.97); }
  .orb-btn-recording {
    background: #2d0a1f;
    border-color: #f87171;
    color: #fca5a5;
    box-shadow: 0 0 24px rgba(248,113,113,.25);
  }
  .orb-label { font-size: .72rem; font-weight: 600; text-transform: uppercase; letter-spacing: .06em; }

  /* Waveform */
  .waveform {
    display: flex; align-items: center; justify-content: center;
    gap: 2.5px; height: 54px; width: 100%;
    max-width: 260px;
  }
  .wave-bar {
    flex-shrink: 0; width: 3px; min-height: 4px;
    background: linear-gradient(to top, #7c3aed, #a78bfa);
    border-radius: 2px;
    transition: height .07s ease;
    opacity: .85;
  }
  .waveform-idle .wave-bar { height: 4px !important; opacity: .25; }

  /* Transcript */
  .capture-transcript {
    width: 100%; max-width: 380px;
    min-height: 80px; max-height: 160px;
    overflow-y: auto;
    background: rgba(255,255,255,.03);
    border: 1px solid #2a2a3e;
    border-radius: 10px;
    padding: .75rem 1rem;
    font-size: .93rem; line-height: 1.65;
    color: #e2e2f0;
  }
  .transcript-committed { color: #e2e2f0; }
  .transcript-interim   { color: #888; font-style: italic; }
  .transcript-placeholder { color: #3a3a5c; font-size: .82rem; line-height: 1.6; }

  .capture-actions {
    display: flex; flex-direction: column; align-items: center; gap: .5rem;
    width: 100%; max-width: 320px;
  }
  .btn-structure {
    width: 100%; padding: .7rem 1.2rem;
    background: #7c3aed; color: #fff;
    border: none; border-radius: 10px;
    font-size: .95rem; font-weight: 700;
    cursor: pointer; transition: background .15s;
  }
  .btn-structure:hover { background: #6d28d9; }
  .btn-skip {
    background: none; border: none;
    color: #555; font-size: .8rem;
    cursor: pointer; text-decoration: underline;
    text-underline-offset: 3px;
  }
  .btn-skip:hover { color: #888; }

  /* ══════════ STRUCTURING STEP ══════════ */
  .structuring-wrap {
    display: flex; flex-direction: column; align-items: center;
    padding: 3.5rem 2rem;
    gap: 1.25rem; min-height: 400px;
    justify-content: center;
  }

  .structuring-orb {
    position: relative; width: 90px; height: 90px;
    display: flex; align-items: center; justify-content: center;
  }
  .s-ring {
    position: absolute; border-radius: 50%;
    border: 1.5px solid rgba(250,204,21,.35);
    animation: s-expand 1.8s ease-out infinite;
  }
  .s-ring-1 { width: 90px;  height: 90px;  animation-delay: 0s; }
  .s-ring-2 { width: 120px; height: 120px; animation-delay: .5s; }
  .s-ring-3 { width: 150px; height: 150px; animation-delay: 1s; }
  @keyframes s-expand {
    0%   { transform: scale(.7); opacity: .8; }
    100% { transform: scale(1.2); opacity: 0; }
  }
  .s-icon { font-size: 2.5rem; position: relative; z-index: 1; animation: s-spin 3s linear infinite; }
  @keyframes s-spin { 0% { transform: rotate(0); } 100% { transform: rotate(360deg); } }

  .structuring-title { margin: 0; font-size: 1.4rem; font-weight: 700; color: #e2e2f0; }
  .structuring-sub   { margin: 0; font-size: .85rem; color: #666; }
  .structuring-transcript {
    margin-top: .5rem;
    max-width: 340px;
    background: rgba(255,255,255,.03);
    border: 1px solid #2a2a3e;
    border-radius: 8px;
    padding: .6rem .9rem;
    font-size: .8rem; color: #555;
    text-align: center; line-height: 1.5;
    font-style: italic;
  }

  /* ══════════ REVIEW STEP ══════════ */
  .review-wrap {
    display: flex; flex-direction: column;
    max-height: 92vh;
    overflow: hidden;
  }

  .review-header {
    display: flex; align-items: flex-start;
    justify-content: space-between; flex-wrap: wrap;
    gap: .5rem;
    padding: 1.25rem 1.5rem;
    border-bottom: 1px solid #2a2a3e;
    flex-shrink: 0;
  }
  .review-header h2 { margin: 0; font-size: 1.1rem; color: #e2e2f0; }
  .review-sub { margin: .2rem 0 0; font-size: .8rem; color: #666; }
  .review-sub strong { color: #a78bfa; }
  .review-sub-err { color: #f87171; }

  .transcript-details summary {
    font-size: .75rem; color: #555; cursor: pointer;
  }
  .transcript-details[open] summary { color: #888; }
  .transcript-detail-body {
    margin-top: .4rem;
    font-size: .78rem; color: #666; line-height: 1.55;
    max-height: 120px; overflow-y: auto;
  }

  .review-body {
    overflow-y: auto; flex: 1;
    padding: 1rem 1.5rem;
    display: flex; flex-direction: column; gap: .65rem;
  }

  /* Staggered row animation */
  .acm-row {
    display: grid; grid-template-columns: 1fr 1fr; gap: .65rem;
    animation: row-in .35s ease both;
    animation-delay: calc(var(--i, 0) * 55ms);
  }
  .acm-row-full { grid-template-columns: 1fr; }
  @media (max-width: 480px) { .acm-row { grid-template-columns: 1fr; } }
  @keyframes row-in {
    from { opacity: 0; transform: translateY(10px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  label {
    display: flex; flex-direction: column; gap: .28rem;
    font-size: .73rem; color: #666; font-weight: 600;
    text-transform: uppercase; letter-spacing: .04em;
  }
  label.acm-required { color: #c4b5fd; }

  /* AI-filled highlight */
  label.ai-filled input,
  label.ai-filled select,
  label.ai-filled textarea {
    border-color: #10b981;
    animation: ai-glow .8s ease both;
  }
  @keyframes ai-glow {
    0%   { box-shadow: 0 0 0 3px rgba(16,185,129,.35); }
    100% { box-shadow: none; }
  }

  input, select, textarea {
    background: #0e0e1a;
    border: 1px solid #2a2a3e;
    border-radius: 6px; color: #e2e2f0;
    padding: .42rem .65rem; font-size: .88rem;
    outline: none; transition: border-color .15s;
    font-family: inherit;
  }
  input:focus, select:focus, textarea:focus { border-color: #7c3aed; }
  textarea { resize: vertical; min-height: 70px; }

  /* Custom fields */
  .custom-fields-section {
    animation: row-in .35s ease both;
    animation-delay: calc(var(--i, 7) * 55ms);
    display: flex; flex-direction: column; gap: .45rem;
    padding-top: .25rem;
  }
  .custom-fields-header {
    display: flex; align-items: center;
    justify-content: space-between;
  }
  .custom-fields-label {
    font-size: .73rem; color: #555; font-weight: 600;
    text-transform: uppercase; letter-spacing: .04em;
  }
  .cf-row { display: flex; gap: .45rem; align-items: center; }
  .cf-key { flex: 1; min-width: 0; }
  .cf-val { flex: 2; min-width: 0; }
  .cf-del {
    flex-shrink: 0; width: 26px; height: 26px;
    background: rgba(248,113,113,.1);
    border: 1px solid rgba(248,113,113,.3);
    border-radius: 6px; color: #f87171;
    font-size: 1rem; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
  }
  .cf-del:hover { background: rgba(248,113,113,.2); }
  .btn-add-cf {
    background: none; border: 1px dashed #3a3a5c;
    color: #555; border-radius: 6px;
    padding: .3rem .8rem; font-size: .78rem;
    cursor: pointer; width: fit-content;
    transition: border-color .15s, color .15s;
  }
  .btn-add-cf:hover { border-color: #7c3aed; color: #a78bfa; }
  .btn-add-cf-empty { width: 100%; text-align: center; padding: .5rem; }

  /* Footer */
  .review-footer {
    display: flex; align-items: center;
    justify-content: flex-end; gap: .65rem;
    padding: .9rem 1.5rem;
    border-top: 1px solid #2a2a3e;
    flex-shrink: 0;
  }
  .rfoot-error { flex: 1; font-size: .78rem; color: #f87171; }
  .btn-back {
    padding: .48rem .9rem;
    background: #1a1a2e; border: 1px solid #3a3a5c;
    color: #777; border-radius: 8px; cursor: pointer;
    font-size: .82rem; transition: background .15s;
  }
  .btn-back:hover { background: #252540; }
  .btn-create {
    padding: .52rem 1.3rem;
    background: #7c3aed; color: #fff;
    border: none; border-radius: 8px;
    font-size: .9rem; font-weight: 700;
    cursor: pointer; transition: background .15s;
  }
  .btn-create:hover:not(:disabled) { background: #6d28d9; }
  .btn-create:disabled { opacity: .5; cursor: not-allowed; }
</style>
