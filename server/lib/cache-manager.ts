/**
 * Comprehensive caching strategy for production performance
 * Implements Redis-based caching with intelligent invalidation
 */

import redisClient from '../queue/redis';
import { logger } from './logger';
import { isProduction } from './env-config';

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  namespace?: string;
  tags?: string[];
  serialize?: boolean;
}

export interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  hitRate: number;
  totalOperations: number;
  averageResponseTime: number;
}

class CacheManager {
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    hitRate: 0,
    totalOperations: 0,
    averageResponseTime: 0
  };

  private responseTimeHistory: number[] = [];
  private readonly maxHistorySize = 1000;

  /**
   * Generates a cache key with optional namespace
   */
  private generateKey(key: string, namespace?: string): string {
    const prefix = isProduction() ? 'prod' : 'dev';
    const ns = namespace ? `${namespace}:` : '';
    return `aigrader:${prefix}:${ns}${key}`;
  }

  /**
   * Records response time for statistics
   */
  private recordResponseTime(responseTime: number): void {
    this.responseTimeHistory.push(responseTime);
    
    if (this.responseTimeHistory.length > this.maxHistorySize) {
      this.responseTimeHistory.shift();
    }
    
    this.stats.averageResponseTime = this.responseTimeHistory.reduce((sum, time) => sum + time, 0) / this.responseTimeHistory.length;
  }

  /**
   * Updates cache statistics
   */
  private updateStats(operation: 'hit' | 'miss' | 'set' | 'delete', responseTime: number): void {
    this.stats[operation === 'hit' ? 'hits' : operation === 'miss' ? 'misses' : operation === 'set' ? 'sets' : 'deletes']++;
    this.stats.totalOperations++;
    this.stats.hitRate = (this.stats.hits / (this.stats.hits + this.stats.misses)) * 100;
    this.recordResponseTime(responseTime);
  }

  /**
   * Gets a value from cache
   */
  async get<T>(key: string, options: CacheOptions = {}): Promise<T | null> {
    const startTime = performance.now();
    
    try {
      const cacheKey = this.generateKey(key, options.namespace);
      const value = await redisClient.get(cacheKey);
      
      const responseTime = performance.now() - startTime;
      
      if (value !== null) {
        this.updateStats('hit', responseTime);
        
        if (options.serialize !== false) {
          try {
            return JSON.parse(value);
          } catch (error) {
            logger.warn('Failed to parse cached JSON', { key: cacheKey, error });
            return value as T;
          }
        }
        
        return value as T;
      }
      
      this.updateStats('miss', responseTime);
      return null;
    } catch (error) {
      const responseTime = performance.now() - startTime;
      this.updateStats('miss', responseTime);
      
      logger.error('Cache get error', { key, error });
      return null;
    }
  }

  /**
   * Sets a value in cache
   */
  async set<T>(key: string, value: T, options: CacheOptions = {}): Promise<boolean> {
    const startTime = performance.now();
    
    try {
      const cacheKey = this.generateKey(key, options.namespace);
      const serializedValue = options.serialize !== false ? JSON.stringify(value) : String(value);
      
      let result: string | null;
      
      if (options.ttl && options.ttl > 0) {
        result = await redisClient.setex(cacheKey, options.ttl, serializedValue);
      } else {
        result = await redisClient.set(cacheKey, serializedValue);
      }
      
      const responseTime = performance.now() - startTime;
      this.updateStats('set', responseTime);
      
      // Store tags for invalidation
      if (options.tags && options.tags.length > 0) {
        await this.addTags(cacheKey, options.tags);
      }
      
      return result === 'OK';
    } catch (error) {
      const responseTime = performance.now() - startTime;
      this.updateStats('set', responseTime);
      
      logger.error('Cache set error', { key, error });
      return false;
    }
  }

  /**
   * Deletes a value from cache
   */
  async delete(key: string, options: CacheOptions = {}): Promise<boolean> {
    const startTime = performance.now();
    
    try {
      const cacheKey = this.generateKey(key, options.namespace);
      const result = await redisClient.del(cacheKey);
      
      const responseTime = performance.now() - startTime;
      this.updateStats('delete', responseTime);
      
      return result > 0;
    } catch (error) {
      const responseTime = performance.now() - startTime;
      this.updateStats('delete', responseTime);
      
      logger.error('Cache delete error', { key, error });
      return false;
    }
  }

  /**
   * Gets or sets a value with a fallback function
   */
  async getOrSet<T>(
    key: string, 
    fallbackFn: () => Promise<T>, 
    options: CacheOptions = {}
  ): Promise<T> {
    const cachedValue = await this.get<T>(key, options);
    
    if (cachedValue !== null) {
      return cachedValue;
    }
    
    const value = await fallbackFn();
    await this.set(key, value, options);
    
    return value;
  }

  /**
   * Adds tags to a cache key for invalidation
   */
  private async addTags(cacheKey: string, tags: string[]): Promise<void> {
    for (const tag of tags) {
      const tagKey = this.generateKey(`tag:${tag}`, 'tags');
      await redisClient.sadd(tagKey, cacheKey);
    }
  }

  /**
   * Invalidates cache by tags
   */
  async invalidateByTags(tags: string[]): Promise<number> {
    let deletedCount = 0;
    
    for (const tag of tags) {
      const tagKey = this.generateKey(`tag:${tag}`, 'tags');
      const keys = await redisClient.smembers(tagKey);
      
      if (keys.length > 0) {
        const results = await redisClient.del(...keys);
        deletedCount += results;
        
        // Remove the tag key itself
        await redisClient.del(tagKey);
      }
    }
    
    logger.info('Cache invalidation by tags', { tags, deletedCount });
    return deletedCount;
  }

  /**
   * Invalidates cache by pattern
   */
  async invalidateByPattern(pattern: string, options: CacheOptions = {}): Promise<number> {
    const searchPattern = this.generateKey(pattern, options.namespace);
    const keys = await redisClient.keys(searchPattern);
    
    if (keys.length > 0) {
      const result = await redisClient.del(...keys);
      logger.info('Cache invalidation by pattern', { pattern: searchPattern, deletedCount: result });
      return result;
    }
    
    return 0;
  }

  /**
   * Clears all cache for the current environment
   */
  async clear(): Promise<number> {
    const pattern = this.generateKey('*');
    const keys = await redisClient.keys(pattern);
    
    if (keys.length > 0) {
      const result = await redisClient.del(...keys);
      logger.info('Cache cleared', { deletedCount: result });
      return result;
    }
    
    return 0;
  }

  /**
   * Gets cache statistics
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * Resets cache statistics
   */
  resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      hitRate: 0,
      totalOperations: 0,
      averageResponseTime: 0
    };
    this.responseTimeHistory = [];
  }

  /**
   * Gets cache health information
   */
  async getHealth(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    stats: CacheStats;
    redis: {
      connected: boolean;
      memory: string;
      keyspace: Record<string, any>;
    };
  }> {
    try {
      const info = await redisClient.info('memory');
      const keyspace = await redisClient.info('keyspace');
      
      const memoryMatch = info.match(/used_memory_human:([^\r\n]+)/);
      const memory = memoryMatch ? memoryMatch[1] : 'unknown';
      
      const keyspaceData: Record<string, any> = {};
      const keyspaceMatch = keyspace.match(/db\d+:keys=(\d+),expires=(\d+)/);
      if (keyspaceMatch) {
        keyspaceData.keys = parseInt(keyspaceMatch[1]);
        keyspaceData.expires = parseInt(keyspaceMatch[2]);
      }
      
      const status = this.stats.averageResponseTime > 100 ? 'degraded' : 'healthy';
      
      return {
        status,
        stats: this.getStats(),
        redis: {
          connected: true,
          memory,
          keyspace: keyspaceData
        }
      };
    } catch (error) {
      logger.error('Cache health check failed', { error });
      return {
        status: 'unhealthy',
        stats: this.getStats(),
        redis: {
          connected: false,
          memory: 'unknown',
          keyspace: {}
        }
      };
    }
  }
}

