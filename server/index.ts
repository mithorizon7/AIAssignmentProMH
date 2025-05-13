// Load environment variables from .env file
import 'dotenv/config';

import express, { type Request, Response, NextFunction } from "express";
import helmet from "helmet";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { errorHandler, notFoundHandler, logger } from "./lib/error-handler";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Configure helmet security headers based on environment
const isProduction = app.get("env") === "production";

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
if (isProduction) {
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

const cspDirectives = isProduction ? productionDirectives : developmentDirectives;

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: cspDirectives,
    },
    strictTransportSecurity: isProduction
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

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // Register 404 handler for API routes only
  app.use('/api', notFoundHandler);
  
  // Register global error handler
  app.use(errorHandler);

  // ALWAYS serve the app on port 5000
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = 5000;
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
