import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

// ---------------------------------------------------------------------------
// Load .env into process.env so AI_API_KEY, AI_BASE_URL etc. are available
// in tests without needing to prefix them with VITE_ or install dotenv.
// Only sets variables that aren't already present in the environment.
// ---------------------------------------------------------------------------
try {
  const envContent = readFileSync(join(process.cwd(), '.env'), 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim();
    if (key && !(key in process.env)) {
      process.env[key] = value;
    }
  }
} catch {
  // .env not present — rely on environment variables already set (e.g. CI)
}

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
