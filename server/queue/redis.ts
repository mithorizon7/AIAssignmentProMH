import { Redis, RedisOptions } from 'ioredis';
import { EventEmitter } from 'events';
import { queueLogger as logger } from '../lib/logger';

/**
 * Enhanced Redis client factory with fallback to mock implementation
 * Provides a real Redis client for production use and graceful fallback for development
 */

// Configuration disabled - using only Upstash Redis via REST API
const REDIS_CONFIG = {
  // Legacy configuration removed - system now uses only Upstash Redis
};

// Mock Redis client for development environments without Redis
class MockRedisClient extends EventEmitter {
  private storage: Map<string, string> = new Map();
  private lists: Map<string, string[]> = new Map();
  private sets: Map<string, Set<string>> = new Map();
  private sortedSets: Map<string, Map<string, number>> = new Map();
  
  constructor() {
    super();
    logger.warn('Using mock Redis client - NOT SUITABLE FOR PRODUCTION', {
      setup_instructions: [
        'Install Redis locally or use a cloud service',
        'Set REDIS_URL or individual REDIS_* environment variables'
      ]
    });
    this.emit('connect');
  }
  
  // Basic key operations
  async get(key: string): Promise<string | null> {
    return this.storage.get(key) || null;
  }
  
  async set(key: string, value: string): Promise<'OK'> {
    this.storage.set(key, value);
    return 'OK';
  }
  
  async del(key: string): Promise<number> {
    const deleted = this.storage.delete(key);
    return deleted ? 1 : 0;
  }
  
  // List operations
  async lpush(key: string, ...values: string[]): Promise<number> {
    if (!this.lists.has(key)) {
      this.lists.set(key, []);
    }
    const list = this.lists.get(key)!;
    values.forEach(v => list.unshift(v));
    return list.length;
  }
  
  async rpush(key: string, ...values: string[]): Promise<number> {
    if (!this.lists.has(key)) {
      this.lists.set(key, []);
    }
    const list = this.lists.get(key)!;
    values.forEach(v => list.push(v));
    return list.length;
  }
  
  async lpop(key: string): Promise<string | null> {
    const list = this.lists.get(key);
    if (!list || list.length === 0) return null;
    return list.shift() || null;
  }
  
  async rpop(key: string): Promise<string | null> {
    const list = this.lists.get(key);
    if (!list || list.length === 0) return null;
    return list.pop() || null;
  }
  
  async lrange(key: string, start: number, stop: number): Promise<string[]> {
    const list = this.lists.get(key);
    if (!list) return [];
    
    // Handle negative indices like Redis does
    let actualStart = start < 0 ? list.length + start : start;
    let actualStop = stop < 0 ? list.length + stop : stop;
    
    // Clamp to array bounds
    actualStart = Math.max(0, Math.min(list.length - 1, actualStart));
    actualStop = Math.max(0, Math.min(list.length - 1, actualStop));
    
    return actualStop >= actualStart 
      ? list.slice(actualStart, actualStop + 1) 
      : [];
  }
  
  // Set operations
  async sadd(key: string, ...members: string[]): Promise<number> {
    if (!this.sets.has(key)) {
      this.sets.set(key, new Set());
    }
    const set = this.sets.get(key)!;
    const sizeBefore = set.size;
    members.forEach(m => set.add(m));
    return set.size - sizeBefore;
  }
  
  async srem(key: string, ...members: string[]): Promise<number> {
    const set = this.sets.get(key);
    if (!set) return 0;
    let removed = 0;
    members.forEach(m => {
      if (set.delete(m)) removed++;
    });
    return removed;
  }
  
  async smembers(key: string): Promise<string[]> {
    const set = this.sets.get(key);
    if (!set) return [];
    return Array.from(set);
  }
  
  // Sorted set operations
  async zadd(key: string, score: number, member: string): Promise<number> {
    if (!this.sortedSets.has(key)) {
      this.sortedSets.set(key, new Map());
    }
    const zset = this.sortedSets.get(key)!;
    const existed = zset.has(member);
    zset.set(member, score);
    return existed ? 0 : 1;
  }
  
  async zcard(key: string): Promise<number> {
    const zset = this.sortedSets.get(key);
    return zset ? zset.size : 0;
  }
  
  // Mock for graceful shutdown
  async quit(): Promise<'OK'> {
    return 'OK';
  }
  
  // For BullMQ compatibility
  async client(command: string, ...args: any[]): Promise<any> {
    return 'OK';
  }
}

// Function to create a properly configured Redis client for Upstash
function createRedisClient() {
  try {
    const redisUrl = process.env.REDIS_URL;
    const redisToken = process.env.REDIS_TOKEN;
    
    if (redisUrl?.includes('upstash.io') && redisToken) {
      // Parse Upstash Redis URL
      const url = new URL(redisUrl);
      
      // Create ioredis client with proper TLS configuration for Upstash
      const redisOptions: RedisOptions = {
        host: url.hostname,
        port: parseInt(url.port) || 6380,
        password: redisToken,
        tls: {
          // Upstash requires TLS connection
        },
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
        lazyConnect: false,
        connectTimeout: 30000,
        commandTimeout: 10000,
        family: 4
      };
      
      const redisClient = new Redis(redisOptions);
      
      // Handle connection events
      redisClient.on('connect', () => {
        logger.info('Successfully connected to Upstash Redis via ioredis');
      });
      
      redisClient.on('ready', () => {
        logger.info('Upstash Redis connection ready for BullMQ');
      });
      
      redisClient.on('error', (err: any) => {
        logger.error('Upstash Redis connection error', { 
          error: err.message,
          code: err.code
        });
      });
      
      logger.info('Configured ioredis client for Upstash Redis', {
        host: url.hostname,
        port: parseInt(url.port) || 6380,
        tls: true
      });
      
      return redisClient;
    }
    
    // Fallback to mock for development without proper Redis configuration
    logger.warn('No Upstash Redis configuration found, using mock client');
    return new MockRedisClient();
  } catch (error: any) {
    const isProd = process.env.NODE_ENV === 'production';
    logger.error(`Failed to connect to Redis${isProd ? ' - CRITICAL FOR PRODUCTION' : ''}`, { 
      error: error.message, 
      code: error.code,
      environment: process.env.NODE_ENV || 'development',
      resolution: isProd 
        ? 'Provide valid Redis credentials in environment variables for production deployment' 
        : 'Development can continue with mock Redis',
      fallback: isProd ? 'Using mock implementation (NOT RECOMMENDED FOR PRODUCTION)' : 'Using mock implementation'
    });
    
    // If we're in production, display an additional critical warning
    if (isProd) {
      logger.error('CRITICAL WARNING: Running in production with mock Redis', {
        impact: 'Jobs will not persist between restarts and cannot be distributed across instances',
        recommendation: 'Provide valid Redis credentials via REDIS_URL or individual REDIS_* environment variables'
      });
    }
    
    return new MockRedisClient();
  }
}

// Create a Redis client lazily (with production mode or mock fallback)
let redisClient: any = null;

function getRedisClient() {
  if (!redisClient) {
    redisClient = createRedisClient();
  }
  return redisClient;
}

// Function to create connection options for BullMQ
export function createRedisClientOptions() {
  return {
    connection: getRedisClient(),
    // Ensure maxRetriesPerRequest is explicitly set to null
    // This is required for compatibility with many Redis providers
    maxRetriesPerRequest: null
  };
}

// Export connection options for BullMQ
export const connectionOptions = createRedisClientOptions();

export default getRedisClient();