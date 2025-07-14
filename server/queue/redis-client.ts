/**
 * Centralized Redis Client Configuration
 * 
 * This is the ONLY file that should create Redis connections in the entire application.
 * All other modules must import the client from this file.
 * 
 * Features:
 * - Single point of configuration
 * - Automatic TLS detection for Upstash/Redis Cloud
 * - Proper BullMQ compatibility
 * - Connection health monitoring
 * - Graceful error handling
 */

import IORedis from 'ioredis';
import { logger } from '../lib/logger';

export interface RedisConfig {
  url?: string;
  host?: string;
  port?: number;
  password?: string;
  username?: string;
  db?: number;
  maxRetriesPerRequest?: number | null;
  retryDelayOnFailover?: number;
  lazyConnect?: boolean;
  tls?: any;
}

/**
 * Create Redis client configuration based on environment variables
 */
function createRedisConfig(): RedisConfig {
  const redisUrl = process.env.REDIS_URL;
  
  if (redisUrl) {
    // Use REDIS_URL if provided
    const config: RedisConfig = {
      maxRetriesPerRequest: null, // Required for BullMQ
      retryDelayOnFailover: 100,
      lazyConnect: true
    };
    
    // Automatic TLS detection for cloud Redis services
    if (redisUrl.includes('upstash.io') || 
        redisUrl.includes('redis.cloud') || 
        redisUrl.includes('redislabs.com') ||
        redisUrl.startsWith('rediss://')) {
      config.tls = {};
      logger.info('Redis TLS enabled (cloud service detected)');
    }
    
    return config;
  }
  
  // Fallback to individual parameters
  return {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
    username: process.env.REDIS_USERNAME,
    db: parseInt(process.env.REDIS_DB || '0'),
    maxRetriesPerRequest: null, // Required for BullMQ
    retryDelayOnFailover: 100,
    lazyConnect: true
  };
}

/**
 * Create and configure the central Redis client
 */
function createRedisClient(): IORedis {
  const config = createRedisConfig();
  const redisUrl = process.env.REDIS_URL;
  
  let client: IORedis;
  
  if (redisUrl) {
    client = new IORedis(redisUrl, config);
  } else {
    client = new IORedis(config);
  }
  
  // Connection event logging
  client.on('connect', () => {
    logger.info('Redis client connected', {
      host: config.host || 'URL-based',
      port: config.port || 'URL-based',
      tls: !!config.tls
    });
  });
  
  client.on('ready', () => {
    logger.info('Redis client ready for commands');
  });
  
  client.on('error', (error) => {
    logger.error('Redis client error', {
      error: error.message,
      code: error.code || 'UNKNOWN'
    });
  });
  
  client.on('close', () => {
    logger.warn('Redis connection closed');
  });
  
  client.on('reconnecting', (delay) => {
    logger.info('Redis reconnecting', { delay });
  });
  
  return client;
}

/**
 * The single Redis client instance for the entire application
 * All modules MUST use this client instead of creating their own
 */
export const redisClient = createRedisClient();

/**
 * Helper function for graceful Redis operations with error handling
 */
export async function safeRedisOperation<T>(
  operation: () => Promise<T>,
  fallbackValue: T,
  operationName: string
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    logger.error(`Redis operation failed: ${operationName}`, {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return fallbackValue;
  }
}

/**
 * Check if Redis is available and ready
 */
export function isRedisReady(): boolean {
  return redisClient.status === 'ready';
}

/**
 * Get Redis connection status information
 */
export function getRedisStatus() {
  return {
    status: redisClient.status,
    uptime: redisClient.uptime,
    commandQueueLength: redisClient.commandQueue.length,
    connectedAt: redisClient.connectedAt
  };
}

/**
 * Export the default client (for backward compatibility)
 */
export default redisClient;