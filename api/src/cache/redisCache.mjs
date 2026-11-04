import { createClient } from 'redis';

const PREFIX = 'campus-events:'; // keeps our keys apart if the Redis server is shared

export function createRedisCache(url, logger) {
  const client = createClient({
    url,
    // While Redis is unreachable, fail commands immediately instead of queueing them:
    // the API then just answers from the database (see cache/index.mjs).
    disableOfflineQueue: true,
    socket: { reconnectStrategy: (retries) => Math.min(retries * 500, 10_000) }
  });
  // Without an 'error' listener a network error would crash the whole process.
  client.on('error', (error) => logger.warn('Redis error', { error: error.message }));
  client.on('ready', () => logger.info('Redis connected'));
  // Don't await: the API must start even when Redis is down. The client keeps reconnecting.
  client.connect().catch((error) => logger.warn('Redis connection failed', { error: error.message }));

  return {
    async get(key) {
      const json = await client.get(PREFIX + key);
      return json === null ? undefined : JSON.parse(json);
    },
    async set(key, value, ttlSeconds) {
      // EX = expire after this many seconds, Redis deletes the key by itself.
      await client.set(PREFIX + key, JSON.stringify(value), { EX: ttlSeconds });
    },
    async del(keys) {
      if (keys.length > 0) await client.del(keys.map((key) => PREFIX + key));
    },
    async clear() {
      for await (const batch of client.scanIterator({ MATCH: `${PREFIX}*` })) {
        if (batch.length > 0) await client.del(batch);
      }
    },
    close: () => client.close()
  };
}
