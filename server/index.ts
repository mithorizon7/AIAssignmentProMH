// Load environment variables from .env file
import 'dotenv/config';

import express, { type Request, Response, NextFunction } from "express";
import helmet from "helmet";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { errorHandler, notFoundHandler, logger } from "./lib/error-handler";
import { runMigrations } from "./migrations/run-migrations";
import { validateAndExit } from "./lib/production-validator";
import { loadConfig, isProduction, isDevelopment } from "./lib/env-config";
import { initGracefulShutdown } from "./lib/graceful-shutdown";
import { initializeDatabaseOptimization } from "./lib/database-optimizer";
import { initializeQueueMonitoring } from "./lib/queue-manager";
import { securityMonitoringMiddleware, initializeSecurityMonitoring } from "./lib/security-enhancer";
import { errorRecoveryMiddleware, initializeErrorRecovery } from "./lib/error-recovery";
import { initializeCacheManager } from "./lib/cache-manager";
import { initializeMemoryMonitor } from "./lib/memory-monitor";
import { assignmentScheduler } from "./services/assignment-scheduler";

// Load and validate configuration
const config = loadConfig();

const app = express();
// Increase JSON payload limit to 10MB for handling large content like AI prompts
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false, limit: '10mb' }));

// Configure helmet security headers based on environment
const isProductionEnv = isProduction();

// Configure different CSP directives for production and development
// Define type to accommodate the helmet CSP directive requirements
type CSPDirectives = Record<string, string[]>;

const productionDirectives: CSPDirectives = {
  // Stricter CSP for production environment
  defaultSrc: ["'self'"],
  scriptSrc: ["'self'"],  // Remove unsafe-inline and unsafe-eval in production
  styleSrc: ["'self'", "'unsafe-inline'"],  // Inline styles often needed for UI frameworks
  imgSrc: ["'self'", "data:"],
  connectSrc: ["'self'"],
  fontSrc: ["'self'"],
  objectSrc: ["'none'"],
  mediaSrc: ["'self'"],
  frameSrc: ["'none'"],
};

// Add upgrade-insecure-requests directive in production
if (isProductionEnv) {
  (productionDirectives as any)["upgrade-insecure-requests"] = [];
}

const developmentDirectives: CSPDirectives = {
  // More relaxed CSP for development environment
  defaultSrc: ["'self'"],
  scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],  // Allow for development tools
  styleSrc: ["'self'", "'unsafe-inline'"],
  imgSrc: ["'self'", "data:"],
  connectSrc: ["'self'", "ws:"],  // Allow WebSocket for HMR
  fontSrc: ["'self'"],
  objectSrc: ["'none'"],
  mediaSrc: ["'self'"],
  frameSrc: ["'none'"],
};

const cspDirectives = isProductionEnv ? productionDirectives : developmentDirectives;

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: cspDirectives,
    },
    strictTransportSecurity: isProductionEnv
      ? {
          maxAge: 63072000, // 2 years in seconds
          includeSubDomains: true,
          preload: true,
        }
      : false, // Disable HSTS in development
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    // Set X-XSS-Protection header
    xssFilter: true,
    // Set X-Frame-Options header to prevent clickjacking
    frameguard: { action: "deny" },
    // Prevent MIME type sniffing
    noSniff: true,
  })
);

// Add security monitoring middleware
app.use(securityMonitoringMiddleware);

app.use((req, res, next) => {
  const start = Date.now();
  const startMemory = process.memoryUsage().heapUsed;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    const endMemory = process.memoryUsage().heapUsed;
    
    if (req.path.startsWith("/api")) {
      // Create structured log data object
      const logData = {
        method: req.method,
        path: req.path,
        status: res.statusCode,
        durationMs: duration,
        memoryDelta: endMemory - startMemory,
        timestamp: new Date().toISOString(),
        userAgent: req.headers['user-agent'],
        ip: req.ip || req.connection.remoteAddress,
        contentLength: res.get('content-length'),
        response: capturedJsonResponse ? {
          type: typeof capturedJsonResponse,
          isArray: Array.isArray(capturedJsonResponse),
          hasData: capturedJsonResponse && Object.keys(capturedJsonResponse).length > 0,
          preview: JSON.stringify(capturedJsonResponse).substring(0, 200) + (JSON.stringify(capturedJsonResponse).length > 200 ? '...' : '')
        } : undefined
      };

      // Log performance warnings for slow requests
      if (duration > 1000) {
        logger.warn('Slow request detected', logData);
      } else if (duration > 500) {
        logger.info('Request completed', logData);
      } else {
        // For fast requests, log more concisely in development
        if (process.env.NODE_ENV === 'development') {
          log(`${req.method} ${req.path} ${res.statusCode} in ${duration}ms${capturedJsonResponse ? ` :: ${JSON.stringify(capturedJsonResponse).substring(0, 100)}${JSON.stringify(capturedJsonResponse).length > 100 ? '...' : ''}` : ''}`);
        } else {
          logger.debug('Request completed', logData);
        }
      }
    }
  });

  next();
});

