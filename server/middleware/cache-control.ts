import { Request, Response, NextFunction } from 'express';
import path from 'path';

/**
 * Middleware to set appropriate cache control headers based on resource type
 * This middleware should be applied after static middleware
 */
export function setupCacheControl() {
  const isProd = process.env.NODE_ENV === 'production';
  
  // Skip cache control headers in development
  if (!isProd) {
    return (_req: Request, _res: Response, next: NextFunction) => next();
  }

  return (req: Request, res: Response, next: NextFunction) => {
    const url = req.url;
    
    // Skip if headers already sent
    if (res.headersSent) {
      return next();
    }
    
    // API endpoints - no caching
    if (url.startsWith('/api/')) {
      res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    } 
    // Content-hashed static assets - aggressive caching
    else if (
      /\.(js|css|woff2?|ttf|eot|otf|svg|png|jpg|jpeg|gif|webp|avif|ico)(\?[a-z0-9]+)?$/i.test(url) &&
      // Content hash pattern like main.a1b2c3d4.js
      /\.[a-z0-9]{8,}\./i.test(url)
    ) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }
    // HTML and other non-hashed assets - no caching
    else if (url === '/' || url.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache');
    }
    
    next();
  };
}

/**
 * Apply this middleware to your Express app in server/index.ts:
 * 
 * import { setupCacheControl } from './middleware/cache-control';
 * 
 * // After setting up static serving
 * app.use(express.static(path.join(__dirname, 'public')));
 * 
 * // Apply cache control middleware
 * app.use(setupCacheControl());
 */