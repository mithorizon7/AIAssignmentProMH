/**
 * Enhanced queue management with monitoring and optimization
 * Provides comprehensive queue health monitoring and performance optimization
 */

import { logger } from './logger';
import { isProduction } from './env-config';

export interface QueueMetrics {
  active: number;
  waiting: number;
  completed: number;
  failed: number;
  delayed: number;
  throughput: number; // jobs per minute
  averageProcessingTime: number;
  failureRate: number;
  lastProcessed: Date | null;
}

export interface QueueHealth {
  status: 'healthy' | 'warning' | 'critical';
  metrics: QueueMetrics;
  recommendations: string[];
  alerts: string[];
}

class QueueManager {
  private processingHistory: Array<{
    jobId: string;
    duration: number;
    success: boolean;
    timestamp: Date;
    error?: string;
  }> = [];
  
  private readonly maxHistorySize = 1000;
  private readonly slowJobThreshold = 30000; // 30 seconds
  private alertThresholds = {
    maxWaiting: 100,
    maxActive: 50,
    maxFailureRate: 10, // percentage
    maxAverageProcessingTime: 60000 // 1 minute
  };

  /**
   * Records job processing metrics
   */
  recordJobProcessing(jobId: string, duration: number, success: boolean, error?: string): void {
    const record = {
      jobId,
      duration,
      success,
      timestamp: new Date(),
      error
    };

    this.processingHistory.push(record);

    // Keep history size manageable
    if (this.processingHistory.length > this.maxHistorySize) {
      this.processingHistory.shift();
    }

    // Log slow jobs
    if (duration > this.slowJobThreshold) {
      logger.warn('Slow job detected', {
        jobId,
        duration,
        slow_job_threshold: this.slowJobThreshold
      });
    }

    // Log failed jobs
    if (!success) {
      logger.error('Job failed', {
        jobId,
        duration,
        error: error || 'Unknown error'
      });
    }
  }

  /**
   * Gets queue performance metrics
   */
  async getQueueMetrics(): Promise<QueueMetrics> {
    try {
      // Import dynamically to avoid circular dependencies
      const { queueApi } = await import('../queue/bullmq-submission-queue');
      const stats = await queueApi.getStats();
      
      // Calculate metrics from processing history
      const recentJobs = this.processingHistory.filter(
        job => Date.now() - job.timestamp.getTime() < 60000 // Last minute
      );
      
      const totalJobs = recentJobs.length;
      const failedJobs = recentJobs.filter(job => !job.success).length;
      const averageProcessingTime = totalJobs > 0 
        ? recentJobs.reduce((sum, job) => sum + job.duration, 0) / totalJobs 
        : 0;
      
      const lastProcessed = this.processingHistory.length > 0 
        ? this.processingHistory[this.processingHistory.length - 1].timestamp
        : null;

      return {
        active: stats.active,
        waiting: stats.waiting,
        completed: stats.completed,
        failed: stats.failed,
        delayed: stats.delayed || 0,
        throughput: totalJobs, // jobs per minute
        averageProcessingTime,
        failureRate: totalJobs > 0 ? (failedJobs / totalJobs) * 100 : 0,
        lastProcessed
      };
    } catch (error) {
      logger.error('Failed to get queue metrics', { error });
      throw error;
    }
  }

  /**
   * Analyzes queue health
   */
  async analyzeQueueHealth(): Promise<QueueHealth> {
    const metrics = await this.getQueueMetrics();
    
    let status: 'healthy' | 'warning' | 'critical' = 'healthy';
    const recommendations: string[] = [];
    const alerts: string[] = [];

    // Check waiting jobs
    if (metrics.waiting > this.alertThresholds.maxWaiting) {
      status = 'critical';
      alerts.push(`High number of waiting jobs: ${metrics.waiting}`);
      recommendations.push('Consider scaling up queue workers');
    } else if (metrics.waiting > this.alertThresholds.maxWaiting * 0.7) {
      status = status === 'critical' ? 'critical' : 'warning';
      recommendations.push('Monitor queue backlog - may need more workers');
    }

    // Check active jobs
    if (metrics.active > this.alertThresholds.maxActive) {
      status = 'critical';
      alerts.push(`High number of active jobs: ${metrics.active}`);
      recommendations.push('Check for stuck jobs or increase worker capacity');
    }

    // Check failure rate
    if (metrics.failureRate > this.alertThresholds.maxFailureRate) {
      status = 'critical';
      alerts.push(`High failure rate: ${metrics.failureRate.toFixed(1)}%`);
      recommendations.push('Investigate job failures and improve error handling');
    }

    // Check processing time
    if (metrics.averageProcessingTime > this.alertThresholds.maxAverageProcessingTime) {
      status = status === 'critical' ? 'critical' : 'warning';
      recommendations.push('Jobs are taking longer than expected - optimize processing');
    }

    // Check for stalled queue
    if (metrics.lastProcessed) {
      const timeSinceLastJob = Date.now() - metrics.lastProcessed.getTime();
      if (timeSinceLastJob > 300000 && metrics.waiting > 0) { // 5 minutes
        status = 'critical';
        alerts.push('Queue appears to be stalled - no jobs processed recently');
        recommendations.push('Restart queue workers or check Redis connection');
      }
    }

    return {
      status,
      metrics,
      recommendations,
      alerts
    };
  }

