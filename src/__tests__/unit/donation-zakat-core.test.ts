import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/server/db/client', () => ({
  prisma: {
    voluntaryDonation: {
      create: vi.fn(),
      update: vi.fn(),
    },
    zakatPayment: {
      create: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
    },
  },
  handleCaughtError: vi.fn(),
}));

import {
  addVoluntaryDonation,
  updateVoluntaryDonation,
} from '@/server/services/voluntary-donations/voluntary-donation.service';
import {
  addZakatPaymentDetail,
  getZakatTotalsByCategory,
  updateZakatPayment,
} from '@/server/services/zakat/zakat.service';
import { prisma } from '@/server/db/client';

describe('donation-zakat-core', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('creates voluntary donation payments', async () => {
    (prisma.voluntaryDonation.create as any).mockResolvedValue({
      id: 'donation-1',
      datePaid: new Date('2025-01-15'),
      amount: 1000,
      beneficiaryType: 'BUSINESS',
      businessId: 'biz-1',
      individualId: null,
      donationLedgerId: 'ledger-1',
      purpose: 'VOLUNTARY',
    });

    const result = await addVoluntaryDonation({
      donationLedgerId: 'ledger-1',
      datePaid: new Date('2025-01-15'),
      amount: 1000,
      beneficiaryType: 'BUSINESS' as const,
      beneficiaryId: 'biz-1',
      donationPurpose: 'VOLUNTARY',
    });

    expect(result.id).toBe('donation-1');
    expect(prisma.voluntaryDonation.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        donationLedgerId: 'ledger-1',
        businessId: 'biz-1',
      }),
    });
  });

  it('updates voluntary donation payments', async () => {
    (prisma.voluntaryDonation.update as any).mockResolvedValue({
      id: 'donation-1',
      purpose: 'VOLUNTARY',
    });

    await updateVoluntaryDonation('donation-1', {
      donationLedgerId: 'ledger-1',
      datePaid: new Date('2025-02-01'),
      amount: 2000,
      beneficiaryType: 'BUSINESS' as const,
      beneficiaryId: 'biz-2',
    });

    expect(prisma.voluntaryDonation.update).toHaveBeenCalledWith({
      where: { id: 'donation-1' },
      data: {
        datePaid: new Date('2025-02-01'),
        amount: 2000,
        beneficiaryType: 'BUSINESS',
        businessId: 'biz-2',
        individualId: null,
      },
    });
  });

  it('creates zakat payments with derived deductibility', async () => {
    (prisma.zakatPayment.create as any).mockResolvedValue({
      id: 'zakat-1',
      datePaid: new Date('2025-03-10'),
      amount: { toNumber: () => 750 },
      beneficiaryType: 'BUSINESS',
      businessId: 'biz-3',
      individualId: null,
      zakatObligationId: 'zakat-ledger-1',
      business: { isDgrRegistered: false },
      individual: null,
    });

    const result = await addZakatPaymentDetail('zakat-ledger-1', {
      datePaid: new Date('2025-03-10'),
      amount: 750,
      beneficiaryType: 'BUSINESS' as const,
      beneficiaryId: 'biz-3',
    });

    expect(result.isDeductible).toBe(false);
    expect(prisma.zakatPayment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        zakatObligationId: 'zakat-ledger-1',
        businessId: 'biz-3',
      }),
      include: {
        business: true,
        individual: true,
      },
    });
  });

  it('updates zakat payments without storing tax category', async () => {
    await updateZakatPayment(
      'zakat-1',
      {
        id: 'zakat-1',
        datePaid: new Date('2025-04-01'),
        amount: 1500,
        beneficiaryType: 'INDIVIDUAL' as const,
        beneficiaryId: 'ind-3',
        zakatObligationId: 'zakat-ledger-1',
      },
    );

    expect(prisma.zakatPayment.update).toHaveBeenCalledWith({
      where: { id: 'zakat-1' },
      data: {
        datePaid: new Date('2025-04-01'),
        amount: 1500,
        beneficiaryType: 'INDIVIDUAL',
        businessId: null,
        individualId: 'ind-3',
      },
    });
  });

  it('calculates zakat totals from derived deductibility', async () => {
    (prisma.zakatPayment.findMany as any).mockResolvedValue([
      {
        amount: { toNumber: () => 5000 },
        business: { isDgrRegistered: true },
      },
      {
        amount: { toNumber: () => 1000 },
        business: { isDgrRegistered: false },
      },
    ]);

    const result = await getZakatTotalsByCategory('year-1');

    expect(result).toEqual({
      deductibleTotal: 5000,
      nonDeductibleTotal: 1000,
    });
  });
});
