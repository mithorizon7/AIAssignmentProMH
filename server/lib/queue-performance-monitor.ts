/**
 * Queue Performance Monitor
 * Comprehensive monitoring and metrics for BullMQ queue performance
 */

import { Queue, Worker, QueueEvents } from 'bullmq';
import { logger } from './logger';

interface QueueMetrics {
  totalJobs: number;
  waitingJobs: number;
  activeJobs: number;
  completedJobs: number;
  failedJobs: number;
  delayedJobs: number;
  
  // Performance metrics
  avgWaitTime: number;
  avgProcessingTime: number;
  throughputPerMinute: number;
  
  // Health indicators
  stalledJobs: number;
  retryJobs: number;
  lastUpdate: string;
}

interface JobTiming {
  jobId: string;
  addedAt: number;
  startedAt?: number;
  completedAt?: number;
  waitTime?: number;
  processingTime?: number;
}

class QueuePerformanceMonitor {
  private queue: Queue;
  private queueEvents: QueueEvents;
  private jobTimings: Map<string, JobTiming> = new Map();
  private metrics: QueueMetrics;
  private metricsInterval: NodeJS.Timeout | null = null;
  private startTime: number = Date.now();

  constructor(queue: Queue, queueEvents: QueueEvents) {
    this.queue = queue;
    this.queueEvents = queueEvents;
    this.metrics = this.initializeMetrics();
    this.setupEventListeners();
    this.startMetricsCollection();
  }

  private initializeMetrics(): QueueMetrics {
    return {
      totalJobs: 0,
      waitingJobs: 0,
      activeJobs: 0,
      completedJobs: 0,
      failedJobs: 0,
      delayedJobs: 0,
      avgWaitTime: 0,
      avgProcessingTime: 0,
      throughputPerMinute: 0,
      stalledJobs: 0,
      retryJobs: 0,
      lastUpdate: new Date().toISOString()
    };
  }

  private setupEventListeners() {
    // Track job lifecycle for performance metrics
    this.queueEvents.on('added', ({ jobId }) => {
      this.jobTimings.set(jobId, {
        jobId,
        addedAt: Date.now()
      });
      logger.debug(`[QUEUE-PERF] Job added to queue`, { jobId });
    });

    this.queueEvents.on('active', ({ jobId }) => {
      const timing = this.jobTimings.get(jobId);
      if (timing) {
        timing.startedAt = Date.now();
        timing.waitTime = timing.startedAt - timing.addedAt;
        logger.debug(`[QUEUE-PERF] Job started processing`, { 
          jobId, 
          waitTime: timing.waitTime 
        });
      }
    });

    this.queueEvents.on('completed', ({ jobId }) => {
      const timing = this.jobTimings.get(jobId);
      if (timing && timing.startedAt) {
        timing.completedAt = Date.now();
        timing.processingTime = timing.completedAt - timing.startedAt;
        
        logger.info(`[QUEUE-PERF] Job completed`, {
          jobId,
          waitTime: timing.waitTime,
          processingTime: timing.processingTime,
          totalTime: timing.completedAt - timing.addedAt
        });
        
        // Clean up old timing data
        setTimeout(() => this.jobTimings.delete(jobId), 60000); // Keep for 1 minute
      }
    });

    this.queueEvents.on('failed', ({ jobId, failedReason }) => {
      const timing = this.jobTimings.get(jobId);
      logger.warn(`[QUEUE-PERF] Job failed`, {
        jobId,
        waitTime: timing?.waitTime,
        processingTime: timing?.startedAt ? Date.now() - timing.startedAt : undefined,
        failedReason
      });
      
      // Clean up timing data for failed jobs
      setTimeout(() => this.jobTimings.delete(jobId), 60000);
    });

    this.queueEvents.on('stalled', ({ jobId }) => {
      logger.error(`[QUEUE-PERF] Job stalled`, { jobId });
    });

    this.queueEvents.on('progress', ({ jobId, data }) => {
      logger.debug(`[QUEUE-PERF] Job progress`, { jobId, progress: data });
    });
  }

  private startMetricsCollection() {
    // Collect metrics every 30 seconds
    this.metricsInterval = setInterval(async () => {
      await this.updateMetrics();
    }, 30000);

    // Initial metrics collection
    this.updateMetrics();
  }