(async () => {
  // Validate production readiness in production environment
  if (isProductionEnv) {
    try {
      await validateAndExit();
      console.log('✅ Production readiness validation passed');
    } catch (error) {
      console.error('[Startup] Production validation failed:', error);
      process.exit(1);
    }
  }

  // Run database migrations to ensure all required columns exist
  try {
    await runMigrations();
    console.log('[Startup] Database migrations completed successfully');
  } catch (error) {
    console.error('[Startup] Error running database migrations:', error);
    if (isProductionEnv) {
      console.error('[Startup] Migration failure is critical in production');
      process.exit(1);
    }
    console.log('[Startup] Continuing application startup despite migration error');
  }

  // Initialize database optimization
  try {
    await initializeDatabaseOptimization();
    console.log('[Startup] Database optimization initialized');
  } catch (error) {
    console.error('[Startup] Database optimization failed:', error);
    if (isProductionEnv) {
      console.error('[Startup] Database optimization failure is critical in production');
      process.exit(1);
    }
  }

  // Initialize queue monitoring
  try {
    await initializeQueueMonitoring();
    console.log('[Startup] Queue monitoring initialized');
  } catch (error) {
    console.error('[Startup] Queue monitoring failed:', error);
    if (isProductionEnv) {
      console.error('[Startup] Queue monitoring failure is critical in production');
      process.exit(1);
    }
  }

  // Initialize security monitoring
  try {
    initializeSecurityMonitoring();
    console.log('[Startup] Security monitoring initialized');
  } catch (error) {
    console.error('[Startup] Security monitoring failed:', error);
    if (isProductionEnv) {
      console.error('[Startup] Security monitoring failure is critical in production');
      process.exit(1);
    }
  }

  // Initialize error recovery system
  try {
    initializeErrorRecovery();
    console.log('[Startup] Error recovery system initialized');
  } catch (error) {
    console.error('[Startup] Error recovery system failed:', error);
    if (isProductionEnv) {
      console.error('[Startup] Error recovery failure is critical in production');
      process.exit(1);
    }
  }

  // Initialize cache manager
  try {
    initializeCacheManager();
    console.log('[Startup] Cache manager initialized');
  } catch (error) {
    console.error('[Startup] Cache manager initialization failed:', error);
    if (isProductionEnv) {
      console.error('[Startup] Cache manager failure is critical in production');
      process.exit(1);
    }
  }

  // Initialize memory monitor
  try {
    initializeMemoryMonitor();
    console.log('[Startup] Memory monitor initialized');
  } catch (error) {
    console.error('[Startup] Memory monitor initialization failed:', error);
    // Not critical, continue without memory monitoring
  }

  const server = await registerRoutes(app);

  // Setup graceful shutdown handling
  initGracefulShutdown(server);

  // Initialize assignment status scheduler for automatic updates
  console.log('[Startup] Initializing assignment status scheduler...');
  assignmentScheduler.start(60); // Update every 60 minutes
  console.log('[Startup] Assignment status scheduler initialized');

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (isDevelopment()) {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // Register 404 handler for API routes only
  app.use('/api', notFoundHandler);
  
  // Register error recovery middleware
  app.use(errorRecoveryMiddleware);
  
  // Register global error handler
  app.use(errorHandler);

  // ALWAYS serve the app on port 5000
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = config.PORT;
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
    
    if (isProductionEnv) {
      console.log('🚀 Production server started successfully');
      console.log(`🌐 Server URL: http://0.0.0.0:${port}`);
    }
  });
})();
