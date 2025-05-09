# Redis Configuration Guide

This guide explains how to set up and configure Redis for the AI Feedback Platform, which is critical for reliable queue functionality.

## Why Redis Is Needed

The platform uses Redis via BullMQ for several critical functions:

1. **Durable Job Queueing**: Ensures submissions aren't lost, even if the server restarts
2. **Work Distribution**: Allows processing to be distributed across multiple workers/servers
3. **Retry Handling**: Provides robust retry mechanisms with exponential backoff
4. **Job Monitoring**: Enables monitoring and management through the admin dashboard
5. **Rate Limiting**: Helps control processing throughput and prevent system overload

Without Redis, the system falls back to an in-memory implementation which is **not suitable for production** as jobs are lost on server restart.

## Production Options

### Option 1: Self-Hosted Redis

For full control but more maintenance:

```bash
# Install Redis on Ubuntu
sudo apt update
sudo apt install redis-server

# Configure Redis to start on boot
sudo systemctl enable redis-server

# Edit configuration
sudo nano /etc/redis/redis.conf

# Set password
# Find the line: # requirepass foobared
# Uncomment and change to: requirepass your_secure_password

# Restart Redis
sudo systemctl restart redis-server
```

### Option 2: Managed Redis Services

For easier maintenance but less control:

- **Redis Cloud**: Offers a free tier with 30MB RAM
- **Amazon ElastiCache**: AWS managed Redis service
- **Azure Cache for Redis**: Microsoft's managed Redis service
- **DigitalOcean Managed Redis**: Simple managed Redis option
- **Redis Enterprise Cloud**: High-performance option

## Environment Configuration

Set these environment variables for the application:

```bash
# Option 1: Full URL (simplest)
REDIS_URL=redis://username:password@host:port/db

# Option 2: Individual components
REDIS_HOST=your-redis-host
REDIS_PORT=6379
REDIS_PASSWORD=your-redis-password
REDIS_USERNAME=default  # Usually only needed for Redis 6.0+
REDIS_DB=0
```

## Redis Memory Management

Redis primarily stores data in memory. For queue usage, configure:

1. **maxmemory**: Set to about 75% of available RAM
2. **maxmemory-policy**: Use `volatile-lru` (removes least recently used keys with expiration)

Example redis.conf settings:

```
maxmemory 2gb
maxmemory-policy volatile-lru
```

## Security Recommendations

1. **Strong Password**: Use a complex password (16+ characters)
2. **Network Security**: 
   - Never expose Redis directly to the internet
   - Use firewalls to restrict access by IP
   - Consider using a VPN or SSH tunnel for remote access
3. **TLS/SSL**: Enable encryption for production (Redis 6.0+)
4. **Regular Updates**: Keep Redis updated for security patches

## Monitoring

Monitor these metrics for health:

- **Memory usage**: Watch for approaching limits
- **CPU usage**: High CPU might indicate inefficient commands
- **Keyspace hits/misses**: Tracks cache efficiency
- **Connected clients**: Unexpected connections could suggest issues

## Backup Strategy

Redis offers two backup mechanisms:

1. **RDB Snapshots**: Point-in-time snapshots of the dataset
2. **AOF (Append Only File)**: Logs every write operation 

Recommended configuration:

```
save 900 1      # Save if at least 1 change in 15 minutes
save 300 10     # Save if at least 10 changes in 5 minutes
save 60 10000   # Save if at least 10000 changes in 1 minute
appendonly yes  # Enable AOF
```

## Redis Health Check API

The application provides an API to check Redis health:

```
GET /api/admin/system/redis-health
```

Response format:
```json
{
  "status": "healthy",
  "connected": true,
  "version": "6.2.6",
  "memoryUsage": {
    "used": "1.2GB",
    "total": "2.0GB",
    "percentUsed": 60
  },
  "queueStats": {
    "waiting": 5,
    "active": 2,
    "completed": 1000,
    "failed": 10
  }
}
```

## Troubleshooting

Common issues and solutions:

1. **Connection Refused**: Check firewall settings and that Redis is running
2. **Authentication Failed**: Verify password/username configuration
3. **Out of Memory**: Increase Redis memory or implement better key expiration
4. **High Latency**: Check network issues or high CPU usage

## Further Reading

- [Redis Documentation](https://redis.io/documentation)
- [BullMQ Documentation](https://docs.bullmq.io/)
- [Redis Best Practices](https://redis.io/topics/optimization)