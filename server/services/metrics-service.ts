import { db } from '../db';
import { submissions, feedback } from '../../shared/schema';
import { eq, count, avg, max, min, gt, lt, between, and, desc, sql } from 'drizzle-orm';

/**
 * Service for collecting and analyzing system performance metrics
 * This will be useful for monitoring system health and performance with large class sizes
 */
export class MetricsService {
  /**
   * Get submission processing statistics
   */
  async getProcessingStats(): Promise<{
    averageProcessingTimeMs: number;
    totalProcessed: number;
    pendingCount: number;
    processingCount: number;
    completedCount: number;
    failedCount: number;
    lastHourCount: number;
    lastDayCount: number;
  }> {
    // Calculate average processing time from feedback records
    const [avgResult] = await db
      .select({ avg: avg(feedback.processingTime).as('average') })
      .from(feedback);
    
    // Get count of submissions by status
    const [pendingResult] = await db
      .select({ count: count() })
      .from(submissions)
      .where(eq(submissions.status, 'pending'));
    
    const [processingResult] = await db
      .select({ count: count() })
      .from(submissions)
      .where(eq(submissions.status, 'processing'));
    
    const [completedResult] = await db
      .select({ count: count() })
      .from(submissions)
      .where(eq(submissions.status, 'completed'));
    
    const [failedResult] = await db
      .select({ count: count() })
      .from(submissions)
      .where(eq(submissions.status, 'failed'));
    
    // Get count of submissions in the last hour
    const oneHourAgo = new Date();
    oneHourAgo.setHours(oneHourAgo.getHours() - 1);
    
    const [lastHourResult] = await db
      .select({ count: count() })
      .from(submissions)
      .where(gt(submissions.createdAt, oneHourAgo));
    
    // Get count of submissions in the last day
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);
    
    const [lastDayResult] = await db
      .select({ count: count() })
      .from(submissions)
      .where(gt(submissions.createdAt, oneDayAgo));
    
