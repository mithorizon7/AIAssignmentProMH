import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';

/**
 * This module tests the security validation as it integrates with the auth module.
 * It verifies that validation happens during the auth module initialization.
 * 
 * For unit testing of just the validation logic, see test/unit/security-validator.test.ts
 */

// Mocks for required modules
vi.mock('express-session', () => {
  return {
    default: vi.fn(() => (req: any, res: any, next: any) => next())
  };
});

vi.mock('connect-pg-simple', () => {
  return {
    default: vi.fn().mockImplementation(() => {
      return function PgStore() {
        return {};
      };
    })
  };
});

vi.mock('passport', () => {
  return {
    default: {
      initialize: vi.fn(() => (req: any, res: any, next: any) => next()),
      session: vi.fn(() => (req: any, res: any, next: any) => next()),
      use: vi.fn(),
      serializeUser: vi.fn(),
      deserializeUser: vi.fn()
    }
  };
});

vi.mock('csrf-csrf', () => {
  return {
    doubleCsrf: vi.fn().mockImplementation(() => ({
      doubleCsrfProtection: vi.fn((req: any, res: any, next: any) => next()),
      generateCsrfToken: vi.fn().mockReturnValue('mock-csrf-token')
    }))
  };
});

vi.mock('../../server/storage', () => {
  return {
    storage: {
      getUserByUsername: vi.fn(),
      getUser: vi.fn(),
      createUser: vi.fn()
    }
  };
});

vi.mock('../../server/db', () => {
  return {
    pool: {}
  };
});

describe('Auth Module Security Validation (Integration)', () => {
  let mockConsoleError: any;
  let mockConsoleWarn: any;
  let mockProcessExit: any;
  
  beforeEach(() => {
    // Save original console methods
    mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockConsoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockProcessExit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    
    // Reset environment before each test
    delete process.env.SESSION_SECRET;
    delete process.env.CSRF_SECRET;
    process.env.NODE_ENV = 'test';
  });
  
  afterEach(() => {
    vi.resetAllMocks();
    vi.resetModules();
  });

  describe('Auth module initialization security checks', () => {
    it('validates SESSION_SECRET during module initialization in production', async () => {
      process.env.NODE_ENV = 'production';
      
      await expect(async () => {
        await import('../../server/auth');
      }).rejects.toThrow(/SESSION_SECRET.*not set/);
    });
    
    it('validates CSRF_SECRET during module initialization in production', async () => {
      process.env.NODE_ENV = 'production';
      process.env.SESSION_SECRET = 'a'.repeat(32);
      
      await expect(async () => {
        await import('../../server/auth');
      }).rejects.toThrow(/CSRF_SECRET.*not set/);
    });
    
    it('logs errors and exits when secrets are missing in development', async () => {
      process.env.NODE_ENV = 'development';
      
      await import('../../server/auth');
      
      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('SESSION_SECRET'),
        expect.any(String)
      );
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });
  });
  
  describe('Auth module initialization with valid configuration', () => {
    it('successfully initializes with valid security configuration', async () => {
      process.env.SESSION_SECRET = 'a'.repeat(32);
      process.env.CSRF_SECRET = 'b'.repeat(32);
      
      const authModule = await import('../../server/auth');
      
      expect(authModule).toHaveProperty('configureAuth');
      expect(mockProcessExit).not.toHaveBeenCalled();
    });
    
    it('warns about weak secrets but still initializes', async () => {
      process.env.SESSION_SECRET = 'short'; // weak secret
      process.env.CSRF_SECRET = 'b'.repeat(32); // valid secret
      
      const authModule = await import('../../server/auth');
      
      expect(mockConsoleWarn).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('SESSION_SECRET is too weak')
      );
      expect(authModule).toHaveProperty('configureAuth');
    });
  });
});