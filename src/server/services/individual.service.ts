import { prisma } from '../utils/prisma';

import type { IndividualSlimCreateModel } from '../models/individual';

export const addIndividualBeneficiary = async ({
  name,
  firstName,
  lastName,
  userId,
}: IndividualSlimCreateModel) => {
  return await prisma.individual.create({
    data: {
      name,
      firstName,
      lastName,
      userId,
    },
  });
};
