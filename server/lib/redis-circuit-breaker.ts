/**
 * Redis Circuit Breaker
 * 
 * Implements a circuit breaker pattern for Redis connections to prevent
 * overloading and automatically recover from failures.
 */

import { logger } from './logger';

export class RedisCircuitBreaker {
  private isOpen = false;
  private failureCount = 0;
  private lastFailureTime = 0;
  private requestCount = 0;
  private readonly maxRequestsPerPeriod = 1000; // Conservative limit
  private readonly failureThreshold = 5;
  private readonly resetTimeout = 60000; // 1 minute
  private readonly monitoringPeriod = 60000; // 1 minute
  private requestCountResetTime = Date.now();

  constructor() {
    // Reset request count periodically
    setInterval(() => {
      this.requestCount = 0;
      this.requestCountResetTime = Date.now();
    }, this.monitoringPeriod);
  }

  /**
   * Check if Redis operation should be allowed
   */
  canExecute(): boolean {
    // Check if we're within request limits
    if (this.requestCount >= this.maxRequestsPerPeriod) {
      logger.warn('Redis circuit breaker: Request limit exceeded', {
        requestCount: this.requestCount,
        maxRequestsPerPeriod: this.maxRequestsPerPeriod,
        action: 'blocking_request'
      });
      return false;
    }

    // Check if circuit is open
    if (this.isOpen) {
      if (Date.now() - this.lastFailureTime > this.resetTimeout) {
        logger.info('Redis circuit breaker: Attempting to close circuit', {
          timeoutPassed: true,
          failureCount: this.failureCount
        });
        this.isOpen = false;
        this.failureCount = 0;
      } else {
        logger.warn('Redis circuit breaker: Circuit is open, blocking request', {
          timeSinceLastFailure: Date.now() - this.lastFailureTime,
          resetTimeout: this.resetTimeout
        });
        return false;
      }
    }

    this.requestCount++;
    return true;
  }

  /**
   * Record successful Redis operation
   */
  recordSuccess(): void {
    if (this.failureCount > 0) {
      this.failureCount = 0;
      logger.info('Redis circuit breaker: Failure count reset after successful operation');
    }
  }

  /**
   * Record failed Redis operation
   */
  recordFailure(error: Error): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    logger.error('Redis circuit breaker: Recording failure', {
      error: error.message,
      failureCount: this.failureCount,
      threshold: this.failureThreshold
    });

    if (this.failureCount >= this.failureThreshold) {
      this.isOpen = true;
      logger.error('Redis circuit breaker: Circuit opened due to excessive failures', {
        failureCount: this.failureCount,
        threshold: this.failureThreshold,
        resetTimeout: this.resetTimeout
      });
    }
  }

  /**
   * Get circuit breaker status
   */
  getStatus() {
    return {
      isOpen: this.isOpen,
      failureCount: this.failureCount,
      requestCount: this.requestCount,
      maxRequestsPerPeriod: this.maxRequestsPerPeriod,
      timeSinceLastFailure: this.lastFailureTime ? Date.now() - this.lastFailureTime : 0,
      resetTimeout: this.resetTimeout
    };
  }

  /**
   * Reset circuit breaker (for manual recovery)
   */
  reset(): void {
    this.isOpen = false;
    this.failureCount = 0;
    this.requestCount = 0;
    this.lastFailureTime = 0;
    logger.info('Redis circuit breaker: Manually reset');
  }
}

export const redisCircuitBreaker = new RedisCircuitBreaker();