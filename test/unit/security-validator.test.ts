import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * This module specifically tests the security validator function in isolation
 * from actual implementation. This allows us to test edge cases and validation 
 * logic without needing to mock or import the actual auth module.
 * 
 * For integration testing with the auth module, see test/auth/security-validation.test.ts
 */
describe('Security Environment Variable Validator (Unit)', () => {
  // Store original environment and console methods
  const originalEnv = { ...process.env };
  let mockConsoleError: any;
  let mockConsoleWarn: any;
  let mockProcessExit: any;
  
  beforeEach(() => {
    // Mock console methods to prevent test output pollution
    mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockConsoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockProcessExit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    
    // Reset environment variables before each test
    delete process.env.SESSION_SECRET;
    delete process.env.CSRF_SECRET;
    process.env.NODE_ENV = 'test';
  });
  
  afterEach(() => {
    // Restore console methods and environment
    vi.restoreAllMocks();
    process.env = { ...originalEnv };
  });

  // Create the validation function to test in isolation
  // This is a generic implementation for testing validation logic without importing the auth module
  const validateSecurityEnvVars = () => {
    if (!process.env.SESSION_SECRET) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('SESSION_SECRET environment variable is not set');
      } else {
        console.error('SESSION_SECRET environment variable is not set', 'This is a critical security issue and should be resolved before deploying to production');
        process.exit(1);
      }
    }
    
    if (process.env.SESSION_SECRET && process.env.SESSION_SECRET.length < 30) {
      console.warn('Security Warning:', 'SESSION_SECRET is too weak. Use a stronger secret with at least 30 characters');
    }
    
    if (!process.env.CSRF_SECRET) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('CSRF_SECRET environment variable is not set');
      } else {
        console.error('CSRF_SECRET environment variable is not set', 'This is a critical security issue and should be resolved before deploying to production');
        process.exit(1);
      }
    }
    
    if (process.env.CSRF_SECRET && process.env.CSRF_SECRET.length < 30) {
      console.warn('Security Warning:', 'CSRF_SECRET is too weak. Use a stronger secret with at least 30 characters');
    }
  };

  describe('SESSION_SECRET validation', () => {
    it('should throw an error if not set in production', () => {
      process.env.NODE_ENV = 'production';
      expect(() => validateSecurityEnvVars()).toThrow(/SESSION_SECRET.*not set/);
    });
    
    it('should exit process if not set in development', () => {
      process.env.NODE_ENV = 'development';
      validateSecurityEnvVars();
      expect(mockConsoleError).toHaveBeenCalledWith(
        'SESSION_SECRET environment variable is not set',
        expect.any(String)
      );
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });
    
    it('should warn if too short', () => {
      process.env.SESSION_SECRET = 'short';
      process.env.CSRF_SECRET = 'a'.repeat(32); // valid CSRF_SECRET to avoid that error
      validateSecurityEnvVars();
      expect(mockConsoleWarn).toHaveBeenCalledWith(
        'Security Warning:',
        expect.stringContaining('SESSION_SECRET is too weak')
      );
    });
  });
  
  describe('CSRF_SECRET validation', () => {
    it('should throw an error if not set in production', () => {
      process.env.NODE_ENV = 'production';
      process.env.SESSION_SECRET = 'a'.repeat(32);
      expect(() => validateSecurityEnvVars()).toThrow(/CSRF_SECRET.*not set/);
    });
    
    it('should exit process if not set in development', () => {
      process.env.NODE_ENV = 'development';
      process.env.SESSION_SECRET = 'a'.repeat(32);
      validateSecurityEnvVars();
      expect(mockConsoleError).toHaveBeenCalledWith(
        'CSRF_SECRET environment variable is not set',
        expect.any(String)
      );
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });
    
    it('should warn if too short', () => {
      process.env.SESSION_SECRET = 'a'.repeat(32); // valid SESSION_SECRET
      process.env.CSRF_SECRET = 'short';
      validateSecurityEnvVars();
      expect(mockConsoleWarn).toHaveBeenCalledWith(
        'Security Warning:',
        expect.stringContaining('CSRF_SECRET is too weak')
      );
    });
  });
  
  it('should pass validation with proper secrets', () => {
    process.env.SESSION_SECRET = 'a'.repeat(32);
    process.env.CSRF_SECRET = 'b'.repeat(32);
    validateSecurityEnvVars();
    expect(mockConsoleError).not.toHaveBeenCalled();
    expect(mockProcessExit).not.toHaveBeenCalled();
  });
});