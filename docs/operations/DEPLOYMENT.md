# Deployment Guide

## Overview

AIGrader is designed for enterprise-scale deployment with comprehensive support for various hosting platforms. This guide provides step-by-step instructions for deploying to production environments.

## Quick Deployment Checklist

- [ ] Configure environment variables on hosting platform
- [ ] Set up PostgreSQL database
- [ ] Configure Redis instance (production required)
- [ ] Obtain Google Gemini API key
- [ ] Build and deploy application
- [ ] Verify health endpoints

## Platform-Specific Deployment

### Replit Deployments (Recommended)

**Prerequisites:**
- Replit account with deployment access
- PostgreSQL database (Replit provides this)
- Redis instance (use Upstash or Redis Cloud)

**Step 1: Configure Environment Variables**

In your Replit deployment settings, add these **required** environment variables:

```bash
# Critical Production Variables
BASE_URL=https://your-app-name.replit.app
STRUCTURED_LOGGING=true

# Database (auto-configured by Replit)
DATABASE_URL=postgresql://...

# AI Service
GEMINI_API_KEY=your_gemini_api_key_here

# Redis Configuration
REDIS_URL=rediss://default:password@hostname:port
# OR individual Redis parameters:
REDIS_HOST=your-redis-host
REDIS_PORT=6380
REDIS_PASSWORD=your-redis-password

# Security
SESSION_SECRET=your_very_secure_session_secret_here
```

**Step 2: Deploy**
1. Connect your GitHub repository to Replit
2. Configure environment variables in Replit deployment settings
3. Deploy using Replit's deployment system

**Step 3: Verify Deployment**
```bash
curl https://your-app-name.replit.app/api/health
```

### Vercel + Database Services

**Prerequisites:**
- Vercel account
- External PostgreSQL (Railway, PlanetScale, or Supabase)
- Redis instance (Upstash recommended)

**Step 1: Database Setup**

1. **PostgreSQL on Railway:**
   ```bash
   # Create Railway project
   railway new
   railway add postgresql
   
   # Get connection string
   railway variables
   ```

