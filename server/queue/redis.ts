import Redis from 'ioredis';

// Create a Redis connection
// In production, you would use a different configuration with authentication
const redisClient = new Redis({
  host: 'localhost',
  port: 6379,
  maxRetriesPerRequest: null, // Required by BullMQ
});

// Handle connection events
redisClient.on('connect', () => {
  console.log('Successfully connected to Redis');
});

redisClient.on('error', (err) => {
  console.error('Redis connection error:', err);
});

// BullMQ connection options
export const connectionOptions = {
  connection: redisClient
};

export default redisClient;