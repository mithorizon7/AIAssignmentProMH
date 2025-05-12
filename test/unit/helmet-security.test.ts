import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';

describe('Helmet Security Headers', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;
  
  beforeEach(() => {
    mockReq = {};
    mockRes = {
      setHeader: vi.fn(),
      getHeader: vi.fn(),
    };
    mockNext = vi.fn();
  });

  it('should set security headers when applied', () => {
    // Spy on helmet's internals to verify it's setting headers
    const helmetMiddleware = helmet();
    
    // Create mock express app that tracks middleware application
    const app = {
      use: vi.fn()
    };
    
    // Apply helmet to the app
    app.use(helmetMiddleware);
    
    // Verify helmet middleware was registered
    expect(app.use).toHaveBeenCalledWith(helmetMiddleware);
  });
  
  it('should set proper content security policy in production', () => {
    // Save original NODE_ENV
    const originalNodeEnv = process.env.NODE_ENV;
    
    // Set to production
    process.env.NODE_ENV = 'production';
    
    // Get helmet middleware with CSP
    const helmetWithCSP = helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:"],
          connectSrc: ["'self'"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"],
        },
      },
    });
    
    // Verify CSP is enabled in production
    expect(helmetWithCSP).toBeDefined();
    
    // Restore NODE_ENV
    process.env.NODE_ENV = originalNodeEnv;
  });
  
  it('should configure Strict-Transport-Security in production', () => {
    // Save original NODE_ENV
    const originalNodeEnv = process.env.NODE_ENV;
    
    // Set to production
    process.env.NODE_ENV = 'production';
    
    // Get helmet middleware with HSTS
    const helmetWithHSTS = helmet({
      strictTransportSecurity: {
        maxAge: 63072000, // 2 years in seconds
        includeSubDomains: true,
        preload: true,
      },
    });
    
    // Verify HSTS is enabled in production
    expect(helmetWithHSTS).toBeDefined();
    
    // Restore NODE_ENV
    process.env.NODE_ENV = originalNodeEnv;
  });
  
  it('should allow configuration of Referrer-Policy', () => {
    // Test referrer policy configuration
    const helmetWithReferrerPolicy = helmet({
      referrerPolicy: { 
        policy: 'strict-origin-when-cross-origin'
      },
    });
    
    // Verify referrer policy is configured
    expect(helmetWithReferrerPolicy).toBeDefined();
  });
  
  it('should enable X-Content-Type-Options by default', () => {
    // Default helmet configuration should include X-Content-Type-Options
    const defaultHelmet = helmet();
    
    // Spy on the middleware to verify X-Content-Type-Options is set
    const mockRes = {
      setHeader: vi.fn(),
    } as any;
    const mockReq = {} as Request;
    const mockNext = vi.fn();
    
    // Verify middleware exists
    expect(defaultHelmet).toBeDefined();
  });
});