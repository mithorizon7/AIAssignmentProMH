# Redis Configuration Guide

This document explains how to configure Redis for the AI Feedback Platform, which is used for queuing and processing submissions.

## Development Environment

In development mode, the application uses a mock Redis implementation that doesn't require an actual Redis server. This allows for easy local development without external dependencies.

However, you might see warning messages like:

```
[WARN] Using mock Redis client - NOT SUITABLE FOR PRODUCTION
```

These warnings are expected and can be safely ignored during development.

## Production Configuration

For production environments, you'll need to configure an actual Redis server. Here are the available configuration options:

### Option 1: Using REDIS_URL (Recommended)

Set the `REDIS_URL` environment variable to your Redis connection string:

```
REDIS_URL=redis://username:password@host:port
```

### Option 2: Using Individual Redis Configuration Variables

Alternatively, you can configure individual parameters:

```
REDIS_HOST=your-redis-host
REDIS_PORT=6379
REDIS_PASSWORD=your-redis-password
REDIS_USERNAME=your-redis-username (optional)
REDIS_DB=0
```

## Redis Role in the Application

Redis is used for the following purposes:

1. **Submission Processing Queue**: Manages the queue of assignments waiting to be processed by the AI service
2. **Job Monitoring**: Tracks job status, progress, and results
3. **Worker Coordination**: Ensures jobs are distributed efficiently among multiple workers

## Fallback Mechanism

The application includes a robust fallback mechanism:

- If Redis connection fails in production, it will log detailed errors but continue operating
- In development, it automatically falls back to an in-memory implementation that processes jobs directly
- All operations are logged with appropriate context for debugging

## Monitoring Redis Status

You can check the Redis queue status via the administration dashboard or the API endpoint:

```
GET /api/admin/queue/stats
```

This will return stats including waiting, active, completed, and failed jobs.

## Troubleshooting

If you encounter Redis-related issues:

1. Check Redis connection settings in your environment variables
2. Ensure firewall rules allow connection to the Redis port
3. Verify Redis server is running and accepting connections
4. Review application logs for detailed error messages (they include connection details and failure reasons)

For Redis connection errors, the application will automatically retry with an exponential backoff strategy.

## Managing Queue Workers

The application automatically manages worker processes. No manual intervention is typically needed.

If you need to restart the worker process:

```
POST /api/admin/queue/restart
```

## Performance Considerations

For high-volume environments, consider:

- Using a Redis cluster for better performance and reliability
- Increasing the number of worker processes (set environment variable `QUEUE_CONCURRENCY=10`)
- Setting up Redis with persistence enabled to prevent job loss during restarts

The default configuration should handle moderate workloads efficiently, processing up to 5 submissions concurrently.

## Security Notes

- Always use authentication for Redis in production
- Place Redis behind a firewall that only allows access from your application servers
- Regularly update your Redis instance to the latest version
- Consider using TLS encryption for Redis connections in sensitive environments