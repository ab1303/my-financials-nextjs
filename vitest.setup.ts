import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// Mock environment variables for testing
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.NEXTAUTH_SECRET = 'test-secret';
process.env.NEXTAUTH_URL = 'http://localhost:3000';
process.env.NODE_ENV = 'test';

// Mock process.exit to prevent tests from killing the process
vi.spyOn(process, 'exit').mockImplementation((code?: number) => {
  throw new Error(`process.exit called with code ${code}`);
});