  /**
   * Optimizes queue performance
   */
  async optimizeQueue(): Promise<void> {
    try {
      logger.info('Starting queue optimization');
      
      // Import dynamically to avoid circular dependencies
      const { queueApi } = await import('../queue/bullmq-submission-queue');
      
      // Clean up old completed jobs
      await queueApi.cleanOldJobs();
      
      // Get current metrics
      const metrics = await this.getQueueMetrics();
      
      // Log optimization results
      logger.info('Queue optimization completed', {
        active_jobs: metrics.active,
        waiting_jobs: metrics.waiting,
        completed_jobs: metrics.completed,
        failed_jobs: metrics.failed,
        throughput: metrics.throughput,
        failure_rate: metrics.failureRate
      });
      
    } catch (error) {
      logger.error('Queue optimization failed', { error });
      throw error;
    }
  }

  /**
   * Gets recent failed jobs
   */
  getRecentFailedJobs(limit: number = 10): Array<{
    jobId: string;
    duration: number;
    timestamp: Date;
    error?: string;
  }> {
    return this.processingHistory
      .filter(job => !job.success)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  /**
   * Gets slow jobs from history
   */
  getSlowJobs(limit: number = 10): Array<{
    jobId: string;
    duration: number;
    timestamp: Date;
  }> {
    return this.processingHistory
      .filter(job => job.duration > this.slowJobThreshold)
      .sort((a, b) => b.duration - a.duration)
      .slice(0, limit);
  }

  /**
   * Sets custom alert thresholds
   */
  setAlertThresholds(thresholds: Partial<typeof this.alertThresholds>): void {
    this.alertThresholds = { ...this.alertThresholds, ...thresholds };
    logger.info('Queue alert thresholds updated', { thresholds: this.alertThresholds });
  }
}

// Global queue manager instance
export const queueManager = new QueueManager();

/**
 * Initializes queue monitoring
 */
export async function initializeQueueMonitoring(): Promise<void> {
  try {
    // Run initial health check
    const health = await queueManager.analyzeQueueHealth();
    
    logger.info('Queue monitoring initialized', {
      status: health.status,
      active_jobs: health.metrics.active,
      waiting_jobs: health.metrics.waiting
    });
    
    // Schedule regular optimization (every 30 minutes in production)
    if (isProduction()) {
      setInterval(async () => {
        try {
          await queueManager.optimizeQueue();
        } catch (error) {
          logger.error('Scheduled queue optimization failed', { error });
        }
      }, 30 * 60 * 1000); // 30 minutes
    }
    
    // Schedule regular health checks (every 5 minutes in production)
    if (isProduction()) {
      setInterval(async () => {
        try {
          const health = await queueManager.analyzeQueueHealth();
          
          if (health.status === 'critical') {
            logger.error('Queue health is critical', {
              alerts: health.alerts,
              recommendations: health.recommendations
            });
          } else if (health.status === 'warning') {
            logger.warn('Queue health warning', {
              recommendations: health.recommendations
            });
          }
        } catch (error) {
          logger.error('Queue health check failed', { error });
        }
      }, 5 * 60 * 1000); // 5 minutes
    }
    
  } catch (error) {
    logger.error('Failed to initialize queue monitoring', { error });
  }
}

/**
 * Wrapper function to monitor job processing
 */
export async function monitoredJobProcessing<T>(
  jobId: string,
  processingFn: () => Promise<T>
): Promise<T> {
  const start = Date.now();
  
  try {
    const result = await processingFn();
    const duration = Date.now() - start;
    
    queueManager.recordJobProcessing(jobId, duration, true);
    
    return result;
  } catch (error) {
    const duration = Date.now() - start;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    queueManager.recordJobProcessing(jobId, duration, false, errorMessage);
    
    throw error;
  }
}

/**
 * Gets comprehensive queue health status
 */
export async function getQueueHealthStatus(): Promise<QueueHealth> {
  return await queueManager.analyzeQueueHealth();
}