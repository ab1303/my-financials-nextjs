import { type DeepMockProxy, mockDeep, mockReset } from 'vitest-mock-extended';
import { vi, beforeEach } from 'vitest';
import type { PrismaClient } from '@prisma/client';

// Create the mock instance
export const prismaMock = mockDeep<PrismaClient>();

// Reset mock before each test
beforeEach(() => {
  mockReset(prismaMock);
});

// Mock the Prisma module globally
// This call will be hoisted if imported correctly
vi.mock('@/server/utils/prisma', () => ({
  __esModule: true,
  prisma: prismaMock,
  handleCaughtError: vi.fn((e) => {
    // In tests, we want to allow the controller catch block to handle the error
    // instead of throwing it out of the handler
    // In production, handleCaughtError throws a TRPCError
  }),
  handleDatabaseError: vi.fn((e) => ({
    success: false,
    error: e instanceof Error ? e.message : 'Database error',
  })),
}));
