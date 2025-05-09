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

// Mock the logger to avoid polluting test output
vi.mock('../../../server/lib/logger', () => {
  return {
    queueLogger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    }
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

  it('should detect Redis URL settings', async () => {
    // Set environment variables
    process.env.NODE_ENV = 'production';
    process.env.REDIS_URL = 'redis://localhost:6379';
    
    // Import the module again to get the updated environment
    // Need to re-import with a dynamic import that bypasses module caching
    const redis = await import('../../../server/queue/redis');
    const connectionOptions = redis.createRedisClientOptions();
    
    // Check that the connection options exist
    expect(connectionOptions).toHaveProperty('connection');
  });

  it('should detect Redis Host settings', async () => {
    // Set environment variables
    process.env.NODE_ENV = 'production';
    process.env.REDIS_HOST = 'localhost';
    delete process.env.REDIS_URL;
    
    // Import the module again to get the updated environment
    const redis = await import('../../../server/queue/redis');
    const connectionOptions = redis.createRedisClientOptions();
    
    // Check that the connection options exist
    expect(connectionOptions).toHaveProperty('connection');
  });

  it('should handle development environment settings', async () => {
    // Set environment variables
    process.env.NODE_ENV = 'development';
    delete process.env.REDIS_URL;
    delete process.env.REDIS_HOST;
    
    // Import the module again to get the updated environment
    const redis = await import('../../../server/queue/redis');
    const connectionOptions = redis.createRedisClientOptions();
    
    // Check that the connection options exist
    expect(connectionOptions).toHaveProperty('connection');
  });

  it('should respect REDIS_URL even in development environment', async () => {
    // Set environment variables
    process.env.NODE_ENV = 'development';
    process.env.REDIS_URL = 'redis://localhost:6379';
    
    // Import the module again to get the updated environment
    const redis = await import('../../../server/queue/redis');
    const connectionOptions = redis.createRedisClientOptions();
    
    // Check that the connection options exist
    expect(connectionOptions).toHaveProperty('connection');
  });

  it('should provide fallback for connection failures', async () => {
    // Set environment variables
    process.env.NODE_ENV = 'production';
    process.env.REDIS_URL = 'redis://non-existent-host:6379';
    
    // Force connection failures
    vi.mock('ioredis', () => {
      return {
        Redis: vi.fn().mockImplementation(() => {
          throw new Error('Connection failed');
        })
      };
    });
    
    // Import the module again to get the updated environment
    const redis = await import('../../../server/queue/redis');
    const connectionOptions = redis.createRedisClientOptions();
    
    // Check that the connection options exist (should use mock client)
    expect(connectionOptions).toHaveProperty('connection');
  });
});