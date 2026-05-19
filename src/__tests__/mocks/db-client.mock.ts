import { mockDeep, mockReset } from 'vitest-mock-extended';
import { vi, beforeEach } from 'vitest';
import type { PrismaClient } from '@prisma/client';

export const dbClientMock = mockDeep<PrismaClient>();

beforeEach(() => {
  mockReset(dbClientMock);
});

vi.mock('@/server/db/client', () => ({
  __esModule: true,
  prisma: dbClientMock,
}));
