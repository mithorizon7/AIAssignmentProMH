import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: [], // No global setup files
    include: ['test/**/*.test.ts'],
    typecheck: {
      enabled: false,
    },
  },
});