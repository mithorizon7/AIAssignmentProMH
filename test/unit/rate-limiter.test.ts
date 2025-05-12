import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { rateLimit, RateLimitRequestHandler } from 'express-rate-limit';
import { authRateLimiter, csrfRateLimiter, defaultRateLimiter, submissionRateLimiter } from '../../server/middleware/rate-limiter';

// Custom interface for our test rate limiter with testing properties
interface TestRateLimiter extends RateLimitRequestHandler {
  _handler: (req: any, res: any) => void;
  _windowMs: number;
  _max: number;
}
import { 
  logSecurityEvent,
  AuditEventType
} from '../../server/lib/audit-logger';

// Mock the logger module
vi.mock('../../server/lib/audit-logger', () => ({
  logSecurityEvent: vi.fn(),
  AuditEventType: {
    RATE_LIMIT_EXCEEDED: 'rate_limit_exceeded'
  }
}));

// Mock express-rate-limit
vi.mock('express-rate-limit', () => ({
  rateLimit: vi.fn().mockImplementation((config) => {
    // Create a mock rate limiter that exposes config for testing
    const rateLimiter = (req: any, res: any, next: any) => {
      next();
    };
    
    // Add test properties to the function object
    Object.assign(rateLimiter, {
      _handler: config.handler,
      _windowMs: config.windowMs,
      _max: config.limit
    });
    
    return rateLimiter;
  })
}));

describe('Rate Limiters', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Mock environment variables
    process.env.NODE_ENV = 'production'; // Test stricter limits in production
  });
  
  afterEach(() => {
    vi.clearAllMocks();
    process.env.NODE_ENV = 'development'; // Reset back to development
  });
  
  it('should configure auth rate limiter with correct limits', () => {
    expect(rateLimit).toHaveBeenCalled();
    expect(authRateLimiter).toBeDefined();
    
    // Verify the limits are production-appropriate for auth
    if (process.env.NODE_ENV === 'production') {
      expect((authRateLimiter as TestRateLimiter)._windowMs).toBeLessThanOrEqual(15 * 60 * 1000); // 15 minutes or less
      expect((authRateLimiter as TestRateLimiter)._max).toBeLessThanOrEqual(10); // No more than 10 attempts 
    }
  });
  
  it('should configure submission rate limiter with correct limits', () => {
    expect(submissionRateLimiter).toBeDefined();
    
    // Verify the limits are production-appropriate for submissions
    if (process.env.NODE_ENV === 'production') {
      expect((submissionRateLimiter as TestRateLimiter)._windowMs).toBeLessThanOrEqual(60 * 60 * 1000); // 1 hour or less
      expect((submissionRateLimiter as TestRateLimiter)._max).toBeLessThanOrEqual(30); // No more than 30 submissions
    }
  });
  
  it('should log rate limit exceeded events and audit them', () => {
    // Create a mock request and response
    const req = { ip: '192.168.1.1', method: 'POST', path: '/api/auth/login' };
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn()
    };
    
    // Call the handler directly with mock request and response
    (authRateLimiter as TestRateLimiter)._handler(req, res);
    
    // Verify response was set correctly
    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ 
      message: expect.stringContaining('Too many requests')
    }));
    
    // Verify audit logging was called
    expect(logSecurityEvent).toHaveBeenCalledWith(
      AuditEventType.RATE_LIMIT_EXCEEDED,
      req.ip,
      undefined,
      undefined,
      expect.objectContaining({
        path: req.path
      })
    );
  });
});