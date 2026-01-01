import type { PrismaClient } from '@prisma/client';
import { mockDeep, mockReset, type DeepMockProxy } from 'vitest-mock-extended';

export type Context = {
  prisma: PrismaClient;
};

export type MockContext = {
  prisma: DeepMockProxy<PrismaClient>;
};

export const createMockContext = (): MockContext => {
  return {
    prisma: mockDeep<PrismaClient>(),
  };
};

let mockCtx: MockContext;

export const getMockContext = (): MockContext => {
  if (!mockCtx) {
    mockCtx = createMockContext();
  }
  return mockCtx;
};

export const resetMockContext = (): void => {
  if (mockCtx) {
    mockReset(mockCtx.prisma);
  }
};
