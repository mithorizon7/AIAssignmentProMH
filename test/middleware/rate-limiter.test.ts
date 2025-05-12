import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import * as rateLimit from 'express-rate-limit';
import { defaultRateLimiter, authRateLimiter, submissionRateLimiter, csrfRateLimiter } from '../../server/middleware/rate-limiter';

// Mock express-rate-limit module
vi.mock('express-rate-limit', () => {
  return {
    default: vi.fn().mockImplementation((options) => {
      // Return a function that simulates the middleware
      return (req: Request, res: Response, next: NextFunction) => {
        // Simulate rate limiter behavior based on options
        if (options.skip && options.skip(req)) {
          return next();
        }
        
        // For testing, we'll use a mock counter to simulate reaching limits
        const mockCounter = (req as any).__mockRequestCount || 0;
        (req as any).__mockRequestCount = mockCounter + 1;
        
        if (mockCounter >= (options.limit || 5)) {
          return options.handler(req, res, next);
        }
        
        next();
      };
    })
  };
});

describe('Rate Limiter Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let nextFunction: NextFunction;
  
  beforeEach(() => {
    // Reset environment before each test
    process.env.NODE_ENV = 'test';
    
    // Create mock request and response objects
    mockRequest = {
      ip: '127.0.0.1',
      path: '/test-path',
      headers: {}
    };
    
    mockResponse = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis()
    };
    
    nextFunction = vi.fn();
  });
  
  afterEach(() => {
    vi.resetAllMocks();
  });
  
  it('should create different rate limiters with appropriate configurations', () => {
    // Verify rate limit library was called with appropriate settings
    expect(rateLimit.default).toHaveBeenCalledTimes(4); // Four different limiters
    
    // Reset mock to check specific calls
    vi.mocked(rateLimit.default).mockClear();
    
    // Recreate the rate limiters to verify configurations
    const testDefaultLimiter = defaultRateLimiter;
    expect(rateLimit.default).toHaveBeenLastCalledWith(expect.objectContaining({
      windowMs: 15 * 60 * 1000, // 15 minutes
      limit: 100
    }));
    
    vi.mocked(rateLimit.default).mockClear();
    const testAuthLimiter = authRateLimiter;
    expect(rateLimit.default).toHaveBeenLastCalledWith(expect.objectContaining({
      windowMs: 60 * 1000, // 1 minute
      limit: 10
    }));
    
    vi.mocked(rateLimit.default).mockClear();
    const testSubmissionLimiter = submissionRateLimiter;
    expect(rateLimit.default).toHaveBeenLastCalledWith(expect.objectContaining({
      windowMs: 60 * 1000, // 1 minute
      limit: 5
    }));
    
    vi.mocked(rateLimit.default).mockClear();
    const testCsrfLimiter = csrfRateLimiter;
    expect(rateLimit.default).toHaveBeenLastCalledWith(expect.objectContaining({
      windowMs: 60 * 1000, // 1 minute
      limit: 20
    }));
  });
  
  it('should skip rate limiting in development environment', () => {
    // Set development environment
    process.env.NODE_ENV = 'development';
    
    // Get a fresh instance of middleware
    vi.resetModules();
    jest.isolateModules(() => {
      const { defaultRateLimiter } = require('../../server/middleware/rate-limiter');
      
      // Call the middleware
      defaultRateLimiter(mockRequest as Request, mockResponse as Response, nextFunction);
      
      // Expect next to be called without rate limiting
      expect(nextFunction).toHaveBeenCalled();
    });
  });
  
  it('should apply rate limiting in production environment', () => {
    // Set production environment
    process.env.NODE_ENV = 'production';
    
    // Mock a request that exceeds the limit
    (mockRequest as any).__mockRequestCount = 101; // Exceed default limit
    
    // Call the middleware
    defaultRateLimiter(mockRequest as Request, mockResponse as Response, nextFunction);
    
    // Expect response with 429 status
    expect(mockResponse.status).toHaveBeenCalledWith(429);
    expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({
      status: 'error',
      message: expect.any(String)
    }));
    expect(nextFunction).not.toHaveBeenCalled();
  });
  
  it('should handle proxy IPs when configured', () => {
    // Set production environment and trust proxy
    process.env.NODE_ENV = 'production';
    process.env.TRUST_PROXY = 'true';
    
    // Add X-Forwarded-For header
    mockRequest.headers = {
      'x-forwarded-for': '192.168.1.1, 10.0.0.1'
    };
    
    // Get a fresh instance of middleware with trust proxy
    vi.resetModules();
    jest.isolateModules(() => {
      const { defaultRateLimiter } = require('../../server/middleware/rate-limiter');
      
      // Call the middleware
      defaultRateLimiter(mockRequest as Request, mockResponse as Response, nextFunction);
      
      // Expect next to be called as we haven't exceeded limit yet
      expect(nextFunction).toHaveBeenCalled();
    });
  });
});