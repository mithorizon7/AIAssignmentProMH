import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    name: 'ai-feedback',
    environment: 'node',
    testTimeout: 120000, // 2 minutes for AI operations
    hookTimeout: 30000,  // 30 seconds for setup/teardown
    threads: true,
    maxThreads: 4,
    minThreads: 1,
    reporter: ['verbose', 'json', 'html'],
    outputFile: {
      json: './test/reports/ai-feedback-results.json',
      html: './test/reports/ai-feedback-report.html'
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: './test/reports/coverage',
      exclude: [
        'node_modules/**',
        'test/**',
        '**/*.test.ts',
        '**/*.config.*',
        '**/build/**',
        '**/dist/**'
      ],
      thresholds: {
        global: {
          branches: 75,
          functions: 80,
          lines: 80,
          statements: 80
        }
      }
    },
    env: {
      NODE_ENV: 'test',
      LOG_LEVEL: 'error'
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './client/src'),
      '@shared': path.resolve(__dirname, './shared'),
      '@server': path.resolve(__dirname, './server')
    }
  }
});