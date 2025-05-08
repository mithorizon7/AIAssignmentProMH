import { EventEmitter } from 'events';

// Mock Redis client for environments where Redis is not available
class MockRedisClient extends EventEmitter {
  private storage: Map<string, string> = new Map();
  private lists: Map<string, string[]> = new Map();
  private sets: Map<string, Set<string>> = new Map();
  private sortedSets: Map<string, Map<string, number>> = new Map();
  
  constructor() {
    super();
    console.log('Using mock Redis client (Redis not available)');
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

// Create a Redis client (or mock)
let redisClient: MockRedisClient;

// Intentionally using a mock instead of actual Redis since Redis is not available in this environment
redisClient = new MockRedisClient();

// Export connection options for BullMQ
export const connectionOptions = {
  connection: redisClient
};

export default redisClient;