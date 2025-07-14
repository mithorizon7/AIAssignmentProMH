/**
 * Error recovery and resilience system
 * Provides automatic recovery mechanisms for common failures
 */

import { logger } from './logger';
import { isProduction } from './env-config';
import { db } from '../db';
import redisClient from '../queue/redis';

export interface RecoveryAction {
  name: string;
  description: string;
  execute: () => Promise<void>;
  retries: number;
  lastAttempt?: Date;
  lastSuccess?: Date;
  enabled: boolean;
}

export interface RecoveryResult {
  success: boolean;
  action: string;
  attempts: number;
  duration: number;
  error?: string;
}

class ErrorRecoverySystem {
  private recoveryActions: Map<string, RecoveryAction> = new Map();
  private recoveryHistory: Array<{
    timestamp: Date;
    action: string;
    success: boolean;
    error?: string;
  }> = [];

  constructor() {
    this.initializeRecoveryActions();
  }

  /**
   * Initializes default recovery actions
   */
  private initializeRecoveryActions(): void {
    // Database connection recovery
    this.registerRecoveryAction('database-reconnect', {
      name: 'Database Reconnect',
      description: 'Attempt to reconnect to the database',
      execute: async () => {
        await db.execute('SELECT 1');
        logger.info('Database reconnection successful');
      },
      retries: 3,
      enabled: true
    });

    // Redis connection recovery
    this.registerRecoveryAction('redis-reconnect', {
      name: 'Redis Reconnect',
      description: 'Attempt to reconnect to Redis',
      execute: async () => {
        await redisClient.ping();
        logger.info('Redis reconnection successful');
      },
      retries: 3,
      enabled: true
    });

    // Queue system recovery
    this.registerRecoveryAction('queue-restart', {
      name: 'Queue Restart',
      description: 'Restart the queue system',
      execute: async () => {
        const { queueApi } = await import('../queue/bullmq-submission-queue');
        await queueApi.restart();
        logger.info('Queue system restart successful');
      },
      retries: 2,
      enabled: true
    });

    // Memory cleanup recovery
    this.registerRecoveryAction('memory-cleanup', {
      name: 'Memory Cleanup',
      description: 'Force garbage collection and cleanup',
      execute: async () => {
        if (global.gc) {
          global.gc();
          logger.info('Memory cleanup completed');
        } else {
          logger.warn('Garbage collection not available');
        }
      },
      retries: 1,
      enabled: isProduction()
    });
  }

  /**
   * Registers a recovery action
   */
  registerRecoveryAction(id: string, action: Omit<RecoveryAction, 'retries' | 'enabled'> & { retries?: number; enabled?: boolean }): void {
    this.recoveryActions.set(id, {
      retries: 3,
      enabled: true,
      ...action
    });
  }

