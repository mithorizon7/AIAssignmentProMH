import { Redis } from 'ioredis';
import { EventEmitter } from 'events';

/**
 * Enhanced Redis client factory with fallback to mock implementation
 * Provides a real Redis client for production use and graceful fallback for development
 */

// Configuration for Redis connection
const REDIS_CONFIG = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD,
  username: process.env.REDIS_USERNAME,
  db: parseInt(process.env.REDIS_DB || '0', 10),
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  retryStrategy: (times: number) => {
    // Exponential backoff with a maximum of 10 seconds
    const delay = Math.min(times * 500, 10000);
    return delay;
  },
  // If using sentinel or cluster, add those configurations here
};

// Mock Redis client for development environments without Redis
class MockRedisClient extends EventEmitter {
  private storage: Map<string, string> = new Map();
  private lists: Map<string, string[]> = new Map();
  private sets: Map<string, Set<string>> = new Map();
  private sortedSets: Map<string, Map<string, number>> = new Map();
  
  constructor() {
    super();
    console.log('⚠️ WARNING: Using mock Redis client - NOT SUITABLE FOR PRODUCTION');
    console.log('To use a real Redis instance:');
    console.log('1. Install Redis locally or use a cloud service');
    console.log('2. Set REDIS_URL or individual REDIS_* environment variables');
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

// Function to create a Redis client with fallback capability
function createRedisClient() {
  // Force mock Redis in development unless explicitly configured
  const useRealRedis = process.env.REDIS_URL || 
                      (process.env.REDIS_HOST && process.env.NODE_ENV === 'production');
  
  if (!useRealRedis) {
    console.log('Development environment detected, using mock Redis implementation');
    return new MockRedisClient();
  }
  
  try {
    // Configure Redis client
    const redisUrl = process.env.REDIS_URL;
    const client = redisUrl 
      ? new Redis(redisUrl, { 
          maxRetriesPerRequest: 1, // Minimize retry attempts for faster fallback
          connectTimeout: 2000,    // Only wait 2 seconds before timing out
          enableOfflineQueue: false // Don't queue commands when disconnected
        }) 
      : new Redis(REDIS_CONFIG);
    
    // Add error handling
    client.on('error', (err) => {
      console.error('Redis connection error:', err);
    });
    
    client.on('connect', () => {
      console.log('✅ Connected to Redis server');
    });
    
    client.on('reconnecting', () => {
      console.log('⚠️ Reconnecting to Redis server...');
    });
    
    // Test connection immediately
    return client;
  } catch (error) {
    console.error('Failed to connect to Redis:', error);
    console.log('Falling back to mock implementation...');
    return new MockRedisClient();
  }
}

// Create a Redis client (with production mode or mock fallback)
const redisClient = createRedisClient();

// Export connection options for BullMQ
export const connectionOptions = {
  connection: redisClient
};

export default redisClient;