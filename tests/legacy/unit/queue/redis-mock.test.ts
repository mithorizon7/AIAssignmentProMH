import { describe, it, expect, beforeEach } from 'vitest';
import { EventEmitter } from 'events';

// Define a simple mock Redis client for tests
class MockRedisClient extends EventEmitter {
  private storage: Map<string, string> = new Map();
  private lists: Map<string, string[]> = new Map();
  private sets: Map<string, Set<string>> = new Map();
  private sortedSets: Map<string, Map<string, number>> = new Map();

  constructor() {
    super();
    // Emit connect event to simulate successful connection
    setTimeout(() => this.emit('connect'), 0);
  }

  async get(key: string): Promise<string | null> {
    return this.storage.get(key) || null;
  }

  async set(key: string, value: string): Promise<'OK'> {
    this.storage.set(key, value);
    return 'OK';
  }

  async del(key: string): Promise<number> {
    const hadKey = this.storage.has(key);
    this.storage.delete(key);
    
    const hadList = this.lists.has(key);
    this.lists.delete(key);
    
    const hadSet = this.sets.has(key);
    this.sets.delete(key);
    
    const hadSortedSet = this.sortedSets.has(key);
    this.sortedSets.delete(key);
    
    return (hadKey || hadList || hadSet || hadSortedSet) ? 1 : 0;
  }

  async lpush(key: string, ...values: string[]): Promise<number> {
    if (!this.lists.has(key)) {
      this.lists.set(key, []);
    }
    
    const list = this.lists.get(key)!;
    list.unshift(...values);
    
    return list.length;
  }

  async rpush(key: string, ...values: string[]): Promise<number> {
    if (!this.lists.has(key)) {
      this.lists.set(key, []);
    }
    
    const list = this.lists.get(key)!;
    list.push(...values);
    
    return list.length;
  }

  async lpop(key: string): Promise<string | null> {
    const list = this.lists.get(key);
    if (!list || list.length === 0) {
      return null;
    }
    
    return list.shift() || null;
  }

  async rpop(key: string): Promise<string | null> {
    const list = this.lists.get(key);
    if (!list || list.length === 0) {
      return null;
    }
    
    return list.pop() || null;
  }

  async lrange(key: string, start: number, stop: number): Promise<string[]> {
    const list = this.lists.get(key);
    if (!list) {
      return [];
    }
    
    // Handle negative indices (Redis style)
    let actualStart = start < 0 ? list.length + start : start;
    let actualStop = stop < 0 ? list.length + stop : stop;
    
    // Ensure bounds
    actualStart = Math.max(0, actualStart);
    actualStop = Math.min(list.length - 1, actualStop);
    
    if (actualStart > actualStop) {
      return [];
    }
    
    return list.slice(actualStart, actualStop + 1);
  }

  async sadd(key: string, ...members: string[]): Promise<number> {
    if (!this.sets.has(key)) {
      this.sets.set(key, new Set());
    }
    
    const set = this.sets.get(key)!;
    const sizeBefore = set.size;
    
    members.forEach(member => set.add(member));
    
    return set.size - sizeBefore;
  }

  async srem(key: string, ...members: string[]): Promise<number> {
    const set = this.sets.get(key);
    if (!set) {
      return 0;
    }
    
    let removed = 0;
    members.forEach(member => {
      if (set.delete(member)) {
        removed++;
      }
    });
    
    return removed;
  }

  async smembers(key: string): Promise<string[]> {
    const set = this.sets.get(key);
    if (!set) {
      return [];
    }
    
    return [...set.values()];
  }

  async zadd(key: string, score: number, member: string): Promise<number> {
    if (!this.sortedSets.has(key)) {
      this.sortedSets.set(key, new Map());
    }
    
    const zset = this.sortedSets.get(key)!;
    const isNew = !zset.has(member);
    
    zset.set(member, score);
    
    return isNew ? 1 : 0;
  }

  async zcard(key: string): Promise<number> {
    const zset = this.sortedSets.get(key);
    if (!zset) {
      return 0;
    }
    
    return zset.size;
  }

  async quit(): Promise<'OK'> {
    this.emit('end');
    return 'OK';
  }

  async client(command: string, ...args: any[]): Promise<any> {
    if (command.toLowerCase() === 'id') {
      return 'mock-client-id';
    }
    return null;
  }
}

describe('MockRedisClient', () => {
  let redis: MockRedisClient;

  beforeEach(() => {
    redis = new MockRedisClient();
  });

  it('should emit a connect event', () => {
    return new Promise<void>((resolve) => {
      redis.on('connect', () => {
        resolve();
      });
    });
  });

  it('should handle basic set and get', async () => {
    await redis.set('key1', 'value1');
    const value = await redis.get('key1');
    expect(value).toBe('value1');
  });

  it('should return null for non-existent keys', async () => {
    const value = await redis.get('non-existent');
    expect(value).toBeNull();
  });

  it('should handle del command', async () => {
    await redis.set('key1', 'value1');
    expect(await redis.get('key1')).toBe('value1');
    
    const deleteCount = await redis.del('key1');
    expect(deleteCount).toBe(1);
    expect(await redis.get('key1')).toBeNull();
    
    const deleteNonExistentCount = await redis.del('non-existent');
    expect(deleteNonExistentCount).toBe(0);
  });

  it('should handle list operations', async () => {
    await redis.lpush('list1', 'value1');
    await redis.lpush('list1', 'value2'); // This will be at the front because of lpush
    await redis.rpush('list1', 'value3');
    
    // Should be ['value2', 'value1', 'value3'] - value2 is first because it was pushed last with lpush
    const list = await redis.lrange('list1', 0, -1);
    expect(list).toEqual(['value2', 'value1', 'value3']);
    
    expect(await redis.lpop('list1')).toBe('value2');
    expect(await redis.rpop('list1')).toBe('value3');
    expect(await redis.lrange('list1', 0, -1)).toEqual(['value1']);
  });

  it('should handle set operations', async () => {
    const addCount1 = await redis.sadd('set1', 'member1', 'member2');
    expect(addCount1).toBe(2);
    
    const addCount2 = await redis.sadd('set1', 'member2', 'member3');
    expect(addCount2).toBe(1); // member2 already exists
    
    const members = await redis.smembers('set1');
    expect(members).toContain('member1');
    expect(members).toContain('member2');
    expect(members).toContain('member3');
    expect(members.length).toBe(3);
    
    const remCount = await redis.srem('set1', 'member1', 'non-existent');
    expect(remCount).toBe(1);
    
    const membersAfterRem = await redis.smembers('set1');
    expect(membersAfterRem).not.toContain('member1');
    expect(membersAfterRem.length).toBe(2);
  });

  it('should handle sorted set operations', async () => {
    const addCount1 = await redis.zadd('zset1', 1.0, 'member1');
    const addCount2 = await redis.zadd('zset1', 2.0, 'member2');
    const addCount3 = await redis.zadd('zset1', 1.5, 'member1'); // Update score
    
    expect(addCount1).toBe(1);
    expect(addCount2).toBe(1);
    expect(addCount3).toBe(0); // Not a new member
    
    const cardinality = await redis.zcard('zset1');
    expect(cardinality).toBe(2);
  });

  it('should handle client commands', async () => {
    const id = await redis.client('id');
    expect(id).toBe('mock-client-id');
    
    const unknown = await redis.client('unknown');
    expect(unknown).toBeNull();
  });
});