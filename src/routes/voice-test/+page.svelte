<script lang="ts">
  import { onDestroy } from 'svelte';

  const API_KEY  = import.meta.env.VITE_GEMINI_API_KEY as string;
  const MODEL    = 'gemini-flash-latest';        // stable alias for this project
  const REST_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`;

  // ── Key health-check ───────────────────────────────────────────────────────
  let keyStatus: 'checking' | 'ok' | 'error' = 'checking';
  let keyError = '';
  (async () => {
    try {
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}?key=${API_KEY}`
      );
      if (r.ok) { keyStatus = 'ok'; }
      else { const j = await r.json().catch(() => ({})); keyError = j?.error?.message || `HTTP ${r.status}`; keyStatus = 'error'; }
    } catch (e: any) { keyError = e.message; keyStatus = 'error'; }
  })();

  // ── Shared ─────────────────────────────────────────────────────────────────
  const TRANSCRIBE_PROMPT =
    'Transcribe the audio verbatim. Output ONLY the spoken words with natural punctuation and capitalization. No commentary, no filler.';

  async function audioToTranscript(blob: Blob, log: (m: string) => void): Promise<string> {
    const ab = await blob.arrayBuffer();
    const bytes = new Uint8Array(ab);
    let binary = '';
    const CHUNK = 65536;
    for (let i = 0; i < bytes.length; i += CHUNK)
      binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
    const b64 = btoa(binary);
    log(`b64 length: ${b64.length} — POSTing to ${MODEL}…`);
    const resp = await fetch(REST_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: TRANSCRIBE_PROMPT }, { inlineData: { mimeType: blob.type, data: b64 } }] }],
        generationConfig: { temperature: 0 }
      })
    });
    const json = await resp.json();
    log(`HTTP ${resp.status} — ${JSON.stringify(json).slice(0, 300)}`);
    if (!resp.ok) throw new Error(json?.error?.message || `HTTP ${resp.status}`);
    return json?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  }

  // ────────────────────────────────────────────────────────────────────────────
  // MODE A — Chunked streaming (3-second slices → REST → additive append)
  // ────────────────────────────────────────────────────────────────────────────
  type StateA = 'idle' | 'recording' | 'error';
  let stateA:      StateA   = 'idle';
  let transcriptA  = '';
  let errorA       = '';
  let debugA:      string[] = [];
  let pendingA     = false;    // true while a REST call for a slice is in-flight

  let mrA:        MediaRecorder | null = null;
  let streamA:    MediaStream   | null = null;
  let chunksA:    Blob[]               = [];
  let mimeTypeA   = '';

  function logA(m: string) {
    debugA = [...debugA, `[${new Date().toISOString().slice(11,23)}] ${m}`];
    if (debugA.length > 200) debugA = debugA.slice(-200);
  }

  // Flush the accumulated chunks as a single blob then transcribe
  async function flushA() {
    if (chunksA.length === 0) return;
    const blob = new Blob(chunksA, { type: mimeTypeA });
    chunksA = [];
    if (blob.size < 1000) { logA(`slice too small (${blob.size}B), skip`); return; }
    logA(`slice ready: ${blob.size}B`);
    pendingA = true;
    try {
      const text = await audioToTranscript(blob, logA);
      if (text) {
        if (transcriptA && !transcriptA.endsWith(' ') && !transcriptA.endsWith('\n')) {
          transcriptA += ' ';
        }
        transcriptA += text;
        logA(`CHUNK TEXT: ${text}`);
      }
    } catch (e: any) {
      logA(`SLICE ERROR: ${e.message}`);
    } finally {
      pendingA = false;
    }
  }

  async function startA() {
    if (stateA !== 'idle') return;
    errorA = '';
    logA('Requesting microphone…');
    try {
      streamA   = await navigator.mediaDevices.getUserMedia({ audio: true });
      mimeTypeA = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/ogg;codecs=opus';

      mrA = new MediaRecorder(streamA, { mimeType: mimeTypeA });
      chunksA = [];

      mrA.ondataavailable = (e) => { if (e.data.size > 0) chunksA.push(e.data); };

      // Every 3 seconds: stop current recorder, flush, restart
      const scheduleNext = () => {
        if (stateA !== 'recording') return;
        mrA?.stop();
        // onstop will run flushA, then we restart
      };

      mrA.onstop = async () => {
        await flushA();
        if (stateA === 'recording') {
          // Restart a fresh recorder on the same stream
          chunksA = [];
          mrA = new MediaRecorder(streamA!, { mimeType: mimeTypeA });
          mrA.ondataavailable = (e) => { if (e.data.size > 0) chunksA.push(e.data); };
          mrA.onstop = mrA.onstop;  // will be overwritten below
          mrA.start();
          logA('Next 3-second slice started…');
          setTimeout(scheduleNext, 3000);
        }
      };

      // Patch onstop to use itself recursively properly
      const makeOnStop = () => async () => {
        await flushA();
        if (stateA === 'recording') {
          chunksA = [];
          const newMr = new MediaRecorder(streamA!, { mimeType: mimeTypeA });
          newMr.ondataavailable = (e) => { if (e.data.size > 0) chunksA.push(e.data); };
          newMr.onstop = makeOnStop();
          mrA = newMr;
          mrA.start();
          logA('Next 3-second slice started…');
          setTimeout(() => { if (stateA === 'recording') mrA?.stop(); }, 3000);
        }
      };
      mrA.onstop = makeOnStop();

      mrA.start();
      stateA = 'recording';
      logA(`Recording with mimeType="${mimeTypeA}" — slicing every 3s`);
      setTimeout(() => { if (stateA === 'recording') mrA?.stop(); }, 3000);
    } catch (e: any) {
      errorA = `Mic error: ${e.message}`;
      stateA = 'error';
      logA(`MIC ERROR: ${e.message}`);
    }
  }

  async function stopA() {
    stateA = 'idle';
    logA('Stop requested — flushing final slice…');
    try { mrA?.stop(); } catch {}
    mrA = null;
    streamA?.getTracks().forEach(t => t.stop());
    streamA = null;
  }

  // ────────────────────────────────────────────────────────────────────────────
  // MODE B — Record everything then transcribe in one shot
  // ────────────────────────────────────────────────────────────────────────────
  type StateB = 'idle' | 'recording' | 'processing' | 'done' | 'error';
  let stateB:     StateB   = 'idle';
  let transcriptB = '';
  let errorB      = '';
  let debugB:     string[] = [];

  let mrB:     MediaRecorder | null = null;
  let chunksB: Blob[]               = [];
  let streamB: MediaStream   | null = null;

  function logB(m: string) {
    debugB = [...debugB, `[${new Date().toISOString().slice(11,23)}] ${m}`];
    if (debugB.length > 200) debugB = debugB.slice(-200);
  }

  async function startB() {
    if (stateB === 'recording') return;
    errorB = ''; chunksB = [];
    logB('Requesting microphone…');
    try {
      streamB = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mt = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/ogg;codecs=opus';
      mrB = new MediaRecorder(streamB, { mimeType: mt });
      mrB.ondataavailable = (e) => { if (e.data.size > 0) chunksB.push(e.data); };
      mrB.onstop = async () => {
        streamB?.getTracks().forEach(t => t.stop());
        stateB = 'processing';
        try {
          const blob = new Blob(chunksB, { type: mt });
          logB(`Blob size: ${blob.size}B`);
          const text = await audioToTranscript(blob, logB);
          transcriptB = text;
          logB(`TRANSCRIPT: ${text}`);
          stateB = 'done';
        } catch (e: any) {
          errorB = e.message;
          stateB = 'error';
          logB(`ERROR: ${e.message}`);
        }
      };
      mrB.start(250);
      stateB = 'recording';
      logB(`Recording with mimeType="${mt}"…`);
    } catch (e: any) {
      errorB = `Mic error: ${e.message}`;
      stateB = 'error';
      logB(`MIC ERROR: ${e.message}`);
    }
  }

  function stopB() {
    logB('Stop recording…');
    mrB?.stop();
    mrB = null;
  }

  // ── Cleanup ────────────────────────────────────────────────────────────────
  onDestroy(() => {
    stateA = 'idle';
    try { mrA?.stop(); } catch {}
    streamA?.getTracks().forEach(t => t.stop());
    streamB?.getTracks().forEach(t => t.stop());
  });
