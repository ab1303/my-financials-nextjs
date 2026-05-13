/// <reference types="vitest/config" />
import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [
    react(),
    tsconfigPaths()
  ],
  test: {
    globals: true,
    environment: 'happy-dom',
    // In Vitest 4, 'workspace' is renamed/moved to 'projects' for better alignment
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          include: ['src/__tests__/unit/**/*.test.ts', 'src/__tests__/unit/**/*.test.tsx'],
          setupFiles: ['./vitest.setup.ts'],
        }
      },
      {
        extends: true,
        test: {
          name: 'integration',
          include: ['src/__tests__/integration/**/*.integration.test.ts'],
          setupFiles: ['./vitest.integration.setup.ts'],
          environment: 'node',
          testTimeout: 15000,
          hookTimeout: 15000,
        }
      }
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        '.next/',
        'dist/',
        '**/*.config.*',
        '**/*.d.ts',
        '**/types/**',
        '**/__tests__/**',
      ],
    },
  },
});
