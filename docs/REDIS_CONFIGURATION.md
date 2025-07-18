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
| `REDIS_URL` | Complete Redis connection string (e.g., redis://username:password@host:port) | - |
| `REDIS_HOST` | Redis server hostname (used if REDIS_URL is not provided) | 'localhost' |
| `REDIS_PORT` | Redis server port (used if REDIS_URL is not provided) | 6379 |
| `REDIS_PASSWORD` | Redis password (used if REDIS_URL is not provided) | - |
| `REDIS_USERNAME` | Redis username (used if REDIS_URL is not provided) | - |
| `REDIS_DB` | Redis database number (used if REDIS_URL is not provided) | 0 |

### Connection Logic

The system uses Redis for queue processing and session management. Connection is established using:
1. The `REDIS_URL` if provided
2. Individual connection parameters (`REDIS_HOST`, `REDIS_PORT`, etc.) if `REDIS_URL` is not provided

If Redis connection fails, the system will use fallback implementations for development.

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

### Common Deployment Errors

- **BullMQ Redis configuration error: maxRetriesPerRequest must be null in Redis connection options**
  - This happens because some Redis hosting providers reject connections with non-null maxRetriesPerRequest
  - Solution: The application now sets maxRetriesPerRequest to null in all Redis connections
  
- **Missing Redis URL or connection parameters in environment variables**
  - Ensure that either REDIS_URL or individual REDIS_* connection parameters are set in your deployment environment
  - Most Redis providers give you a connection string to use for REDIS_URL
  
- **Application requires Redis in production environment**
  - The application is configured to always use a real Redis instance in production
  - If your deployment sets NODE_ENV=production, you MUST provide a valid Redis connection

For more information, refer to:
- [BullMQ Documentation](https://docs.bullmq.io/)
- [Redis Documentation](https://redis.io/docs/)
- [Redis Cloud](https://redis.com/redis-enterprise-cloud/overview/)
- [Upstash Redis](https://upstash.com/) (Serverless Redis with reasonable free tier)