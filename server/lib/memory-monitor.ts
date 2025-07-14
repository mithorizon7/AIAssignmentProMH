/**
 * Memory monitoring and optimization utilities
 * Helps identify and resolve memory issues in production
 */

import { logger } from './logger';
import { isProduction } from './env-config';

export interface MemoryStats {
  rss: number;
  heapTotal: number;
  heapUsed: number;
  external: number;
  arrayBuffers: number;
  percentage: number;
  timestamp: Date;
}

export interface MemoryAlert {
  type: 'warning' | 'critical';
  message: string;
  stats: MemoryStats;
  timestamp: Date;
}

class MemoryMonitor {
  private memoryHistory: MemoryStats[] = [];
  private readonly maxHistorySize = 50;
  private alertCallbacks: Array<(alert: MemoryAlert) => void> = [];
  private monitoringInterval: NodeJS.Timeout | null = null;

  /**
   * Gets current memory statistics
   */
  getMemoryStats(): MemoryStats {
    const memory = process.memoryUsage();
    const percentage = (memory.heapUsed / memory.heapTotal) * 100;
    
    return {
      rss: Math.round(memory.rss / 1024 / 1024),
      heapTotal: Math.round(memory.heapTotal / 1024 / 1024),
      heapUsed: Math.round(memory.heapUsed / 1024 / 1024),
      external: Math.round(memory.external / 1024 / 1024),
      arrayBuffers: Math.round(memory.arrayBuffers / 1024 / 1024),
      percentage: Math.round(percentage),
      timestamp: new Date()
    };
  }

  /**
   * Records memory statistics
   */
  recordMemoryStats(): void {
    const stats = this.getMemoryStats();
    this.memoryHistory.push(stats);
    
    // Keep history manageable
    if (this.memoryHistory.length > this.maxHistorySize) {
      this.memoryHistory.shift();
    }
    
    // Check for memory alerts
    this.checkMemoryAlerts(stats);
  }

  /**
   * Checks for memory alerts and triggers callbacks
   */
  private checkMemoryAlerts(stats: MemoryStats): void {
    if (stats.percentage > 95) {
      this.triggerAlert({
        type: 'critical',
        message: `Critical memory usage: ${stats.percentage}% (${stats.heapUsed}MB/${stats.heapTotal}MB)`,
        stats,
        timestamp: new Date()
      });
    } else if (stats.percentage > 85) {
      this.triggerAlert({
        type: 'warning',
        message: `High memory usage: ${stats.percentage}% (${stats.heapUsed}MB/${stats.heapTotal}MB)`,
        stats,
        timestamp: new Date()
      });
    }
  }

  /**
   * Triggers memory alert
   */
  private triggerAlert(alert: MemoryAlert): void {
    logger.warn('Memory alert', alert);
    
    this.alertCallbacks.forEach(callback => {
      try {
        callback(alert);
      } catch (error) {
        logger.error('Memory alert callback failed', { error });
      }
    });
  }

  /**
   * Registers alert callback
   */
  onAlert(callback: (alert: MemoryAlert) => void): void {
    this.alertCallbacks.push(callback);
  }

  /**
   * Gets memory trend analysis
   */
  getMemoryTrend(): {
    current: MemoryStats;
    trend: 'increasing' | 'decreasing' | 'stable';
    averagePercentage: number;
    peakPercentage: number;
    suggestions: string[];
  } {
    const current = this.getMemoryStats();
    const history = this.memoryHistory;
    
    if (history.length < 3) {
      return {
        current,
        trend: 'stable',
        averagePercentage: current.percentage,
        peakPercentage: current.percentage,
        suggestions: []
      };
    }
    
    const recent = history.slice(-5);
    const avgRecent = recent.reduce((sum, stat) => sum + stat.percentage, 0) / recent.length;
    const older = history.slice(-10, -5);
    const avgOlder = older.reduce((sum, stat) => sum + stat.percentage, 0) / older.length;
    
    let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
    if (avgRecent > avgOlder + 5) {
      trend = 'increasing';
    } else if (avgRecent < avgOlder - 5) {
      trend = 'decreasing';
    }
    
    const averagePercentage = Math.round(history.reduce((sum, stat) => sum + stat.percentage, 0) / history.length);
    const peakPercentage = Math.max(...history.map(stat => stat.percentage));
    
    const suggestions = this.generateSuggestions(current, trend, averagePercentage, peakPercentage);
    
    return {
      current,
      trend,
      averagePercentage,
      peakPercentage,
      suggestions
    };
  }

  /**
   * Generates memory optimization suggestions
   */
  private generateSuggestions(
    current: MemoryStats,
    trend: 'increasing' | 'decreasing' | 'stable',
    averagePercentage: number,
    peakPercentage: number
  ): string[] {
    const suggestions: string[] = [];
    
    if (current.percentage > 90) {
      suggestions.push('Critical: Consider restarting the application');
      suggestions.push('Review and optimize memory-intensive operations');
    }
    
    if (trend === 'increasing') {
      suggestions.push('Memory usage is increasing - investigate potential memory leaks');
      suggestions.push('Consider reducing cache sizes or clearing old data');
    }
    
    if (current.external > 50) {
      suggestions.push('High external memory usage - review buffer and file operations');
    }
    
    if (peakPercentage > 85) {
      suggestions.push('Consider implementing memory-based alerting');
      suggestions.push('Review setInterval/setTimeout usage for potential leaks');
    }
    
    if (current.arrayBuffers > 10) {
      suggestions.push('High array buffer usage - review file processing operations');
    }
    
    return suggestions;
  }

  /**
   * Forces garbage collection (if available)
   */
  forceGarbageCollection(): boolean {
    if (global.gc) {
      try {
        global.gc();
        logger.info('Garbage collection forced');
        return true;
      } catch (error) {
        logger.error('Failed to force garbage collection', { error });
        return false;
      }
    }
    return false;
  }

  /**
   * Starts memory monitoring
   */
  startMonitoring(intervalMs: number = 30000): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
    
    this.monitoringInterval = setInterval(() => {
      this.recordMemoryStats();
    }, intervalMs);
    
    logger.info('Memory monitoring started', { intervalMs });
  }

  /**
   * Stops memory monitoring
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    
    logger.info('Memory monitoring stopped');
  }

  /**
   * Gets memory history
   */
  getMemoryHistory(): MemoryStats[] {
    return [...this.memoryHistory];
  }

  /**
   * Clears memory history
   */
  clearHistory(): void {
    this.memoryHistory = [];
  }
}

// Global memory monitor instance
export const memoryMonitor = new MemoryMonitor();

/**
 * Initializes memory monitoring
 */
export function initializeMemoryMonitor(): void {
  // Set up memory alerts
  memoryMonitor.onAlert((alert) => {
    if (alert.type === 'critical') {
      logger.error('Critical memory alert', alert);
      // In production, you might want to trigger alerts to monitoring systems
    }
  });
  
  // Start monitoring in production
  if (isProduction()) {
    memoryMonitor.startMonitoring(30000); // Every 30 seconds
  }
  
  // Log initial memory stats
  const stats = memoryMonitor.getMemoryStats();
  logger.info('Memory monitor initialized', stats);
}

/**
 * Memory cleanup utility
 */
export function cleanupMemory(): void {
  // Force garbage collection if available
  memoryMonitor.forceGarbageCollection();
  
  // Clear memory histories
  memoryMonitor.clearHistory();
  
  logger.info('Memory cleanup completed');
}