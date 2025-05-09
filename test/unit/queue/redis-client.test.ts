import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'events';

// Mock Redis class
class MockRedis extends EventEmitter {
  constructor(url?: string, options?: any) {
    super();
    setTimeout(() => this.emit('connect'), 0);
  }

  // Mock Redis methods
  async get() { return null; }
  async set() { return 'OK'; }
  async quit() { return 'OK'; }
}

// Mock module imports
vi.mock('ioredis', () => {
  return {
    Redis: MockRedis
  };
});

// Import the module under test (after mocks)
import { createRedisClientOptions } from '../../../server/queue/redis';

describe('Redis Client Factory', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset process.env before each test
    process.env = { ...originalEnv };
    vi.resetModules();
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.clearAllMocks();
  });

  it('should create connection options that include connection property', () => {
    const options = createRedisClientOptions();
    expect(options).toHaveProperty('connection');
  });

  it('should detect production environment with REDIS_URL', async () => {
    // Set environment variables
    process.env.NODE_ENV = 'production';
    process.env.REDIS_URL = 'redis://localhost:6379';
    
    // Need to re-import to get the updated environment
    const { default: createRedisClient } = await import('../../../server/queue/redis');
    const redisClient = createRedisClient();
    
    // In production with REDIS_URL, should use real Redis
    expect(redisClient).toBeInstanceOf(MockRedis);
  });

  it('should detect production environment with REDIS_HOST', async () => {
    // Set environment variables
    process.env.NODE_ENV = 'production';
    process.env.REDIS_HOST = 'localhost';
    delete process.env.REDIS_URL;
    
    // Need to re-import to get the updated environment
    const { default: createRedisClient } = await import('../../../server/queue/redis');
    const redisClient = createRedisClient();
    
    // In production with REDIS_HOST, should use real Redis
    expect(redisClient).toBeInstanceOf(MockRedis);
  });

  it('should use mock in development without Redis config', async () => {
    // Set environment variables
    process.env.NODE_ENV = 'development';
    delete process.env.REDIS_URL;
    delete process.env.REDIS_HOST;
    
    // Need to re-import to get the updated environment
    const { default: createRedisClient } = await import('../../../server/queue/redis');
    const redisClient = createRedisClient();
    
    // In development without Redis config, should use MockRedisClient
    expect(redisClient).toBeInstanceOf(EventEmitter);
    expect(redisClient.constructor.name).not.toBe('Redis'); // It should be the mock version
  });

  it('should use real Redis if REDIS_URL is set regardless of environment', async () => {
    // Set environment variables
    process.env.NODE_ENV = 'development';
    process.env.REDIS_URL = 'redis://localhost:6379';
    
    // Need to re-import to get the updated environment
    const { default: createRedisClient } = await import('../../../server/queue/redis');
    const redisClient = createRedisClient();
    
    // With REDIS_URL, should use real Redis even in development
    expect(redisClient).toBeInstanceOf(MockRedis);
  });

  it('should fallback to mock if Redis connection fails', async () => {
    // Set environment variables
    process.env.NODE_ENV = 'production';
    process.env.REDIS_URL = 'redis://non-existent-host:6379';
    
    // Make Redis constructor throw an error
    vi.mock('ioredis', () => {
      return {
        Redis: vi.fn().mockImplementation(() => {
          throw new Error('Connection failed');
        })
      };
    });
    
    // Need to re-import to get the updated environment
    const { default: createRedisClient } = await import('../../../server/queue/redis');
    const redisClient = createRedisClient();
    
    // Should fallback to mock Redis
    expect(redisClient).toBeInstanceOf(EventEmitter);
    expect(redisClient.constructor.name).not.toBe('Redis');
  });
});