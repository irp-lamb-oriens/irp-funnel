import { describe, expect, it } from 'vitest';
import { readNdjson, StreamCutError, type StreamMessage } from './ndjson.ts';

function streamOf(chunks: string[]): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  return new ReadableStream({
    start(c) {
      for (const ch of chunks) c.enqueue(enc.encode(ch));
      c.close();
    },
  });
}

describe('readNdjson', () => {
  it('hands over each object as it lands, even when a line is split across chunks', async () => {
    const seen: StreamMessage[] = [];
    const done = await readNdjson(streamOf(['{"type":"clients","n":1}\n{"type":"cli', 'ents","n":2}\n', '{"type":"done","total":2}\n']), (m) => seen.push(m));
    expect(seen.map((m) => m.n)).toEqual([1, 2]);
    expect(done.total).toBe(2);
  });

  it('turns an error line into an error with the server message', async () => {
    await expect(readNdjson(streamOf(['{"type":"error","error":"boom"}\n']), () => {})).rejects.toThrow('boom');
  });

  it('a stream that ends without "done" was cut', async () => {
    await expect(readNdjson(streamOf(['{"type":"clients"}\n']), () => {})).rejects.toBeInstanceOf(StreamCutError);
  });

  it('gives up on a silent stream', async () => {
    const silent = new ReadableStream<Uint8Array>({ start() {} });
    await expect(readNdjson(silent, () => {}, 20)).rejects.toBeInstanceOf(StreamCutError);
  });
});
