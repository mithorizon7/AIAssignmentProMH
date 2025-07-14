/**
 * Performance Caching Middleware
 * Implements memory-based caching for frequently accessed endpoints
 */

import { Request, Response, NextFunction } from 'express';

interface CacheOptions {
  ttl: number; // Time to live in seconds
  key?: (req: Request) => string;
  condition?: (req: Request) => boolean;
}

interface CacheEntry {
  data: any;
  expires: number;
  statusCode: number;
  headers?: Record<string, string>;
}

const cache = new Map<string, CacheEntry>();
const cacheStats = {
  hits: 0,
  misses: 0,
  sets: 0,
  evictions: 0
};

export function createCacheMiddleware(options: CacheOptions) {
  return (req: Request, res: Response, next: NextFunction) => {
    // Skip caching for non-GET requests or if condition fails
    if (req.method !== 'GET' || (options.condition && !options.condition(req))) {
      return next();
    }
    
    const cacheKey = options.key ? options.key(req) : req.originalUrl;
    const cached = cache.get(cacheKey);
    
    // Check if cached entry is still valid
    if (cached && cached.expires > Date.now()) {
      cacheStats.hits++;
      console.log(`[CACHE] Hit: ${cacheKey} (${cacheStats.hits} hits total)`);
      
      // Set cached headers if available
      if (cached.headers) {
        Object.entries(cached.headers).forEach(([key, value]) => {
          res.setHeader(key, value);
        });
      }
      
      return res.status(cached.statusCode).json(cached.data);
    }
    
    cacheStats.misses++;
    
    // Override res.json to cache the response
    const originalJson = res.json;
    const originalStatus = res.status;
    let statusCode = 200;
    
    res.status = function(code: number) {
      statusCode = code;
      return originalStatus.call(this, code);
    };
    
    res.json = function(body: any) {
      // Only cache successful responses
      if (statusCode >= 200 && statusCode < 300) {
        const cacheEntry: CacheEntry = {
          data: body,
          expires: Date.now() + (options.ttl * 1000),
          statusCode,
          headers: {
            'X-Cache': 'MISS',
            'X-Cache-TTL': options.ttl.toString()
          }
        };
        
        cache.set(cacheKey, cacheEntry);
        cacheStats.sets++;
        
        console.log(`[CACHE] Set: ${cacheKey}, TTL: ${options.ttl}s`);
        
        // Set cache headers
        res.setHeader('X-Cache', 'MISS');
        res.setHeader('X-Cache-TTL', options.ttl.toString());
      }
      return originalJson.call(this, body);
    };
    
    next();
  };
}

// Cache cleanup - remove expired entries every 2 minutes
setInterval(() => {
  const now = Date.now();
  let cleaned = 0;
  
  for (const [key, value] of cache.entries()) {
    if (value.expires <= now) {
      cache.delete(key);
      cleaned++;
      cacheStats.evictions++;
    }
  }
  
  if (cleaned > 0) {
    console.log(`[CACHE] Cleaned ${cleaned} expired entries`);
  }
}, 2 * 60 * 1000);

// Cache statistics endpoint
export function getCacheStats() {
  return {
    ...cacheStats,
    currentEntries: cache.size,
    memoryUsage: JSON.stringify([...cache.entries()]).length / 1024, // KB estimate
    hitRate: cacheStats.hits + cacheStats.misses > 0 
      ? ((cacheStats.hits / (cacheStats.hits + cacheStats.misses)) * 100).toFixed(2) + '%'
      : '0%'
  };
}

// Manual cache management
export function clearCache(pattern?: string) {
  if (pattern) {
    let cleared = 0;
    for (const key of cache.keys()) {
      if (key.includes(pattern)) {
        cache.delete(key);
        cleared++;
      }
    }
    console.log(`[CACHE] Cleared ${cleared} entries matching pattern: ${pattern}`);
    return cleared;
  } else {
    const size = cache.size;
    cache.clear();
    console.log(`[CACHE] Cleared all ${size} entries`);
    cacheStats.hits = 0;
    cacheStats.misses = 0;
    cacheStats.sets = 0;
    cacheStats.evictions = 0;
    return size;
  }
}

// Preemptive cache warming for common endpoints
export function warmCache(endpoints: Array<{ url: string; ttl: number }>) {
  console.log(`[CACHE] Warming cache for ${endpoints.length} endpoints`);
  // This would typically make internal requests to populate cache
  // For now, just log the intention
  endpoints.forEach(endpoint => {
    console.log(`[CACHE] Would warm: ${endpoint.url} (TTL: ${endpoint.ttl}s)`);
  });
}