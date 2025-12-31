import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// Mock environment variables for integration testing
process.env.DATABASE_URL =
  'postgresql://test:test@localhost:5432/test_integration';
process.env.NEXTAUTH_SECRET = 'test-secret-integration';
process.env.NEXTAUTH_URL = 'http://localhost:3000';
process.env.NODE_ENV = 'test';

// For integration tests, you would typically set up a real test database here
// Example using SQLite:
// process.env.DATABASE_URL = 'file:./test-integration.db';

// Mock process.exit to prevent tests from killing the process
vi.spyOn(process, 'exit').mockImplementation((code?: number) => {
  throw new Error(`process.exit called with code ${code}`);
});

// Note: For true integration tests, you should:
// 1. Set up a test database (SQLite recommended for speed)
// 2. Run migrations before tests
// 3. Clean up data between tests
// 4. See the testing guide for complete setup instructions
