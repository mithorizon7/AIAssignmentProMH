/**
 * Production-specific configuration settings
 * This file contains optimizations and settings that should only be applied
 * in a production environment.
 */

import { Express } from 'express';
import compression from 'compression';
import { setupCacheControl } from '../middleware/cache-control';

/**
 * Apply production optimizations to the Express app
 * @param app Express application instance
 */
export function applyProductionOptimizations(app: Express): void {
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) return;

  console.log('🚀 Applying production optimizations...');

  // 1. Enable compression for all responses
  app.use(compression());

  // 2. Apply cache control headers
  app.use(setupCacheControl());

  // 3. Disable x-powered-by header for security
  app.disable('x-powered-by');

  // 4. Set security headers
  app.use((req, res, next) => {
    // Helps prevent clickjacking
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    
    // Strict MIME type checking
    res.setHeader('X-Content-Type-Options', 'nosniff');
    
    // Prevents browser from loading page if it detects XSS
    res.setHeader('X-XSS-Protection', '1; mode=block');
    
    // Prevents loading resources from other domains
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:;");
    
    next();
  });

  // Log that optimizations were applied
  console.log('✅ Production optimizations applied');
}

/**
 * How to use this file:
 * 
 * In server/index.ts:
 * 
 * ```typescript
 * import { applyProductionOptimizations } from './config/production';
 * 
 * // After creating the Express app
 * const app = express();
 * 
 * // Apply production optimizations
 * applyProductionOptimizations(app);
 * ```
 */