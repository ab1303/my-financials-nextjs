import { describe, it, expect } from 'vitest';
import {
  getTaxCategoryLabel,
  getDonationPurposeLabel,
  calculateBreakdownTotals,
} from '@/app/(authorized)/cashflow/_utils/charity-tax';
import type { DonationPaymentType } from '@/app/(authorized)/cashflow/donations/_types';
import type { ZakatPaymentType } from '@/app/(authorized)/zakat/_types';
import { DonationPurposeEnum } from '@prisma/client';

describe('charity-tax-display helpers', () => {
  describe('getTaxCategoryLabel', () => {
    it('should return "Deductible (DGR)" for DEDUCTIBLE status', () => {
      const result = getTaxCategoryLabel('DEDUCTIBLE');
      expect(result).toBe('Deductible (DGR)');
    });

    it('should return "Non-Deductible" for NON_DEDUCTIBLE status', () => {
      const result = getTaxCategoryLabel('NON_DEDUCTIBLE');
      expect(result).toBe('Non-Deductible');
    });

    it('should return the status as-is for unknown values', () => {
      const result = getTaxCategoryLabel('UNKNOWN_STATUS');
      expect(result).toBe('UNKNOWN_STATUS');
    });

    it('should handle empty string', () => {
      const result = getTaxCategoryLabel('');
      expect(result).toBe('');
    });
  });

  describe('getDonationPurposeLabel', () => {
    it('should return "Voluntary" for VOLUNTARY purpose', () => {
      const result = getDonationPurposeLabel(DonationPurposeEnum.VOLUNTARY);
      expect(result).toBe('Voluntary');
    });

    it('should return "Interest Cleansing" for INTEREST_CLEANSING purpose', () => {
      const result = getDonationPurposeLabel(DonationPurposeEnum.INTEREST_CLEANSING);
      expect(result).toBe('Interest Cleansing');
    });

    it('should return "Zakat" for ZAKAT purpose', () => {
      const result = getDonationPurposeLabel(DonationPurposeEnum.ZAKAT);
      expect(result).toBe('Zakat');
    });
  });

  describe('calculateBreakdownTotals', () => {
    it('should calculate correct breakdown totals for donations', () => {
      const payments: DonationPaymentType[] = [
        {
          id: '1',
          datePaid: new Date('2024-01-01'),
          amount: 1000,
          beneficiaryType: 'BUSINESS' as const,
          taxCategory: 'DEDUCTIBLE',
          donationPurpose: DonationPurposeEnum.VOLUNTARY,
          beneficiaryId: 'biz-1',
        },
        {
          id: '2',
          datePaid: new Date('2024-01-02'),
          amount: 500,
          beneficiaryType: 'INDIVIDUAL' as const,
          taxCategory: 'NON_DEDUCTIBLE',
          donationPurpose: DonationPurposeEnum.VOLUNTARY,
          beneficiaryId: 'ind-1',
        },
        {
          id: '3',
          datePaid: new Date('2024-01-03'),
          amount: 200,
          beneficiaryType: 'BUSINESS' as const,
          taxCategory: 'DEDUCTIBLE',
          donationPurpose: DonationPurposeEnum.INTEREST_CLEANSING,
          beneficiaryId: 'biz-2',
        },
      ];

      const result = calculateBreakdownTotals('donation', payments as any);

      expect(result).toEqual({
        voluntaryDeductible: 1000,
        voluntaryNonDeductible: 500,
        interestCleansingDeductible: 200,
        interestCleansingNonDeductible: 0,
        totalDeductible: 1200,
        totalNonDeductible: 500,
        total: 1700,
      });
    });

    it('should calculate correct breakdown totals for zakat', () => {
      const payments: ZakatPaymentType[] = [
        {
          id: '1',
          datePaid: new Date('2024-01-01'),
          amount: 1000,
          beneficiaryType: 'BUSINESS' as const,
          taxCategory: 'DEDUCTIBLE',
          beneficiaryId: 'biz-1',
        },
        {
          id: '2',
          datePaid: new Date('2024-01-02'),
          amount: 500,
          beneficiaryType: 'INDIVIDUAL' as const,
          taxCategory: 'NON_DEDUCTIBLE',
          beneficiaryId: 'ind-1',
        },
      ];

      const result = calculateBreakdownTotals('zakat', payments as any);

      expect(result).toEqual({
        totalDeductible: 1000,
        totalNonDeductible: 500,
        total: 1500,
      });
    });

    it('should handle empty payment array for donations', () => {
      const result = calculateBreakdownTotals('donation', []);

      expect(result).toEqual({
        voluntaryDeductible: 0,
        voluntaryNonDeductible: 0,
        interestCleansingDeductible: 0,
        interestCleansingNonDeductible: 0,
        totalDeductible: 0,
        totalNonDeductible: 0,
        total: 0,
      });
    });

    it('should handle empty payment array for zakat', () => {
      const result = calculateBreakdownTotals('zakat', []);

      expect(result).toEqual({
        totalDeductible: 0,
        totalNonDeductible: 0,
        total: 0,
      });
    });

    it('should handle payments with default/missing purpose for donations', () => {
      const payments: DonationPaymentType[] = [
        {
          id: '1',
          datePaid: new Date('2024-01-01'),
          amount: 100,
          beneficiaryType: 'BUSINESS' as const,
          taxCategory: 'DEDUCTIBLE',
          donationPurpose: undefined,
          beneficiaryId: 'biz-1',
        },
      ];

      const result = calculateBreakdownTotals('donation', payments as any);

      expect(result.voluntaryDeductible).toBe(100);
      expect(result.total).toBe(100);
    });
  });
});
