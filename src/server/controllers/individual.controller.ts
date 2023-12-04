import { addIndividualBeneficiary } from '@/server/services/individual.service';
import { handleCaughtError } from '@/server/utils/prisma';

export const createIndividualBeneficiaryHandler = async (
  name: string,
  userId: string
) => {
  try {
    const trimmedNames = name.split(' ').map((n) => n.trim());

    const [firstName, ...lastName] = trimmedNames;
    const beneficiary = await addIndividualBeneficiary({
      name,
      firstName: firstName || '',
      lastName: lastName.join(' '),
      userId: userId,
    });
    return { beneficiaryId: beneficiary.id };
  } catch (e) {
    handleCaughtError(e);

    return { beneficiaryId: '' };
  }
};
