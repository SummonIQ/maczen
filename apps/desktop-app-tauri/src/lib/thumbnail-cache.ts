type ThumbnailCacheEntry = {
  dataUrl: string;
  lastAccessedAt: number;
  bytes: number;
};

const CACHE_TTL_MS = 30 * 60 * 1000;
const CLEANUP_INTERVAL_MS = 3 * 60 * 1000;
const MAX_CACHE_ENTRIES = 900;
const MAX_CACHE_BYTES = 192 * 1024 * 1024;
const MAX_CONCURRENT_THUMBNAIL_REQUESTS = 6;

const thumbnailCache = new Map<string, ThumbnailCacheEntry>();
const inFlightLoads = new Map<string, Promise<string | null>>();

type QueueEntry = { execute: () => void; cancelled: boolean };
const thumbnailLoadQueue: QueueEntry[] = [];

let activeThumbnailRequests = 0;
let cleanupTimerStarted = false;

const estimateBytes = (dataUrl: string) => dataUrl.length * 2;

const getTotalCacheBytes = () => {
  let total = 0;
  for (const entry of thumbnailCache.values()) {
    total += entry.bytes;
  }
  return total;
};

const runNextThumbnailRequest = () => {
  while (
    thumbnailLoadQueue.length > 0 &&
    activeThumbnailRequests < MAX_CONCURRENT_THUMBNAIL_REQUESTS
  ) {
    const next = thumbnailLoadQueue.shift();
    if (next && !next.cancelled) {
      next.execute();
      return;
    }
  }
};

const queueThumbnailRequest = <T>(fn: () => Promise<T>): { promise: Promise<T>; cancel: () => void } => {
  let queueEntry: QueueEntry | null = null;

  const promise = new Promise<T>((resolve, reject) => {
    const execute = async () => {
      activeThumbnailRequests++;
      try {
        resolve(await fn());
      } catch (error) {
        reject(error);
      } finally {
        activeThumbnailRequests--;
        runNextThumbnailRequest();
      }
    };

    if (activeThumbnailRequests < MAX_CONCURRENT_THUMBNAIL_REQUESTS) {
      void execute();
    } else {
      queueEntry = { execute, cancelled: false };
      thumbnailLoadQueue.push(queueEntry);
    }
  });

  const cancel = () => {
    if (queueEntry) queueEntry.cancelled = true;
  };

  return { promise, cancel };
};

export const getCachedThumbnail = (path: string): string | null => {
  const cached = thumbnailCache.get(path);
  if (!cached) return null;
  cached.lastAccessedAt = Date.now();
  return cached.dataUrl;
};

export const setCachedThumbnail = (path: string, dataUrl: string) => {
  thumbnailCache.set(path, {
    dataUrl,
    lastAccessedAt: Date.now(),
    bytes: estimateBytes(dataUrl),
  });
};

export const deleteCachedThumbnail = (path: string) => {
  thumbnailCache.delete(path);
};

export const cleanupThumbnailCache = () => {
  const now = Date.now();
  for (const [path, entry] of thumbnailCache.entries()) {
    if (now - entry.lastAccessedAt > CACHE_TTL_MS) {
      thumbnailCache.delete(path);
    }
  }

  if (
    thumbnailCache.size <= MAX_CACHE_ENTRIES &&
    getTotalCacheBytes() <= MAX_CACHE_BYTES
  ) {
    return;
  }

  const entries = Array.from(thumbnailCache.entries()).sort(
    (a, b) => a[1].lastAccessedAt - b[1].lastAccessedAt,
  );
  let totalBytes = getTotalCacheBytes();

  for (const [path, entry] of entries) {
    if (
      thumbnailCache.size <= MAX_CACHE_ENTRIES &&
      totalBytes <= MAX_CACHE_BYTES
    ) {
      break;
    }
    thumbnailCache.delete(path);
    totalBytes -= entry.bytes;
  }
};

const ensureCleanupTimer = () => {
  if (cleanupTimerStarted) return;
  cleanupTimerStarted = true;
  if (typeof window !== "undefined") {
    window.setInterval(cleanupThumbnailCache, CLEANUP_INTERVAL_MS);
  }
};

ensureCleanupTimer();

export const getOrLoadThumbnail = (
  path: string,
  loader: () => Promise<string | null>,
): { promise: Promise<string | null>; cancel: () => void } => {
  const cached = getCachedThumbnail(path);
  if (cached) return { promise: Promise.resolve(cached), cancel: () => {} };

  const inFlight = inFlightLoads.get(path);
  if (inFlight) return { promise: inFlight, cancel: () => {} };

  const { promise, cancel } = queueThumbnailRequest(async () => {
    const freshCached = getCachedThumbnail(path);
    if (freshCached) return freshCached;
    const loaded = await loader();
    if (loaded) {
      setCachedThumbnail(path, loaded);
    }
    return loaded;
  });

  const tracked = promise.finally(() => {
    inFlightLoads.delete(path);
  });

  inFlightLoads.set(path, tracked);
  return { promise: tracked, cancel };
};
