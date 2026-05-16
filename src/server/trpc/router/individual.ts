import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '@/server/trpc/trpc';
import {
  allIndividualDetailsHandler,
  addIndividualDetailsHandler,
  updateIndividualDetailsHandler,
  removeIndividualDetailsHandler,
} from '@/server/controllers/individual.controller';
import {
  createIndividualSchema,
  updateIndividualSchema,
  params,
  createRelationshipSchema,
  relationshipParams,
} from '@/server/schema/individual.schema';
import { getRelationships } from '@/server/services/relationship.service';

export const individualRouter = router({
  // Quick-create: name only — used by CreateBeneficiaryModal in the donation linking drawer
  create: protectedProcedure
    .input(z.object({ name: z.string().min(1, 'Name is required') }))
    .mutation(async ({ input, ctx }) => {
      const result = await addIndividualDetailsHandler({
        input: { name: input.name, addressFormat: 'AU' },
        userId: ctx.session.user.id,
      });
      const individual = result?.data?.individual;
      if (!individual) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to create individual' });
      }
      return { id: individual.id, name: individual.name };
    }),

  // Individual CRUD operations
  saveIndividualDetails: protectedProcedure
    .input(createIndividualSchema)
    .mutation(({ input, ctx: { session } }) =>
      addIndividualDetailsHandler({ input, userId: session.user.id }),
    ),

  updateIndividualDetails: protectedProcedure
    .input(updateIndividualSchema)
    .mutation(({ input, ctx: { session } }) =>
      updateIndividualDetailsHandler({ input, userId: session.user.id }),
    ),

  getAllIndividuals: protectedProcedure.query(({ ctx: { session } }) => {
    return allIndividualDetailsHandler(session.user.id);
  }),

  removeIndividualDetails: protectedProcedure
    .input(params)
    .mutation(({ input }) => removeIndividualDetailsHandler({ params: input })),

  // Relationship management operations
  getAllRelationships: protectedProcedure.query(({ ctx: { session } }) => {
    return getRelationships({ userId: session.user.id });
  }),
});
