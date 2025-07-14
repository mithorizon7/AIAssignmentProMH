/**
 * Database optimization and connection management
 * Provides connection pooling, query optimization, and performance monitoring
 */

import { logger } from './logger';
import { db } from '../db';
import { isProduction } from './env-config';

export interface DatabaseMetrics {
  activeConnections: number;
  totalConnections: number;
  averageQueryTime: number;
  slowQueries: number;
  errorRate: number;
  lastOptimized: Date;
}

export interface QueryPerformance {
  query: string;
  duration: number;
  timestamp: Date;
  success: boolean;
  error?: string;
}

class DatabaseOptimizer {
  private queryHistory: QueryPerformance[] = [];
  private readonly maxHistorySize = 1000;
  private readonly slowQueryThreshold = 1000; // 1 second
  private lastOptimizationRun: Date = new Date();

  /**
   * Monitors query performance
   */
  recordQuery(query: string, duration: number, success: boolean, error?: string): void {
    const performance: QueryPerformance = {
      query: query.slice(0, 100), // Truncate long queries
      duration,
      timestamp: new Date(),
      success,
      error
    };

    this.queryHistory.push(performance);

    // Keep history size manageable
    if (this.queryHistory.length > this.maxHistorySize) {
      this.queryHistory.shift();
    }

    // Log slow queries
    if (duration > this.slowQueryThreshold) {
      logger.warn('Slow query detected', {
        query: query.slice(0, 200),
        duration,
        slow_query_threshold: this.slowQueryThreshold
      });
    }
  }

  /**
   * Gets database performance metrics
   */
  getMetrics(): DatabaseMetrics {
    const recentQueries = this.queryHistory.filter(
      q => Date.now() - q.timestamp.getTime() < 60000 // Last minute
    );

    const totalQueries = recentQueries.length;
    const failedQueries = recentQueries.filter(q => !q.success).length;
    const slowQueries = recentQueries.filter(q => q.duration > this.slowQueryThreshold).length;
    const averageQueryTime = totalQueries > 0 
      ? recentQueries.reduce((sum, q) => sum + q.duration, 0) / totalQueries 
      : 0;

    return {
      activeConnections: 0, // This would need to be implemented based on the specific DB driver
      totalConnections: 0,
      averageQueryTime,
      slowQueries,
      errorRate: totalQueries > 0 ? (failedQueries / totalQueries) * 100 : 0,
      lastOptimized: this.lastOptimizationRun
    };
  }

  /**
   * Optimizes database performance
   */
  async optimizeDatabase(): Promise<void> {
    try {
      logger.info('Starting database optimization');

      // Analyze table statistics
      await this.analyzeTableStatistics();

      // Check for missing indexes
      await this.checkIndexes();

      // Clean up old data if needed
      await this.cleanupOldData();

      // Update vacuum statistics (PostgreSQL specific)
      if (isProduction()) {
        await this.updateStatistics();
      }

      this.lastOptimizationRun = new Date();
      logger.info('Database optimization completed');

    } catch (error) {
      logger.error('Database optimization failed', { error });
      throw error;
    }
  }

  /**
   * Analyzes table statistics
   */
  private async analyzeTableStatistics(): Promise<void> {
    try {
      const tables = ['users', 'assignments', 'submissions', 'feedback', 'courses'];
      
      for (const table of tables) {
        const result = await db.execute(`
          SELECT 
            schemaname,
            tablename,
            attname,
            n_distinct,
            correlation
          FROM pg_stats 
          WHERE tablename = '${table}'
          ORDER BY n_distinct DESC
        `);
        
        logger.debug(`Table statistics for ${table}`, {
          table,
          stats_count: result.rows.length
        });
      }
    } catch (error) {
      logger.warn('Failed to analyze table statistics', { error });
    }
  }

  /**
   * Checks for missing indexes
   */
  private async checkIndexes(): Promise<void> {
    try {
      // Check for missing indexes on foreign keys
      const result = await db.execute(`
        SELECT 
          t.relname as table_name,
          a.attname as column_name,
          pg_size_pretty(pg_total_relation_size(t.oid)) as table_size
        FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
        WHERE c.contype = 'f'
        AND NOT EXISTS (
          SELECT 1 FROM pg_index i 
          WHERE i.indrelid = c.conrelid 
          AND a.attnum = ANY(i.indkey)
        )
      `);

      if (result.rows.length > 0) {
        logger.warn('Missing indexes detected on foreign keys', {
          missing_indexes: result.rows.length
        });
      }
    } catch (error) {
      logger.warn('Failed to check indexes', { error });
    }
  }

