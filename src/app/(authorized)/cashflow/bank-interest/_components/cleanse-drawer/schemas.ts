import { BeneficiaryEnumType } from '@prisma/client';
import { z } from 'zod';

export const linkedModeSchema = z.object({
  beneficiaryType: z.nativeEnum(BeneficiaryEnumType),
  beneficiaryId: z.string().min(1, 'Please select a beneficiary'),
});

export const manualModeSchema = z.object({
  datePaid: z.string().min(1, 'Date is required'),
  amount: z
    .number({ required_error: 'Amount is required' })
    .positive('Must be greater than 0'),
  beneficiaryType: z.nativeEnum(BeneficiaryEnumType),
  beneficiaryId: z.string().min(1, 'Please select a beneficiary'),
});

export function getDefaultLinkedValues() {
  return {
    beneficiaryType: BeneficiaryEnumType.INDIVIDUAL,
    beneficiaryId: '',
  };
}

export function getDefaultManualValues() {
  return {
    datePaid: '',
    amount: 0,
    beneficiaryType: BeneficiaryEnumType.INDIVIDUAL,
    beneficiaryId: '',
  };
}
