import { router, protectedProcedure } from '@/server/trpc/trpc';
import {
  createIndividualBeneficiaryOuputSchema,
  createIndividualBeneficiarySchema,
} from '@/server/schema/individual.schema';
import { createIndividualBeneficiaryHandler } from '@/server/controllers/individual.controller';

export const individualRouter = router({
  addIndividualBeneficiary: protectedProcedure
    .input(createIndividualBeneficiarySchema)
    .output(createIndividualBeneficiaryOuputSchema)
    .mutation(({ input: { name }, ctx: { session } }) =>
      createIndividualBeneficiaryHandler(name, session.user.id)
    ),
});
