/// <reference types="vitest" />
import { resolve } from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'integration',
    include: ['src/__tests__/integration/**/*.integration.test.ts'],
    environment: 'happy-dom',
    setupFiles: ['./vitest.integration.setup.ts'],
    globals: true,
    // Integration tests may take longer
    testTimeout: 10000,
    hookTimeout: 10000,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '~': resolve(__dirname, './src'),
    },
  },
});
