/**
 * API Response Validation Schemas
 * 
 * This module provides Zod schemas for validating API responses
 * to ensure type safety and prevent runtime errors from malformed data.
 */

import { z } from 'zod';

// Health Check Schema
export const healthCheckSchema = z.object({
  status: z.enum(['pass', 'fail', 'warn']),
  response_time: z.number(),
  message: z.string().optional(),
  details: z.record(z.any()).optional()
});

// System Health Schema
export const systemHealthSchema = z.object({
  status: z.enum(['healthy', 'degraded', 'unhealthy']),
  timestamp: z.string(),
  uptime: z.number(),
  version: z.string().optional(),
  checks: z.object({
    database: healthCheckSchema,
    redis: healthCheckSchema,
    ai_services: healthCheckSchema,
    storage: healthCheckSchema,
    memory: healthCheckSchema,
    queue: healthCheckSchema
  }),
  metrics: z.object({
    memory_usage: z.number(),
    cpu_usage: z.number().optional(),
    active_connections: z.number().optional(),
    queue_size: z.number().optional()
  })
});

// Production Readiness Schema
export const productionReadinessSchema = z.object({
  isValid: z.boolean(),
  errors: z.array(z.string()),
  warnings: z.array(z.string()),
  checks: z.object({
    environment: z.boolean(),
    database: z.boolean(),
    redis: z.boolean(),
    security: z.boolean(),
    apiKeys: z.boolean(),
    storage: z.boolean()
  }),
  summary: z.object({
    total: z.number(),
    passed: z.number(),
    failed: z.number(),
    warnings: z.number()
  }).optional()
});

// Security Health Schema
export const securityHealthSchema = z.object({
  status: z.enum(['secure', 'monitoring', 'threat_detected']),
  metrics: z.object({
    blockedRequests: z.number(),
    suspiciousActivity: z.number(),
    rateLimit: z.number(),
    csrfFailures: z.number(),
    threatsDetected: z.number(),
    lastSecurityEvent: z.string().nullable().optional()
  }),
  recentThreats: z.array(z.object({
    type: z.string(),
    severity: z.string(),
    description: z.string(),
    timestamp: z.string(),
    ip: z.string().optional(),
    blocked: z.boolean().optional()
  }))
});

// Recovery Status Schema
export const recoveryStatusSchema = z.object({
  status: z.object({
    actions: z.array(z.object({
      id: z.string(),
      name: z.string(),
      enabled: z.boolean(),
      retries: z.number(),
      lastAttempt: z.string().optional(),
      lastSuccess: z.string().optional(),
      status: z.enum(['idle', 'running', 'completed', 'failed']).optional()
    })),
    recentHistory: z.array(z.object({
      timestamp: z.string(),
      action: z.string(),
      success: z.boolean(),
      error: z.string().optional(),
      duration: z.number().optional()
    }))
  }),
  metrics: z.object({
    totalAttempts: z.number(),
    successfulRecoveries: z.number(),
    failedRecoveries: z.number(),
    recentActivity: z.number(),
    averageRecoveryTime: z.number().optional()
  })
});

// Memory Status Schema
export const memoryStatusSchema = z.object({
  current: z.object({
    rss: z.number(),
    heapTotal: z.number(),
    heapUsed: z.number(),
    external: z.number(),
    arrayBuffers: z.number(),
    percentage: z.number(),
    timestamp: z.string().transform(str => new Date(str))
  }),
  trend: z.enum(['increasing', 'decreasing', 'stable']),
  averagePercentage: z.number(),
  peakPercentage: z.number(),
  suggestions: z.array(z.string()),
  history: z.array(z.object({
    rss: z.number(),
    heapTotal: z.number(),
    heapUsed: z.number(),
    external: z.number(),
    arrayBuffers: z.number(),
    percentage: z.number(),
    timestamp: z.string().transform(str => new Date(str))
  }))
});

// Type exports for use in components
export type HealthCheck = z.infer<typeof healthCheckSchema>;
export type SystemHealth = z.infer<typeof systemHealthSchema>;
export type ProductionReadiness = z.infer<typeof productionReadinessSchema>;
export type SecurityHealth = z.infer<typeof securityHealthSchema>;
export type RecoveryStatus = z.infer<typeof recoveryStatusSchema>;
export type MemoryStatus = z.infer<typeof memoryStatusSchema>;

// Validation helper functions
export const validateApiResponse = <T>(schema: z.ZodSchema<T>, data: unknown): T | null => {
  try {
    return schema.parse(data);
  } catch (error) {
    console.error('API response validation failed:', error);
    return null;
  }
};

export const validateApiResponseWithFallback = <T>(
  schema: z.ZodSchema<T>, 
  data: unknown, 
  fallback: T
): T => {
  try {
    return schema.parse(data);
  } catch (error) {
    console.error('API response validation failed, using fallback:', error);
    return fallback;
  }
};

// Default fallback values
export const defaultSystemHealth: SystemHealth = {
  status: 'unhealthy',
  timestamp: new Date().toISOString(),
  uptime: 0,
  checks: {
    database: { status: 'fail', response_time: 0, message: 'Unknown' },
    redis: { status: 'fail', response_time: 0, message: 'Unknown' },
    ai_services: { status: 'fail', response_time: 0, message: 'Unknown' },
    storage: { status: 'fail', response_time: 0, message: 'Unknown' },
    memory: { status: 'fail', response_time: 0, message: 'Unknown' },
    queue: { status: 'fail', response_time: 0, message: 'Unknown' }
  },
  metrics: {
    memory_usage: 0,
    queue_size: 0
  }
};

export const defaultProductionReadiness: ProductionReadiness = {
  isValid: false,
  errors: ['Unable to validate production readiness'],
  warnings: [],
  checks: {
    environment: false,
    database: false,
    redis: false,
    security: false,
    apiKeys: false,
    storage: false
  }
};

export const defaultSecurityHealth: SecurityHealth = {
  status: 'threat_detected',
  metrics: {
    blockedRequests: 0,
    suspiciousActivity: 0,
    rateLimit: 0,
    csrfFailures: 0,
    threatsDetected: 0
  },
  recentThreats: []
};

export const defaultRecoveryStatus: RecoveryStatus = {
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