    return {
      averageProcessingTimeMs: avgResult?.avg || 0,
      totalProcessed: (completedResult?.count || 0) + (failedResult?.count || 0),
      pendingCount: pendingResult?.count || 0,
      processingCount: processingResult?.count || 0,
      completedCount: completedResult?.count || 0,
      failedCount: failedResult?.count || 0,
      lastHourCount: lastHourResult?.count || 0,
      lastDayCount: lastDayResult?.count || 0,
    };
  }

  /**
   * Get performance metrics breakdown by assignment
   */
  async getAssignmentMetrics(assignmentId?: number): Promise<Array<{
    assignmentId: number;
    totalSubmissions: number;
    averageProcessingTime: number | null;
    maxProcessingTime: number | null;
    minProcessingTime: number | null;
  }>> {
    // Base query to get assignment stats
    if (assignmentId) {
      // If assignmentId is provided, filter by it
      return db
        .select({
          assignmentId: submissions.assignmentId,
          totalSubmissions: count(),
          averageProcessingTime: avg(feedback.processingTime),
          maxProcessingTime: max(feedback.processingTime),
          minProcessingTime: min(feedback.processingTime),
        })
        .from(submissions)
        .leftJoin(feedback, eq(submissions.id, feedback.submissionId))
        .where(eq(submissions.assignmentId, assignmentId))
        .groupBy(submissions.assignmentId);
    } else {
      // Otherwise return all assignments
      return db
        .select({
          assignmentId: submissions.assignmentId,
          totalSubmissions: count(),
          averageProcessingTime: avg(feedback.processingTime),
          maxProcessingTime: max(feedback.processingTime),
          minProcessingTime: min(feedback.processingTime),
        })
        .from(submissions)
        .leftJoin(feedback, eq(submissions.id, feedback.submissionId))
        .groupBy(submissions.assignmentId);
    }
  }

  /**
   * Get processing time percentiles for performance analysis using database-level percentile functions
   * This is enterprise-grade implementation that avoids loading all data into memory
   * Uses PostgreSQL's built-in percentile_cont function for optimal performance at scale
   */
  async getProcessingTimePercentiles(): Promise<{
    p50: number;
    p75: number;
    p90: number;
    p95: number;
    p99: number;
  }> {
    console.log('[METRICS] Calculating percentiles using database-level aggregation for scalability');
    
    try {
      // Use PostgreSQL's built-in percentile_cont function to calculate percentiles at database level
      // This prevents loading millions of records into memory and ensures O(1) memory usage
      const [result] = await db
        .select({
          p50: sql<number>`percentile_cont(0.5) within group (order by ${feedback.processingTime})`.as('p50'),
          p75: sql<number>`percentile_cont(0.75) within group (order by ${feedback.processingTime})`.as('p75'),
          p90: sql<number>`percentile_cont(0.9) within group (order by ${feedback.processingTime})`.as('p90'),
          p95: sql<number>`percentile_cont(0.95) within group (order by ${feedback.processingTime})`.as('p95'),
          p99: sql<number>`percentile_cont(0.99) within group (order by ${feedback.processingTime})`.as('p99'),
          totalRecords: count(feedback.processingTime).as('total')
        })
        .from(feedback)
        .where(sql`${feedback.processingTime} IS NOT NULL`);

      // Fallback to zero if no data exists
      if (!result || result.totalRecords === 0) {
        console.log('[METRICS] No processing time data found, returning zero percentiles');
        return { p50: 0, p75: 0, p90: 0, p95: 0, p99: 0 };
      }

      console.log(`[METRICS] Calculated percentiles from ${result.totalRecords} records using database aggregation`);
      
      return {
        p50: Math.round(result.p50 || 0),
        p75: Math.round(result.p75 || 0),
        p90: Math.round(result.p90 || 0),
        p95: Math.round(result.p95 || 0),
        p99: Math.round(result.p99 || 0),
      };
    } catch (error) {
      console.error('[METRICS] Error calculating percentiles:', error);
      // Return zeros on error rather than crashing
      return { p50: 0, p75: 0, p90: 0, p95: 0, p99: 0 };
    }
  }

  /**
   * Get system load aggregated by time buckets for the specified period
   * Uses database-level aggregation to avoid loading large datasets into memory
   * Returns time-series data suitable for dashboard visualization
   */
  async getSystemLoad(unit: string = 'day', count: number = 7): Promise<Array<{
    period: string;
    submissionCount: number;
    avgProcessingTime: number | null;
    completedCount: number;
    failedCount: number;
  }>> {
    console.log(`[METRICS] Getting system load for ${count} ${unit}(s) using database aggregation`);
    
    const timeAgo = new Date();
    
    switch (unit) {
      case 'hour':
        timeAgo.setHours(timeAgo.getHours() - count);
        break;
      case 'day':
        timeAgo.setDate(timeAgo.getDate() - count);
        break;
      case 'week':
        timeAgo.setDate(timeAgo.getDate() - (count * 7));
        break;
      case 'month':
        timeAgo.setMonth(timeAgo.getMonth() - count);
        break;
      default:
        timeAgo.setDate(timeAgo.getDate() - count);
    }
    
    // Use database-level aggregation to avoid loading individual records
    // Group by time buckets and aggregate metrics for each period
    let dateFormat: string;
    switch (unit) {
      case 'hour':
        dateFormat = 'YYYY-MM-DD HH24:00';
        break;
      case 'day':
        dateFormat = 'YYYY-MM-DD';
        break;
      case 'week':
        dateFormat = 'IYYY-IW'; // ISO year and week
        break;
      case 'month':
        dateFormat = 'YYYY-MM';
        break;
      default:
        dateFormat = 'YYYY-MM-DD';
    }
    
    try {
      const loadData = await db
        .select({
          period: sql<string>`to_char(${submissions.createdAt}, '${dateFormat}')`.as('period'),
          submissionCount: count(submissions.id).as('submissionCount'),
          avgProcessingTime: avg(feedback.processingTime).as('avgProcessingTime'),
          completedCount: sql<number>`count(case when ${submissions.status} = 'completed' then 1 end)`.as('completedCount'),
          failedCount: sql<number>`count(case when ${submissions.status} = 'failed' then 1 end)`.as('failedCount')
        })
        .from(submissions)
        .leftJoin(feedback, eq(submissions.id, feedback.submissionId))
        .where(gt(submissions.createdAt, timeAgo))
        .groupBy(sql`to_char(${submissions.createdAt}, '${dateFormat}')`)
        .orderBy(sql`to_char(${submissions.createdAt}, '${dateFormat}')`);
      
      console.log(`[METRICS] Aggregated system load data: ${loadData.length} time periods`);
      return loadData;
    } catch (error) {
      console.error('[METRICS] Error getting system load:', error);
      return [];
    }
  }
}

// Singleton instance
export const metricsService = new MetricsService();