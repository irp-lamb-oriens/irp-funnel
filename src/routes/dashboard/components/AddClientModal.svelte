<script lang="ts">
  import { createEventDispatcher, onDestroy } from 'svelte';
  import { authToken } from '../store.ts';

  const dispatch = createEventDispatcher<{
    created: { docId: string };
    close: void;
  }>();

  const API     = import.meta.env.VITE_API_URL || 'http://localhost:8000';
  const GEM_KEY = import.meta.env.VITE_GEMINI_API_KEY as string;
  const GEM_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${GEM_KEY}`;

  // ── Form fields ───────────────────────────────────────────────────────────
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

  // ── Submission state ──────────────────────────────────────────────────────
  let submitting  = false;
  let submitError = '';

  // ── Voice state ───────────────────────────────────────────────────────────
  type MicState = 'idle' | 'recording' | 'error';
  let micState:        MicState = 'idle';
  let micError                  = '';
  let micPending                = false;   // true while a single slice REST call is in-flight
  let voiceAccumulated          = '';      // only voice-dictated text; sent as voiceTranscript
  let _destroyed                = false;  // guard against post-destroy state mutations

  let _mr:       MediaRecorder | null = null;
  let _stream:   MediaStream   | null = null;
  let _chunks:   Blob[]               = [];
  let _mimeType  = '';

  const PROMPT = 'Transcribe the audio verbatim. Output ONLY the spoken words with natural punctuation and capitalization. No commentary, no filler.';

  async function _transcribeBlob(blob: Blob): Promise<string> {
    const ab  = await blob.arrayBuffer();
    const raw = new Uint8Array(ab);
    let bin = '';
    for (let i = 0; i < raw.length; i += 65536)
      bin += String.fromCharCode(...raw.subarray(i, i + 65536));
    const b64 = btoa(bin);
    const res = await fetch(GEM_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: PROMPT }, { inlineData: { mimeType: blob.type, data: b64 } }] }],
        generationConfig: { temperature: 0 }
      })
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json?.error?.message || `HTTP ${res.status}`);
    return json?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  }

  function _makeMicOnStop(): () => Promise<void> {
    return async () => {
      // build slice blob
      const blob = new Blob(_chunks, { type: _mimeType });
      _chunks = [];
      if (blob.size >= 800) {
        if (!_destroyed) micPending = true;
        try {
          const text = (await _transcribeBlob(blob)).trim();
          if (text && !_destroyed) {
            if (notes && !/\s$/.test(notes)) notes += ' ';
            notes += text;
            voiceAccumulated += (voiceAccumulated ? ' ' : '') + text;
          }
        } catch (e: any) {
          if (!_destroyed) micError = e.message;
        } finally {
          if (!_destroyed) micPending = false;
        }
      }
      // restart if still recording and component is alive
      if (!_destroyed && micState === 'recording') {
        _chunks = [];
        const newMr = new MediaRecorder(_stream!, { mimeType: _mimeType });
        newMr.ondataavailable = (e) => { if (e.data.size > 0) _chunks.push(e.data); };
        newMr.onstop = _makeMicOnStop();
        _mr = newMr;
        _mr.start();
        setTimeout(() => { if (!_destroyed && micState === 'recording') _mr?.stop(); }, 3000);
      }
    };
  }

  async function startMic() {
    if (micState !== 'idle' && micState !== 'error') return;
    micError = '';
    try {
      _stream   = await navigator.mediaDevices.getUserMedia({ audio: true });
      _mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/ogg;codecs=opus';
      _chunks = [];
      _mr = new MediaRecorder(_stream, { mimeType: _mimeType });
      _mr.ondataavailable = (e) => { if (e.data.size > 0) _chunks.push(e.data); };
      _mr.onstop = _makeMicOnStop();
      _mr.start();
      micState = 'recording';
      setTimeout(() => { if (!_destroyed && micState === 'recording') _mr?.stop(); }, 3000);
    } catch (e: any) {
      micError = `Mic: ${e.message}`;
      micState = 'error';
    }
  }

  async function stopMic() {
    micState = 'idle';
    try { _mr?.stop(); } catch {}
    _mr = null;
    _stream?.getTracks().forEach(t => t.stop());
    _stream = null;
  }

  // ── Submit ────────────────────────────────────────────────────────────────
  function getHeaders() {
    return { 'Content-Type': 'application/json', 'x-dashboard-token': $authToken || '' };
  }

  async function handleSubmit() {
    if (!email.trim()) { submitError = 'Email is required.'; return; }
    submitting  = true;
    submitError = '';
    try {
      const res = await fetch(`${API}/api/dashboard/clients/manual`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          name: name.trim(),
          surname: surname.trim(),
          email: email.trim().toLowerCase(),
          phone: phone.trim(),
          originCountry: originCountry.trim(),
          originCity: originCity.trim(),
          destinationCountry: destinationCountry.trim(),
          destinationCity: destinationCity.trim(),
          budget: budget.trim(),
          size: size.trim(),
          immigrationStatus: immigrationStatus.trim(),
          notes: notes.trim(),
          voiceTranscript: voiceAccumulated.trim() || undefined,
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

  function closeModal() {
    if (micState === 'recording') stopMic();
    dispatch('close');
  }

  onDestroy(() => {
    // Set _destroyed BEFORE stopping the recorder so the async onstop
    // callback's state mutations are all no-ops.
    _destroyed = true;
    try { _mr?.stop(); } catch {}
    _stream?.getTracks().forEach(t => t.stop());
    _mr = null;
    _stream = null;
  });
</script>

<!-- ── Modal overlay ─────────────────────────────────────────────────────── -->
<div class="acm-overlay" on:click|self={closeModal} role="dialog" aria-modal="true">
  <div class="acm-modal">

    <!-- Header -->
    <div class="acm-header">
      <h2>➕ Add Client Manually</h2>
      <button class="acm-close" on:click={closeModal} aria-label="Close">✕</button>
    </div>

    <!-- Body -->
    <div class="acm-body">

      <div class="acm-row">
        <label>First Name<input bind:value={name} placeholder="John" /></label>
        <label>Surname<input bind:value={surname} placeholder="Smith" /></label>
      </div>

      <div class="acm-row">
        <label class="acm-required">Email *
          <input type="email" bind:value={email} placeholder="john@example.com" />
        </label>
        <label>Phone<input bind:value={phone} placeholder="+1 555 123 4567" /></label>
      </div>

      <div class="acm-row">
        <label>Origin Country<input bind:value={originCountry} placeholder="United States" /></label>
        <label>Origin City<input bind:value={originCity} placeholder="Austin, TX" /></label>
      </div>

      <div class="acm-row">
        <label>Destination Country<input bind:value={destinationCountry} placeholder="Costa Rica" /></label>
        <label>Destination City<input bind:value={destinationCity} placeholder="San José" /></label>
      </div>

      <div class="acm-row">
        <label>Budget
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
        <label>Move Size
          <select bind:value={size}>
            <option value="">Unknown</option>
            <option>LCL / Partial</option>
            <option>20ft container</option>
            <option>40ft container</option>
          </select>
        </label>
      </div>

      <div class="acm-row">
        <label>Immigration Status
          <input bind:value={immigrationStatus} placeholder="Pensionado visa, none, etc." />
        </label>
      </div>

      <!-- Notes + mic -->
      <div class="acm-notes-wrap">
        <div class="acm-notes-label-row">
          <span class="acm-label">Internal Notes</span>
          <div class="acm-mic-hint">
            {#if micState === 'recording' && micPending}
              <span class="mic-hint-text pending">⏳ Transcribing…</span>
            {:else if micState === 'recording'}
              <span class="mic-hint-text listening">● Listening – dictate now</span>
            {:else if micError}
              <span class="mic-hint-text err">{micError}</span>
            {:else if micState === 'idle'}
              <span class="mic-hint-text idle">Click 🎙 to dictate into notes</span>
            {/if}
          </div>
        </div>
        <div class="acm-notes-input-row">
          <textarea
            class="acm-notes-textarea"
            bind:value={notes}
            rows="4"
            placeholder="Any context about this client… or click 🎙 to dictate"
          ></textarea>
          <button
            class="acm-mic-btn"
            class:recording={micState === 'recording'}
            class:pending={micPending}
            class:err={micState === 'error'}
            on:click={micState === 'recording' ? stopMic : startMic}
            title={micState === 'recording' ? 'Stop dictation' : 'Start dictation'}
            aria-label={micState === 'recording' ? 'Stop dictation' : 'Dictate into notes'}
          >
            {#if micState === 'recording' && micPending}
              <span class="mic-icon">⏳</span>
            {:else if micState === 'recording'}
              <span class="mic-icon">⏹</span>
              <span class="mic-ring"></span>
            {:else}
              <span class="mic-icon">🎙</span>
            {/if}
          </button>
        </div>
      </div>

    </div><!-- .acm-body -->

    <!-- Footer -->
    <div class="acm-footer">
      {#if submitError}
        <div class="acm-submit-error">{submitError}</div>
      {/if}
      <button class="btn-cancel" on:click={closeModal}>Cancel</button>
      <button class="btn-submit" on:click={handleSubmit} disabled={submitting || !email.trim()}>
        {submitting ? '⏳ Creating…' : '✅ Create Client'}
      </button>
    </div>

  </div>
</div>

<style>
  /* ── Overlay / Modal shell ── */
  .acm-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,.55);
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
  }
  .acm-modal {
    background: #1e1e2e;
    border: 1px solid #3a3a5c;
    border-radius: 12px;
    width: 100%;
    max-width: 660px;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: 0 16px 56px rgba(0,0,0,.6);
  }

  /* ── Header ── */
  .acm-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem 1.25rem;
    border-bottom: 1px solid #3a3a5c;
    flex-shrink: 0;
  }
  .acm-header h2 { margin: 0; font-size: 1.1rem; color: #e2e2f0; }
  .acm-close {
    background: none; border: none; color: #888;
    font-size: 1.1rem; cursor: pointer; padding: .25rem .5rem;
    border-radius: 4px; line-height: 1;
  }
  .acm-close:hover { background: #333; color: #fff; }

  /* ── Body ── */
  .acm-body {
    overflow-y: auto;
    padding: 1.25rem;
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: .75rem;
  }

  /* ── Form rows ── */
  .acm-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: .75rem;
  }
  @media (max-width: 480px) { .acm-row { grid-template-columns: 1fr; } }

  label {
    display: flex;
    flex-direction: column;
    gap: .3rem;
    font-size: .78rem;
    color: #aaa;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: .04em;
  }
  label.acm-required { color: #c4b5fd; }

  input, select {
    background: #12121e;
    border: 1px solid #3a3a5c;
    border-radius: 6px;
    color: #e2e2f0;
    padding: .45rem .65rem;
    font-size: .9rem;
    outline: none;
    transition: border-color .15s;
    font-family: inherit;
  }
  input:focus, select:focus { border-color: #7c3aed; }

  /* ── Notes + mic composite ── */
  .acm-notes-wrap {
    display: flex;
    flex-direction: column;
    gap: .35rem;
  }
  .acm-notes-label-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: .4rem;
  }
  .acm-label {
    font-size: .78rem;
    color: #aaa;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: .04em;
  }
  .acm-mic-hint { flex: 1; text-align: right; }
  .mic-hint-text {
    font-size: .75rem;
    font-weight: 500;
  }
  .mic-hint-text.idle    { color: #555; }
  .mic-hint-text.pending { color: #facc15; }
  .mic-hint-text.listening { color: #f87171; }
  .mic-hint-text.err     { color: #fca5a5; }

  .acm-notes-input-row {
    display: flex;
    gap: .6rem;
    align-items: flex-start;
  }
  .acm-notes-textarea {
    flex: 1;
    background: #12121e;
    border: 1px solid #3a3a5c;
    border-radius: 6px;
    color: #e2e2f0;
    padding: .45rem .65rem;
    font-size: .9rem;
    outline: none;
    transition: border-color .15s;
    font-family: inherit;
    resize: vertical;
    min-height: 88px;
  }
  .acm-notes-textarea:focus { border-color: #7c3aed; }

  /* ── Mic button ── */
  .acm-mic-btn {
    flex-shrink: 0;
    position: relative;
    width: 44px;
    height: 44px;
    border-radius: 50%;
    border: 2px solid #3a3a5c;
    background: #12121e;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: border-color .2s, background .2s, box-shadow .2s;
    padding: 0;
    margin-top: 2px;
    overflow: visible;
  }
  .acm-mic-btn:hover:not(:disabled) {
    border-color: #7c3aed;
    background: #1e1e30;
  }
  .acm-mic-btn.recording {
    border-color: #f87171;
    background: #2a0a0a;
    box-shadow: 0 0 0 3px rgba(248,113,113,.18);
  }
  .acm-mic-btn.pending {
    border-color: #facc15;
    background: #1a1400;
  }
  .acm-mic-btn.err {
    border-color: #ef4444;
  }

  .mic-icon { font-size: 1.15rem; line-height: 1; position: relative; z-index: 1; }

  /* Pulsing outer ring while recording */
  .mic-ring {
    position: absolute;
    inset: -5px;
    border-radius: 50%;
    border: 2px solid #f87171;
    opacity: .6;
    animation: mic-pulse 1.2s ease-in-out infinite;
    pointer-events: none;
  }
  @keyframes mic-pulse {
    0%, 100% { transform: scale(1);   opacity: .6; }
    50%       { transform: scale(1.18); opacity: .15; }
  }

  /* ── Footer ── */
  .acm-footer {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: .75rem;
    padding: .9rem 1.25rem;
    border-top: 1px solid #3a3a5c;
    flex-shrink: 0;
  }
  .acm-submit-error {
    flex: 1;
    color: #f87171;
    font-size: .8rem;
  }
  .btn-cancel {
    padding: .5rem 1rem;
    background: #2a2a3e;
    border: 1px solid #3a3a5c;
    color: #aaa;
    border-radius: 8px;
    cursor: pointer;
    font-size: .875rem;
  }
  .btn-cancel:hover { background: #333; }
  .btn-submit {
    padding: .5rem 1.25rem;
    background: #7c3aed;
    color: #fff;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    font-size: .9rem;
    font-weight: 600;
    transition: background .15s;
  }
  .btn-submit:hover:not(:disabled) { background: #6d28d9; }
  .btn-submit:disabled { opacity: .5; cursor: not-allowed; }
</style>
