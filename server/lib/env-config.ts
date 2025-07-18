/**
 * Enhanced environment configuration with validation and defaults
 * Provides type-safe environment variable handling with production validation
 */

import { z } from 'zod';
import { logger } from './logger';

// Environment schema with validation
const envSchema = z.object({
  // Application
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(5000),
  
  // Security (required in production)
  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be at least 32 characters'),
  CSRF_SECRET: z.string().min(32, 'CSRF_SECRET must be at least 32 characters'),
  
  // Database
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid URL'),
  
  // Redis (optional in development, required in production)
  REDIS_URL: z.string().url().optional(),
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().default(6379),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_USERNAME: z.string().optional(),
  REDIS_DB: z.coerce.number().default(0),
  ENABLE_REDIS: z.coerce.boolean().default(false),
  
  // AI Services
  GEMINI_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  
  // Authentication
  BASE_URL: z.string().url().optional(),
  AUTH0_DOMAIN: z.string().optional(),
  AUTH0_CLIENT_ID: z.string().optional(),
  AUTH0_CLIENT_SECRET: z.string().optional(),
  AUTH0_CALLBACK_URL: z.string().url().optional(),
  
  MIT_HORIZON_OIDC_ISSUER_URL: z.string().url().optional(),
  MIT_HORIZON_OIDC_CLIENT_ID: z.string().optional(),
  MIT_HORIZON_OIDC_CLIENT_SECRET: z.string().optional(),
  MIT_HORIZON_OIDC_CALLBACK_URL: z.string().url().optional(),
  
  // Storage
  GOOGLE_APPLICATION_CREDENTIALS: z.string().optional(),
  GCS_BUCKET_NAME: z.string().optional(),
  GCP_PROJECT_ID: z.string().optional(),
  
  // Other
  MAX_UPLOAD_SIZE: z.coerce.number().default(10485760), // 10MB
  TRUST_PROXY: z.coerce.boolean().default(false),
  
  // Logging
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug', 'trace']).default('info'),
  STRUCTURED_LOGGING: z.enum(['true', 'false']).default('false')
});

// Refined schema for production validation
const productionSchema = envSchema.extend({
  NODE_ENV: z.literal('production'),
  SESSION_SECRET: z.string().min(32),
  CSRF_SECRET: z.string().min(32),
  DATABASE_URL: z.string().url(),
  // At least one AI service required
  GEMINI_API_KEY: z.string().min(1).optional(),
  OPENAI_API_KEY: z.string().min(1).optional(),
  BASE_URL: z.string().url(),
  STRUCTURED_LOGGING: z.literal('true')
}).refine(
  (data) => data.GEMINI_API_KEY || data.OPENAI_API_KEY,
  {
    message: "At least one AI API key (GEMINI_API_KEY or OPENAI_API_KEY) is required in production",
    path: ["GEMINI_API_KEY", "OPENAI_API_KEY"]
  }
);

// Type for validated environment
export type EnvConfig = z.infer<typeof envSchema>;

// Global configuration object
let config: EnvConfig | null = null;

/**
 * Validates and loads environment configuration
 */
export function loadConfig(): EnvConfig {
  if (config) {
    return config;
  }
  
  try {
    // First validate with base schema
    const baseResult = envSchema.safeParse(process.env);
    
    if (!baseResult.success) {
      logger.error('Environment validation failed', {
        errors: baseResult.error.errors
      });
      
      // In production, exit on validation failure
      if (process.env.NODE_ENV === 'production') {
        console.error('❌ Environment validation failed in production:');
        baseResult.error.errors.forEach(err => {
          console.error(`  - ${err.path.join('.')}: ${err.message}`);
        });
        process.exit(1);
      }
      
      // In development, show warnings and use defaults where possible
      console.warn('⚠️  Environment validation warnings:');
      baseResult.error.errors.forEach(err => {
        console.warn(`  - ${err.path.join('.')}: ${err.message}`);
      });
    }
    
    config = baseResult.success ? baseResult.data : envSchema.parse({});
    
    // Additional production validation
    if (config.NODE_ENV === 'production') {
      const prodResult = productionSchema.safeParse(process.env);
      
      if (!prodResult.success) {
        console.error('❌ Production environment validation failed:');
        prodResult.error.errors.forEach(err => {
          console.error(`  - ${err.path.join('.')}: ${err.message}`);
        });
        process.exit(1);
      }
    }
    
    logger.info('Environment configuration loaded', {
      env: config.NODE_ENV,
      redis_enabled: config.ENABLE_REDIS || config.NODE_ENV === 'production',
      ai_services: {
        gemini: !!config.GEMINI_API_KEY,
        openai: !!config.OPENAI_API_KEY
      },
      auth: {
        auth0: !!(config.AUTH0_DOMAIN && config.AUTH0_CLIENT_ID),
        mit_horizon: !!(config.MIT_HORIZON_OIDC_ISSUER_URL && config.MIT_HORIZON_OIDC_CLIENT_ID)
      },
      storage: {
        gcs: !!(config.GOOGLE_APPLICATION_CREDENTIALS && config.GCS_BUCKET_NAME)
      }
    });
    
    return config;
    
  } catch (error) {
    logger.error('Failed to load environment configuration', { error });
    
    if (process.env.NODE_ENV === 'production') {
      console.error('❌ Critical error loading environment configuration in production');
      process.exit(1);
    }
    
    throw error;
  }
}

