export interface VideoLoaderOptions {
  signal?: AbortSignal;
  onProgress?: (progress: { received: number; total: number }) => void;
}

export interface BlobLoaderResult {
  objectUrl: string;
  revoke: () => void;
}

export interface MSELoaderResult {
  mediaSource: MediaSource;
  objectUrl: string;
  teardown: () => Promise<void>;
}

export type AutoLoaderResult = {
  mode: 'blob' | 'mse' | 'direct';
  attach: (videoEl: HTMLVideoElement) => void;
  teardown: () => Promise<void>;
};

export interface TelemetryEvent {
  name:
    | 'dns_connect_start'
    | 'dns_connect_end'
    | 'first_byte'
    | 'first_append'
    | 'metadata_loaded'
    | 'canplay'
    | 'play_start'
    | 'rebuffer_start'
    | 'rebuffer_end';
  timestamp: number;
}