  /**
   * Executes a recovery action
   */
  async executeRecovery(actionId: string): Promise<RecoveryResult> {
    const action = this.recoveryActions.get(actionId);
    if (!action) {
      throw new Error(`Recovery action not found: ${actionId}`);
    }

    if (!action.enabled) {
      throw new Error(`Recovery action disabled: ${actionId}`);
    }

    const start = Date.now();
    let attempts = 0;
    let lastError: string | undefined;

    while (attempts < action.retries) {
      attempts++;
      action.lastAttempt = new Date();

      try {
        logger.info(`Executing recovery action: ${action.name} (attempt ${attempts}/${action.retries})`);
        
        await action.execute();
        
        action.lastSuccess = new Date();
        const duration = Date.now() - start;
        
        this.recordRecovery(actionId, true);
        
        logger.info(`Recovery action successful: ${action.name}`, {
          attempts,
          duration
        });

        return {
          success: true,
          action: action.name,
          attempts,
          duration
        };

      } catch (error) {
        lastError = error instanceof Error ? error.message : 'Unknown error';
        
        logger.warn(`Recovery action failed: ${action.name} (attempt ${attempts}/${action.retries})`, {
          error: lastError
        });

        // Exponential backoff between retries
        if (attempts < action.retries) {
          const delay = Math.pow(2, attempts) * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    const duration = Date.now() - start;
    this.recordRecovery(actionId, false, lastError);

    return {
      success: false,
      action: action.name,
      attempts,
      duration,
      error: lastError
    };
  }

  /**
   * Records recovery attempt
   */
  private recordRecovery(actionId: string, success: boolean, error?: string): void {
    this.recoveryHistory.push({
      timestamp: new Date(),
      action: actionId,
      success,
      error
    });

    // Keep history manageable
    if (this.recoveryHistory.length > 100) {
      this.recoveryHistory.shift();
    }
  }

  /**
   * Attempts automatic recovery based on error type
   */
  async attemptAutoRecovery(error: Error): Promise<RecoveryResult[]> {
    const results: RecoveryResult[] = [];
    const errorMessage = error.message.toLowerCase();

    // Database-related errors
    if (errorMessage.includes('connection') && errorMessage.includes('database')) {
      try {
        const result = await this.executeRecovery('database-reconnect');
        results.push(result);
      } catch (recoveryError) {
        logger.error('Database recovery failed', { error: recoveryError });
      }
    }

    // Redis-related errors
    if (errorMessage.includes('redis') || errorMessage.includes('connection') && errorMessage.includes('timeout')) {
      try {
        const result = await this.executeRecovery('redis-reconnect');
        results.push(result);
      } catch (recoveryError) {
        logger.error('Redis recovery failed', { error: recoveryError });
      }
    }

    // Memory-related errors
    if (errorMessage.includes('memory') || errorMessage.includes('heap')) {
      try {
        const result = await this.executeRecovery('memory-cleanup');
        results.push(result);
      } catch (recoveryError) {
        logger.error('Memory cleanup failed', { error: recoveryError });
      }
    }

    // Queue-related errors
    if (errorMessage.includes('queue') || errorMessage.includes('job')) {
      try {
        const result = await this.executeRecovery('queue-restart');
        results.push(result);
      } catch (recoveryError) {
        logger.error('Queue recovery failed', { error: recoveryError });
      }
    }

    return results;
  }

  /**
   * Gets recovery system status
   */
  getRecoveryStatus(): {
    actions: Array<{
      id: string;
      name: string;
      enabled: boolean;
      retries: number;
      lastAttempt?: Date;
      lastSuccess?: Date;
    }>;
    recentHistory: Array<{
      timestamp: Date;
      action: string;
      success: boolean;
      error?: string;
    }>;
  } {
    const actions = Array.from(this.recoveryActions.entries()).map(([id, action]) => ({
      id,
      name: action.name,
      enabled: action.enabled,
      retries: action.retries,
      lastAttempt: action.lastAttempt,
      lastSuccess: action.lastSuccess
    }));

    const recentHistory = this.recoveryHistory
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, 20);

    return {
      actions,
      recentHistory
    };
  }

  /**
   * Enables or disables a recovery action
   */
  setRecoveryActionEnabled(actionId: string, enabled: boolean): void {
    const action = this.recoveryActions.get(actionId);
    if (action) {
      action.enabled = enabled;
      logger.info(`Recovery action ${enabled ? 'enabled' : 'disabled'}: ${actionId}`);
    }
  }
}

// Global error recovery system
export const errorRecoverySystem = new ErrorRecoverySystem();

/**
 * Middleware to handle errors with automatic recovery
 */
export async function errorRecoveryMiddleware(
  error: Error,
  req: any,
  res: any,
  next: any
): Promise<void> {
  // Log the original error
  logger.error('Error occurred, attempting recovery', {
    error: error.message,
    stack: error.stack,
    path: req.path,
    method: req.method
  });

  // Only attempt recovery in production
  if (isProduction()) {
    try {
      const recoveryResults = await errorRecoverySystem.attemptAutoRecovery(error);
      
      if (recoveryResults.length > 0) {
        const successfulRecoveries = recoveryResults.filter(r => r.success);
        
        if (successfulRecoveries.length > 0) {
          logger.info('Error recovery successful', {
            recoveries: successfulRecoveries.map(r => r.action)
          });
        }
      }
    } catch (recoveryError) {
      logger.error('Error recovery failed', { error: recoveryError });
    }
  }

  // Continue with normal error handling
  next(error);
}

/**
 * Initializes error recovery system
 */
export function initializeErrorRecovery(): void {
  logger.info('Error recovery system initialized');
  
  // Schedule periodic health checks in production
  if (isProduction()) {
    setInterval(async () => {
      try {
        // Check database health
        try {
          await db.execute('SELECT 1');
        } catch (error) {
          logger.warn('Database health check failed, attempting recovery');
          await errorRecoverySystem.executeRecovery('database-reconnect');
        }

        // Check Redis health
        try {
          await redisClient.ping();
        } catch (error) {
          logger.warn('Redis health check failed, attempting recovery');
          await errorRecoverySystem.executeRecovery('redis-reconnect');
        }

      } catch (error) {
        logger.error('Health check failed', { error });
      }
    }, 5 * 60 * 1000); // Every 5 minutes
  }
}

/**
 * Manual recovery trigger for admin use
 */
export async function triggerManualRecovery(actionId: string): Promise<RecoveryResult> {
  return await errorRecoverySystem.executeRecovery(actionId);
}

/**
 * Gets recovery system metrics
 */
export function getRecoveryMetrics(): {
  totalAttempts: number;
  successfulRecoveries: number;
  failedRecoveries: number;
  recentActivity: number;
} {
  const status = errorRecoverySystem.getRecoveryStatus();
  const recentActivity = status.recentHistory.filter(
    h => Date.now() - h.timestamp.getTime() < 60 * 60 * 1000 // Last hour
  ).length;

  return {
    totalAttempts: status.recentHistory.length,
    successfulRecoveries: status.recentHistory.filter(h => h.success).length,
    failedRecoveries: status.recentHistory.filter(h => !h.success).length,
    recentActivity
  };
}