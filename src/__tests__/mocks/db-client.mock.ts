import type { PrismaClient } from '@prisma/client';
import { beforeEach,vi } from 'vitest';
import { mockDeep, mockReset } from 'vitest-mock-extended';

export const dbClientMock = mockDeep<PrismaClient>();

beforeEach(() => {
  mockReset(dbClientMock);
});

vi.mock('@/server/db/client', () => ({
  __esModule: true,
  prisma: dbClientMock,
}));
