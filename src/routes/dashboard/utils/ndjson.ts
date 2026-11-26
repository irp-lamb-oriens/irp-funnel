/**
 * ndjson.ts — read a streamed response (one JSON object per line, see
 * irp-funnel-server/helper/ndjson.ts) and hand each object over as it lands.
 *
 * The stream must end with `{ type: "done" }`. `{ type: "error" }` becomes a
 * thrown Error with the server's message; a stream that stops without either
 * means the connection was cut; one silent for `idleMs` is abandoned.
 */

export interface StreamMessage {
  type: string;
  [key: string]: unknown;
}

export class StreamCutError extends Error {
  constructor(message = 'The connection was cut before all the data arrived. Try again.') {
    super(message);
    this.name = 'StreamCutError';
  }
}

export async function readNdjson(
  body: ReadableStream<Uint8Array>,
  onMessage: (m: StreamMessage) => void,
  idleMs = 60_000,
): Promise<StreamMessage> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let timer: ReturnType<typeof setTimeout> | undefined;
  const idle = () =>
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new StreamCutError('The server stopped sending data. Try again.')), idleMs);
    });

  try {
    for (;;) {
      const { value, done } = await Promise.race([reader.read(), idle()]);
      clearTimeout(timer);
      if (value) buffer += decoder.decode(value, { stream: true });
      let nl: number;
      while ((nl = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        if (!line) continue;
        const m = JSON.parse(line) as StreamMessage;
        if (m.type === 'error') throw new Error(String(m.error || 'The server reported an error.'));
        if (m.type === 'done') return m;
        onMessage(m);
      }
      if (done) throw new StreamCutError();
    }
  } finally {
    clearTimeout(timer);
    reader.cancel().catch(() => {});
  }
}
