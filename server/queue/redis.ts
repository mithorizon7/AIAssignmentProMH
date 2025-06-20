import IORedis from 'ioredis';
import { queueLogger as logger } from '../lib/logger';

// This should be the only place a Redis client is created.
// It must use the full REDIS_URL from the environment secrets, which
// starts with "rediss://" and contains the password.
const redisClient = new IORedis(process.env.REDIS_URL!, {
    // The tls object is mandatory for connecting to Upstash.
    tls: {},
    // This is a best practice for BullMQ compatibility.
    maxRetriesPerRequest: null
});

// Handle connection errors for logging.
redisClient.on('error', (err: any) => {
    logger.error('Redis Client Error', { error: err.message, code: err.code });
});

redisClient.on('connect', () => {
    logger.info('Successfully connected to Upstash Redis');
});

redisClient.on('ready', () => {
    logger.info('Upstash Redis connection ready for BullMQ');
});

// Export the single, correctly configured client for the rest of the app to use.
export default redisClient;

// Legacy exports for backward compatibility
export function getRedisClient() {
    return redisClient;
}

export function createRedisClientOptions() {
    return {
        connection: redisClient,
        maxRetriesPerRequest: null
    };
}