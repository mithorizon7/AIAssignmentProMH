/**
 * Comprehensive health check system for production monitoring
 * Provides detailed system health information for monitoring and alerting
 */

import { logger } from './logger';
import { db } from '../db';
import { redisClient, isRedisReady, getRedisStatus } from '../queue/redis-client';
import { GeminiAdapter } from '../adapters/gemini-adapter';
import { OpenAIAdapter } from '../adapters/openai-adapter';
import { Storage } from '@google-cloud/storage';

export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  version: string;
  checks: {
    database: HealthCheck;
    redis: HealthCheck;
    ai_services: HealthCheck;
    storage: HealthCheck;
    memory: HealthCheck;
    queue: HealthCheck;
  };
  metrics: {
    memory_usage: number;
    cpu_usage?: number;
    active_connections?: number;
    queue_size?: number;
  };
}

interface HealthCheck {
  status: 'pass' | 'fail' | 'warn';
  response_time: number;
  message?: string;
  details?: Record<string, any>;
}

/**
 * Checks database connectivity and performance
 */
async function checkDatabase(): Promise<HealthCheck> {
  const start = Date.now();
  
  try {
    // Test basic connectivity
    await db.execute('SELECT 1');
    
    // Test a simple query performance
    const result = await db.execute('SELECT COUNT(*) as count FROM users');
    const userCount = result.rows[0]?.count || 0;
    
    const responseTime = Date.now() - start;
    
    return {
      status: responseTime < 1000 ? 'pass' : 'warn',
      response_time: responseTime,
      message: responseTime < 1000 ? 'Database responsive' : 'Database slow response',
      details: {
        user_count: userCount,
        response_time_ms: responseTime
      }
    };
    
  } catch (error) {
    return {
      status: 'fail',
      response_time: Date.now() - start,
      message: `Database connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      details: { error: error instanceof Error ? error.message : 'Unknown error' }
    };
  }
}

/**
 * Checks Redis connectivity and performance using centralized client
 */
async function checkRedis(): Promise<HealthCheck> {
  const start = Date.now();
  
  try {
    // Check if Redis is ready
    if (!isRedisReady()) {
      return {
        status: 'fail',
        response_time: Date.now() - start,
        message: 'Redis client not ready',
        details: { 
          redis_status: getRedisStatus(),
          error: 'Client not in ready state'
        }
      };
    }
    
    // Test Redis connectivity
    const pong = await redisClient.ping();
    
    // Get Redis info and status
    const info = await redisClient.info('memory');
    const memoryMatch = info.match(/used_memory:(\d+)/);
    const memoryUsage = memoryMatch ? parseInt(memoryMatch[1]) : 0;
    const status = getRedisStatus();
    
    const responseTime = Date.now() - start;
    
    return {
      status: pong === 'PONG' ? 'pass' : 'fail',
      response_time: responseTime,
      message: pong === 'PONG' ? 'Redis responsive' : 'Redis not responding',
      details: {
        memory_usage_bytes: memoryUsage,
        memory_usage_mb: Math.round(memoryUsage / 1024 / 1024),
        response_time_ms: responseTime,
        connection_status: status.status,
        uptime: status.uptime,
        command_queue_length: status.commandQueueLength
      }
    };
    
  } catch (error) {
    return {
      status: 'fail',
      response_time: Date.now() - start,
      message: `Redis connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      details: { 
        error: error instanceof Error ? error.message : 'Unknown error',
        redis_status: getRedisStatus()
      }
    };
  }
}

/**
 * Checks AI service availability
 */
