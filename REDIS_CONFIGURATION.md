# Redis Configuration Guide

This document provides detailed information on configuring and using Redis with the AI-Powered Assignment Feedback Platform.

## Overview

The platform uses Redis through BullMQ for reliable queue processing. This enables:

- Asynchronous processing of submission feedback
- Reliable job retries on failure
- Persistence of jobs during restarts
- Distribution of work across multiple processes

## Configuration Options

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | When set to 'production', activates Redis/BullMQ by default | 'development' |
| `ENABLE_REDIS` | Force enable Redis even in non-production environments | 'false' |
| `REDIS_URL` | Complete Redis connection string (e.g., redis://username:password@host:port) | - |
| `REDIS_HOST` | Redis server hostname (used if REDIS_URL is not provided) | 'localhost' |
| `REDIS_PORT` | Redis server port (used if REDIS_URL is not provided) | 6379 |
| `REDIS_PASSWORD` | Redis password (used if REDIS_URL is not provided) | - |
| `REDIS_USERNAME` | Redis username (used if REDIS_URL is not provided) | - |
| `REDIS_DB` | Redis database number (used if REDIS_URL is not provided) | 0 |

### Connection Logic

The system uses the following logic to determine whether to use Redis:

1. If `NODE_ENV=production`, Redis is enabled by default
2. If `ENABLE_REDIS=true`, Redis is enabled regardless of environment
3. If `REDIS_URL` is provided, Redis is enabled regardless of other settings

When Redis is enabled, the system connects using:
1. The `REDIS_URL` if provided
2. Individual connection parameters (`REDIS_HOST`, `REDIS_PORT`, etc.) if `REDIS_URL` is not provided

## Development Mode

In development mode without Redis, the system uses a mock implementation that:

- Processes jobs immediately in the same process
- Simulates queue behavior without actual Redis dependencies
- Provides similar API but with in-memory storage

This allows development without a Redis installation, but limits some features:

- No persistence between restarts
- No distributed processing
- No dashboard monitoring

## Production Requirements

In production, a real Redis instance is **required**. The application will:

1. Attempt to connect to Redis using the provided credentials
2. Log connection errors with detailed information
3. Retry connection with exponential backoff
4. Use proper Redis clients for BullMQ compatibility

## Redis Hosting Options

For production use, you can:

1. **Self-host Redis**: Run your own Redis server
2. **Use Redis Cloud**: Services like Redis Labs, Upstash, etc.
3. **Platform Redis**: Many platforms like Heroku, Render, etc. offer Redis add-ons

## Minimal Redis Requirements

- Redis version: 5.0 or higher
- Memory: At least 100MB dedicated to Redis
- Persistence: AOF recommended for job reliability

## Testing Redis Connection

To test if Redis is properly configured:

1. Set `ENABLE_REDIS=true` in your development environment
2. Configure Redis connection parameters
3. Start the application
4. Check logs for successful connection messages
5. Submit an assignment to test queue processing

## Troubleshooting

- **Connection Errors**: Verify credentials and network access
- **Authentication Errors**: Ensure password/username are correct
- **Performance Issues**: Consider increasing Redis memory or connection pool
- **Lost Jobs**: Enable AOF persistence in Redis configuration

For more information, refer to:
- [BullMQ Documentation](https://docs.bullmq.io/)
- [Redis Documentation](https://redis.io/docs/)