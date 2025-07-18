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
 * Create Redis client configuration optimized for Upstash and enterprise use
 */
function createRedisConfig(): RedisConfig {
  const redisUrl = process.env.REDIS_URL;
  
  if (redisUrl) {
    // Enhanced configuration for REDIS_URL
    const config: RedisConfig = {
      maxRetriesPerRequest: null,    // Required for BullMQ
      retryDelayOnFailover: 2000,    // 2s retry delay to reduce frequency
      lazyConnect: true,             // Connect only when needed
      
      // Upstash Redis performance optimizations
      keepAlive: 60000,              // 60s keep-alive to reduce connection overhead
      connectTimeout: 8000,          // 8s connection timeout
      
      // Connection pooling optimized for Redis request limits
      family: 4,                     // IPv4
      enableAutoPipelining: false,   // Disable auto-pipelining to reduce request count
      maxLoadingTimeout: 10000,      // 10s max loading timeout
      
      // Upstash-specific optimizations for request efficiency
      commandTimeout: 8000,          // 8s command timeout
      enableOfflineQueue: false,     // Disable offline queue for immediate errors
    };
    
    // Automatic TLS detection for cloud Redis services
    if (redisUrl.includes('upstash.io') || 
        redisUrl.includes('redis.cloud') || 
        redisUrl.includes('redislabs.com') ||
        redisUrl.startsWith('rediss://')) {
      config.tls = {
        checkServerIdentity: () => undefined // Skip hostname verification for Upstash
      };
      logger.info('Redis TLS enabled with cloud optimizations', {
        provider: redisUrl.includes('upstash.io') ? 'Upstash' : 'Cloud Redis',
        optimizations: ['TLS', 'Auto-pipelining', 'Connection pooling']
      });
    }
    
    return config;
  }
  
  // Fallback to individual parameters with performance optimizations
  return {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
    username: process.env.REDIS_USERNAME,
    db: parseInt(process.env.REDIS_DB || '0'),
    
    // Performance settings optimized for Redis request limits
    maxRetriesPerRequest: null,    // Required for BullMQ
    retryDelayOnFailover: 2000,    // 2s retry delay to reduce frequency
    lazyConnect: true,             // Only connect when needed
    keepAlive: 60000,              // 60s keep-alive to reduce connection overhead
    connectTimeout: 8000,          // 8s connection timeout
    enableAutoPipelining: false,   // Disable auto-pipelining to reduce request count
    commandTimeout: 8000,          // 8s command timeout
    enableOfflineQueue: false      // Disable offline queue for immediate errors
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
 * Wait for Redis client to be ready with timeout
 * This solves the race condition where validators check Redis status
 * before the client has finished connecting
 */
export function waitForRedisReady(timeout = 5000): Promise<void> {
  return new Promise((resolve, reject) => {
    // If already ready, resolve immediately
    if (redisClient.status === 'ready') {
      return resolve();
    }

    const readyHandler = () => {
      clearTimeout(timer);
      redisClient.removeListener('error', errorHandler);
      resolve();
    };

    const errorHandler = (err: Error) => {
      clearTimeout(timer);
      redisClient.removeListener('ready', readyHandler);
      reject(new Error(`Redis connection failed: ${err.message}`));
    };

    const timer = setTimeout(() => {
      redisClient.removeListener('ready', readyHandler);
      redisClient.removeListener('error', errorHandler);
      reject(new Error('Redis connection timed out'));
    }, timeout);

    redisClient.once('ready', readyHandler);
    redisClient.once('error', errorHandler);
  });
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