  /**
   * Cleans up old data
   */
  private async cleanupOldData(): Promise<void> {
    try {
      // Clean up old feedback records older than 1 year
      if (isProduction()) {
        const result = await db.execute(`
          DELETE FROM feedback 
          WHERE created_at < NOW() - INTERVAL '1 year'
        `);
        
        logger.info('Old feedback cleaned up', {
          deleted_count: result.rowCount || 0
        });
      }
    } catch (error) {
      logger.warn('Failed to cleanup old data', { error });
    }
  }

  /**
   * Updates database statistics
   */
  private async updateStatistics(): Promise<void> {
    try {
      await db.execute('ANALYZE');
      logger.info('Database statistics updated');
    } catch (error) {
      logger.warn('Failed to update statistics', { error });
    }
  }

  /**
   * Gets slow queries from history
   */
  getSlowQueries(limit: number = 10): QueryPerformance[] {
    return this.queryHistory
      .filter(q => q.duration > this.slowQueryThreshold)
      .sort((a, b) => b.duration - a.duration)
      .slice(0, limit);
  }

  /**
   * Gets recent errors
   */
  getRecentErrors(limit: number = 10): QueryPerformance[] {
    return this.queryHistory
      .filter(q => !q.success)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }
}

// Global database optimizer instance
export const dbOptimizer = new DatabaseOptimizer();

/**
 * Wrapper function to monitor database queries
 */
export async function monitoredQuery<T>(
  queryFn: () => Promise<T>,
  queryDescription: string
): Promise<T> {
  const start = Date.now();
  
  try {
    const result = await queryFn();
    const duration = Date.now() - start;
    
    dbOptimizer.recordQuery(queryDescription, duration, true);
    
    return result;
  } catch (error) {
    const duration = Date.now() - start;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    dbOptimizer.recordQuery(queryDescription, duration, false, errorMessage);
    
    throw error;
  }
}

/**
 * Initializes database optimization
 */
export async function initializeDatabaseOptimization(): Promise<void> {
  try {
    // Run initial optimization
    await dbOptimizer.optimizeDatabase();
    
    // Schedule regular optimization (every 6 hours in production)
    if (isProduction()) {
      setInterval(async () => {
        try {
          await dbOptimizer.optimizeDatabase();
        } catch (error) {
          logger.error('Scheduled database optimization failed', { error });
        }
      }, 6 * 60 * 60 * 1000); // 6 hours
    }
    
    logger.info('Database optimization initialized');
  } catch (error) {
    logger.error('Failed to initialize database optimization', { error });
  }
}

/**
 * Gets database health information
 */
export async function getDatabaseHealth(): Promise<{
  status: 'healthy' | 'warning' | 'critical';
  metrics: DatabaseMetrics;
  recommendations: string[];
}> {
  const metrics = dbOptimizer.getMetrics();
  const slowQueries = dbOptimizer.getSlowQueries(5);
  const recentErrors = dbOptimizer.getRecentErrors(5);
  
  let status: 'healthy' | 'warning' | 'critical' = 'healthy';
  const recommendations: string[] = [];
  
  // Check for performance issues
  if (metrics.averageQueryTime > 500) {
    status = 'warning';
    recommendations.push('Average query time is high - consider optimizing queries');
  }
  
  if (metrics.errorRate > 5) {
    status = 'critical';
    recommendations.push('High error rate detected - investigate database issues');
  }
  
  if (slowQueries.length > 0) {
    status = status === 'critical' ? 'critical' : 'warning';
    recommendations.push(`${slowQueries.length} slow queries detected - review query performance`);
  }
  
  if (recentErrors.length > 0) {
    status = status === 'critical' ? 'critical' : 'warning';
    recommendations.push(`${recentErrors.length} recent errors detected - check error logs`);
  }
  
  return {
    status,
    metrics,
    recommendations
  };
}