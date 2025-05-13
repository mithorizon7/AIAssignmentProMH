import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./setup.ts'],
    include: ['**/*.{test,spec}.{js,mjs,cjs,ts,mjs,cjs,tsx}'],
    exclude: ['node_modules/**/*'],
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, '../../client/src'),
      '@shared': resolve(__dirname, '../../shared'),
    },
  },
});