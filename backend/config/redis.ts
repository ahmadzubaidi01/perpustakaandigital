import { createClient, RedisClientType } from 'redis';
import env from './environment';
import logger from '../utils/logger';

let redisClient: RedisClientType;
let lastErrorLoggedTime = 0;
let lastReconnectingLoggedTime = 0;
let lastAttemptLoggedTime = 0;
const LOG_COOLDOWN_MS = 300000; // 5 minutes (300,000 ms)

const initRedis = async (): Promise<RedisClientType> => {
  redisClient = createClient({
    socket: {
      host: env.REDIS_HOST,
      port: env.REDIS_PORT,
      reconnectStrategy: (retries: number) => {
        // Slow down retries exponentially to avoid high CPU and infinite rapid logs loop
        if (retries > 5) {
          const now = Date.now();
          if (now - lastAttemptLoggedTime > LOG_COOLDOWN_MS) {
            logger.warn(`Redis: Reconnection attempt #${retries}. Retrying in 15s to prevent logs loop.`);
            lastAttemptLoggedTime = now;
          }
          return 15000; // Wait 15 seconds between retries after 5 attempts
        }
        return Math.min(retries * 500, 5000);
      },
      connectTimeout: 3000, // Timeout after 3 seconds to avoid hanging startup
    },
    password: env.REDIS_PASSWORD || undefined,
    database: env.REDIS_DB,
  });

  redisClient.on('connect', () => {
    logger.info('Redis: Connected successfully');
    // Reset cooldowns on successful connection
    lastErrorLoggedTime = 0;
    lastReconnectingLoggedTime = 0;
    lastAttemptLoggedTime = 0;
  });

  redisClient.on('error', (err) => {
    // Only log as warning to prevent winston from classifying it as fatal unhandled error in some flows
    const now = Date.now();
    if (now - lastErrorLoggedTime > LOG_COOLDOWN_MS) {
      logger.warn('Redis: Connection error', { error: err.message });
      lastErrorLoggedTime = now;
    }
  });

  redisClient.on('reconnecting', () => {
    const now = Date.now();
    if (now - lastReconnectingLoggedTime > LOG_COOLDOWN_MS) {
      logger.warn('Redis: Reconnecting...');
      lastReconnectingLoggedTime = now;
    }
  });

  // Non-blocking connection boot: execute connect in the background
  // to prevent block/hanging of the main server startup when Redis is down
  Promise.resolve().then(async () => {
    try {
      await redisClient.connect();
    } catch (err: any) {
      logger.warn('Redis: Initial background connection attempt failed. Running without cache.', { error: err.message });
    }
  });

  return redisClient;
};

const getRedisClient = (): RedisClientType | null => {
  if (!env.REDIS_ENABLED || !redisClient || !redisClient.isReady) {
    return null;
  }
  return redisClient;
};

/**
 * Build a prefixed Redis key.
 */
const buildKey = (key: string): string => {
  return `${env.REDIS_KEY_PREFIX}${key}`;
};

/**
 * Set a value with optional TTL (seconds).
 */
const setCache = async (key: string, value: unknown, ttlSeconds?: number): Promise<void> => {
  try {
    const client = getRedisClient();
    if (!client) return;
    const prefixedKey = buildKey(key);
    const serialized = JSON.stringify(value);

    if (ttlSeconds) {
      await client.setEx(prefixedKey, ttlSeconds, serialized);
    } else {
      await client.set(prefixedKey, serialized);
    }
  } catch (err: any) {
    logger.warn('Redis: Failed to set cache', { key, error: err.message });
  }
};

/**
 * Get a cached value.
 */
const getCache = async <T = unknown>(key: string): Promise<T | null> => {
  try {
    const client = getRedisClient();
    if (!client) return null;
    const prefixedKey = buildKey(key);
    const data = await client.get(prefixedKey);

    if (!data) return null;
    return JSON.parse(data) as T;
  } catch (err: any) {
    logger.warn('Redis: Failed to get cache', { key, error: err.message });
    return null;
  }
};

/**
 * Delete a cached value.
 */
const deleteCache = async (key: string): Promise<void> => {
  try {
    const client = getRedisClient();
    if (!client) return;
    const prefixedKey = buildKey(key);
    await client.del(prefixedKey);
  } catch (err: any) {
    logger.warn('Redis: Failed to delete cache', { key, error: err.message });
  }
};

/**
 * Delete all cached values matching a pattern.
 * Used for cache invalidation after data mutations.
 */
const deleteCachePattern = async (pattern: string): Promise<void> => {
  try {
    const client = getRedisClient();
    if (!client) return;
    const prefixedPattern = buildKey(pattern);
    let cursor = '0';

    do {
      const result = await client.scan(cursor, { MATCH: prefixedPattern, COUNT: 100 });
      cursor = result.cursor;

      if (result.keys.length > 0) {
        await client.del(result.keys);
      }
    } while (cursor !== '0');
  } catch (err: any) {
    logger.warn('Redis: Failed to delete cache pattern', { pattern, error: err.message });
  }
};

/**
 * Check if Redis is healthy.
 */
const isRedisHealthy = async (): Promise<boolean> => {
  try {
    const client = getRedisClient();
    if (!client) return false;
    const pong = await client.ping();
    return pong === 'PONG';
  } catch {
    return false;
  }
};

export {
  initRedis,
  getRedisClient,
  buildKey,
  setCache,
  getCache,
  deleteCache,
  deleteCachePattern,
  isRedisHealthy,
};
