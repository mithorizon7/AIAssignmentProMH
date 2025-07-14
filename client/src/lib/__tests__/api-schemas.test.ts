/**
 * Tests for API response validation schemas
 * 
 * These tests ensure that our validation schemas work correctly
 * and handle edge cases gracefully.
 */

import { describe, test, expect } from 'vitest';
import {
  systemHealthSchema,
  productionReadinessSchema,
  securityHealthSchema,
  recoveryStatusSchema,
  validateApiResponse,
  validateApiResponseWithFallback,
  defaultSystemHealth,
  defaultProductionReadiness,
  defaultSecurityHealth,
  defaultRecoveryStatus
} from '../api-schemas';

describe('API Response Validation', () => {
  describe('System Health Schema', () => {
    test('validates correct system health response', () => {
      const validData = {
        status: 'healthy',
        timestamp: '2025-07-14T19:48:23.548Z',
        uptime: 123.45,
        checks: {
          database: { status: 'pass', response_time: 50 },
          redis: { status: 'pass', response_time: 30 },
          ai_services: { status: 'pass', response_time: 200 },
          storage: { status: 'warn', response_time: 10, message: 'Using local storage' },
          memory: { status: 'pass', response_time: 5 },
          queue: { status: 'pass', response_time: 15 }
        },
        metrics: {
          memory_usage: 150,
          queue_size: 0
        }
      };

      const result = validateApiResponse(systemHealthSchema, validData);
      expect(result).toBeTruthy();
      expect(result?.status).toBe('healthy');
      expect(result?.uptime).toBe(123.45);
    });

    test('handles malformed system health response', () => {
      const invalidData = {
        status: 'invalid_status',
        timestamp: 'invalid_timestamp',
        checks: {
          database: { status: 'invalid_status' }
        }
      };

      const result = validateApiResponse(systemHealthSchema, invalidData);
      expect(result).toBeNull();
    });

    test('uses fallback for invalid system health', () => {
      const invalidData = { invalid: 'data' };
      const result = validateApiResponseWithFallback(
        systemHealthSchema, 
        invalidData, 
        defaultSystemHealth
      );
      
      expect(result).toEqual(defaultSystemHealth);
      expect(result.status).toBe('unhealthy');
    });
  });

  describe('Production Readiness Schema', () => {
    test('validates correct production readiness response', () => {
      const validData = {
        isValid: true,
        errors: [],
        warnings: ['Minor warning'],
        checks: {
          environment: true,
          database: true,
          redis: true,
          security: true,
          apiKeys: true,
          storage: false
        }
      };

      const result = validateApiResponse(productionReadinessSchema, validData);
      expect(result).toBeTruthy();
      expect(result?.isValid).toBe(true);
      expect(result?.warnings).toHaveLength(1);
    });

    test('handles missing fields in production readiness', () => {
      const incompleteData = {
        isValid: true,
        errors: [],
        warnings: []
        // Missing checks object
      };

      const result = validateApiResponse(productionReadinessSchema, incompleteData);
      expect(result).toBeNull();
    });

    test('uses fallback for invalid production readiness', () => {
      const result = validateApiResponseWithFallback(
        productionReadinessSchema, 
        null, 
        defaultProductionReadiness
      );
      
      expect(result).toEqual(defaultProductionReadiness);
      expect(result.isValid).toBe(false);
    });
  });

  describe('Security Health Schema', () => {
    test('validates correct security health response', () => {
      const validData = {
        status: 'secure',
        metrics: {
          blockedRequests: 0,
          suspiciousActivity: 2,
          rateLimit: 1,
          csrfFailures: 0,
          threatsDetected: 0
        },
        recentThreats: [
          {
            type: 'suspicious_headers',
            severity: 'medium',
            description: 'Suspicious user agent detected',
            timestamp: '2025-07-14T19:48:23.548Z'
          }
        ]
      };

      const result = validateApiResponse(securityHealthSchema, validData);
      expect(result).toBeTruthy();
      expect(result?.status).toBe('secure');
      expect(result?.recentThreats).toHaveLength(1);
    });

    test('handles invalid security metrics', () => {
      const invalidData = {
        status: 'secure',
        metrics: {
          blockedRequests: 'invalid', // Should be number
          suspiciousActivity: 2,
          rateLimit: 1,
          csrfFailures: 0,
          threatsDetected: 0
        },
        recentThreats: []
      };

      const result = validateApiResponse(securityHealthSchema, invalidData);
      expect(result).toBeNull();
    });

    test('uses fallback for invalid security health', () => {
      const result = validateApiResponseWithFallback(
        securityHealthSchema, 
        { invalid: 'data' }, 
        defaultSecurityHealth
      );
      
      expect(result).toEqual(defaultSecurityHealth);
      expect(result.status).toBe('threat_detected');
    });
  });

  describe('Recovery Status Schema', () => {
    test('validates correct recovery status response', () => {
      const validData = {
        status: {
          actions: [
            {
              id: 'db-recovery',
              name: 'Database Recovery',
              enabled: true,
              retries: 3,
              lastAttempt: '2025-07-14T19:48:23.548Z',
              lastSuccess: '2025-07-14T19:45:00.000Z'
            }
          ],
          recentHistory: [
            {
              timestamp: '2025-07-14T19:48:23.548Z',
              action: 'Database Recovery',
              success: true
            }
          ]
        },
        metrics: {
          totalAttempts: 10,
          successfulRecoveries: 8,
          failedRecoveries: 2,
          recentActivity: 1
        }
      };

      const result = validateApiResponse(recoveryStatusSchema, validData);
      expect(result).toBeTruthy();
      expect(result?.status.actions).toHaveLength(1);
      expect(result?.metrics.successfulRecoveries).toBe(8);
    });

    test('handles empty recovery actions', () => {
      const validData = {
        status: {
          actions: [],
          recentHistory: []
        },
        metrics: {
          totalAttempts: 0,
          successfulRecoveries: 0,
          failedRecoveries: 0,
          recentActivity: 0
        }
      };

      const result = validateApiResponse(recoveryStatusSchema, validData);
      expect(result).toBeTruthy();
      expect(result?.status.actions).toHaveLength(0);
    });

    test('uses fallback for invalid recovery status', () => {
      const result = validateApiResponseWithFallback(
        recoveryStatusSchema, 
        undefined, 
        defaultRecoveryStatus
      );
      
      expect(result).toEqual(defaultRecoveryStatus);
      expect(result.status.actions).toHaveLength(0);
    });
  });

  describe('Validation Helper Functions', () => {
    test('validateApiResponse returns null for invalid data', () => {
      const result = validateApiResponse(systemHealthSchema, 'invalid string');
      expect(result).toBeNull();
    });

    test('validateApiResponse returns parsed data for valid input', () => {
      const validData = {
        status: 'healthy',
        timestamp: '2025-07-14T19:48:23.548Z',
        uptime: 123.45,
        checks: {
          database: { status: 'pass', response_time: 50 },
          redis: { status: 'pass', response_time: 30 },
          ai_services: { status: 'pass', response_time: 200 },
          storage: { status: 'pass', response_time: 10 },
          memory: { status: 'pass', response_time: 5 },
          queue: { status: 'pass', response_time: 15 }
        },
        metrics: {
          memory_usage: 150
        }
      };

      const result = validateApiResponse(systemHealthSchema, validData);
      expect(result).toEqual(validData);
    });

    test('validateApiResponseWithFallback always returns valid data', () => {
      const invalidInput = null;
      const result = validateApiResponseWithFallback(
        systemHealthSchema, 
        invalidInput, 
        defaultSystemHealth
      );
      
      expect(result).toBeTruthy();
      expect(result.status).toBe('unhealthy');
    });
  });

  describe('Default Values', () => {
    test('default system health is valid', () => {
      const result = validateApiResponse(systemHealthSchema, defaultSystemHealth);
      expect(result).toBeTruthy();
    });

    test('default production readiness is valid', () => {
      const result = validateApiResponse(productionReadinessSchema, defaultProductionReadiness);
      expect(result).toBeTruthy();
    });

    test('default security health is valid', () => {
      const result = validateApiResponse(securityHealthSchema, defaultSecurityHealth);
      expect(result).toBeTruthy();
    });

    test('default recovery status is valid', () => {
      const result = validateApiResponse(recoveryStatusSchema, defaultRecoveryStatus);
      expect(result).toBeTruthy();
    });
  });

  describe('Error Handling', () => {
    test('validation logs errors to console in development', () => {
      const originalError = console.error;
      const originalEnv = process.env.NODE_ENV;
      const errorLogs: any[] = [];
      
      // Set development environment
      process.env.NODE_ENV = 'development';
      console.error = (...args) => errorLogs.push(args);

      validateApiResponse(systemHealthSchema, { invalid: 'data' });
      
      expect(errorLogs.length).toBeGreaterThan(0);
      expect(errorLogs[0][0]).toContain('API response validation failed');
      
      // Restore original values
      console.error = originalError;
      process.env.NODE_ENV = originalEnv;
    });

    test('fallback validation logs errors to console in development', () => {
      const originalError = console.error;
      const originalEnv = process.env.NODE_ENV;
      const errorLogs: any[] = [];
      
      // Set development environment
      process.env.NODE_ENV = 'development';
      console.error = (...args) => errorLogs.push(args);

      validateApiResponseWithFallback(
        systemHealthSchema, 
        { invalid: 'data' }, 
        defaultSystemHealth
      );
      
      expect(errorLogs.length).toBeGreaterThan(0);
      expect(errorLogs[0][0]).toContain('API response validation failed');
      
      // Restore original values
      console.error = originalError;
      process.env.NODE_ENV = originalEnv;
    });

    test('validation does not log errors in production', () => {
      const originalError = console.error;
      const originalEnv = process.env.NODE_ENV;
      const errorLogs: any[] = [];
      
      // Set production environment
      process.env.NODE_ENV = 'production';
      console.error = (...args) => errorLogs.push(args);

      validateApiResponse(systemHealthSchema, { invalid: 'data' });
      
      expect(errorLogs.length).toBe(0);
      
      // Restore original values
      console.error = originalError;
      process.env.NODE_ENV = originalEnv;
    });
  });
});