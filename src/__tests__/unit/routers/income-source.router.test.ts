import { beforeEach, describe, expect, it, vi } from 'vitest';

import { appRouter } from '../../../server/trpc/router/_app';
import { prismaMock } from '../../mocks/prisma.mock';

type CallerContext = Parameters<typeof appRouter.createCaller>[0];

const createIncomeSource = (
  overrides?: Partial<{
    id: string;
    name: string;
    description: string | null;
    isActive: boolean;
    createdAt: Date;
  }>,
) => ({
  id: '1',
  name: 'Salary',
  description: null,
  isActive: true,
  createdAt: new Date('2024-01-01'),
  ...overrides,
});

describe('incomeSource router', () => {
  const caller = appRouter.createCaller({
    prisma: prismaMock,
    session: { user: { id: 'user_1' } },
  } as unknown as CallerContext);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getAll returns all sources with usageCount', async () => {
    prismaMock.incomeSource.findMany.mockResolvedValue([
      createIncomeSource({ id: '1', name: 'Salary', isActive: true }),
      createIncomeSource({ id: '2', name: 'Freelance', isActive: false }),
    ] as never);

    vi.mocked(prismaMock.transaction.groupBy).mockResolvedValue([
      { category: 'Salary', _count: { category: 2 } },
      { category: 'Freelance', _count: { category: 0 } },
    ] as never);

    await expect(caller.incomeSource.getAll()).resolves.toEqual([
      {
        id: '1',
        name: 'Salary',
        description: undefined,
        isActive: true,
        usageCount: 2,
      },
      {
        id: '2',
        name: 'Freelance',
        description: undefined,
        isActive: false,
        usageCount: 0,
      },
    ]);
  });

  it('getAll with no transactions returns usageCount 0', async () => {
    prismaMock.incomeSource.findMany.mockResolvedValue([
      createIncomeSource({ id: '1', name: 'Salary', isActive: true }),
    ] as never);

    vi.mocked(prismaMock.transaction.groupBy).mockResolvedValue([] as never);

    await expect(caller.incomeSource.getAll()).resolves.toEqual([
      {
        id: '1',
        name: 'Salary',
        description: undefined,
        isActive: true,
        usageCount: 0,
      },
    ]);
  });

  it('remove soft-deletes when transaction count > 0', async () => {
    prismaMock.incomeSource.findUnique.mockResolvedValue({
      name: 'Salary',
    } as never);
    prismaMock.transaction.count.mockResolvedValue(3);
    prismaMock.incomeSource.update.mockResolvedValue({
      id: '1',
      isActive: false,
    } as never);

    await expect(caller.incomeSource.remove({ id: '1' })).resolves.toEqual({
      softDeleted: true,
    });
    expect(prismaMock.incomeSource.update).toHaveBeenCalledWith({
      where: { id: '1' },
      data: { isActive: false },
    });
  });

  it('remove hard-deletes when transaction count === 0', async () => {
    prismaMock.incomeSource.findUnique.mockResolvedValue({
      name: 'Salary',
    } as never);
    prismaMock.transaction.count.mockResolvedValue(0);
    prismaMock.incomeSource.delete.mockResolvedValue(
      createIncomeSource({ id: '1' }) as never,
    );

    await expect(caller.incomeSource.remove({ id: '1' })).resolves.toEqual({
      softDeleted: false,
    });
    expect(prismaMock.incomeSource.delete).toHaveBeenCalledWith({
      where: { id: '1' },
    });
  });

  it('remove throws NOT_FOUND when source does not exist', async () => {
    prismaMock.incomeSource.findUnique.mockResolvedValue(null);

    await expect(
      caller.incomeSource.remove({ id: 'bad-id' }),
    ).rejects.toMatchObject({
      code: 'NOT_FOUND',
      message: 'Income source not found',
    });
  });

  it('create rejects duplicate name', async () => {
    prismaMock.incomeSource.findFirst.mockResolvedValue({
      id: '1',
      name: 'Salary',
    } as never);

    await expect(
      caller.incomeSource.create({ name: 'Salary' }),
    ).rejects.toMatchObject({
      code: 'CONFLICT',
      message: 'An income source with this name already exists',
    });
  });
});
