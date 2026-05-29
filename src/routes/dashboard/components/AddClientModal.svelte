<script lang="ts">
  import { createEventDispatcher, onDestroy, onMount, tick } from 'svelte';
  import { authToken } from '../store.ts';
  import type { ClientFieldExtraction } from '../../../lib/voice/extractClientFields.js';


  const dispatch = createEventDispatcher<{ created: { docId: string }; close: void }>();

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

  // Transcription + extraction both run server-side via the dashboard API
  // (no CORS, keys stay on the server, OpenRouter→Gemini→scraper fallback).
  const TRANSCRIBE_URL = `${API_URL}/api/dashboard/voice-transcribe`;
  const EXTRACT_URL    = `${API_URL}/api/dashboard/extract-client-fields`;


  // ── Field schema — single source of truth ────────────────────────────
  type FieldDef = {
    key: string;
    label: string;
    type: 'text' | 'email' | 'select' | 'textarea';
    placeholder?: string;
    options?: string[];
    required?: boolean;
  };

  const FIELDS: FieldDef[] = [
    { key: 'name',               label: 'First Name',         type: 'text',     placeholder: 'John' },
    { key: 'surname',            label: 'Surname',            type: 'text',     placeholder: 'Smith' },
    { key: 'email',              label: 'Email',              type: 'email',    placeholder: 'john@example.com', required: true },
    { key: 'phone',              label: 'Phone',              type: 'text',     placeholder: '+1 555 123 4567' },
    { key: 'originCountry',      label: 'Origin Country',     type: 'text',     placeholder: 'United States' },
    { key: 'originCity',         label: 'Origin City',        type: 'text',     placeholder: 'Austin, TX' },
    { key: 'destinationCountry', label: 'Destination Country', type: 'text',    placeholder: 'Costa Rica' },
    { key: 'destinationCity',    label: 'Destination City',   type: 'text',     placeholder: 'San José' },
    { key: 'budget',             label: 'Budget',             type: 'select',   options: ['Under $5k','$5-10k','$10-15k','$15-20k','$20-30k','Over $30k'] },
    { key: 'size',               label: 'Move Size',          type: 'select',   options: ['LCL / Partial','20ft container','40ft container'] },
    { key: 'immigrationStatus',  label: 'Immigration Status', type: 'text',     placeholder: 'Pensionado visa, none…' },
    { key: 'notes',              label: 'Notes',              type: 'textarea', placeholder: 'Any additional context…' },
  ];

  // ── Step machine ──────────────────────────────────────────────────────
  type Step = 'dictate' | 'structuring' | 'review';
  let step: Step = 'dictate';

  // ── Recording ─────────────────────────────────────────────────────────
  type RecState = 'idle' | 'recording';
  let recState: RecState = 'idle';
  let mr: MediaRecorder | null = null;
  let stream: MediaStream | null = null;
  let chunks: Blob[] = [];
  let mimeType = '';

  // ── Dictation pad ────────────────────────────────────────────────────
  let padText = '';
  let insertPos = 0;
  let transcribing = false;
  let transcriptError = '';      // shown when all audio models fail
  let showPadManual = false;
  let padTextareaEl: HTMLTextAreaElement;

  // ── Web Speech ───────────────────────────────────────────────────────
  let interimPreview = '';
  let speechRec: any = null;
  let rawTranscript = '';

  // ── Auto-start recording on mount ────────────────────────────────────
  onMount(() => { startRecording(); });

  // ── Web Audio visualizer ──────────────────────────────────────────────
  const BARS = 28;
  let waveHeights: number[] = Array(BARS).fill(4);
  let audioCtx: AudioContext | null = null;
  let analyser: AnalyserNode | null = null;
  let freqBuf: Uint8Array;
  let animId = 0;

  function startVisualizer(micStream: MediaStream) {
    try {
      audioCtx = new AudioContext();
      const src = audioCtx.createMediaStreamSource(micStream);
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 128;
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
    waveHeights = Array.from(freqBuf).slice(2, 2 + BARS).map(v => 5 + (v / 255) * 95);
  }
  function stopVisualizer() {
    cancelAnimationFrame(animId); animId = 0;
    try { audioCtx?.close(); } catch {}
    audioCtx = null; analyser = null;
    waveHeights = Array(BARS).fill(4);
  }

  // ── Web Speech live ghost caption ─────────────────────────────────────
  function startLivePreview() {
    const Ctor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!Ctor) return;
    speechRec = new Ctor();
    speechRec.continuous = true; speechRec.interimResults = true; speechRec.lang = 'en-US';
    speechRec.onresult = (e: any) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++)
        if (!e.results[i].isFinal) interim += e.results[i][0].transcript;
      interimPreview = interim;
    };
    speechRec.onend = () => { if (recState === 'recording') { try { speechRec?.start(); } catch {} } };
    try { speechRec.start(); } catch {}
  }
  function stopLivePreview() {
    try { speechRec?.stop(); } catch {}
    speechRec = null; interimPreview = '';
  }

  // ── Audio helpers ─────────────────────────────────────────────────────
  function pickMime(): string {
    for (const t of ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'])
      if (MediaRecorder.isTypeSupported(t)) return t;
    return '';
  }

  // Transcribe via the backend Whisper proxy (no CORS, key stays server-side)
  async function sliceToText(blob: Blob): Promise<string> {
    if (blob.size < 1000) return '';
    const ab = await blob.arrayBuffer();
    const bytes = new Uint8Array(ab);
    let bin = ''; const C = 65536;
    for (let i = 0; i < bytes.length; i += C)
      bin += String.fromCharCode(...bytes.subarray(i, i + C));
    const b64 = btoa(bin);

    console.log('[ACM] POST voice-transcribe — bytes:', bytes.length);
    const res = await fetch(TRANSCRIBE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-dashboard-token': $authToken || '' },
      body: JSON.stringify({ audioBase64: b64, mimeType: blob.type }),
    });
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      throw new Error((e as any).error || `Transcription failed (HTTP ${res.status})`);
    }
    const data = await res.json();
    console.log('[ACM] transcript chars:', (data.transcript || '').length);
    return (data.transcript || '').trim();
  }


  // ── Recording controls ────────────────────────────────────────────────
  async function startRecording() {
    if (recState !== 'idle') return;
    transcriptError = ''; interimPreview = ''; showPadManual = false; chunks = [];
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mimeType = pickMime();
      console.log('[ACM] startRecording — mimeType:', mimeType);
      mr = new MediaRecorder(stream, { mimeType });
      mr.ondataavailable = (e: any) => {
        console.log('[ACM] ondataavailable — size:', e.data?.size);
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };
      mr.start(250);
      recState = 'recording';
      console.log('[ACM] MediaRecorder started, state:', mr.state);
      startVisualizer(stream);
      startLivePreview();
    } catch (e: any) {
      console.error('[ACM] Mic error:', e);
    }
  }

  async function stopRecording() {
    if (recState === 'idle') return;
    recState = 'idle';
    stopVisualizer(); stopLivePreview();
    const pos = insertPos;
    console.log('[ACM] stopRecording — chunks so far:', chunks.length, '| insertPos:', pos);
    if (!mr || mr.state === 'inactive') {
      console.warn('[ACM] MediaRecorder already inactive');
      stream?.getTracks().forEach(t => t.stop());
      mr = null; stream = null; return;
    }
    transcribing = true; showPadManual = false;
    const finalBlob = await new Promise<Blob | null>((resolve) => {
      const collected = [...chunks]; const mime = mimeType;
      mr!.ondataavailable = (e: any) => {
        console.log('[ACM] final ondataavailable — size:', e.data?.size);
        if (e.data && e.data.size > 0) collected.push(e.data);
      };
      mr!.onstop = () => {
        console.log('[ACM] onstop — total chunks:', collected.length);
        chunks = [];
        if (collected.length === 0) { resolve(null); return; }
        const blob = new Blob(collected, { type: mime });
        console.log('[ACM] final blob size:', blob.size, 'type:', blob.type);
        resolve(blob);
      };
      try { mr!.stop(); } catch (err) {
        console.error('[ACM] mr.stop() threw:', err); resolve(null);
      }
    });
    stream?.getTracks().forEach(t => t.stop());
    mr = null; stream = null;
    if (!finalBlob || finalBlob.size < 1000) {
      console.warn('[ACM] blob too small or null, size:', finalBlob?.size);
      transcribing = false; return;
    }
    try {
      console.log('[ACM] calling sliceToText (cascade)…');
      const text = (await sliceToText(finalBlob)).trim();
      console.log('[ACM] transcribed text:', JSON.stringify(text));
      if (text) {
        const before = padText.slice(0, pos);
        const after  = padText.slice(pos);
        const sb = before.length > 0 && !/[\s\n]$/.test(before) ? ' ' : '';
        const sa = after.length  > 0 && !/^[\s\n]/.test(after)  ? ' ' : '';
        padText = before + sb + text + sa + after;
        const newCursor = pos + sb.length + text.length;
        console.log('[ACM] padText updated, length:', padText.length, '| newCursor:', newCursor);
        await tick();
        if (padTextareaEl) {
          padTextareaEl.selectionStart = newCursor;
          padTextareaEl.selectionEnd   = newCursor;
          padTextareaEl.focus();
          insertPos = newCursor;
        }
      }
    } catch (err: any) {
      transcriptError = 'Transcription failed — type your notes below or record again.';
      console.error('[ACM] All audio models failed:', err.message);
    }
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

  // ── Type-in animation ─────────────────────────────────────────────────
  async function typeIn(setter: (v: string) => void, text: string, ms = 14): Promise<void> {
    setter('');
    for (let i = 1; i <= text.length; i++) {
      await new Promise<void>(r => setTimeout(r, ms));
      setter(text.slice(0, i));
    }
  }

  // ── Extraction + form fill ────────────────────────────────────────────
  let extracted: ClientFieldExtraction | null = null;
  let extractError = '';
  let aiFilledFields: Set<string> = new Set();

  const EMPTY_EXTRACTION: ClientFieldExtraction = {
    name: '', surname: '', email: '', phone: '',
    originCountry: '', originCity: '',
    destinationCountry: '', destinationCity: '',
    budget: '', size: '', immigrationStatus: '', notes: '',
    customFields: {},
  };

  async function runExtraction(text: string) {
    extractError = '';
    try {
      console.log('[ACM] POST extract-client-fields — chars:', text.length);
      const res = await fetch(EXTRACT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-dashboard-token': $authToken || '' },
        body: JSON.stringify({ transcript: text }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error((e as any).error || `Extraction failed (HTTP ${res.status})`);
      }
      const data = await res.json();
      extracted = (data.fields ?? EMPTY_EXTRACTION) as ClientFieldExtraction;
      console.log('[ACM] extracted fields:', extracted);
      seedVisibleFields(extracted);
      step = 'review';
      await fillFormAnimated(extracted);
    } catch (e: any) {
      console.error('[ACM] extraction error:', e?.message);
      extractError = (e as Error).message;
      seedVisibleFields(EMPTY_EXTRACTION);
      step = 'review';
    }
  }


  async function fillFormAnimated(f: ClientFieldExtraction) {
    aiFilledFields = new Set();
    const STAGGER = 70;
    const CHAR_MS = 14;
    const rows: Array<{ key: string; val: string }> = [];
    for (const field of FIELDS) {
      const val = (f as any)[field.key] as string | undefined;
      if (typeof val === 'string' && val.trim()) {
        aiFilledFields = new Set([...aiFilledFields, field.key]);
        rows.push({ key: field.key, val: val.trim() });
      }
    }
    await Promise.all(rows.map(({ key, val }, i) =>
      new Promise<void>(async (res) => {
        await new Promise<void>(r => setTimeout(r, i * STAGGER));
        await typeIn((v) => setField(key, v), val, CHAR_MS);
        res();
      })
    ));
    customFieldRows = (Object.entries(f.customFields || {}) as [string, string][])
      .map(([k, v]) => ({ key: k, value: v }));
  }

  // ── Form state — schema-driven progressive disclosure ─────────────────
  function initFormValues(): Record<string, string> {
    return Object.fromEntries(FIELDS.map(f => [f.key, '']));
  }
  let formValues: Record<string, string> = initFormValues();

  // Direct-mutate + reassign for Svelte reactivity (safe with parallel type-in)
  function setField(k: string, v: string) {
    formValues[k] = v;
    formValues = formValues;
  }
  function getField(k: string): string { return formValues[k] || ''; }

  // Progressive visibility — email is always shown; others reveal on extraction or user request
  let visibleFields: Set<string> = new Set(['email']);
  $: visibleFieldList = FIELDS.filter(f => visibleFields.has(f.key));
  $: hiddenFieldList  = FIELDS.filter(f => !visibleFields.has(f.key));

  function seedVisibleFields(f: ClientFieldExtraction) {
    const show = new Set<string>(['email']);
    for (const fd of FIELDS) {
      const val = (f as any)[fd.key];
      if (typeof val === 'string' && val.trim()) show.add(fd.key);
    }
    visibleFields = show;
  }

  function revealField(key: string) {
    visibleFields = new Set([...visibleFields, key]);
  }

  function resetForm() {
    formValues = initFormValues();
    visibleFields = new Set(['email']);
    aiFilledFields = new Set();
    extractError = ''; extracted = null;
    customFieldRows = [];
  }

  let customFieldRows: { key: string; value: string }[] = [];
  function addCustomField()             { customFieldRows = [...customFieldRows, { key: '', value: '' }]; }
  function removeCustomField(i: number) { customFieldRows = customFieldRows.filter((_, x) => x !== i); }

  // ── Submit ────────────────────────────────────────────────────────────
  let submitting = false;
  let submitError = '';

  async function handleSubmit() {
    const email = getField('email').trim().toLowerCase();
    if (!email) { submitError = 'Email is required.'; return; }
    submitting = true; submitError = '';
    const cf: Record<string, string> = {};
    for (const { key, value } of customFieldRows)
      if (key.trim() && value.trim()) cf[key.trim()] = value.trim();
    try {
      const res = await fetch(`${API_URL}/api/dashboard/clients/manual`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-dashboard-token': $authToken || '' },
        body: JSON.stringify({
          name: getField('name').trim(), surname: getField('surname').trim(),
          email,
          phone: getField('phone').trim(),
          originCountry: getField('originCountry').trim(), originCity: getField('originCity').trim(),
          destinationCountry: getField('destinationCountry').trim(), destinationCity: getField('destinationCity').trim(),
          budget: getField('budget').trim(), size: getField('size').trim(),
          immigrationStatus: getField('immigrationStatus').trim(), notes: getField('notes').trim(),
          voiceTranscript: rawTranscript || undefined,
          customFields: Object.keys(cf).length ? cf : undefined,
        }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error((e as any).error || 'Failed to create client.');
      }
      const data = await res.json();
      dispatch('created', { docId: data.docId });
    } catch (err: any) {
      submitError = (err as Error).message;
    } finally {
      submitting = false;
    }
  }

  // ── Cleanup + navigation ─────────────────────────────────────────────
  function cleanup() {
    recState = 'idle';
    stopVisualizer(); stopLivePreview();
    try { mr?.stop(); } catch {}
    stream?.getTracks().forEach(t => t.stop());
    mr = null; stream = null;
  }

  function skipToPad()    { cleanup(); transcribing = false; chunks = []; }
  function skipToManual() { cleanup(); seedVisibleFields(EMPTY_EXTRACTION); step = 'review'; }
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
         STEP 1 · DICTATE  (three sub-phases)
    ═══════════════════════════════════════════════════ -->
    {#if step === 'dictate'}

      <!-- ─── A: RECORDING ─── -->
      {#if recState === 'recording'}
        <div class="rec-phase">
          <div class="rec-badge"><span class="rec-dot"></span><span>Recording</span></div>

          <div class="orb-wrap">
            <div class="orb-ring ring-1"></div>
            <div class="orb-ring ring-2"></div>
            <div class="orb-ring ring-3"></div>
            <button class="orb-btn orb-btn-recording" on:click={stopRecording} aria-label="Stop">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <rect x="5" y="5" width="14" height="14" rx="2.5"/>
              </svg>
              <span class="orb-label">Stop</span>
            </button>
          </div>

          <div class="spectrum spectrum-active" aria-hidden="true">
            {#each waveHeights as h, i}
              <div class="spec-bar"
                style="height:{h}%;background:hsl({260+i*2},{60+(h/100)*30}%,{55+(h/100)*15}%);opacity:{0.85+(h/100)*0.15}"
              ></div>
            {/each}
          </div>

          {#if interimPreview}
            <div class="ghost-caption" aria-hidden="true">{interimPreview}</div>
          {/if}

          {#if padText.trim()}
            <div class="pad-wrap">
              <textarea bind:this={padTextareaEl} bind:value={padText} class="pad-editor"
                rows="5" spellcheck="true" placeholder="Speak naturally…"
                on:blur={trackCursor} on:keyup={trackCursor}
                on:click={trackCursor} on:mouseup={trackCursor}
              ></textarea>
              <div class="pad-meta"><span class="pad-char">{padText.length} chars</span></div>
            </div>
          {:else}
            <p class="rec-hint">Describe the new client naturally — name, origin, destination, budget…</p>
          {/if}

          <button class="btn-manual-tiny" on:click={skipToPad}>✏️ Type manually instead</button>
        </div>

      <!-- ─── B: TRANSCRIBING (cosmos spinner) ─── -->
      {:else if transcribing}
        <div class="transcribing-phase">
          <div class="cosmos">
            <div class="cosmos-orbit cosmos-orbit-1"></div>
            <div class="cosmos-orbit cosmos-orbit-2"></div>
            <div class="cosmos-orbit cosmos-orbit-3"></div>
            <div class="cosmos-core">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 1a4 4 0 0 1 4 4v6a4 4 0 0 1-8 0V5a4 4 0 0 1 4-4z"/>
                <path d="M19 10a7 7 0 0 1-14 0" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" fill="none"/>
                <line x1="12" y1="17" x2="12" y2="22" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                <line x1="9" y1="22" x2="15" y2="22" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
              </svg>
            </div>
          </div>
          <h2 class="transcribing-title">
            Transcribing<span class="td-dot" style="--d:0">.</span><span
              class="td-dot" style="--d:1">.</span><span class="td-dot" style="--d:2">.</span>
          </h2>
          <p class="transcribing-sub">Converting your voice to text</p>
          {#if !showPadManual}
            <button class="btn-manual-tiny" on:click={() => (showPadManual = true)}>✏️ Type manually instead</button>
          {:else}
            <div class="pad-wrap" style="width:100%">
              <textarea bind:this={padTextareaEl} bind:value={padText} class="pad-editor" rows="5"
                spellcheck="true" placeholder="Type while it processes…"
                on:blur={trackCursor} on:keyup={trackCursor} on:click={trackCursor} on:mouseup={trackCursor}
              ></textarea>
            </div>
          {/if}
        </div>

      <!-- ─── C: PAD (text ready + orb for more recording) ─── -->
      {:else}
        <div class="pad-phase">
          <div class="pad-phase-header">
            <h2>New Client</h2>
            {#if padText.trim()}
              <p class="pad-sub">✅ Ready — edit, add more, or structure with AI</p>
            {:else}
              <p class="pad-sub">Speak — AI transcribes directly into the pad</p>
            {/if}
          </div>

          <div class="orb-wrap">
            <button class="orb-btn" on:click={startRecording} aria-label="Record">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 1a4 4 0 0 1 4 4v6a4 4 0 0 1-8 0V5a4 4 0 0 1 4-4z"/>
                <path d="M19 10a7 7 0 0 1-14 0" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" fill="none"/>
                <line x1="12" y1="17" x2="12" y2="22" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                <line x1="9" y1="22" x2="15" y2="22" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
              </svg>
              <span class="orb-label">{padText.trim() ? 'Record more' : 'Record'}</span>
            </button>
          </div>

          <div class="spectrum" aria-hidden="true">
            {#each waveHeights as _h, _i}
              <div class="spec-bar" style="height:4%;opacity:.12;background:#a78bfa"></div>
            {/each}
          </div>

          {#if transcriptError}
            <div class="pad-error">⚠️ {transcriptError}</div>
          {/if}

          <div class="pad-wrap">
            <textarea bind:this={padTextareaEl} bind:value={padText} class="pad-editor pad-editor-reveal"
              rows="6" spellcheck="true"
              placeholder='e.g. "New client, John Smith, moving from Texas to Costa Rica in October, budget around fifteen thousand…"'
              on:blur={trackCursor} on:keyup={trackCursor} on:click={trackCursor} on:mouseup={trackCursor}
            ></textarea>
            <div class="pad-meta"><span class="pad-char">{padText.length} chars</span></div>
          </div>

          <div class="dictate-footer">
            <button class="btn-skip" on:click={skipToManual}>✏️ Skip — type manually</button>
            {#if padText.trim()}
              <button class="btn-structure-now" on:click={goStructure}>
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

    {/if}<!-- /step dictate -->

    <!-- ═══════════════════════════════════════════════════
         STEP 2 · STRUCTURING
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
         STEP 3 · REVIEW — progressive disclosure
         Fields only appear when extracted (or manually revealed)
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

          <!-- Progressive standard fields — only visible ones render -->
          <div class="acm-fields">
            {#each visibleFieldList as field, i (field.key)}
              <div
                class="acm-field"
                class:acm-field-full={field.type === 'textarea'}
                style="--i:{i}"
              >
                <label
                  class:ai-filled={aiFilledFields.has(field.key)}
                  class:acm-required={field.required}
                >
                  {field.label}{field.required ? ' *' : ''}
                  {#if field.type === 'select'}
                    <select bind:value={formValues[field.key]}>
                      <option value="">Unknown</option>
                      {#each field.options ?? [] as opt}<option>{opt}</option>{/each}
                    </select>
                  {:else if field.type === 'textarea'}
                    <textarea bind:value={formValues[field.key]} rows="3"
                      placeholder={field.placeholder ?? ''}></textarea>
                  {:else}
                    <input type={field.type} bind:value={formValues[field.key]}
                      placeholder={field.placeholder ?? ''} />
                  {/if}
                </label>
              </div>
            {/each}
          </div>

          <!-- Reveal hidden fields on demand (pill buttons) -->
          {#if hiddenFieldList.length > 0}
            <div class="af-section">
              <span class="af-label">Add a field</span>
              <div class="af-pills">
                {#each hiddenFieldList as f}
                  <button class="af-pill" on:click={() => revealField(f.key)}>+ {f.label}</button>
                {/each}
              </div>
            </div>
          {/if}

          <!-- Custom fields (user-defined free key-value pairs) -->
          <div class="custom-fields-section">
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
          {#if submitError}<div class="rfoot-error">{submitError}</div>{/if}
          <button class="btn-back"
            on:click={() => { resetForm(); step = 'dictate'; rawTranscript = ''; }}>
            ← Re-record
          </button>
          <button class="btn-create" on:click={handleSubmit}
            disabled={submitting || !getField('email').trim()}>
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
    background: rgba(15,8,40,.58); z-index: 1000;
    display: flex; align-items: center; justify-content: center;
    padding: 1rem; backdrop-filter: blur(8px);
  }
  .acm-shell {
    background: #fff; border: 1px solid #e2e2ee; border-radius: 22px;
    width: 100%; max-width: 700px; max-height: 92vh;
    display: flex; flex-direction: column; overflow: hidden;
    box-shadow: 0 24px 72px rgba(15,8,40,.2), 0 2px 10px rgba(15,8,40,.08);
    position: relative; transition: max-width .35s cubic-bezier(.4,0,.2,1);
  }
  .dictate-mode { max-width: 520px; }
  .acm-x {
    position: absolute; top: 1rem; right: 1rem; z-index: 10;
    background: #f3f3fa; border: 1px solid #e2e2ee; color: #8888b0;
    width: 32px; height: 32px; border-radius: 50%; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    transition: background .15s, color .15s, transform .15s;
  }
  .acm-x:hover { background: #eaeaf5; color: #12122a; transform: scale(1.1); }

  /* ══ RECORDING PHASE ══════════════════════════════════════════════════ */
  .rec-phase {
    display: flex; flex-direction: column; align-items: center;
    padding: 2rem 1.8rem 1.8rem; gap: 1.2rem;
    background: #fff; overflow-y: auto;
  }
  .rec-badge {
    display: inline-flex; align-items: center; gap: .5rem;
    background: #fff1f1; border: 1px solid #fecaca; border-radius: 20px;
    padding: .28rem .9rem;
    font-size: .72rem; font-weight: 800; color: #dc2626;
    letter-spacing: .06em; text-transform: uppercase;
  }
  .rec-dot {
    width: 7px; height: 7px; border-radius: 50%; background: #dc2626;
    animation: rec-pulse 1.1s ease-in-out infinite;
  }
  @keyframes rec-pulse {
    0%,100% { opacity: 1; transform: scale(1); }
    50%     { opacity: .3; transform: scale(.7); }
  }
  .rec-hint {
    font-size: .84rem; color: #a0a0c0; text-align: center;
    max-width: 340px; line-height: 1.55; margin: 0;
  }

  /* ── Orb ── */
  .orb-wrap { position: relative; display: flex; align-items: center; justify-content: center; }
  .orb-ring {
    position: absolute; border-radius: 50%;
    border: 1.5px solid rgba(124,58,237,.28);
    animation: orb-ring-pulse 2s ease-out infinite; pointer-events: none;
  }
  .ring-1 { width:126px; height:126px; animation-delay:0s; }
  .ring-2 { width:162px; height:162px; animation-delay:.65s; }
  .ring-3 { width:198px; height:198px; animation-delay:1.3s; }
  @keyframes orb-ring-pulse {
    0%   { transform:scale(.82); opacity:.75; }
    100% { transform:scale(1.18); opacity:0; }
  }
  .orb-btn {
    position: relative; z-index: 1;
    width: 108px; height: 108px; border-radius: 50%;
    border: 2.5px solid #d4c4fb;
    background: linear-gradient(145deg,#f5f0ff 0%,#ece4fd 100%);
    color: #7c3aed; cursor: pointer;
    display: flex; flex-direction: column; align-items: center; justify-content: center; gap: .28rem;
    box-shadow: 0 6px 20px rgba(124,58,237,.15), inset 0 1px 0 rgba(255,255,255,.9);
    transition: background .2s, border-color .2s, transform .15s, box-shadow .2s;
  }
  .orb-btn:hover {
    background: linear-gradient(145deg,#ece4fd 0%,#ddd2fb 100%);
    border-color: #7c3aed; box-shadow: 0 10px 32px rgba(124,58,237,.28); transform: scale(1.05);
  }
  .orb-btn:active { transform: scale(.97); }
  .orb-btn-recording {
    background: linear-gradient(145deg,#fff6f6 0%,#ffe4e4 100%);
    border-color: #f87171; color: #dc2626;
    box-shadow: 0 6px 24px rgba(248,113,113,.25), inset 0 1px 0 rgba(255,255,255,.9);
  }
  .orb-label { font-size:.68rem; font-weight:800; text-transform:uppercase; letter-spacing:.07em; }

  /* ── Spectrum ── */
  .spectrum {
    display: flex; align-items: flex-end; justify-content: center;
    gap: 2px; width: 100%; max-width: 320px; height: 64px;
  }
  .spec-bar {
    width: 6px; border-radius: 3px 3px 2px 2px;
    transition: height .05s linear, opacity .1s; min-height: 3px;
  }

  /* ── Ghost caption ── */
  .ghost-caption {
    width: 100%; max-width: 420px;
    font-size: .86rem; line-height: 1.55; color: #a0a0c8;
    font-style: italic; text-align: center; min-height: 1.6em; padding: 0 .5rem;
    animation: fade-in .15s ease;
  }
  @keyframes fade-in { from{opacity:0} to{opacity:1} }

  /* ══ TRANSCRIBING PHASE — cosmos spinner ══════════════════════════════ */
  .transcribing-phase {
    display: flex; flex-direction: column; align-items: center;
    padding: 3.5rem 2rem 2.5rem; gap: 1.6rem;
    background: #fff; min-height: 400px; justify-content: center; overflow-y: auto;
  }
  .cosmos {
    position: relative; width: 100px; height: 100px;
    display: flex; align-items: center; justify-content: center;
  }
  .cosmos-orbit { position: absolute; border-radius: 50%; border: 2px solid transparent; }
  .cosmos-orbit-1 {
    inset: 0; border-top-color: #7c3aed; border-right-color: rgba(124,58,237,.35);
    animation: cosmos-cw 1.1s linear infinite;
  }
  .cosmos-orbit-2 {
    inset: -11px; border-top-color: rgba(167,139,250,.6); border-left-color: rgba(167,139,250,.3);
    animation: cosmos-ccw 1.85s linear infinite;
  }
  .cosmos-orbit-3 {
    inset: -24px; border-top-color: rgba(196,181,253,.35); border-bottom-color: rgba(196,181,253,.18);
    animation: cosmos-cw 3.1s linear infinite;
  }
  .cosmos-core {
    position: absolute; inset: 14px; border-radius: 50%;
    background: radial-gradient(135deg,#f0ebff 0%,#e4d9fd 50%,#d0bbff 100%);
    box-shadow: 0 0 20px rgba(124,58,237,.32), 0 0 44px rgba(124,58,237,.14), inset 0 1px 0 rgba(255,255,255,.8);
    display: flex; align-items: center; justify-content: center; color: #7c3aed;
    animation: cosmos-pulse 2s ease-in-out infinite;
  }
  @keyframes cosmos-cw   { to{transform:rotate(360deg)} }
  @keyframes cosmos-ccw  { to{transform:rotate(-360deg)} }
  @keyframes cosmos-pulse {
    0%,100% { box-shadow:0 0 20px rgba(124,58,237,.32),0 0 44px rgba(124,58,237,.14),inset 0 1px 0 rgba(255,255,255,.8); }
    50%     { box-shadow:0 0 30px rgba(124,58,237,.52),0 0 64px rgba(124,58,237,.22),inset 0 1px 0 rgba(255,255,255,.8); }
  }
  .transcribing-title { margin:0; font-size:1.25rem; font-weight:800; color:#12122a; letter-spacing:-.01em; }
  .td-dot {
    display: inline-block; color: #7c3aed;
    animation: td-bounce .9s ease-in-out infinite;
    animation-delay: calc(var(--d) * 0.18s);
  }
  @keyframes td-bounce { 0%,60%,100%{transform:translateY(0)} 30%{transform:translateY(-6px)} }
  .transcribing-sub { margin:-.6rem 0 0; font-size:.84rem; color:#8888b0; }
  .btn-manual-tiny {
    background: none; border: none; color: #b0b0cc; font-size: .78rem;
    cursor: pointer; text-decoration: underline; text-underline-offset: 4px;
    transition: color .15s; margin-top: .3rem;
  }
  .btn-manual-tiny:hover { color: #7c3aed; }

  /* ══ PAD PHASE ════════════════════════════════════════════════════════ */
  .pad-phase {
    display: flex; flex-direction: column; align-items: center;
    padding: 2.2rem 1.8rem 1.8rem; gap: 1.1rem;
    background: #fff; overflow-y: auto;
  }
  .pad-phase-header { text-align: center; }
  .pad-phase-header h2 { margin:0; font-size:1.55rem; font-weight:800; color:#12122a; letter-spacing:-.02em; }
  .pad-sub { margin:.3rem 0 0; font-size:.88rem; color:#6666a0; }
  .pad-wrap { width:100%; max-width:440px; }
  .pad-editor {
    width: 100%; resize: vertical;
    background: #f9f9fd; border: 1px solid #d8d8ec; border-radius: 12px;
    color: #12122a; padding: .85rem 1rem; font-size: .92rem; line-height: 1.7;
    font-family: inherit; outline: none; box-sizing: border-box;
    transition: border-color .15s, box-shadow .15s;
  }
  .pad-editor:focus { border-color:#7c3aed; box-shadow:0 0 0 3px rgba(124,58,237,.1); }
  .pad-editor-reveal { animation: pad-reveal .5s cubic-bezier(.2,0,.4,1) both; }
  @keyframes pad-reveal { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
  .pad-meta { display:flex; align-items:center; margin-top:.28rem; min-height:1.2em; }
  .pad-char { font-size:.72rem; color:#a0a0c0; margin-left:auto; }
  .pad-error {
    font-size: .82rem; color: #dc2626; background: #fff5f5;
    border: 1px solid #fecaca; border-radius: 8px; padding: .5rem .85rem;
    width: 100%; max-width: 440px; line-height: 1.45; box-sizing: border-box;
  }
  .dictate-footer {
    display: flex; align-items: center; justify-content: space-between;
    gap: .8rem; width: 100%; max-width: 440px; flex-wrap: wrap;
  }
  .btn-structure-now {
    display: inline-flex; align-items: center; gap: .55rem; padding: .72rem 1.8rem;
    background: linear-gradient(135deg,#7c3aed 0%,#5b21b6 55%,#4c1d95 100%);
    color: #fff; border: 1px solid rgba(167,139,250,.35); border-radius: 14px;
    font-size: .95rem; font-weight: 800; letter-spacing: .03em; cursor: pointer;
    box-shadow: 0 6px 24px rgba(124,58,237,.35), inset 0 1px 0 rgba(255,255,255,.18);
    transition: box-shadow .2s, transform .12s, filter .15s;
  }
  .btn-structure-now:hover:not(:disabled) { box-shadow:0 10px 36px rgba(124,58,237,.52); filter:brightness(1.1); transform:translateY(-2px); }
  .btn-structure-now:active:not(:disabled) { transform:translateY(0); }
  .btn-structure-now:disabled { opacity:.4; cursor:not-allowed; box-shadow:none; filter:none; }
  .btn-skip {
    background: none; border: none; color: #9090b8; font-size: .8rem;
    cursor: pointer; text-decoration: underline; text-underline-offset: 4px;
  }
  .btn-skip:hover { color: #5555a0; }

  /* ══ STRUCTURING ══════════════════════════════════════════════════════ */
  .structuring-wrap {
    display: flex; flex-direction: column; align-items: center;
    padding: 4rem 2rem; gap: 1.3rem; min-height: 420px;
    justify-content: center; background: #fff;
  }
  .structuring-orb { position:relative; width:96px; height:96px; display:flex; align-items:center; justify-content:center; }
  .s-ring { position:absolute; border-radius:50%; border:1.5px solid rgba(124,58,237,.22); animation:s-expand 2s ease-out infinite; }
  .s-ring-1 { width:96px;  height:96px;  animation-delay:0s; }
  .s-ring-2 { width:128px; height:128px; animation-delay:.6s; }
  .s-ring-3 { width:160px; height:160px; animation-delay:1.2s; }
  @keyframes s-expand { 0%{transform:scale(.7);opacity:.8} 100%{transform:scale(1.25);opacity:0} }
  .s-icon { font-size:2.6rem; z-index:1; animation:s-spin 3s linear infinite; }
  @keyframes s-spin { to{transform:rotate(360deg)} }
  .structuring-title { margin:0; font-size:1.45rem; font-weight:800; color:#12122a; }
  .structuring-sub   { margin:0; font-size:.86rem; color:#6666a0; }
  .structuring-transcript {
    max-width:360px; background:#f3f3fa; border:1px solid #e2e2ee; border-radius:10px;
    padding:.65rem 1rem; font-size:.8rem; color:#6666a0; text-align:center; line-height:1.55; font-style:italic;
  }

  /* ══ REVIEW FORM ══════════════════════════════════════════════════════ */
  .review-wrap { display:flex; flex-direction:column; max-height:92vh; overflow:hidden; background:#fff; }
  .review-header {
    display:flex; align-items:flex-start; justify-content:space-between; flex-wrap:wrap; gap:.5rem;
    padding:1.3rem 1.6rem; border-bottom:1px solid #e8e8f2; background:#fafafe; flex-shrink:0;
  }
  .review-header h2 { margin:0; font-size:1.15rem; font-weight:800; color:#12122a; }
  .review-sub { margin:.2rem 0 0; font-size:.8rem; color:#6666a0; }
  .review-sub strong { color:#7c3aed; }
  .review-sub-err { color:#dc2626; }
  .ts-details summary { font-size:.75rem; color:#9090b8; cursor:pointer; }
  .ts-details[open] summary { color:#6666a0; }
  .ts-detail-body { margin-top:.4rem; font-size:.78rem; color:#6666a0; line-height:1.55; max-height:110px; overflow-y:auto; }

  .review-body {
    overflow-y: auto; flex: 1;
    padding: 1.1rem 1.6rem; display: flex; flex-direction: column; gap: .9rem; background: #fff;
  }

  /* Progressive fields grid */
  .acm-fields {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
    gap: .7rem;
  }
  .acm-field {
    animation: field-in .35s ease both;
    animation-delay: calc(var(--i, 0) * 55ms);
  }
  .acm-field-full { grid-column: 1 / -1; }
  @keyframes field-in { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }

  label {
    display: flex; flex-direction: column; gap: .3rem;
    font-size: .71rem; font-weight: 800; color: #5555a0;
    text-transform: uppercase; letter-spacing: .055em;
  }
  label.acm-required { color: #7c3aed; }
  label.ai-filled input, label.ai-filled select, label.ai-filled textarea {
    border-color: #059669; background: #f0fdf8; animation: ai-glow .9s ease both;
  }
  @keyframes ai-glow { 0%{box-shadow:0 0 0 3px rgba(5,150,105,.22)} 100%{box-shadow:none} }

  input, select, textarea {
    background: #f9f9fd; border: 1px solid #d8d8ec; border-radius: 8px;
    color: #12122a; padding: .48rem .76rem; font-size: .88rem;
    outline: none; font-family: inherit; transition: border-color .15s, box-shadow .15s;
  }
  input::placeholder, textarea::placeholder { color: #b8b8d0; }
  input:focus, select:focus, textarea:focus {
    border-color: #7c3aed; box-shadow: 0 0 0 3px rgba(124,58,237,.11);
  }
  textarea { resize: vertical; min-height: 72px; }

  /* Add-field pill buttons */
  .af-section { display:flex; flex-direction:column; gap:.4rem; }
  .af-label {
    font-size: .68rem; font-weight: 800; color: #a8a8c0;
    text-transform: uppercase; letter-spacing: .06em;
  }
  .af-pills { display:flex; flex-wrap:wrap; gap:.36rem; }
  .af-pill {
    background: none; border: 1px dashed #d0d0e8; color: #9090b8;
    border-radius: 20px; padding: .22rem .78rem; font-size: .75rem; font-weight: 700;
    cursor: pointer; transition: border-color .12s, color .12s, background .12s, border-style .12s;
  }
  .af-pill:hover {
    border-style: solid; border-color: #7c3aed; color: #7c3aed; background: #f5f0ff;
  }

  /* Custom fields */
  .custom-fields-section { display:flex; flex-direction:column; gap:.48rem; padding-top:.1rem; }
  .custom-fields-header { display:flex; align-items:center; justify-content:space-between; }
  .custom-fields-label { font-size:.71rem; font-weight:800; color:#9090b8; text-transform:uppercase; letter-spacing:.055em; }
  .cf-row { display:flex; gap:.48rem; align-items:center; }
  .cf-key { flex:1; min-width:0; }
  .cf-val { flex:2; min-width:0; }
  .cf-del {
    flex-shrink:0; width:28px; height:28px; background:#fff5f5;
    border:1px solid #fecaca; border-radius:7px; color:#dc2626;
    font-size:1rem; cursor:pointer; display:flex; align-items:center; justify-content:center;
    transition:background .15s;
  }
  .cf-del:hover { background:#fee2e2; }
  .btn-add-cf {
    background:none; border:1px dashed #c8c8e8; color:#9090b8; border-radius:8px;
    padding:.3rem .9rem; font-size:.78rem; cursor:pointer; width:fit-content;
    transition:border-color .15s,color .15s;
  }
  .btn-add-cf:hover { border-color:#7c3aed; color:#7c3aed; }
  .btn-add-cf-empty { width:100%; text-align:center; padding:.5rem; }

  /* Review footer */
  .review-footer {
    display:flex; align-items:center; justify-content:flex-end; gap:.7rem;
    padding:1rem 1.6rem; border-top:1px solid #e8e8f2; background:#fafafe; flex-shrink:0;
  }
  .rfoot-error { flex:1; font-size:.78rem; color:#dc2626; }
  .btn-back {
    padding:.5rem 1.1rem; background:#f3f3fa; border:1px solid #d8d8ec;
    color:#5555a0; border-radius:10px; cursor:pointer; font-size:.83rem; font-weight:700;
    transition:background .15s,border-color .15s;
  }
  .btn-back:hover { background:#eaeaf5; border-color:#b8b8e0; color:#12122a; }
  .btn-create {
    display:inline-flex; align-items:center; gap:.45rem; padding:.58rem 1.5rem;
    background:#fff; color:#5b21b6; border:1.5px solid #7c3aed; border-radius:10px;
    font-size:.88rem; font-weight:800; letter-spacing:.025em; cursor:pointer;
    box-shadow:0 2px 10px rgba(124,58,237,.15);
    transition:background .15s,box-shadow .2s,transform .1s,border-color .15s,color .15s;
  }
  .btn-create:hover:not(:disabled) {
    background:#f3effe; border-color:#5b21b6; color:#4c1d95;
    box-shadow:0 4px 18px rgba(124,58,237,.25); transform:translateY(-1px);
  }
  .btn-create:active:not(:disabled) { transform:translateY(0); background:#ece4fd; }
  .btn-create:disabled { opacity:.4; cursor:not-allowed; box-shadow:none; }
  .btn-spin {
    display:inline-block; width:13px; height:13px;
    border:2px solid rgba(124,58,237,.25); border-top-color:#7c3aed;
    border-radius:50%; animation:btn-rotate .65s linear infinite; flex-shrink:0;
  }
  @keyframes btn-rotate { to{transform:rotate(360deg)} }
</style>
