import { DonationPurposeEnum } from '@prisma/client';
import { describe, expect,it } from 'vitest';

import {
  calculateBreakdownTotals,
  getDonationPurposeLabel,
  getTaxCategoryLabel,
} from '@/app/(authorized)/cashflow/_utils/charity-tax';
import type { DonationPaymentType } from '@/app/(authorized)/cashflow/donations/_types';
import type { ZakatPaymentType } from '@/app/(authorized)/zakat/_types';

describe('charity-tax-display helpers', () => {
  describe('getTaxCategoryLabel', () => {
    it('returns deductible label for true', () => {
      expect(getTaxCategoryLabel(true)).toBe('Deductible (DGR)');
    });

    it('returns non-deductible label for false', () => {
      expect(getTaxCategoryLabel(false)).toBe('Non-Deductible');
    });
  });

  describe('getDonationPurposeLabel', () => {
    it('returns human readable labels', () => {
      expect(getDonationPurposeLabel(DonationPurposeEnum.VOLUNTARY)).toBe('Voluntary');
      expect(getDonationPurposeLabel(DonationPurposeEnum.INTEREST_CLEANSING)).toBe('Interest Cleansing');
      expect(getDonationPurposeLabel(DonationPurposeEnum.ZAKAT)).toBe('Zakat');
    });
  });

  describe('calculateBreakdownTotals', () => {
    it('calculates donation breakdown from isDeductible', () => {
      const payments: DonationPaymentType[] = [
        {
          id: '1',
          datePaid: new Date('2024-01-01'),
          amount: 1000,
          beneficiaryType: 'BUSINESS' as const,
          isDeductible: true,
          donationPurpose: DonationPurposeEnum.VOLUNTARY,
          beneficiaryId: 'biz-1',
        },
        {
          id: '2',
          datePaid: new Date('2024-01-02'),
          amount: 500,
          beneficiaryType: 'INDIVIDUAL' as const,
          isDeductible: false,
          donationPurpose: DonationPurposeEnum.VOLUNTARY,
          beneficiaryId: 'ind-1',
        },
        {
          id: '3',
          datePaid: new Date('2024-01-03'),
          amount: 200,
          beneficiaryType: 'BUSINESS' as const,
          isDeductible: true,
          donationPurpose: DonationPurposeEnum.INTEREST_CLEANSING,
          beneficiaryId: 'biz-2',
        },
      ];

      expect(calculateBreakdownTotals('donation', payments)).toEqual({
        voluntaryDeductible: 1000,
        voluntaryNonDeductible: 500,
        interestCleansingDeductible: 200,
        interestCleansingNonDeductible: 0,
        totalDeductible: 1200,
        totalNonDeductible: 500,
        total: 1700,
      });
    });

    it('calculates zakat breakdown from isDeductible', () => {
      const payments: ZakatPaymentType[] = [
        {
          id: '1',
          datePaid: new Date('2024-01-01'),
          amount: 1000,
          beneficiaryType: 'BUSINESS' as const,
          isDeductible: true,
          beneficiaryId: 'biz-1',
        },
        {
          id: '2',
          datePaid: new Date('2024-01-02'),
          amount: 500,
          beneficiaryType: 'INDIVIDUAL' as const,
          isDeductible: false,
          beneficiaryId: 'ind-1',
        },
      ];

      expect(calculateBreakdownTotals('zakat', payments)).toEqual({
        totalDeductible: 1000,
        totalNonDeductible: 500,
        total: 1500,
      });
    });
  });
});
