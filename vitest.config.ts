import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./test/setup.ts'],
    coverage: {
      reporter: ['text', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        'test/',
        '**/*.test.ts',
        '**/*.spec.ts',
        'scripts/',
        'docs/',
        'temp/',
        'attached_assets/',
        'test_files/',
        'client/src/**/*.test.ts',
        'client/src/**/*.spec.ts'
      ]
    }
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './client/src'),
      '@shared': resolve(__dirname, './shared'),
      '@server': resolve(__dirname, './server')
    }
  }
});