async function checkAIServices(): Promise<HealthCheck> {
  const start = Date.now();
  const services = [];
  
  try {
    // Check Gemini availability
    if (process.env.GEMINI_API_KEY) {
      try {
        const geminiAdapter = new GeminiAdapter();
        // Test with a simple prompt
        const response = await geminiAdapter.generateCompletion('Test connection');
        services.push({
          service: 'Gemini',
          status: 'available',
          model: response.modelName || 'gemini-2.5-flash'
        });
      } catch (error) {
        services.push({
          service: 'Gemini',
          status: 'unavailable',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
    
    // Check OpenAI availability
    if (process.env.OPENAI_API_KEY) {
      try {
        const openaiAdapter = new OpenAIAdapter();
        const response = await openaiAdapter.generateCompletion('Test connection');
        services.push({
          service: 'OpenAI',
          status: 'available',
          model: response.modelName || 'gpt-4'
        });
      } catch (error) {
        services.push({
          service: 'OpenAI',
          status: 'unavailable',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
    
    const responseTime = Date.now() - start;
    const availableServices = services.filter(s => s.status === 'available');
    
    return {
      status: availableServices.length > 0 ? 'pass' : 'fail',
      response_time: responseTime,
      message: `${availableServices.length} AI service(s) available`,
      details: {
        services,
        available_count: availableServices.length,
        total_count: services.length
      }
    };
    
  } catch (error) {
    return {
      status: 'fail',
      response_time: Date.now() - start,
      message: `AI services check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      details: { error: error instanceof Error ? error.message : 'Unknown error' }
    };
  }
}

/**
 * Checks storage service availability
 */
async function checkStorage(): Promise<HealthCheck> {
  const start = Date.now();
  
  try {
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS && process.env.GCS_BUCKET_NAME) {
      const storage = new Storage();
      const bucket = storage.bucket(process.env.GCS_BUCKET_NAME);
      
      // Test bucket access
      const [exists] = await bucket.exists();
      
      const responseTime = Date.now() - start;
      
      return {
        status: exists ? 'pass' : 'fail',
        response_time: responseTime,
        message: exists ? 'Google Cloud Storage accessible' : 'Google Cloud Storage bucket not found',
        details: {
          bucket_name: process.env.GCS_BUCKET_NAME,
          exists,
          response_time_ms: responseTime
        }
      };
    } else {
      return {
        status: 'warn',
        response_time: Date.now() - start,
        message: 'Google Cloud Storage not configured - using local storage',
        details: {
          configured: false,
          fallback: 'local storage'
        }
      };
    }
    
  } catch (error) {
    return {
      status: 'fail',
      response_time: Date.now() - start,
      message: `Storage check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      details: { error: error instanceof Error ? error.message : 'Unknown error' }
    };
  }
}

/**
 * Checks system memory usage
 */
function checkMemory(): HealthCheck {
  const start = Date.now();
  
  try {
    const memoryUsage = process.memoryUsage();
    // Calculate percentage based on heap usage vs heap total (more accurate)
    const memoryPercent = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;
    
    let status: 'pass' | 'warn' | 'fail' = 'pass';
    let message = 'Memory usage normal';
    
    if (memoryPercent > 90) {
      status = 'fail';
      message = 'Critical memory usage';
    } else if (memoryPercent > 75) {
      status = 'warn';
      message = 'High memory usage';
    }
    
    return {
      status,
      response_time: Date.now() - start,
      message,
      details: {
        heap_used_mb: Math.round(memoryUsage.heapUsed / 1024 / 1024),
        heap_total_mb: Math.round(memoryUsage.heapTotal / 1024 / 1024),
        external_mb: Math.round(memoryUsage.external / 1024 / 1024),
        memory_percent: Math.round(memoryPercent),
        rss_mb: Math.round(memoryUsage.rss / 1024 / 1024)
      }
    };
    
  } catch (error) {
    return {
      status: 'fail',
      response_time: Date.now() - start,
      message: `Memory check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      details: { error: error instanceof Error ? error.message : 'Unknown error' }
    };
  }
}

/**
 * Checks queue system health
 */
async function checkQueue(): Promise<HealthCheck> {
  const start = Date.now();
  
  try {
    // Import queue dynamically to avoid circular dependencies
    const { queueApi } = await import('../queue/bullmq-submission-queue');
    
    const stats = await queueApi.getStats();
    const responseTime = Date.now() - start;
    
    let status: 'pass' | 'warn' | 'fail' = 'pass';
    let message = 'Queue system operational';
    
    if (stats.failed > 10) {
      status = 'warn';
      message = 'High number of failed jobs';
    }
    
    if (stats.active > 100) {
      status = 'warn';
      message = 'High number of active jobs';
    }
    
    return {
      status,
      response_time: responseTime,
      message,
      details: {
        active_jobs: stats.active,
        waiting_jobs: stats.waiting,
        completed_jobs: stats.completed,
        failed_jobs: stats.failed,
        response_time_ms: responseTime
      }
    };
    
  } catch (error) {
    return {
      status: 'fail',
      response_time: Date.now() - start,
      message: `Queue check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      details: { error: error instanceof Error ? error.message : 'Unknown error' }
    };
  }
}

/**
 * Performs comprehensive health check
 */
export async function performHealthCheck(): Promise<HealthCheckResult> {
  const startTime = Date.now();
  
  logger.info('Starting health check');
  
  // Run all checks in parallel
  const [database, redis, aiServices, storage, memory, queue] = await Promise.all([
    checkDatabase(),
    checkRedis(),
    checkAIServices(),
    checkStorage(),
    checkMemory(),
    checkQueue()
  ]);
  
  // Determine overall health status
  const checks = { database, redis, ai_services: aiServices, storage, memory, queue };
  const failedChecks = Object.values(checks).filter(check => check.status === 'fail');
  const warnChecks = Object.values(checks).filter(check => check.status === 'warn');
  
  let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
  
  if (failedChecks.length > 0) {
    overallStatus = 'unhealthy';
  } else if (warnChecks.length > 0) {
    overallStatus = 'degraded';
  }
  
  const result: HealthCheckResult = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0',
    checks,
    metrics: {
      memory_usage: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      queue_size: queue.details?.active_jobs || 0
    }
  };
  
  const totalTime = Date.now() - startTime;
  
  logger.info('Health check completed', {
    status: overallStatus,
    duration_ms: totalTime,
    failed_checks: failedChecks.length,
    warning_checks: warnChecks.length
  });
  
  return result;
}

/**
 * Lightweight health check for quick monitoring
 */
export async function quickHealthCheck(): Promise<{ status: 'ok' | 'error'; message: string }> {
  try {
    // Quick database check
    await db.execute('SELECT 1');
    
    // Quick Redis check (if configured)
    if (process.env.REDIS_URL || process.env.REDIS_HOST) {
      await redisClient.ping();
    }
    
    return {
      status: 'ok',
      message: 'System operational'
    };
    
  } catch (error) {
    return {
      status: 'error',
      message: `System check failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}