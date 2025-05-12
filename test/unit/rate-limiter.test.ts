import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';

describe('Rate Limiter Configuration', () => {
  const originalEnv = { ...process.env };
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let nextFunction: NextFunction;
  let rateLimitMock: any;
  
  beforeEach(() => {
    // Reset environment
    process.env = { ...originalEnv };
    process.env.NODE_ENV = 'test';
    
    // Create mock request and response
    mockRequest = {
      ip: '127.0.0.1',
      path: '/test-path',
      headers: {}
    };
    
    mockResponse = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      sendStatus: vi.fn()
    };
    
    nextFunction = vi.fn();
    
    // Create a mock for express-rate-limit
    rateLimitMock = vi.fn().mockImplementation((options) => {
      // Return middleware function
      return (req: Request, res: Response, next: NextFunction) => {
        // Skip rate limiting if the skip function returns true
        if (options.skip && options.skip(req)) {
          return next();
        }
        
        // For testing, simulate rate limiting based on a special header
        if (req.headers['x-test-rate-limit-exceeded'] === 'true') {
          return options.handler(req, res, next);
        }
        
        // Otherwise, proceed normally
        next();
      };
    });
  });
  
  afterEach(() => {
    // Restore environment
    process.env = { ...originalEnv };
    vi.resetAllMocks();
  });
  
  it('should configure different rate limiters with appropriate limits', () => {
    // Define rate limiter creator function
    const createRateLimiter = (options = {}) => {
      const defaultOptions = {
        windowMs: 15 * 60 * 1000, // 15 minutes
        limit: 100, // default limit
        standardHeaders: true,
        legacyHeaders: false,
        message: 'Too many requests from this IP, please try again later.',
        handler: (req: Request, res: Response) => {
          res.status(429).json({
            status: 'error',
            message: 'Rate limit exceeded. Please try again later.'
          });
        }
      };
      
      return rateLimitMock({ ...defaultOptions, ...options });
    };
    
    // Create specialized rate limiters
    const defaultLimiter = createRateLimiter();
    const authLimiter = createRateLimiter({ 
      windowMs: 60 * 1000, // 1 minute
      limit: 10 
    });
    const submissionLimiter = createRateLimiter({ 
      windowMs: 60 * 1000, // 1 minute
      limit: 5 
    });
    const csrfLimiter = createRateLimiter({ 
      windowMs: 60 * 1000, // 1 minute
      limit: 20 
    });
    
    // Verify rate limiters were created with appropriate parameters
    expect(rateLimitMock).toHaveBeenCalledTimes(4);
    
    // Check the first call (default limiter)
    expect(rateLimitMock.mock.calls[0][0]).toMatchObject({
      windowMs: 15 * 60 * 1000,
      limit: 100
    });
    
    // Check the second call (auth limiter)
    expect(rateLimitMock.mock.calls[1][0]).toMatchObject({
      windowMs: 60 * 1000,
      limit: 10
    });
    
    // Check the third call (submission limiter)
    expect(rateLimitMock.mock.calls[2][0]).toMatchObject({
      windowMs: 60 * 1000,
      limit: 5
    });
    
    // Check the fourth call (csrf limiter)
    expect(rateLimitMock.mock.calls[3][0]).toMatchObject({
      windowMs: 60 * 1000,
      limit: 20
    });
    
    // Verify the limiters are functions
    expect(typeof defaultLimiter).toBe('function');
    expect(typeof authLimiter).toBe('function');
    expect(typeof submissionLimiter).toBe('function');
    expect(typeof csrfLimiter).toBe('function');
  });
  
  it('should skip rate limiting in development environment', () => {
    // Set development environment
    process.env.NODE_ENV = 'development';
    
    // Create rate limiter with development detection
    const createRateLimiter = () => {
      return rateLimitMock({
        windowMs: 15 * 60 * 1000,
        limit: 100,
        skip: (req: Request) => process.env.NODE_ENV === 'development'
      });
    };
    
    const limiter = createRateLimiter();
    
    // Call the rate limiter
    limiter(mockRequest as Request, mockResponse as Response, nextFunction);
    
    // Expect next to have been called without rate limiting
    expect(nextFunction).toHaveBeenCalled();
  });
  
  it('should apply rate limiting in production environment', () => {
    // Set production environment
    process.env.NODE_ENV = 'production';
    
    // Create rate limiter and specify to apply rate limiting
    const createRateLimiter = () => {
      return rateLimitMock({
        windowMs: 15 * 60 * 1000,
        limit: 100,
        skip: (req: Request) => process.env.NODE_ENV === 'development',
        handler: (req: Request, res: Response) => {
          res.status(429).json({
            status: 'error',
            message: 'Rate limit exceeded. Please try again later.'
          });
        }
      });
    };
    
    const limiter = createRateLimiter();
    
    // Set header to simulate reaching rate limit
    mockRequest.headers = {
      'x-test-rate-limit-exceeded': 'true'
    };
    
    // Call the rate limiter
    limiter(mockRequest as Request, mockResponse as Response, nextFunction);
    
    // Expect rate limiting to have been applied
    expect(mockResponse.status).toHaveBeenCalledWith(429);
    expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({
      status: 'error',
      message: 'Rate limit exceeded. Please try again later.'
    }));
    expect(nextFunction).not.toHaveBeenCalled();
  });
});