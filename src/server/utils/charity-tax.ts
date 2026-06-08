import type { BeneficiaryEnumType } from '@prisma/client';

import { prisma } from './prisma';

/**
 * Derives whether a donation or zakat payment is deductible
 * based on the beneficiary's DGR (Deductible Gift Recipient) registration status.
 *
 * - If beneficiary is a BUSINESS and DGR-registered: returns "DEDUCTIBLE"
 * - If beneficiary is an INDIVIDUAL: always returns "NON_DEDUCTIBLE" (DGR only applies to organisations)
 * - If beneficiary is a BUSINESS and not DGR-registered or not found: returns "NON_DEDUCTIBLE"
 *
 * @param beneficiaryId - The ID of the beneficiary (Business or Individual)
 * @param beneficiaryType - The type of beneficiary: "BUSINESS" or "INDIVIDUAL"
 * @param userId - Optional user ID (for potential future filtering)
 * @returns true when deductible, false otherwise
 */
export async function deriveIsDeductible(
  beneficiaryId: string,
  beneficiaryType: BeneficiaryEnumType,
): Promise<boolean> {
  // DGR status only applies to BUSINESS beneficiaries, not INDIVIDUAL
  if (beneficiaryType === 'INDIVIDUAL') {
    return false;
  }

  const business = await prisma.business.findUnique({
    where: { id: beneficiaryId },
    select: { isDgrRegistered: true },
  });

  return business?.isDgrRegistered === true;
}

export function getDeductibilityLabel(isDeductible: boolean): string {
  return isDeductible ? 'Deductible (DGR)' : 'Non-Deductible';
}

// Backwards-compatible alias for UI code migrating off taxCategory naming.
export function getTaxCategoryLabel(taxCategoryOrFlag: string | boolean): string {
  const isDeductible =
    typeof taxCategoryOrFlag === 'boolean'
      ? taxCategoryOrFlag
      : taxCategoryOrFlag === 'DEDUCTIBLE';
  return getDeductibilityLabel(isDeductible);
}
