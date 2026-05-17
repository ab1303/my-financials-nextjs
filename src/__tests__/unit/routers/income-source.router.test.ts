import { beforeEach, describe, expect, it, vi } from 'vitest';
import { appRouter } from '../../../server/trpc/router/_app';
import { prismaMock } from '../../mocks/prisma.mock';

describe('incomeSource router', () => {
  const caller = appRouter.createCaller({
    prisma: prismaMock,
    session: { user: { id: 'user_1' } },
  } as any);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getAll returns all sources with usageCount', async () => {
    prismaMock.incomeSource.findMany.mockResolvedValue([
      {
        id: '1',
        name: 'Salary',
        isActive: true,
        _count: { incomeRecords: 2 },
      },
      {
        id: '2',
        name: 'Freelance',
        isActive: false,
        _count: { incomeRecords: 0 },
      },
    ] as any);

    await expect(caller.incomeSource.getAll()).resolves.toEqual([
      { id: '1', name: 'Salary', isActive: true, usageCount: 2 },
      { id: '2', name: 'Freelance', isActive: false, usageCount: 0 },
    ]);
  });

  it('create rejects duplicate name', async () => {
    prismaMock.incomeSource.findFirst.mockResolvedValue({ id: '1', name: 'Salary' } as any);

    await expect(caller.incomeSource.create({ name: 'Salary' })).rejects.toMatchObject({
      code: 'CONFLICT',
      message: 'An income source with this name already exists',
    });
  });

  it('remove soft-deletes when usageCount > 0', async () => {
    prismaMock.incomeRecord.count.mockResolvedValue(3);
    prismaMock.incomeSource.update.mockResolvedValue({ id: '1', isActive: false } as any);

    await expect(caller.incomeSource.remove({ id: '1' })).resolves.toEqual({ softDeleted: true });
    expect(prismaMock.incomeSource.update).toHaveBeenCalledWith({
      where: { id: '1' },
      data: { isActive: false },
    });
  });

  it('remove hard-deletes when usageCount === 0', async () => {
    prismaMock.incomeRecord.count.mockResolvedValue(0);
    prismaMock.incomeSource.delete.mockResolvedValue({ id: '1' } as any);

    await expect(caller.incomeSource.remove({ id: '1' })).resolves.toEqual({ softDeleted: false });
    expect(prismaMock.incomeSource.delete).toHaveBeenCalledWith({ where: { id: '1' } });
  });
});