  private async updateMetrics() {
    try {
      // Get queue status
      const waiting = await this.queue.getWaiting();
      const active = await this.queue.getActive();
      const completed = await this.queue.getCompleted();
      const failed = await this.queue.getFailed();
      const delayed = await this.queue.getDelayed();

      // Calculate timing statistics
      const recentTimings = Array.from(this.jobTimings.values())
        .filter(timing => timing.completedAt && timing.waitTime && timing.processingTime);

      const avgWaitTime = recentTimings.length > 0
        ? recentTimings.reduce((sum, timing) => sum + (timing.waitTime || 0), 0) / recentTimings.length
        : 0;

      const avgProcessingTime = recentTimings.length > 0
        ? recentTimings.reduce((sum, timing) => sum + (timing.processingTime || 0), 0) / recentTimings.length
        : 0;

      // Calculate throughput (jobs completed per minute)
      const oneMinuteAgo = Date.now() - 60000;
      const recentlyCompleted = recentTimings.filter(timing => 
        timing.completedAt && timing.completedAt > oneMinuteAgo
      ).length;

      // Update metrics
      this.metrics = {
        totalJobs: waiting.length + active.length + completed.length + failed.length + delayed.length,
        waitingJobs: waiting.length,
        activeJobs: active.length,
        completedJobs: completed.length,
        failedJobs: failed.length,
        delayedJobs: delayed.length,
        avgWaitTime: Math.round(avgWaitTime),
        avgProcessingTime: Math.round(avgProcessingTime),
        throughputPerMinute: recentlyCompleted,
        stalledJobs: 0, // BullMQ doesn't expose stalled count directly
        retryJobs: failed.filter(job => job.attemptsMade > 1).length,
        lastUpdate: new Date().toISOString()
      };

      // Log performance summary every 5 minutes
      if (Date.now() - this.startTime > 0 && (Date.now() - this.startTime) % (5 * 60 * 1000) < 30000) {
        this.logPerformanceSummary();
      }

      // Alert on performance issues
      this.checkPerformanceAlerts();

    } catch (error: any) {
      logger.error('[QUEUE-PERF] Failed to update metrics', { error: error.message });
    }
  }

  private logPerformanceSummary() {
    logger.info('[QUEUE-PERF] Performance Summary', {
      ...this.metrics,
      uptime: Math.round((Date.now() - this.startTime) / 1000 / 60), // minutes
      memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024 // MB
    });
  }

  private checkPerformanceAlerts() {
    const alerts = [];

    // High wait time alert
    if (this.metrics.avgWaitTime > 30000) { // 30 seconds
      alerts.push(`High average wait time: ${(this.metrics.avgWaitTime / 1000).toFixed(1)}s`);
    }

    // High processing time alert
    if (this.metrics.avgProcessingTime > 2 * 60 * 1000) { // 2 minutes
      alerts.push(`High average processing time: ${(this.metrics.avgProcessingTime / 1000).toFixed(1)}s`);
    }

    // Low throughput alert
    if (this.metrics.throughputPerMinute < 1 && this.metrics.waitingJobs > 5) {
      alerts.push(`Low throughput: ${this.metrics.throughputPerMinute} jobs/min with ${this.metrics.waitingJobs} waiting`);
    }

    // High failure rate alert
    const totalProcessed = this.metrics.completedJobs + this.metrics.failedJobs;
    if (totalProcessed > 10 && (this.metrics.failedJobs / totalProcessed) > 0.1) {
      alerts.push(`High failure rate: ${((this.metrics.failedJobs / totalProcessed) * 100).toFixed(1)}%`);
    }

    // Queue backup alert
    if (this.metrics.waitingJobs > 50) {
      alerts.push(`Queue backup: ${this.metrics.waitingJobs} jobs waiting`);
    }

    if (alerts.length > 0) {
      logger.warn('[QUEUE-PERF] Performance Alerts', { alerts });
    }
  }

  /**
   * Get current performance metrics
   */
  public getMetrics(): QueueMetrics {
    return { ...this.metrics };
  }

  /**
   * Get detailed timing data for recent jobs
   */
  public getRecentJobTimings(limit: number = 50): JobTiming[] {
    return Array.from(this.jobTimings.values())
      .filter(timing => timing.completedAt)
      .sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0))
      .slice(0, limit);
  }

  /**
   * Generate performance report
   */
  public generateReport(): {
    summary: QueueMetrics;
    recommendations: string[];
    health: 'excellent' | 'good' | 'warning' | 'critical';
  } {
    const recommendations: string[] = [];
    let health: 'excellent' | 'good' | 'warning' | 'critical' = 'excellent';

    // Performance analysis
    if (this.metrics.avgWaitTime > 60000) { // 1 minute
      recommendations.push('Consider increasing worker concurrency - high wait times detected');
      health = 'warning';
    }

    if (this.metrics.avgProcessingTime > 3 * 60 * 1000) { // 3 minutes
      recommendations.push('Optimize AI processing pipeline - high processing times detected');
      health = 'warning';
    }

    if (this.metrics.throughputPerMinute < 2 && this.metrics.waitingJobs > 10) {
      recommendations.push('Scale worker instances horizontally - low throughput with queue backup');
      health = 'critical';
    }

    const failureRate = this.metrics.completedJobs + this.metrics.failedJobs > 0
      ? this.metrics.failedJobs / (this.metrics.completedJobs + this.metrics.failedJobs)
      : 0;

    if (failureRate > 0.05) { // 5% failure rate
      recommendations.push('Investigate job failures - high failure rate detected');
      health = health === 'critical' ? 'critical' : 'warning';
    }

    if (this.metrics.waitingJobs > 100) {
      recommendations.push('Emergency scaling needed - severe queue backup');
      health = 'critical';
    }

    if (recommendations.length === 0) {
      recommendations.push('Queue performance is optimal');
      health = this.metrics.throughputPerMinute > 5 ? 'excellent' : 'good';
    }

    return {
      summary: this.metrics,
      recommendations,
      health
    };
  }

  /**
   * Stop monitoring and cleanup
   */
  public stop() {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = null;
    }
    this.jobTimings.clear();
    logger.info('[QUEUE-PERF] Performance monitoring stopped');
  }
}

export default QueuePerformanceMonitor;