</script>

<svelte:head><title>🎙 Voice Test — Gemini</title></svelte:head>

<div class="vt-page">

  <!-- HEADER -->
  <div class="vt-header">
    <div class="vt-title">
      <span class="vt-emoji">🎙</span>
      <div>
        <h1>Gemini Voice Transcription</h1>
        <p class="vt-subtitle">Sandbox — model: <code>{MODEL}</code></p>
      </div>
    </div>
    <div class="vt-key-badge" class:ok={keyStatus==='ok'} class:err={keyStatus==='error'}>
      {#if keyStatus==='checking'}⏳ Checking key…
      {:else if keyStatus==='ok'}✅ API key valid
      {:else}❌ {keyError}{/if}
    </div>
  </div>

  <div class="vt-cards">

    <!-- MODE A -->
    <div class="vt-card" class:active={stateA==='recording'} class:errored={stateA==='error'}>
      <div class="vt-card-header">
        <h2>Mode A · Chunked Live</h2>
        <span class="vt-badge">3-second slices → REST → additive append</span>
      </div>
      <p class="vt-desc">
        Records in rolling 3-second chunks. Each chunk is sent to <code>{MODEL}:generateContent</code>
        and the transcript updates as you speak — no Live API access required.
      </p>

      <div class="vt-status"
        class:s-idle={stateA==='idle'}
        class:s-listen={stateA==='recording'}
        class:s-conn={pendingA}
        class:s-err={stateA==='error'}>
        <span class="vt-dot"></span>
        {stateA==='idle' ? 'Ready' :
         stateA==='recording' && pendingA ? '⏳ Transcribing slice…' :
         stateA==='recording' ? '● Recording – speak now' :
         `Error: ${errorA}`}
      </div>

      <div class="vt-controls">
        {#if stateA==='idle' || stateA==='error'}
          <button class="btn-start" on:click={startA}>🎙 Start</button>
        {:else}
          <button class="btn-stop" on:click={stopA}>⏹ Stop</button>
        {/if}
        <button class="btn-clear" on:click={() => { transcriptA=''; debugA=[]; errorA=''; stateA='idle'; }}>🗑 Clear</button>
      </div>

      <div class="vt-transcript-wrap">
        <div class="vt-transcript-label">
          Transcript
          <button class="btn-copy" on:click={() => navigator.clipboard.writeText(transcriptA)} disabled={!transcriptA}>📋 Copy</button>
        </div>
        <textarea class="vt-transcript" bind:value={transcriptA} placeholder="Transcript updates every ~3 seconds as you speak…" rows="6"></textarea>
      </div>

      <details class="vt-debug">
        <summary>Debug log ({debugA.length})</summary>
        <div class="vt-log">{#each debugA as l}<div>{l}</div>{/each}</div>
      </details>
    </div>

    <!-- MODE B -->
    <div class="vt-card" class:active={stateB==='recording'} class:errored={stateB==='error'}>
      <div class="vt-card-header">
        <h2>Mode B · Record then Transcribe</h2>
        <span class="vt-badge">MediaRecorder → single REST call</span>
      </div>
      <p class="vt-desc">
        Records the whole session as WebM/Opus, then sends it in one shot to
        <code>{MODEL}:generateContent</code>. Transcript appears after you stop.
      </p>

      <div class="vt-status"
        class:s-idle={stateB==='idle'}
        class:s-listen={stateB==='recording'}
        class:s-conn={stateB==='processing'}
        class:s-done={stateB==='done'}
        class:s-err={stateB==='error'}>
        <span class="vt-dot"></span>
        {stateB==='idle' ? 'Ready' :
         stateB==='recording' ? '● Recording – speak now' :
         stateB==='processing' ? '⏳ Transcribing…' :
         stateB==='done' ? '✅ Done' :
         `Error: ${errorB}`}
      </div>

      <div class="vt-controls">
        {#if stateB==='idle'||stateB==='done'||stateB==='error'}
          <button class="btn-start" on:click={startB}>🎙 Start Recording</button>
        {:else if stateB==='recording'}
          <button class="btn-stop" on:click={stopB}>⏹ Stop & Transcribe</button>
        {:else}
          <button class="btn-stop" disabled>⏳ Processing…</button>
        {/if}
        <button class="btn-clear" on:click={() => { transcriptB=''; debugB=[]; errorB=''; stateB='idle'; }}>🗑 Clear</button>
      </div>

      <div class="vt-transcript-wrap">
        <div class="vt-transcript-label">
          Transcript
          <button class="btn-copy" on:click={() => navigator.clipboard.writeText(transcriptB)} disabled={!transcriptB}>📋 Copy</button>
        </div>
        <textarea class="vt-transcript" bind:value={transcriptB} placeholder="Transcript appears after you stop recording…" rows="6"></textarea>
      </div>

      <details class="vt-debug">
        <summary>Debug log ({debugB.length})</summary>
        <div class="vt-log">{#each debugB as l}<div>{l}</div>{/each}</div>
      </details>
    </div>

  </div>

  <p class="vt-footer">
    Sandbox — no data is saved to the IRP server. Both modes are 100% client-side.
  </p>
</div>

<style>
  :global(body){margin:0;}
  .vt-page{min-height:100vh;background:#0f0f1a;color:#e2e2f0;font-family:'Inter',system-ui,sans-serif;padding:2rem 1.5rem 4rem;box-sizing:border-box;}

  /* header */
  .vt-header{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:1rem;margin-bottom:2.5rem;}
  .vt-title{display:flex;align-items:center;gap:1rem;}
  .vt-emoji{font-size:2.5rem;}
  .vt-title h1{margin:0;font-size:1.5rem;font-weight:700;}
  .vt-subtitle{margin:.15rem 0 0;font-size:.85rem;color:#888;}
  .vt-subtitle code{font-size:.82rem;color:#c4b5fd;background:#2a2a3e;padding:.1rem .3rem;border-radius:4px;}

  /* key badge */
  .vt-key-badge{padding:.45rem 1rem;border-radius:999px;font-size:.85rem;font-weight:500;background:#1e1e30;border:1px solid #3a3a5c;color:#aaa;white-space:nowrap;}
  .vt-key-badge.ok{border-color:#10b981;color:#6ee7b7;background:#052e16;}
  .vt-key-badge.err{border-color:#ef4444;color:#fca5a5;background:#3b0a0a;}

  /* grid */
  .vt-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(400px,1fr));gap:1.75rem;max-width:1400px;margin:0 auto;}

  /* card */
  .vt-card{background:#1e1e2e;border:1px solid #3a3a5c;border-radius:16px;padding:1.5rem;display:flex;flex-direction:column;gap:1rem;transition:border-color .2s;}
  .vt-card.active{border-color:#f87171;box-shadow:0 0 0 3px rgba(248,113,113,.12);}
  .vt-card.errored{border-color:#ef4444;}

  .vt-card-header{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:.5rem;}
  .vt-card-header h2{margin:0;font-size:1.05rem;font-weight:700;}
  .vt-badge{font-size:.72rem;font-family:monospace;background:#2a2a3e;border:1px solid #4a4a6e;border-radius:6px;padding:.2rem .55rem;color:#a78bfa;}

  .vt-desc{font-size:.83rem;color:#888;margin:0;line-height:1.6;}
  .vt-desc code{font-size:.82rem;color:#c4b5fd;background:#2a2a3e;padding:.1rem .3rem;border-radius:4px;}

  /* status */
  .vt-status{display:flex;align-items:center;gap:.6rem;font-size:.875rem;font-weight:500;padding:.5rem .75rem;border-radius:8px;background:#12121e;border:1px solid #2a2a3e;}
  .vt-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0;background:#555;}
  .s-idle .vt-dot{background:#555;}
  .s-conn .vt-dot{background:#facc15;animation:pulse 1s infinite;}
  .s-listen .vt-dot{background:#f87171;animation:pulse 1s infinite;}
  .s-done .vt-dot{background:#10b981;}
  .s-err .vt-dot{background:#ef4444;}
  .s-idle{color:#777;} .s-conn{color:#facc15;} .s-listen{color:#f87171;} .s-done{color:#10b981;} .s-err{color:#fca5a5;}
  @keyframes pulse{0%,100%{opacity:1;}50%{opacity:.3;}}

  /* controls */
  .vt-controls{display:flex;gap:.75rem;flex-wrap:wrap;}
  .btn-start,.btn-stop,.btn-clear,.btn-copy{padding:.55rem 1.1rem;border-radius:10px;font-size:.875rem;font-weight:600;cursor:pointer;border:none;transition:background .15s,opacity .15s;}
  .btn-start{background:#7c3aed;color:#fff;}  .btn-start:hover{background:#6d28d9;}
  .btn-stop{background:#dc2626;color:#fff;}   .btn-stop:hover:not(:disabled){background:#b91c1c;}
  .btn-stop:disabled{opacity:.5;cursor:not-allowed;}
  .btn-clear{background:#2a2a3e;color:#aaa;border:1px solid #3a3a5c;} .btn-clear:hover{background:#333;}
  .btn-copy{font-size:.75rem;padding:.25rem .65rem;background:#1e3a2e;color:#6ee7b7;border:1px solid #10b981;border-radius:6px;}
  .btn-copy:hover:not(:disabled){background:#14532d;} .btn-copy:disabled{opacity:.4;cursor:not-allowed;}

  /* transcript */
  .vt-transcript-wrap{display:flex;flex-direction:column;gap:.4rem;}
  .vt-transcript-label{display:flex;align-items:center;justify-content:space-between;font-size:.72rem;color:#888;text-transform:uppercase;letter-spacing:.06em;font-weight:600;}
  .vt-transcript{background:#12121e;border:1px solid #3a3a5c;border-radius:8px;color:#e2e2f0;padding:.75rem;font-size:.95rem;line-height:1.7;resize:vertical;outline:none;font-family:inherit;transition:border-color .15s;min-height:100px;}
  .vt-transcript:focus{border-color:#7c3aed;}

  /* debug */
  .vt-debug{margin-top:.25rem;}
  .vt-debug summary{font-size:.78rem;color:#666;cursor:pointer;user-select:none;padding:.25rem 0;}
  .vt-debug summary:hover{color:#999;}
  .vt-log{background:#090912;border:1px solid #2a2a3e;border-radius:6px;padding:.6rem .75rem;max-height:200px;overflow-y:auto;margin-top:.5rem;font-family:monospace;font-size:.73rem;color:#6b7280;line-height:1.5;white-space:pre-wrap;}
  .vt-log div:last-child{color:#9ca3af;}

  .vt-footer{text-align:center;font-size:.78rem;color:#444;margin-top:2.5rem;}
  @media(max-width:500px){.vt-cards{grid-template-columns:1fr;}}
</style>
