import { beforeEach,describe, expect, it, vi } from 'vitest';

vi.mock('@/server/utils/prisma', () => ({
  prisma: {
    business: {
      findUnique: vi.fn(),
    },
  },
}));

import { deriveIsDeductible, getTaxCategoryLabel } from '@/server/utils/charity-tax';
import { prisma } from '@/server/utils/prisma';

describe('charity-tax helper', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('derives deductibility from business DGR status', async () => {
    (prisma.business.findUnique as any).mockResolvedValue({ isDgrRegistered: true });
    await expect(deriveIsDeductible('biz-123', 'BUSINESS')).resolves.toBe(true);
    expect(prisma.business.findUnique).toHaveBeenCalledWith({
      where: { id: 'biz-123' },
      select: { isDgrRegistered: true },
    });
  });

  it('returns false for individuals', async () => {
    await expect(deriveIsDeductible('ind-1', 'INDIVIDUAL')).resolves.toBe(false);
  });

  it('formats deductibility labels', () => {
    expect(getTaxCategoryLabel(true)).toBe('Deductible (DGR)');
    expect(getTaxCategoryLabel(false)).toBe('Non-Deductible');
  });
});
