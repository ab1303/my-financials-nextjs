import { beforeEach, describe, expect, it, vi } from 'vitest';
import { appRouter } from '../../../server/trpc/router/_app';
import { prismaMock } from '../../mocks/prisma.mock';

describe('expenseCategory router', () => {
  const caller = appRouter.createCaller({
    prisma: prismaMock,
    session: { user: { id: 'user_1' } },
  } as any);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates new category', async () => {
    prismaMock.expenseCategory.findFirst.mockResolvedValue(null);
    prismaMock.expenseCategory.create.mockResolvedValue({
      id: '1',
      name: 'Food',
      isActive: true,
    } as any);

    await expect(caller.expenseCategory.create({ name: 'Food' })).resolves.toEqual({
      id: '1',
      name: 'Food',
      isActive: true,
    });
  });

  it('remove soft-deletes in-use category', async () => {
    prismaMock.monthlyExpenseSummary.count.mockResolvedValue(1);
    prismaMock.expenseCategory.update.mockResolvedValue({ id: '1', isActive: false } as any);

    await expect(caller.expenseCategory.remove({ id: '1' })).resolves.toEqual({ softDeleted: true });
    expect(prismaMock.expenseCategory.update).toHaveBeenCalledWith({
      where: { id: '1' },
      data: { isActive: false },
    });
  });
});
