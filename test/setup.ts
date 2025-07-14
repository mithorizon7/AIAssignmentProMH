import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import 'dotenv/config';

// Mock Redis for testing
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.NODE_ENV = 'test';

// Global test setup
beforeAll(() => {
  // Setup test environment
  console.log('Setting up test environment...');
});

afterAll(() => {
  // Cleanup test environment
  console.log('Cleaning up test environment...');
});

beforeEach(() => {
  // Reset state before each test
});

afterEach(() => {
  // Cleanup after each test
});