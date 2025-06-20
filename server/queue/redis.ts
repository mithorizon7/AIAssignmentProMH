import IORedis from 'ioredis';

// This must be the only Redis client instance created in the entire application.
const redisUrl = process.env.REDIS_URL!;

// Configure Redis client based on the URL format
let redisOptions: any = {
    maxRetriesPerRequest: null // BullMQ best practice
};

// If the URL contains Upstash domain or uses rediss://, enable TLS
if (redisUrl.includes('upstash.io') || redisUrl.startsWith('rediss://')) {
    redisOptions.tls = {}; // Mandatory for Upstash
}

const redisClient = new IORedis(redisUrl, redisOptions);

redisClient.on('error', (err) => {
    console.error('Central Redis Client Error:', err);
});

export default redisClient;