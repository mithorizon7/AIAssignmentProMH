import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'events';

// Since we need to mock the Redis client for testing
class MockRedisClient extends EventEmitter {
  private storage: Map<string, string> = new Map();
  private lists: Map<string, string[]> = new Map();
  private sets: Map<string, Set<string>> = new Map();
  private sortedSets: Map<string, Map<string, number>> = new Map();
  
  constructor() {
    super();
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

describe('MockRedisClient', () => {
  let redis: MockRedisClient;

  beforeEach(() => {
    redis = new MockRedisClient();
  });

  describe('Key-value operations', () => {
    it('should set and get a value', async () => {
      await redis.set('key1', 'value1');
      const value = await redis.get('key1');
      expect(value).toBe('value1');
    });

    it('should return null for non-existent keys', async () => {
      const value = await redis.get('nonexistent');
      expect(value).toBeNull();
    });

    it('should delete keys', async () => {
      await redis.set('key2', 'value2');
      const result = await redis.del('key2');
      expect(result).toBe(1);
      expect(await redis.get('key2')).toBeNull();
    });
  });

  describe('List operations', () => {
    it('should push and pop from lists', async () => {
      await redis.lpush('list1', 'item1', 'item2');
      expect(await redis.lrange('list1', 0, -1)).toEqual(['item2', 'item1']);

      await redis.rpush('list1', 'item3');
      expect(await redis.lrange('list1', 0, -1)).toEqual(['item2', 'item1', 'item3']);

      expect(await redis.lpop('list1')).toBe('item2');
      expect(await redis.rpop('list1')).toBe('item3');
      expect(await redis.lrange('list1', 0, -1)).toEqual(['item1']);
    });

    it('should handle range queries correctly', async () => {
      await redis.rpush('list2', 'a', 'b', 'c', 'd', 'e');
      expect(await redis.lrange('list2', 1, 3)).toEqual(['b', 'c', 'd']);
      expect(await redis.lrange('list2', -3, -1)).toEqual(['c', 'd', 'e']);
      expect(await redis.lrange('list2', 0, -2)).toEqual(['a', 'b', 'c', 'd']);
    });
  });

  describe('Set operations', () => {
    it('should add and remove set members', async () => {
      await redis.sadd('set1', 'member1', 'member2', 'member1'); // Duplicate intentional
      expect(await redis.smembers('set1')).toContain('member1');
      expect(await redis.smembers('set1')).toContain('member2');
      expect(await redis.smembers('set1').then(m => m.length)).toBe(2);

      await redis.srem('set1', 'member1');
      expect(await redis.smembers('set1')).not.toContain('member1');
      expect(await redis.smembers('set1')).toContain('member2');
    });
  });

  describe('Sorted set operations', () => {
    it('should add members with scores', async () => {
      await redis.zadd('zset1', 10, 'member1');
      await redis.zadd('zset1', 20, 'member2');
      expect(await redis.zcard('zset1')).toBe(2);
    });

    it('should update score if member exists', async () => {
      await redis.zadd('zset2', 10, 'member1');
      const result = await redis.zadd('zset2', 20, 'member1');
      expect(result).toBe(0); // Member already exists
    });
  });

  describe('Client operations', () => {
    it('should support quit operation', async () => {
      const result = await redis.quit();
      expect(result).toBe('OK');
    });

    it('should support client command', async () => {
      const result = await redis.client('id');
      expect(result).toBe('OK');
    });
  });
});