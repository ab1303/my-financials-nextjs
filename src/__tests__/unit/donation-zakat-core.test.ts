import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

vi.mock('@/server/utils/prisma', () => ({
  prisma: {
    donationLedger: {
      create: vi.fn(),
      findUnique: vi.fn(),
    },
    donationPayment: {
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      findMany: vi.fn(),
      aggregate: vi.fn(),
    },
    zakatObligation: {
      create: vi.fn(),
      findUnique: vi.fn(),
    },
    zakatPayment: {
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      findMany: vi.fn(),
      aggregate: vi.fn(),
    },
  },
  handleCaughtError: vi.fn(),
}));

import { prisma } from '@/server/utils/prisma';
import {
  addDonationPaymentDetail,
  updateDonationPayment,
  getDonationTotalsByCategory,
} from '@/server/services/donation.service';
import {
  addZakatPaymentDetail,
  updateZakatPayment,
  getZakatTotalsByCategory,
} from '@/server/services/zakat.service';

describe('donation-zakat-core', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('creates donation payments with derived deductibility', async () => {
    (prisma.donationPayment.create as any).mockResolvedValue({
      id: 'donation-1',
      datePaid: new Date('2025-01-15'),
      amount: { toNumber: () => 1000 },
      beneficiaryType: 'BUSINESS',
      businessId: 'biz-1',
      individualId: null,
      donationLedgerId: 'ledger-1',
      transactionId: null,
      donationPurpose: 'VOLUNTARY',
      business: { isDgrRegistered: true },
      individual: null,
    });

    const result = await addDonationPaymentDetail('ledger-1', {
      datePaid: new Date('2025-01-15'),
      amount: 1000,
      beneficiaryType: 'BUSINESS' as const,
      beneficiaryId: 'biz-1',
      donationPurpose: 'VOLUNTARY',
    });

    expect(result.isDeductible).toBe(true);
    expect(prisma.donationPayment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        donationLedgerId: 'ledger-1',
        businessId: 'biz-1',
        donationPurpose: 'VOLUNTARY',
      }),
      include: {
        business: true,
        individual: true,
      },
    });
  });

  it('updates donation payments without storing tax category', async () => {
    await updateDonationPayment(
      {
        id: 'donation-1',
        datePaid: new Date('2025-02-01'),
        amount: 2000,
        beneficiaryType: 'BUSINESS' as const,
        beneficiaryId: 'biz-2',
      },
      'donation-1',
    );

    expect(prisma.donationPayment.update).toHaveBeenCalledWith({
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

  it('calculates donation totals from purpose and derived deductibility', async () => {
    (prisma.donationPayment.findMany as any).mockResolvedValue([
      {
        amount: { toNumber: () => 1000 },
        donationPurpose: 'VOLUNTARY',
        business: { isDgrRegistered: true },
      },
      {
        amount: { toNumber: () => 500 },
        donationPurpose: 'INTEREST_CLEANSING',
        business: { isDgrRegistered: false },
      },
    ]);

    const result = await getDonationTotalsByCategory('year-1');

    expect(result).toEqual({
      voluntaryTotal: 1000,
      interestCleansingTotal: 500,
      deductibleTotal: 1000,
      nonDeductibleTotal: 500,
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
      {
        id: 'zakat-1',
        datePaid: new Date('2025-04-01'),
        amount: 1500,
        beneficiaryType: 'INDIVIDUAL' as const,
        beneficiaryId: 'ind-3',
      },
      'zakat-1',
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