2. **Redis on Upstash:**
   - Create account at [Upstash](https://upstash.com)
   - Create Redis database
   - Copy connection details

**Step 2: Configure Vercel**

Create `vercel.json`:
```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "installCommand": "npm install",
  "functions": {
    "server/index.js": {
      "maxDuration": 30
    }
  },
  "env": {
    "NODE_ENV": "production"
  }
}
```

**Step 3: Environment Variables**

Configure in Vercel dashboard:
```bash
BASE_URL=https://your-app.vercel.app
STRUCTURED_LOGGING=true
DATABASE_URL=postgresql://...
REDIS_URL=rediss://...
GEMINI_API_KEY=your_key_here
SESSION_SECRET=your_session_secret
```

**Step 4: Deploy**
```bash
vercel --prod
```

### Docker + Cloud Platforms

**Dockerfile:**
```dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci --only=production

# Copy application code
COPY . .

# Build application
RUN npm run build

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S aigrader -u 1001

# Change ownership
RUN chown -R aigrader:nodejs /app
USER aigrader

EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:5000/api/health || exit 1

CMD ["npm", "start"]
```

**Docker Compose (Development):**
```yaml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "5000:5000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://postgres:password@db:5432/aigrader
      - REDIS_URL=redis://redis:6379
    depends_on:
      - db
      - redis

  db:
    image: postgres:15
    environment:
      POSTGRES_DB: aigrader
      POSTGRES_PASSWORD: password
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
```

### AWS Deployment

**Using AWS App Runner:**

1. **Create apprunner.yaml:**
   ```yaml
   version: 1.0
   runtime: nodejs18
   build:
     commands:
       build:
         - npm ci
         - npm run build
   run:
     runtime-version: 18
     command: npm start
     network:
       port: 5000
       env: PORT
   ```

2. **Environment Configuration:**
   - Use AWS Systems Manager Parameter Store for secrets
   - Configure RDS PostgreSQL instance
   - Set up ElastiCache Redis cluster

**Using ECS with Fargate:**

1. **Task Definition:**
   ```json
   {
     "family": "aigrader",
     "networkMode": "awsvpc",
     "requiresCompatibilities": ["FARGATE"],
     "cpu": "512",
     "memory": "1024",
     "executionRoleArn": "arn:aws:iam::account:role/ecsTaskExecutionRole",
     "containerDefinitions": [
       {
         "name": "aigrader",
         "image": "your-account.dkr.ecr.region.amazonaws.com/aigrader:latest",
         "portMappings": [
           {
             "containerPort": 5000,
             "protocol": "tcp"
           }
         ],
         "environment": [
           {
             "name": "NODE_ENV",
             "value": "production"
           }
         ],
         "secrets": [
           {
             "name": "DATABASE_URL",
             "valueFrom": "arn:aws:ssm:region:account:parameter/aigrader/DATABASE_URL"
           }
         ]
       }
     ]
   }
   ```

### Google Cloud Platform

**Using Cloud Run:**

1. **Deploy Container:**
   ```bash
   # Build and push to Container Registry
   gcloud builds submit --tag gcr.io/PROJECT-ID/aigrader
   
   # Deploy to Cloud Run
   gcloud run deploy aigrader \
     --image gcr.io/PROJECT-ID/aigrader \
     --platform managed \
     --region us-central1 \
     --allow-unauthenticated \
     --set-env-vars NODE_ENV=production
   ```

2. **Configure Secrets:**
   ```bash
   # Store secrets in Secret Manager
   echo -n "your-database-url" | gcloud secrets create database-url --data-file=-
   echo -n "your-redis-url" | gcloud secrets create redis-url --data-file=-
   
   # Update Cloud Run service to use secrets
   gcloud run services update aigrader \
     --update-secrets DATABASE_URL=database-url:latest,REDIS_URL=redis-url:latest
   ```

## Environment Configuration

### Required Environment Variables

**Core Application:**
```bash
# REQUIRED: Application base URL
BASE_URL=https://your-domain.com

# REQUIRED: Enable structured logging for production
STRUCTURED_LOGGING=true

# REQUIRED: Application environment
NODE_ENV=production
```

**Database:**
```bash
# REQUIRED: PostgreSQL connection string
DATABASE_URL=postgresql://username:password@host:port/database
```

**AI Services:**
```bash
# REQUIRED: Google Gemini API key
GEMINI_API_KEY=your_gemini_api_key_here

# OPTIONAL: Specific Gemini model
GEMINI_MODEL_NAME=gemini-2.5-flash

# OPTIONAL: OpenAI fallback
OPENAI_API_KEY=your_openai_api_key_here
```

**Redis (Required for Production):**
```bash
# Option 1: Full connection URL (recommended)
REDIS_URL=rediss://default:password@hostname:port

# Option 2: Individual parameters
REDIS_HOST=your-redis-host
REDIS_PORT=6380
REDIS_PASSWORD=your-password
REDIS_USERNAME=default
```

**Security:**
```bash
# REQUIRED: Session encryption secret
SESSION_SECRET=your_very_secure_random_string_here

# OPTIONAL: CSRF protection (enabled by default)
CSRF_PROTECTION=true

# OPTIONAL: Rate limiting
RATE_LIMIT_REQUESTS_PER_MINUTE=100
```

### Optional Integrations

**File Storage:**
```bash
# Google Cloud Storage
GOOGLE_CLOUD_PROJECT_ID=your-project-id
GOOGLE_CLOUD_STORAGE_BUCKET=your-bucket-name
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
```

**Authentication SSO:**
```bash
# Auth0 SSO
AUTH0_DOMAIN=your-domain.auth0.com
AUTH0_CLIENT_ID=your_client_id
AUTH0_CLIENT_SECRET=your_client_secret
AUTH0_CALLBACK_URL=https://your-domain.com/api/auth-sso/callback

# MIT Horizon OIDC
MIT_HORIZON_OIDC_ISSUER_URL=https://mit-horizon.auth0.com/
MIT_HORIZON_OIDC_CLIENT_ID=your_client_id
MIT_HORIZON_OIDC_CLIENT_SECRET=your_client_secret
```

**Monitoring:**
```bash
# Application monitoring
ANALYTICS_API_KEY=your_analytics_key
MONITORING_API_KEY=your_monitoring_key

# Email notifications
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your_email@example.com
SMTP_PASS=your_email_password
```

## Database Setup

### PostgreSQL Requirements

**Minimum Requirements:**
- PostgreSQL 13+
- 2GB RAM minimum
- 10GB storage minimum
- Connection pooling recommended

**Schema Initialization:**
```bash
# Run database migrations
npm run db:push

# Verify tables created
npm run db:studio
```

**Performance Tuning:**
```sql
-- Recommended PostgreSQL settings for production
shared_buffers = 256MB
effective_cache_size = 1GB
work_mem = 4MB
maintenance_work_mem = 64MB
checkpoint_completion_target = 0.9
wal_buffers = 16MB
default_statistics_target = 100
```

### Redis Configuration

**Production Redis Setup:**
```bash
# Redis configuration for production
maxmemory-policy allkeys-lru
maxmemory 512mb
save 900 1
save 300 10
save 60 10000
```

**Redis Cloud Providers:**
- [Upstash](https://upstash.com) - Serverless Redis
- [Redis Cloud](https://redis.com/redis-enterprise-cloud/) - Enterprise Redis
- [AWS ElastiCache](https://aws.amazon.com/elasticache/) - AWS managed Redis

## SSL/TLS Configuration

### Nginx Configuration

```nginx
server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /path/to/certificate.crt;
    ssl_certificate_key /path/to/private.key;
    
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}
```

## Monitoring & Health Checks

### Health Endpoint

The application provides comprehensive health checks:

```bash
curl https://your-domain.com/api/health
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-01-18T20:30:00Z",
  "services": {
    "database": "healthy",
    "redis": "healthy",
    "ai_service": "healthy"
  },
  "version": "1.0.0",
  "uptime": "2d 14h 30m"
}
```

### Application Monitoring

**Recommended Monitoring Tools:**
- **APM**: New Relic, Datadog, or AppDynamics
- **Logs**: ELK Stack, Splunk, or cloud provider logging
- **Metrics**: Prometheus + Grafana
- **Uptime**: Pingdom, UptimeRobot, or StatusCake

**Key Metrics to Monitor:**
- Response times (target: <2s for API endpoints)
- Error rates (target: <1%)
- Memory usage (target: <80%)
- Database connection pool utilization
- Queue processing times
- AI service response times

### Log Management

**Structured Logging Configuration:**
```bash
# Enable structured JSON logging for production
STRUCTURED_LOGGING=true
```

**Log Aggregation Setup:**
```bash
# For ELK Stack
docker run -d \
  --name logstash \
  -v $(pwd)/logstash.conf:/usr/share/logstash/pipeline/logstash.conf \
  docker.elastic.co/logstash/logstash:8.0.0
```

## Security Considerations

### Production Security Checklist

- [ ] HTTPS enabled with valid SSL certificate
- [ ] Environment variables stored securely (not in code)
- [ ] Database connections encrypted
- [ ] Redis AUTH enabled
- [ ] CSRF protection enabled
- [ ] Rate limiting configured
- [ ] File upload size limits enforced
- [ ] Input validation on all endpoints
- [ ] Session security configured
- [ ] Security headers configured

### Security Headers

Configure these security headers in your reverse proxy:

```nginx
add_header X-Frame-Options DENY;
add_header X-Content-Type-Options nosniff;
add_header X-XSS-Protection "1; mode=block";
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
add_header Referrer-Policy "strict-origin-when-cross-origin";
add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:";
```

## Backup & Recovery

### Database Backup

**Automated PostgreSQL Backup:**
```bash
#!/bin/bash
# Daily backup script
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="aigrader_backup_$DATE.sql"

pg_dump $DATABASE_URL > $BACKUP_FILE
gzip $BACKUP_FILE

# Upload to cloud storage
aws s3 cp $BACKUP_FILE.gz s3://your-backup-bucket/
```

**Restore from Backup:**
```bash
# Download and restore backup
aws s3 cp s3://your-backup-bucket/aigrader_backup_20250118.sql.gz .
gunzip aigrader_backup_20250118.sql.gz
psql $DATABASE_URL < aigrader_backup_20250118.sql
```

### File Storage Backup

If using local file storage, implement regular backups:
```bash
# Backup uploaded files
tar -czf uploads_backup_$(date +%Y%m%d).tar.gz uploads/
```

## Scaling Considerations

### Horizontal Scaling

**Load Balancer Configuration:**
```nginx
upstream aigrader_backend {
    server app1.internal:5000;
    server app2.internal:5000;
    server app3.internal:5000;
}

server {
    listen 443 ssl;
    server_name your-domain.com;
    
    location / {
        proxy_pass http://aigrader_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

**Session Affinity:**
Since AIGrader uses Redis for session storage, no session affinity is required.

### Database Scaling

**Read Replicas:**
```javascript
// Configure read replicas in production
const readReplicas = [
  'postgresql://user:pass@read-replica-1:5432/aigrader',
  'postgresql://user:pass@read-replica-2:5432/aigrader'
];
```

**Connection Pooling:**
```javascript
// Configure connection pooling
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});
```

## Troubleshooting

### Common Deployment Issues

**1. Build Failures:**
```bash
# Check Node.js version
node --version  # Should be 18+

# Clear npm cache
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

**2. Database Connection Issues:**
```bash
# Test database connection
psql $DATABASE_URL -c "SELECT version();"

# Check for SSL requirements
psql "$DATABASE_URL?sslmode=require" -c "SELECT 1;"
```

**3. Redis Connection Issues:**
```bash
# Test Redis connection
redis-cli -u $REDIS_URL ping

# Check TLS requirements
redis-cli -u $REDIS_URL --tls ping
```

**4. Environment Variable Issues:**
```bash
# Verify environment variables are set
env | grep -E "(BASE_URL|DATABASE_URL|GEMINI_API_KEY)"

# Check application logs for missing variables
tail -f /var/log/aigrader.log | grep -i "environment"
```

### Performance Issues

**High Memory Usage:**
- Check for memory leaks in application logs
- Monitor Redis memory usage
- Review file upload handling

**Slow Database Queries:**
- Enable query logging in PostgreSQL
- Use `EXPLAIN ANALYZE` on slow queries
- Check for missing indexes

**AI Service Timeouts:**
- Verify API key validity
- Check network connectivity to AI services
- Monitor AI service rate limits

### Emergency Recovery

**Service Recovery Steps:**
1. Check health endpoint: `/api/health`
2. Verify database connectivity
3. Check Redis availability
4. Review application logs
5. Restart application if necessary
6. Verify external service connectivity

**Rollback Procedure:**
1. Switch traffic to previous deployment
2. Verify application functionality
3. Investigate deployment issues
4. Fix issues and redeploy

---

For additional deployment support, see the [GitHub Issues](../../issues) or contact the development team.