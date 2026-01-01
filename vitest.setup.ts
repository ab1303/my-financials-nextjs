import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// Mock environment variables for testing
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.NEXTAUTH_SECRET = 'test-secret';
process.env.NEXTAUTH_URL = 'http://localhost:3000';
// NODE_ENV is read-only, no need to set it in test environment

// Mock process.exit to prevent tests from killing the process
vi.spyOn(process, 'exit').mockImplementation(
  (code?: string | number | null | undefined): never => {
    throw new Error(`process.exit called with code ${code}`);
  },
);
