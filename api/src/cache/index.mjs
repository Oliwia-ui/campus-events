import { env } from '../config/env.mjs';
import { logger } from '../config/logger.mjs';
import { createMemoryCache } from './memoryCache.mjs';
import { createRedisCache } from './redisCache.mjs';

const store = env.redisUrl ? createRedisCache(env.redisUrl, logger) : createMemoryCache();

// The cache is an optimisation, never a reason for a request to fail. Every Redis error
// is logged and treated like "not in the cache", so a dead Redis only makes the API slower.
async function safely(action, fallback) {
  try {
    return await action();
  } catch (error) {
    logger.warn('cache unavailable, using the database', { error: error.message });
    return fallback;
  }
}

export const cache = {
  get: (key) => safely(() => store.get(key), undefined),
  set: (key, value) => safely(() => store.set(key, value, env.cacheTtlSeconds)),
  invalidate: (keys) => safely(() => store.del(keys)),
  clear: () => safely(() => store.clear()),
  close: () => store.close?.()
};

// Every cached GET response has one key. Writes delete the keys they make outdated.
export const cacheKeys = {
  eventList: () => 'events:list',
  event: (id) => `events:${id}`,
  registrations: (eventId) => `events:${eventId}:registrations`,
  stats: () => 'stats'
};