// Global cache manager instance
export const cacheManager = new CacheManager();

/**
 * Cache decorator for methods
 */
export function cache(options: CacheOptions = {}) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function (...args: any[]) {
      const cacheKey = `${target.constructor.name}:${propertyName}:${JSON.stringify(args)}`;
      
      return await cacheManager.getOrSet(
        cacheKey,
        () => originalMethod.apply(this, args),
        options
      );
    };
    
    return descriptor;
  };
}

/**
 * Common cache keys and configurations
 */
export const CacheKeys = {
  USER_PROFILE: (userId: string) => `user:profile:${userId}`,
  ASSIGNMENT_DETAILS: (assignmentId: string) => `assignment:details:${assignmentId}`,
  COURSE_STUDENTS: (courseId: string) => `course:students:${courseId}`,
  SUBMISSION_FEEDBACK: (submissionId: string) => `submission:feedback:${submissionId}`,
  SYSTEM_HEALTH: 'system:health',
  QUEUE_STATUS: 'queue:status',
  ANALYTICS_DATA: (type: string, period: string) => `analytics:${type}:${period}`
};

export const CacheConfigs = {
  SHORT: { ttl: 300, tags: ['short-lived'] }, // 5 minutes
  MEDIUM: { ttl: 1800, tags: ['medium-lived'] }, // 30 minutes
  LONG: { ttl: 3600, tags: ['long-lived'] }, // 1 hour
  PERSISTENT: { ttl: 86400, tags: ['persistent'] }, // 24 hours
  USER_DATA: { ttl: 3600, tags: ['user-data'] },
  ASSIGNMENT_DATA: { ttl: 1800, tags: ['assignment-data'] },
  ANALYTICS: { ttl: 300, tags: ['analytics'] }
};

/**
 * Initializes cache manager with periodic cleanup
 */
export function initializeCacheManager(): void {
  logger.info('Cache manager initialized');
  
  // Schedule periodic cache cleanup in production
  if (isProduction()) {
    setInterval(async () => {
      try {
        // Clean up expired keys
        const stats = cacheManager.getStats();
        logger.info('Cache statistics', stats);
        
        // Reset stats if they get too large
        if (stats.totalOperations > 100000) {
          cacheManager.resetStats();
        }
      } catch (error) {
        logger.error('Cache cleanup failed', { error });
      }
    }, 60 * 60 * 1000); // Every hour
  }
}