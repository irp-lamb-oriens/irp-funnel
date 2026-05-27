<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { authToken } from '../store.ts';

  const dispatch = createEventDispatcher<{
    created: { docId: string };
    close: void;
  }>();

  const API = import.meta.env.VITE_API_URL || 'http://localhost:8000';

  // ── Tabs ──────────────────────────────────────────────────────────────────
  let tab: 'form' | 'voice' = 'form';

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

  // ── Voice recording state ─────────────────────────────────────────────────
  let mediaRecorder: MediaRecorder | null = null;
  let audioChunks: Blob[] = [];
  let isRecording = false;
  let voiceTranscript = '';
  let voiceLoading    = false;
  let voiceError      = '';
  let audioBlob: Blob | null = null;
  let audioUrl: string | null = null;

  // ── Submission state ──────────────────────────────────────────────────────
  let submitting = false;
  let submitError = '';

  // ── Helpers ───────────────────────────────────────────────────────────────
  function getHeaders() {
    return {
      'Content-Type': 'application/json',
      'x-dashboard-token': $authToken || '',
    };
  }

  // ── Voice recording ────────────────────────────────────────────────────────
  async function startRecording() {
    voiceError = '';
    audioChunks = [];
    audioBlob = null;
    audioUrl = null;
    voiceTranscript = '';

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : 'audio/ogg;codecs=opus';

      mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunks.push(e.data); };
      mediaRecorder.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        audioBlob = new Blob(audioChunks, { type: mimeType });
        audioUrl = URL.createObjectURL(audioBlob);
      };
      mediaRecorder.start();
      isRecording = true;
    } catch (err: any) {
      voiceError = `Microphone error: ${err.message}`;
    }
  }

  function stopRecording() {
    mediaRecorder?.stop();
    isRecording = false;
  }

  async function handleAudioUpload(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    audioBlob = file;
    audioUrl = URL.createObjectURL(file);
    voiceTranscript = '';
  }

  async function transcribeAudio() {
    if (!audioBlob) return;
    voiceLoading = true;
    voiceError = '';
    voiceTranscript = '';

    try {
      // Convert blob to base64
      const arrayBuffer = await audioBlob.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = '';
      bytes.forEach(b => binary += String.fromCharCode(b));
      const audioBase64 = btoa(binary);
      const mimeType = audioBlob.type || 'audio/webm';

      const res = await fetch(`${API}/api/dashboard/voice-transcribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-dashboard-token': $authToken || '',
        },
        body: JSON.stringify({ audioBase64, mimeType }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || 'Transcription failed');
      }

      const data = await res.json();
      voiceTranscript = data.transcript || '';
      // Also fill notes for easy review
      if (voiceTranscript && !notes) notes = voiceTranscript;
    } catch (err: any) {
      voiceError = err.message;
    } finally {
      voiceLoading = false;
    }
  }

  // ── Submit ────────────────────────────────────────────────────────────────
  async function handleSubmit() {
    if (!email.trim()) { submitError = 'Email is required.'; return; }
    submitting = true;
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
          voiceTranscript: voiceTranscript.trim() || undefined,
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
    dispatch('close');
  }
</script>

<!-- ── Modal overlay ─────────────────────────────────────────────────────── -->
<div class="add-client-overlay" on:click|self={closeModal} role="dialog" aria-modal="true">
  <div class="add-client-modal">

    <!-- Header -->
    <div class="acm-header">
      <h2>➕ Add Client Manually</h2>
      <button class="acm-close" on:click={closeModal} aria-label="Close">✕</button>
    </div>

    <!-- Tabs -->
    <div class="acm-tabs">
      <button class:active={tab === 'form'} on:click={() => (tab = 'form')}>📝 Form</button>
      <button class:active={tab === 'voice'} on:click={() => (tab = 'voice')}>🎙 Voice Note</button>
    </div>

    <!-- ── Form Tab ───────────────────────────────────────────────────────── -->
    {#if tab === 'form'}
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
          <label>Immigration Status<input bind:value={immigrationStatus} placeholder="Pensionado visa, none, etc." /></label>
        </div>

        <div class="acm-field">
          <label>Internal Notes
            <textarea bind:value={notes} rows="4" placeholder="Any context about this client…"></textarea>
          </label>
        </div>

      </div>

    <!-- ── Voice Tab ─────────────────────────────────────────────────────── -->
    {:else}
      <div class="acm-body">

        <p class="acm-voice-hint">
          Record a quick voice note about this client — it will be transcribed and saved to their file.
        </p>

        <div class="acm-voice-controls">
          {#if !isRecording}
            <button class="btn-record" on:click={startRecording} disabled={voiceLoading}>
              🎙 Start Recording
            </button>
          {:else}
            <button class="btn-stop" on:click={stopRecording}>
              ⏹ Stop Recording
            </button>
            <span class="recording-indicator">● Recording…</span>
          {/if}

          <label class="btn-upload">
            📎 Upload Audio
            <input type="file" accept="audio/*" on:change={handleAudioUpload} style="display:none" />
          </label>
        </div>

        {#if audioUrl}
          <div class="acm-audio-preview">
            <!-- svelte-ignore a11y-media-has-caption -->
            <audio controls src={audioUrl}></audio>
            <button class="btn-transcribe" on:click={transcribeAudio} disabled={voiceLoading}>
              {voiceLoading ? '⏳ Transcribing…' : '📄 Transcribe'}
            </button>
          </div>
        {/if}

        {#if voiceError}
          <div class="acm-voice-error">{voiceError}</div>
        {/if}

        {#if voiceTranscript}
          <div class="acm-transcript">
            <label>Transcript (editable)
              <textarea bind:value={voiceTranscript} rows="6"></textarea>
            </label>
          </div>
        {/if}

        <div class="acm-field" style="margin-top: 1rem;">
          <p class="acm-note">📋 Don't forget to fill in the basic fields in the <strong>Form</strong> tab (at minimum: email).</p>
        </div>

      </div>
    {/if}

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
  .add-client-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.55);
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
  }

  .add-client-modal {
    background: #1e1e2e;
    border: 1px solid #3a3a5c;
    border-radius: 12px;
    width: 100%;
    max-width: 660px;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: 0 16px 56px rgba(0,0,0,0.6);
  }

  .acm-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem 1.25rem;
    border-bottom: 1px solid #3a3a5c;
    flex-shrink: 0;
  }

  .acm-header h2 {
    margin: 0;
    font-size: 1.1rem;
    color: #e2e2f0;
  }

  .acm-close {
    background: none;
    border: none;
    color: #888;
    font-size: 1.1rem;
    cursor: pointer;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    line-height: 1;
  }
  .acm-close:hover { background: #333; color: #fff; }

  .acm-tabs {
    display: flex;
    gap: 0;
    border-bottom: 1px solid #3a3a5c;
    flex-shrink: 0;
  }
  .acm-tabs button {
    flex: 1;
    padding: 0.6rem 1rem;
    background: none;
    border: none;
    color: #999;
    cursor: pointer;
    font-size: 0.875rem;
    font-weight: 500;
    transition: background 0.15s, color 0.15s;
  }
  .acm-tabs button:hover { background: #2a2a3e; color: #ccc; }
  .acm-tabs button.active { color: #a78bfa; border-bottom: 2px solid #a78bfa; }

  .acm-body {
    overflow-y: auto;
    padding: 1.25rem;
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .acm-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.75rem;
  }

  .acm-field { display: flex; flex-direction: column; }

  label {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    font-size: 0.78rem;
    color: #aaa;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  label.acm-required { color: #c4b5fd; }

  input, select, textarea {
    background: #12121e;
    border: 1px solid #3a3a5c;
    border-radius: 6px;
    color: #e2e2f0;
    padding: 0.45rem 0.65rem;
    font-size: 0.9rem;
    outline: none;
    transition: border-color 0.15s;
    font-family: inherit;
  }
  input:focus, select:focus, textarea:focus { border-color: #7c3aed; }
  textarea { resize: vertical; }

  /* Voice tab */
  .acm-voice-hint {
    font-size: 0.85rem;
    color: #999;
    margin: 0 0 0.75rem;
  }

  .acm-voice-controls {
    display: flex;
    gap: 0.75rem;
    align-items: center;
    flex-wrap: wrap;
  }

  .btn-record, .btn-stop, .btn-upload, .btn-transcribe {
    padding: 0.55rem 1rem;
    border-radius: 8px;
    font-size: 0.875rem;
    cursor: pointer;
    font-weight: 600;
    border: none;
    transition: background 0.15s;
  }

  .btn-record { background: #7c3aed; color: #fff; }
  .btn-record:hover:not(:disabled) { background: #6d28d9; }
  .btn-record:disabled { opacity: 0.5; cursor: not-allowed; }

  .btn-stop { background: #dc2626; color: #fff; }
  .btn-stop:hover { background: #b91c1c; }

  .btn-upload { background: #1e3a5f; color: #93c5fd; display: inline-flex; align-items: center; gap: 0.3rem; }
  .btn-upload:hover { background: #1e4980; }

  .btn-transcribe { background: #0f5b4f; color: #6ee7b7; }
  .btn-transcribe:hover:not(:disabled) { background: #0d4f44; }
  .btn-transcribe:disabled { opacity: 0.5; cursor: not-allowed; }

  .recording-indicator {
    color: #f87171;
    font-size: 0.85rem;
    font-weight: 600;
    animation: blink 1s step-start infinite;
  }
  @keyframes blink { 50% { opacity: 0; } }

  .acm-audio-preview {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-top: 0.5rem;
    flex-wrap: wrap;
  }

  audio {
    flex: 1;
    min-width: 200px;
    height: 36px;
    border-radius: 4px;
  }

  .acm-voice-error {
    background: #3b0a0a;
    border: 1px solid #7f1d1d;
    color: #fca5a5;
    padding: 0.5rem 0.75rem;
    border-radius: 6px;
    font-size: 0.85rem;
  }

  .acm-transcript label {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    font-size: 0.78rem;
    color: #aaa;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .acm-note {
    font-size: 0.8rem;
    color: #888;
    margin: 0;
    border-left: 2px solid #4f46e5;
    padding-left: 0.75rem;
  }

  /* Footer */
  .acm-footer {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 0.75rem;
    padding: 0.9rem 1.25rem;
    border-top: 1px solid #3a3a5c;
    flex-shrink: 0;
  }

  .acm-submit-error {
    flex: 1;
    color: #f87171;
    font-size: 0.8rem;
  }

  .btn-cancel {
    padding: 0.5rem 1rem;
    background: #2a2a3e;
    border: 1px solid #3a3a5c;
    color: #aaa;
    border-radius: 8px;
    cursor: pointer;
    font-size: 0.875rem;
  }
  .btn-cancel:hover { background: #333; }

  .btn-submit {
    padding: 0.5rem 1.25rem;
    background: #7c3aed;
    color: #fff;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    font-size: 0.9rem;
    font-weight: 600;
    transition: background 0.15s;
  }
  .btn-submit:hover:not(:disabled) { background: #6d28d9; }
  .btn-submit:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
