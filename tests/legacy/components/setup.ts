/**
 * Component test setup file
 */

import { afterAll, afterEach, beforeAll, vi, expect } from 'vitest';
import '@testing-library/jest-dom/vitest';
import * as matchers from '@testing-library/jest-dom/matchers';

// Add the jest-dom matchers to vitest
expect.extend(matchers);

// Setup default environment variables for tests
beforeAll(() => {
  // Suppress console warnings/errors during tests
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

// Cleanup environment after all tests
afterAll(() => {
  // Restore console
  vi.restoreAllMocks();
});

// Clean up after each test
afterEach(() => {
  vi.resetAllMocks();
  vi.resetModules();
});