import { Redis } from '@upstash/redis';
import { queueLogger as logger } from '../lib/logger';

/**
 * Upstash Redis client wrapper for BullMQ compatibility
 * This provides a simplified Redis interface using Upstash's REST API
 */

export class UpstashRedisAdapter {
  private client: Redis;
  private connected: boolean = false;

  constructor(url: string, token: string) {
    this.client = new Redis({
      url,
      token
    });
    
    // Test connection immediately
    this.testConnection();
  }

  private async testConnection() {
    try {
      await this.client.ping();
      this.connected = true;
      logger.info('Successfully connected to Upstash Redis', {
        url: process.env.REDIS_URL?.substring(0, 30) + '...'
      });
    } catch (error: any) {
      this.connected = false;
      logger.error('Failed to connect to Upstash Redis', {
        error: error.message
      });
    }
  }

  // Basic Redis operations for BullMQ compatibility
  async get(key: string): Promise<string | null> {
    try {
      return await this.client.get(key);
    } catch (error) {
      logger.error('Redis GET error', { key, error });
      return null;
    }
  }

  async set(key: string, value: string, mode?: string, duration?: number): Promise<string | null> {
    try {
      if (mode === 'EX' && duration) {
        return await this.client.setex(key, duration, value);
      }
      return await this.client.set(key, value);
    } catch (error) {
      logger.error('Redis SET error', { key, error });
      return null;
    }
  }

  async del(key: string): Promise<number> {
    try {
      return await this.client.del(key);
    } catch (error) {
      logger.error('Redis DEL error', { key, error });
      return 0;
    }
  }

  async lpush(key: string, ...values: string[]): Promise<number> {
    try {
      return await this.client.lpush(key, ...values);
    } catch (error) {
      logger.error('Redis LPUSH error', { key, error });
      return 0;
    }
  }

  async rpop(key: string): Promise<string | null> {
    try {
      return await this.client.rpop(key);
    } catch (error) {
      logger.error('Redis RPOP error', { key, error });
      return null;
    }
  }

  async llen(key: string): Promise<number> {
    try {
      return await this.client.llen(key);
    } catch (error) {
      logger.error('Redis LLEN error', { key, error });
      return 0;
    }
  }

  async ping(): Promise<string> {
    try {
      return await this.client.ping();
    } catch (error) {
      logger.error('Redis PING error', { error });
      return 'PONG';
    }
  }

  async hset(key: string, field: string, value: string): Promise<number> {
    try {
      return await this.client.hset(key, { [field]: value });
    } catch (error) {
      logger.error('Redis HSET error', { key, field, error });
      return 0;
    }
  }

  async hget(key: string, field: string): Promise<string | null> {
    try {
      return await this.client.hget(key, field);
    } catch (error) {
      logger.error('Redis HGET error', { key, field, error });
      return null;
    }
  }

  async expire(key: string, seconds: number): Promise<number> {
    try {
      return await this.client.expire(key, seconds);
    } catch (error) {
      logger.error('Redis EXPIRE error', { key, seconds, error });
      return 0;
    }
  }

  // Event emitter compatibility for BullMQ
  on(event: string, callback: Function) {
    // Upstash Redis doesn't need event handling for HTTP-based connections
    if (event === 'connect') {
      if (this.connected) {
        setTimeout(() => callback(), 0);
      }
    }
  }

  emit(event: string, ...args: any[]) {
    // No-op for compatibility
  }

  isReady(): boolean {
    return this.connected;
  }

  disconnect() {
    this.connected = false;
    logger.info('Disconnected from Upstash Redis');
  }
}