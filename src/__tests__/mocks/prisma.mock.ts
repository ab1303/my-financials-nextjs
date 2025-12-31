import { type DeepMockProxy, mockDeep, mockReset } from 'vitest-mock-extended';

import { prisma } from '@/server/utils/prisma';

import type { PrismaClient } from '@prisma/client';

// Mock the Prisma client
vi.mock('@/server/utils/prisma', () => ({
  __esModule: true,
  prisma: mockDeep<PrismaClient>(),
}));

beforeEach(() => {
  mockReset(prismaMock);
});

export const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;