/**
 * Gets the current configuration (loads if not already loaded)
 */
export function getConfig(): EnvConfig {
  return config || loadConfig();
}

/**
 * Checks if running in production mode
 */
export function isProduction(): boolean {
  return getConfig().NODE_ENV === 'production';
}

/**
 * Checks if running in development mode
 */
export function isDevelopment(): boolean {
  return getConfig().NODE_ENV === 'development';
}

/**
 * Checks if Redis is enabled
 */
export function isRedisEnabled(): boolean {
  const cfg = getConfig();
  return cfg.ENABLE_REDIS || cfg.NODE_ENV === 'production';
}

/**
 * Gets database connection configuration
 */
export function getDatabaseConfig() {
  const cfg = getConfig();
  return {
    url: cfg.DATABASE_URL
  };
}

/**
 * Gets Redis connection configuration
 */
export function getRedisConfig() {
  const cfg = getConfig();
  
  if (cfg.REDIS_URL) {
    return { url: cfg.REDIS_URL };
  }
  
  return {
    host: cfg.REDIS_HOST,
    port: cfg.REDIS_PORT,
    password: cfg.REDIS_PASSWORD,
    username: cfg.REDIS_USERNAME,
    db: cfg.REDIS_DB
  };
}

/**
 * Gets AI service configuration
 */
export function getAIConfig() {
  const cfg = getConfig();
  return {
    gemini: {
      apiKey: cfg.GEMINI_API_KEY,
      enabled: !!cfg.GEMINI_API_KEY
    },
    openai: {
      apiKey: cfg.OPENAI_API_KEY,
      enabled: !!cfg.OPENAI_API_KEY
    }
  };
}

/**
 * Gets authentication configuration
 */
export function getAuthConfig() {
  const cfg = getConfig();
  return {
    sessionSecret: cfg.SESSION_SECRET,
    csrfSecret: cfg.CSRF_SECRET,
    baseUrl: cfg.BASE_URL,
    auth0: {
      domain: cfg.AUTH0_DOMAIN,
      clientId: cfg.AUTH0_CLIENT_ID,
      clientSecret: cfg.AUTH0_CLIENT_SECRET,
      callbackUrl: cfg.AUTH0_CALLBACK_URL,
      enabled: !!(cfg.AUTH0_DOMAIN && cfg.AUTH0_CLIENT_ID && cfg.AUTH0_CLIENT_SECRET)
    },
    mitHorizon: {
      issuerUrl: cfg.MIT_HORIZON_OIDC_ISSUER_URL,
      clientId: cfg.MIT_HORIZON_OIDC_CLIENT_ID,
      clientSecret: cfg.MIT_HORIZON_OIDC_CLIENT_SECRET,
      callbackUrl: cfg.MIT_HORIZON_OIDC_CALLBACK_URL,
      enabled: !!(cfg.MIT_HORIZON_OIDC_ISSUER_URL && cfg.MIT_HORIZON_OIDC_CLIENT_ID && cfg.MIT_HORIZON_OIDC_CLIENT_SECRET)
    }
  };
}

/**
 * Gets storage configuration
 */
export function getStorageConfig() {
  const cfg = getConfig();
  return {
    gcs: {
      credentialsPath: cfg.GOOGLE_APPLICATION_CREDENTIALS,
      bucketName: cfg.GCS_BUCKET_NAME,
      projectId: cfg.GCP_PROJECT_ID,
      enabled: !!(cfg.GOOGLE_APPLICATION_CREDENTIALS && cfg.GCS_BUCKET_NAME)
    },
    maxUploadSize: cfg.MAX_UPLOAD_SIZE
  };
}

// Initialize configuration on module load
loadConfig();