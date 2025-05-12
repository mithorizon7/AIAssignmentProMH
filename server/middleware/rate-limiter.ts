import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';

/**
 * Rate limiting configuration for various API endpoints
 * These settings help protect the application from abuse, DoS attacks, and brute force attempts
 */

// Default rate limiter configuration (100 requests per 15 minutes)
export const defaultRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 100, // 100 requests per window
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: { 
    status: 429, 
    message: 'Too many requests, please try again later.' 
  },
  // Skip rate limiting in development environment
  skip: (req) => process.env.NODE_ENV === 'development',
  // Correctly identify client IP when behind proxy
  ...getIPConfig(),
  // Custom handler for rate limit exceeded
  handler: (req: Request, res: Response) => {
    // Log rate limit exceeded events
    console.warn(`Rate limit exceeded for IP: ${req.ip}, path: ${req.path}`);
    res.status(429).json({
      status: 'error',
      message: 'Too many requests, please try again later.'
    });
  }
});

// Stricter rate limiter for authentication endpoints (10 requests per minute)
export const authRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  limit: 10, // 10 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { 
    status: 429, 
    message: 'Too many login attempts, please try again later.' 
  },
  skip: (req) => process.env.NODE_ENV === 'development',
  ...getIPConfig(),
  handler: (req: Request, res: Response) => {
    console.warn(`Auth rate limit exceeded for IP: ${req.ip}, path: ${req.path}`);
    res.status(429).json({
      status: 'error',
      message: 'Too many login attempts, please try again later.'
    });
  }
});

// Strict rate limiter for anonymous submissions (5 requests per minute)
export const submissionRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  limit: 5, // 5 requests per window
  standardHeaders: true,
  legacyHeaders: false, 
  message: { 
    status: 429, 
    message: 'Submission rate limit exceeded. Please try again later.' 
  },
  skip: (req) => process.env.NODE_ENV === 'development',
  ...getIPConfig(),
  handler: (req: Request, res: Response) => {
    console.warn(`Submission rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({
      status: 'error',
      message: 'Submission rate limit exceeded. Please try again later.'
    });
  }
});

// More lenient rate limiter for CSRF token generation (20 requests per minute)
export const csrfRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  limit: 20, // 20 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { 
    status: 429, 
    message: 'Too many requests for CSRF token, please try again later.' 
  },
  skip: (req) => process.env.NODE_ENV === 'development',
  ...getIPConfig(),
  handler: (req: Request, res: Response) => {
    console.warn(`CSRF token rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({
      status: 'error',
      message: 'Too many requests for CSRF token, please try again later.'
    });
  }
});

/**
 * Helper function to configure IP extraction
 * Ensures we're properly identifying clients even when behind a proxy
 */
function getIPConfig() {
  // When in production and behind a proxy, use X-Forwarded-For header
  if (process.env.NODE_ENV === 'production' && process.env.TRUST_PROXY === 'true') {
    return {
      // Trust the first hop in X-Forwarded-For
      trustProxy: true
    };
  }
  
  // Default behavior - use direct connection IP
  return {};
}