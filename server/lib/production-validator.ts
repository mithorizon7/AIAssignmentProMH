/**
 * Production readiness validator
 * Validates critical configuration and dependencies required for production deployment
 */

import { logger } from './logger';
import { db } from '../db';
import redisClient from '../queue/redis';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  checks: {
    environment: boolean;
    database: boolean;
    redis: boolean;
    security: boolean;
    apiKeys: boolean;
    storage: boolean;
  };
}

/**
 * Validates environment variables required for production
 */
function validateEnvironment(): { valid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Critical environment variables
  const requiredVars = ['SESSION_SECRET', 'CSRF_SECRET', 'DATABASE_URL'];
  const recommendedVars = ['REDIS_URL', 'BASE_URL', 'GEMINI_API_KEY'];
  
  for (const varName of requiredVars) {
    if (!process.env[varName]) {
      errors.push(`Missing required environment variable: ${varName}`);
    } else if (varName.includes('SECRET') && process.env[varName].length < 32) {
      errors.push(`${varName} must be at least 32 characters long for security`);
    }
  }
  
  for (const varName of recommendedVars) {
    if (!process.env[varName]) {
      warnings.push(`Missing recommended environment variable: ${varName}`);
    }
  }
  
  // Validate NODE_ENV
  if (process.env.NODE_ENV !== 'production') {
    warnings.push('NODE_ENV is not set to "production"');
  }
  
  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Validates database connectivity and configuration
 */
async function validateDatabase(): Promise<{ valid: boolean; errors: string[]; warnings: string[] }> {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  try {
    // Test database connection
    await db.execute('SELECT 1');
    
    // Check for required tables
    const result = await db.execute(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('users', 'assignments', 'submissions', 'feedback')
    `);
    
    const tables = result.rows.map((row: any) => row.table_name);
    const requiredTables = ['users', 'assignments', 'submissions', 'feedback'];
    
    for (const table of requiredTables) {
      if (!tables.includes(table)) {
        errors.push(`Missing required database table: ${table}`);
      }
    }
    
  } catch (error) {
    errors.push(`Database connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
  
  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Validates Redis connectivity and configuration
 */
async function validateRedis(): Promise<{ valid: boolean; errors: string[]; warnings: string[] }> {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  try {
    // Test Redis connection
    await redisClient.ping();
    
    // Check Redis memory usage
    const info = await redisClient.info('memory');
    const memoryMatch = info.match(/used_memory_human:(\S+)/);
    if (memoryMatch) {
      logger.info('Redis memory usage', { memory: memoryMatch[1] });
    }
    
  } catch (error) {
    if (process.env.NODE_ENV === 'production') {
      errors.push(`Redis connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } else {
      warnings.push('Redis not available (acceptable in development mode)');
    }
  }
  
  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Validates security configuration
 */
function validateSecurity(): { valid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Check session configuration
  if (!process.env.SESSION_SECRET) {
    errors.push('SESSION_SECRET is required for secure session management');
  }
  
  if (!process.env.CSRF_SECRET) {
    errors.push('CSRF_SECRET is required for CSRF protection');
  }
  
  // Check for secure headers in production
  if (process.env.NODE_ENV === 'production') {
    if (!process.env.TRUST_PROXY) {
      warnings.push('TRUST_PROXY should be set to "true" when behind a proxy in production');
    }
  }
  
  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Validates API key configuration
 */
function validateApiKeys(): { valid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  const hasGemini = !!process.env.GEMINI_API_KEY;
  const hasOpenAI = !!process.env.OPENAI_API_KEY;
  
  if (!hasGemini && !hasOpenAI) {
    errors.push('At least one AI API key (GEMINI_API_KEY or OPENAI_API_KEY) is required');
  }
  
  if (!hasGemini) {
    warnings.push('GEMINI_API_KEY not set - using OpenAI as primary AI service');
  }
  
  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Validates storage configuration
 */
function validateStorage(): { valid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Check Google Cloud Storage configuration
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS && !process.env.GCS_BUCKET_NAME) {
    warnings.push('Google Cloud Storage not configured - file uploads will use local storage');
  }
  
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS && !process.env.GCS_BUCKET_NAME) {
    errors.push('GCS_BUCKET_NAME is required when GOOGLE_APPLICATION_CREDENTIALS is set');
  }
  
  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Runs all production readiness checks
 */
export async function validateProductionReadiness(): Promise<ValidationResult> {
  logger.info('Starting production readiness validation');
  
  const results = await Promise.all([
    Promise.resolve(validateEnvironment()),
    validateDatabase(),
    validateRedis(),
    Promise.resolve(validateSecurity()),
    Promise.resolve(validateApiKeys()),
    Promise.resolve(validateStorage())
  ]);
  
  const [envResult, dbResult, redisResult, securityResult, apiResult, storageResult] = results;
  
  const allErrors = [
    ...envResult.errors,
    ...dbResult.errors,
    ...redisResult.errors,
    ...securityResult.errors,
    ...apiResult.errors,
    ...storageResult.errors
  ];
  
  const allWarnings = [
    ...envResult.warnings,
    ...dbResult.warnings,
    ...redisResult.warnings,
    ...securityResult.warnings,
    ...apiResult.warnings,
    ...storageResult.warnings
  ];
  
  const isValid = allErrors.length === 0;
  
  const validationResult: ValidationResult = {
    isValid,
    errors: allErrors,
    warnings: allWarnings,
    checks: {
      environment: envResult.valid,
      database: dbResult.valid,
      redis: redisResult.valid,
      security: securityResult.valid,
      apiKeys: apiResult.valid,
      storage: storageResult.valid
    }
  };
  
  // Log results
  if (isValid) {
    logger.info('Production readiness validation passed', { 
      warnings: allWarnings.length,
      checks: validationResult.checks 
    });
  } else {
    logger.error('Production readiness validation failed', { 
      errors: allErrors.length,
      warnings: allWarnings.length,
      checks: validationResult.checks 
    });
  }
  
  return validationResult;
}

/**
 * Validates production readiness and exits if critical issues are found
 */
export async function validateAndExit(): Promise<void> {
  const result = await validateProductionReadiness();
  
  if (!result.isValid) {
    console.error('\n❌ Production readiness validation failed:');
    result.errors.forEach(error => console.error(`  - ${error}`));
    
    if (result.warnings.length > 0) {
      console.warn('\n⚠️  Warnings:');
      result.warnings.forEach(warning => console.warn(`  - ${warning}`));
    }
    
    console.error('\nPlease fix these issues before deploying to production.');
    process.exit(1);
  }
  
  if (result.warnings.length > 0) {
    console.warn('\n⚠️  Production readiness warnings:');
    result.warnings.forEach(warning => console.warn(`  - ${warning}`));
  }
  
  console.log('\n✅ Production readiness validation passed');
}