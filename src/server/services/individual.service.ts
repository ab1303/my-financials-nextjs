import { prisma } from '../utils/prisma';

import type {
  IndividualSlimCreateModel,
  IndividualSlimModel,
} from '../models/individual';

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

export const getIndividuals = async (): Promise<IndividualSlimModel[]> => {
  const individuals = await prisma.individual.findMany();
  return individuals.map((indv) => ({
    id: indv.id,
    firstName: indv.firstName || '',
    lastName: indv.lastName || '',
    name: indv.name,
  }));
};
