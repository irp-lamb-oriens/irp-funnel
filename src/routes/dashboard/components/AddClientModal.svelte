<script lang="ts">
  import { createEventDispatcher, onDestroy, tick } from 'svelte';
  import { authToken } from '../store.ts';
  import { extractClientFields, type ClientFieldExtraction } from '../../../lib/voice/extractClientFields.js';

  const dispatch = createEventDispatcher<{ created: { docId: string }; close: void }>();

  const API_URL  = import.meta.env.VITE_API_URL || 'http://localhost:8000';
  const GEM_KEY  = import.meta.env.VITE_GEMINI_API_KEY as string;
  const MODEL    = 'gemini-flash-latest';
  const REST_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEM_KEY}`;
  const PROMPT   = 'Transcribe the audio verbatim. Output ONLY the spoken words with natural punctuation and capitalization. No commentary, no filler.';

  // ─────────────────────────────────────────────────────────────────────────
  // STEP MACHINE
  // capture+transcript merged → 'dictate'
  // ─────────────────────────────────────────────────────────────────────────
  type Step = 'dictate' | 'structuring' | 'review';
  let step: Step = 'dictate';

  // ─────────────────────────────────────────────────────────────────────────
  // RECORDING — continuous single-take (no 3-second slicing)
  // ─────────────────────────────────────────────────────────────────────────
  type RecState = 'idle' | 'recording';
  let recState: RecState = 'idle';

  let mr:       MediaRecorder | null = null;
  let stream:   MediaStream   | null = null;
  let chunks:   Blob[]               = [];
  let mimeType  = '';

  // Dictation pad — persistent editable textarea that accumulates all takes
  let padText        = '';          // the persistent text content
  let insertPos      = 0;           // cursor position in padText (tracked on blur/keyup)
  let transcribing   = false;       // true while Gemini call is in flight after stop
  let padTextareaEl: HTMLTextAreaElement;

  // Web Speech interim ghost caption (not stored, purely visual)
  let interimPreview = '';
  let speechRec: any = null;

  // rawTranscript fed into extraction step
  let rawTranscript = '';

  // ─────────────────────────────────────────────────────────────────────────
  // WEB AUDIO — Real-frequency visualizer via AnalyserNode
  // ─────────────────────────────────────────────────────────────────────────
  const BARS = 28;
  let waveHeights: number[] = Array(BARS).fill(4);
  let audioCtx:  AudioContext | null = null;
  let analyser:  AnalyserNode | null = null;
  let freqBuf:   Uint8Array;
  let animId     = 0;

  function startVisualizer(micStream: MediaStream) {
    try {
      audioCtx = new AudioContext();
      const src = audioCtx.createMediaStreamSource(micStream);
      analyser  = audioCtx.createAnalyser();
      analyser.fftSize               = 128;  // 64 bins
      analyser.smoothingTimeConstant = 0.78;
      freqBuf = new Uint8Array(analyser.frequencyBinCount);
      src.connect(analyser);
      rafTick();
    } catch {}
  }

  function rafTick() {
    animId = requestAnimationFrame(rafTick);
    if (!analyser) return;
    analyser.getByteFrequencyData(freqBuf);
    // bins 2–29 cover roughly 100–3400 Hz (speech range)
    const raw = Array.from(freqBuf).slice(2, 2 + BARS);
    waveHeights = raw.map(v => 5 + (v / 255) * 95);
  }

  function stopVisualizer() {
    cancelAnimationFrame(animId);
    animId = 0;
    try { audioCtx?.close(); } catch {}
    audioCtx = null;
    analyser = null;
    waveHeights = Array(BARS).fill(4);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // WEB SPEECH — Live interim ghost caption only (discarded on stop)
  // ─────────────────────────────────────────────────────────────────────────
  function startLivePreview() {
    const Ctor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!Ctor) return;
    speechRec = new Ctor();
    speechRec.continuous     = true;
    speechRec.interimResults = true;
    speechRec.lang           = 'en-US';
    speechRec.onresult = (e: any) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (!e.results[i].isFinal) interim += e.results[i][0].transcript;
      }
      interimPreview = interim;
    };
    speechRec.onend = () => {
      if (recState === 'recording') { try { speechRec?.start(); } catch {} }
    };
    try { speechRec.start(); } catch {}
  }

  function stopLivePreview() {
    try { speechRec?.stop(); } catch {}
    speechRec = null;
    interimPreview = '';
  }

  // ─────────────────────────────────────────────────────────────────────────
  // AUDIO HELPERS
  // ─────────────────────────────────────────────────────────────────────────
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

  // ─────────────────────────────────────────────────────────────────────────
  // RECORDING CONTROLS — continuous single-take, no slicing
  // ─────────────────────────────────────────────────────────────────────────
  async function startRecording() {
    if (recState !== 'idle') return;
    interimPreview = '';
    chunks = [];
    try {
      stream   = await navigator.mediaDevices.getUserMedia({ audio: true });
      mimeType = pickMime();
      mr       = new MediaRecorder(stream, { mimeType });
      mr.ondataavailable = (e: any) => { if (e.data.size > 0) chunks.push(e.data); };
      // No onstop that restarts — just plain accumulation
      mr.start();
      recState = 'recording';
      startVisualizer(stream);
      startLivePreview();
    } catch (e: any) {
      console.error('Mic error:', e);
    }
  }

  async function stopRecording() {
    if (recState === 'idle') return;
    recState = 'idle';
    stopVisualizer();
    stopLivePreview();

    // Capture insert position BEFORE any async work
    const pos = insertPos;
    const allChunks = [...chunks];
    chunks = [];

    try { mr?.stop(); } catch {}
    stream?.getTracks().forEach(t => t.stop());
    mr = null; stream = null;

    if (allChunks.length === 0) return;

    transcribing = true;
    try {
      const blob = new Blob(allChunks, { type: mimeType });
      const text = (await sliceToText(blob)).trim();
      if (text) {
        // Insert at cursor position, preserving content before and after
        const before = padText.slice(0, pos);
        const after  = padText.slice(pos);
        const spaceBefore = before.length > 0 && !/[\s\n]$/.test(before) ? ' ' : '';
        const spaceAfter  = after.length  > 0 && !/^[\s\n]/.test(after)  ? ' ' : '';
        padText = before + spaceBefore + text + spaceAfter + after;
        const newCursor = pos + spaceBefore.length + text.length;

        // Move textarea cursor to end of inserted text
        await tick();
        if (padTextareaEl) {
          padTextareaEl.selectionStart = newCursor;
          padTextareaEl.selectionEnd   = newCursor;
          padTextareaEl.focus();
          insertPos = newCursor;
        }
      }
    } catch {}
    transcribing = false;
  }

  function trackCursor() {
    if (padTextareaEl) insertPos = padTextareaEl.selectionStart ?? padText.length;
  }

  async function goStructure() {
    rawTranscript = padText.trim();
    if (!rawTranscript) return;
    step = 'structuring';
    await runExtraction(rawTranscript);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // TYPE-IN ANIMATION
  // ─────────────────────────────────────────────────────────────────────────
  async function typeIn(setter: (v: string) => void, text: string, ms = 16): Promise<void> {
    setter('');
    for (let i = 1; i <= text.length; i++) {
      await new Promise<void>(r => setTimeout(r, ms));
      setter(text.slice(0, i));
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // EXTRACTION + FORM FILL
  // ─────────────────────────────────────────────────────────────────────────
  let extracted: ClientFieldExtraction | null = null;
  let extractError = '';
  let aiFilledFields: Set<string> = new Set();

  async function runExtraction(text: string) {
    extractError = '';
    try {
      extracted = await extractClientFields(text, REST_URL);
      step = 'review';                         // show form first
      await fillFormAnimated(extracted);       // then type-in
    } catch (e: any) {
      extractError = (e as Error).message;
      step = 'review';
    }
  }

  async function fillFormAnimated(f: ClientFieldExtraction) {
    aiFilledFields = new Set();
    const STAGGER = 70;
    const CHAR_MS = 14;

    type Entry = { field: string; setter: (v: string) => void; val: string };
    const rows: Entry[] = [];

    const q = (field: string, setter: (v: string) => void, val: string | undefined) => {
      if (val?.trim()) {
        aiFilledFields = new Set([...aiFilledFields, field]);
        rows.push({ field, setter, val: val.trim() });
      }
    };

    q('name',               (v) => (name = v),               f.name);
    q('surname',            (v) => (surname = v),             f.surname);
    q('email',              (v) => (email = v),               f.email);
    q('phone',              (v) => (phone = v),               f.phone);
    q('originCountry',      (v) => (originCountry = v),       f.originCountry);
    q('originCity',         (v) => (originCity = v),          f.originCity);
    q('destinationCountry', (v) => (destinationCountry = v),  f.destinationCountry);
    q('destinationCity',    (v) => (destinationCity = v),     f.destinationCity);
    q('budget',             (v) => (budget = v),              f.budget);
    q('size',               (v) => (size = v),                f.size);
    q('immigrationStatus',  (v) => (immigrationStatus = v),   f.immigrationStatus);
    q('notes',              (v) => (notes = v),               f.notes);

    await Promise.all(
      rows.map(({ setter, val }, i) =>
        new Promise<void>(async (res) => {
          await new Promise<void>(r => setTimeout(r, i * STAGGER));
          await typeIn(setter, val, CHAR_MS);
          res();
        })
      )
    );

    customFieldRows = (Object.entries(f.customFields || {}) as [string, string][])
      .map(([key, value]) => ({ key, value }));
  }

  // ─────────────────────────────────────────────────────────────────────────
  // FORM STATE
  // ─────────────────────────────────────────────────────────────────────────
  let name = '', surname = '', email = '', phone = '';
  let originCountry = '', originCity = '';
  let destinationCountry = '', destinationCity = '';
  let budget = '', size = '', immigrationStatus = '', notes = '';
  let customFieldRows: { key: string; value: string }[] = [];

  function addCustomField()             { customFieldRows = [...customFieldRows, { key: '', value: '' }]; }
  function removeCustomField(i: number) { customFieldRows = customFieldRows.filter((_, x) => x !== i); }

  // ─────────────────────────────────────────────────────────────────────────
  // SUBMIT
  // ─────────────────────────────────────────────────────────────────────────
  let submitting  = false;
  let submitError = '';

  async function handleSubmit() {
    if (!email.trim()) { submitError = 'Email is required.'; return; }
    submitting = true; submitError = '';
    const cf: Record<string, string> = {};
    for (const { key, value } of customFieldRows)
      if (key.trim() && value.trim()) cf[key.trim()] = value.trim();
    try {
      const res = await fetch(`${API_URL}/api/dashboard/clients/manual`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-dashboard-token': $authToken || '' },
        body: JSON.stringify({
          name: name.trim(), surname: surname.trim(),
          email: email.trim().toLowerCase(), phone: phone.trim(),
          originCountry: originCountry.trim(), originCity: originCity.trim(),
          destinationCountry: destinationCountry.trim(), destinationCity: destinationCity.trim(),
          budget: budget.trim(), size: size.trim(),
          immigrationStatus: immigrationStatus.trim(), notes: notes.trim(),
          voiceTranscript: rawTranscript || undefined,
          customFields: Object.keys(cf).length ? cf : undefined,
        }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(e.error || 'Failed to create client.');
      }
      const data = await res.json();
      dispatch('created', { docId: data.docId });
    } catch (err: any) {
      submitError = (err as Error).message;
    } finally {
      submitting = false;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CLEANUP
  // ─────────────────────────────────────────────────────────────────────────
  function cleanup() {
    recState = 'idle';
    stopVisualizer();
    stopLivePreview();
    try { mr?.stop(); } catch {}
    stream?.getTracks().forEach(t => t.stop());
    mr = null; stream = null;
  }

  function skipToManual() { cleanup(); step = 'review'; }
  function closeModal()   { cleanup(); dispatch('close'); }
  onDestroy(cleanup);
</script>

<!-- ════════════════════════════════════════════════════════
     OVERLAY
════════════════════════════════════════════════════════ -->
<div class="acm-overlay" on:click|self={closeModal} role="dialog" aria-modal="true">
  <div class="acm-shell" class:dictate-mode={step === 'dictate'}>

    <button class="acm-x" on:click={closeModal} aria-label="Close">
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
        <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
      </svg>
    </button>

    <!-- ═══════════════════════════════════════════════════
         STEP 1 · DICTATE  (voice capture + editable pad in one)
    ═══════════════════════════════════════════════════ -->
    {#if step === 'dictate'}
      <div class="dictate-wrap">

        <div class="dictate-title">
          <h2>New Client</h2>
          <p class="dictate-sub">Speak — AI transcribes directly into the pad below</p>
        </div>

        <!-- Orb -->
        <div class="orb-wrap">
          {#if recState === 'recording'}
            <div class="orb-ring ring-1"></div>
            <div class="orb-ring ring-2"></div>
            <div class="orb-ring ring-3"></div>
          {/if}
          <button
            class="orb-btn"
            class:orb-btn-recording={recState === 'recording'}
            on:click={() => recState === 'idle' ? startRecording() : stopRecording()}
            aria-label={recState === 'recording' ? 'Stop' : 'Record'}
          >
            {#if recState === 'idle'}
              <svg width="36" height="36" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 1a4 4 0 0 1 4 4v6a4 4 0 0 1-8 0V5a4 4 0 0 1 4-4z"/>
                <path d="M19 10a7 7 0 0 1-14 0" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" fill="none"/>
                <line x1="12" y1="17" x2="12" y2="22" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                <line x1="9" y1="22" x2="15" y2="22" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
              </svg>
              <span class="orb-label">Record</span>
            {:else}
              <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <rect x="5" y="5" width="14" height="14" rx="2.5"/>
              </svg>
              <span class="orb-label">Stop</span>
            {/if}
          </button>
        </div>

        <!-- Real-frequency spectrum visualizer -->
        <div class="spectrum" class:spectrum-active={recState === 'recording'} aria-hidden="true">
          {#each waveHeights as h, i}
            <div
              class="spec-bar"
              style="height:{h}%;
                     background: hsl({260 + i * 2},{60 + (h/100)*30}%,{55 + (h/100)*15}%);
                     opacity:{recState === 'recording' ? 0.85 + (h/100)*0.15 : 0.15}"
            ></div>
          {/each}
        </div>

        <!-- Ghost caption: Web Speech interim (italic, dim — visual feedback only) -->
        {#if interimPreview && recState === 'recording'}
          <div class="ghost-caption" aria-hidden="true">{interimPreview}</div>
        {/if}

        <!-- Dictation pad: persistent editable textarea, accumulates all takes -->
        <div class="pad-wrap">
          <textarea
            bind:this={padTextareaEl}
            bind:value={padText}
            class="pad-editor"
            rows="6"
            spellcheck="true"
            placeholder={recState === 'recording'
              ? 'Recording… speak naturally'
              : 'e.g. "New client, John Smith, moving from Texas to Costa Rica in October, budget around fifteen thousand…"'}
            on:blur={trackCursor}
            on:keyup={trackCursor}
            on:click={trackCursor}
            on:mouseup={trackCursor}
          ></textarea>
          <div class="pad-meta">
            {#if transcribing}
              <span class="pad-transcribing">
                <span class="trans-dot"></span>Transcribing…
              </span>
            {:else}
              <span class="pad-char">{padText.length} chars</span>
            {/if}
          </div>
        </div>

        <!-- Footer actions -->
        <div class="dictate-footer">
          <button class="btn-skip" on:click={skipToManual}>✏️ Skip — type manually</button>
          {#if padText.trim()}
            <button class="btn-structure-now" on:click={goStructure} disabled={transcribing}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
                      stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              Structure with AI
            </button>
          {/if}
        </div>

      </div>
    {/if}

    <!-- ═══════════════════════════════════════════════════
         STEP 2 · STRUCTURING (AI processing)
    ═══════════════════════════════════════════════════ -->
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
          <div class="structuring-transcript">
            {rawTranscript.slice(0, 180)}{rawTranscript.length > 180 ? '…' : ''}
          </div>
        {/if}
      </div>
    {/if}

    <!-- ═══════════════════════════════════════════════════
         STEP 3 · REVIEW FORM (with type-in animation)
    ═══════════════════════════════════════════════════ -->
    {#if step === 'review'}
      <div class="review-wrap">

        <div class="review-header">
          <div>
            <h2>Review &amp; Create</h2>
            {#if extracted && !extractError}
              <p class="review-sub">✨ AI filled <strong>{aiFilledFields.size}</strong> field{aiFilledFields.size !== 1 ? 's' : ''}</p>
            {:else if extractError}
              <p class="review-sub review-sub-err">AI issue — fill manually</p>
            {:else}
              <p class="review-sub">Fill in the client details</p>
            {/if}
          </div>
          {#if rawTranscript}
            <details class="ts-details">
              <summary>📝 Transcript</summary>
              <div class="ts-detail-body">{rawTranscript}</div>
            </details>
          {/if}
        </div>

        <div class="review-body">

          <div class="acm-row" style="--i:0">
            <label class:ai-filled={aiFilledFields.has('name')}>
              First Name <input bind:value={name} placeholder="John" />
            </label>
            <label class:ai-filled={aiFilledFields.has('surname')}>
              Surname <input bind:value={surname} placeholder="Smith" />
            </label>
          </div>

          <div class="acm-row" style="--i:1">
            <label class="acm-required" class:ai-filled={aiFilledFields.has('email')}>
              Email * <input type="email" bind:value={email} placeholder="john@example.com" />
            </label>
            <label class:ai-filled={aiFilledFields.has('phone')}>
              Phone <input bind:value={phone} placeholder="+1 555 123 4567" />
            </label>
          </div>

          <div class="acm-row" style="--i:2">
            <label class:ai-filled={aiFilledFields.has('originCountry')}>
              Origin Country <input bind:value={originCountry} placeholder="United States" />
            </label>
            <label class:ai-filled={aiFilledFields.has('originCity')}>
              Origin City <input bind:value={originCity} placeholder="Austin, TX" />
            </label>
          </div>

          <div class="acm-row" style="--i:3">
            <label class:ai-filled={aiFilledFields.has('destinationCountry')}>
              Destination Country <input bind:value={destinationCountry} placeholder="Costa Rica" />
            </label>
            <label class:ai-filled={aiFilledFields.has('destinationCity')}>
              Destination City <input bind:value={destinationCity} placeholder="San José" />
            </label>
          </div>

          <div class="acm-row" style="--i:4">
            <label class:ai-filled={aiFilledFields.has('budget')}>
              Budget
              <select bind:value={budget}>
                <option value="">Unknown</option>
                <option>Under $5k</option><option>$5-10k</option>
                <option>$10-15k</option><option>$15-20k</option>
                <option>$20-30k</option><option>Over $30k</option>
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

        </div><!-- .review-body -->

        <div class="review-footer">
          {#if submitError}
            <div class="rfoot-error">{submitError}</div>
          {/if}
          <button class="btn-back"
            on:click={() => { step = 'dictate'; rawTranscript = ''; }}>
            ← Re-record
          </button>
          <button class="btn-create" on:click={handleSubmit} disabled={submitting || !email.trim()}>
            {#if submitting}
              <span class="btn-spin"></span><span>Creating…</span>
            {:else}
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M2.5 8.5L6.5 12.5L13.5 4" stroke="currentColor" stroke-width="2"
                      stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              <span>Create Client</span>
            {/if}
          </button>
        </div>

      </div>
    {/if}

  </div>
</div>

<!-- ════════════════════════════════════════════════════════
     STYLES
════════════════════════════════════════════════════════ -->
<style>
  /* ── Overlay ── */
  .acm-overlay {
    position: fixed; inset: 0;
    background: rgba(15, 8, 40, 0.55);
    z-index: 1000;
    display: flex; align-items: center; justify-content: center;
    padding: 1rem;
    backdrop-filter: blur(8px);
  }

  .acm-shell {
    background: #ffffff;
    border: 1px solid #e2e2ee;
    border-radius: 22px;
    width: 100%; max-width: 700px;
    max-height: 92vh;
    display: flex; flex-direction: column;
    overflow: hidden;
    box-shadow: 0 24px 72px rgba(15,8,40,.2), 0 2px 10px rgba(15,8,40,.08);
    position: relative;
    transition: max-width .35s cubic-bezier(.4,0,.2,1);
  }
  .dictate-mode { max-width: 520px; }

  /* Close */
  .acm-x {
    position: absolute; top: 1rem; right: 1rem; z-index: 10;
    background: #f3f3fa; border: 1px solid #e2e2ee;
    color: #8888b0; width: 32px; height: 32px; border-radius: 50%;
    cursor: pointer; display: flex; align-items: center; justify-content: center;
    transition: background .15s, color .15s, transform .15s;
  }
  .acm-x:hover { background: #eaeaf5; color: #12122a; transform: scale(1.1); }

  /* ═══ DICTATE ══════════════════════════════════════════════════════ */
  .dictate-wrap {
    display: flex; flex-direction: column; align-items: center;
    padding: 2.5rem 1.8rem 1.8rem; gap: 1.2rem;
    background: #ffffff;
    overflow-y: auto;
  }

  .dictate-title { text-align: center; }
  .dictate-title h2 { margin: 0; font-size: 1.6rem; font-weight: 800; color: #12122a;
                      letter-spacing: -.02em; }
  .dictate-sub { margin: .3rem 0 0; font-size: .88rem; color: #6666a0; }

  /* Orb */
  .orb-wrap {
    position: relative;
    display: flex; align-items: center; justify-content: center;
  }

  .orb-ring {
    position: absolute; border-radius: 50%;
    border: 1.5px solid rgba(124,58,237,.28);
    animation: orb-ring-pulse 2s ease-out infinite;
    pointer-events: none;
  }
  .ring-1 { width: 126px; height: 126px; animation-delay: 0s; }
  .ring-2 { width: 162px; height: 162px; animation-delay: .65s; }
  .ring-3 { width: 198px; height: 198px; animation-delay: 1.3s; }
  @keyframes orb-ring-pulse {
    0%   { transform: scale(.82); opacity: .75; }
    100% { transform: scale(1.18); opacity: 0; }
  }

  .orb-btn {
    position: relative; z-index: 1;
    width: 108px; height: 108px; border-radius: 50%;
    border: 2.5px solid #d4c4fb;
    background: linear-gradient(145deg, #f5f0ff 0%, #ece4fd 100%);
    color: #7c3aed;
    cursor: pointer;
    display: flex; flex-direction: column; align-items: center;
    justify-content: center; gap: .28rem;
    box-shadow: 0 6px 20px rgba(124,58,237,.15), inset 0 1px 0 rgba(255,255,255,.9);
    transition: background .2s, border-color .2s, transform .15s, box-shadow .2s;
  }
  .orb-btn:hover {
    background: linear-gradient(145deg, #ece4fd 0%, #ddd2fb 100%);
    border-color: #7c3aed;
    box-shadow: 0 10px 32px rgba(124,58,237,.28);
    transform: scale(1.05);
  }
  .orb-btn:active { transform: scale(.97); }
  .orb-btn-recording {
    background: linear-gradient(145deg, #fff6f6 0%, #ffe4e4 100%);
    border-color: #f87171;
    color: #dc2626;
    box-shadow: 0 6px 24px rgba(248,113,113,.25), inset 0 1px 0 rgba(255,255,255,.9);
  }
  .orb-label {
    font-size: .68rem; font-weight: 800;
    text-transform: uppercase; letter-spacing: .07em;
  }

  /* ── Real-frequency spectrum visualizer ── */
  .spectrum {
    display: flex; align-items: flex-end; justify-content: center;
    gap: 2px; width: 100%; max-width: 320px; height: 64px;
  }
  .spec-bar {
    width: 6px; border-radius: 3px 3px 2px 2px;
    transition: height .05s linear, opacity .1s;
    min-height: 3px;
  }
  .spectrum:not(.spectrum-active) .spec-bar {
    height: 4px !important;
    opacity: .12 !important;
    background: #a78bfa !important;
  }

  /* Ghost caption — Web Speech interim (visual feedback only) */
  .ghost-caption {
    width: 100%; max-width: 420px;
    font-size: .86rem; line-height: 1.55; color: #a0a0c8;
    font-style: italic; text-align: center;
    min-height: 1.6em;
    padding: 0 .5rem;
    animation: fade-in .15s ease;
  }
  @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }

  /* Dictation pad */
  .pad-wrap { width: 100%; max-width: 440px; }
  .pad-editor {
    width: 100%; resize: vertical;
    background: #f9f9fd; border: 1px solid #d8d8ec; border-radius: 12px;
    color: #12122a; padding: .85rem 1rem; font-size: .92rem; line-height: 1.7;
    font-family: inherit; outline: none; box-sizing: border-box;
    transition: border-color .15s, box-shadow .15s;
  }
  .pad-editor:focus { border-color: #7c3aed; box-shadow: 0 0 0 3px rgba(124,58,237,.1); }
  .pad-meta {
    display: flex; align-items: center; gap: .4rem;
    margin-top: .28rem; min-height: 1.2em;
  }
  .pad-char { font-size: .72rem; color: #a0a0c0; margin-left: auto; }

  /* Transcribing spinner */
  .pad-transcribing {
    display: inline-flex; align-items: center; gap: .42rem;
    font-size: .78rem; color: #7c3aed; font-weight: 700;
    margin-left: auto;
  }
  .trans-dot {
    display: inline-block; width: 8px; height: 8px;
    border: 1.5px solid rgba(124,58,237,.3); border-top-color: #7c3aed;
    border-radius: 50%; animation: btn-rotate .65s linear infinite; flex-shrink: 0;
  }

  /* Dictate footer */
  .dictate-footer {
    display: flex; align-items: center; justify-content: space-between;
    gap: .8rem; width: 100%; max-width: 440px;
    flex-wrap: wrap;
  }

  /* Structure with AI — hero CTA */
  .btn-structure-now {
    display: inline-flex; align-items: center; gap: .55rem;
    padding: .72rem 1.8rem;
    background: linear-gradient(135deg, #7c3aed 0%, #5b21b6 55%, #4c1d95 100%);
    color: #fff;
    border: 1px solid rgba(167,139,250,.35);
    border-radius: 14px;
    font-size: .95rem; font-weight: 800; letter-spacing: .03em;
    cursor: pointer;
    box-shadow: 0 6px 24px rgba(124,58,237,.35), inset 0 1px 0 rgba(255,255,255,.18);
    transition: box-shadow .2s, transform .12s, filter .15s;
  }
  .btn-structure-now:hover:not(:disabled) {
    box-shadow: 0 10px 36px rgba(124,58,237,.52);
    filter: brightness(1.1);
    transform: translateY(-2px);
  }
  .btn-structure-now:active:not(:disabled) { transform: translateY(0); }
  .btn-structure-now:disabled { opacity: .4; cursor: not-allowed; box-shadow: none; filter: none; }

  .btn-skip {
    background: none; border: none;
    color: #9090b8; font-size: .8rem;
    cursor: pointer; text-decoration: underline; text-underline-offset: 4px;
  }
  .btn-skip:hover { color: #5555a0; }

  /* ═══ STRUCTURING ══════════════════════════════════════════════════ */
  .structuring-wrap {
    display: flex; flex-direction: column; align-items: center;
    padding: 4rem 2rem; gap: 1.3rem; min-height: 420px;
    justify-content: center; background: #ffffff;
  }
  .structuring-orb {
    position: relative; width: 96px; height: 96px;
    display: flex; align-items: center; justify-content: center;
  }
  .s-ring {
    position: absolute; border-radius: 50%;
    border: 1.5px solid rgba(124,58,237,.22);
    animation: s-expand 2s ease-out infinite;
  }
  .s-ring-1 { width: 96px;  height: 96px;  animation-delay: 0s; }
  .s-ring-2 { width: 128px; height: 128px; animation-delay: .6s; }
  .s-ring-3 { width: 160px; height: 160px; animation-delay: 1.2s; }
  @keyframes s-expand {
    0%   { transform: scale(.7); opacity: .8; }
    100% { transform: scale(1.25); opacity: 0; }
  }
  .s-icon { font-size: 2.6rem; z-index: 1; animation: s-spin 3s linear infinite; }
  @keyframes s-spin { to { transform: rotate(360deg); } }
  .structuring-title { margin: 0; font-size: 1.45rem; font-weight: 800; color: #12122a; }
  .structuring-sub   { margin: 0; font-size: .86rem; color: #6666a0; }
  .structuring-transcript {
    max-width: 360px; background: #f3f3fa; border: 1px solid #e2e2ee;
    border-radius: 10px; padding: .65rem 1rem;
    font-size: .8rem; color: #6666a0; text-align: center; line-height: 1.55; font-style: italic;
  }

  /* ═══ REVIEW FORM ══════════════════════════════════════════════════ */
  .review-wrap {
    display: flex; flex-direction: column; max-height: 92vh; overflow: hidden;
    background: #ffffff;
  }
  .review-header {
    display: flex; align-items: flex-start; justify-content: space-between;
    flex-wrap: wrap; gap: .5rem;
    padding: 1.3rem 1.6rem;
    border-bottom: 1px solid #e8e8f2;
    background: #fafafe; flex-shrink: 0;
  }
  .review-header h2 { margin: 0; font-size: 1.15rem; font-weight: 800; color: #12122a; }
  .review-sub { margin: .2rem 0 0; font-size: .8rem; color: #6666a0; }
  .review-sub strong { color: #7c3aed; }
  .review-sub-err { color: #dc2626; }

  .ts-details summary { font-size: .75rem; color: #9090b8; cursor: pointer; }
  .ts-details[open] summary { color: #6666a0; }
  .ts-detail-body {
    margin-top: .4rem; font-size: .78rem; color: #6666a0; line-height: 1.55;
    max-height: 110px; overflow-y: auto;
  }

  .review-body {
    overflow-y: auto; flex: 1;
    padding: 1.1rem 1.6rem; display: flex; flex-direction: column; gap: .7rem;
    background: #ffffff;
  }

  /* Grid rows with stagger animation */
  .acm-row {
    display: grid; grid-template-columns: 1fr 1fr; gap: .7rem;
    animation: row-in .35s ease both;
    animation-delay: calc(var(--i, 0) * 50ms);
  }
  .acm-row-full { grid-template-columns: 1fr; }
  @media (max-width: 480px) { .acm-row { grid-template-columns: 1fr; } }
  @keyframes row-in {
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  label {
    display: flex; flex-direction: column; gap: .3rem;
    font-size: .71rem; font-weight: 800; color: #5555a0;
    text-transform: uppercase; letter-spacing: .055em;
  }
  label.acm-required { color: #7c3aed; }

  /* AI type-in green glow */
  label.ai-filled input,
  label.ai-filled select,
  label.ai-filled textarea {
    border-color: #059669;
    background: #f0fdf8;
    animation: ai-glow .9s ease both;
  }
  @keyframes ai-glow {
    0%   { box-shadow: 0 0 0 3px rgba(5,150,105,.22); }
    100% { box-shadow: none; }
  }

  input, select, textarea {
    background: #f9f9fd; border: 1px solid #d8d8ec; border-radius: 8px;
    color: #12122a; padding: .48rem .76rem; font-size: .88rem;
    outline: none; font-family: inherit;
    transition: border-color .15s, box-shadow .15s;
  }
  input::placeholder, textarea::placeholder { color: #b8b8d0; }
  input:focus, select:focus, textarea:focus {
    border-color: #7c3aed;
    box-shadow: 0 0 0 3px rgba(124,58,237,.11);
  }
  textarea { resize: vertical; min-height: 72px; }

  /* Custom fields */
  .custom-fields-section {
    animation: row-in .35s ease both;
    animation-delay: calc(var(--i, 7) * 50ms);
    display: flex; flex-direction: column; gap: .48rem; padding-top: .25rem;
  }
  .custom-fields-header { display: flex; align-items: center; justify-content: space-between; }
  .custom-fields-label {
    font-size: .71rem; font-weight: 800; color: #9090b8;
    text-transform: uppercase; letter-spacing: .055em;
  }
  .cf-row { display: flex; gap: .48rem; align-items: center; }
  .cf-key { flex: 1; min-width: 0; }
  .cf-val { flex: 2; min-width: 0; }
  .cf-del {
    flex-shrink: 0; width: 28px; height: 28px; background: #fff5f5;
    border: 1px solid #fecaca; border-radius: 7px; color: #dc2626;
    font-size: 1rem; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    transition: background .15s;
  }
  .cf-del:hover { background: #fee2e2; }
  .btn-add-cf {
    background: none; border: 1px dashed #c8c8e8; color: #9090b8;
    border-radius: 8px; padding: .3rem .9rem; font-size: .78rem;
    cursor: pointer; width: fit-content;
    transition: border-color .15s, color .15s;
  }
  .btn-add-cf:hover { border-color: #7c3aed; color: #7c3aed; }
  .btn-add-cf-empty { width: 100%; text-align: center; padding: .5rem; }

  /* Footer */
  .review-footer {
    display: flex; align-items: center; justify-content: flex-end; gap: .7rem;
    padding: 1rem 1.6rem;
    border-top: 1px solid #e8e8f2;
    background: #fafafe; flex-shrink: 0;
  }
  .rfoot-error { flex: 1; font-size: .78rem; color: #dc2626; }

  .btn-back {
    padding: .5rem 1.1rem;
    background: #f3f3fa; border: 1px solid #d8d8ec;
    color: #5555a0; border-radius: 10px; cursor: pointer;
    font-size: .83rem; font-weight: 700;
    transition: background .15s, border-color .15s;
  }
  .btn-back:hover { background: #eaeaf5; border-color: #b8b8e0; color: #12122a; }

  /* Create Client — light theme */
  .btn-create {
    display: inline-flex; align-items: center; gap: .45rem;
    padding: .58rem 1.5rem;
    background: #ffffff; color: #5b21b6;
    border: 1.5px solid #7c3aed; border-radius: 10px;
    font-size: .88rem; font-weight: 800; letter-spacing: .025em;
    cursor: pointer;
    box-shadow: 0 2px 10px rgba(124,58,237,.15);
    transition: background .15s, box-shadow .2s, transform .1s, border-color .15s, color .15s;
  }
  .btn-create:hover:not(:disabled) {
    background: #f3effe; border-color: #5b21b6; color: #4c1d95;
    box-shadow: 0 4px 18px rgba(124,58,237,.25);
    transform: translateY(-1px);
  }
  .btn-create:active:not(:disabled) { transform: translateY(0); background: #ece4fd; }
  .btn-create:disabled { opacity: .4; cursor: not-allowed; box-shadow: none; }

  .btn-spin {
    display: inline-block; width: 13px; height: 13px;
    border: 2px solid rgba(124,58,237,.25); border-top-color: #7c3aed;
    border-radius: 50%; animation: btn-rotate .65s linear infinite; flex-shrink: 0;
  }
  @keyframes btn-rotate { to { transform: rotate(360deg); } }
</style>
