import type {
  VideoLoaderOptions,
  BlobLoaderResult,
  MSELoaderResult,
  AutoLoaderResult,
} from './types.js';

/**
 * Chooses the first supported MIME type from a list of candidates.
 * @param candidates - An array of MIME type strings.
 * @returns The first supported MIME type, or a default fallback.
 */
function chooseSupportedMime(candidates: string[]): string {
  for (const c of candidates) {
    if (window.MediaSource && MediaSource.isTypeSupported(c)) {
      return c;
    }
  }
  return 'video/mp4'; // Fallback
}

/**
 * Fetches a video as a Blob and creates an Object URL for it.
 * @param url - The URL of the video file.
 * @param options - Loader options, including an AbortSignal and progress callback.
 * @returns A promise that resolves to an object containing the Object URL and a revoke function.
 */
export async function loadVideoAsBlob(
  url: string,
  { signal, onProgress }: VideoLoaderOptions = {},
): Promise<BlobLoaderResult> {
  const res = await fetch(url, { mode: 'cors', signal });
  if (!res.ok) throw new Error(`HTTP error ${res.status}`);

  const contentLength = Number(res.headers.get('content-length')) || 0;
  const reader = res.body?.getReader();

  if (!reader) {
    // Fallback for environments without ReadableStream support
    const buf = await res.arrayBuffer();
    const blob = new Blob([buf], { type: 'video/mp4' });
    const objectUrl = URL.createObjectURL(blob);
    return { objectUrl, revoke: () => URL.revokeObjectURL(objectUrl) };
  }

  let received = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.byteLength;
    onProgress?.({ received, total: contentLength });
  }

  const blob = new Blob(chunks, { type: 'video/mp4' });
  const objectUrl = URL.createObjectURL(blob);
  return { objectUrl, revoke: () => URL.revokeObjectURL(objectUrl) };
}

/**
 * Loads a video using Media Source Extensions (MSE) for streaming.
 * @param url - The URL of the fMP4 video file.
 * @param options - Loader options.
 * @returns A promise that resolves to an object for managing the MSE source.
 */
export async function loadVideoWithMSE(
  url: string,
  { signal, onProgress }: VideoLoaderOptions = {},
): Promise<MSELoaderResult> {
  if (!('MediaSource' in window)) {
    throw new Error('Media Source Extensions API is not available.');
  }

  const ms = new MediaSource();
  const objectUrl = URL.createObjectURL(ms);

  const teardown = async () => {
    try {
      if (ms.readyState === 'open') {
        ms.endOfStream();
      }
    } catch (e) {
      console.error('Error during endOfStream:', e);
    }
    URL.revokeObjectURL(objectUrl);
  };

  const opened = new Promise<void>((resolve, reject) => {
    ms.addEventListener('sourceopen', () => resolve(), { once: true });
    ms.addEventListener('error', (e) => reject(new Error('MediaSource failed to open.')), { once: true });
  });

  const res = await fetch(url, { mode: 'cors', signal });
  if (!res.ok) throw new Error(`HTTP error ${res.status}`);
  const contentLength = Number(res.headers.get('content-length')) || 0;

  await opened;

  const mime = chooseSupportedMime([
    'video/mp4; codecs="avc1.42E01E, mp4a.40.2"',
    'video/mp4; codecs="avc1.4D401E, mp4a.40.2"',
    'video/mp4',
  ]);

  const sourceBuffer = ms.addSourceBuffer(mime);
  const queue: Uint8Array[] = [];
  let isAppending = false;

  const appendNext = () => {
    if (isAppending || queue.length === 0 || sourceBuffer.updating) return;
    isAppending = true;
    const chunk = queue.shift();
    if (chunk) {
      try {
        sourceBuffer.appendBuffer(chunk);
      } catch (e) {
        console.error('Error appending buffer:', e);
        isAppending = false;
        // Handle error, maybe reject a promise or emit an event
      }
    } else {
      isAppending = false;
    }
  };

  sourceBuffer.addEventListener('updateend', () => {
    isAppending = false;
    appendNext();
  });

  const reader = res.body!.getReader();
  let received = 0;

  (async () => {
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        queue.push(value);
        received += value.byteLength;
        onProgress?.({ received, total: contentLength });
        appendNext();
      }

      const endStreamWhenReady = () => {
        if (sourceBuffer.updating || queue.length > 0) {
          sourceBuffer.addEventListener('updateend', endStreamWhenReady, { once: true });
        } else if (ms.readyState === 'open') {
          ms.endOfStream();
        }
      };
      endStreamWhenReady();
    } catch (e) {
      console.error('Error reading stream:', e);
      // If the stream fails, the teardown process will handle cleanup.
      // There is no 'abort' method on MediaSource.
    }
  })();

  return {
    mediaSource: ms,
    objectUrl,
    teardown,
  };
}

/**
 * Automatically selects the best loading strategy (MSE, Blob, or direct URL).
 * @param url - The video URL.
 * @param options - Loader options.
 * @returns A promise resolving to an object for attaching the video and tearing down.
 */
export async function autoLoad(
  url: string,
  options: VideoLoaderOptions = {},
): Promise<AutoLoaderResult> {
  const video = document.createElement('video');
  const h264Supported =
    video.canPlayType('video/mp4; codecs="avc1.42E01E, mp4a.40.2"') ||
    video.canPlayType('video/mp4');
  const mseSupported = 'MediaSource' in window && MediaSource.isTypeSupported('video/mp4');

  // Prioritize direct loading
  try {
    // This is a conceptual check; in practice, direct assignment happens first.
    // If it fails, the other methods can be tried.
    return {
        mode: 'direct',
        attach: (el: HTMLVideoElement) => {
          el.src = url;
          el.playsInline = true;
        },
        teardown: async () => {
          /* no-op */
        },
      };
  } catch (e) {
    console.warn('Direct load failed, trying MSE.', e);
  }


  if (mseSupported) {
    try {
      const { objectUrl, teardown } = await loadVideoWithMSE(url, options);
      return {
        mode: 'mse',
        attach: (el: HTMLVideoElement) => {
          el.src = objectUrl;
          el.playsInline = true;
        },
        teardown,
      };
    } catch (e) {
      console.warn('MSE load failed, trying Blob.', e);
    }
  }

  if (h264Supported) {
    try {
      const { objectUrl, revoke } = await loadVideoAsBlob(url, options);
      return {
        mode: 'blob',
        attach: (el: HTMLVideoElement) => {
          el.src = objectUrl;
          el.playsInline = true;
        },
        teardown: async () => revoke(),
      };
    } catch (e) {
        console.warn('Blob load failed.', e);
    }
  }

  // This should not be reached if direct loading is prioritized, but serves as a final fallback.
  return {
    mode: 'direct',
    attach: (el: HTMLVideoElement) => {
      el.src = url;
      el.playsInline = true;
    },
    teardown: async () => {
      /* no-op */
    },
  };
}
