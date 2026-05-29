<script lang="ts">
  import { createEventDispatcher, onDestroy } from 'svelte';
  import { authToken } from '../store.ts';
  import { extractClientFields, type ClientFieldExtraction } from '../../../lib/voice/extractClientFields.js';

  const dispatch = createEventDispatcher<{ created: { docId: string }; close: void }>();

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
  const GEM_KEY = import.meta.env.VITE_GEMINI_API_KEY as string;
  const MODEL   = 'gemini-flash-latest';
  const REST_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEM_KEY}`;
  const PROMPT  = 'Transcribe the audio verbatim. Output ONLY the spoken words with natural punctuation and capitalization. No commentary, no filler.';

  // ─── Step machine ─────────────────────────────────────────────────────────
  type Step = 'capture' | 'structuring' | 'review';
  let step: Step = 'capture';

  // ─── Recording (Mode A — 3-second additive slices, same as voice-test) ────
  type RecState = 'idle' | 'recording';
  let recState: RecState = 'idle';

  let mr:       MediaRecorder | null = null;
  let stream:   MediaStream   | null = null;
  let chunks:   Blob[]               = [];
  let mimeType  = '';
  let transcript    = '';   // builds up additively in real-time
  let rawTranscript = '';   // snapshot used for extraction

  // ─── Extraction ───────────────────────────────────────────────────────────
  let extracted: ClientFieldExtraction | null = null;
  let extractError = '';
  let aiFilledFields: Set<string> = new Set();

  // ─── Form fields ──────────────────────────────────────────────────────────
  let name = '', surname = '', email = '', phone = '';
  let originCountry = '', originCity = '';
  let destinationCountry = '', destinationCity = '';
  let budget = '', size = '', immigrationStatus = '', notes = '';
  let customFieldRows: { key: string; value: string }[] = [];

  // ─── Submission ───────────────────────────────────────────────────────────
  let submitting  = false;
  let submitError = '';

  // ─── Waveform ─────────────────────────────────────────────────────────────
  const BARS = 18;
  let waveHeights: number[] = Array.from({ length: BARS }, () => 20);
  let waveTimer: ReturnType<typeof setInterval> | null = null;

  function startWave() {
    waveTimer = setInterval(() => {
      waveHeights = Array.from({ length: BARS }, () => 20 + Math.random() * 60);
    }, 80);
  }
  function stopWave() {
    if (waveTimer) { clearInterval(waveTimer); waveTimer = null; }
    waveHeights = Array.from({ length: BARS }, () => 20);
  }

  // ─── Audio helpers ────────────────────────────────────────────────────────
  function pickMime() {
    for (const t of ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'])
      if (MediaRecorder.isTypeSupported(t)) return t;
    return '';
  }

  async function sliceToText(blob: Blob): Promise<string> {
    if (blob.size < 1000) return '';
    const ab = await blob.arrayBuffer();
    const bytes = new Uint8Array(ab);
    let bin = ''; const C = 65536;
    for (let i = 0; i < bytes.length; i += C)
      bin += String.fromCharCode(...bytes.subarray(i, i + C));
    const b64 = btoa(bin);
    const res = await fetch(REST_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: PROMPT }, { inlineData: { mimeType: blob.type, data: b64 } }] }],
        generationConfig: { temperature: 0 }
      })
    });
    const json = await res.json();
    if (!res.ok) return '';
    return ((json?.candidates?.[0]?.content?.parts?.[0]?.text) || '').trim();
  }

  function appendText(text: string) {
    if (!text) return;
    if (transcript && !transcript.endsWith(' ')) transcript += ' ';
    transcript += text;
  }

  // Factory that creates an onstop handler — exactly as in voice-test Mode A
  const makeOnStop = () => async () => {
    const b = new Blob(chunks, { type: mimeType });
    chunks = [];
    try { appendText(await sliceToText(b)); } catch {}
    if (recState === 'recording') {
      const newMr = new MediaRecorder(stream!, { mimeType });
      newMr.ondataavailable = (e: any) => { if (e.data.size > 0) chunks.push(e.data); };
      newMr.onstop = makeOnStop();
      mr = newMr;
      mr.start();
      setTimeout(() => { if (recState === 'recording') mr?.stop(); }, 3000);
    }
  };

  async function startRecording() {
    if (recState !== 'idle') return;
    transcript = '';
    chunks = [];
    try {
      stream   = await navigator.mediaDevices.getUserMedia({ audio: true });
      mimeType = pickMime();
      mr       = new MediaRecorder(stream, { mimeType });
      mr.ondataavailable = (e: any) => { if (e.data.size > 0) chunks.push(e.data); };
      mr.onstop = makeOnStop();
      mr.start();
      recState = 'recording';
      startWave();
      setTimeout(() => { if (recState === 'recording') mr?.stop(); }, 3000);
    } catch (e: any) {
      console.error('Mic error:', e);
    }
  }

  async function stopAndStructure() {
    if (recState === 'idle') return;
    // Set idle FIRST — onstop checks this and won't restart
    recState = 'idle';
    stopWave();
    // Grab any partial chunks before stopping
    const finalChunks = [...chunks];
    chunks = [];  // clear so onstop sees empty blob (won't try to retranscribe)
    try { mr?.stop(); } catch {}
    stream?.getTracks().forEach(t => t.stop());
    mr = null;
    stream = null;
    // Transcribe the remaining partial slice directly
    if (finalChunks.length > 0) {
      const blob = new Blob(finalChunks, { type: mimeType });
      try { appendText(await sliceToText(blob)); } catch {}
    }
    rawTranscript = transcript;
    if (!rawTranscript.trim()) return;
    step = 'structuring';
    await runExtraction(rawTranscript);
  }

  async function runExtraction(text: string) {
    extractError = '';
    try {
      extracted = await extractClientFields(text, REST_URL);
      fillFormFromExtraction(extracted);
      step = 'review';
    } catch (e: any) {
      extractError = e.message;
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

  // ─── Skip to manual form ─────────────────────────────────────────────────
  function skipToManual() {
    recState = 'idle';
    try { mr?.stop(); } catch {}
    stream?.getTracks().forEach(t => t.stop());
    mr = null; stream = null;
    stopWave();
    step = 'review';
  }

  // ─── Close ───────────────────────────────────────────────────────────────
  function closeModal() {
    recState = 'idle';
    try { mr?.stop(); } catch {}
    stream?.getTracks().forEach(t => t.stop());
    mr = null; stream = null;
    stopWave();
    dispatch('close');
  }

  onDestroy(() => {
    recState = 'idle';
    try { mr?.stop(); } catch {}
    stream?.getTracks().forEach(t => t.stop());
    mr = null; stream = null;
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
          class:orb-idle={recState === 'idle'}
          class:orb-listening={recState === 'recording'}
        >
          {#if recState === 'recording'}
            <div class="orb-ring ring-1"></div>
            <div class="orb-ring ring-2"></div>
          {/if}
          <button
            class="orb-btn"
            class:orb-btn-recording={recState === 'recording'}
            on:click={() => recState === 'idle' ? startRecording() : stopAndStructure()}
            aria-label={recState === 'recording' ? 'Stop recording' : 'Start recording'}
          >
            {#if recState === 'idle'}
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
        {#if recState === 'recording'}
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
        <div class="capture-transcript" class:has-text={transcript.length > 0}>
          {#if transcript}
            <span class="transcript-committed">{transcript}</span>
          {:else if recState === 'idle'}
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
          {#if recState === 'recording' && transcript.trim()}
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

        {#if rawTranscript}
          <div class="structuring-transcript">{rawTranscript.slice(0, 160)}{rawTranscript.length > 160 ? '…' : ''}</div>
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
          <button class="btn-back" on:click={() => { step = 'capture'; transcript = ''; rawTranscript = ''; }}>
            ← Re-record
          </button>
          <button class="btn-create" on:click={handleSubmit} disabled={submitting || !email.trim()}>
            {#if submitting}
              <span class="btn-spin"></span>
              <span>Creating…</span>
            {:else}
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M2.5 8.5L6.5 12.5L13.5 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              <span>Create Client</span>
            {/if}
          </button>
        </div>

      </div>
    {/if}

  </div>
</div>

<!-- ─────────────────────────────── STYLES ──────────────────────────────────── -->
<style>
  /* ── Design tokens (light theme) ── */
  /* bg:           #ffffff / #f9f9fd  */
  /* surface-2:    #f3f3fa            */
  /* border:       #e2e2ee            */
  /* text-primary: #12122a            */
  /* text-muted:   #6666a0            */
  /* text-hint:    #a0a0c0            */
  /* brand:        #7c3aed            */

  /* ── Overlay ── */
  .acm-overlay {
    position: fixed; inset: 0;
    background: rgba(20,10,50,.45);
    z-index: 1000;
    display: flex; align-items: center; justify-content: center;
    padding: 1rem;
    backdrop-filter: blur(6px);
  }

  .acm-shell {
    background: #ffffff;
    border: 1px solid #e2e2ee;
    border-radius: 20px;
    width: 100%; max-width: 680px;
    max-height: 92vh;
    display: flex; flex-direction: column;
    overflow: hidden;
    box-shadow: 0 20px 60px rgba(20,10,50,.18), 0 2px 8px rgba(20,10,50,.08);
    position: relative;
    transition: max-width .3s;
  }
  .capture-mode { max-width: 460px; }

  /* ── Close ── */
  .acm-x {
    position: absolute; top: .9rem; right: .9rem; z-index: 10;
    background: #f3f3fa; border: 1px solid #e2e2ee;
    color: #8888b0; width: 30px; height: 30px; border-radius: 50%;
    font-size: .8rem; cursor: pointer; display: flex;
    align-items: center; justify-content: center; line-height: 1;
    transition: background .15s, color .15s;
  }
  .acm-x:hover { background: #eaeaf5; color: #12122a; }

  /* ══════════ CAPTURE STEP ══════════ */
  .capture-wrap {
    display: flex; flex-direction: column; align-items: center;
    padding: 2.5rem 2rem 2rem;
    gap: 1.25rem;
    min-height: 480px;
    background: #ffffff;
  }

  .capture-title { text-align: center; }
  .capture-title h2 { margin: 0; font-size: 1.5rem; font-weight: 700; color: #12122a; }
  .capture-sub { margin: .3rem 0 0; font-size: .87rem; color: #6666a0; }

  /* Orb */
  .orb-wrap { position: relative; display: flex; align-items: center; justify-content: center; }

  .orb-ring {
    position: absolute; border-radius: 50%;
    border: 1.5px solid rgba(124,58,237,.3);
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
    border: 2px solid #d4c4fb;
    background: #f3effe;
    color: #7c3aed;
    cursor: pointer;
    display: flex; flex-direction: column; align-items: center;
    justify-content: center; gap: .25rem;
    transition: background .2s, border-color .2s, transform .15s, box-shadow .2s;
  }
  .orb-btn:hover { background: #ece4fd; border-color: #7c3aed; transform: scale(1.04); }
  .orb-btn:active { transform: scale(.97); }
  .orb-btn-recording {
    background: #fff1f1;
    border-color: #f87171;
    color: #dc2626;
    box-shadow: 0 0 24px rgba(248,113,113,.2);
  }
  .orb-label { font-size: .72rem; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; }

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
    opacity: .8;
  }
  .waveform-idle .wave-bar { height: 4px !important; opacity: .18; }

  /* Transcript */
  .capture-transcript {
    width: 100%; max-width: 380px;
    min-height: 80px; max-height: 160px;
    overflow-y: auto;
    background: #f9f9fd;
    border: 1px solid #e2e2ee;
    border-radius: 10px;
    padding: .75rem 1rem;
    font-size: .93rem; line-height: 1.65;
    color: #12122a;
  }
  .transcript-committed { color: #12122a; }
  .transcript-interim   { color: #9090c0; font-style: italic; }
  .transcript-placeholder { color: #c0c0da; font-size: .82rem; line-height: 1.6; }

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
    box-shadow: 0 3px 12px rgba(124,58,237,.3);
  }
  .btn-structure:hover { background: #6d28d9; }
  .btn-skip {
    background: none; border: none;
    color: #9090b8; font-size: .8rem;
    cursor: pointer; text-decoration: underline;
    text-underline-offset: 3px;
  }
  .btn-skip:hover { color: #5555a0; }

  /* ══════════ STRUCTURING STEP ══════════ */
  .structuring-wrap {
    display: flex; flex-direction: column; align-items: center;
    padding: 3.5rem 2rem;
    gap: 1.25rem; min-height: 400px;
    justify-content: center;
    background: #ffffff;
  }

  .structuring-orb {
    position: relative; width: 90px; height: 90px;
    display: flex; align-items: center; justify-content: center;
  }
  .s-ring {
    position: absolute; border-radius: 50%;
    border: 1.5px solid rgba(124,58,237,.25);
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

  .structuring-title { margin: 0; font-size: 1.4rem; font-weight: 700; color: #12122a; }
  .structuring-sub   { margin: 0; font-size: .85rem; color: #6666a0; }
  .structuring-transcript {
    margin-top: .5rem;
    max-width: 340px;
    background: #f3f3fa;
    border: 1px solid #e2e2ee;
    border-radius: 8px;
    padding: .6rem .9rem;
    font-size: .8rem; color: #6666a0;
    text-align: center; line-height: 1.5;
    font-style: italic;
  }

  /* ══════════ REVIEW STEP ══════════ */
  .review-wrap {
    display: flex; flex-direction: column;
    max-height: 92vh;
    overflow: hidden;
    background: #ffffff;
  }

  .review-header {
    display: flex; align-items: flex-start;
    justify-content: space-between; flex-wrap: wrap;
    gap: .5rem;
    padding: 1.25rem 1.5rem;
    border-bottom: 1px solid #e8e8f2;
    flex-shrink: 0;
    background: #fafafe;
  }
  .review-header h2 { margin: 0; font-size: 1.1rem; color: #12122a; font-weight: 700; }
  .review-sub { margin: .2rem 0 0; font-size: .8rem; color: #6666a0; }
  .review-sub strong { color: #7c3aed; }
  .review-sub-err { color: #dc2626; }

  .transcript-details summary {
    font-size: .75rem; color: #9090b8; cursor: pointer;
  }
  .transcript-details[open] summary { color: #6666a0; }
  .transcript-detail-body {
    margin-top: .4rem;
    font-size: .78rem; color: #6666a0; line-height: 1.55;
    max-height: 120px; overflow-y: auto;
  }

  .review-body {
    overflow-y: auto; flex: 1;
    padding: 1rem 1.5rem;
    display: flex; flex-direction: column; gap: .65rem;
    background: #ffffff;
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
    font-size: .72rem; color: #5555a0; font-weight: 700;
    text-transform: uppercase; letter-spacing: .05em;
  }
  label.acm-required { color: #7c3aed; }

  /* AI-filled highlight */
  label.ai-filled input,
  label.ai-filled select,
  label.ai-filled textarea {
    border-color: #059669;
    background: #f0fdf8;
    animation: ai-glow .8s ease both;
  }
  @keyframes ai-glow {
    0%   { box-shadow: 0 0 0 3px rgba(5,150,105,.2); }
    100% { box-shadow: none; }
  }

  input, select, textarea {
    background: #f9f9fd;
    border: 1px solid #d8d8ec;
    border-radius: 8px; color: #12122a;
    padding: .46rem .72rem; font-size: .88rem;
    outline: none; transition: border-color .15s, box-shadow .15s;
    font-family: inherit;
  }
  input::placeholder, textarea::placeholder { color: #b0b0cc; }
  input:focus, select:focus, textarea:focus {
    border-color: #7c3aed;
    box-shadow: 0 0 0 3px rgba(124,58,237,.12);
  }
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
    font-size: .72rem; color: #9090b8; font-weight: 700;
    text-transform: uppercase; letter-spacing: .05em;
  }
  .cf-row { display: flex; gap: .45rem; align-items: center; }
  .cf-key { flex: 1; min-width: 0; }
  .cf-val { flex: 2; min-width: 0; }
  .cf-del {
    flex-shrink: 0; width: 28px; height: 28px;
    background: #fff5f5;
    border: 1px solid #fecaca;
    border-radius: 8px; color: #dc2626;
    font-size: 1rem; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    transition: background .15s;
  }
  .cf-del:hover { background: #fee2e2; }
  .btn-add-cf {
    background: none; border: 1px dashed #c8c8e8;
    color: #9090b8; border-radius: 8px;
    padding: .3rem .9rem; font-size: .78rem;
    cursor: pointer; width: fit-content;
    transition: border-color .15s, color .15s;
  }
  .btn-add-cf:hover { border-color: #7c3aed; color: #7c3aed; }
  .btn-add-cf-empty { width: 100%; text-align: center; padding: .5rem; }

  /* Footer */
  .review-footer {
    display: flex; align-items: center;
    justify-content: flex-end; gap: .65rem;
    padding: .9rem 1.5rem;
    border-top: 1px solid #e8e8f2;
    background: #fafafe;
    flex-shrink: 0;
  }
  .rfoot-error { flex: 1; font-size: .78rem; color: #dc2626; }
  .btn-back {
    padding: .48rem 1rem;
    background: #f3f3fa; border: 1px solid #d8d8ec;
    color: #5555a0; border-radius: 10px; cursor: pointer;
    font-size: .83rem; font-weight: 600;
    transition: background .15s, border-color .15s;
  }
  .btn-back:hover { background: #eaeaf5; border-color: #b8b8e0; color: #12122a; }

  /* ── Create button — light theme ── */
  .btn-create {
    display: inline-flex; align-items: center; gap: .45rem;
    padding: .58rem 1.5rem;
    background: #ffffff;
    color: #5b21b6;
    border: 1.5px solid #7c3aed;
    border-radius: 10px;
    font-size: .88rem; font-weight: 700;
    letter-spacing: .025em;
    cursor: pointer;
    box-shadow: 0 2px 10px rgba(124,58,237,.15), inset 0 1px 0 rgba(255,255,255,.8);
    transition: background .15s, box-shadow .2s, transform .1s, border-color .15s, color .15s;
  }
  .btn-create:hover:not(:disabled) {
    background: #f3effe;
    border-color: #5b21b6;
    color: #4c1d95;
    box-shadow: 0 4px 18px rgba(124,58,237,.25);
    transform: translateY(-1px);
  }
  .btn-create:active:not(:disabled) { transform: translateY(0); background: #ece4fd; }
  .btn-create:disabled { opacity: .4; cursor: not-allowed; box-shadow: none; }

  /* Spinner for loading state */
  .btn-spin {
    display: inline-block;
    width: 13px; height: 13px;
    border: 2px solid rgba(124,58,237,.25);
    border-top-color: #7c3aed;
    border-radius: 50%;
    animation: btn-rotate .65s linear infinite;
    flex-shrink: 0;
  }
  @keyframes btn-rotate { to { transform: rotate(360deg); } }
</style>
