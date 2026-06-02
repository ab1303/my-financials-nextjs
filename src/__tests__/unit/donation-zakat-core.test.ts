import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// Mock prisma and charity-tax helper
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
    business: {
      findUnique: vi.fn(),
    },
  },
  handleCaughtError: vi.fn(),
}));

vi.mock('@/server/utils/charity-tax', () => ({
  deriveTaxCategory: vi.fn(),
}));

import { prisma } from '@/server/utils/prisma';
import { deriveTaxCategory } from '@/server/utils/charity-tax';
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

  describe('addDonationPaymentDetail', () => {
    it('should create a donation payment with derived tax category', async () => {
      // Arrange
      const donationLedgerId = 'ledger-123';
      const payment = {
        datePaid: new Date('2025-01-15'),
        amount: 1000,
        beneficiaryType: 'BUSINESS' as const,
        beneficiaryId: 'biz-123',
        donationPurpose: 'VOLUNTARY' as const,
      };

      (deriveTaxCategory as any).mockResolvedValue('DEDUCTIBLE');
      (prisma.donationPayment.create as any).mockResolvedValue({
        id: 'donation-123',
        datePaid: payment.datePaid,
        amount: payment.amount,
        beneficiaryType: payment.beneficiaryType,
        taxCategory: 'DEDUCTIBLE',
        donationPurpose: payment.donationPurpose,
        businessId: 'biz-123',
        individualId: null,
        donationLedgerId,
        transactionId: null,
      });

      // Act
      const result = await addDonationPaymentDetail(donationLedgerId, payment);

      // Assert
      expect(deriveTaxCategory).toHaveBeenCalledWith(
        'biz-123',
        'BUSINESS'
      );
      expect(prisma.donationPayment.create).toHaveBeenCalledWith({
        data: {
          donationLedgerId,
          datePaid: payment.datePaid,
          amount: payment.amount,
          beneficiaryType: payment.beneficiaryType,
          taxCategory: 'DEDUCTIBLE',
          businessId: 'biz-123',
          individualId: null,
          transactionId: null,
          donationPurpose: 'VOLUNTARY',
        },
      });
      expect(result.taxCategory).toBe('DEDUCTIBLE');
    });

    it('should handle INTEREST_CLEANSING purpose with individual beneficiary as non-deductible', async () => {
      // Arrange
      const donationLedgerId = 'ledger-123';
      const payment = {
        datePaid: new Date('2025-02-15'),
        amount: 500,
        beneficiaryType: 'INDIVIDUAL' as const,
        beneficiaryId: 'ind-456',
        donationPurpose: 'INTEREST_CLEANSING' as const,
      };

      // Individuals are always non-deductible
      (deriveTaxCategory as any).mockResolvedValue('NON_DEDUCTIBLE');
      (prisma.donationPayment.create as any).mockResolvedValue({
        id: 'donation-456',
        datePaid: payment.datePaid,
        amount: payment.amount,
        beneficiaryType: payment.beneficiaryType,
        taxCategory: 'NON_DEDUCTIBLE',
        donationPurpose: payment.donationPurpose,
        businessId: null,
        individualId: 'ind-456',
        donationLedgerId,
        transactionId: null,
      });

      // Act
      const result = await addDonationPaymentDetail(donationLedgerId, payment);

      // Assert
      expect(result.donationPurpose).toBe('INTEREST_CLEANSING');
      expect(result.taxCategory).toBe('NON_DEDUCTIBLE');
    });
  });

  describe('updateDonationPayment', () => {
    it('should update donation payment and re-derive tax category', async () => {
      // Arrange
      const paymentId = 'donation-123';
      const update = {
        id: paymentId,
        datePaid: new Date('2025-03-15'),
        amount: 2000,
        beneficiaryType: 'BUSINESS' as const,
        beneficiaryId: 'biz-789',
        taxCategory: 'will-be-overridden',
      };

      (deriveTaxCategory as any).mockResolvedValue('DEDUCTIBLE');

      // Act
      await updateDonationPayment(update, paymentId);

      // Assert
      expect(deriveTaxCategory).toHaveBeenCalledWith(
        'biz-789',
        'BUSINESS'
      );
      expect(prisma.donationPayment.update).toHaveBeenCalledWith({
        where: { id: paymentId },
        data: {
          datePaid: update.datePaid,
          amount: update.amount,
          beneficiaryType: update.beneficiaryType,
          taxCategory: 'DEDUCTIBLE',
          businessId: 'biz-789',
          individualId: null,
        },
      });
    });
  });

  describe('addZakatPaymentDetail', () => {
    it('should create a zakat payment with derived tax category', async () => {
      // Arrange
      const zakatId = 'zakat-obligation-123';
      const payment = {
        datePaid: new Date('2025-01-20'),
        amount: 750,
        beneficiaryType: 'BUSINESS' as const,
        beneficiaryId: 'biz-donor',
      };

      (deriveTaxCategory as any).mockResolvedValue('DEDUCTIBLE');
      (prisma.zakatPayment.create as any).mockResolvedValue({
        id: 'zakat-payment-123',
        datePaid: payment.datePaid,
        amount: payment.amount,
        beneficiaryType: payment.beneficiaryType,
        taxCategory: 'DEDUCTIBLE',
        businessId: 'biz-donor',
        individualId: null,
        zakatObligationId: zakatId,
        transactionId: null,
      });

      // Act
      const result = await addZakatPaymentDetail(zakatId, payment);

      // Assert
      expect(deriveTaxCategory).toHaveBeenCalledWith(
        'biz-donor',
        'BUSINESS'
      );
      expect(prisma.zakatPayment.create).toHaveBeenCalledWith({
        data: {
          zakatObligationId: zakatId,
          datePaid: payment.datePaid,
          amount: payment.amount,
          beneficiaryType: payment.beneficiaryType,
          taxCategory: 'DEDUCTIBLE',
          businessId: 'biz-donor',
          individualId: null,
          transactionId: null,
        },
      });
      expect(result.taxCategory).toBe('DEDUCTIBLE');
    });
  });

  describe('updateZakatPayment', () => {
    it('should update zakat payment and re-derive tax category for individual (always non-deductible)', async () => {
      // Arrange
      const paymentId = 'zakat-payment-456';
      const update = {
        id: paymentId,
        datePaid: new Date('2025-03-20'),
        amount: 1500,
        beneficiaryType: 'INDIVIDUAL' as const,
        beneficiaryId: 'ind-charity',
      };

      // Individuals are always non-deductible
      (deriveTaxCategory as any).mockResolvedValue('NON_DEDUCTIBLE');

      // Act
      await updateZakatPayment(update, paymentId);

      // Assert
      expect(deriveTaxCategory).toHaveBeenCalledWith(
        'ind-charity',
        'INDIVIDUAL'
      );
      expect(prisma.zakatPayment.update).toHaveBeenCalledWith({
        where: { id: paymentId },
        data: {
          datePaid: update.datePaid,
          amount: update.amount,
          beneficiaryType: update.beneficiaryType,
          taxCategory: 'NON_DEDUCTIBLE',
          businessId: null,
          individualId: 'ind-charity',
        },
      });
    });
  });

  describe('getDonationTotalsByCategory', () => {
    it('should return breakdown of donations by purpose and deductible status', async () => {
      // Arrange
      const calendarYearId = 'year-2025';
      (prisma.donationPayment.aggregate as any).mockResolvedValueOnce({
        _sum: { amount: { toNumber: () => 3000 } },
      });
      (prisma.donationPayment.aggregate as any).mockResolvedValueOnce({
        _sum: { amount: { toNumber: () => 1500 } },
      });
      (prisma.donationPayment.aggregate as any).mockResolvedValueOnce({
        _sum: { amount: { toNumber: () => 4000 } },
      });
      (prisma.donationPayment.aggregate as any).mockResolvedValueOnce({
        _sum: { amount: { toNumber: () => 500 } },
      });

      // Act
      const result = await getDonationTotalsByCategory(calendarYearId);

      // Assert
      expect(result).toEqual({
        voluntaryTotal: 3000,
        interestCleansingTotal: 1500,
        deductibleTotal: 4000,
        nonDeductibleTotal: 500,
      });
    });
  });

  describe('getZakatTotalsByCategory', () => {
    it('should return breakdown of zakat by deductible status', async () => {
      // Arrange
      const calendarYearId = 'year-2025';
      (prisma.zakatPayment.aggregate as any).mockResolvedValueOnce({
        _sum: { amount: { toNumber: () => 5000 } },
      });
      (prisma.zakatPayment.aggregate as any).mockResolvedValueOnce({
        _sum: { amount: { toNumber: () => 1000 } },
      });

      // Act
      const result = await getZakatTotalsByCategory(calendarYearId);

      // Assert
      expect(result).toEqual({
        deductibleTotal: 5000,
        nonDeductibleTotal: 1000,
      });
    });
  });
});
