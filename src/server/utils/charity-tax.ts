import { prisma } from './prisma';
import type { BeneficiaryEnumType } from '@prisma/client';

/**
 * Derives the tax category (DEDUCTIBLE or NON_DEDUCTIBLE) for a donation or zakat payment
 * based on the beneficiary's DGR (Deductible Gift Recipient) registration status.
 *
 * - If beneficiary is a BUSINESS and DGR-registered: returns "DEDUCTIBLE"
 * - If beneficiary is an INDIVIDUAL: always returns "NON_DEDUCTIBLE" (DGR only applies to organisations)
 * - If beneficiary is a BUSINESS and not DGR-registered or not found: returns "NON_DEDUCTIBLE"
 *
 * @param beneficiaryId - The ID of the beneficiary (Business or Individual)
 * @param beneficiaryType - The type of beneficiary: "BUSINESS" or "INDIVIDUAL"
 * @param userId - Optional user ID (for potential future filtering)
 * @returns "DEDUCTIBLE" or "NON_DEDUCTIBLE"
 */
export async function deriveTaxCategory(
  beneficiaryId: string,
  beneficiaryType: BeneficiaryEnumType,
  userId?: string
): Promise<string> {
  try {
    // DGR status only applies to BUSINESS beneficiaries, not INDIVIDUAL
    if (beneficiaryType === 'BUSINESS') {
      const business = await prisma.business.findUnique({
        where: { id: beneficiaryId },
      });

      if (business?.isDgrRegistered === true) {
        return 'DEDUCTIBLE';
      }
    } else if (beneficiaryType === 'INDIVIDUAL') {
      // Individuals are never DGR-registered; donations to individuals are always non-deductible
      return 'NON_DEDUCTIBLE';
    }

    // If beneficiary not found, not DGR-registered, or any other case: non-deductible
    return 'NON_DEDUCTIBLE';
  } catch (error) {
    // On error, default to non-deductible for safety
    console.error('Error deriving tax category:', error);
    return 'NON_DEDUCTIBLE';
  }
}
