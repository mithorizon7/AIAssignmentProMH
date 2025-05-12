/**
 * Global test setup file
 * Runs before any tests are executed
 */

import { afterAll, afterEach, beforeAll, beforeEach, vi } from 'vitest';

// Setup default environment variables for tests
beforeAll(() => {
  // Set environment variables needed for tests to pass
  process.env.NODE_ENV = 'test';
  process.env.SESSION_SECRET = 'test_session_secret_with_more_than_30_chars';
  process.env.CSRF_SECRET = 'test_csrf_secret_with_more_than_30_chars';
  
  // Suppress console warnings/errors during tests
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

// Cleanup environment after all tests
afterAll(() => {
  // Reset environment variables
  delete process.env.SESSION_SECRET;
  delete process.env.CSRF_SECRET;
  
  // Restore console
  vi.restoreAllMocks();
});

// Clean up after each test
afterEach(() => {
  vi.resetAllMocks();
  vi.resetModules();
});