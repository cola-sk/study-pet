const CACHE_PREFIX = 'study_pet_cache_v1';

function storageKey(userId: string, key: string): string {
  return `${CACHE_PREFIX}:${userId}:${key}`;
}

/** Read a user-scoped JSON value from localStorage, returning null on miss or error. */
export function readUserCache<T>(userId: string, key: string): T | null {
  if (!userId || typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(storageKey(userId, key));
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/** Persist a user-scoped JSON value to localStorage, ignoring storage quota/access errors. */
export function writeUserCache<T>(userId: string, key: string, value: T): void {
  if (!userId || typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(storageKey(userId, key), JSON.stringify(value));
  } catch {
    // Ignore storage quota or private-mode access errors.
  }
}

/** Remove all cached entries belonging to a specific user. */
export function clearUserCache(userId: string): void {
  if (!userId || typeof window === 'undefined') return;
  try {
    const prefix = `${CACHE_PREFIX}:${userId}:`;
    const toRemove: string[] = [];
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (key && key.startsWith(prefix)) toRemove.push(key);
    }
    for (const key of toRemove) window.localStorage.removeItem(key);
  } catch {
    // Ignore storage access errors.
  }
}
