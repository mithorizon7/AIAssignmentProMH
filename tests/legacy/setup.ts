/**
 * Test setup configuration for Vitest
 * 
 * This file is automatically loaded before running tests.
 * It sets up global test utilities and configurations.
 */

import { beforeAll, afterAll, afterEach } from 'vitest';

// Global test setup
beforeAll(() => {
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = 'postgresql://test_user:test_password@localhost:5432/test_aigrader';
  process.env.SESSION_SECRET = 'test_session_secret_at_least_32_chars_long';
  process.env.CSRF_SECRET = 'test_csrf_secret_at_least_32_chars_long';
});

// Clean up after each test
afterEach(() => {
  // Reset any global state if needed
});

// Global test teardown
afterAll(() => {
  // Cleanup resources if needed
});

// Mock console methods in test environment
if (process.env.NODE_ENV === 'test') {
  // Suppress console.log in tests unless explicitly needed
  const originalConsoleLog = console.log;
  console.log = (...args: any[]) => {
    if (process.env.DEBUG_TESTS) {
      originalConsoleLog(...args);
    }
  };
}