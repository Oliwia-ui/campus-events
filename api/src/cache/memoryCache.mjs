// Same interface as the Redis cache, kept in this process's memory.
// Used for local development and tests, so they don't need a Redis server.
// Values are stored as JSON strings, like in Redis, so a caller can't change a cached object by accident.
export function createMemoryCache() {
  const entries = new Map();

  return {
    async get(key) {
      const entry = entries.get(key);
      if (!entry) return undefined;
      if (entry.expiresAt < Date.now()) {
        entries.delete(key);
        return undefined;
      }
      return JSON.parse(entry.json);
    },
    async set(key, value, ttlSeconds) {
      entries.set(key, { json: JSON.stringify(value), expiresAt: Date.now() + ttlSeconds * 1000 });
    },
    async del(keys) {
      for (const key of keys) entries.delete(key);
    },
    async clear() {
      entries.clear();
    }
  };
}
