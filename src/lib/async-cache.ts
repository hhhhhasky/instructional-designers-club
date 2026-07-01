export interface AsyncCacheOptions<T> {
  key: string;
  ttlMs: number;
  storage?: "memory" | "session";
  fetcher: () => Promise<T>;
}

interface CacheEntry<T> {
  expiresAt: number;
  data: T;
}

export interface AsyncCache<T> {
  get: (options?: { fresh?: boolean }) => Promise<T>;
  clear: () => void;
  peek: () => T | null;
}

function canUseSessionStorage(): boolean {
  return typeof window !== "undefined" && typeof window.sessionStorage !== "undefined";
}

export function createAsyncCache<T>({
  key,
  ttlMs,
  storage = "memory",
  fetcher,
}: AsyncCacheOptions<T>): AsyncCache<T> {
  let memoryEntry: CacheEntry<T> | null = null;
  let pending: Promise<T> | null = null;

  const readSession = (): CacheEntry<T> | null => {
    if (storage !== "session" || !canUseSessionStorage()) return null;
    try {
      const raw = window.sessionStorage.getItem(key);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as CacheEntry<T>;
      if (!parsed.expiresAt || parsed.expiresAt <= Date.now()) {
        window.sessionStorage.removeItem(key);
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  };

  const writeSession = (entry: CacheEntry<T>) => {
    if (storage !== "session" || !canUseSessionStorage()) return;
    try {
      window.sessionStorage.setItem(key, JSON.stringify(entry));
    } catch {
      // Embedded browsers may block storage; memory cache still covers this render session.
    }
  };

  const clearSession = () => {
    if (storage !== "session" || !canUseSessionStorage()) return;
    try {
      window.sessionStorage.removeItem(key);
    } catch {
      // no-op
    }
  };

  const read = (): T | null => {
    const now = Date.now();
    if (memoryEntry && memoryEntry.expiresAt > now) return memoryEntry.data;
    const sessionEntry = readSession();
    if (sessionEntry) {
      memoryEntry = sessionEntry;
      return sessionEntry.data;
    }
    return null;
  };

  return {
    async get(options = {}) {
      if (options.fresh) {
        memoryEntry = null;
        clearSession();
      } else {
        const cached = read();
        if (cached) return cached;
        if (pending) return pending;
      }

      pending = (async () => {
        const data = await fetcher();
        const entry = { expiresAt: Date.now() + ttlMs, data };
        memoryEntry = entry;
        writeSession(entry);
        return data;
      })();

      try {
        return await pending;
      } finally {
        pending = null;
      }
    },
    clear() {
      memoryEntry = null;
      pending = null;
      clearSession();
    },
    peek() {
      return read();
    },
  };
}
