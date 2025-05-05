interface CacheConfig {
  ttl?: number;
  validate?: (data: any) => boolean;
}

interface FetchConfig extends RequestInit {
  cacheOptions?: {
    session?: boolean | CacheConfig;
    local?: boolean | CacheConfig;
    forceFresh?: boolean;
    keyBuilder?: (url: string, options?: RequestInit) => string;
    customKey?: string;
  };
}

const ongoingRequests = new Map<string, Promise<any>>();

// Function overload signatures
export function localSessionFallbackFetch<T>(
  url: string,
  customKey: string
): Promise<T>;
export function localSessionFallbackFetch<T>(
  url: string,
  options?: FetchConfig
): Promise<T>;
export function localSessionFallbackFetch<T>(
  url: string,
  options?: any
): Promise<T> {
  // Handle simplified syntax
  const config: FetchConfig =
    typeof options === "string"
      ? {
          cacheOptions: {
            customKey: options,
            session: true,
            local: true,
          },
        }
      : options || {};

  const { cacheOptions = {}, ...fetchOptions } = config;

  // Configuration defaults
  const {
    session = true,
    local = true,
    forceFresh = false,
    keyBuilder = defaultKeyBuilder,
    customKey,
  } = cacheOptions;

  const cacheKey = customKey || keyBuilder(url, fetchOptions);
  const requestController = new AbortController();

  async function executeRequest(): Promise<T> {
    try {
      let cachedData: T | null = null;

      if (!forceFresh) {
        // Try session storage first
        if (session) {
          cachedData = getValidatedCache<T>(cacheKey, "session", session);
        }

        // Fallback to local storage
        if (!cachedData && local) {
          cachedData = getValidatedCache<T>(cacheKey, "local", local);
        }
      }

      if (cachedData) {
        // Refresh cache in background if stale
        if (isCacheExpired(cacheKey, "local")) {
          setTimeout(
            () =>
              localSessionFallbackFetch(url, {
                ...config,
                cacheOptions: { ...cacheOptions, forceFresh: true },
              }),
            0
          );
        }
        return cachedData;
      }

      const response = await fetch(url, {
        ...fetchOptions,
        signal: requestController.signal,
      });

      return handleNetworkResponse(response);
    } catch (error) {
      if (isCachedDataAvailable(cacheKey)) {
        return getFallbackData(cacheKey);
      }
      throw new Error(`Request failed: ${(error as Error).message}`);
    }
  }

  async function handleNetworkResponse(response: Response): Promise<T> {
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

    const data = (await response.json()) as T;
    console.log("Data fetched:", data);

    // Cache the new data
    try {
      if (session) {
        setCache(cacheKey, data, "session", session);
      }
      if (local) {
        setCache(cacheKey, data, "local", local);
      }
    } catch (storageError) {
      console.warn("Storage quota exceeded", storageError);
    }

    return data;
  }

  // Concurrent request deduplication
  if (!ongoingRequests.has(cacheKey)) {
    ongoingRequests.set(cacheKey, executeRequest());
  }

  return ongoingRequests.get(cacheKey)!.finally(() => {
    ongoingRequests.delete(cacheKey);
    requestController.abort();
  });
}

// Helper functions
function getValidatedCache<T>(
  key: string,
  storageType: "session" | "local",
  config: boolean | CacheConfig
): T | null {
  const storage = storageType === "session" ? sessionStorage : localStorage;
  const entry = storage.getItem(key);

  if (!entry) return null;

  try {
    const { data, timestamp } = JSON.parse(entry);
    const { ttl, validate } = typeof config === "object" ? config : {};

    if (ttl && Date.now() - timestamp > ttl) {
      storage.removeItem(key);
      return null;
    }

    if (validate && !validate(data)) {
      storage.removeItem(key);
      return null;
    }

    console.log(`Data fetched from ${storageType} storage:`, data);
    return data;
  } catch (error) {
    storage.removeItem(key);
    return null;
  }
}

function setCache(
  key: string,
  data: any,
  storageType: "session" | "local",
  config: boolean | CacheConfig
): void {
  const storage = storageType === "session" ? sessionStorage : localStorage;
  const entry = JSON.stringify({
    data,
    timestamp: Date.now(),
    ...(typeof config === "object" ? { ttl: config.ttl } : {}),
  });

  try {
    storage.setItem(key, entry);
  } catch (error) {
    clearExpiredEntries(storage);
    storage.setItem(key, entry);
  }
}

function isCacheExpired(
  key: string,
  storageType: "session" | "local"
): boolean {
  const storage = storageType === "session" ? sessionStorage : localStorage;
  const entry = storage.getItem(key);

  if (!entry) return true;

  try {
    const { timestamp, ttl } = JSON.parse(entry);
    return ttl && Date.now() - timestamp > ttl;
  } catch {
    return true;
  }
}

function getFallbackData(key: string): any {
  const storages = [sessionStorage, localStorage];
  for (const storage of storages) {
    const entry = storage.getItem(key);
    if (entry) {
      try {
        return JSON.parse(entry).data;
      } catch {
        storage.removeItem(key);
      }
    }
  }
  throw new Error("No cached data available");
}

function isCachedDataAvailable(key: string): boolean {
  return [sessionStorage, localStorage].some((storage) => storage.getItem(key));
}


function defaultKeyBuilder(url: string, options?: RequestInit): string {
  const optionsHash = options ? btoa(JSON.stringify(options)) : "";
  return `${url}|${optionsHash}`;
}

function clearExpiredEntries(storage: Storage): void {
  Object.keys(storage).forEach((key) => {
    try {
      const entry = storage.getItem(key);
      if (entry) {
        const { timestamp, ttl } = JSON.parse(entry);
        if (ttl && Date.now() - timestamp > ttl) {
          storage.removeItem(key);
        }
      }
    } catch {
      storage.removeItem(key);
    }
  });
}
