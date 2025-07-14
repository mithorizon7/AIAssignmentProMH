/**
 * Graceful shutdown handler for production deployments
 * Ensures proper cleanup of resources and connections
 */

import { logger } from './logger';
import { db } from '../db';
import redisClient from '../queue/redis';
import { Server } from 'http';

interface ShutdownHandler {
  name: string;
  handler: () => Promise<void>;
  timeout?: number;
}

class GracefulShutdown {
  private server: Server | null = null;
  private isShuttingDown = false;
  private shutdownHandlers: ShutdownHandler[] = [];
  private readonly shutdownTimeout = 30000; // 30 seconds

  /**
   * Sets the HTTP server instance
   */
  setServer(server: Server): void {
    this.server = server;
  }

  /**
   * Registers a shutdown handler
   */
  registerHandler(name: string, handler: () => Promise<void>, timeout?: number): void {
    this.shutdownHandlers.push({ name, handler, timeout });
  }

  /**
   * Initializes graceful shutdown handlers
   */
  init(): void {
    // Handle different shutdown signals
    process.on('SIGTERM', this.handleSignal.bind(this, 'SIGTERM'));
    process.on('SIGINT', this.handleSignal.bind(this, 'SIGINT'));
    process.on('SIGUSR2', this.handleSignal.bind(this, 'SIGUSR2')); // Nodemon restart

    // Handle uncaught exceptions
    process.on('uncaughtException', this.handleUncaughtException.bind(this));
    process.on('unhandledRejection', this.handleUnhandledRejection.bind(this));

    // Register default shutdown handlers
    this.registerDefaultHandlers();

    logger.info('Graceful shutdown handlers initialized');
  }

  /**
   * Registers default shutdown handlers
   */
  private registerDefaultHandlers(): void {
    // Close HTTP server
    this.registerHandler('http-server', async () => {
      if (this.server) {
        return new Promise<void>((resolve) => {
          this.server!.close(() => {
            logger.info('HTTP server closed');
            resolve();
          });
        });
      }
    });

    // Close database connections
    this.registerHandler('database', async () => {
      try {
        // Drizzle doesn't have a explicit close method, but we can end the pool
        if (db && (db as any).end) {
          await (db as any).end();
        }
        logger.info('Database connections closed');
      } catch (error) {
        logger.error('Error closing database connections', { error });
      }
    });

    // Close Redis connection
    this.registerHandler('redis', async () => {
      try {
        await redisClient.quit();
        logger.info('Redis connection closed');
      } catch (error) {
        logger.error('Error closing Redis connection', { error });
      }
    });

    // Close queue workers
    this.registerHandler('queue-workers', async () => {
      try {
        // Import dynamically to avoid circular dependencies
        const { queueApi } = await import('../queue/bullmq-submission-queue');
        await queueApi.shutdown();
        logger.info('Queue workers closed');
      } catch (error) {
        logger.error('Error closing queue workers', { error });
      }
    });
  }

  /**
   * Handles shutdown signals
   */
  private async handleSignal(signal: string): Promise<void> {
    if (this.isShuttingDown) {
      logger.warn(`Received ${signal} during shutdown, forcing exit`);
      process.exit(1);
    }

    this.isShuttingDown = true;
    logger.info(`Received ${signal}, initiating graceful shutdown`);

    // Set a timeout to force exit if shutdown takes too long
    const forceExitTimeout = setTimeout(() => {
      logger.error('Graceful shutdown timeout exceeded, forcing exit');
      process.exit(1);
    }, this.shutdownTimeout);

    try {
      await this.performShutdown();
      clearTimeout(forceExitTimeout);
      logger.info('Graceful shutdown completed');
      process.exit(0);
    } catch (error) {
      clearTimeout(forceExitTimeout);
      logger.error('Error during graceful shutdown', { error });
      process.exit(1);
    }
  }

  /**
   * Performs the actual shutdown process
   */
  private async performShutdown(): Promise<void> {
    logger.info('Starting graceful shutdown process');

    // Execute shutdown handlers in reverse order (LIFO)
    for (let i = this.shutdownHandlers.length - 1; i >= 0; i--) {
      const handler = this.shutdownHandlers[i];
      const timeout = handler.timeout || 5000;

      try {
        logger.info(`Executing shutdown handler: ${handler.name}`);
        
        // Create a timeout promise
        const timeoutPromise = new Promise<void>((_, reject) => {
          setTimeout(() => reject(new Error(`Shutdown handler ${handler.name} timed out`)), timeout);
        });

        // Race the handler against the timeout
        await Promise.race([handler.handler(), timeoutPromise]);
        
        logger.info(`Shutdown handler ${handler.name} completed`);
      } catch (error) {
        logger.error(`Error in shutdown handler ${handler.name}`, { error });
        // Continue with other handlers even if one fails
      }
    }
  }

  /**
   * Handles uncaught exceptions
   */
  private handleUncaughtException(error: Error): void {
    logger.error('Uncaught exception', { error: error.message, stack: error.stack });
    
    // In production, try to shutdown gracefully
    if (process.env.NODE_ENV === 'production') {
      this.handleSignal('UNCAUGHT_EXCEPTION');
    } else {
      // In development, exit immediately
      process.exit(1);
    }
  }

  /**
   * Handles unhandled promise rejections
   */
  private handleUnhandledRejection(reason: any, promise: Promise<any>): void {
    logger.error('Unhandled promise rejection', { 
      reason: reason instanceof Error ? reason.message : reason,
      stack: reason instanceof Error ? reason.stack : undefined
    });

    // In production, try to shutdown gracefully
    if (process.env.NODE_ENV === 'production') {
      this.handleSignal('UNHANDLED_REJECTION');
    } else {
      // In development, just log and continue
      logger.warn('Continuing execution after unhandled rejection (development mode)');
    }
  }

  /**
   * Manually triggers shutdown (for testing or programmatic shutdown)
   */
  async shutdown(): Promise<void> {
    if (this.isShuttingDown) {
      return;
    }

    await this.handleSignal('MANUAL_SHUTDOWN');
  }
}

// Export singleton instance
export const gracefulShutdown = new GracefulShutdown();

// Export convenience function for initialization
export function initGracefulShutdown(server?: Server): void {
  if (server) {
    gracefulShutdown.setServer(server);
  }
  gracefulShutdown.init();
}

// Export function to register custom shutdown handlers
export function registerShutdownHandler(name: string, handler: () => Promise<void>, timeout?: number): void {
  gracefulShutdown.registerHandler(name, handler, timeout);
}