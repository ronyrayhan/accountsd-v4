const redis = require('redis');
const { logger } = require('./logger');

let redisClient = null;
let isRedisAvailable = false;

/**
 * Initialize Redis connection
 * Gracefully degrades if Redis is unavailable
 */
const initRedis = async () => {
    try {
        const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

        redisClient = redis.createClient({
            url: redisUrl,
            socket: {
                connectTimeout: 5000,
                reconnectStrategy: (retries) => {
                    if (retries > 3) {
                        logger.warn('Redis reconnection attempts exhausted, running without cache');
                        return false; // Stop reconnecting
                    }
                    return Math.min(retries * 100, 3000);
                }
            }
        });

        redisClient.on('error', (err) => {
            logger.error('Redis Client Error', { error: err.message });
            isRedisAvailable = false;
        });

        redisClient.on('connect', () => {
            logger.info('Redis connected successfully');
            isRedisAvailable = true;
        });

        redisClient.on('ready', () => {
            logger.info('Redis client ready');
            isRedisAvailable = true;
        });

        await redisClient.connect();
    } catch (error) {
        logger.warn('Redis initialization failed, running without cache', { error: error.message });
        isRedisAvailable = false;
    }
};

/**
 * Get value from cache
 * @param {string} key - Cache key
 * @returns {Promise<any|null>} - Parsed value or null
 */
const getCache = async (key) => {
    if (!isRedisAvailable || !redisClient) return null;

    try {
        const value = await redisClient.get(key);
        return value ? JSON.parse(value) : null;
    } catch (error) {
        logger.error('Cache get error', { key, error: error.message });
        return null;
    }
};

/**
 * Set value in cache
 * @param {string} key - Cache key
 * @param {any} value - Value to cache
 * @param {number} ttl - Time to live in seconds (default: 300)
 */
const setCache = async (key, value, ttl = 300) => {
    if (!isRedisAvailable || !redisClient) return;

    try {
        await redisClient.setEx(key, ttl, JSON.stringify(value));
    } catch (error) {
        logger.error('Cache set error', { key, error: error.message });
    }
};

/**
 * Delete value from cache
 * @param {string} key - Cache key
 */
const delCache = async (key) => {
    if (!isRedisAvailable || !redisClient) return;

    try {
        await redisClient.del(key);
    } catch (error) {
        logger.error('Cache delete error', { key, error: error.message });
    }
};

/**
 * Delete all keys matching a pattern
 * @param {string} pattern - Key pattern (e.g., 'user:*')
 */
const delCachePattern = async (pattern) => {
    if (!isRedisAvailable || !redisClient) return;

    try {
        const keys = await redisClient.keys(pattern);
        if (keys.length > 0) {
            await redisClient.del(keys);
        }
    } catch (error) {
        logger.error('Cache pattern delete error', { pattern, error: error.message });
    }
};

module.exports = {
    initRedis,
    getCache,
    setCache,
    delCache,
    delCachePattern,
    isRedisAvailable: () => isRedisAvailable
};
