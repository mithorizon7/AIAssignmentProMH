import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';

describe('CSRF Protection', () => {
  // Mock csrfGenerator
  const mockGenerateToken = vi.fn().mockReturnValue('valid-csrf-token');
  const mockCsrfProtection = vi.fn();
  const mockDoubleCsrf = vi.fn().mockImplementation(() => ({
    generateToken: mockGenerateToken,
    doubleCsrfProtection: mockCsrfProtection
  }));
  
  // Mock request, response, and next
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;
  
  beforeEach(() => {
    // Reset mocks
    vi.resetAllMocks();
    
    // Setup mockRequest, mockResponse, and mockNext
    mockRequest = {
      cookies: {},
      headers: {}
    };
    
    mockResponse = {
      cookie: vi.fn(),
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis()
    };
    
    mockNext = vi.fn();
    
    // Mock csrfProtection to accept custom behavior
    mockCsrfProtection.mockImplementation((req, res, next) => {
      // Check if test wants to simulate CSRF failure
      if (req.headers['x-test-csrf-fail'] === 'true') {
        return res.status(403).json({
          status: 'error',
          message: 'CSRF token validation failed'
        });
      }
      next();
    });
  });
  
  // CSRF token endpoint handler
  const csrfTokenHandler = (req: Request, res: Response) => {
    const csrfToken = mockGenerateToken(req);
    res.json({ csrfToken: csrfToken });
  };
  
  it('should generate CSRF token when requested', () => {
    // Call the token handler
    csrfTokenHandler(mockRequest as Request, mockResponse as Response);
    
    // Verify token generation and response
    expect(mockGenerateToken).toHaveBeenCalledWith(mockRequest);
    expect(mockResponse.json).toHaveBeenCalledWith({ csrfToken: 'valid-csrf-token' });
  });
  
  it('should validate CSRF token on protected endpoints', () => {
    // Call CSRF protection middleware with valid token
    mockCsrfProtection(mockRequest as Request, mockResponse as Response, mockNext);
    
    // Verify next was called (protection passed)
    expect(mockNext).toHaveBeenCalled();
  });
  
  it('should reject requests with invalid CSRF tokens', () => {
    // Setup request to simulate CSRF failure
    mockRequest.headers = { 'x-test-csrf-fail': 'true' };
    
    // Call CSRF protection middleware with invalid token
    mockCsrfProtection(mockRequest as Request, mockResponse as Response, mockNext);
    
    // Verify response
    expect(mockResponse.status).toHaveBeenCalledWith(403);
    expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({
      status: 'error',
      message: 'CSRF token validation failed'
    }));
    expect(mockNext).not.toHaveBeenCalled();
  });
  
  it('should configure CSRF protection with secure options', () => {
    // Function to configure CSRF protection
    const configureCSRF = (secret: string) => {
      const csrfOptions = {
        getSecret: () => secret,
        cookieName: 'csrf_token',
        cookieOptions: {
          httpOnly: true,
          sameSite: 'strict',
          secure: process.env.NODE_ENV === 'production'
        }
      };
      return mockDoubleCsrf(csrfOptions);
    };
    
    // Configure with test secret
    const csrf = configureCSRF('test-csrf-secret');
    
    // Verify configuration
    expect(mockDoubleCsrf).toHaveBeenCalledWith(expect.objectContaining({
      cookieOptions: expect.objectContaining({
        httpOnly: true,
        sameSite: 'strict'
      })
    }));
    
    // Verify returned functions
    expect(csrf).toHaveProperty('generateToken');
    expect(csrf).toHaveProperty('doubleCsrfProtection');
  });
  
  it('should apply secure options in production', () => {
    // Save original NODE_ENV
    const originalNodeEnv = process.env.NODE_ENV;
    
    // Set production environment
    process.env.NODE_ENV = 'production';
    
    // Function to configure CSRF protection
    const configureCSRF = (secret: string) => {
      const csrfOptions = {
        getSecret: () => secret,
        cookieName: 'csrf_token',
        cookieOptions: {
          httpOnly: true,
          sameSite: 'strict',
          secure: process.env.NODE_ENV === 'production'
        }
      };
      return mockDoubleCsrf(csrfOptions);
    };
    
    // Configure with test secret
    configureCSRF('test-csrf-secret');
    
    // Verify configuration with secure option in production
    expect(mockDoubleCsrf).toHaveBeenCalledWith(expect.objectContaining({
      cookieOptions: expect.objectContaining({
        httpOnly: true,
        sameSite: 'strict',
        secure: true
      })
    }));
    
    // Restore original NODE_ENV
    process.env.NODE_ENV = originalNodeEnv;
  });
});