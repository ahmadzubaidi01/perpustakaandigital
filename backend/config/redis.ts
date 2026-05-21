import { createClient, RedisClientType } from 'redis';
import env from './environment';
import logger from '../utils/logger';

let redisClient: RedisClientType;

const initRedis = async (): Promise<RedisClientType> => {
  redisClient = createClient({
    socket: {
      host: env.REDIS_HOST,
      port: env.REDIS_PORT,
      reconnectStrategy: (retries: number) => {
        if (retries > 10) {
          logger.error('Redis: Max reconnection attempts reached');
          return new Error('Redis max reconnection attempts reached');
        }
        return Math.min(retries * 100, 3000);
      },
    },
    password: env.REDIS_PASSWORD || undefined,
    database: env.REDIS_DB,
  });

  redisClient.on('connect', () => {
    logger.info('Redis: Connected successfully');
  });

  redisClient.on('error', (err) => {
    logger.error('Redis: Connection error', { error: err.message });
  });

  redisClient.on('reconnecting', () => {
    logger.warn('Redis: Reconnecting...');
  });

  await redisClient.connect();
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
