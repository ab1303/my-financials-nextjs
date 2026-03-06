import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// Mock environment variables for integration testing
process.env.DATABASE_URL =
  'postgresql://postgres:postgres@localhost:5432/financials_e2e_test';
process.env.NEXTAUTH_SECRET = 'test-secret-for-e2e-tests-only';
process.env.NEXTAUTH_URL = 'http://localhost:3000';

// Import the global Prisma mock to ensure all integration tests use the mock
import './src/__tests__/mocks/prisma.mock';

// Mock process.exit to prevent tests from killing the process
vi.spyOn(process, 'exit').mockImplementation(
  (code?: string | number | null | undefined): never => {
    throw new Error(`process.exit called with code ${code}`);
  },
);

// Note: For true integration tests, you would typically set up a real test database here
// Example using SQLite:
// process.env.DATABASE_URL = 'file:./test-integration.db';

// See the testing guide for complete setup instructions
