/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
    include: [
      'test/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
      'src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
    ],
    exclude: [
      'node_modules',
      'dist',
      '.idea',
      '.git',
      '.cache',
      'test/e2e/**/*',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov', 'text-summary'],
      reportsDirectory: 'coverage',
      exclude: [
        'node_modules/',
        'dist/',
        'test/',
        'scripts/',
        '**/*.config.ts',
        '**/*.config.js',
        '**/*.d.ts',
        'coverage/',
        '.github/',
        'temp/',
        '**/*.test.ts',
        '**/*.test.tsx',
        '**/*.spec.ts',
        '**/*.spec.tsx',
      ],
      include: [
        'server/**/*.ts',
        'client/src/**/*.{ts,tsx}',
        'shared/**/*.ts',
      ],
      thresholds: {
        global: {
          branches: 75,
          functions: 75,
          lines: 75,
          statements: 75,
        },
        // Per-file thresholds for critical files
        'server/routes/*.ts': {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80,
        },
        'shared/schema.ts': {
          branches: 85,
          functions: 85,
          lines: 85,
          statements: 85,
        },
      },
      watermarks: {
        statements: [75, 90],
        functions: [75, 90],
        branches: [75, 90],
        lines: [75, 90],
      },
    },
    testTimeout: 30000,
    hookTimeout: 30000,
    teardownTimeout: 10000,
    isolate: true,
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,
        isolate: true,
      },
    },
    reporters: ['verbose', 'junit'],
    outputFile: {
      junit: './test-results.xml',
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './client/src'),
      '@shared': path.resolve(__dirname, './shared'),
      '@server': path.resolve(__dirname, './server'),
      '@test': path.resolve(__dirname, './test'),
    },
  },
  define: {
    'import.meta.vitest': undefined,
  },
});