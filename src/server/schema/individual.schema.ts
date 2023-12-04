import { object, string } from 'zod';

// Individual Beneficiary
export const createIndividualBeneficiarySchema = object({
  name: string({ required_error: 'Individual beneficiary name is required' }),
});

export const createIndividualBeneficiaryOuputSchema = object({
  beneficiaryId: string(),
});
