import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import crypto from 'crypto';

// CSRF token validation middleware
export function csrfProtection(req: Request, res: Response, next: NextFunction) {
  // Skip CSRF for GET requests and API endpoints that don't modify state
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    return next();
  }

  // Skip CSRF for certain endpoints that handle their own authentication
  const skipPaths = [
    '/api/auth/login',
    '/api/auth/logout',
    '/api/auth/register',
    '/api/auth-sso/callback',
    '/api/newsletter/subscribe' // Public endpoint
  ];

  if (skipPaths.some(path => req.path.startsWith(path))) {
    return next();
  }

  // Get CSRF token from header or body
  const csrfToken = req.headers['x-csrf-token'] || req.body.csrfToken;
  
  if (!csrfToken) {
    return res.status(403).json({
      error: 'CSRF token required',
      message: 'Missing CSRF token in request'
    });
  }

  // Validate CSRF token format
  const csrfTokenSchema = z.string().min(32).max(128);
  const validationResult = csrfTokenSchema.safeParse(csrfToken);
  
  if (!validationResult.success) {
    return res.status(403).json({
      error: 'Invalid CSRF token',
      message: 'CSRF token format is invalid'
    });
  }

  // Reset session CSRF token if it's corrupted or from old instance
  const sessionToken = req.session?.csrfToken;
  if (!sessionToken) {
    // No session token - this is the first request, generate one and allow
    req.session.csrfToken = csrfToken;
    console.log(`[CSRF] No session token found, accepting and storing: ${csrfToken.substring(0, 10)}...`);
    return next();
  }
  
  if (sessionToken !== csrfToken) {
    // Token mismatch - could be old instance data, regenerate session token
    console.log(`[CSRF] Token mismatch detected - regenerating session token`);
    req.session.csrfToken = csrfToken;
    console.log(`[CSRF] Session token updated to: ${csrfToken.substring(0, 10)}...`);
  }

  next();
}

// Generate CSRF token for session
export function generateCSRFToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

// Middleware to add CSRF token to session
export function addCSRFToken(req: Request, res: Response, next: NextFunction) {
  if (!req.session?.csrfToken) {
    req.session.csrfToken = generateCSRFToken();
  }
  next();
}

// Endpoint to get CSRF token
export function getCSRFToken(req: Request, res: Response) {
  // Always generate a fresh token to avoid old instance conflicts
  const newToken = generateCSRFToken();
  req.session.csrfToken = newToken;
  
  console.log(`[CSRF] Generated fresh token: ${newToken.substring(0, 10)}...`);
  res.json({ csrfToken: newToken });
}