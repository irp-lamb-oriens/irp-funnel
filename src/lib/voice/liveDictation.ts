/**
 * liveDictation.ts
 *
 * Gapless live dictation engine.
 *   PRIMARY  : Web Speech API  (SpeechRecognition / webkitSpeechRecognition)
 *              – continuous, interim results, auto-restart on silence
 *   FALLBACK : Continuous MediaRecorder + cumulative Gemini REST transcription
 *              – one recorder that never stops; full growing blob re-sent every
 *                RESEND_INTERVAL_MS for a replacing (not appending) transcript
 *
 * Usage:
 *   const d = createDictation({ geminiKey, onInterim, onFinal, onState });
 *   await d.start();
 *   await d.stop();   // returns full final transcript string
 */

export type DictationState =
  | 'idle'
  | 'starting'
  | 'listening'
  | 'transcribing'
  | 'error';

export interface DictationCallbacks {
  /** Called rapidly with the live "typing" text (not yet committed) */
  onInterim?: (text: string) => void;
  /** Called when a segment is committed – append this to the displayed transcript */
  onFinal?: (segment: string) => void;
  /** Full replacement of the transcript (used by Gemini cumulative fallback) */
  onTranscriptReplace?: (full: string) => void;
  /** State changes */
  onState?: (state: DictationState) => void;
  /** Non-fatal errors/warnings */
  onError?: (msg: string) => void;
  /** Gemini REST endpoint (only needed for fallback path) */
  geminiUrl?: string;
}

export interface DictationHandle {
  start(): Promise<void>;
  stop(): Promise<string>;   // resolves with final committed transcript
  readonly mode: 'webspeech' | 'gemini-cumulative' | 'none';
}

const RESEND_INTERVAL_MS  = 2500;
const MIN_BLOB_SIZE_BYTES = 800;

const TRANSCRIBE_PROMPT =
  'Transcribe the audio verbatim. Output ONLY the spoken words with ' +
  'natural punctuation and capitalization. No commentary, no filler.';

// ── helpers ──────────────────────────────────────────────────────────────────

// SpeechRecognition is not in TS's lib.dom by default in all configs — use any
type SpeechRecognitionCtor = any;

function hasWebSpeech(): boolean {
  return typeof window !== 'undefined' &&
    !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
}

function getSpeechCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;
}

async function blobToBase64(blob: Blob): Promise<string> {
  const ab  = await blob.arrayBuffer();
  const raw = new Uint8Array(ab);
  let bin   = '';
  for (let i = 0; i < raw.length; i += 65536)
    bin += String.fromCharCode(...raw.subarray(i, i + 65536));
  return btoa(bin);
}

async function fetchGeminiTranscript(
  url: string,
  blob: Blob,
): Promise<string> {
  const b64 = await blobToBase64(blob);
  const res = await fetch(url, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [
          { text: TRANSCRIBE_PROMPT },
          { inlineData: { mimeType: blob.type, data: b64 } },
        ],
      }],
      generationConfig: { temperature: 0 },
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error?.message || `HTTP ${res.status}`);
  return (json?.candidates?.[0]?.content?.parts?.[0]?.text || '') as string;
}

// ── Web Speech engine ─────────────────────────────────────────────────────────

function createWebSpeechEngine(cb: DictationCallbacks): DictationHandle {
  const Ctor   = getSpeechCtor()!;
  let rec: any = null;
  let committed = '';
  let destroyed = false;

  function emit(s: DictationState) { cb.onState?.(s); }

  function startRec() {
    if (destroyed) return;
    rec = new Ctor();
    rec.continuous     = true;
    rec.interimResults = true;
    rec.lang           = 'en-US';

    rec.onresult = (e: any) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) {
          committed += res[0].transcript;
          cb.onFinal?.(res[0].transcript);
        } else {
          interim += res[0].transcript;
        }
      }
      cb.onInterim?.(interim);
    };

    rec.onerror = (e: any) => {
      if (e.error === 'no-speech' || e.error === 'aborted') return; // benign
      cb.onError?.(`SpeechRecognition error: ${e.error}`);
    };

    // Auto-restart on natural end (e.g. silence timeout)
    rec.onend = () => {
      if (destroyed) return;
      try { startRec(); } catch {}
    };

    rec.start();
    emit('listening');
  }

  return {
    mode: 'webspeech',
    async start() {
      destroyed = false;
      committed = '';
      emit('starting');
      startRec();
    },
    async stop() {
      destroyed = true;
      emit('idle');
      try { rec?.abort(); } catch {}
      rec = null;
      return committed.trim();
    },
  };
}

// ── Gemini cumulative engine ──────────────────────────────────────────────────

function createGeminiCumulativeEngine(
  geminiUrl: string,
  cb: DictationCallbacks,
): DictationHandle {
  let mr:       MediaRecorder | null = null;
  let stream:   MediaStream   | null = null;
  let allChunks: Blob[]              = [];
  let mimeType  = '';
  let timer: ReturnType<typeof setInterval> | null = null;
  let inFlight  = false;
  let destroyed = false;
  let latestTranscript = '';

  function emit(s: DictationState) { cb.onState?.(s); }

  async function flush(final = false) {
    if (allChunks.length === 0 || inFlight) return;
    const blob = new Blob(allChunks, { type: mimeType });
    if (blob.size < MIN_BLOB_SIZE_BYTES) return;
    inFlight = true;
    if (!destroyed) emit('transcribing');
    try {
      const text = (await fetchGeminiTranscript(geminiUrl, blob)).trim();
      if (!destroyed) {
        latestTranscript = text;
        cb.onTranscriptReplace?.(text);
        if (!final) emit('listening');
      }
    } catch (e: any) {
      if (!destroyed) cb.onError?.(e.message);
    } finally {
      inFlight = false;
    }
  }

  function pickMimeType() {
    for (const t of [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
    ]) {
      if (MediaRecorder.isTypeSupported(t)) return t;
    }
    return '';
  }

  return {
    mode: 'gemini-cumulative',
    async start() {
      destroyed   = false;
      allChunks   = [];
      inFlight    = false;
      latestTranscript = '';
      emit('starting');

      stream   = await navigator.mediaDevices.getUserMedia({ audio: true });
      mimeType = pickMimeType();
      mr = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mr.ondataavailable = (e) => { if (e.data.size > 0) allChunks.push(e.data); };
      mr.start(250);
      emit('listening');
      timer = setInterval(() => { if (!destroyed) flush(); }, RESEND_INTERVAL_MS);
    },
    async stop() {
      destroyed = true;
      if (timer) clearInterval(timer);
      timer = null;
      try { mr?.stop(); } catch {}
      stream?.getTracks().forEach(t => t.stop());
      mr = null;
      stream = null;
      // Final high-quality transcription
      await flush(true);
      emit('idle');
      return latestTranscript;
    },
  };
}

// ── Public factory ────────────────────────────────────────────────────────────

export function createDictation(cb: DictationCallbacks): DictationHandle {
  if (hasWebSpeech()) {
    return createWebSpeechEngine(cb);
  }
  if (cb.geminiUrl) {
    cb.onError?.('Web Speech API unavailable – using Gemini cumulative fallback.');
    return createGeminiCumulativeEngine(cb.geminiUrl, cb);
  }
  // No engine available (e.g. SSR context)
  return {
    mode: 'none',
    async start() { cb.onError?.('No STT engine available in this environment.'); },
    async stop()  { return ''; },
  };
}
